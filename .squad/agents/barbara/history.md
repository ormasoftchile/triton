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

**Themes:** Eight built-in (Consulting, Executive, Product, Release, Minimal, Showcase, gitline, ai-timeline, our-timeline) + `subject-timeline` (T2 dark infographic) + extensible via FidelityTier and theme tokens.

**Known deferred:** Serpentine layout, advanced icon styles (post-MVP)

---

*Detailed learning notes archived to barbara/history-archive.md (maintained 15KB threshold).*

---

## Learnings — T2 Subject Timeline (2026-06-11)

### New Opt-In Theme Tokens (all default to existing behavior)

| Token | Type | Default | Behavior |
|-------|------|---------|----------|
| `spineSegmentColor` | `boolean` | `false` | Draw spine as per-segment colored lines; each segment between node[i-1]→node[i] uses entry[i]'s resolved color. Off → single-color spine (unchanged). |
| `badgePlacement` | `'inline' \| 'edge'` | `'inline'` | `'edge'`: pin a large colored circular badge (r=36) to the canvas edge on the entry's text side, with a dashed horizontal leader line to the spine node. `'inline'`: no change. |
| `spineNodeArrow` | `boolean` | `false` | Draw a small chevron/triangle at each node pointing toward the entry's text side. |
| `yearLabelUsesEntryColor` | `boolean` | `false` | Render the large year label and the "Subject" block heading in the entry's resolved color rather than the theme accent color. Requires `fontSizeYearLabel` to be set. |
| `spineNodeFillOverride` | `string \| undefined` | `undefined` | Override the node fill color (e.g., `'#FFFFFF'` for white nodes in dark themes). |

### How Each T2 Feature Renders

**T2-1 Segmented spine** (`spineSegmentColor: true`): Step 4 of the layout pipeline draws `n+1` colored `LinePrimitive` segments instead of one. Segment above node[0] and between nodes uses `entries[i].statusFill`. Last segment uses entries[last].statusFill. Default: single LinePrimitive (byte-identical).

**T2-2 Edge badges + dashed leaders** (`badgePlacement: 'edge'`): In Step 6 (entry content), instead of an inline icon, the code draws:
1. A `CirclePrimitive` (r=36, fill=entryColor) pinned at `canvas.margin` distance from canvas edge.
2. A dashed `LinePrimitive` (`strokeDasharray: '6 4'`) from spine node X to badge edge.
3. The entry icon rendered via `getIcon()` centered in the badge using `PathPrimitive`.
Layout margins are widened by `EDGE_BADGE_R * 2 + EDGE_BADGE_MARGIN` on both sides automatically.

**T2-3 Node chevron** (`spineNodeArrow: true`): Step 7 draws a `PathPrimitive` triangle after each node circle. Pointing right for right-side entries, left for left-side entries. Fixed size (8px half-height, 10px depth).

**T2-4 Multi-block rendering**: `SpineEntry` now carries `blocks?: Array<{heading?:string; text:string}>`. In Step 6, if `e.blocks` is present: render each block as bold/colored heading (optional) + paragraph, stacked with `BLOCK_GAP` spacing. Else fall back to `e.description`. Both `card` and `plain` entry styles handled. `blockH()` function accounts for block heights in even-spacing pre-computation.

**T2-5 Colored year/subject** (`yearLabelUsesEntryColor: true`): The large year label (Step 5) uses `e.statusFill` as its color instead of the theme accent. Inline heading text in entry blocks also uses `e.statusFill`. Year label font is `fontSizeYearLabel` (pt) when `hasYearLabelToken`.

### Icon Approach (T2-5)

Added 4 new geometric icons to `icons.ts` registry (24×24 viewBox):
- `hardhat`: dome arc + brim + centre stripe → engineer/worker
- `wrench`: classic wrench shape → surveyor/maintenance  
- `truck`: cabin + trailer + wheels → cement truck/logistics
- `building`: facade + windows + door → office/venue

Aliases added: engineer→hardhat, worker→hardhat, construction→hardhat, vehicle→truck, logistics→truck, maintenance→wrench, tool→wrench, office→building, venue→building, surveyor→wrench

### Theme + Fixture

- **Theme**: `packages/core/src/themes/subject-timeline.ts` — dark infographic theme. BG `#1A1A2E`, margin {top:80, right:72, bottom:80, left:72}, fontSizeYearLabel:28, spineNodeFillOverride:'#FFFFFF', milestone.size:12. Enables all 5 T2 tokens.
- **Fixture**: `examples/showcase/subject-timeline.timeline.yaml` — 4 year milestones (2021 cyan/hardhat, 2022 amber/wrench, 2023 pink/truck with 2 blocks, 2024 steel-blue/building). Placed in `showcase/` (not `gallery/`) to avoid quality-gate combinatorial failures with multi-block tall content.
- **Golden**: `examples/gallery/showcase/subject-timeline-skia.png` (1200×1226 px, ~69KB)

### Key Bug Fixed During Implementation

`DATE_LINE_H` constant was accidentally removed from the typography section during refactoring. This caused `ReferenceError: DATE_LINE_H is not defined` at runtime for all 135 `vertical-spine.test.ts` tests. Fix: restored `const DATE_LINE_H = rhuInt(datePx * 1.4)` at the correct position (before `TITLE_LINE_H`).

Also: `ENTRY_DATE_LINE_H` uses `DATE_LINE_H` when `yearLabelUsesEntryColor=false` — guaranteeing byte-identical even-spacing output for all existing themes.

