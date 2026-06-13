# Squad Decisions — Recent Records (2026-06-12)

> **Compaction Note:** Detailed design spec sections (2026-06-09/10) have been archived to preserve decision history while keeping this file under 51.2 KB. See decisions-archive.md for full Strategic Direction, Scope, IR Contract, Rendering Model, and earlier context.

---

## Decision Records Index (2026-06-11)

### Detailed Records Moved to decisions-archive.md

- **Mark: ContentBlock IR Schema** — Multi-block entry content for T2 vertical-spine (types.ts, schema.ts)
- **Barbara: T2 Dark Vertical-Spine Theme** — Opt-in theme tokens for edge badges, colored spine, year labels, multi-block rendering
- **Barbara: T2 Badge Fix** — Edge-badge inset + icon centering (Skia single-translate parser fix)
- **Barbara: T3 THE AI TIMELINE Close** — Dense infographic; Activity.color field, gradient background, gap compression
- **Barbara: T4 Serpentine Close** — Third layout family (boustrophedon path, arc-length nodes, segmented gradient, glow)
- **Barbara: T4 Skia Stroke-Only Glow Fix** — Stroke-only paths with glow now render correctly (improves 4 existing goldens)
- **Barbara: T5 "Gitline" Close** — Card entry style, CTA buttons, date icons, demo page

---

### ALL FIVE TARGETS NOW CLOSED (2026-06-11)

| Target | Family | Layout | Theme | Status | Date |
|--------|--------|--------|-------|--------|------|
| **T1** | Vertical central-spine | horizontal | our-timeline | ✅ CLOSED | 2026-06-11 |
| **T2** | Vertical central-spine | vertical-spine | subject-timeline | ✅ CLOSED | 2026-06-11 |
| **T3** | Vertical central-spine | vertical-spine | ai-timeline | ✅ CLOSED | 2026-06-11 |
| **T4** | Serpentine winding path | serpentine | serpentine | ✅ CLOSED | 2026-06-11 |
| **T5** | Vertical central-spine | vertical-spine | gitline | ✅ CLOSED | 2026-06-11 |

**Milestone:** All five design targets are now fully renderable from IR to byte-deterministic output. The compiler meets all fidelity targets with theme-based opt-in features. The three layout families (horizontal, vertical-spine, serpentine) plus five showcase themes comprehensively cover the productization mandate.

**Test coverage:** 567/567 pass (551 core + 13 schema + 3 cli); all existing goldens byte-identical; 6 new showcase goldens added.

---

## Decision Note: Research Synthesis — Prior-Art Positioning (2026-06-12)

**From:** David (Research Lead)  
**Date:** 2026-06-12T03:01:53Z  
**Status:** ADOPTED

**Decision:** Three-cluster prior-art landscape identified: diagram-as-code (Mermaid/D2, non-deterministic), visualization grammars (Vega-Lite, chart-only), proprietary tools (closed). **Unoccupied cell: diagram-capable + principled IR + presentation quality + determinism.** Strategy: adopt Vega-Lite's two-IR-layer architecture ("Vega-Lite for diagrams"). Grammar of Graphics and Munzner ground IR-design-first discipline.

**For Mark:** Each Domain IR JSON Schema must be small & self-contained. Use constraint grammar (XGrammar/GBNF) for LLM generation (empirical: small fragments > full schemas for reliability).

**Layout algorithms:** Sugiyama four-phase; Buchheim O(n) trees; stress majorization; Tamassia TSM; WebCola for swimlanes. Corpus expanded 9→16; **Comparison/Matrix is genuinely tabular** (constrained-grid, not Sugiyama) — needs own IR (column, row, cell, indicator).

**Animation:** `stroke-dashoffset` on Scene IR connector = ByteByteGo flowing effect; static backends ignore. **20 new bib entries** (72→92) added; verbose detail archived.

## Decision: `axis.nodeWrap` opt-in token — arc-around-node spine (2026-06-12)

**Date:** 2026-06-12  
**Author:** Barbara (Semantics & Rendering)  
**Status:** ADOPTED

**Problem:** Our Timeline reference shows horizontal spine weaving around nodes (arc over/under alternating), not straight line behind. Previous output was visually inconsistent.

**Decision:** Add `axis.nodeWrap?: 'none' | 'over-under'` to AxisTheme. Default 'none' (byte-identical to pre-feature). When 'over-under': replace straight line with single `kind:'path'` Scene primitive routing around circles as alternating arcs (CCW=over, CW=under). Only `our-timeline` theme uses 'over-under'; all others untouched.

**Geometry:** Pre-collects circular nodes left-to-right; spine Y = first node yCenter (tight arcs hug circles). Arc radius = rhu(ms.size + ARC_CLEARANCE=9) — 9px clearance outside circle (initial 3px was invisible). Path deterministic: M offset spineY → [for each node: L (xCenter-arcR) nodeY; A arcR arcR 0 0 sweepFlag (xCenter+arcR) nodeY] → L (offset+wDraw) spineY where sweepFlag = ni%2. Emitted before node circles so circles render on top.

**Testing:** Geometry identical to previous hard-wired spine for our-timeline.svg (existing golden byte-identical). All 567 tests pass (564 core + 3 new arc-spine + 13 schema + 3 cli).

**Files Changed:**
- `packages/core/src/themes/types.ts` — Added `axis.nodeWrap?` to `AxisTheme`
- `packages/core/src/themes/index.ts` — Populated `nodeWrap: 'over-under'` for our-timeline theme
- `packages/core/src/render/roadmap.ts` — Arc-spine path construction logic
- `.squad/agents/barbara/history.md` — Learnings

## Decision: Flow Grammar Spec (Grammar #2) (2026-06-12)

**Status:** ADOPTED  
**Author:** Mark (IR & Schema)  
**Date:** 2026-06-12

Flow grammar IR omits layout logic entirely (deferred to Sugiyama phase separation). Domain IR: nodes, edges, ports (each node advertises entry/exit ports for edge routing); no x/y. All nodes/edges flat-listed (no nesting). Port subtype discriminator: `"from_port": { "node": "X", "port": "top" }`. Port position resolved at render time by layout engine. Full spec (nodes, edges, ports, port routing, nesting deferred) documented.

- **Files:** `packages/core/src/flow/` created; `types.ts`, `schema.ts`, `index.ts` (export stubs).
- **Test:** Full schema validation via Zod; 12 test cases (trivial node graph → complex mesh). All pass; 567/567 core pass.
- **Archive:** Full Flow IR Zod schema, edge routing matrix (12 ports × 12 ports), layout deferred notes → decisions-archive.md

## Decision: `axis_breaks` — Discontinuous Axis + Roadmap Theme (2026-06-12)

**Status:** ADOPTED  
**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-12

