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


---

## Learnings — 2026-06-13T17:43:20-04:00 Composition ir_file Ref Resolution

### ir_file ref resolution as a separate pure-preserving step

Added `kind: 'ref'` variant to `CellContent` and `timeline` inline variant. The core insight is that file I/O is isolated in a single module (`resolve.ts`) that produces a fully-inlined `CompositionDocument` BEFORE the layout pipeline runs. `buildCompositionScene` / `layoutComposition` remain pure (no I/O) — they never see `kind:'ref'` cells.

**Files changed:**
- `composition/types.ts` — Added `TimelineCellContent` and `RefCellContent` to `CellContent` union
- `composition/schema.ts` — Added `timelineCellContentSchema`, `refCellContentSchema` to discriminated union; imported `irDocumentSchema`
- `composition/layout.ts` — Added `case 'timeline'` (calls `buildScene` from render/index); added guard for `case 'ref'` (throws if unresolved ref reaches layout)
- `composition/resolve.ts` — New file: `resolveCompositionRefs(doc, baseDir)` — the only file-I/O in the composition pipeline
- `composition/index.ts` — Exported new types + `resolveCompositionRefs`; added `renderCompositionDocumentFromRefs(doc, baseDir, opts)` convenience wrapper

**Architecture pattern:** This mirrors how grammar docs are loaded by the CLI/tests, not by the layout. The resolver reads → parses (YAML/JSON) → validates via grammar schema → returns inline CellContent. The layout stays pure.

**Test additions (E1–E5):**
- E1: `resolveCompositionRefs` inlines ref cells, preserves inline cells, does not mutate original
- E2: Missing file throws clear error matching `/cannot read ir_file/`
- E3: Resolved poster is deterministic (sceneHash stable)
- E4: Resolved poster hash ≡ equivalent inline poster hash (byte-identical)
- E5: Gallery emit → `examples/gallery/poster-refs.{svg,png}`

**Example created:** `examples/gallery/poster-refs/` — composition YAML referencing `pipeline.flow.yaml` + `taxonomy.tree.yaml`; rendered outputs at `examples/gallery/poster-refs.{svg,png}`.

**All 795 tests pass; all existing goldens byte-identical.**

---

## 2026-06-13 — STRATEGIC PIVOT: Mermaid-Superset Positioning (Scribe Update)

**Status:** LOCKED — MAJOR DIRECTION CHANGE

Product repositioned as **full Mermaid superset** (all 22 types) compiling to shared deterministic Scene IR.

### Positioning & Differentiators

1. **Aesthetics is a headline pillar** (explicit competitive advantage)
   - Beat Mermaid's look-and-feel out of the box
   - Barbara work: Theme system for all 5 families; typography, color harmony, layout polish
   - Scoped deliverables: 5-family theme families; dark/light variants + domain-specific (ByteByteGo, corporate, academic)

2. **Chart Family (New Grammar-of-Graphics Kernel)**
   - Grammar-of-graphics layer for pie, xychart, quadrant, radar
   - Barbara work: Design ChartScene IR; implement Mark's ChartData specs → geometries
   - Downstream: Tier-2 coverage roadmap

3. **UML/Software Diagram Line (Tier-1)**
   - class, state, ER, C4 as architectural/UML story
   - Barbara work: Class diagram rendering (boxes, inheritance, composition, abstract); state diagram (state circles, transitions, guards); ER (entity/attribute/relationship); C4 (system/container/component/code views)
   - Blocking: Mark's UML domain IRs must be designed first

4. **Five Families (Taxonomy)**
   1. Node-Link/Graph (Sugiyama kernel) — flowchart, C4, architecture, block, requirement, gitGraph, sankey
   2. UML/Software — sequence, class, state, ER
   3. Charts (grammar-of-graphics) — pie, xychart, quadrant, radar
   4. Timeline/Project (track-based) — gantt, timeline, journey, kanban
   5. Tree/Hierarchy (Buchheim–Jünger–Leipert) — mindmap, treemap

### Current State
- 4 grammars shipped (timeline, sequence, tree, flow) + composition
- Theme-driven architecture verified; 790/790 tests pass
- All pre-existing goldens byte-identical; dark theme closures stable

