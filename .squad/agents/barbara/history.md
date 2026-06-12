# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

---

## 2026-06-11 Session — T4 Serpentine Layout & Skia Stroke Fix (FINAL SESSION)

**Status:** ✅ ALL FIVE TARGETS NOW CLOSED

### Session Overview

Implemented the final target: **serpentine** (boustrophedon) layout family as the third layout family, achieving full closure of all five design targets (T1–T5). Additionally, fixed a critical Skia backend bug where stroke-only paths with glow effects rendered as filled slabs.

---

## T4 Serpentine Layout Family

### Path Geometry: Boustrophedon

**Canvas:** 1200px wide. Path rows run left↔right with rounded U-turns (radius 80px default).

- Row 0 (even): Left→Right from (90, pathStartY) with right turn
- Row 1 (odd): Right→Left from (1110, y_1) with left turn
- Row 2 (even): Left→Right again
- etc.

**Arc-length parameterization:**
- L_row = 1020px (rowWidth), L_turn = π*r = 251.3px
- Nodes placed at centred intervals t_i = (i+0.5)/n
- Prevents NODE_OVERLAP at path endpoints (t=0, t=1 reserved for start/end badges)

**Canvas height auto-computed:** `headerH + TOP_PAD + (nRows−1)*rowSpacing + BOTTOM_PAD`
Formula: `nRows = max(2, ceil(n / NODES_PER_ROW))` where NODES_PER_ROW=3. For 9 entries: 3 rows.

### Gradient Approach: Segmented Path

