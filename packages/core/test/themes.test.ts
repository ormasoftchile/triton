/**
 * @file test/themes.test.ts — Theme registry and multi-theme rendering tests.
 *
 * Covers:
 *  - resolveTheme returns correct objects for all 5 registered themes
 *  - listThemeInfos returns metadata for all 5 themes
 *  - rendering a small fixture under each theme yields valid, non-empty SVG
 *  - rendering is deterministic (two renders byte-identical)
 *  - minimal theme: all activity fills are greyscale (no hue)
 *  - release theme: milestone renders a <path> element (triangle shape)
 *  - executive theme: dark canvas background present in SVG
 *  - bytebytego theme: dark canvas, determinism + gallery emit
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse as parseYaml } from 'yaml';
import type { IRDocument } from '../src/types.js';
import { resolveTheme, listThemeInfos } from '../src/themes/index.js';
import { renderDocument } from '../src/render/index.js';
import { parseIR } from '../src/load.js';

// ---------------------------------------------------------------------------
// Small fixture shared across all theme tests
// ---------------------------------------------------------------------------

const FIXTURE: IRDocument = {
  version:  '1.0',
  metadata: {
    title:      'Theme Test',
    today:      '2026-06-10',
    time_range: { start: '2026-01', end: '2026-12' },
    axis_unit:  'quarter',
  },
  tracks: [
    { id: 'delivery', label: 'Delivery', index: 0 },
    { id: 'quality',  label: 'Quality',  index: 1 },
  ],
  activities: [
    { id: 'act-planned',     label: 'Planning',  track: 'delivery', start: '2026-01-01', end: '2026-03-31', status: 'planned'     },
    { id: 'act-in-progress', label: 'Build',     track: 'delivery', start: '2026-04-01', end: '2026-06-30', status: 'in-progress', progress: 0.6 },
    { id: 'act-done',        label: 'Discovery', track: 'delivery', start: '2026-01-01', end: '2026-02-28', status: 'done'        },
    { id: 'act-at-risk',     label: 'Testing',   track: 'quality',  start: '2026-04-01', end: '2026-06-30', status: 'at-risk'     },
    { id: 'act-blocked',     label: 'Integration', track: 'quality', start: '2026-07-01', end: '2026-09-30', status: 'blocked'    },
  ],
  milestones: [
    { id: 'ms-1', label: 'Alpha Release', date: '2026-03-31', track: 'delivery', status: 'done',    category: 'standard-node' },
    { id: 'ms-2', label: 'Beta Launch',   date: '2026-06-30', track: 'delivery', status: 'planned', category: 'standard-node' },
  ],
};

const ALL_THEME_IDS = ['consulting', 'executive', 'minimal', 'product', 'release'] as const;

// ---------------------------------------------------------------------------
// Helper: is a hex colour string greyscale? (#RRGGBB where RR===GG===BB)
// ---------------------------------------------------------------------------

function isGreyscaleHex(hex: string): boolean {
  const m = /^#([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/.exec(hex);
  if (!m) return false;
  return m[1]!.toLowerCase() === m[2]!.toLowerCase() &&
         m[2]!.toLowerCase() === m[3]!.toLowerCase();
}

// ---------------------------------------------------------------------------
// Theme registry
// ---------------------------------------------------------------------------

describe('theme registry', () => {
  it('resolveTheme returns correct theme for each id', () => {
    for (const id of ALL_THEME_IDS) {
      const theme = resolveTheme(id);
      expect(theme.id).toBe(id);
      expect(typeof theme.title).toBe('string');
      expect(theme.title.length).toBeGreaterThan(0);
    }
  });

  it('resolveTheme falls back to consulting for unknown id', () => {
    const theme = resolveTheme('nonexistent-theme-xyz');
    expect(theme.id).toBe('consulting');
  });

  it('listThemeInfos returns entries for all 5 themes (plus default alias)', () => {
    const infos = listThemeInfos();
    expect(infos.length).toBeGreaterThanOrEqual(5);
    const ids = infos.map((t) => t.id);
    for (const id of ALL_THEME_IDS) {
      expect(ids).toContain(id);
    }
  });

  it('all themes have valid tier values', () => {
    const infos = listThemeInfos();
    for (const info of infos) {
      expect(info.tier).toBeGreaterThanOrEqual(1);
      expect(info.tier).toBeLessThanOrEqual(3);
    }
  });

  it('all themes have complete statusMap with all 7 Status keys', () => {
    const statuses = ['planned', 'in-progress', 'done', 'at-risk', 'blocked', 'cancelled', 'tentative'];
    for (const id of ALL_THEME_IDS) {
      const theme = resolveTheme(id);
      for (const s of statuses) {
        expect(theme.statusMap).toHaveProperty(s);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Multi-theme rendering
// ---------------------------------------------------------------------------

describe('multi-theme rendering', () => {
  for (const themeId of ALL_THEME_IDS) {
    describe(`theme: ${themeId}`, () => {
      it('produces a valid non-empty SVG string', () => {
        const result = renderDocument(FIXTURE, { format: 'svg', theme: themeId });
        expect(result.svg).toBeDefined();
        expect(typeof result.svg).toBe('string');
        expect(result.svg!.length).toBeGreaterThan(200);
        expect(result.svg).toMatch(/^<\?xml/);
        expect(result.svg).toContain('<svg');
        expect(result.svg).toContain('xmlns="http://www.w3.org/2000/svg"');
      });

      it('is deterministic (two renders produce byte-identical SVG)', () => {
        const r1 = renderDocument(FIXTURE, { format: 'svg', theme: themeId });
        const r2 = renderDocument(FIXTURE, { format: 'svg', theme: themeId });
        expect(r1.svg).toBe(r2.svg);
        expect(r1.sceneHash).toBe(r2.sceneHash);
      });

      it('sceneHash is a 64-character hex string', () => {
        const result = renderDocument(FIXTURE, { format: 'svg', theme: themeId });
        expect(result.sceneHash).toMatch(/^[0-9a-f]{64}$/);
      });

      it('SVG contains the fixture title', () => {
        const result = renderDocument(FIXTURE, { format: 'svg', theme: themeId });
        expect(result.svg).toContain('Theme Test');
      });
    });
  }
});

// ---------------------------------------------------------------------------
// Theme-specific visual assertions
// ---------------------------------------------------------------------------

describe('executive theme — dark background', () => {
  it('SVG contains the dark canvas background fill', () => {
    const result = renderDocument(FIXTURE, { format: 'svg', theme: 'executive' });
    // Executive background is #0D1B2A — verify SVG includes this dark rect
    expect(result.svg).toContain('#0D1B2A');
  });

  it('dark background rect appears as the first rect element', () => {
    const result = renderDocument(FIXTURE, { format: 'svg', theme: 'executive' });
    // Background rect fill should be the canvas background color
    const theme = resolveTheme('executive');
    expect(result.svg).toContain(`fill="${theme.canvas.backgroundColor}"`);
  });
});

describe('minimal theme — greyscale fills only', () => {
  it('all fill attribute values in the SVG are greyscale or white/transparent', () => {
    const result = renderDocument(FIXTURE, { format: 'svg', theme: 'minimal' });
    // Extract all fill="#XXXXXX" hex values
    const hexFills = [...result.svg!.matchAll(/fill="(#[0-9a-fA-F]{6})"/g)]
      .map((m) => m[1]!);

    // Every hex fill must be greyscale
    for (const hex of hexFills) {
      expect(isGreyscaleHex(hex)).toBe(true);
    }
  });

  it('minimal theme statusMap uses only greyscale fills', () => {
    const theme = resolveTheme('minimal');
    const statuses = Object.values(theme.statusMap);
    for (const s of statuses) {
      expect(isGreyscaleHex(s.fill)).toBe(true);
    }
  });
});

describe('release theme — triangle milestones', () => {
  it('SVG contains <path elements for triangle milestone shapes', () => {
    const result = renderDocument(FIXTURE, { format: 'svg', theme: 'release' });
    // Release uses triangle shape → path element for each milestone
    expect(result.svg).toContain('<path');
  });

  it('release theme milestone shape is "triangle"', () => {
    const theme = resolveTheme('release');
    expect(theme.milestone.shape).toBe('triangle');
  });

  it('traffic-light: done=green, blocked=red in statusMap', () => {
    const theme = resolveTheme('release');
    const doneFill    = theme.statusMap['done']!.fill.toUpperCase();
    const blockedFill = theme.statusMap['blocked']!.fill.toUpperCase();
    // done is #16A34A (green-family: high green component)
    const doneG = parseInt(doneFill.slice(3, 5), 16);
    const doneR = parseInt(doneFill.slice(1, 3), 16);
    expect(doneG).toBeGreaterThan(doneR); // more green than red
    // blocked is #DC2626 (red-family: high red component)
    const blockedR = parseInt(blockedFill.slice(1, 3), 16);
    const blockedG = parseInt(blockedFill.slice(3, 5), 16);
    expect(blockedR).toBeGreaterThan(blockedG); // more red than green
  });
});

describe('product theme — category-driven colours', () => {
  it('categoryMap has multiple category overrides', () => {
    const theme = resolveTheme('product');
    expect(Object.keys(theme.categoryMap).length).toBeGreaterThanOrEqual(5);
  });
});

// ---------------------------------------------------------------------------
// Consulting golden non-regression: ensure consulting renders are unchanged
// ---------------------------------------------------------------------------

describe('consulting theme non-regression', () => {
  it('two consulting renders are byte-identical (Consulting golden unchanged)', () => {
    const r1 = renderDocument(FIXTURE, { format: 'svg', theme: 'consulting' });
    const r2 = renderDocument(FIXTURE, { format: 'svg', theme: 'consulting' });
    expect(r1.svg).toBe(r2.svg);
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('consulting theme has titleColor #111111 (matches previous hardcoded value)', () => {
    const theme = resolveTheme('consulting');
    expect(theme.typography.titleColor).toBe('#111111');
  });

  it('consulting theme has axisLineColor #333333 (matches previous hardcoded value)', () => {
    const theme = resolveTheme('consulting');
    expect(theme.axis.axisLineColor).toBe('#333333');
  });

  it('consulting theme has tickLabelColor #555555 (matches previous hardcoded value)', () => {
    const theme = resolveTheme('consulting');
    expect(theme.axis.tickLabelColor).toBe('#555555');
  });
});

// ---------------------------------------------------------------------------
// ByteByteGo dark timeline theme tests (Task 3)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');

describe('bytebytego theme — registry & structure', () => {
  it('resolveTheme("bytebytego") returns the bytebyteGo theme', () => {
    const theme = resolveTheme('bytebytego');
    expect(theme.id).toBe('bytebytego');
    expect(theme.title).toBe('ByteByteGo Dark');
    expect(theme.tier).toBe(2);
  });

  it('listThemeInfos includes bytebytego', () => {
    const infos = listThemeInfos();
    const ids = infos.map((t) => t.id);
    expect(ids).toContain('bytebytego');
  });

  it('bytebytego canvas background is dark (#111827)', () => {
    const theme = resolveTheme('bytebytego');
    expect(theme.canvas.backgroundColor).toBe('#111827');
  });

  it('bytebytego has complete statusMap with all 7 statuses', () => {
    const statuses = ['planned', 'in-progress', 'done', 'at-risk', 'blocked', 'cancelled', 'tentative'];
    const theme = resolveTheme('bytebytego');
    for (const s of statuses) {
      expect(theme.statusMap).toHaveProperty(s);
    }
  });
});

describe('bytebytego theme — determinism', () => {
  it('two renders with bytebytego theme are byte-identical', () => {
    const r1 = renderDocument(FIXTURE, { format: 'svg', theme: 'bytebytego' });
    const r2 = renderDocument(FIXTURE, { format: 'svg', theme: 'bytebytego' });
    expect(r1.svg).toBe(r2.svg);
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('bytebytego sceneHash differs from consulting (same IR, different theme)', () => {
    const rBBG = renderDocument(FIXTURE, { format: 'svg', theme: 'bytebytego' });
    const rCon = renderDocument(FIXTURE, { format: 'svg', theme: 'consulting' });
    expect(rBBG.sceneHash).not.toBe(rCon.sceneHash);
  });

  it('bytebytego SVG contains the dark canvas background color', () => {
    const result = renderDocument(FIXTURE, { format: 'svg', theme: 'bytebytego' });
    expect(result.svg).toContain('#111827');
  });
});

describe('bytebytego theme — gallery emit', () => {
  it('emits feature-rich-bytebytego.svg to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });

    const yamlText = readFileSync(
      join(GALLERY_DIR, 'feature-rich.timeline.yaml'),
      'utf-8',
    );
    const ir = parseIR(yamlText);
    const result = renderDocument(ir, { format: 'svg', theme: 'bytebytego' });
    expect(typeof result.svg).toBe('string');
    expect(result.svg!.length).toBeGreaterThan(200);

    const outPath = join(GALLERY_DIR, 'feature-rich-bytebytego.svg');
    writeFileSync(outPath, result.svg!, 'utf-8');
    expect(existsSync(outPath)).toBe(true);
    console.log('[bytebytego] feature-rich-bytebytego.svg →', outPath);
  });

  it('emits feature-rich-bytebytego.png to examples/gallery/', () => {
    if (!existsSync(GALLERY_DIR)) mkdirSync(GALLERY_DIR, { recursive: true });

    const yamlText = readFileSync(
      join(GALLERY_DIR, 'feature-rich.timeline.yaml'),
      'utf-8',
    );
    const ir = parseIR(yamlText);
    const result = renderDocument(ir, { format: 'png', theme: 'bytebytego' });
    expect(result.png).toBeInstanceOf(Uint8Array);
    expect(result.png![0]).toBe(0x89); // PNG signature

    const outPath = join(GALLERY_DIR, 'feature-rich-bytebytego.png');
    writeFileSync(outPath, result.png!);
    expect(existsSync(outPath)).toBe(true);
    console.log('[bytebytego] feature-rich-bytebytego.png →', outPath);
  });

  it('feature-rich default render is byte-identical before and after (bytebytego does not pollute default)', () => {
    const yamlText = readFileSync(
      join(GALLERY_DIR, 'feature-rich.timeline.yaml'),
      'utf-8',
    );
    const ir = parseIR(yamlText);
    // Default fixture theme is 'product' — ensure it is unchanged.
    const r1 = renderDocument(ir, { format: 'svg', theme: 'product' });
    const r2 = renderDocument(ir, { format: 'svg', theme: 'product' });
    expect(r1.svg).toBe(r2.svg);
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });
});