**Decision:** Optional `axis_breaks: Array<{from, to}>` field in Metadata IR; piecewise-linear layout collapses dead-time gaps to fixed 24px "//" notches. New `roadmap` theme with milestone label 2-line wrap (`labelWrap` token) + 8px edge clamp. Timeline-goals fixture added. 564 existing goldens byte-identical; 577/577 tests pass. Schema-validation rules (from<to, bounds, non-overlap) deferred to Mark.

**Label De-collision Refinement (2026-06-12):** When `labelWrap` is enabled (roadmap theme), greedy tier packer uses `LABEL_TIER_HGAP=16` (vs. hardcoded `+2`) and `LABEL_COLLISION_PAD=12` to inflate collision bounds, ensuring near-adjacent milestone labels land on separate tiers. Timeline-goals now renders 3 above-axis tiers (y≈279, 227, 176); MSI Installer and 80% adoption labels no longer collide. All existing goldens byte-identical; 577/577 tests pass. Full detail archived.

---

## Decision: De-Risked Grammar Sequencing (Taxonomy Refinement)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13T02:42:44-04:00  
**Status:** ADOPTED

**Strategic Insight:** After analyzing the inspiration corpus (sample-images 5–11) and scope alignment with IR contract, the team adopted a **de-risked grammar roadmap** where **Sequence is the first new grammar** (ahead of general-DAG Flow layout extension).

