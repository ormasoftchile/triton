# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T14:45:00Z (Geometry-quality kernel validation complete; all posters CLEAN)

---

## Current Status (2026-06-16)

**GEOMETRY QUALITY KERNEL + GATE COMPLETE.** Kernel validated against synthetic bad geometry (acid tests pass). Router wired with `pickBestRoute`. Post-render gate `visual-quality.test.ts` added (9 tests, all passing). State pseudo-state anchor fix (`isPseudo` truthy-check) corrected link-poster route. ALL 5 posters verified CLEAN by both kernel and visual inspection. 2770 tests passing, determinism preserved. Committed b4b2f04.

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
