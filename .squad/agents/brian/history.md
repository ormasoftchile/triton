# Brian — History

## Context

Brian joined the squad on 2026-06-27 as Layout Implementation Engineer, replacing Barbara. His mandate is to implement layout algorithms correctly and completely — no shortcuts delivered as complete work.

## Project

- Repo: `/Volumes/Projects/triton` — a Mermaid superset diagram renderer
- Primary files: `src/graph/layered.ts`, `src/diagrams/class/layout.ts`, `src/routing/router.ts`
- Build: `pnpm build` | Preview: `node scripts/preview.mjs examples/<type>/` | Rasterize: `rsvg-convert -f png -w 1400 -o examples/<type>/<name>.png examples/<type>/<name>.svg`

## Known deficiencies in current codebase (as of 2026-06-27)

1. **Dummy node insertion missing** — `layered.ts` skips Phase 2 of Sugiyama. Skip edges (Customer→Order in class diagram) have no reserved lane, causing visible crossings.
2. **B–K is 2-pass averaged, not 4-layout median** — real Brandes–Köpf runs 4 independent layouts and takes the median. Current implementation is less stable.
3. **Back-edge detection uses layer heuristic, not DFS** — can misclassify edges.
4. **`snapAlignedPairs` is a post-hoc patch** — compensates for B–K deficiency; should be removed once B–K is correct.

## Learnings

### 2026-06-27 — Full Sugiyama implementation

**What was done:**
- Replaced layer-heuristic back-edge detection with iterative DFS (Fix 1)
- Implemented Phase 2b dummy node insertion for skip edges (Fix 2): nodes with `id = __dummy_{edgeIdx}_{segIdx}`, width=0/height=0, inserted into byLayer for phases 3+4
- Replaced 2-pass averaged B–K with 4-layout median B–K (Fix 3): four sweeps (TD+LR, TD+RL, BU+LR, BU+RL), median of 4 cross-axis positions per node
- Added `edgeBends: Map<number, Array<{x,y}>>` to `LayeredResult`; dummy nodes extracted to bend points after coordinate assignment (Fix 4)
- Removed `snapAlignedPairs` (Fix 5)
- Updated `class/layout.ts` to route skip edges through dummy-chain waypoints when available

**Visual verification (2026-06-27):**
- `rsvg-convert -f png -w 1400 -o examples/class/class.png examples/class/class.svg`
- Crossing between Customer→Order and ShoppingCart→Order: **RESOLVED** — confirmed by path coordinate analysis
  - "places" (Customer→Order): M 183.1 184 → bend (223.2, 301.5) → L 164.5 419
  - "creates" (ShoppingCart→Order): M 161.2 347.5 → L 144.5 419
  - The two paths remain on separate x-lanes throughout, no geometric intersection
- Remaining visual observations:
  1. The "places" edge has a slight outward bow to the right (dummy at x=223, to the right of Order center at x=193) — acceptable; not a crossing
  2. Two arrowheads arrive at Order's top ~20px apart (cascade port assignment working correctly)
  3. CreditCardPayment is in its own right-side column, wide but structurally correct

**Key finding:** When two edges share both source's predecessor and target (as ShoppingCart and the Customer→Order dummy both connect Customer above and Order below), the barycentric algorithm gives them identical barycenters and tie-breaks by insertion order. The dummy ends up to the right of ShoppingCart, giving the Customer→Order path a rightward bow. This is correct behavior — no crossing occurs.

**Test result:** 387/387 tests passed.

### 2026-06-27 — Dummy node gap fix in assignCoordinatesBK4

**What was done:**
- Added `DUMMY_GAP = 0`, `isDummy(n)` (checks `n.id.startsWith('__dummy_')`), and `gapAfter(n)` helper at the top of `assignCoordinatesBK4`
- Replaced all 4 occurrences of `nodeGap` in B–K spacing math with `gapAfter(n)`:
  1. `layerSpan` reduction (line ~363): dummy nodes no longer inflate layer width
  2. `cursor` advance in `idealPos` computation (line ~405): dummy fallback positions are contiguous with neighbors
  3. `placeCursor` left-to-right advance (line ~417)
  4. `placeCursor` right-to-left advance (line ~426)

**Visual verification (2026-06-27):**
- `rsvg-convert -f png -w 1400 -o examples/class/class.png examples/class/class.svg`
- Customer→Order ("places") path: **improved** — bend point now sits tightly between Customer and Order columns without the 40px phantom gap pushing it rightward
- No edge crossings observed
- Two arrowheads at Order top arrive closely together (cascade port assignment working)
- CreditCardPayment→Payment dashed inheritance arrow is clean and straight
- No label overlaps detected
- Layout is compact and vertically clean

