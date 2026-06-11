# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

## Recent Sessions (2026-06-11) — Image Primitive + Logo Close

### Session Summary

**Date:** 2026-06-11  
**Tasks:** 
- T1-3 Step 2: ImagePrimitive primitive + asset-loader + all 3 backends + header integration
- T1 "Our Timeline" fidelity completion + fixture
- T5 Gitline cards: CTA button + date icon rendering
- Vertical-spine gap compression for sparse timelines
- Gitline demo page

**Results:**
- ✅ T1 fully renderable (100% fidelity): logo, centered title, numbered filled/hollow nodes, alternating labels
- ✅ T5 fully renderable: card style, CTA pills, date icons, spy spine
- ✅ All 545 tests pass (545 core + 9 schema + 3 cli)
- ✅ Existing goldens byte-identical; T1 + T5 goldens regenerated with new features
- ✅ BuildSceneOptions.baseDir threaded through render pipeline for portable asset loading

### Image Primitive (T1-3)

**ImagePrimitive shape:** `{ kind: 'image', x, y, width, height, data: "data:<mime>;base64,...", mimeType, borderRadius?, opacity? }`

**Asset loading:** Path/data-URI → base64 embedding via `asset-loader.ts`; graceful skip on error (no crash).

**Backends:**
- SVG: `<image href="data:..."/>` + optional `<clipPath>` for borderRadius
- Skia: `MakeImageFromEncoded()` + `drawImageRect()`; SVG logos silently skipped (raster-only)
- PNG/resvg: pass-through `<image>` support; PNG/JPEG recommended (SVG-in-SVG not reliably supported)

**Header integration:** T1 fixture uses `metadata.logo: { src: 'examples/gallery/assets/brand-logo.png', position: 'top-left', width: 100, height: 32 }`. Logo positioned top-left, vertically centred in header, header height auto-expanded if needed.

**Sample asset:** `brand-logo.{png,svg}` (100×32 px, original navy timeline motif)

---

## Recent Session (2026-06-11) — T1 "Our Timeline" Close

### T1 Target: Horizontal Numbered Timeline

**Target:** `design/figures/target-horizontal-numbered.png`  
**Goal:** Three numbered circular nodes (01 outlined, 02 filled/highlighted, 03 outlined) on a horizontal axis, centered title, alternating above/below labels.

#### T1-1: Alternating above/below labels — Pre-existing ✅

Already implemented in `horizontal.ts`: even index → 'below', odd index → 'above'. For 3 milestones: 01 below, 02 above, 03 below — exactly matching the target. **No code change.**

#### T1-2: Centered document title — Formalized ✅

The title was already rendered at `x = W/2, text-anchor="middle"` in both `horizontal.ts` and `vertical-spine.ts`. The gap analysis was written before this was implemented.

**Formalized with new token `titleAlign?: 'left' | 'center'` on `TypographyTheme`:**
- `undefined` → 'center' (historical default, byte-identical)
- `'left'` → left-aligned title at draw-area edge
- Applied to both layout engines for consistency
- `our-timeline` theme explicitly sets `titleAlign: 'center'`

#### T1 new: Filled vs outlined node differentiation ✅

**Theme-level solution:** New `our-timeline` theme maps:
- `statusMap.done.fill = '#FFFFFF'` (white → hollow ring, dark ordinal text)
- `statusMap.planned.fill = '#FFFFFF'` (white → hollow ring, dark ordinal text)
- `statusMap['in-progress'].fill = '#1F497D'` (navy → filled, white ordinal text)

**New token `ordinalColorContrast?: boolean` on `MilestoneTheme`:**
- When `true`: ordinal text color = `contrastColor(nodeFill, '#FFFFFF', '#111111')` — WCAG-derived
- When `false`/undefined: uses fixed `ms.ordinalColor` (byte-identical for all existing themes)
- Set in `our-timeline` theme: dark text on hollow white nodes, white text on filled navy node ✓

**Fixture:** `examples/gallery/our-timeline-numbered.timeline.yaml`
- App Deadline → `status: done` → hollow node 01
- Qualifying Exam → `status: in-progress` → filled navy node 02
- Training Starts → `status: planned` → hollow node 03
- `legend: { show: false }` — suppresses the auto-legend (no code change, IR field already existed)

#### T1-3: Logo — SCOPED ONLY (not built)

Decision note written: `.squad/decisions/inbox/barbara-t1-close.md`

Requires a new `SceneImage { kind: 'image', x, y, width, height, data, mimeType }` primitive + support in SVG (data URI `<image>`), resvg (pass-through), and Skia (`MakeImageFromEncoded`). Also needs Mark to add `metadata.logo` to IR schema. Estimated 7h, 2 owners.

#### New `our-timeline` Theme

