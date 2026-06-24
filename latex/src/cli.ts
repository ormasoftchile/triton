/**
 * triton-latex — render Triton diagrams to vector PDF for LaTeX `\includegraphics`.
 *
 * Commands:
 *   triton-latex render <input.triton|.mmd> -o <out.pdf|.svg> [--theme N] [--scale S]
 *   triton-latex render-dir <srcDir> -o <outDir> [--theme N] [--scale S]
 *
 * The CLI reuses the core compiler's `renderSync()` (SVG) and converts to vector
 * PDF via ./pdf.ts. It is editor-independent (no `vscode`) and never throws —
 * core returns a Result, which we surface as a clean exit code + message.
 *
 * Core is imported by RELATIVE PATH (the repo has no package `main`/`exports`);
 * esbuild bundles the whole compiler graph in. The PDF toolchain stays external.
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';

import { renderSync } from '../../src/frontend/index.js';
import { getThemePreset } from '../../src/theme/preset.js';
import { svgToPdf } from './pdf.js';

// ─── Arg parsing (tiny, dependency-free) ────────────────────────────────────────

interface Args {
  readonly command?: string;
  readonly positionals: string[];
  readonly out?: string;
  readonly theme?: string;
  readonly scale: number;
  readonly help: boolean;
}

function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  let out: string | undefined;
  let theme: string | undefined;
  let scale = 1;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case '-o':
      case '--out':
        out = argv[++i];
        break;
      case '--theme':
        theme = argv[++i];
        break;
      case '--scale':
        scale = Number(argv[++i]) || 1;
        break;
      case '-h':
      case '--help':
        help = true;
        break;
      default:
        positionals.push(a);
    }
  }

  return { command: positionals.shift(), positionals, out, theme, scale, help };
}

const USAGE = `triton-latex — render Triton diagrams to vector PDF for LaTeX.

Usage:
  triton-latex render <input.triton|.mmd> -o <out.pdf|.svg> [options]
  triton-latex render-dir <srcDir> -o <outDir> [options]

Options:
  -o, --out <path>   Output file (render) or output directory (render-dir).
  --theme <name>     Theme preset (default, executive, minimal, …).
  --scale <number>   Uniform scale for the PDF page box (default 1).
  -h, --help         Show this help.

Examples:
  triton-latex render diagram.mmd -o figures/diagram.pdf
  triton-latex render diagram.mmd -o diagram.svg          # SVG pass-through
  triton-latex render-dir diagrams/ -o figures/           # batch → *.pdf
`;

// ─── Rendering ──────────────────────────────────────────────────────────────────

const DIAGRAM_EXTS = new Set(['.triton', '.mmd']);

/** Render one source file to an SVG string, throwing a clean Error on failure. */
function renderToSvg(source: string, themeName?: string): string {
  const themeInput = themeName ? getThemePreset(themeName) : undefined;
  const result = renderSync(source, themeInput);
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

/** Render a single input file to a .pdf or .svg output. */
async function renderFile(
  inputPath: string,
  outPath: string,
  themeName: string | undefined,
  scale: number,
): Promise<void> {
  const source = readFileSync(inputPath, 'utf8');
  const svg = renderToSvg(source, themeName);

  // The inline LaTeX environment renders into a content-hashed cache dir
  // (e.g. `\jobname.triton-cache/<hash>.pdf`) that may not exist yet — single
  // `render` must create the parent directory, not just `render-dir`.
  mkdirSync(dirname(resolve(outPath)), { recursive: true });

  if (extname(outPath).toLowerCase() === '.svg') {
    writeFileSync(outPath, svg, 'utf8');
    return;
  }

  const pdf = await svgToPdf(svg, { scale });
  writeFileSync(outPath, pdf);
}

/** Batch-render every *.triton / *.mmd in srcDir to <name>.pdf in outDir. */
async function renderDir(
  srcDir: string,
  outDir: string,
  themeName: string | undefined,
  scale: number,
): Promise<{ rendered: number; failed: string[] }> {
  mkdirSync(outDir, { recursive: true });

  const entries = readdirSync(srcDir).filter((f) => {
    const full = join(srcDir, f);
    return statSync(full).isFile() && DIAGRAM_EXTS.has(extname(f).toLowerCase());
  });

  let rendered = 0;
  const failed: string[] = [];

  for (const file of entries) {
    const inputPath = join(srcDir, file);
    const name = basename(file, extname(file));
    const outPath = join(outDir, `${name}.pdf`);
    try {
      await renderFile(inputPath, outPath, themeName, scale);
      console.log(`  ✓ ${file} → ${name}.pdf`);
      rendered++;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`  ✗ ${file}: ${message}`);
      failed.push(file);
    }
  }

  return { rendered, failed };
}

// ─── Entry point ────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    console.log(USAGE);
    return args.command ? 0 : 1;
  }

  if (args.command === 'render') {
    const input = args.positionals[0];
    if (!input || !args.out) {
      console.error('error: `render` needs <input> and -o <output>.\n');
      console.error(USAGE);
      return 1;
    }
    await renderFile(resolve(input), resolve(args.out), args.theme, args.scale);
    console.log(`✓ ${input} → ${args.out}`);
    return 0;
  }

  if (args.command === 'render-dir') {
    const srcDir = args.positionals[0];
    if (!srcDir || !args.out) {
      console.error('error: `render-dir` needs <srcDir> and -o <outDir>.\n');
      console.error(USAGE);
      return 1;
    }
    const { rendered, failed } = await renderDir(
      resolve(srcDir),
      resolve(args.out),
      args.theme,
      args.scale,
    );
    console.log(`\n${rendered} rendered, ${failed.length} failed.`);
    return failed.length > 0 ? 1 : 0;
  }

  console.error(`error: unknown command "${args.command}".\n`);
  console.error(USAGE);
  return 1;
}

main()
  .then((code) => process.exit(code))
  .catch((cause) => {
    const message = cause instanceof Error ? cause.message : String(cause);
    console.error(`error: ${message}`);
    process.exit(1);
  });
