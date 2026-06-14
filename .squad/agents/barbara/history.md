## 2026-06-14 — Faithful Gantt Layout

### Summary

Replaced the roadmap-style gantt render (which reused `layoutRoadmap` and produced rounded pills, no section labels, circle milestones) with a **dedicated, Mermaid-faithful `layoutGantt`** engine, gated behind `layout: 'gantt'`. Real-Mermaid A/B confirmed full structural parity.

### Gallery: `examples/gallery/mermaid-gantt.{svg,png}` — viewBox `0 0 1400 510`

### Gantt Layout: section bands + labels (2026-06-14)

- **Section label column:** 120px fixed-width column on the LEFT, right-aligned text, vertically centred per section band. This is the most prominent gap vs. the roadmap look — section labels were completely absent before.
- **Section bands:** Alternating fills (`#EEF2FF` periwinkle / `#FAFAFA` near-white). Full chart-area width (excluding the label column). Drawn before gridlines.
- **One row per declared task** (declaration index = row number). Real Mermaid puts each declared task in its own horizontal lane; greedy interval packing is wrong here. This gives the characteristic staircase pattern for sequential tasks.
- **Vertical gridlines drawn AFTER section bands** so they're visible on top. Soft `#AAAACC` at 50% opacity — readable without dominating.

### Gantt Layout: date axis / grid (2026-06-14)

