/**
 * @file load.test.ts — Tests for parseIR (load.ts).
 *
 * Covers:
 *  - Valid YAML parses to a correct IRDocument
 *  - Valid JSON parses to a correct IRDocument
 *  - Format auto-detection ('{' prefix → json, otherwise yaml)
 *  - Malformed YAML throws IRParseError with diagnostics
 *  - Schema violations throw IRParseError with JSON-Pointer paths
 */

import { describe, expect, it } from 'vitest';
import { IRParseError, parseIR } from '../src/load.js';
import type { IRDocument } from '../src/types.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const VALID_YAML = `
version: "1.0"
metadata:
  title: Test Timeline
  time_range:
    start: 2026-01-01
    end: 2026-12-31
tracks:
  - id: main
    label: Main Track
activities:
  - id: first-task
    label: First Task
    track: main
    start: 2026-Q1
    end: 2026-Q2
`.trim();

const VALID_JSON: IRDocument = {
  version: '1.0',
  metadata: {
    title: 'Test Timeline',
    time_range: { start: '2026-01-01', end: '2026-12-31' },
  },
  tracks: [{ id: 'main', label: 'Main Track' }],
  activities: [
    { id: 'first-task', label: 'First Task', track: 'main', start: '2026-Q1', end: '2026-Q2' },
  ],
};

// ---------------------------------------------------------------------------
// Valid YAML
// ---------------------------------------------------------------------------

describe('parseIR — valid YAML', () => {
  it('returns an IRDocument from valid YAML', () => {
    const doc = parseIR(VALID_YAML);
    expect(doc.version).toBe('1.0');
    expect(doc.metadata.title).toBe('Test Timeline');
    expect(doc.tracks).toHaveLength(1);
    expect(doc.tracks[0]?.id).toBe('main');
    expect(doc.activities).toHaveLength(1);
  });

  it('explicitly specified yaml format works', () => {
    const doc = parseIR(VALID_YAML, 'yaml');
    expect(doc.version).toBe('1.0');
  });

  it('maps quarter dates through correctly', () => {
    const doc = parseIR(VALID_YAML);
    expect(doc.activities[0]?.start).toBe('2026-Q1');
    expect(doc.activities[0]?.end).toBe('2026-Q2');
  });
});

// ---------------------------------------------------------------------------
// Valid JSON
// ---------------------------------------------------------------------------

describe('parseIR — valid JSON', () => {
  it('returns an IRDocument from valid JSON string', () => {
    const doc = parseIR(JSON.stringify(VALID_JSON));
    expect(doc.version).toBe('1.0');
    expect(doc.tracks[0]?.id).toBe('main');
  });

  it('explicitly specified json format works', () => {
    const doc = parseIR(JSON.stringify(VALID_JSON), 'json');
    expect(doc.metadata.title).toBe('Test Timeline');
  });

  it('produces a value structurally equal to the input', () => {
    const doc = parseIR(JSON.stringify(VALID_JSON));
    expect(doc).toEqual(VALID_JSON);
  });
});

// ---------------------------------------------------------------------------
// Format auto-detection
// ---------------------------------------------------------------------------

describe('parseIR — auto-detection', () => {
  it('detects JSON when text starts with "{"', () => {
    const text = JSON.stringify(VALID_JSON);
    expect(text.trimStart().startsWith('{')).toBe(true);
    const doc = parseIR(text); // no format arg
    expect(doc.version).toBe('1.0');
  });

  it('detects YAML when text does not start with "{"', () => {
    const doc = parseIR(VALID_YAML); // starts with 'v'
    expect(doc.version).toBe('1.0');
  });

  it('detects YAML for leading-whitespace YAML input', () => {
    const doc = parseIR('  \n' + VALID_YAML);
    expect(doc.version).toBe('1.0');
  });
});

// ---------------------------------------------------------------------------
// Malformed YAML
// ---------------------------------------------------------------------------

describe('parseIR — malformed YAML', () => {
  it('throws IRParseError for invalid YAML syntax', () => {
    expect(() => parseIR('key: [unclosed bracket')).toThrow(IRParseError);
  });

  it('IRParseError carries at least one diagnostic', () => {
    try {
      parseIR('key: [unclosed');
    } catch (e) {
      expect(e).toBeInstanceOf(IRParseError);
      const err = e as IRParseError;
      expect(err.diagnostics.length).toBeGreaterThan(0);
    }
  });

  it('diagnostic code is YAML_PARSE_ERROR', () => {
    try {
      parseIR('key: [unclosed');
    } catch (e) {
      const err = e as IRParseError;
      expect(err.diagnostics[0]?.code).toBe('YAML_PARSE_ERROR');
    }
  });

  it('diagnostic includes range with line/column', () => {
    try {
      parseIR('key: [unclosed bracket');
    } catch (e) {
      const err = e as IRParseError;
      const diag = err.diagnostics[0];
      // YAML parser provides linePos — range should be populated
      expect(diag?.range).toBeDefined();
      expect(diag?.range?.start.line).toBeGreaterThan(0);
    }
  });

  it('error message is descriptive', () => {
    try {
      parseIR('key: [unclosed');
    } catch (e) {
      const err = e as IRParseError;
      expect(err.message).toContain('YAML parse error');
    }
  });
});

// ---------------------------------------------------------------------------
// Malformed JSON
// ---------------------------------------------------------------------------

describe('parseIR — malformed JSON', () => {
  it('throws IRParseError for invalid JSON syntax', () => {
    expect(() => parseIR('{bad json', 'json')).toThrow(IRParseError);
  });

  it('diagnostic code is JSON_PARSE_ERROR', () => {
    try {
      parseIR('{bad json', 'json');
    } catch (e) {
      const err = e as IRParseError;
      expect(err.diagnostics[0]?.code).toBe('JSON_PARSE_ERROR');
    }
  });
});

// ---------------------------------------------------------------------------
// Schema violations
// ---------------------------------------------------------------------------

describe('parseIR — schema violations', () => {
  it('throws IRParseError when required `version` field is missing', () => {
    const yaml = `
