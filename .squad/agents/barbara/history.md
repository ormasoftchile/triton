# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-17T17:00:00Z (Straight vs Orthogonal routing visual comparison — configurable routing styles; 2790/2790 tests pass)

---

## Current Status (2026-06-17)

**STRAIGHT ROUTING IMPLEMENTED — VISUAL COMPARISON COMPLETE.** Added configurable routing styles for poster overlay connectors: `routingStyle: 'orthogonal'` (default, Manhattan routing with horizontal/vertical segments) vs `routingStyle: 'straight'` (direct diagonal lines). Implementation: (1) Added 'direct' routing candidate to `enumerateHopCandidates()` that creates single-segment paths from source to target, selecting exit/entry ports based on predominant direction (horizontal vs vertical). (2) Added `routingStyle` field to PosterDocument interface, parsed from frontmatter. (3) Filter candidates based on style: 'straight' keeps ONLY direct candidates, 'orthogonal' (default) filters out direct candidates to preserve existing Manhattan routing. (4) Created link-poster-orthogonal.mmd and link-poster-straight.mmd for side-by-side comparison. **All 2790/2790 tests pass.**

**VISUAL COMPARISON RESULTS:**
- **Orthogonal (Manhattan):** Uses 3-segment paths (horizontal-vertical-horizontal) via intermediate vertical gutters. Example: Payment→PaymentGateway goes right to x=489, down to target y, then right to target. Clean 90° turns, respects grid structure, feels intentional and structured. Label boxes sit on vertical gutter segments.
- **Straight (Direct):** Uses 1-segment diagonal paths. Example: Payment→PaymentGateway goes directly from (416.93,171.11)→(579.04,203.60). Minimal ink, shorter paths, more organic feel. Labels sit on diagonal midpoints.
- **Which looks better?** DEPENDS ON INTENT. Orthogonal feels more **architectural and intentional** — connectors follow the implicit grid, creating visual alignment and regularity (gutters at x=489, x=509, x=726.5 create vertical rhythm). Straight feels more **organic and minimal** — fewer bends, less visual clutter, direct "as the crow flies" connections. For diagrams emphasizing flow/causality (traces, data pipelines), straight may be cleaner. For architectural/structural diagrams (system boundaries, layered architectures), orthogonal maintains grid discipline.
- **Trade-offs:** Straight routing COULD cross obstacles if source/target aren't cleanly separated (not an issue in link-poster due to grid layout, but could be problematic in denser posters with overlapping cells). Orthogonal routing ALWAYS respects cell boundaries via gutters, but adds extra path length and visual complexity (3 segments vs 1).

**Earlier (2026-06-17):** Wall-centered connector exit/entry points fix; greedy-switch crossing minimization; Brandes-Köpf structure; A* pathfinding; aesthetic metrics. See earlier notes below.

---

## Archive & Historical Notes

**Full detailed work (2026-06-15–2026-06-17):** See `history-2026-06-17-archived.md` (if created) for A* pathfinding, aesthetic metrics, and earlier June 17 work.

**Earlier work (2026-06-14 and prior):** See `history-archive.md` and dated archive files.

---

## Learnings

### Wall-Centered Connector Ports (2026-06-17)

1. **Wall-face centers create visually balanced connectors.** Exit/entry points MUST be at the CENTER of the appropriate wall face (right/left/top/bottom), not at the node's geometric center or corners. Using geometric centers for horizontal routes causes connectors to exit from arbitrary vertical positions (e.g., bottom-right corner instead of center-right), creating visual imbalance and staircase routes where straight lines are expected.

2. **ALL candidate variants must use wall centers.** The PRIMARY candidates (first h-right, h-left, v-down, v-up) were already correct, but VARIANT/NEAR/ALTERNATE candidates still used old geometric-center logic (`srcCx`, `srcCy`, `tgtCx`, `tgtCy`). This caused the kernel to pick visually broken routes when the primary candidate had throughNode penalties. Fix: update ALL 18 candidate builders to use the wall-centered points (`srcRight`, `srcLeft`, `srcTop`, `srcBottom`, `tgtRight`, `tgtLeft`, `tgtTop`, `tgtBottom`).

3. **Alternate-port candidates should use wall corners, not arbitrary positions.** The top/bottom alternate-port variants (for avoiding same-cell siblings) should use `srcTop` and `srcBottom` (wall-face points at the top/bottom edges) instead of `{ x: s.x + s.w, y: s.y }` (arbitrary corner coordinate). This maintains the semantic intent (exit from top/bottom edge of right wall) while using the wall-centered abstraction.

