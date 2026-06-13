# Leslie — Spec Architect

**Owner:** Leslie (Spec Architect)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-13T15:53:53Z

---

## Current Role

Design domain-specific IR shapes for deterministic diagram compilers. Establish grammar specs that are implementable and principled. Composition-layer architecture.

---

## Strategic Context (Summarized)

- **Product focus:** Deterministic, themeable, agent-authorable DIAGRAM COMPILER (not timeline-only).
- **Two-IR-layer architecture:** Domain IRs (grammar-specific) compile to Scene IR (universal primitives). All styling in themes.
- **Grammar governance:** Each grammar specifies semantics (layout determinism rationale), IR shape (no styling), and deferred schema/rendering questions.
- **De-risked sequencing:** Sequence chosen before Flow because layout is deterministic-by-construction (no iterative algorithms).

For detailed specs and design notes from earlier grammars (Sequence, Tree, Flow up to 2026-06-13 10:00Z), see `leslie/history-archive.md`.

---

## Grammar Status (2026-06-13)

| Grammar | Spec File | Status | IR Shape | Layout Algo | Schema | Rendering |
|---------|-----------|--------|----------|-------------|--------|-----------|
| **Timeline** | design/sections/20-timeline.tex | ✅ COMPLETE | ✅ | ✅ (5 layout families) | ✅ | ✅ |
| **Sequence** | design/sections/26-sequence.tex | ✅ COMPLETE | ✅ | ✅ (deterministic by order) | ✅ Mark | ✅ Barbara |
| **Tree** | design/sections/27-tree.tex | ✅ COMPLETE | ✅ (recursive children-list) | ✅ (B–J–L O(n)) | ✅ Mark | ✅ Barbara |
| **Flow** | design/sections/25-flow.tex | ✅ COMPLETE | ✅ (flat node/edge) | ✅ (Sugiyama 4-phase LR) | ✅ Mark | ✅ Barbara |
| **Composition** | design/sections/30-composition.tex | ✅ COMPLETE | ✅ (grid-based IR) | ✅ (deterministic) | 🚧 Awaiting Mark | 🚧 Awaiting Barbara |

**Milestone:** All four grammar specs finalized as of 2026-06-13.

---

## Current Work — Composition Layer (Complete Spec)

### What's Specced

**Artifact:** design/sections/30-composition.tex (enriched from sketch to full spec)

**IR Shape:**
- CompositionDocument: version, metadata, grid (columns, rows, gap, padding), cells[]
- Cell: id, row/col, rowSpan/colSpan, title/caption, content: CellContent
- CellContent: discriminated union (grammar | stat | text | title | image)
- GrammarContent: grammar name + inline ir OR ir_file reference

**Embed Algorithm:**
1. Compile each cell's content → independent sub-Scene
2. Grid sizing: column widths = max(sub-scene widths per column); row heights analogous
3. Uniform scale factor s = min(W_cell/w_scene, H_cell/h_scene), capped at 1.0
4. Center sub-Scene in cell rect; apply translateAndScale() to all primitives
5. Merge in painter's order → single Scene

**Worked Example:** RAG Architecture Poster (2×2 grid with flow, sequence, tree, stat) — verified clean composite output

### Blocking Points for Inc-1

**Mark (Schema):**
- CompositionDocument JSON Schema (discriminated union for CellContent)
- ir_file URI schemes (pkg:, file:, http:)
- Two-pass validation strategy (composition → sub-grammar)

**Barbara (Rendering):**
- Kernel helper `translateAndScale()` in packages/core/src/scene-transform.ts
- Handles all primitive kinds + Path d-string transformation + StrokeGradient coords + recursive GroupPrimitive
- Critical path: Once implemented, composition inc-1 rendering engine ships

### Deferred to Inc-2+

- Named grid tracks (CSS Grid style)
- Advanced scale policies (clip, overflow)
- Freeform/custom layout modes
- Deep nesting (depth > 3)

---

## Open Questions (For Mark/Barbara Intake)

**Mark:**
- Discriminated union syntax options (single `kind` field vs. separate keys)?
- ir_file URI scheme coverage and priority (pkg:, file:, http: all needed, or subset)?
- Validation rule precision (nested validation, XGrammar constraint grammar for ir_file)?

**Barbara:**
- Path d-string coordinate parsing strategy (regex, manual parser, or library)?
- StrokeGradient transformation constraints (linear only, or radial too)?
- GroupPrimitive recursive descent depth limit for safety?

---

## Archive

For detailed context from earlier sessions (Sequence spec, Tree spec refinement, Flow spec, de-risked grammar sequencing decision), see `leslie/history-archive.md`.

---

## Next Steps

1. **Mark:** CompositionDocument schema finalization (expected next turn)
2. **Barbara:** Kernel helper implementation (estimated 2–3 hours after schema)
3. **Leslie:** Awaits Mark/Barbara for composition inc-1 implementation kickoff
