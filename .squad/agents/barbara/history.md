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

## Learnings — Multi-Line Node Labels (2026-06-15)

**Multi-line node labels are now IMPLEMENTED.** `splitLabelLines(label)` in `packages/core/src/util/label-lines.ts` splits on `<br>` / `<br/>` / `<br />` (case-insensitive) and literal `\n` / actual newlines. Returns a single-element array when no markers are present — zero overhead for existing single-line labels.

**Grammars that gained multi-line label support:**
- **flow** (`grammars/flow/layout.ts`): `computeNodeSize` uses max-line width and `N × lineHeight` height; `emitNode` emits `kind:'multitext'` when N > 1, otherwise unchanged `kind:'text'`.
- **tree** (`grammars/tree/layout.ts`): same approach in `buildLayoutTree` (sizing) and `emitNode` (emission).
- **tree/radial** (`grammars/tree/layoutRadial.ts`): root circle sized via hypotenuse of text-block half-diagonal; child rect nodes use `N × lineHeight`; both emit `multitext` when N > 1.
- **state** (`grammars/state/layout.ts`): regular state title field supports multi-line; sizing uses `N × lineHeight` rows; description divider y tracks after all title lines.
- **C4** (`grammars/c4/layout.ts`): `normalizeDescription` now preserves `<br>` as newline separator instead of collapsing to space; `measureElement` splits by `\n` then applies word-wrap per segment.
- **mindmap parser** (`frontend/mermaid/mindmap.ts`): `clean()` no longer strips `<br>` variants — they are preserved as-is for `splitLabelLines` downstream.

**Deferred (follow-up):** requirement (name field, compartment layout), block, architecture, kanban — these already use word-wrap (`wrapText`); adding explicit `<br>` splitting within segments is low-risk but kept for a dedicated increment.

**Node-sizing approach:**
- Single line: `h = rhuInt(fontSize × 1.4 + 2 × padY)` — unchanged.
- N lines: `h = rhuInt(N × lineHeight + 2 × padY)` where `lineHeight = rhuInt(fontSize × 1.4)`.
- Multi-line text y-anchor (centered, dominantBaseline:central): `y = cy − (N−1) × lineHeight / 2`.
- For circle (radial root): `rootR = max(ROOT_RADIUS_MIN, ceil(sqrt((maxLineW/2)² + (N×lh/2)²)) + ROOT_RADIUS_PAD)`.

**Determinism:**
- Grepped ALL existing fixtures/goldens: the only `<br>` in source files was in `examples/gallery/mermaid-c4.mmd` (a description field) and the mindmap corpus test's `On effectiveness<br/>and features` label. No flow/tree/state fixture had `\n` or `<br>` in a label.
- The C4 description change (`normalizeDescription`) alters the `mermaid-c4.svg` gallery output — this is intentional (the `<br/>` now creates a real line break instead of a space). Not a golden-comparison file; only size-check test → still passes.
- The mindmap test that asserted `<br/> → space` was updated to assert `<br/>` is preserved (correct new behavior).
- All 2687 tests pass (52 test files). No golden comparison file changed.

**Dogfood figures re-authored (2026-06-15):**
- `design/figures/src/theme-contract.mmd`: binding nodes now use `"bindFlowTheme<br>→ FlowTheme"` etc. — the arrow-and-type go on a second line. Renders cleanly with two-line boxes; no literal `<br>` visible.
- `design/figures/src/family-taxonomy.mmd`: root circle restored to `root((5 Diagram<br>Families))` — shows "5 Diagram / Families" on two lines centered in the circle.
- `design/main.pdf` rebuilt clean (2.53 MiB).



**Multi-line node labels are NOT supported.** Both the flow layout (`grammars/flow/layout.ts`) and the tree layout (`grammars/tree/layout.ts`) emit `kind: 'text'` primitives with the raw label string — no `\n` interpretation, no `<br>` handling, no `MultiTextPrimitive` path is reached for node labels. The `\n` character renders literally as the two-character sequence `\n` on screen. This is a **real product gap**: authors expecting Mermaid-style `\n` line breaks in node labels will be surprised. It should be addressed as a future feature (add `<br>`/`\n` splitting in `extractLabel` for flow and the equivalent label extractor for tree, emitting `MultiTextPrimitive` instead of `TextPrimitive`).

**Fix for `theme-contract.mmd` (defect A):** Replaced all seven `\n`-containing labels with clean single-line equivalents. The TC hub became `"Theme Contract"` (the arc structure already conveys the fanout). Binding nodes became `"bindFlowTheme → FlowTheme"` etc. (arrow on one line). Result: 1033×550 px, aspect 1.88, executive theme — reads cleanly.

**Fix for `family-taxonomy.mmd` (defects A + B):** Fixed root literal `\n` (`"5 Diagram\nFamilies"` → `"5 Diagram Families"`). For the UML label-collision issue, shortened the four UML leaves from full Mermaid keywords to short aliases: `classDiagram → class`, `sequenceDiagram → sequence`, `stateDiagram → state`, `erDiagram → ER`. The radial mindmap then places these short-label boxes without overlap. Blueprint dark theme retained. Result: 1400×1000 px, aspect 1.4 — no overlap, fully readable.

**PDF:** `design/main.pdf` built clean (2.52 MiB, pre-existing LaTeX hbox warnings only — unrelated to these changes). No core/renderer code was touched; `pnpm -C packages/core test` was not run (figure sources only).