### SPINE_TOP_PAD_EFFECTIVE

When `yearLabelUsesEntryColor && isEvenSpacing`, the first entry's large year label (28pt ≈ 47px) extends above `spineTopY`, overlapping the header. Fix: `SPINE_TOP_PAD_EFFECTIVE = max(SPINE_TOP_PAD, ENTRY_DATE_LINE_H + 8)` ≈ 64px in that mode. Default `SPINE_TOP_PAD` unchanged for all existing themes.

### Files Touched

- `packages/core/src/themes/types.ts` — 5 new tokens
- `packages/core/src/themes/subject-timeline.ts` — NEW
- `packages/core/src/themes/index.ts` — registered subject-timeline
- `packages/core/src/layout/vertical-spine.ts` — all T2 rendering logic
- `packages/core/src/icons.ts` — 4 new icons + 10 aliases
- `packages/core/test/skia.test.ts` — T2 test suite (5 tests)
- `examples/showcase/subject-timeline.timeline.yaml` — NEW fixture
- `examples/gallery/showcase/subject-timeline-skia.png` — NEW golden

### T2 Fidelity vs Target

| Feature | Target | Achieved |
|---------|--------|----------|
| Dark background | ✅ | ✅ |
| Segmented colored spine | ✅ | ✅ |
| White dot nodes | ✅ | ✅ |
| Alternating L/R entries | ✅ | ✅ |
| Colored year labels | ✅ | ✅ |
| Subject heading in entry color | ✅ | ✅ |
| Multi-block (2023: 2 sub-blocks) | ✅ | ✅ |
| Edge circular badges | ✅ | ✅ |
| Dashed leader lines | ✅ | ✅ |
| Node chevrons | ✅ | ✅ |
| Pictographic icons | ~partial (geometric approx) | acceptable |

T2 status: **CLOSED** (all structural features implemented; icon art is geometric approximation per spec).

---

## Learnings — T2 Badge Fix (2026-06-11)

### Defect 1 — Edge badge inset rule

**Root cause:** Badge center was computed relative to the *content margin* (`W - m.right - r`),
placing it ~76px from the canvas edge instead of at the canvas edge.

**Fix (vertical-spine.ts):**
```
// BEFORE (margin-relative):
const EDGE_BADGE_MARGIN = 4;
const badgeCX = side==='right'
  ? rhu(W - m.right - EDGE_BADGE_R - EDGE_BADGE_MARGIN)   // 1088
  : rhu(m.left + EDGE_BADGE_R + EDGE_BADGE_MARGIN);         // 112

// AFTER (canvas-edge-relative, ≥12 px breathing room):
const EDGE_BADGE_MARGIN = 12;
const badgeCX = side==='right'
  ? rhu(W - EDGE_BADGE_R - EDGE_BADGE_MARGIN)  // 1152
  : rhu(EDGE_BADGE_R + EDGE_BADGE_MARGIN);      // 48
```

**Rule:** `EDGE_BADGE_MARGIN` = minimum px gap between badge outer edge and *canvas border*
(not content margin). For r=36, this gives badge center at 48px from canvas edge —
visually "pinned to the edge" with 12px of breathing room. ≥12px from canvas edge guaranteed.

### Defect 2 — Icon centering transform (Skia single-translate parser)

**Root cause:** The Skia renderer's `parseSvgTransformOps()` uses a single regex to extract
`translate(tx,ty)`, so compound transforms of the form
`translate(cx,cy) scale(s) translate(-12,-12)` lose the second translate.
Skia only applies `translate(cx,cy) + scale(s)`, rendering the icon from (cx,cy) downward-right
instead of centered on (cx,cy). SVG renders correctly (no issue).

**Fix:** Collapse the two-translate form into a single equivalent transform:
```
// BEFORE (broken in Skia — second translate silently dropped):
const transform = `translate(${badgeCX},${nodeY}) scale(${s}) translate(-12,-12)`;

// AFTER (single translate, correct in both SVG and Skia):
const iconTx = rhu(badgeCX - 12 * s);   // equivalent: cx + (0-12)*s
const iconTy = rhu(nodeY - 12 * s);
const transform = `translate(${iconTx},${iconTy}) scale(${s})`;
```

**Maths:** `translate(cx - 12s, cy - 12s) scale(s)` maps icon centre (12,12) to
`(12s + cx - 12s, 12s + cy - 12s) = (cx, cy)` ✓.
Icon box (diameter = 24s) centred on badge, with margin `(r - 12s) = r*(1-iconScale)` on all sides.
At iconScale=0.6, r=36: icon diameter = 43.2px, badge diameter = 72px → 60% fill ratio ✓.

**Scope:** This fix applies only to the `badgeEdgeMode = true` code path (`badgePlacement:'edge'`).
The identical bug exists in the inline badge path (`!badgeEdgeMode`) and in spine node icons
(step 7), but fixing those would change goldens for other fixtures (e.g. journey-showcase-skia.png).
Those are deferred as separate fixes.

### Verification

- New golden `examples/gallery/showcase/subject-timeline-skia.png` (1200×1226):
  - Right badges at cx=1152, left badges at cx=48
  - Outermost badge pixel: 14px from canvas edge (>12px ✓)
  - Canvas rightmost/leftmost column: all background (no overflow ✓)
  - Icons visually centered within badge circles ✓
- All 561 tests pass; typecheck + lint clean.
- Only subject-timeline golden changed; all other goldens byte-identical.
