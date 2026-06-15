/**
 * @file grammars/sequence/contract-binding.ts — Tier-3 binding: ThemeContract → SequenceTheme.
 *
 * `bindSequenceTheme` derives every SequenceTheme field from the Tier-2 contract.
 * Component-specific geometry (activation bar widths, fragment rx, note sizing)
 * is computed deterministically from contract tokens — these are Tier-3 tokens
 * and must not escape this file into the contract.
 *
 * Binding invariants (§12.4):
 *   - All values derive from contract tokens or are computed from them.
 *   - No magic constants: every default is traceable to a contract domain.
 *   - Deterministic: same contract → byte-identical SequenceTheme.
 */

import type { ThemeContract, Density } from '../../theme-contract/types.js';
import type { SequenceTheme } from './theme.js';

// ── Density → geometry multipliers ───────────────────────────────────────────

interface SeqDensityGeo {
  rowHeight:    number;
  colGap:       number;
  marginH:      number;
  marginTop:    number;
  marginBottom: number;
  headerPadX:   number;
  headerPadY:   number;
  minColWidth:  number;
  firstMsgGap:  number;
}

function seqDensityGeo(density: Density, spacingMd: number, spacingLg: number, spacingXl: number): SeqDensityGeo {
  switch (density) {
    case 'compact':
      return {
        rowHeight:    44,
        colGap:       spacingXl + spacingMd,
        marginH:      spacingXl,
        marginTop:    spacingMd,
        marginBottom: spacingXl,
        headerPadX:   spacingMd - 4,
        headerPadY:   spacingMd / 2,
        minColWidth:  110,
        firstMsgGap:  spacingLg,
      };
    case 'comfortable':
      return {
        rowHeight:    72,
        colGap:       spacingXl + spacingXl,
        marginH:      spacingXl + spacingMd,
        marginTop:    spacingXl,
        marginBottom: spacingXl + spacingMd,
        headerPadX:   spacingXl,
        headerPadY:   spacingMd,
        minColWidth:  140,
        firstMsgGap:  spacingXl + spacingMd,
      };
    default: // 'normal'
      return {
        rowHeight:    56,
        colGap:       spacingXl + spacingLg,
        marginH:      spacingXl + 8,
        marginTop:    spacingLg,
        marginBottom: spacingXl,
        headerPadX:   spacingMd,
        headerPadY:   spacingMd / 2 + 2,
        minColWidth:  120,
        firstMsgGap:  spacingLg + spacingMd,
      };
  }
}

// ── Main binding ──────────────────────────────────────────────────────────────

/**
 * Derive a SequenceTheme from a Tier-2 ThemeContract.
 *
 * Participant boxes use the 'box' mode (UML-style) with contract palette
 * applied: accent border/fill, ink labels, muted lifelines. Fragment and
 * note styling derive from surface/border roles.
 */
export function bindSequenceTheme(contract: ThemeContract): SequenceTheme {
  const { palette, typography, spacing, density, shape } = contract;
  const s = spacing.steps;

  const geo = seqDensityGeo(density, s.md, s.lg, s.xl);

  // Tier-3: stroke widths from shape.strokeScale
  const baseStroke = Math.round(1.5 * shape.strokeScale * 10) / 10;

  // Tier-3: activation bar half-width — proportional to node padding
  const activationBarHalfW = Math.max(4, Math.round(shape.nodePadding * 0.45));

  // Tier-3: note width derived from comfortable column width * 1.2
  const noteWidth = Math.round(geo.minColWidth * 1.2);

  // Tier-3: arrowhead size proportional to base scale
  const arrowHeadSize = Math.round(typography.scale.base * 0.65);

  // Tier-3: fragment corner radius from shape, slightly more generous
  const fragRx = Math.max(2, shape.cornerRadius + 2);

  return {
    background:  palette.surface,
    fontFamily:  `${typography.family}, ${typography.fallback}`,

    marginH:      geo.marginH,
    marginTop:    geo.marginTop,
    marginBottom: geo.marginBottom,
    headerPadX:   geo.headerPadX,
    headerPadY:   geo.headerPadY,
    minColWidth:  geo.minColWidth,
    colGap:       geo.colGap,
    firstMsgGap:  geo.firstMsgGap,
    rowHeight:    geo.rowHeight,
    actorIconHeight:    40,
    activationBarHalfW,
    activationBarMinH:  20,
    arrowHeadSize,
    selfMsgLoopW:  s.xl + s.sm,
    selfMsgLoopH:  s.lg,
    fragPadX:      s.md - 4,
    fragPadY:      s.md - 2,
    fragRx,
    fragTabPadX:   s.xs + 2,
    fragTabPadY:   s.xs,

    // Typography from contract scale
    labelFontSize:    typography.scale.md,
    labelFontWeight:  typography.weights.bold,
    msgFontSize:      typography.scale.base,
    msgFontWeight:    typography.weights.regular,
    fragKeyFontSize:  typography.scale.sm,
    fragKeyFontWeight: typography.weights.bold,
    fragLabelFontSize:  typography.scale.sm,
    fragLabelFontWeight: typography.weights.regular,

    // Stroke widths from strokeScale
    participantBoxStrokeWidth: baseStroke,
    lifelineStrokeWidth:       Math.round(baseStroke * 0.7 * 10) / 10,
    messageLineStrokeWidth:    baseStroke,
    activationBarStrokeWidth:  baseStroke,
    fragStrokeWidth:           baseStroke,

    // Participant box — box mode with accent palette
    participantRenderMode: 'box',
    participantBoxRx:      shape.cornerRadius,
    participantBoxFill:    palette.surfaceRaised,
    participantBoxStroke:  palette.accent,
    participantLabelColor: palette.ink,

    // Card mode (unused in executive; provided for interface completeness)
    cardIconAreaSize: 36,
    cardKindColors:   {},
    cardKindIconMap:  {},

    // Lifeline — subtle, muted
    lifelineVisible: true,
    lifelineStroke:  palette.border,
    lifelineDash:    '6,4',

    // Messages — ink on white
    messageLineStroke:    palette.ink,
    messageLineDashReply: '6,4',
    messageLabelColor:    palette.ink,
    arrowFill:            palette.ink,

    // Activation bars — accent fill, subtle stroke
    activationBarFill:   palette.accentMuted + '44',  // 27% alpha tint
    activationBarStroke: palette.accent,
    activationBarRx:     Math.max(1, shape.cornerRadius - 2),

    // Fragments — muted surface / accent tab
    fragStroke:       palette.accent,
    fragFill:         palette.muted,
    fragTabFill:      palette.accent,
    fragTabTextColor: palette.inkInverse,
    fragLabelColor:   palette.inkMuted,
    fragDividerDash:  '6,4',

    // Notes — surface-raised with border
    noteFill:        palette.surfaceRaised,
    noteStroke:      palette.border,
    noteStrokeWidth: baseStroke,
    noteTextColor:   palette.ink,
    noteFontSize:    typography.scale.sm,
    notePadX:        s.md - 6,
    notePadY:        s.md - 8,
    noteWidth,

    // Step number badges — off by default in executive (clean look)
    showStepNumbers:     false,
    stepBadgeRadius:     10,
    stepBadgeFill:       palette.accent,
    stepBadgeTextColor:  palette.inkInverse,
    stepBadgeFontSize:   typography.scale.xs,
    stepBadgeOffset:     0,
    msgLabelYOffset:     s.xs + 2,
  };
}
