# Barbara — Semantics & Rendering — Work Archive (2026-06-16)

**Owner:** Barbara (Semantics & Rendering)  
**Archive Date:** 2026-06-16T14:45:00Z  
**Archived From:** barbara/history.md (43995 bytes)

---

## Current Status (2026-06-16)

**GEOMETRY QUALITY KERNEL + GATE COMPLETE (§30b Phase C-finish).** Kernel validated against synthetic bad geometry (acid tests pass). Router already wired with `pickBestRoute` in prior session. Post-render gate `visual-quality.test.ts` added (9 tests). State pseudo-state anchor fix (`isPseudo` truthy-check). ALL 5 posters verified CLEAN by both kernel and visual inspection. 2770 tests passing. See "Learnings — Geometry Quality Gate" below.

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



## Learnings — §30b Source+Render Adjacency (2026-06-16)

**Summary:** Fixed §30b design doc so each worked-example code listing is immediately followed by its rendered figure, giving readers the "source → output" payoff that is the whole point of a diagram-compiler spec.

### What changed in §30b

**Link worked example (~original lines 105–138):**
- Rewrote listing from non-renderable `grid 2x2` (included `sequenceDiagram` in B2, a non-anchored grammar) to a clean `grid 3x1` using only the three anchored grammars: `flowchart LR` (A1), `classDiagram` (B1), `stateDiagram-v2` (C1).
- Links now span all three cells: `A1.pay → B1.PaymentGateway`, `A1.pick → B1.WarehouseSystem`, `A1.ship → C1.Shipped`.
- Created `design/figures/src/link-poster.mmd` with byte-identical content to the tex listing.
- Placed `\ourdiagram[\linewidth]{link-poster}{...}` immediately after `\end{lstlisting}`.
- Updated prose explanation to note Excel cell addresses for A1/B1/C1.

**Trace worked example (~original lines 1069–1107):**
- Rewrote listing from non-renderable `requirementDiagram` (A1) + `C4Component` (B1) — both non-anchored — to `flowchart TD` (A1) + `classDiagram` (B1) + `flowchart TD` (C1), all anchored.
- Node IDs rewritten to avoid hyphens (which `\w+` regex cannot match): `REQ-12` flow node → `REQ12`; class nodes `AuthController`/`TokenService` resolve via dual-indexing.
- Trace lines updated accordingly: `A1.REQ12 --> B1.AuthController --> C1.T1` etc.
- Created `design/figures/src/trace-poster.mmd` with byte-identical content.
- Placed `\ourdiagram[\linewidth]{trace-poster}{...}` immediately after `\end{lstlisting}`.
- Fixed prose reference `\texttt{authctrl}` → `\texttt{AuthController}` to match the new listing.

### Figure names now in §30b

| Figure name    | Source file                                  | Shows                                                          |
|----------------|----------------------------------------------|----------------------------------------------------------------|
| `link-poster`  | `design/figures/src/link-poster.mmd`         | Three `link` overlay arrows (flow→class, flow→class, flow→state) |
| `trace-poster` | `design/figures/src/trace-poster.mmd`        | Two `satisfies` traces with legend (flow→class→flow)           |
| `crosslink-poster` | `design/figures/src/crosslink-poster.mmd` | (existing) REQ-01/REQ-02 traces; stays in "Rendered Example" §  |

### Key lesson: non-anchored grammars in doc listings

The original listings used `requirementDiagram`, `C4Component`, and `sequenceDiagram` — none of which have `WithAnchors` variants yet.  Node references in those cells silently WARN+skip, producing a poster with no overlay edges at all — the opposite of the "payoff" illustration.  **Doc listings in §30b must use only flow/class/state until Phase C anchors the remaining grammars.**

Also: Mermaid flow node IDs that contain a hyphen (e.g., `REQ-12`) are invalid as `link`/`trace` hop references because the parser regex uses `\w+` (no hyphen).  Use underscores or drop the hyphen in the `.mmd` source and mirror the display text in the node label (e.g., `REQ12[REQ-12: description]`).

### PDF build

`cd design && make figures && make pdf` → `main.pdf` (3.35 MiB). Pre-existing hbox warnings only; no new errors.

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
- **Highlight/filter interactivity:** hover-to-highlight a trace, filter by type — deferred to interactive export phase.
- **`---` undirected edges:** should suppress arrowhead — not yet implemented.
- **Second trace wrap-around:** `lightenHex` distinguishes second cycle; a third cycle (>16 traces) falls back to same lightened colors — acceptable for now.

