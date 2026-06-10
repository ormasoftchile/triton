#!/usr/bin/env node
/**
 * @timeline-compiler/cli — Timeline Compiler command-line interface.
 *
 * Commands:
 *   render <input>   — Render a timeline YAML/JSON file to SVG or PNG
 *   validate <input> — Validate a timeline YAML/JSON file
 *   schema           — Print the Timeline IR JSON Schema
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRequire } from 'node:module';

import { Command } from 'commander';
import {
  NotImplementedError,
  getSchema,
  loadIR,
  render,
  validate,
} from '@timeline-compiler/core';

// ---------------------------------------------------------------------------
// Version resolution
// ---------------------------------------------------------------------------

const _require = createRequire(import.meta.url);
const pkg: { version: string } = _require('../package.json');

// ---------------------------------------------------------------------------
// Program
// ---------------------------------------------------------------------------

const program = new Command();

program
  .name('timeline')
  .description('Timeline Compiler — render and validate timeline IR documents')
  .version(pkg.version, '-v, --version', 'print version number');

// ---------------------------------------------------------------------------
// render command
// ---------------------------------------------------------------------------

program
  .command('render <input>')
  .description('Render a timeline YAML/JSON file to SVG or PNG')
  .option('-o, --output <path>', 'output file path (default: stdout for SVG)')
  .option('--theme <theme>', 'theme id (default: "default")', 'default')
  .option('--format <format>', 'output format: svg or png', 'svg')
  .action((inputPath: string, options: { output?: string; theme: string; format: string }) => {
    const format = options.format as 'svg' | 'png';
    if (format !== 'svg' && format !== 'png') {
      console.error(`Error: --format must be "svg" or "png", got "${format}"`);
      process.exit(1);
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

    try {
      const ir = loadIR(text);
      const result = render(ir, { format, theme: options.theme });
      if (options.output) {
        if (format === 'svg' && result.svg) {
          writeFileSync(resolve(options.output), result.svg, 'utf-8');
        } else if (format === 'png' && result.png) {
          writeFileSync(resolve(options.output), result.png);
        }
        console.log(`Written to ${options.output}`);
      } else {
        process.stdout.write(result.svg ?? '');
      }
    } catch (e) {
      if (e instanceof NotImplementedError) {
        console.error(`Not yet implemented: ${(e as Error).message}`);
        console.error('Phase 1 will implement the render pipeline.');
        process.exit(2);
      }
      throw e;
    }
  });

// ---------------------------------------------------------------------------
// validate command
// ---------------------------------------------------------------------------

program
  .command('validate <input>')
  .description('Validate a timeline YAML/JSON file against the IR schema')
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

    try {
      const ir = loadIR(text);
      const result = validate(ir);
      if (result.valid) {
        console.log('✅ Valid');
      } else {
        console.error('❌ Invalid');
        for (const err of result.errors) {
          console.error(`  [${err.code}] ${err.path}: ${err.message}`);
        }
        process.exit(1);
      }
    } catch (e) {
      if (e instanceof NotImplementedError) {
        console.error(`Not yet implemented: ${(e as Error).message}`);
        console.error('Phase 1 will implement the validation pipeline.');
        process.exit(2);
      }
      throw e;
    }
  });

// ---------------------------------------------------------------------------
// schema command
// ---------------------------------------------------------------------------

program
  .command('schema')
  .description('Print the Timeline IR JSON Schema to stdout')
  .action(() => {
    const schema = getSchema();
    process.stdout.write(JSON.stringify(schema, null, 2) + '\n');
  });

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

program.parse(process.argv);
