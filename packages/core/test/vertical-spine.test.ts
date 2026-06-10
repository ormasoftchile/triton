/**
 * @file test/vertical-spine.test.ts — Vertical-spine layout family tests.
 *
 * Tests the VERTICAL CENTRAL-SPINE layout family added in Phase 1 Extension.
 * Validates:
 *   (a) non-empty SVG with central spine line
 *   (b) alternating entry blocks with connectors
 *   (c) determinism: two renders are byte-identical and sceneHash matches
 *   (d) entries sorted by (date_ordinal, id)
 *   (e) card-theme emits card rects; plain-theme does not
 *   (f) entries outside time_range are suppressed
 *   (g) empty timeline renders without error
 *   (h) RenderOptions.layout default ('horizontal') is unchanged
 */

import { describe, expect, it } from 'vitest';
import type { IRDocument } from '../src/types.js';
import { renderDocument } from '../src/render/index.js';

// ---------------------------------------------------------------------------
// Shared IR fixtures
// ---------------------------------------------------------------------------

/** A timeline with 4 milestones spread across 2021-2025. */
const VS_IR: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'AI Timeline',
    today:      '2026-06-10',
    time_range: { start: '2021-01', end: '2025-12' },
    axis_unit:  'year',
    theme:      'consulting',
    locale:     'en',
  },
  tracks:     [{ id: 'main', label: '', index: 0 }],
  activities: [],
  milestones: [
    { id: 'gpt3',   label: 'GPT-3 Released',   date: '2021-05-28', track: 'main', status: 'done',        category: 'standard-node', description: 'OpenAI releases GPT-3' },
    { id: 'dalle',  label: 'DALL·E Launch',    date: '2021-01-05', track: 'main', status: 'done',        category: 'standard-node' },
    { id: 'chatgpt',label: 'ChatGPT Launch',   date: '2022-11-30', track: 'main', status: 'done',        category: 'standard-node' },
    { id: 'gpt4',   label: 'GPT-4 Released',   date: '2023-03-14', track: 'main', status: 'done',        category: 'standard-node', description: 'Multi-modal model' },
  ],
};

/** Same IR but with consulting (plain) theme for comparison. */
const VS_IR_PRODUCT: IRDocument = {
  ...VS_IR,
  metadata: { ...VS_IR.metadata, theme: 'product' },
};

/** IR with an activity that has a duration. */
const VS_IR_ACTIVITY: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'Journey Timeline',
    today:      '2026-06-10',
    time_range: { start: '2020-01', end: '2023-12' },
    axis_unit:  'year',
    locale:     'en',
  },
  tracks: [{ id: 'main', label: '', index: 0 }],
  activities: [
    {
      id:     'training',
      label:  'Model Training',
      track:  'main',
      start:  '2021-01-01',
      end:    '2021-12-31',
      status: 'done',
      description: 'Large-scale pre-training',
    },
    {
      id:     'deployment',
      label:  'Deployment Phase',
      track:  'main',
      start:  '2022-06-01',
      // no end = ongoing
      status: 'in-progress',
    },
  ],
  milestones: [
    { id: 'start', label: 'Project Start', date: '2020-03-01', track: 'main', status: 'done' },
    { id: 'mvp',   label: 'MVP Release',   date: '2022-01-15', track: 'main', status: 'done', description: 'First public release' },
  ],
};

// ---------------------------------------------------------------------------
// (a) SVG structure: spine line present, non-empty
// ---------------------------------------------------------------------------

