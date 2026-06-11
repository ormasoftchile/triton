/**
 * @file test/icons.test.ts — Icon registry + deterministic rendering tests.
 *
 * Validates:
 *   (a) getIcon returns a valid IconDef for all ~20 canonical names
 *   (b) Aliases resolve to the canonical icon (e.g. 'zap' → bolt, 'cancel' → x)
 *   (c) getIcon returns undefined for unknown names — no throw
 *   (d) hasIcon returns true/false correctly
 *   (e) Milestone with a known icon renders <path> elements deterministically
 *       (two renders are byte-identical; icon <path> present in SVG)
 *   (f) Milestone with unknown icon falls back to ordinal number, no crash
 */

import { describe, expect, it } from 'vitest';
import { getIcon, hasIcon, listIcons } from '../src/icons.js';
import type { IRDocument } from '../src/types.js';
import { renderDocument } from '../src/render/index.js';

// ---------------------------------------------------------------------------
// (a) Known canonical icon names
// ---------------------------------------------------------------------------

describe('icons — (a) canonical names return valid IconDef', () => {
  const CANONICAL_NAMES = [
    'flag', 'star', 'check', 'x', 'warning',
    'rocket', 'target', 'calendar', 'clock', 'gear',
    'lock', 'cloud', 'database', 'code', 'milestone',
    'play', 'bolt', 'people', 'doc', 'pin',
  ];

  for (const name of CANONICAL_NAMES) {
    it(`getIcon('${name}') returns a valid IconDef`, () => {
      const def = getIcon(name);
      expect(def).toBeDefined();
      expect(def!.viewBox).toBe('0 0 24 24');
      expect(Array.isArray(def!.paths)).toBe(true);
      expect(def!.paths.length).toBeGreaterThan(0);
      // Each path must have a non-empty d string
      for (const p of def!.paths) {
        expect(typeof p.d).toBe('string');
        expect(p.d.length).toBeGreaterThan(0);
      }
    });
  }

  it('listIcons() returns all canonical names sorted', () => {
    const icons = listIcons();
    expect(icons.length).toBeGreaterThanOrEqual(20);
    // Sorted
    for (let i = 1; i < icons.length; i++) {
      expect(icons[i]! >= icons[i - 1]!).toBe(true);
    }
    // Contains known names
    for (const n of CANONICAL_NAMES) {
      expect(icons).toContain(n);
    }
  });
});

// ---------------------------------------------------------------------------
// (b) Alias resolution
// ---------------------------------------------------------------------------

describe('icons — (b) aliases resolve correctly', () => {
  const ALIAS_MAP: Record<string, string> = {
    'zap':          'bolt',
    'lightning':    'bolt',
    'cancel':       'x',
    'close':        'x',
    'cross':        'x',
    'alert':        'warning',
    'triangle':     'warning',
    'launch':       'rocket',
    'goal':         'target',
    'bullseye':     'target',
    'settings':     'gear',
    'cog':          'gear',
    'security':     'lock',
    'padlock':      'lock',
    'data':         'database',
    'storage':      'database',
    'team':         'people',
    'users':        'people',
    'file':         'doc',
    'document':     'doc',
    'location':     'pin',
    'marker':       'pin',
    'diamond':      'milestone',
    'start':        'play',
    'check-circle': 'check',
    'tick':         'check',
  };

  for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
    it(`alias '${alias}' resolves to '${canonical}'`, () => {
      const fromAlias    = getIcon(alias);
      const fromCanonical = getIcon(canonical);
      expect(fromAlias).toBeDefined();
      expect(fromAlias).toEqual(fromCanonical);
    });
  }

  it('lookup is case-insensitive (ROCKET → rocket)', () => {
    expect(getIcon('ROCKET')).toEqual(getIcon('rocket'));
    expect(getIcon('Star')).toEqual(getIcon('star'));
    expect(getIcon('  FLAG  ')).toEqual(getIcon('flag'));
  });
});

// ---------------------------------------------------------------------------
// (c) Unknown icon names return undefined — no throw
// ---------------------------------------------------------------------------

describe('icons — (c) unknown names return undefined', () => {
  const UNKNOWNS = ['banana', 'not-an-icon', '', '   ', '🚀', 'null', 'undefined'];

  for (const name of UNKNOWNS) {
    it(`getIcon('${name}') returns undefined`, () => {
      expect(() => getIcon(name)).not.toThrow();
      expect(getIcon(name)).toBeUndefined();
    });
  }
});

// ---------------------------------------------------------------------------
// (d) hasIcon
// ---------------------------------------------------------------------------