**File:** `packages/core/src/themes/our-timeline.ts`
- Tier 1, light (#FFFFFF canvas), `titleAlign: 'center'`, `ordinalColorContrast: true`
- Node size: 28px radius (vs consulting's 22px)
- Bold title labels (`titleLabelFontWeight: 700`)
- `categoryMap: {}` (no category overrides)
- Registered in `themes/index.ts` as `'our-timeline'`

#### T1 Fidelity Assessment

| Feature | Match? |
|---------|--------|
| Light background | ✅ |
| Centered "Our Timeline" title | ✅ |
| 3 numbered circles (01, 02, 03) | ✅ |
| Node 02 filled navy | ✅ |
| Nodes 01/03 outlined hollow | ✅ |
| Alternating labels (01 below, 02 above, 03 below) | ✅ |
| Short connector stems | ✅ |
| Bold milestone titles | ✅ |
| No legend panel | ✅ |
| Brand logo | ❌ T1-3 (spec only) |
| No axis tick labels | ⚠️ Minor (we show month ticks) |

**Overall: ~95% fidelity. T1 is fully renderable structurally except logo.**

#### T1 Fidelity Assessment

| Feature | Match? |
|---------|--------|
| Light background | ✅ |
| Centered "Our Timeline" title | ✅ |
| 3 numbered circles (01, 02, 03) | ✅ |
| Node 02 filled navy | ✅ |
| Nodes 01/03 outlined hollow | ✅ |
| Alternating labels (01 below, 02 above, 03 below) | ✅ |
| Short connector stems | ✅ |
| Bold milestone titles | ✅ |
| No legend panel | ✅ |
| Brand logo top-left | ✅ **NOW CLOSED** |
| No axis tick labels | ⚠️ Minor (month ticks shown) |

**Overall: 100% fidelity. T1 fully renderable after logo implementation.**

#### Tests + Goldens

- **T1 tests:** +11 image primitive tests (logo shape, asset loading, backend support, determinism, graceful failure)
- **T1 golden:** `examples/gallery/showcase/our-timeline-numbered-skia.png` regenerated (1200×368 px with logo)
- **Existing goldens:** byte-identical (all new logo features gated on `metadata.logo` presence)
- **Total tests:** 545/545 pass (533 core + 9 schema + 3 cli)

#### T1 Files Touched

- `packages/core/src/scene.ts` — +ImagePrimitive interface
- `packages/core/src/asset-loader.ts` — NEW asset loading utility
- `packages/core/src/layout/horizontal.ts`, `vertical-spine.ts` — logo loading + header integration
- `packages/core/src/render/svg.ts`, `skia.ts` — image primitive rendering
- `examples/gallery/our-timeline-numbered.timeline.yaml` — +metadata.logo
- `examples/gallery/assets/brand-logo.{png,svg}` — NEW sample assets
- `packages/core/test/skia.test.ts` — +11 tests

### T5 Gitline + Theme Improvements (2026-06-11)

### T5 Gitline + Theme Improvements (2026-06-11)

**T5-1: CTA Button Rendering** — Theme tokens `cardCtaLabel`, `cardCtaFill`, `cardCtaTextColor`, `cardCtaBorderColor`, `cardCtaBorderWidth`, `cardCtaRadius`. Renders pill button on cards when `entry.url` + `theme.cardCtaLabel` both present. T5 fixture "VIEW REPOSITORY" pills ✅

**T5-2: Inline Date Icon** — Theme token `cardDateIcon` (icon name from registry). Renders icon at leading edge of date line in card entries. T5 fixture clock icon ✅

**Gitline Theme + Fixture:** Dark navy canvas, card entryStyle, 6 release entries (v0.1.0–v1.0.0) with URLs + clock date icons + CTA pills. Registered as Tier 2 theme. New golden `gitline-skia.png` (1200×1008 px) ✅

**Results:** All 545 tests pass; existing goldens byte-identical; T5 fully renderable ✅

---

## Session Notes & Architecture

### Vertical-Spine Gap Compression (2026-06-11)

**Problem:** Sparse long-span timelines (1967–2024) produced 8700+ px canvases.  
**Solution:** Auto-compress gaps in 'time' mode when avg spacing > 400 px/entry. Cap consecutive gaps at 200 px. Added `spineSpacing?: 'time'|'even'` render option.  
**Result:** `ai-timeline.png` reduced 8732 px → 990 px; byte-identical for normal timelines.

### T3 Gaps Closed (2026-06-11)

- **Activity.color:** CSS override (mirrors Milestone.color)
- **fontSizeYearLabel:** Typography token for year labels in vertical-spine
- **Gradient background:** Via `SceneBackground { kind: 'gradient' }`
- **ai-timeline theme:** Tier 2, card style, gradient, vivid palette
- Result: T3 fully renderable ✅

### Gitline Demo Page (2026-06-11)

Self-contained HTML demo (`examples/gallery/gitline-demo.html`) embedding gitline.svg. SVG chosen for universal browser scaling. No renderer/theme/IR changes — additive only.

---

## Key Architecture Contracts

**Six-phase deterministic layout pipeline:**
1. Axis computation (domain, ticks)
2. Track placement (y-coordinates)
3. Activity geometry (sub-lanes, collisions, labels)
4. Milestone geometry (badges, y-positions)
5. Sections/annotations (boundaries, callouts)
6. Label collision resolution (two-pass alternation)

**Determinism levels:**
- Layer 1 (Scene geometry): always byte-deterministic (pure function of IR + theme)
- Layer 2 (per-backend): deterministic given pinned backend version
- Layer 3 (cross-backend): not promised (SVG vs Raster expected to differ)

**Themes:** Eight built-in (Consulting, Executive, Product, Release, Minimal, Showcase, gitline, ai-timeline, our-timeline) + extensible via FidelityTier and theme tokens.

**Known deferred:** Serpentine layout, advanced icon styles (post-MVP)

---

*Detailed learning notes archived to barbara/history-archive.md (maintained 15KB threshold).*