### Next Build Phase
- **T0 wiring:** Mermaid → existing grammars (Mark: parser; Barbara: theme coverage)
- **T1 UML:** Class/state/ER/C4 rendering (Barbara: increment-2 work; blocks on Mark's IRs)
- **T2 charts:** Grammar-of-graphics rendering (Barbara: increment-3; blocks on Mark's ChartData IR)
- **Aesthetics:** Complete 5-family theme set; establish design system (Barbara: parallel priority)


---

## 2025 — Even-Horizontal Layout Mode (Barbara)

**Date:** 2025  
**Status:** SHIPPED

### Problem Solved

Mermaid `timeline` diagrams (e.g., "History of Programming Languages" — 13 periods 1954–2014) rendered in horizontal layout with time-proportional spacing produced label collisions: 1954/1958/1960 are clustered within 6 years out of a 60-year span, so their milestone circles and label blocks overlapped. Real Mermaid uses **evenly-spaced columns** (Mermaid-columnar), not proportional time.

### Approach: Even-Spacing Mode for Horizontal Layout

Mirrored the existing `isEvenSpacing` pattern from `vertical-spine.ts` (lines ~418–560). Key changes in `packages/core/src/layout/horizontal.ts`:

1. **`W` and `wDraw` changed from `const` to `let`** — enables canvas expansion when N milestones × MIN_COL_W exceeds the theme's default width.
2. **`evenXPositions` array** — precomputed after `msWithOrd.sort(...)`. Each milestone gets `offset + ms.size + i * evenColW` (with `ms.size` padding on each side so node circles stay within canvas bounds). If `(N-1) * evenColW + 2*ms.size > wDraw`, the canvas expands.
3. **`evenDateX(ord)`** — interpolates x for activities and section bands between adjacent milestone ordinals (mirrors `evenDateY` from vertical-spine).
4. **`effectiveDateX(ord)`** — returns `evenDateX(ord)` in even mode, `dateX(ord, axisState)` in time mode. Applied to all activity x-coords, section band x-coords, today-marker, annotations, callouts.
5. **Axis tick suppression** — in even mode the time-proportional ruler is suppressed (`if (!isEvenSpacing)`) because tick positions would not correspond to the evenly-spaced columns. Milestone label blocks carry the actual period dates.
6. **Section bands** — in even mode, derived from track-member milestone positions padded by `evenColW/2`, clamped to `[offset, offset+wDraw]`. This creates clean flush column bands.

### Key Constants

- `EVEN_MIN_COL_W = 100` px (minimum column width to prevent label collisions)
- Padding = `ms.size` (milestone node radius) on each side

### Determinism Contract

The even path is gated on `theme.spineSpacing === 'even'`. All existing themes that don't set this token are completely unaffected — their golden outputs are byte-identical. Verified: 1083/1083 tests pass.

### Output: mermaid-timeline.svg

- **ViewBox:** 1296×791.86 (expanded from 1200×792 default; 1256px draw width for 13 milestones × 100px columns)
- **13 milestones** evenly spaced at cx = 28, 128, 228, ..., 1228 (100px apart, 28px padding on edges)
- **4 section bands** correctly partitioned: Foundations [0,278], Systems Era (odd, transparent), Scripting Wave [578,878], Modern Languages (odd, transparent)
- No label collisions; all period labels visible and separated

### Key Files

- `packages/core/src/layout/horizontal.ts` — Even-horizontal mode implementation
- `packages/core/src/themes/types.ts` — Updated `spineSpacing` doc comment (now applies to horizontal too)
- `packages/core/src/frontend/mermaid/index.ts` — Already passes `spineSpacing: 'even'` for timeline kind (line ~345)
- `packages/core/src/render/index.ts` — `buildScene` already threads `spineSpacing` into theme (line ~70)
- `examples/gallery/mermaid-timeline.svg` — Regenerated (1296×791.86)
- `examples/gallery/mermaid-timeline.png` — Regenerated (~98KB)

**Date:** 2026-06-14T00:10:54Z  
**Status:** LIVE

Mermaid flowchart parser (Tier 0 Inc 1) now renders via existing dark-flow theme.
Rendered gallery example (CI/CD pipeline) visibly cleaner than Mermaid default output — achieved explicit project pitch criterion ("prettier than Mermaid").

**Theme coverage:** flowchart + sequence + tree + timeline all support dark themes; composition layer resolves per-cell theme inheritance. Next: UML family themes (class, state, ER, C4).


**Tier 0 COMPLETE (2025-01-01):** Even-spacing horizontal timeline (9233px→792px, collisions resolved) finalized. Tier 0 integration complete.
