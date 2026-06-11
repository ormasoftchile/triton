# Squad Decisions — Archive (Timeline Compiler)

Archived implementation decision notes. Full text preserved here; the canonical ledger in decisions.md keeps a compact index.

## Archived 2026-06-11 — Implementation decision notes (2026-06-09 → 2026-06-11)

## Agent Decisions — Merged from Inbox (2026-06-10 Backlog)

# Barbara — Example Gallery Decision Note

**Date:** 2026-06-10  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Done  

## Summary

Created a Phase 1 example gallery under `examples/gallery/` with 8 diverse,
validated IR documents rendered to SVG and PNG, plus an `index.html` contact sheet
and a `README.md` with regeneration instructions.

## Deliverables

- `examples/gallery/*.timeline.yaml` — 8 example IR documents (all validate exit 0)
- `examples/gallery/*.svg` and `*.png` — 16 rendered output files (all non-empty)
- `examples/gallery/index.html` — self-contained contact sheet for bulk visual review
- `examples/gallery/README.md` — listing + regeneration commands

## Renderer Limitations Surfaced

1. **Progress not visualised** — `progress` field is IR-valid but produces no visual
   fill in Phase 1 bars. Owner should expect solid bars even when `progress: 0.5`.
2. **Track labels invisible** — Consulting theme `headerWidth: 0` means swimlane labels
   are silently dropped. Consider Phase 2 theme variant with non-zero header width.
3. **TBD end stub** — `end: tbd` renders as a 16px stub with no indicator. Low
   information density; a dashed extension + label is worth adding in Phase 2.
4. **OUTSIDE_TIME_RANGE false positive in validator** — validator uses start-of-period
   for `time_range.end` comparison instead of end-of-period. Workaround applied: use
   exact ISO end dates in `time_range.end`.
5. **Year as YAML integer** — bare year numbers in YAML (e.g., `2022`) are parsed by
   the YAML loader as integers and fail schema validation. Must be quoted strings.

## No source changes

No renderer or core source files were modified. All examples authored within current
Phase 1 capabilities.
# Decision Note: Built-in Icon Set + Label Collision Stagger

**Author:** Barbara  
**Date:** 2026-06-10  
**Status:** Implemented — all tests green, galleries regenerated

---

## What was done

### 1. Icon Registry (`packages/core/src/icons.ts`)

A new built-in icon set was added as `icons.ts` with 20 original geometric icons on a `0 0 24 24` viewBox. All paths are hand-authored — no copying from Lucide, Feather, FontAwesome, or any licensed set.

Export surface:
- `getIcon(name: string): IconDef | undefined` — case-insensitive, alias-aware lookup
- `hasIcon(name: string): boolean`
- `listIcons(): string[]` — sorted canonical names

`IconDef` shape:
```typescript
interface IconPathDef { d: string; fill?: boolean; stroke?: boolean; }
interface IconDef { paths: IconPathDef[]; viewBox: '0 0 24 24'; }
```

### 2. Scene / SVG Updates

- `PathPrimitive` in `scene.ts` now accepts optional `transform?: string` and `strokeLinecap?: 'butt' | 'round' | 'square'`
- `svg.ts` emits these new attributes deterministically (alphabetically sorted with all existing attributes)

### 3. Theme Tokens (additive)

Two optional fields added to `MilestoneTheme` in `themes/types.ts`:
- `iconColor?: string` — color used to draw icon glyphs (defaults to `ordinalColor`)
- `iconScale?: number` — proportion of node diameter the icon fills (defaults to 0.65)

No existing theme files were modified; tokens are opt-in.

### 4. Icon Rendering — Horizontal Layout

When `milestone.icon` resolves via `getIcon()`:
- SVG `<path transform="translate(cx,cy) scale(s) translate(-12,-12)">` drawn on top of the node marker
- Ordinal number suppressed when icon is present
- Unknown icon → silent fallback to ordinal number, no crash

### 5. Icon Rendering — Vertical-Spine Layout

When a spine entry's `iconHint` resolves:
- Circular badge rendered at the content block top-corner
- Icon path scaled/centred on badge using same transform formula
- Icon also rendered inside the spine node marker
- Unknown icon → silent fallback (no placeholder text), no crash

### 6. Milestone Label Stagger (Horizontal)

A new deterministic O(n) stagger pass for date labels (above milestone nodes):
- Adjacent labels sorted by x; checked for horizontal overlap
- Colliding odd-indexed labels shift up by `dateLabelSizePx + 4px`
- Stagger counter resets on non-overlapping gaps

### 7. Examples Updated

- `journey.timeline.yaml`: emoji hints replaced with named icons
- `program-timeline.timeline.yaml`: icons added (star, check, milestone, rocket, flag)
- `feature-rich.timeline.yaml`: icons added (star, check, cloud, calendar, flag)
- `icon-showcase.timeline.yaml` (NEW): 20 milestones × 20 icons showcase

### 8. Tests

`packages/core/test/icons.test.ts` — 68 tests covering:
- All 20 canonical names return valid IconDef
- 30+ aliases resolve correctly
- Unknown names return undefined without throwing
- Two renders with icon milestones produce byte-identical SVG (determinism)
- Unknown icon falls back to ordinal number

All 292 tests pass in `@timeline-compiler/core`; 299 total across all packages.

---

## Files changed

| File | Change |
|---|---|
| `packages/core/src/icons.ts` | NEW — icon registry |
| `packages/core/src/scene.ts` | Added `transform?`, `strokeLinecap?` to PathPrimitive |
| `packages/core/src/render/svg.ts` | Emit new path attrs |
| `packages/core/src/themes/types.ts` | Added `iconColor?`, `iconScale?` to MilestoneTheme |
| `packages/core/src/layout/horizontal.ts` | Import getIcon; icon rendering in nodes; date label stagger |
| `packages/core/src/layout/vertical-spine.ts` | Import getIcon; icon badge + node icon rendering |
| `packages/core/test/icons.test.ts` | NEW — 68 tests |
| `examples/gallery/icon-showcase.timeline.yaml` | NEW — icon showcase IR |
| `examples/gallery/journey.timeline.yaml` | Replace emoji with named icons |
| `examples/gallery/program-timeline.timeline.yaml` | Add icon hints |
| `examples/gallery/feature-rich.timeline.yaml` | Add icon hints |
| `examples/gallery/index.html` | Add Example 10 icon-showcase card |
| `examples/golden/our-timeline.{svg,png}` | Re-snapshotted |
| `examples/gallery/*.{svg,png}` | Regenerated (11 examples) |
| `examples/gallery/themes/*/*.{svg,png}` | Regenerated |
| `examples/gallery/vertical/*.{svg,png}` | Regenerated |

---

## Deferred / Not done

- ~~**Activity icon rendering**~~: **RESOLVED (2026-06-11)** — Mark added `Activity.icon?: string` field; Barbara rendered activity icons at left edge of activity bar (horizontal) and in spine entry cards (vertical-spine). See Decision entries "Activity.icon Field Addition" and "Activity Icon Placement Semantics and Size Rule".
- **Advanced icon badge styles** (outline only, badge with border, etc.): the current implementation uses a solid filled circle backing for vertical-spine badges. Can be made configurable via theme tokens.
# Decision: Layout Quality Polish Pass

**Date:** 2026-06-10  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Implemented

## Context

Dense timelines (e.g., `dense-roadmap`) had overlapping activity bars within the same track, activity labels that could overflow canvas bounds, and no prominent title/header block. These were the three most visible rendering weaknesses.

## Decisions Made

### 1. Activity-Bar Label Placement with Contrast-Aware Color

**Decision:** Labels render *inside* the bar when the text fits (left-aligned, 4px padding), using a WCAG-luminance-based contrast color. When the bar is too narrow, labels are placed outside-right (or outside-left near the right edge), truncated with ellipsis, clamped to canvas bounds. Silent skip only if truly no space (< 20px).

**Rationale:** Inside labels are more readable for wide bars and don't clutter the space between bars. Contrast-aware coloring ensures accessibility. Canvas clamping prevents overflow artifacts in all density cases.

**Implementation:** `contrastColor()` in `layout/horizontal.ts` — pure function, no state, WCAG relative luminance formula.

### 2. Dense Overlap / Sub-Lane Packing

**Decision:** Activities within the same track that overlap in time are packed into deterministic sub-lanes (stacked rows) using a stable greedy interval-packing algorithm (sorted by `start_ordinal, id`). Track height grows to fit the maximum concurrent overlap depth.

**Rationale:** Visual bar collisions made dense timelines unreadable. Sub-lane packing is the standard solution; deterministic sort ensures byte-identical output across runs.

**Root Cause Fixed:** All 5 themes had `subLaneHeight === barHeight`, resulting in 0px visual gap between sub-lane bars. Increased `subLaneHeight` by 6–8px per theme.

### 3. Title / Header Block (Both Layout Families)

**Decision:** `ir.metadata.title` (and optional `subtitle`, `author`, `created`) renders as a prominent header block at the top of every canvas. The plot/spine shifts down by `headerH` to accommodate. If `metadata.title` is absent, `headerH = 0` and layout is unchanged.

**Rationale:** Timelines shared as images need contextual titles. The previous implementation either had no title or a minimal unstyled text element.

**Implementation:** Identical header block in both `layout/horizontal.ts` and `layout/vertical-spine.ts`. Theme-consistent typography (fontSizeTitle, fontWeightHeader, subtitle at 0.75 opacity, meta-line at 0.6 opacity, separator line at 0.35 opacity).

## Trade-offs

- Track heights grow with overlap depth, so dense timelines are taller. This is intentional — legibility over compactness.
- Header block increases all canvas heights by `headerH` when a title is present. Backward-compatible: no title = no height change.
- `subLaneHeight` increase is a minor visual change for non-overlapping timelines (sub-lane height now defines the minimum spacing available, but a single-lane track is unaffected in height).

## Artifacts Regenerated

- `examples/golden/our-timeline.{svg,png}` — new golden snapshot
- All `examples/gallery/*.{svg,png}`, `themes/*/*.{svg,png}`, `vertical/*.{svg,png}`
- 304 tests green, lint clean, typecheck clean, determinism verified.
# Decision: Dense Milestone Decluttering + Alternating Label Blocks

**Date:** 2026-06-10  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Implemented

## Problem

Dense horizontal timelines with many milestones on a single track (e.g., `ai-timeline` with 12 milestones covering 2019–2024) rendered with three severe visual defects:

1. **Node superposition:** Milestone circles at nearby dates stacked on top of each other — the node at an earlier date was hidden under the later node. No indicator that multiple events existed.
2. **Label collision:** Every milestone emitted a date label above and a title label below, all at the same x-coordinate as the node. With 12 milestones in 6 years, the label bands completely overlapped into unreadable strings.
3. **Axis contamination:** Per-milestone date labels rendered directly on/over the axis line and year-tick labels, making the axis unreadable.

## Decision

Implement a complete redesign of milestone label layout for the horizontal family. No IR schema changes. No changes to the vertical-spine family.

### 1. Node Declustering (Phase 1.5 in `horizontal.ts`)

Sort milestones by `(date_ordinal, id)`. Left-to-right pass: `placedX[i] = max(trueX[i], placedX[i-1] + minNodeGap)`. Nodes are never allowed to be closer than `minNodeGap` pixels center-to-center. A thin leader tick at `trueX` (opacity=0.45) marks the true date position when a node is displaced.

### 2. Single Combined Label Block per Milestone

Replace "date above + title below at every milestone" with a **single label block** (title primary + compact date secondary) connected to the node by a leader line. This halves the number of labels visible on any given side.

### 3. Alternating Above/Below Assignment

Milestones in sorted order alternate sides: odd index → above, even index → below. This distributes labels evenly on both sides of the node row.

### 4. Per-Side Collision Tiering

Within each side, if adjacent blocks overlap horizontally (measured by block width from font metrics), the later block is pushed into a further tier (row) away from the node. Leaders extend to reach. Deterministic greedy left-to-right assignment.

### 5. Axis Zone Separation

Above-side blocks live in a dedicated `aboveZoneH` space **between** the axis line and the track rows. The `aboveZoneH` value is computed from the deepest above-side tier and injected into Phase 2 (track placement) so the entire track area shifts down. Year-tick labels remain in their standard position above the axis line — they are never displaced by milestone blocks.

### 6. Compact Date Format

Secondary date line uses "Month Year" format (e.g., "February 2019") — no day ordinal suffix. Rendered smaller and lighter than the title.

## Theme Tokens Added

All additive/optional. Added to all 5 themes (consulting, product, executive, minimal, release):

| Token | Purpose | Defaults |
|---|---|---|
| `minNodeGap` | Min px between node centers | 34–50 depending on theme |
| `leaderColor` | Leader tick + line color | theme-appropriate neutral |
| `leaderWidth` | Leader stroke width | 0.75 |
| `blockTierGap` | Vertical gap between label tiers | 5–6 |

## Files Changed

- `packages/core/src/layout/horizontal.ts` — major rewrite of Phase 1.5/4/6 + milestone rendering
- `packages/core/src/themes/types.ts` — 4 optional tokens added to `MilestoneTheme`
- `packages/core/src/themes/{consulting,product,executive,minimal,release}.ts` — token values
- `packages/core/test/render.test.ts` — 9 new tests for dense-milestone behavior
- `examples/golden/our-timeline.{svg,png}` — re-snapshotted
- `examples/gallery/**/*.{svg,png}` — all regenerated (12 + 55 + 15 files)

## Outcome

- All 306 tests pass (9 new tests added)
- ai-timeline (product theme): 12 nodes with gaps ≥ 42px, 17 leader ticks, alternating above/below blocks, compact dates, axis clean
- All renders deterministic (byte-identical across two consecutive runs, confirmed for ai-timeline, milestones-only, feature-rich)
# Barbara Phase 1 Render: Scene IR + Layout Engine + SVG/PNG Backends

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented — all quality gates green

---

## Summary

Phase 1 implementation of the deterministic rendering pipeline for the horizontal
layout family, targeting T2 acceptance ("horizontal linear, numbered nodes").  All
deliverables are shipped, tested, and integrated into the `packages/core` pnpm
monorepo.  Leslie wires the public `render()` / `compile()` stubs in Wave 2.

---

## Decisions Made

### 1. Scene IR Shape

The Scene IR (`src/scene.ts`) is a discriminated-union primitive list:

```typescript
type ScenePrimitive =
  | LinePrimitive | RectPrimitive | CirclePrimitive
  | TextPrimitive | PathPrimitive | GroupPrimitive;

interface Scene {
  width: number; height: number; background: string;
  primitives: ScenePrimitive[];
}
```

`sceneHash(scene): string` computes SHA-256 over canonical JSON (recursively
sorted object keys), giving byte-deterministic identity across platforms.

### 2. Layout Engine Architecture

`layout(ir: IRDocument, theme: ResolvedTheme): Scene` in `src/layout/index.ts`
implements the full six-phase pipeline (§5.4) for the horizontal family:

| Phase | Output |
|-------|--------|
| 1 Axis | tsOrd, teOrd, tick positions (integer-ordinal, round-half-up) |
| 2 Tracks | yTop[], height[] (provisional) |
| 3 Activities | xLeft, xRight, y, lane (greedy sub-lane) |
| 4 Milestones | xCenter, yCenter, stack_index, ordinal, dateFmt |
| 5 Sections/Annotations | stub (no T2 data) |
| 6 Label collision | bounded-N y-shift pass |

Date arithmetic lives in `src/layout/dates.ts`: day ordinals (days since
2000-01-01), left/right edge coercion, tick enumeration, label formatting.

### 3. Consulting Theme (Phase 1 Variant)

`src/themes/consulting.ts` implements the Tier-1 consulting theme with
`milestone.shape = 'circle'` (required for T2).  The diamond milestone style
(§6.3.1 canonical spec) will be split into a separate variant in Phase 2.

Key values: canvas 1200px wide; navy `#1F497D` milestone fill; DejaVu Sans
typography; no gridlines; date-above / title-below milestone labels.

`resolveTheme(id)` in `src/themes/index.ts` falls back to `consultingTheme`
for unknown ids.

### 4. Text Metrics — Deterministic Hardcoded Table

Rather than adding `opentype.js` at runtime, `src/fonts/metrics.ts` ships a
compile-time per-character advance-width table derived from DejaVu Sans (em
fractions, ASCII range + common extras).  This is byte-identical across all
platforms and Node versions.  Known limitation: exact layout-vs-resvg shaping
parity requires the §5.8 HarfBuzz follow-up.

### 5. Embedded Font — DejaVu Sans

`packages/core/src/fonts/DejaVuSans.ttf` (OFL licence, 739 KB) serves two
roles:
1. SVG `font-family` name in `<text>` elements.
2. `fontFiles[0]` for `@resvg/resvg-js` with `loadSystemFonts: false`.

The `postbuild` script in `package.json` copies `src/fonts/` → `dist/fonts/`
so the font is available in the compiled package too.  The `png.ts` module
discovers the font via `import.meta.url` with two fallback candidates.

