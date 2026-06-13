/**
 * @file grammars/sequence/theme.ts — SequenceTheme token surface.
 *
 * Every styling decision that was hardcoded in layout.ts is now a token here.
 * The default theme reproduces the original UML look byte-identically.
 * Additional named themes (e.g. sequenceByteByteGoTheme) can be registered
 * in SEQUENCE_THEME_REGISTRY for use via metadata.theme.
 */

import type { IconDef } from '../../icons.js';
import { getIcon } from '../../icons.js';

/** Per-kind card color style used when participantRenderMode === 'card'. */
export interface CardKindStyle {
  /** Card background fill color. */
  fill: string;
  /** Label text color inside the card. */
  textColor: string;
  /** Accent color (e.g. subtle border or inner highlight). Not rendered in base impl. */
  accentColor: string;
  /** Icon stroke/fill color inside the card. */
  iconColor: string;
}

/**
 * Complete visual token set for a sequence diagram.
 * All geometry, color, typography, and feature-flag tokens live here.
 *
 * - 'box' mode: plain rectangles (UML style)
 * - 'card' mode: colored rounded cards with icon glyphs (ByteByteGo style)
 */
export interface SequenceTheme {
  // ── Canvas ───────────────────────────────────────────────────────────────
  background: string;
  fontFamily: string;

  // ── Geometry constants ───────────────────────────────────────────────────
  /** Canvas horizontal margin (left and right). */
  marginH: number;
  /** Canvas top margin (above first participant box). */
  marginTop: number;
  /** Canvas bottom margin (below last message row). */
  marginBottom: number;
  /** Horizontal padding inside participant header boxes. */
  headerPadX: number;
  /** Vertical padding inside participant header boxes. */
  headerPadY: number;
  /** Minimum column width for any participant. */
  minColWidth: number;
  /** Gap between adjacent participant columns (edge-to-edge). */
  colGap: number;
  /** Gap from header bottom to first message row. */
  firstMsgGap: number;
  /** Vertical distance between consecutive message rows. */
  rowHeight: number;
  /** Height of the stick-figure icon for 'actor' participants (box mode). */
  actorIconHeight: number;
  /** Half-width of the activation bar rect. */
  activationBarHalfW: number;
  /** Minimum height for activation bar (when from_order == to_order). */
  activationBarMinH: number;
  /** Arrowhead size (half-angle base width and depth). */
  arrowHeadSize: number;
  /** Self-message loop rightward extent. */
  selfMsgLoopW: number;
  /** Self-message loop descent. */
  selfMsgLoopH: number;
  /** Horizontal padding outside participant extents for fragment box. */
  fragPadX: number;
  /** Vertical padding above/below message rows for fragment box. */
  fragPadY: number;
  /** Fragment rounded-corner radius. */
  fragRx: number;
  /** Horizontal padding inside keyword tab. */
  fragTabPadX: number;
  /** Vertical padding inside keyword tab. */
  fragTabPadY: number;

  // ── Typography ───────────────────────────────────────────────────────────
  /** Participant label font size in pixels. */
  labelFontSize: number;
  /** Participant label font weight. */
  labelFontWeight: number | string;
  /** Message label font size in pixels. */
  msgFontSize: number;
  /** Message label font weight. */
  msgFontWeight: number | string;
  /** Fragment kind keyword font size. */
  fragKeyFontSize: number;
  /** Fragment kind keyword font weight. */
  fragKeyFontWeight: number | string;
  /** Fragment guard label font size. */
  fragLabelFontSize: number;
  /** Fragment guard label font weight. */
  fragLabelFontWeight: number | string;

  // ── Stroke widths (previously hardcoded as 1.5 / 1) ─────────────────────
  /** Participant box border width. */
  participantBoxStrokeWidth: number;
  /** Lifeline stroke width. */
  lifelineStrokeWidth: number;
  /** Message arrow line stroke width. */
  messageLineStrokeWidth: number;
  /** Activation bar border width. */
  activationBarStrokeWidth: number;
  /** Fragment box border width. */
  fragStrokeWidth: number;

  // ── Participant rendering ─────────────────────────────────────────────────
  /** 'box' = plain rect (UML); 'card' = colored rounded card with icon. */
  participantRenderMode: 'box' | 'card';
  /** Corner radius for participant box/card. */
  participantBoxRx: number;
  /** Participant box/card background fill. */
  participantBoxFill: string;
  /** Participant box/card border color ('none' for no border). */
  participantBoxStroke: string;
  /** Participant label text color. */
  participantLabelColor: string;

