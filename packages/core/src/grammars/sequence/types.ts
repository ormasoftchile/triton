/**
 * @file grammars/sequence/types.ts — Sequence Grammar Domain IR.
 *
 * The Sequence Grammar is the first "de-risked" grammar: its layout is
 * deterministic-by-construction (declared participant order → x-position;
 * declared message order → y-position). No graph layout algorithm is needed.
 *
 * This IR represents increment-1 of the grammar: Participants + Messages.
 * Activation and Fragment types are defined here for forward-compatibility
 * but are deferred to increment 2.
 *
 * LOWERING: SequenceDocument → layoutSequence() → Scene (shared kernel IR)
 * The Scene is then consumed by sceneToSvg / sceneToPngSkia unchanged.
 */

// ---------------------------------------------------------------------------
// Participant
// ---------------------------------------------------------------------------

/**
 * A named entity with a vertical lifeline in the sequence diagram.
 * Participants are laid out left-to-right in declared order.
 */
export interface Participant {
  /** Document-unique identifier (kebab-case). */
  id: string;
  /** Display text shown in the participant header box. */
  label: string;
  /**
   * Visual stereotype. Affects header rendering only — NOT layout.
   * Default: 'object' (rectangular box).
   * Increment-1: 'actor' (stick-figure above label) and 'object' are rendered.
   * Others fall back to 'object' styling.
   */
  kind?: 'actor' | 'object' | 'boundary' | 'control' | 'entity' | 'database';
  /**
   * Optional icon name (looked up from the built-in icon registry).
   * Used by card-mode themes to display a glyph inside the participant card.
   * Ignored by box-mode themes.
   */
  icon?: string;
  /**
   * Optional per-participant color override.
   * - box mode: overrides participantBoxFill for this participant only.
   * - card mode: overrides the card fill color from cardKindColors.
   */
  color?: string;
  /** Optional tooltip / secondary text (not rendered in increment-1). */
  description?: string;
}

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------

/**
 * A directed communication between two participants.
 * Sorted by `order` (ascending) before layout; ties broken by list position.
 */
export interface Message {
  /** Optional document-unique message identifier. */
  id?: string;
  /** Source participant id. */
  from: string;
  /** Target participant id. */
  to: string;
  /** Label text shown above the arrow. */
  label: string;
  /**
   * Explicit sequence index (≥ 0). Determines y-position.
   * Total order: lower order → higher on diagram.
   * Tie-breaking: list position (stable sort).
   */
  order: number;
  /**
   * Message kind controls arrowhead and line style.
   * - sync:  solid line + filled triangular arrowhead
   * - async: solid line + open (V-shape) arrowhead
   * - reply: dashed line + open (V-shape) arrowhead
   * Default: 'sync'.
   */
  kind?: 'sync' | 'async' | 'reply';
}

// ---------------------------------------------------------------------------
// Activation (increment-2; fully implemented)
// ---------------------------------------------------------------------------

/**
 * A processing span on a participant's lifeline.
 * Rendered as a thin filled rectangle centered on the lifeline, spanning
 * from the y-position of `from_order` to the y-position of `to_order`.
 * Messages arriving/leaving an active participant visually attach to the
 * activation bar's edge rather than the bare lifeline center.
 */
export interface Activation {
  /** The lifeline on which the activation appears. */
  participant: string;
  /** Message order at which activation begins (must be ≤ to_order). */
  from_order: number;
  /** Message order at which activation ends. */
  to_order: number;
}

// ---------------------------------------------------------------------------
// Fragment (increment-2; fully implemented)
// ---------------------------------------------------------------------------

/**
 * A labeled combined fragment (loop, alt, opt, etc.) spanning a range of messages.
 * Rendered as a labeled rounded rect behind the messages:
 *  - Vertically: from just above `from_order`'s row to just below `to_order`'s row.
 *  - Horizontally: across the involved participants' x-extent (all by default).
 *  - Upper-left tab contains the `kind` keyword; guard `label` appears next to it.
 *
 * Legacy fragments use a single guard label via `label`.
 * `alt` fragments may additionally define ordered `sections` for
 * multi-guard sub-compartments.
 */
/**
 * One compartment inside a multi-section `alt` fragment.
 * Only used when `Fragment.sections` is present.
 */
export interface FragmentSection {
  /** Guard condition text for this compartment (e.g. "[success]"). */
  guard?: string;
  /** First message order in this compartment (must be ≤ toOrder). */
  fromOrder: number;
  /** Last message order in this compartment. */
  toOrder: number;
}

export interface Fragment {
  /** Fragment operator keyword. */
  kind: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break';
  /** Guard condition or description text. */
  label: string;
  /** First message order in the span (must be ≤ to_order). */
  from_order: number;
  /** Last message order in the span. */
  to_order: number;
  /** Subset of participant ids the fragment spans. Default: all participants. */
  participants?: string[];
  /**
   * Optional ordered list of sub-compartments for `alt` fragments.
   * When present, renders dashed horizontal dividers between compartments
   * and displays each compartment's `guard` at its top-left.
   * If absent (or length < 2), the fragment renders as a single compartment
   * (byte-identical to the existing behaviour).
   * `sections[0].fromOrder` should equal `from_order`;
   * `sections[last].toOrder` should equal `to_order`.
   */
  sections?: FragmentSection[];
}

// ---------------------------------------------------------------------------
// Document root
// ---------------------------------------------------------------------------

export interface SequenceMetadata {
  /** Diagram title. */
  title?: string;
  /** Optional subtitle. */
  subtitle?: string;
  /** Theme name. Default: 'default-sequence'. */
  theme?: string;
}

export interface SequenceDefinition {
  /** Participants in left-to-right declared order (min 1). */
  participants: Participant[];
  /** Messages (may be empty). */
  messages: Message[];
  /** Activation spans (increment-2; implemented and rendered). */
  activations?: Activation[];
  /** Combined fragments (increment-2; implemented and rendered). */
  fragments?: Fragment[];
}

/** Root document for the Sequence Grammar IR. */
export interface SequenceDocument {
  /** Spec version (semver string, e.g. "1.0"). */
  version: string;
  metadata: SequenceMetadata;
  sequence: SequenceDefinition;
}