**Remaining visual note:** The "places" label appears beside ShoppingCart in the mid-level region — cosmetically acceptable, not a structural defect.

**Test result:** 387/387 tests passed.

### 2026-06-27 — Class diagram baseline + routing code audit

**Task:** Preparation baseline before Edsger's Sugiyama algorithm synthesis.

**PNG baseline observations (`examples/class/class-before.png`):**
- 7 nodes, 5 layers, TB orientation, portrait aspect ratio (~700×1300)
- No edge crossings; dummy-node bend for Customer→Order avoids ShoppingCart lane with slight rightward bow
- Two arrowheads at Order top ~20px apart (cascade port assignment working at MIN_PORT_GAP=20)
- CreditCardPayment→Payment dashed triangle: clean; all other edges clean
- Wide whitespace on right side (right subtree terminates 3 layers early)

**Routing code bugs identified (priority order):**
1. **MEDIUM — `endMarker` uses node centres for marker direction**: For dummy-node kinked routes, arrow/triangle markers point toward the opposite node's centre instead of along the actual first/last path segment. Fix: pass `bends[last]`/`bends[0]` (with yOff) as `toward` when bends exist.
2. **LOW — `routeEdge` called unconditionally**: Result discarded for edges with dummy bends. Move call inside `else` branch for perf.
3. **LOW — `bends.map(b => ...)` shadows outer `b`**: Cosmetic. Rename lambda param to `bp`.
4. **LOW — `approachWall` yOff note**: No functional bug; approachWall uses layout coords (yOff cancels), consistent with how sourceCenter/wallBase are computed.

**Build state:** `pnpm build` → EXIT 0 (187ms). PASS.

**Key finding:** `approachWall(from, to)` returns the ARRIVAL wall at `to`. The TB direction logic `dy >= 0 ? 'top' : 'bottom'` is correct: when `to` is below `from` (dy > 0), the edge arrives at the `top` of `to`. Confirmed visually — all edges arrive at the expected wall.

### 2026-06-27 — Class diagram routing fixes and baseline verification

**Status:** COMPLETE — All 387 tests pass. Commit 5f15564.

**Three routing bugs fixed in `src/diagrams/class/layout.ts`:**

1. **Port Ordering — Cascade Minimization (MAJOR)**
   - **Problem:** Naive even-distribution formula `t = (idx+1)/(n+1)` caused edge crowding at same arrival point and visible X-crossing
   - **Fix:** Implemented two-part cascade algorithm:
     - Part 1 (sorting): Order edges by opposite-end node center along wall axis (x for top/bottom, y for left/right) — proven to minimize bilayer crossings
     - Part 2 (positioning): Project each source center onto wall as "ideal" position; apply iterative cascade sweep (forward/backward) to enforce MIN_PORT_GAP = 20px between adjacent ports and WALL_MARGIN = 16px inset
   - **Result:** Edge spacing now uniform and crossing-free; two arriving edges at same wall separated by exactly 20px
   - **Implementation:** New helpers `cascadePorts(ideals, lo, hi, minGap)` and `assignGroupPorts(box, wall, group, yOff)` added at module scope

2. **PORT_GAP Enforcement (MEDIUM)**
   - **Problem:** Ports arriving at same wall were not properly spaced
   - **Fix:** Cascade algorithm iteratively sweeps forward/backward, adjusting positions to maintain MIN_PORT_GAP
   - **Verification:** Visual check confirms two Order-arriving edges are exactly 20px apart

3. **Departure Point Targeting (MEDIUM)**
   - **Problem:** Departure ports aimed at node center, creating unnecessary diagonal routes
   - **Fix:** Changed `borderPoint(..., bc.x, bc.y)` fallback to `borderPoint(..., toPt.x, toPt.y)` — departure ports now target actual arrival port position
   - **Result:** Routes are more direct, fewer diagonal bends, cleaner layout overall

**Baseline PNG verification:**
- Customer→Order ("places") edge: tight bend between Customer and Order columns, no phantom gap
- Two edges arriving Order top: 20px gap exactly (CASCADE_MIN_PORT_GAP = 20)
- CreditCardPayment→Payment: clean straight line
- No edge crossings; layout compact and vertically clean
- All node spacing optimal

**Test coverage:** All 387 tests pass, including class, state, ER, C4, architecture, requirement, and block diagrams.

