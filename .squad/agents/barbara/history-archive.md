# Barbara — Archive of Earlier Work

---

## Archived 2026-06-24 by Scribe — VS Code extension Phase 1 + Queue family (2026-06-23)

> Moved out of `history.md` to keep it under the size gate. Both are also captured in `.squad/decisions.md` (the "VS CODE EXTENSION — Phase 1" and "QUEUE DIAGRAM FAMILY" blocks). Durable facts retained here.

### VS Code extension (Phase 1 live preview) — `extension/` satellite

- **Files:** `extension/package.json` (name `triton-vscode`, private, `main: ./dist/extension.cjs`, no `type` field, `engines.vscode ^1.90.0`), `extension/esbuild.mjs` (bundler + `.js`→`.ts` plugin + `build:grammars` precondition), `extension/src/extension.ts` (activate + `PreviewManager` + webview HTML, one file), `extension/tsconfig.json` (typecheck-only, `noEmit`), `README.md`, `.gitignore`.
- **render() Result shape:** `render(text) → Promise<Result<string>>`, `Result = {ok:true,value} | {ok:false,error:{code,message,cause?}}`, NEVER throws. Import path from `extension/src/extension.ts` is `../../src/frontend/index.js`. Returns a ~2956-byte `<svg…` for examples/flowchart.
- **esbuild `.js`→`.ts` plugin:** `onResolve({filter:/\.js$/})` → resolve to sibling `.ts` IF it exists, else return `undefined` so esbuild handles the REAL generated Peggy `parser.js` (no `.ts` sibling). Bundling from `src/` (not `dist/`) inlines parsers and sidesteps the tsc-doesn't-copy-parser.js dist-sync hack. Output ≈1.1 MB CJS (+2.2 MB map), build ~85ms, exit 0.
- **build:grammars precondition:** `esbuild.mjs` runs `pnpm build:grammars` in repo root first (23 grammars), then verifies every `grammar.peggy` has a sibling `parser.js`, failing loudly otherwise.
- **TS gotcha:** CJS `extension.ts` statically importing ESM compiler source trips **TS1479** under NodeNext → use `moduleResolution:"Bundler"` + `module:"ESNext"` (typecheck-only; esbuild is the real bundler). typecheck = 0 errors.
- **deps:** esbuild + @types/vscode + @types/node + typescript via `pnpm install --ignore-workspace` (extension is NOT a workspace member — keeps repo flat).
- **Mermaid coexistence (LOCKED):** `.triton`/```` ```triton ```` always handled; explicit Open Preview renders ANY active file unconditionally; passive Mermaid (`.mmd`/```` ```mermaid ````-in-markdown) gated behind `triton.enableMermaid` (default false); Phase 1 never auto-opens. Logic in `pickRenderable(document, config, mode)`.
- **Sandbox quirk:** VS Code terminal sandbox re-quotes `!` → `\!` inside heredocs — avoid `!` in heredoc'd JS (use `=== false`).

### Queue family (queue / cqueue / deque / pqueue) — PR #17, 337 tests

- **The struct family does NOT use peggy.** Each kind is ONE self-contained file under `src/diagrams/queue/` hand-parsing with the `lines()` helper → `parse()` → `layout*()` → `export const <kind>: DiagramModule`. Only flowchart/timeline/poster own `parser.js`. Files: `src/diagrams/queue/{shared,queue,cqueue,deque,pqueue}.ts`; `shared.ts` re-exports `lines` from `../struct/shared.js` + owns the arrowhead markers + `pointerBelow()`.
- **One header per variant** (content-detectable): `queue`/`cqueue`/`deque`/`pqueue`. Canonical 3-edit registration (DiagramKind union, detect.ts MERMAID_PATTERNS, frontend/index.ts) — miss one and it silently routes to flowchart.
- **Kernel reuse:** all four use `buildStrip` (`scene/strip.ts`) for cell rects + per-cell `slots` → `c0..cn` anchors. Linear/circular/deque horizontal; pqueue vertical.
- **Deque double-head:** SVG `markerStart`+`orient="auto"` does NOT reverse (no `auto-start-reverse` — resvg may not honor). `shared.ts` defines TWO fixed markers `ARROW_FWD` (apex +x, markerEnd) + `ARROW_REV` (apex −x, markerStart); a deque end segment carries both.
- **Circular wrap:** single cubic-bezier arc rear→front over the strip, `mod N` caption at apex; front/rear inferred from occupancy (`_`/`.`/`-` empty) unless explicit `front i`/`rear i`; padded/clamped to `capacity`.
- **Priority shading (no cost.ts):** pqueue sorts desc stable `(b.p-a.p)||(a.i-b.i)`, highest at top; shade = deterministic hex lerp via a LOCAL `mixHex(palette.primary, palette.surface, t)` — the repo has NO color-mix util (`palette/categorical.ts` = fixed hue cycle; `style/cost.ts` = discrete tiers). Solid tint (buildStrip takes per-cell `fill`, not opacity).
- **Example regen:** `tsx` is NOT installed + registry network-blocked (`npm 403`); `node -e` top-level await also fails. The working path is **`node scripts/preview.mjs examples/queue/`** (build:grammars + tsc-emit + parser copy + render from `dist/`).

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


