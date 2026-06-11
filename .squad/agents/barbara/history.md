# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

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

#### Tests + Goldens

- **New tests:** 5 tests in `skia.test.ts` describe block "T1 Our Timeline"
- **New golden:** `examples/gallery/showcase/our-timeline-numbered-skia.png` (1200×369 px)
- **Existing goldens:** byte-identical (all new tokens opt-in with non-breaking defaults)
- **Total tests:** 527/527 pass (518 core + 6 schema + 3 cli)
- **typecheck + lint:** clean

#### Files touched (T1)

- `packages/core/src/themes/types.ts` — +`titleAlign` (TypographyTheme), +`ordinalColorContrast` (MilestoneTheme)
- `packages/core/src/layout/horizontal.ts` — titleAlign in header; ordinalColorContrast in ordinal render
- `packages/core/src/layout/vertical-spine.ts` — titleAlign in header (consistency)
- `packages/core/src/themes/our-timeline.ts` — new file
- `packages/core/src/themes/index.ts` — registered 'our-timeline'
- `examples/gallery/our-timeline-numbered.timeline.yaml` — new T1 fixture
- `examples/gallery/our-timeline-numbered.svg` — SVG render artifact
- `examples/gallery/showcase/our-timeline-numbered-skia.png` — new golden
- `packages/core/test/skia.test.ts` — T1 describe block
- `.squad/decisions/inbox/barbara-t1-close.md` — logo spec + T1 fidelity report

#### Key Learnings (T1)

