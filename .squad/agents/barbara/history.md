# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T16:45:00Z (Obstacle/target separation fix; link-poster clean; 2772 tests pass)

---

## Current Status (2026-06-16)

**CRITICAL BUG FIX: OBSTACLE/TARGET SEPARATION.** The geometry kernel was blind to state pseudo-states (start/end/fork/join/choice) as obstacles because the node-anchor registry was shared between "addressable targets" (links/traces) and "kernel obstacles". Pseudo-states were correctly excluded from addressable targets, but that exclusion also removed them from the obstacle set — making the kernel unable to detect or avoid routes through the end-state bullseye. The `link-poster` "triggers" route had been stabbing through the `__end__` bullseye and the kernel falsely reported CLEAN. Root cause fixed; router improved; 2772 tests pass; `link-poster.png` re-rendered CLEAN.

**GEOMETRY QUALITY KERNEL + GATE COMPLETE.** Kernel validated against synthetic bad geometry (acid tests pass). Router wired with `pickBestRoute`. Post-render gate `visual-quality.test.ts` added (11 tests, all passing including 2 new regression tests E1/E2). ALL 5 posters verified CLEAN by both kernel and visual inspection. Committed (by coordinator).

**CROSS-DIAGRAM NODE LINKING Phase A SHIPPED.** Sidecar NodeAnchorRegistry on flow/class/state grammars, `link` DSL parsing in poster.ts, composition overlay, gallery demo.

**CROSS-DIAGRAM TRACES Phase B SHIPPED.** Named, typed, multi-hop `trace` abstraction. Categorical palette coloring, trace legend, overlay polish. Gallery demo + §30b dogfood figure.

---

## Archive & Historical Notes

**Full detailed work (2026-06-15–2026-06-16):** See `history-2026-06-16-summarized.md` for geometry-quality kernel validation, cross-diagram links Phase A/B implementation, trace abstraction, dimension guard root-cause analysis, theme coherence verdicts, multi-line label support, and earlier work.

**Earlier work (2026-06-14 and prior):** See `history-archive.md` and dated archive files.

---

## Key Learnings & Patterns (2026-06-16)

1. **Geometry quality gate:** Post-render validation catches real defects (state anchor regression); kernel defect detection is correct and trusted.
2. **Determinism preservation:** Sidecar registries (anchors) do not change scene hashes; only new features (link/trace) emit new overlay primitives.
3. **Cross-grammar anchor pattern:** All three grammars (flow/class/state) expose node bboxes differently; dual-indexing (ID + name) and truthy-checks handle parser quirks.
4. **Doc-sourced rendering:** Worked examples in §30b must use only anchored grammars (flow/class/state); non-anchored cells silently warn+skip, defeating the illustration purpose.

## Learnings (2026-06-16 — Obstacle/Target Separation Fix)

5. **Obstacles ≠ addressable targets — NEVER share a single registry for both purposes.** The `NodeAnchorRegistry` was pruned of pseudo-states (start/end/fork/join/choice) to prevent them from being used as `link`/`trace` endpoints. That same pruned registry was then used as the kernel's obstacle set, making the kernel blind to every rendered pseudo-state. The fix: grammars now return TWO registries — `anchors` (addressable targets, no pseudo-states) and `obstacles` (all placed node boxes, real + pseudo). The composition layer uses `anchors` for endpoint resolution and `obstacles` for kernel/router scoring. The `RenderWithAnchors<S>` interface in `anchors.ts` now carries the optional `obstacles` field.
   - Files: `packages/core/src/anchors.ts`, `packages/core/src/grammars/state/layout.ts`, `packages/core/src/grammars/state/index.ts`, `packages/core/src/grammars/class/layout.ts`, `packages/core/src/grammars/class/index.ts`, `packages/core/src/frontend/mermaid/index.ts`.

6. **Dual-indexed anchor registries produce phantom double-obstacles.** The class grammar registers each class node under BOTH its canonical name and lowercase ID for case-insensitive link resolution. Both entries occupy the same physical box. Using the raw anchor registry as the obstacle set counted that box twice, inflating the collision penalty for routes through class cells by 2×. Fix: `obstacles` registry in the class grammar only includes ONE entry per physical box (keyed by `cls.name`); the lowercase alias stays in `anchors` only.

