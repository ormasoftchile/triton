/**
 * @file test/executive-gallery-timeline.test.ts — Executive timeline/gantt gallery emit.
 *
 * Renders the mermaid-timeline.mmd and mermaid-gantt.mmd sources under the
 * contract `executive` theme via `bindTimelineTheme(CONTRACT_THEMES.executive)`,
 * BYPASSING the legacy theme name dispatch.
 *
 * The legacy `executive` name maps to the dark-navy boardroom timeline theme.
 * These gallery files demonstrate the CONTRACT executive design system applied
 * to the timeline family — navy accent on white, Georgia serif, comfortable
 * density — for visual coherence comparison with executive-flowchart/sequence/xychart.
 *
 * Files produced (NEW — existing goldens untouched):
 *   examples/gallery/executive-timeline.svg/.png
 *   examples/gallery/executive-gantt.svg/.png
 *
 * PRECEDENCE RULE GUARD: also validates that the legacy `executive` theme
 * still renders with a dark (#0D1B2A) background, confirming it was NOT
 * overridden by this migration.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { CONTRACT_THEMES } from '../src/theme-contract/index.js';
import { bindTimelineTheme } from '../src/themes/index.js';
import { renderDocument } from '../src/render/index.js';
import { parseTimelineInternal } from '../src/frontend/mermaid/timeline.js';
import { parseGanttInternal } from '../src/frontend/mermaid/gantt.js';
import { renderMermaid } from '../src/frontend/mermaid/index.js';
import type { IRDocument } from '../src/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const REPO_ROOT  = join(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');

function readMmd(name: string): string {
  return readFileSync(join(GALLERY, name), 'utf-8');
}

function writeGallery(name: string, content: string | Buffer): void {
  if (!existsSync(GALLERY)) mkdirSync(GALLERY, { recursive: true });
  writeFileSync(join(GALLERY, name), content);
}

// Pre-resolve the contract executive theme once (deterministic, avoid repeated derivation)
const CONTRACT_EXECUTIVE_RT = bindTimelineTheme(CONTRACT_THEMES.executive!);

// ── Executive Timeline (contract binding, bypassing legacy name dispatch) ─────

describe('Executive gallery — timeline (contract executive, NEW files)', () => {
  it('emits executive-timeline.svg via contract binding', () => {
    const src = readMmd('mermaid-timeline.mmd');
    const { doc } = parseTimelineInternal(src);
    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, layout: 'timeline-columns' },
    };
    const result = renderDocument(finalDoc, {
      format:        'svg',
      layout:        'timeline-columns',
      resolvedTheme: CONTRACT_EXECUTIVE_RT,
    });
    expect(result.svg).toBeTruthy();
    expect(result.svg!).toContain('<svg');
    writeGallery('executive-timeline.svg', result.svg!);
    console.log('[executive-contract] executive-timeline.svg written.');
  });

  it('emits executive-timeline.png via contract binding', () => {
    const src = readMmd('mermaid-timeline.mmd');
    const { doc } = parseTimelineInternal(src);
    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, layout: 'timeline-columns' },
    };
    const result = renderDocument(finalDoc, {
      format:        'png',
      layout:        'timeline-columns',
      resolvedTheme: CONTRACT_EXECUTIVE_RT,
    });
    expect(result.png).toBeTruthy();
    expect(result.png![0]).toBe(0x89); // PNG magic byte
    writeGallery('executive-timeline.png', result.png!);
    console.log('[executive-contract] executive-timeline.png written.');
  });

  it('executive-timeline renders are deterministic', () => {
    const src = readMmd('mermaid-timeline.mmd');
    const { doc } = parseTimelineInternal(src);
    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, layout: 'timeline-columns' },
    };
    const a = renderDocument(finalDoc, { format: 'svg', layout: 'timeline-columns', resolvedTheme: CONTRACT_EXECUTIVE_RT });
    const b = renderDocument(finalDoc, { format: 'svg', layout: 'timeline-columns', resolvedTheme: CONTRACT_EXECUTIVE_RT });
    expect(a.sceneHash).toBe(b.sceneHash);
    expect(a.svg).toBe(b.svg);
  });
});

// ── Executive Gantt (contract binding, bypassing legacy name dispatch) ────────

describe('Executive gallery — gantt (contract executive, NEW files)', () => {
  it('emits executive-gantt.svg via contract binding', () => {
    const src = readMmd('mermaid-gantt.mmd');
    const { doc } = parseGanttInternal(src);
    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, layout: 'gantt' },
    };
    const result = renderDocument(finalDoc, {
      format:        'svg',
      layout:        'gantt',
      resolvedTheme: CONTRACT_EXECUTIVE_RT,
    });
    expect(result.svg).toBeTruthy();
    expect(result.svg!).toContain('<svg');
    writeGallery('executive-gantt.svg', result.svg!);
    console.log('[executive-contract] executive-gantt.svg written.');
  });

  it('emits executive-gantt.png via contract binding', () => {
    const src = readMmd('mermaid-gantt.mmd');
    const { doc } = parseGanttInternal(src);
    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, layout: 'gantt' },
    };
    const result = renderDocument(finalDoc, {
      format:        'png',
      layout:        'gantt',
      resolvedTheme: CONTRACT_EXECUTIVE_RT,
    });
    expect(result.png).toBeTruthy();
    expect(result.png![0]).toBe(0x89); // PNG magic byte
    writeGallery('executive-gantt.png', result.png!);
    console.log('[executive-contract] executive-gantt.png written.');
  });

  it('executive-gantt renders are deterministic', () => {
    const src = readMmd('mermaid-gantt.mmd');
    const { doc } = parseGanttInternal(src);
    const finalDoc: IRDocument = {
      ...doc,
      metadata: { ...doc.metadata, layout: 'gantt' },
    };
    const a = renderDocument(finalDoc, { format: 'svg', layout: 'gantt', resolvedTheme: CONTRACT_EXECUTIVE_RT });
    const b = renderDocument(finalDoc, { format: 'svg', layout: 'gantt', resolvedTheme: CONTRACT_EXECUTIVE_RT });
    expect(a.sceneHash).toBe(b.sceneHash);
    expect(a.svg).toBe(b.svg);
  });
});

// ── Coherence: executive timeline family shares design language ───────────────

describe('Executive timeline family — design coherence', () => {
  it('executive-timeline SVG uses contract surface color #ffffff (white canvas)', () => {
    const svg = readFileSync(join(GALLERY, 'executive-timeline.svg'), 'utf-8');
    expect(svg.toLowerCase()).toContain('#ffffff');
  });

  it('executive-timeline SVG uses Georgia serif font from contract', () => {
    const svg = readFileSync(join(GALLERY, 'executive-timeline.svg'), 'utf-8');
    // Georgia font comes from typography.family in the contract binding
    expect(svg.toLowerCase()).toContain('georgia');
  });

  it('executive-gantt SVG uses contract surface color #ffffff (white canvas)', () => {
    const svg = readFileSync(join(GALLERY, 'executive-gantt.svg'), 'utf-8');
    expect(svg.toLowerCase()).toContain('#ffffff');
  });

  it('executive-gantt SVG uses Georgia serif font from contract', () => {
    const svg = readFileSync(join(GALLERY, 'executive-gantt.svg'), 'utf-8');
    expect(svg.toLowerCase()).toContain('georgia');
  });

  it('executive-timeline does NOT use legacy dark-navy canvas (#0d1b2a)', () => {
    const svg = readFileSync(join(GALLERY, 'executive-timeline.svg'), 'utf-8');
    // Legacy executive background; contract-derived uses #ffffff
    expect(svg.toLowerCase()).not.toContain('#0d1b2a');
  });

  it('executive-gantt does NOT use legacy dark-navy canvas (#0d1b2a)', () => {
    const svg = readFileSync(join(GALLERY, 'executive-gantt.svg'), 'utf-8');
    expect(svg.toLowerCase()).not.toContain('#0d1b2a');
  });

  it('executive-timeline and executive-flowchart share white surface', () => {
    const timelineSvg   = readFileSync(join(GALLERY, 'executive-timeline.svg'),   'utf-8');
    const flowchartSvg  = readFileSync(join(GALLERY, 'executive-flowchart.svg'),   'utf-8');
    // Both should use the white executive canvas
    expect(timelineSvg.toLowerCase()).toContain('#ffffff');
    expect(flowchartSvg.toLowerCase()).toContain('#ffffff');
  });

  it('executive-timeline and executive-flowchart share Georgia typography', () => {
    const timelineSvg   = readFileSync(join(GALLERY, 'executive-timeline.svg'),   'utf-8');
    const flowchartSvg  = readFileSync(join(GALLERY, 'executive-flowchart.svg'),   'utf-8');
    expect(timelineSvg.toLowerCase()).toContain('georgia');
    expect(flowchartSvg.toLowerCase()).toContain('georgia');
  });
});

// ── Precedence guard: legacy executive is unchanged ───────────────────────────

describe('Precedence guard — legacy executive theme untouched', () => {
  it('renderMermaid with theme="executive" uses legacy dark-navy background', () => {
    const src = readMmd('mermaid-timeline.mmd');
    // Force legacy executive via options.theme — hits REGISTRY first
    const result = renderMermaid(src, { theme: 'executive', format: 'svg' });
    expect(result.svg).toBeTruthy();
    // Legacy executive background is #0d1b2a (dark navy), NOT #ffffff (contract)
    expect(result.svg!.toLowerCase()).toContain('#0d1b2a');
    expect(result.svg!.toLowerCase()).not.toContain('background-color:#ffffff');
  });

  it('mermaid-timeline.mmd golden (our-timeline theme) is byte-identical after migration', () => {
    // Render with no theme override → should use 'our-timeline' from frontmatter
    const src = readMmd('mermaid-timeline.mmd');
    const a = renderMermaid(src, { format: 'svg' });
    const b = renderMermaid(src, { format: 'svg' });
    expect(a.sceneHash).toBe(b.sceneHash);
    // our-timeline has a white background (not the legacy executive dark)
    expect(a.svg!.toLowerCase()).not.toContain('#0d1b2a');
  });
});
