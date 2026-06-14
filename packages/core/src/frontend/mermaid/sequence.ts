/**
 * @file frontend/mermaid/sequence.ts — Mermaid sequenceDiagram → SequenceDocument parser.
 *
 * Translates Mermaid `sequenceDiagram` syntax into the Sequence Grammar Domain IR
 * (SequenceDocument). Follows the tokenizer fidelity bar established by flowchart.ts
 * hardening: whitespace-independent, all arrow operators, graceful degradation,
 * public warnings, validated by a real-data corpus.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPLEMENTED
 * ─────────────────────────────────────────────────────────────────────────
 *   Header
 *     sequenceDiagram  (case-insensitive)
 *
 *   Participant declarations
 *     participant A as Alice    → Participant { id:'a', label:'Alice', kind:'object' }
 *     participant A             → Participant { id:'a', label:'A', kind:'object' }
 *     actor A as Bob            → Participant { id:'a', label:'Bob', kind:'actor' }
 *     actor A                   → Participant { id:'a', label:'A', kind:'actor' }
 *     Auto-registration: first mention in a message auto-registers a participant
 *     (kind:'object', label = raw ID).
 *
 *   Messages (whitespace-tolerant — works with or without spaces around arrow):
 *     A->>B: msg     solid arrowhead            → kind: 'sync'
 *     A-->>B: msg    dashed arrowhead           → kind: 'reply'
 *     A->B: msg      solid open                 → kind: 'sync'
 *     A-->B: msg     dashed open                → kind: 'reply'
 *     A-)B: msg      solid async (open circle)  → kind: 'async'
 *     A--)B: msg     dashed async               → kind: 'async'
 *     A-xB: msg      solid cross                → kind: 'async'
 *     A--xB: msg     dashed cross               → kind: 'async'
 *     A->>A: msg     self-message               → from === to
 *
 *   Activations
 *     activate A / deactivate A  — explicit form
 *     A->>+B: msg               — shorthand: activate B at this message's order
 *     B-->>-A: msg              — shorthand: deactivate B (FROM) at this message's order
 *     Produces Activation { participant, from_order, to_order }
 *
 *   Fragments
 *     loop <label> … end         → Fragment { kind:'loop', label, from_order, to_order }
 *     opt <label> … end          → Fragment { kind:'opt', ... }
 *     alt <label> … else … end   → Fragment { kind:'alt', sections:[] }
 *     par <label> … and … end    → Fragment { kind:'par', sections:[] }
 *     critical <label> … end     → DEGRADE to 'opt' + warning
 *     break <label> … end        → DEGRADE to 'opt' + warning
 *
 *   Metadata
 *     autonumber      → warning (DEFERRED — not representable in sequence IR)
 *     Note left of A: text
 *     Note right of A: text
 *     Note over A,B: text  → warning + skip (not in sequence IR — Mark's call)
 *
 *   Frontmatter (--- … ---) and %%{init}%% directives via preprocessMermaid (utils.ts)
 *   Comments (%%) handled by preprocessMermaid
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEFERRED
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Note construct       — no IR type yet (Mark's domain); warn + skip
 *   2. autonumber           — no IR flag yet; warn
 *   3. critical / break     — degrade to opt + warn (not in IR kind enum... actually
 *                             they ARE in Fragment.kind; still emit a compat warning)
 *   4. Quoted participant IDs ("Alice Smith"->>Bob: msg) — very rare; warn + skip
 *   5. Links / click directives, color attributes — warn + skip
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines → skip with collected warning. NEVER throws on syntax
 *   errors. Always returns a valid (possibly partial) SequenceDocument.
 *   The minimum viable document must have at least one participant.
 *   If no participants are found after parsing, a synthetic placeholder is added
 *   so the IR passes schema validation — a warning is emitted.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ID SANITIZATION
 * ─────────────────────────────────────────────────────────────────────────
 *   Sequence IR requires IDs matching ^[a-z][a-z0-9-]*$ — same as flow IR.
 *   Same sanitization algorithm as flowchart.ts (idMap per parse session).
 */