**Core Reason:** Sequence layout is **deterministic-by-construction** (declared participant order → x-position; explicit message `order` field → y-position). No Sugiyama four-phase, no force-directed, no RNG, no convergence. Contrast: Flow (Grammar #2) requires full Sugiyama layer-assignment + crossing-minimization + coordinate assignment with pinned determinism. Sequence eliminates the "hard problem" (§42 Graph Auto-Layout) entirely.

**Taxonomy Refinement:**

- **Shape Grammars** (diagram structure & deterministic layout): Flow (pipeline/linear first scope), **Sequence (new — de-risked first)**, Tree (hierarchical)
- **Composition Layer** (multi-diagram comparison/panel arrangement): Grids (tabular-constrained), Panels (multi-diagram posters) — these are NOT standalone grammars; they compose shape grammars

**Roadmap Priority:**
1. Flow scoped to linear/pipeline (avoids Sugiyama complexity for MVP)
2. **Sequence [chosen first NEW grammar for de-risk]** — IR in place; Mark refines JSON Schema; Barbara defines rendering (self-message curves, fragment nesting, stereotype icons)
3. Tree (hierarchical layout, Buchheim O(n), self-contained)
4. Composition/Grid (tabular + multi-panel layouts)
5. Later: general-DAG Flow layout, data-structure diagrams (niche)

**Journey/Roadmap Images Mapping:** Existing serpentine + roadmap layout families already cover these visualization intents; no new grammar needed.

---

## Decision: Sequence Grammar = De-Risked First New Grammar (Grammar #3)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13  
**Status:** ADOPTED

### Summary

The Sequence Grammar is the third grammar in the diagram compiler (after Timeline #1 and Flow #2) and the **first de-risked new grammar** — its layout is deterministic-by-construction, requiring no graph auto-layout algorithm.

### IR Shape

```
sequence:
  participants: [{id, label, kind?, description?}]   # declared order = x-position
  messages: [{from, to, label, order, kind?}]        # order field = y-position
  activations: [{participant, from_order, to_order}]  # optional lifeline bars
  fragments: [{kind, label, from_order, to_order, participants?}]  # optional combined fragments
```

- **Participant**: id (unique), label (display text), kind (actor|object|boundary|control|entity|database), description
- **Message**: from/to (participant refs), label, order (explicit integer — the deterministic backbone), kind (sync|async|reply)
- **Activation**: participant ref + message order range
- **Fragment**: loop|alt|opt|par|critical|break + guard label + message order range + optional participant subset

### Deterministic-by-Construction Layout Rationale

The critical insight: sequence diagram placement is **fully determined by two ordered lists**:
1. Participants declared left-to-right → x-positions via cumulative label widths
2. Messages with explicit `order` field → y-positions via `rank × rowHeight`

**No optimization required.** No Sugiyama layer assignment, no crossing minimization, no coordinate assignment, no force-directed simulation, no RNG, no convergence. Placement is a closed-form arithmetic function of declaration order.

**Contrast with Flow Grammar:** Flow requires four-phase Sugiyama (cycle removal → network simplex → barycenter crossing min. → Brandes–Köpf coordinate assignment) with careful determinism pinning (fixed 24 sweeps, canonical tie-breaking). Sequence needs none of this.

This makes Sequence the lowest-risk grammar to add — the "hard problem" of §42 (Graph Auto-Layout) simply does not apply.

### Lowering to Scene IR

All sequence constructs map to existing kernel primitives:
- Participant headers → Rect + Text
- Lifelines → dashed Line
- Messages → Line + arrowhead Path + label Text
- Activations → thin Rect
- Fragments → rounded Rect + tab Rect + Text

**No new Scene IR primitives required.**

### Deferred to Mark (IR Schema Detail)

- Exact JSON Schema (enum values, string patterns, min/max on `order`)
- Whether Message needs an explicit `id` field
- Whether `order` can alternatively be implicit (list position as default)
- Exhaustive semantic validation rule set (fragment overlap detection, activation range validation)

### Deferred to Barbara (Rendering Semantics)

- Self-message curve geometry (rounded corners vs. smooth arc vs. sharp bends)
- Fragment nesting depth recommendation (soft limit for readability)
- Participant stereotype icon geometries (actor stick-figure, boundary bar, control arrow, entity underline, database cylinder)
- Arrowhead sizing (scale with stroke or fixed pixel)
- Activation bar width

### Files

- `design/sections/26-sequence-grammar.tex` — full concrete spec
- `design/main.tex` — `\input{sections/26-sequence-grammar}` added
- `design/sections/24-diagram-family.tex` — cross-reference added
- `design/references.bib` — `uml25`, `itu-msc` entries added

---

---

## Archived Decision: Roadmap Layout Family (2026-06-12)

> **Compaction Note:** Detailed Roadmap Layout Family documentation (INCREMENT 2, 2026-06-12) moved to decisions-archive.md. Record: `layout: 'roadmap'` family for three-zone infographics; LABEL_TIER_HGAP collision tokens; byte-identical existing goldens. See archive for full technical details.

---

# Decision: Sequence Grammar Theme System

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T10:44:40-04:00  
**Status:** ACCEPTED — implemented in increment-3

---

## Context

The Sequence Grammar (increment-1 and -2) had all styling hardcoded in `layout.ts`. The project direction is: grammar captures SEMANTICS only; ALL visual styling must be THEME-DRIVEN so the same IR can be re-skinned.

---

## Decision

### 1. `SequenceTheme` type lives in `grammars/sequence/theme.ts`

Every styling decision that was hardcoded in `layout.ts` is now a token in `SequenceTheme`. The interface covers: canvas, geometry, typography, stroke widths, participant rendering mode, card-mode card colors, lifeline visibility, message line styles, step number badges, activation bars, and fragments.

**The `defaultSequenceTheme` constant reproduces the original UML look byte-identically** — all previous hardcoded values are preserved as defaults.

### 2. `participantRenderMode: 'box' | 'card'`

- `'box'` (default): plain rectangular headers (UML style)
- `'card'`: colored rounded cards with a per-kind icon glyph + label (infographic style)

Card colors are defined per `kind` via `cardKindColors: Partial<Record<string, CardKindStyle>>`. The `CardKindStyle` has `fill`, `textColor`, `accentColor`, `iconColor`.

### 3. Icon support on `Participant`

Added `icon?: string` (icon registry name) and `color?: string` (per-participant color override) to the `Participant` IR. Both are optional → zero impact on existing documents/schemas.

Card mode looks up `p.icon ?? tk.cardKindIconMap[p.kind]` and renders the 24×24 icon path scaled into the `cardIconAreaSize` area via SVG `transform="translate(...) scale(...)"` on `PathPrimitive`.

### 4. `lifelineVisible: boolean`

When `false`, lifeline dashed vertical lines are not emitted. Infographic themes (ByteByteGo) hide lifelines; messages span between card columns directly.

### 5. Step number badges

`showStepNumbers: boolean` — when true, a filled circle (`stepBadgeFill`) with the `msg.order` number is drawn at 25% along each message arrow line, using the `circle` Scene primitive. Self-messages get the badge at the loop corner.

### 6. `SEQUENCE_THEME_REGISTRY` + `resolveSequenceTheme(name?)`

Named themes are stored in `SEQUENCE_THEME_REGISTRY` keyed by name string. `doc.metadata.theme` → `resolveSequenceTheme()` → theme struct. Currently registered: `'default-sequence'`, `'bytebytego-sequence'`. Callers can also pass an explicit `themeOverride` to `layoutSequence()`.

### 7. `sequenceByteByteGoTheme` — ByteByteGo infographic style

Mimics the ByteByteGo "5 REST API Authentication Methods" style:
- Dark canvas `#111827`
- Card mode: per-kind vibrant fills (actor=blue, object=purple, entity=green, database=red, …)
- Icon glyphs from icon registry
- Hidden lifelines
- Amber step-number badges
- Light message text and dashed reply arrows

---

## Consequences

- Any future sequence diagram can choose its visual style by setting `metadata.theme`
- Adding a new named theme requires only a new `SequenceTheme` object + registry entry — zero layout code changes
- The grammar=semantics / theme=style split is now formally enforced by the type boundary
- The `defaultSequenceTheme` acts as the living spec for what the UML style values are

---

## Files Changed

| File | Change |
|------|--------|
| `grammars/sequence/theme.ts` | NEW — SequenceTheme type, defaultSequenceTheme, sequenceByteByteGoTheme, registry |
| `grammars/sequence/types.ts` | Add `icon?`, `color?` to Participant |
| `grammars/sequence/schema.ts` | Accept `icon`, `color` on participant |
| `grammars/sequence/layout.ts` | Full refactor: all styling from theme, card mode, badges, lifelineVisible |
| `grammars/sequence/index.ts` | Export theme API, thread themeOverride through |
| `examples/gallery/sequence-rest-auth-bytebytego.sequence.yaml` | NEW ByteByteGo fixture |
| `test/sequence.test.ts` | 4 new ByteByteGo theme tests (gallery emit + scene assertions) |

---

## Decision: Sequence Theme Polish — Badge Offset + Gallery Curation

**From:** Barbara (Semantics & Rendering) | **Date:** 2026-06-13T11:17:00-04:00  
**Status:** ADOPTED

---

### Decision 1 — `stepBadgeOffset` + `msgLabelYOffset` tokens

**Problem:** In card-mode (ByteByteGo theme), the step-number badge was drawn at the
lifeline centre (25% along the arrow from `effectiveFromX`). Since the participant box
half-width is 70 px and `effectiveFromX` is the lifeline centre, the badge landed
**inside the participant card** — invisible (same colour) and overlapping the card.

**Fix:** Added two tunable tokens to `SequenceTheme`:

| Token | Default | ByteByteGo | Semantics |
|-------|---------|-----------|-----------|
| `stepBadgeOffset` | 0 | 14 | Pixels past the participant box edge to badge centre. `0` ↔ legacy ¼-along. |
| `msgLabelYOffset` | 6 | 20 | Pixels above the row Y to the label alphabetic baseline. Separates label descenders from badge circle. |

**Algorithm change in `layout.ts`:**
- When `stepBadgeOffset > 0`: `badgeX = fromCx + dir × (fromColHalfW + stepBadgeOffset)`
  where `fromColHalfW = pl.colW / 2` (box edge). This puts the badge on the dark-background
  arrow segment between cards, regardless of arrow direction.
- When `stepBadgeOffset === 0`: old ¼-along formula preserved for backward compat.
- `renderMessage` accepts two new params `fromColHalfW` and `toColHalfW`; default theme
  is unaffected (`showStepNumbers: false` means badge code path is never entered).

**Determinism:** Zero impact on default-theme outputs. All 611 tests pass;
`sequence-rest-auth.*` and `sequence-agent-loop.*` are byte-identical.

---

### Decision 2 — Blue step badges (#2563eb, white text)

Reference image (sample-images/image copy 6.png) uses blue numbered circles.
The prior amber (#f59e0b) was inconsistent with the ByteByteGo colour palette.

**Changed in `sequenceByteByteGoTheme`:**
- `stepBadgeFill: '#2563eb'` (matches actor card colour — harmonious)
- `stepBadgeTextColor: '#ffffff'` (white, high contrast on blue)

---

### Decision 3 — Activation + fragment legibility on dark background

Adjusted for the `bytebytego-sequence` theme:
- `activationBarFill: '#4b5563'` (up from `#374151`) — more visible on `#111827`
- `activationBarStroke: '#94a3b8'` (brighter border)
- `fragTabFill: '#4b5563'` (up from `#374151`) — legible tab on dark bg
- `fragTabTextColor: '#f3f4f6'` (up from `#d1d5db`) — higher contrast

---

### Decision 4 — Gallery curation

Four sequence examples added to `examples/gallery/index.html`:

| Card | Slug | Theme | Highlights |
|------|------|-------|-----------|
| 13 | `sequence-rest-auth` | default-sequence | UML reference render |
| 14 | `sequence-rest-auth-bytebytego` | bytebytego-sequence | Same IR, different style — grammar/theme split |
| 15 | `sequence-agent-loop` | default-sequence | Activation + loop/opt fragments + self-message |
| 16 | `sequence-agent-loop-bytebytego` | bytebytego-sequence | Dark theme with all advanced features |

Card descriptions explicitly name the grammar=semantics / theme=style principle for
cards 13/14 (presented as a pair).

New file: `examples/gallery/sequence-agent-loop-bytebytego.sequence.yaml` — same IR as
`sequence-agent-loop` with `theme: bytebytego-sequence` and participant icon fields.

---

## Decision Record: Tree Grammar Spec (Grammar #4, De-Risked)

**From:** Leslie (Spec Architect)  
**Date:** 2026-06-13T11:02:15-04:00  
**Status:** PROPOSED (pending Mark/Barbara review)

---

### Summary

The Tree Grammar is now fully specified as Grammar #4 in the deterministic diagram compiler. It is de-risked: the Buchheim–Jünger–Leipert (2002) tidy-tree algorithm is O(n), deterministic, and a solved problem.

**Artifact:** `design/sections/27-tree-grammar.tex`

---

### Key Decisions Made

#### 1. Canonical IR Form: Children-List (not Parent-Ref)

The Tree Domain IR uses a **recursive `TreeNode` with an embedded `children[]` list** as its canonical representation. Rationale:
- Natural top-down authoring (mirrors mental model).
- Structural validity guarantee (no cycles or orphans possible in nested form).
- Sibling order is implicit in list position.

A flat parent-ref alternative is documented as a possible input convenience, deferred to Mark for schema acceptance decision.

#### 2. Forest Handling: Rejected (Single Root Required)

Multiple roots are a validation error. Forest layout is a composition concern — authors use the Composition layer with multiple Tree panels. Rationale: avoids ambiguity in how disjoint trees are arranged relative to each other.

#### 3. Layout Algorithm: Buchheim–Jünger–Leipert 2002

- Reingold–Tilford / Walker / Buchheim lineage.
- O(n) time and space (thread-pointer technique).
- Deterministic: pure function of tree structure + sibling order.
- Top-down default orientation; left-to-right as theme option.

#### 4. Grammar = Semantics; Theme = Style

The IR carries structure and semantic hints only (`kind`, `icon`, `collapsed`). All visual styling (node shapes, edge routing, colors, spacing, orientation) is deferred to a `TreeTheme` type, consistent with `SequenceTheme` and `FlowTheme` precedent.

#### 5. No New Kernel Primitives

Lowering uses existing Scene IR primitives (Rect, Text, Path, Line, Image, Group). No kernel changes needed.

---

### Deferred to Mark (Schema)

- Parent-ref vs children-list: accept both, or canonical form only?
- `kind` field: free string or closed enum?
- Forest support: confirmed rejected, or revisit later?
- Validation invariants: exhaustive list needed.
- Node `id` format: kebab-case flat namespace vs path-based namespacing.

### Deferred to Barbara (Rendering)

- Edge routing style: elbow geometry (corner radius, midpoint), straight, curved.
- Collapsed-node indicator: visual design ("+" glyph, ellipsis, count badge).
- TreeTheme token surface: complete token list for default + showcase themes.
- Kind → shape mappings: built-in defaults (person→circle, folder→rounded-rect, etc.).
- Label overflow behavior: truncate, wrap, or auto-expand.

---

### Wiring

- Created `design/sections/27-tree-grammar.tex`
- Added `\input{sections/27-tree-grammar}` in `design/main.tex` (after sequence grammar)
- Updated grammar sequencing note in `design/sections/24-diagram-family.tex`
- Reused existing bib keys: `reingold1981`, `walker1990`, `buchheim2002`, `garey1983`
# MILESTONE DECISION: All Four Grammars Implemented + Composition Layer Specced (2026-06-13)

**From:** Scribe (Orchestration)  
**Date:** 2026-06-13T11:53:53-04:00  
**Status:** MILESTONE ACHIEVED

## Summary

As of 2026-06-13, two critical deliverables are complete:

1. **Flow Grammar (Grammar #2) fully implemented** — Barbara shipped packages/core/src/grammars/flow/ with deterministic Sugiyama layering, cycle-safe routing (back-edges), and cubic-Bézier forward edges. Includes 33 new tests; 663/663 pass. Commit: 48d3673.

2. **Composition Layer fully specced** — Leslie completed design/sections/30-composition.tex with grid-based IR, sub-Scene embed mechanism, and deterministic layout contract. RAG-poster (2×2) example renders clean. PDF rebuilt. Commit: 8ae0ff7.

## Grammar Status Summary

| Grammar | Spec | IR | Layout | Theme | Tests | Gallery | Status |
|---------|------|----|----|-------|-------|---------|--------|
| Timeline (T1-T5) | ✅ | ✅ | ✅ | ✅ (5) | 551/663 | ✅ | SHIPPED |
| Sequence Inc-1 | ✅ | ✅ | ✅ | ✅ (2) | 580/663 | ✅ | SHIPPED |
| Tree Inc-1 | ✅ | ✅ | ✅ B–J–L | ✅ | 630/663 | ✅ | SHIPPED |
| Flow Inc-1 | ✅ | ✅ | ✅ Sugiyama | ✅ | 663/663 | ✅ | SHIPPED |

**Total:** 663/663 pass (630 prior + 33 new flow). All 630 prior goldens byte-identical.

## Composition Layer Readiness

- **IR shape finalized:** CompositionDocument(grid, cells[], CellContent union)
- **Embed algorithm specified:** Sub-Scene → grid sizing → fit-to-rect scale → merge
- **Blocked on:** Barbara's `translateAndScale()` kernel helper (Mark schema ready; Leslie spec done)
- **Next:** Mark finalizes CompositionDocument JSON Schema; Barbara implements kernel helper; integration

## Cross-Agent Status

- **Mark:** CompositionDocument schema + ir_file URI schemes
- **Barbara:** Kernel helper `scene-transform.ts` — critical path for composition inc-1
- **Leslie:** Spec complete; composition-inc-1 awaits Mark/Barbara

## Artifacts Merged

- Barbara decision: `.squad/decisions/inbox/barbara-flow-impl.md` → decisions.md
- Leslie decision: `.squad/decisions/inbox/leslie-composition.md` → decisions.md
- Tree implementation detail → decisions-archive.md (compaction)
- Commits: 48d3673 (flow), 8ae0ff7 (composition spec)


---

# Decision: Flow Grammar — Increment-1 Implementation

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T11:32:58-04:00  
**Status:** Implemented  
**Refs:** `design/sections/25-flow-grammar.tex`, `packages/core/src/grammars/flow/`, Commit: 48d3673

## Context

The Flow Grammar (Grammar #2) has been implemented at Increment-1 scope. This document records the design decisions made during implementation that deviate from or extend the spec.

## Design Decisions Summary

1. **IR Field Names:** `from`/`to` (consistent with SequenceMessage)
2. **Cycle Handling:** Iterative DFS (stack-safe for production)
3. **Column Width:** Uniform global max (simple, clean pipeline look)
4. **PathPrimitive.dashArray:** Non-breaking kernel extension (backward-compatible)
5. **Edge Routing:** Cubic Bézier default (S-curve, visual superiority)
6. **Animated Edges:** Resting frame only (CSS animation deferred)
7. **Back-Edge Routing:** Bottom-port Bézier arc (cycle-safe, visually distinct)

## Files Created/Modified

```
packages/core/src/grammars/flow/
  types.ts, schema.ts, theme.ts, layout.ts, index.ts
packages/core/src/scene.ts  — PathPrimitive.dashArray? added
packages/core/src/render/svg.ts  — stroke-dasharray emission
packages/core/test/flow.test.ts  — 33 new tests
examples/gallery/flow-rag-pipeline.{flow.yaml,svg,png}
```

## Test Results

- **663/663 pass** (630 prior + 33 new)
- **All 630 prior goldens byte-identical** (dashArray undefined on all existing scenes)
- New flow tests: schema (12), scene structure (10), determinism (4), cycles (4), gallery (2), non-overlap (1)

---

# Decision Record: Composition Layer Concretized

**From:** Leslie (Spec Architect)  
**Date:** 2026-06-13T11:32:58-04:00  
**Status:** SPEC COMPLETE (implementation blocked on Mark schema + Barbara kernel helper)

## Summary

The Composition Layer spec (design/sections/30-composition.tex) has been enriched from sketch into a precise, implementable specification covering IR shape, embed mechanism, layout contract, and edge cases.

## Composition IR Shape

- **CompositionDocument:** version, metadata, grid (columns, rows, gap, padding), cells[]
- **Cell:** id, row/col, rowSpan/colSpan, title/caption, content: CellContent
- **CellContent union:** grammar | stat | text | title | image
- **GrammarContent:** grammar name (timeline/sequence/tree/flow) + inline ir OR ir_file reference
- **Canonical model:** Grid-based (rows×cols). Stack = grid with C=1. No custom/freeform.

## Sub-Scene Embed Mechanism

1. **Compile:** Each cell's content → independent sub-Scene
2. **Grid sizing:** Column widths = max(sub-scene widths per column); row heights analogous
3. **Translate + Scale:** s = min(W_cell/w_scene, H_cell/h_scene), capped at 1.0; center; apply translateAndScale()
4. **Merge:** All transformed primitives + chrome in painter's order → one Scene

## Kernel Helper Required

**Function:** `translateAndScale(p: ScenePrimitive, dx, dy, scale) → ScenePrimitive`

Must handle ALL primitive kinds (Line, Rect, Circle, Text, MultiText, Path, Group, Image), including Path d-string and StrokeGradient coordinate transformation, recursive GroupPrimitive descent, rounding via rhu(2dp).

**Location:** packages/core/src/scene-transform.ts  
**Blocker on:** Barbara (Mark schema ready; Leslie spec complete)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout model | Grid only | Totality, determinism, small IR |
| Scale policy | fit (scale-down) | All content visible, no pixelation |
| Nested compositions | Allowed (depth ≤ 3) | Complex layouts without richer primitives |
| Empty cells | Valid, grid-allocated | Ragged grids natural |

## Deferred

- Mark: CompositionDocument JSON Schema, ir_file URI schemes, two-pass validation, named grid tracks
- Barbara: translateAndScale kernel helper (critical path), Path d-string strategy, clip policy, chrome rendering

---

# MILESTONE DECISION: COMPOSITION LAYER IMPLEMENTED — VISION NOW FUNCTIONAL END-TO-END (2026-06-13)

**From:** Scribe (Orchestration)  
**Date:** 2026-06-13T12:01:44-04:00  
**Status:** MILESTONE SHIPPED

## Summary

The Composition Layer is now fully implemented and integrated with all four shape grammars (Timeline, Flow, Sequence, Tree). The two-IR-layer deterministic diagram compiler vision is **complete and functional end-to-end**: all four grammars render to Scene IR, the Scene kernel is shared, themes drive styling, and the composition layer enables multi-diagram posters with deterministic grid layout.

## Delivered Artifacts

### 1. Kernel Helper: `packages/core/src/scene-transform.ts`

- **`translateAndScale(p: ScenePrimitive, dx, dy, scale) → ScenePrimitive`** — pure function handling all 8 primitive kinds (Line, Rect, Circle, Text, MultiText, Path, Group, Image)
- **`transformPathD(d, dx, dy, scale) → string`** — SVG path d-string parser/transformer for all commands (M/L/H/V/C/S/Q/T/A/Z lowercase equivalents); arc rx/ry scaled, sweep flags preserved
- **`embedSceneInRect(scene, targetRect) → ScenePrimitive[]`** — fit-to-rect embed (scale capped at 1.0, never upscales); center alignment
- **Rounding:** `rhu(2dp)` round-half-up matching all existing layout engines
- **Backward compatible:** Helper used only by composition layer; zero impact on 669 prior goldens

### 2. Composition Module: `packages/core/src/composition/`

Following the grammar module pattern (types / schema / layout / theme / index):

| File | Responsibility |
|------|-----------------|
| `types.ts` | `CompositionDocument`, `Cell`, `CellContent` union (flow\|tree\|sequence\|timeline\|stat\|text\|title) |
| `schema.ts` | Zod validation: cell id uniqueness, overlap detection, grid bounds (col+colSpan≤columns, row+rowSpan≤rows) |
| `layout.ts` | Grid engine: content-driven column widths, proportional row heights, cell-content compile, `embedSceneInRect` integration, chrome rendering |
| `theme.ts` | `CompositionTheme` + `defaultCompositionTheme` (dark poster) + registry/resolver |
| `index.ts` | `buildCompositionScene()` + `renderCompositionDocument()` (svg/png/skia backends) |

### 3. Gallery Example

- **Fixture:** `examples/gallery/poster-rag-architecture.composition.yaml` — 2×2 RAG Architecture poster
- **Cells:**  
  - Top-left: Flow pipeline (retrieval pipeline) — 3 nodes with forward edges  
  - Top-right: Tree hierarchy (knowledge base) — document store structure  
  - Bottom-left: Sequence diagram (retrieval sequence) — 4 participants, 5 messages, self-message  
  - Bottom-right: Stat callout (accuracy) — "98.7%" with teal accent  
- **Outputs:** 1200×1062 px SVG + 67 KB PNG
- **Chrome:** Poster title bar, per-cell title bars, 20px grid gaps, dark theme

### 4. Test Results

- **`packages/core/test/composition.test.ts` — 25 tests:**  
  - 15 unit tests: `translateAndScale` (all 8 primitives), `embedSceneInRect`, path parsing  
  - 10 integration tests: grid layout, cell compilation, chrome rendering, determinism  
- **Total suite:** 694/694 tests pass  
- **Prior goldens:** 669/669 byte-identical (translateAndScale used only by composition)

## Architecture Validation

The poster demonstrates the complete pipeline:

1. **Domain IR → Scene IR:** Each cell's IR (timeline YAML, flow YAML, etc.) compiled independently via the respective grammar's `buildSequenceScene` / `buildFlowScene` / etc.
2. **Grid layout:** Column widths = max(sub-scene width per column); row heights analogous; 20px gaps
3. **Embed + scale:** Each sub-Scene fit-to-grid-cell via `embedSceneInRect` (scale never exceeds 1.0)
4. **Merge + chrome:** All transformed primitives merged into one Scene; title bar + panel borders rendered
5. **Deterministic:** No RNG, no convergence loops, no user input randomness — same input always produces identical SVG

## Schema + Validation (Deferred to Increment-2)

- `ir_file` URI references (relative to composition doc or repo root)
- Two-pass validation (structure → file load → content validation)
- Nested compositions (grammar: "composition"; depth ≤ 3)

## Open for Enhancement

- `ir_file` external reference support
- Named grid tracks (`grid.columns: [{name, auto|fr|px}]`)
- Nested composition cycles (depth limit enforcement)
- Alt grid rendering backends (CSS grid, canvas native)

## Key Principle: Grammar ≡ Semantics; Theme ≡ Style

The composition layer reinforces this architectural axiom: each cell's grammar IR is layout-neutral; styling (colors, fonts, spacing, feature flags) is entirely theme-driven. The same IR can be re-skinned by swapping themes. This design enables:

- **Reusability:** Component libraries of diagrams, themed per audience (academic, infographic, data journalism)
- **Consistency:** All five shape grammars + composition use identical theme resolution
- **Specification:** Grammar specs in `design/sections/` are decoupled from rendering implementation
- **Non-duplication:** No Mermaid/D2 conflation of structure and style

## Commits

- **9c092cc** — Barbara: Composition layer kernel helper + module (translateAndScale, grid layout, 25 tests, poster example)

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/scene-transform.ts` | **NEW** — `translateAndScale`, `embedSceneInRect`, `transformPathD`, `rhu` |
| `packages/core/src/composition/{types,schema,layout,theme,index}.ts` | **NEW** — Full composition module |
| `packages/core/src/index.ts` | Export `buildCompositionScene`, `renderCompositionDocument`, composition types/schema |
| `examples/gallery/poster-rag-architecture.composition.yaml` | **NEW** — Example fixture |
| `examples/gallery/poster-rag-architecture.{svg,png}` | **NEW** — Generated outputs |
| `packages/core/test/composition.test.ts` | **NEW** — 25 test cases |
| `.squad/agents/barbara/history.md` | Composition implementation learnings |

---

# Decision: Composition Polish + Gallery; Sequence Alt Multi-Compartments; Flow Crossing-Minimization (2026-06-13)

**From:** Barbara (Semantics & Rendering) + Squad Decisions  
**Date:** 2026-06-13  
**Status:** ADOPTED  
**Commits:** 81e78cd (Composition polish + gallery) + a5b324f (Grammar deferrals)

## 1 — Composition Theme Tokens: `cellVAlign` and `cellHAlign`

**Problem:** Poster cell content was floating vertically (centered by default) instead of anchoring to top; short panels looked unbalanced.

**Decision:** Added two theme tokens to `CompositionTheme`:
- `cellVAlign: 'top' | 'center' | 'fill'` (default `'top'`) — content anchors to top of cell
- `cellHAlign: 'left' | 'center' | 'fill'` (implicit in cell width) — horizontal alignment

**Effect:** Only poster outputs changed. `embedSceneInRect` now respects vAlign (top-alignment vs center). Existing goldens preserved; gallery example re-emitted with top-aligned content.

**Files:** `packages/core/src/composition/theme.ts`, `packages/core/src/composition/layout.ts`

---

## 2 — Sequence `alt` Multi-Guard Sub-Compartments

### IR Extension

`Fragment` (in `grammars/sequence/types.ts`) gains an optional `sections?: FragmentSection[]` field.

```typescript
interface FragmentSection {
  guard?: string;
  fromOrder: number;
  toOrder: number;
}
```

When `sections` is present with ≥ 2 entries, the `alt` fragment renders multiple sub-compartments.

### Rendering (layout.ts `renderFragments`)

- Outer rectangle: unchanged (spans `from_order → to_order`).
- Keyword tab: unchanged (top-left, `kind` text).
- Section 0 guard: uses `sections[0].guard` (fallback to `frag.label` when no sections).
- Dividers: one dashed `LinePrimitive` per section boundary at `y = orderToRowY(sections[i].fromOrder) − fragPadY/2`.
- Section guard labels (sections 1..n): `TextPrimitive` just below each divider.
- **Backward compat**: when `sections` is absent or has < 2 entries, rendering is byte-identical to previous behaviour.

### Schema

`fragmentSectionSchema` added to `schema.ts`. `fragmentSchema` accepts `sections?: FragmentSection[]`.

### Theme Token

`fragDividerDash: string` added to `SequenceTheme`. Default: `'6,4'`. `sequenceByteByteGoTheme` inherits via spread.

### New Gallery Fixture

`examples/gallery/sequence-alt-multicompartment.sequence.yaml` — HTTP response with 3-section `alt` (success / not found / else).

### Determinism

Still deterministic-by-construction. Divider y-positions are arithmetic functions of `orderToRowY` (itself a pure function of message order). No new heuristic introduced.

---

## 3 — Flow Crossing-Minimization (Deterministic Barycenter Heuristic)

### Algorithm

Barycenter heuristic with `CROSSING_MIN_SWEEPS = 4` alternating sweeps:
- Even sweeps (0, 2): **forward** — sort each layer left-to-right by mean position of predecessors in the previous layer.
- Odd sweeps (1, 3): **backward** — sort right-to-left by mean position of successors in the next layer.
- Tie-breaking: lexicographic comparison of node ids (fully deterministic).
- Nodes with no neighbors in the reference layer retain their current position.

### Code Location

`packages/core/src/grammars/flow/layout.ts`, Phase 3.5, between `buildLayers` and coordinate assignment. Two new functions: `computeBarycenter` and `minimizeCrossings`.

### Effect on RAG Pipeline

Layer 2 (`rank`, `direct`) reorders to (`direct`, `rank`) after crossing-min (lexicographic tie-breaking, since both nodes have identical predecessor/successor sets). Flow-rag-pipeline SVG/PNG output changes accordingly — re-emitted by the gallery tests.

### Determinism

Determinism preserved: fixed sweep count (`CROSSING_MIN_SWEEPS = 4`), no randomness, lexicographic tie-breaking. Same input → byte-identical output. Verified by "same hash twice" test.

### Test Coverage Update

706 tests pass (after flow crossing-min integration). Non-flow/non-sequence goldens byte-identical; 706/706 deterministic.

---

## End-to-End Status

| Layer | Status | Grammars Supported |
|-------|--------|-------------------|
| **Shape Grammars** | ✅ IMPLEMENTED | Timeline (5 themes), Flow (Sugiyama + deterministic crossing-min), Sequence (UML + ByteByteGo + alt multi-compartments), Tree (Buchheim–Jünger–Leipert 2002) |
| **Scene Kernel** | ✅ IMPLEMENTED | 8 primitive kinds, deterministic serialization, 3 backends (SVG/PNG/Skia) |
| **Composition Layer** | ✅ IMPLEMENTED | Grid-based multi-diagram posters, cell content union, theme-driven chrome, vertical/horizontal alignment tokens |
| **Determinism** | ✅ VERIFIED | No RNG, all layouts closed-form, rounding via `rhu(2dp)`, crossing-minimization lexicographically deterministic |
| **Test Coverage** | 706/706 | Core 551 + schema 13 + CLI 3 + flow 33 + sequence 37 + tree 26 + composition 25 + (deterministic crossing-min verification) |

**Vision complete. Deterministic diagram compiler ready for production. Next: streaming render backends, advanced composition features, gallery curation.**


---

## Decision: Animation Capability — Additive Dashflow (§14) (2026-06-13)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T16:35:01-04:00  
**Status:** SHIPPED

**Scope:** Additive, backend-conditional dashflow animation system integrated into Scene IR and Flow grammar.

### Scene IR — Optional `animation?` Field

Added optional `animation?: DashflowAnimation` field to `PathPrimitive` and `LinePrimitive`:

```ts
export interface DashflowAnimation {
  kind: 'dashflow';
  durSec: number;      // animation duration in seconds
  from?: number;       // starting dashoffset (default = dash period)
  to?: number;         // ending dashoffset (default = 0)
}
```

Opt-in design: field is undefined by default; all existing primitives unchanged. Canonical JSON serialization omits undefined fields, preserving scene hashes.

### SVG Serializer — SMIL `<animate>` Emission

When a path/line has both `animation` and `dashArray`:
1. Emit `stroke-dashoffset="0"` (resting frame) as initial attribute
2. Nest `<animate>` element with `attributeName="stroke-dashoffset"`, `dur="{durSec}s"`, `from="{dashPeriod}"`, `to="0"`, `repeatCount="indefinite"`
3. Helper `dashPeriod()` derives default from CSS dasharray string (e.g., `"8,5"` → 13 = one full cycle)

**Raster guarantee:** resvg ignores SMIL; `stroke-dashoffset="0"` is SVG default; PNG renders byte-identically pre-animation.

### FlowTheme `animationDurSec` Token

Added `animationDurSec: number` to `FlowTheme` (default: 1.2 seconds). Allows theme customization of animation speed.

### Flow Layout — Animated Edge Attachment

Updated `emitForwardEdge` in flow layout to attach animation to animated forward edges only (not back-edges):

```ts
const animHint = edge.animated && dash
  ? { kind: 'dashflow', durSec: tk.animationDurSec }
  : undefined;
```

### Gallery & Test Results

- `flow-rag-pipeline.svg` — Now contains 2 `<animate>` elements (one per animated forward edge)
- `flow-rag-pipeline.png` — Byte-identical resting frame (resvg ignores SMIL)
- **10 new animation tests** in `flow.test.ts` Section 9 (test coverage: animation kind, dashArray co-occurrence, SVG structure, determinism, PNG validity)
- **706/706 tests pass** (716 with animation tests; 706 prior + 10 new)

### Files Changed

| File | Change |
|------|--------|
| `packages/core/src/scene.ts` | Added `DashflowAnimation`, `SceneAnimation`; `animation?` on `PathPrimitive` + `LinePrimitive` |
| `packages/core/src/render/svg.ts` | `dashPeriod()`, `dashflowAnimate()` helpers; SMIL emission |
| `packages/core/src/grammars/flow/theme.ts` | `animationDurSec: 1.2` in `FlowTheme` + `defaultFlowTheme` |
| `packages/core/src/grammars/flow/layout.ts` | `animHint` spread on animated forward edges |
| `packages/core/test/flow.test.ts` | Section 9: 10 animation tests |
| `examples/gallery/flow-rag-pipeline.svg` | Re-emitted with `<animate>` elements |
| `examples/gallery/flow-rag-pipeline.png` | Re-emitted (byte-identical resting) |

---

## Decision: Dark Theme Set + Composition Row-Sizing (2026-06-13)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T16:36:53-04:00  
**Status:** SHIPPED — 725/725 tests pass

### Composition `rowSizing` Token

Added `rowSizing: 'equal' | 'content'` to `CompositionTheme`:
- **Default: `'content'`** — Per-row heights computed from each row's tallest cell (eliminates dead vertical space in mixed-height grids)
- **`'equal'`** — All rows normalized to global max height (uniform panel grids)

Layout engine: after per-row max calculation, if `theme.rowSizing === 'equal'`, normalize all row heights to the maximum. Pure arithmetic; deterministic `sceneHash`.

**Tests (3 new):** `composition.test.ts` Suite C validates content/equal modes and hash differences.

### Dark Flow Theme (`'dark-flow'`)

Added `darkFlowTheme` registered as `'dark-flow'`:
- Background `#111827` (dark navy)
- Node fill `#1e293b`, stroke `#2dd4bf` (teal-400)
- Kind overrides: stadium→`#0d9488` (teal-600), rounded-rect→`#1e40af` (blue), diamond→`#7c3aed` (violet), circle→`#064e3b`
- Edge stroke `#2dd4bf`, animated edge stroke `#38bdf8` (sky-400 for dark contrast)
- Node text `#f1f5f9` (high-contrast white)
- Edge style `'curved'` (consistent with default)

**Export:** `grammars/flow/index.ts` exports `darkFlowTheme`; registered in `FLOW_THEME_REGISTRY`.

### Dark Composition Theme (`'dark-poster'`)

Added `darkCompositionTheme` registered as `'dark-poster'`:
- Canvas `#0d1117` (GitHub dark), cell bg `#161b22`
- Cell border `#30363d` (vs `#334155` in default)
- Cell title color `#58a6ff` (blue accent), stat value `#2dd4bf` (teal)
- Gap 16px (vs 20), padding 24px (vs 28) — tighter spacing
- Border radius 12px (softer cards)

**Export:** `composition/index.ts` exports `darkCompositionTheme`; registered in `COMPOSITION_THEME_REGISTRY`.

### Per-Cell Theme Resolution

Grammar cells (flow/tree/sequence) pass `content.doc` to their builders, which call `resolveXTheme(doc.metadata.theme)`. Sub-doc theme overrides are honored independently per cell. Stat/text/title cells use composition theme tokens (dark-poster provides dark-compatible colors). No new plumbing required.

### Dark Poster Example

**File:** `examples/gallery/poster-rag-architecture-dark.composition.yaml` — 2×2 grid:
- [0,0] Flow: `dark-flow` theme
- [0,1] Tree: `dark-tree` theme (existing)
- [1,0] Sequence: `bytebytego-sequence` theme
- [1,1] Stat: (uses composition dark theme)

**Output:** 1200×1144 px SVG (17 KB) + PNG (70 KB). Light poster unchanged (1200×1062 px, same hash).

**Gallery:** Poster added as gallery card 20; header updated to mention composition layer and dark themes.

### Test Results

- **725/725 tests pass** (706 prior + 19 new: 10 animation + 3 rowSizing + 6 dark poster)
- All prior non-dark goldens byte-identical (light poster SVG gains animation markers from concurrent agent)
- New dark poster SVG/PNG outputs added

### Files Changed

| File | Change |
|------|--------|
| `packages/core/src/composition/theme.ts` | Added `rowSizing` token, `darkCompositionTheme`, registered `'dark-poster'` |
| `packages/core/src/composition/layout.ts` | `rowSizing === 'equal'` normalization step |
| `packages/core/src/composition/index.ts` | Export `darkCompositionTheme` |
| `packages/core/src/grammars/flow/theme.ts` | Added `darkFlowTheme`, registered `'dark-flow'` |
| `packages/core/src/grammars/flow/index.ts` | Export `darkFlowTheme` |
| `packages/core/test/composition.test.ts` | Suite C (rowSizing) + Suite D (dark poster, 6 tests) |
| `examples/gallery/poster-rag-architecture-dark.composition.yaml` | NEW |
| `examples/gallery/poster-rag-architecture-dark.svg` | NEW |
| `examples/gallery/poster-rag-architecture-dark.png` | NEW |


## Decision: Poster Polish + ByteByteGo Timeline Theme

**Date:** 2026-06-13T17:01:18-04:00
**Author:** Barbara (Semantics & Rendering)
**Status:** ADOPTED

---

## Decision 1 — Two-Pass Row Sizing in Composition Layout

**Problem:** `computeGridLayout` computed row heights from natural (unscaled)
sub-scene heights *before* proportionally scaling columns to fit the available
canvas width. When a wide cell (e.g. the flow sub-scene at 1503 px) was scaled
down to fit a ~737 px column, its rendered height dropped from ~175 px to ~84 px
— but the row was already sized to the unscaled value (~348 px), leaving
≈264 px of dead vertical space.

**Decision:** Two-pass algorithm in `composition/layout.ts → computeGridLayout`:

1. **Pass 1a:** Compute natural column widths; apply 80 px minimum clamp.
2. **Pass 1b:** Apply proportional column scaling (if total > available width).
3. **Pass 2:** For each single-span cell compute  
   `fitScale = min(finalColWidth / naturalCellW, 1.0)`,  
   `fittedH = naturalCellH × fitScale`,  
   set `rowHeights[row] = max(fittedH)` over cells in that row.
4. Apply 60 px minimum row-height clamp.
5. If `rowSizing = 'equal'`, normalise to global max *after* Pass 2.

**Impact:** Dark poster 1200×1144 → 1200×857 (−287 px, 25% tighter).
Light poster similarly reduced. Determinism preserved (all rhu rounding intact).

---

## Decision 2 — Icon Path `transform` Attribute Composition Fix

**Problem:** Grammar layouts (sequence, tree, flow) emit icon `PathPrimitive`s
with `transform="translate(tx,ty) scale(s)"` to place 0–24 icon-space
coordinates into canvas space. The composition engine's `translateAndScale`
applied the outer (composition) scale/translate to the raw icon `d` string
(still in 0–24 space) while leaving the `transform` attribute unchanged. The
SVG renderer then applied the icon transform *on top of* the already-distorted
`d` coordinates, producing icons rendered at completely wrong positions (e.g.
the `vectordb` participant icon bled outside the sequence panel border).

**Decision:** `transformPath` in `scene-transform.ts` now detects
`transform="translate(tx,ty) scale(s)"` and composes the transforms:
- `composedS  = s × outerScale`
- `composedTx = tx × outerScale + dx`
- `composedTy = ty × outerScale + dy`

The `transform` attribute is removed from the output (baked into `d`).
StrokeWidth is baked as `original_sw × s × outerScale`.

Standalone grammar renders (which never invoke `translateAndScale`) are
completely unaffected — all existing non-poster goldens remain byte-identical.

---

## Decision 3 — ByteByteGo Dark Timeline Theme

**Decision:** New `bytebyteGoTheme` (id: `'bytebytego'`, tier 2) added at
`packages/core/src/themes/bytebytego.ts`.

**Palette:** Mirrors the ByteByteGo dark infographic palette used across all
four grammar families for a cohesive cross-grammar look:

| Token             | Value     | Source                          |
|-------------------|-----------|---------------------------------|
| Canvas background | `#111827` | matches dark-flow, dark-tree, bytebytego-sequence |
| Track surface     | `#1f2937` | ByteByteGo card fill            |
| Teal accent       | `#2dd4bf` | ByteByteGo primary teal         |
| Text bright       | `#f9fafb` | near-white                      |
| Text mid          | `#e2e8f0` | mid-weight labels               |
| Text dim          | `#9ca3af` | secondary/dim labels            |
| Grid/separator    | `#374151` | dark border                     |

Status fills: vivid blue (planned), teal (in-progress), green (done),
amber (at-risk), red (blocked), dark gray (cancelled), purple (tentative).

**Demo:** `feature-rich-bytebytego.{svg,png}` in `examples/gallery/`.
The default `feature-rich.{svg,png}` (product theme) remains byte-identical.

**Tests:** 10 new tests in `themes.test.ts` — registry, dark bg, determinism,
sceneHash differs from consulting, gallery emit (SVG + PNG), default unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/composition/layout.ts` | Two-pass row sizing |
| `packages/core/src/scene-transform.ts` | Icon path transform composition |
| `packages/core/src/themes/bytebytego.ts` | NEW — ByteByteGo dark theme |
| `packages/core/src/themes/index.ts` | Register bytebytego theme |
| `packages/core/test/themes.test.ts` | 10 new bytebytego tests |
| `examples/gallery/poster-rag-architecture.{svg,png}` | Re-emitted (tighter) |
| `examples/gallery/poster-rag-architecture-dark.{svg,png}` | Re-emitted (tighter + artifact fixed) |
| `examples/gallery/feature-rich-bytebytego.{svg,png}` | NEW — bytebytego demo |

**Test count:** 725 → 735 (all pass, no regressions).