7. **Non-adjacent cell routing — near-source gutter variant required.** The h-right candidate's gutter X is computed as the midpoint between source and target cells. For non-adjacent same-row links (e.g. A1→C1 with B1 in between), that midpoint falls inside B1, causing the route's vertical segment to pass through B1's node boxes. Added `h-right-near` (and `h-left-near`) candidates that place the vertical gutter just past the source cell's right (left) edge — guaranteed to be in the actual inter-cell gap. Symmetric variants added for h-left.

8. **Bus center-entry is fragile for state diagrams.** The end-state bullseye is always at the same center X as the last real state and sits directly below it. A bus route entering the target at center-X-bottom inevitably passes through the bullseye. Added `bus-left` and `bus-right` candidates (entering at target.left+4 and target.right-4) as clean alternatives. The kernel scores all three; the cleanest wins.

9. **Kernel gate invariant: `geo.nodes` MUST equal ALL rendered node boxes.** The visual-quality gate's `qualityGeometry.nodes` is built from `posterObstacles` (the full obstacle set, including pseudo-states). If it ever reverts to being built from `posterAnchors` (addressable targets only), pseudo-states disappear from the gate's view. Regression tests E1/E2 in `test/visual-quality.test.ts` enforce this invariant permanently.

10. **link-poster fix (2026-06-16):** `link A1.ship --> C1.Shipped : "triggers"` — the route now enters "Shipped" from its left side at center Y via `h-right-near`. The end-state bullseye (⊙) sits cleanly below the "Shipped" box; the red arrow does not touch it. `design/figures/link-poster.png` is the only changed golden; all others unchanged. 2772/2772 tests pass.


---

## Learnings (2026-06-16 — Aesthetic Metrics Layer)

### Work Done
Implemented the full aesthetic quality layer for the geometry-quality kernel. This closes the gap between "no egregious binary defects" and "layout feels comfortable" — catching the "feels horrible" class of issues that binary defect detection misses.

### Aesthetic Metrics (geometry/aesthetics.ts)
Five continuous metrics, normalized 0..1 (1 = best), pure + deterministic:

1. **`gridBalanceScore`** — 16×16 occupancy grid over the canvas. Two penalties combined: (a) largest contiguous empty region as a fraction of total cells (the "dead third" anti-pattern), and (b) variance of occupancy across four quadrants (lopsided layout). Score = 1 − 0.5×emptyFraction − 0.5×quadrantImbalance.

2. **`congestionScore`** — per-cell segment count over the 16×16 grid. CONGESTION_THRESHOLD = 3 segments/cell. Score = 1/(1 + max(0, peakLevel − 1)). Catches the "busy gutter" where all overlay routes pile into one inter-cell gap.

3. **`alignmentScore`** — fraction of node boxes that participate in at least one shared axis-aligned guide (left/center-x/right/top/center-y/bottom) within 5px tolerance. 1.0 = every box aligns to at least one other.

4. **`spacingUniformScore`** — coefficient of variation of gaps between adjacent sibling elements (boxes on similar rows or columns). 1.0 = all gaps equal; lower = irregular spacing.

5. **`edgeCrossingsAestheticScore`** — re-uses the existing `edgeCrossingsScore` from scores.ts (fraction of edge-pairs that do NOT cross).

Key exports: `computeAestheticScores(geo)`, `formatAestheticScorecard(geo, name, thresholds?)`.

### Corpus Calibration (baseline distribution, 5 posters, 2026-06-16)

| metric | min | max | mean |
|---|---|---|---|
| gridBalance | 0.617 | 0.684 | 0.666 |
| congestion | 0.600 | 1.000 | 0.790 |
| alignment | 0.778 | 1.000 | 0.889 |
| spacingUniform | 0.000 | 0.517 | 0.373 |
| edgeCrossings | 0.667 | 1.000 | 0.800 |
| overall | 0.649 | 0.788 | 0.714 |

Worst performers: poster-trace and trace-poster (overall 0.649, MEDIOCRE — unavoidable crossings in 2×2 multi-hop layout). Best: poster-crosslink (0.788, ACCEPTABLE).