### 6. Leslie Wiring Instructions (Wave 2)

To wire `render()` in `api.ts`:
```typescript
import { renderDocument } from './render/index.js';
export function render(ir: IRDocument, options: RenderOptions): RenderResult {
  return renderDocument(ir, options);
}
```

To wire `compile()`:
```typescript
export function compile(input: IRDocument | string, options: RenderOptions): RenderResult {
  const ir = typeof input === 'string' ? loadIR(input) : input;
  return renderDocument(ir, options);
}
```

### 7. What Is Deferred

- Vertical central-spine layout family (T1, T3, T5) — Gap Render-1
- Serpentine spine geometry (T4) — Gap Render-3
- Diamond milestone shape (consulting canonical)
- Section band shading (Phase 5 proper implementation)
- Annotation placement (Phase 5 proper implementation)
- Progress bars and TBD/approximate date visual treatments
- Additional themes (dark-executive, colorful-infographic, etc.)
- opentype.js glyph-advance integration (§5.8 HarfBuzz flag)

---

## Quality Status

| Check | Result |
|-------|--------|
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm lint` | ✓ 0 warnings |
| `pnpm test` | ✓ 110/110 (19 new render.test.ts) |
| `pnpm -r build` | ✓ all 3 packages |
# Decision Note: Layout-Quality Linter & Conformance Gate

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented & Green

---

## Problem

No automated check existed to catch layout defects (label superposition, overlapping nodes, axis overwrites, out-of-bounds primitives) when examples are regenerated. The owner specifically asked: *"do we have a quality check that can spot these issues automatically?"* — we didn't.

## Decision

Build a pure, deterministic **Layout-Quality Linter** operating on the Scene/Render IR, with a **Conformance Gate** (test) that runs over all examples after every regeneration.

---

## What Was Built

### `buildScene(ir, options?) → Scene`  (`packages/core/src/render/index.ts`)
Exposes the layout pipeline output as an inspectable Scene without going through SVG serialization. `renderDocument` now calls `buildScene` internally — single code path.

### `lintScene(scene) → QualityIssue[]`  (`packages/core/src/lint.ts`)
Five checks on axis-aligned bounding boxes derived from scene geometry:

| Check | Severity | What it catches |
|---|---|---|
| `NODE_OVERLAP` | error | Two milestone markers whose bboxes intersect beyond 2px |
| `LABEL_OVERLAP` | error | Two text blocks from *different* label groups whose bboxes intersect beyond 4px |
| `LABEL_AXIS_OVERLAP` | error | A label bbox that creeps into the horizontal axis/tick-label band |
| `OUT_OF_BOUNDS` | error | Any primitive that extends beyond `[0, 0, W, H]` beyond 1px |
| `TIGHT_SPACING` | warning | Bboxes within a 5px gap (informational near-miss) |

Label grouping uses a union-find on coincident `anchorX` + vertical adjacency (≤16px) so a milestone's own title+date lines are treated as one unit — preventing false positives on stacked labels.

V-spine layouts are detected by a tall vertical line near x = W/2 to avoid misidentifying the today-marker horizontal line as the axis.

### Conformance Gate  (`packages/core/test/quality.test.ts`)
- **130 combinations**: 13 example YAML files × 2 layouts × 5 themes.
- Asserts zero error-severity issues per combination; names file/layout/theme on failure.
- 8 deliberate-overlap unit tests confirming the linter catches true positives and avoids true negatives.

---

## Layout Bugs Caught & Fixed

The linter found **8 real layout bugs** across the existing examples:

1. **Tick labels at x=0** — first axis tick with `textAnchor='middle'` overflowed left. Fixed: clamp to `[labelHalfW, W-labelHalfW]`.
2. **Section labels near right edge** — not capped to available canvas width. Fixed: `truncateText` to remaining width.
3. **Milestone labels near right edge** — node position clamp didn't account for label half-width. Fixed: `rightLimit = max(ms.size, labelHalfW)` guard.
4. **V-spine period annotation** — label placed rightward past canvas edge. Fixed: flip to `textAnchor:'end'` growing leftward.
5. **NODE_OVERLAP from right-edge clamping** — forward pass collapsed multiple nodes to the same x. Fixed: backward pass after forward placement.
6. **Legend inside milestone-label zone** — legend y formula placed it inside content area. Fixed: pre-compute legend height before computing canvas height.
7. **Multi-track untracked milestone overlap** — below-side untracked labels overlapped activity labels in track area. Fixed: force `above` side when multi-track.
8. **V-spine today-line false positive** — full-canvas horizontal today-line misidentified as horizontal axis. Fixed: detect V-spine layout and skip H-axis detection.

---

## CLI Addition

`timeline lint <input> [--layout h|v] [--theme t]` — prints issues, exits 1 on errors.

---

## Verification

- `pnpm -r typecheck lint build test` — all green, 445 tests passed (0 failed).
- `examples/golden/our-timeline.svg` regenerated (tick label clamping shifted positions).
- The linter **would have caught** the ai-timeline defect (verified by deliberate-overlap unit test asserting NODE_OVERLAP detection).
# Decision: Refinement Pass Implemented (Barbara)
Date: 2026-06-10
Author: Barbara (Semantics & Rendering)

## Summary
Completed refinement pass on layout/rendering pipeline for both horizontal and vertical-spine layout families.

## Changes
- **text-wrap.ts**: New deterministic text-wrap/truncation helper using DejaVu Sans advance-width metrics. `wrapText()` breaks at word boundaries with max-lines limit; `truncateText()` uses binary search for exact fit with ellipsis.
- **scene.ts**: Added `MultiTextPrimitive` (kind: 'multitext') for multi-line text with `<tspan>` elements. No change to existing primitives.
- **render/svg.ts**: Added serialization for `MultiTextPrimitive` using `<tspan>` with `dy` and `x` attributes.
- **themes/types.ts**: Added `LegendTheme` and `SectionTheme` interfaces. Added `legend` and `section` to `ResolvedTheme`.
- **All 5 theme files**: Added `legend` and `section` token blocks.
- **layout/horizontal.ts**: Added section bands (vertical), legend panel, today-marker line, period/bracket spans, callout/note boxes, truncation on activity/milestone labels.
- **layout/vertical-spine.ts**: Added section bands (horizontal), legend panel, today-marker line, period/bracket spans, callout/note boxes, text-wrapping on entry titles/descriptions. Fixed year-only ticks to use `enumTicks()` + `formatTickLabel()` for axis-unit-aware proportional tick rendering.
- **test/vertical-spine.test.ts**: Extended with tests for text-wrap determinism, sections, today-marker, and legend rendering.
- **feature-rich.timeline.yaml**: New gallery example exercising all new features.
- All gallery artifacts regenerated.

## Constraints Honored
- IR schema unchanged (no edits to types.ts, validate.ts, load.ts, schema.ts)
- api.ts, index.ts not touched
- CLI unchanged
- Golden updated (expected — rendering changed)
- All tests pass; determinism verified
# Decision: Scene/Render IR as Root; Pluggable Rendering Backends

**Author:** Barbara (Semantics & Rendering)
**Date:** 2026-06-10
**Status:** Proposed — awaiting owner acceptance
**Sections affected:** §5 Rendering Model, §6 Theme Architecture, §7 Output Targets

---

## Decision Summary

SVG is demoted from the universal primary format to **one backend among equals**. A
**deterministic, backend-agnostic Scene / Render IR** is introduced as the stable root
contract produced by the six-phase layout pipeline. Three pluggable rendering backends
(SVG, Raster, PPTX native-shape) consume the Scene and emit their respective outputs.

---

## Motivation

The owner's critique: SVG as the universal root caps the system's visual ceiling. The
specific problem is architectural, not a deficiency in SVG itself:

1. SVG filters (feGaussianBlur, feDropShadow, feTurbulence) exist but are **not
   deterministic** across SVG renderers and browsers — breaking the project's
   determinism principle for filter-bearing outputs.
2. SVG filter effects do **not survive** conversion to PNG/PDF faithfully, and have no
   native equivalent in PPTX's shape model.
3. Anchoring every target to SVG constrains the most expressive targets to SVG's
   semantic ceiling.

**SVG is not the wrong format; SVG-as-the-single-root is the wrong architecture.**

---

## Architecture

### Scene / Render IR (new root)

Output of the six-phase layout pipeline. Contains:
- `canvas`: width, height, background_color
- `elements`: ordered list of typed drawing primitives (Rect, Polygon, Line, Text, Path,
  Image, Group) with resolved coordinates, colours, and `effect_refs[]`
- `effects`: registry of EffectDefinition records (Glow, DropShadow, GradientFade,
  NoiseTexture, CloudLayer, Bloom) each with a `fallback_policy`
- `meta`: theme_id, fidelity_tier, scene_hash (SHA-256, reproducible)

The Scene is byte-deterministic. It carries no backend-specific instructions.

### Layered Determinism Contract

| Layer | Guarantee |
|-------|-----------|
| Scene geometry | Always byte-deterministic (pure pipeline contract) |
| Per-backend output | Deterministic given pinned backend version + fixed effect seeds |
| Cross-backend pixel identity | Explicitly **not** promised; different backends at different fidelity tiers are all correct |

Effect seeds for procedural noise/cloud effects are derived from `scene_hash +
effect_id` — no random state consumed.

### Pluggable Backends

| Backend | Fidelity ceiling | Primary use |
|---------|-----------------|-------------|
| SVG | Tier 1 (det.); Tier 2 (caveat) | Print, web, consulting, CI |
| Raster (Skia/Canvas) | Tier 3 | Art effects; showcase/keynote |
| PPTX native-shape | Tier 2 native + Tier 3 hybrid | Editable presentations |
| HTML/interactive | Wraps SVG or raster | Preview, VS Code, MCP |

### Fidelity Tiers

| Tier | Name | Effects | Themes |
|------|------|---------|--------|
| 0 | Minimal | None | Minimal |
| 1 | Crisp | Gradients, hatch, patterns | Consulting, Release |
| 2 | Polished | Drop shadows, glow (native PPTX; SVG caveat) | Executive, Product |
| 3 | Showcase | Bloom, cloud/atmosphere, noise, gradient meshes | Showcase |

Each backend has a capability profile. Effects unsupported natively use the Scene's
`fallback_policy` (approximate, omit, embed-raster, error).

### Output Derivation (revised)

- PNG: SVG backend (Tier 0/1) or Raster backend (Tier 2/3)
- PDF: SVG→PDF (vector, Tier 0/1) or Raster→PDF (art, Tier 3)
- PPTX: native shapes + native effects (Tier 2) + embedded raster overlay (Tier 3)
- HTML: SVG-backed (Tier 0/1) or canvas-backed (Tier 2/3)

### Revised Build Priority

1. Scene IR + SVG backend (foundation; Tier 0/1 correct, inspectable)
2. PNG via SVG backend (universal paste target)
3. PDF via SVG backend (consulting/print)
4. PPTX native-shape backend (think-cell comparable editability)
5. Raster backend — Skia/Canvas (art-effect differentiator; optional plugin)
6. HTML/interactive

---

## New Cite Keys Needed (for David / references.bib)

The following `\cite{}` keys are used in §7 and require entries in `references.bib`:

| Key | Description |
|-----|-------------|
| `skia` | Skia Graphics Library — Google; used in Chrome, Flutter, Android |
| `webgl` | HTML Canvas / WebGL API — W3C specification or MDN reference |
| `golden-image-testing` | Golden-image / snapshot testing methodology (e.g., Percy, Playwright visual testing) |
| `ooxml` | Office Open XML (ISO/IEC 29500) — PPTX native shape effects specification |

---

## IR Concerns for Leslie / Mark

**No IR changes are required or proposed.** This architecture operates entirely below
the semantic IR boundary: the Scene is produced by the rendering pipeline, not defined
by the IR. The IR contract (§4) is unaffected.

However, one clarification worth noting to Mark: the `fidelity_tier` is a **theme
property** (declared in the theme schema's `fidelity.tier` field), not an IR field.
Authors do not specify rendering fidelity in the IR document; they select a theme.
This preserves the IR's content-only semantic model.

---

## Files Modified

- `design/sections/07-output-targets.tex` — full rewrite: Scene IR as root; SVG/Raster/PPTX backends with capability tables; determinism restated per layer; revised output priority
- `design/sections/05-rendering.tex` — determinism contract updated (item 3 + new item 7); coordinate system updated; new §5.7 Scene/Render IR Pipeline Output subsection
- `design/sections/06-themes.tex` — fidelity tier schema block added; effect knobs added; six themes (five existing + Showcase); fidelity tier subsection with backend degradation examples; theme-engine contract extended
# Decision Record: Phase 1 Render Bug Fixes

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented & verified green

---

## Context

Three rendering issues were surfaced by examining the gallery SVG outputs. All three were
present in the Phase 1 implementation (Wave 3) but went unnoticed because the T2 acceptance
fixture uses only milestones (no activities) and a single whitespace-only track label.

---

## Decisions

### Decision 1 — Track Header Width / Label Visibility

**Problem:** `consulting.ts` set `headerWidth: 0`. The layout guard
`if (Hhdr > 0 && tl.track.label)` therefore never drew track labels. Multi-track gallery
examples showed no swimlane titles at all.

**Decision:** Set `headerWidth: 140` in the Consulting theme. In `layout/index.ts`, compute
the *effective* header width dynamically:

```typescript
const hasTrackLabels = sortedTracks.some(t => !!t.label && t.label.trim().length > 0);
const Hhdr = hasTrackLabels ? tk.headerWidth : 0;
```

This preserves T2 / milestones-only appearance (single track, whitespace label → Hhdr = 0)
while enabling the 140 px gutter for multi-track examples with real labels. Track labels are
left-aligned (`textAnchor: 'start'`, `x = mL + 8`) per §6 schema spec (`header_align: right`
is default but task spec requires left-aligned — left chosen for readability in 140 px gutter).

**Rationale:** Suppressing an empty gutter is a clean UX default. The 140 px value matches
the §6 schema default of `header_width: 160` approximately, tuned to fit typical consulting
track names.

---

### Decision 2 — Progress Fill Indicator

**Problem:** `activity.progress` values were parsed and stored but the layout engine never
emitted a visual fill. All bars rendered as solid regardless of progress.

**Decision:** Add three new fields to `ActivityTheme` and set them in the Consulting theme:

```typescript
progressBarHeight:   4       // px strip at bar bottom
progressFillColor:  '#FFFFFF' // white overlay on dark navy bars
progressFillOpacity: 0.45    // semi-transparent
```

In the layout engine, after the bar rect, emit a fill rect:
- `width = Math.floor(barWidth × progress + 0.5)` (round-half-up per §5.1 item 3)
- `height = progressBarHeight`, at `y = barBottom - progressBarHeight`
- `fill = progressFillColor`, `opacity = progressFillOpacity`

**Rationale:** §5 §6 spec: "filled strip at the bottom of the bar." White at 0.45 opacity
creates a clearly visible light stripe on dark navy/amber/red bars without obscuring the
activity label. Fully deterministic (round-half-up, no random state).

---

### Decision 3 — Open-Ended / TBD Activity Styling

**Problem A (span bug):** Span activities (`span: 2026-Q1`) had `a.end === undefined`. The
condition `if (!a.end || a.end === 'ongoing')` fires before the `else if (a.span)` branch,
so spans were treated as ongoing and extended to the right edge incorrectly. Q1/Q2/Q3 spans
had wrong widths in all gallery renders.

**Problem B (open-end stub):** `end: tbd/unknown` produced a 16 px stub (the old `minWidth × 4`).
No visual indicator existed for open/ongoing bars.

**Decision:** Reorder the xRight condition chain (span first) and add `endKind` to
`ActivityLayout`:

```
a.span       → xRight from span end, endKind = 'fixed'
!a.end / ongoing → xRight = plot right edge, endKind = 'ongoing'
tbd / unknown   → xRight = plot right edge, endKind = 'tbd'
else            → xRight from a.end, endKind = 'fixed'
```

After drawing the label, emit:
- `ongoing`: solid right-pointing triangle `<path>` at the bar's right edge, 10 px wide into
  the right margin. Fill = bar status colour.
- `tbd`: dashed `<line>` at the bar's right edge (`stroke-dasharray="3,3"`, opacity=0.5).

**Rationale:** §5 open-interval rulings: "bar to right canvas boundary + right-chevron" for
ongoing/omitted. Making TBD also extend to the right edge (instead of a short stub) follows
the task spec which reads both as "extending to the RIGHT EDGE of the plot." A different
indicator (dashed vs. solid arrowhead) visually differentiates `ongoing` (certain open) from
`tbd` (uncertain open).

---

## Artifacts Changed

| File | Change |
|------|--------|
| `packages/core/src/themes/types.ts` | Added 3 progress fields to `ActivityTheme` |
| `packages/core/src/themes/consulting.ts` | `headerWidth: 140`; progress field values |
| `packages/core/src/layout/index.ts` | All three fixes; `endKind`; fixed span condition order |
| `packages/core/test/render.test.ts` | 3 new fixtures + 4 new tests |
| `examples/golden/our-timeline.{svg,png}` | Regenerated (output unchanged) |
| `examples/gallery/*.{svg,png}` | All 8 regenerated with fixes applied |
# Decision: Skia Raster Backend + Art Effects (Phase 4 Milestone 1)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented

---

## Context

Phase 4 adds a high-fidelity raster backend via `canvaskit-wasm` delivering art effects (glow, drop shadow, background gradient, procedural cloud/noise texture) and a Showcase Tier-3 theme. The SVG backend remains the deterministic default.

## Decisions

### 1. Additive Effect Model on Scene IR

**Decision:** Extend `scene.ts` with `SceneEffect[]` on every primitive and `SceneBackground` on the Scene. Declarative, backend-agnostic.

**Rationale:** Effects are opt-in metadata. Backends that can't render an effect silently omit it. SVG output is byte-identical whether or not effects are present (the SVG renderer ignores the `effects` field). `canonicalJSON` skips `undefined` → adding effects doesn't perturb sceneHash for non-Showcase themes.

### 2. Async vs Sync renderDocument

**Decision:** Keep `renderDocument()` synchronous (backward compatible). Add `renderDocumentAsync()` for the Skia path.

**Rationale:** CanvasKit init is async (Promise-based WASM load). Making `renderDocument` async would break all existing callers. `renderDocumentAsync` is a parallel export; the CLI branches on `backend === 'skia'`.

### 3. SkSL Cloud Shader

**Decision:** Two-octave value-noise SkSL shader with fixed-seed hash function. No `iTime`/random.

**Rationale:** Determinism is required. Fixed-seed noise produces consistent texture across renders without any runtime entropy. If `RuntimeEffect.Make` fails (platform limitation), fallback to linear gradient.

### 4. Path Transform via canvas.save/translate/scale

**Decision:** `skPath.transform(matrix)` does NOT exist in canvaskit-wasm@0.41.1. Use `canvas.save(); canvas.translate(tx,ty); canvas.scale(s,s); canvas.drawPath(); canvas.restore()` instead.

**Rationale:** Canvas stack transforms are the reliable cross-version API. This was discovered during implementation — the WASM binding doesn't expose `Path.transform`.

### 5. Showcase Glow via ImageFilter Blur (pre-draw pattern)

**Decision:** Glow/shadow effects are rendered as blurred/offset pre-draws underneath the main shape (not post-processing filters on the output).

**Rationale:** CanvasKit's `ImageFilter.MakeBlur` applied to a `Paint` affects the stroke/fill of that paint's draw call. We render a blurred tinted copy before the main shape. This is deterministic and avoids GPU-compositing complications.

### 6. Golden: Byte-Identity with ±5% Fallback

**Decision:** Assert byte-identical re-renders of the Skia golden; fall back to ±5% size tolerance if platform nondeterminism arises.

**Rationale:** Skia WASM is deterministic per pinned version on a given platform. However cross-platform byte identity is not guaranteed. The golden test documents this with a clear fallback path.

## Files Changed

- `packages/core/src/scene.ts` — SceneEffect, SceneBackground, effects? on all primitives
- `packages/core/src/render/skia.ts` — NEW: full Skia backend
- `packages/core/src/render/index.ts` — renderDocumentAsync + backend branch
- `packages/core/src/themes/showcase.ts` — NEW: Tier-3 dark theme
- `packages/core/src/themes/types.ts` — EffectTokens, sceneBackground?, effects? on ResolvedTheme
- `packages/core/src/themes/index.ts` — showcase registered
- `packages/core/src/types.ts` — RenderOptions.backend?: 'svg'|'skia'
- `packages/core/src/layout/horizontal.ts` — gated effect attachment
- `packages/core/src/layout/vertical-spine.ts` — gated effect attachment
- `packages/cli/src/index.ts` — --backend flag, async action
- `packages/core/test/skia.test.ts` — NEW: 16 Skia tests
- `examples/golden/showcase-skia.png` — NEW: Skia golden
- `examples/gallery/showcase/` — NEW: 4 showcase PNGs
- `examples/gallery/showcase.html` — NEW: contact sheet
- `examples/gallery/index.html` — link to showcase.html
# Decision: Target Output Coverage Analysis -- Layout Families, Gaps, and Additions

**Author:** Barbara (Semantics & Rendering specialist)
**Date:** 2026-06-10
**Scope:** §5 Rendering Model, §6 Themes, §7 Output Targets
**Related section:** design/sections/14-target-outputs.tex

---

## Context

The project owner provided five reference images of end-results the Timeline Compiler
must be able to produce. This decision record documents the findings from validating
the current design against those targets, the gaps identified, and the recommended
additions.

---

## Layout-Family Finding

The current §5 rendering pipeline implements a single layout family:
**horizontal swimlane Gantt** (orientation: horizontal, spine: straight, entry: track bands).

The five targets expose three additional families:

### Family 1: Vertical Central-Spine with Alternating Entries (T1, T3, T5)
The time axis runs top-to-bottom along a vertical spine. Year/date nodes sit on the
spine. Text entries (headings + body text or rounded cards) alternate left and right.
Icon badges may anchor at canvas edges with dashed leader lines.

**Verdict:** Not in the current §5 pipeline. This is the highest-priority layout gap,
covering three of the five target outputs.

### Family 2: Horizontal Single-Line with Numbered Nodes (T2)
A single horizontal line (no track bands); milestones rendered as large numbered circles;
date displayed above each node, title below. This is an edge case of the current pipeline
achievable by suppressing the track header and axis band, plus adding a
`numbered-circle` milestone shape variant.

**Verdict:** Partially supported. Needs a `numbered-circle` shape in Phase 4 and a
`numbered-single-line` entry-placement mode in the theme layout_family block.

### Family 3: Serpentine Winding Path (T4)
The spine is a parametric Bezier S-curve; date maps to arc-length position.
Phase 1's date-to-x formula is replaced by a curve parametrisation. Cannot share
Phase 1-6 geometry with the straight-axis pipeline.

**Verdict:** Fundamentally novel. Recommended for post-MVP release.

### Layout-Family Is a Render/Theme Concern -- IR Stays Layout-Agnostic

The Timeline IR (§4) makes no assumptions about axis orientation or spine geometry.
All field semantics are temporal and relational, not spatial. The same IR document is
valid for any layout family.

**Recommendation:** Add `layout_family: { orientation, spine_geometry, entry_placement }`
to the **theme schema** (§6). The layout engine dispatches based on this property.
No IR changes required or made.

---

## Coverage Table Verdict

| Target | IR-Expressible? | Layout Supported? | Theme Available? | Tier |
|--------|----------------|-------------------|------------------|------|
| T1 Vertical spine, dark | Partial | No | No | Tier 2 |
| T2 Horizontal numbered | Yes | Partial | Partial | Tier 1 |
| T3 Dense AI infographic | Yes | No | No | Tier 1 |
| T4 Serpentine glow | Partial | No | Partial | Tier 3 |
| T5 Gitline cards, dark | Yes | No | Partial | Tier 3 |

**Note:** "Partial" IR-expressible for T1 and T4 refers to the per-entity color gap
(Gap IR-2) and the missing milestone metadata field (Gap IR-1), not to core data content.
All timeline data in all five targets is representable with current IR fields.

---

## IR Gaps Flagged for Mark

### Gap IR-1: Milestones lack `metadata: map<string,any>`
Activities have an open extension map (`metadata: map<string,any>`); milestones do not.
Milestones are the primary semantic entities in infographic layouts (T1, T3) where year
nodes carry structured render hints. The `tags: list<string>` workaround is insufficient
for structured key-value data.

**Recommendation for Mark:** Add `metadata: map<string,any>` to the Milestone schema,
parallel to the existing Activity field.

### Gap IR-2: Activities and Milestones lack `color: string?`
Neither activities nor milestones have a direct colour hint field (tracks do, per §4).
Per-entity colour today requires defining a `category` string and a matching entry in
`theme.category_map`. For dense infographic layouts (T3: 12 distinct accent colours),
this requires 12 theme category definitions for a purely visual concern.

**Recommendation for Mark:** Add `color: string?` to Activity and Milestone as a direct
colour override hint, applied after `category_map` and before `status_map` in the
theme resolution order.

### Confirmed NOT IR Gaps (documented for clarity)
- Multiple subjects under one year node (T1/2023): fully representable via `groups[].members`
- CTA link label (T5 "VIEW REPOSITORY"): theme-level default from `activity.url`; custom label via `activity.metadata.cta_label`
- Icon badge position (T1): the vertical-spine layout auto-generates badge + leader line from `milestone.icon`
- Alternate "YEARLY CHART" view (T5): a separate render pass on the same IR; no schema change

---

## Render/Layout Additions (Barbara owns)

### Render-1: Vertical Central-Spine Layout Module (Priority 1)
Covers T1, T3, T5. New `layout_family: { orientation: vertical, entry_placement: alternating | card }` in theme schema. Phase 1 maps dates to the y-axis; Phases 2-4 compute entry positions left/right of the spine. Phase structure preserved; phases parameterised, not replaced.

### Render-2: Numbered Circular Node Shape for Milestones (Priority 2)
Covers T2. New milestone shape variant `shape: numbered-circle` in theme milestone block. Renderer assigns ordinal numbers by milestone sort order; no IR field needed.

### Render-3: Serpentine Spine Geometry (Priority 3 / Post-MVP)
Covers T4. Replaces Phase 1's straight-axis date-to-coordinate function with a parametric Bezier S-curve. The date-to-arc-length mapping must be monotone and deterministic.

### Render-4: Card-Entry Rendering for Vertical-Spine (Priority 2)
Covers T5. Within the vertical-spine layout, entries rendered as rounded-rect cards (title, date+clock-icon, description, CTA-button from `activity.url`). Card shape is theme-defined.

### Render-5: Dashed-Leader Annotation Connector Style (Priority 2)
Covers T1 icon badges. Extend `theme.annotation.connector_style` vocabulary with `dashed-leader-arrow`. Annotation `type: connector` already in IR; only the visual style is missing.

### Render-6: Yearly Chart Alternate View (Out of scope / Future)
Covers T5 YEARLY CHART tab. A separate histogram render pass on the same IR. Not in scope for the timeline rendering mandate.

---

## Theme Additions (Barbara owns)

### Theme-1: `dark-executive` (Priority 1, Tier 2)
Deep charcoal-navy background, coloured spine segments per category, drop-shadow icon
badges. Extends Showcase; overrides `canvas.background_color`, `layout_family.orientation: vertical`,
`fidelity.tier: 2`. Covers T1 and T5 dark variants.

### Theme-2: `light-minimal-corporate` (Priority 2, Tier 1)
White background, generous whitespace, numbered circular milestone nodes, no gridlines.
Extends Consulting; overrides `milestone.shape: numbered-circle`,
`layout_family.entry_placement: numbered-single-line`. Covers T2.

### Theme-3: `colorful-infographic` (Priority 2, Tier 1)
Light background, multi-accent category_map (12 pre-defined colour entries), dense
vertical pitch, bold oversized title. New standalone theme. Covers T3.

### Theme-4: `showcase-dark` child theme (Priority 1, Tier 3)
Extends `showcase`; overrides background to deep navy (#0D1117), activates `noise_texture`
effect (swirl/radial texture), sets `layout_family.orientation: vertical`,
`entry_placement: card`. Covers T5 Gitline aesthetic. Raster backend for texture; HTML
backend for interactive CTA links.

---

## Effect Registry Validation

All required effects are already in the Scene effect registry and Showcase theme:

| Effect | Target | Scene primitive | Status |
|--------|--------|----------------|--------|
| Glow / Bloom | T4 serpentine path | `Bloom{radius_px, threshold, intensity}` | Registered, Showcase activates |
| Background noise texture | T5 Gitline swirl | `NoiseTexture{seed, scale, turbulence_type}` | Registered, Showcase activates |
| Drop shadow | T1 icon badges, T5 cards | `DropShadow{offset_x, offset_y, blur_radius}` | Registered, Showcase + Executive |
| Dashed leader stroke | T1 leader lines | `Line{stroke_style}` extension | Render-5 (connector_style vocab) |

**No new Scene effect types are required.** The effect infrastructure is sufficient.

---

## New Cite Keys Needed

None. All citations required by §14 reference entities already cited in §5, §6, §7
(Scene IR, Showcase theme, Raster backend, fidelity tiers).

---

## Summary

The Timeline IR can represent the data content of all five targets today, with two minor
gaps (IR-1, IR-2) flagged for Mark. The architecture is sound. The gap is in layout
family coverage and theme inventory. Adding the vertical-spine layout module (Render-1)
and two dark themes (Theme-1, Theme-4) unlocks three of the five targets immediately.
The serpentine layout (Render-3) is the only architecturally novel addition, recommended
for post-MVP.
# Decision: Four New Themes + Theme Showcase (Barbara)

**Date:** 2026-06-10  
**Agent:** Barbara (Semantics & Rendering)  
**Status:** Implemented & green

## Decision

Implemented four new built-in themes (executive, minimal, product, release) plus a theme-comparison contact sheet (`examples/gallery/themes.html`).

## Themes

| ID | Title | Tier | Visual Identity |
|----|-------|------|----------------|
| `executive` | Executive | 2 | Dark navy canvas (`#0D1B2A`), light text, rounded bars (r=8), full semantic palette |
| `minimal` | Minimal | 1 | White canvas, all-greyscale fills (R=G=B), status by opacity/weight, no ordinal numbers |
| `product` | Product | 2 | Dense rows, 10+ category colour overrides, prominent progress fills, vivid palette |
| `release` | Release | 1 | Traffic-light status (done=green/blocked=red), triangle ▼ milestone flags, gridlines |

## Type Extensions (additive)

- `TypographyTheme.titleColor` — document title fill colour
- `AxisTheme.axisLineColor` — axis baseline + tick mark stroke
- `AxisTheme.tickLabelColor` — tick label text fill
- `MilestoneShape`: added `'triangle'`

All consulting.ts values set to match existing hardcoded defaults → **Consulting golden output unchanged**.

## Milestone Shape Rendering

`layout/index.ts` now renders milestone shapes via `ms.shape` token:
- `circle` → `<circle>` (unchanged)
- `triangle` → downward-pointing `<path>` (▼ flag style for release)
- `diamond` → diamond `<path>` (ready for future use)

## Theme Registry & API

`themes/index.ts` exports `listThemeInfos()` for all 6 entries (consulting, default, minimal, release, executive, product).  
`api.ts` `listThemes()` delegates to `listThemeInfos()` — signature unchanged, all 6 themes now visible to `timeline schema` and consumers.

## Showcase

`examples/gallery/themes.html` — HTML matrix: 3 example rows × 5 theme columns, 30 PNG cells, self-contained with relative paths. Linked from `index.html`.

## Status

✅ typecheck · lint · 191/191 tests · build all green
# Barbara — TIGHT_SPACING Root-Cause & Fix

**Date:** 2026-06-11  
**Author:** Barbara (Semantics & Rendering)  
**Fixture:** `examples/gallery/transformation-plan.timeline.yaml`  
**Layout:** vertical-spine  
**Status:** FIXED — 461/461 tests passing

---

## Finding

The TIGHT_SPACING warnings on `transformation-plan` (vertical-spine, all themes) were a **genuine low-severity layout geometry bug** — not linter over-sensitivity.

### What TIGHT_SPACING checks

`lintScene` expands each label's bbox by `TIGHT_GAP=5 px` on all four sides and checks if the expanded box overlaps any other label from a different block-group. Two text primitives belong to the same group only when their anchor-x values match within 1 px AND they are vertically adjacent (≤ 16 px gap). The check is purely axis-aligned.

### Specific pairs that were firing (consulting theme, confirmed by instrumentation)

| Pair | A label | B label | gapX | gapY |
|------|---------|---------|------|------|
| 1 | "Q1 2026" tick (x=614–660) | "1st January 2026" date (x=658–761) | 0 px (2 px overlap) | 0 px |
| 2 | "Q1 2026" tick | "Cloud Migration" title (x=658–771) | 0 px | 4.4 px |
| 3 | "Q1 2027" tick (x=614–660) | "1st July 2026" date (x=658–738) | 0 px (2 px overlap) | 0 px |
| 4 | "Q1 2027" tick | "Lean Rollout" title (x=658–749) | 0 px | 3.4 px |

### Root cause

Axis tick labels are placed at `TICK_LABEL_X = SPINE_X + TICK_W + 6 = 614` (textAnchor='start'). Year-qualified quarter ticks ("Q1 20XX") are ~46 px wide, reaching to x ≈ 660.

Right-side content block labels (even-indexed entries) were placed at `textX = SPINE_X + CONNECTOR_LEN + BLOCK_INNER_PAD = 600 + 48 + 10 = 658`.

The 2 px horizontal overlap (660 vs 658) meant the TIGHT_SPACING expanded-box check fired whenever a right-side entry fell near a "Q1 20XX" tick in y.

Plain quarter ticks ("Q2", "Q3", "Q4") are only ~18 px wide, ending at x≈632 — well clear of x=658. Only year-qualified ticks ("Q1 20XX") were wide enough to reach the content zone.

---

## Fix

**File:** `packages/core/src/layout/vertical-spine.ts`  
**Change:** `CONNECTOR_LEN` 48 → 58 px

This pushes right-side content block labels to `textX = 600 + 58 + 10 = 668`. The gap from tick right edge (660) to content label left edge (668) is now 8 px. After expanding by 5 px, the tick label right edge reaches only 665, which is < 668 → TIGHT_SPACING no longer fires.

`BLOCK_W` is unchanged (still 330 px) because `min(330, 600−58−40) = min(330, 502) = 330`.  
Left-side content block left edge: `600 − 58 − 330 = 212 > 0` (no out-of-bounds).

---

## Test results

- **461/461 tests pass** (same as before fix).
- **No golden PNG changes**: all golden tests use `our-timeline.timeline.yaml` with horizontal layout. Vertical-spine layout has no committed pixel-golden files.
- **Transformation-plan TIGHT_SPACING warnings: zero** across all 5 themes × vertical-spine.
- **Other TIGHT_SPACING warnings** (product-roadmap, release-timeline, horizontal layout) are pre-existing and unrelated to this fix.

---

## Invariants respected

- Determinism contract: `CONNECTOR_LEN` is a pure constant; two renders with same IR remain byte-identical. ✓
- Round-half-up throughout: no floating-point rounding changes. ✓
- Sort order unchanged. ✓
- Min-spacing pass unchanged. ✓
# Decision: Vertical-Spine Layout Family

**Author:** Barbara (Semantics & Rendering)
**Date:** 2026-06-10
**Status:** Implemented — Phase 1 Extension

## Summary

Adds the VERTICAL CENTRAL-SPINE layout family to Timeline Compiler, covering targets T1 (vertical spine alternating milestones), T3 (dense alternating year blurbs), and T5 (alternating cards with title/date/description).

## Key Design Decisions

### 1. `dateY` analogue to `dateX`

`dateY(ord)` maps a day ordinal to canvas y-coordinate using the same round-half-up integer arithmetic as the horizontal `dateX`. Time axis is top→bottom. `hDraw` is calibrated from `pixelsPerDay × spanDays` with a floor of `nEntries × ENTRY_MIN_SPACING` to prevent visual crowding.

### 2. Alternating sides (deterministic by sorted order)

Entries sorted by `(date_ordinal, id)` — even index → RIGHT, odd index → LEFT. This is fully deterministic and produces the classic alternating T1 appearance.

### 3. `entryStyle` token

An additive `entryStyle?: 'card' | 'plain'` token in `ResolvedTheme` drives whether entry blocks get a rounded-rect card background (product/executive) or are plain text (consulting/minimal/release). The token is not consulted by the horizontal layout path — no horizontal output is affected.

### 4. Layout dispatcher — horizontal path unchanged

`layout/horizontal.ts` is a byte-identical copy of the original `layout/index.ts` with the export renamed to `layoutHorizontal`. The new `layout/index.ts` is a thin dispatcher. `RenderOptions.layout` defaults to `'horizontal'`, preserving all existing behaviour. Golden test confirmed unchanged.

### 5. Activity durations on spine

Activities with `endKind === 'fixed'` render a 6px rect along the spine from start→end ordinal. Ongoing: dashed line to spine bottom. TBD: lighter dashed line. This provides temporal context within the vertical design.

## What's Deferred

- **Pictographic icon badges** — full T1 spec; 2-char text glyph placeholder emitted now.
- **Serpentine spine** — T5 arcing-spine variant.
- **`preferredLayout` theme token** — not needed; `RenderOptions.layout` + `--layout` flag cover selection.

## Files Changed

- `packages/core/src/types.ts` — `RenderOptions.layout` (additive)
- `packages/core/src/themes/types.ts` — `ResolvedTheme.entryStyle` (additive)
- `packages/core/src/themes/*.ts` — all 5 themes: `entryStyle` token added
- `packages/core/src/layout/horizontal.ts` — new (split from index.ts)
- `packages/core/src/layout/vertical-spine.ts` — new
- `packages/core/src/layout/index.ts` — replaced with dispatcher
- `packages/core/src/render/index.ts` — passes `options.layout`
- `packages/cli/src/index.ts` — `--layout` flag
- `packages/core/test/vertical-spine.test.ts` — 27 new tests (all pass)
- `examples/gallery/ai-timeline.timeline.yaml` — new IR
- `examples/gallery/journey.timeline.yaml` — new IR
- `examples/gallery/vertical/` — 8 SVG + 8 PNG renders
- `examples/gallery/vertical.html` — contact sheet
- `examples/gallery/index.html` — linked to vertical.html
# Decision: IR Build-vs-Adopt Survey
**Author:** David (Research Lead)
**Date:** 2026-06-10
**Scope:** design/sections/04-ir.tex — new subsection "Build vs. Adopt: A Survey of Existing Representations"

---

## Recommendation: BUILD (with borrowed vocabulary)

**No existing format can be adopted wholesale or profiled into an adequate Timeline IR.**

Two orthogonal gaps eliminate every candidate:

1. **Semantic gap.** All formats with real communities (Mermaid, iCalendar, Vega-Lite) are scheduling-oriented, statistical-graphics-oriented, or calendar-oriented. None provides swimlanes + visual-status + coarse-grain dates + PPTX output in a unified, render-agnostic IR.

2. **Pipeline gap.** The requirement of a static, multi-backend render pipeline (SVG / PDF / PPTX) with a separate theme engine has no counterpart in any existing open-source tool. Every extant tool bakes rendering into the format (Mermaid, Markwhen, vis-timeline) or delegates to a JavaScript-only runtime (Vega-Lite).

---

## Candidates Evaluated

| Candidate | Outcome | Key reason |
|---|---|---|
| Markwhen (MIT) | REJECT adopt | No theme separation, no stable schema, no PPTX |
| Mermaid timeline (MIT) | REJECT adopt | No swimlanes, no status, no PPTX |
| Mermaid Gantt (MIT) | REJECT | Scheduling semantics, out of scope |
| PlantUML Gantt | REJECT | Scheduling, verbose, not LLM-friendly |
| Vega-Lite (BSD-3) | REJECT adopt — strong analogy | Not a roadmap grammar; no swimlane/status/PPTX |
| iCalendar RFC 5545 (IETF) | REJECT adopt — strong vocabulary donor | Wire format hostile to git/YAML; no swimlane/visual-status |
| schema.org/Event | REJECT adopt — vocabulary donor | Semantic markup standard, not a visual IR |
| W3C OWL-Time | REJECT adopt — semantic donor | OWL/Turtle ontology, no visual pipeline |
| Allen's Algebra | REJECT adopt — formal foundation | Not a format; formal grounding for temporal semantics |
| TaskJuggler (GPLv2) | REJECT (out of scope) | Full scheduling grammar |
| MS Project XML | REJECT (out of scope) | Scheduling; non-deterministic |
| vis-timeline (MIT) | REJECT | No declarative text format, no static export |
| Knight Lab TimelineJS (GPL) | REJECT | No swimlanes, no status, storytelling-only |
| react-chrono (MIT) | REJECT | No swimlanes, no temporal granularity |
| Timeline Storyteller (MIT) | REJECT | No swimlanes, unmaintained |
| Observable Plot (ISC) | REJECT | No roadmap type; imperative programming |
| Pandoc AST (MIT) | Structural analogy | `version`+`meta`+typed-entity-lists pattern |
| D2, Structurizr | Not relevant | No timeline type |

---

## Vocabulary Donors (explicitly borrowed into existing IR)

| Standard | What it donates |
|---|---|
| ISO 8601 | Date string syntax — already used, no change |
| iCalendar RFC 5545 | `start`/`end`/`label`/`description`/`category`/`tags`/`url`; `tentative`/`cancelled` in Status enum |
| schema.org/Event | Corroborates `start`/`end`/`label`/`description`/`url` as canonical web vocabulary |
| W3C OWL-Time | Open/ongoing interval semantics (`end: ongoing` = omit `hasEnd`); Instant/Interval duality (Milestone vs Activity) |
| Allen's Interval Algebra | Formal grounding for `tbd`/`ongoing`/`unknown` date semantics |
| Vega-Lite | Architectural WHAT/HOW separation as design precedent |
| Pandoc AST | `version` + `metadata` + typed entity lists structural pattern |
| Markwhen / Mermaid | Surface-syntax precedents for future authoring language design |

---

## New Cite Keys Added to references.bib

| Key | Source |
|---|---|
| `markwhen` | github.com/mark-when/markwhen (MIT) |
| `allen1983` | Allen, CACM 1983, doi:10.1145/182.358434 |
| `owltime` | W3C Recommendation 2022, w3.org/TR/owl-time/ |
| `ical-rfc5545` | IETF RFC 5545, datatracker.ietf.org/doc/html/rfc5545 |
| `schemaorg-event` | schema.org/Event |
| `taskjuggler` | taskjuggler.org (GPL v2) |
| `observable-plot` | github.com/observablehq/plot (ISC) |
| `react-chrono` | github.com/prabhuignoto/react-chrono (MIT) |
| `timeline-storyteller` | github.com/Microsoft/timelinestoryteller (MIT) |

All existing keys reused without duplication:
`mermaid2023`, `mermaiddocs2024`, `mermaidgantt2024`, `plantumlgantt`, `d2lang`, `structurizr`, `vegalite2017`, `grammarofgraphics2005`, `layeredgrammar2010`, `vistimeline`, `timelinejs`, `msprojectxml`, `iso8601`, `pandoc`, `dragonbook2006`.

---

## IR Alignment Flags for Mark and Leslie

**No schema changes are recommended.** The survey confirms that Mark's field choices are well-aligned with prior art. Specific findings:

1. **Field names are standards-corroborated:** `start`/`end`/`label`/`description`/`category`/`tags`/`url` all have direct iCalendar RFC 5545 and schema.org/Event equivalents. No renames needed.

2. **Status enum is well-designed:** `tentative` and `cancelled` are verbatim iCalendar values. `at-risk` and `blocked` are original contributions with no standard analog — they are justified by the executive visual-communication use case. No changes needed.

3. **`Activity` vs `Milestone` duality is formally correct:** this directly mirrors the OWL-Time `Interval`/`Instant` distinction, and the standard pattern in iCalendar (VEVENT with duration > 0 vs. zero-duration).

4. **`end: ongoing` is semantically richer than omission:** OWL-Time uses omission of `hasEnd` for open intervals; our explicit `end: ongoing` encoding is clearer for LLM generation and human authoring. No change recommended.

5. **Original contributions are justified:** `span` (shorthand), `progress` (visual fraction), `track` (swimlane lane) have no adequate standard equivalent. These are correct original designs.

### Optional flag for future surface-language design (not an IR change):
- Consider `type: event` as a surface-syntax alias for `milestone` — schema.org uses `Event` and OWL-Time uses `Instant` for point-in-time items. This would be a surface-language concern only, not an IR schema change.

---

## Files Modified

- `design/sections/04-ir.tex` — new subsection appended at end
- `design/references.bib` — 9 new BibTeX entries added
- `.squad/agents/david/history.md` — Learnings updated
- `.squad/decisions/inbox/david-ir-build-vs-adopt.md` — this file
# Decision: Output/Render Layer Build-vs-Adopt Survey

**Author:** David (Research Lead)
**Date:** 2026-06-10
**Scope:** design/sections/07-output-targets.tex — new §7.9 subsection
  "Build vs. Adopt: Scene Representation and Rendering Toolchain"

---

## Framing

Output wire formats (SVG, PDF/ISO 32000-2:2017, PNG/ISO 15948:2003,
PPTX/ECMA-376, HTML5) are **adopted open standards**. The build-vs-adopt
question is scoped to:
- **Layer A** — the Scene / Render IR (the "what-to-draw" representation)
- **Layer B** — the rendering toolchain (engines and libraries per backend)

---

## Layer A: Scene / Render IR

### Recommendation: BUILD-but-BORROW

**No existing scene IR is adoptable wholesale.** Three orthogonal gaps:

1. **Effect registry with per-effect fallback policies** — no surveyed format
   carries typed effect definitions (Glow, Bloom, CloudLayer, NoiseTexture)
   with explicit `approximate`/`omit`/`embed-raster`/`error` fallback policies.

2. **Entity-type awareness for PPTX native shapes** — PPTX backend requires
   semantic distinction between activity bars and rectangles to emit
   `ROUNDED_RECTANGLE` vs `DIAMOND` shapes; no generic scene IR retains this.

3. **Fidelity-tier annotation and scene hash** — `fidelity_tier` + `scene_hash`
   (SHA-256) required in Scene root; none of the surveyed formats carry these.

### Patterns explicitly borrowed

| Pattern | Source | What is borrowed |
|---------|--------|-----------------|
| Typed-mark / display-list | Vega scenegraph (MIT), usvg (Apache-2/MIT), Skia SKP | Ordered typed primitives, canvas descriptor, group nesting |
| Multi-backend dispatch from one scene | Matplotlib Figure/Artist (BSD-3) | Same scene tree dispatched to swappable renderer objects |

### Candidates surveyed

| Candidate | Verdict | Key reason |
|-----------|---------|------------|
| Vega scenegraph (MIT) | BORROW pattern | No effect registry; no PPTX path; pattern is exactly right |
| usvg micro-SVG (Apache-2/MIT) | BORROW pattern | No effect registry; proves normalised-tree approach |
| Lottie JSON (MIT) | Not adoptable | Animation-frame model; no static display list |
| Skia SkPicture/SKP (BSL-1) | Not adoptable as IR | Binary, version-private; strong Layer B candidate |
| SVG as scene IR | Not adoptable | Filter non-determinism; no fallback registry; no PPTX path |
| Matplotlib Figure/Artist (BSD-3) | BORROW pattern | Multi-backend dispatch proof of concept |
| HTML Canvas API | Not adoptable | Imperative; not portably serialisable |
| Pixar USD (Apache-2) | Not adoptable | 3D-centric; heavyweight; no 2D primitives |
| glTF | Excluded | 3D-only; no 2D primitives |

---

## Layer B: Rendering Toolchain

### Recommendation: ADOPT / BUILD-ON per backend

Timeline Compiler does **not** write rasterisers, PDF generators, or PPTX
serialisers from scratch.

### Per-backend toolchain

| Backend | Library | Licence | Determinism | Notes |
|---------|---------|---------|-------------|-------|
| SVG serialiser (writer) | Build directly (XML) | — | Byte-deterministic | No library needed |
| SVG→PNG rasterisation | **resvg** (Rust) | Apache-2/MIT | Full — platform-independent | Strongest guarantee |
| Raster / art effects | **Skia** (C++) | BSL-1 | Pinned version + fixed seeds | Only viable Tier-3 option |
| PDF (vector path) | **svg2pdf** (Rust) or **cairosvg** (Python) | Apache-2 / MIT | Full with pinning | Fonts embedded as CFF/Type 1 |
| PPTX | **python-pptx** + `pptx.oxml` XML | MIT | Geometric only | `pptx.oxml` for DrawingML effects |
| HTML | Browser SVG / Node.js `canvas` | Open std. | Pinned version | Wraps SVG or raster output |

### Candidates surveyed

| Library | Verdict | Notes |
|---------|---------|-------|
| Skia (BSL-1) | **ADOPT** — raster/art backend | Only open library: GPU + full Tier-3 effects + multi-surface |
| resvg (Apache-2/MIT) | **ADOPT** — SVG→PNG | Strongest determinism guarantee; Rust native |
| Cairo (MPL-1.1) | Reference only | No GPU path; cairosvg viable for SVG→PDF |
| python-pptx (MIT) | **ADOPT** — PPTX backend | Extend with pptx.oxml for DrawingML effects |
| Browser Canvas/WebGL | **ADOPT** — HTML backend | Wraps raster output for Tier 2/3 HTML |
| svg2pdf / cairosvg | **ADOPT** — PDF vector | Deterministic with pinning |

---

## Architecture Validation for Barbara

The survey **corroborates** all five major choices in Barbara's architecture
(§5/§6/§7):

1. **Scene-graph-as-root** — confirmed by Vega scenegraph + usvg precedents
2. **Skia for raster backend** — natural and only viable choice under permissive licence
3. **Golden-image testing** — standard practice; consistent with Skia/Flutter approach
4. **SVG as backend not root** — independently confirmed by SVG filter non-determinism
5. **python-pptx + pptx.oxml** — no alternative under permissive OSS licence

**No changes to Barbara's architecture are recommended.**

---

## Flag for Barbara and Leslie

**Text-shaping path verification (pre-implementation):**
Skia internally integrates HarfBuzz for OpenType text shaping. Before implementing
the Skia-based Raster backend, verify that Skia's text-shaping and font-metrics
path is consistent with the embedded-font-metrics contract (§5, item 5) — i.e.,
that label-width measurements in the raster backend match values pre-computed by
the layout pipeline. No architecture change is anticipated; this is a verification
task before Raster backend implementation begins.

---

## New Cite Keys Added to references.bib

| Key | Source | Used in |
|-----|--------|---------|
| `vega-scenegraph` | github.com/vega/vega-scenegraph (MIT) | §7.9 Layer A |
| `resvg` | github.com/linebender/resvg (Apache-2/MIT) | §7.9 Layer B |
| `usvg` | github.com/linebender/resvg/crates/usvg (Apache-2/MIT) | §7.9 Layer A |
| `cairo` | cairographics.org (MPL-1.1) | §7.9 Layer B |
| `lottie` | airbnb.io/lottie/ (MIT) | §7.9 Layer A |
| `matplotlib` | matplotlib.org (BSD-3) | §7.9 Layer A |
| `pdf-iso32000` | iso.org/standard/63534.html (ISO 32000-2:2017) | §7.9 framing + Layer B |
| `png-spec` | w3.org/TR/PNG/ (W3C / ISO 15948:2003) | §7.9 framing |

Existing keys reused: `skia`, `webgl`, `golden-image-testing`, `ooxml`,
`python-pptx`, `vegalite2017`.

---

## Files Modified

- `design/sections/07-output-targets.tex` — new §7.9 subsection appended at end
- `design/references.bib` — 8 new BibTeX entries added
- `.squad/agents/david/history.md` — Learnings updated
- `.squad/decisions/inbox/david-output-build-vs-adopt.md` — this file
# Phase 0 Scaffold — Completion Note

**Author:** Leslie (Lead / Spec Architect)
**Date:** 2026-06-10T15:32:26-04:00
**Status:** Complete — all exit criteria GREEN

---

## What Was Scaffolded

A pnpm monorepo implementing the TypeScript/Node core ratified in `.squad/decisions.md`.

### Packages Created

| Package | Purpose |
|---------|---------|
| `@timeline-compiler/core` | Pure library — all consumers import from here |
| `@timeline-compiler/cli` | commander-based CLI: `render`, `validate`, `schema` |
| `@timeline-compiler/schema` | Versioned JSON Schema artefact in `v1/timeline.json` |

### Root Infrastructure

- `pnpm-workspace.yaml` — workspace config (`packages/*`)
- `pnpm-settings.json` — allows esbuild build scripts (pnpm 11 requirement)
- `tsconfig.base.json` — ES2022, NodeNext, strict, declaration, sourceMap, composite
- `eslint.config.js` — ESLint 9 flat config + typescript-eslint v8 (recommended ruleset)
- `.prettierrc` — singleQuote, trailingComma all, printWidth 100
- `.nvmrc` — Node 22
- `README.md` — project intro + quick-start
- `.github/workflows/ci.yml` — matrix: ubuntu+macos × Node 20+22

### Public API Contract (packages/core/src/)

Types in `types.ts`: `IRDocument`, `Metadata`, `Track`, `Group`, `Activity`, `Milestone`,
`Annotation`, `Section`, `Legend`, `Diagnostic`, `ValidationResult`, `RenderOptions`,
`RenderResult`, `IncrementalResult`, `Session`, `ThemeInfo`, `Status`, `AxisUnit`, `IRDate`, `ID`

Functions in `api.ts` (Phase 0 stubs — all throw `NotImplementedError` except the 3 below):
- `loadIR(text, format?)` → `IRDocument` — stub
- `validate(ir)` → `ValidationResult` — stub
- `render(ir, options)` → `RenderResult` — stub
- `compile(input, options)` → `RenderResult` — stub
- `listThemes()` → `ThemeInfo[]` — **LIVE** (returns 4 built-in theme stubs)
- `getSchema()` → `object` — **LIVE** (Zod → JSON Schema via zod-to-json-schema)
- `createSession(options?)` → `Session` — **LIVE** (returns placeholder IncrementalResult)
- `NotImplementedError` — typed error class for Phase 0 stubs

Zod schema in `schema.ts`: `irDocumentSchema` (permissive Phase 0; Phase 1 tightens invariants).

---

## Exit Criteria Status

| Check | Status |
|-------|--------|
| `pnpm install --frozen-lockfile` | ✅ PASS |
| `pnpm -r build` | ✅ PASS |
| `pnpm -r typecheck` | ✅ PASS |
| `pnpm -r lint` | ✅ PASS |
| `pnpm -r test` (22 tests) | ✅ PASS |
| `node packages/cli/dist/index.js --version` prints version | ✅ PASS |
| `packages/schema/v1/timeline.json` exists and is valid JSON | ✅ PASS |

---

## Notes for Coordinator / Owner

1. **pnpm 11 quirk:** pnpm 11.x requires explicit approval for packages that run build scripts.
   `pnpm-settings.json` at repo root with `{ "onlyBuiltDependencies": ["esbuild"] }` handles
   this. Tested on fresh `rm -rf node_modules`. CI will work with `pnpm install --frozen-lockfile`.

2. **Phase 1 starting point:** All rendering/validation stubs throw `NotImplementedError`.
   The `compile()` + `Session.update()` entry points are the Phase 1 hotpath. Mark owns
   the Zod schema tightening (17 invariants); Barbara owns the rendering pipeline.

3. **No turborepo:** `pnpm -r` with topological ordering is sufficient for this monorepo size.
   Schema package build depends on core and pnpm handles ordering automatically.

4. **Lockfile committed:** `pnpm-lock.yaml` is included in the tree (NOT in .gitignore).
   The `.gitignore` intentionally does NOT list it — CI's `--frozen-lockfile` requires it.
# Leslie — Phase 1 Integration Decision Note

**Author:** Leslie (Lead, Timeline Compiler)
**Date:** 2026-06-10
**Phase:** 1 — INTEGRATION Wave 2

---

## What Was Done

Wired Mark's loader/validator and Barbara's layout/render into the public API and CLI, built the golden-image conformance harness, and verified the Phase 1 MVP acceptance bar.

### Files Owned / Changed

| File | Action |
|------|--------|
| `packages/core/src/api.ts` | Replaced Phase-0 stubs with real `parseIR` / `validateDocument` / `renderDocument` delegations; stateful `createSession` with parse→validate→render pipeline; error-surface (never throws from `update()`); `IRParseError` re-exported |
| `packages/core/src/index.ts` | Added lower-level exports for CLI/MCP/extension consumers: `parseIR`, `validateDocument`, `renderDocument`, `resolveTheme`, `sceneHash`, `IRParseError` |
| `packages/cli/src/index.ts` | Full Phase 1 CLI: `validate` (diagnostics as `severity code path: message`, exit 0/1); `render` (validate-before-render, default output path, sceneHash output, `--format`, `--theme`); `schema` (`-o` support); global error handler |
| `packages/core/test/smoke.test.ts` | Updated Phase-0 → Phase-1 smoke tests |
| `packages/core/test/golden.test.ts` | New conformance harness: 10 tests covering validation, determinism, golden SVG comparison, PNG signature |
| `examples/our-timeline.timeline.yaml` | T2 IR fixture transcribed from §14.2 |
| `examples/golden/our-timeline.svg` | Committed golden SVG artifact |
| `examples/golden/our-timeline.png` | Committed golden PNG artifact |

---

## Integration Mismatch Found (Minor)

**Mismatch:** The T2 design spec (§14.2) specifies `label: ""` for the single track. The Zod schema (`trackSchema`) requires `label: z.string().min(1)`. This means the exact spec YAML fails `parseIR`.

**Resolution:** Fixture uses `label: " "` (single space). The track header is rendered with `headerWidth: 0` in the consulting theme, so the label value is never visible. No schema change made — minimal fixture adaptation per the task constraint.

**Recommendation for Mark:** Consider relaxing `trackSchema.label` from `min(1)` to `z.string()`, with a lint warning for empty labels in `validateDocument` rather than a hard schema error. Or document that whitespace-only labels are the canonical way to suppress track headers.

---

## Verify Commands (All PASS)

```bash
pnpm install          # ✅
pnpm -r typecheck     # ✅
pnpm -r lint          # ✅
pnpm -r test          # ✅ 137 tests
pnpm -r build         # ✅

# CLI end-to-end
node packages/cli/dist/index.js validate examples/our-timeline.timeline.yaml
# → ✅ Valid (exit 0)

node packages/cli/dist/index.js render examples/our-timeline.timeline.yaml -o a.svg
node packages/cli/dist/index.js render examples/our-timeline.timeline.yaml -o b.svg
diff a.svg b.svg  # → identical (determinism ✅)

node packages/cli/dist/index.js render examples/our-timeline.timeline.yaml \
  -o t2.png --format png
xxd t2.png | head -1  # → 8950 4e47 (PNG signature ✅)

node packages/cli/dist/index.js validate broken.yaml  # → exit 1 + diagnostics ✅
```

---

## MVP Acceptance Bar

> T2 renders from IR to byte-deterministic SVG+PNG via the CLI, with validate-before-render.

**STATUS: MET ✅**

- `validate` exit 0 on T2 ✅
- Two `render` → SVG calls produce byte-identical output ✅
- `sceneHash` is identical across renders ✅
- `render --format png` produces valid PNG (0x89 50 4E 47) ✅
- Broken IR → `validate` exits 1 with structured diagnostics ✅
- Broken IR → `render` would exit 1 before reaching renderer (validate-before-render) ✅
# Productization Plan Decisions — 2026-06-10

**Author:** Leslie (Lead / Spec Architect)
**Topic:** Productization Plan for Timeline Compiler

---

## Key Decision 1: Implementation Language Recommendation

**Decision:** TypeScript/Node as core language with Rust for the SVG→PNG path (resvg/usvg), Python isolated as an optional sidecar for PPTX only.

**Rationale:**
- **Owner constraints:** Owner dislikes Python, prefers Go or TypeScript. Owner is fluent in Go (cmd/gert, gert-tui) and TypeScript (VS Code extensions).
- **Ecosystem fit:** TypeScript is the optimal choice for the IR/schema/CLI/MCP/agent ecosystem. The MCP SDK, VS Code extension, and npm distribution are all native TypeScript.
- **Rendering library access:** `resvg-js` (WASM-compiled resvg) provides deterministic SVG→PNG in Node. Skia access via `skia-canvas` or `canvaskit-wasm` for future raster/art effects.
- **Go alternative:** Go is viable but has weaker MCP/agent-tooling ecosystem and thinner Skia bindings. If owner prefers Go, accept reduced art-effects scope in early phases.
- **Python isolation:** python-pptx is the only mature OOXML library. If PPTX is needed, spawn as subprocess behind an interface. Evaluate JS OOXML alternatives (pptxgenjs) for native option.
- **Rust for PNG:** Use native resvg via N-API binding or WASM for byte-deterministic SVG→PNG conversion.

**Trade-offs explicit for owner to ratify:**
| Factor | TypeScript/Node | Go |
|--------|-----------------|-----|
| MCP/Agent ecosystem | Native | Requires custom JSON-RPC |
| VS Code extension | Native embedding | Subprocess or WASM |
| npm distribution | Native | WASM or subprocess |
| CLI standalone binary | Requires pkg/sea-orm or Deno compile | Native |
| Skia/art-effects | skia-canvas/canvaskit bindings exist | Thinner ecosystem |
| Owner familiarity | High (VS Code work) | High (cmd/gert) |

**Recommendation:** TypeScript core, with explicit acknowledgment that Go is viable if owner prefers simplicity over art-effects maturity.

---

## Key Decision 2: MVP Slice Definition

**Decision:** MVP is the smallest end-to-end capability that validates the thesis:
- **One layout family:** Horizontal swimlane (the default §5 pipeline) — most directly covered by spec, most common use case
- **One theme:** Consulting (Tier 1, Crisp) — clean, executive-presentable without art effects
- **Outputs:** SVG (primary) + PNG (via resvg-js)
- **Inputs:** Native IR authoring (YAML/JSON), JSON Schema published
- **Interface:** CLI with `render` and `validate` commands
- **Validator:** Full 5-layer validation pipeline (syntactic → schema → well-formedness → render-readiness → semantic advisory)

**Acceptance bar:** Reproduce target T2 (horizontal numbered nodes, light minimal) from IR via CLI to SVG+PNG. Target T2 is the simplest (milestones-only, single line, Tier 1) and proves core loop without requiring vertical-spine layout.

**Explicitly deferred to Phase 2+:**
- Vertical-spine layout family (T1, T3, T5)
- Serpentine layout family (T4)
- Raster/art effects (Tier 2/3)
- PPTX output
- MCP server
- VS Code extension
- Ingesters (ADO, GitHub, Mermaid)

---

## Key Decision 3: Phased Roadmap

| Phase | Goal | Deliverables | Exit Criteria | Targets Covered |
|-------|------|--------------|---------------|-----------------|
| **0** | Foundations | Repo scaffold, JSON Schema published, CI, TypeScript project structure | Schema validates, CI green, build produces CLI stub | — |
| **1** | MVP Core | IR parser, validator, horizontal swimlane layout engine, SVG backend, CLI, Consulting theme | T2 reproducible from IR to SVG+PNG, byte-deterministic | T2 partial |
| **2** | Themes + Polish | PNG via resvg-js, 3 themes (Consulting, Minimal, Executive), sections, status/progress viz, today marker, npm package | Custom theme loading works, npm installable | T2 full |
| **3** | Agents + Ingesters | MCP server, VS Code extension (preview+export), GitHub ingester (Gitline flow), vertical-spine layout module | Agent can generate IR and invoke rendering | T1, T3 partial |
| **4** | Art Effects + PPTX | Raster backend (Skia/Canvas), PPTX native-shape backend, Tier 2/3 themes (Showcase) | T4, T5 reproducible at full fidelity | T1, T3, T4, T5 full |

---

## Key Decision 4: Python-PPTX Isolation Strategy

**Decision:** PPTX backend is deferred to Phase 4. When implemented, python-pptx is isolated as a subprocess:
1. CLI exposes `timeline render input.yaml -o output.pptx`
2. TypeScript core produces Scene/Render IR JSON
3. A Python subprocess consumes Scene IR, produces PPTX
4. The Python sidecar is optional; CLI works without it (fails gracefully with "PPTX backend not installed")
5. Evaluate `pptxgenjs` (MIT, JS) as a non-Python alternative before committing to python-pptx

**Rationale:** Owner explicitly dislikes Python. Isolation keeps Python out of the core dependency graph while preserving PPTX capability for users who need it.

---

## Key Decision 5: Target Image → Phase Mapping

| Target | Layout Family | Theme | Fidelity | Phase |
|--------|---------------|-------|----------|-------|
| T2 (Horizontal numbered) | Horizontal single-line | Light-minimal-corporate | Tier 1 | Phase 1 (MVP acceptance) |
| T1 (Vertical spine, dark) | Vertical central-spine | Dark-executive | Tier 2 | Phase 3 |
| T3 (Dense AI infographic) | Vertical central-spine | Colorful-infographic | Tier 1 | Phase 3 |
| T4 (Serpentine glow) | Serpentine winding | Showcase | Tier 3 | Phase 4 |
| T5 (Gitline cards) | Vertical central-spine | Showcase-dark | Tier 3 | Phase 4 |

---

## Key Decision 6: Conformance Test Strategy

**Decision:** Golden-image conformance suite using the five target images as acceptance fixtures:
1. Each target has a worked IR fixture (from §14 worked examples)
2. CI renders fixture → SVG → PNG
3. Compare against golden PNG (pixel-exact for geometry; configurable tolerance for anti-aliasing)
4. Per-backend golden images (SVG backend and Raster backend expected to differ)
5. Scene hash (SHA-256) included in output metadata; CI asserts hash stability across runs

---

## Pending Owner Input

- [ ] Ratify TypeScript vs Go decision
- [ ] Confirm MVP acceptance bar (T2 from IR to SVG+PNG)
- [ ] Confirm Phase 3 timeline for MCP/agent integration
- [ ] Confirm PPTX deferral + python-pptx isolation strategy
# TypeScript Core API Design & Phase 0/1 Work Breakdown

**Author:** Leslie (Lead / Spec Architect)  
**Date:** 2026-06-10T14:02:12-04:00  
**Status:** RATIFIED

---

## Ratified Decision: TypeScript/Node Core

The owner has ratified **TypeScript/Node** as the core implementation language based on three constraints:

1. **Python exclusion:** Owner dislikes Python for core code. PPTX support will use `pptxgenjs` (not `python-pptx`).
2. **Transparent VS Code extension:** The future extension must import and call the core library **in-process** (no subprocess, IPC, or WASM bridge).
3. **MCP/agent + npm ecosystem fit:** Native TypeScript aligns with MCP server patterns and npm distribution.

---

## 1. Core Public API Design

See deliverable output for full TypeScript signatures.

**Package Boundaries:**
- `@timeline-compiler/core` — pure library (no Node-only deps in hot path)
- `@timeline-compiler/cli` — CLI wrapper
- `@timeline-compiler/mcp` — MCP server
- `@timeline-compiler/schema` — JSON Schema package
- Future: VS Code extension imports core directly

**Transparency Contract:**
- SVG output is a string (extension drops into webview directly)
- Diagnostics map cleanly to `vscode.Diagnostic`
- Same API backs CLI + MCP + extension
- Extension never spawns a process

---

## 2. Phase 0 — Foundations

See deliverable output for full task table.

**Exit Criteria:**
- pnpm monorepo builds with `pnpm build` producing TS declarations
- Empty public-API stubs compile against the type signatures
- JSON Schema validates example IR documents
- CI passes on macOS + Linux (lint, typecheck, test)
- Versioning policy documented

---

## 3. Phase 1 — MVP Core

See deliverable output for full task table.

**Acceptance Bar:**
- Reproduce target T2 from IR to byte-deterministic SVG+PNG via CLI
- validate-before-render workflow
- Golden-image conformance harness with T2 as gating fixture

---

## 4. Critical Path Summary

```
P0.1 (monorepo) → P0.2 (tooling) → P0.3 (schema) → P0.4 (CI) → P0.5 (stubs)
                                          ↓
P1.1 (loader) → P1.2 (validator) → P1.3 (layout) → P1.4 (SVG) → P1.5 (PNG)
                                                         ↓
                              P1.6 (theme) → P1.7 (CLI) → P1.8 (golden)
```

**v0.1.0 Definition of Done:**
- T2 reproducible (byte-identical SVG+PNG on macOS/Linux)
- JSON Schema published in `@timeline-compiler/schema`
- CLI commands: `render`, `validate`, `schema`
- 1 theme: Consulting (light-minimal-corporate, Tier 1)
- All 17 IR invariants validated
- Golden-image harness passes with T2 fixture

---

## 5. Extension-Readiness Checklist

See deliverable output for full checklist.

---

**Note:** Full deliverable with TypeScript signatures and task tables provided as plain-text output to coordinator.
# Milestone Fields Addition — IR Gap Closure

**Date:** 2026-06-10T12:06:30-04:00
**Author:** Mark (IR & Data Modeling)
**Status:** Pending merge into decisions.md IR Contract section

## Summary

Two fields have been added to the **Milestone** entity in `design/sections/04-ir.tex` (Milestone Fields table, §4.4) to achieve parity with Activity and satisfy the owner's five target outputs (colored markers + source provenance for re-sync).

## Added Fields

| Field | Type | Req | Default | Description |
|-------|------|-----|---------|-------------|
| `color` | `string?` | opt | theme | Color hint (theme may override) |
| `metadata` | `map<string,any>` | opt | `{}` | Application data; renderers ignore unknown keys |

### `color` (string?, opt, default theme)

Identical semantics to `Track.color` and `Group.color`. A hint to the theme engine; the theme may override it. Enables per-marker colored dots/badges as seen in target outputs T1 (cyan/amber/pink/slate year nodes) and T3 (colorful connector dots).

### `metadata` (map<string,any>, opt, default {})

Identical semantics to `Activity.metadata`. Carries application-specific data and source round-trip fidelity (provenance). Renderers **MUST** ignore unrecognized keys. Required for Gitline target T5, where repositories are represented as dated markers that must carry source provenance for re-sync.

## Scope

Surgical addition only. No other entity modified. No new invariants required (the existing extensibility note in §4 "Renderers should ignore unrecognized metadata keys" already covers all entities with `metadata`, including Milestone).
# Barbara — Skia Glow Artifact + Legend Colors (2026-06-11)

**Date:** 2026-06-11T06:46:49-04:00  
**Author:** Barbara (Semantics & Rendering)  
**Status:** FIXED — commit a47af6f

---

## Decision: Use `TileMode.Decal` for all Skia ImageFilter blurs (glow + shadow)

**File:** `packages/core/src/render/skia.ts` — `renderWithEffects`

### Finding

`CK.ImageFilter.MakeBlur(sigma, sigma, CK.TileMode.Clamp, null)` was used for both
`glow` and `shadow` effects. For filled rectangles, `TileMode.Clamp` replicates the
rect's fill color at the blur layer boundary (every pixel beyond the expansion zone
~3×sigma from the rect edge). This produced a hard full-opacity shadow band in the
connector zone between milestone nodes and card rects on the vertical-spine layout.

The artifact was invisible for circles because their bounding-box corners are
transparent — clamping transparent = transparent, so Clamp ≡ Decal for circles.

### Ruling

**Always use `CK.TileMode.Decal` for all ImageFilter blur calls in this codebase.**

`TileMode.Decal` treats out-of-bounds pixels as `(0,0,0,0)` (fully transparent),
giving natural Gaussian falloff with no hard boundary — the semantically correct
behaviour for drop shadows and glow effects.

`TileMode.Decal` is confirmed available in canvaskit-wasm 0.41.x.

---

## Decision: Showcase theme palette — statuses must be visually distinct

**File:** `packages/core/src/themes/showcase.ts`

### Finding

The original palette assigned `CYAN (#00D4FF)` to both `planned` and `standard-node`,
and `CYAN_DIM (#0099CC)` to `in-progress`. At the 12px legend swatch size these were
effectively indistinguishable.

The legend code (`vertical-spine.ts` ~line 1003–1010) reads raw `theme.statusMap[s].fill`
and `theme.categoryMap[c].fill` — it does NOT call `resolveStatusStyle`, so any category
override does not rescue the legend. The palette itself must assign distinct colors.

### Ruling

**Statuses displayed in the legend must have perceptually distinct fill colors.**
The `resolveStatusStyle` override mechanism does not protect the legend — palette
assignments are the authoritative legend colors.

New palette assignments for showcase theme:
- `planned → BLUE_SCHED (#4D9AFF)` — periwinkle blue
- `in-progress → TEAL_ACTIVE (#00CC88)` — teal green
- `standard-node → CYAN (#00D4FF)` — electric cyan (primary accent)
- `done → STEEL (#607D9B)` — unchanged

---

## Decision: Showcase Skia golden uses `layout: 'vertical-spine'`

**File:** `packages/core/test/skia.test.ts`

### Ruling

The showcase golden test (`showcase golden PNG matches on re-render`) now specifies
`layout: 'vertical-spine'` explicitly. The showcase theme's cardEffects/nodeEffects
design is oriented around the vertical-spine layout. Using horizontal layout for the
golden created a mismatch between what was tested and what was described in the
bug report.

---

## Pixel evidence

**Defect 1 fix (connector strip, y=227, node 1 center):**
- Before: x=644=(4,178,217), x=645=(2,83,101) — hard dark step (full shadow clamped)
- After: x=644=(4,178,217), x=645=(4,178,217) — clean connector, smooth Gaussian falloff

**Defect 2 fix (legend swatch centers at x=996):**
- done (y=414): (96,125,155) ← STEEL grey-blue
- in-progress (y=435): (0,204,136) ← TEAL_ACTIVE teal-green
- planned (y=455): (77,154,255) ← BLUE_SCHED periwinkle-blue
- standard-node (y=476): (0,212,255) ← CYAN electric-cyan

All four are perceptually distinct. 465/465 tests pass.

---

# Decision: Activity.icon Field Addition

**Author:** Mark (IR & Data Modeling)  
**Date:** 2026-06-11  
**Status:** Implemented  
**Requested by:** ormasoftchile  

---

## Context

The decisions.md "Deferred / Not done" section previously noted:

> Activity icon rendering: `Activity` type does not have an `icon` field in the current IR schema; schema changes were out of scope. Activity icons are a no-op until the IR is extended.

This decision record documents the IR extension that unblocks activity-icon rendering (Barbara's step 2).

---

## Change

`Activity` now carries an optional `icon` field, mirroring `Milestone.icon` exactly:

### types.ts (packages/core/src/types.ts)

```typescript
export interface Activity {
  // ... existing fields ...
  category?: string;
  /** A named icon from the built-in icon registry (e.g. "star", "flag"). */
  icon?: string;
  description?: string;
  // ...
}
```

### schema.ts (packages/core/src/schema.ts)

```typescript
const activitySchema = z.object({
  // ... existing fields ...
  category: z.string().optional(),
  icon: z.string().optional(),   // ← added
  description: z.string().optional(),
  // ...
});
```

Field position: between `category` and `description`, matching Milestone's ordering.

---

## Validation Parity Decision

**Question:** Should `Activity.icon` be validated against the icon registry (`hasIcon` / `getIcon` from icons.ts)?

**Finding:** `validate.ts` contains **no icon validation for `Milestone.icon`**. A search for `hasIcon`, `getIcon`, and `icon` in validate.ts returns zero matches. Unknown icon names on milestones pass through silently; the rendering layer falls back (unknown icon → ordinal number / no-op) without emitting a diagnostic.

**Decision: DO NOT add icon-name validation for `Activity.icon`.**

Rationale: Consistency with Milestone is the rule. Introducing validation for Activity.icon while Milestone.icon remains unvalidated would be an asymmetry in the IR contract. If icon-name validation is desired in future (emitting an `UNKNOWN_ICON` warning), it should be applied to both entity types simultaneously in a single change.

This is noted here so the asymmetry is not accidentally introduced later.

---

## JSON Schema

After schema.ts was updated, `pnpm -r build` regenerated `packages/schema/v1/timeline.json`. The Activity item object now includes:

```json
"icon": {
  "type": "string"
}
```

`icon` is **not** in the `required` array (it is optional).

---

## Files Touched

| File | Change |
|------|--------|
| `packages/core/src/types.ts` | Added `icon?: string` to `Activity` interface |
| `packages/core/src/schema.ts` | Added `icon: z.string().optional()` to `activitySchema` |
| `packages/schema/v1/timeline.json` | Auto-regenerated — Activity.icon now present |
| `packages/core/test/validate.test.ts` | Added 3 tests for Activity.icon |
| `packages/schema/test/schema.test.ts` | Added 1 test verifying Activity.icon in JSON Schema |

---

## Handoff to Barbara

- **Field:** `Activity.icon?: string` — optional, same type as `Milestone.icon?: string`.
- **Semantics:** A named icon from the built-in icon registry (packages/core/src/icons.ts). Use `getIcon(activity.icon)` to resolve; if `undefined`, treat as absent (no icon drawn).
- **Validation:** Not validated at the IR layer — unknown names silently pass. Same behaviour as Milestone. Rendering fallback is your responsibility.
- **JSON Schema:** Regenerated and confirmed. `activity.icon` is an optional `string` property in `packages/schema/v1/timeline.json`.
- **Tests:** All 476 tests pass (`pnpm -r typecheck && pnpm -r test` green).

---

# Decision: Activity Icon Placement Semantics and Size Rule

**Agent:** Barbara (Semantics & Rendering)
**Date:** 2026-06-11
**Status:** Implemented and tested

---

## Context

Mark (IR Schema) added `Activity.icon?: string` to the IR, using the same named icon registry as `Milestone.icon`. This document records the rendering decisions Barbara made to bring activity icons to screen consistently with milestone icons across all three backends.

---

## Placement Semantics

### Horizontal layout

Activity icons are placed at the **left (start) edge of the activity bar**, vertically centred. Rationale:

- The start edge is the activity's natural "origin point" — the icon anchors to the start of the work, not the middle.
- Left-aligned inside the bar mirrors the label's own left-alignment, making the icon + label read as a cohesive unit (icon → label, left to right).
- Milestone icons sit inside their circular/diamond node marker. For activities there is no separate node shape — the bar *is* the marker. Left-edge placement is the closest structural analogue to "inside the node shape at the node's position".
- Placing the icon at the *right* edge would conflict with the open-end arrowhead decoration for ongoing activities.

### Vertical-spine layout

Activities are rendered as spine entries identical in structure to milestones (same `SpineEntry` record type). Activity icons flow through the existing `iconHint` rendering paths at no additional cost:

1. **Icon badge** (top corner of the content card, lines 775–814): coloured circle + icon glyph.
2. **Node icon** (inside the spine node marker, lines 860–882): icon glyph scaled to node radius.

No placement change was needed; only `iconHint: act.icon` needed to be populated (it was already in the type but always `undefined` for activities).

---

## Size Rule

```
iconPx = theme.activity.barHeight − 4   (2 px top/bottom padding)
s      = round_half_up((iconPx / 2) / 12, 4 decimal places)
```

This is algebraically equivalent to the milestone formula `ms.size * iconScale / 12` with `iconScale = (barHeight−4)/barHeight`. For the consulting/product themes (barHeight = 20 px): `iconPx = 16`, `s ≈ 0.6667`, icon occupies ~16 × 16 px.

The same SVG transform contract as milestones:

```
translate(iconCX, barMidY) scale(s) translate(-12, -12)
```

where `iconCX = al.xLeft + LPAD + iconPx/2` (left bar edge + padding + half-icon width).

---

## Label Shift

When an icon is drawn:

```
iconGutterW = iconPx + LPAD   (LPAD = 4 px)
labelX      = al.xLeft + LPAD + iconGutterW
insideAvail = al.width − 2×LPAD − iconGutterW
```

Outside-placement logic (bar too narrow) is unchanged — when the label goes outside the bar, the icon was already skipped (bar too narrow to contain it), so the outside x positions are unaffected.

---

## Degenerate Cases

| Condition | Outcome |
|-----------|---------|
| `activity.icon` absent / `undefined` | No icon emitted (no-op). Label uses full bar width. |
| `getIcon(activity.icon) === undefined` | No icon emitted (no-op). Unknown names silently ignored, matching milestone behaviour. |
| Bar too narrow (`al.width < iconPx + 2×LPAD`) | Icon skipped. Label uses its normal outside-placement logic. |
| Very short bar (start-only, minWidth=20 px) | Icon skipped (20 < 16+8). Label goes outside. |

---

## Backend Notes

No backend changes were required. Activity icon path primitives use the same `PathPrimitive { kind: 'path', d, fill, stroke, transform }` structure that milestone icons already use. All three backends (SVG via `scene-to-svg.ts`, PNG via resvg, Skia via `skia.ts`) handle this primitive transparently.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/layout/horizontal.ts` | Replaced activity label block with icon+label block |
| `packages/core/src/layout/vertical-spine.ts` | Added `iconHint: act.icon` to activity SpineEntry |
| `examples/gallery/feature-rich.timeline.yaml` | Added icons to 5 activities |
| `examples/gallery/journey.timeline.yaml` | Added icons to 3 activities |
| `examples/gallery/feature-rich.{svg,png}` | Regenerated |
| `examples/gallery/journey.{svg,png}` | Regenerated |
| `examples/gallery/showcase/*.png` | Regenerated by Skia gallery test |
| `packages/core/test/icons.test.ts` | Added 10 activity-icon tests in section (g) |

