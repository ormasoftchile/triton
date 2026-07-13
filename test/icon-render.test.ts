/**
 * P2 Icon Render Tests
 *
 * Validates the SceneIcon → SVG emit pipeline:
 *   - Monochrome tinting via CSS currentColor
 *   - Brand verbatim emit (no color override)
 *   - Brand gradient ID namespacing (no bare id= collisions across instances)
 *   - Transform application (rotate, hFlip, vFlip)
 *   - No <foreignObject> or <image> in output
 *   - viewBox / aspect-ratio scaling correctness
 */

import { describe, it, expect } from 'vitest';
import { renderSVG } from '../src/render/svg.js';
import type { Scene, SceneIcon } from '../src/contracts/index.js';
import type { ResolvedIcon } from '../src/contracts/icons.js';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** A minimal monochrome icon (MDI-style — uses currentColor). */
const MONO_ICON: ResolvedIcon = {
  body: '<path fill="currentColor" d="M4 2h16v20H4z"/>',
  viewBox: { width: 24, height: 24, left: 0, top: 0 },
  transforms: { rotate: 0, hFlip: false, vFlip: false },
  colorMode: 'monochrome',
};

/** A brand icon with hardcoded hex fills (Azure-style). */
const BRAND_ICON: ResolvedIcon = {
  body: '<rect fill="#0078D4" x="0" y="0" width="18" height="18"/>',
  viewBox: { width: 18, height: 18, left: 0, top: 0 },
  transforms: { rotate: 0, hFlip: false, vFlip: false },
  colorMode: 'brand',
};

/** A brand icon with a linearGradient (id collision risk). */
const GRAD_ICON: ResolvedIcon = {
  body: '<defs><linearGradient id="a"><stop offset="0%" stop-color="#0078D4"/><stop offset="100%" stop-color="#005A9E"/></linearGradient></defs><rect fill="url(#a)" width="24" height="24"/>',
  viewBox: { width: 24, height: 24, left: 0, top: 0 },
  transforms: { rotate: 0, hFlip: false, vFlip: false },
  colorMode: 'brand',
};

/** Helper: build a minimal Scene containing a single SceneIcon element. */
function iconScene(icon: SceneIcon): Scene {
  return {
    viewBox: { x: 0, y: 0, width: 200, height: 200 },
    elements: [icon],
  };
}

function makeIcon(partial: Omit<SceneIcon, 'type'>): SceneIcon {
  return { type: 'icon', ...partial };
}

// ─── Monochrome tinting ───────────────────────────────────────────────────────

describe('SceneIcon monochrome', () => {
  it('emits a nested <svg> element', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 10, y: 10, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('<svg x=');
    expect(svg).toContain('viewBox=');
  });

  it('applies color tint as style="color:..." on the nested svg wrapper', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 10, y: 10, size: 32, color: '#1e293b' });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('style="color:#1e293b"');
  });

  it('emits body with currentColor verbatim inside the wrapper', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 10, y: 10, size: 32, color: '#1e293b' });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('fill="currentColor"');
  });

  it('omits style attribute when no color specified', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 10, y: 10, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).not.toContain('style="color:');
  });

  it('does NOT emit a hardcoded fill color for monochrome icons', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 10, y: 10, size: 32, color: '#ff0000' });
    const svg = renderSVG(iconScene(el));
    // The body path must still use currentColor, not #ff0000 as a fill attribute
    expect(svg).not.toMatch(/fill="#ff0000"/);
    expect(svg).toContain('fill="currentColor"');
  });
});

// ─── Brand verbatim emit ──────────────────────────────────────────────────────