describe('vertical-spine — (a) SVG structure', () => {
  it('returns a non-empty SVG string', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toBeDefined();
    expect(typeof result.svg).toBe('string');
    expect(result.svg!.length).toBeGreaterThan(200);
  });

  it('SVG starts with XML declaration and <svg> root', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toMatch(/^<\?xml/);
    expect(result.svg).toContain('<svg');
    expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('SVG contains the document title', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('AI Timeline');
  });

  it('SVG contains a central spine line (x1 === x2, vertical)', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    // The spine is rendered as a <line> with x1 = x2 (vertical line)
    expect(result.svg).toContain('<line');
    // At least one <line> has x1=x2 (vertical spine at canvas center W/2 = 600)
    expect(result.svg).toMatch(/x1="600"[^/]*x2="600"/);
  });

  it('SVG contains connector lines (horizontal, short)', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    // Connector lines are <line> elements with opacity="0.8" (vs spine with no opacity)
    // At least one connector should be present for each entry
    expect(result.svg).toContain('opacity="0.8"');
    // Also verify multiple <line> elements exist (spine + connectors + ticks)
    const lineCount = (result.svg!.match(/<line /g) ?? []).length;
    expect(lineCount).toBeGreaterThan(4);
  });
});

// ---------------------------------------------------------------------------
// (b) Entry blocks: all labels present
// ---------------------------------------------------------------------------

describe('vertical-spine — (b) entry blocks', () => {
  it('SVG contains all milestone labels', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('GPT-3 Released');
    expect(result.svg).toContain('DALL·E Launch');
    expect(result.svg).toContain('ChatGPT Launch');
    expect(result.svg).toContain('GPT-4 Released');
  });

  it('SVG contains date labels (formatted milestone dates)', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('May 2021');
    expect(result.svg).toContain('January 2021');
  });

  it('SVG contains description text when description is set', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('OpenAI releases GPT-3');
    expect(result.svg).toContain('Multi-modal model');
  });

  it('SVG contains node marker elements (circles or paths)', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toMatch(/<circle|<path/);
  });
});

// ---------------------------------------------------------------------------
// (c) Determinism
// ---------------------------------------------------------------------------

describe('vertical-spine — (c) determinism', () => {
  it('two renders of the same IR produce byte-identical SVG', () => {
    const r1 = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    const r2 = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(r1.svg).toBe(r2.svg);
  });

  it('two renders produce identical sceneHash values', () => {
    const r1 = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    const r2 = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('sceneHash is a 64-character hex string', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.sceneHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different IR produces different sceneHash', () => {
    const modified: IRDocument = { ...VS_IR, metadata: { ...VS_IR.metadata, title: 'Changed' } };
    const r1 = renderDocument(VS_IR,    { format: 'svg', layout: 'vertical-spine' });
    const r2 = renderDocument(modified, { format: 'svg', layout: 'vertical-spine' });
    expect(r1.sceneHash).not.toBe(r2.sceneHash);
  });
});

// ---------------------------------------------------------------------------
// (d) Sort by (date_ordinal, id)
// ---------------------------------------------------------------------------

describe('vertical-spine — (d) sort by (date_ordinal, id)', () => {
  it('entries appear in the SVG in date-ascending order', () => {
    // DALL·E (2021-01-05) must appear before GPT-3 (2021-05-28)
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    const dallePos   = result.svg!.indexOf('DALL·E Launch');
    const gpt3Pos    = result.svg!.indexOf('GPT-3 Released');
    const chatgptPos = result.svg!.indexOf('ChatGPT Launch');
    const gpt4Pos    = result.svg!.indexOf('GPT-4 Released');

    expect(dallePos).toBeGreaterThan(0);
    expect(gpt3Pos).toBeGreaterThan(0);
    expect(dallePos).toBeLessThan(gpt3Pos);
    expect(gpt3Pos).toBeLessThan(chatgptPos);
    expect(chatgptPos).toBeLessThan(gpt4Pos);
  });
});

// ---------------------------------------------------------------------------
// (e) Card-theme vs plain-theme
// ---------------------------------------------------------------------------

describe('vertical-spine — (e) card vs plain theme', () => {
  it('product theme (card) emits rect elements for card backgrounds', () => {
    const result = renderDocument(VS_IR_PRODUCT, { format: 'svg', layout: 'vertical-spine', theme: 'product' });
    // Card backgrounds are <rect> with rx="6" (rounded corners)
    expect(result.svg).toContain('rx="6"');
  });

  it('consulting theme (plain) does NOT emit card rect (rx="6")', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine', theme: 'consulting' });
    // Plain style: no rounded-rect card backgrounds
    expect(result.svg).not.toContain('rx="6"');
  });

  it('executive theme (card) emits card rect backgrounds', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine', theme: 'executive' });
    expect(result.svg).toContain('rx="6"');
  });

  it('minimal theme (plain) does NOT emit card rect', () => {
    const result = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine', theme: 'minimal' });
    expect(result.svg).not.toContain('rx="6"');
  });
});