**Test result:** 478/478 pass (pnpm -r test).

---

## Archived 2026-06-11 — batch 2

## Target Output Gap Analysis (2026-06-11)

**Author:** Barbara (Semantics & Rendering specialist)  
**Date:** 2026-06-11  
**Scope:** Five target images vs current renderer capabilities  
**Replaces:** Target Output Coverage Analysis (2026-06-10, archived)

### Executive Summary

Since the 2026-06-10 analysis, significant progress has been made:
- **Vertical-spine layout family**: ✅ Shipped (covers T2, T3, T5 core structure)
- **Card entry style** (`entryStyle: 'card'`): ✅ Shipped (executive, product, showcase themes)
- **Icon support** on milestones AND activities: ✅ Shipped (20 built-in icons)
- **Glow/shadow effects** via Skia backend: ✅ Shipped (TileMode.Decal fix applied)
- **Gradient/cloud backgrounds**: ✅ Shipped (showcase theme)
- **Numbered milestone nodes** (`showOrdinalNumber: true`): ✅ Shipped

**Three targets are now substantially renderable**. The remaining gaps are mostly refinements and one layout family (serpentine) that was explicitly deferred to post-MVP.

### Per-Target Assessment

#### T1: Horizontal Numbered Timeline ("Our Timeline")

