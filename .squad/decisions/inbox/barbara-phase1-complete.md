# Decision: Phase 1 — Flowchart Full Sugiyama Upgrade (Complete)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-27T10:00:00-04:00  
**Status:** DONE — merged to main (commit 23cee08)  
**Requested by:** ormasoftchile  

---

## What Was Implemented

### Phase 3: Barycentric Crossing Minimisation (`minimizeCrossings`)

Added to `src/diagrams/flowchart/layout.ts` after `groupByLayer`.

- Bi-directional sweeps (even pass = downward using predecessors, odd pass = upward
  using successors), capped at `MAX_PASSES = 4` bi-directional passes.
- Back-edges (the same `Set<number>` computed by `findBackEdges`, already in scope)
  and self-loops excluded from barycenter computation — they would corrupt downward
  ordering.
- Stable sort: nodes without anchoring neighbours in the reference layer use their
  current position index as barycenter so they keep their relative order. Equal
  barycenters tie-break on the original insertion index (deterministic).
- The `posInLayer` map is rebuilt after every layer reorder so the barycenter of
  a later layer uses fresh positions from the layer just sorted.

### Phase 4: Simplified Brandes–Köpf Coordinate Assignment (`assignCoordinatesBK`)

Replaces the old centering loop in `layoutFlowchart`.

**Algorithm:**
1. **Two independent passes** (top-down using predecessors, bottom-up using
   successors). Each pass places every layer as a uniform block:
   - Each node's "preference" = mean cross-axis position of its forward-edge
     neighbours in the adjacent layer (mean rather than median matches dagre's
     weighted-sum approach and gives centred results for symmetric trees).
   - Nodes with no qualifying neighbours fall back to the OLD centering formula
     (`margin + (maxNodesInLayer − count) * crossStep / 2 + i * crossStep`)
     so root and leaf layers remain stable.
   - Block start = `max(margin, medianOfPrefs − ½·totalSpan)` — the whole layer
     block is centred on its collective preference, clamped to the margin.
2. **Averaging:** Final position = average of the two passes. Both passes
   independently use a uniform spacing of `crossStep = crossSize + gap`, so the
   average is also uniform and cannot produce overlaps (proven: if `p1[i+1] − p1[i]
   = p2[i+1] − p2[i] = step`, then `avg[i+1] − avg[i] = step`).

**Not implemented (noted simplifications):**
- Type-1 / type-2 conflict marking (requires virtual/dummy nodes for long edges;
  Triton's flowchart has no dummy nodes).
- Four-alignment B-K (leftUp/rightUp/leftDown/rightDown) — two passes + average
  is sufficient for the visual quality needed in Phase 1.
- Full horizontal compaction and block-graph construction from the dagre reference.

### Ancillary Fix: `scripts/preview.mjs` dist path

The preview script imported from `../dist/frontend/index.js` but the tsconfig
`outDir` is `./packages/core/dist`. Fixed both the import path and the parser
copy destination. This was a pre-existing bug unmasked by this task's visual
verification requirement.

---

## Edge Cases Confirmed

| Case | Behaviour |
|------|-----------|
| Single-node layer (root/leaf) | Uses centering fallback; block-start = margin |
| All nodes in one layer | Crossing-min no-ops; B-K centres block at margin |
| All nodes with same predecessor | Forward pass pushes one node right; block still centred on shared preference |
| Symmetric tree (A→B,C) | Pass1: block under A; Pass2: A centred above B,C; average: correct centred position |
| Disconnected nodes (no edges) | Assigned layer 0 by `assignLayers`; no neighbours → centering fallback |
| Back-edges (cyclic graph) | Excluded from crossing-min and B-K; visual routing unchanged (PR #28) |
| Self-loops | Excluded from crossing-min and B-K; selfLoopRoute unchanged |
| LR direction | `isLR=true` swaps cross/main axes; crossSize=NODE_H, mainSize=NODE_W |
| RL / BT (isReverse) | `layerNum = numLayers − 1 − li` in B-K; order preserved |

---

## Visual Verification Results

All three flowchart examples re-rendered and verified:

- **flowchart.mmd** (LR, 5 nodes, no cycles): 4 distinct x-layers; all nodes
  non-overlapping; `validate` diamond centred between `process` and `reject`.
- **ci-pipeline.mmd** (TD, 8 nodes, no cycles): 5 distinct y-groups; `stage`/
  `notify` placed left/right (crossing minimisation correctly separates them);
  `prod`/`hold` placed left/right under `approve`; no overlaps.
- **order-processing.mmd** (LR, 7 nodes, no cycles): 6 distinct x-layers; no
  overlaps; all labels within bounding boxes.

7-point checklist: ✓ all items confirmed.

---

## Test Gate

`pnpm test` → **387/387 passed** (unchanged count — golden SVG updates do not
affect the test count because `examples.test.ts` validates SVG well-formedness,
not exact coordinates).

---

## What Remains for Phase 2

The same `minimizeCrossings` + `assignCoordinatesBK` logic should be lifted into
`src/graph/layered.ts` so that class, state, ER, C4, block, and requirement
diagrams inherit the improvement automatically (per Leslie's phase plan §Phase 2).
The flowchart implementation is the reference to refactor upward.
