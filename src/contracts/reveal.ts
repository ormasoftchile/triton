/**
 * Reveal
 *
 * Contracts for progressive, step-wise reveal of scene elements.
 *
 * A RevealTrack is an ordered choreography that a presentation host (e.g.
 * Deckpilot) plays back one step at a time. It is diagram-agnostic: a layout
 * engine that opts in produces a RevealTrack alongside its Scene, referencing
 * scene elements by the SAME stable ids used by the node-anchor registry
 * (see anchors.ts). Non-participating diagrams omit it entirely.
 *
 * Design rules:
 *   - The track is pure DATA — it never mutates the Scene, and the Scene
 *     renders identically whether or not a track is present.
 *   - Step ids reference `<g id="…">` group ids in the rendered SVG, drawn
 *     from the same author-facing vocabulary as NodeAddress/anchor keys.
 *   - Ordering is deterministic: steps are 1-based and monotonically indexed.
 *   - It is emitted into SVG output ONLY on the interactive render path
 *     (compileAndRenderSync), mirroring the anchor manifest. Plain renderSync
 *     output stays byte-stable and reveal-free.
 *
 * Dependency: (none — plain value types)
 */

// ─── Reveal Effect ──────────────────────────────────────────────────────────

/**
 * Suggested visual treatment for a step. The HOST owns final presentation and
 * may honor, remap, or ignore this — Triton only expresses intent.
 *
 * 'fade'  — fade the entering elements in (default)
 * 'draw'  — draw/wipe the entering elements in
 * 'grow'  — scale the entering elements up from their anchor
 * 'slide' — slide the entering elements in
 */
export type RevealEffect = 'fade' | 'draw' | 'grow' | 'slide';

// ─── Reveal Step ────────────────────────────────────────────────────────────

/**
 * A single reveal step. Names the scene-element group ids to act on when the
 * host advances to this step.
 */
export interface RevealStep {
  /** 1-based, monotonically increasing step index. */
  readonly index: number;
  /** Optional human-facing label (e.g. for a presenter outline). */
  readonly label?: string;
  /** Group ids that become visible at this step. */
  readonly enter: readonly string[];
  /** Group ids to emphasize (e.g. highlight) at this step. */
  readonly emphasize?: readonly string[];
  /** Group ids that leave (hide) at this step. */
  readonly exit?: readonly string[];
  /** Suggested effect for the entering elements. */
  readonly effect?: RevealEffect;
}

// ─── Reveal Track ───────────────────────────────────────────────────────────

/**
 * The complete reveal choreography for a diagram.
 *
 * `steps` is ordered by `index`. Elements NOT referenced by any step's `enter`
 * are treated as base content (always visible before the first step).
 */
export interface RevealTrack {
  /** Ordered reveal steps (1-based indices). */
  readonly steps: readonly RevealStep[];
}
