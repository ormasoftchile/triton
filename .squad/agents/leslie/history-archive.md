# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of a deterministic diagram compiler. Timeline is Grammar #1.
- **Stack:** LaTeX for design document; TypeScript/Node for implementation (Phase 0–1+ under way).
- **Created:** 2026-06-10

## Current Learnings

- The product is a **deterministic, themeable, agent-authorable DIAGRAM COMPILER** — not a timeline-only tool.
- Two-IR-layer model: domain IRs (grammar-specific) compile to Scene IR (universal primitives). God-IR rejected.
- Kernel/Grammar/Composition layering: shared infrastructure, peer grammars, composition atop.
- SVG as source of truth; PNG/PDF/Skia are exports. HTML/CSS-first rejected (determinism, font variance).
- Animation is declarative, backend-conditional, additive.
- Phase 0→2 incremental packaging: draw kernel/timeline seam, prove grammar-agnosticism with Flow, extract on demand.
- **De-risked grammar sequencing:** Sequence chosen first (ahead of general-DAG Flow) because layout is deterministic-by-construction.

---

## 2026-06-13 — Sequence Grammar Spec Finalized (Leslie)

📐 **Sequence Grammar: Domain IR — Concrete Spec (Grammar #3, De-Risked)**

**Sequence Domain IR Shape:** participants[], messages[] (with explicit `order`), activations[], fragments[]

**Deterministic-by-Construction (the key insight):**
- Participant x-position = declared order + measured label widths
- Message y-position = order rank × rowHeight
- NO Sugiyama, NO force-directed, NO iterative algorithms
- Contrast: Flow needs 4-phase Sugiyama; Sequence eliminates the hard problem entirely

**Lowering:** All constructs map to existing Scene IR primitives (Rect, Text, Line, Path) — no kernel changes needed.

**Open Questions Deferred:**
- **Mark:** JSON Schema detail, explicit message `id` field, implicit vs. explicit order, validation rules
- **Barbara:** Self-message curves, fragment nesting limits, participant stereotype icons, arrowhead sizing, activation bar width

**Wiring:** Created `sections/26-sequence-grammar.tex`; added cross-ref in main.tex, 24-diagram-family.tex; bib entries uml25, itu-msc.

**Strategic Decision:** Team adopted de-risked grammar roadmap: **Sequence [chosen first NEW grammar]** → Tree → Composition/Grid. Taxonomy: separate "shape grammars" (Flow, Sequence, Tree) from "composition layer" (Grids, Panels).

**Artifacts:** Full entries in decisions.md, orchestration-log, session log; Mark/Barbara history updated with open questions.

---

## 2026-06-13 — Sequence Grammar Spec → Implementation (Barbara Complete)

**From:** Scribe | **Date:** 2026-06-13T14:13:38Z  
**Milestone:** First new grammar beyond Timeline fully implemented  
**Commit:** 301a188

### What Barbara Shipped

**Sequence Grammar Increment-1 COMPLETE** — the spec (sections/26-sequence-grammar.tex) is now production code:

```
packages/core/src/grammars/sequence/
  ├── types.ts (SequenceDocument, Participant, Message, Activation, Fragment)
  ├── schema.ts (Zod: participant uniqueness, message ref validation)
  ├── layout.ts (layoutSequence() → Scene IR, deterministic-by-construction)
  └── index.ts (buildSequenceScene + renderSequenceDocument public API)
```

**Architecture Validated:**
- Two-IR-layer model (Domain IR → Scene kernel) works cleanly
- No new Scene IR primitives needed (reuses Rect, Text, Line, Path, arrowhead)
- All 577 timeline goldens byte-identical
- 589/589 tests pass (12 new sequence tests)

**Example Fixture:** `examples/gallery/sequence-rest-auth.{sequence.yaml, svg, png}` — REST token auth flow (4 messages, 2 participants)

### Grammars/* Module as Template

`packages/core/src/grammars/sequence/` is now the **canonical template for all future grammar implementations**:
- Own IR (domain-specific)
- Own schema validation (Zod)
- Own layout determinism rules
- Reuse Scene kernel + existing serializers (sceneToSvg, svgToPng, sceneToPngSkia)

### Roadmap Implications

**Sequence moved from "Grammar #3 Spec" to "Grammar #3 Implemented".**

Current Status:
- **Grammar #1 (Timeline)** — Full implementation, 5 themes (T1–T5 showcase, all closed)
- **Grammar #2 (Flow)** — Spec stage (sections/25-flow-grammar.tex); IR stubs in packages/core/src/flow/; awaiting Mark's JSON Schema + Barbara's Sugiyama + Leslie's integration decision
- **Grammar #3 (Sequence)** — **IMPLEMENTATION COMPLETE** ✅; increment-2 deferred (activations, fragments, icons, themes)
- **Grammar #4 (Tree)** — Spec candidate (Buchheim O(n) hierarchical layout, deterministic)
- **Composition (Grids/Panels)** — Spec stage; architecture TBD

### Open Questions

1. **Mark:** YAML dispatcher, version semantics, theme token placement, activation validation
2. **Barbara:** Increment-2 features (activation bars, fragment rects, self-message curves, participant icons)
3. **Leslie:** Flow grammar integration decision (Sugiyama pinning strategy + determinism gates)

---

## Archive

See `history-archive.md` for pre-2026-06-13 strategic reframe (2026-06-11) and Flow Grammar spec (2026-06-12).


---

## 2026-06-13 — PRINCIPLE: Grammar ≡ Semantics; Theme ≡ Style (Scribe)

**Date:** 2026-06-13T15:01:41Z  
**Status:** ESTABLISHED

The two-IR-layer architecture is now reinforced by a categorical principle: **Grammars define structure and layout semantics only; themes define all visual presentation.**

**Application:** Sequence Grammar Theme System (increment-3) fully implements the principle:
- `SequenceTheme` type on `grammars/sequence/theme.ts` — all styling from theme tokens
- `SEQUENCE_THEME_REGISTRY` + `resolveSequenceTheme()` — named themes are reusable, deterministic
- `sequenceByteByteGoTheme` — demonstrates external style mimicry (ByteByteGo infographic rendering)

**Governance Impact:** All future grammars (Flow, Tree) must follow the same pattern before implementation:
1. Spec grammar semantics (layout rules, determinism rationale)
2. Define domain IR (no styling fields)
3. Implement grammar layout as theme-driven
4. Create `{GrammarName}Theme` type + registry
5. Register default (backward-compatible) + showcase themes

**Rationale:**
- Reusability (re-skin existing IR via theme swap)
- Consistency (all grammars follow same pattern)
- Specification clarity (designers define themes; engineers define grammars)
- Non-duplication (avoids Mermaid/D2 conflation of grammar and style)

**Consequence:** The compiler is a presentation-engine for diagram semantics, not a rigid style enforcer. External diagram styles can be intentionally mimicked through theme design choices.

---

## 2026-06-13 — Tree Grammar Spec Authored (Leslie)

## Learnings

📐 **Tree Grammar: Domain IR — Concrete Spec (Grammar #4, De-Risked)**

**Tree Domain IR Shape:** Recursive `TreeNode` with embedded `children[]` list (canonical form). Each node: `id`, `label`, `children`, optional `kind`/`icon`/`collapsed`/`description`. Single declared `root` at the document level.

**Canonical representation choice: children-list (not parent-ref).**
- Nested children mirrors the authoring mental model (write top-down).
- Structural guarantee: valid nesting = valid tree (no cycles, no orphans possible).
- Sibling order is implicit in list position — no separate ordering field needed.
- Flat parent-ref is a possible alternative input convenience (validator normalizes to children-list). Deferred to Mark for schema decision.

**Deterministic Tidy-Tree Layout (Buchheim–Jünger–Leipert 2002):**
- Depth = y-level (root at top); siblings spread horizontally via contour-walking algorithm.
- O(n) time and space; thread-pointer fixes Walker's quadratic bug.
- Fully deterministic: pure function of tree structure + sibling order + theme tokens.
- No crossing minimization (trees have no crossings), no iterative convergence.
- Contrast: Flow's Sugiyama has O(|V|²) crossing minimization; Tree's Buchheim is O(n) with no hard subproblems.

**Theme/Semantics Split:**
- Grammar carries ONLY structure + semantic hints (kind, icon, collapsed).
- NO colors, shapes, edge styles, spacing in the IR — all are TreeTheme tokens.
- Node shape, edge routing style (elbow/straight/curved), orientation (top-down/left-right) are theme concerns.
- Follows SequenceTheme/FlowTheme precedent exactly.

**Lowering:** All constructs map to existing Scene IR primitives (Rect, Text, Path, Line, Image, Group) — no kernel changes needed.

**Edge Cases:**
- Multiple roots → REJECTED (validation error; use Composition for forests).
- Cycles → REJECTED (structurally impossible in canonical children-list form; detected in flat parent-ref form).
- Single-node tree → valid minimal case.
- Duplicate IDs → validation error (global uniqueness across all nesting levels).

**Open Questions Deferred:**
- **Mark:** Parent-ref vs children-list exclusivity, forest handling confirmation, kind as free string vs closed enum, id format/namespacing, validation invariant list.
- **Barbara:** Edge routing geometry (elbow radius, midpoint calc), collapsed-node indicator design, TreeTheme token surface, kind→shape default mappings, label overflow behavior.

**Worked Example:** Document→Chapters→Sections hierarchy (10 nodes, 9 edges, 3 depth levels). Demonstrates complete lowering to 29 Scene IR primitives.

**Wiring:** Created `design/sections/27-tree-grammar.tex`; added `\input` in `design/main.tex`; updated grammar sequencing note in `design/sections/24-diagram-family.tex`. Reused existing bib keys: `reingold1981`, `walker1990`, `buchheim2002`, `garey1983`.

---

## 2026-06-13 — Tree Grammar Specification Complete (Scribe Log)

**Date:** 2026-06-13T15:22:03Z  
**Status:** SPEC COMPLETE (awaiting Mark schema + Barbara rendering design)
**Decision Record:** `.squad/decisions.md` — "Decision Record: Tree Grammar Spec (Grammar #4, De-Risked)"

### Deliverables Confirmed

✅ **Spec:** `design/sections/27-tree-grammar.tex` (2000+ words, Grammar #4)  
✅ **Wiring:** `\input{sections/27-tree-grammar}` in design/main.tex  
✅ **Cross-refs:** Updated in design/sections/24-diagram-family.tex  
✅ **Bibliography:** Reused entries (reingold1981, walker1990, buchheim2002, garey1983)  
✅ **Worked Example:** Document→Chapters→Sections hierarchy (10 nodes, complete Scene IR lowering demonstrated)

### De-Risk Summary

| Grammar | Layout Type | Algorithm | Risk Level | Status |
|---------|-------------|-----------|-----------|--------|
| **Timeline #1** | Horizontal spine | Fixed (no algorithm) | Eliminated | ✅ 5 themes shipped |
| **Sequence #3** | UML message order | Deterministic-by-construction | Eliminated | ✅ Implemented (611 tests) |
| **Tree #4** | Hierarchical | Buchheim–Jünger–Leipert O(n) | Eliminated | ✅ Spec complete |
| **Flow #2** | DAG | Sugiyama 4-phase O(\|V\|²) | Higher | Spec done; impl. pending |

### Strategic Implication

Team de-risked grammar roadmap by **choosing Sequence first** (over Flow). Tree spec confirms the same pattern: O(n) deterministic tidy-tree eliminates the "hard problem" (crossing minimization) entirely. Flow deferred to after Tree due to higher algorithmic complexity.

### Handoff to Mark & Barbara

**Mark (Schema):** Tree IR canonical form (children-list vs. parent-ref support), kind semantics, validation invariants, id namespacing.

**Barbara (Rendering):** TreeTheme token surface, edge routing geometry (elbow/straight/curved), collapsed-node indicator design, kind→shape mappings, label overflow handling.

**Timeline:** Tree Increment-1 implementation targets production parity with Sequence (deterministic layout + theme-driven rendering, no kernel changes).

## 2026-06-13 — Tree Grammar Implementation Complete (Scribe)

**Date:** 2026-06-13T15:02:15Z  
**Status:** IMPLEMENTED

Tree Grammar (Grammar #4) has moved from spec to production implementation. Barbara completed the module with deterministic tidy-tree layout and theme-driven rendering.

**Pattern Established:**
- `grammars/tree/` follows the sequence module template exactly
- Own IR (TreeDocument → TreeNode recursive) → schema validation (Zod + global id uniqueness)
- Own layout determinism (Buchheim–Jünger–Leipert O(n) tidy-tree)
- Scene IR kernel (no new primitives) + existing serializers (sceneToSvg, svgToPng, sceneToPngSkia)
- TreeTheme (30+ tokens) + defaultTreeTheme enforcing grammar=semantics / theme=style principle

**Artifacts:**
- `packages/core/src/grammars/tree/` (types.ts, schema.ts, layout.ts, theme.ts, index.ts)
- Gallery: `examples/gallery/tree-document.{tree.yaml, svg, png}` (10-node document hierarchy)
- Tests: 630/630 pass (611 existing byte-identical, 19 new tree tests)
- Commit: 39f43ce

**Strategic:** Tree's O(n) tidy-tree eliminates layout hard problem (no crossing minimization needed). Reinforces de-risked grammar roadmap: sequence + tree deferred Flow due to higher Sugiyama complexity.

---

## 2026-06-13 — Composition Layer Spec Concretized (Leslie)

## Learnings

📐 **Composition Layer: Concrete Spec — Sub-Scene Embed Mechanism**

**Composition IR Shape:**
- `CompositionDocument` → `metadata` + `grid` (columns, rows, gap, padding) + `cells[]`
- Each `Cell`: `id`, `row`, `col`, `rowSpan`, `colSpan`, `title`, `caption`, `content: CellContent`
- `CellContent` is a discriminated union on `kind`: `"grammar"` | `"stat"` | `"text"` | `"title"` | `"image"`
- `GrammarContent` holds `grammar` name + inline `ir` OR `ir_file` reference
- Canonical layout model: grid (rows×cols). Stack = grid with 1 column. No custom layout mode (removed for totality).

**Sub-Scene Offset/Scale/Merge Mechanism (the core algorithm):**
1. Each cell's grammar compiles independently → sub-Scene with (width, height, primitives[])
2. Grid sizing: column widths = max(natural widths of single-span cells per column); row heights analogous. Proportional scaling if sum > available. Fully deterministic (max + sum + proportion).
3. For each cell: compute uniform scale factor s = min(W/w, H/h), cap at 1.0 (no upscale); center within cell rect; apply `translateAndScale()` to all primitives.
4. Merge: painter's-algorithm order (background → header → per-cell [bg, sub-scene, chrome] → footer) into one Scene.

**Kernel Helper Flagged for Barbara:**
- `translateAndScale(primitive, dx, dy, scale) → ScenePrimitive` — pure function transforming all coordinate/dimension fields of every primitive kind, including Path d-strings and StrokeGradient coords. Recursive for GroupPrimitive.
- `embedSceneInRect(scene, targetRect) → ScenePrimitive[]` — convenience wrapper computing scale + offset + calling translateAndScale on all primitives.
- Proposed location: `packages/core/src/scene-transform.ts`

**Edge Cases Decided:**
- Oversized sub-scene: default scale-to-fit (never upscale); alternatives clip/overflow as theme policy
- Empty cell: allocated by grid, no primitives emitted, chrome still renders
- Single-cell: valid (poster frame around one diagram)
- Ragged grid: undeclared slots treated as empty
- Nested compositions: allowed (depth ≤ 3); nested composition compiles to sub-Scene like any grammar

**Open Questions Deferred:**
- **Mark:** JSON Schema shape for CompositionDocument (discriminated union vs separate keys), ir_file URI schemes, two-pass validation strategy, named grid tracks
- **Barbara:** translateAndScale kernel helper implementation (Path d-string parsing), clip policy implementation (GroupPrimitive clip-path extension?), scale-to-fit UX confirmation, panel chrome rendering confirmation (no new primitives needed)

**Wiring:** Enriched `design/sections/30-composition.tex` (existing file, ~3x expansion). Cross-references to §20 grammar-concept, §25-27 grammar specs, scene.ts.


---

## 2026-06-13 — Composition Layer Spec Complete (Scribe)

**Date:** 2026-06-13T15:53:53Z  
**Status:** Spec fully specced; awaiting Mark/Barbara for inc-1 implementation

### Composition Layer Specification Complete

- **Artifact:** design/sections/30-composition.tex (enriched from sketch to implementable spec)
- **IR shape:** CompositionDocument(grid, cells[], metadata) + CellContent discriminated union (grammar/stat/text/title/image)
- **Embed algorithm:** Sub-Scene compile → grid sizing (max col/row) → uniform scale (fit, never upscale) → center + merge
- **Worked example:** RAG Architecture Poster (2×2 grid with flow, sequence, tree, stat cells) — verified clean composite output

### Blocking Points for Inc-1

**Mark (Schema):**
- CompositionDocument JSON Schema (discriminated union syntax)
- ir_file URI schemes
- Two-pass validation strategy

**Barbara (Kernel Helper):**
- `translateAndScale()` in packages/core/src/scene-transform.ts
- Handles all primitive kinds + Path d-string + StrokeGradient + recursive GroupPrimitive
- Critical path: Once implemented, composition inc-1 rendering engine can ship

### Next Action

Leslie spec is complete and ready. No further spec work needed. Awaiting Mark schema finalization and Barbara kernel helper implementation to proceed.

---

