# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T00:31:46Z (Extended Timeline spec'd (§16b); 4 IR gaps flagged incl. schema layout-enum bug)

---

## Current Status (2026-06-16)

**Extended Timeline Spec'd (§16b; leslie):** One IR × 6 layouts × 7 themes = 42 presentations. Two-tier superset of Mermaid `timeline` with full IRDocument field mapping. Four known IR gaps flagged: (1) Milestone no `shape` field, (2) schema.ts layout enum missing `gantt`/`timeline-columns`, (3) `density` not persisted, (4) legend auto-generation unspecified. Implementation TBD.

**Active Work (2026-06-15):**
- Dimension guard test + spine height warning + config-layout fix (2642/2642 tests)
- 3 named contract themes (terminal, pastel, mono) added; matrix: 7×21 components = 2392/2392 tests
- 4 earlier named themes (midnight, blueprint, editorial, executive) — all coherent across 21 diagram types
- All themes follow `categorical[0] = accent` convention; zero per-component binding changes required

---

## Archive & Historical Notes

**2026-06-15 Detailed Work:** See `history-2026-06-15-summarized.md` for dimension guard root-cause analysis, render-time warning implementation, config-layout demo fix, and full theme coherence verdicts.

**Earlier Work (2026-06-14 and prior):** See `history-archive.md` and dated archive files for timeline ResolvedTheme generalization, Tier 3 long-tail grammar completion, theme vocabulary resolution, and contract spike details.