describe('SceneIcon brand', () => {
  it('emits the brand fill color verbatim in the body', () => {
    const el = makeIcon({ icon: BRAND_ICON, x: 10, y: 10, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('#0078D4');
  });

  it('does NOT add a style="color:..." attribute for brand icons', () => {
    const el = makeIcon({ icon: BRAND_ICON, x: 10, y: 10, size: 32, color: '#ff0000' });
    const svg = renderSVG(iconScene(el));
    expect(svg).not.toContain('style="color:');
  });

  it('wraps brand body in a nested <svg> with correct viewBox', () => {
    const el = makeIcon({ icon: BRAND_ICON, x: 0, y: 0, size: 36 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('viewBox="0 0 18 18"');
  });
});

// ─── Brand gradient ID namespacing ───────────────────────────────────────────

describe('SceneIcon brand gradient ID namespacing', () => {
  it('rewrites id="a" to a namespaced id in the body', () => {
    const el = makeIcon({ icon: GRAD_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    // The bare id="a" must NOT appear
    expect(svg).not.toMatch(/\bid="a"/);
    // A namespaced id must appear
    expect(svg).toMatch(/id="icn\d+-a"/);
  });

  it('rewrites url(#a) reference to match the namespaced id', () => {
    const el = makeIcon({ icon: GRAD_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).not.toContain('url(#a)');
    expect(svg).toMatch(/url\(#icn\d+-a\)/);
  });

  it('uses DIFFERENT prefixes for two brand icons to avoid ID collisions', () => {
    const el1 = makeIcon({ icon: GRAD_ICON, x: 0,   y: 0, size: 32 });
    const el2 = makeIcon({ icon: GRAD_ICON, x: 50,  y: 0, size: 32 });
    const scene: Scene = {
      viewBox: { x: 0, y: 0, width: 300, height: 100 },
      elements: [el1, el2],
    };
    const svg = renderSVG(scene);

    // Collect all id= values in the SVG
    const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    // No two elements should share the same id
    expect(new Set(ids).size).toBe(ids.length);
    // There must be exactly two distinct icon-prefixed gradient ids
    const iconIds = ids.filter(id => id?.startsWith('icn'));
    expect(iconIds).toHaveLength(2);
    expect(iconIds[0]).not.toBe(iconIds[1]);
  });
});

// ─── Transforms ──────────────────────────────────────────────────────────────

describe('SceneIcon transforms', () => {
  it('emits NO transform <g> wrapper for identity transform', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    // No <g transform="..."> should appear for the icon
    const match = svg.match(/<g transform="([^"]+)"/);
    expect(match).toBeNull();
  });

  it('wraps body in <g transform="..."> for rotate=1 (90°)', () => {
    const rotIcon: ResolvedIcon = {
      ...MONO_ICON,
      transforms: { rotate: 1, hFlip: false, vFlip: false },
    };
    const el = makeIcon({ icon: rotIcon, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('<g transform="');
    expect(svg).toContain('rotate(90)');
  });

  it('wraps body in <g transform="..."> for hFlip=true', () => {
    const flipIcon: ResolvedIcon = {
      ...MONO_ICON,
      transforms: { rotate: 0, hFlip: true, vFlip: false },
    };
    const el = makeIcon({ icon: flipIcon, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('scale(-1 1)');
  });

  it('wraps body in <g transform="..."> for vFlip=true', () => {
    const flipIcon: ResolvedIcon = {
      ...MONO_ICON,
      transforms: { rotate: 0, hFlip: false, vFlip: true },
    };
    const el = makeIcon({ icon: flipIcon, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('scale(1 -1)');
  });

  it('combines rotate and hFlip in one transform', () => {
    const comboIcon: ResolvedIcon = {
      ...MONO_ICON,
      transforms: { rotate: 2, hFlip: true, vFlip: false },
    };
    const el = makeIcon({ icon: comboIcon, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('rotate(180)');
    expect(svg).toContain('scale(-1 1)');
  });

  it('encodes rotation around the icon viewBox center', () => {
    const rotIcon: ResolvedIcon = {
      ...MONO_ICON, // viewBox 0 0 24 24, center = (12, 12)
      transforms: { rotate: 1, hFlip: false, vFlip: false },
    };
    const el = makeIcon({ icon: rotIcon, x: 0, y: 0, size: 48 });
    const svg = renderSVG(iconScene(el));
    // center of 0 0 24 24 is (12, 12)
    expect(svg).toContain('translate(12 12)');
    expect(svg).toContain('translate(-12 -12)');
  });
});

// ─── viewBox scaling ─────────────────────────────────────────────────────────

describe('SceneIcon viewBox scaling', () => {
  it('preserves aspect ratio for a square icon in a square box', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 0, y: 0, size: 48 });
    const svg = renderSVG(iconScene(el));
    // 24×24 icon in 48×48 box → scale=2 → width=48, height=48
    expect(svg).toContain('width="48"');
    expect(svg).toContain('height="48"');
  });

  it('preserves aspect ratio and centers for a wide non-square icon', () => {
    const wideIcon: ResolvedIcon = {
      body: '<rect fill="currentColor" width="32" height="16"/>',
      viewBox: { width: 32, height: 16, left: 0, top: 0 },
      transforms: { rotate: 0, hFlip: false, vFlip: false },
      colorMode: 'monochrome',
    };
    const el = makeIcon({ icon: wideIcon, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    // scale = min(32/32, 32/16) = 1
    // scaledW=32, scaledH=16 → centered: y offset = 0+(32-16)/2 = 8
    expect(svg).toContain('height="16"');
    expect(svg).toContain('y="8"');
  });

  it('encodes the viewBox correctly with non-zero origin', () => {
    const offsetIcon: ResolvedIcon = {
      body: '<path fill="currentColor" d="M2 2h20v20H2z"/>',
      viewBox: { width: 24, height: 24, left: 2, top: 2 },
      transforms: { rotate: 0, hFlip: false, vFlip: false },
      colorMode: 'monochrome',
    };
    const el = makeIcon({ icon: offsetIcon, x: 10, y: 10, size: 24 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('viewBox="2 2 24 24"');
  });
});

// ─── Safety: no <foreignObject> or <image> ────────────────────────────────────

describe('SceneIcon rsvg safety', () => {
  it('never emits <foreignObject> for monochrome icon', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).not.toContain('<foreignObject');
    expect(svg).not.toContain('<image');
  });

  it('never emits <foreignObject> for brand icon', () => {
    const el = makeIcon({ icon: BRAND_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).not.toContain('<foreignObject');
    expect(svg).not.toContain('<image');
  });

  it('never emits <foreignObject> for gradient brand icon', () => {
    const el = makeIcon({ icon: GRAD_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    expect(svg).not.toContain('<foreignObject');
    expect(svg).not.toContain('<image');
  });
});

// ─── opacity passthrough ──────────────────────────────────────────────────────

describe('SceneIcon opacity', () => {
  it('emits opacity attribute when specified', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 0, y: 0, size: 32, opacity: 0.5 });
    const svg = renderSVG(iconScene(el));
    expect(svg).toContain('opacity="0.5"');
  });

  it('omits opacity attribute when not specified', () => {
    const el = makeIcon({ icon: MONO_ICON, x: 0, y: 0, size: 32 });
    const svg = renderSVG(iconScene(el));
    // The outer <svg> must not carry an opacity attribute
    const nestedSvgLine = svg.split('\n').find(l => l.includes('viewBox="0 0 24 24"'));
    expect(nestedSvgLine).toBeDefined();
    expect(nestedSvgLine).not.toContain('opacity=');
  });
});