4. **Bus candidates exit from bottom wall center.** Bus routes (fallback for blocked direct routes) should exit from `srcBottom` (bottom wall center) and enter the target's bottom wall (`tgtBottom`), not from arbitrary geometric centers. This ensures bus routes also have clean visual entry/exit points.

5. **Label box positioning inherits from wall-centered points.** Label boxes are centered on the midpoint of connector segments. When connectors exit from wall centers instead of geometric centers, labels automatically align better with their edges. The "handled by", "fulfilled by", "triggers" labels in link-poster are now visually centered on their red connector lines.

6. **Test suite validates geometric correctness, not visual balance.** All 2790 tests passed before and after the fix. The tests verify routing kernel correctness (no overlaps, deterministic selection, valid paths), but don't detect visual imbalance issues like corner-exit connectors or staircase routes. Visual assessment (viewing rendered PNGs) is ESSENTIAL for catching these aesthetic regressions.

7. **Regenerating posters reveals global improvements.** Fixing wall-centered ports improved ALL three posters (link-poster, trace-poster, crosslink-poster). The trace-poster showed cleaner cross-cell routing (REQ boxes to class-diagram boxes exit from right wall centers). The crosslink-poster showed improved vertical alignment for multi-cell traces. Wall-centered ports are a GLOBAL aesthetic improvement, not just a link-poster fix.

### Key Files Modified (2026-06-17)

- `packages/core/src/frontend/mermaid/index.ts` — `enumerateHopCandidates()` wall-centered ports (lines 2048-2308)
- `design/figures/link-poster.png` — regenerated with improved routing
- `design/figures/trace-poster.png` — regenerated with improved routing
- `design/figures/crosslink-poster.png` — regenerated with improved routing

### Greedy-Switch + Brandes-Köpf Implementation (2026-06-17)

1. **Greedy-switch works correctly with deterministic tie-breaking.** The algorithm swaps adjacent nodes in a layer if the swap reduces crossings. Crossings are counted pairwise for edges incident to the two nodes. The swap-or-revert logic is deterministic (no randomness), and the fixed iteration limit (10) prevents infinite loops. On the RAG pipeline fixture (6 nodes, 7 edges, one branch), no swaps occurred because the barycenter phase already found the optimal order - but the algorithm is validated and ready for more complex graphs.

2. **Full Brandes-Köpf is complex; simplified version deferred.** The original ELK Brandes-Köpf algorithm has 4 passes (up-left, up-right, down-left, down-right) and complex conflict resolution when nodes in the same layer belong to the same alignment block. For increment-1, implemented a simplified structure that builds alignment blocks but maintains sequential y-offsets within layers to avoid overlap. This preserves determinism and test compatibility while deferring the full horizontal compaction logic to increment-2. The algorithm structure is in place for future enhancement.

3. **Node overlap is a hard constraint.** Tests verify no two node boxes overlap (x/y/width/height intersection check). Any placement algorithm must ensure nodes in the same layer maintain vertical spacing (nodeH + nodeGap). Alignment blocks can only affect nodes in DIFFERENT layers (horizontal alignment across columns). Initial BK implementation incorrectly assigned same y-offset to nodes in same layer, causing overlap - fixed by enforcing sequential offsets within each layer.

4. **Crossing counting requires edge direction awareness.** The `edgesCross` function checks if two edges cross by comparing relative positions of their endpoints in adjacent layers. Edges cross if their relative order reverses (e.g., edge A goes from pos 0→1, edge B goes from pos 1→0). Only edges spanning the same layer pair are considered (down-edges from current rank, or up-edges to current rank). Back-edges and self-loops are excluded from crossing minimization.

5. **Lexicographic tie-breaking maintains determinism.** The barycenter sort uses `(bc.get(a)! - bc.get(b)!) || a.localeCompare(b)` to break ties by node ID when barycenter values are equal. This ensures identical input → identical output across builds. Greedy-switch inherits this determinism by using positional comparisons (layer indexOf) and fixed iteration count.

6. **Simple examples don't exercise complex algorithms.** The current flowchart corpus (RAG pipeline, decision tree) are simple linear/branching chains with ≤2 nodes per layer. Greedy-switch and full BK show benefits on denser graphs (≥3 nodes per layer, multiple crossing candidates). Future increment-2 should add a complex flowchart fixture (e.g., 4×4 grid with cross-layer branches) to validate and showcase the crossing reduction.