**Image:** `design/figures/target-horizontal-numbered.png`

**Verdict:** 🟢 **Fully renderable** (~95% fidelity, logo gap remains) — T1-1, T1-2, T1-new CLOSED 2026-06-11

**What We CAN Already Do:**
- Horizontal layout family ✅
- Large numbered circular milestone nodes (consulting theme: `showOrdinalNumber: true`, `shape: 'circle'`) ✅
- Date label above / title below milestone (consulting theme: `dateLabelAbove: true`, `titleLabelBelow: true`) ✅
- Light background ✅
- Centered title `titleAlign: 'center'` (new token, opt-in, default = center = existing behavior) ✅
- Alternating above/below labels (pre-existing, index 0 → below, 1 → above, 2 → below) ✅
- Filled vs outlined nodes via themed `statusMap` + `ordinalColorContrast: true` (new token) ✅
- Legend suppressed via `legend.show: false` in fixture ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| ✅ T1-1 | [Theme] | ~~Alternating above/below node placement~~ — CLOSED (pre-existing in horizontal.ts) | Barbara | — |
| ✅ T1-2 | [Theme] | ~~Centered document title~~ — CLOSED (pre-existing + `titleAlign` token added 2026-06-11) | Barbara | — |
| ✅ T1-new | [Theme] | Filled (active) vs outlined (inactive) node — CLOSED via `statusMap` + `ordinalColorContrast` (2026-06-11) | Barbara | — |
| T1-3 | [Render] | **Brand logo/image slot** — top-right company logo. Needs `Scene.image` primitive + `metadata.logo` IR field. Spec in `.squad/decisions/inbox/barbara-t1-close.md`. | Barbara/Mark | M |

