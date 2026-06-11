# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

## Recent Session (2026-06-11)

### Vertical-Spine Gap Compression + spineSpacing Render Option

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

**Themes:** Five built-in (Consulting, Executive, Product, Release, Minimal) + extensible via FidelityTier tokens. `ai-timeline` is Tier 2 (Skia art effects enabled).

**Known deferred:** Serpentine layout, CTA buttons, advanced icon badges → Phase 4+

---

*Previous session archive: barbara/history-archive.md (2026-06-09/10 design and Phase 1 implementation)*
