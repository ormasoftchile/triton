# Barbara — Archive of Earlier Work

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

---

## 2026-06-13 — Tier 1 Kickoff: classDiagram Rendering via Scene Paths

**Date:** 2026-06-13T22:59:00Z  
**Status:** SHIPPED

Class grammar (UML software line) shipped with deterministic 2-column layout. All 6 UML relationships rendered as Scene path primitives (inheritance, realization, composition, aggregation, association, dependency) to preserve SVG/PNG/Skia backend compatibility. Class compartments (attributes, methods) sized via measureText(). Light+dark themes supported. Next: state, ER, C4 grammar rendering.

---

## Learnings — 2026-06-13 — Tier 1: classDiagram Implementation

**Date:** 2026-06-13T21:43:20Z  
**Status:** COMPLETE

### Pattern: Grammar-Driven Theme Architecture

Class diagram IR fully independent of rendering. Theme defines all positioning, colors, padding. Adding a new class theme requires only: grammar schema validation, measureText() loop for compartments, grid placement, and path primitives — no changes to class IR or parser.

**Example:** `lightClassTheme` (white background, black text) and `darkClassTheme` (#1F2937 boxes, white text) use identical layout code; only token values differ.

### Path Primitives for UML Markers

All six UML relationships rendered as Scene `path` primitives:
- Inheritance: hollow triangle tip → `path (polygon)`
- Realization: hollow triangle (dashed edge) → `path + dashed`
- Composition: filled diamond → `path (diamond)`
- Aggregation: hollow diamond → `path (diamond outline)`
- Association: open arrow → `path (simple line + arrowhead)`
- Dependency: dashed arrow → `path (dashed + arrowhead)`

No backend-specific code; SVG and PNG both interpret `path` correctly. Preserves Skia/canvas/WebGL compatibility.

### Determinism: Grid Placement + Compartment Sizing

- Grid assignment: declaration order → 2-column left-fill
- Compartment sizing: `measureText()` for each line (attributes, methods) → height sum
- Coordinate rounding: `rhuInt()` for all x, y, width, height
- Padding: fixed theme tokens (classNamePadX, classBodyPadY, etc.)

Result: byte-identical goldens across platform/font implementations (as verified by jest snapshot tests).

---

