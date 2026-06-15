/**
 * @file test/theme-contract-bindings.test.ts — Tier-3 binding unit tests.
 *
 * Validates that:
 *   1. bindFlowTheme(executive) produces a valid FlowTheme
 *   2. bindSequenceTheme(executive) produces a valid SequenceTheme
 *   3. bindChartTheme(executive) produces a valid ChartTheme
 *   4. All three bindings are deterministic (same input → same output)
 *   5. The CONTRACT_THEMES registry contains the executive theme
 *   6. isContractTheme() guards are correct
 *
 * These tests prove the Tier-2 contract (ThemeContract) can be fully
 * realised into a component-specific theme without any component-specific
 * hacks. Passing these tests commits the Tier-2 vocabulary as final (§12).
 */

import { describe, expect, it } from 'vitest';

import { executive, CONTRACT_THEMES, isContractTheme } from '../src/theme-contract/index.js';
import type { ThemeContract } from '../src/theme-contract/index.js';
import { bindFlowTheme }     from '../src/grammars/flow/contract-binding.js';
import { bindSequenceTheme } from '../src/grammars/sequence/contract-binding.js';
import { bindChartTheme }    from '../src/grammars/chart/contract-binding.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Deep-clone a ThemeContract so we can test determinism without aliasing. */
function cloneContract(c: ThemeContract): ThemeContract {
  return JSON.parse(JSON.stringify(c)) as ThemeContract;
}

// ── Contract registry ─────────────────────────────────────────────────────────

describe('CONTRACT_THEMES registry', () => {
  it('contains the executive theme', () => {
    expect(CONTRACT_THEMES['executive']).toBeDefined();
    expect(CONTRACT_THEMES['executive']!.id).toBe('executive');
  });

  it('isContractTheme("executive") returns true', () => {
    expect(isContractTheme('executive')).toBe(true);
  });

  it('isContractTheme("default-flow") returns false', () => {
    expect(isContractTheme('default-flow')).toBe(false);
  });

  it('isContractTheme(undefined) returns false', () => {
    expect(isContractTheme(undefined)).toBe(false);
  });
});

// ── Executive contract shape ──────────────────────────────────────────────────

