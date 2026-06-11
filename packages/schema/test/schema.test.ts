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

// ---------------------------------------------------------------------------
// Activity.icon — JSON Schema coverage
// ---------------------------------------------------------------------------

describe('@timeline-compiler/schema — Activity.icon property', () => {
  it('exposes Activity.icon as an optional string property in the generated JSON Schema', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    // Navigate: definitions.IRDocument.properties.activities.items.properties.icon
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const activities = props['activities'] as Record<string, unknown>;
    const items = activities['items'] as Record<string, unknown>;
    const itemProps = items['properties'] as Record<string, unknown>;
    expect(itemProps).toHaveProperty('icon');
    const iconDef = itemProps['icon'] as Record<string, unknown>;
    expect(iconDef['type']).toBe('string');
    // icon must NOT be in the required array (it is optional)
    const required = items['required'] as string[] | undefined;
    expect(required ?? []).not.toContain('icon');
  });
});

// ---------------------------------------------------------------------------
// Activity.color — JSON Schema coverage
// ---------------------------------------------------------------------------

describe('@timeline-compiler/schema — Activity.color property', () => {
  it('exposes Activity.color as an optional string property in the generated JSON Schema', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const activities = props['activities'] as Record<string, unknown>;
    const items = activities['items'] as Record<string, unknown>;
    const itemProps = items['properties'] as Record<string, unknown>;
    expect(itemProps).toHaveProperty('color');
    const colorDef = itemProps['color'] as Record<string, unknown>;
    expect(colorDef['type']).toBe('string');
    // color must NOT be in the required array (it is optional)
    const required = items['required'] as string[] | undefined;
    expect(required ?? []).not.toContain('color');
  });
});