  // ── Card mode (only used when participantRenderMode === 'card') ───────────
  /** Height of the icon area at the top of the card. */
  cardIconAreaSize: number;
  /** Per-kind card color styles. Use 'default' key as fallback. */
  cardKindColors: Partial<Record<string, CardKindStyle>>;
  /** Per-kind icon name (looked up from icons registry). */
  cardKindIconMap: Partial<Record<string, string>>;

  // ── Lifeline ─────────────────────────────────────────────────────────────
  /** When false, lifelines are not rendered (card/infographic mode). */
  lifelineVisible: boolean;
  lifelineStroke: string;
  lifelineDash: string;

  // ── Messages ─────────────────────────────────────────────────────────────
  messageLineStroke: string;
  /** Dash pattern for sync messages (undefined = solid). */
  messageLineDashSync?: string;
  /** Dash pattern for async messages (undefined = solid). */
  messageLineDashAsync?: string;
  /** Dash pattern for reply messages. */
  messageLineDashReply: string;
  messageLabelColor: string;
  arrowFill: string;

  // ── Activation bars ───────────────────────────────────────────────────────
  activationBarFill: string;
  activationBarStroke: string;
  /** Activation bar corner radius. */
  activationBarRx: number;

  // ── Fragments ─────────────────────────────────────────────────────────────
  fragStroke: string;
  fragFill: string;
  fragTabFill: string;
  fragTabTextColor: string;
  fragLabelColor: string;
  /** Dash pattern for dashed dividers between alt sub-compartments. */
  fragDividerDash: string;

  // ── Step number badges ────────────────────────────────────────────────────
  /** When true, a numbered circle badge is drawn on each message arrow. */
  showStepNumbers: boolean;
  stepBadgeRadius: number;
  stepBadgeFill: string;
  stepBadgeTextColor: string;
  stepBadgeFontSize: number;
  /**
   * Pixels from the source participant's box edge (along the arrow direction)
   * to the badge centre. Using the box edge (rather than the lifeline centre)
   * ensures the badge lands on the visible dark-background arrow segment in
   * card mode. Set to 0 to use the legacy ¼-along placement.
   */
  stepBadgeOffset: number;
  /**
   * Vertical distance (pixels) from the arrow row Y to the message label
   * baseline. Increase this in dark/card themes to ensure clear separation
   * between the label text descenders and the badge circle on the line.
   */
  msgLabelYOffset: number;
}

// ---------------------------------------------------------------------------
// Default theme — matches ALL current hardcoded values in layout.ts exactly
// ---------------------------------------------------------------------------

export const defaultSequenceTheme: SequenceTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans',

  marginH: 40,
  marginTop: 20,
  marginBottom: 40,
  headerPadX: 16,
  headerPadY: 10,
  minColWidth: 120,
  colGap: 80,
  firstMsgGap: 30,
  rowHeight: 56,
  actorIconHeight: 40,
  activationBarHalfW: 5,
  activationBarMinH: 20,
  arrowHeadSize: 8,
  selfMsgLoopW: 36,
  selfMsgLoopH: 24,
  fragPadX: 12,
  fragPadY: 14,
  fragRx: 6,
  fragTabPadX: 6,
  fragTabPadY: 4,

  labelFontSize: 13,
  labelFontWeight: 700,
  msgFontSize: 12,
  msgFontWeight: 400,
  fragKeyFontSize: 11,
  fragKeyFontWeight: 700,
  fragLabelFontSize: 11,
  fragLabelFontWeight: 400,

  participantBoxStrokeWidth: 1.5,
  lifelineStrokeWidth: 1,
  messageLineStrokeWidth: 1.5,
  activationBarStrokeWidth: 1.5,
  fragStrokeWidth: 1.5,

  participantRenderMode: 'box',
  participantBoxRx: 4,
  participantBoxFill: '#e8f0fe',
  participantBoxStroke: '#4a6cf7',
  participantLabelColor: '#1a1a2e',

  cardIconAreaSize: 36,
  cardKindColors: {},
  cardKindIconMap: {},

  lifelineVisible: true,
  lifelineStroke: '#9aa3b2',
  lifelineDash: '6,4',

  messageLineStroke: '#2c3e50',
  messageLineDashReply: '6,4',
  messageLabelColor: '#2c3e50',
  arrowFill: '#2c3e50',

  activationBarFill: '#c5cae9',
  activationBarStroke: '#5c6bc0',
  activationBarRx: 2,

  fragStroke: '#7986cb',
  fragFill: '#eff1fb',
  fragTabFill: '#5c6bc0',
  fragTabTextColor: '#ffffff',
  fragLabelColor: '#3949ab',
  fragDividerDash: '6,4',

  showStepNumbers: false,
  stepBadgeRadius: 10,
  stepBadgeFill: '#4a6cf7',
  stepBadgeTextColor: '#ffffff',
  stepBadgeFontSize: 10,
  stepBadgeOffset: 0,
  msgLabelYOffset: 6,
};