---

## Learnings — Orthogonal Bus Routing Rewrite (2026-06-16)

**Summary:** Rewrote the cross-diagram overlay router from diagonal straight-lines + Z-elbows to a clean **orthogonal bottom-margin bus** design. All cross-cell edges now route through a whitespace channel below the poster cells; no segment ever crosses a cell box interior or an unrelated node.

### Algorithm: Bottom-Margin Bus Routing

**Core shape (U-route):** Every cross-cell overlay edge follows a 3-segment orthogonal path:
1. Exit source node at its **bottom-centre port** → travel vertically downward to the assigned bus lane Y.
2. Travel **horizontally** along the bus lane to the target node's centre X.
3. Travel vertically **upward** into the target node's **bottom-centre port**.

All three segments are axis-aligned (horizontal or vertical only). No diagonal component.

**Bus channel location:** `busLaneY = globalCellBot + BUS_MARGIN_TOP + laneIndex * BUS_LANE_PITCH`
- `globalCellBot` = maximum of `(cellY + cellH)` across all `CellTransform` records — the bottom edge of the lowest cell in poster space.
- `BUS_MARGIN_TOP = 14` px (gap from cell bottom to first lane centre).
- `BUS_LANE_PITCH = 18` px (vertical separation between lanes).
- `BUS_EXTRA_BOT = 10` px (below last lane).

**Canvas extension:** When links/traces are present, `renderPoster` extends `baseScene.height` by `max(0, busNeeded - compositionTheme.padding)` to ensure the bus channels fit below the cell area. The canvas background rect (always `primitives[0]`) is grown to match. The legend's `yStart` is set to the extended height, keeping legend below the bus.

### Lane Assignment (deterministic)

- Traces are assigned lanes first, in traceIndex ascending order (one lane per trace; all hops of a trace share one lane).
- Standalone links (no `traceIndex`) are assigned lanes after traces, in declaration order (one lane per link).
- This gives stable lane numbering across re-renders (closed-form assignment, not graph-search).

Key: `laneGroupKey = traceIndex !== undefined ? 't{i}' : 's{linkIdx}'`; lane index = insertion order into `laneMap`.

### Label placement

Labels are placed at `(midX of horizontal bus segment, laneY)` — always in the open bus channel below cells, never overlapping any cell box or node. Label pill: white fill + colored border, font 11px.

### Arrowhead direction

The final segment travels upward (from `laneY` to `tgtPy` where `tgtPy < laneY`). `tailDir = {x:0, y: tgtPy − laneY}` (negative Y = upward). The `arrowhead()` function produces a filled triangle pointing upward into the target node's bottom.

### Files changed

- `packages/core/src/composition/layout.ts`: `CellTransform` interface extended with `cellX, cellY, cellW, cellH`; `layoutCompositionFull` populates them.
- `packages/core/src/frontend/mermaid/index.ts`:
  - New helpers: `computeNumBusLanes()`, `extendCanvasHeight()`, `emitBusEdge()`.
  - `renderPoster`: extends canvas height for bus; passes `cellTransforms` to `resolveAndDrawLinks`.
  - `resolveAndDrawLinks`: rewritten — uses bottom-centre ports + bus lane assignment; old `chooseSide`, `clearLabelPoint`, `pointInBox`, `emitEdge` removed.
  - `arrowhead()` and `labelPill()` retained unchanged.
  - `CellTransform` added to composition import.

### Visual verdict

- `design/figures/link-poster.png` and `trace-poster.png`: all orthogonal, labels in clear bus space, no line crosses B1 or C1 cell interiors from an unrelated source. The "triggers" link (A1→C1 skipping B1) routes cleanly under B1's bottom edge.
- `design/figures/crosslink-poster.png`: two-trace lanes visible, connected bus segments per trace, arrowheads pointing upward into target nodes.
- `examples/gallery/poster-crosslink.png` and `poster-trace.png`: same clean routing.
- All 2719 tests pass (53 test files). Changed goldens: link/trace poster files only. All other goldens byte-identical.
- `design/main.pdf` rebuilt (3.32 MiB); pre-existing LaTeX warnings only.


## Learnings — Hybrid Layout + Direct Gutter Routing (2026-06-16)

The user rejected the bottom-bus routing from the previous rewrite as "horrible"
and gave a precise layout directive: stack the WIDE/horizontal diagrams in a
LEFT column and place the TALL/vertical diagram to their RIGHT as the hub,
spanning their combined height. Traces must route DIRECTLY through the central
gutter, not dumped into a bottom bus. This section supersedes the bottom-bus
section above for adjacent-cell hops.

