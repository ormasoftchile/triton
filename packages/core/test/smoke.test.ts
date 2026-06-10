import { describe, expect, it } from 'vitest';
import {
  NotImplementedError,
  compile,
  createSession,
  getSchema,
  listThemes,
  loadIR,
  render,
  validate,
} from '../src/index.js';

describe('@timeline-compiler/core — Phase 0 smoke tests', () => {
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
  });

  describe('NotImplementedError', () => {
    it('loadIR throws NotImplementedError', () => {
      expect(() => loadIR('version: "1.0"')).toThrow(NotImplementedError);
    });

    it('render throws NotImplementedError', () => {
      const stub = {} as Parameters<typeof render>[0];
      expect(() => render(stub, { format: 'svg' })).toThrow(NotImplementedError);
    });

    it('validate throws NotImplementedError', () => {
      const stub = {} as Parameters<typeof validate>[0];
      expect(() => validate(stub)).toThrow(NotImplementedError);
    });

    it('compile throws NotImplementedError', () => {
      expect(() => compile('', { format: 'svg' })).toThrow(NotImplementedError);
    });

    it('NotImplementedError message contains feature name', () => {
      try {
        loadIR('test');
      } catch (e) {
        expect(e).toBeInstanceOf(NotImplementedError);
        expect((e as Error).message).toContain('loadIR');
      }
    });
  });
});
