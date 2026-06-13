# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-13T21:43:20Z

---

## Current Role

Render domain IRs to Scene IR primitives with deterministic, themeable output. Implement visualization grammars following grammar ≡ semantics / theme ≡ style principle.

---

## Key Learnings

- **Two-IR-Layer Model:** Domain IR → Scene IR (universal kernel). All styling in theme tokens.
- **Deterministic Rendering:** `measureText()`, `rhuInt()` rounding, fixed geometry — reproducible across platforms.
- **Theme-Driven Architecture:** Grammar IR independent of rendering; external style mimicry without IR changes.
- **Grammar governance pattern:** Spec semantics → define domain IR (no styling) → implement theme-driven layout → create GrammarTheme type + registry.

---

## Shipped Grammars (All 4)

| Grammar | Module | Tests | Theme(s) | Status |
|---------|--------|-------|----------|--------|
| **Timeline** | packages/core/src/grammars/timeline/ | 551+ | 5 (ByteByteGo dark) | SHIPPED |
| **Sequence** | packages/core/src/grammars/sequence/ | 611+ | 2 (bytebytego) | SHIPPED |
| **Tree** | packages/core/src/grammars/tree/ | 630+ | 2 (light + dark) | SHIPPED |
| **Flow** | packages/core/src/grammars/flow/ | 741+ | 2 (light + dark) | SHIPPED |
| **Composition** | packages/core/src/composition/ | 735+ | 2 (light + dark) | SHIPPED |

**Total test pass rate:** 790/790 (735 pre-existing byte-identical; 55 new validation)

---

## Recent Closeout (2026-06-13)

### Flow Grammar — Diamond Shape (Commit 4452e9e)

- Implemented deferred `kind: 'diamond'` as 4-point PathPrimitive rhombus
- Double padding for label fit inside inscribed area
- Stale comments cleaned: flow/layout, flow/types, sequence/types
- 8 new tests; all 741 tests pass; flow-rag-pipeline byte-identical

### Composition Layer — Two-Pass Row Sizing + Icon Transform Fix

- **Row Sizing:** Moved column scaling before row height computation; eliminates dead vertical space in mixed-height grids
- **Icon Transform:** Fixed composition-layer icon positioning by composing transforms before d-string application
- **Dark Themes:** darkCompositionTheme (#0d1117 canvas), darkFlowTheme (#111827), per-cell theme resolution
- **Determinism:** All row/column arithmetic pure; rhu(int) rounding preserved
- Result: Poster sizes optimized (1200×1144 → 1200×857 for dark poster)

### Animation + Crossing Minimization

- **SVG SMIL Animation:** Optional `animation?: DashflowAnimation` field on Path/Line; SMIL `<animate>` with stroke-dashoffset; PNG raster byte-identical (ignores SMIL)
- **Flow Crossing-Min:** Deterministic barycenter heuristic (4 alternating sweeps, lexicographic tie-breaking on node ids)
- 10 new animation tests + 12 crossing-min tests; total 725/725 pass

### Sequence Alt Multi-Compartments

- Fragment IR gains `sections?: FragmentSection[]` for multi-section logic (e.g., HTTP response: success/404/else)
- Dashed dividers + section labels rendered at boundaries
- Backward compat: fragments without sections render identically
- New gallery example: `sequence-alt-multicompartment.sequence.yaml`

---

## Current Implementation Status

**Kernel Extensions:** PathPrimitive.dashArray? (SMIL stroke-dashoffset), Scene IR animation field, scene-transform.ts helpers (translateAndScale, embedSceneInRect, parseSimpleTransform)

**Theme Registry Coverage:**
- 5 timeline themes (horizontal + 4 variants)
- 2 sequence themes (default UML + ByteByteGo dark)
- 2 tree themes (light + dark)
- 2 flow themes (light + dark, with animation duration tokens)
- 2 composition themes (light + dark poster)

**Gallery:** 20 cards representing all grammars and theme splits (same IR, different styles)

---

## Deferred Items (For Future Increments)

- Flow Inc-3+: Force-directed layout, stress-majorization, top-bottom orientation
- Tree Inc-2+: Forest support, shape variation per kind, depth/width linting
- Composition Inc-2+: Scale policy modes (clip, overflow), advanced URI schemes (pkg:, file:, http:)
- Timeline: Frame-by-frame animation, video export, Lottie format
- General: LLM-driven layout hints, collaborative editor integration

---

## Archive

For detailed implementation notes from increments 1–4 (June 10–13), including full Sequence/Tree/Flow/Composition implementation logs, see `barbara/history-archive.md`.

---

## Metrics Summary

- **Test Coverage:** 790 total (all pass; 55 new validation in Increment-2 closeout)
- **Byte-Safety:** All pre-existing goldens byte-identical; new gallery outputs deterministic
- **Kernel Stability:** No breaking changes; all extensions backward-compatible
- **Code Quality:** Theme-driven architecture verified across all 5 grammars + composition layer

