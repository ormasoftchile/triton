/**
 * @file test/mermaid-config-surface.test.ts — Config-surface parsing + resolveContractTheme tests.
 *
 * Coverage:
 *   1. preprocessMermaid — extracts layout / density / themeOverrides from frontmatter AND %%{init}%%
 *   2. resolveContractTheme — applies density override and token overrides deterministically
 *   3. Unknown keys / invalid values are ignored without error (graceful degradation)
 *   4. renderMermaid with config-surface keys — density and accent override applied
 *   5. Gallery emit — three demo SVG/PNG files written to examples/gallery/
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { preprocessMermaid } from '../src/frontend/mermaid/utils.js';
import { resolveContractTheme } from '../src/theme-contract/resolve.js';
import { executive, midnight } from '../src/theme-contract/index.js';
import { renderMermaid } from '../src/frontend/mermaid/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '..', '..', '..');
const GALLERY    = join(REPO_ROOT, 'examples', 'gallery');

function writeGallery(name: string, content: string | Uint8Array): void {
  if (!existsSync(GALLERY)) mkdirSync(GALLERY, { recursive: true });
  writeFileSync(join(GALLERY, name), content);
}

// ── 1. preprocessMermaid: frontmatter extraction ───────────────────────────

describe('preprocessMermaid — config-surface frontmatter extraction', () => {
  it('extracts layout from frontmatter', () => {
    const text = `---
layout: vertical-spine
theme: midnight
---
timeline
    title Test`;
    const result = preprocessMermaid(text);
    expect(result.frontmatter['layout']).toBe('vertical-spine');
    expect(result.frontmatter['theme']).toBe('midnight');
  });

  it('extracts density from frontmatter', () => {
    const text = `---
theme: executive
density: compact
---
flowchart LR
    A --> B`;
    const result = preprocessMermaid(text);
    expect(result.frontmatter['density']).toBe('compact');
  });

  it('extracts themeOverrides object from frontmatter', () => {
    const text = `---
theme: midnight
themeOverrides:
  accent: "#0A7F6F"
  fontFamily: "Inter"
---
flowchart LR
    A --> B`;
    const result = preprocessMermaid(text);
    const overrides = result.frontmatter['themeOverrides'] as Record<string, unknown>;
    expect(overrides).toBeDefined();
    expect(overrides['accent']).toBe('#0A7F6F');
    expect(overrides['fontFamily']).toBe('Inter');
  });

  it('returns body without frontmatter, layout and density keys do not affect body', () => {
    const text = `---
theme: executive
density: compact
layout: vertical-spine
---
flowchart LR
    A --> B`;
    const { body } = preprocessMermaid(text);
    expect(body.trim()).toBe('flowchart LR\n    A --> B');
  });
});

// ── 2. preprocessMermaid: %%{init}%% directive extraction ─────────────────

describe('preprocessMermaid — config-surface %%{init}%% directive extraction', () => {
  it('extracts layout from %%{init}%%', () => {
    const text = `%%{init: {"layout": "vertical-spine", "theme": "midnight"}}%%
timeline
    title Test`;
    const result = preprocessMermaid(text);
    expect(result.directiveLayout).toBe('vertical-spine');
    expect(result.directiveTheme).toBe('midnight');
  });

  it('extracts density from %%{init}%%', () => {
    const text = `%%{init: {"theme": "executive", "density": "compact"}}%%
flowchart LR
    A --> B`;
    const result = preprocessMermaid(text);
    expect(result.directiveDensity).toBe('compact');
  });

  it('extracts themeOverrides object from %%{init}%%', () => {
    const text = `%%{init: {"theme": "midnight", "themeOverrides": {"accent": "#0A7F6F"}}}%%
flowchart LR
    A --> B`;
    const result = preprocessMermaid(text);
    expect(result.directiveThemeOverrides).toBeDefined();
    expect(result.directiveThemeOverrides!['accent']).toBe('#0A7F6F');
  });

  it('directive line is dropped from body', () => {
    const text = `%%{init: {"layout": "serpentine"}}%%
timeline
    title History`;
    const { body } = preprocessMermaid(text);
    expect(body).not.toContain('%%{init');
    expect(body.trim()).toContain('timeline');
  });

  it('undefined for missing optional fields — no error', () => {
    const text = `%%{init: {"theme": "midnight"}}%%
flowchart LR
    A --> B`;
    const result = preprocessMermaid(text);
    expect(result.directiveLayout).toBeUndefined();
    expect(result.directiveDensity).toBeUndefined();
    expect(result.directiveThemeOverrides).toBeUndefined();
  });
});

// ── 3. resolveContractTheme — no-op when no options ──────────────────────

describe('resolveContractTheme — identity when no overrides', () => {
  it('returns same reference when no density or overrides', () => {
    const result = resolveContractTheme('executive', {});
    // Same object (fast path)
    expect(result).toBe(executive);
  });

  it('returns same reference for midnight', () => {
    const result = resolveContractTheme('midnight');
    expect(result).toBe(midnight);
  });

  it('throws on unknown theme name', () => {
    expect(() => resolveContractTheme('nonexistent-xyz')).toThrow(/Unknown contract theme/);
  });
});

// ── 4. resolveContractTheme — density override ────────────────────────────

describe('resolveContractTheme — density override', () => {
  it('overrides density to compact', () => {
    const base = executive; // density: 'comfortable'
    const resolved = resolveContractTheme('executive', { density: 'compact' });
    expect(base.density).toBe('comfortable');
    expect(resolved.density).toBe('compact');
  });

  it('preserves all other fields when only density changes', () => {
    const resolved = resolveContractTheme('executive', { density: 'compact' });
    expect(resolved.palette.accent).toBe(executive.palette.accent);
    expect(resolved.typography.family).toBe(executive.typography.family);
    expect(resolved.shape.cornerRadius).toBe(executive.shape.cornerRadius);
  });

  it('overrides density to normal', () => {
    const resolved = resolveContractTheme('midnight', { density: 'normal' });
    expect(resolved.density).toBe('normal');
  });

  it('is deterministic — same inputs → same output structure', () => {
    const a = resolveContractTheme('executive', { density: 'compact' });
    const b = resolveContractTheme('executive', { density: 'compact' });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ── 5. resolveContractTheme — token overrides (shorthand flat keys) ────────

describe('resolveContractTheme — shorthand flat token overrides', () => {
  it('overrides accent via shorthand key', () => {
    const resolved = resolveContractTheme('midnight', {
      overrides: { accent: '#0A7F6F' },
    });
    expect(resolved.palette.accent).toBe('#0A7F6F');
    // Other palette fields unchanged
    expect(resolved.palette.surface).toBe(midnight.palette.surface);
  });

  it('overrides surface via shorthand key', () => {
    const resolved = resolveContractTheme('executive', {
      overrides: { surface: '#FFFFF0' },
    });
    expect(resolved.palette.surface).toBe('#FFFFF0');
  });

  it('overrides fontFamily via shorthand key', () => {
    const resolved = resolveContractTheme('executive', {
      overrides: { fontFamily: 'Inter' },
    });
    expect(resolved.typography.family).toBe('Inter');
    // Other typography fields unchanged
    expect(resolved.typography.scale.base).toBe(executive.typography.scale.base);
  });

  it('overrides cornerRadius via shorthand key', () => {
    const resolved = resolveContractTheme('executive', {
      overrides: { cornerRadius: 8 },
    });
    expect(resolved.shape.cornerRadius).toBe(8);
  });

  it('combines multiple shorthand overrides', () => {
    const resolved = resolveContractTheme('midnight', {
      overrides: { accent: '#FF0000', surface: '#111111', fontFamily: 'Roboto' },
    });
    expect(resolved.palette.accent).toBe('#FF0000');
    expect(resolved.palette.surface).toBe('#111111');
    expect(resolved.typography.family).toBe('Roboto');
  });
});

// ── 6. resolveContractTheme — nested path token overrides ─────────────────

describe('resolveContractTheme — nested ThemeContract path overrides', () => {
  it('deep-merges palette object', () => {
    const resolved = resolveContractTheme('executive', {
      overrides: {
        palette: { accent: '#123456', ink: '#222222' },
      },
    });
    expect(resolved.palette.accent).toBe('#123456');
    expect(resolved.palette.ink).toBe('#222222');
    // Other palette fields unchanged
    expect(resolved.palette.surface).toBe(executive.palette.surface);
    expect(resolved.palette.border).toBe(executive.palette.border);
  });

  it('deep-merges typography.scale without destroying other typography fields', () => {
    const resolved = resolveContractTheme('executive', {
      overrides: {
        typography: { scale: { base: 14 } },
      },
    });
    expect(resolved.typography.scale.base).toBe(14);
    // Other scale steps unchanged
    expect(resolved.typography.scale.xs).toBe(executive.typography.scale.xs);
    expect(resolved.typography.family).toBe(executive.typography.family);
  });

  it('combines density + nested override deterministically', () => {
    const a = resolveContractTheme('executive', {
      density: 'compact',
      overrides: { palette: { accent: '#AABBCC' } },
    });
    const b = resolveContractTheme('executive', {
      density: 'compact',
      overrides: { palette: { accent: '#AABBCC' } },
    });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.density).toBe('compact');
    expect(a.palette.accent).toBe('#AABBCC');
  });
});

// ── 7. Graceful degradation — unknown keys silently ignored ────────────────

describe('resolveContractTheme — graceful degradation', () => {
  it('ignores completely unknown override keys without error', () => {
    expect(() => resolveContractTheme('executive', {
      overrides: {
        unknownKey123: 'some-value',
        anotherBadKey: { nested: 'object' },
      },
    })).not.toThrow();
  });

  it('base contract is unchanged after ignoring unknown keys', () => {
    const resolved = resolveContractTheme('executive', {
      overrides: { unknownKey123: 'value', accent: '#123456' },
    });
    // accent was valid and applied
    expect(resolved.palette.accent).toBe('#123456');
    // known fields untouched
    expect(resolved.palette.surface).toBe(executive.palette.surface);
  });
});

// ── 8. renderMermaid — config-surface integration ────────────────────────

describe('renderMermaid — config-surface integration (density + overrides)', () => {
  it('renders flowchart with executive theme + compact density without error', () => {
    const text = `---
theme: executive
density: compact
---
flowchart LR
    A[Start] --> B[End]`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('flowchart');
    expect(result.svg).toBeDefined();
    expect(result.svg!.length).toBeGreaterThan(0);
    expect(result.warnings).not.toContain(expect.stringMatching(/error/i));
  });

  it('renders timeline with executive + compact density (config-surface density)', () => {
    const text = `---
theme: executive
density: compact
---
timeline
    title Test Timeline
    section Phase 1
        2026-01 : Task A`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('timeline');
    expect(result.svg).toBeDefined();
  });

  it('renders timeline with layout: vertical-spine from frontmatter', () => {
    const text = `---
theme: executive
layout: vertical-spine
---
timeline
    title Vertical Spine Test
    section Phase 1
        2026-01 : Milestone A
    section Phase 2
        2026-06 : Milestone B`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('timeline');
    expect(result.svg).toBeDefined();
    expect(result.warnings.some(w => w.includes('Unknown layout'))).toBe(false);
  });

  it('warns for unknown layout and uses fallback', () => {
    const text = `---
theme: executive
layout: totally-invalid-layout
---
timeline
    title Test
    section S1
        2026-01 : E1`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('timeline');
    expect(result.warnings.some(w => w.includes('Unknown layout'))).toBe(true);
    expect(result.svg).toBeDefined(); // still renders
  });

  it('renders flowchart with midnight + accent override from %%{init}%%', () => {
    const text = `%%{init: {"theme": "midnight", "themeOverrides": {"accent": "#0A7F6F"}}}%%
flowchart LR
    A[API] --> B[DB]`;
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('flowchart');
    expect(result.svg).toBeDefined();
  });

  it('ignores unknown frontmatter keys without error (Mermaid compat)', () => {
    const text = `---
theme: executive
unknownFutureKey: some-value
anotherUnknownKey: 42
---
flowchart LR
    A --> B`;
    expect(() => renderMermaid(text, { format: 'svg' })).not.toThrow();
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('flowchart');
    expect(result.svg).toBeDefined();
  });

  it('renders deterministically — same config → same SVG', () => {
    const text = `---
theme: midnight
density: compact
themeOverrides:
  accent: "#0A7F6F"
---
flowchart LR
    A --> B --> C`;
    const r1 = renderMermaid(text, { format: 'svg' });
    const r2 = renderMermaid(text, { format: 'svg' });
    expect(r1.svg).toBe(r2.svg);
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });
});

// ── 9. Gallery demo emit ──────────────────────────────────────────────────

describe('Config-surface gallery demos', () => {
  // ── config-density-compact ─────────────────────────────────────────────
  it('emits config-density-compact.svg/.png — executive + compact density', () => {
    const src = `---
title: "Executive Theme — Compact Density"
theme: executive
density: compact
---
flowchart LR
    codePush([Code Push]) --> lint[Lint]
    lint -->|pass| test[Unit Tests]
    lint -->|fail| fail1[Notify Lint Failed]
    test -->|pass| build[Docker Build]
    test -->|fail| fail2[Notify Tests Failed]
    build --> deploy([Deploy Production])`;

    writeFileSync(join(GALLERY, 'config-density-compact.mmd'), src);

    const svgResult = renderMermaid(src, { format: 'svg' });
    expect(svgResult.svg).toBeDefined();
    writeGallery('config-density-compact.svg', svgResult.svg!);

    const pngResult = renderMermaid(src, { format: 'png' });
    expect(pngResult.png).toBeDefined();
    expect(pngResult.png!.length).toBeGreaterThan(0);
    writeGallery('config-density-compact.png', pngResult.png!);

    // Verify file written
    expect(existsSync(join(GALLERY, 'config-density-compact.svg'))).toBe(true);
    expect(existsSync(join(GALLERY, 'config-density-compact.png'))).toBe(true);
  });

  // ── config-accent-override ─────────────────────────────────────────────
  it('emits config-accent-override.svg/.png — midnight + accent override', () => {
    const src = `---
title: "Midnight Theme — Teal Accent Override"
theme: midnight
themeOverrides:
  accent: "#0A9F8A"
---
flowchart LR
    req([HTTP Request])
    req --> auth{Auth?}
    auth -->|valid| proc[Process Request]
    auth -->|invalid| rej[Reject 401]
    proc --> cache{Cached?}
    cache -->|yes| fast([Cache Hit])
    cache -->|no| db[Query DB]
    db --> resp([Response])`;

    writeFileSync(join(GALLERY, 'config-accent-override.mmd'), src);

    const svgResult = renderMermaid(src, { format: 'svg' });
    expect(svgResult.svg).toBeDefined();
    writeGallery('config-accent-override.svg', svgResult.svg!);

    const pngResult = renderMermaid(src, { format: 'png' });
    expect(pngResult.png).toBeDefined();
    writeGallery('config-accent-override.png', pngResult.png!);

    expect(existsSync(join(GALLERY, 'config-accent-override.svg'))).toBe(true);
    expect(existsSync(join(GALLERY, 'config-accent-override.png'))).toBe(true);
  });

  // ── config-layout ──────────────────────────────────────────────────────
  it('emits config-layout.svg/.png — executive + vertical-spine + even spacing', () => {
    const src = `---
title: "Executive Theme — Vertical Spine Layout"
theme: executive
layout: vertical-spine
spineSpacing: even
---
timeline
    title Technology Milestones

    section Foundations
        1969 : Unix
             : AT&T Bell Labs
        1972 : C Language
             : Dennis Ritchie

    section Systems
        1991 : Linux Kernel
             : Linus Torvalds
        1994 : Apache HTTP
             : Open Source

    section Web Era
        2009 : Go Language
             : Google
        2014 : Swift
             : Apple
        2015 : Rust 1.0
             : Mozilla`;

    writeFileSync(join(GALLERY, 'config-layout.mmd'), src);

    const svgResult = renderMermaid(src, { format: 'svg' });
    expect(svgResult.svg).toBeDefined();
    expect(svgResult.warnings.some(w => w.includes('Unknown layout'))).toBe(false);
    writeGallery('config-layout.svg', svgResult.svg!);

    const pngResult = renderMermaid(src, { format: 'png' });
    expect(pngResult.png).toBeDefined();
    writeGallery('config-layout.png', pngResult.png!);

    expect(existsSync(join(GALLERY, 'config-layout.svg'))).toBe(true);
    expect(existsSync(join(GALLERY, 'config-layout.png'))).toBe(true);
  });
});
