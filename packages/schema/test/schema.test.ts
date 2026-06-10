import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '..', 'v1', 'timeline.json');

describe('@timeline-compiler/schema — Phase 0 smoke tests', () => {
  it('v1/timeline.json exists', () => {
    expect(existsSync(schemaPath)).toBe(true);
  });

  it('v1/timeline.json is valid JSON', () => {
    const text = readFileSync(schemaPath, 'utf-8');
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it('v1/timeline.json is a non-empty object', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as unknown;
    expect(schema).toBeTypeOf('object');
    expect(schema).not.toBeNull();
  });

  it('v1/timeline.json has expected schema structure', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const hasStructure = 'type' in schema || '$schema' in schema || 'definitions' in schema;
    expect(hasStructure).toBe(true);
  });
});
