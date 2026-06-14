# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-14T04:41:53Z

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

## Metrics Summary

- **Test Coverage:** 1235 total (1083 baseline + 152 new for Tier 1 class/state/ER polish; all pass)
- **Byte-Safety:** All pre-existing goldens byte-identical; new gallery outputs deterministic
- **Kernel Stability:** No breaking changes; all extensions backward-compatible
- **Code Quality:** Theme-driven architecture verified across all 5 grammars + composition layer + UML Tier 1 polish

---

## Archive

For detailed implementation notes from earlier work (2025 even-horizontal timeline, Tier 1 kickoff, detailed learnings), see `barbara/history-archive.md`.

---

## Learnings (Tier 1 · C4 Polish — 2026-06-14)

### C4 Element Placement with Boundary Grouping

**Approach:** `computeTopLevelGrid` separates boundaries (row 0, left-to-right) from top-level elements (row 1, centered). Inside each boundary, `sortBoundaryChildren` orders children by rank: Person/Person_Ext=0, sub-Boundary=1, other elements=2. This places hub systems (like Internet Banking System) in the center-bottom of their boundary — directly below the persons who use them — eliminating long-distance diagonal crossings.

**Files:** `packages/core/src/grammars/c4/layout.ts` (functions `computeTopLevelGrid`, `sortBoundaryChildren`, `childSortRank`).

### Orthogonal Routing with Port Distribution

**Approach:** All C4 `Rel` edges use orthogonal L-shaped paths (HVH or VHV `PathPrimitive`), never diagonal `LinePrimitive`. Two-pass port distribution: first compute routing strategy for all rels, then distribute per-(alias, side) group with 24 px spacing, clamped to [edge+8, edge−8]. Multiple edges into the same element fan out across the perimeter rather than bunching at one point.

**Files:** `packages/core/src/grammars/c4/layout.ts` (functions `computePortPairs`, `portOffsetCoord`, `buildOrthogonalPath`).

### Edge Label Clear-of-Boxes Rule

**Rule:** Edge labels (and tech sub-labels) are placed at the midpoint of the longest path segment, offset perpendicularly by 22 px. `adjustLabelAnchor` checks against all element boxes (boundaries excluded); if overlap detected, moves label above the box. Only solid-filled element boxes are checked — dashed boundary borders are transparent for routing and label purposes.

**Files:** `packages/core/src/grammars/c4/layout.ts` (functions `adjustLabelAnchor`, `collectElementBoxes`).

### VHV Fallback When HVH Vertical Is Blocked (Proximity Grazing Fix)

**Problem:** When HVH's initial midX is blocked by an element box, the search adjusts midX rightward/leftward. The adjusted midX may place the first horizontal segment within a few pixels of a neighbouring element, creating visual confusion (e.g., CustomerA→SystemAA horizontal at y=164 grazing CustomerB's left edge at y=164).

**Detection:** In `determineRelStrategy`, after confirming the first H segment is clear, ALSO check if the VERTICAL at midX=(sx+ex)/2 is blocked. If blocked (meaning the rightward midX adjustment will occur), switch to VHV immediately, using `fromSide='bottom', toSide='top'` when source is above target.

**Result:** CustomerA→SystemAA routes cleanly from CustomerA's bottom, across at y=273 (clear space between the persons row and systems row), into SystemAA's top. No visual ambiguity.

**Files:** `packages/core/src/grammars/c4/layout.ts` (function `determineRelStrategy`, `vertBlocked` check added).

### Arrowhead Path-Endpoint Travel-Direction Gotcha

**Problem:** Using `sideDir(endSide)` (outward normal) to compute path endpoint gives the wrong direction for paths entering a box. For a path entering from the RIGHT (`endSide='right'`), the outward normal is `+x` but the travel direction is `−x`. Using the wrong sign creates a 24 px gap between the path end and the arrowhead base.

**Fix:** Each routing branch (`hvh`, `vhv`, `h`, `v`) independently computes `finalEndDirX/Y` from the actual travel direction of the last segment (`ex > midX ? 1 : -1`), not from `sideDir`.

**Files:** `packages/core/src/grammars/c4/layout.ts` (function `buildOrthogonalPath`, each branch).

### C4 Corpus Test Structure

AC1–AC10 tests (`packages/core/test/mermaid-c4-corpus.test.ts`) assert structure only (element/boundary/rel counts, positive dimensions, non-empty files) — no coordinate assertions. AC10 regenerates `examples/gallery/mermaid-c4.{svg,png}` automatically.

### Gallery Output