- **Bottom axis position** (not top — Mermaid puts dates at the bottom). Axis baseline: a horizontal line at `contentBottomY`.
- **Tick labels: `YYYY-MM-DD` format** (e.g., `2025-02-01`). Deterministic: no locale. Crowding-skip algorithm prevents overlapping labels using measured text widths + `MIN_TICK_LABEL_GAP`.
- **`GanttAxisState`** — simple struct `{ tsOrd, teOrd, xLeft, xRight }`. dateX = linear mapping from ordinal to pixel range. No break-segment logic needed (gantt doesn't use axis breaks).
- **Axis unit auto-selected** based on range: <60d→day, <365d→month, <1095d→quarter.

### Gantt Layout: status colors (2026-06-14)

- `done` → `fill: #C0C7D4`, `stroke: #8E9AAF` (muted gray-blue)
- `in-progress` (active) → `fill: #7B9FE0`, `stroke: #3B5FC0` (cornflower blue)
- `planned` → `fill: #C8D9F5`, `stroke: #7B9FE0` (light blue)
- `critical` category (overrides status) → `fill: #FF8080`, `stroke: #E53E3E` (red)
- Milestone diamonds: same color families; crit → bright red `#E53E3E`

### Gantt Layout: milestone diamonds (2026-06-14)

- **Diamond = 4-point path** `M cx t L r cy L cx b L l cy Z` where `t/r/b/l` are top/right/bottom/left vertices at ±DIAMOND_SIZE (8px half-diagonal) from center.
- Placed at the milestone's date ordinal → x, in the row AFTER the last activity row in the section.
- **Label flip:** label renders to the RIGHT of the diamond by default. If `labelX + labelWidth > chartRight - 4`, flips to the LEFT (`textAnchor: 'end'`). This correctly handles "Public GA" at the right edge.

### Opt-in / determinism architecture (2026-06-14)

- New layout module: `packages/core/src/layout/gantt.ts` (pure function, zero imports from other layout modules)
- `layout/index.ts`: `if (family === 'gantt') return layoutGantt(ir, theme, baseDir);` — single dispatch guard.
- `types.ts` + `render/index.ts`: union extended with `| 'gantt'` in two places.
- `frontend/mermaid/gantt.ts` (parser): sets `layout: 'gantt'` in IRDocument metadata.
- `frontend/mermaid/index.ts` (renderer): hardcodes `layout: 'gantt'` in the render branch.
- All pre-existing goldens byte-identical. `git status --porcelain examples/gallery/*.svg` → only `mermaid-gantt.svg`.

### File paths

- `packages/core/src/layout/gantt.ts` — NEW gantt layout engine
- `packages/core/src/layout/index.ts` — register gantt dispatcher
- `packages/core/src/types.ts` — add `'gantt'` to layout unions
- `packages/core/src/render/index.ts` — add `'gantt'` to BuildSceneOptions
- `packages/core/src/frontend/mermaid/gantt.ts` — set `layout: 'gantt'` in parser
- `packages/core/src/frontend/mermaid/index.ts` — force `layout: 'gantt'` in render branch
- `examples/gallery/mermaid-gantt.{svg,png}` — re-emitted
- `.squad/decisions/inbox/barbara-gantt-faithful.md` — decision note

### Test result: 1540/1540 ✓ (only mermaid-gantt.svg changed)


---

## Learnings — timeline-columns layout (Mermaid `timeline` fidelity) (2026-06-14)

**Supersedes:** the previous even-spine fix for the Mermaid timeline path (that path used
`layout: 'horizontal', spineSpacing: 'even'` which produced arc-around-node style — wrong).

### Layout architecture

The Mermaid `timeline` type requires a **section-column** grid layout, not a horizontal spine:

| Zone | What it is |
|------|------------|
| Top band | Colored section header rectangles (one per section, spanning its periods) |
| Middle | Period column header boxes (darker tint, one per period) |
| Axis | Horizontal arrow line separating period headers from events |
| Bottom | Event boxes stacked vertically per period (light pastel tint) |

### Data reconstruction (NO parser changes needed)

The Mermaid timeline parser already stores all grouping info in the IRDocument:
- **Sections** → `doc.sections` (or fallback `doc.tracks`)
- **Periods** → `doc.milestones` with `milestone.track === sectionId`
- **Events** → `doc.activities` with `activity.track === sectionId` AND `(activity.span || activity.start) === period.date`

Sorting periods within a section: lexicographic on the IRDate string (works correctly for
year-only "1954", YYYY-MM, and YYYY-MM-DD forms — all sort chronologically as strings).

### Column width formula

```
minCanvasW = totalPeriods * MIN_COL_W + MARGIN_LR * 2
colW = floor((max(theme.canvas.width, minCanvasW) - MARGIN_LR * 2) / totalPeriods + 0.5)
canvasW = colW * totalPeriods + MARGIN_LR * 2
```

Even spacing is enforced: all columns same width regardless of time gaps between periods.
`MIN_COL_W = 100` ensures labels are readable at `EVENT_FONT_PX = 11` (fixed px, not pt).

### Font size lesson

Event labels must use a **fixed small px size** (11px), NOT `ptToPx(theme.fontSizeBase)`.
The consulting theme's `fontSizeBase = 11pt = 14.67px` is too large for ~91px-wide event boxes.
At 14.67px, even "FORTRAN" (7 chars) was being truncated. At 11px, all single-word labels
fit comfortably; multi-word labels wrap gracefully to 2 lines.

### 8-color section palette

Defined inline in `timeline-columns.ts` — each entry has `{ header, period, event, headerText, eventText, eventBorder }`.
Section headers use saturated colors; period boxes use slightly darker shade; event boxes
use a very light pastel. All 8 colors are distinct; cycling handles timelines with >8 sections.

### Opt-in / determinism architecture (same pattern as gantt)

- New layout module: `packages/core/src/layout/timeline-columns.ts` (pure function)
- `layout/index.ts`: `if (family === 'timeline-columns') return layoutTimelineColumns(ir, theme, baseDir);`
- `types.ts` + `render/index.ts`: union extended with `| 'timeline-columns'` in two places
- `frontend/mermaid/index.ts`: hardcodes `layout: 'timeline-columns'` in the timeline render branch
  (replaces the old `layout: finalDoc.metadata.layout, spineSpacing: 'even'` approach)
- All pre-existing goldens byte-identical. Only `mermaid-timeline.svg` changed.

### Output dimensions

- viewBox: `0 0 1380 346` — 1380×346 px (13 periods × 100px + 80px margins)
- Canvas height = MARGIN_TOP + titleH + SECTION_HDR_H + PERIOD_HDR_H + eventAreaH + MARGIN_BOTTOM
- maxEvents = 3 (period 1995 has Java + "Write once, run anywhere" + "JVM ecosystem")

### File paths

- `packages/core/src/layout/timeline-columns.ts` — **NEW** timeline-columns layout engine
- `packages/core/src/layout/index.ts` — register dispatcher + export
- `packages/core/src/types.ts` — add `'timeline-columns'` to layout unions
- `packages/core/src/render/index.ts` — add `'timeline-columns'` to `BuildSceneOptions.layout`
- `packages/core/src/frontend/mermaid/index.ts` — switch timeline render branch to `'timeline-columns'`
- `examples/gallery/mermaid-timeline.{svg,png}` — re-emitted
- `.squad/decisions/inbox/barbara-timeline-columns.md` — decision note

### Test result: 1540/1540 ✓ (only mermaid-timeline.svg changed)


---

## Learnings — Radar `curve id["Label"]{...}` — Mermaid-valid gallery example (2026-06-14)

### What changed

The gallery example `examples/gallery/mermaid-radar.mmd` previously used `curve "Senior Dev"{...}` (no id) which is our superset extension. Real Mermaid `radar-beta` **requires** a bare id before the label:

- ✅ Valid: `curve sd["Senior Dev"]{9, 8, 7, 8, 9, 6}`
- ❌ Rejected: `curve "Senior Dev"{9, 8, 7, 8, 9, 6}` (no id)

The example now reads `curve sd["Senior Dev"]{9, 8, 7, 8, 9, 6}` and `curve jd["Junior Dev"]{6, 5, 5, 3, 6, 4}`. Both axes (`axis sp["Speed"], rl["Reliability"], ...`) and `max`/`min`/`title` were already Mermaid-valid.

### Parser behaviour (both forms supported)

Our parser (`frontend/mermaid/radar.ts`) already handled the id form via the `labeledId` branch at line 141 — `seriesName = labeledId[2]` takes the quoted label, **not** the id. So the legend always shows "Senior Dev" / "Junior Dev" regardless of whether `sd` / `jd` ids are present.

The no-id superset form `curve "Senior Dev"{...}` is preserved via the `doubleQuoted` branch and continues to work.

### Corpus test added

New test case `'canonical mermaid id-form curves use label not id'` in `test/mermaid-radar-corpus.test.ts` verifies the gallery MMD text with `sd`/`jd` ids parses to `expectedAxes` = 6 axes, `expectedSeries` = 2, `expectedLabelIncludes` = `['Developer Profile Comparison', 'Senior Dev', 'Junior Dev']`.

### A/B result

Both real Mermaid (mmdc) and our renderer produce the correct 6-axis 2-series radar:
- **Real Mermaid:** smooth bezier-curved polygons, blue/periwinkle + yellow-green fill, grey concentric rings, no ring scale labels.
- **Ours:** angular straight-line polygons, blue + orange fill (higher contrast), dashed concentric rings WITH scale labels (2.5 / 5 / 7.5 / 10) — more informative.

Both are structurally faithful. Ours is at least as clean, with better series contrast and explicit scale labels. The main visual delta is polygon shape (curved vs straight edges).

### SVG golden note

Because the rendered output only depends on series **labels** (not ids), and the labels "Senior Dev" / "Junior Dev" did not change, the re-emitted `mermaid-radar.svg` is byte-identical to the committed version. All other gallery SVGs are also byte-identical. Only `mermaid-radar.mmd` changed in git.

### Test result: 1541/1541 ✓ (1 new test added)