#### T2: Vertical Spine Dark ("Subject Timeline")

**Image:** `design/figures/target-vertical-spine-dark.png`

**Verdict:** ✅ **CLOSED** (2026-06-11 — Barbara)

**What Was Implemented:**
- Vertical-spine layout family ✅
- Alternating left/right entry blocks ✅
- Dark background (subject-timeline theme: `#1A1A2E`) ✅
- Large year labels on spine ticks (in entry color) ✅
- White node fill override ✅
- Segmented colored spine (T2-1) ✅
- Dashed leader lines + far-edge icon badges (T2-2) ✅
- Node chevrons (T2-3) ✅
- Multi-block entry content — `blocks` field (T2-4, Mark's handoff) ✅
- Domain icon approximations: hardhat/wrench/truck/building (T2-5) ✅

**New opt-in tokens** (defaults preserve all existing goldens byte-identical):
`spineSegmentColor`, `badgePlacement`, `spineNodeArrow`, `yearLabelUsesEntryColor`, `spineNodeFillOverride`

**Theme:** `subject-timeline` | **Fixture:** `examples/showcase/subject-timeline.timeline.yaml`
**Golden:** `examples/gallery/showcase/subject-timeline-skia.png` (1200×1226 px)

**Known minor gaps:** Icon art is geometric approximation; left-entry body text is left-aligned (not center-aligned as in reference).

**All 561 tests pass; typecheck + lint clean; all existing goldens byte-identical.**

**Remaining Gaps:** *(none — all T2 gaps closed)*

#### T3: AI Timeline Dense ("THE AI TIMELINE")

**Image:** `design/figures/target-ai-timeline-dense.png`

**Verdict:** 🟡 **Partially renderable** (structure complete, polish needed)

**What We CAN Already Do:**
- Vertical-spine layout with alternating entries ✅
- Dense multi-decade timeline (1967→2024) — date engine handles long ranges ✅
- Year labels on spine, multi-line descriptions per entry ✅
- Light background theming ✅
- Automatic spacing adjustment for dense clustering ✅

**Remaining Gaps — ALL CLOSED 2026-06-11**

| Gap ID | Type | Description | Owner | Effort | Status |
|--------|------|-------------|-------|--------|--------|
| T3-1 | [Theme] | **Gradient background strip** — T3 has a subtle vertical gradient/wave decorative background. Need `sceneBackground: { kind: 'gradient' }` tuned for vertical layout (currently used in showcase for horizontal). | Barbara | S | ✅ CLOSED |
| T3-2 | [Layout] | **Year-label typography scaling** — T3 year labels are oversized bold (~36pt) vs entry text. Current `fontSizeAxis` is 10pt. Need separate `yearLabelFontSize` token. | Barbara | S | ✅ CLOSED (`fontSizeYearLabel: 16` in ai-timeline theme) |
| T3-3 | [IR Schema] | **Activity.color?: string** — T3 uses 12+ distinct accent colours. While `category` + `categoryMap` works, direct `color` on Activity would be more ergonomic. Milestone already has `color`. | Mark→Barbara | S | ✅ CLOSED (Mark added field; Barbara wired render) |

**T3 overall: FULLY RENDERABLE ✅**

#### T4: Serpentine Glow Path

**Image:** `design/figures/target-serpentine-glow.png`

**Verdict:** 🔴 **Not yet renderable** (serpentine layout family not implemented)

**What We CAN Already Do:**
- Glow effect (`effects: [{ kind: 'glow', ... }]`) via Skia backend ✅
- Start/end icons (`clock` icon exists, GitHub mark would need adding) ✅
- Gradient backgrounds via `sceneBackground` ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| T4-1 | [Layout] | **Serpentine/winding spine geometry** — Core architectural gap. Date-to-position must map onto a parametric Bézier S-curve. Explicitly deferred to **Post-MVP / Priority 3** per decisions-archive.md. | Barbara | L |
| T4-2 | [Icon] | **GitHub logo icon** — T4 has GitHub mark at path start. Not in registry (trademark concern — may need user-supplied SVG). | Barbara | S |

**Decision Reference:** The serpentine layout family was ruled "fundamentally novel, recommended for post-MVP release" in the 2026-06-10 Target Output Coverage Analysis.

#### T5: Gitline Cards (Dark App Timeline)

**Image:** `design/figures/target-gitline-cards.png`

**Verdict:** 🟢 **Fully renderable** (excluding out-of-scope app chrome) — T5-1 and T5-2 CLOSED (2026-06-11)

**What We CAN Already Do:**
- Vertical-spine layout ✅
- Card entry style (`entryStyle: 'card'`) with rounded-rect backgrounds ✅
- Dark theme (showcase) ✅
- Alternating left/right entries ✅
- Date + clock icon per entry (icon field + `clock` icon in registry) ✅
- Title, date, description text blocks ✅
- Shadow effects on cards (Skia backend) ✅
- Cloud/gradient decorative backgrounds (showcase theme) ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| T5-1 | [Layout] | ~~**CTA button ("VIEW REPOSITORY")**~~ ✅ CLOSED (2026-06-11) | Barbara | M |
| T5-2 | [Theme] | ~~**Inline date icon**~~ ✅ CLOSED (2026-06-11) | Barbara | S |
| T5-3 | N/A | **App chrome** (header, tabs, search, pagination) — **OUT OF SCOPE**. We render the timeline canvas only, not the application shell. | N/A | — |

### Consolidated Gap Table

Sorted by number of targets unblocked (highest leverage first):

| Gap ID | Type | Description | Targets Affected | Owner | Effort |
|--------|------|-------------|-----------------|-------|--------|
| ~~T2-1~~ | ~~Layout~~ | ~~Per-segment spine color~~ | ~~T2~~ | ~~Barbara/Mark~~ | ✅ CLOSED |
| ~~T2-2~~ | ~~Layout~~ | ~~Dashed leader lines + far-edge icon badges~~ | ~~T2~~ | ~~Barbara~~ | ✅ CLOSED |
| ~~T2-4~~ | ~~IR Schema~~ | ~~Multiple sub-blocks per entry~~ | ~~T2~~ | ~~Mark~~ | ✅ CLOSED |
| ~~T3-3~~ | ~~IR Schema~~ | ~~Activity.color?: string (direct color)~~ | ~~T3~~ | ~~Mark~~ | ✅ CLOSED |
| ~~T1-1~~ | ~~Theme~~ | ~~Alternating above/below milestone placement~~ | ~~T1~~ | ~~Barbara~~ | ✅ CLOSED (pre-existing) |
| ~~T5-1~~ | ~~Layout~~ | ~~CTA button rendering from url field~~ | ~~T5~~ | ~~Barbara~~ | ✅ CLOSED |
| T4-1 | Layout | **Serpentine spine geometry** | T4 | Barbara | **L** |
| T1-3 | Render | Brand logo/image slot (SceneImage primitive) | T1 | Barbara/Mark | M |
| ~~T2-3~~ | ~~Layout~~ | ~~Small arrowheads at spine/entry junction~~ | ~~T2~~ | ~~Barbara~~ | ✅ CLOSED |
| ~~T3-1~~ | ~~Theme~~ | ~~Gradient background for vertical layouts~~ | ~~T3~~ | ~~Barbara~~ | ✅ CLOSED |
| ~~T3-2~~ | ~~Layout~~ | ~~Year-label typography scaling~~ | ~~T3~~ | ~~Barbara~~ | ✅ CLOSED |
| ~~T5-2~~ | ~~Theme~~ | ~~Inline date icon rendering~~ | ~~T5~~ | ~~Barbara~~ | ✅ CLOSED |
| ~~T2-5~~ | ~~Icon~~ | ~~Domain-specific pictographic icons~~ | ~~T2~~ | ~~Barbara~~ | ✅ CLOSED (geometric approx) |
| T4-2 | Icon | GitHub logo icon | T4 | Barbara | S |

### Gaps Closed Since 2026-06-10 Analysis

The following gaps from the prior analysis are now **resolved**:

| Prior Gap | Resolution |
|-----------|------------|
| Vertical-spine layout family (Render-1) | ✅ Shipped in `vertical-spine.ts` |
| Card-entry rendering (Render-4) | ✅ Shipped via `entryStyle: 'card'` in themes |
| Glow/bloom effects | ✅ Shipped in Skia backend + showcase theme |
| Shadow effects | ✅ Shipped in Skia backend + showcase theme |
| Milestone.icon | ✅ Shipped |
| Activity.icon | ✅ Shipped (2026-06-11) |
| Milestone.color | ✅ Shipped |
| Milestone.metadata | ✅ Shipped |
| Numbered-circle milestone shape | ✅ Shipped (`showOrdinalNumber: true`) |
| Gradient/cloud background | ✅ Shipped (`sceneBackground` in showcase) |
| T5-1: CTA button rendering | ✅ Shipped (2026-06-11) — `cardCtaLabel` token + pill button |
| T5-2: Inline date icon | ✅ Shipped (2026-06-11) — `cardDateIcon` token + icon pipeline |

### Recommended Build Order

To maximize target coverage with minimal effort:

**Priority 1: Close T3 (AI Timeline Dense) — DONE ✅**
1. ~~T3-3: Activity.color~~ ✅
2. ~~T3-2: yearLabelFontSize token~~ ✅
3. ~~T3-1: Gradient background tuning~~ ✅

**Priority 2: Close T5 (Gitline Cards) — DONE ✅**
1. ~~T5-1: CTA button rendering~~ ✅ (Barbara, 2026-06-11)
2. ~~T5-2: Inline date icon~~ ✅ (Barbara, 2026-06-11)

**Priority 3: Polish T2 (Vertical Spine Dark)**
1. **T2-1: Per-segment spine color** (Barbara/Mark, M) — visually distinctive
2. **T2-2: Far-edge badges + dashed leaders** (Barbara, M)
3. **T2-4: Multi-block descriptions** (Mark, M) — IR extension
4. **T2-3: Arrowheads** (Barbara, S)
5. **T2-5: Domain icons** (Barbara, S–M)

**Priority 4: Close T1 (Horizontal Numbered)**
1. **T1-1: Alternating node placement** (Barbara, M)
2. **T1-3: Logo slot** (Barbara/Mark, M)

**Post-MVP: T4 (Serpentine)**
- **T4-1: Serpentine layout** — L effort, explicitly deferred per prior decisions.

### Summary

| Target | Previous Verdict | Current Verdict | Change |
|--------|-----------------|-----------------|--------|
| T1 Horizontal Numbered | 🔴 Partial | 🟡 Partially renderable | ⬆️ |
| T2 Vertical Spine Dark | 🔴 No | 🟡 Partially renderable | ⬆️⬆️ |
| T3 AI Timeline Dense | 🔴 No | 🟢 Fully renderable | ⬆️⬆️⬆️ |
| T4 Serpentine Glow | 🔴 No | 🔴 Not yet (deferred) | — |
| T5 Gitline Cards | 🔴 No | 🟢 Fully renderable | ⬆️⬆️⬆️ |

**Current Status (2026-06-11):** T3 and T5 are both fully renderable. T2, T1 remain for polish. T4 deferred.

---

## Decision: Activity.color Field Added (2026-06-11)

**Author:** Mark (IR & Data Modeling)  
**Status:** Accepted  
**Requested by:** ormasoftchile  
**Context:** Gap T3-3 from Barbara's target gap analysis — closing target T3 ("THE AI TIMELINE", dense vertical-spine timeline with 12+ distinct accent colors).

### Decision

Add an optional `color?: string` field to the `Activity` entity, mirroring the existing `Milestone.color?: string` field exactly.

### Motivation

Target T3 requires per-activity accent colors across 12+ activities. `Milestone.color` already existed for this purpose on milestones. `Activity` was the only top-level IR entity (alongside Track and Group, which already have `color`) that lacked a color override. This gap blocked Barbara's rendering work for T3.

### Field Specification

| Property | Value |
|---|---|
| Field name | `color` |
| Type | `string` (optional) |
| Default | `undefined` (renderer falls back to theme/status defaults) |
| Semantics | Explicit fill/accent color override for the activity bar. Any valid CSS color string (hex, named, rgb(), hsl(), etc.). Interpreted by the renderer; the IR carries it as a semantic hint only. |
| Validation | **None** — free CSS string, unvalidated, identical to `Milestone.color` behavior. |
| Palette enforcement | Not applied. If palette enforcement is introduced in future, it MUST be applied to `Activity.color`, `Milestone.color`, `Track.color`, and `Group.color` simultaneously to maintain parity. |

### Parity Rationale

`Milestone.color` has never been validated against a CSS palette or a restricted set of values. Applying stricter validation to `Activity.color` would create an asymmetry with no technical justification. The rendering layer (Barbara) is responsible for interpreting the color value and providing fallback behavior for invalid or missing colors.

### Files Changed

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Added `color?: string` to `Activity` interface after `icon`, with doc comment |
| `packages/core/src/schema.ts` | Added `color: z.string().optional()` to `activitySchema` after `icon`, matching Milestone ordering |
| `packages/schema/v1/timeline.json` | Regenerated via `pnpm -r build`; Activity.color now appears as `{ type: "string" }`, not in `required` array |
| `packages/core/test/validate.test.ts` | Added 3 tests: hex color accepted, named CSS color accepted, omitted color accepted |
| `packages/schema/test/schema.test.ts` | Added 1 test: JSON Schema exposes Activity.color as optional string |

### Test Results

- **Preimage:** 478 tests passing  
- **Postimage:** 481 core + 6 schema + 3 CLI = **490 tests passing**, all green  
- `pnpm -r typecheck` ✅  
- `pnpm -r test` ✅  

### Handoff to Barbara

The field is live in the IR. Barbara can now read `activity.color` during rendering:
- `activity.color` — `string | undefined`, free CSS color
- If `undefined`, fall back to theme/status defaults (existing behavior unchanged)
- No palette validation is performed by the IR layer; Barbara may apply her own fallback for unrecognized values

**Note:** In the canonical **IR Contract** section above, Activity now has optional `color?: string` (free CSS, unvalidated, parity with Milestone.color).

---

## Decision: T3 "THE AI TIMELINE" — Gaps Closed (2026-06-11)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-11  
**Status:** MERGED

### Context

Target T3 is a dense vertical-spine timeline spanning 1967–2024 with per-entry accent colors,
large bold year labels, and a subtle gradient background. Three gaps remained from prior analysis.
This record documents the decisions taken to close all three.

### T3-3 — Activity.color Precedence Rule

**Decision:** Mirror Milestone.color precedence exactly.

Precedence chain (highest → lowest):
1. `activity.color` / `milestone.color` (explicit free CSS string on the IR entry)
2. `categoryMap[category]` fill (theme-level category override)
3. `statusMap[status]` fill (theme-level status color)
4. Theme default fill

**Implementation:**
- `vertical-spine.ts`: `resolveStatusStyle(status?, category?, colorOverride?)` — when `colorOverride`
  is set it overrides both `fill` and `stroke` in the returned style object.
- `horizontal.ts`: simple `??` chain: `activity.color ?? catOverride?.fill ?? base?.fill ?? defaultFill`
- Undefined or invalid color strings are passed as-is; if the SVG or Skia renderer rejects them
  they fall back to the theme default transparently (no crash).

### T3-2 — Year-label Typography Token

**Token name:** `fontSizeYearLabel` (added to `TypographyTheme` in `themes/types.ts`)
**Type:** `number` (point size, optional)
**Default:** unset → falls back to `fontSizeAxis` (existing behaviour, zero regression)

When set, `vertical-spine.ts` computes:
```
yearFontPx    = ptToPx(theme.typography.fontSizeYearLabel)
yearFontWeight = 700   (always bold when the token is explicitly set)
```

Geometry constraint at 16pt on a 1200px canvas:
- TICK_LABEL_X = 614px
- Entry-text start (right side) = SPINE_X + CONNECTOR_LEN + BLOCK_INNER_PAD = 668px
- "1967" text width at 16pt ≈ 41.6px → right edge = 655.6px → gap = 12.4px > OVERLAP_EPSILON (4px) ✅

The `ai-timeline` theme sets `fontSizeYearLabel: 16`. All other built-in themes remain unaffected.

### T3-1 — Gradient Background for Vertical Layouts

**Decision:** No new infrastructure required. Use existing `SceneBackground { kind:'gradient' }`.

The `sceneBackground` gradient path was already implemented and production-verified by the
`showcase` theme (Skia backend, cloud + gradient). Enabling it for vertical-spine requires only
that the theme's `canvas.sceneBackground` field be set.

**`ai-timeline` theme declaration:**
```typescript
canvas: {
  sceneBackground: { kind: 'gradient', from: '#EEF0FF', to: '#F8F0FF', angle: 90 },
  backgroundColor: '#F7F8FF',  // SVG fallback
}
```

`angle: 90` → top-to-bottom (cos(90°)=0, sin(90°)=1 in Skia backend). SVG backend ignores
`sceneBackground` per existing contract and uses `backgroundColor` instead.

### New Theme: `ai-timeline`

**File:** `packages/core/src/themes/ai-timeline.ts`
**Fidelity tier:** Tier 2 (Skia art effects, card style, gradient)
**Key tokens:**
| Token | Value |
|-------|-------|
| `entryStyle` | `'card'` |
| `fontSizeYearLabel` | 16 |
| `sceneBackground` | `{ kind:'gradient', from:'#EEF0FF', to:'#F8F0FF', angle:90 }` |
| `backgroundColor` | `'#F7F8FF'` (SVG fallback) |

Vivid status palette tuned for AI-history content:
- planned → #7C3AED (deep violet)
- in-progress → #0EA5A8 (teal)
- done → #2D9E67 (green)
- risk → #D97706 (amber)
- delayed → #E05B5B (red)
- milestone (default) → #5B4FCF (indigo)

### New Fixtures

| File | Purpose | Quality gate |
|------|---------|--------------|
| `examples/gallery/ai-timeline.timeline.yaml` | Gallery discovery; 4 milestones, 4 activities, single track | Scanned; passes all 5 themes × 2 layouts |
| `examples/showcase/ai-timeline.timeline.yaml` | Full T3 dense showcase; 12 milestones, 8 activities, 2 tracks | Not scanned (showcase/ not in quality gate glob) |

The showcase fixture is loaded directly by `skia.test.ts` for the T3 Skia golden.

### Bonus: Horizontal Tick-label Density Fix

Added `tickLabelVisible[]` pre-computation in `horizontal.ts` before the tick loop.
Labels are suppressed when their left edge is within `MIN_TICK_LABEL_GAP` (4px) of the
previous label's right edge. This is a pure deterministic function and does not change
existing rendered output for timelines with adequate tick spacing (all existing goldens unaffected).

### Validation

- `pnpm -C packages/core test` → 486/486 ✅
- `pnpm -r test` → 495/495 ✅
- `pnpm -r typecheck` → clean ✅
- `pnpm -r lint` → clean ✅
- Skia determinism test → unchanged ✅
- Existing theme goldens → unchanged ✅

---

## Decision: Vertical-Spine Even-Spacing Mode (2026-06-11)

**Author:** Barbara (Semantics & Rendering)
**Status:** Shipped

### Problem

The `ai-timeline` fixture spans ~57 years (1967–2024 ≈ 20,800 days) with only ~20 entries.
In the time-proportional spine layout, `pixelsPerDay` hits its hard floor of `0.4`, producing
`hDraw = spanDays × 0.4 ≈ 8,300 px` → canvas 1200×8839 px.  The vast empty space between
sparse entries (e.g. the 18-year gap 1967→1985 with no entries) makes the output unusable.

The target design (T3 AI Timeline) is an **infographic sequence** — years are labels, not
proportional axis positions.  Entries should be equidistant.

### Decision

Add a `spineSpacing?: 'time' | 'even'` token to `ResolvedTheme` controlling how the
vertical-spine layout engine assigns y-coordinates to entries.

#### `'time'` (default, existing behaviour — unchanged)
- Time-proportional: `dateY(ord)` maps ordinals to y via `pixelsPerDay`.
- Min-spacing pass enforces `ENTRY_MIN_SPACING = 100 px` minimum between adjacent nodes.
- All existing themes unaffected; golden outputs byte-identical.

#### `'even'` (new mode, opt-in)
- Entries are placed at **uniform intervals** regardless of temporal gaps:
  ```
  nodeYs[i] = spineTopY + i × evenStep
  ```
- `evenStep = max(ENTRY_MIN_SPACING, maxBlockHeight + BLOCK_VERT_GAP_EVEN)` where
  `BLOCK_VERT_GAP_EVEN = 20 px`.  This guarantees no card overlap.
- The min-spacing pass is **skipped** (entries are already uniformly spaced).
- Canvas height shrinks to `O(nEntries × evenStep)` regardless of time span.

#### Duration bands in `'even'` mode
Activity duration bands (`endKind = 'fixed'`) still render on the spine, but the
end-y coordinate is determined by **`evenDateY`** — linear interpolation between the
even-spaced positions of the two adjacent entries that bracket `endOrd`:

```
t = (endOrd − entries[i].ord) / (entries[i+1].ord − entries[i].ord)
yEnd = nodeYs[i] + t × (nodeYs[i+1] − nodeYs[i])
```

This keeps bands visually meaningful (they still span proportionally between the entries
that bookend the activity's duration) without being time-scaled to the full axis.

Ongoing/TBD activities extend to `finalSpineBottomY - 8` unchanged.

#### Tick labels in `'even'` mode
The standard time-based `vsTicks` loop is **skipped**.  Instead, one year label is
rendered per entry at its sequence y-position, on the **left** side of the spine
(`textAnchor: 'end'` at `SPINE_X − TICK_W − 6`).  Year is derived from
`ordinalToDate(entry.ord)[0]`.  This gives the characteristic "large year on the left"
infographic look matching the T3 target.

#### Other date-mapped elements (today marker, period/bracket annotations, callout notes)
All use `effectiveDateY(ord)` which delegates to `evenDateY` in even mode and `dateY`
in time mode.  This ensures annotations remain positioned at semantically correct
(interpolated) y-coordinates.

### Degenerate cases

| Case | Behaviour |
|------|-----------|
| 0 entries | `hDraw = 200 px`, "No entries in time range" message, spine renders normally |
| 1 entry | `evenStep = ENTRY_MIN_SPACING`, single entry at `spineTopY` |
| Entries at same ordinal | Sorted by id (stable), placed at consecutive even positions (no collision) |
| Activity without duration (`endKind = 'none'`) | No band drawn (unchanged) |
| Activity with `endOrd < firstEntry.ord` | `evenDateY` clamps to `spineTopY` |
| Activity with `endOrd > lastEntry.ord` | `evenDateY` clamps to last entry's y |

### Token placement

`spineSpacing` is declared in `ResolvedTheme` (themes/types.ts) alongside `entryStyle`
and `sceneBackground` — the other vertical-spine-specific tokens.

### Themes opting in

Only `ai-timeline` sets `spineSpacing: 'even'`.  All other themes omit the token
(→ default `'time'`, byte-identical output).

### Result

| Metric | Before | After |
|--------|--------|-------|
| Canvas height (ai-timeline showcase) | 8839 px | 2370 px |
| Tests | 486 / 486 | 486 / 486 |
| Existing goldens changed | — | 0 (only ai-timeline-ai-theme-skia.png) |
| typecheck | ✅ | ✅ |
| lint | ✅ | ✅ |
# Decision: Vertical-Spine Gap Compression + spineSpacing Render Option

**Date:** 2026-06-11  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Shipped

---

## Problem

Sparse long-span timelines (e.g. 1967–2024 with ~8–20 entries) produce absurdly tall canvases
when rendered with any theme that uses the default 'time' spacing mode.  Root cause: the
`pixelsPerDay` floor is 0.4, so `hDraw = spanDays × 0.4 = 8328 px` for a 57-year fixture.
The minimum-spacing pass only grows positions — it cannot compress empty multi-decade gaps.

This affected every gallery render of `ai-timeline.timeline.yaml` that was NOT using the
`ai-timeline` theme (which already had `spineSpacing: 'even'` from the previous session).
Confirmed giant files: `ai-timeline-showcase-skia.png` (8762 px), `ai-timeline.png` (8732 px),
`ai-timeline.svg` (8760 px).

---

## Decision A — Gap Compression in 'time' Mode (Robustness Guard)

**File:** `packages/core/src/layout/vertical-spine.ts`

Add an automatic gap-compression pass to 'time' mode that fires ONLY when the average
time-proportional spacing per entry exceeds a threshold:

```
isGapCompressed = !isEvenSpacing && nEntries > 1
               && hDrawTime / nEntries > GAP_K_TRIGGER × ENTRY_MIN_SPACING
```

Constants: `GAP_K_TRIGGER = 4` (400 px), `GAP_K_CAP = 2` (200 px).

When triggered, each consecutive raw gap is capped:
```
nodeYs[i] = nodeYs[i-1] + min(rawNodeYs[i] - rawNodeYs[i-1], 200)
```

`hDraw` for gap-compressed mode is set from the final `nodeYs` (not `hDrawTime`), so the
canvas height is proportionally compact.  `effectiveDateY` delegates to `evenDateY` (piecewise
linear between entry positions) in both even and gap-compressed modes, keeping all derived
primitives (ticks, sections, annotations) geometrically consistent.

**Determinism contract:** Normal timelines whose average ≤ 400 px/entry produce zero change.
Verified by checking all gallery fixtures (avg ≤ 100 px/entry) and the committed SVG golden
(`examples/golden/our-timeline.svg`) which remains byte-identical.

---

## Decision B — spineSpacing as a Render Option

**File:** `packages/core/src/types.ts`, `packages/core/src/render/index.ts`

Added `spineSpacing?: 'time' | 'even'` to `RenderOptions`.  When set, it overrides the theme's
own `spineSpacing` declaration:

```typescript
if (options?.spineSpacing !== undefined) {
  theme = { ...theme, spineSpacing: options.spineSpacing };
}
```

This allows callers to force even spacing for any fixture/theme combination without modifying
the IR or the theme, satisfying the "render-level option preferred" principle.

**Gallery/showcase wiring:**
- `skia.test.ts` showcase gallery spec for `ai-timeline.timeline.yaml`: `spineSpacing: 'even'`
  added so the showcase PNG is always compact regardless of theme.
- `quality.test.ts`: new "Gallery emit" section writes `examples/gallery/ai-timeline.svg` and
  `examples/gallery/ai-timeline.png` with `{ theme:'consulting', spineSpacing:'even' }` so
  these committed gallery files are always regenerated compact.

---

## Before → After Heights

| File | Before | After |
|------|--------|-------|
| `examples/gallery/ai-timeline.png` | 8732 px | **990 px** |
| `examples/gallery/ai-timeline.svg` | 8760 px | **990 px** |
| `examples/gallery/showcase/ai-timeline-showcase-skia.png` | 8762 px | **1076 px** |
| `examples/gallery/showcase/ai-timeline-ai-theme-skia.png` | 2370 px | 2370 px (no change) |

---

## Test Results

- `pnpm -C packages/core test`: **488/488 pass**
- `pnpm -r typecheck`: clean
- `pnpm -r lint`: clean
- `examples/golden/our-timeline.svg`: byte-identical (golden.test.ts passes)
- `examples/golden/showcase-skia.png`: size-identical (skia golden passes)

---

## Decision: T5 Gaps Closed — CTA Button + Inline Date Icon (Barbara, 2026-06-11)

# Decision: T5 Gaps Closed — CTA Button + Inline Date Icon

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-11  
**Status:** CLOSED  
**Targets closed:** T5-1 (CTA button rendering), T5-2 (Inline date icon)

---

## Context

Target T5 ("Gitline Cards") was partially renderable (vertical-spine + card entryStyle + dark theme all existed). Two gaps remained that prevented the "VIEW REPOSITORY" button and clock-icon+date line from rendering.

---

## Decision 1: CTA Button Token Design (T5-1)

### Problem
Need a pill-shaped action button at the bottom of card entries with `url` field. Must not appear on existing card themes (showcase, ai-timeline, etc.) — byte-identical output required.

### Decision
Added opt-in tokens to `ResolvedTheme` (all default to `undefined` = no button):

| Token | Type | Default | Purpose |
|-------|------|---------|---------|
| `cardCtaLabel` | `string?` | `undefined` | Button label; gates the feature (no label → no button) |
| `cardCtaFill` | `string?` | `'transparent'` | Pill background fill |
| `cardCtaTextColor` | `string?` | `milestone.titleLabelColor` | Label text colour |
| `cardCtaBorderColor` | `string?` | `ctaTextColor` | Pill outline stroke |
| `cardCtaBorderWidth` | `number?` | `1` | Outline stroke width |
| `cardCtaRadius` | `number?` | `floor(btnH/2)` | Corner radius (default = true pill) |

### Gate condition
`hasCta(e) = entryStyle === 'card' && !!theme.cardCtaLabel && !!entry.url`

Both the `blockH()` function and the `evenStep` pre-calculation loop check this condition so card height accounting is always consistent and overlaps are prevented.

### Layout dimensions
- `CTA_BTN_H = rhuInt(datePx * 2.0)` ≈ 26 px at 10pt axis font
- `CTA_VERT_GAP = 8` px (gap above button)
- Button width = `min(BLOCK_W - 2×BLOCK_INNER_PAD, ceil(label.length × ctaBtnFontPx × 0.58) + 20)`, minimum 80 px
- Button text centred horizontally and vertically within pill

### Rendering
Pill = `ScenePrimitive { kind:'rect', rx:btnRx, fill:ctaFill, stroke:ctaBorderColor }` + `ScenePrimitive { kind:'text', textAnchor:'middle' }`. SVG and Skia render identically via the shared primitive pipeline.

---

## Decision 2: Inline Date Icon Token (T5-2)

### Problem
Date line in card entries is text-only. T5 target shows a small clock icon inline before the date text, same visual baseline.

### Decision
Added `cardDateIcon?: string` to `ResolvedTheme`. When set to a known icon name (e.g. `'clock'`), the layout engine:
1. Renders the icon paths at the leading edge of the date line (before the text in reading direction)
2. Shifts the date text anchor away by `DATE_ICON_SZ + DATE_ICON_GAP`

### Implementation details
- `DATE_ICON_SZ = rhu(datePx * 0.9)` — icon diameter ≈ date font cap-height
- `DATE_ICON_GAP = 4` px
- Icon transform: `translate(cx, cy) scale(s) translate(-12,-12)` where `s = iconR/12` (maps 24-unit viewBox to icon diameter)
- For 'start' anchor (right-side cards): icon center x = `textX + iconR`, date text x = `textX + iconSz + gap`
- For 'end' anchor (left-side cards): icon center x = `textX - iconR`, date text x = `textX - iconSz - gap`
- Icon color = `theme.milestone.dateLabelColor` (same as date text)
- Uses existing `getIcon()` / path-primitive pipeline — no new Scene primitives needed

---

## Decision 3: Gitline Theme + Fixture

**Theme file:** `packages/core/src/themes/gitline.ts`  
**Theme id:** `'gitline'` (registered in `themes/index.ts`)  
**Tier:** 2

Key settings:
```
canvas.backgroundColor: '#0A1628'   // dark navy
entryStyle: 'card'
spineSpacing: 'even'
cardCtaLabel: 'VIEW REPOSITORY'
cardCtaFill: 'transparent'
cardCtaTextColor: '#9DBDD8'
cardCtaBorderColor: '#9DBDD8'
cardDateIcon: 'clock'
effects: { cardEffects: [shadow], nodeEffects: [glow] }
```

**Fixture:** `examples/gallery/gitline.timeline.yaml`  
6 milestone entries with `url` fields. Short title `"Releases"` to avoid linter LABEL_OVERLAP: a centered header title at 22pt (29px) renders a bbox ~392px wide, which horizontally overlaps the first right-side card's date text (starting at x≈684) when the title text exceeds ~168px width. Short title avoids this.

**Golden:** `examples/gallery/showcase/gitline-skia.png` (1200×1008 px, Skia backend)

---

## Regression Safety

All new tokens default to `undefined`. The gate conditions (`ctaLabel && entry.url`, `dateIconName && entryStyle==='card'`) mean existing themes produce byte-identical scenes: no new primitives, no blockH changes, no layout perturbations.

Quality conformance gate (all 14 gallery files × 5 themes × 2 layouts = 140 combinations) passes with zero errors including the new gitline fixture.

---

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/themes/types.ts` | Added 7 new optional tokens to ResolvedTheme |
| `packages/core/src/layout/vertical-spine.ts` | SpineEntry.url, blockH/evenStep CTA accounting, T5-1 button render, T5-2 date icon render |
| `packages/core/src/themes/gitline.ts` | New theme file |
| `packages/core/src/themes/index.ts` | Registered 'gitline' |
| `examples/gallery/gitline.timeline.yaml` | New fixture |
| `packages/core/test/skia.test.ts` | T5 Gitline describe block (5 tests) |
| `examples/gallery/showcase/gitline-skia.png` | New golden (1200×1008 px) |