---

# Archived 2026-06-23 by Scribe — detailed 2026-06-17 routing/layout learnings
# (superseded by the design-doc realignment; paths reference the old packages/core tree)

## Learnings

### Wall-Centered Connector Ports (2026-06-17)

1. **Wall-face centers create visually balanced connectors.** Exit/entry points MUST be at the CENTER of the appropriate wall face (right/left/top/bottom), not at the node's geometric center or corners. Using geometric centers for horizontal routes causes connectors to exit from arbitrary vertical positions (e.g., bottom-right corner instead of center-right), creating visual imbalance and staircase routes where straight lines are expected.

2. **ALL candidate variants must use wall centers.** The PRIMARY candidates (first h-right, h-left, v-down, v-up) were already correct, but VARIANT/NEAR/ALTERNATE candidates still used old geometric-center logic (`srcCx`, `srcCy`, `tgtCx`, `tgtCy`). This caused the kernel to pick visually broken routes when the primary candidate had throughNode penalties. Fix: update ALL 18 candidate builders to use the wall-centered points (`srcRight`, `srcLeft`, `srcTop`, `srcBottom`, `tgtRight`, `tgtLeft`, `tgtTop`, `tgtBottom`).

3. **Alternate-port candidates should use wall corners, not arbitrary positions.** The top/bottom alternate-port variants (for avoiding same-cell siblings) should use `srcTop` and `srcBottom` (wall-face points at the top/bottom edges) instead of `{ x: s.x + s.w, y: s.y }` (arbitrary corner coordinate). This maintains the semantic intent (exit from top/bottom edge of right wall) while using the wall-centered abstraction.

4. **Bus candidates exit from bottom wall center.** Bus routes (fallback for blocked direct routes) should exit from `srcBottom` (bottom wall center) and enter the target's bottom wall (`tgtBottom`), not from arbitrary geometric centers. This ensures bus routes also have clean visual entry/exit points.

5. **Label box positioning inherits from wall-centered points.** Label boxes are centered on the midpoint of connector segments. When connectors exit from wall centers instead of geometric centers, labels automatically align better with their edges. The "handled by", "fulfilled by", "triggers" labels in link-poster are now visually centered on their red connector lines.

6. **Test suite validates geometric correctness, not visual balance.** All 2790 tests passed before and after the fix. The tests verify routing kernel correctness (no overlaps, deterministic selection, valid paths), but don't detect visual imbalance issues like corner-exit connectors or staircase routes. Visual assessment (viewing rendered PNGs) is ESSENTIAL for catching these aesthetic regressions.

7. **Regenerating posters reveals global improvements.** Fixing wall-centered ports improved ALL three posters (link-poster, trace-poster, crosslink-poster). The trace-poster showed cleaner cross-cell routing (REQ boxes to class-diagram boxes exit from right wall centers). The crosslink-poster showed improved vertical alignment for multi-cell traces. Wall-centered ports are a GLOBAL aesthetic improvement, not just a link-poster fix.

### Key Files Modified (2026-06-17)

- `packages/core/src/frontend/mermaid/index.ts` — `enumerateHopCandidates()` wall-centered ports (lines 2048-2308)
- `design/figures/link-poster.png` — regenerated with improved routing
- `design/figures/trace-poster.png` — regenerated with improved routing
- `design/figures/crosslink-poster.png` — regenerated with improved routing

### Greedy-Switch + Brandes-Köpf Implementation (2026-06-17)

1. **Greedy-switch works correctly with deterministic tie-breaking.** The algorithm swaps adjacent nodes in a layer if the swap reduces crossings. Crossings are counted pairwise for edges incident to the two nodes. The swap-or-revert logic is deterministic (no randomness), and the fixed iteration limit (10) prevents infinite loops. On the RAG pipeline fixture (6 nodes, 7 edges, one branch), no swaps occurred because the barycenter phase already found the optimal order - but the algorithm is validated and ready for more complex graphs.

