/**
 * @file test/timeline-contract-binding.test.ts — Timeline contract binding unit tests.
 *
 * Validates that:
 *   1. `bindTimelineTheme(executive)` produces a valid, complete ResolvedTheme.
 *   2. The binding is deterministic (same input → same output).
 *   3. The PRECEDENCE RULE is enforced: all 14 legacy timeline theme names
 *      resolve to their legacy ResolvedTheme via `resolveTheme()`, never
 *      to the contract-derived version.  `executive` specifically resolves
 *      to the dark-navy legacy theme, not the contract-derived light theme.
 *   4. A non-legacy contract theme name would fall through to the binding
 *      (structural test only — no new contract themes added yet).
 *
 * These tests guard the "legacy themes always win" invariant that keeps all
 * 14 timeline golden outputs byte-identical after this migration step.
 */

import { describe, expect, it } from 'vitest';

import { executive, CONTRACT_THEMES } from '../src/theme-contract/index.js';
import { bindTimelineTheme } from '../src/themes/index.js';
import { resolveTheme } from '../src/themes/index.js';

// ── Binding validity ──────────────────────────────────────────────────────────

describe('bindTimelineTheme(executive) — valid ResolvedTheme', () => {
  const rt = bindTimelineTheme(executive);

  it('has id matching the contract', () => {
    expect(rt.id).toBe('executive');
  });

  it('has title matching the contract name', () => {
    expect(rt.title).toBe('Executive');
  });

  it('uses contract surface color as canvas background', () => {
    // executive contract: surface = #FFFFFF
    expect(rt.canvas.backgroundColor).toBe('#FFFFFF');
  });

  it('uses contract typography family', () => {
    // executive contract: family = 'Georgia'
    expect(rt.typography.fontFamily).toBe('Georgia');
  });

  it('uses contract accent for categoryMap standard-node fill', () => {
    // executive contract: accent = #1F497D
    expect(rt.categoryMap['standard-node']?.fill).toBe('#1F497D');
  });

  it('axis line color is palette.ink', () => {
    // Convention: axis lines → palette.ink
    expect(rt.axis.axisLineColor).toBe(executive.palette.ink);
  });

  it('gridline color is palette.border', () => {
    // Convention: gridlines → palette.border
    expect(rt.axis.gridlineColor).toBe(executive.palette.border);
  });

  it('track separator color is palette.border', () => {
    expect(rt.track.separatorColor).toBe(executive.palette.border);
  });

  it('track header background is palette.surfacePanel', () => {
    expect(rt.track.headerBackground).toBe(executive.palette.surfacePanel);
  });

  it('track header color is palette.inkPanel', () => {
    expect(rt.track.headerColor).toBe(executive.palette.inkPanel);
  });

  it('milestone shape is circle (contract markerShape)', () => {
    expect(rt.milestone.shape).toBe('circle');
  });

  it('milestone stroke color is palette.surface (halo outline)', () => {
    expect(rt.milestone.strokeColor).toBe(executive.palette.surface);
  });

  it('activity label inside color is palette.inkInverse', () => {
    expect(rt.activity.labelColorInside).toBe(executive.palette.inkInverse);
  });

  it('status map has all 7 required statuses', () => {
    const statuses = ['planned', 'in-progress', 'done', 'at-risk', 'blocked', 'cancelled', 'tentative'] as const;
    for (const s of statuses) {
      expect(rt.statusMap[s]).toBeDefined();
      expect(rt.statusMap[s].fill).toMatch(/^#/);
      expect(rt.statusMap[s].stroke).toMatch(/^#/);
    }
  });

  it('cancelled status has diagonal-hatch pattern (from contract)', () => {
    expect(rt.statusMap['cancelled'].pattern).toBe('diagonal-hatch');
  });

  it('tentative status has dashed-border pattern (from contract)', () => {
    expect(rt.statusMap['tentative'].pattern).toBe('dashed-border');
  });

  it('planned status fill is contract.palette.statusPlanned.fill', () => {
    expect(rt.statusMap['planned'].fill).toBe(executive.palette.statusPlanned.fill);
  });

  it('in-progress status fill is contract.palette.statusActive.fill', () => {
    expect(rt.statusMap['in-progress'].fill).toBe(executive.palette.statusActive.fill);
  });

  it('at-risk status fill is contract.palette.statusWarning.fill', () => {
    expect(rt.statusMap['at-risk'].fill).toBe(executive.palette.statusWarning.fill);
  });

  it('blocked status fill is contract.palette.statusError.fill', () => {
    expect(rt.statusMap['blocked'].fill).toBe(executive.palette.statusError.fill);
  });

  it('comfortable density produces generous row height (88)', () => {
    // executive contract density = 'comfortable'
    expect(rt.track.rowHeight).toBe(88);
  });

  it('comfortable density produces large canvas margins', () => {
    expect(rt.canvas.margin.top).toBeGreaterThanOrEqual(48);
  });

  it('activity bar radius ≤ cornerRadius (derived from shape)', () => {
    expect(rt.activity.barRadius).toBeLessThanOrEqual(executive.shape.cornerRadius);
  });

  it('entry style is card (fidelity ≥ 2 + cornerRadius > 0)', () => {
    // executive: fidelity=2, cornerRadius=4 → card
    expect(rt.entryStyle).toBe('card');
  });

  it('legend background is palette.surfaceRaised', () => {
    expect(rt.legend.backgroundColor).toBe(executive.palette.surfaceRaised);
  });

  it('section band fill (even) is palette.muted', () => {
    expect(rt.section.bandFillEven).toBe(executive.palette.muted);
  });
});

// ── Determinism ───────────────────────────────────────────────────────────────

describe('bindTimelineTheme determinism', () => {
  it('produces identical output for the same input', () => {
    const a = bindTimelineTheme(executive);
    const b = bindTimelineTheme(executive);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces identical output for a deep-clone of the contract', () => {
    const clone = JSON.parse(JSON.stringify(executive)) as typeof executive;
    const a = bindTimelineTheme(executive);
    const b = bindTimelineTheme(clone);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

// ── PRECEDENCE RULE: legacy themes always win ─────────────────────────────────

describe('resolveTheme — legacy themes always win (precedence rule)', () => {
  it('"executive" resolves to the LEGACY dark-navy theme, NOT the contract binding', () => {
    const resolved = resolveTheme('executive');
    // Legacy executive: dark navy background (#0D1B2A), NOT contract white (#FFFFFF)
    expect(resolved.canvas.backgroundColor).toBe('#0D1B2A');
    expect(resolved.canvas.backgroundColor).not.toBe('#FFFFFF');
  });

  it('"consulting" resolves to the legacy consulting theme', () => {
    const resolved = resolveTheme('consulting');
    expect(resolved.id).toBe('consulting');
    expect(resolved.canvas.backgroundColor).toBe('#FFFFFF');
    // consulting uses DejaVu Sans, not Georgia
    expect(resolved.typography.fontFamily).toBe('DejaVu Sans');
  });

  it('"minimal" resolves to the legacy minimal theme', () => {
    const resolved = resolveTheme('minimal');
    expect(resolved.id).toBe('minimal');
  });

  it('"roadmap" resolves to the legacy roadmap theme', () => {
    const resolved = resolveTheme('roadmap');
    expect(resolved.id).toBe('roadmap');
  });

  it('"serpentine" resolves to the legacy serpentine theme', () => {
    const resolved = resolveTheme('serpentine');
    expect(resolved.id).toBe('serpentine');
  });

  it('"showcase" resolves to the legacy showcase theme', () => {
    const resolved = resolveTheme('showcase');
    expect(resolved.id).toBe('showcase');
  });

  it('"bytebytego" resolves to the legacy bytebytego theme', () => {
    const resolved = resolveTheme('bytebytego');
    expect(resolved.id).toBe('bytebytego');
  });

  it('"gitline" resolves to the legacy gitline theme', () => {
    const resolved = resolveTheme('gitline');
    expect(resolved.id).toBe('gitline');
  });

  it('"ai-timeline" resolves to the legacy ai-timeline theme', () => {
    const resolved = resolveTheme('ai-timeline');
    expect(resolved.id).toBe('ai-timeline');
  });

  it('"our-timeline" resolves to the legacy our-timeline theme', () => {
    const resolved = resolveTheme('our-timeline');
    expect(resolved.id).toBe('our-timeline');
  });

  it('"subject-timeline" resolves to the legacy subject-timeline theme', () => {
    const resolved = resolveTheme('subject-timeline');
    expect(resolved.id).toBe('subject-timeline');
  });

  it('"product" resolves to the legacy product theme', () => {
    const resolved = resolveTheme('product');
    expect(resolved.id).toBe('product');
  });

  it('"release" resolves to the legacy release theme', () => {
    const resolved = resolveTheme('release');
    expect(resolved.id).toBe('release');
  });

  it('unknown theme names fall back to consulting (not contract)', () => {
    const resolved = resolveTheme('this-does-not-exist-xyz');
    expect(resolved.id).toBe('consulting');
  });

  it('legacy executive canvas.backgroundColor is dark (#0D1B2A)', () => {
    // Regression guard: the dark-navy executive golden MUST be preserved.
    const resolved = resolveTheme('executive');
    expect(resolved.canvas.backgroundColor).toBe('#0D1B2A');
  });

  it('contract-derived executive via bindTimelineTheme is DIFFERENT from legacy', () => {
    const legacy = resolveTheme('executive');
    const contractDerived = bindTimelineTheme(CONTRACT_THEMES.executive!);
    // Same id but different backgrounds: legacy=dark, contract=light
    expect(legacy.id).toBe(contractDerived.id);
    expect(legacy.canvas.backgroundColor).not.toBe(contractDerived.canvas.backgroundColor);
  });
});

// ── Contract shape validation ─────────────────────────────────────────────────

describe('executive ThemeContract — new fields (migration step 1)', () => {
  it('palette.surfacePanel is defined', () => {
    expect(executive.palette.surfacePanel).toMatch(/^#/);
  });

  it('palette.inkPanel is defined', () => {
    expect(executive.palette.inkPanel).toMatch(/^#/);
  });

  it('shape.markerShape is circle', () => {
    expect(executive.shape.markerShape).toBe('circle');
  });

  it('statusCancelled has pattern=diagonal-hatch', () => {
    expect(executive.palette.statusCancelled.pattern).toBe('diagonal-hatch');
  });

  it('statusUncertain has pattern=dashed-border', () => {
    expect(executive.palette.statusUncertain.pattern).toBe('dashed-border');
  });
});