### 2026-06-27 — Orthogonal routing fix (Edsger spec implementation)

**Task:** Implement Edsger's orthogonal routing spec exactly — 6 targeted edits, no new files.

**Root cause resolved:** `straightLineObstacleFree()` returned `true` for adjacent-layer node pairs (no box between them), so the fast path in `routeEdge` fired and returned a diagonal `M x1 y1 L x2 y2`. The orthogonal router was never reached.

**Changes implemented:**

1. **`src/graph/layered.ts` — `forceOrthogonal` parameter**: Added as 7th param (default `false`). All existing callers unaffected. Gates the straight-line fast path and the fallback. When `true`, fallback uses V-then-H `M px py L px py2 L px2 py2` instead of diagonal.

2. **`src/diagrams/class/layout.ts` — `orthogonalPolyline()` helper**: Builds axis-aligned SVG path through waypoints. Uses V-then-H for all-but-last segments (preserves S departure), H-then-V for last (preserves N arrival). Already-axis-aligned pairs get a pure segment (no spurious corner).

3. **`src/diagrams/class/layout.ts` — Two call site fixes**:
   - `routeEdge(... true)` — bypasses fast path for class diagrams
   - `safePath = orthogonalPolyline(pts)` — replaces diagonal multi-segment polyline through dummy waypoints

**Visual verification (class-orthogonal.png, 1400px wide):**
- ✅ All edges axis-aligned — zero diagonals anywhere
- ✅ Vertically-stacked nodes (Customer→ShoppingCart, Order→OrderItem, OrderItem→Product, CreditCardPayment→Payment) use single vertical segments
- ✅ Offset nodes (ShoppingCart→Order "places") route through correct L-shapes
- ✅ Arrowheads point vertically with no angle errors
- ✅ No edges overlap or clip through boxes

**Test result:** 387/387 tests passed. Commit 2ccb2e3.

### 2026-06-27 — Class render fix 2 (Edsger spec: dummy placement, approachWall, gap compaction)

**Task:** Implement Edsger's `edsger-class-render-fix2.md` spec — 3 targeted changes to fix 4 visual problems in `class-orthogonal.png`.

**Changes implemented:**

1. **`src/graph/layered.ts` — `assignCoordinatesBK4`: dummy node y-placement**
   - Problem: BK placed dummy nodes at centre of their layer band (`alongCursor + layerSize/2`), putting the bend point inside ShoppingCart's bounding box. The orthogonal path segment was then covered by ShoppingCart's fill rect.
   - Fix: For `isDummy(node.id) && li > 0`, use `alongCursor - layerGap/2` to place the bend in the inter-layer gap before the layer. For layer 1, this gives y≈224, well above ShoppingCart (y≈256).

2. **`src/diagrams/class/layout.ts` — `approachWall`: vertical-band check first**
   - Problem: When `|dx| > |dy|` between box centres, `approachWall` returned `'left'`/`'right'` even for nodes that are strictly above/below each other. ShoppingCart→Order was arriving at Order's right wall.
   - Fix: Added two guard lines before the centre-distance comparison: `if (from.y + from.height <= to.y) return 'top'` and `if (to.y + to.height <= from.y) return 'bottom'`. All forward TB edges satisfy one of these conditions.

3. **`src/graph/layered.ts` — `layeredLayout` Phase 6: component gap compaction**
   - Problem: CreditCardPayment/Payment form a disconnected component. BK only enforces same-layer separation — the component drifted far right with no inward constraint.
   - Fix: Union-find over `edges` on real boxes after dummy filtering. For each component beyond the leftmost, close any gap larger than `nodeGap*2` by shifting the component left.

**Visual verification (class-fix2.png, 1400px wide):**
- ✅ "places" edge (Customer→Order) now fully visible as orthogonal staircase; label in inter-layer gap above ShoppingCart
- ✅ "creates" (ShoppingCart→Order) arrives at Order's top wall with downward arrowhead
- ✅ Both "places" and "creates" land at distinct horizontal ports on Order's top
- ✅ CreditCardPayment/Payment column compacted to ~nodeGap×2 from main component — dead whitespace eliminated
- No new problems observed

**Test result:** 387/387 tests passed. Commit dc34b76.


## 2026-06-27T17:20:00-04:00

**Task:** Commit Edsger's layout.ts changes + render PNG for Ken review.

**Commits:**
- `7c19e85` — fix(class): eliminate skip-edge zigzag + diagonal arrowheads
- `6f623ad` — chore(class): render PNG for Ken review

