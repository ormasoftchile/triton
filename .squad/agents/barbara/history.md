# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T22:36:40Z (Intra-cell obstacle-aware routing; poster-trace 0.649→0.761 ACCEPTABLE; all 5 posters ACCEPTABLE; 2790/2790 tests pass)

---

## Current Status (2026-06-16)

**INTRA-CELL OBSTACLE-AWARE OVERLAY ROUTING COMPLETE.** Extended route-cost model to penalize intra-cell obstacles and added clean exit-port candidates (h-*-near, bus-left/right). The composition layout selector's best candidate (C1, trace-ordered row) was previously defective because A1→B1 routed rightward through SessionCache (same-cell sibling). Now defect-free. **poster-trace improved 0.649 MEDIOCRE → 0.761 ACCEPTABLE (0 crossings, kernel CLEAN).** All 5 posters now ACCEPTABLE (≥0.744). Commit 0425a12. 2790/2790 tests pass.

**AESTHETIC-DRIVEN COMPOSITION LAYOUT SELECTOR IMPLEMENTED.** Enumerate up to 5 candidate cell arrangements (C0–C4: as-authored, trace-ordered row/column, hub-sidebar variants). Score each using full layout+routing+aesthetic pipeline. Pick best zero-defect arrangement (C0-preferred tie-break, LAYOUT_EPSILON=0.02). For current corpus: C0 optimal for all 5 posters (no changes to existing goldens).

**Earlier updates (obstacle/target separation, aesthetic metrics, geometry kernel):** See history-2026-06-16-summarized.md for full detailed learnings.

---

## Archive & Historical Notes

**Full detailed work (2026-06-15–2026-06-16):** See `history-2026-06-16-summarized.md` for geometry-quality kernel validation, cross-diagram links Phase A/B implementation, trace abstraction, aesthetic metrics layer, composition layout selection, intra-cell routing, and earlier work.

**Earlier work (2026-06-14 and prior):** See `history-archive.md` and dated archive files.

---

## Key Learnings & Patterns (2026-06-16)

1. **Geometry quality gate:** Post-render validation catches real defects (state anchor regression); kernel defect detection is correct and trusted.
2. **Determinism preservation:** Sidecar registries (anchors) do not change scene hashes; only new features (link/trace) emit new overlay primitives.
3. **Cross-grammar anchor pattern:** All three grammars (flow/class/state) expose node bboxes differently; dual-indexing (ID + name) and truthy-checks handle parser quirks.
4. **Doc-sourced rendering:** Worked examples in §30b must use only anchored grammars (flow/class/state); non-anchored cells silently warn+skip, defeating the illustration purpose.
5. **Obstacles ≠ addressable targets.** NEVER share a single registry for both purposes. Grammars now return TWO registries — `anchors` (addressable targets, no pseudo-states) and `obstacles` (all node boxes, real + pseudo). Composition layer uses `anchors` for endpoint resolution and `obstacles` for kernel/router scoring.
6. **Same-cell obstacles are real.** Multi-node cells (class, state) contain multiple node boxes. The router must treat ALL node boxes as obstacles, whether inter-cell or intra-cell. Previous assumption (source-cell interior privilege) was incorrect.
7. **Route-cost penalty ensures determinism.** Obstacle defects are not binary gates; making them costly in scoring ensures the router automatically prefers clean routes without special-case logic.
8. **Candidate expansion works.** Adding intra-cell-aware exit-port variants (h-*-near, bus-left/right) gives the route scorer more options. Existing enumeration→scoring→pick loop handles intra-cell obstacles transparently.
9. **Aesthetic metrics validate kernel verdicts.** The 0.761 ACCEPTABLE score for poster-trace now includes 1.0 edgeCrossings (0 crossings), confirming kernel's CLEAN verdict and visual improvement are aligned.
10. **Composition layout selection (C0–C4) correctly handles defects.** Zero-defect requirement is HARD; C0 tie-break epsilon ensures well-authored posters don't change on marginal equivalences. Infrastructure is deterministic and generalizes to any poster topology.

**Full detailed learnings (obstacle/target separation, aesthetic metrics, layout selection, intra-cell routing):** See `history-2026-06-16-summarized.md`.

