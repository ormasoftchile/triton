# Mark History Archive — Through 2026-06-11

This archive contains Mark's IR specification and reconciliation work from project initiation through Phase 1 completion. For current work, see history.md.

---

## Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of a deterministic diagram compiler. Mark leads IR design.
- **Stack:** LaTeX for design document; TypeScript/Node for implementation.
- **Created:** 2026-06-10

---

## Milestone: IR Core Shape Specified (2026-06-09/10)

✓ **IR Specification Complete (§4)**

### Core IR Envelope

Root structure: `version`, `metadata`, `tracks`, `groups` (opt), `activities`, `milestones` (opt), `annotations` (opt), `sections` (opt), `legend` (opt).

- **Tracks:** Swimlanes containing activities/milestones
- **Groups:** Hierarchical structure within tracks
- **Activities:** Time spans (start/end or span)
- **Milestones:** Point events in time
- **Status:** `planned`, `in-progress`, `done`, `at-risk`, `blocked`, `cancelled`, `tentative` (visual, not PM workflow)

### Date Model

- ISO dates (2026-06-09), partial (2026-06, 2026)
- Quarters (2026-Q2), halves (2026-H1), fiscal (FY26-Q2)
- Relative (+3m, -2w), symbolic (now)
- Uncertain: TBD, ongoing, unknown, ~prefix (approximate)
- DateRange: start/end pair or span shorthand

### ID/Ref System

- IDs: kebab-case slugs (`^[a-z][a-z0-9-]*$`), globally unique
- References: bare strings validated by schema context (ref<Track>, ref<Activity>, etc.)

### Well-formedness Invariants: 14 (later 17)

Covers version validity, required fields, ID uniqueness, reference resolution, no circular groups, temporal consistency (end >= start), progress [0,1], enum validity.

---

## Milestone: IR Reconciliation Complete (2026-06-10)

✓ **Resolved 6 Gaps with Barbara (Rendering) & Bjarne (Agent Integration)**

### New Fields Added

1. **`metadata.today`:** Date anchor for `now`, relative dates (+3m, -2w), today-marker. Resolution: `metadata.today` → `metadata.created` → hard error (DATE_ANCHOR_MISSING). Ensures byte-stable, deterministic output (no system clock).

2. **`metadata.fiscal_year_start`:** Int [1..12], default 1 (January). Maps fiscal dates (FYnn-Qk) to calendar dates.

3. **`metadata.logo`:** Logo asset. Shape: `{ src: string; position?: 'top-left'|'top-right'; width?: number; height?: number }`. (Later added by Mark.)

### Resolved Conflicts

- **Omitted end semantics:** Activity with start but no end = open/ongoing. Explicit valid state, not error.
- **`span` / `start`+`end` exclusivity:** Added Invariant #12 (SPAN_START_CONFLICT). Every activity must satisfy exactly one: `span` alone or `start` ± `end`.
- **Relative-date anchor:** Invariant #13 (DATE_ANCHOR_MISSING). Relative dates resolve against `metadata.today` → `metadata.created`.
- **`track.index` naming:** Renamed from `order` throughout §4 for consistency with downstream teams. Invariant #14: uniqueness.

### Invariant Expansion

14 → 17 after adding #12 (span exclusivity), #13 (date anchor), #14 (track index unique).

---

## Milestone: Parity & Phase 1 Implementation (2026-06-10/11)

✓ **Activity/Milestone Parity Achieved; Schema Tightened**

### Activity Gained Icon & Color (T1 support)

- **`Activity.icon?: string`:** Named icon from registry (e.g., "star", "flag"). Optional; unknown icon → silent fallback.
- **`Activity.color?: string`:** Opt; default theme color. Matches Milestone.color parity.

### Milestone Gained Metadata

- **`Milestone.metadata?: map<string, any>`:** Optional provenance map. Supports re-sync (T5/Gitline).

### ContentBlock Support (T2 Step 1)

- **`ContentBlock` interface:** `{ heading?: string; text: string }`
- **`Activity.blocks? ContentBlock[]`** & **`Milestone.blocks?: ContentBlock[]`:** Multi-section content for vertical-spine entries.
- **Precedence decision:** Renderers SHOULD prefer `blocks` over `description` when non-empty. Soft (documented, not hard invariant).

