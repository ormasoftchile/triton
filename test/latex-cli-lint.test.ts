/**
 * test/latex-cli-lint.test.ts
 *
 * Unit tests for diagram linting diagnostics.
 *
 * Strategy:
 *  - Import lintDiagram() from src/frontend/index.ts — NOT from latex/dist/cli.cjs.
 *    Like test/latex-cli-theme.test.ts and test/latex-cli-icons.test.ts, this runs
 *    cleanly at root `pnpm test` time even when latex/node_modules is not installed
 *    and latex/dist/cli.cjs does not exist.
 *  - If latex/dist/cli.cjs exists (e.g. after pnpm build), optionally run
 *    end-to-end CLI checks.
 */

import { describe, it, expect } from 'vitest';
import { resolve, join } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { lintDiagram } from '../src/frontend/index.js';

const ROOT = resolve(__dirname, '..');
const CLI_PATH = join(ROOT, 'latex', 'dist', 'cli.cjs');

describe('Diagram linting diagnostics', () => {
  it('reports clean on valid platform diagram', () => {
    const filePath = join(ROOT, 'examples', 'triton', 'platform', 'data-lakehouse.mmd');
    const source = readFileSync(filePath, 'utf8');
    const diagnostics = lintDiagram(source);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });

  it('detects unmatched bus endpoint with error severity', () => {
    const brokenSource = `platform "Error Test"
  tier clients "CLIENTS"
    card app "App"
  end
  tier backend "BACKEND"
    card srv "Service"
  end
  bus app --> brokenEndpoint
`;
    const diagnostics = lintDiagram(brokenSource);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.rule).toBe('unmatched-bus-endpoint');
    expect(errors[0]!.nodeOrBusId).toBe('brokenEndpoint');
  });

  if (existsSync(CLI_PATH)) {
    it('displays lint and check in help output', () => {
      const res = spawnSync(process.execPath, [CLI_PATH, '--help'], { encoding: 'utf8' });
      expect(res.status).toBe(0);
      expect(res.stdout).toContain('triton-latex lint');
      expect(res.stdout).toContain('triton-latex check');
      expect(res.stdout).toContain('--check');
    });
  }
});