- **viewBox:** 1189×744 (was 1445×728 diagonal-routing original)
- **All rels:** orthogonal `<path>` elements (zero `<line>` elements)
- **Test result:** 1280/1281 pass; 1 pre-existing Skia flake unrelated to C4

---

## Learnings (Tier 1 · classDiagram)

Class grammar (UML software line) shipped with deterministic 2-column layout. All 6 UML relationships rendered as Scene path primitives (inheritance, realization, composition, aggregation, association, dependency) to preserve SVG/PNG/Skia backend compatibility. Class compartments (attributes, methods) sized via measureText(). Light+dark themes supported.

## Milestone: Tier 1 Layout Polish — State + ER (2026-06-14T04:41:53Z)

**Date:** 2026-06-14T04:41:53Z  
**Status:** COMPLETE  
**Commit:** 9c2d9b3 "feat(mermaid): Tier 1 — stateDiagram + erDiagram"  
**Previous work:** Bjarne's stateDiagram + erDiagram grammars passed initial render but coordinator visual review flagged three state collision classes and two ER routing defects.

### State Diagram: Rank-Based Skip-Transition Side Routing + Adjacent-Label Placement

**Problem 1:** Skip transitions (source and target 2+ ranks apart) placed labels at geometric midpoint, which falls inside intermediate state boxes → text-on-text overlap.

**Solution:** Compute `rank` (0-based position in column) for every top-level state, propagated to composite children. For `|rank_diff| > 1`, emit **L-shaped side-route path** exiting left to `sideTrackX = marginLeft/3 ≈ 19 px`, traveling vertically, re-entering target horizontally. Labels placed at `(sideTrackX+6, midY_vertical)` with white background rectangles — always in left margin, unreachable by any state box.

**Problem 2:** Adjacent transitions placed labels at 50% midpoint, near target-box top edge → visual crowding.

**Solution:** Move label placement to `t=0.34` (34% from source), keeping label in source-node half of gap.

**Problem 3:** Composite state children cramped inside container, arrowheads crowding borders.

**Solution:** Dedicated `compositeBodyPadX: 22`, `compositeBodyPadY: 14` theme tokens (separate from global state padding).

**Files:** `packages/core/src/grammars/state/layout.ts` (rank propagation, side-route dispatcher, label placement), `packages/core/src/grammars/state/theme.ts` (padding tokens).

**Result:** mermaid-state.svg 670×942 px; all skip-labels in margin, adjacent-labels in gaps, composite children breathe.

### ER Diagram: Degree-Sort + Interleaved Grid + Wider Gaps

**Problem 1:** Long diagonal routing (PRODUCT↔LINE_ITEM 511 px) crossing multiple entity boxes.

**Root cause:** Declaration-order column-first grid fill (PRODUCT col=1 row=0, LINE_ITEM col=0 row=2 — maximally far, diagonally opposite).

**Solution:** **Degree-sort + interleaved placement:** Sort entities by relationship count (descending), tie-break on name. Assign to 2-column grid with `col = index % 2`, `row = floor(index / 2)`. High-degree entities (PRODUCT deg=3, CUSTOMER/LINE_ITEM/ORDER deg=2) land in adjacent grid cells. All relationships become axis-aligned.

**Result:** PRODUCT↔LINE_ITEM long diagonal collapses to 4 px vertical segment.

**Problem 2:** Crow's-foot glyphs on same-row horizontal edges appear cramped (43 px actual line).

**Solution:** Increase `entityGapX: 96→120`, `entityGapY: 48→56`. Result: 68 px horizontal clearance.

**Files:** `packages/core/src/grammars/er/layout.ts` (degree computation, interleaved placement), `packages/core/src/grammars/er/theme.ts` (gap increases).

**Result:** mermaid-er.svg 656×706 px; CUSTOMER↔PRODUCT wishlist line spacious, PRODUCT↔LINE_ITEM vertical segment clean.

### Known Limitation Deferred

**CATEGORY↔PRODUCT label placement:** Same-column skip edge (2-row gap) label midpoint lands at y≈368 inside LINE_ITEM box. Label shifted 12 px perpendicular. Full fix requires same-column side-routing for ER (like state) — deferred to future increment.

### Verification

- Build & typecheck: ✓
- Test suite: 1235 / 1235 passing (baseline unchanged, all goldens byte-identical)
- Gallery outputs verified

**No regressions. All layout improvements deterministic.**

---

## Milestone: Tier 1 Layout Polish — State + ER (2026-06-14T04:41:53Z)

