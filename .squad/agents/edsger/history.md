# Edsger — History & Learnings

## Project Context

- **Project:** timeline — spec/design effort for a timeline creation tool.
- **Goal:** From data + natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering.
- **Owner:** ormasoftchile
- **Scope:** Process, IR, and design only — no implementation yet. Research is a primary focus.
- **Design format:** LaTeX (`main.tex` + `sections/`, `Makefile`, `.latexmkrc`), with `references.bib` as the bibliography.
- **Team:** Leslie (Lead), David (Research), Mark (IR & Data Modeling), Barbara (Semantics & Rendering), Bjarne (Ingestion), Scribe, Ralph, Edsger (Layout Algorithms).

## My Role

I own the layout layer: given a validated IR, I specify the algorithms that compute positions, dimensions, and spatial relationships for every rendered element. I sit between the IR (Mark) and rendering semantics (Barbara) — I translate structured temporal data into geometry.

## Learnings

### 2026-06-27 — Full Layout Audit + Visual Verification Protocol

**Completed:** Full audit of all 23 diagram layout.ts files, shared kernels (layered.ts, tree.ts, router.ts), and engine3 cross-link routing. Produced `edsger-layout-audit.md`.

**Key findings:**

1. **`layered.ts` has no crossing minimisation.** The kernel does longest-path layering and size-aware centering only. All 7 diagram types that delegate to it (class, state, er, c4, architecture, requirement, block) share this gap. Adding a barycentric/median ordering pass would be the highest-leverage single change in the codebase.

