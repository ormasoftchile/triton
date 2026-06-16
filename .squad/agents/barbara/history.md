# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T00:31:46Z (Extended Timeline spec'd (§16b); 4 IR gaps flagged incl. schema layout-enum bug)

---

## Current Status (2026-06-16)

**Trace abstraction spec'd (§30b.8) — multi-hop system traceability across poster layers**

**Extended Timeline Spec'd (§16b; leslie):** One IR × 6 layouts × 7 themes = 42 presentations. Two-tier superset of Mermaid `timeline` with full IRDocument field mapping. Four known IR gaps flagged: (1) Milestone no `shape` field, (2) schema.ts layout enum missing `gantt`/`timeline-columns`, (3) `density` not persisted, (4) legend auto-generation unspecified. Implementation TBD.

**Active Work (2026-06-15):**
- Dimension guard test + spine height warning + config-layout fix (2642/2642 tests)
- 3 named contract themes (terminal, pastel, mono) added; matrix: 7×21 components = 2392/2392 tests
- 4 earlier named themes (midnight, blueprint, editorial, executive) — all coherent across 21 diagram types
- All themes follow `categorical[0] = accent` convention; zero per-component binding changes required

---

## Archive & Historical Notes

**2026-06-15 Detailed Work:** See `history-2026-06-15-summarized.md` for dimension guard root-cause analysis, render-time warning implementation, config-layout demo fix, and full theme coherence verdicts.

**Earlier Work (2026-06-14 and prior):** See `history-archive.md` and dated archive files for timeline ResolvedTheme generalization, Tier 3 long-tail grammar completion, theme vocabulary resolution, and contract spike details.

**CROSS-AGENT (2026-06-15T21:45:00Z):** Excel poster addressing shipped (feaec9d); cross-diagram linking spec'd §30b (73d8c21).

## Learnings — Dogfood Figure Fixes (2026-06-15)

**Multi-line node labels are NOT supported.** Both the flow layout (`grammars/flow/layout.ts`) and the tree layout (`grammars/tree/layout.ts`) emit `kind: 'text'` primitives with the raw label string — no `\n` interpretation, no `<br>` handling, no `MultiTextPrimitive` path is reached for node labels. The `\n` character renders literally as the two-character sequence `\n` on screen. This is a **real product gap**: authors expecting Mermaid-style `\n` line breaks in node labels will be surprised. It should be addressed as a future feature (add `<br>`/`\n` splitting in `extractLabel` for flow and the equivalent label extractor for tree, emitting `MultiTextPrimitive` instead of `TextPrimitive`).

**Fix for `theme-contract.mmd` (defect A):** Replaced all seven `\n`-containing labels with clean single-line equivalents. The TC hub became `"Theme Contract"` (the arc structure already conveys the fanout). Binding nodes became `"bindFlowTheme → FlowTheme"` etc. (arrow on one line). Result: 1033×550 px, aspect 1.88, executive theme — reads cleanly.

**Fix for `family-taxonomy.mmd` (defects A + B):** Fixed root literal `\n` (`"5 Diagram\nFamilies"` → `"5 Diagram Families"`). For the UML label-collision issue, shortened the four UML leaves from full Mermaid keywords to short aliases: `classDiagram → class`, `sequenceDiagram → sequence`, `stateDiagram → state`, `erDiagram → ER`. The radial mindmap then places these short-label boxes without overlap. Blueprint dark theme retained. Result: 1400×1000 px, aspect 1.4 — no overlap, fully readable.

**PDF:** `design/main.pdf` built clean (2.52 MiB, pre-existing LaTeX hbox warnings only — unrelated to these changes). No core/renderer code was touched; `pnpm -C packages/core test` was not run (figure sources only).
