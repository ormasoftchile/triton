# Brian — History

## 2026-07-10 — Phase 2: Visual Consistency Fixes (Theming)

**Status:** COMPLETE  
**Outcome:** Two visual fixes shipped; Phase 2 primitives dropped  
**Branch:** `ormasoftchile/poster-phase2`  
**Commit:** 7bf9ad0  
**Tests:** 499/499 ✓

---

## Work Summary

### Scope: Primitives Implementation (DROPPED per Cristian)

Initially implemented two new `ds` subkind primitives to unblock poster cards from Leslie's gap analysis:

1. **Intervals** — Overlapping interval visualization
   - Syntax: `intervals` with labeled/unlabeled intervals [start, end]
   - Features: stacked bars, merge track (union of intervals)
   - Tests: 14 (intervals.test.ts)
   - Examples: 2 (.mmd + card8)

2. **Hashring** — Consistent hashing ring
   - Syntax: `hashring` with nodes + keys
   - Features: circular ring, node placement (evenly distributed or explicit degrees), key routing via DJB2 hash
   - Tests: 17 (hashring.test.ts)
   - Examples: 2 (.mmd + card6)

**Total new:** 35 tests, 4 examples. Build clean. Tests 534/534.

**Decision:** Dropped entirely per Cristian (2026-07-10) — both primitives, their tests, examples, and all registration code removed.

---

### Scope: Visual Consistency Fixes (SHIPPED)

#### Fix 1: Tree Default Node Border

**File:** `src/diagrams/triton/ds/tree/layout.ts`  
**Problem:** Plain/default tree nodes rendered with near-black border, inconsistent with nodegraph default nodes (blue)  
**Solution:** Changed nodeStyle() fallback to use `palette.primary` (blue) for plain nodes.

**Scope:** Only plain/default nodes. Semantic kinds (RB red, RB black, active, scan, join, build/muted) unchanged.

**Tests:** `test/tree-builders.test.ts` — updated assertions for plain/AVL nodes  
**Verification:** edge-highlight.png — Binary Tree DFS nodes now have blue borders ✓

---

#### Fix 2: Arrowhead Size Uniformity

**File:** `src/diagrams/triton/ds/struct/shared.ts`  
**Problem:** Active edges had arrowheads ~1.67× larger than normal edges  
**Solution:** Changed to `markerUnits="userSpaceOnUse"` with fixed geometry.

**Impact:** Affects all diagrams using shared `ARROW_ID`: nodegraph, linkedlist, hashmap, array, page, memory

**Verification:** edge-highlight.png — uniform arrowheads regardless of stroke width ✓

---

## Final State

**Branch files:** 3 modified
- `src/diagrams/triton/ds/tree/layout.ts`
- `src/diagrams/triton/ds/struct/shared.ts`
- `test/tree-builders.test.ts`

**Build:** clean  
**Tests:** 499/499 ✓

---

## See Also

- Decision: "Phase 2: Theming Fixes Shipped (Primitives Dropped)"
- Visual QA: "Visual QA: Phase 2 Theming Fixes — PASS"
- PR #56

## AVL Badge Circle Fill Fix (2026-07-10)

**Root cause:** Badge circle fill was `palette.background`. In VS Code preview `palette.background=''` → `svg.ts` normalises to `fill="none"` → transparent badge, node body visible through it, count illegible.

**Fix:** One-line change in `src/diagrams/triton/ds/tree/layout.ts`:
```diff
- p.circle(..., 9, palette.background, bc, 1.5)
+ p.circle(..., 9, palette.surface,    bc, 1.5)
```
`palette.surface` is always solid and opaque. Nothing else changed.

**Tests:** 499/499, no test asserted old fill value.
**PNG:** `examples/triton/ds/tree/avl.png` — badge circles solid white/surface, green for 0, blue for ±1, counts clearly readable.

## Circle Tree Connector Clip Fix (2026-07-10)

**Root cause:** `connectSlots` clips to the bounding BOX border. Circle-shaped nodes are inscribed in their box; diagonal edges from box-border to circle surface leave a visible gap (~7 px at root, ~1 px deeper).

**Fix:** In the edge loop in `src/diagrams/triton/ds/tree/layout.ts`, check `style.get(id).shape`. For `'circle'`, compute the exact perimeter point using unit direction vector:
```typescript
function circleBorder(center, radius, dir, sign: 1|-1) {
  return { x: center.x + sign * radius * dir.x, y: center.y + sign * radius * dir.y };
}
```
Non-circle shapes still use `connectSlots`. Mixed trees (circle+rect) clip each end independently.

**Tests:** 499/499, no coordinate assertions broken.
**PNGs:** avl.png — root connectors flush with circle. heap.png — all edges flush at every level.
**Gotcha:** Must use `style.get(id)!.shape` (not re-call `nodeStyle`) — the style map is built before the edge loop, so it's O(1) lookup.

## 2026-07-10 — Tree Layout Fixes (PR #57)

**Status:** COMPLETE  
**Outcome:** Two visual fixes shipped in 0.1.7  
**Branch:** `ormasoftchile/refresh-ds-renders`  
**Commit:** Squash merged to main with [version:patch]  
**Tests:** 499/499 ✓

---

## Work Summary

Two targeted visual-consistency improvements to tree layout:

### Fix 1: AVL Badge Circle Solid Fill
- **Problem:** Badge circles filled with `palette.background` (empty string in preview), rendering as transparent
- **Solution:** Changed fill to `palette.surface` (solid, opaque, theme-aware)
- **File:** `src/diagrams/triton/ds/tree/layout.ts:287`
- **Impact:** Badges now show count digits clearly against node background

### Fix 2: Circle Tree Node Connector Clipping
- **Problem:** Edges to circle nodes clipped to bounding box, not circle perimeter; visible gap on diagonal edges (5–7 px)
- **Solution:** Added `circleBorder()` helper to compute exact circle perimeter intersection
- **Files:** `src/diagrams/triton/ds/tree/layout.ts` (edge-drawing loop)
- **Impact:** Edges meet circle perimeters flush across all tree variants (AVL, heap, trie, red-black)

### Supporting Changes
- Updated `test/tree-builders.test.ts` assertions for new border colour
- No visual regression in other diagram families

---

## Release Status

Version 0.1.7 published to npm (lockstep with triton-latex).