### 1) Poster span DSL (cell spans)

Authors can now make one cell occupy a rectangular grid block. `poster.ts`
accepts three header forms, all feeding `Cell.colSpan`/`Cell.rowSpan`:

- Excel range:   `cell B1:B2: classDiagram`      → col 1, rowSpan 2
- Bracket range: `cell [0,1]:[1,1]: classDiagram` → col 1, rowSpan 2
- Keyword form:  `cell B1 rowspan 2: classDiagram` (also `colspan N`)

Implementation:
- `PosterCellDef` gained optional `colSpan`/`rowSpan`.
- New regexes `CELL_HEADER_EXCEL_RANGE_RE`, `CELL_HEADER_BRACKET_RANGE_RE`,
  `CELL_HEADER_KEYWORD_SPAN_RE`; span branches are tried BEFORE the single-cell
  forms in the parse loop. `makeSpanningCell` derives row/col (top-left corner)
  and inclusive colSpan/rowSpan from the two endpoints.
- `columns` derivation accounts for colSpan so the grid width is correct.
- `renderPoster` (index.ts) feeds colSpan/rowSpan into the composition `Cell`.
- `computeGridLayout` (layout.ts) Pass 1a' distributes a spanning cell's
  intrinsic WIDTH across its columns and Pass 2' its HEIGHT across its rows, so
  a tall hub aligns flush with the combined height of the stacked cells.
- Tests: crosslink.test.ts Group F (F1–F6) cover all three forms, colSpan,
  the single-cell no-regression case, and a clean spanning render.

### 2) Direct gutter routing (replaces bottom-bus for adjacent cells)