2. **Full Brandes-Köpf is complex; simplified version deferred.** The original ELK Brandes-Köpf algorithm has 4 passes (up-left, up-right, down-left, down-right) and complex conflict resolution when nodes in the same layer belong to the same alignment block. For increment-1, implemented a simplified structure that builds alignment blocks but maintains sequential y-offsets within layers to avoid overlap. This preserves determinism and test compatibility while deferring the full horizontal compaction logic to increment-2. The algorithm structure is in place for future enhancement.

3. **Node overlap is a hard constraint.** Tests verify no two node boxes overlap (x/y/width/height intersection check). Any placement algorithm must ensure nodes in the same layer maintain vertical spacing (nodeH + nodeGap). Alignment blocks can only affect nodes in DIFFERENT layers (horizontal alignment across columns). Initial BK implementation incorrectly assigned same y-offset to nodes in same layer, causing overlap - fixed by enforcing sequential offsets within each layer.

4. **Crossing counting requires edge direction awareness.** The `edgesCross` function checks if two edges cross by comparing relative positions of their endpoints in adjacent layers. Edges cross if their relative order reverses (e.g., edge A goes from pos 0→1, edge B goes from pos 1→0). Only edges spanning the same layer pair are considered (down-edges from current rank, or up-edges to current rank). Back-edges and self-loops are excluded from crossing minimization.

5. **Lexicographic tie-breaking maintains determinism.** The barycenter sort uses `(bc.get(a)! - bc.get(b)!) || a.localeCompare(b)` to break ties by node ID when barycenter values are equal. This ensures identical input → identical output across builds. Greedy-switch inherits this determinism by using positional comparisons (layer indexOf) and fixed iteration count.

6. **Simple examples don't exercise complex algorithms.** The current flowchart corpus (RAG pipeline, decision tree) are simple linear/branching chains with ≤2 nodes per layer. Greedy-switch and full BK show benefits on denser graphs (≥3 nodes per layer, multiple crossing candidates). Future increment-2 should add a complex flowchart fixture (e.g., 4×4 grid with cross-layer branches) to validate and showcase the crossing reduction.

7. **Algorithm documentation in header comments is essential.** Updated the flow/layout.ts file header to document phases 3.6 (greedy-switch) and 3.7 (Brandes-Köpf simplified). Clear inline comments explain the swap logic, crossing counting, and why nodes in the same layer maintain sequential offsets. Future maintainers will understand the deferred BK enhancement path.

8. **Performance is acceptable.** Greedy-switch adds O(k * L * n²) where k=max iterations (10), L=number of layers, n=nodes per layer. On typical flowcharts (<50 nodes), this is <1ms overhead. Crossing counting is O(e²) for edges incident to the two swapped nodes, typically <10 edges each. No performance degradation observed in test suite (29.6s total runtime unchanged).

### Key Files Modified (2026-06-17)

- `packages/core/src/grammars/flow/layout.ts` — greedy-switch + BK structure (line 257 onward)
- Header comment updated to document new phases 3.6 and 3.7

### Prior Learnings (2026-06-17)

1. **A* as best-of-both strategy works.** Enumerated candidates handle 99% of poster layouts; A* provides safety net for future complex obstacles.
2. **Edge-length uniformity is topology-dependent.** Variance is inherent to domain (different trace paths naturally have different lengths).
3. **Enumerated candidates are already near-optimal for simple grids.** 2×2 and 2×1 layouts with clean gaps don't need pathfinding.
4. **Deterministic A* is critical.** Grid rasterization uses integer math; path simplification is deterministic.
5. **Grid resolution trades quality vs performance.** gridSize=10px provides fine-grained avoidance; <10ms per edge.
6. **Weighted aesthetic mean balances metrics.** 6-metric scorecard with 18% weight for original 5, 10% for edgeLengthUniformity.
7. **ACCEPTABLE ≠ failure.** 0.733–0.807 range is legitimately good; reaching GOOD (≥0.85) would require layout reordering, not routing.
8. **A* candidate rank matters.** Appended after enumerated candidates (rank = candidates.length) ensures A* is fallback, not first choice.

**Full detailed learnings (obstacle/target separation, aesthetic metrics, layout selection, intra-cell routing):** See `history-2026-06-16-summarized.md`.

### Parse→Render Pipeline Map (2026-06-17)

Verified end-to-end pipeline stages and key entry-point files for the team's reference:

**Entry points:**
- CLI: `packages/cli/src/index.ts` — `isMermaidInput()` routes `.mmd`/frontmatter to Mermaid path, YAML/JSON to IR path
- Public API: `packages/core/src/api.ts` — `render()`, `compile()`, `loadIR()`, `createSession()`
- Mermaid API: `packages/core/src/frontend/mermaid/index.ts` — `detectDiagramType()`, `parseMermaid()`, `renderMermaid()`