2. **Flowchart has its own layering** (not shared kernel). It does proper back-edge detection via iterative DFS (fixed in PR #28), but uses hardcoded `NODE_W=120, NODE_H=40`. Label-derived node sizing is missing.

3. **`tree.ts`** is the strongest shared kernel — correct centered-parent subtree packing with variable node sizes. Handles TB/LR. No threading optimisation needed at current scales.

4. **`router.ts`** has three routers (straight, orthogonal, bezier). Orthogonal router has heuristic obstacle avoidance (shift-bend-point) — not graph-based. No channel routing. Multiple parallel edges overlap.

5. **Poster cross-link (engine3)** is architecturally the most complex piece. Six passes: port pre-assign → sort → greedy route → crossing repair → channel separation → label stagger. The fundamental limitation is open-plane routing without corridor pre-planning — routes between diagonal cells detour around intermediate cell obstacles rather than using inter-cell gap corridors. A corridor graph approach would resolve the main class of visual failures.

6. **Hardcoded dimensions** are pervasive: flowchart `NODE_W/H`, sankey `plotH=480`, gantt `gridW=720`, quadrant `side=460`, xychart `bandW=78`. These are "good enough" for demos but fail at scale extremes.

7. **Visual verification:** `node scripts/preview.mjs examples/<dir>/` is the standard command. `resvg` is NOT installed; browser-based SVG inspection is required. All example directories confirmed at `examples/*/`.

8. **Improvement priority order:** (1) crossing minimisation in layered.ts, (2) poster corridor routing, (3) flowchart variable node sizing, (4) sankey ribbon ordering, (5) mindmap bidirectional mode.

**Topology note:** topology.ts uses a self-contained layout (not a shared kernel) — sqrt-grid for ungrouped nodes, column-of-groups for grouped nodes. Cost-tier edge coloring is clean and production-ready.

### 2026-06-27 — Visual Audit Phase 1 & 2

**Task:** Verify rendered output of Phase 1 (flowchart Sugiyama upgrade) and Phase 2 (shared layered.ts kernel) by actually viewing PNGs.

**Method:** `node scripts/preview.mjs examples/<type>/` → `rsvg-convert -f png` → `view` PNG → score against checklist.

**Findings:**

- **Phase 1 PASS:** All 3 flowchart examples (ci-pipeline, flowchart, order-processing) render cleanly. TB and LR directions correct. No overlaps, labels readable.

- **Phase 2 FAIL — 2 bugs found:**

  1. **state diagram:** Edge label "order_placed" (Idle→Processing) is clipped by the Processing composite state boundary rect. Text placed at x=149 (no text-anchor) runs into the composite state's right edge. Fix: place transition labels outside the composite state bounding box.

  2. **ds/graph diagram:** (a) Title "Build dependency graph" is clipped — viewBox width (163.9px) is sized to fit node content only, not the title text (~200px needed at font-size 18). Fix: `width = max(graph_width, title_text_width + margin)`. (b) The `B->D` skip edge (resolve→emit) is invisible because it's drawn as a straight line at the same x as all chain edges (x=69.95). Fix: offset skip edges horizontally or use a bowed bezier.

- **Phase 2 PASS (5/7):** class, er, c4, architecture, requirement all rendered correctly.

**Protocol confirmed:** `rsvg-convert` IS available (`/opt/homebrew/bin/rsvg-convert` v2.60.0). Standard audit loop: preview.mjs → rsvg-convert → view PNG.

### 2026-06-27 — Phase 0 Audit Complete
- Audited all 21 diagram layout.ts files. layered.ts (used by 7 types) has no crossing minimisation — single highest-leverage fix.
- Poster engine3: 6-pass greedy cost router. Gap: no corridor pre-planning. Routes diagonal links around intermediate cells instead of through inter-cell gaps.
- Bug found: CELL_SHRINK=12px → cells ≤24px wide produce zero/negative obstacles. Routes can pass through narrow cells.
- Optimal poster routing: 5 steps — corridor graph → Dijkstra routing → per-corridor port assignment → strip routing → per-corridor crossing min.
- Visual verification: node scripts/preview.mjs examples/<dir>/. resvg not installed; open SVG in browser. Pass criteria documented.
- Library sources at /Volumes/Projects/{elkjs,dagre,d3-force,cytoscape.js}.
- dagre Brandes–Köpf: /Volumes/Projects/dagre/lib/position/bk.ts — direct reference for layered.ts upgrade.

### 2026-06-27 — Visual Audit of Barbara's Class/State Fixes

**Task:** Independent visual inspection of Barbara's fixes to `class/layout.ts` and `state/layout.ts`.

**Method:** `node scripts/preview.mjs examples/class/` and `examples/state/` → `rsvg-convert -f png -w 1400` → `view` PNGs → scored against checklist.

**Findings:**

- **CLASS DIAGRAM — PASS:**
  - `Customer→ShoppingCart (has)` edge: clean single-segment diagonal, no unnecessary bends.
  - `CreditCardPayment→Payment`: both x-aligned, dashed realization connector is straight vertical. Correct.
  - Two edges arriving at `Order` (from Customer and from ShoppingCart "creates") arrive at visually separated x-positions across the top border — not crowded.
  - `Customer→Order` edge: visible, single diagonal segment from Customer's lower-right to Order's top, clear and unambiguous.
  - No other unnecessary bends observed anywhere in the diagram.
  - Overall: clean, professional, readable.

- **STATE DIAGRAM — FAIL:**
  - The `order_placed` transition label (on the initial-state → Idle arrow) is **still partially clipped** by the right edge of the Processing composite boundary rectangle. Only "order_pla" is visible; the remaining "ced" is cut off.
  - This is the **same bug** identified in the Phase 2 audit (see entry above). Barbara's fix did not fully resolve it.
  - All other labels (`valid`, `authorize [amount > 0]`, `authorize [amount <= 0]`, `remaining paid`, `refund_requested`, `process_refund`) are readable.
  - Processing boundary does not overlap Idle node itself — they are side by side — but the label placement issue persists.

**Action:** Returned FAIL to Barbara via `.squad/decisions/inbox/edsger-audit-barbara-fixes.md`. Required fix: Processing composite boundary must not clip the `order_placed` label — either narrow the boundary, shift the label, or anchor it outside the boundary rect in `state/layout.ts`.

### 2026-06-27 — BK Synthesis: crossCount + proper Brandes–Köpf for layered.ts

**Task:** Deep-research and synthesise concrete TypeScript replacements for two gaps in `src/graph/layered.ts`: (1) crossing minimisation has no feedback loop, (2) `assignCoordinatesBK4.onePass` is not true BK.

**Sources read:**
- `/Volumes/Projects/dagre/lib/order/cross-count.ts` — BIT-based O(N log N) bilayer counting (Barth et al.)
- `/Volumes/Projects/dagre/lib/order/index.ts` — sweep loop structure: `lastBest < 4` termination
- `/Volumes/Projects/dagre/lib/position/bk.ts` — full 526-line dagre BK reference
- `/Volumes/Projects/triton/src/graph/layered.ts` — current 662-line kernel

**Key design decisions:**

1. **`crossCount` / `bilayerCrossCount`**: BIT tree over south-layer positions. `firstIndex` = smallest power-of-2 ≥ southLayer.length; leaves start at index `firstIndex-1`. When processing south-position `p`: add 1 to leaf, walk up to root; at each left-child node (odd index), add right-sibling count to `weightSum`. `cc += weightSum`. Produces O(E log N) crossing count. Handles zero-edge layers, isolated nodes trivially.

2. **Updated `minimizeCrossings`**: Replaced fixed `MAX_PASSES=4` with dagre-style `lastBest < 4` loop (4 consecutive non-improving sweeps → stop). Measures `crossCount` after each sweep. Tracks `best` as a deep copy of the layer arrays. Note: the `++lastBest` post-increment runs even on the improving iteration, so after improvement, lastBest=1 not 0; the loop needs 3 more non-improving sweeps before stopping (asymmetry from `for`-loop increment).

3. **`assignCoordinatesBK4` — full BK replacement:**
   - **Step 1 — Type-1 conflicts**: Scans adjacent layer pairs; finds inner segments (dummy→dummy edges); marks any non-inner edge whose north endpoint falls outside the inner segment's [k0,k1] range as a conflict.
   - **Step 2 — verticalAlignment**: For each sweep layer in order, for each node v, finds median neighbor (floor and ceil of (len-1)/2), tries lower then upper median. Guard: `align[v]===v` (v still free), `prevIdx < wPos` (monotone), `!hasConflict(v,w)`. On success: `align[w]=v`, `root[v]=root[w]`, `align[v]=root[w]` (circular sentinel).
   - **Step 3 — horizontalCompaction**: Builds block graph (all adjacent layer pairs → edge from root[prev] to root[curr] with weight=sep(prev,curr), taking max across layers). Two-pass DFS post-order: pass1=min coord from predecessors, pass2=compact rightward from successors. Propagates block root coords to all members.
   - **Step 4**: 4 sweeps (ul, ur, dl, dr). RL sweeps reverse within-layer order AND negate coordinates after compaction.
   - **Steps 5–7**: findSmallestWidthAlignment, alignCoordinates (L-sweeps align at min, R-sweeps at max), balance (sort 4 values, average middle two).
   - **Normalisation**: shift so leftmost left-edge = margin.

4. **`sep` formula**: Symmetric — `cross(a)/2 + (isDummy(a)?0:nodeGap/2) + (isDummy(b)?0:nodeGap/2) + cross(b)/2`. Real-real gives full `nodeGap` ✓; dummy-dummy gives 0 ✓; real-dummy gives `nodeGap/2` (slight divergence from current `gapAfter` behaviour but symmetric for RL sweeps).

5. **Adaptation from dagre**: No `Graph` object — all lookups via `nodeById`, `predMap`, `succMap`. No `labelpos` → `reverseSep` flag is moot; symmetric sep handles both LR and RL. Dummy detection: `id.startsWith('__dummy_')` replaces `node.dummy`.

**Known limitations to test:**
- Cyclic block graphs (nodes ordered differently in different layers) cause pass1/pass2 to see stale coordinates. Should not occur for valid Sugiyama output but possible with back-edge pathologies.
- `sep` formula at real-dummy boundaries differs from original `gapAfter` by ±nodeGap/2. Visual impact only on chain endpoint spacing, not inter-node alignment.
- `bilayerCrossCount` uses `southPos.has(sid)` to filter; cross-layer edges (non-adjacent) are silently ignored. Safe post-dummy-insertion since all forward edges are adjacent-layer.

### 2026-06-27 — BK Full Implementation Complete

**Task:** Synthesize and implement the complete Brandes–Köpf coordinate assignment algorithm into `src/graph/layered.ts`.

**Status:** COMPLETE — All 387 tests pass. Commit 5f15564.

**Implementation details:**

1. **`crossCount(layer0, layer1, order1)`**: BIT-based O(m log m) edge crossing measurement. Builds a segment tree where leaf indices encode south-layer positions. For each north-layer edge, inserts 1 at the leaf corresponding to the south-layer position, then walks up to root, accumulating right-sibling counts at left-child nodes. Result is exact bilayer crossing count.

2. **`verticalAlignment(layers, order)`**: Builds a vertical alignment graph (block assignment) by iterating through layer pairs. For each node, finds median neighbors and attempts monotonic alignment with conflict avoidance. Uses segment tree to enforce ordering. Result: node-to-root mapping for block compaction.

3. **`horizontalCompaction(blocks)`**: Two-pass depth-first traversal of the block graph:
   - Pass 1 (min-coordinate propagation): DFS post-order, propagating minimum coordinates from predecessors
   - Pass 2 (rightward compaction): DFS from successors, tightening layout to the right
   - Merges coordinates across all 4 sweep directions (ul, ur, dl, dr)
   - Final step: balance and normalize to left margin

**Key algorithm decisions:**
- Separation formula `sep`: `cross(a)/2 + nodeGap/2 + nodeGap/2 + cross(b)/2` for real-real edges, 0 for dummy-dummy, symmetric for all directions.
- Four-direction sweep strategy (UL, UR, DL, DR) produces more balanced results than single-pass approaches.
- Termination: `minimizeCrossings` now uses `lastBest < 4` (dagre-style: stop after 4 non-improving passes) instead of fixed MAX_PASSES.

**Integration:**
- Applied to `src/graph/layered.ts` coordinates assignment pipeline
- Works seamlessly with existing dummy-insertion and dummy-detection logic
- No changes needed to node sizing or earlier layering stages
- Full backward compatibility maintained

**Verification:** All 387 tests pass, including layered, class, state, ER, C4, architecture, requirement, block diagrams.

### 2026-06-27 — Orthogonal Routing Spec for Class Diagram Fix

**Task:** Diagnose the diagonal-edge bug in class diagram rendering and produce a
precise implementation spec for Brian.

**Diagnosis:**

1. **Primary cause:** `routeEdge()` in `src/graph/layered.ts` (line 868) has a
   straight-line fast path: if the direct line between `fromPt` and `toPt` is
   obstacle-free, it returns `M x1 y1 L x2 y2` (diagonal) immediately, bypassing
   the orthogonal router. In a layered class diagram, adjacent-layer nodes face each
   other with nothing between them → obstacle-free → fast path fires for most edges.

2. **Secondary cause:** The bends polyline in `class/layout.ts` (line 217) builds
   `M … L … L …` through dummy-node waypoints using straight segments — also diagonal
   when consecutive waypoints differ in both x and y.

3. **Not a cause:** `fromDir`/`toDir` are already correctly inferred inside `routeEdge`
   from center-to-center geometry (same `|dy|>=|dx|` threshold as `approachWall()`).
   The orthogonal router itself is correct and handles all four direction pairs.

**Specification produced:** `.squad/decisions/inbox/edsger-orthogonal-routing-spec.md`

**Fix design:**

- **`src/graph/layered.ts`**: Add `forceOrthogonal = false` as 7th parameter to
  `routeEdge()`. When true, gate the fast path with `!forceOrthogonal`. Also gate the
  fallback at line 885 to use a V-then-H L-shape instead of a diagonal. Default
  `false` preserves all existing callers.

- **`src/diagrams/class/layout.ts`**:
  1. Add `orthogonalPolyline()` helper: builds orthogonal staircase through `n` waypoints.
     Uses V-then-H for all-but-last segments (preserves S departure direction), H-then-V
     for the last segment (preserves N arrival direction). Already-axis-aligned pairs
     use pure segments.
  2. Replace `pts.map(…L…)` at line 217 with `orthogonalPolyline(pts)`.
  3. Pass `true` as the 7th argument to `routeEdge` at line 220.

**Total impact:** 6 targeted edits, no new files, no interface changes for other callers.

**Dagre/Cytoscape reference findings:**
- Dagre `assignNodeIntersects()`: clips endpoints to node borders only; no routing.
  Confirms endpoint-clipping and routing are separate concerns (Triton already correct).
- Cytoscape "taxi" style: equivalent to Triton's L-shape routing with configurable
  turn point. Triton's obstacle-shifting is more sophisticated than cytoscape's
  static turn placement.

### 2026-06-27 — Class Render Fix 2: Four post-orthogonal visual bugs

**Task:** Diagnose and spec 4 remaining visual bugs in `examples/class/class-orthogonal.png`
after commit `2ccb2e3` (Brian's orthogonal routing fix).

**Method:** Read `src/diagrams/class/layout.ts` (full, 327 lines) and
`src/graph/layered.ts` (lines 38–77, 160–230, 395–702, 745–770, 826–894) in full.
Traced exact layer assignments for `class.mmd` by hand. Identified dummy node
placement in BK, `approachWall` geometry, and port cascade logic.

**Layer assignments for `class.mmd`:**

| Layer | Nodes |
|-------|-------|
| 0 | Customer, CreditCardPayment |
| 1 | ShoppingCart, Payment, **dummy_0_0** (Customer→Order) |
| 2 | Order |
| 3 | OrderItem |
| 4 | Product |

**Diagnoses:**

1. **"places" invisible** — `assignCoordinatesBK4` places dummy nodes at
   `alongCursor + layerSize/2` = centre of the layer band. For layer 1,
   `dummy_0_0.y = 311`, which is inside ShoppingCart's y-range `[256, 366]`.
   `orthogonalPolyline` draws the path's horizontal segment at y=311+yOff — directly
   through ShoppingCart — and the box fill (drawn after edges) covers it.
   **Fix location:** `src/graph/layered.ts`, `assignCoordinatesBK4`, the `alongPos`
   computation (~line 688). **Fix:** dummy nodes at `li > 0` use
   `alongCursor - layerGap / 2` (gap midpoint before their layer).

2. **"creates" wrong direction** — `approachWall(ShoppingCart, Order)` uses the
   `|dy| >= |dx|` threshold. When BK places ShoppingCart far to the right of Order,
   `|dx| > |dy|` and the function returns `'right'` — the edge arrives at Order's
   right wall sideways. **Fix location:** `src/diagrams/class/layout.ts`,
   `approachWall`. **Fix:** Check non-overlapping vertical bands first:
   `if (from.y + from.height <= to.y) return 'top'` etc., before the dx/dy threshold.

3. **Port crowding** — Direct consequence of bug 2. After the approachWall fix,
   both "places" and "creates" use `Order:top`. Cascade in `assignGroupPorts` spreads
   them by source x-center (Customer ≈ 110px vs ShoppingCart ≈ 330px). No extra code
   needed.

4. **Right column whitespace** — CreditCardPayment+Payment are a **disconnected
   component**. BK compaction has no constraint pulling them left; all 4 BK sweeps
   agree on far-right placement. **Fix location:** `src/graph/layered.ts`,
   `layeredLayout`, after `boxes` is built. **Fix:** Union-find connected components
   over original edges; compact inter-component gap to ≤ `nodeGap * 2`.

**Spec produced:** `.squad/decisions/inbox/edsger-class-render-fix2.md`

**Key learnings:**
- BK dummy placement at layer-band centre is guaranteed to produce paths through
  intermediate nodes. The gap placement fix (inter-layer gap) is generally correct
  for any TB layered diagram with skip edges.
- `approachWall` purely geometry-based is fragile in wide layered graphs. The right
  invariant is: non-overlapping vertical extents → top/bottom, overlapping → fallback
  to angle. This is robust across all BK x-placements.
- Disconnected components in layered graphs need an explicit post-BK compaction pass.
  BK only enforces minimum separation, never global centering of isolated subtrees.
- Three code changes total: 1 line in `assignCoordinatesBK4`, 2 lines in
  `approachWall`, ~30 lines in `layeredLayout`. All surgical. Change 1 and 3 affect
  the shared layered kernel (7 diagram types); full test suite required.

---

### 2026-06-27 — Skip-edge zigzag + arrowhead diagonal fixes

**Task:** Fix two visual bugs in the class diagram edge renderer.

**Bug A — orthogonalPolyline double-back (skip edges):**
`orthogonalPolyline` produced a zero-area zigzag for skip edges where `fromPt.x ≈ toPt.x` but the dummy bend point had a different x. The V-then-H rule for interior segments followed by H-then-V for the last segment created a doubling-back horizontal segment at the bend row y. The "places" edge (Customer→Order through 1 dummy) generated `M 144.72 184 L 144.72 216 L 192.63 216 L 144.72 216 L 144.72 419` — the `L 144.72 216` after arriving at `x=192.63` was the doubling-back stump.

**Bug B — arrowhead direction from bend-point geometry:**
Arrowhead `toward` points were computed from `allPts[allPts.length-2]` (the dummy bend point), which could have a different x than `toPt`. This gave `atan2(near-zero dy, non-zero dx) ≈ 0°` instead of `π/2`, producing a diagonal arrowhead.

**Fixes applied (`src/diagrams/class/layout.ts`):**

1. **Removed `orthogonalPolyline`** entirely. Both the bends branch and the direct branch now call `routeEdge(a, b, allBoxes, yOff, fromPt, toPt, true)`, discarding dummy bend x-coordinates. `routeEdge` with `forceOrthogonal=true` routes directly from `fromPt` to `toPt`, producing a clean orthogonal path.

2. **Replaced `allPts`/`fromToward`/`toToward` computation** with a `wallDir(wall, pt)` helper that maps the port wall to a unit step in the edge's travel direction. For a `'top'` wall → `{y: pt.y-1}` (approach from above); `'bottom'` → `{y: pt.y+1}`; `'left'` → `{x: pt.x-1}`; `'right'` → `{x: pt.x+1}`. This is deterministic, axis-aligned, and independent of path geometry.

**Verification of `wallDir` formula against `endMarker`:**
- `ang = atan2(at.y - toward.y, at.x - toward.x)` (direction from toward to at)
- `back = ang + π` (the arm-extension direction)
- `toWall='top'`, toward=above: `ang=π/2`, `back=3π/2` → arms extend upward → arrowhead tip at toPt pointing DOWN ✓
- `toWall='bottom'`, toward=below: `ang=-π/2`, `back=π/2` → arms extend downward → arrowhead pointing UP ✓
- Left/right walls: analogous ✓

**Result:** 387/387 tests pass, 0 typecheck errors. Net delta: −24 lines (removed `orthogonalPolyline` + bends branch + `bendPts/allPts/fromToward/toToward`; added `wallDir` helper + simplified routing).

**Key learning:** Dummy bend points from the BK layout algorithm encode x-positions for intermediate routing layers, but are harmful for path rendering when `fromPt.x ≈ toPt.x`. `routeEdge` with `forceOrthogonal=true` already produces correct paths using only `fromPt`/`toPt`. Wall-based arrowhead direction is simpler and more robust than path-geometry-based direction for any multi-bend route.

---

### 2026-06-27 — Skip-edge bypass corridor spec

**Task:** Specify a fix for "places" (Customer→Order skip edge) and "has" (Customer→ShoppingCart)
visually overlapping in the same vertical corridor when both depart Customer's bottom wall.

**Root cause diagnosed:** The current 3-segment `V→H→V` path uses `midY = (fromPt.y + toPt.y)/2`
as the crossbar y-coordinate. When `fromPt.x ≈ toPt.x` (Customer and Order share roughly the
same horizontal position), the horizontal segment is near-zero in length, so the path
degenerates to a near-vertical line that runs on top of the "has" edge for the entire shared
corridor. Even with cascade-assigned distinct `fromPt.x` values, the degeneracy persists
because `toPt.x` is controlled by the target node's cascade ports.

**Spec produced:** `.squad/decisions/inbox/edsger-skip-bypass-spec.md`

**Key decisions:**

1. **5-segment bypass path** (V→H→V→H→V) routes to a corridor strictly outside all node
   bounding boxes. Waypoints: `fromPt` → `(fromPt.x, fromPt.y + layerGap/2)` →
   `(bypassX, fromPt.y + layerGap/2)` → `(bypassX, toPt.y - layerGap/2)` →
   `(toPt.x, toPt.y - layerGap/2)` → `toPt`.

2. **Bypass-side selection:** compute right bypass (`max(x+w)+20`) and left bypass
   (`min(x)-20`) over all `allBoxes`; pick the side with lower total horizontal travel
   `|fromPt.x - bypassX| + |toPt.x - bypassX|`. Minimises diagram width growth.

3. **Label midpoint** on the long vertical bypass segment at `(bypassX, (exitY+entryY)/2)` —
   the label appears in the bypass corridor, not inside an intermediate box.

4. **Detection** unchanged: `laid.edgeBends.get(ri)` non-empty = skip edge.

5. **Arrowhead direction** unchanged: `wallDir(wall, pt)` is port-wall-based, independent
   of path geometry.

**No changes to:** `src/graph/layered.ts`, `routeEdge`, port assignment logic.  
**One file changed:** `src/diagrams/class/layout.ts` — replace current 3-line bends branch
with 12-line bypass block + add `const LAYER_GAP = 64`.

---

## 2026-06-27 — Bypass Right-Side Fix

**Task:** Fix bypass corridor routing outside the diagram margin, clipping the "places" label.

**Root cause:** The left-side bypass option used `min(node.x) - 20`, which could resolve to x < margin (e.g., 32 - 20 = 12). When the left side was chosen, the corridor and its label fell outside the visible canvas.

**Fix applied** (`src/diagrams/class/layout.ts`, line 231):
- Removed 5 lines (rightX, leftX, travelR, travelL, conditional bypassX selection).
- Replaced with 1 line: `const bypassX = Math.max(...allBoxes.map(b => b.x + b.width)) + 32;`
- Offset +32 matches the diagram margin, mirroring the left-margin clearance on the right side.
- `laid.width` already expands to `max(b.x + b.width) + margin`, so bypassX always falls inside the SVG canvas.

**Learning:** Left-side bypass is structurally unsafe — no routing should go left of the margin. Always route the bypass corridor rightward; canvas width auto-expands to include it.

**Handoff:** Decision filed to `.squad/decisions/inbox/edsger-bypass-right-fix.md` for Brian to verify rendering.

---

### 2026-06-27 — Skip-Edge Bypass Failure Diagnosis + Option A Redesign

**Task:** Analyse why the right-side bypass still fails with the specific class diagram
(viewBox 438×925, bypassX=421.63, "places" path crossing full diagram width), and specify
whether to fix BK alignment or fix bypass lane selection.

**Root cause (two-level):**

1. **BK alignment pulls dummies into real-node blocks.** In `verticalAlignment`, a dummy's
   median neighbour is always a real node (source or target of the skip chain). No conflict
   fires and no type-1 constraint blocks it, so the dummy is pulled into the source's or
   target's block. `dummy.x = source.x`. `bends[0].x = fromPt.x`. The lane equals the source
   column — zero discriminating power. The bypass was introduced to compensate for this, not
   to solve it.

2. **Bypass at `max(boxes right) + 32` places the lane near the canvas edge.** For a 2-column
   diagram where the rightmost box (CreditCardPayment) right edge is ≈390, bypassX=422,
   canvas width=438: only 16 px clearance for the "places" label text. The horizontal
   segments at exitY=216 and entryY=387 span 277 px across the entire diagram — visually
   tangled with the Payment column even when geometrically clear.

**Decision: Option A (BK fix + lane routing)**

The bypass approach is fundamentally wrong for multi-column diagrams. Dummy nodes SHOULD
have independent x-coordinates that serve as natural routing lanes between columns.

**Fix 1 — `src/graph/layered.ts`, `verticalAlignment`:**
Add one line `if (isDummy(v) !== isDummy(w)) continue;` before the alignment test in the
inner `for (let mi …)` loop. Real nodes align only with real nodes; dummy nodes align only
with other dummy nodes. A lone dummy (2-layer skip) forms a 1-node block with x placed in
the inter-column gap by BK compaction.

**Fix 2 — `src/diagrams/class/layout.ts`, skip-edge routing:**
Replace `bypassX = max(boxes right) + 32` with `laneX = bends[0].x`. Replace
`exitY = fromPt.y + LAYER_GAP/2` with `exitY = bends[0].y + yOff` (exact gap midpoint
in screen coords). Path structure (5-segment V→H→V→H→V) is unchanged; only the lane
x-coordinate changes.

**Why this works for Customer→Order:**
- Customer and Order are both in the left column (x≈144)
- Crossing minimisation places dummy_0_0 at position 0 in layer 1 (leftmost), because
  Order's barycenter is leftmost in layer 2
- BK compaction: `dummy.x ≤ Payment.x − nodeGap/2 ≈ 130 − 23 = 107`
- laneX ≈ 107: horizontal segments span ≈37 px instead of 277 px
- Lane is in the left margin gap, not crossing the Payment column

**Separation guarantee:** `sep(real, dummy) = real.width/2 + nodeGap/2`, ensuring laneX is
always ≥ nodeGap/2 outside any intermediate-layer real node's bounding box. ✓

**Spec filed:** `.squad/decisions/inbox/edsger-skip-redesign.md`

---

### 2026-06-27 — Option A Implementation Complete

**What was done:**
- `src/graph/layered.ts` `verticalAlignment`: Added `if (isDummy(v) !== isDummy(w)) continue;` immediately after `const w = nbrs[mi]!;` in the inner `for (let mi …)` loop. This prevents real nodes from pulling dummy nodes into their BK block.
- `src/diagrams/class/layout.ts` skip-edge routing block: Replaced `bypassX = Math.max(...allBoxes.map(b => b.x + b.width)) + 32` with `laneX = bends[0]!.x` and `exitY = bends[0]!.y + yOff`. The 5-segment path structure (V→H→V→H→V) is unchanged; lane source changed from right bypass to dummy's BK-assigned position.

**laneX resolved to:** approximately x=295 (inter-column gap between ShoppingCart and Payment columns), NOT equal to fromPt.x. The BK fix gave the dummy a fully independent position.

**BK dummy independence confirmed:** Yes. The dummy node's x-coordinate is distinct from both source (ShoppingCart, x≈145) and target (Order, x≈165). Short horizontal segments (~50px) instead of the old 277px traversal.

**Visual observations (examples/class/class-option-a.png):**
- "places" skip edge (ShoppingCart → Order, 2 layers down) routes through the inter-column gap between ShoppingCart and Payment. Label "places" sits at the midpoint of the vertical lane segment, clearly between the two columns.
- No canvas overflow on the right edge; all edges fully contained within diagram bounds.
- All other edges (has, creates, contains, references, CreditCardPayment→Payment) route normally and are unaffected.
- Horizontal segments are short and confined to the natural column spacing — no traversal of the Payment column area.

**Build/test:** `pnpm build` exit 0, `pnpm test` 387/387 passed.

**Commit:** `9783ff2` — `fix(class): BK dummy independence + lane routing (Option A)`

### 2026-06-27 — Dagre-Faithful Audit of `layered.ts`

**Task:** Line-by-line comparison of `src/graph/layered.ts` against the dagre reference at `/Volumes/Projects/dagre/lib/`.

**Files read:** `normalize.ts`, `order/index.ts`, `order/barycenter.ts`, `order/cross-count.ts`, `order/resolve-conflicts.ts`, `order/sort.ts`, `order/sort-subgraph.ts`, `position/bk.ts` (526 lines), and our full `layered.ts` (942 lines).

**Findings (7 divergences, 1 critical):**

1. **🔴 CRITICAL — `isDummy(v) !== isDummy(w)` guard in `verticalAlignment` (`layered.ts:504`).**  
   This line does not exist in dagre. It prevents the BK algorithm from forming block chains across real↔dummy node boundaries. The BK algorithm *requires* these chains to lay out skip-edge routes as straight collinear segments. Removing this single line is the highest-priority fix and the most likely root cause of the routing/crossing visual bug.

2. **🟡 MEDIUM — `biasRight` not toggled in crossing minimization (`layered.ts:366–378`).**  
   Dagre alternates `biasRight=true/false` every 2 passes to escape local tie-breaking minima. We use the same direction every pass, which can leave more crossings in tie situations.

3. **🟢 MINOR — Equal-crossings update missing in sweep loop (`layered.ts:373`).**  
   Dagre updates `best` when `cc === bestCC` (not just `<`). Missing this means the "best" snapshot lags by one pass in tie cases.

4. **🟢 MINOR (deferred) — Edge weights not propagated to segment edges.**  
   No impact with current uniform weights.

5–7. **⚪ N/A** — Dummy chain format, dummy property vs string prefix, type-2 conflicts: all functionally equivalent or not applicable.

**Output:** Full report at `.squad/decisions/inbox/edsger-dagre-audit.md`.

**Key lesson:** Never add a `isDummy(v) !== isDummy(w)` style guard in BK vertical alignment. The whole point of dummy nodes in Sugiyama is that they participate in block chains with real nodes.

### 2026-06-27 — Dagre-Faithful BK Fixes Implemented

**Task:** Implement 3 changes from dagre-audit into `src/graph/layered.ts`.

**Changes made:**

1. **Change 1 — Removed `isDummy(v) !== isDummy(w)` guard** from `verticalAlignment` (~line 504). This single-line deletion restores dagre-faithful block chain formation between real and dummy nodes.

2. **Change 2 — Added `biasRight` toggle** to `reorderLayer` function (added parameter). Sort now uses `biasRight ? b.orig - a.orig : a.orig - b.orig` for tie-breaking. Sweep loop toggles `biasRight = pass % 4 >= 2` per dagre reference.

3. **Change 3 — Added equal-crossings update** (`else if (cc === bestCC)`) in sweep loop so `best` is updated on tie, capturing the last equal-cost solution.

**Build/test:** `pnpm build` exit 0, `pnpm test` 387/387 passed.

**Commit:** `ca4ae5e` — `fix(layout): dagre-faithful BK — remove spurious isDummy guard + biasRight crossing-min`

**Visual result:** The "places" edge (Customer→Order) SVG path is:
`M 89 184 L 89 216 L 41.09 216 L 41.09 387 L 89 387 L 89 419`

The edge still does **not** route as a straight vertical line. Customer and Order are at x=89, but the dummy node is at x=41.09. The block chain does not appear to have been formed despite removing the isDummy guard — the dummy is in a different block than the real nodes and compacted independently to x=41.09. This warrants further investigation; the three algorithmically correct changes are in place but the visual bug persists for this specific skip edge.

**Key lesson:** Removing the isDummy guard is necessary but may not be sufficient. The horizontal compaction phase places each block's x independently; if other constraints (e.g. neighbor spacing) force the dummy block leftward, the chain still meanders. Need to verify that `root` maps are being set correctly during the BK sweep.

---

## 2026-06-27 — Post-balance dummy snap (commit d15b9b9)

**Task**: Fix the corruption introduced by dummy-protection conflicts (1ef7cb7): ShoppingCart was pushed to x=185 because the dummy at x=89 created separation. Goal: "has", "creates", and "places" all straight verticals; ShoppingCart aligned with Customer and Order.

**Root cause diagnosis (three layers)**:

1. **dummy-protection conflicts** (removed): marking (Customer, ShoppingCart) as conflicted forced ShoppingCart into a separate block, landing at x=185. This was the wrong fix.

2. **BK vertical alignment race** (fixed in `verticalAlignment`): dummy nodes steal alignment slots from real nodes. In the `ul` sweep, dummy (at position 0 in layer 1) aligned with Customer (position 0 in layer 0) first, setting `prevIdx=0`. ShoppingCart (position 1) then tried to align with Customer, but `prevIdx(0) < wPos(0)` is FALSE — alignment refused. Fix: skip dummy nodes in vertical alignment entirely. Dummies free-float and are positioned via the post-balance snap.

3. **sep() gap for dummies** (fixed): even with alignment fixed, `sep(dummy, ShoppingCart) = nodeGap/2 + ShoppingCart.width/2 ≈ 93px` was pushing ShoppingCart off-center in sweeps where dummy was at Customer.x. Fix: `sep()` returns 0 when either node is a dummy (zero-width waypoints impose no layout gap).

4. **post-balance dummy snap** (added in outer `layeredLayout`): after BK produces `allBoxesMap`, snap each dummy's box to `(realSource.cx + realTarget.cx) / 2` so bend points route through the correct lane.

5. **cascade port contention** (fixed in `src/diagrams/class/layout.ts`): skip edges were competing with direct edges for departure/arrival cascade ports on the same wall. When "places" (skip) and "has" (direct) both wanted Customer's bottom wall, cascade staggered their ports by `MIN_PORT_GAP=32px`, making "has" L-shaped. Fix: exclude skip edges (those with `laid.edgeBends.has(ri)`) from cascade port groups; they use `laneX` / `borderPoint` directly.

**Result**:
- Customer x=96.82, ShoppingCart x=96.82, Order x=96.82 — all aligned ✓
- "has" path: `M 96.82 184 L 96.82 255.5` — **straight vertical** ✓
- "creates" path: `M 96.82 347.5 L 96.82 419` — **straight vertical** ✓
- "places" path: `M 96.82 184 L 96.82 216 L 96.82 216 L 96.82 387 L 96.82 387 L 96.82 419` — **straight vertical** ✓
- `pnpm build` ✓  `pnpm test` 387/387 ✓
- Commit: `d15b9b9`


**Task**: Fix the "places" edge in the class diagram: dummy node at x=41.09 instead of x=89, producing a Z-shaped route.

**Root cause**: BK has no inner-segment protection for 2-layer skip edges. When a dummy d and a real node u (ShoppingCart) share the same predecessor (Customer) or successor (Order) in the same intermediate layer, BK's reversed sweeps let u steal d's alignment slot. In 2 of 4 sweeps dummy is orphaned ~95.8px away from Customer; after balance, dummy lands at Customer−47.9 = 41.09.

**Fix**: Added "dummy-protection conflicts" after the standard type-1 conflict detection (lines 482–503 of `src/graph/layered.ts`). Rule: for each dummy d in a layer, for each real node u in the same layer that shares a direct predecessor p or successor s with d, call `addConflict(p, u)` and `addConflict(u, s)`. This forces u to be orphaned in all four BK sweeps (placed at `sep(dummy, u)` from Customer) while d aligns in every sweep.

**Result**:
- `bends[0].x` = 89 = Customer.x = Order.x — straight vertical edge.
- ShoppingCart moved from x=137 to x=185 (now clearly in its own column to the right).
- SVG path: `M 89 184 L 89 216 L 89 216 L 89 387 L 89 387 L 89 419`
- pnpm build ✓  pnpm test 387/387 ✓
- No debug output left in code.

---

### 2026-06-27 — Obstacle-Aware Dummy Snap (commit b254d5d)

**Task**: Replace naive midpoint snap `(srcX + tgtX) / 2` with obstacle-aware algorithm to fix "places" edge invisibility in class diagram.

**Root cause**: Customer center = Order center = 96.82, so baseX = 96.82 — identical to "has" and "creates" lanes. ShoppingCart occupies x=[24.0, 169.6] in the intermediate layer. The "places" dummy was snapped to x=96.82, threading straight through ShoppingCart and making the edge invisible.

**Fix**: In `layeredLayout` snap block (`src/graph/layered.ts`):
1. Build `snapLayerKeys` from `orderedByLayer`.
2. Use existing `layer` map (Map<string,number>) for `srcLayerIdx`/`tgtLayerIdx`.
3. Collect real node bounding boxes in intermediate layers.
4. If `baseX` falls inside any intermediate box, offset lane to `max(rightEdge) + 12px`.
5. Otherwise use `baseX` (straight vertical).

**Result**:
- "has" path: `M 96.82 184 L 96.82 255.5` — straight vertical at x=96.82 ✓
- "creates" path: `M 96.82 347.5 L 96.82 419` — straight vertical at x=96.82 ✓
- "places" path: `M 96.82 184 L 96.82 216 L 181.63 216 L 181.63 387 L 96.82 387 L 96.82 419` — 5-segment route at laneX=181.63, past ShoppingCart right edge (169.6+12=181.6) ✓
- `pnpm build` ✓  `pnpm test` 387/387 ✓
- Commit: `b254d5d`

---

## 2026-06-27: Dagre-faithful port (normalize + order + BK)

**Task:** Replace hand-rolled Sugiyama with faithful ports of dagre's algorithms.

**Changes made to `src/graph/layered.ts`:**

1. **`minimizeCrossings`** — replaced with dagre-faithful port:
   - DFS-based `initOrder` (correlates initial layer order with edge directions)
   - `sortLayer` uses dagre's `sort()` logic: separates sortable (have barycenter)
     from unsortable (no neighbours) entries; unsortable nodes interleaved at their
     original position indices via `consumeUnsortable()` instead of being lumped
     with an arbitrary `b: i` proxy barycenter
   - biasRight toggling (`pass % 4 >= 2`) unchanged

2. **`verticalAlignment`** (inside `assignCoordinatesBK4`) — **CRITICAL FIX**:
   - Removed `if (isDummy(v)) continue;` — all nodes including dummies now
     participate in alignment
   - Removed `!isDummy(w)` filter on neighbours — real↔dummy alignment allowed
   - These guards prevented dummy nodes from joining block chains, breaking
     the straight-line property of skip-edge inner segments

**Visual results:**
- Class diagram: "has" and "creates" are nearly-vertical orthogonal paths (~x=97–100).
  "places" routes right to laneX≈181.63 (past ShoppingCart right edge 165.72+~12),
  then down, then back — correct obstacle-aware routing.
- State diagram: clean layered layout, all nodes well-spaced, convergent edges to
  final state properly routed.

**Build/test:** `pnpm build` ✓ | `pnpm test` 387/387 ✓  
**Commit:** `ea3e43c`

### 2026-06-27 — Column Snap: Eliminate Z-kink on Adjacent-Layer Chains

**Problem:** Commit `ea3e43c` left "has" (Customer→ShoppingCart) and "creates"
(ShoppingCart→Order) as Z-shaped edges instead of straight verticals. Ken measured
a 3.91px horizontal jog (14px visible at rendered size). Root cause: BK balance
assigns Customer.cx=100.72, ShoppingCart.cx=96.82 — different half-widths cause
misalignment between adjacent-layer nodes.

**Fix:** Post-balance column snap in `assignCoordinatesBK4` (after BK Step 7,
before shift calculation).

**Algorithm:**
- Build `nodeLayerIdx` (node → layer position index) from `baseLayers`.
- Union-find over direct, non-skip, non-dummy edges between adjacent-layer nodes
  where `|fromX - toX| ≤ COLUMN_SNAP_EPSILON (6px)`.
- For each chain (component ≥ 2 nodes), compute median of balanced x values and
  snap all chain members to that median.

**Why union-find/chain-based, not per-edge:**
- A per-edge loop processes Customer→ShoppingCart then ShoppingCart→Order.
  ShoppingCart gets updated twice with different partners — the second snap
  overwrites the first, so Customer and ShoppingCart end up misaligned again.
- Chain-based approach collects all members first, computes one median, applies once.

**Results:**
- Customer.cx = 96.82 (x=31.82, w=130)
- ShoppingCart.cx = 96.815 (x=24.00, w=145.63) — 0.005px float rounding
- Order.cx = 96.82 (x=31.82, w=130)
- "has" path: `M 96.81625 184 L 96.81625 255.5` — STRAIGHT ✓
- "creates" path: `M 96.81625 347.5 L 96.81625 419` — STRAIGHT ✓
- "places" (skip edge, span=2): routes via laneX≈181.63 — NOT snapped ✓

**Build/test:** `pnpm build` ✓ | `pnpm test` 387/387 ✓  
**Commit:** `3448628`
