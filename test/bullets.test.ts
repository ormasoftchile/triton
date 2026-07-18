import { describe, it, expect } from 'vitest';
import { parseBullets, layoutBullets } from '../src/diagrams/triton/deck/bullets/bullets.js';
import { detect } from '../src/frontend/detect.js';
import { renderSync, compileAndRenderSync } from '../src/frontend/index.js';
import { embedRevealManifest } from '../src/render/svg.js';
import { resolveTheme } from '../src/theme/resolver.js';
import { defaultTheme } from '../src/theme/preset.js';
import '../src/frontend/index.js'; // registers diagram modules

const SOURCE = `bullets
  title Agenda
  Introduction
  - The problem
  * Our approach
  Results
`;

// ─── Detection ────────────────────────────────────────────────────────────────

describe('bullets detection', () => {
  it('routes `bullets` source to the bullets diagram', () => {
    expect(detect(SOURCE).diagramType).toBe('bullets');
  });
});

// ─── Parse ────────────────────────────────────────────────────────────────────

describe('parseBullets', () => {
  it('extracts the title and item list, stripping list markers', () => {
    const doc = parseBullets(SOURCE);
    expect(doc.title).toBe('Agenda');
    expect(doc.items).toEqual(['Introduction', 'The problem', 'Our approach', 'Results']);
  });

  it('works with no title', () => {
    const doc = parseBullets('bullets\n  One\n  Two\n');
    expect(doc.title).toBeUndefined();
    expect(doc.items).toEqual(['One', 'Two']);
  });

  it('ignores an injected `---…---` theme frontmatter block', () => {
    const doc = parseBullets('---\ntheme: midnight\n---\nbullets\n  One\n  Two\n  Three\n');
    expect(doc.items).toEqual(['One', 'Two', 'Three']);
  });

  it('lifts the frontmatter `theme` into metadata so the theme resolver sees it', () => {
    const doc = parseBullets('---\ntheme: minimal\n---\nbullets\n  One\n  Two\n');
    expect(doc.metadata.theme).toBe('minimal');
  });

  it('has empty metadata when there is no frontmatter', () => {
    expect(parseBullets('bullets\n  One\n').metadata).toEqual({});
  });
});

// ─── Layout: anchors + reveal ──────────────────────────────────────────────────

describe('layoutBullets', () => {
  const theme = resolveTheme({}, defaultTheme);

  it('emits one anchor group per item', () => {
    const result = layoutBullets(parseBullets(SOURCE), theme);
    const keys = Object.keys(result.anchors).sort();
    expect(keys).toEqual(['bullet-0', 'bullet-1', 'bullet-2', 'bullet-3']);
  });

  it('emits a reveal track with one step per item, entering each group in order', () => {
    const result = layoutBullets(parseBullets(SOURCE), theme);
    expect(result.reveal).toBeDefined();
    const steps = result.reveal!.steps;
    expect(steps).toHaveLength(4);
    steps.forEach((s, i) => {
      expect(s.index).toBe(i + 1);
      expect(s.enter).toEqual([`bullet-${i}`]);
    });
  });
});

// ─── Layout: reveal effects & grouping ─────────────────────────────────────────

describe('bullets reveal effects & grouping', () => {
  const theme = resolveTheme({}, defaultTheme);
  const stepsOf = (src: string) => layoutBullets(parseBullets(src), theme).reveal!.steps;

  it('defaults every step to the fade effect', () => {
    stepsOf(SOURCE).forEach(s => expect(s.effect).toBe('fade'));
  });

  it('applies a global `effect` directive to all steps', () => {
    const steps = stepsOf('bullets\n  effect slide\n  One\n  Two\n');
    expect(steps.map(s => s.effect)).toEqual(['slide', 'slide']);
  });

  it('honors a per-item `@effect` override on the step it starts', () => {
    const steps = stepsOf('bullets\n  effect fade\n  One\n  Two @grow\n');
    expect(steps.map(s => s.effect)).toEqual(['fade', 'grow']);
  });

  it('ignores unknown effect tokens (kept as literal text)', () => {
    const doc = parseBullets('bullets\n  One @bogus\n');
    expect(doc.items).toEqual(['One @bogus']);
    expect(doc.effects).toEqual([undefined]);
  });

  it('chunks items N-per-step with `group N`', () => {
    const steps = stepsOf('bullets\n  group 2\n  A\n  B\n  C\n  D\n  E\n');
    expect(steps.map(s => s.enter)).toEqual([
      ['bullet-0', 'bullet-1'],
      ['bullet-2', 'bullet-3'],
      ['bullet-4'],
    ]);
  });

  it('merges a `+`-prefixed item into the previous step', () => {
    const doc = parseBullets('bullets\n  Problem\n  + and its cost\n  Approach\n');
    expect(doc.items).toEqual(['Problem', 'and its cost', 'Approach']);
    expect(doc.joins).toEqual([false, true, false]);
    const steps = layoutBullets(doc, theme).reveal!.steps;
    expect(steps.map(s => s.enter)).toEqual([
      ['bullet-0', 'bullet-1'],
      ['bullet-2'],
    ]);
  });

  it('still emits one anchor per item regardless of grouping', () => {
    const result = layoutBullets(parseBullets('bullets\n  group 3\n  A\n  B\n  C\n'), theme);
    expect(Object.keys(result.anchors).sort()).toEqual(['bullet-0', 'bullet-1', 'bullet-2']);
  });
});

// ─── Static render stays reveal-free ────────────────────────────────────────────

describe('bullets render paths', () => {
  it('renderSync produces static SVG with per-item groups but NO reveal manifest', () => {
    const result = renderSync(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toContain('id="bullet-0"');
    expect(result.value).not.toContain('triton-reveal');
    expect(result.value).not.toContain('triton-anchors');
  });

  it('compileAndRenderSync returns the reveal track as data (svg still manifest-free)', () => {
    const result = compileAndRenderSync(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reveal).toBeDefined();
    expect(result.value.reveal!.steps).toHaveLength(4);
    expect(result.value.svg).not.toContain('triton-reveal');
  });

  it('embedRevealManifest injects a parseable, deterministic reveal script for hosts', () => {
    const result = compileAndRenderSync(SOURCE);
    expect(result.ok).toBe(true);
    if (!result.ok || !result.value.reveal) return;
    const withManifest = embedRevealManifest(result.value.svg, result.value.reveal);
    expect(withManifest).toContain('<script type="application/json" id="triton-reveal">');
    const match = withManifest.match(/<script type="application\/json" id="triton-reveal">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const parsed = JSON.parse(match![1]);
    expect(parsed.steps).toHaveLength(4);
    expect(parsed.steps[0].enter).toEqual(['bullet-0']);
    // Deterministic
    expect(embedRevealManifest(result.value.svg, result.value.reveal))
      .toBe(withManifest);
  });
});