7. **Algorithm documentation in header comments is essential.** Updated the flow/layout.ts file header to document phases 3.6 (greedy-switch) and 3.7 (Brandes-Köpf simplified). Clear inline comments explain the swap logic, crossing counting, and why nodes in the same layer maintain sequential offsets. Future maintainers will understand the deferred BK enhancement path.

8. **Performance is acceptable.** Greedy-switch adds O(k * L * n²) where k=max iterations (10), L=number of layers, n=nodes per layer. On typical flowcharts (<50 nodes), this is <1ms overhead. Crossing counting is O(e²) for edges incident to the two swapped nodes, typically <10 edges each. No performance degradation observed in test suite (29.6s total runtime unchanged).

### Key Files Modified (2026-06-17)

- `packages/core/src/grammars/flow/layout.ts` — greedy-switch + BK structure (line 257 onward)
- Header comment updated to document new phases 3.6 and 3.7

### Prior Learnings (2026-06-17)

1. **A* as best-of-both strategy works.** Enumerated candidates handle 99% of poster layouts; A* provides safety net for future complex obstacles.
2. **Edge-length uniformity is topology-dependent.** Variance is inherent to domain (different trace paths naturally have different lengths).
3. **Enumerated candidates are already near-optimal for simple grids.** 2×2 and 2×1 layouts with clean gaps don't need pathfinding.
4. **Deterministic A* is critical.** Grid rasterization uses integer math; path simplification is deterministic.
5. **Grid resolution trades quality vs performance.** gridSize=10px provides fine-grained avoidance; <10ms per edge.
6. **Weighted aesthetic mean balances metrics.** 6-metric scorecard with 18% weight for original 5, 10% for edgeLengthUniformity.
7. **ACCEPTABLE ≠ failure.** 0.733–0.807 range is legitimately good; reaching GOOD (≥0.85) would require layout reordering, not routing.
8. **A* candidate rank matters.** Appended after enumerated candidates (rank = candidates.length) ensures A* is fallback, not first choice.

**Full detailed learnings (obstacle/target separation, aesthetic metrics, layout selection, intra-cell routing):** See `history-2026-06-16-summarized.md`.

### Parse→Render Pipeline Map (2026-06-17)

Verified end-to-end pipeline stages and key entry-point files for the team's reference:

**Entry points:**
- CLI: `packages/cli/src/index.ts` — `isMermaidInput()` routes `.mmd`/frontmatter to Mermaid path, YAML/JSON to IR path
- Public API: `packages/core/src/api.ts` — `render()`, `compile()`, `loadIR()`, `createSession()`
- Mermaid API: `packages/core/src/frontend/mermaid/index.ts` — `detectDiagramType()`, `parseMermaid()`, `renderMermaid()`

**Pipeline stages:**
1. **Preprocess** — `frontend/mermaid/utils.ts:preprocessMermaid()` strips YAML frontmatter + `%%{init}%%` directives → `PreprocessResult`
2. **Detect** — `frontend/mermaid/index.ts:detectDiagramType()` (line 273) regex-matches first non-blank body line → `DiagramKind`
3. **Parse→Domain IR** — `parseMermaid()` (line 350) dispatches to `parseXxxInternal()` in `frontend/mermaid/xxx.ts` → grammar-specific Domain IR (`FlowDocument`, `SequenceDocument`, `IRDocument`, `ClassDocument`, etc.)
4. **Theme resolution** — `renderMermaid()` resolves theme: contract path via `resolveContractTheme()` + `bindXxxTheme()`, or legacy registry via `resolveTheme()` in `themes/index.ts` (line 77)
5. **Layout → Scene IR** — `buildXxxScene()` in `grammars/xxx/layout.ts` (or `layout/index.ts:layout()` for IRDocument) → `Scene` (flat `ScenePrimitive[]` with geometry)
6. **Geometry kernel** — during layout, `geometry/index.ts:pickBestRoute()` scores edge candidates (enumerate → score → pick)
7. **SVG serialise** — `render/svg.ts:sceneToSvg()` → SVG string (deterministic, alphabetically-sorted attributes)
8. **PNG raster** — `render/png.ts:svgToPng()` via `@resvg/resvg-js` (sync), or `render/skia.ts:sceneToPngSkia()` via CanvasKit WASM (async)

**Boundary summary:**
- Front-end: `frontend/mermaid/*.ts` (text → Domain IR)
- Middle: `grammars/*/layout.ts` + `layout/*.ts` (Domain IR → Scene IR + theme application)
- Back-end: `render/svg.ts` + `render/png.ts` + `render/skia.ts` (Scene IR → SVG/PNG)