### Schema Tightening (packages/core/src/schema.ts)

- **`idSchema`:** Enforces `^[a-z][a-z0-9-]*$` regex
- **`irDateSchema`:** Comprehensive regex covering ISO, quarter, half, fiscal, relative, symbolic, uncertain, approximate
- **`contentBlockSchema`:** Zod sub-object wired into both Activity and Milestone
- **Metadata.logo:** Full shape validated

### Test Coverage

- Phase 0: 490 tests
- After ContentBlock: 556 tests (540 core + 13 schema + 3 CLI)
- All green; typecheck + lint clean

---

## Key Learning Points

- The IR is the **universal contract** between ingestion, domain reasoning, and rendering. Small, semantically tight domain IRs (timeline entities ≠ graph nodes) are LLM-friendly.
- Date resolution chain (metadata.today → metadata.created → error) ensures determinism and author control.
- Parity decisions (Activity/Milestone icon, color, blocks) keep the IR consistent and extensible.
- Well-formedness invariants (17 total) catch misconfigurations early, supporting deterministic rendering and agent generation.
- The two-IR-layer model (domain IR → Scene IR) decouples grammar-specific concerns from universal rendering primitives.

---

## Files & Specs

- Design: `design/sections/04-ir.tex` (~1340 lines, LaTeX source)
- Schema: `packages/core/src/schema.ts`, `packages/schema/v1/timeline.json`
- Types: `packages/core/src/types.ts`
- Validation: `packages/core/src/validate.ts`, `packages/core/src/load.ts`
- Tests: `packages/core/test/validate.test.ts`, `packages/schema/test/schema.test.ts`
# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of deterministic diagram compiler. Mark leads IR (intermediate representation) architecture.
- **Stack:** LaTeX for design; TypeScript/Node for implementation (Phase 0–1+ in progress).
- **Created:** 2026-06-10

## Current Learnings

- The IR is the **universal contract** between ingestion, rendering, and agent reasoning. Small, semantically tight domain IRs (not god-schemas) are LLM-friendly.
- Parity decisions (Activity/Milestone icon, color, blocks, metadata) keep the IR consistent and extensible across multiple grammars.
- Well-formedness invariants (17 total) catch misconfigurations early for deterministic rendering.
- Date resolution chain (metadata.today → metadata.created → error) ensures determinism; no system-clock dependency.
- The two-IR-layer model (grammar-specific domain IR → universal Scene IR) decouples concerns and enables grammar-agnosticism.

## 2026-06-11 — Strategic Alignment on Two-IR-Layer Architecture (Mark)

📐 **IR Positioned Within Diagram Compiler Strategic Reframe**

### Scene IR as Shared Kernel Contract

With the strategic reframe to diagram compiler, the IR architecture is repositioned:

- **Domain IR** (Timeline's IR): Grammar-specific, small, semantically tight
- **Scene IR** (Universal kernel): Assembly language of primitives (Rect, Line, Circle, Text, Path, Group, effects, animation hints)
- **All domain IRs compile DOWN to Scene IR** — the shared rendering contract

### Timeline IR Role in Phase 0→2

In Phase 0, the kernel/timeline seam is drawn inside `packages/core`. Timeline IR (Domain) + Timeline Layout Engine compile to Scene IR. Future grammars (Flow, Graph, etc.) will have their own domain IRs, sharing the Scene IR contract and kernel infrastructure.

### Implications for Validation & Rendering

- Timeline validation continues to enforce the 17 well-formedness invariants
- Scene IR compilation deterministic: same Timeline IR → same Scene IR (golden-testable as text/bytes)
- Backend diversity supported: SVG, PNG (resvg), Skia, PDF — all consume Scene IR, not domain IR
- Animation hints on Scene primitives are backend-conditional (SVG honors; raster ignores)

---

## Cross-Agent Flags — David's Research Synthesis (2026-06-12)

**From David (Research Lead):**
- Domain IR schemas must remain **small and self-contained**. Large polymorphic god-IRs are LLM-authoring failure vectors.
- Constrained LLM generation: Research shows small grammars outperform full schemas (Willard 2023, Wang 2023, Dong 2024 XGrammar).
- **Recommendation:** Submit each Domain IR JSON Schema as constraint grammar (XGrammar or GBNF) to eliminate syntactic failures.
- **Comparison/Matrix Grammar Implication:** This grammar is genuinely **tabular**, not a flow or graph. It needs its own Domain IR with entity types: `column`, `row`, `cell`, `indicator` (not Sugiyama DAG entities). Layout is constrained-grid (column-width × row-height), not any Sugiyama variant.

---

## 2026-06-12 — Theme Tokens: New Axis-Routing Grammar Extension (Barbara's Node Wrap)

**From Barbara (Semantics & Rendering):**

Added **`axis.nodeWrap?: 'none' | 'over-under'`** token to `AxisTheme` (packages/core/src/themes/types.ts). This is a **new pattern for opt-in axis-routing grammar features** — a theme-level knob that changes layout behavior without altering the IR.

- **Default `'none'`**: byte-identical output; existing themes unaffected
- **`'over-under'`** (enabled in our-timeline theme): horizontal spine routes around on-axis circular nodes as alternating semicircular arcs (arc radius = ms.size + 9 px)
- **Implication for future grammars:** Theme tokens can now express routing algorithms (arc-weaving, constraint-based, force-directed hints) — design alternative to embedding routing specs in the Domain IR

**Mark/IR Note:** This confirms the two-IR-layer boundary. Layout is rendering/theming concern, not IR concern. Future grammars can define axis-routing patterns similarly as opt-in theme tokens rather than polluting domain IRs.

---

## Open Questions — Flow Grammar Phase 1 Preparation (2026-06-12)

**Context:** Leslie (Spec Architect) authored Flow Grammar Spec (Grammar #2) in sections/25-flow-grammar.tex. Flow IR is now awaiting Mark's JSON Schema design. Scribe identified open questions for day-1 implementation context.

### Flow Domain IR Schema Open Questions

1. **Edge Unique Identity:** Should edges have explicit `id` field or rely on positional identity (source + target + port pairs)? Impact: reference resolution, validation, determinism.
   - **Tradeoff:** Explicit id = easier JSON references, harder to serialize; positional = deterministic ordering, more fragile if port order changes.
   - **Decision impact:** Validation invariants, LLM generation constraints.

2. **Port Model Extensibility:** Current spec lists fixed ports (auto|top|right|bottom|left). Should schema allow named custom ports?
   - **Use case:** Domain-specific node types might need ports like 'data-in', 'control-out' for semantic precision.
   - **Impact on routing:** Layout engine (Sugiyama + port-aware connection coordinate resolution).

3. **JSON Schema Constraints:** Enums for node shape, edge style, group layout, and directedness need exhaustive specification.
   - **XGrammar / GBNF constraint grammar:** Per David's research, should be submitted as constraint grammar to LLM generation pipeline for syntactic reliability.

4. **Validation Rule List:** 17 Timeline IR invariants exist. Flow needs similar well-formedness rules:
   - Example: All source/target node refs must exist; no cycles in group nesting; at least one node if groups present?
   - Impact: LLM generation failure modes; error messaging.

---

## 2026-06-13 — Sequence Grammar Domain IR Open Questions (Mark Intake)

**From:** Scribe (recording Leslie's deferred work) | **Date:** 2026-06-13T06:43:00Z  
**Artifact:** `design/sections/26-sequence-grammar.tex` (Grammar #3 Specification)  
**Status:** Ready for Mark's JSON Schema refinement

### Sequence IR Schema Queries (Priority: Mark intake for Phase 2)

1. **Message Unique Identity**
   - Should Message require explicit `id` field or rely on positional identity (from + to + order)?
   - **Impact:** Reference resolution in fragments, activation ranges; validation determinism; LLM generation constraints.

2. **Order Field — Implicit vs. Explicit**
   - Current spec: messages have explicit `order` integer. Alternative: infer order from list position?
   - **Tradeoff:** Explicit = self-documenting, reorderable; implicit = compact, fragile if position changes.
   - **Impact:** Serialization, validation, evolution path.

3. **Fragment Overlap & Nesting Validation**
   - Fragments specify `from_order`, `to_order` ranges. What invariants guard against:
     - Fragment A nested in Fragment B but order ranges don't nest?
     - Multiple fragments with identical order spans?
     - Participants in fragment subset not in global participants list?
   - **Pattern:** Add to 17-strong well-formedness rule set (Timeline invariants model).

4. **JSON Schema Precision**
   - Participant `kind` enum: `actor|object|boundary|control|entity|database`
   - Message `kind` enum: `sync|async|reply`
   - Fragment `kind` enum: `loop|alt|opt|par|critical|break`
   - Enums complete? Any domain-specific extensions to anticipate?

5. **Constraint Grammar (XGrammar/GBNF)**
   - Per David's research guidance: Submit Sequence JSON schema as constraint grammar for LLM generation pipeline reliability.
   - Deliverable: Annotated XGrammar version of schema for constraint-based syntactic validation.

---

## 2026-06-13 — Sequence Grammar Implementation Complete (Barbara → Mark)

**From:** Scribe | **Date:** 2026-06-13T14:13:38Z  
**Artifact:** Commit 301a188 | `packages/core/src/grammars/sequence/` module  
**Status:** COMPLETED — First full multi-grammar implementation

### Sequence IR Implemented (Domain IR Validation)

**Barbara shipped full Sequence Grammar Increment-1:**

```
SequenceDocument (Domain IR)
  - participants: [{id, label, kind, description}]
  - messages: [{from, to, label, order, kind}]
  - activations: [{participant, from_order, to_order}]
  - fragments: [{kind, label, from_order, to_order, participants?}]
```

**Module Structure:**
- `types.ts` — SequenceDocument + Participant/Message/Activation/Fragment interfaces
- `schema.ts` — Zod validation (participant uniqueness enforced; message refs validated)
- `layout.ts` — `layoutSequence()` deterministic-by-construction → Scene IR
- `index.ts` — `buildSequenceScene()` + `renderSequenceDocument()` public API

**Schema Validation Currently Implemented:**
- Participant id uniqueness (via Zod set)
- Message `from`/`to` references (must be valid participant ids)
- Message `order` as integer (no explicit validation of range; deferred per open questions)
- Fragment `kind` enum: `loop|alt|opt|par|critical|break`

### Key Insight: No Kernel Changes Required

All sequence constructs lowered to existing Scene IR primitives. All 577 timeline goldens byte-identical. 589/589 tests pass (577 legacy + 12 new sequence).

### Open Schema Questions — Next Actions for Mark

1. **YAML Loader Dispatch:** Should `compile()` / `loadIR()` dispatch on document `kind` field, or is sequence always separate entry point?
   - **Recommend:** Add `kind` field to root document + dispatcher

2. **Version Field Semantics:** Current validation is non-empty string. Enforce semver or allowlist?

3. **Theme Token Block:** When `SequenceTheme` added to `ResolvedTheme`, where does `sequence?` sit in interface? Currently using DEFAULTS in layout.

4. **Activation Cross-Validation:** `from_order`, `to_order` should reference valid message `order` values. Currently accepted structurally only — deferred to increment-2.

### Constraint Grammar Candidate

Per David's research (2026-06-12): Sequence JSON schema should be submitted as XGrammar/GBNF constraint grammar for LLM generation pipeline reliability. **Action:** Mark to author constraint grammar version of schema.

### Test Coverage: 589/589 Pass

12 new test cases cover:
- Participant uniqueness validation
- Message reference validation (from/to exist)
- Fragment nesting (increment-2 semantic rules deferred)
- Schema serialization round-trip
- Gallery fixture (sequence-rest-auth.sequence.yaml) renders clean UML-style sequence diagram

---

## 2026-06-12 — Cross-Agent Context: `axis_breaks` IR Field Schema Review (Barbara → Mark)

**From:** Barbara (Semantics & Rendering) | **Date:** 2026-06-12  
**Feature:** Optional `axis_breaks?: Array<{from: IRDate; to: IRDate}>` field in Metadata IR

### What Barbara Shipped (Rendering Adopted)

1. **IR Field:** `axis_breaks?: Array<{from: IRDate; to: IRDate}>` (optional; currently accepts basic IRDate format)
2. **Layout Engine:** Piecewise-linear scale with fixed 24px gaps per break; suppresses ticks/gridlines inside breaks
3. **Visual:** "//" marker (two line primitives) at break boundary; axis line segments separated by gap
4. **Determinism:** All 564 existing goldens byte-identical; 577/577 tests pass
5. **Additive:** New `roadmap` theme, milestone label wrapping (`labelWrap` token), 8px edge clamp for timeline-goals fixture

**Status:** Rendering ADOPTED. Schema validation rules deferred to Mark; detailed context in decisions-archive.md.

### Open Schema Validation Rules (Marked for Mark)

1. **`from < to` Enforcement**
   - **Current:** Accepted by Zod schema (basic IRDate format only)
   - **Issue:** Breaks with `from ≥ to` are structurally invalid; layout engine silently drops them
   - **Recommendation:** Add constraint to Zod; emit error code `BREAK_FROM_AFTER_TO` at parse time

2. **Breaks Within `time_range` Bounds**
   - **Current:** Accepted; layout engine ignores breaks outside document's time_range
   - **Issue:** Author intent unclear (accidental vs intentional)
   - **Recommendation:** Add bounds check; emit warning `BREAK_OUT_OF_RANGE`

3. **Non-Overlapping and Sorted**
   - **Current:** Accepted; layout engine sorts and filters overlaps (may produce visual artifacts)
   - **Issue:** Multiple breaks with same ordinal ranges cause undefined results
   - **Recommendation:** Validate no overlaps; emit `BREAKS_OVERLAP` / `BREAKS_UNSORTED` error codes

4. **Maximum Number of Breaks**
   - **Current:** No upper limit enforced
   - **Issue:** With N breaks, `nonBreakWDraw = wDraw − N × 24px`. If excessive, rendering invalid
   - **Recommendation:** Warning code `BREAKS_TOO_MANY` if N excessive or draw width < 100px

### Implementation Context

- **Files:** `packages/core/src/schema.ts` (Zod), `types.ts` (TypeScript), `validate.ts` (invariants)
- **Pattern:** Follow existing 17 well-formedness invariants in validate.ts
- **Error codes:** Use `BREAK_*` prefix (e.g., `BREAK_FROM_AFTER_TO`)
- **Testing:** Add to schema validation tests; existing goldens unaffected (axis_breaks opt-in)

---

---

## 2026-06-13 — Cross-Agent Context: Sequence Grammar IR Surface — Increment-2 (Barbara → Mark)

**From:** Barbara (Semantics & Rendering) | **Date:** 2026-06-13T14:34:13Z  
**Feature:** Activations + Fragments IR types (fully integrated; layout & render complete)

### New IR Types Shipped (Rendering Adopted)

**Activation** (optional array in SequenceDocument):
```typescript
interface Activation {
  participant: string;          // Must reference valid participant id
  from_order: number;           // Message order (inclusive)
  to_order: number;             // Message order (inclusive)
}
```

**Fragment** (optional array in SequenceDocument):
```typescript
interface Fragment {
  kind: 'loop' | 'alt' | 'opt' | 'par' | 'critical' | 'break';
  guard?: string;               // Label text (e.g., "[retry until 200]")
  from_order: number;           // Message order (inclusive)
  to_order: number;             // Message order (inclusive)
  fragments?: Fragment[];       // Nesting (recursive)
}
```

### Rendering Adopted

1. **Activations:** Thin filled rectangles (`activationBarHalfW=5`, `#c5cae9` fill / `#5c6bc0` stroke) on participant lifelines.
2. **Fragments:** Labeled rounded boxes with keyword tabs (layout renders outer-first, inner on top; nesting arbitrary depth).
3. **Deferral:** Alt sub-compartments (multiple guard conditions with divider lines) → increment-3.

**Status:** IR types ADOPTED. All 603 tests pass; goldens byte-identical.

### Open Schema Validation Rules (Marked for Mark)

1. **Activation Order-Range Validation**
   - **Current:** Structurally accepted; `from_order` and `to_order` must be integers
   - **Issue:** No cross-validation with actual message `order` values
   - **Recommendation:** Add constraint to Zod (or separate validation pass in `validate.ts`):
     - `from_order < to_order` 
     - Both `from_order` and `to_order` must exist in message `order` list
     - Emit error code `ACTIVATION_ORDER_INVALID` / `ACTIVATION_ORDER_OUT_OF_RANGE`

2. **Fragment Order-Range Validation**
   - **Current:** Structurally accepted; same as Activation
   - **Issue:** Same cross-validation gap
   - **Recommendation:** Same as Activation; error codes `FRAGMENT_ORDER_INVALID` / `FRAGMENT_ORDER_OUT_OF_RANGE`

3. **Alt Multi-Guard Schema (Deferred to Increment-3)**
   - **Current:** `guard?: string` (single label only)
   - **Issue:** Alt fragment visually requires multiple guard labels with horizontal dividers
   - **Design Choice:** 
     - **Option A:** Change to `guard?: string | string[]` (break order-range at each guard transition)
     - **Option B:** Introduce nested `guards: Array<{label: string; from_order: number; to_order: number}>` (explicit range per guard)
   - **Recommendation:** Option B offers clearer semantics; recommend Mark's sign-off

4. **Nesting Depth Limit**
   - **Current:** Recursive `fragments?: Fragment[]` allows arbitrary depth
   - **Issue:** UML spec soft-recommends ≤3; deep nesting becomes hard to read
   - **Recommendation:** Add soft limit; warn if depth >3 with error code `FRAGMENT_NESTING_DEEP`

### Implementation Context

- **Files:** `packages/core/src/grammars/sequence/schema.ts` (Zod), `types.ts` (TypeScript), deferred `validate.ts`
- **Pattern:** Follow existing particle uniqueness validation (participant id set)
- **Error codes:** Use `ACTIVATION_*` / `FRAGMENT_*` prefix
- **Testing:** New test cases cover valid/invalid order ranges; add to increment-3 pass

### Gallery Fixture Example

`examples/gallery/sequence-agent-loop.sequence.yaml`:
- 1 Activation: Agent (orders 2–6)
- 2 Fragments: `loop [retry until 200]` (orders 2–6), `opt [if token valid]` (order 7)
- Renders correctly; exercise both features end-to-end

---
# Mark — IR & Schema Architecture

**Owner:** Mark (IR & Schema Lead)  
**Project:** timeline — deterministic diagram compiler  
**Created:** 2026-06-10

---

## Current Role

Design and validate Domain IR schemas for each grammar (Timeline, Flow, Sequence, etc.). Ensure each schema is:
- Small & semantically tight (LLM-friendly per David's research)
- Deterministic-by-construction
- Submitted as constraint grammar (XGrammar/GBNF) for LLM generation reliability

---

## Key Learnings

- **Two-IR-Layer Model:** Domain IR (grammar-specific) → Scene IR (universal kernel). Cleanly decouples concerns.
- **Schema Constraints First:** Well-formedness invariants (17 for Timeline) are cross-validated EARLY (at parse time) to catch errors before layout engine.
- **Determinism Requirements:** No system-clock dependencies; date resolution chain ensures reproducibility across machines/sessions.
- **Theme as Layout Grammar:** Theme tokens (e.g., `axis.nodeWrap`, `labelWrap`) express opt-in layout behavior without polluting domain IR.
- **Constraint Grammars:** Small fragments outperform full schemas for LLM generation (Willard 2023, Wang 2023, Dong 2024 XGrammar).

---

## Active Schemas

### Timeline IR (Phase 0 — COMPLETE)

**Status:** SHIPPED  
**Module:** `packages/core/src/`  
**Files:** types.ts, schema.ts, validate.ts (17 well-formedness invariants)  
**Test Coverage:** 551 core tests pass; determinism verified

**Latest:** Increment-2 shipped `axis_breaks?: Array<{from, to}>` (optional time-axis gaps). Rendering adopted; schema validation rules (from<to, bounds, overlap) queued for Mark's implementation.

**Open:** Implement 4 validation rules for `axis_breaks` (BREAK_FROM_AFTER_TO, BREAK_OUT_OF_RANGE, BREAKS_OVERLAP, BREAKS_TOO_MANY).

### Flow IR (Phase 1 — STUBS ONLY)

**Status:** Spec complete (Leslie 2026-06-12); JSON schema design pending  
**Module:** `packages/core/src/flow/`  
**Files:** types.ts, schema.ts (stubs); no layout.ts yet  

**Design Questions (Mark intake):**
1. Edge unique identity (explicit `id` vs. positional)?
2. Port model extensibility (fixed vs. named custom ports)?
3. JSON schema precision (exhaustive enums)?
4. Validation rule list (17-element well-formedness model)?
5. Constraint grammar delivery (XGrammar version)?

### Sequence IR (Phase 1 — COMPLETE Increment-1 & Increment-2)

**Status:** SHIPPED Increment-1 (baseline); Increment-2 (Activations + Fragments)  
**Module:** `packages/core/src/grammars/sequence/`  
**Files:** types.ts, schema.ts, layout.ts, index.ts (full module)  
**Test Coverage:** 603/603 pass (589 existing + 14 new); goldens byte-identical

**Shipped Increment-1 (2026-06-13T06:43Z):**
- Participants, messages (sync/async/reply), lifelines, actor icons
- No kernel changes needed; existing Scene IR sufficient

**Shipped Increment-2 (2026-06-13T10:13Z):**
- Self-messages (dashed LinePrimitive segments)
- Activations (thin bars on lifelines; from_order → to_order)
- Fragments (labeled boxes: loop|alt|opt|par|critical|break with keyword tabs; nesting support)
- New fixture: sequence-agent-loop.sequence.yaml (3 participants, 7 messages, 1 activation, 2 fragments)

**Open Schema Validation (Mark intake Increment-3):**
1. **Activation/Fragment Order-Range Validation:** Cross-validate from/to against actual message `order` list (ACTIVATION_ORDER_INVALID, FRAGMENT_ORDER_INVALID).
2. **Alt Multi-Guard Schema:** Change `guard?: string` to support multiple conditions:
   - Option A: `guard?: string | string[]`
   - Option B: `guards: Array<{label: string; from_order; to_order}>`
   - Recommendation: Option B (clearer semantics)
3. **Nesting Depth Limit:** Warn if depth > 3 (FRAGMENT_NESTING_DEEP)
4. **Constraint Grammar:** XGrammar version for LLM generation pipeline

---

## Deferral Tracking

### Increment-2 Deferred to Increment-3

**Sequence Grammar:**
- Alt sub-compartments (multiple guard conditions with divider lines between)
- Participant kind icons (boundary, control, entity, database visual subtypes)
- SequenceTheme token integration on ResolvedTheme
- Fragment validation (order-range bounds, nesting depth soft limit)

**Timeline IR:**
- 4 validation rules for `axis_breaks` (awaiting Mark implementation)

---

## Next Actions

1. **Sequence Increment-3 (Mark + Barbara):**
   - Implement 4 order-range validation rules (ACTIVATION_*, FRAGMENT_*)
   - Finalize alt multi-guard schema design
   - Add nesting depth check + warn code
   - Author XGrammar constraint grammar version

2. **Flow IR Phase 1 (Mark + Leslie):**
   - Resolve 5 design questions above
   - Author Flow JSON schema (Zod + TypeScript)
   - Define 17-element well-formedness rule set
   - Deliver XGrammar constraint grammar

3. **Timeline IR Refinement:**
   - Implement `axis_breaks` validation (4 rules)
   - Add 4 new error/warn codes to schema

---

## Archive

Detailed architectural context, learnings, and cross-agent handoff notes archived to `mark/history-2026-06-13-archived.md` (16,808 bytes).

---


---