import type {
  SequenceDocument,
  Participant,
  Message,
  Activation,
  Fragment,
  FragmentSection,
} from '../../grammars/sequence/types.js';
import { preprocessMermaid } from './utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Full parse result returned by parseSequenceInternal. */
export interface SequenceParseResult {
  /** The Sequence Domain IR document. */
  doc: SequenceDocument;
  /** Collected non-fatal warnings (skipped lines, deferrals, degradations). */
  warnings: string[];
  /** Raw frontmatter key-value pairs, if a frontmatter block was present. */
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Arrow → kind mapping
// ---------------------------------------------------------------------------

/**
 * Map a Mermaid sequence arrow string to Message.kind.
 * Must be called with one of the recognised arrow patterns.
 */
function arrowToKind(arrow: string): Message['kind'] {
  switch (arrow) {
    case '-->>': return 'reply';
    case '->>':  return 'sync';
    case '-->':  return 'reply';
    case '->':   return 'sync';
    case '--)':  return 'async';
    case '-)':   return 'async';
    case '--x':  return 'async';
    case '-x':   return 'async';
    default:     return 'sync';
  }
}

// ---------------------------------------------------------------------------
// Message line tokenizer
// ---------------------------------------------------------------------------

/**
 * Ordered arrow patterns — most-specific (longest) first so that `-->>` is
 * matched before `-->` and `->>` before `->`.
 */
const ARROW_ALTS = '-->>|--x|--\\)|-->|->>|->|-x|-\\)';

/**
 * Full message pattern (whitespace-tolerant):
 *   GROUP 1: FROM participant raw ID
 *   GROUP 2: arrow operator
 *   GROUP 3: optional +/- activation shorthand on TO
 *   GROUP 4: TO participant raw ID
 *   GROUP 5: label text (trimmed by caller)
 *
 * FROM and TO must start with a letter or underscore (standard Mermaid IDs).
 * Spaces around the arrow are optional.
 */
const SEQ_MSG_RE = new RegExp(
  `^([A-Za-z_]\\w*)\\s*(${ARROW_ALTS})\\s*([+\\-]?)([A-Za-z_]\\w*)\\s*:(.*)$`,
);

interface MessageToken {
  fromRaw: string;
  arrow: string;
  activateTo: boolean;    // + on TO participant
  deactivateFrom: boolean; // - on TO participant (semantically deactivates FROM)
  toRaw: string;
  label: string;
}

/**
 * Try to parse a line as a Mermaid sequence message.
 * Returns null if the line does not match.
 */
function parseMessageLine(line: string): MessageToken | null {
  const m = SEQ_MSG_RE.exec(line);
  if (!m) return null;

  const modifier = m[3] ?? '';
  return {
    fromRaw:        m[1] ?? '',
    arrow:          m[2] ?? '->>', // should always match
    activateTo:     modifier === '+',
    deactivateFrom: modifier === '-',
    toRaw:          m[4] ?? '',
    label:          (m[5] ?? '').trim(),
  };
}

// ---------------------------------------------------------------------------
// Participant declaration tokenizer
// ---------------------------------------------------------------------------

const PARTICIPANT_RE = /^(participant|actor)\s+([A-Za-z_]\w*)(?:\s+as\s+(.+))?\s*$/i;

interface ParticipantToken {
  kind: 'actor' | 'object';
  rawId: string;
  label: string;
}

function parseParticipantLine(line: string): ParticipantToken | null {
  const m = PARTICIPANT_RE.exec(line);
  if (!m) return null;

  const keyword = (m[1] ?? 'participant').toLowerCase();
  const rawId   = m[2] ?? '';
  const alias   = m[3]?.trim();

  return {
    kind:  keyword === 'actor' ? 'actor' : 'object',
    rawId,
    label: alias && alias.length > 0 ? alias : rawId,
  };
}

// ---------------------------------------------------------------------------
// Fragment keyword matchers
// ---------------------------------------------------------------------------

const LOOP_RE     = /^loop\s+(.*)/i;
const OPT_RE      = /^opt\s+(.*)/i;
const ALT_RE      = /^alt\s+(.*)/i;
const ELSE_RE     = /^else(?:\s+(.*))?$/i;
const PAR_RE      = /^par(?:\s+(.*))?$/i;
const AND_RE      = /^and(?:\s+(.*))?$/i;
const CRITICAL_RE = /^critical\s+(.*)/i;
const BREAK_RE    = /^break\s+(.*)/i;
const END_RE      = /^end\s*$/i;
const ACTIVATE_RE   = /^activate\s+([A-Za-z_]\w*)\s*$/i;
const DEACTIVATE_RE = /^deactivate\s+([A-Za-z_]\w*)\s*$/i;
const AUTONUMBER_RE = /^autonumber\s*$/i;
const NOTE_RE       = /^note\s+(left\s+of|right\s+of|over)\s+.*/i;

// ---------------------------------------------------------------------------
// Internal state types
// ---------------------------------------------------------------------------

interface PendingSection {
  guard?: string;
  fromOrder: number;
}

interface PendingFragment {
  kind: Fragment['kind'];
  /** Main fragment label (first alt/par label, loop label, etc.) */
  label: string;
  /** First message order inside this fragment. Set to orderCounter at fragment start. */
  from_order: number;
  /** True for alt/par — these produce sections. */
  isMultiSection: boolean;
  /** Section being accumulated (open). */
  currentSection?: PendingSection;
  /** Completed sections (not yet finalized with toOrder). */
  completedSections: Array<{ guard?: string; fromOrder: number; toOrder: number }>;
}

// ---------------------------------------------------------------------------
// ID sanitization (same algorithm as flowchart.ts)
// ---------------------------------------------------------------------------

function sanitizeId(rawId: string, idMap: Map<string, string>): string {
  if (idMap.has(rawId)) return idMap.get(rawId)!;

  let s = rawId;
  // camelCase / PascalCase → kebab-case
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2');
  s = s.replace(/([a-z])([A-Z])/g, '$1-$2');
  // lowercase
  s = s.toLowerCase();
  // underscores / spaces → hyphens
  s = s.replace(/[_\s]+/g, '-');
  // strip non-[a-z0-9-]
  s = s.replace(/[^a-z0-9-]/g, '');
  // collapse multiple hyphens; strip leading/trailing hyphens
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');
  // prefix 'n' if empty or starts with digit
  if (!s || /^\d/.test(s)) s = 'n' + s;

  // collision resolution
  const existingValues = new Set(idMap.values());
  if (!existingValues.has(s)) {
    idMap.set(rawId, s);
    return s;
  }
  let candidate = s;
  let counter = 2;
  while (existingValues.has(candidate)) {
    candidate = `${s}-${counter}`;
    counter++;
  }
  idMap.set(rawId, candidate);
  return candidate;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse Mermaid `sequenceDiagram` text and return the Sequence Grammar IR.
 *
 * Does not throw on syntax errors. Returns a valid (possibly partial) document
 * with warnings for everything that was skipped or degraded.
 */
export function parseSequence(text: string): SequenceDocument {
  return parseSequenceInternal(text).doc;
}

/**
 * Full-fidelity parse: returns doc + warnings + frontmatter.
 * Used by renderMermaid in index.ts to apply theme overrides.
 */
export function parseSequenceInternal(text: string): SequenceParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  // ── Parse state ──────────────────────────────────────────────────────────
  const idMap = new Map<string, string>();
  /** Participants in first-declaration/first-use order. */
  const participantsMap = new Map<string, Participant>();
  const messages: Message[] = [];
  const activations: Activation[] = [];
  const fragments: Fragment[] = [];

  /** Running message order counter (0-based, monotonically increasing). */
  let orderCounter = 0;
  /** Order of the last message parsed (undefined = no messages yet). */
  let lastOrder: number | undefined;

  /**
   * Activation stacks per participant (sanitized ID → stack of from_order values).
   * Each push corresponds to an 'activate' or '+' shorthand.
   */
  const actStacks = new Map<string, number[]>();

  /** Fragment stack (innermost at end). */
  const fragStack: PendingFragment[] = [];

  // ── Helper: ensure participant exists ────────────────────────────────────

  function ensureParticipant(rawId: string, kind: Participant['kind'] = 'object'): string {
    const sanitized = sanitizeId(rawId, idMap);
    if (!participantsMap.has(sanitized)) {
      participantsMap.set(sanitized, {
        id: sanitized,
        label: rawId,
        kind,
      });
    }
    return sanitized;
  }

  // ── Helper: activate participant ─────────────────────────────────────────

  function activateParticipant(sanitizedId: string, fromOrder: number): void {
    if (!actStacks.has(sanitizedId)) actStacks.set(sanitizedId, []);
    actStacks.get(sanitizedId)!.push(fromOrder);
  }

  // ── Helper: deactivate participant ───────────────────────────────────────

  function deactivateParticipant(sanitizedId: string, toOrder: number): void {
    const stack = actStacks.get(sanitizedId);
    if (!stack || stack.length === 0) {
      warnings.push(
        `WARNING: deactivate '${sanitizedId}' without matching activate — skipped.`,
      );
      return;
    }
    const fromOrder = stack.pop()!;
    if (fromOrder > toOrder) {
      warnings.push(
        `WARNING: activation for '${sanitizedId}' has from_order (${fromOrder}) > to_order (${toOrder}) — skipped.`,
      );
      return;
    }
    activations.push({ participant: sanitizedId, from_order: fromOrder, to_order: toOrder });
  }

  // ── Helper: close a pending fragment ────────────────────────────────────

  function closeFragment(pending: PendingFragment): void {
    // Must have at least one message
    if (lastOrder === undefined || pending.from_order > lastOrder) {
      warnings.push(
        `WARNING: ${pending.kind} fragment '${pending.label}' contains no messages — skipped.`,
      );
      return;
    }

    const to_order = lastOrder;

    if (pending.isMultiSection) {
      // Close the current open section
      const sections: FragmentSection[] = [...pending.completedSections];

      if (pending.currentSection) {
        const sec = pending.currentSection;
        const toOrder = lastOrder;
        if (sec.fromOrder <= toOrder) {
          sections.push({
            ...(sec.guard !== undefined ? { guard: sec.guard } : {}),
            fromOrder: sec.fromOrder,
            toOrder,
          });
        } else {
          warnings.push(
            `WARNING: ${pending.kind} section '${sec.guard ?? '(unnamed)'}' has no messages — omitted.`,
          );
        }
      }

      const frag: Fragment = {
        kind: pending.kind,
        label: pending.label || `(${pending.kind})`,
        from_order: pending.from_order,
        to_order,
        ...(sections.length >= 2 ? { sections } : {}),
      };
      fragments.push(frag);
    } else {
      const frag: Fragment = {
        kind: pending.kind,
        label: pending.label || `(${pending.kind})`,
        from_order: pending.from_order,
        to_order,
      };
      fragments.push(frag);
    }
  }

  // ── 1. Locate header ────────────────────────────────────────────────────
  let headerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (/^sequencediagram\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }

    // First non-empty line is not the expected header — warn and continue
    if (!/^\s*%%/.test(trimmed)) {
      warnings.push(
        `Expected "sequenceDiagram" header on first content line; got: "${trimmed}". Proceeding.`,
      );
      break;
    }
  }

