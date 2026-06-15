/**
 * @file theme-contract/types.ts — Tier-2 General Theme Contract.
 *
 * The ThemeContract interface is the component-agnostic token vocabulary that
 * every component implements against (§12.4 — Three-Tier Token Architecture).
 *
 * Tier 1 (Primitives): raw hex ramps, type families — inside concrete theme files.
 * Tier 2 (this file):  semantic tokens — role palette, data palette, type scale,
 *                       spacing, density, shape, effects.
 * Tier 3 (bindings):   component tokens — derived from Tier 2 inside each binding.
 *
 * Binding invariants (§12.4):
 *   - Tier 2 NEVER references a Tier-3 component token.
 *   - Components reference upward only.
 *   - Themes may optionally reach into component namespaces.
 */

// ── Role palette ──────────────────────────────────────────────────────────────

/** A semantic status role: fill + stroke color pair. */
export interface StatusRole {
  fill:    string;
  stroke:  string;
  opacity?: number;
  /**
   * Optional fill pattern for status indicators.
   * Defaults to `'solid'` when absent.
   * Used by timeline/gantt to communicate cancelled (diagonal-hatch) and
   * uncertain/tentative (dashed-border) states — but the concept is general.
   */
  pattern?: 'solid' | 'diagonal-hatch' | 'dashed-border';
}

/**
 * Role palette — structural / semantic colors.
 * Components map their visual elements to roles by name, never by raw hex.
 */
export interface RolePalette {
  // Surface roles
  /** Primary background. */
  surface:         string;
  /** Cards, panels, raised regions. */
  surfaceRaised:   string;
  /** Dark overlay / inverse background. */
  surfaceOverlay:  string;
  /**
   * Lane/panel/card background — sits between `surface` and `surfaceRaised`.
   * Used by: track/lane headers (gantt, timeline), kanban card backgrounds,
   * table row alternates.  Provides a gentle lift without the full `surfaceRaised`
   * elevation.
   */
  surfacePanel:    string;
  /**
   * Text colour for panel/lane header labels (foreground on `surfacePanel`).
   * Used by: track header text (gantt, timeline), kanban column titles.
   */
  inkPanel:        string;

  // Content roles
  /** Primary text color. */
  ink:             string;
  /** Secondary / de-emphasized text. */
  inkMuted:        string;
  /** Text on dark (overlay) backgrounds. */
  inkInverse:      string;

  // Brand / accent
  /** Primary brand color. */
  accent:          string;
  /** Lighter accent (inactive, planned). */
  accentMuted:     string;
  /** Darker accent (active, in-progress). */
  accentStrong:    string;

  // Border
  /** Default stroke / divider color. */
  border:          string;
  /** Emphasized boundary. */
  borderStrong:    string;

  // Muted fill
  /** Background regions, disabled states. */
  muted:           string;
  /** Stronger muted fill. */
  mutedStrong:     string;

  // Semantic status roles
  statusSuccess:  StatusRole;
  statusWarning:  StatusRole;
  statusError:    StatusRole;
  statusInfo:     StatusRole;

  // IR workflow state roles
  statusPlanned:    StatusRole;
  statusActive:     StatusRole;
  statusDone:       StatusRole & { opacity: number };
  statusCancelled:  StatusRole & { opacity: number };
  statusUncertain:  StatusRole & { opacity: number };
}

// ── Data palette ──────────────────────────────────────────────────────────────

/** Sequential ramp for ordered quantitative encodings. */
export interface SequentialRamp {
  low:  string;
  mid:  string;
  high: string;
}

/** Diverging ramp for values around a meaningful midpoint. */
export interface DivergingRamp {
  negative: string;
  zero:     string;
  positive: string;
}

/**
 * Data palette — chart and quantity components.
 * Provides categorical, sequential, and diverging color systems.
 */
export interface DataPalette {
  /** Ordered series/slice colors. Use by index (0-based). Minimum 6 entries. */
  categorical: string[];
  /** Sequential ramp: low → mid → high. */
  sequential:  SequentialRamp;
  /** Diverging ramp: negative → zero → positive. */
  diverging:   DivergingRamp;
}

// ── Typography ────────────────────────────────────────────────────────────────

/**
 * Named type scale steps (point sizes).
 * Components consume scale by step name, never by raw pt value.
 */
export interface TypeScale {
  /** 8 pt — axis ticks, dense labels. */
  xs:   number;
  /** 9 pt — captions, secondary labels. */
  sm:   number;
  /** 11 pt — body text, activity labels. */
  base: number;
  /** 13 pt — subtitles, section headers. */
  md:   number;
  /** 18 pt — document title. */
  lg:   number;
  /** 24 pt — hero / keynote headline. */
  xl:   number;
}