Used 64 short straight-line `PathPrimitive` sub-segments, each with solid colour interpolated between `gradientFrom` (#86EFAC light green) and `gradientTo` (#15803D dark green) via linear RGB interpolation.

**Why:** Works in all backends (SVG, Skia, PNG/resvg) without path-gradient shaders. Slight polygonal approximation invisible at 14px strokeWidth.

**Glow layer:** One additional `PathPrimitive` with full boustrophedon SVG path (with arc commands), rendered BEFORE gradient segments. Wider stroke (+4px), opacity 0.6, SceneEffect `{ kind:'glow', color, radius }`.
- SVG backend: silently omits effects
- Skia backend: renders soft green glow halo

### Start/End Icon Badges

Rendered at `pathPointAtS(0, geo)` (start) and `pathPointAtS(totalLength, geo)` (end).
- CirclePrimitive: r=22, dark green fill
- Icon PathPrimitive: single-translate form `translate(cx − 12*s, cy − 12*s) scale(s)`
- Default icons: startIcon='play', endIcon='target' (configurable via theme.serpentine.startIcon/endIcon)

### Labels

TextPrimitive offset 14+nodeRadius px from node center.
- Even rows → label BELOW (dominantBaseline:'hanging')
- Odd rows → label ABOVE (dominantBaseline:'alphabetic')
- Truncated at 16 chars with '…'

### Linter Compatibility

Linter's `pathBBox` returns null for paths with curves (arc commands) → gradient segments and glow path are not bounds-checked. No false OUT_OF_BOUNDS errors. Node circles (r=10) are checked; all within [0,W]×[0,H] with ≥10px margin. NODE_OVERLAP prevented by centred-interval placement (~333px arc-length gap vs. 20px combined diameter).

### Theme: `serpentine`

**File:** packages/core/src/themes/serpentine.ts
- Tier 3, light canvas (#F7FBF7), Skia glow enabled
- Gradient: #86EFAC (light green) → #15803D (dark green)
- Glow: #4ADE80, radius 18
- Path stroke: 14px
- Turn radius: 80px, rowSpacing: 160px
- Nodes: r=10, white fill, dark green stroke
- Badges: r=22, dark green fill
- Labels: 9pt, gray (#374151)

### Fixture: `serpentine-journey`

9 milestones (Kickoff → V4 Milestone) spread 2020–2024, all with icons.
3 rows of 3 nodes each. No legend.

### Goldens Generated

- `examples/gallery/showcase/serpentine-journey-skia.png` (1200×556 px)
- `examples/gallery/showcase/serpentine-journey.svg` (11KB)

### Files Touched (T4)

**New:**
- `packages/core/src/layout/serpentine.ts`
- `packages/core/src/themes/serpentine.ts`
- `examples/showcase/serpentine-journey.timeline.yaml`
- Goldens: serpentine-journey-skia.png, serpentine-journey.svg

**Modified:**
- `packages/core/src/themes/types.ts` — SerpentineLayoutTheme added
- `packages/core/src/themes/index.ts` — serpentine theme registered
- `packages/core/src/layout/index.ts` — 'serpentine' dispatcher
- `packages/core/src/types.ts` — 'serpentine' in RenderOptions.layout union
- `packages/core/src/render/index.ts` — layout dispatcher
- `packages/cli/src/index.ts` — --layout serpentine option
- `packages/core/test/skia.test.ts` — 6 T4 tests

### T4 Fidelity Assessment

| Feature | Target | Achieved |
|---------|--------|----------|
| Light background | ✅ | ✅ |
| Winding 3-row path | ✅ | ✅ |
| Thick rounded stroke | ✅ | ✅ |
| Soft green glow (Skia) | ✅ | ✅ |
| Light→dark gradient | ✅ | ✅ (segmented) |
| Evenly-spaced nodes | ✅ | ✅ |
| Start/end badges | ✅ | ✅ (play/target) |
| Optional labels | ✅ | ✅ |
| No axis | ✅ | ✅ |

**Status: ✅ CLOSED.** 567/567 tests pass.

---

## Skia Stroke-Only Path Glow Fix

### Root Cause

The serpentine path renders with `fill: 'none'` and `effects: [{ kind: 'glow', ... }]`.

Original `renderPath` in `skia.ts` routed ALL paths through `renderWithEffects`, which:
1. Creates `glowPaint` with `PaintStyle.Fill`
2. Calls `drawFn` with glowPaint as `overridePaint`
3. Since `overridePaint !== null`, the Fill paint was used

When drawing a filled closed SVG path from open geometry (implicit closure), this produced:
- A filled green slab across the row area (the glowPaint's Fill)
- A diagonal "closing" band from path end back to start

Main draw pass rendered transparent (invisible), so the glow fill was visible but masked the stroke.

### Fix: Detect `fill === 'none'` in renderPath (skia.ts)

Added stroke-only detection at top of `renderPath`:

```typescript
const strokeOnly = p.fill === 'none'

if (strokeOnly) {
  // Skip renderWithEffects entirely
  // For each glow effect: create PaintStyle.Stroke paint with blur ImageFilter
  // Main stroke pass: normal PaintStyle.Stroke paint
} else {
  // Original code path for filled paths (unchanged)
}
```

When `!strokeOnly`: existing code path unchanged — `renderWithEffects` fills, then separate stroke pass.

### Corrected Result

**Before:** Filled green slab + diagonal closing bands (Skia only; SVG was correct)
**After:** Thin winding green stroke with soft glow halo (Skia ≡ design target)

- Glow path: 18px wide stroke with 0.6 opacity + green blur → soft halo
- Gradient segments: 14px stroke, round caps, light→dark green → seamless
- Matches design target: slim glowing line, no slab

### Cascade Impact

Fixed serpentine AND improved 4 existing showcase goldens:
- feature-rich-skia.png (glow now correct)
- gitline-skia.png (glow now correct)
- journey-skia.png (glow now correct)
- subject-timeline-skia.png (glow now correct)

Horizontal golden guard (our-timeline-skia.png) byte-identical.

---

## Session Results

- **T4 Implementation:** Complete serpentine layout family with boustrophedon path, arc-length nodes, segmented gradient, glow, badges, labels
- **Skia Fix:** Stroke-only path glow now renders correctly; improves 4 existing goldens
- **Test Coverage:** 567/567 tests pass (551 core + 13 schema + 3 cli)
- **All Five Targets:** CLOSED (T1 horizontal, T2 vertical-spine dark, T3 vertical-spine dense, T4 serpentine, T5 vertical-spine cards)

**Milestone Achieved:** All design targets fully renderable from IR to byte-deterministic output.

---

## 2026-06-11 Session — Smooth Gradient & Palette-Derived Serpentine

### Improvement 1 — True Smooth Stroke Gradient

**StrokeGradient Scene Primitive Extension:**
- Added `StrokeGradient` interface and optional `strokeGradient?` field to `PathPrimitive` in `packages/core/src/scene.ts`.
- Shape: `{ from: string; to: string; x1: number; y1: number; x2: number; y2: number }` — endpoint colors + scene-space coordinates.
- When present, the path is stroked with a linear gradient instead of a flat solid `stroke`.
- Purely additive/opt-in: all existing PathPrimitives without the field are unaffected (canonicalJSON omits undefined values → sceneHash stable for existing scenes).

**SVG Backend (`render/svg.ts`):**
- Added `strokeGradientId(sg)` — content-based deterministic ID: `sg-{x1}-{y1}-{x2}-{y2}-{fromHex}-{toHex}` (period replaced with 'd' for XML safety).
- Added `collectGradientDefs(primitives)` — walks scene tree, deduplicates by ID, emits `<linearGradient gradientUnits="userSpaceOnUse" id="sg-..." x1="..." ...><stop offset="0%".../><stop offset="100%".../>` in `<defs>`.
- Path rendering: `stroke="url(#sg-...)"` when `strokeGradient` present.
- Defs block: merges clip-path defs (images) + gradient defs into one `<defs>` block.

**Skia Backend (`render/skia.ts`):**
- In `renderPath` strokeOnly branch: condition extended to `(p.stroke || p.strokeGradient) && strokeWidth > 0`.
- When `strokeGradient` present: builds `CK.Shader.MakeLinearGradient([x1,y1],[x2,y2], [parseColor(from,opacity), parseColor(to,opacity)], null, CK.TileMode.Clamp)`, applies shader to stroke Paint — true smooth gradient, no faceting.
- When absent: existing solid `parseColor(p.stroke)` path unchanged.

**Linter fix (`lint.ts`):**
- `pathBBox` now skips paths containing arc/curve SVG commands (`A, Q, C, S, T, a, q, c, s, t`).
- Previously, the single boustrophedon path (with A commands) had 4 M/L vertices that passed the 3–7 polygon check, producing a huge scene-spanning bbox that flagged all circles as NODE_OVERLAP. The curve-exclusion filter correctly identifies milestone diamond/triangle shapes (M/L/Z only).

**Serpentine Layout (`layout/serpentine.ts`):**
- Replaced 64-chord polyline (`GRADIENT_SEGS` loop) with ONE `PathPrimitive` carrying `strokeGradient`.
- `pathStart = pathPointAtS(0, geo)` and `pathEnd = pathPointAtS(totalLength, geo)` computed once, used for both the gradient endpoints and the badge positions.
- The full arc-command boustrophedon `buildPathD(geo)` path is reused for both the glow layer and the gradient stroke.
- SVG path count: 66 → 4 (glow + gradient + 2 icon paths). Gradient ID: `sg-90-164-1110-484-86efac-15803d` for the standard serpentine fixture.

### Improvement 2 — Palette-Derived Serpentine Fallback

**Fallback in `layout/serpentine.ts`:**
- When `theme.serpentine` is absent, the fallback is now palette-derived using `theme.statusMap['in-progress'].fill` as the accent base.
- `gradientFrom = lightenHex(accent, 0.35)` — blend toward white by 35%.
- `gradientTo = darkenHex(accent, 0.15)` — blend toward black by 15%.
- `glowColor = accent` (the raw in-progress color).
- `nodeFill = theme.canvas.backgroundColor` — nodes "hollow" against the path.
- `nodeStroke = accent`.
- `badgeFill = darkenHex(accent, 0.2)`.
- `badgeIconColor = contrastColor(badgeFill)` — white for dark fills, `#1F2937` for light fills (average RGB < 128 threshold).
- `labelColor = theme.milestone.titleLabelColor`.
- Added helpers: `lightenHex(hex, factor)`, `darkenHex(hex, factor)`, `contrastColor(hex)`.
- Explicit `theme.serpentine` block (e.g. the serpentine theme itself) still takes full precedence.

**Theme palette derivations verified:**
- Consulting (NAVY `#1F497D` in-progress): gradient `#6D89AB` → `#1A3E6A` (lighter/darker navy).
- Executive (CYAN `#00B4D8` in-progress): gradient `#59CEE6` → `#0099B8` (lighter/darker teal).
- Both distinctly non-green, matching each theme's identity.

### New Multi-Theme Goldens

| Golden | Theme | Dims | Notes |
|--------|-------|------|-------|
| `serpentine-journey-skia.png` | serpentine | 1200×556 | Regenerated with smooth gradient |
| `serpentine-journey.svg` | serpentine | 1200×556 | 4 paths + `<linearGradient>` in `<defs>` |
| `serpentine-journey-consulting-skia.png` | consulting | 1200×556 | Navy palette-derived NEW |
| `serpentine-journey-executive-skia.png` | executive | 1200×556 | Teal palette-derived NEW |

### Existing Goldens Unchanged

All non-serpentine goldens byte-identical (`our-timeline-skia.png` guard confirmed). The `strokeGradient` field is opt-in and no existing layout uses it.

### Files Touched

**Modified:**
- `packages/core/src/scene.ts` — `StrokeGradient` interface + `strokeGradient?` on `PathPrimitive`
- `packages/core/src/render/svg.ts` — `strokeGradientId`, `collectGradientDefs`, gradient defs in `<defs>`, path stroke ref
- `packages/core/src/render/skia.ts` — gradient shader in `renderPath` strokeOnly branch
- `packages/core/src/layout/serpentine.ts` — single gradient path, palette-derived fallback, `lightenHex`/`darkenHex`/`contrastColor` helpers, updated file comment
- `packages/core/src/lint.ts` — `pathBBox` skips curved paths (A/Q/C commands)
- `packages/core/test/skia.test.ts` — 3 new tests (consulting golden, executive golden, SVG determinism)

**Goldens Updated:**
- `serpentine-journey-skia.png` (53740→56376 bytes), `serpentine-journey.svg` (SVG reduced from ~66 paths to 4)

**Goldens Added:**
- `serpentine-journey-consulting-skia.png` (58125 bytes)
- `serpentine-journey-executive-skia.png` (55855 bytes)

### Test Results

**570/570 tests pass** (554 core + 13 schema + 3 cli). 3 new tests added. `pnpm -r typecheck` and `pnpm -r lint` clean.

---

## Learnings

- Serpentine layout (T4) now appears in examples/gallery/showcase.html for direct browsing alongside other showcase entries. Fixture placement (examples/showcase/serpentine-journey.timeline.yaml) confirmed consistent with other showcase fixtures.
- `PathPrimitive.strokeGradient` enables true smooth gradient strokes on curved paths; the SVG backend uses `<linearGradient gradientUnits="userSpaceOnUse">` with a content-based deterministic ID; the Skia backend uses `CK.Shader.MakeLinearGradient`.
- The linter's `pathBBox` must exclude curved SVG paths (A/Q/C commands) to avoid false NODE_OVERLAP from the serpentine's wide-spanning boustrophedon geometry.
- Palette derivation for serpentine fallback: `lightenHex(accent, 0.35)` → `darkenHex(accent, 0.15)` creates a coherent light-to-dark gradient from any theme's in-progress status color.
- Serpentine is now showcased in the theme matrix (examples/gallery/themes.html) as Example E across all 5 themes (consulting=navy, executive=teal, minimal=grey, product=blue, release=indigo). The per-theme renders at `examples/gallery/themes/{theme}/serpentine-journey.{svg,png}` are generated by the "Theme-matrix gallery emit — serpentine-journey" describe block added to `packages/core/test/quality.test.ts` (10 new tests). Count badge updated to "5 themes · 5 examples · 50 renders".

---

## 2026-06-11 — Strategic Alignment: Product Reframe to Diagram Compiler (Barbara)

📐 **Scene IR as Rendering Kernel Contract**

### Positioning Within Diagram Compiler Strategic Reframe

With Leslie's architectural reframe (Timeline is Grammar #1 of a larger diagram compiler), Barbara's rendering work is repositioned:

**Scene IR Becomes Shared Kernel Contract:**
- Scene IR (Rect, Line, Circle, Text, Path, Group, effects, animation hints) is the **universal rendering contract** shared by ALL future grammars (Timeline, Flow, Graph, Comparison, Stat, etc.)
- Timeline rendering → produces Scene IR → multiple backends (SVG/PNG/Skia/PDF) all consume Scene IR
- Backend diversity: SVG (text-deterministic), PNG (resvg WASM), Skia (art effects), PDF (exports)
- Animation hints on Scene primitives are backend-conditional (SVG honors; raster ignores)

### Phase 0→1 Implementation Path

In Phase 0, kernel/timeline seam drawn in `packages/core`. Barbara owns Scene IR primitives, rendering backends, and theme system. Future grammars' layout engines will compile domain IRs to Scene IR, reusing Barbara's existing backend infrastructure.

### No Changes to Current Implementation

All 5 targets (T1–T5) remain fully renderable. The three layout families (horizontal-swimlane, vertical-spine, serpentine) and five showcase themes (consulting, subject-timeline, ai-timeline, serpentine, gitline) are now positioned as Timeline grammar exemplars, not the whole product.

**Test status:** 570/570 tests pass. All golden images remain byte-identical.
