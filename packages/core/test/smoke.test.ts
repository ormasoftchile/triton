import { describe, expect, it } from 'vitest';
import {
  IRParseError,
  NotImplementedError,
  compile,
  createSession,
  getSchema,
  listThemes,
  loadIR,
  render,
  validate,
} from '../src/index.js';

// Minimal valid YAML fixture for Phase 1 smoke tests.
const VALID_YAML = `
version: "1.0"
metadata:
  title: Smoke Test
  time_range:
    start: 2026-01-01
    end: 2026-12-31
tracks:
  - id: main
    label: Main Track
activities: []
`.trim();

describe('@timeline-compiler/core — Phase 1 smoke tests', () => {
  describe('getSchema()', () => {
    it('returns a non-empty object', () => {
      const schema = getSchema();
      expect(schema).toBeTypeOf('object');
      expect(schema).not.toBeNull();
    });

    it('contains a "type" or "$schema" property', () => {
      const schema = getSchema() as Record<string, unknown>;
      const hasType = 'type' in schema;
      const hasSchema = '$schema' in schema;
      expect(hasType || hasSchema).toBe(true);
    });

    it('references IRDocument definition', () => {
      const schema = JSON.stringify(getSchema());
      expect(schema).toContain('IRDocument');
    });
  });

  describe('listThemes()', () => {
    it('returns an array', () => {
      expect(Array.isArray(listThemes())).toBe(true);
    });

    it('returns at least one theme', () => {
      expect(listThemes().length).toBeGreaterThan(0);
    });

    it('each theme has id, title, and tier', () => {
      for (const theme of listThemes()) {
        expect(typeof theme.id).toBe('string');
        expect(typeof theme.title).toBe('string');
        expect(typeof theme.tier).toBe('number');
      }
    });

    it('includes a "default" theme', () => {
      expect(listThemes().some((t) => t.id === 'default')).toBe(true);
    });
  });

  describe('createSession()', () => {
    it('returns an object with update and dispose methods', () => {
      const session = createSession();
      expect(typeof session.update).toBe('function');
      expect(typeof session.dispose).toBe('function');
      session.dispose();
    });

    it('update() returns an IncrementalResult with svg, diagnostics, changed', () => {
      const session = createSession();
      const result = session.update('');
      expect(typeof result.svg).toBe('string');
      expect(Array.isArray(result.diagnostics)).toBe(true);
      expect(typeof result.changed).toBe('boolean');
      session.dispose();
    });

    it('update() throws after dispose()', () => {
      const session = createSession();
      session.dispose();
      expect(() => session.update('')).toThrow();
    });

    it('update() with valid IR returns an SVG string', () => {
      const session = createSession();
      const result = session.update(VALID_YAML);
      expect(result.svg.length).toBeGreaterThan(50);
      expect(result.svg).toContain('<svg');
      session.dispose();
    });

    it('update() changed is true on first successful render', () => {
      const session = createSession();
      const result = session.update(VALID_YAML);
      expect(result.changed).toBe(true);
      session.dispose();
    });
  });

  describe('NotImplementedError', () => {
    it('NotImplementedError class is exported and instantiable', () => {
      const err = new NotImplementedError('test-feature');
      expect(err).toBeInstanceOf(NotImplementedError);
      expect(err).toBeInstanceOf(Error);
      expect(err.message).toContain('test-feature');
    });

    it('NotImplementedError name is set correctly', () => {
      const err = new NotImplementedError('foo');
      expect(err.name).toBe('NotImplementedError');
    });
  });

  describe('IRParseError', () => {
    it('is exported from the package', () => {
      expect(IRParseError).toBeDefined();
    });

    it('loadIR throws IRParseError for invalid YAML', () => {
      expect(() => loadIR('key: [unclosed')).toThrow(IRParseError);
    });

    it('loadIR throws IRParseError for missing required fields', () => {
      expect(() => loadIR('version: "1.0"')).toThrow(IRParseError);
    });
  });

  describe('loadIR() — Phase 1', () => {
    it('returns an IRDocument from valid YAML', () => {
      const doc = loadIR(VALID_YAML);
      expect(doc.version).toBe('1.0');
      expect(doc.metadata.title).toBe('Smoke Test');
      expect(doc.tracks).toHaveLength(1);
    });
  });

  describe('validate() — Phase 1', () => {
    it('returns valid:true for a valid document', () => {
      const ir = loadIR(VALID_YAML);
      const result = validate(ir);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('returns a ValidationResult shape', () => {
      const ir = loadIR(VALID_YAML);
      const result = validate(ir);
      expect(typeof result.valid).toBe('boolean');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });

  describe('render() — Phase 1', () => {
    it('returns an SVG string for a valid document', () => {
      const ir = loadIR(VALID_YAML);
      const result = render(ir, { format: 'svg' });
      expect(result.svg).toBeDefined();
      expect(result.svg!.length).toBeGreaterThan(50);
      expect(result.svg).toContain('<svg');
    });

    it('sceneHash is a 64-char hex string', () => {
      const ir = loadIR(VALID_YAML);
      const result = render(ir, { format: 'svg' });
      expect(result.sceneHash).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe('compile() — Phase 1', () => {
    it('accepts a YAML string and returns a RenderResult', () => {
      const result = compile(VALID_YAML, { format: 'svg' });
      expect(result.svg).toBeDefined();
      expect(result.svg!.length).toBeGreaterThan(50);
    });

    it('accepts an IRDocument and returns a RenderResult', () => {
      const ir = loadIR(VALID_YAML);
      const result = compile(ir, { format: 'svg' });
      expect(result.svg).toBeDefined();
    });

    it('throws IRParseError for invalid YAML string', () => {
      expect(() => compile('not valid ir', { format: 'svg' })).toThrow(IRParseError);
    });
  });
});
