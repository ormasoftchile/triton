/**
 * Overlay
 *
 * Contracts for diagram annotations and legends.
 *
 * This file defines two layers:
 *
 *   RAW layer  — types emitted by PEG grammars. These are structural captures
 *                of the overlay syntax, not yet positioned or resolved.
 *
 *   RESOLVED layer — types consumed by layout engines and the overlay pipeline.
 *                    These have fully specified positions and anchor references.
 *
 * The separation matters: grammars produce Raw types; the overlay compiler
 * (implementation, not defined here) converts Raw → Resolved; layout engines
 * incorporate Resolved overlays into the final Scene geometry.
 *
 * Neither layer appears on the Scene type — overlays are fully resolved into
 * SceneElement[]s before a Scene is returned from layout().
 */

import type { Point } from './primitives.js';

// ─── Raw Layer — Grammar Output ───────────────────────────────────────────────

/**
 * A note/annotation directive as captured verbatim by a grammar rule.
 * The target is an element label or ID — not yet a screen coordinate.
 */
export interface RawNote {
  readonly type: 'note';
  readonly text: string;
  /** Element ID or label this note is anchored to. */
  readonly target: string;
  /** Optional pixel offset from the anchor, e.g. to avoid overlap. */
  readonly offset?: { readonly dx: number; readonly dy: number };
}

/**
 * A legend block directive as captured verbatim by a grammar rule.
 * Corner is a raw string — the overlay compiler validates and narrows it.
 */
export interface RawLegend {
  readonly type: 'legend';
  readonly corner: string;
  readonly title?: string;
  readonly entries: ReadonlyArray<{ readonly key: string; readonly value: string }>;
}

/** Union of every overlay directive a grammar can emit. */
export type RawOverlay = RawNote | RawLegend;

// ─── Resolved Layer — Layout Engine Input ────────────────────────────────────

/** The four corners a legend may occupy. */
export type LegendCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface LegendEntry {
  readonly key: string;
  readonly value: string;
}

/**
 * A resolved legend block — position is determined by the layout engine
 * relative to the diagram's viewBox using the corner property.
 */
export interface Legend {
  readonly title?: string;
  readonly entries: ReadonlyArray<LegendEntry>;
  readonly corner: LegendCorner;
  /** Width override in px. Auto-sized to content if absent. */
  readonly width?: number;
}

/**
 * A resolved annotation — a callout box with a connector to an anchor.
 *
 * Position is the top-left of the callout box.
 * Anchor is either a resolved screen point or an element group ID that
 * the overlay layout engine will resolve at render time.
 */
export interface Annotation {
  readonly id: string;
  readonly text: string;
  /** Top-left corner of the annotation box in diagram coordinates. */
  readonly position: Point;
  /** What the connector line points to. */
  readonly anchor: { readonly elementId: string } | { readonly point: Point };
  /** Width override in px. Auto-sized to content if absent. */
  readonly width?: number;
}

/**
 * The fully compiled set of overlays for a diagram.
 * Produced by the overlay compiler from RawOverlay[].
 */
export interface CompiledOverlays {
  readonly annotations: ReadonlyArray<Annotation>;
  readonly legend?: Legend;
}