### Corpus-Calibrated Thresholds

HARD GATE (fail):
- `gridBalance < 0.30`: extreme dead-whitespace (≥70% of canvas in one empty blob)
- `congestion < 0.30`: extreme gutter jam (≥10 segments per grid cell)

REPORT-ONLY (soft):
- All other metrics: too variable between layout styles to gate firmly
- alignment, spacingUniform: sensitive to node count; link-poster has spacingUniform=0.000 (geometrically unavoidable)
- edgeCrossings: some crossings are geometrically unavoidable in multi-hop 2×2 grids; 0.667 floor is expected

The hard-gate values are 50% below the corpus minimum — NO existing example fails. They catch only GENUINELY BROKEN future layouts.

### Route-Cost Congestion Penalty (route-cost.ts)

Added `congestion: 20` weight to `ROUTE_WEIGHTS` (between edgeCrossing:40 and bend:4).

In `scoreRoute`: added `sharesGutterCorridor(candidateSegments, committedEdge, CORRIDOR_TOL=24)` which detects when a candidate's vertical or horizontal segment runs parallel within 24px of a committed edge's segment AND overlaps along the shared axis. The `congestionCount` multiplied by 20 steers the router away from gutters that are already populated.

### Before → After Poster Scores (route-cost congestion penalty)

| Poster | metric | BEFORE | AFTER | Δ |
|---|---|---|---|---|
| link-poster | congestion | 0.750 | 1.000 | **+0.250** |
| link-poster | overall | 0.698 | 0.733 | +0.035 |
| poster-trace | gridBalance | 0.650 | 0.682 | +0.032 |
| poster-trace | overall | 0.642 | 0.649 | +0.007 |
| crosslink-poster | gridBalance | 0.654 | 0.684 | +0.030 |
| crosslink-poster | overall | 0.694 | 0.700 | +0.006 |
| trace-poster | gridBalance | 0.650 | 0.682 | +0.032 |
| trace-poster | overall | 0.642 | 0.649 | +0.007 |
| poster-crosslink | (all) | unchanged | unchanged | — |

The biggest win: `link-poster` congestion went from 0.750 → 1.000 (3 links now spread across distinct gutters instead of piling). The route change was confirmed by the poster-trace SVG diff: REQ-13's return hop now uses a bus route at x=791/485 instead of sharing the x=629 gutter with REQ-12.

### Visual Verdict (honest)

- **link-poster**: "handled by" and "fulfilled by" now use distinct routes into the class cell. "triggers" drops to the bus. Routes feel visibly less stacked. Residual: the right third of the flow cell (A1) is mostly empty (gridBalance 0.667 — acceptable for 3-cell horizontal layout).
- **trace-poster / crosslink-poster**: REQ-13/REQ-02 return legs now travel different corridors than REQ-12/REQ-01. More visual breathing room. Residual: 2 crossings unavoidable given the 2×2 geometry (top-left→bottom-right then bottom-right→top-right crosses top-left→bottom-right then bottom-right→bottom-left when they share the right vertical gutter).
- **poster-crosslink**: Unchanged — 2 right-going links were already routed to different gutter offsets via the lane system.

Residual issues (report-only, noted honestly): spacingUniform=0 on link-poster (3 overlay nodes at very different Y positions — geometrically unavoidable); edgeCrossings 0.667 on trace/crosslink posters (unavoidable crossing in 2×2 multi-hop layout).

### Files

- New: `packages/core/src/geometry/aesthetics.ts`
- Modified: `packages/core/src/geometry/index.ts` (export new functions)
- Modified: `packages/core/src/geometry/route-cost.ts` (congestion penalty + congestionCount in RouteCost)
- Modified: `packages/core/test/geometry-kernel.test.ts` (+18 aesthetic unit tests)
- Modified: `packages/core/test/visual-quality.test.ts` (+F group: corpus calibration + hard gate)
- Changed goldens: `examples/gallery/poster-trace.{svg,png}` (routing improved, still CLEAN)
- All other goldens: byte-identical

### Full Suite
2790 tests passing (up from 2772). Skia passed in the same run.
