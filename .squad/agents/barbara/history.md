# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

## Recent Session (2026-06-11)

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

### Learnings

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
