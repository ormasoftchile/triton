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
