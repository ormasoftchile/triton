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

// ---------------------------------------------------------------------------
// metadata.logo — JSON Schema coverage
// ---------------------------------------------------------------------------

describe('@timeline-compiler/schema — metadata.logo property', () => {
  it('exposes metadata.logo as an optional object in the generated JSON Schema', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const metadata = props['metadata'] as Record<string, unknown>;
    const metaProps = metadata['properties'] as Record<string, unknown>;
    expect(metaProps).toHaveProperty('logo');
    // logo must NOT be in metadata's required array
    const required = metadata['required'] as string[] | undefined;
    expect(required ?? []).not.toContain('logo');
  });

  it('metadata.logo.src is a required non-empty string', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const metadata = props['metadata'] as Record<string, unknown>;
    const metaProps = metadata['properties'] as Record<string, unknown>;
    const logo = metaProps['logo'] as Record<string, unknown>;
    const logoProps = logo['properties'] as Record<string, unknown>;
    expect(logoProps).toHaveProperty('src');
    const srcDef = logoProps['src'] as Record<string, unknown>;
    expect(srcDef['type']).toBe('string');
    // src must appear in logo's required array
    const required = logo['required'] as string[] | undefined;
    expect(required ?? []).toContain('src');
  });

  it('metadata.logo.position is an optional enum of top-left | top-right', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const metadata = props['metadata'] as Record<string, unknown>;
    const metaProps = metadata['properties'] as Record<string, unknown>;
    const logo = metaProps['logo'] as Record<string, unknown>;
    const logoProps = logo['properties'] as Record<string, unknown>;
    expect(logoProps).toHaveProperty('position');
    const posDef = logoProps['position'] as Record<string, unknown>;
    const enumVals = posDef['enum'] as string[] | undefined;
    expect(enumVals).toContain('top-left');
    expect(enumVals).toContain('top-right');
    const required = logo['required'] as string[] | undefined;
    expect(required ?? []).not.toContain('position');
  });
});

// ---------------------------------------------------------------------------
// Milestone.blocks — JSON Schema coverage
// ---------------------------------------------------------------------------

describe('@timeline-compiler/schema — Milestone.blocks property', () => {
  it('exposes Milestone.blocks as an optional array in the generated JSON Schema', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const milestones = props['milestones'] as Record<string, unknown>;
    const items = milestones['items'] as Record<string, unknown>;
    const itemProps = items['properties'] as Record<string, unknown>;
    expect(itemProps).toHaveProperty('blocks');
    const blocksDef = itemProps['blocks'] as Record<string, unknown>;
    expect(blocksDef['type']).toBe('array');
    // blocks must NOT be in the required array
    const required = items['required'] as string[] | undefined;
    expect(required ?? []).not.toContain('blocks');
  });

  it('Milestone.blocks items have text (required) and heading (optional)', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const milestones = props['milestones'] as Record<string, unknown>;
    const items = milestones['items'] as Record<string, unknown>;
    const itemProps = items['properties'] as Record<string, unknown>;
    const blocksDef = itemProps['blocks'] as Record<string, unknown>;
    const blockItems = blocksDef['items'] as Record<string, unknown>;
    const blockItemProps = blockItems['properties'] as Record<string, unknown>;
    expect(blockItemProps).toHaveProperty('text');
    expect(blockItemProps).toHaveProperty('heading');
    const required = blockItems['required'] as string[] | undefined;
    expect(required ?? []).toContain('text');
    expect(required ?? []).not.toContain('heading');
  });
});

// ---------------------------------------------------------------------------
// Activity.blocks — JSON Schema coverage
// ---------------------------------------------------------------------------

describe('@timeline-compiler/schema — Activity.blocks property', () => {
  it('exposes Activity.blocks as an optional array in the generated JSON Schema', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const activities = props['activities'] as Record<string, unknown>;
    const items = activities['items'] as Record<string, unknown>;
    const itemProps = items['properties'] as Record<string, unknown>;
    expect(itemProps).toHaveProperty('blocks');
    const blocksDef = itemProps['blocks'] as Record<string, unknown>;
    expect(blocksDef['type']).toBe('array');
    // blocks must NOT be in the required array
    const required = items['required'] as string[] | undefined;
    expect(required ?? []).not.toContain('blocks');
  });

  it('Activity.blocks items have text (required) and heading (optional)', () => {
    const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as Record<string, unknown>;
    const defs = schema['definitions'] as Record<string, unknown>;
    const irDoc = defs['IRDocument'] as Record<string, unknown>;
    const props = irDoc['properties'] as Record<string, unknown>;
    const activities = props['activities'] as Record<string, unknown>;
    const items = activities['items'] as Record<string, unknown>;
    const itemProps = items['properties'] as Record<string, unknown>;
    const blocksDef = itemProps['blocks'] as Record<string, unknown>;
    const blockItems = blocksDef['items'] as Record<string, unknown>;
    const blockItemProps = blockItems['properties'] as Record<string, unknown>;
    expect(blockItemProps).toHaveProperty('text');
    expect(blockItemProps).toHaveProperty('heading');
    const required = blockItems['required'] as string[] | undefined;
    expect(required ?? []).toContain('text');
    expect(required ?? []).not.toContain('heading');
  });
});
