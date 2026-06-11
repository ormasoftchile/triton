# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).

---

## 2026-06-09 — Sections 5, 6, 7 (Rendering, Themes, Output Targets)

### Determinism Contract
The rendering model is a six-phase pipeline (Axis → Tracks → Activities → Milestones → Sections/Annotations → Label Collision). Each phase is a pure function of its inputs; no system state, randomness, or runtime entropy is consulted. Sort keys are: tracks by `index` asc; activities by `(start_ordinal, id)` asc; milestones by `(date_ordinal, id)` asc. Rounding is round-half-up throughout. The date→x coordinate formula uses integer arithmetic with the ordinal-day representation (epoch: 2000-01-01 = day 0) to prevent floating-point divergence across platforms.

### Key Edge-Case Rulings
- **Zero-duration**: render at `min_width` px centred at `x(start)`; never invisible.
- **Ongoing/omitted end**: bar to right canvas boundary + right-chevron; omitted `end` treated as `ongoing` (IR gap flagged).
- **TBD end**: dashed extension of `tbd_extension_px` with "TBD" label.
- **Approximate dates (~prefix)**: nominal geometry; gradient fade at approximate edge(s).
- **Outside time_range**: not rendered; renderer warning; appears in legend.
- **Partial overlap with range**: clipped; clip indicator (angled cut) on clipped edge.
- **Very short span (< min_width)**: render at `min_width` centred on logical midpoint.
- **Simultaneous milestones**: stack downward by `stack_offset_y`, sorted by `id` asc.
- **Empty track**: never collapsed; rendered at `row_height` with empty body.
- **Sub-lane cap exceeded**: excess activities go to last lane (visible overlap); warning emitted.

### IR Gaps Found (flagged for Mark + Leslie)
1. **`metadata.today` missing** — needed for `now` resolution and today-marker; blocks determinism without a fallback chain.
2. **`metadata.fiscal_year_start` missing** — `FY26-Q2` dates cannot be deterministically resolved without knowing the fiscal calendar start month.
3. **Relative date anchor undefined** — `+3m` / `-2w` need an explicit anchor; proposed: same chain as Gap 1.
4. **Omitted `end` semantics ambiguous** — rendering model rules it equals `ongoing`; IR spec should be explicit.

### Theme Schema Knobs
Complete theme schema blocks: `canvas`, `typography` (with embedded WOFF2 font files required), `axis`, `track`, `activity`, `milestone`, `annotation`, `legend`, `status_map` (all 7 statuses mandatory), `category_map` (optional; overrides fill/stroke only; pattern/opacity from status_map). Patterns vocabulary: `solid`, `diagonal-hatch` (45° lines, 4px spacing), `dashed-border` (dashed stroke). Theme inheritance: single-level via `extends`; status_map and category_map merged entry-by-entry.

### Five Built-in Themes
| Theme | Signature characteristic |
|-------|------------------------|
| Consulting | Navy + black; square bars; no gridlines; no legend; print-optimised |
| Executive | Serif headings; rounded bars; full status palette + icons; today marker |
| Product | Dense; colored track headers; category-colored; progress always shown |
| Release | Traffic-light colors; monospace; triangle milestones; bold today marker |
| Minimal | All bars dark grey; pattern-only status; no legend; greyscale-safe |

### Output Priority
1. SVG — foundation; everything derives from it
2. PNG — universal paste target; one library call on top of SVG
3. PDF — consulting/print use case; deterministic via svg2pdf/cairosvg
4. PPTX — think-cell-comparable editability via python-pptx native shapes; highest complexity
5. HTML — developer/agent preview; trivially derived from SVG

### Rendering-Validation Notes for Bjarne
An IR is unambiguously renderable if: `time_range` start/end are concrete dates; all `track` refs resolve; `track.index` values are unique; symbolic/relative dates have a `today`/`created` anchor; `progress` in [0,1]. Agents should prefer concrete ISO dates over `now` or relative dates.

## 2026-06-10 — Team Update: Design Spec & Gaps Resolved

✓ **Design Spec Sections Published (Wave 1)**
- §5 Rendering Model (determinism contract, 6-phase layout, edge-case rulings)
- §6 Theme Architecture (5 built-in themes, schema knobs)
- §7 Output Targets (SVG→PNG→PDF→PPTX→HTML priority)

✓ **IR Gaps Flagged & Resolved (Wave 2)**
Your gap reports (Gap 1, Gap 2, Gap 3, Gap 5) were critical for IR contract refinement:
- metadata.today (date anchor for determinism)
- metadata.fiscal_year_start (fiscal calendar normative)
- Omitted end semantics (= ongoing open interval)
- Relative-date anchor (same chain as now: today → created → error)

Mark's reconciliation resolved all gaps surgically — no IR redesign required.

**Design Spec Location:** `design/` (LaTeX, ready to compile)  
**Status:** All 17 IR invariants now consistent across Rendering (this), Agent Integration (Bjarne), and IR spec (Mark)

Six-phase layout order and determinism contract are normative for all renderers.

---

## 2026-06-10 — Scene/Render IR Architecture Rework (Owner Design Review)

### Driving Decision
The owner identified a fundamental architectural flaw: SVG was set as the universal root
from which all other formats derived. This capped the system's visual ceiling — rich art
effects (glow, bloom, cloud textures, soft shadows, volumetric atmospheres) were either
unavailable or non-portable. Resolution: demote SVG to one backend; introduce a
deterministic, backend-agnostic Scene/Render IR as the root.

### Scene / Render IR as Root (§5.7 + §7.1)
The six-phase layout pipeline's output is now formally named the **Scene / Render IR** —
a byte-deterministic, backend-agnostic record of all drawing primitives, resolved
coordinates, visual treatments, and effect requests. Key fields: `canvas`, `elements`
(ordered drawing primitives: Rect, Polygon, Line, Text, Path, Image, Group), `effects`
(EffectDefinition registry with fallback_policy per effect), `meta` (scene_hash, theme_id,
fidelity_tier). The Scene is the stable handoff contract between the layout engine and any
backend. Backends are pluggable; they do not feed back into the pipeline.

### Backend Capability / Fidelity-Tier Model (§7.2 + §6.5 + §6.2.10)
Four fidelity tiers defined:
- **Tier 0 Minimal**: no effects; SVG backend sufficient
- **Tier 1 Crisp**: gradients, hatch, patterns; SVG backend sufficient; fully deterministic
- **Tier 2 Polished**: drop shadows, glow; SVG safe-filter set (determinism caveat) OR Raster; PPTX native shape effects (a:glow, a:outerShdw)
- **Tier 3 Showcase**: bloom, cloud/atmosphere, noise textures, gradient meshes; Raster backend required