  // ── 2. Parse body lines ──────────────────────────────────────────────────
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // ── autonumber ─────────────────────────────────────────────────────────
    if (AUTONUMBER_RE.test(trimmed)) {
      warnings.push(
        'DEFERRED: autonumber is not representable in the sequence IR in Tier-0. ' +
          'Step numbering display is a theme/rendering concern.',
      );
      continue;
    }

    // ── Note → warn + skip ────────────────────────────────────────────────
    if (NOTE_RE.test(trimmed)) {
      warnings.push(
        `DEFERRED: Note construct has no IR type in the sequence grammar yet ` +
          `(Mark's decision). Line skipped: "${trimmed}"`,
      );
      continue;
    }

    // ── activate / deactivate ─────────────────────────────────────────────
    const activateM = ACTIVATE_RE.exec(trimmed);
    if (activateM) {
      const raw = activateM[1] ?? '';
      const sid = ensureParticipant(raw);
      // from_order = last message order (the one that triggered activation)
      // or 0 if no messages yet
      const from = lastOrder !== undefined ? lastOrder : 0;
      activateParticipant(sid, from);
      continue;
    }

    const deactivateM = DEACTIVATE_RE.exec(trimmed);
    if (deactivateM) {
      const raw = deactivateM[1] ?? '';
      const sid = sanitizeId(raw, idMap);
      const to = lastOrder !== undefined ? lastOrder : 0;
      deactivateParticipant(sid, to);
      continue;
    }

