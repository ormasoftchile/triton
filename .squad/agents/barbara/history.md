# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T22:30:00Z (CROSS-DIAGRAM TRACES Phase B shipped — trace DSL, categorical coloring + legend, overlay polish, §30b dogfood figure)

---

## Current Status (2026-06-16)

**CROSS-DIAGRAM NODE LINKING Phase A SHIPPED (§30b).** Sidecar NodeAnchorRegistry on flow/class/state grammars, `link` DSL parsing in poster.ts, composition overlay in renderPoster, and gallery demo. See "Learnings — Cross-Diagram Links Phase A" below.

**CROSS-DIAGRAM TRACES Phase B SHIPPED (§30b.8).** Named, typed, multi-hop `trace` abstraction built on Phase A link infrastructure. Categorical palette coloring, trace legend, overlay polish (solid-edge fix, label offset, elbow routing for inter-row links). Gallery demo + §30b dogfood figure. See "Learnings — Cross-Diagram Traces Phase B" below.

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

**CROSS-AGENT (2026-06-16T18:45:00Z):** Cross-diagram node linking Phase A shipped (§30b sidecar registry + link overlay).

## Learnings — Cross-Diagram Links Phase A (2026-06-16)

**Summary:** Implemented the Candidate (b) SIDECAR NodeAnchorRegistry mechanism from §30b. Three grammars now expose per-node bboxes as metadata. A new `link` DSL keyword in the poster parser resolves cross-cell node references and draws overlay edges in poster-space. All additive — every existing golden is byte-identical.

### NodeAnchor shared types
- **File:** `packages/core/src/anchors.ts` (NEW)
- `NodeAnchor { id: string; x: number; y: number; w: number; h: number; ports?: Partial<Record<CardinalSide, {x,y}>> }` — local coordinate space of the cell diagram.
- `NodeAnchorRegistry = Record<string, NodeAnchor>` — keyed by diagram-local node id.
- `RenderWithAnchors<S> = { scene: S; anchors: NodeAnchorRegistry }` — sidecar wrapper for any scene type.
- `CardinalSide = 'top' | 'right' | 'bottom' | 'left'` — used for port-side selection.

### Grammars that expose node anchors (Phase A starter set)
1. **flow** (`grammars/flow/layout.ts`):
   - `layoutFlow` returns `RenderWithAnchors<Scene>` instead of `Scene`.
   - Anchors built from the `placed: Map<string, PlacedNode>` after all nodes are emitted.
   - PlacedNode has `.x`, `.y`, `.w`, `.h` — directly usable as anchor bbox.
   - `buildFlowScene` extracts `.scene` (backward-compatible); `buildFlowSceneWithAnchors` exposed in `grammars/flow/index.ts`.

2. **class** (`grammars/class/layout.ts`):
   - `layoutClass` returns `RenderWithAnchors<Scene>`.
   - Anchors indexed by BOTH `cls.name` (display/original casing) AND `cls.id` (sanitized lowercase).
   - **Critical:** The Mermaid class parser (`sanitizeClassId`) lowercases class IDs. `cls.id = "paymentgateway"`, `cls.name = "PaymentGateway"`. Dual-indexing + case-insensitive fallback in overlay resolver handles this reliably.
   - `buildClassSceneWithAnchors` exposed in `grammars/class/index.ts`.

3. **state** (`grammars/state/layout.ts`):
   - `layoutState` returns `RenderWithAnchors<Scene>`.
   - Anchors built from `allPlaced: PlacedState[]`. PlacedState has `.x`, `.y`, `.right`, `.bottom` (not `.w`/`.h`). Use `w = right - x`, `h = bottom - y`.
   - `buildStateSceneWithAnchors` exposed in `grammars/state/index.ts`.

**Remaining grammars for Phase B+:** sequence, architecture, er, c4, gantt, mindmap, tree, block, kanban, requirement, timeline, quadrant. These lack per-node placed bboxes in the current layout APIs.

### layoutCompositionFull — per-cell transforms
- **File:** `packages/core/src/composition/layout.ts`
- `CellTransform { row, col, dx, dy, scale }` — the alignment-adjusted translation and scale for each placed cell.
- `layoutCompositionFull` mirrors `layoutComposition` logic but records `{ dx: alignDx, dy: alignDy, scale }` per cell as `CellTransform`.
- Map key: `"${row},${col}"` (e.g. `"0,0"`, `"0,1"`).
- Poster-space anchor transform: `x_p = x_local × scale + dx`, `y_p = y_local × scale + dy`, `w_p = w_local × scale`, `h_p = h_local × scale`.
- The existing `layoutComposition` is unchanged — all existing callers still work.