/** Named font weight levels. */
export interface WeightSet {
  regular:  number;  // 400
  medium:   number;  // 500
  semibold: number;  // 600
  bold:     number;  // 700
}

/** Typography domain. */
export interface Typography {
  /** Primary font family name. */
  family:   string;
  /** Fallback font stack (CSS font-family string). */
  fallback: string;
  /** Type scale: step names → point sizes. */
  scale:    TypeScale;
  /** Weight palette. */
  weights:  WeightSet;
}

// ── Spacing ───────────────────────────────────────────────────────────────────

/**
 * Named spacing steps (px).
 * Advisory: components map step names onto their own geometry as they see fit.
 */
export interface SpacingSteps {
  xxs: number;  // 2  — 0.25u
  xs:  number;  // 4  — 0.5u
  sm:  number;  // 8  — 1u
  md:  number;  // 16 — 2u
  lg:  number;  // 24 — 3u
  xl:  number;  // 32 — 4u
  xxl: number;  // 48 — 6u
}

/** Spacing / rhythm scale. Advisory across components. */
export interface Spacing {
  /** Base rhythm unit in px. */
  unit:  number;
  /** Named derived steps. */
  steps: SpacingSteps;
}

// ── Density ───────────────────────────────────────────────────────────────────

/**
 * Discrete density level. Components use this to select between compact and
 * comfortable configurations for row heights, gaps, and label visibility.
 */
export type Density = 'compact' | 'normal' | 'comfortable';

// ── Shape language ────────────────────────────────────────────────────────────

/** Connector routing style. */
export type ConnectorStyle = 'straight' | 'elbow' | 'curved' | 'orthogonal';

/** Shape language: how geometric objects feel. */
export interface ShapeLanguage {
  /** Corner radius in px. 0 = square; >0 = rounded. */
  cornerRadius:    number;
  /** Internal padding inside node shapes (px). */
  nodePadding:     number;
  /** Multiplier on all stroke widths (0.5=hairline; 1.0=normal; 2.0=bold). */
  strokeScale:     number;
  /** Default connector routing style. */
  connectorStyle:  ConnectorStyle;
  /**
   * Default marker/milestone shape.
   * Used by timeline milestones, chart scatter-point markers, etc.
   * When absent, each component falls back to its own default.
   */
  markerShape?: 'circle' | 'diamond' | 'square' | 'triangle';
}

// ── Effects ───────────────────────────────────────────────────────────────────

/** Fidelity tier (§12.7 — Fidelity Tiers and Backend Effect Profiles). */
export type FidelityTier = 0 | 1 | 2 | 3;

/** Optional drop-shadow effect. */
export interface DropShadow {
  enabled:  boolean;
  /** Blur radius in px (only consulted when enabled=true). */
  blur?:    number;
  /** Color with alpha. */
  color?:   string;
  /** X offset in px. */
  offsetX?: number;
  /** Y offset in px. */
  offsetY?: number;
}

/** Optional glow effect. */
export interface Glow {
  enabled: boolean;
  color?:  string;
  radius?: number;
}

/** Effects and fidelity domain. */
export interface Effects {
  /**
   * Fidelity tier:
   *   0 = Minimal — solid fills, patterns, opacity only (SVG backend)
   *   1 = Crisp   — gradients, diagonal hatch, dashed borders (SVG backend)
   *   2 = Polished — drop shadows, soft glow (SVG caveat or Raster)
   *   3 = Showcase — bloom, textures, gradients meshes (Raster required)
   */
  fidelity:   FidelityTier;
  dropShadow: DropShadow;
  glow:       Glow;
  /** SMIL animation opt-in (raster backends ignore). */
  motion:     { enabled: boolean };
}

// ── ThemeContract (Tier-2 General Contract) ───────────────────────────────────

/**
 * The Tier-2 General Theme Contract.
 *
 * This is the interface every component implements against. It is
 * component-agnostic: no component-specific fields are present.
 * Components derive their Tier-3 tokens from this contract in their
 * own `contract-binding.ts` files.
 *
 * A theme named `executive` (or any other) provides one concrete object
 * satisfying this interface. The component binding functions consume it and
 * return a component-specific theme struct.
 */
export interface ThemeContract {
  /** Theme identifier (unique, kebab-case). */
  id:   string;
  /** Human-readable display name. */
  name: string;

  /** Role palette: structural / semantic colors. */
  palette: RolePalette;

  /** Data palette: chart / quantity colors. */
  dataPalette: DataPalette;

  /** Typography: family, scale, weights. */
  typography: Typography;

  /** Spacing scale (advisory). */
  spacing: Spacing;

  /** Density: discrete layout compactness level. */
  density: Density;

  /** Shape language: corner radius, padding, stroke scale, connector style. */
  shape: ShapeLanguage;

  /** Effects and fidelity tier. */
  effects: Effects;
}