    // ── participant / actor ────────────────────────────────────────────────
    const pToken = parseParticipantLine(trimmed);
    if (pToken) {
      const sid = sanitizeId(pToken.rawId, idMap);
      if (!participantsMap.has(sid)) {
        participantsMap.set(sid, {
          id: sid,
          label: pToken.label,
          kind: pToken.kind,
        });
      } else {
        // Update label and kind on explicit re-declaration
        const existing = participantsMap.get(sid)!;
        existing.label = pToken.label;
        existing.kind = pToken.kind;
      }
      continue;
    }

    // ── Fragment: loop ─────────────────────────────────────────────────────
    const loopM = LOOP_RE.exec(trimmed);
    if (loopM) {
      fragStack.push({
        kind: 'loop',
        label: (loopM[1] ?? '').trim() || '(loop)',
        from_order: orderCounter,
        isMultiSection: false,
        completedSections: [],
      });
      continue;
    }

    // ── Fragment: opt ──────────────────────────────────────────────────────
    const optM = OPT_RE.exec(trimmed);
    if (optM) {
      fragStack.push({
        kind: 'opt',
        label: (optM[1] ?? '').trim() || '(opt)',
        from_order: orderCounter,
        isMultiSection: false,
        completedSections: [],
      });
      continue;
    }