describe('icons — (d) hasIcon', () => {
  it('returns true for known canonical names', () => {
    expect(hasIcon('rocket')).toBe(true);
    expect(hasIcon('flag')).toBe(true);
    expect(hasIcon('bolt')).toBe(true);
  });

  it('returns true for known aliases', () => {
    expect(hasIcon('zap')).toBe(true);
    expect(hasIcon('launch')).toBe(true);
    expect(hasIcon('cancel')).toBe(true);
  });

  it('returns false for unknown names', () => {
    expect(hasIcon('banana')).toBe(false);
    expect(hasIcon('')).toBe(false);
    expect(hasIcon('noop')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Shared IR with icon milestones
// ---------------------------------------------------------------------------

const ICON_IR: IRDocument = {
  version: '1.0',
  metadata: {
    title:      'Icon Test',
    today:      '2026-06-10',
    time_range: { start: '2026-01', end: '2026-12' },
    axis_unit:  'month',
    theme:      'consulting',
  },
  tracks: [{ id: 'main', label: '', index: 0 }],
  activities: [],
  milestones: [
    {
      id:       'rocket-ms',
      label:    'Launch',
      date:     '2026-03-01',
      track:    'main',
      status:   'done',
      category: 'standard-node',
      icon:     'rocket',
    },
    {
      id:       'flag-ms',
      label:    'GA Release',
      date:     '2026-09-01',
      track:    'main',
      status:   'planned',
      category: 'standard-node',
      icon:     'flag',
    },
  ],
};

const UNKNOWN_ICON_IR: IRDocument = {
  ...ICON_IR,
  milestones: [
    {
      id:       'unknown-icon-ms',
      label:    'Unknown',
      date:     '2026-06-01',
      track:    'main',
      status:   'planned',
      category: 'standard-node',
      icon:     'definitely-not-an-icon',
    },
  ],
};

// ---------------------------------------------------------------------------
// (e) Deterministic icon rendering
// ---------------------------------------------------------------------------

describe('icons — (e) deterministic rendering with known icons', () => {
  it('two horizontal renders with icon milestones are byte-identical', () => {
    const r1 = renderDocument(ICON_IR, { format: 'svg', layout: 'horizontal' });
    const r2 = renderDocument(ICON_IR, { format: 'svg', layout: 'horizontal' });
    expect(r1.svg).toBe(r2.svg);
  });

  it('two vertical-spine renders with icon milestones are byte-identical', () => {
    const r1 = renderDocument(ICON_IR, { format: 'svg', layout: 'vertical-spine' });
    const r2 = renderDocument(ICON_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(r1.svg).toBe(r2.svg);
  });

  it('sceneHash is identical across two horizontal renders', () => {
    const r1 = renderDocument(ICON_IR, { format: 'svg', layout: 'horizontal' });
    const r2 = renderDocument(ICON_IR, { format: 'svg', layout: 'horizontal' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('horizontal SVG with icon milestone contains <path> with transform', () => {
    const result = renderDocument(ICON_IR, { format: 'svg', layout: 'horizontal' });
    // The icon is rendered as a <path> with a transform attribute
    expect(result.svg).toContain('transform=');
    expect(result.svg).toMatch(/translate\([^)]+\) scale\([^)]+\)/);
  });

  it('vertical-spine SVG with icon milestone contains transform paths', () => {
    const result = renderDocument(ICON_IR, { format: 'svg', layout: 'vertical-spine' });
    expect(result.svg).toContain('transform=');
  });

  it('horizontal SVG does NOT contain ordinal number when icon is set', () => {
    const result = renderDocument(ICON_IR, { format: 'svg', layout: 'horizontal' });
    // With icon present, ordinal numbers ('01', '02') should NOT appear
    expect(result.svg).not.toContain('>01<');
    expect(result.svg).not.toContain('>02<');
  });
});

// ---------------------------------------------------------------------------
// (f) Unknown icon falls back gracefully — no crash, ordinal shown
// ---------------------------------------------------------------------------

describe('icons — (f) unknown icon fallback', () => {
  it('rendering milestone with unknown icon does not throw', () => {
    expect(() => renderDocument(UNKNOWN_ICON_IR, { format: 'svg' })).not.toThrow();
  });

  it('milestone with unknown icon still renders the ordinal number', () => {
    const result = renderDocument(UNKNOWN_ICON_IR, { format: 'svg' });
    expect(result.svg).toBeDefined();
    expect(result.svg).toContain('>01<');
  });

  it('SVG output is non-empty even with unknown icon', () => {
    const result = renderDocument(UNKNOWN_ICON_IR, { format: 'svg' });
    expect(result.svg!.length).toBeGreaterThan(100);
  });

  it('two renders with unknown icon are still byte-identical', () => {
    const r1 = renderDocument(UNKNOWN_ICON_IR, { format: 'svg' });
    const r2 = renderDocument(UNKNOWN_ICON_IR, { format: 'svg' });
    expect(r1.svg).toBe(r2.svg);
  });
});
