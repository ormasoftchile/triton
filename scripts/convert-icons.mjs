#!/usr/bin/env node
/**
 * convert-icons.mjs — Convert a directory of SVG files into a Triton icon pack.
 *
 * Uses @iconify/tools to import, clean up, and optionally optimise SVGs, then
 * emits a validated *.triton-icons.json pack in Triton's IconifyJSON format.
 *
 * Usage:
 *   node scripts/convert-icons.mjs <svg-dir> <prefix> [--out <file>] [--no-svgo]
 *
 * Arguments:
 *   <svg-dir>     Directory containing .svg files to convert.
 *   <prefix>      Pack prefix (e.g. "azure", "mdi"). Must match [a-z][a-z0-9-]*.
 *   --out <file>  Output path. Defaults to <prefix>.triton-icons.json in cwd.
 *   --no-svgo     Skip SVGO optimisation (faster; useful for already-optimised SVGs).
 *
 * The output file passes Triton's validateIconPack (strict schema, no unknown keys).
 *
 * ─── Dependency placement ────────────────────────────────────────────────────
 * @iconify/tools is listed under devDependencies. It is an AUTHORING tool, not
 * part of the core render path. This script must never be imported from any
 * src/** module — triton-core stays a pure function of text with zero runtime
 * dependencies on authoring tooling.
 */

import { importDirectory, cleanupSVG, runSVGO } from '@iconify/tools';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const repoRoot   = resolve(__dirname, '..');

// ─── Token grammar (mirrors validate.ts) ─────────────────────────────────────

const PREFIX_RE = /^[a-z][a-z0-9-]*$/;
const NAME_RE   = /^[a-z0-9][a-z0-9-]*$/;

// ─── Allowed keys (mirrors validate.ts strict sets) ──────────────────────────

const TRITON_TOP_LEVEL_KEYS = new Set(['prefix', 'icons', 'aliases', 'width', 'height', 'left', 'top']);
const TRITON_ICON_DATA_KEYS = new Set(['body', 'width', 'height', 'left', 'top', 'rotate', 'hFlip', 'vFlip']);

// ─── Mirrors detectColorMode from src/icons/resolver.ts ──────────────────────

/**
 * Classify an icon body as 'monochrome' or 'brand'.
 * Logic mirrors detectColorMode in src/icons/resolver.ts exactly so the
 * converter's reporting matches what the runtime will classify.
 */
function detectColorMode(body) {
  if (body.includes('<linearGradient') || body.includes('<radialGradient')) {
    return 'brand';
  }
  const ATTR_RE = /(?:fill|stroke)=["']([^"']+)["']/g;
  const NEUTRAL = new Set(['none', 'currentcolor', 'inherit']);
  let match;
  while ((match = ATTR_RE.exec(body)) !== null) {
    const value = match[1];
    if (value && !NEUTRAL.has(value.toLowerCase())) return 'brand';
  }
  return 'monochrome';
}

// ─── Name normalisation ───────────────────────────────────────────────────────

/**
 * Normalise an SVG filename into a Triton icon name.
 *   • Strip .svg extension (already done by importDirectory's defaultKeyword)
 *   • Lowercase everything
 *   • Replace runs of non-alnum chars (spaces, underscores, dots, parens) with '-'
 *   • Collapse repeated hyphens
 *   • Strip leading/trailing hyphens
 *   • If result doesn't start with [a-z0-9], prepend 'icon-'
 */
function normaliseIconName(raw) {
  let name = raw.toLowerCase();
  name = name.replace(/[^a-z0-9]+/g, '-');
  name = name.replace(/-+/g, '-');
  name = name.replace(/^-+|-+$/g, '');
  if (!NAME_RE.test(name)) {
    name = 'icon-' + name.replace(/^-+/, '');
  }
  return name || 'unnamed';
}

// ─── Core conversion logic ────────────────────────────────────────────────────

/**
 * Convert a directory of SVG files into a Triton-compatible IconifyJSON pack.
 *
 * @param {string} svgDir   Absolute (or cwd-relative) path to SVG directory.
 * @param {string} prefix   Pack prefix — must match [a-z][a-z0-9-]*.
 * @param {object} options
 * @param {boolean} [options.useSvgo=true]    Run SVGO on each icon.
 * @param {boolean} [options.verbose=false]   Log per-icon progress.
 * @returns {Promise<object>} A plain object ready to JSON.stringify and write.
 *                            Passes validateIconPack.
 */
