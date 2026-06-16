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