    // ── Fragment: alt ──────────────────────────────────────────────────────
    const altM = ALT_RE.exec(trimmed);
    if (altM) {
      const label = (altM[1] ?? '').trim();
      fragStack.push({
        kind: 'alt',
        label: label || '(alt)',
        from_order: orderCounter,
        isMultiSection: true,
        currentSection: { guard: label || undefined, fromOrder: orderCounter },
        completedSections: [],
      });
      continue;
    }

    // ── Fragment: else ─────────────────────────────────────────────────────
    const elseM = ELSE_RE.exec(trimmed);
    if (elseM) {
      const top = fragStack[fragStack.length - 1];
      if (!top || !top.isMultiSection) {
        warnings.push(`WARNING: "else" without matching "alt" — skipped: "${trimmed}"`);
        continue;
      }
      // Close current section
      if (top.currentSection) {
        const sec = top.currentSection;
        const toOrder = lastOrder !== undefined ? lastOrder : sec.fromOrder;
        if (sec.fromOrder <= toOrder) {
          top.completedSections.push({
            ...(sec.guard !== undefined ? { guard: sec.guard } : {}),
            fromOrder: sec.fromOrder,
            toOrder,
          });
        } else {
          warnings.push(
            `WARNING: alt section '${sec.guard ?? '(unnamed)'}' has no messages — omitted.`,
          );
        }
      }
      // Open new section
      const elseLabel = (elseM[1] ?? '').trim() || undefined;
      top.currentSection = { guard: elseLabel, fromOrder: orderCounter };
      continue;
    }

    // ── Fragment: par ──────────────────────────────────────────────────────
    const parM = PAR_RE.exec(trimmed);
    if (parM) {
      const label = (parM[1] ?? '').trim();
      fragStack.push({
        kind: 'par',
        label: label || '(par)',
        from_order: orderCounter,
        isMultiSection: true,
        currentSection: { guard: label || undefined, fromOrder: orderCounter },
        completedSections: [],
      });
      continue;
    }

    // ── Fragment: and ─────────────────────────────────────────────────────
    const andM = AND_RE.exec(trimmed);
    if (andM) {
      const top = fragStack[fragStack.length - 1];
      if (!top || !top.isMultiSection || top.kind !== 'par') {
        warnings.push(`WARNING: "and" without matching "par" — skipped: "${trimmed}"`);
        continue;
      }
      // Close current section
      if (top.currentSection) {
        const sec = top.currentSection;
        const toOrder = lastOrder !== undefined ? lastOrder : sec.fromOrder;
        if (sec.fromOrder <= toOrder) {
          top.completedSections.push({
            ...(sec.guard !== undefined ? { guard: sec.guard } : {}),
            fromOrder: sec.fromOrder,
            toOrder,
          });
        } else {
          warnings.push(
            `WARNING: par section '${sec.guard ?? '(unnamed)'}' has no messages — omitted.`,
          );
        }
      }
      // Open new section
      const andLabel = (andM[1] ?? '').trim() || undefined;
      top.currentSection = { guard: andLabel, fromOrder: orderCounter };
      continue;
    }

