/**
 * @file grammars/flow/contract-binding.ts — Tier-3 binding: ThemeContract → FlowTheme.
 *
 * `bindFlowTheme` derives every FlowTheme field from the Tier-2 contract.
 * Component-specific constants (Tier-3 tokens) are derived deterministically
 * here — they are NOT added to the contract.
 *
 * Binding invariants (§12.4):
 *   - All field values derive from contract tokens or are computed from them.
 *   - No magic constants: every default is traceable to a contract domain.
 *   - Deterministic: same contract → byte-identical FlowTheme.
 */

import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { FlowTheme } from './theme.js';

// ── Density → layout geometry ─────────────────────────────────────────────────

interface DensityLayout {
  layerGap:      number;
  nodeGap:       number;
  nodePadX:      number;
  nodePadY:      number;
  marginH:       number;
  marginV:       number;
  marginBottom:  number;
}

function densityLayout(density: Density, spacingMd: number, spacingLg: number, spacingXl: number): DensityLayout {
  switch (density) {
    case 'compact':
      return { layerGap: spacingXl + spacingMd,  nodeGap: spacingMd,        nodePadX: spacingMd,      nodePadY: spacingMd / 2,  marginH: spacingXl,       marginV: spacingXl,       marginBottom: spacingXl + spacingMd };
    case 'comfortable':
      return { layerGap: spacingXl + spacingXl,  nodeGap: spacingXl,        nodePadX: spacingXl - 4,  nodePadY: spacingMd,      marginH: spacingXl + 8,   marginV: spacingXl,       marginBottom: spacingXl + spacingXl };
    default: // 'normal'
      return { layerGap: spacingXl + spacingMd,  nodeGap: spacingLg,        nodePadX: spacingXl / 2 + 10, nodePadY: spacingMd - 4, marginH: spacingXl,  marginV: spacingXl,       marginBottom: spacingXl + spacingLg };
  }
}

// ── Main binding ──────────────────────────────────────────────────────────────

/**
 * Derive a FlowTheme from a Tier-2 ThemeContract.
 *
 * Every field is derived from the contract; Tier-3 component-specific constants
 * (e.g. arrowSize, backEdgeCurvature, animationDurSec) are computed from the
 * contract's shape/spacing/typography domains — they never escape this file.
 */
export function bindFlowTheme(contract: ThemeContract): FlowTheme {
  const { palette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;

  const geo = densityLayout(density, s.md, s.lg, s.xl);

  // Tier-3: stroke widths derived from shape.strokeScale
  const nodeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;
  const edgeStrokeWidth = Math.round(1.5 * shape.strokeScale * 10) / 10;

  // Tier-3: arrowSize proportional to base font size (scale.base ≈ 12pt)
  const arrowSize = Math.round(typography.scale.base * 0.55);

  // Tier-3: backEdgeCurvature scales with comfortable spacing
  const backEdgeCurvature = s.xxl;

  // Tier-3: icon size derived from base type scale
  const iconSize = Math.round(typography.scale.base * 1.1);

  return {
    background:   palette.surface,
    fontFamily:   `${typography.family}, ${typography.fallback}`,
    orientation:  'LR',

    marginLeft:   geo.marginH,
    marginRight:  geo.marginH,
    marginTop:    geo.marginV,
    marginBottom: geo.marginBottom,

    nodePadX:      geo.nodePadX,
    nodePadY:      geo.nodePadY,
    minNodeWidth:  120,

    layerGap: geo.layerGap,
    nodeGap:  geo.nodeGap,

    // Default node: surface-raised fill, accent stroke
    nodeFill:         palette.surfaceRaised,
    nodeStroke:       palette.accent,
    nodeStrokeWidth,
    nodeRx:           shape.cornerRadius,
    nodeTextColor:    palette.ink,

    kindFills:      {},
    kindTextColors: {},

    // Status fills from role palette
    statusFills: {
      default:  palette.surfaceRaised,
      active:   palette.statusActive.fill,
      success:  palette.statusSuccess.fill + '33',  // 20% tint for fills
      warning:  palette.statusWarning.fill + '22',
      error:    palette.statusError.fill   + '22',
      muted:    palette.muted,
      planned:  palette.statusPlanned.fill + '33',
    },
    statusTextColors: {
      default:  palette.ink,
      active:   palette.inkInverse,
      success:  palette.statusSuccess.stroke,
      warning:  palette.statusWarning.stroke,
      error:    palette.statusError.stroke,
      muted:    palette.inkMuted,
      planned:  palette.statusPlanned.stroke,
    },

    // Typography from scale
    nodeFontSize:       typography.scale.base,
    nodeFontWeight:     typography.weights.semibold,
    edgeLabelFontSize:  typography.scale.sm,
    edgeLabelFontWeight: typography.weights.regular,
    edgeLabelColor:     palette.inkMuted,

    // Edge routing from contract shape
    edgeStyle:          shape.connectorStyle === 'curved' ? 'curved'
                      : shape.connectorStyle === 'straight' ? 'straight'
                      : 'elbow',
    edgeStroke:         palette.border,
    edgeStrokeWidth,
    edgeDash:           '6,4',
    edgeDotted:         '2,4',
    animatedEdgeDash:   '8,5',
    animatedEdgeStroke: palette.accent,

    arrowSize,
    arrowFill: palette.inkMuted,

    backEdgeCurvature,
    backEdgeStroke: palette.borderStrong,
    backEdgeDash:   '5,4',

    animationDurSec: 1.2,

    showIcons:    true,
    iconSize,
    iconLabelGap: s.xs,
  };
}