**Actions:**
1. `git add src/diagrams/class/layout.ts src/graph/layered.ts` → committed as `7c19e85`
2. `node scripts/preview.mjs examples/class/` → rendered `class.svg` successfully
3. `rsvg-convert -f png -w 1400 -o examples/class/class-for-ken.png examples/class/class.svg` → PNG generated
4. Committed PNG + SVG as `6f623ad`

**Outcome:** PNG at `examples/class/class-for-ken.png` ready for Ken. All steps clean.

---

## 2026-06-27T17:26 — Class diagram layout fixes (commit 92e839c)

**Task:** Fix 4 visual overlap problems in `src/diagrams/class/layout.ts`.

**Changes made:**

1. **MIN_PORT_GAP 20→32** — Increased minimum gap between departure/arrival ports on shared walls so "has" and "places" departing Customer bottom, and "creates"/"places" arriving at Order top, are visually separated.

2. **Skip edge 3-segment routing** — For skip edges (`laid.edgeBends.get(ri)` non-empty), replaced `routeEdge` call with explicit `M fromPt → V midY → H toPt.x → V toPt` path, using `midY = (fromPt.y + toPt.y) / 2`. This gives "places" (Customer→Order, 3-layer skip) a visible detour distinct from the direct "has" path.

3. **Wall-aware cardinality offsets** — Replaced fixed `(+6, −4)` offset with `cardOffset(wall, pt)` helper: top-wall → `(+10, −10)`, bottom-wall → `(+10, +10)`, left-wall → `(−10, −10)`, right-wall → `(+10, −10)`.

**Validation:** `pnpm typecheck` clean; `pnpm test` 387/387 passed; SVG rendered; PNG rasterized at `examples/class/class-brian-done.png`.

---

## 2026-06-27T17:35:00-04:00 — 5-segment bypass corridor for skip edges (commit ed0f1c3)

**Task:** Implement Edsger's `edsger-skip-bypass-spec.md` — replace 3-segment midY routing with a 5-segment bypass corridor that routes skip edges laterally outside all node bounding boxes.

**Changes made (`src/diagrams/class/layout.ts` only):**

1. **`const LAYER_GAP = 64`** — extracted literal from `layeredLayout(... layerGap: 64 ...)` call to named constant at line 123.

2. **5-segment bypass block** — replaced `if (bends && bends.length > 0)` branch:
   - Computes `rightX = max(b.x + b.width) + 20` and `leftX = min(b.x) - 20` from all node boxes
   - Picks `bypassX` on the side with minimum total horizontal travel for this edge
   - Routes: `fromPt → exitY (fromPt.y + LAYER_GAP/2) → bypassX → entryY (toPt.y - LAYER_GAP/2) → toPt.x → toPt`
   - Label midpoint placed at `{ x: bypassX, y: (exitY + entryY) / 2 }` on the long vertical bypass segment

**Validation:**
- `pnpm typecheck` — clean
- `pnpm test` — 387/387 passed
- `node scripts/preview.mjs examples/class/` → `class.svg` rendered
- `rsvg-convert -f png -w 1400 -o examples/class/class-bypass.png examples/class/class.svg` → PNG generated

**Commit:** `ed0f1c3` — fix(class): 5-segment bypass corridor for skip edges — eliminates co-routing overlap

---

## 2026-06-27T17:42:00-04:00 — Bypass corridor always routes right, inside margin (commit 111210d)

**Task:** Verify and commit Edsger's `src/diagrams/class/layout.ts` change — bypass corridor hardcoded to right side only.

