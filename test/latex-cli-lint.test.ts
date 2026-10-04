import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { resolve, join } from 'node:path';
import { writeFileSync, unlinkSync } from 'node:fs';

const ROOT = resolve(__dirname, '..');
const CLI_PATH = join(ROOT, 'latex', 'dist', 'cli.cjs');

describe('CLI lint and check command', () => {
  it('displays lint and check in help output', () => {
    const res = spawnSync(process.execPath, [CLI_PATH, '--help'], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('triton-latex lint');
    expect(res.stdout).toContain('triton-latex check');
    expect(res.stdout).toContain('--check');
  });

  it('reports clean on valid diagram file', () => {
    const filePath = join(ROOT, 'examples', 'triton', 'platform', 'data-lakehouse.mmd');
    const res = spawnSync(process.execPath, [CLI_PATH, 'lint', filePath], { encoding: 'utf8' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('clean');
  });

  it('fails with exit code 1 when diagram has unmatched bus endpoint error', () => {
    const tempFile = join(ROOT, 'temp-error-diag.mmd');
    writeFileSync(
      tempFile,
      `platform "Error Test"
  tier clients "CLIENTS"
    card app "App"
  end
  tier backend "BACKEND"
    card srv "Service"
  end
  bus app --> brokenEndpoint
`,
      'utf8',
    );

    try {
      const res = spawnSync(process.execPath, [CLI_PATH, 'lint', tempFile], { encoding: 'utf8' });
      expect(res.status).toBe(1);
      expect(res.stdout).toContain('[unmatched-bus-endpoint]');
    } finally {
      try {
        unlinkSync(tempFile);
      } catch {
        // ignore
      }
    }
  });
});
