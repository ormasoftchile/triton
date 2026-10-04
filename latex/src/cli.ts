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

import { readFileSync, writeFileSync, readdirSync, mkdirSync, statSync, existsSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderSync, lintDiagram, type DiagramDiagnostic } from '../../src/frontend/index.js';
import type { ResolvedTheme } from '../../src/contracts/theme.js';
import type { IconPackMap } from '../../src/contracts/icons.js';
import { svgToPdf } from './pdf.js';
import { resolveCliTheme } from './theme-resolve.js';
import { resolveCliIcons } from './icon-resolve.js';

// ─── Arg parsing (tiny, dependency-free) ────────────────────────────────────────

interface Args {
  readonly command?: string;
  readonly positionals: string[];
  readonly out?: string;
  readonly theme?: string;
  readonly themeFile?: string;
  readonly themesDir?: string;
  readonly iconPack?: string;
  readonly iconsDir?: string;
  readonly scale: number;
  readonly check: boolean;
  readonly help: boolean;
}

function parseArgs(argv: string[]): Args {
  const positionals: string[] = [];
  let out: string | undefined;
  let theme: string | undefined;
  let themeFile: string | undefined;
  let themesDir: string | undefined;
  let iconPack: string | undefined;
  let iconsDir: string | undefined;
  let scale = 1;
  let check = false;
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
      case '--theme-file':
        themeFile = argv[++i];
        break;
      case '--themes-dir':
        themesDir = argv[++i];
        break;
      case '--icon-pack':
        iconPack = argv[++i];
        break;
      case '--icons-dir':
        iconsDir = argv[++i];
        break;
      case '--scale':
        scale = Number(argv[++i]) || 1;
        break;
      case '--check':
        check = true;
        break;
      case '-h':
      case '--help':
        help = true;
        break;
      default:
        positionals.push(a);
    }
  }

  return {
    command: positionals.shift(),
    positionals,
    out,
    theme,
    themeFile,
    themesDir,
    iconPack,
    iconsDir,
    scale,
    check,
    help,
  };
}

const USAGE = `triton-latex — render and lint Triton diagrams.

Usage:
  triton-latex render <input.triton|.mmd> -o <out.pdf|.svg> [options]
  triton-latex render-dir <srcDir> -o <outDir> [options]
  triton-latex lint <input.triton|.mmd|srcDir> [options]
  triton-latex check <input.triton|.mmd|srcDir> [options]

Options:
  -o, --out <path>          Output file (render) or output directory (render-dir).
  --check                   Verify diagram diagnostics (fails on error) before rendering.
  --theme <name>            Theme preset name (default, executive, minimal, …) or
                            a name from the discovered/loaded custom theme registry.
  --theme-file <path>       Path to a .triton-theme.json file. Takes precedence over
                            --theme and --themes-dir. Fails loudly on load error.
  --themes-dir <dir>        Directory of .triton-theme.json files to register; merged
                            on top of auto-discovered .triton/themes/ (overrides on
                            name collision). Use with --theme <name>.
  --icon-pack <path>        Path to a .triton-icons.json icon pack file. Loaded at
                            highest precedence (overrides --icons-dir and auto-discovery
                            on duplicate prefix). Fails loudly on load or validation error.
  --icons-dir <dir>         Directory of .triton-icons.json files to register; merged
                            on top of auto-discovered .triton/icons/ (overrides on
                            duplicate prefix). Use alongside --icon-pack as needed.
  --scale <number>          Uniform scale for the PDF page box (default 1).
  -h, --help                Show this help.

Theme resolution order:
  1. --theme-file <path>    → load that exact file (errors are fatal)
  2. --themes-dir + auto-discovery (.triton/themes/ ancestor walk) → build registry
     --theme <name>          → look up name in registry, then fall back to built-in preset
  3. No theme flags          → core uses diagram frontmatter / default preset

Icon resolution order:
  1. --icon-pack <path>     → load that exact file (errors are fatal); highest precedence
  2. --icons-dir <dir>      → discover packs in dir, merged over auto-discovery
  3. Auto-discovery          → walk up from input file looking for .triton/icons/
  (No icon flags + no .triton/icons/ found → no custom icon packs loaded)

Examples:
  triton-latex render diagram.mmd -o figures/diagram.pdf
  triton-latex render diagram.mmd -o diagram.svg                        # SVG pass-through
  triton-latex render diagram.mmd -o out.pdf --theme-file my.triton-theme.json
  triton-latex render diagram.mmd -o out.pdf --themes-dir .triton/themes --theme acme
  triton-latex render diagram.mmd -o out.pdf --icon-pack icons/azure.triton-icons.json
  triton-latex render diagram.mmd -o out.pdf --icons-dir .triton/icons
  triton-latex render-dir diagrams/ -o figures/                         # batch → *.pdf
`;

// ─── Rendering ──────────────────────────────────────────────────────────────────

const DIAGRAM_EXTS = new Set(['.triton', '.mmd']);

/** Render one source file to an SVG string, throwing a clean Error on failure. */
function renderToSvg(
  source: string,
  themeInput: ResolvedTheme | undefined,
  icons: IconPackMap,
): string {
  const result = renderSync(source, themeInput, undefined, undefined, icons);
  if (!result.ok) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.value;
}