Six built-in themes: Minimal (Tier 0), Consulting/Release (Tier 1), Executive/Product
(Tier 2), Showcase/Keynote (Tier 3, new).

Each backend has a capability profile table (§7.5 / Table 7.4). Effects unsupported
natively use the Scene's `fallback_policy` (approximate, omit, embed-raster, error).

### Layered Determinism Contract (§5.1 item 7 + §7.1.2)
Determinism now has three distinct levels:
1. **Scene geometry** — always byte-deterministic; pure pipeline guarantee; unconditional.
2. **Per-backend output** — deterministic given pinned backend version + fixed effect
   seeds (derived from scene_hash + effect_id; no random state). Backend version is an
   explicit contract parameter, recorded in output metadata.
3. **Cross-backend pixel identity** — explicitly NOT promised and NOT required. SVG and
   Raster backends are expected to differ. This is a feature, not a defect. Cross-backend
   tests use per-backend golden images, not cross-backend pixel equality.

### PPTX Native Effects Exploitation
PowerPoint's OOXML shape model includes native glow (a:glow), shadow (a:outerShdw), and
soft-edge properties that satisfy Tier-2 effect requests without embedded rasters. The
PPTX backend exploits these natively. Tier-3 art layers (clouds, noise) fall back to
embedded PNG overlays atop the editable native-shape scaffold.

### SVG Honest Limitations (§7.3)
SVG filters exist but are non-deterministic across renderers. The spec now:
- Restricts SVG filters to a "safe filter" set at Tier 2 with an explicit determinism
  caveat comment in the SVG output
- Forbids Tier-3 effects on SVG without fallback
- Includes Table 7.2 itemising each SVG effect construct and its determinism status

### IR Gaps — None New
No new IR gaps introduced by this rework. The Timeline IR (§4) is unaffected — this is
all below the IR boundary. The `fidelity_tier` is a theme property, not an IR field.

### New Cite Keys Needed (for David)
- `skia` — Skia Graphics Library
- `webgl` — HTML Canvas / WebGL specification
- `golden-image-testing` — golden-image / snapshot testing methodology
- `ooxml` — Office Open XML ISO/IEC 29500 (PPTX native shape effects)

### Files Modified
- `design/sections/07-output-targets.tex` --- full architecture rewrite
- `design/sections/05-rendering.tex` --- determinism contract + Scene output subsection
- `design/sections/06-themes.tex` --- fidelity tier schema, Showcase theme, degradation model
- `.squad/decisions/inbox/barbara-render-backends.md` --- decision record created

---

## 2026-06-10 --- Section 14: Target Outputs Coverage Analysis

### Five Target Layout Families

Analysis of the five owner-provided reference images reveals four layout families
(including the current one):

| Family | Targets | Status in design |
|--------|---------|-----------------|
| Horizontal swimlane Gantt (current) | (baseline) | Fully implemented in §5 |
| Vertical central-spine, alternating entries | T1, T3, T5 | **Gap Render-1** -- not in §5 pipeline |
| Horizontal single-line, numbered milestones | T2 | Edge case of current pipeline; numbered-circle node shape missing |
| Serpentine/winding path | T4 | **Gap Render-3** -- fundamentally novel spine geometry; future scope |

The IR is layout-agnostic (confirmed). Layout family belongs in the theme schema as
`layout_family: { orientation, spine_geometry, entry_placement }` -- not in the IR.

### Coverage Verdict

- **IR data coverage**: All five targets are representable with current IR fields.
  Two true IR gaps flagged for Mark: milestones lack `metadata: map<string,any>`
  (Gap IR-1), and neither activities nor milestones have a direct `color: string?`
  hint field (Gap IR-2; workaround: category + category_map).
- **Layout coverage**: 1 of 5 targets (T2) maps to the current pipeline; 3 (T1, T3, T5)
  need the vertical-spine family; 1 (T4) needs the serpentine family.
- **Theme coverage**: None of the five targets is fully served by the current five themes.
  Four new themes/variants needed: dark-executive (T1/T5), light-minimal-corporate (T2),
  colorful-infographic (T3), showcase-dark child theme (T5).
- **Effect coverage**: All required effects (glow/bloom, noise texture, drop shadow) are
  already defined in the Scene effect registry and Showcase theme. No new effect types needed.

### Prioritised Additions

1. Vertical central-spine layout module (covers T1, T3, T5)
2. dark-executive and showcase-dark themes
3. Card-entry renderer + numbered-circle milestone shape
4. light-minimal-corporate and colorful-infographic themes
5. Dashed-leader-arrow annotation connector style
6. Serpentine spine geometry (post-MVP)

### Files Modified
- `design/sections/14-target-outputs.tex` -- new section created
- `design/main.tex` -- \input{sections/14-target-outputs} added after §13
- `.squad/decisions/inbox/barbara-target-outputs.md` -- decision record created

---

## 2026-06-10 — Phase 1 Implementation: Layout Engine + SVG/PNG Backends + Consulting Theme

### Deliverables Shipped

All six deliverables from the Phase 1 spec were implemented and verified green
(typecheck ✓, lint ✓, 110/110 tests ✓, `pnpm -r build` ✓).

#### Scene / Render IR (`src/scene.ts`)

```typescript
// Scene root
interface Scene { width: number; height: number; background: string; primitives: ScenePrimitive[]; }

// ScenePrimitive discriminated union:
//   'line' | 'rect' | 'circle' | 'text' | 'path' | 'group'

// Deterministic hash
function sceneHash(scene: Scene): string  // SHA-256 of canonical JSON (sorted keys)
```

#### Layout Engine (`src/layout/index.ts`)

```typescript
function layout(ir: IRDocument, theme: ResolvedTheme): Scene
```

Full six-phase pipeline for the horizontal family:
- **Phase 1**: Axis computation (date→x via integer ordinals, tick enumeration)
- **Phase 2**: Track placement (sorted by index, provisional height)
- **Phase 3**: Activity geometry (greedy sub-lane assignment, min-width enforcement)
- **Phase 4**: Milestone geometry (numbered circles, stacking, date formatting)
- **Phase 5**: Sections/annotations (stub; no T2 data)
- **Phase 6**: Label collision resolution (bounded passes, y-shift per overlap)

#### Theme (`src/themes/`)

