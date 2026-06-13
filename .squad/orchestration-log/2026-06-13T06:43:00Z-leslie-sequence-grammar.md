# Orchestration Log: Leslie — Sequence Grammar (Grammar #3)

**Timestamp:** 2026-06-13T06:43:00Z  
**Agent:** Leslie (Spec Architect)

## Manifest

Leslie authored the Sequence Grammar specification — the **first de-risked new grammar** ahead of general-DAG Flow layout.

**Key Achievement:** Layout is deterministic-by-construction:
- Participants declared left-to-right → x-position (no graph auto-layout)
- Messages with explicit `order` field → y-position (rank-based, no Sugiyama)
- No crossing minimization, no coordinate assignment, no RNG, no convergence

**Contrast with Flow Grammar:** Flow (Grammar #2) requires full Sugiyama four-phase with careful determinism pinning; Sequence eliminates this complexity entirely.

## Deliverables

### Specification (Design Artifacts)

- **`design/sections/26-sequence-grammar.tex`** — Complete concrete spec with IR shape, lowering semantics, taxonomy notes
- **`design/main.tex`** — Added `\input{sections/26-sequence-grammar}` after 25-flow-grammar
- **`design/sections/24-diagram-family.tex`** — Cross-reference added (connects Sequence to shape-grammar taxonomy)
- **`design/references.bib`** — Added `uml25`, `itu-msc` bib entries for UML 2.5 & ITU-T MSC standards
- **PDF build** — Successful; 2.84MB; commit d268933

### IR Contract & Open Questions

**Schema Details (Deferred to Mark):**
- Exact JSON Schema (enum values, string patterns, min/max on `order`)
- Whether Message needs explicit `id` field
- Whether `order` can alternatively be implicit (list position as default)
- Exhaustive semantic validation rules (fragment overlap, activation range validation)

**Rendering Semantics (Deferred to Barbara):**
- Self-message curve geometry (rounded corners vs. smooth arc vs. sharp bends)
- Fragment nesting depth recommendation (soft limit for readability)
- Participant stereotype icon geometries (actor stick-figure, boundary bar, control arrow, entity underline, database cylinder)
- Arrowhead sizing (scale with stroke or fixed pixel)
- Activation bar width

## Strategic Decision

**Team adopted de-risked grammar sequencing:**

| Priority | Grammar | Layout | Determinism | Status |
|----------|---------|--------|-------------|--------|
| 1 | Flow | pipeline/linear | Sugiyama (scoped to linear) | Grammar #2 (complete) |
| **2** | **Sequence** | **deterministic-by-construction** | **No optimization** | **Grammar #3 (chosen first NEW)** |
| 3 | Tree | hierarchical | Buchheim O(n) | Planned |
| 4 | Composition/Grid | tabular + multi-panel | Constrained layout | Planned |

**Rationale:** Sequence eliminates §42 Graph Auto-Layout hard problem entirely. Lowest-risk grammar to add; no new Scene IR primitives required; maps all constructs to existing kernel (Rect, Text, dashed Line, arrowhead Path).

## Team Notes

- **Workflow:** Leslie drafted spec autonomously after data-synthesis phase; Mark/Barbara queues open questions for refinement
- **Next Checkpoint:** Mark (IR Schema) and Barbara (Rendering) pick up deferred items in parallel

## Files Touched (Scribe Processing)

- `.squad/decisions.md` — Strategic decision entry + merged inbox → production
- `.squad/orchestration-log/2026-06-13T06:43:00Z-leslie-sequence-grammar.md` — **THIS FILE**
- `.squad/log/2026-06-13T06:43:00Z-sequence-grammar.md` — Session log
- `.squad/agents/mark/history.md` — Appended (open questions for IR schema)
- `.squad/agents/barbara/history.md` — Appended (open questions for rendering)
- `.squad/agents/leslie/history.md` — Append (de-risking rationale)