// ---------------------------------------------------------------------------
// (f) Outside-range suppression + empty timeline
// ---------------------------------------------------------------------------

describe('vertical-spine — (f/g) edge cases', () => {
  it('milestone outside time_range is suppressed', () => {
    const irOutside: IRDocument = {
      ...VS_IR,
      milestones: [
        ...(VS_IR.milestones ?? []),
        { id: 'future', label: 'FutureEvent', date: '2099-01-01', track: 'main' },
      ],
    };
    const result = renderDocument(irOutside, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).not.toContain('FutureEvent');
  });

  it('empty milestone/activity list renders without error', () => {
    const irEmpty: IRDocument = { ...VS_IR, milestones: [], activities: [] };
    expect(() => renderDocument(irEmpty, { format: 'svg', layout: 'vertical-spine' })).not.toThrow();
  });

  it('empty timeline SVG mentions "No entries"', () => {
    const irEmpty: IRDocument = { ...VS_IR, milestones: [], activities: [] };
    const result = renderDocument(irEmpty, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('No entries');
  });
});

// ---------------------------------------------------------------------------
// (h) Default layout is horizontal (golden guard for layout default)
// ---------------------------------------------------------------------------

describe('vertical-spine — (h) default layout unchanged', () => {
  it('omitting layout option renders the horizontal layout (contains axis ticks)', () => {
    // The horizontal layout renders a horizontal axis with tick marks as <line> elements
    // The vertical spine has no horizontal axis tick marks in the same position
    const horiz  = renderDocument(VS_IR, { format: 'svg' });              // default
    const vert   = renderDocument(VS_IR, { format: 'svg', layout: 'vertical-spine' });
    // They should produce DIFFERENT scene hashes (different layouts)
    expect(horiz.sceneHash).not.toBe(vert.sceneHash);
  });

  it('explicit layout horizontal is byte-identical to default', () => {
    const default_ = renderDocument(VS_IR, { format: 'svg' });
    const explicit  = renderDocument(VS_IR, { format: 'svg', layout: 'horizontal' });
    expect(default_.svg).toBe(explicit.svg);
    expect(default_.sceneHash).toBe(explicit.sceneHash);
  });
});

// ---------------------------------------------------------------------------
// Activities with duration in vertical-spine
// ---------------------------------------------------------------------------

describe('vertical-spine — activities with duration', () => {
  it('activity with start+end renders SVG without error', () => {
    expect(() =>
      renderDocument(VS_IR_ACTIVITY, { format: 'svg', layout: 'vertical-spine' }),
    ).not.toThrow();
  });

  it('activity labels appear in the SVG', () => {
    const result = renderDocument(VS_IR_ACTIVITY, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('Model Training');
    expect(result.svg).toContain('Deployment Phase');
  });

  it('ongoing activity emits a dashed line segment (dashArray)', () => {
    const result = renderDocument(VS_IR_ACTIVITY, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('stroke-dasharray');
  });

  it('deterministic for activity IR', () => {
    const r1 = renderDocument(VS_IR_ACTIVITY, { format: 'svg', layout: 'vertical-spine' });
    const r2 = renderDocument(VS_IR_ACTIVITY, { format: 'svg', layout: 'vertical-spine' });
    expect(r1.svg).toBe(r2.svg);
  });
});