`resolveAndDrawLinks` (index.ts) now returns `{primitives, busBottomY}` and, for
each hop, chooses a DIRECT orthogonal route when the two cells are adjacent and
the corridor between them is clear: exit the source at the boundary facing the
target, run through the gutter BETWEEN the cells, enter the target at its near
boundary. Modes h-right/h-left/v-down/v-up via `emitDirectEdge`. The bottom bus
(`emitBusEdge`) is kept ONLY as a fallback for genuinely non-adjacent cells or
when `corridorBlocked` detects a direct route would cross an intervening cell
(e.g. link-poster's A1→C1 "triggers" skip-link, which still buses cleanly).

Lane separation: each gutter assigns lanes (traces first by traceIndex, then
standalone links), centered with `offset=(lane-(count-1)/2)*GUTTER_PITCH`
(PITCH=20). A trace's two hops share `laneGroupKey t{idx}` → same gutter X → one
continuous colored thread through the hub. `ROUTING_GUTTER=72` widens the gap
and `cellVAlign='center'` is set — both gated on `doc.links.length > 0` so only
link/trace posters change; every other executive poster stays byte-identical.

### 3) Authoring rules for clean class-hub traceability (the hybrid pattern)

- Class grammar uses a FIXED 2-column grid (`rows=ceil(n/2)`, fill col0 then
  col1). It is never a single tall column. To make trace TARGET classes reachable
  from the LEFT gutter, declare them FIRST so they land in col0 (left edge).
  Using 3 classes (e.g. AuthController, TokenService in col0; SessionCache in
  col1) gives a naturally tall hub with both targets left-facing.
- A 3-column trace through a class hub is fundamentally awkward: the hub class
  must connect LEFT (entry) AND RIGHT (exit), but the 2-col class grid puts a
  neighbor on the right → crossing. The hybrid layout (enter hub from left, exit
  back to left) is the ONLY clean layout for a class-diagram hub — exactly the
  user's directive. Both trace figures (trace-poster, crosslink-poster) now use
  it; the 3-column crosslink-poster was converted to hybrid.
- Author left cells as BRANCHING flows (`SPEC --> REQ12`, `SPEC --> REQ13`) so
  trace SOURCE nodes are terminal and sit at the gutter-facing right edge; this
  avoids intra-cell crossings (`corridorBlocked` only detects CELL crossings,
  not sibling-node crossings within a wide LR flow).

### Files changed

- `packages/core/src/frontend/mermaid/poster.ts`: span DSL (regexes,
  `makeSpanningCell`, columns derivation), `PosterCellDef.colSpan/rowSpan`.
- `packages/core/src/frontend/mermaid/index.ts`: direct routing
  (`emitDirectEdge`, `CellRect`, `RouteMode`, `RouteRecord`, `corridorBlocked`),
  `resolveAndDrawLinks` rewrite, layoutTheme widening gated on links,
  GUTTER_PITCH=20, ROUTING_GUTTER=72.
- `packages/core/src/composition/layout.ts`: spanning-cell width (Pass 1a') and
  height (Pass 2') track distribution in `computeGridLayout`.
- `examples/gallery/poster-trace.mmd` + `design/figures/src/trace-poster.mmd`:
  hybrid 2x2 (A1/A2 wide LR branching flows, B1:B2 tall class hub, two
  `satisfies` traces REQ-12/REQ-13).
- `examples/gallery/poster-crosslink.mmd`: grid 2x1 links demo, branching A1,
  reordered B1 classes so link targets face the gutter.
- `design/figures/src/link-poster.mmd`: branching A1, reordered classes; keeps
  the A1→C1 "triggers" skip-link as a bus-fallback demonstration.
- `design/figures/src/crosslink-poster.mmd`: converted 3x1 → hybrid 2x2.
- `design/sections/30b-cross-diagram-links.tex`: new `\subsubsection{Cell Spans
  in the Poster DSL}` (label `sec:cdl-cell-spans`); updated link/trace listings,
  figure captions, and prose to the hybrid + direct-routing reality.
- `packages/core/test/crosslink.test.ts`: Group F span-DSL tests (F1–F6).

### Visual verdict

- `trace-poster.png` / `crosslink-poster.png`: balanced left stack vs right hub;
  the tall hub aligns to the combined height of the two equal-width left cells;
  traces are direct, lane-separated colored threads through the central gutter
  with arrowheads at boundaries and NO line crossing any non-endpoint node; no
  labels over boxes (legend only). Genuinely clean.
- `link-poster.png`: two adjacent links route directly through the gutter; the
  non-adjacent "triggers" skip-link cleanly falls back to the bottom bus —
  demonstrating both routing modes in one figure.
- Minor: the class hub leaves some whitespace in its lower third (class grammar
  is intrinsically short); vertical centering keeps it balanced rather than
  top-heavy.
- Full suite: 2725 tests / 53 files pass. Changed goldens: poster-trace and
  poster-crosslink (svg+png) plus the three design figures only; all others
  byte-identical. `design/main.pdf` rebuilt (3.45 MiB), pre-existing LaTeX
  warnings only.


---

## Learnings — Geometry Quality Gate (2026-06-16)

**Summary:** Completed the geometry-quality kernel validation, post-render gate, and pseudo-state anchor fix. All poster renders confirmed CLEAN by both kernel measurement and visual inspection. 2770 tests pass.

### 1. Acid-Test Validation Results (old posters)

Ran `detectDefects` on the **current** (new-routing) renders of the committed poster MMDs:

| Poster | nodes | edges | Kernel verdict |
|---|---|---|---|
| poster-crosslink.mmd | 10 | 2 | **CLEAN** |
| poster-trace.mmd | 12 | 4 | **CLEAN** |
| link-poster.mmd | 14 | 3 | **CLEAN** (after fix) |
| crosslink-poster.mmd | 12 | 4 | **CLEAN** |
| trace-poster.mmd | 12 | 4 | **CLEAN** |

The synthetic acid tests (A1, A2, A3) prove the kernel is trustworthy:
- A1: `edgeThroughNode` flagged when an edge clearly crosses a non-endpoint node.
- A2: `labelOverNode` flagged when a label box overlaps a non-owner node.
- A3: CLEAN geometry returns CLEAN — no false positives.

One real defect was FOUND during validation: `design/figures/src/link-poster.mmd`'s `A1.ship → C1.Shipped` link initially produced `edgeThroughNode` against node `0,2:__end__` (the terminal `[*]` pseudo-state in the stateDiagram cell). This confirmed the kernel is genuinely trustworthy (it catches real routing defects) and revealed a bug in the state anchor registry.

### 2. Root Cause: State Pseudo-State Anchor Bug

**Problem:** `layoutState` was including ALL placed states (including `__start__`, `__end__`, fork, join, choice pseudo-states) in the `NodeAnchorRegistry`. These appeared as node obstacles in the geometry kernel's scoring, causing any route that approached a real state node "from behind" the pseudo-state to be penalized — and in the case where ALL candidates had such a crossing, the kernel still chose the best available route (bus route to `Shipped`), which crossed `__end__`.

**Fix (state/layout.ts line ~728):**
```typescript
// Before (wrong): also skipped real states when isPseudo === null
if (s.node.isPseudo !== null) continue; // null !== null is false → ok
                                         // undefined !== null is TRUE → skips real states!
// Intermediate wrong attempt (wrong):
if (s.node.isPseudo !== undefined) continue; // also wrong — skips null too

// Correct:
if (s.node.isPseudo) continue; // truthy: 'start'|'end'|'fork'|'join'|'choice' → skip
                                 // falsy: undefined (real states) or null (test fixtures) → keep
```

**Why `undefined`:** The `StateNode.isPseudo` field is declared `isPseudo?: PseudostateKind` (optional), so real states have `isPseudo === undefined`. Test fixtures use `isPseudo: null` for real states (explicit null). The truthy-check handles both correctly.

**Consequence:** After the fix, pseudo-states are excluded from the anchor registry. This means:
1. They can't be referenced as link/trace targets (correct — authors use real state names).
2. They don't appear as obstacles in the kernel's nodeBoxes (correct — they're rendering artifacts).
3. Routes to real states near pseudo-states score cleanly.

### 3. Router Wiring Status (from prior session, confirmed)

The router was already wired with the geometry kernel by the prior session:
- `enumerateHopCandidates()` produces: h-right, h-left, v-down, v-up (direct gutter routes), + bus fallback.
- `pickBestRoute(candidates, ctx)` scores each against all node boxes + committed edges + committed labels.
- Hard penalties: `throughNode=1000`, `labelOverNode=600`, `outOfBounds=800` — defective routes never chosen when a clean alternative exists.
- The router is fully deterministic and closed-form (no stochastic search, no randomness).

### 4. Post-Render Gate: visual-quality.test.ts

**File:** `packages/core/test/visual-quality.test.ts` (NEW — 9 tests)

Structure:
- **Group A (acid tests):** synthetic bad geometry → kernel correctly flags `edgeThroughNode` and `labelOverNode`; clean geometry → CLEAN. Proves kernel trustworthiness before trusting gate results.
- **Group B (gallery posters):** render `poster-crosslink.mmd` and `poster-trace.mmd`; assert `qualityGeometry.clean === true` and zero `edgeThroughNode`/`labelOverNode` counts.
- **Group C (design figures):** render `link-poster.mmd`, `crosslink-poster.mmd`, `trace-poster.mmd`; same CLEAN assertion.
- **Group D (report helper):** `D1` prints `formatDefectReport` for all 5 posters — human-readable, CI-visible.

The test reads real `.mmd` files from `examples/gallery/` and `design/figures/src/`, renders via `renderMermaid`, and accesses the `qualityGeometry` field returned in `MermaidRenderResult`. If `qualityGeometry` is absent (no overlay links), the test throws a setup error (not a quality error).

### 5. Golden Changes

- `design/figures/link-poster.png`: **CHANGED** — pseudo-state anchor fix + state anchor exclusion changed the node count and routing for `ship → Shipped`. All 3 links now drawn clean (was: link present but defective).
- `examples/gallery/poster-trace.png`: **UNCHANGED** vs HEAD (already updated in prior routing-rewrite session).
- `examples/gallery/poster-crosslink.png`: **UNCHANGED** vs HEAD (already updated in prior routing-rewrite session).
- `design/figures/crosslink-poster.png`, `trace-poster.png`: **UNCHANGED** vs HEAD.
- All other goldens: **BYTE-IDENTICAL**.

### 6. Full Test Suite

**2770 tests pass (55 test files)** — up from 2761 (prior session) plus 9 new visual-quality tests.

### 7. What Remains — Extending Quality to Other Grammars

The current kernel gate covers ONLY cross-diagram overlay geometry (poster links/traces). Single-diagram geometry quality is not yet gated:
- flow, class, state, sequence, etc. do their own node-edge collision avoidance internally
- No `qualityGeometry` is returned for non-poster renders
- Future: add a `sceneToLabeledGeometry(scene)` helper that extracts geometry from Scene primitives (rects as node boxes, paths as edges, text as labels), then run `detectDefects` on it
- This would catch regressions like a flow layout that accidentally overlaps two nodes or a label outside the canvas

Also remaining: expose `WithAnchors` variants for sequence, er, c4, architecture, gantt, mindmap, tree, block, kanban, requirement, timeline, quadrant — enabling `link`/`trace` references to nodes in these grammars.
