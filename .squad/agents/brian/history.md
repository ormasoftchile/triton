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