metadata:
  title: No Version
  time_range:
    start: 2026-01-01
tracks:
  - id: main
    label: Main
activities: []
`.trim();
    expect(() => parseIR(yaml)).toThrow(IRParseError);
  });

  it('IRParseError diagnostics include JSON-Pointer paths', () => {
    const yaml = `
version: "1.0"
metadata:
  title: ""
  time_range:
    start: 2026-01-01
tracks:
  - id: main
    label: Main
activities: []
`.trim();
    try {
      parseIR(yaml);
    } catch (e) {
      const err = e as IRParseError;
      const paths = err.diagnostics.map((d) => d.path);
      // title is empty string → schema error at /metadata/title
      expect(paths.some((p) => p.includes('title'))).toBe(true);
    }
  });

  it('throws when tracks array is empty (schema min:1)', () => {
    const yaml = `
version: "1.0"
metadata:
  title: Empty Tracks
  time_range:
    start: 2026-01-01
tracks: []
activities: []
`.trim();
    expect(() => parseIR(yaml)).toThrow(IRParseError);
  });

  it('diagnostic severity is "error" for schema failures', () => {
    try {
      parseIR('not: a: valid: ir: doc');
    } catch (e) {
      const err = e as IRParseError;
      for (const d of err.diagnostics) {
        expect(d.severity).toBe('error');
      }
    }
  });

  it('throws IRParseError when activity track id has invalid format', () => {
    const yaml = `
version: "1.0"
metadata:
  title: Test
  time_range:
    start: 2026-01-01
tracks:
  - id: BadId
    label: Bad
activities: []
`.trim();
    expect(() => parseIR(yaml)).toThrow(IRParseError);
  });
});