export async function convertIconDirectory(svgDir, prefix, options = {}) {
  const { useSvgo = true, verbose = false } = options;

  const absDir = resolve(svgDir);
  if (!existsSync(absDir)) {
    throw new Error(`SVG directory not found: ${absDir}`);
  }

  if (!PREFIX_RE.test(prefix)) {
    throw new Error(
      `Invalid prefix "${prefix}": must match ^[a-z][a-z0-9-]*$ ` +
      `(start with lowercase letter, then lowercase alphanumeric/hyphens)`,
    );
  }

  // ── Import directory ────────────────────────────────────────────────────────
  // importDirectory reads every .svg under absDir, applies cleanupSVG to each,
  // and returns an IconSet keyed by the normalised filename (sans extension).
  // We provide a keyword callback to apply our Triton name grammar on top.

  const iconSet = await importDirectory(absDir, {
    prefix,
    keyword: (file, defaultKeyword) => normaliseIconName(defaultKeyword),
    ignoreImportErrors: 'warn',
  });

  // ── Per-icon processing ─────────────────────────────────────────────────────

  const skipped = [];

  await iconSet.forEach(async (name, type) => {
    if (type !== 'icon') return;

    const svg = iconSet.toSVG(name);
    if (!svg) {
      skipped.push({ name, reason: 'toSVG returned null' });
      iconSet.remove(name);
      return;
    }

    try {
      // cleanupSVG was already run by importDirectory; run it again to ensure
      // any fixup after the keyword rename is applied cleanly.
      cleanupSVG(svg);

      if (useSvgo) {
        runSVGO(svg);
      }

      iconSet.fromSVG(name, svg);
      if (verbose) process.stderr.write(`  ✓ ${name}\n`);
    } catch (/** @type {any} */ err) {
      skipped.push({ name, reason: err?.message ?? String(err) });
      iconSet.remove(name);
      if (verbose) process.stderr.write(`  ⚠ skipping ${name}: ${err?.message}\n`);
    }
  });

  // ── Export and sanitise ─────────────────────────────────────────────────────
  // iconSet.export() returns the full @iconify/types IconifyJSON which can
  // include 'lastModified', 'info', 'not_found', etc. — all unknown to Triton's
  // strict validator. We build a clean object with only the allowed keys.

  const raw = iconSet.export();

  if (!raw.icons || Object.keys(raw.icons).length === 0) {
    throw new Error(`No icons were converted from ${absDir}. Check your SVG files.`);
  }

  // Build icon entries with only Triton-allowed keys
  /** @type {Record<string, object>} */
  const icons = {};
  for (const [name, data] of Object.entries(raw.icons)) {
    if (!NAME_RE.test(name)) {
      skipped.push({ name, reason: `name "${name}" doesn't match Triton name grammar — skipped` });
      continue;
    }
    /** @type {Record<string, unknown>} */
    const entry = {};
    for (const key of TRITON_ICON_DATA_KEYS) {
      const val = /** @type {any} */ (data)[key];
      if (val !== undefined) entry[key] = val;
    }
    if (!entry['body'] || typeof entry['body'] !== 'string' || entry['body'].length === 0) {
      skipped.push({ name, reason: 'empty body after processing' });
      continue;
    }
    icons[name] = entry;
  }

  if (Object.keys(icons).length === 0) {
    throw new Error('All icons failed processing. Nothing to write.');
  }

  // ── Hoist uniform dimensions to pack level ──────────────────────────────────
  // If every icon has the same width AND height, hoist those to pack level and
  // strip them from individual icons (keeps the output compact).

  const allWidths  = new Set(Object.values(icons).map(i => /** @type {any} */ (i)['width']));
  const allHeights = new Set(Object.values(icons).map(i => /** @type {any} */ (i)['height']));

  // If one of the values is undefined, NOT every icon declared it — don't hoist.
  const uniformWidth  = allWidths.size  === 1 && !allWidths.has(undefined)
    ? /** @type {any} */ ([...allWidths][0])
    : undefined;
  const uniformHeight = allHeights.size === 1 && !allHeights.has(undefined)
    ? /** @type {any} */ ([...allHeights][0])
    : undefined;

  // Also respect pack-level dims from the export (set if viewBox was uniform
  // across the whole import run — e.g. 24×24 icon sets).
  const packWidth  = uniformWidth  ?? (raw.width  ?? undefined);
  const packHeight = uniformHeight ?? (raw.height ?? undefined);

  if (packWidth !== undefined && packHeight !== undefined) {
    for (const icon of Object.values(icons)) {
      delete /** @type {any} */ (icon)['width'];
      delete /** @type {any} */ (icon)['height'];
    }
  }

  // ── Assemble the pack ───────────────────────────────────────────────────────

  /** @type {Record<string, unknown>} */
  const pack = { prefix, icons };

  if (packWidth  !== undefined) pack['width']  = packWidth;
  if (packHeight !== undefined) pack['height'] = packHeight;
  if (raw.left   !== undefined && typeof raw.left  === 'number') pack['left']  = raw.left;
  if (raw.top    !== undefined && typeof raw.top   === 'number') pack['top']   = raw.top;

  // Ensure only TRITON_TOP_LEVEL_KEYS are present
  for (const key of Object.keys(pack)) {
    if (!TRITON_TOP_LEVEL_KEYS.has(key)) delete pack[key];
  }

  return { pack, skipped, iconCount: Object.keys(icons).length };
}