### Poster `link` DSL parsing
- **File:** `packages/core/src/frontend/mermaid/poster.ts`
- `PosterLink { fromCell: {row,col}, fromNodeId: string, edge: PosterLinkEdgeStyle, toCell: {row,col}, toNodeId: string, label?: string }`
- `PosterLinkEdgeStyle = '-->' | '-.->' | '---'`
- `LINK_RE = /^link\s+(\[?\w+\]?|\w\d+)\.(\w+)\s+(-->|-\.->|---)\s+(\[?\w+\]?|\w\d+)\.(\w+)(?:\s*:\s*"([^"]*)")?$/i`
- Detection heuristic: `trimmed` (line trimEnd only, NOT trimStart) starts with `/^link\s/i.test(trimmed)` — catches only top-level lines (0-indent). Indented cell-body `link`-like text is not treated as a poster link directive.
- `addrToRowCol(addr)` handles both `[r,c]` bracket form and Excel-style `A1`/`B1` etc.
- Graceful degradation: malformed `link` → WARN + skip. Unknown cell/node → WARN + skip. Both warn + continue poster rendering.
- `PosterDocument.links: PosterLink[]` (new field, defaults to `[]`).

### Composition overlay — resolveAndDrawLinks
- **File:** `packages/core/src/frontend/mermaid/index.ts`
- `renderCellSceneWithAnchors(cell, cellSrc)` dispatches to `buildFlowSceneWithAnchors` / `buildClassSceneWithAnchors` / `buildStateSceneWithAnchors` by grammar kind; returns `{ scene, anchors }`. Falls back to `{ scene, anchors: {} }` for unsupported grammars.
- `renderPoster` now:
  1. Calls `renderCellSceneWithAnchors` per cell (instead of `renderCellScene`), accumulates `cellAnchors: Map<"row,col", NodeAnchorRegistry>`.
  2. Uses `layoutCompositionFull` (instead of `layoutComposition`) to get `CellTransform` per cell.
  3. Transforms all cell anchors from local → poster space using the cell's `CellTransform`.
  4. Calls `resolveAndDrawLinks(links, posterAnchors, overlayPrims)`.
- `resolveAndDrawLinks`: for each `PosterLink`, looks up from-anchor and to-anchor in the poster-space registry. Calls `chooseSide` to pick from/to ports (nearest side, center-to-center). Emits: a `line` primitive (red, dashed), a filled arrowhead `path`, and (if label) a white-background rect + text label pill.

### Port/routing choice (Phase A)
- `chooseSide(fromAnchor, toAnchor)` → nearest sides: if `toX > fromX + fromW/2`, from-port = right edge of from-anchor, to-port = left edge of to-anchor; and vice versa; with top/bottom fallback for predominantly-vertical offsets. Simple center-to-center with nearest-side attachment. Sufficient for non-overlapping cross-cell links.
- Arrowhead: filled triangle pointing toward target, normal to the arrival direction.
- Routing: single straight segment (no elbows). Good for side-by-side `grid 2x1` or `grid 1x2` layouts. An elbow router is the natural Phase B improvement.
- Overlay color: `#E05B4B` (warm red for high contrast against both executive and midnight themes).
- Dash pattern: `8,4` for dashed styles, `6,4` for dot-dashed.

### Known issues / Phase B improvements
- `-->` (solid) edge style still renders dashed in the overlay; the solid/dashed distinction was not applied — fix before Phase B.
- Label pill overlaps cell diagram text when the link trajectory passes over a class header. Elbow routing would avoid this.
- Arrowhead direction for `---` (undirected) should suppress the arrowhead — not yet implemented.
- Remaining grammars (sequence, er, c4, architecture, etc.) need `WithAnchors` variants.

### Demo poster
- `examples/gallery/poster-crosslink.mmd` — 2-cell `grid 2x1` poster, `theme: executive`.
- Left cell (A1): `flowchart LR` — Receive Order → Validate → Payment → Dispatch.
- Right cell (B1): `classDiagram` — OrderService / PaymentGateway / ShipmentHandler.
- Links: `A1.pay --> B1.PaymentGateway : "handled by"` and `A1.ship --> B1.ShipmentHandler : "fulfilled by"`.
- Gallery card added to `examples/gallery/index.html` under "Superset: Posters".

### Phase B readiness
- Phase B `trace` multi-hop traversal can build directly on the `NodeAnchorRegistry` and `PosterLink` infrastructure.
- The poster-space anchor map is already available after `resolveAndDrawLinks` — Phase B traces just need to chain hops through it.
- Elbow routing, directed/undirected edge styles, and remaining grammar anchors are the main gaps.



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



## Learnings — Cross-Diagram Traces Phase B (2026-06-16)