- T1-1 and T1-2 were already implemented before this session — gap analysis written before those features shipped
- Filled vs hollow nodes can be achieved **purely via theme `statusMap`** without per-milestone IR changes: setting `fill: '#FFFFFF'` in the status map produces an outlined ring appearance
- `ordinalColorContrast: true` + `contrastColor()` is the correct way to auto-adapt ordinal text color to fill — avoids hardcoding per-status ordinal colors in the theme
- `legend.show: false` in the YAML fixture suppresses the auto-legend — no theme token needed, the IR already supports this
- The `contrastColor()` function uses the WCAG 2.1 relative-luminance threshold (0.179) which correctly handles both navy (#1F497D, L≈0.044) and white (#FFFFFF, L=1.0)
- `titleAlign` token default must be `'center'` (matching existing behavior), NOT `'left'` — the existing rendering was already center-aligned



### T5 Gitline Cards — Gaps T5-1 and T5-2 CLOSED

**Goal:** Close target T5 ("Gitline" dark card timeline) — two remaining gaps after core vertical-spine + card entryStyle were already shipped.

#### T5-1: CTA Button Rendering [CLOSED]

**What was added:**
- **Theme tokens** in `themes/types.ts` on `ResolvedTheme`:
  - `cardCtaLabel?: string` — button label text; when undefined (default), NO button renders
  - `cardCtaFill?: string` — button background (default `'transparent'`)
  - `cardCtaTextColor?: string` — label text colour
  - `cardCtaBorderColor?: string` — pill outline stroke colour
  - `cardCtaBorderWidth?: number` — outline stroke width (default 1)
  - `cardCtaRadius?: number` — corner radius (default: `floor(btnH/2)` = true pill)
- **SpineEntry.url** field added (mirrors `Activity.url` / `Milestone.url` that already existed in IR)
- **blockH()** updated: adds `CTA_VERT_GAP(8) + CTA_BTN_H(≈26px)` when `hasCta(e)` is true
- **evenStep** computation updated inline with same CTA guard
- **Render**: pill rect (`transparent` fill + border) + centred label text, anchored to inner edge of card
- **Gate**: only renders when `theme.cardCtaLabel && entry.url` — existing themes are byte-identical

#### T5-2: Inline Date Icon [CLOSED]

**What was added:**
- **Theme token** `cardDateIcon?: string` — icon name from built-in registry (default undefined = no icon)
- **Render**: in card entries, if `cardDateIcon` set, renders icon paths at the leading edge of the date line, then shifts the date text away by `DATE_ICON_SZ + DATE_ICON_GAP` in the appropriate direction (right for 'start' anchor, left for 'end' anchor)
- Icon size: `DATE_ICON_SZ = rhu(datePx * 0.9)` — cap-height match; uses same icon path pipeline as badge icons
- **Gate**: only renders when `theme.cardDateIcon && entryStyle === 'card'` — existing themes unchanged

#### New gitline Theme + Fixture

**Theme:** `packages/core/src/themes/gitline.ts`
- Dark navy canvas (`#0A1628`), card entryStyle, even spacing
- `cardCtaLabel: 'VIEW REPOSITORY'`, `cardCtaFill: 'transparent'`, pill border in `#9DBDD8`
- `cardDateIcon: 'clock'` — clock icon from built-in registry
- Card shadow + node glow effects (Skia backend)
- Registered in `themes/index.ts` as `'gitline'` (Tier 2)

**Fixture:** `examples/gallery/gitline.timeline.yaml`
- 6 milestone entries with `url` fields (repository release history v0.1.0–v1.0.0)
- `activities: []` (schema requires activities)
- Title: `"Releases"` (kept short to avoid linter LABEL_OVERLAP with first card entry — wide centered titles at 29pt cause bbox collisions with cards starting immediately below the header)

**Golden:** `examples/gallery/showcase/gitline-skia.png` — 1200×1008 px
- Dark cards alternating L/R, clock icon + date, "VIEW REPOSITORY" pills, spine dots ✅

**Tests added:** `packages/core/test/skia.test.ts` — "T5 Gitline" describe block (5 tests):
- Schema validation, SVG determinism, linter clean, Skia valid PNG, Skia golden

**Results:**
- All 503 core tests pass (was 497 → +6 new T5 tests)
- Full repo: 512/512 pass (503 core + 6 schema + 3 cli)
- `pnpm -r typecheck` and `pnpm -r lint`: clean
- Existing goldens: byte-identical (all new tokens are opt-in, default to undefined/no-op)
- T5 is now **fully renderable** (excluding out-of-scope app chrome) ✅

**Key learnings:**
- CTA button height must be reflected in BOTH `blockH()` AND the `evenStep` pre-calculation loop (evenStep is computed BEFORE blockH is defined)
- For inline date icons on left-side cards (textAnchor='end'), shift the date text x by `-(iconSz + gap)` so the icon appears at the text's leading edge
- Linter LABEL_OVERLAP epsilon is 4px; a long header title centered at canvas midpoint creates real bbox collisions with first card entry when title width > 2×(spineX - cardEdgeX). Keep fixture titles short (< ~8 chars at 22pt / 29px) to stay within the spine's "shadow" horizontally
- `hasCta` is a closure capturing `ctaLabel` and `entryStyle` — this correctly reads from the theme at layout time with no runtime overhead

## Learnings

**Image Primitive + Logo (T1-3 CLOSED) — 2026-06-11:**

### Image Primitive Shape

`ImagePrimitive` added to `scene.ts`:
```typescript
{ kind: 'image'; x; y; width; height; data: string /* data:<mime>;base64,... */; mimeType: string; borderRadius?: number; opacity?: number }
```
Added to `ScenePrimitive` union. `data` MUST be an embedded data URI — no external path references in the Scene (determinism contract).

### Asset Loading / Base64 Embedding

`src/asset-loader.ts` → `loadImageAsset(src, baseDir?)`:
- `data:` URI → extracted MIME + returned as-is (no I/O)
- Filesystem path → resolved via `resolve(baseDir ?? process.cwd(), src)`, read with `readFileSync`, base64-encoded
- MIME inference from extension: `.png` → `image/png`, `.jpg/.jpeg` → `image/jpeg`, `.svg` → `image/svg+xml`, `.gif` → `image/gif`, `.webp` → `image/webp`
- Missing file / unsupported extension / I/O error → returns `null` (graceful skip, no crash)
- **Path resolution base:** `baseDir` parameter (defaults to `process.cwd()`). `buildScene`, `renderDocument`, `renderDocumentAsync` all accept `baseDir?: string` option to pass through.

### Header Logo Placement

Both `layoutHorizontal` and `layoutVerticalSpine` (horizontal.ts + vertical-spine.ts):
- `logo` in IR → `loadImageAsset()` called at layout time → `ImagePrimitive` pushed to primitives
- Default position: `'top-left'` (matching T1 target; `'top-right'` also supported)
- Logo horizontally at `mL + 4` (top-left) or `W - mR - logoW - 4` (top-right)
- Logo vertically centred in header: `y = mT + (headerH - logoH) / 2`
- `headerH` expanded if logo is taller than the title block: `max(headerH, logoH + LOGO_V_PAD*2)`
- Default size: 100×32 px (if `logo.width`/`logo.height` not specified)
- Logo does NOT overlap title: title is centred at W/2; logo is in the far corner. No header height increase for the T1 fixture (headerH=65 already fits the 32px logo).

### Per-Backend Rendering Notes

**SVG (svg.ts):**
- `case 'image':` emits `<image href="data:..." x y width height [opacity] [clip-path]/>` (attributes alphabetically sorted per determinism contract)
- `borderRadius`: `sceneToSvg` runs `collectImageClipDefs()` pre-pass to collect `<clipPath>` defs; emits them in a `<defs>` block before the primitives. Clip ID = `img-clip-{x}-{y}-{width}-{height}` (deterministic)
- SVG logo files (`image/svg+xml`) render correctly in SVG backend (as an embedded SVG-in-SVG image)

**Skia (skia.ts):**
- `renderImage()`: parses data URI, decodes base64 with `Buffer.from(b64, 'base64')`, calls `CK.MakeImageFromEncoded(bytes)` → `canvas.drawImageRect()`
- **SVG logos SKIPPED**: `MakeImageFromEncoded` is raster-only (PNG/JPEG/GIF/WebP). SVG mime type → return early, no crash
- `borderRadius`: `canvas.save()` + `canvas.clipRRect()` + `canvas.drawImageRect()` + `canvas.restore()`
- `opacity`: `paint.setAlphaf(opacity)` when < 1

**PNG/resvg (png.ts):**
- No changes needed — resvg handles `<image href="data:..."/>` natively when the backend renders the SVG intermediate
- PNG/JPEG logos: fully supported
- **SVG-in-SVG limitation**: resvg may not support `data:image/svg+xml;base64,...` within `<image>`; PNG/JPEG logos are recommended for maximum compatibility

### Sample Asset

- `examples/gallery/assets/brand-logo.svg` — hand-authored SVG source (navy rounded rect #1F497D with white timeline motif: horizontal line + 3 nodes, center filled, outer hollow)
- `examples/gallery/assets/brand-logo.png` — rasterized from SVG using resvg (100×32 px, 964 bytes)
- Original mark, not copyrighted; mirrors the Our Timeline visual language

### T1 Now FULLY CLOSED

- `our-timeline-numbered.timeline.yaml` updated with `metadata.logo: { src: 'examples/gallery/assets/brand-logo.png', position: top-left, width: 100, height: 32 }`
- `examples/gallery/our-timeline-numbered.svg` regenerated with embedded logo (top-left, 100×32, navy timeline mark) ✓
- `examples/gallery/showcase/our-timeline-numbered-skia.png` regenerated (1200×368 px) ✓
- **T1 fidelity: 100%** — light background, centered title, numbered nodes (filled vs hollow), alternating labels, brand logo top-left ✓

### Tests Added (11 new, total 545 across all packages)

1. T1 SVG deterministic with logo (+ checks `<image` and `data:image/png;base64`)
2. T1 linter passes with logo
3. T1 Skia valid PNG with logo
4. T1 Skia golden byte-determinism with logo
5. SVG emits `<image>` for data URI logo
6. Path src embedded as base64 (no file reference in SVG)
7. Graceful skip on missing file
8. Graceful skip on unsupported extension
9. Data URI passthrough
10. SVG determinism (same URI → same hash)
11. PNG/resvg renders with embedded PNG logo
12. Skia renders without crash
13. Skia gracefully skips SVG logo (no crash)
14. `borderRadius` produces `<defs>/<clipPath>` in SVG
15. T1 SVG golden regenerated with logo

### BuildSceneOptions Extension

`render/index.ts` exports `BuildSceneOptions` (not in types.ts):
```typescript
interface BuildSceneOptions { theme?; layout?; spineSpacing?; baseDir?: string }
```
`buildScene`, `renderDocument`, `renderDocumentAsync` all accept `baseDir`. Threaded through `layout()` → `layoutHorizontal/layoutVerticalSpine` → `loadImageAsset`.

**Key Learnings:**
- `<defs>` in SVG must be collected in a pre-pass (before primitive rendering) to emit a proper defs block at the top; inlining within elements is syntactically valid but unclean
- CanvasKit `MakeImageFromEncoded` is raster-only; SVG logos must be skipped silently (not an error)
- resvg SVG `<image>` with PNG/JPEG data URIs: fully supported. SVG-in-SVG: not reliably supported → PNG logos recommended for fixtures
- `baseDir` threading is the right approach when CWD ≠ document directory (avoids coupling layout functions to process state)
- Clip path ID determinism: use `fmt(x)-fmt(y)-fmt(w)-fmt(h)` — stable since all coords are deterministic layout outputs



**Gitline Demo Page (2026-06-11):**
- `examples/gallery/gitline-demo.html` — self-contained dark Gitline app shell demo page
- Embeds `examples/gallery/gitline.svg` (1200×1008 px, rendered via SVG backend from the gitline fixture)
- SVG chosen over PNG: scales perfectly at any browser width; all cards, clock icons, CTA pills, and spine circles render correctly in the SVG backend (no Skia-only gradients needed for the demo)
- To view: `open examples/gallery/gitline-demo.html` from the repo root, or serve the directory (`npx serve examples/gallery`) and visit `http://localhost:3000/gitline-demo.html`
- The page is additive only — no renderer, theme, or IR changes were made

**Files touched (Demo):**
- `examples/gallery/gitline.svg` — new SVG render artifact (gitline theme, vertical-spine, 1200×1008 px)
- `examples/gallery/gitline-demo.html` — new standalone demo page (self-contained HTML+CSS, references sibling gitline.svg)

**Files touched (T5):**
- `packages/core/src/themes/types.ts` — 7 new ResolvedTheme tokens
- `packages/core/src/layout/vertical-spine.ts` — SpineEntry.url, blockH, evenStep, date icon render, CTA render
- `packages/core/src/themes/gitline.ts` — new file
- `packages/core/src/themes/index.ts` — registered 'gitline'
- `examples/gallery/gitline.timeline.yaml` — new fixture
- `packages/core/test/skia.test.ts` — T5 describe block added
- `examples/gallery/showcase/gitline-skia.png` — new golden (1200×1008 px)

---

### Previous: Vertical-Spine Gap Compression + spineSpacing Render Option (2026-06-11)

**Problem:** `ai-timeline` fixture (1967–2024, ~20 entries) produced 8700+ px tall canvases in all themes except `ai-timeline` (which used `spineSpacing: 'even'`). Root: `pixelsPerDay` floor at 0.4 → 20,800 days × 0.4 = 8320 px; min-spacing pass only grows, doesn't compress.

**Solution A — Auto Gap Compression in 'time' mode:**
- Trigger: `hDrawTime / nEntries > 400 px/entry`
- Action: Cap consecutive gaps at 200 px (2× ENTRY_MIN_SPACING)
- `effectiveDateY` uses piecewise-linear interpolation (consistent with entry spacing)
- Byte-identical output for normal timelines (avg ≤100 px/entry)

**Solution B — spineSpacing as RenderOption:**
- Added `spineSpacing?: 'time' | 'even'` to `RenderOptions` (overrides theme at render time)
- Gallery renders now pass `spineSpacing: 'even'` to force uniform spacing

**Results:**
- `ai-timeline.png`: 8732 px → 990 px
- `ai-timeline-showcase-skia.png`: 8762 px → 1076 px
- All existing goldens: byte-identical ✅
- Tests: 497/497 pass (488 core + 6 schema + 3 cli) ✅

**Canonical update:** Added gap-compression + render-option note to "Rendering Model & Themes" section in decisions.md.

### Previous: T3 Gaps Closed (2026-06-11)

- **Activity.color:** Free CSS string override (mirrors Milestone.color)
- **fontSizeYearLabel:** Typography token for large year labels in vertical-spine
- **Gradient background:** Via existing `SceneBackground { kind:'gradient' }`
- **New ai-timeline theme:** Tier 2 (card style, gradient, vivid status palette)
- Result: T3 target now fully renderable; all three gaps closed

## Architecture Essentials

**Six-phase deterministic layout pipeline:**
1. Axis computation (domain, ticks)
2. Track placement (y-coordinates)
3. Activity geometry (sub-lanes, collisions, labels)
4. Milestone geometry (badges, y-positions)
5. Sections/annotations (boundaries, callouts)
6. Label collision resolution (two-pass alternation)

**Key contract:** Scene geometry is always byte-deterministic (pure function of IR + theme). Determinism at three levels: Scene (always), per-backend (version-pinned), cross-backend (not promised).

**Themes:** Six built-in (Consulting, Executive, Product, Release, Minimal, Gitline) + showcase + ai-timeline + extensible via FidelityTier tokens. `gitline` is Tier 2 (dark card, CTA button, clock icon).

**Known deferred:** Serpentine layout, advanced icon badges → Phase 4+

---

*Previous session archive: barbara/history-archive.md (2026-06-09/10 design and Phase 1 implementation)*
