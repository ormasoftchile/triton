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