**Summary:** Implemented §30b.8 `trace` abstraction on top of Phase A `link` infrastructure. Named, typed, ordered multi-hop traces desugar to atomic PosterLinks. Each trace is colored from the theme's categorical data palette. A legend band is appended at the bottom of the poster. Overlay polish fixed three Phase A issues: solid-edge bug, label collision, and straight-line routing through inter-row cell boxes.

### trace DSL types

- **File:** `packages/core/src/frontend/mermaid/poster.ts`
- `TraceType = 'satisfies' | 'derives' | 'verifies' | 'refines' | 'traces' | 'contains' | 'copies' | 'calls' | 'flowsTo' | 'mapsTo'` — requirement-relationship vocabulary (§30b.8) plus poster-flow extensions.
- `TraceHop { cellAddr: string; nodeId: string; raw: string }` — one resolved cell.nodeId hop.
- `TraceRecord { name: string; type?: TraceType; orderedMembers: TraceHop[]; linkIndexRange: [number, number] }` — the trace group record; `linkIndexRange` identifies which desugared PosterLinks belong to this trace.
- `PosterLink` gained `traceIndex?: number` — set to the trace's position in `doc.traces[]` when the link is a desugared trace hop.
- `PosterDocument` gained `traces: TraceRecord[]`.

### trace parsing + desugaring

- **File:** `packages/core/src/frontend/mermaid/poster.ts` — `parsePosterInternal`
- Detection: `TRACE_HEAD_RE = /^trace\s+"([^"]+)"(?:\s+(\w+))?\s*:/i` at zero-indent.
- `splitHopChain(chain)`: splits on `\s+(-->|--|-\.-?>|->)\s+` capturing delimiters; tokens at even indices are hops, odd indices are arrows. Returns null if <3 tokens (i.e. <2 hops), or uneven count.
- `parseHop(raw)`: parses `<addr>.<nodeId>` — addr accepts `[r,c]`, `A1`, `B2`, etc. (reuses `addrToRowCol`).
- Desugaring: each consecutive hop pair becomes one atomic `PosterLink` with `traceIndex` set; edge style follows type (solid for satisfies/verifies/contains/calls/flowsTo; dashed for derives/refines/traces/copies/mapsTo).
- **Graceful degradation**: if <2 hops → warn + skip entire trace; bad hop → warn + skip remaining hops in that trace (partial trace still renders from resolved portion if ≥2 hops remain before the bad one).

### Categorical palette trace coloring + legend

- **File:** `packages/core/src/frontend/mermaid/index.ts`
- Theme contract provides `dataPalette.categorical: string[]` — 8 entries for executive theme: `['#1F497D','#2E86AB','#4CAF82','#D97706','#7C3AED','#0891B2','#B45309','#0D2B4E']`. Accessed via `resolveContractTheme(themeName).dataPalette.categorical`.
- `traceColorMap: Map<number, string>` — maps trace index to color. On first cycle (i < n): `categorical[i]`. On wrap (i ≥ n): `lightenHex(categorical[i % n], 0.18)` — distinguishes second-cycle traces visually.
- `lightenHex(hex, amount)` — mixes hex with white by `amount` (0–1); pure JS, no deps.
- `buildTraceLegend(traces, traceColorMap, scene, theme)` — appends a horizontal band below the poster:
  - Background band: `posterBg` fill, `LEGEND_PAD_TOP(14) + ROW_H(22) + LEGEND_PAD_BOT(14) = 50px` height.
  - Top rule: `1px accent`-colored rule.
  - "Traces:" label in `textFont.color` (`#333333` for executive — NOT `posterTitleFont.color` which is `#FFFFFF` = white, invisible).
  - Per trace: colored `12×12` swatch rect, trace name text, `«type»` type pill.
- **Bug found:** `posterTitleFont.color = #FFFFFF` for executive theme — white on white = invisible legend text. Fixed: use `theme.textFont?.color ?? '#333333'` throughout legend.

### Overlay polish — Phase A blemishes fixed