**Pipeline stages:**
1. **Preprocess** — `frontend/mermaid/utils.ts:preprocessMermaid()` strips YAML frontmatter + `%%{init}%%` directives → `PreprocessResult`
2. **Detect** — `frontend/mermaid/index.ts:detectDiagramType()` (line 273) regex-matches first non-blank body line → `DiagramKind`
3. **Parse→Domain IR** — `parseMermaid()` (line 350) dispatches to `parseXxxInternal()` in `frontend/mermaid/xxx.ts` → grammar-specific Domain IR (`FlowDocument`, `SequenceDocument`, `IRDocument`, `ClassDocument`, etc.)
4. **Theme resolution** — `renderMermaid()` resolves theme: contract path via `resolveContractTheme()` + `bindXxxTheme()`, or legacy registry via `resolveTheme()` in `themes/index.ts` (line 77)
5. **Layout → Scene IR** — `buildXxxScene()` in `grammars/xxx/layout.ts` (or `layout/index.ts:layout()` for IRDocument) → `Scene` (flat `ScenePrimitive[]` with geometry)
6. **Geometry kernel** — during layout, `geometry/index.ts:pickBestRoute()` scores edge candidates (enumerate → score → pick)
7. **SVG serialise** — `render/svg.ts:sceneToSvg()` → SVG string (deterministic, alphabetically-sorted attributes)
8. **PNG raster** — `render/png.ts:svgToPng()` via `@resvg/resvg-js` (sync), or `render/skia.ts:sceneToPngSkia()` via CanvasKit WASM (async)

**Boundary summary:**
- Front-end: `frontend/mermaid/*.ts` (text → Domain IR)
- Middle: `grammars/*/layout.ts` + `layout/*.ts` (Domain IR → Scene IR + theme application)
- Back-end: `render/svg.ts` + `render/png.ts` + `render/skia.ts` (Scene IR → SVG/PNG)



---

## Current Status (2026-06-17) — archived from history.md by Scribe 2026-06-24


**STRAIGHT ROUTING IMPLEMENTED — VISUAL COMPARISON COMPLETE.** Added configurable routing styles for poster overlay connectors: `routingStyle: 'orthogonal'` (default, Manhattan routing with horizontal/vertical segments) vs `routingStyle: 'straight'` (direct diagonal lines). Implementation: (1) Added 'direct' routing candidate to `enumerateHopCandidates()` that creates single-segment paths from source to target, selecting exit/entry ports based on predominant direction (horizontal vs vertical). (2) Added `routingStyle` field to PosterDocument interface, parsed from frontmatter. (3) Filter candidates based on style: 'straight' keeps ONLY direct candidates, 'orthogonal' (default) filters out direct candidates to preserve existing Manhattan routing. (4) Created link-poster-orthogonal.mmd and link-poster-straight.mmd for side-by-side comparison. **All 2790/2790 tests pass.**

**VISUAL COMPARISON RESULTS:**
- **Orthogonal (Manhattan):** Uses 3-segment paths (horizontal-vertical-horizontal) via intermediate vertical gutters. Example: Payment→PaymentGateway goes right to x=489, down to target y, then right to target. Clean 90° turns, respects grid structure, feels intentional and structured. Label boxes sit on vertical gutter segments.
- **Straight (Direct):** Uses 1-segment diagonal paths. Example: Payment→PaymentGateway goes directly from (416.93,171.11)→(579.04,203.60). Minimal ink, shorter paths, more organic feel. Labels sit on diagonal midpoints.
- **Which looks better?** DEPENDS ON INTENT. Orthogonal feels more **architectural and intentional** — connectors follow the implicit grid, creating visual alignment and regularity (gutters at x=489, x=509, x=726.5 create vertical rhythm). Straight feels more **organic and minimal** — fewer bends, less visual clutter, direct "as the crow flies" connections. For diagrams emphasizing flow/causality (traces, data pipelines), straight may be cleaner. For architectural/structural diagrams (system boundaries, layered architectures), orthogonal maintains grid discipline.
- **Trade-offs:** Straight routing COULD cross obstacles if source/target aren't cleanly separated (not an issue in link-poster due to grid layout, but could be problematic in denser posters with overlapping cells). Orthogonal routing ALWAYS respects cell boundaries via gutters, but adds extra path length and visual complexity (3 segments vs 1).

**Earlier (2026-06-17):** Wall-centered connector exit/entry points fix; greedy-switch crossing minimization; Brandes-Köpf structure; A* pathfinding; aesthetic metrics. See earlier notes below.