/** Render a single input file to a .pdf or .svg output. */
async function renderFile(
  inputPath: string,
  outPath: string,
  themeInput: ResolvedTheme | undefined,
  icons: IconPackMap,
  scale: number,
  check = false,
): Promise<void> {
  const source = readFileSync(inputPath, 'utf8');

  if (check) {
    const diagnostics = lintDiagram(source, themeInput, undefined, icons);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    for (const w of warnings) {
      console.warn(`  ⚠ [${w.rule}] ${w.message}`);
    }
    if (errors.length > 0) {
      for (const e of errors) {
        console.error(`  ✗ [${e.rule}] ${e.message}`);
      }
      throw new Error(`Lint failed with ${errors.length} error(s).`);
    }
  }

  const svg = renderToSvg(source, themeInput, icons);

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
  themeInput: ResolvedTheme | undefined,
  icons: IconPackMap,
  scale: number,
  check = false,
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
      await renderFile(inputPath, outPath, themeInput, icons, scale, check);
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

/** Lint a single file and output diagnostics. Returns error and warning counts. */
function lintSingleFile(
  inputPath: string,
  themeInput: ResolvedTheme | undefined,
  icons: IconPackMap,
): { errors: number; warnings: number } {
  const source = readFileSync(inputPath, 'utf8');
  const diagnostics = lintDiagram(source, themeInput, undefined, icons);
  const errors = diagnostics.filter((d) => d.severity === 'error');
  const warnings = diagnostics.filter((d) => d.severity === 'warning');

  const fileLabel = basename(inputPath);
  if (diagnostics.length === 0) {
    console.log(`  ✓ ${fileLabel}: clean`);
    return { errors: 0, warnings: 0 };
  }

  const mark = errors.length > 0 ? '✗' : '⚠';
  console.log(`  ${mark} ${fileLabel} (${errors.length} error(s), ${warnings.length} warning(s)):`);
  for (const d of diagnostics) {
    const icon = d.severity === 'error' ? '    ✗' : '    ⚠';
    console.log(`${icon} [${d.rule}] ${d.message}`);
  }
  return { errors: errors.length, warnings: warnings.length };
}

/** Lint all diagram files in a directory. */
function lintDirectory(
  srcDir: string,
  themeInput: ResolvedTheme | undefined,
  icons: IconPackMap,
): { totalFiles: number; errorCount: number; warningCount: number } {
  const entries = readdirSync(srcDir).filter((f) => {
    const full = join(srcDir, f);
    return statSync(full).isFile() && DIAGRAM_EXTS.has(extname(f).toLowerCase());
  });

  let errorCount = 0;
  let warningCount = 0;
  for (const file of entries) {
    const full = join(srcDir, file);
    const res = lintSingleFile(full, themeInput, icons);
    errorCount += res.errors;
    warningCount += res.warnings;
  }
  return { totalFiles: entries.length, errorCount, warningCount };
}

// ─── Entry point ────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help || !args.command) {
    console.log(USAGE);
    return args.help ? 0 : 1;
  }

  if (args.command === 'lint' || args.command === 'check') {
    const target = args.positionals[0] || '.';
    const resolvedTarget = resolve(target);
    if (!existsSync(resolvedTarget)) {
      console.error(`error: target path does not exist: "${target}"`);
      return 1;
    }
    const isDir = statSync(resolvedTarget).isDirectory();
    const baseDir = isDir ? resolvedTarget : dirname(resolvedTarget);

    let themeInput: ResolvedTheme | undefined;
    let icons: IconPackMap;
    try {
      themeInput = resolveCliTheme(args, baseDir);
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      return 1;
    }
    try {
      icons = resolveCliIcons(args, baseDir);
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      return 1;
    }

    if (isDir) {
      const { totalFiles, errorCount, warningCount } = lintDirectory(
        resolvedTarget,
        themeInput,
        icons,
      );
      console.log(
        `\nChecked ${totalFiles} file(s): ${errorCount} error(s), ${warningCount} warning(s).`,
      );
      return errorCount > 0 ? 1 : 0;
    } else {
      const res = lintSingleFile(resolvedTarget, themeInput, icons);
      return res.errors > 0 ? 1 : 0;
    }
  }

  if (args.command === 'render') {
    const input = args.positionals[0];
    if (!input || !args.out) {
      console.error('error: `render` needs <input> and -o <output>.\n');
      console.error(USAGE);
      return 1;
    }
    const inputPath = resolve(input);
    let themeInput: ResolvedTheme | undefined;
    let icons: IconPackMap;
    try {
      themeInput = resolveCliTheme(args, dirname(inputPath));
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      return 1;
    }
    try {
      icons = resolveCliIcons(args, dirname(inputPath));
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      return 1;
    }
    await renderFile(inputPath, resolve(args.out), themeInput, icons, args.scale, args.check);
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
    const resolvedSrcDir = resolve(srcDir);
    let themeInput: ResolvedTheme | undefined;
    let icons: IconPackMap;
    try {
      themeInput = resolveCliTheme(args, resolvedSrcDir);
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      return 1;
    }
    try {
      icons = resolveCliIcons(args, resolvedSrcDir);
    } catch (e) {
      console.error(`error: ${(e as Error).message}`);
      return 1;
    }
    const { rendered, failed } = await renderDir(
      resolvedSrcDir,
      resolve(args.out),
      themeInput,
      icons,
      args.scale,
      args.check,
    );
    console.log(`\n${rendered} rendered, ${failed.length} failed.`);
    return failed.length > 0 ? 1 : 0;
  }

  console.error(`error: unknown command "${args.command}".\n`);
  console.error(USAGE);
  return 1;
}

function isDirectExecution(): boolean {
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    return true;
  }
  if (typeof __filename !== 'undefined' && process.argv[1]) {
    try {
      return resolve(process.argv[1]) === resolve(__filename);
    } catch {
      return false;
    }
  }
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url && process.argv[1]) {
      return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
    }
  } catch {
    return false;
  }
  return false;
}

if (isDirectExecution()) {
  main()
    .then((code) => process.exit(code))
    .catch((cause) => {
      const message = cause instanceof Error ? cause.message : String(cause);
      console.error(`error: ${message}`);
      process.exit(1);
    });
}