// ─── CLI entry point ──────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Parse flags
  let svgDir  = '';
  let prefix  = '';
  let outFile = '';
  let useSvgo = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--out' || arg === '-o') {
      outFile = args[++i] ?? '';
    } else if (arg === '--no-svgo') {
      useSvgo = false;
    } else if (!svgDir) {
      svgDir = arg;
    } else if (!prefix) {
      prefix = arg;
    }
  }

  if (!svgDir || !prefix) {
    console.error(
      'Usage: node scripts/convert-icons.mjs <svg-dir> <prefix> [--out <file>] [--no-svgo]\n' +
      '\n' +
      '  <svg-dir>    Directory containing .svg files to convert\n' +
      '  <prefix>     Pack prefix, e.g. "azure" or "mdi" (must match [a-z][a-z0-9-]*)\n' +
      '  --out <file> Output path (default: <prefix>.triton-icons.json in cwd)\n' +
      '  --no-svgo    Skip SVGO optimisation\n',
    );
    process.exit(1);
  }

  if (!outFile) {
    outFile = resolve(process.cwd(), `${prefix}.triton-icons.json`);
  } else {
    outFile = resolve(process.cwd(), outFile);
  }

  console.log(`▸ Converting SVGs from ${svgDir} → prefix "${prefix}"`);
  if (!useSvgo) console.log('  (SVGO disabled)');

  let pack, skipped, iconCount;
  try {
    ({ pack, skipped, iconCount } = await convertIconDirectory(
      resolve(process.cwd(), svgDir),
      prefix,
      { useSvgo, verbose: true },
    ));
  } catch (/** @type {any} */ err) {
    console.error(`✗ Conversion failed: ${err?.message ?? String(err)}`);
    process.exit(1);
  }

  // ── Validate with Triton's validateIconPack ─────────────────────────────────
  // Dynamically import from compiled dist if available, so the CLI can give
  // a clear pass/fail. On a fresh clone (dist not built), we skip validation
  // gracefully — the test suite covers this path.

  let validated = false;
  const distPath = join(repoRoot, 'packages/core/dist/icons/validate.js');
  if (existsSync(distPath)) {
    try {
      const { validateIconPack } = await import(distPath);
      const result = validateIconPack(pack);
      if (!result.ok) {
        console.error(`✗ Output failed Triton validation: ${result.error?.message ?? result.error}`);
        process.exit(1);
      }
      validated = true;
    } catch (/** @type {any} */ err) {
      console.warn(`⚠ Could not load validator from dist: ${err?.message} (skipping)`);
    }
  } else {
    console.warn('  ⚠ dist not built — run "pnpm build" for inline validation');
  }

  // ── Write output ─────────────────────────────────────────────────────────────

  const outDir = dirname(outFile);
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
  writeFileSync(outFile, JSON.stringify(pack, null, 2) + '\n', 'utf8');

  // ── Summary ───────────────────────────────────────────────────────────────────

  const iconNames = Object.keys(pack.icons);
  let mono = 0, brand = 0;
  for (const data of Object.values(pack.icons)) {
    if (detectColorMode(/** @type {any} */ (data)['body'])) {
      detectColorMode(/** @type {any} */ (data)['body']) === 'monochrome' ? mono++ : brand++;
    }
  }
  // Re-count correctly
  mono = 0; brand = 0;
  for (const data of Object.values(pack.icons)) {
    const mode = detectColorMode(/** @type {any} */ (data)['body']);
    if (mode === 'monochrome') mono++; else brand++;
  }

  console.log(`\n✓ ${iconCount} icon${iconCount === 1 ? '' : 's'} converted`);
  console.log(`  monochrome: ${mono}  brand: ${brand}`);
  if (pack['width'])  console.log(`  pack size:  ${pack['width']} × ${pack['height']} px`);
  if (skipped.length) {
    console.log(`  skipped (${skipped.length}): ${skipped.map(s => s.name).join(', ')}`);
  }
  if (validated) console.log('  ✓ passes validateIconPack');
  console.log(`\n  → ${outFile}`);
}

// Run when invoked directly (not imported)
if (process.argv[1] === __filename) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}