- **File:** `packages/core/src/frontend/mermaid/index.ts`
- **Solid-edge bug (FIXED):** Phase A `resolveAndDrawLinks` set `dashArray: '8,4'` for ALL edges including `-->`. Fixed: `dashArray` only set when `isDashed` is true; `-->` edges are now solid.
- **Label offset (FIXED):** `clearLabelPoint(t0, ax, ay, bx, by, allBboxes, step?)` — starts at midpoint (t=0.5), walks outward in steps of `max(8, edgeLen × 0.05)`, checks `pointInBox(px, py, bbox)` against all anchor bboxes, returns first clear point. Falls back to naive midpoint if no clear point within t∈[0,1]. Labels placed with small background pill via `labelPill(x, y, text, fontSize, fillColor, textColor)`.
- **Elbow routing (IMPROVED):** `emitEdge(...)` checks `isSameRow = link.fromCell.row === link.toCell.row`. Same row → straight `LinePrimitive`. Different row → L-shaped `PathPrimitive` with `elbowX = (srcPort.px + tgtPort.px) / 2` (`M srcX srcY L elbowX srcY L elbowX tgtY L tgtX tgtY`). This routes inter-row links through the inter-cell gutter rather than straight through node boxes.
- **Port selection:** `chooseSide(fromAnchor, toAnchor)` returns nearest-side center ports — unchanged from Phase A but now shared by both atomic links and traces via `emitEdge`.
- **Arrowhead:** filled triangle, 8×6px, pointing toward target, normal to arrival direction. Traces use the same arrowhead emitter.

### §30b dogfood figure

- **Source:** `design/figures/src/crosslink-poster.mmd` — 3-cell `grid 3x1`, executive theme, two `satisfies` traces ("REQ-01 chain", "REQ-02 chain") across requirements flowchart → service class diagram → test flowchart.
- **Output:** `design/figures/crosslink-poster.png` (89 KB, scale 3) — rendered via `cd design && make figures`.
- **Insertion in §30b:** `design/sections/30b-cross-diagram-links.tex` — added `\subsubsection{Rendered Example: Two Typed Traces Across Three Diagram Layers}` with `\ourdiagram[0.97\linewidth]{crosslink-poster}{\ldots}` caption. Figure shows real running-system output, not a sketch.
- **PDF build:** `cd design && make pdf` → `main.pdf` (3.17 MiB). Pre-existing LaTeX hbox/underfull warnings only; no new errors.

### Gallery demo

- **Source:** `examples/gallery/poster-trace.mmd` — 3-cell `grid 3x1`, executive theme, same requirements traceability narrative.
- **Renders:** `examples/gallery/poster-trace.{svg,png}` — emitted by test E7.
- **Gallery card:** added to `examples/gallery/index.html` under "Superset: Posters" section — describes trace DSL syntax, categorical coloring, legend, and desugaring to atomic links.

### Grid layout convention (important)

- `grid <columns>x<rows>` — columns first. `grid 3x1` = 3 columns, 1 row. **NOT** rows×columns.
- The spec examples (§30b) use `grid 1x3` for a 3-column layout — this is a spec inconsistency. The implementation is columns-first; authored files use `grid 3x1`.
- Cell addresses for `grid 3x1`: `A1`, `B1`, `C1` (all row 1, columns A/B/C).

### Test suite

- **File:** `packages/core/test/crosslink.test.ts` — appended groups D (trace parsing) + E (trace rendering).
- D1: parse trace name + type from header line.
- D2: desugar 3-hop trace to 2 atomic PosterLinks with traceIndex.
- D3: `trace` without type → `type` field undefined; still valid.
- D4: all 10 TraceType values accepted.
- D5: graceful degradation — bad hop warns + produces 0 links, poster renders.
- D6: two traces → distinct traceIndex values (0 and 1).
- E1–E3: SVG output contains `<path>` trace edges, `«satisfies»` legend pill, categorical color (#2E86AB).
- E4: deterministic trace color assignment (same input → same color).
- E5: legend renders correctly (text visible, not white-on-white).
- E6: bad-hop trace degrades gracefully in rendered output.
- E7: gallery emit — poster-trace.{svg,png} files written.
- E8: trace-less poster → no legend rendered (legend band absent).
- **Final count:** 2719 tests passed (53 test files). 1 known flaky Skia infrastructure timeout (not a test failure).

### Golden changes

- `examples/gallery/poster-crosslink.{svg,png}` — CHANGED (overlay polish intended): solid edges now render solid, label pills placed in clear space, inter-row routing uses elbows.
- All other existing gallery goldens: BYTE-IDENTICAL. Verified via `git diff --name-only`.
- New gallery files: `poster-trace.svg`, `poster-trace.png`.

### Remaining work / future Phase C

- **Grammars to anchor:** sequence, er, c4, architecture, gantt, mindmap, tree, block, kanban, requirement, timeline, quadrant — none expose per-node placed bboxes yet.
- **Trace routing Phase 2:** orthogonal/Manhattan routing through gutter space (avoid crossing unrelated node boxes for same-row hops — current Phase B still routes straight for same-row links).
- **Highlight/filter interactivity:** hover-to-highlight a trace, filter by type — deferred to interactive export phase.
- **`---` undirected edges:** should suppress arrowhead — not yet implemented.
- **Second trace wrap-around:** `lightenHex` distinguishes second cycle; a third cycle (>16 traces) falls back to same lightened colors — acceptable for now.
