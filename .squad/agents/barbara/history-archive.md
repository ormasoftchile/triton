# Barbara — Archive of Earlier Work

---

## 2025 — Even-Horizontal Layout Mode (Barbara)

**Date:** 2025  
**Status:** SHIPPED

### Problem Solved

Mermaid `timeline` diagrams (e.g., "History of Programming Languages" — 13 periods 1954–2014) rendered in horizontal layout with time-proportional spacing produced label collisions: 1954/1958/1960 are clustered within 6 years out of a 60-year span, so their milestone circles and label blocks overlapped. Real Mermaid uses **evenly-spaced columns** (Mermaid-columnar), not proportional time.

### Approach: Even-Spacing Mode for Horizontal Layout

Mirrored the existing `isEvenSpacing` pattern from `vertical-spine.ts` (lines ~418–560). Key changes in `packages/core/src/layout/horizontal.ts`:

1. **`W` and `wDraw` changed from `const` to `let`** — enables canvas expansion when N milestones × MIN_COL_W exceeds the theme's default width.
2. **`evenXPositions` array** — precomputed after `msWithOrd.sort(...)`. Each milestone gets `offset + ms.size + i * evenColW` (with `ms.size` padding on each side so node circles stay within canvas bounds). If `(N-1) * evenColW + 2*ms.size > wDraw`, the canvas expands.
3. **`evenDateX(ord)`** — interpolates x for activities and section bands between adjacent milestone ordinals (mirrors `evenDateY` from vertical-spine).
4. **`effectiveDateX(ord)`** — returns `evenDateX(ord)` in even mode, `dateX(ord, axisState)` in time mode. Applied to all activity x-coords, section band x-coords, today-marker, annotations, callouts.
5. **Axis tick suppression** — in even mode the time-proportional ruler is suppressed (`if (!isEvenSpacing)`) because tick positions would not correspond to the evenly-spaced columns. Milestone label blocks carry the actual period dates.
6. **Section bands** — in even mode, derived from track-member milestone positions padded by `evenColW/2`, clamped to `[offset, offset+wDraw]`. This creates clean flush column bands.

### Key Constants

- `EVEN_MIN_COL_W = 100` px (minimum column width to prevent label collisions)
- Padding = `ms.size` (milestone node radius) on each side

### Determinism Contract

The even path is gated on `theme.spineSpacing === 'even'`. All existing themes that don't set this token are completely unaffected — their golden outputs are byte-identical. Verified: 1083/1083 tests pass.

### Output: mermaid-timeline.svg

- **ViewBox:** 1296×791.86 (expanded from 1200×792 default; 1256px draw width for 13 milestones × 100px columns)
- **13 milestones** evenly spaced at cx = 28, 128, 228, ..., 1228 (100px apart, 28px padding on edges)
- **4 section bands** correctly partitioned: Foundations [0,278], Systems Era (odd, transparent), Scripting Wave [578,878], Modern Languages (odd, transparent)
- No label collisions; all period labels visible and separated

### Key Files

- `packages/core/src/layout/horizontal.ts` — Even-horizontal mode implementation
- `packages/core/src/themes/types.ts` — Updated `spineSpacing` doc comment (now applies to horizontal too)
- `packages/core/src/frontend/mermaid/index.ts` — Already passes `spineSpacing: 'even'` for timeline kind (line ~345)
- `packages/core/src/render/index.ts` — `buildScene` already threads `spineSpacing` into theme (line ~70)
- `examples/gallery/mermaid-timeline.svg` — Regenerated (1296×791.86)
- `examples/gallery/mermaid-timeline.png` — Regenerated (~98KB)

**Date:** 2026-06-14T00:10:54Z  
**Status:** LIVE

Mermaid flowchart parser (Tier 0 Inc 1) now renders via existing dark-flow theme.
Rendered gallery example (CI/CD pipeline) visibly cleaner than Mermaid default output — achieved explicit project pitch criterion ("prettier than Mermaid").

**Theme coverage:** flowchart + sequence + tree + timeline all support dark themes; composition layer resolves per-cell theme inheritance. Next: UML family themes (class, state, ER, C4).

