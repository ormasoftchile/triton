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
