/**
 * Theme
 *
 * The unified visual configuration contract.
 *
 * One ResolvedTheme applies uniformly to every diagram type.
 * No diagram gets private theme keys — all visual tokens are defined here.
 * This guarantees that switching themes affects all diagrams identically.
 *
 * Two shapes exist:
 *   ThemeInput     — what users/callers provide (all fields optional).
 *   ResolvedTheme  — what layout engines consume (all fields required).
 *
 * A theme resolver (not defined here — that is implementation) merges a
 * ThemeInput over a base preset to produce a ResolvedTheme.
 */

import type { Color, FontFamily } from './primitives.js';

// ─── Token Groups ─────────────────────────────────────────────────────────────

export interface ThemePalette {
  /** Primary accent — edges, active indicators, highlights. */
  readonly primary: Color;
  /** Secondary accent — secondary highlights, badges. */
  readonly secondary: Color;
  /** Canvas / page background. */
  readonly background: Color;
  /** Node / card fill. */
  readonly surface: Color;
  /** Default border and stroke. */
  readonly border: Color;
  /** Primary readable text. */
  readonly text: Color;
  /** De-emphasised / secondary text. */
  readonly textMuted: Color;
  /** Semantic: success state. */
  readonly success: Color;
  /** Semantic: warning state. */
  readonly warning: Color;
  /** Semantic: error / blocked state. */
  readonly error: Color;
}

export interface ThemeTypography {
  readonly fontFamily: FontFamily;
  readonly monoFamily: FontFamily;
  /** Base body text size in px. */
  readonly baseFontSize: number;
  /** Diagram title / section heading size in px. */
  readonly titleFontSize: number;
  /** Labels, captions, timestamps in px. */
  readonly smallFontSize: number;
  /** Line height multiplier (unitless, e.g. 1.4). */
  readonly lineHeight: number;
}

export interface ThemeSpacing {
  /** Base grid unit in px. All spacing should be multiples of this. */
  readonly unit: number;
  /** Padding inside node/card shapes. */
  readonly nodePadding: number;
  /** Gap between adjacent nodes. */
  readonly nodeGap: number;
  /** Margin between the diagram content and the viewBox edge. */
  readonly diagramMargin: number;
}

export interface ThemeEdges {
  /** Default edge stroke width in px. */
  readonly strokeWidth: number;
  /** Arrowhead size in px. */
  readonly arrowSize: number;
  /** Font size for edge labels in px. */
  readonly labelFontSize: number;
  /** Bezier curve tension, 0 (straight) to 1 (full arc). */
  readonly curveTension: number;
}

// ─── Resolved Theme (consumed by layout engines) ──────────────────────────────

/** Fully resolved — every field is present and required. Layout engines receive this. */
export interface ResolvedTheme {
  readonly name: string;
  readonly palette: ThemePalette;
  readonly typography: ThemeTypography;
  readonly spacing: ThemeSpacing;
  readonly edges: ThemeEdges;
}

// ─── Theme Input (provided by callers) ────────────────────────────────────────

/** Partial override — merged with a base preset by the theme resolver. */
export type ThemeInput = {
  readonly name?: string;
  readonly palette?: Partial<ThemePalette>;
  readonly typography?: Partial<ThemeTypography>;
  readonly spacing?: Partial<ThemeSpacing>;
  readonly edges?: Partial<ThemeEdges>;
};
