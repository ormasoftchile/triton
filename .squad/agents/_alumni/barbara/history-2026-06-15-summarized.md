# Barbara — Semantics & Rendering — Work Archive (2026-06-15)

**Owner:** Barbara (Semantics & Rendering)  
**Archive Date:** 2026-06-16T00:31:46Z  
**Archived From:** barbara/history.md (15747 bytes)

---

## 2026-06-15 — Dimension Guard Test + Spine Height Warning + config-layout Fix (Detailed)

### Root Cause (why gap-compression didn't fire)

The existing gap-compression trigger `hDrawTime / nEntries > 400px` divides over ALL entries, including multiple entries sharing the same date. Mermaid timeline parsing emits 3 entries per period (1 milestone anchor + 2 activity events), so 7 periods = 21 entries. Average per-entry spacing = `6720 / 21 = 320px < 400px` threshold → guard didn't fire. But the visual gaps between distinct date clusters were 1972→1991 = 2774px, 1994→2009 = 2190px. Total height: 7357px.

### Three Fixes Delivered

**1. Gallery Dimension-Guard Test** — `packages/core/test/gallery-dimensions.test.ts` (NEW)

Scans all SVGs under `examples/gallery/**/*.svg` (recursive glob via `readdirSync`). 191 tests:
1 count check + 190 per-file dimension assertions:
- `height ≤ 5000px` (empirical max of all legitimate renders: 2280px in vertical/ golden)
- `H/W ≤ 4.0` (empirical max of legitimate class diagrams: 1.92 for pastel-class)

Wide diagrams (LR flowcharts, W/H up to 8.25) are legitimately wide and intentionally not guarded. Only tall renders are pathological for this layout engine.

**2. Render-Time Warning** — `packages/core/src/layout/vertical-spine.ts` (modified)

After computing `H`, inserted a dimension-health guard block (warning only):
```typescript
const WARN_HEIGHT_PX = 5000;
const WARN_HW_RATIO  = 4.0;
if (H > WARN_HEIGHT_PX || H / W > WARN_HW_RATIO) {
  console.warn(`[vertical-spine] Pathological render detected: ...`);
}
```
Warning appears at render time, not in the SVG. Geometry unchanged. All existing goldens byte-identical.

**3. config-layout Demo Fix** — two parts:

**(a) New config-surface key `spineSpacing`** — `packages/core/src/frontend/mermaid/index.ts`

Added `spineSpacing: 'even' | 'time'` to the Mermaid timeline config-surface. Frontmatter value extracted and passed through `buildScene` and `renderDocument`. Prevents height explosion for any vertical-spine timeline with a long time span.

**(b) Demo updated** — `config-layout.mmd` / `mermaid-config-surface.test.ts`

Added `spineSpacing: even` to the frontmatter. Result: **1200×2283px** (H/W=1.90), down from 1200×7357px. Same 1969-2015 dataset — layout-selection-via-config still demonstrated.

#### Thresholds Chosen (empirical — measured from all 190 gallery SVGs before fix)

| Threshold | Value | Highest legitimate | Pathological before fix |
|-----------|-------|-------------------|------------------------|
| HEIGHT_MAX | 5000px | 2280px (feature-rich-executive in vertical/) | 7357px |
| HW_RATIO_MAX | 4.0 | 1.92 (pastel-class) | 6.13 (config-layout) |

#### Files Created/Modified

```
packages/core/test/gallery-dimensions.test.ts          (NEW — 191-test dimension guard)
packages/core/src/layout/vertical-spine.ts             (modified — dimension health warning after H computed)
packages/core/src/frontend/mermaid/index.ts            (modified — spineSpacing config-surface key for timeline)
packages/core/test/mermaid-config-surface.test.ts      (modified — config-layout test source updated)
examples/gallery/config-layout.mmd                     (modified — added spineSpacing: even)
examples/gallery/config-layout.svg                     (re-emitted — 1200×2283px, was 1200×7357px)
examples/gallery/config-layout.png                     (re-emitted)
.squad/decisions/inbox/barbara-dimension-guard.md      (NEW — decision note)
```

All other gallery goldens: byte-identical. Full suite: **2642/2642 tests passing**.

---

## 2026-06-15 — Three More Named Contract Themes (terminal, pastel, mono) (Summary)

Built 3 additional `ThemeContract` instances, bringing the named theme total to 7. Matrix promise re-confirmed: zero per-component work. Tests: **2392/2392 tests**.

**Themes authored:**
- **terminal** — Retro CRT / hacker; phosphor green on black; Courier New monospace; compact density
- **pastel** — Soft, friendly; warm off-white + soft lavender; Nunito rounded; comfortable density; 12px radius
- **mono** — Pure grayscale; white + mid-gray; Helvetica Neue; normal density; zero chroma throughout

All three follow `categorical[0] = accent` convention. Zero per-component binding changes required; matrix covers 7 themes × 21 components automatically.

**Files created/modified:**
```
packages/core/src/theme-contract/{terminal,pastel,mono}.ts        (NEW)
packages/core/src/theme-contract/index.ts                         (modified)
packages/core/test/terminal-pastel-mono-gallery.test.ts          (NEW)
examples/gallery/{terminal,pastel,mono}-*.{svg,png}              (NEW — 36 files)
examples/gallery/index.html                                       (modified)
```

---

## 2026-06-15 Work Summary (Archived Sections from current history.md)

Previously detailed: 3 named contract themes (midnight, blueprint, editorial) with full coherence verdicts, matrix tests, and gallery emit details. All archived for long-term retention with focus on summary above.

See main history.md for current-session updates and earlier-work links.