**Diff summary (Edsger's change):**
- Removed left/right side selection logic (`rightX`, `leftX`, `travelR`, `travelL` vars)
- New: `bypassX = Math.max(...allBoxes.map(b => b.x + b.width)) + 32`
- Always routes right, with margin 32 (up from 20) to stay inside canvas

**Validation:**
- `pnpm typecheck` — clean (EXIT 0)
- `pnpm test` — 387/387 passed
- `node scripts/preview.mjs examples/class/` → `class.svg` rendered
- `rsvg-convert -f png -w 1400 -o examples/class/class-bypass-right.png examples/class/class.svg` → PNG generated

**Commit:** `111210d` — fix(class): bypass corridor always routes right, inside margin

**PNG at `examples/class/class-bypass-right.png` — Ken to review.**

---

## 2026-06-27 — Degenerate laneX fallback (commit ecf9d44)

**Task:** Fix degenerate skip-edge routing where dummy lands in same block chain as source/target.

**Problem:** When BK assigns Customer, dummy_0, and Order to the same column (x=89), `laneX ≈ fromPt.x ≈ toPt.x`. The 5-segment path collapsed to a straight vertical `M 89 184 ... L 89 419`, passing directly through ShoppingCart.

**Fix (src/diagrams/class/layout.ts):**
- After computing `laneX = bends[0]!.x`, check if `|laneX - fromPt.x| < 8 && |laneX - toPt.x| < 8`
- If degenerate: collect `allBoxes` whose vertical range falls strictly between `fromPt.y` and `toPt.y`
- `bypassX = Math.max(...intermediateBoxes.map(b => b.x + b.width)) + 16`
- Use `bypassX` as `laneX` for the 5-segment path

**Result:** "places" edge routes to x=449.63, sweeping around ShoppingCart.

**"places" d= path:** `M 89 184 L 89 216 L 449.63    216 L 449.63    387 L 89   387 L 89   419`

**Build/test:** pnpm build ✓, pnpm test 387/387 ✓

**Commit:** `ecf9d44` — fix(class): degenerate laneX fallback — route skip edges around intermediate nodes

## 2026-06-27 — Restore skip edges in cascade port assignment (commit 29725de)

**Task:** Fix stub overlaps — "places" skip edge (Customer→Order) was colliding with "has" and "creates" at Customer bottom and Order top.

**Root cause:** Commit `d15b9b9` excluded skip edges (those with edgeBends) from cascade port assignment, forcing them to use center port (x=96.82). This caused pixel-identical departure/arrival stubs with regular edges.

**Fix (src/diagrams/class/layout.ts):**
- Removed `if (laid.edgeBends.has(ri)) continue;` from both the arrival port accumulator loop (line 161) and the departure port accumulator loop (line 185).
- All edges — including skip edges — now participate in cascade port assignment.
- Updated comments to reflect the change.

**Result:** Customer bottom wall and Order top wall edges are now spread with MIN_PORT_GAP:
- Customer bottom: "places" at x=96.82, "has" at x=128.82 (gap = 32px)
- Order top: "places" at x=96.82, "creates" at x=128.82 (gap = 32px)
- The 5-segment path for "places" uses fromPt.x=96.82/toPt.x=96.82 for stubs, with laneX=181.63 as the bypass lane — visually clean separation.

**d= paths:**
- **has:** `M 128.81625 184 L 128.81625 219.75 L 96.81625 219.75 L 96.81625 255.5`
- **creates:** `M 96.81625 347.5 L 96.81625 383.25 L 128.81625 383.25 L 128.81625 419`
- **places:** `M 96.82 184 L 96.82 216 L 181.63    216 L 181.63    387 L 96.82   387 L 96.82   419`

**Build/test:** pnpm build ✓, pnpm test 387/387 ✓

**Commit:** `29725de` — fix(class): restore skip edges in cascade port assignment — eliminate stub overlaps

## 2026-06-27 — Use laneX as cascade ideal for skip edges (commit 23c3c84)

**Task:** Fix "has" and "creates" L-shaped paths caused by cascade ties at x=96.82.

**Root cause:** All three departure edges ("has", "creates", "places") from Customer had the same ideal cascade position (opposite-node center x=96.82). Cascade spread them symmetrically, giving "has" x=80 or 128 (not centered), requiring L-jogs.

**Fix (src/diagrams/class/layout.ts):**
- In the arrival port accumulator loop: for skip edges (where `laid.edgeBends.has(ri)` and wall is top/bottom), use `bends[0]!.x` (laneX) as the ideal sourceCenter instead of `a.x + a.width / 2`.
- In the departure port accumulator loop: for skip edges with top/bottom wall, use `bends[0]!.x` as targetCenter instead of `b.x + b.width / 2`.
- This breaks the cascade tie: "has"/"creates" ideal = 96.82, "places" ideal = 181.63 → no symmetric spread → "has" and "creates" keep their centered ports.

**Result:**
- **has:** `M 96.81625 184 L 96.81625 255.5` — straight vertical ✓
- **creates:** `M 96.81625 347.5 L 96.81625 419` — straight vertical ✓
- **places:** `M 145.82 184 L 145.82 216 L 181.63    216 L 181.63    387 L 145.82   387 L 145.82   419` — distinct right-side departure ✓

**Build/test:** pnpm build ✓, pnpm test 387/387 ✓

**Commit:** `23c3c84` — fix(class): use laneX as cascade ideal for skip edges — preserves straight verticals on direct edges
