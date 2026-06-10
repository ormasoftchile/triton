#!/usr/bin/env node
/**
 * @timeline-compiler/cli — Timeline Compiler command-line interface.
 *
 * Commands:
 *   render <input>   — Validate then render a timeline YAML/JSON file to SVG or PNG
 *   validate <input> — Validate a timeline YAML/JSON file (schema + all invariants)
 *   schema           — Print the Timeline IR JSON Schema
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';

import { Command } from 'commander';
import {
  IRParseError,
  getSchema,
  loadIR,
  render,
  validate,
} from '@timeline-compiler/core';
import type { Diagnostic } from '@timeline-compiler/core';

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

const _require = createRequire(import.meta.url);
const pkg: { version: string } = _require('../package.json');

// ---------------------------------------------------------------------------
// Diagnostic formatting
// ---------------------------------------------------------------------------

function formatDiagnostic(d: Diagnostic): string {
  const loc = d.path ? d.path : '(document)';
  let line = `  ${d.severity}  ${d.code}  ${loc}: ${d.message}`;
  if (d.suggestion) line += `\n    → ${d.suggestion}`;
  return line;
}

// ---------------------------------------------------------------------------
// Global error handling
// ---------------------------------------------------------------------------

process.on('uncaughtException', (err) => {
  console.error(`Fatal error: ${err.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error(`Unhandled rejection: ${String(reason)}`);
  process.exit(1);
});

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('timeline')
  .description('Timeline Compiler — render and validate timeline IR documents')
  .version(pkg.version, '-v, --version', 'print version number');

// ---------------------------------------------------------------------------
// validate command
// ---------------------------------------------------------------------------

program
  .command('validate <input>')
  .description('Validate a timeline YAML/JSON file against the IR schema and all invariants')
  .action((inputPath: string) => {
    let text: string;
    try {
      text = readFileSync(resolve(inputPath), 'utf-8');
    } catch (e) {
      console.error(`Error reading file: ${inputPath}`);
      console.error((e as Error).message);
      process.exit(1);
      return;
    }

    let ir;
    try {
      ir = loadIR(text);
    } catch (e) {
      if (e instanceof IRParseError) {
        console.error('❌ Parse failed:');
        for (const d of e.diagnostics) {
          console.error(formatDiagnostic(d));
        }
        process.exit(1);
        return;
      }
      console.error(`Unexpected error: ${(e as Error).message}`);
      process.exit(1);
      return;
    }

    const result = validate(ir);

    for (const d of [...result.errors, ...result.warnings]) {
      console.log(formatDiagnostic(d));
    }

    if (result.valid) {
      console.log('✅ Valid');
      process.exit(0);
    } else {
      console.error('❌ Invalid');
      process.exit(1);
    }
  });

// ---------------------------------------------------------------------------
// render command
// ---------------------------------------------------------------------------

program
  .command('render <input>')
  .description('Render a timeline YAML/JSON file to SVG or PNG (validate-before-render)')
  .option('-o, --output <path>', 'output file path (default: input basename with .svg/.png)')
  .option('--theme <theme>', 'theme id', 'consulting')
  .option('--format <format>', 'output format: svg or png', 'svg')
  .action((inputPath: string, options: { output?: string; theme: string; format: string }) => {
    const format = options.format as 'svg' | 'png';
    if (format !== 'svg' && format !== 'png') {
      console.error(`Error: --format must be "svg" or "png", got "${format}"`);
      process.exit(1);
      return;
    }

    let text: string;
    try {
      text = readFileSync(resolve(inputPath), 'utf-8');
    } catch (e) {
      console.error(`Error reading file: ${inputPath}`);
      console.error((e as Error).message);
      process.exit(1);
      return;
    }

    // ── Parse ─────────────────────────────────────────────────────────────
    let ir;
    try {
      ir = loadIR(text);
    } catch (e) {
      if (e instanceof IRParseError) {
        console.error('❌ Parse failed:');
        for (const d of e.diagnostics) {
          console.error(formatDiagnostic(d));
        }
        process.exit(1);
        return;
      }
      console.error(`Unexpected error: ${(e as Error).message}`);
      process.exit(1);
      return;
    }

    // ── Validate-before-render ────────────────────────────────────────────
    const validationResult = validate(ir);

    if (!validationResult.valid) {
      console.error('❌ Validation failed — aborting render:');
      for (const d of validationResult.errors) {
        console.error(formatDiagnostic(d));
      }
      process.exit(1);
      return;
    }

    // Print warnings (non-fatal) before rendering.
    for (const d of validationResult.warnings) {
      console.warn(formatDiagnostic(d));
    }

    // ── Render ────────────────────────────────────────────────────────────
    let result;
    try {
      result = render(ir, { format, theme: options.theme });
    } catch (e) {
      console.error(`Render error: ${(e as Error).message}`);
      process.exit(1);
      return;
    }

    // ── Write output ──────────────────────────────────────────────────────
    const inputResolved = resolve(inputPath);
    const ext = extname(inputResolved);
    const inputBase = basename(inputResolved, ext);
    const inputDir = dirname(inputResolved);
    const defaultOut = join(inputDir, `${inputBase}.${format}`);
    const outputPath = options.output ? resolve(options.output) : defaultOut;

    try {
      const outputDir = dirname(outputPath);
      if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

      if (format === 'svg' && result.svg) {
        writeFileSync(outputPath, result.svg, 'utf-8');
      } else if (format === 'png' && result.png) {
        writeFileSync(outputPath, result.png);
      }
    } catch (e) {
      console.error(`Error writing output: ${(e as Error).message}`);
      process.exit(1);
      return;
    }

    console.log(`Written: ${outputPath}`);
    console.log(`sceneHash: ${result.sceneHash}`);
  });

// ---------------------------------------------------------------------------
// schema command
// ---------------------------------------------------------------------------

program
  .command('schema')
  .description('Print the Timeline IR JSON Schema to stdout (or write to -o path)')
  .option('-o, --output <path>', 'write schema to file instead of stdout')
  .action((options: { output?: string }) => {
    const schemaText = JSON.stringify(getSchema(), null, 2) + '\n';
    if (options.output) {
      try {
        writeFileSync(resolve(options.output), schemaText, 'utf-8');
        console.log(`Schema written to ${options.output}`);
      } catch (e) {
        console.error(`Error writing schema: ${(e as Error).message}`);
        process.exit(1);
      }
    } else {
      process.stdout.write(schemaText);
    }
  });

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

try {
  program.parse(process.argv);
} catch (e) {
  console.error(`Error: ${(e as Error).message}`);
  process.exit(1);
}