describe('executive ThemeContract shape', () => {
  it('has id "executive"', () => {
    expect(executive.id).toBe('executive');
  });

  it('has all required palette roles', () => {
    const { palette } = executive;
    expect(palette.surface).toMatch(/^#/);
    expect(palette.surfaceRaised).toMatch(/^#/);
    expect(palette.surfaceOverlay).toMatch(/^#/);
    expect(palette.ink).toMatch(/^#/);
    expect(palette.inkMuted).toMatch(/^#/);
    expect(palette.inkInverse).toMatch(/^#/);
    expect(palette.accent).toMatch(/^#/);
    expect(palette.accentMuted).toMatch(/^#/);
    expect(palette.accentStrong).toMatch(/^#/);
    expect(palette.border).toMatch(/^#/);
    expect(palette.muted).toMatch(/^#/);
    expect(palette.statusSuccess.fill).toMatch(/^#/);
    expect(palette.statusWarning.fill).toMatch(/^#/);
    expect(palette.statusError.fill).toMatch(/^#/);
    expect(palette.statusInfo.fill).toMatch(/^#/);
  });

  it('data palette categorical has at least 6 entries', () => {
    expect(executive.dataPalette.categorical.length).toBeGreaterThanOrEqual(6);
    for (const c of executive.dataPalette.categorical) {
      expect(c).toMatch(/^#/);
    }
  });

  it('data palette sequential has low/mid/high', () => {
    const { sequential } = executive.dataPalette;
    expect(sequential.low).toMatch(/^#/);
    expect(sequential.mid).toMatch(/^#/);
    expect(sequential.high).toMatch(/^#/);
  });

  it('data palette diverging has negative/zero/positive', () => {
    const { diverging } = executive.dataPalette;
    expect(diverging.negative).toMatch(/^#/);
    expect(diverging.zero).toMatch(/^#/);
    expect(diverging.positive).toMatch(/^#/);
  });

  it('typography has family, scale, weights', () => {
    const { typography } = executive;
    expect(typography.family).toBeTruthy();
    expect(typography.scale.xs).toBeGreaterThan(0);
    expect(typography.scale.sm).toBeGreaterThan(typography.scale.xs);
    expect(typography.scale.base).toBeGreaterThan(typography.scale.sm);
    expect(typography.scale.md).toBeGreaterThan(typography.scale.base);
    expect(typography.scale.lg).toBeGreaterThan(typography.scale.md);
    expect(typography.scale.xl).toBeGreaterThan(typography.scale.lg);
    expect(typography.weights.regular).toBe(400);
    expect(typography.weights.bold).toBe(700);
  });

  it('density is "comfortable"', () => {
    expect(executive.density).toBe('comfortable');
  });

  it('shape.cornerRadius is 4', () => {
    expect(executive.shape.cornerRadius).toBe(4);
  });

  it('shape.connectorStyle is "elbow"', () => {
    expect(executive.shape.connectorStyle).toBe('elbow');
  });

  it('effects.fidelity is 2 (Polished)', () => {
    expect(executive.effects.fidelity).toBe(2);
  });
});

// ── bindFlowTheme ─────────────────────────────────────────────────────────────

describe('bindFlowTheme(executive)', () => {
  const theme = bindFlowTheme(executive);

  it('produces a FlowTheme (non-null object)', () => {
    expect(theme).toBeDefined();
    expect(typeof theme).toBe('object');
  });

  it('background is the contract surface color', () => {
    expect(theme.background).toBe(executive.palette.surface);
  });

  it('fontFamily contains the contract typography family', () => {
    expect(theme.fontFamily).toContain(executive.typography.family);
  });

  it('nodeRx equals contract cornerRadius', () => {
    expect(theme.nodeRx).toBe(executive.shape.cornerRadius);
  });

  it('nodeFontSize equals contract scale.base', () => {
    expect(theme.nodeFontSize).toBe(executive.typography.scale.base);
  });

  it('nodeFontWeight equals contract weights.semibold', () => {
    expect(theme.nodeFontWeight).toBe(executive.typography.weights.semibold);
  });

  it('edgeStyle is "elbow" (from connectorStyle)', () => {
    expect(theme.edgeStyle).toBe('elbow');
  });

  it('layerGap is larger in comfortable density than compact', () => {
    const compact = bindFlowTheme({ ...executive, density: 'compact' });
    expect(theme.layerGap).toBeGreaterThan(compact.layerGap);
  });

  it('nodeGap is larger in comfortable density than compact', () => {
    const compact = bindFlowTheme({ ...executive, density: 'compact' });
    expect(theme.nodeGap).toBeGreaterThan(compact.nodeGap);
  });

  it('is deterministic: two calls produce identical results', () => {
    const a = bindFlowTheme(executive);
    const b = bindFlowTheme(cloneContract(executive));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('statusFills.active comes from palette.statusActive.fill', () => {
    expect(theme.statusFills['active']).toBe(executive.palette.statusActive.fill);
  });
});

// ── bindSequenceTheme ─────────────────────────────────────────────────────────

describe('bindSequenceTheme(executive)', () => {
  const theme = bindSequenceTheme(executive);

  it('produces a SequenceTheme (non-null object)', () => {
    expect(theme).toBeDefined();
    expect(typeof theme).toBe('object');
  });

  it('background is the contract surface color', () => {
    expect(theme.background).toBe(executive.palette.surface);
  });

  it('fontFamily contains the contract typography family', () => {
    expect(theme.fontFamily).toContain(executive.typography.family);
  });

  it('participantBoxRx equals contract cornerRadius', () => {
    expect(theme.participantBoxRx).toBe(executive.shape.cornerRadius);
  });

  it('participantBoxFill is surfaceRaised', () => {
    expect(theme.participantBoxFill).toBe(executive.palette.surfaceRaised);
  });

  it('participantBoxStroke is accent', () => {
    expect(theme.participantBoxStroke).toBe(executive.palette.accent);
  });

  it('labelFontSize equals contract scale.md', () => {
    expect(theme.labelFontSize).toBe(executive.typography.scale.md);
  });

  it('labelFontWeight equals contract weights.bold', () => {
    expect(theme.labelFontWeight).toBe(executive.typography.weights.bold);
  });

  it('rowHeight is larger in comfortable density than compact', () => {
    const compact = bindSequenceTheme({ ...executive, density: 'compact' });
    expect(theme.rowHeight).toBeGreaterThan(compact.rowHeight);
  });

  it('participantRenderMode is "box"', () => {
    expect(theme.participantRenderMode).toBe('box');
  });

  it('is deterministic: two calls produce identical results', () => {
    const a = bindSequenceTheme(executive);
    const b = bindSequenceTheme(cloneContract(executive));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('fragTabFill is accent', () => {
    expect(theme.fragTabFill).toBe(executive.palette.accent);
  });
});

// ── bindChartTheme ────────────────────────────────────────────────────────────

describe('bindChartTheme(executive)', () => {
  const theme = bindChartTheme(executive);

  it('produces a ChartTheme (non-null object)', () => {
    expect(theme).toBeDefined();
    expect(typeof theme).toBe('object');
  });

  it('background is the contract surface color', () => {
    expect(theme.background).toBe(executive.palette.surface);
  });

  it('fontFamily contains the contract typography family', () => {
    expect(theme.fontFamily).toContain(executive.typography.family);
  });

  it('titleColor is the contract ink color', () => {
    expect(theme.titleColor).toBe(executive.palette.ink);
  });

  it('titleFontSize equals contract scale.lg', () => {
    expect(theme.titleFontSize).toBe(executive.typography.scale.lg);
  });

  it('tickLabelFontSize equals contract scale.sm', () => {
    expect(theme.tickLabelFontSize).toBe(executive.typography.scale.sm);
  });

  it('tickLabelColor is inkMuted', () => {
    expect(theme.tickLabelColor).toBe(executive.palette.inkMuted);
  });

  it('piePalette equals dataPalette.categorical', () => {
    expect(theme.piePalette).toEqual(executive.dataPalette.categorical);
  });

  it('piePalette has at least 6 entries', () => {
    expect(theme.piePalette.length).toBeGreaterThanOrEqual(6);
  });

  it('canvasHeight is larger in comfortable density than compact', () => {
    const compact = bindChartTheme({ ...executive, density: 'compact' });
    expect(theme.canvasHeight).toBeGreaterThan(compact.canvasHeight);
  });

  it('is deterministic: two calls produce identical results', () => {
    const a = bindChartTheme(executive);
    const b = bindChartTheme(cloneContract(executive));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('gridlineColor is border palette role', () => {
    expect(theme.gridlineColor).toBe(executive.palette.border);
  });
});

// ── Cross-component coherence ─────────────────────────────────────────────────

describe('cross-component coherence (executive theme)', () => {
  const flowTheme = bindFlowTheme(executive);
  const seqTheme  = bindSequenceTheme(executive);
  const chartTheme = bindChartTheme(executive);

  it('all three share the same background color (surface)', () => {
    expect(flowTheme.background).toBe(seqTheme.background);
    expect(seqTheme.background).toBe(chartTheme.background);
  });

  it('all three use the same font family', () => {
    expect(flowTheme.fontFamily).toBe(seqTheme.fontFamily);
    expect(seqTheme.fontFamily).toBe(chartTheme.fontFamily);
  });

  it('flow node stroke, sequence box stroke, and chart axis all use ink-family colors', () => {
    // node/participant borders use accent; chart axes use ink — both coherent
    expect(flowTheme.nodeStroke).toBe(executive.palette.accent);
    expect(seqTheme.participantBoxStroke).toBe(executive.palette.accent);
    expect(chartTheme.axisColor).toBe(executive.palette.ink);
  });
});