**Tier 0 COMPLETE (2025-01-01):** Even-spacing horizontal timeline (9233px→792px, collisions resolved) finalized. Tier 0 integration complete.

---

## 2026-06-13 — Tier 1 Kickoff: classDiagram Rendering via Scene Paths

**Date:** 2026-06-13T22:59:00Z  
**Status:** SHIPPED

Class grammar (UML software line) shipped with deterministic 2-column layout. All 6 UML relationships rendered as Scene path primitives (inheritance, realization, composition, aggregation, association, dependency) to preserve SVG/PNG/Skia backend compatibility. Class compartments (attributes, methods) sized via measureText(). Light+dark themes supported. Next: state, ER, C4 grammar rendering.

---

## Learnings — 2026-06-13 — Tier 1: classDiagram Implementation

**Date:** 2026-06-13T21:43:20Z  
**Status:** COMPLETE

### Pattern: Grammar-Driven Theme Architecture

Class diagram IR fully independent of rendering. Theme defines all positioning, colors, padding. Adding a new class theme requires only: grammar schema validation, measureText() loop for compartments, grid placement, and path primitives — no changes to class IR or parser.

**Example:** `lightClassTheme` (white background, black text) and `darkClassTheme` (#1F2937 boxes, white text) use identical layout code; only token values differ.

### Path Primitives for UML Markers

All six UML relationships rendered as Scene `path` primitives:
- Inheritance: hollow triangle tip → `path (polygon)`
- Realization: hollow triangle (dashed edge) → `path + dashed`
- Composition: filled diamond → `path (diamond)`
- Aggregation: hollow diamond → `path (diamond outline)`
- Association: open arrow → `path (simple line + arrowhead)`
- Dependency: dashed arrow → `path (dashed + arrowhead)`

No backend-specific code; SVG and PNG both interpret `path` correctly. Preserves Skia/canvas/WebGL compatibility.

### Determinism: Grid Placement + Compartment Sizing

- Grid assignment: declaration order → 2-column left-fill
- Compartment sizing: `measureText()` for each line (attributes, methods) → height sum
- Coordinate rounding: `rhuInt()` for all x, y, width, height
- Padding: fixed theme tokens (classNamePadX, classBodyPadY, etc.)

Result: byte-identical goldens across platform/font implementations (as verified by jest snapshot tests).

---

# Barbara — Layout Specialist

**Owner:** Barbara (Layout & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-14T19:24:39Z

---

## Current Status

**Tier 2 Foundation Complete:** Grammar-of-graphics chart layer shipped. Scales (LinearScale, BandScale), axes, marks, deterministic layout engine with priority-based label collision avoidance. First two chart types operational: pie + xychart-beta (bar+line). 1361 tests passing, all pre-existing regressions zero.

**Gallery:** mermaid-pie.png + mermaid-xychart.png (920×560), cards 33+34.

**Commit:** 5b709cf "feat(mermaid): Tier 2 kickoff — grammar-of-graphics + pie + xychart"

---

## Key Capabilities

- **Deterministic Rendering:** All geometry from direct arithmetic, `rhuInt()` rounding, no iterative solvers
- **Theme-Driven Architecture:** Grammar IR independent of rendering; external style via theme tokens
- **Two-IR-Layer Model:** Domain IR → Scene IR (universal kernel)
- **Shared Foundation Pattern:** Grammars reuse scale/axis/mark infrastructure

---

## Shipped Grammars

| Grammar | Status | Tests |
|---------|--------|-------|
| Timeline | SHIPPED | 551+ |
| Sequence | SHIPPED | 611+ |
| Tree | SHIPPED | 630+ |
| Flow | SHIPPED | 741+ |
| Composition | SHIPPED | 735+ |
| **Chart** | **SHIPPED (Tier 2)** | **1361 total** |
| Class (UML) | SHIPPED | 1281 |
| State (UML) | SHIPPED | 1281 |
| ER (UML) | SHIPPED | 1281 |
| C4 (UML) | SHIPPED | 1281 |

---

## Tier 2 — Chart Foundation Architecture

### ChartDocument (Domain IR)

Semantic chart intent: data rows, field encodings, lightweight config. Maps Mermaid syntax into unified structure for all chart families.

### Scales

- **LinearScale:** continuous numeric domain → pixel range, nicening for axis ticks
- **BandScale:** categorical domain → pixel bands with padding

### Layout Engine

- **Priority-based label placement:** largest slices first, inside when roomy, outside for small/conflicting, leader lines for spillover
- **Tick-label crowding:** deterministic skipping based on measured label width vs available space
- **No iterative solvers:** all geometry derives from direct arithmetic

### Scene IR Output

Existing primitives only: `rect`, `line`, `circle`, `text`, `path`. Serializers unchanged.

---

## Recent Milestones

### Tier 1 Complete (2026-06-14)

All four UML/Software-line types shipped: classDiagram, stateDiagram, erDiagram, C4. 1281 tests, determinism verified, gallery outputs finalized.

**Key layouts:**
- Class: 2-column deterministic grid
- State: rank-based skip-transition side routing + adjacent-label placement (skip-labels in left margin)
- ER: degree-sort + interleaved grid placement
- C4: top-level grid + boundary nesting, orthogonal edge routing with port distribution, edge labels clear of boxes

### Tier 2 Started (2026-06-14)

Chart grammar-of-graphics foundation + pie + xychart-beta. Foundation ready for quadrant + radar (only dispatch branch per type).

---

## Deferred / Known Limitations

- Quadrant + radar chart types (reuse foundation)
- Flow Inc-3+: Force-directed layout, stress-majorization
- Tree Inc-2+: Forest support, shape variation
- Composition Inc-2+: Scale policy modes, advanced URI schemes
- ER follow-up: Same-column side-routing for edge labels

---

## Archive

For detailed learnings from earlier work (2025 timeline polish, grammar-of-graphics, Tier 1 polish), see archived history files.

---

## Tier 2 Complete — quadrantChart + radar/radar-beta (2026-06-14)

Completed the remaining Tier 2 chart types on the shared chart grammar foundation.

### Shipped
- `quadrantChart`: normalized `[0,1] × [0,1]` plot with tinted quadrants, semantic Low/High axis endpoints, quadrant region labels, and deterministic point-label collision handling.
- `radar` / `radar-beta`: explicit spoke axes, concentric polygon graticules, normalized radial scaling via closed-form `RadialScale`, multi-series filled/stroked polygons, and internal legend.

### Parser learnings
- `radar` needs syntax auto-detection: if `axes:` is absent but `axis`/`curve` markers appear, treat it as beta-style content rather than simple syntax.
- Beta curves can appear before axis declarations; preserve indexed values temporarily (`_axisN`) and backfill once axis names arrive.

### Rendering learnings
- Current `PathPrimitive` lacks separate `fillOpacity` and `strokeLinejoin`; the stable pattern is **two paths per radar polygon**: one translucent fill-only path and one stroke-only path.
- Quadrant labels and point annotations can reuse the existing pie label-box helpers for deterministic overlap avoidance without introducing a new solver.

### Verification
- `pnpm -C packages/core build` ✅
- `pnpm -C packages/core typecheck` ✅
- `pnpm -C packages/core test` ✅
- Gallery outputs generated: `examples/gallery/mermaid-quadrant.{mmd,svg,png}` and `examples/gallery/mermaid-radar.{mmd,svg,png}`

---

## Learnings

### Quadrant margin / edge-aware label placement (2026-06-14)

- **Y-axis end labels need ≥ 110 px left reserve.** With 12 px DejaVu Sans, a 15-char label like "High Engagement" measures ≈ 97 px wide. The label is anchored at `plotX − 8` with `textAnchor="end"`, so left clearance = `plotX − 8 − labelWidth`. Anything under ~113 px for `plotX` clips the left edge of the canvas.
- **Priority placement must check plot-boundary proximity, not just mutual label overlap.** An item at x ≈ 0.81 in a 378 px plot (px ≈ 448) lands within 6 px of the plot's right edge when the first right-side candidate is selected. Adding `EDGE_MARGIN = 6` to the boundary check and skipping candidates that would land within that margin of either horizontal plot edge prevents subtle clips that the mutual-overlap test alone cannot catch. Fallback path must mirror this: prefer the left-side anchor when the right-side placement would exceed `plotRight − EDGE_MARGIN`.
## 2026-06-14 — Tier 3 Started

Tier 3 started (journey/gitGraph). journey: horizontal score-ramp with section bands + actor legend. gitGraph: per-branch lanes with merge curves, tags, commit types. 1503/1503 tests ✓. Commit a2a1b37. Remaining Tier 3: sankey (in progress), then breadth.

---

## 2026-06-14 — Sankey Grammar (Tier 3) Complete

### Summary
Sankey (proportional-flow diagram) shipped as a full Tier 3 grammar. 1540/1540 tests passing.
Gallery: `examples/gallery/mermaid-sankey.{mmd,svg,png}` — 964×544 px energy-flow, card 39.

### Files
- `packages/core/src/grammars/sankey/{types,schema,theme,layout,index}.ts`
- `packages/core/src/frontend/mermaid/sankey.ts` (Mermaid CSV parser)
- `packages/core/test/mermaid-sankey-corpus.test.ts` (34 cases)
- `examples/gallery/mermaid-sankey.mmd` (16-link energy-flow example)
- `examples/gallery/index.html` (card 39 added)
- `.squad/decisions/inbox/barbara-tier3-sankey.md`

### Learnings

#### Sankey Topological Layering (2026-06-14)

- **Algorithm:** Iterative longest-path from sources. Start all nodes at rank 0. For each link `src→tgt`: if `rank(tgt) ≤ rank(src)`, set `rank(tgt) = rank(src)+1`. Repeat until stable. Process links in declaration order — this gives a stable, deterministic result.
- **Cycle guard:** Per-node pass counter capped at `N` (number of nodes). Once a node has been updated N times, its back-edges are skipped with a warning. Deterministic because we process in stable link order.
- **Why not crossing-minimization:** Classic barycenter/median heuristics are iterative and floating-point-dependent. Violates the determinism contract (§5.1). First-appearance stable order is reproducible and visually clean for Mermaid's typical sankey-beta datasets.

#### Value→Pixel Scale (2026-06-14)

- **Closed-form:** `scale_c = (contentHeight - totalGapsInColumn) / columnThroughput` for each column. Final scale = `min(scale_c)` so the tallest column exactly fills `contentHeight`.
- **Throughput per node:** `max(totalInFlow, totalOutFlow)` — uses the dominant flow direction, matching real Sankey conventions where losses can be smaller than sources.
- **Degenerate case:** If all values are zero, scale defaults to `nodeBarMinHeight` so nodes are still visible as minimal bars.

#### Ribbon Bézier Approach (2026-06-14)

- Each ribbon is a **closed path**: top cubic Bézier (source-right→target-left), bottom cubic Bézier (target-left→source-right), closed with `Z`.
- Control points at `x1 + (x2-x1)/3` and `x1 + 2*(x2-x1)/3` — symmetric S-curve, works well for all column distances.
- Ribbon stacking uses `outY`/`inY` offsets per node edge (simple integer accumulation in link-declaration order). This prevents ribbon overlap within a node's band.
- Fill = source node color from palette; opacity 0.45; thin stroke 0.5px for boundary visibility.

#### Label Placement (2026-06-14)

- Leftmost column: labels to the left (`textAnchor: end`); flip right if clipping left canvas edge.
- Rightmost column: labels to the right (`textAnchor: start`); flip left if clipping right canvas edge.
- Middle columns: default right; flip left if clipping.
- Label reserve of 160px each side ensures labels never clip for typical Mermaid node names.
- No iterative label-collision resolution needed: stacked bars in stable order and side-anchoring prevent overlap.

#### CSV Tokenizer (2026-06-14)

- RFC 4180-ish: quoted fields (double-quotes), commas inside quotes, escaped quotes (`""` → `"`).
- Unquoted fields: split on comma, trim whitespace.
- Malformed (unclosed quote, wrong field count, non-numeric value, negative value) → warn + skip row.
- All valid rows accumulate normally; no crash on bad input.


---

## Learnings — gitGraph topology layout (2026-06-14)

### Branch topology rendering (fidelity fix)

**Problem:** The original gitGraph layout drew flat full-width parallel rails (each lane from laneStartX to laneEndX) with disconnected branches. This produced a "timeline with dangling curves" look, not a git graph.

**Fix:** `packages/core/src/grammars/gitgraph/layout.ts` — full topology-aware rework.

#### Branch lane extents (§ topology-faithful lanes)

Each branch's horizontal line now spans only from its **first commit** to its **last commit** in document order. Empty branches get a 2-px stub so lane-existence tests continue to pass. Primary branch (laneIndex 0 / main) follows the same rule — its line starts at the first commit and ends at the last.

#### Branch-off connectors (§ branch creation topology)

A cubic "subway-map" S-curve is drawn from the **branch-off parent commit** (on the parent lane) to the **first commit on the child lane**, colored with the child branch color.

**IR gap discovered:** The Mermaid gitGraph parser stores `parents=[]` on the first commit of a freshly-created branch (because `lastCommitByBranch.get(newBranch)` is undefined at creation time). The layout derives the branch-off parent by scanning backwards in document order from `firstChildCommitIndex - 1` for the last commit on a different branch. This heuristic is exact for all standard Mermaid gitGraph patterns.

#### Merge connectors

Same cubic S-curve formula applied to merge commits: from `sourcePC` (parents[1]) to the merge commit. `cubicBezierPath(x0, y0, x1, y1)` = `M x0 y0 C x0 midY x1 midY x1 y1` where `midY = (y0+y1)/2`. Works for both down (branch-off) and up (merge) directions.

#### Hollow merge commits

Merge commits (`isMerge: true`) rendered as circles with `fill: tk.background` + thick colored stroke (`commitStrokeWidth + 2`).

#### HIGHLIGHT commits as squares

`type: HIGHLIGHT` commits rendered as a filled `RectPrimitive` (side = `commitRadius * 2.2`, rx=2) with `fill: tk.highlightFill`. Two test assertions updated: `primitive.kind === 'circle'` → `primitive.kind === 'rect'` for HIGHLIGHT; `primitive.kind === 'rect'` → `primitive.kind === 'path'` for tag callout.

#### Tag callouts (triangle pointer)

Tags use a `PathPrimitive` shaped as a rounded rectangle with a downward-pointing equilateral-ish triangle (`tagCalloutPath`). Triangle tip touches `positioned.y - tk.tagOffsetY`. Body center Y = `tipY - tipH - bodyH/2`.

#### Colored branch-label pills

Branch labels are now colored `RectPrimitive` pills (`rx = pillHeight/2` → fully rounded) with white text, replacing plain text. Pill width sized to `measureText(name) + 2*pillPadX`.

### File paths
- `packages/core/src/grammars/gitgraph/layout.ts` — full rewrite
- `packages/core/src/grammars/gitgraph/theme.ts` — branchStrokeWidth 3→4, branchLaneSize 84→88
- `packages/core/test/mermaid-gitgraph-corpus.test.ts` — 2 assertion updates + empty-branch note
- Gallery: `examples/gallery/mermaid-gitgraph.{svg,png}` — viewBox `0 0 1152 448`

### Test result: 1540/1540 ✓ (all pre-existing non-gitgraph goldens byte-identical)

---

## 2026-06-14 — Mindmap Radial Layout

### Summary

Replaced the flat top-down tree render for mindmap with a genuine radial/organic layout matching Mermaid's mindmap style. The new layout is ADDITIVE and OPT-IN — the default `layoutTree` (Buchheim-Jünger-Leipert tidy tree) is completely unchanged; all existing tree/other goldens are byte-identical.

### Learnings

#### Radial tree layout: sector subdivision (2026-06-14)

**Core algorithm:**
1. **Equal sectors for top-level branches:** Divide 2π evenly among all children of root. For 4 branches this places centers at 45°/135°/225°/315° — the four quadrant centers — matching Mermaid's layout exactly (startAngle=0°, i.e. rightward, going clockwise).
2. **Leaf-weighted sub-sectors for deeper nodes:** Within each branch's angular wedge, subdivide proportional to subtree leaf count. `countLeaves(node)` = 1 if leaf, else sum of children's leaf counts. Gives proportional spacing: dense sub-trees get wider wedges.
3. **Radius ∝ depth:** `r(d) = 170 + (d−1) × 130` for d ≥ 1 (root at center, r=0). Gives 170 px for depth-1, 300 for depth-2, 430 for depth-3.
4. **Dynamic root circle radius:** `rootR = max(44, halfTextWidth + 18)` based on `measureText(label, 13)`. Fits any label inside the root circle.

**Determinism:** Pure closed-form arithmetic over tree structure + sibling order. No iteration, no random seeding, no convergence criterion. `rhuInt(v) = Math.floor(v + 0.5)` for integer coordinates.

#### Radial tree layout: d3-linkRadial Bézier connectors (2026-06-14)

**Formula (L1+ → deeper edges):**
```
CP1 = (CENTER_X + r_child * cos(parent.angle),  CENTER_Y + r_child * sin(parent.angle))
CP2 = (CENTER_X + r_parent * cos(child.angle),  CENTER_Y + r_parent * sin(child.angle))
path: M px py C cp1x cp1y cp2x cp2y cx cy
```

**Key property:** Tangent at start ∥ parent's radial direction; tangent at end ∥ child's radial direction. This matches d3's `linkRadial()` and produces the organic curves seen in real Mermaid mindmaps.

**Root → L1 special case:** Since root has r=0 (no radial direction), use control points along the child's angle: `cp1 = 0.35 × r_child`, `cp2 = 0.78 × r_child`. Creates a smooth outward curve from center.

#### Branch coloring (2026-06-14)

- Per-top-level-branch palette of 8 entries, cycling for larger trees.
- Branches inherit their index (0-based among root's children); descendants carry the same `branchIndex`.
- Each palette entry: `{ fill, edge, stroke, text }` — fill for node background, edge for connector, stroke for node border (1px crispness bonus over Mermaid), text for label.
- Palette designed to match Mermaid's actual 4-branch colors (warm yellow, yellow-green, soft purple, warm pink) in order.

#### Opt-in/additive architecture (2026-06-14)

- **New file:** `packages/core/src/grammars/tree/layoutRadial.ts` — exports only `layoutTreeRadial(doc: TreeDocument): Scene`. Zero imports from the default `layout.ts`.
- **Minimal index additions:** `import { layoutTreeRadial }` + `export { layoutTreeRadial }` + `renderTreeDocumentRadial()` added to `packages/core/src/grammars/tree/index.ts`.
- **Minimal mermaid/index.ts change:** Mindmap branch now calls `renderTreeDocumentRadial(finalDoc, { format })` instead of `renderTreeDocument + buildTreeScene + resolveTreeTheme`. Old tree imports (`buildTreeScene`, `renderTreeDocument`, `resolveTreeTheme`) removed since only mindmap used them.
- **All pre-existing goldens byte-identical:** `tree-document.svg/png`, all other grammar goldens unchanged. Only `mermaid-mindmap.svg/png` updated.

#### Canvas sizing for radial mindmap (2026-06-14)

- Canvas: 1400 × 1000, center (700, 500). Gives 300px horizontal margin and 70px+ vertical margin for depth-3 nodes at r=430.
- Formula to check: for any leaf at r=430 going directly up/down, y = 500 ± 430 = 70 or 930. Node half-height ≈ 15px → margin ≥ 55px. For any leaf going left/right, x = 700 ± 430 ≈ 270–1130. Longest label half-width ≈ 55px → margin ≥ 215px.
- viewBox: `0 0 1400 1000`.

### File paths

- `packages/core/src/grammars/tree/layoutRadial.ts` — new, radial layout engine
- `packages/core/src/grammars/tree/index.ts` — additive: import, export, `renderTreeDocumentRadial`
- `packages/core/src/frontend/mermaid/index.ts` — mindmap branch switches to radial
- `examples/gallery/mermaid-mindmap.{svg,png}` — re-emitted with radial layout

### Test result: 1540/1540 ✓ (all pre-existing tree grammar goldens byte-identical)

---