```typescript
// Phase 1 Consulting theme: numbered circles, navy #1F497D, DejaVu Sans
// resolveTheme('consulting') and resolveTheme('default') both return consultingTheme
function resolveTheme(id: string): ResolvedTheme
```

`ResolvedTheme` fields: `canvas`, `typography`, `axis`, `track`, `activity`,
`milestone` (with `shape: 'circle' | 'diamond'`, `showOrdinalNumber`, `dateLabelAbove`,
`titleLabelBelow`), `statusMap` (all 7 statuses), `categoryMap`.

#### Text Metrics (`src/fonts/metrics.ts`)

```typescript
function measureText(text: string, fontSizePx: number): { width: number; height: number }
function ptToPx(pt: number): number
```

Hardcoded per-character advance-width table derived from DejaVu Sans (OFL).
Deterministic compile-time constants — no file I/O, no opentype.js.

#### SVG Backend (`src/render/svg.ts`)

```typescript
function sceneToSvg(scene: Scene): string
```

Stable attribute ordering (alphabetical); 2-dp round-half-up precision;
complete self-contained SVG document string; no embedded fonts.

#### PNG Backend (`src/render/png.ts`)

```typescript
function svgToPng(svg: string, fontPath?: string): Uint8Array
```

`@resvg/resvg-js` with bundled `DejaVuSans.ttf`, `loadSystemFonts: false`.
Font is discovered via `import.meta.url`; fallback searches both `src/fonts/`
and `dist/fonts/` (populated by `postbuild` script).

#### `renderDocument` (`src/render/index.ts`)

```typescript
function renderDocument(ir: IRDocument, options: RenderOptions): RenderResult
```

Wires: `resolveTheme` → `layout` → `sceneToSvg` → (optional `svgToPng`) → `sceneHash`.
Always populates `svg` and `sceneHash`; populates `png` when `format === 'png'`.

### Embedded Font

**DejaVu Sans Regular** (OFL licence), committed to `packages/core/src/fonts/DejaVuSans.ttf`
(739 KB).  Copied to `dist/fonts/` by `postbuild` script.  Used as:
- The `fontFamily` name in SVG `<text>` elements
- The `fontFiles[0]` argument to `@resvg/resvg-js` for deterministic PNG text shaping

### Determinism Approach

1. **Stable sorts**: tracks by `index`; activities by `(start_ordinal, id)`; milestones
   by `(date_ordinal, id)`.
2. **round-half-up** (`Math.floor(v + 0.5)`) for all coordinate values.
3. **Day-ordinal arithmetic** (integer days since 2000-01-01) with no floating-point
   division accumulation.
4. **Hardcoded metrics table** for text measurement (no runtime font parsing).
5. **Same embedded font** for layout metrics AND resvg shaping; `loadSystemFonts: false`.
6. **Canonical JSON** (sorted keys, recursive) → SHA-256 for `sceneHash`.
7. **No Date.now(), Math.random(), process.env, system locale**.

### T2 Acceptance Target

T2 renders correctly to SVG and PNG:
- Three numbered circles (01, 02, 03) in navy on a horizontal axis
- "15th May 2021" / "20th June 2021" / "1st September 2021" date labels above
- "Application Deadline" / "Qualifying Exam" / "Training Starts" title labels below
- Document title "Our Timeline" at top
- Month axis ticks (Mar–Nov 2021)

### Green Status