**Date:** 2026-06-14T04:41:53Z  
**Status:** COMPLETE  
**Commit:** 9c2d9b3 "feat(mermaid): Tier 1 — stateDiagram + erDiagram"  
**Previous work:** Bjarne's stateDiagram + erDiagram grammars passed initial render but coordinator visual review flagged three state collision classes and two ER routing defects.

### State Diagram: Rank-Based Skip-Transition Side Routing + Adjacent-Label Placement

**Problem 1:** Skip transitions (source and target 2+ ranks apart) placed labels at geometric midpoint, which falls inside intermediate state boxes → text-on-text overlap.

**Solution:** Compute `rank` (0-based position in column) for every top-level state, propagated to composite children. For `|rank_diff| > 1`, emit **L-shaped side-route path** exiting left to `sideTrackX = marginLeft/3 ≈ 19 px`, traveling vertically, re-entering target horizontally. Labels placed at `(sideTrackX+6, midY_vertical)` with white background rectangles — always in left margin, unreachable by any state box.

**Problem 2:** Adjacent transitions placed labels at 50% midpoint, near target-box top edge → visual crowding.

**Solution:** Move label placement to `t=0.34` (34% from source), keeping label in source-node half of gap.

**Problem 3:** Composite state children cramped inside container, arrowheads crowding borders.

**Solution:** Dedicated `compositeBodyPadX: 22`, `compositeBodyPadY: 14` theme tokens (separate from global state padding).

**Files:** `packages/core/src/grammars/state/layout.ts` (rank propagation, side-route dispatcher, label placement), `packages/core/src/grammars/state/theme.ts` (padding tokens).

**Result:** mermaid-state.svg 670×942 px; all skip-labels in margin, adjacent-labels in gaps, composite children breathe.

### ER Diagram: Degree-Sort + Interleaved Grid + Wider Gaps

**Problem 1:** Long diagonal routing (PRODUCT↔LINE_ITEM 511 px) crossing multiple entity boxes.

**Root cause:** Declaration-order column-first grid fill (PRODUCT col=1 row=0, LINE_ITEM col=0 row=2 — maximally far, diagonally opposite).

**Solution:** **Degree-sort + interleaved placement:** Sort entities by relationship count (descending), tie-break on name. Assign to 2-column grid with `col = index % 2`, `row = floor(index / 2)`. High-degree entities (PRODUCT deg=3, CUSTOMER/LINE_ITEM/ORDER deg=2) land in adjacent grid cells. All relationships become axis-aligned.

**Result:** PRODUCT↔LINE_ITEM long diagonal collapses to 4 px vertical segment.

**Problem 2:** Crow's-foot glyphs on same-row horizontal edges appear cramped (43 px actual line).

**Solution:** Increase `entityGapX: 96→120`, `entityGapY: 48→56`. Result: 68 px horizontal clearance.

**Files:** `packages/core/src/grammars/er/layout.ts` (degree computation, interleaved placement), `packages/core/src/grammars/er/theme.ts` (gap increases).

**Result:** mermaid-er.svg 656×706 px; CUSTOMER↔PRODUCT wishlist line spacious, PRODUCT↔LINE_ITEM vertical segment clean.

### Known Limitation Deferred

**CATEGORY↔PRODUCT label placement:** Same-column skip edge (2-row gap) label midpoint lands at y≈368 inside LINE_ITEM box. Label shifted 12 px perpendicular. Full fix requires same-column side-routing for ER (like state) — deferred to future increment.

### Verification

- Build & typecheck: ✓
- Test suite: 1235 / 1235 passing (baseline unchanged, all goldens byte-identical)
- Gallery outputs verified

**No regressions. All layout improvements deterministic.**


## Learnings (Tier 2 · Chart Foundation — 2026-06-14)

### Shared Chart Grammar Layer

A new `packages/core/src/grammars/chart/` foundation now handles chart semantics (`ChartDocument`), deterministic closed-form scales (`LinearScale`, `BandScale`, `RadialScale` stub), reusable axis/grid emitters, and shared mark generation. The same Scene IR primitives already used by the timeline/sequence/flow/tree/UML grammars are sufficient for pie sectors and xychart overlays, so no serializer changes were required.

### Pie Label Strategy

Pie charts use a priority-first placement rule rather than iterative collision solving: sort slices by angular span descending, try inside placement for roomy slices, fall back to outside placement for small or colliding slices, and emit leader lines for spillover labels. This keeps layout deterministic while preserving the most important labels first.

### XY Chart Composition

`xychart-beta` is normalized into row-oriented chart data with `bar_*` / `line_*` numeric fields per x position. Layout then derives grouped bars, polyline series, gridlines, and axis ticks from the shared chart foundation; long categorical labels are handled by deterministic tick skipping based on measured width vs band width.