    // ── Fragment: critical → degrade to opt ───────────────────────────────
    const critM = CRITICAL_RE.exec(trimmed);
    if (critM) {
      const label = (critM[1] ?? '').trim();
      warnings.push(
        `DEFERRED: "critical" fragment degraded to "opt" (not in IR kind in Tier-0 schema). Label: "${label}"`,
      );
      // Note: 'critical' IS in Fragment.kind enum — pass it through
      fragStack.push({
        kind: 'critical',
        label: label || '(critical)',
        from_order: orderCounter,
        isMultiSection: false,
        completedSections: [],
      });
      continue;
    }

    // ── Fragment: break → degrade to opt ──────────────────────────────────
    const breakM = BREAK_RE.exec(trimmed);
    if (breakM) {
      const label = (breakM[1] ?? '').trim();
      warnings.push(
        `DEFERRED: "break" fragment degraded to "opt" (not in IR kind in Tier-0 schema). Label: "${label}"`,
      );
      // Note: 'break' IS in Fragment.kind enum — pass it through
      fragStack.push({
        kind: 'break',
        label: label || '(break)',
        from_order: orderCounter,
        isMultiSection: false,
        completedSections: [],
      });
      continue;
    }

    // ── Fragment: end ──────────────────────────────────────────────────────
    if (END_RE.test(trimmed)) {
      const pending = fragStack.pop();
      if (!pending) {
        warnings.push('WARNING: "end" without matching fragment keyword — skipped.');
        continue;
      }
      closeFragment(pending);
      continue;
    }

    // ── Message line ──────────────────────────────────────────────────────
    const msgToken = parseMessageLine(trimmed);
    if (msgToken) {
      const { fromRaw, arrow, activateTo, deactivateFrom, toRaw, label } = msgToken;

      // Auto-register participants
      const fromId = ensureParticipant(fromRaw);
      const toId   = ensureParticipant(toRaw);

      // Build message
      const order = orderCounter++;
      lastOrder = order;

      const msg: Message = {
        from:  fromId,
        to:    toId,
        label: label.length > 0 ? label : '(message)',
        order,
        kind:  arrowToKind(arrow),
      };
      if (label.length === 0) {
        warnings.push(`WARNING: message at order ${order} has empty label; using "(message)".`);
      }
      messages.push(msg);

      // Activation shorthand
      if (activateTo) {
        activateParticipant(toId, order);
      }
      if (deactivateFrom) {
        // Semantically: deactivate FROM (the participant who was active and is now replying)
        deactivateParticipant(fromId, order);
      }

      continue;
    }

    // ── Unrecognised line ─────────────────────────────────────────────────
    warnings.push(`SKIP: unrecognised line in sequenceDiagram: "${trimmed}"`);
  }

  // ── 3. Close any unclosed fragments (warn) ───────────────────────────────
  while (fragStack.length > 0) {
    const pending = fragStack.pop()!;
    warnings.push(
      `WARNING: unclosed ${pending.kind} fragment '${pending.label}' — attempting to close at end of input.`,
    );
    closeFragment(pending);
  }

  // ── 4. Close any unclosed activations (warn) ────────────────────────────
  for (const [id, stack] of actStacks) {
    while (stack.length > 0) {
      const fromOrder = stack.pop()!;
      const toOrder   = lastOrder !== undefined ? lastOrder : fromOrder;
      warnings.push(
        `WARNING: unclosed activate for '${id}' — closed at order ${toOrder}.`,
      );
      if (fromOrder <= toOrder) {
        activations.push({ participant: id, from_order: fromOrder, to_order: toOrder });
      }
    }
  }

  // ── 5. Ensure at least one participant (schema requires min 1) ───────────
  if (participantsMap.size === 0) {
    warnings.push(
      'WARNING: no participants found in sequenceDiagram — adding synthetic placeholder.',
    );
    participantsMap.set('participant', {
      id: 'participant',
      label: 'Participant',
      kind: 'object',
    });
  }

  // ── 6. Resolve theme and metadata ───────────────────────────────────────
  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = fmTitle ?? directiveTitle;

  // ── 7. Assemble SequenceDocument ─────────────────────────────────────────
  const doc: SequenceDocument = {
    version: '1.0',
    metadata: {
      ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    },
    sequence: {
      participants: Array.from(participantsMap.values()),
      messages,
      ...(activations.length > 0 ? { activations } : {}),
      ...(fragments.length > 0 ? { fragments } : {}),
    },
  };

  return { doc, warnings, frontmatter };
}
