import { describe, it, expect } from 'vitest';
import { stripComments } from '../src/frontend/preprocess.js';
import { detect } from '../src/frontend/detect.js';
import { render } from '../src/frontend/index.js';

// ─── stripComments unit tests ─────────────────────────────────────────────────

describe('stripComments', () => {
  it('removes a full-line %% comment', () => {
    const input = '%% this is a comment\nflowchart TD\nA --> B\n';
    expect(stripComments(input)).toBe('flowchart TD\nA --> B\n');
  });

  it('removes a leading-whitespace %% comment', () => {
    const input = '  %% indented comment\nflowchart TD\nA --> B\n';
    expect(stripComments(input)).toBe('flowchart TD\nA --> B\n');
  });

  it('removes multiple consecutive comment lines', () => {
    const input = '%% comment 1\n%% comment 2\nflowchart TD\nA --> B\n';
    expect(stripComments(input)).toBe('flowchart TD\nA --> B\n');
  });

  it('does NOT strip %% that appears after content on the same line', () => {
    const input = 'flowchart TD\nA --> B %% inline note\n';
    expect(stripComments(input)).toBe('flowchart TD\nA --> B %% inline note\n');
  });

  it('does NOT strip %% inside a quoted label', () => {
    // A line that starts with real content — first non-ws chars are not %%
    const input = 'flowchart TD\nA["50%% off"] --> B\n';
    expect(stripComments(input)).toBe('flowchart TD\nA["50%% off"] --> B\n');
  });

  it('preserves leading frontmatter block verbatim', () => {
    const input = '---\ntheme: dark\n---\n%% stripped\nclassDiagram\nA <|-- B\n';
    const result = stripComments(input);
    expect(result).toBe('---\ntheme: dark\n---\nclassDiagram\nA <|-- B\n');
    expect(result).toContain('---\ntheme: dark\n---\n');
  });

  it('does NOT strip inside the frontmatter block itself', () => {
    const input = '---\ntitle: 50%% capacity\n---\ngantt\n  section S\n  T: a, 1d\n';
    const result = stripComments(input);
    expect(result).toContain('title: 50%% capacity');
  });

  it('preserves pure-YAML inputs (type: key) untouched', () => {
    const yaml = 'type: flowchart\n%% should stay\nnodes:\n  - id: A\n';
    expect(stripComments(yaml)).toBe(yaml);
  });

  it('handles input with no comments unchanged', () => {
    const input = 'classDiagram\nA <|-- B\n';
    expect(stripComments(input)).toBe(input);
  });

  it('handles empty input', () => {
    expect(stripComments('')).toBe('');
  });

  it('removes a comment-only line at end of input (no trailing newline)', () => {
    const input = 'timeline\n  section S\n    Task: 2024\n%% trailing comment';
    const result = stripComments(input);
    expect(result).not.toContain('%%');
    expect(result).toContain('timeline');
  });
});

// ─── detect() integration: comment before header keyword ──────────────────────

describe('detect after stripComments', () => {
  it('recognises classDiagram when %% comment precedes it', () => {
    const input = '%% a comment\nclassDiagram\nA <|-- B\n';
    const { format, diagramType } = detect(stripComments(input));
    expect(format).toBe('mermaid');
    expect(diagramType).toBe('class');
  });

  it('recognises sankey when %% comment precedes it', () => {
    const input = '%% options\nsankey-beta\nA,B,10\n';
    const { format, diagramType } = detect(stripComments(input));
    expect(format).toBe('mermaid');
    expect(diagramType).toBe('sankey');
  });

  it('recognises packet when %% comment precedes it', () => {
    const input = '%% note\npacket-beta\n0-3: "Offset"\n';
    const { format, diagramType } = detect(stripComments(input));
    expect(format).toBe('mermaid');
    expect(diagramType).toBe('packet');
  });

  it('recognises a ds family (array) when %% comment precedes it', () => {
    const input = '%% diagram-options\narray\n  cells 1 2 3\n';
    const { format, diagramType } = detect(stripComments(input));
    expect(format).toBe('mermaid');
    expect(diagramType).toBe('array');
  });
});

// ─── End-to-end: previously-unsupported families now accept %% ────────────────

describe('render with %% comments in previously-unsupported families', () => {
  it('renders classDiagram with a leading %% comment', async () => {
    const src = '%% This diagram has no built-in Comment rule\nclassDiagram\n  class Animal {\n    +String name\n  }\n  Animal <|-- Dog\n';
    const result = await render(src);
    if (!result.ok) throw new Error(`class: ${result.error.code} — ${result.error.message}`);
    expect(result.value).toContain('<svg');
  });

  it('renders packet-beta with a leading %% comment', async () => {
    const src = '%% packet options\npacket-beta\n  title TCP\n  0-3: "Data Offset"\n  16-31: "Window"\n';
    const result = await render(src);
    if (!result.ok) throw new Error(`packet: ${result.error.code} — ${result.error.message}`);
    expect(result.value).toContain('<svg');
  });

  it('renders array (ds) with a leading %% comment', async () => {
    const src = '%% ds comment\narray 5 8 13\n';
    const result = await render(src);
    if (!result.ok) throw new Error(`array: ${result.error.code} — ${result.error.message}`);
    expect(result.value).toContain('<svg');
  });

  it('renders mindmap with a leading %% comment', async () => {
    const src = '%% mindmap comment\nmindmap\n  root((Root))\n    Child\n';
    const result = await render(src);
    if (!result.ok) throw new Error(`mindmap: ${result.error.code} — ${result.error.message}`);
    expect(result.value).toContain('<svg');
  });

  it('renders pie with a leading %% comment', async () => {
    const src = '%% pie options\npie title Pets\n  "Dogs" : 42\n  "Cats" : 58\n';
    const result = await render(src);
    if (!result.ok) throw new Error(`pie: ${result.error.code} — ${result.error.message}`);
    expect(result.value).toContain('<svg');
  });
});