// ---------------------------------------------------------------------------
// ByteByteGo theme — dark infographic, card participants, step badges
// ---------------------------------------------------------------------------

export const sequenceByteByteGoTheme: SequenceTheme = {
  ...defaultSequenceTheme,

  // Dark canvas
  background: '#111827',

  // More space for cards
  marginH: 48,
  marginTop: 28,
  marginBottom: 48,
  minColWidth: 140,
  colGap: 64,
  firstMsgGap: 44,
  rowHeight: 64,
  headerPadX: 20,
  headerPadY: 12,

  // Card mode
  participantRenderMode: 'card',
  participantBoxRx: 14,
  participantBoxFill: '#1f2937',
  participantBoxStroke: 'none',
  participantBoxStrokeWidth: 0,
  participantLabelColor: '#f9fafb',

  // Icon area inside card
  cardIconAreaSize: 38,
  cardKindColors: {
    actor:    { fill: '#2563eb', textColor: '#ffffff', accentColor: '#1d4ed8', iconColor: '#bfdbfe' },
    object:   { fill: '#7c3aed', textColor: '#ffffff', accentColor: '#6d28d9', iconColor: '#ddd6fe' },
    boundary: { fill: '#0891b2', textColor: '#ffffff', accentColor: '#0e7490', iconColor: '#a5f3fc' },
    control:  { fill: '#d97706', textColor: '#ffffff', accentColor: '#b45309', iconColor: '#fde68a' },
    entity:   { fill: '#059669', textColor: '#ffffff', accentColor: '#047857', iconColor: '#6ee7b7' },
    database: { fill: '#dc2626', textColor: '#ffffff', accentColor: '#b91c1c', iconColor: '#fca5a5' },
    default:  { fill: '#374151', textColor: '#f9fafb', accentColor: '#1f2937', iconColor: '#d1d5db' },
  },
  cardKindIconMap: {
    actor:    'people',
    object:   'gear',
    boundary: 'cloud',
    control:  'bolt',
    entity:   'doc',
    database: 'database',
  },

  // No lifelines — cards span the diagram width
  lifelineVisible: false,

  // Step number badges — blue circles at the source card edge
  showStepNumbers: true,
  stepBadgeRadius: 11,
  stepBadgeFill: '#2563eb',
  stepBadgeTextColor: '#ffffff',
  stepBadgeFontSize: 10,
  stepBadgeOffset: 14,
  msgLabelYOffset: 20,

  // Light message lines on dark bg
  messageLineStroke: '#94a3b8',
  messageLineDashReply: '8,5',
  messageLabelColor: '#e2e8f0',
  arrowFill: '#94a3b8',
  messageLineStrokeWidth: 1.5,

  // Activation bars — slightly lighter for visibility on dark bg
  activationBarFill: '#4b5563',
  activationBarStroke: '#94a3b8',

  // Fragment on dark bg — visible but unobtrusive
  fragFill: '#1e2433',
  fragStroke: '#4b5563',
  fragTabFill: '#4b5563',
  fragTabTextColor: '#f3f4f6',
  fragLabelColor: '#9ca3af',
};

// ---------------------------------------------------------------------------
// Theme registry + resolver
// ---------------------------------------------------------------------------

export const SEQUENCE_THEME_REGISTRY: Record<string, SequenceTheme> = {
  'default-sequence': defaultSequenceTheme,
  'bytebytego-sequence': sequenceByteByteGoTheme,
};

/**
 * Resolve a theme by name. Falls back to `defaultSequenceTheme` for unknown names.
 */
export function resolveSequenceTheme(name?: string): SequenceTheme {
  if (!name) return defaultSequenceTheme;
  return SEQUENCE_THEME_REGISTRY[name] ?? defaultSequenceTheme;
}

// Re-export getIcon for use in layout.ts (avoids double import)
export { getIcon };
export type { IconDef };