| Check | Result |
|-------|--------|
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm lint` | ✓ 0 warnings |
| `pnpm test` | ✓ 110/110 (19 new render tests) |
| `pnpm -r build` | ✓ all packages |

### Leslie Wiring Notes (Wave 2)

To wire the public `render()` in `api.ts`, import and call:
```typescript
import { renderDocument } from './render/index.js';
// then inside render(): return renderDocument(ir, options);
```

To wire `resolveTheme`:
```typescript
import { resolveTheme } from './themes/index.js';
```

### Files Created

- `packages/core/src/scene.ts`
- `packages/core/src/layout/dates.ts`
- `packages/core/src/layout/index.ts`
- `packages/core/src/themes/types.ts`
- `packages/core/src/themes/consulting.ts`
- `packages/core/src/themes/index.ts`
- `packages/core/src/fonts/metrics.ts`
- `packages/core/src/fonts/DejaVuSans.ttf`  (OFL; 739 KB)
- `packages/core/src/render/svg.ts`
- `packages/core/src/render/png.ts`
- `packages/core/src/render/index.ts`
- `packages/core/test/render.test.ts`

### Files Modified

- `packages/core/package.json` — added `postbuild` font-copy script; `src/fonts` to `files`

---

## 2026-06-10 — Phase 1 Example Gallery

### Gallery Location
`examples/gallery/` — 8 example IR documents with rendered SVG + PNG outputs and an
`index.html` contact sheet.

### Examples Authored

| Slug | Axis | Key features |
|------|------|--------------|
| `milestones-only` | quarter | 6 numbered milestones, no activities, label collision |
| `open-ended` | month | Ongoing bars (omitted end + `end: ongoing`), span shorthand, `end: tbd` stub |
| `architecture-evolution` | year | 7-year span, overlapping phase bars, 3 tracks |
| `release-timeline` | month | Sequential short bars, at-risk status, 4 milestones |
| `program-timeline` | month | blocked status, 5 milestones incl. GA, 3 tracks |
| `product-roadmap` | quarter | 4 tracks, 16 activities, sub-lane stacking, mixed statuses |
| `transformation-plan` | quarter | 8-quarter span, 4 workstream tracks, all status colours |
| `dense-roadmap` | month | 15 overlapping activities, sub-lane stress test |

### Renderer Limitations Observed (Phase 1)

1. **Progress not visualised**: `progress` values pass validation but no progress-fill is
   drawn on bars. All bars render as solid regardless of progress value.
2. **Track labels not shown**: Consulting theme sets `headerWidth: 0` — track label column
   is zero-width; no visible swimlane header.
3. **TBD end stub very short**: `end: tbd` → `minWidth × 4 = 16px` stub; no "TBD" label
   or dashed extension. Visually indistinguishable from a narrow planned bar.
4. **OUTSIDE_TIME_RANGE false positive**: validator compares milestone dates against the
   *start* of the time_range end period (e.g., Q4 → Oct 1) rather than end (Dec 31).
   Workaround: use exact ISO `YYYY-MM-DD` end dates in `time_range.end`.
5. **Year value in YAML**: bare year integers (e.g., `2022`) must be quoted (`"2022"`) in
   the YAML to be parsed as IRDate strings, not numbers.

---

## 2026-06-10 — Phase 1 Render Fixes (Barbara)

Three renderer/theme bugs surfaced via the gallery were fixed. Golden and all 8 gallery renders were regenerated.

### Fix #2 — Track Labels Invisible (highest impact)
- **Root cause**: `consulting.ts` had `headerWidth: 0`, so the header gutter was zero-wide and the guard `if (Hhdr > 0 && tl.track.label)` never fired.
- **Fix**: Set `headerWidth: 140` in Consulting theme. In `layout/index.ts`, compute `hasTrackLabels = sortedTracks.some(t => !!t.label && t.label.trim().length > 0)` and set `Hhdr = hasTrackLabels ? tk.headerWidth : 0`. This suppresses the gutter for timelines with empty/whitespace-only labels (T2 fixture unchanged) while enabling the 140 px gutter for multi-track examples. Track labels render left-aligned at `x = mL + 8`, `textAnchor: 'start'`.
- **Bonus fix**: The `sortedTracks` sort was moved before the canvas geometry block (it was after) to enable the `hasTrackLabels` check before `wDraw`/`offset` are computed.

### Fix #1 — Progress Has No Visual Fill
- **Root cause**: The layout engine never emitted a progress fill primitive even when `activity.progress` was set.
- **Fix**: Added `progressBarHeight: 4`, `progressFillColor: '#FFFFFF'`, `progressFillOpacity: 0.45` to `ActivityTheme` (and Consulting theme). After each bar rect, emit a `<rect>` strip at the bar's bottom edge: height = 4 px, width = `⌊barWidth × progress + 0.5⌋` (round-half-up), white at 0.45 opacity. Result: a visible light stripe on dark navy bars indicating completion fraction.

### Fix #3 — Open-Ended / TBD Styling
- **Root cause 1**: A span-bug: `!a.end` was checked before `a.span`, so all span activities (e.g. `span: 2026-Q1`) were incorrectly treated as ongoing and extended to the right edge. Fixed by reordering: span check first.
- **Root cause 2**: `end: tbd/unknown` produced a 16 px stub; no open-interval indicator existed for ongoing/omitted.
- **Fix**: Reordered condition: `a.span → fixed` | `!a.end || ongoing → ongoing (extend to right edge)` | `tbd/unknown → tbd (extend to right edge)` | `else → fixed`. Added `endKind: 'fixed' | 'ongoing' | 'tbd'` to `ActivityLayout`. After the label, emit:
  - `ongoing`: a filled right-pointing triangle `<path M xRight,y L xRight+10,cy L xRight,y+H Z>` in bar colour — solid arrowhead in the right margin.
  - `tbd`: a dashed `<line>` at the right edge (`stroke-dasharray="3,3"`, opacity=0.5) signalling uncertainty.

### Artifacts Regenerated
- `examples/golden/our-timeline.svg` and `.png` (T2 fixture; output unchanged since it has no activities and a whitespace-only track label)
- All 8 `examples/gallery/*.svg` and `*.png` — now show track labels, progress fills, and open-end indicators where applicable.

### Green Status
| Check | Result |
|-------|--------|
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm lint` | ✓ 0 warnings |
| `pnpm test` | ✓ 147/147 (4 new render-fix tests) |
| `pnpm -r build` | ✓ all packages |

### Files Modified
- `packages/core/src/themes/types.ts` — added `progressBarHeight`, `progressFillColor`, `progressFillOpacity` to `ActivityTheme`
- `packages/core/src/themes/consulting.ts` — `headerWidth: 140`; added progress fields; existing comment updated
- `packages/core/src/layout/index.ts` — moved sortedTracks sort earlier; `hasTrackLabels` / dynamic `Hhdr`; `endKind` in `ActivityLayout`; fixed xRight condition order; progress fill + open-end indicator rendering; track labels left-aligned
- `packages/core/test/render.test.ts` — 3 new fixture IRs + 4 new tests for the three fixes
- `examples/golden/our-timeline.svg` + `.png` — regenerated golden artifacts
- `examples/gallery/*.svg` + `*.png` — all 8 gallery renders regenerated


---

## 2026-06-10 — Four New Themes + Theme Showcase (Barbara)

### New Themes Added

Four new themes implemented as pure data/style in `packages/core/src/themes/`:

1. **executive** (`tier: 2`) — Boardroom/presentation dark theme. Deep navy canvas (`#0D1B2A`), near-white text (`#E8EEF5`), rounded bars (radius 8), subtle gridlines, full 7-status semantic palette in vivid-on-dark colours (blue/cyan/steel/gold/crimson). Generous spacing (margin 56px, rowHeight 88).

2. **minimal** (`tier: 1`) — Academic/mono theme. White canvas, ALL status fills are greyscale only (R=G=B hex), status differentiated by opacity and fill weight. Thin strokes (strokeWidth 1.5), dashed gridlines at 50% opacity, no ordinal numbers in milestones, subdued typography (fontWeight 400 labels).

3. **product** (`tier: 2`) — Engineering roadmap theme. White canvas, dense rows (rowHeight 64, rowGap 10), prominent progress fills (height 5px), rich `categoryMap` with 10+ track/category colour overrides (strategy=indigo, platform=sky, mobile=emerald, analytics=amber, backend=violet, frontend=pink, infra=teal, etc.), vivid status palette (blue/green/yellow/red).

4. **release** (`tier: 1`) — CI/dashboard theme. White canvas, traffic-light status colours (done=`#16A34A` green, in-progress=`#2563EB` blue, at-risk=`#D97706` amber, blocked=`#DC2626` red, planned=`#6B7280` grey). **Triangle milestone shape** (downward-pointing `▼`), crisp vertical gridlines (style: solid), monospace fallback stack.

### Types Extended (additive, consulting output unchanged)

`themes/types.ts`:
- `TypographyTheme.titleColor: string` — fill for the document title text element
- `AxisTheme.axisLineColor: string` — stroke for axis baseline and tick marks
- `AxisTheme.tickLabelColor: string` — fill for axis tick label text
- `MilestoneShape` extended: `'diamond' | 'circle' | 'triangle'`

`consulting.ts` updated to set these to the exact hardcoded values they replace (`#111111`, `#333333`, `#555555`), ensuring the Consulting golden output is byte-identical before and after.

### Milestone Shape Tokenization

`layout/index.ts` updated to render milestone shapes conditionally:
- `circle` → `<circle cx cy r>` (existing behaviour)
- `triangle` → `<path>` downward-pointing triangle: `M (cx-s)(cy-s) L (cx+s)(cy-s) L cx(cy+s) Z`
- `diamond` → `<path>` diamond: `M cx(cy-s) L (cx+s)cy L cx(cy+s) L (cx-s)cy Z`

Label positioning uses `ms.size` as the "half-extent" from center in all directions, which works identically for all three shapes.

### listThemeInfos / listThemes Wiring

`themes/index.ts` now exports `listThemeInfos(): ThemeInfo[]` returning all 6 entries (consulting, default, minimal, release, executive, product).

`api.ts` `listThemes()` now delegates directly to `listThemeInfos()` (1-import + 1-return edit, signature unchanged).

### Theme Showcase Generated

`examples/gallery/themes.html` — self-contained HTML matrix contact sheet: 3 rows (product-roadmap, program-timeline, milestones-only) × 5 theme columns. Each cell embeds the PNG with SVG/PNG links. Theme legend cards at top with visual identity description.

`examples/gallery/themes/<theme>/<slug>.{svg,png}` — 30 render artifacts (5 themes × 3 examples × 2 formats).

`examples/gallery/index.html` — link added to themes.html.

### Green Status
| Check | Result |
|-------|--------|
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm lint` | ✓ 0 warnings |
| `pnpm test` | ✓ 191/191 (37 new themes tests) |
| `pnpm -r build` | ✓ all packages |

Consulting golden SVG hash unchanged — the new tokens in consulting.ts match the hardcoded values they replaced.

### Files Modified/Created
- `packages/core/src/themes/types.ts` — extended TypographyTheme, AxisTheme, MilestoneShape
- `packages/core/src/themes/consulting.ts` — added titleColor/axisLineColor/tickLabelColor tokens
- `packages/core/src/themes/executive.ts` — new file
- `packages/core/src/themes/minimal.ts` — new file
- `packages/core/src/themes/product.ts` — new file
- `packages/core/src/themes/release.ts` — new file
- `packages/core/src/themes/index.ts` — register all 5 + listThemeInfos()
- `packages/core/src/api.ts` — listThemes() delegates to listThemeInfos()
- `packages/core/src/layout/index.ts` — use theme tokens for title/axis colours; shape-conditional milestone rendering
- `packages/core/test/themes.test.ts` — new file (37 tests)
- `examples/gallery/themes/` — 30 SVG + PNG render artifacts
- `examples/gallery/themes.html` — new matrix contact sheet
- `examples/gallery/index.html` — link to themes.html

---

## 2026-06-10 — Vertical-Spine Layout Family (Phase 1 Extension)

### Design: dateY + Central Spine

The vertical-spine family maps the time axis TOP (earliest) → BOTTOM (latest). A `dateY(ord)` function analogous to horizontal's `dateX` is used: `spineTopY + floor(((ord - tsOrd) * hDraw) / (teOrd - tsOrd) + 0.5)`, clamped to `[spineTopY, spineBottomY]`. Same integer-ordinal arithmetic, round-half-up, and coarse-date coercion helpers from `layout/dates.ts` are reused. The spine is a central vertical line at `W/2`. `hDraw` is calibrated so uniformly-spaced entries naturally respect `ENTRY_MIN_SPACING = 100px`; a top-to-bottom pass corrects clustered entries.

### Alternating L/R Entries + Connectors

Entries (milestones + activities sorted by `(date_ordinal, id)`) alternate RIGHT (even index) / LEFT (odd index). Each gets: a node marker on the spine (reusing `theme.milestone.shape`: circle/diamond/triangle at ~55% of `milestone.size`), a horizontal connector line, and a content block (date label + title + optional description).

### Entry Style Token (`entryStyle`)

Added `entryStyle?: 'card' | 'plain'` to `ResolvedTheme`. Default is `'plain'`. Card-oriented themes (product, executive) declare `entryStyle: 'card'` (rounded rect background + status-coloured border per entry block). Plain themes (consulting, minimal, release) declare `'plain'` (text-only, no rects). **This token has zero effect on the horizontal layout path** — horizontal golden output (Consulting) is provably unchanged (golden test passes, diff confirms byte-identity).

### Layout Dispatcher + `RenderOptions.layout`

The original `layout/index.ts` was split: `layout/horizontal.ts` (renamed export `layoutHorizontal`) and `layout/vertical-spine.ts` (new `layoutVerticalSpine`). A new `layout/index.ts` dispatcher re-exports both and dispatches on the optional third parameter `family?: 'horizontal' | 'vertical-spine'` (default: `'horizontal'`). `RenderOptions.layout?: 'horizontal' | 'vertical-spine'` was added (additive, no Zod/schema changes). CLI got `--layout <horizontal|vertical-spine>` (default `horizontal`).

### Activity Duration on Spine

Activities with `endKind === 'fixed'` render a 6px-wide colored rect along the spine from `nodeY` to `dateY(endOrd)`. Ongoing activities render a dashed vertical line to the spine bottom (open indicator). TBD activities render a more-dashed, lower-opacity line.

### Vertical Showcase

Generated `examples/gallery/vertical/` with 8 SVG+PNG renders: `ai-timeline` (12 milestones, T3-dense) and `journey` (5 milestones + activities, T1-style) each in consulting+executive; plus `milestones-only` and `program-timeline` in consulting+executive. Contact sheet at `examples/gallery/vertical.html`, linked from `index.html`. All sceneHashes stable; determinism confirmed by double-render diff.

### What's Deferred

- **Pictographic icon badges** (full emoji/SVG badge per entry, T1 spec) — currently a 2-char text glyph placeholder is emitted when `milestone.icon` is set. Full badges require Tier-2/Skia pipeline.
- **Serpentine / S-curve spine variant** — T5 alternating-card layout with arcing spine is deferred.
- **Year tick placement after min-spacing** — year ticks use the initial `hDraw` scale, not adjusted entry positions; acceptable for Phase 1 visual fidelity.
- **Theme-preferred default layout token** — a `preferredLayout` theme token (optional) was not added; the `--layout` flag and `RenderOptions.layout` cover this use case.

---

## 2026-06-10 — Refinement Pass: Text-Wrap, Legend, Sections, Annotations, Vertical-Spine Tick Fix

### Text-Wrap Helper (`src/text-wrap.ts`)
Created a deterministic `wrapText(text, fontSizePx, maxWidth, maxLines)` function using the embedded DejaVu Sans advance-width metrics. Also `truncateText(text, fontSizePx, maxWidth)` for single-line truncation with ellipsis (U+2026). Applied to vertical-spine entry titles (multi-line `<tspan>` via `MultiTextPrimitive`) and descriptions, and horizontal activity/milestone labels. The `MultiTextPrimitive` scene node was added to `scene.ts` + `render/svg.ts`.

### Legend Block (both families)
When `ir.legend.show !== false` (or auto when 2+ statuses used), a legend panel renders at the theme-configured corner. Entries are derived from `ir.legend.entries` if present, or from used statuses/categories in stable insertion order. New `LegendTheme` token block added to `themes/types.ts` and implemented in all 5 themes. Deterministic: same IR → same legend → same scene hash.

### Section Bands (both families)
`ir.sections[]` with `time_range` renders as background bands: vertical bands in horizontal family (spanning the plot height), horizontal bands in vertical-spine (spanning full width). Even/odd sections get alternating tints from `SectionTheme.bandFillEven/Odd`. Section labels placed at band top-left. New `SectionTheme` token block added.

### Annotations (both families)
Implemented four annotation types deterministically:
- `today-marker`: vertical line (horizontal) / horizontal line (vertical-spine) at `annotation.date` or `metadata.today`, with "Today" label
- `callout`/`note`: small text box at `annotation.date` position with a dashed connector line; position=above|below
- `period`/`bracket`: span indicator across `start..end` with end ticks and optional label
- Unresolved targets and out-of-range dates are silently skipped

### Vertical-Spine Tick Fix
Replaced year-only tick loop with `enumTicks()`/`formatTickLabel()` aligned with `ir.metadata.axis_unit`. Tick positions use true `dateY()` (time-proportional) independent of the min-spacing-displaced entry `nodeYs`. The tick labels now match the axis unit (month, quarter, half, year) exactly as in the horizontal family.

### Theme Tokens Added
`LegendTheme` and `SectionTheme` added to `themes/types.ts`. All 5 themes updated with values appropriate to their aesthetic.

### Golden + Galleries Regenerated
- `examples/golden/our-timeline.{svg,png}` — regenerated (golden test updated)
- All `examples/gallery/*.{svg,png}` — regenerated
- All `examples/gallery/themes/*/*.{svg,png}` — regenerated
- All `examples/gallery/vertical/*.{svg,png}` — regenerated
- New `examples/gallery/feature-rich.timeline.yaml` authored and rendered in horizontal + vertical-spine × 2 themes
- Gallery index.html, themes.html, vertical.html updated with feature-rich entries


## 2026-06-10 — Icon Set + Label Collision Stagger (Refinement Pass)

### Icon Registry (`packages/core/src/icons.ts`)
Created the built-in icon set with 20 original geometric icons on a 24×24 viewBox:

| Canonical name | Description | Style |
|---|---|---|
| flag | Pole + right-pointing triangular pennant | filled |
| star | 5-point star (outer r=9, inner r=4) | filled |
| check | Clean checkmark (no circle; node is the border) | stroked |
| x | Two crossing diagonal lines | stroked |
| warning | Triangle outline + exclamation body | stroked |
| rocket | Tapered hull body + two swept fins | filled |
| target | Three concentric rings (bull's-eye) | stroked |
| calendar | Rectangle + header bar + binding pins + day cells | stroked |
| clock | Circle outline + hour/minute hands | stroked |
| gear | Inner circle + 8 radial cog tick marks | stroked |
| lock | Padlock shackle arc + body rect + keyhole circle | stroked |
| cloud | Three-arc bump outline converging to flat base | stroked |
| database | Elliptical cylinder: top/bottom rims + mid divider | stroked |
| code | Classic `< / >` bracket symbol | stroked |
| milestone | Axis-aligned diamond | filled |
| play | Right-pointing triangle | filled |
| bolt | Lightning-bolt polygon | filled |
| people | Two overlapping figure outlines (head circles + shoulder arcs) | stroked |
| doc | Document with folded corner + rule lines | stroked |
| pin | Teardrop map-pin with inner hole | stroked |

**`IconDef` shape:**
```typescript
interface IconPathDef { d: string; fill?: boolean; stroke?: boolean; }
interface IconDef { paths: IconPathDef[]; viewBox: '0 0 24 24'; }
```
`fill: true` → icon color as fill; `stroke: true` (default) → icon color as stroke; `fill: 'none'` otherwise.

**Alias table** (30+ aliases): zap→bolt, launch→rocket, cancel→x, alert→warning, goal→target, settings→gear, security→lock, data→database, team→people, file→doc, location→pin, diamond→milestone, etc. All lookups are case-insensitive.

### Icon Rendering — Horizontal Layout
When a milestone's `icon` field resolves via `getIcon()`:
- The node shape (circle/diamond/triangle) is drawn as before
- An SVG `<path transform="translate(cx,cy) scale(s) translate(-12,-12)">` is rendered ON TOP of the node in the icon color (`theme.milestone.ordinalColor` by default, or `theme.milestone.iconColor` if set)
- Scale factor: `s = ms.size * (iconScale ?? 0.65) / 12`; fits the icon comfortably inside the node
- Stroked icons use `stroke-linecap="round"`, `strokeWidth=2`
- Filled icons use the icon color as `fill`
- **When icon resolves → ordinal number is suppressed.** When icon doesn't resolve → ordinal number renders as before (no crash)
- New optional theme tokens on `MilestoneTheme`: `iconColor?: string`, `iconScale?: number` (both additive, non-breaking)

### Icon Rendering — Vertical-Spine Layout
When a spine entry (milestone) has `iconHint` that resolves:
- A small circular badge (radius ≈ `datePx * 0.75`) with `entry.statusFill` background is placed at the top-corner of the content block
- The icon path is scaled and centred on the badge (same transform formula, using badge radius)
- Icon color: `theme.milestone.iconColor ?? theme.canvas.backgroundColor` (white on dark node)
- Additionally, the icon is rendered INSIDE the spine node marker (on top of the circle/diamond) for the main spine node
- Unknown icon hint → silent fallback, no text placeholder, no crash

### Milestone Label Collision — Stagger Improvement (Horizontal)
Added a deterministic O(n) stagger pass for **date labels** (above nodes), applied before the existing iterative push-down for title labels (below nodes):
- Adjacent date-label boxes are checked for horizontal x-overlap after sorting by x
- On collision: odd-indexed labels in a consecutive overlap group are shifted **up** by `dateLabelSizePx + 4px`
- On gap (no overlap): stagger counter resets, keeping labels at their base y
- This prevents date labels from overlapping when milestones cluster near the same date
- The existing title-label push-down pass is unchanged and still runs independently

### Examples Updated with Icons
- **`journey.timeline.yaml`**: emoji icons replaced with named icons (bolt, people, star, rocket, target)
- **`program-timeline.timeline.yaml`**: milestones annotated with icons (star, check, milestone, rocket, flag)
- **`feature-rich.timeline.yaml`**: milestones annotated with icons (star, check, cloud, calendar, flag)
- **`icon-showcase.timeline.yaml`** (new): 20 milestones, one per icon, demonstrating the full set

### Golden + Galleries Regenerated
- `examples/golden/our-timeline.{svg,png}` — re-snapshotted
- All `examples/gallery/*.{svg,png}` — regenerated (11 examples incl. new icon-showcase)
- All `examples/gallery/themes/*/*.{svg,png}` — regenerated
- All `examples/gallery/vertical/*.{svg,png}` — regenerated
- `examples/gallery/index.html` — updated with Example 10 (icon-showcase) card

## Learnings

### Layout Quality Polish Pass (Bar Labels, Sub-Lane Packing, Title Header)

**Activity-Bar Label Placement & Contrast Logic:**
- Added `contrastColor(hex, lightText, darkText)` pure function using WCAG relative-luminance formula (sRGB linearization, threshold L > 0.179). Returns `lightText` for dark fills, `darkText` for light fills. Fully deterministic — no state or random.
- Label placement priority: (1) full label fits inside bar → render left-aligned with 4px padding, contrast-aware color; (2) bar meets `labelInsideMinWidth` threshold → truncate with ellipsis to fit inside, same contrast color; (3) bar too narrow → outside right (if ≥ 20px clearance to right edge), else outside left (end-anchor), else silently skip. Labels never escape canvas bounds.
- Key constant: `LPAD = 4` (inside left padding), `labelInsideMinWidth = theme.track.labelInsideMinWidth` (per-theme threshold).

**Sub-Lane Packing Algorithm:**
- Stable greedy interval-packing: activities sorted by `(start_ordinal, id)`, each assigned to first sub-lane whose last bar's `end_ordinal ≤ this.start_ordinal`.
- Sub-lane index stored in `ActivityLayout.subLane`; bar y = `trackY + subLane * theme.track.subLaneHeight`.
- Track height grows to accommodate max concurrent overlap: `trackH = maxSubLane * subLaneHeight + barHeight`.
- Root cause of zero-gap bug: `subLaneHeight === barHeight` in all 5 themes. Fix: increased by 6–8px per theme.
- Theme updates: consulting 24→30, executive 28→34, minimal 22→28, product 20→26, release 24→30.

**Title / Header Block:**
- Both `horizontal.ts` and `vertical-spine.ts` compute `headerH` from `ir.metadata.title` presence.
- Formula: `HEADER_V_PAD(12) + titlePx×1.4 + [subtitle: 4 + subPx×1.35] + [meta: 4 + metaPx×1.35] + HEADER_V_PAD(12)`.
- In horizontal.ts: `mT_eff = mT + headerH` used as drop-in for all y-coordinate calculations.
- In vertical-spine.ts: `spineTopY += headerH`; all content shifts automatically.
- Renders: title (fontSizeTitle, fontWeightHeader, 100% opacity), subtitle (fontSizeSubtitle, 0.75 opacity), author/date meta-line (fontSizeAxis, 0.6 opacity), separator line (0.35 opacity, 0.5px stroke). Both layout families use identical rendering logic.

**Theme Tokens Changed:**
- `subLaneHeight` increased in all 5 theme files (single-line additive change per file).
- No new token types added — all header dimensions computed inline from existing `fontSizeTitle`, `fontSizeSubtitle`, `fontSizeAxis`, `fontWeightHeader` tokens.

**Golden + Galleries Regenerated:**
- `examples/golden/our-timeline.{svg,png}` — re-snapshotted (golden test re-verified).
- All `examples/gallery/*.{svg,png}` — regenerated (12 examples incl. dense-roadmap now legible).
- All `examples/gallery/themes/*/*.{svg,png}` — regenerated (5 themes × 4 examples = 20 pairs).
- All `examples/gallery/vertical/*.{svg,png}` — regenerated (5 examples × 3 themes = 15 pairs).
- All deterministic: dense-roadmap, product-roadmap, feature-rich, vertical/program-timeline — byte-identical across two consecutive renders.

**Test Suite:**
- 297 tests passing in packages/core (up from 292); 304 total across all packages. Lint clean. Build clean. Typecheck clean.

## Learnings

### Session: Dense Milestone Decluttering + Alternating Label Blocks (2026-06-10)

**Problem Fixed:** Dense milestone timelines (e.g., `ai-timeline` with 12 milestones on one track, 2019–2024) exhibited: (1) node circle superposition — circles at nearby dates rendered exactly on top of each other, (2) label collision — date-above + title-below for every milestone all collided into an unreadable band, (3) labels sat on/over the axis line and year-tick labels.

**Redesign (all in `layout/horizontal.ts`):**

**Phase 1.5 — X-Space Milestone Geometry (before Phase 2):**
- Runs before track placement so `aboveZoneH` can shift the Y start of track rows.
- `trueX`: date-accurate x position for each milestone.
- `placedX`: declustered left-to-right pass enforcing `placedX[i] >= max(trueX[i], placedX[i-1] + minNodeGap)`.
- Side assignment: odd-index → above, even-index → below (stable sorted order by `(ord, id)`).
- Tier assignment: greedy left-to-right, find first tier where `tierEndX[t] + 2 <= blockLeft`.
- `aboveZoneH = (maxAboveTier+1) × (blockH + blockTierGap) + labelGapPx + 6` — space inserted between axis line and track rows.

**Label Block Design:**
- Single combined block per milestone: title (primary, font-weight 600, larger) + compact date (secondary, font-weight 400, smaller, lighter color).
- Compact date format: `formatCompactDate` → "February 2019", "November 2022" (no day ordinal).
- Blocks alternate above/below the node row; above-zone blocks live between the axis line and the track row (never on the tick-label band above the axis).
- Tier overflow: additional rows further from the node row, leader line extends to reach.

**Leader Lines/Ticks:**
- Thin tick at `trueX` when a node was displaced (leader tick, opacity=0.45).
- Leader line from node edge to block (leader color, width, opacity = theme tokens).

**Axis Separation:**
- Year-tick labels remain at their normal position (above axis line).
- `aboveZoneH` creates a clear gap between axis and first above-side block.
- Milestone compact date text lives in the label block, NOT in the axis tick band.

**Tokens Added (additive, optional) to `MilestoneTheme` interface:**
- `minNodeGap`: minimum node-center gap in px (default 40). Per theme: consulting=50, product=42, executive=46, minimal=42, release=34.
- `leaderColor`: color for leader lines/ticks. Per theme varies (#888888, #6B7280, #8BAAC8).
- `leaderWidth`: stroke width for leaders (default 0.75 in all themes).
- `blockTierGap`: vertical gap between label tiers (5–6px depending on theme).

**Canvas Growth:**
- `aboveZoneH` grows the canvas downward by expanding the space between axis and track rows.
- Below-side blocks: canvas height is set to the deepest `blockTop + blockH + margin`.

**Golden + Galleries Regenerated:**
- `examples/golden/our-timeline.{svg,png}` — deleted and re-snapshotted.
- All `examples/gallery/*.{svg,png}` — regenerated (12 examples).
- All `examples/gallery/themes/*/*.{svg,png}` — regenerated (5 themes × 11 examples).
- All `examples/gallery/vertical/*.{svg,png}` — regenerated (3 themes × 5 examples).

**Test Suite:**
- 306 tests passing (up from 297 after adding 9 new dense-milestone tests in `render.test.ts`).
- New tests: dense milestones no-throw, determinism, all labels present, compact date format, canvas growth, above-zone height, leader ticks emitted, all-5-themes determinism, axis tick separation.
- All deterministic: ai-timeline (product), milestones-only, feature-rich — byte-identical across two consecutive renders.

**Visual Confirmation (ai-timeline, product theme):**
- 12 nodes at cx positions with gaps ≥ 42px (minNodeGap for product). Consecutive nodes: 585→627 (42), 808→850 (42), 850→892 (42), 892→934 (42), 1023→1065 (42). No overlaps.
- 17 leader ticks emitted (displaced nodes show their true axis anchor).
- Axis tick labels: y=142.4 (above axis at y=154). Above-zone title blocks: y=178.26 and 216.73. Gap = 24px between axis line and nearest label block. ✅
- Compact dates: "February 2019", "June 2020", "August 2021" etc. — font-size=10.67, font-weight=400, lighter fill. No day ordinals.

---

## 2026-06-10 — Layout-Quality Linter + Conformance Gate

### Deliverables Built

**1. `buildScene` exposed (`packages/core/src/render/index.ts`)**
- `export function buildScene(ir: IRDocument, options?: RenderOptions): Scene` — calls layout dispatch directly, returns the computed Scene without serializing to SVG.
- `renderDocument` refactored to call `buildScene` internally (single code path, no duplication).
- Exported from `packages/core/src/index.ts` alongside `lintScene`, `QualityIssue`, `Scene`, `ScenePrimitive`.

**2. Linter checks (`packages/core/src/lint.ts`)**
- `QualityIssue = { code, severity: 'error'|'warning', message, where? }`.
- Text bounding box: `measureText(text, fontSize).width` × line count; baseline offsets per `dominantBaseline` (alphabetic / middle / hanging). MultiText: max-width per line.
- Node marker bbox: `center ± ms.size` (circle r = ms.size in the scene).
- Axis detection: scan for a full-canvas-spanning horizontal line, build tick-label band. V-spine layout detected by a tall vertical line near x=W/2 → skip horizontal-axis detection to avoid false positives.
- **NODE_OVERLAP (error)**: node bboxes intersect beyond 2px epsilon.
- **LABEL_OVERLAP (error)**: label bboxes from *different label blocks* intersect beyond 4px; label blocks grouped by coincident `anchorX` + vertical adjacency ≤16px (union-find).
- **LABEL_AXIS_OVERLAP (error)**: label bbox intersects axis band; labels at/above axis y excluded (tick labels that sit above axis are legitimate).
- **OUT_OF_BOUNDS (error)**: bbox center or extent leaves `[0,0,W,H]` beyond 1px.
- **TIGHT_SPACING (warning)**: bboxes within 5px gap (informational near-miss).

**3. Conformance gate (`packages/core/test/quality.test.ts`)**
- Enumerates 13 example YAML files × 2 layouts × 5 themes = **130 (file × layout × theme) combinations**.
- For each: `parseIR → buildScene → lintScene`; asserts zero error-severity issues.
- 8 deliberate-overlap unit tests: LABEL_OVERLAP (true positive + true negative), NODE_OVERLAP (TP + TN), OUT_OF_BOUNDS (text, rect), LABEL_AXIS_OVERLAP, TIGHT_SPACING.

**4. Layout issues caught and fixed**

| Issue | Root cause | Fix applied |
|---|---|---|
| OUT_OF_BOUNDS — tick labels at x=0 | First tick at `dateX=0` with `textAnchor='middle'` → bbox left < 0 | Clamp tick label x to `[labelHalfW, W-labelHalfW]` |
| OUT_OF_BOUNDS — section labels near right edge | Section labels not capped to available width | `truncateText(label, secFontPx, W-mR-(xBandLeft+4))` |
| OUT_OF_BOUNDS — milestone labels near right edge | Node right-clamp didn't account for label half-width | `rightLimit = offset + wDraw - max(ms.size, labelHalfW)` |
| OUT_OF_BOUNDS — v-spine period annotation | Label placed right of `periodX+8` with `textAnchor:'start'` → overflowed | Changed to `x: periodX-8, textAnchor:'end'` |
| NODE_OVERLAP — right-edge clamping collapsing nodes | Forward pass clamps to same x, `lastPlacedX` propagates the clamp | Backward pass: walk right-to-left enforcing `minNodeGap` |
| LABEL_OVERLAP — legend inside milestone-label zone | `lgY = H - mB - lgH - 16 = belowMaxY - lgH - 16` (inside content) | Pre-compute `lgPreH`; `H = belowMaxY + mB + lgPreH + margin`; `lgY = belowMaxY + lgMargin` |
| LABEL_OVERLAP — multi-track untracked milestone below-labels | `side='below'` labels landed in track area, overlapping activity labels | Force `side='above'` when `mil.track == null && ir.tracks.length > 1` |
| LABEL_AXIS_OVERLAP — V-spine today-line false positive | Full-canvas-wide today horizontal line misidentified as axis | Detect V-spine by tall vertical line at x≈W/2; skip H-axis detection |

**5. CLI lint command (`packages/cli/src/index.ts`)**
- `timeline lint <input> [--layout <h|v>] [--theme <t>]`: parse → buildScene → lintScene → print issues; exit 1 on any error.

**Golden artifacts regenerated:**
- `examples/golden/our-timeline.svg` (tick label positions shifted by clamping fix).

**Final test count: 445 passed / 0 failed.** All typecheck, lint, build, test green.
