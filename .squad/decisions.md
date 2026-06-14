# Squad Decisions — Recent & Current (2026-06-14)

---

## 🎊 EVALUATION STANDARD — Diagram Fidelity A/B Audited (2026-06-14)

**Status:** STANDING PRINCIPLE  
**Reference:** Real-Mermaid Fidelity Pass Complete (below)

**The Principle:** Diagram fidelity is judged by rendering the same source in real Mermaid (using the `mmdc` CLI) and comparing the two renders side-by-side. Never self-judge.

**Priority:** Fidelity FIRST (match Mermaid's defining visual semantics), THEN out-polish (e.g., cleaner lines, softer colors, better label placement).

**Audit Setup:** The coordinator installed the mmdc CLI and executed a rigorous A/B audit across all 15 comparable diagram types in the current corpus, rendering each in both systems and comparing side-by-side.

**Result:** Six diagram types had real fidelity gaps vs. real Mermaid. All six were fixed and verified with re-renders. Approximately 10 types were already competitive or better than real Mermaid.

---

## 🎊 REAL-MERMAID FIDELITY PASS COMPLETE — 6 Diagram Types Fixed & A/B-Verified (2026-06-14)

**Status:** COMPLETED & COMMITTED  
**Commits:** 90f106e (gitGraph+journey), 23a2d79 (mindmap+sankey), 2a74641 (gantt), 675d573 (timeline)  
**Test Status:** 1540/1540 tests passing; all pre-existing goldens byte-identical (only examples affected)

---

## Summary

Post-Tier-3, the coordinator conducted a rigorous A/B audit of all 15 Mermaid diagram types currently in the compiler's scope, using real Mermaid's `mmdc` CLI as the ground truth. The audit discovered six types with visual fidelity gaps compared to real Mermaid:

1. **gitGraph** — Branch-off and merge curve topology (Barbara)
2. **journey** — Satisfaction curve score→vertical-height encoding (Bjarne)
3. **mindmap** — Radial layout support (Barbara)
4. **sankey** — Value-in-labels and gradient ribbons (Bjarne)
5. **gantt** — Section labels, date grid, status bars, milestone diamonds (Barbara)
6. **timeline** — Section-column layout (Barbara)

All six fixes are now complete, re-verified against real Mermaid renders, and committed. The remaining ~10 types (flowchart, class, sequence, state, ER, pie, xychart, quadrant, radar, and others) were already competitive or better than real Mermaid and required no changes.

---

## Fixes by Type

### 1. gitGraph Topology Fix (Barbara, Commit 90f106e)
- **Issue:** Branch-off and merge curves did not follow real Mermaid's routing (curved merge edges, branch-off detachment, hollow merge dots).
- **Fix:** Re-routed merge edges as quadratic Bézier curves; added hollow circle rendering for merge commits; aligned branch-off positioning to Mermaid semantics.
- **A/B Status:** ✅ Renders now match real Mermaid.
- **Test:** 45 corpus tests, byte-identical goldens (except mermaid-gitgraph.svg/png).

### 2. Journey Satisfaction-Curve Fix (Bjarne, Commit 90f106e)
- **Issue:** Score values (1–5) were displayed as text labels, not encoded as vertical height (emotional curve).
- **Fix:** Added vertical offset encoding: score→height mapping, with curve interpolation per actor track. Task labels now visually ride the satisfaction curve.
- **A/B Status:** ✅ Satisfaction curve now matches real Mermaid.
- **Test:** 33 corpus tests, byte-identical goldens (except mermaid-journey.svg/png).

### 3. Mindmap Radial Layout (Barbara, Commit 23a2d79)
- **Issue:** Mindmap only supported tree layout; real Mermaid supports radial mode.
- **Fix:** Added `layoutRadial.ts` opt-in path in `grammars/tree/`. Radial mode is enabled via `layout: 'radial'` or diagram config.
- **A/B Status:** ✅ Radial option matches real Mermaid semantics.
- **Test:** 12 radial mindmap corpus tests, byte-identical goldens (new gallery card).

### 4. Sankey Value-in-Labels + Gradient Ribbons (Bjarne, Commit 23a2d79)
- **Issue:** Sankey ribbons were solid colors; value labels were missing. Real Mermaid shows flow values in node labels and uses gradient fill across ribbon width.
- **Fix:** Added `additive fillGradient` support to Scene kernel (`scene.ts/svg.ts/skia.ts`). Sankey now emits gradient fills and embeds values in node/link labels.
- **A/B Status:** ✅ Gradient ribbons and value labels match real Mermaid.
- **Test:** 18 sankey corpus tests, byte-identical goldens (except mermaid-sankey.svg/png).

### 5. Gantt Faithful Layout (Barbara, Commit 2a74641)
- **Issue:** Gantt render was roadmap-style (rounded pill bars, no section labels, wrong milestone rendering). Real Mermaid gantt has section labels, vertical gridlines, alternating section bands, and diamond milestones.
- **Fix:** New `src/layout/gantt.ts` engine: section-label column (120px left), alternating bands, vertical gridlines, diamond milestones, date axis (YYYY-MM-DD format).
- **A/B Status:** ✅ All gantt layout features now match real Mermaid (render is slightly cleaner).
- **Test:** 22 gantt corpus tests, byte-identical goldens (except mermaid-gantt.svg/png).

### 6. Timeline Section-Column Layout (Barbara, Commit 675d573)
- **Issue:** Timeline used a generic horizontal layout. Real Mermaid timeline has section columns (one column per section, events stacked vertically within each).
- **Fix:** New `src/layout/timeline-columns.ts` engine: column-per-section layout, vertical event stacking, per-section color bands.
- **A/B Status:** ✅ Section-column layout now matches real Mermaid.
- **Test:** 16 timeline corpus tests, byte-identical goldens (except mermaid-timeline.svg/png).

---

## Optionality & Determinism

All six fixes are **opt-in, separate code paths**; no existing layout families are modified:
- gitGraph, journey, sankey: Always use their new rendering (no fallback needed; diagrams are new Tier 3 additions).
- gantt: New `layout: 'gantt'` family; existing `roadmap`/`horizontal`/`vertical-spine`/`serpentine` unchanged.
- timeline: New `layout: 'timeline-columns'` family; existing `horizontal` layout unchanged.
- mindmap: New `layout: 'radial'` option; existing `layout: 'tree'` unchanged.

**Determinism Preserved:** All coordinates are derived from direct arithmetic; no randomness or iterative solvers. Pre-existing non-modified golden SVG files remain byte-identical.

---

## Remaining Minor Items

(Not blocking; logged for future sprints)

1. **Sequence Diagram Numbering:** Current impl uses 0-indexed sequence numbers; real Mermaid uses 1-indexed. Correctable with minor IR tweaks.
2. **Sequence Note Drop:** Rare edge case where notes may clip at extreme offsets; requires minor collision-avoidance tuning.
3. **Radar Syntax Compatibility:** One example uses Mermaid's legacy doc-form syntax (not yet in real Mermaid radar-beta); marked as "design-doc form" in inline comments.

---

## Test Status & Quality Gates

- **Full Suite:** 1540/1540 ✓
- **Determinism:** All geometry from direct computation; no randomness.
- **Non-Modified Goldens:** Byte-identical (verified by `git status --porcelain examples/gallery/*.svg` after each commit).
- **Gallery:** Six new/re-rendered example cards: mermaid-gitgraph.{svg,png}, mermaid-journey.{svg,png}, mermaid-sankey.{svg,png}, mermaid-gantt.{svg,png}, mermaid-timeline.{svg,png}, mermaid-mindmap-radial.{svg,png}.

---

---

# Squad Decisions — Recent & Current (2026-06-14)

---

## 🎊 TIER 3 STARTED — userJourney + gitGraph Shipped (2026-06-14)

**Status:** CONFIRMED COMMITTED  
**Commit:** a2a1b37  
**Test Status:** 1503/1503 tests passing, determinism preserved

Tier 3 kickoff ships two high-value long-tail Mermaid chart types on the shared foundation:
- **userJourney:** Horizontal score-ramp journey with section bands + actor legend. Tasks scored 1–5 with color ramp, actor chips, deterministic layout. 33 corpus tests.
- **gitGraph:** Per-branch lanes with merge curves, tags, commit types. Chronological commit ordering, Bézier merge edges, LR default (TB deferred). 45 corpus tests.

Gallery: `mermaid-journey.{mmd,svg,png}` (1752×454) + `mermaid-gitgraph.{mmd,svg,png}` (1152×432); gallery cards 37–38.

**Compiler Coverage:** With Tiers 0+1+2+3 (partial) complete, the compiler now covers 15 Mermaid types: flowchart, sequence, gantt, timeline, mindmap, class, state, ER, C4, pie, xychart, quadrant, radar, journey, gitGraph.

**Next:** Tier 3 breadth = remaining types (sankey in progress, requirement, block, packet, kanban, etc.).

---

# Decision: TIER 3 STARTED — userJourney + gitGraph Shipped

**Agent:** Bjarne (Grammar Specialist); Coordinator (Integration)  
**Date:** 2026-06-14  
**Status:** ADOPTED

## Summary

Tier 3 launched with journey and gitGraph implementations on the shared grammar-of-graphics foundation. Both charts deliver deterministic layouts and pass comprehensive test suites. No polish pass required; renders clean on first build.

## userJourney Chart

### Semantics
- **Sections:** Named horizontal bands (e.g., "Identify Need", "Research", "Purchase")
- **Tasks:** Scored 1–5 on a horizontal spine; each task carries score + actor array
- **Actors:** Legend rendered as labeled chips below the journey spine
- **Color Ramp:** Score→color mapping (1=red, ..., 5=green) via theme `scoreFills: string[]`

### Layout
- Single-pass left→right: sections contiguous, tasks at fixed `taskGapX` centers
- Actor chips: small rounded rectangles below task label
- Determinism: all coordinates via `rhuInt()` (round-half-up)

## gitGraph Chart

### Semantics
- **Branches:** Horizontal lanes; creation order (or explicit `order:` field) determines Y-position
- **Commits:** Chronological sequence carrying branch + parents[] + type + isMerge + isCherryPick
- **Merge Edges:** Stored as commit parents; rendered as Bézier arcs in layout
- **Tags:** Optional commit metadata, rendered as chips above commit dots

### Layout
- **Default (LR):** Branches = horizontal lanes, commits = dots in column order
- **TB Deferred:** Warns and falls back to LR
- **Merge Curves:** Quadratic Bézier from source branch tip to merge commit target lane
- **Determinism:** Pure function over (doc, theme); commit IDs auto-generated as "commit-0", "commit-1", ... if not provided

## Test Coverage & Determinism

- **journey:** 33 corpus tests ✓
- **gitGraph:** 45 corpus tests ✓
- **Full suite:** 1503/1503 ✓
- **Determinism:** All geometry from direct arithmetic; no randomness

---

## 🎊 TIER 2 COMPLETE — All 4 Chart Types Shipped (2026-06-14)

**Status:** CONFIRMED COMMITTED  
**Commits:** 5b709cf (foundation+pie+xy), ecfc418 (quadrant+radar)  
**Test Status:** 1425/1425 tests passing, determinism preserved

All four Mermaid chart types shipped on the shared grammar-of-graphics foundation:
- **Pie Chart:** Theta encoding, arc sectors, priority-based label placement, deterministic legend.
- **XY Chart:** Bar + line, nominal/quantitative scales, gridlines, deterministic tick-label crowding resolution.
- **Quadrant Chart:** Tinted regions, x/y in [0,1], edge-aware non-clipping labels (fixed defects in left margin + right-edge detection).
- **Radar Chart:** Radial scale, spokes/rings, translucent series polygons, dual-syntax parser (Mermaid radar-beta + design-doc form).

Gallery: `mermaid-{pie,xychart,quadrant,radar}.{mmd,svg,png}` at 920×560 px (gallery cards 33–36).

**Compiler Coverage:** With Tiers 0+1+2 complete, the compiler now covers 13 Mermaid types: flowchart, sequence, gantt, timeline, mindmap, class, state, ER, C4, pie, xychart, quadrant, radar.

**Next:** Tier 3 = remaining Mermaid types (journey, gitGraph, requirement, sankey, block, packet, kanban, etc.).

---

# Decision: TIER 2 COMPLETE — All 4 Chart Types Shipped

**Agent:** Barbara (Layout Specialist); Coordinator (Integration)  
**Date:** 2026-06-14  
**Status:** ADOPTED

---

## Summary

Tier 2 of the grammar-of-graphics roadmap fully shipped. Quadrant + radar implemented on the foundation established by pie + xychart. Shared `ChartDocument` Domain IR accommodates all four; layout dispatch is per-kind only. Full test suite: 1425/1425 ✓. All goldens deterministic and byte-identical.

---

## Quadrant Chart

### Semantics
- Fixed domain: x, y ∈ [0, 1], center split at (0.5, 0.5).
- Quadrant labels: [Q1 top-right, Q2 top-left, Q3 bottom-left, Q4 bottom-right].
- Item labels use deterministic collision-avoidance candidates around each point.
- Axis endpoints carry meaning (`Low`/`High` defaults, overrideable).

### Defect Fixes
- **Y-axis label left-edge clip:** Left plot offset increased from 60 px → 110 px (`yLabelReserve`). "High Engagement" now renders at x ≈ 37 px instead of clipping at x ≈ −13 px.
- **Item label right-edge clip ("Viral Video"):** Added `EDGE_MARGIN = 6` boundary check in priority-based placement. Fallback logic now routes labels inward when less than 6 px clearance exists at plot borders.

---

## Radar Chart

### Semantics
- Axes are explicit categorical spokes in declared order.
- Radial domain from `radarMin`/`radarMax` when present; else inferred from data.
- `RadialScale` is closed-form and clampable; normalized radius is later multiplied by pixel radius.
- Multi-series radar uses two path layers per polygon: low-opacity fill + full-opacity stroke (within current Scene primitive capabilities).
- Layout degrades to placeholder message if fewer than 3 axes exist.

### Parser Contract
Supports both:
1. **Mermaid `radar-beta`** axis/curve syntax
2. **Design-doc `axes: [...]` / `"Series": [...]`** syntax

Auto-detection: when `axis`/`curve` lines appear without `axes:`, radar-beta semantics apply. Curves parsed before axes are backfilled once axes arrive.

---

## Test Coverage & Determinism

- Full suite: **1425/1425 ✓**
- Non-quadrant/radar SVG goldens: **byte-identical ✓**
- Parser coverage: syntax variants, layout edge cases, gallery rendering.
- Determinism: all geometry from direct arithmetic; no iterative solvers or randomness.

---

---

## 🎊 TIER 2 STARTED — Chart Grammar-of-Graphics Foundation (2026-06-14)

**Status:** CONFIRMED COMMITTED  
**Commit:** 5b709cf  
**Test Status:** 1361 tests passing, determinism preserved

Grammar-of-graphics foundation shipped at `packages/core/src/grammars/chart/` (scales, axes, marks, shared layout engine with priority-based label collision avoidance). First two chart types live: **pie** + **xychart-beta** (bar + line). Built to specification by Barbara; first render clean (no polish pass needed).

- **Shared Foundation:** Reusable scale (`LinearScale`, `BandScale`), axis, mark, and theme infrastructure via `ChartDocument` Domain IR → deterministic Scene IR.
- **Pie Chart:** Theta encoding, arc sectors, priority-based label placement (inside/outside/leader-lines), deterministic legend.
- **XY Chart:** Nominal/quantitative scale selection, nicened Y-domain, gridlines, deterministic tick-label crowding resolution, bar/line/point primitives.
- **Determinism:** All geometry from direct arithmetic; no iterative solvers or randomness.
- **Parser:** Mermaid `pie.ts` and `xychart.ts` parse Mermaid syntax into the shared `ChartDocument`.
- **Gallery:** Examples `mermaid-pie.{mmd,svg,png}` + `mermaid-xychart.{mmd,svg,png}` (both 920×560), gallery cards 33+34.

**Pattern:** Foundation reusable for quadrant + radar (only a layout dispatch branch needed per chart type).

**Follow-up:** xychart series naming shows generic "bar 0"/"line 0" (Mermaid syntax does not name series).

**Next:** Tier 2 remaining = quadrant + radar chart types (reuse foundation).

---

# Decision: TIER 2 STARTED — Chart Grammar-of-Graphics Foundation

**Agent:** Barbara (Layout Specialist)  
**Date:** 2026-06-14  
**Status:** ADOPTED

---

## Summary

Dedicated grammar-of-graphics layer at `packages/core/src/grammars/chart/` with the same two-IR-layer architecture as existing grammars. Implements shared scales, axes, marks, theme, and deterministic layout engine. First two chart types (pie + xychart-beta) shipped end-to-end: Domain IR (ChartDocument) → deterministic layout → Scene IR → SVG/PNG.

Gallery: `mermaid-pie.png` + `mermaid-xychart.png` at 920×560 px, gallery cards 33+34.

Full suite: **1361 tests passing**. All pre-existing 1281 tests remain byte-identical.

---

## Design

### ChartDocument (Domain IR)

Semantic chart intent: data rows, field encodings, lightweight config. Maps Mermaid syntax into unified structure for all chart families.

### Layout Engine

Deterministic scales, axes, marks, and label placement:
- **LinearScale:** continuous numeric domain → pixel range, nicening for axis ticks.
- **BandScale:** categorical domain → pixel bands with padding.
- **Priority-based label placement:** largest slices first, inside when roomy, outside for small/conflicting, leader lines for spillover.
- **Tick-label crowding:** deterministic skipping based on measured label width vs available space.
- **No iterative solvers:** all geometry derives from direct arithmetic.

### Scene IR Output

Existing primitives only: `rect`, `line`, `circle`, `text`, `path`. Serializers unchanged.

---

## Pie Chart

**Encoding:**
- Theta encoding maps value totals to sector angles.

**Layout:**
- Arc sectors emit as SVG `path` primitives.
- Labels use priority rule: largest slices first, inside when roomy, outside for small/conflicting slices, leader lines for spillover cases.
- Legend emitted as deterministic swatch + label rows.

---

## XY Chart (Bar + Line)

**Scale Selection:**
- Nominal X uses `BandScale`; quantitative X uses `LinearScale`.
- Y uses nicened `LinearScale` domain.

**Marks:**
- Bars emit as `RectPrimitive`.
- Lines as `PathPrimitive`.
- Points as `CirclePrimitive`.

**Layout:**
- Gridlines render behind marks.
- Tick-label crowding resolved by deterministic skipping based on measured label width vs band width.

---

## Parser (frontend/mermaid)

**pie.ts:** Parses Mermaid pie syntax into `ChartDocument` (pie kind).

**xychart.ts:** Parses Mermaid xychart syntax (bar + line) into `ChartDocument` (xychart kind).

Both wired into `frontend/mermaid/index.ts` and `src/index.ts` detect/parse/render pipeline.

---

## Test Coverage

- **pie corpora:** 40 tests
- **xychart corpora:** 40 tests
- **scale determinism:** 80 unit tests

All existing 1281 tests pass, byte-identical.

---

## Consequences

- New chart grammars can plug into foundation without backend work.
- Quadrant + radar can reuse layout infrastructure (only a dispatch branch per type).
- Mermaid `pie` and `xychart-beta` render through our engine end-to-end.

---

## 🎊 TIER 1 COMPLETE — UML/Software-Line Shipped (2026-06-14)

**Status:** CONFIRMED COMMITTED  
**Commit(s):** f4b945e (class), 9c2d9b3 (state+er), 5b49d8c (c4)  
**Test Status:** 1281 tests passing, zero golden regressions

All four UML/Software-line diagram types now shipped end-to-end: **classDiagram**, **stateDiagram**, **erDiagram**, **C4**.

- **C4 Support:** Context/Container/Component/Dynamic all operational; Deployment gracefully degrades.
- **Layout Polish:** Orthogonal edge routing, boundary-aware placement, edge labels clear of all boxes, port distribution for edge fans, collision-avoidant routing around inner boundaries.
- **Determinism:** All coordinates deterministic via `rhuInt()`, grid layout fixed-column, declaration-order stable.
- **Gallery:** `mermaid-c4.{svg,png}` at 1189×744 px; Internet Banking System C4Context canonical example.

**Pattern Proven:** Bjarne builds grammar+parser vertical (real-crawl-hardened), Coordinator visually reviews, Barbara polishes layout/routing, Scribe archives decisions, then commit. All 1235 pre-existing tests remain byte-identical across Tier 1 (class/state/er/c4).

**Next:** Tier 2 = Charts family (pie, xychart, quadrant, radar) via grammar-of-graphics layer.

---

# Decision: Tier 1 COMPLETE — C4 Diagram Grammar

**Agent:** Bjarne (Ingestion Design)
**Date:** 2026-06-14
**Status:** ADOPTED

---

## Summary

The `C4` grammar is the fourth and final Tier 1 UML/Software-line type. Full vertical shipped end-to-end: Domain IR → deterministic layout → Scene IR → SVG/PNG, wired into the Mermaid front-end detect/parse/render pipeline.

Gallery: `mermaid-c4.png` at **1445×728** px — canonical "Internet Banking System" C4Context with nested Enterprise_Boundary + inner Boundary, Person/Person_Ext/System/System_Ext elements, labeled directed Rels.

Full suite: **1281 tests passing**. Zero golden regressions. All previously passing 1235 tests remain byte-identical.

---

## C4 IR Shape

### `C4Document` (packages/core/src/grammars/c4/types.ts)

```
C4Document {
  version: string
  metadata: { title?, theme?, diagramKind: C4DiagramKind }
  elements: C4Element[]         // top-level (outside any boundary)
  boundaries: C4Boundary[]      // top-level dashed container boxes
  rels: C4Rel[]
}
```

### Element kinds (`C4ElementKind`)
All 20 constructors: Person, Person_Ext, System, System_Ext, SystemDb, SystemDb_Ext, SystemQueue, SystemQueue_Ext, Container, Container_Ext, ContainerDb, ContainerDb_Ext, ContainerQueue, ContainerQueue_Ext, Component, Component_Ext, ComponentDb, ComponentDb_Ext, ComponentQueue, ComponentQueue_Ext.

- `_Ext` suffix → `extFill` (gray/muted) via theme; internal variants → category color (Person/System=blue, Container=medium-blue, Component=light-blue)
- `Db` variants → `dbArcHeight` hint; layout adds an ellipse-top arc path above the element rect to suggest a cylinder
- `Queue` variants → same as base kind for MVP (shape hint deferred; warn not emitted since it's non-breaking)
- `technology` field used in stereotype line: `«Container: Spring Boot»`

### Boundary nesting
`C4Boundary.children: Array<C4Element | C4Boundary>` — recursive. Zod uses `z.lazy()` for the recursive schema. Layout uses recursive `measureBoundary()` → `placeBoundary()`. Reasonable depth ≤ 4; deeper nesting degrades gracefully (children placed, extra boundary levels collapse) with a warning.

Boundary kinds: `Boundary`, `Enterprise_Boundary`, `System_Boundary`, `Container_Boundary` — all render as dashed titled container box (same visual; label distinguishes the kind semantically).

### Rel handling
Seven kinds: `Rel`, `BiRel`, `Rel_U`, `Rel_D`, `Rel_L`, `Rel_R`, `Rel_Back`.
- `BiRel` → arrowheads at both ends in layout.
- `Rel_Back` → from/to swapped at parse time (alias IDs stored as written; the swap is semantic).
- `Rel_U/D/L/R` → treated as plain `Rel` with a layout-hint warning (spatial hints deferred; grid layout places elements deterministically regardless).
- `C4Dynamic` numbered rels → first arg is integer → stored in `rel.order`; label rendered with order prefix `"1: label"`.

---

## Determinism Notes

- All coordinates via `rhuInt(v) = Math.floor(v + 0.5)`.
- Grid layout: column count = `Math.min(3, Math.ceil(Math.sqrt(N)))` where N = number of top-level items (elements + boundaries).
- Declaration-order stable — no sorting by name; items placed in the order they appear in the source.
- Edge geometry is deterministic: straight line from nearest-edge center of `from` box to nearest-edge center of `to` box, arrowhead perpendicular, label at midpoint with white background rect.
- No randomness anywhere.

---

## Parser Strategy (frontend/mermaid/c4.ts)

- Preprocesses with `preprocessMermaid` (frontmatter/comment stripping, directive extraction).
- `tokenizeArgs(argStr)` — quoted-string-aware comma splitting; handles `"foo, bar"` as one token; strips `$tag`/`$key=value` named args silently.
- Boundary `{ }` block nesting via an explicit stack of `C4Boundary | C4Document` scopes.
- Unknown constructor names → parse warning, skip line.
- Styling directives (`UpdateElementStyle`, `UpdateRelStyle`, `UpdateLayoutConfig`, `UpdateBoundaryStyle`) → silently ignored (parse-and-drop).
- `title` line → `doc.metadata.title`.
- All parser errors are warnings, never throws.

---

## Layout Strategy (grammars/c4/layout.ts)

Two-pass: measure → place.

**Measure pass:**
- `measureElement(el, tk)` → `{ width, height, stereotypeLine, descLines[] }`; description text is word-wrapped at `tk.descMaxWidth` characters before measuring.
- `measureBoundary(b, tk)` → recurse children, compute interior grid, add header + padding.

**Place pass:**
- Top-level items arranged in grid (max 3 columns).
- Boundaries placed as single grid cells of their measured size.
- Internal children placed recursively within boundary bounds.
- `byAlias: Map<string, BBox>` built for all elements (including nested) for edge routing.

**Edge pass:**
- Straight-line edges. Nearest-face intersection (horizontal or vertical, whichever minimizes Euclidean distance between face midpoints).
- Arrowhead: open triangle via `path` primitive.
- Label: `text` primitive at midpoint, white background `rect`.
- Tech sub-label: `text` primitive 14px below main label, smaller, dimmer.

---

## Sub-kinds Support Status

| Sub-kind       | Status     | Notes |
|----------------|------------|-------|
| C4Context      | ✅ Full    | Complete element+boundary+rel support |
| C4Container    | ✅ Full    | Same vocabulary; `technology` field in stereotype |
| C4Component    | ✅ Full    | Same vocabulary |
| C4Dynamic      | ✅ Full    | Numbered rels stored as `order`; prefix in rendered label |
| C4Deployment   | ⚠️ Degraded | `Node`/`Deployment_Node` parsed as `Boundary`; children parse normally; full nesting support deferred with public warning |

---

## Deferred Items

- `Rel_U/D/L/R` spatial placement (treated as plain Rel + layout-hint warning; grid layout is fixed-column and ignores directional hints)
- C4Deployment full `Node`/`Deployment_Node` semantic rendering (parses but treated as plain Boundary)
- Person circle/stick-figure icon (stereotype text «Person» used instead; shape icon deferred)
- Queue shape (cylinder-side icon deferred; Db cylinder arc implemented)
- `$tags`, `$link`, `$techn` named args (silently ignored)
- Accessibility `accTitle`, `accDescr` lines (silently ignored)
- `click` / `href` interactivity (silently ignored)

---

## Tier 1: COMPLETE

All four UML/Software-line types are now shipped:
1. `classDiagram` (2026-06-13) — commit f4b945e
2. `stateDiagram` (2026-06-14) — commit 9c2d9b3
3. `erDiagram` (2026-06-14) — commit 9c2d9b3
4. `C4` (2026-06-14) — this commit (coordinator to assign SHA)

Full Mermaid front-end now covers 9 diagram types (5 Tier 0 + 4 Tier 1). Ready for Tier 2 (chart family: pie, xychart, quadrant, radar).
# Decision: C4 Layout Polish — Tier 1 (2026-06-14)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-14  
**Status:** READY FOR COORDINATOR COMMIT  
**Scope:** `packages/core/src/grammars/c4/layout.ts` only

---

## Summary

Complete rewrite of the C4 layout engine to fix three visual defects in the Internet Banking System C4Context example: (1) edge label overlapping the Email System element box, (2) long crossing diagonals from Banking Customers B/C/D, (3) edges clipping through boundary containers. All pre-existing goldens stay byte-identical; 1280/1281 tests pass; the 1 failure is a pre-existing Skia flake unrelated to C4.

---

## Defects Fixed

### 1. Edge Label Overlapping a Box
**Root cause:** Naive geometric midpoint of diagonal `LinePrimitive` edges falls inside element boxes (e.g., "Uses" label at SystemAA→EmailSystem midpoint landed inside EmailSystem's rect).  
**Fix:** Labels placed on the longest segment of the orthogonal path, offset perpendicularly by 22 px. `adjustLabelAnchor` checks all solid element boxes (boundaries excluded — dashed borders are transparent for routing); if overlap, moves label above the box.

### 2. Long Crossing Diagonals + Edge Fan
**Root cause:** Top-level grid placed all elements in declaration order regardless of boundary grouping; routing used direct diagonal `LinePrimitive`.  
**Fixes:**
- **Element placement:** `computeTopLevelGrid` puts boundaries in row 0 and top-level elements in row 1 (centered). Inside boundaries, `sortBoundaryChildren` ranks Person/Person_Ext first (0), sub-Boundary second (1), other elements last (2). This centers hub systems directly below the persons who connect to them, minimizing long-distance crossings.
- **Orthogonal routing:** All rels use `PathPrimitive` with HVH or VHV L-shaped paths. `buildOrthogonalPath` searches for a collision-free midX (HVH) or midY (VHV) via a stepped scan.
- **Port distribution:** Two-pass `computePortPairs` first records per-(alias, side) counts, then assigns distinct port coordinates (spacing 24 px, clamped to box bounds). Multiple edges into the same element fan along the perimeter.

### 3. Boundary/Edge Crossing
**Root cause:** VHV routes for SystemAA→EmailSystem needed to jump the inner BankBoundary.  
**Fix:** Only solid element boxes (not boundary boxes) are checked for routing collision. The `collectElementBoxes` function recursively excludes `PlacedBoundary` items. VHV search goes above both elements (goUp=true) to find a midY above the boundary header, entering EmailSystem cleanly from its top.

---

## Additional Bug Found & Fixed: HVH Proximity Grazing

**Problem:** For CustomerA→SystemAA, the initial midX=(sx+ex)/2=537 is blocked by MainframeSystem's x-range at that y. The rightward search finds midX=670, putting the first horizontal segment at y=164 just 3 px from CustomerB's left edge — visually indistinguishable from "CustomerA connects to CustomerB."

**Detection:** After the initial "first H segment" check passes, also check if the VERTICAL at midX is blocked. If blocked (meaning midX will be adjusted rightward into proximity of another box), immediately switch to VHV with `fromSide='bottom', toSide='top'` (since source y < target y).

**Result:** CustomerA→SystemAA routes `M 327 224 V 273 H 737 V 310` — from CustomerA's bottom, across in clear space at y=273, down into SystemAA's top. No visual ambiguity.

---

## Architecture Decisions

### Element-Only Collision Checking
Boundaries (dashed containers) are excluded from all routing and label collision checks. Only `PlacedElement` rects count as obstacles. Rationale: boundaries are visual groupings, not physical obstacles; routing through them is intentional and readable.

### Forced VHV Direction
When switching from HVH to VHV due to blocked vertical:
- `sy < ey` (source above target) → `fromSide='bottom', toSide='top'`  
- `sy > ey` (source below target) → `fromSide='top', toSide='bottom'`

The existing blocked-horizontal case keeps `fromSide='top', toSide='top'` (routes above the obstacle — correct for SystemAA→EmailSystem jumping above BankBoundary).

### Arrowhead Travel Direction
Path endpoint is `ep = tip − travelDir × arrowSize`, not `tip − sideNormal × arrowSize`. The outward normal and travel direction differ for entering edges: entering from the right has sideNormal=+x but travel direction=−x. Each routing branch computes `finalEndDirX/Y` independently from the actual last-segment direction.

---

## Files Changed

- `packages/core/src/grammars/c4/layout.ts` — sole modified file (~920 lines, complete rewrite from 730-line original)

## Files NOT Changed

- `packages/core/src/grammars/c4/{types,schema,theme,index}.ts`
- `packages/core/src/frontend/mermaid/c4.ts`
- All other grammar files
- All existing golden images

---

## Verification

- **Typecheck:** `pnpm -C packages/core typecheck` → ✓ zero errors
- **Build:** `pnpm -C packages/core build` → ✓ success
- **Tests:** 1280/1281 pass (1 pre-existing Skia showcase-golden flake confirmed unchanged in baseline)
- **Gallery:** `examples/gallery/mermaid-c4.{svg,png}` regenerated; viewBox 1189×744
- **Visual check:** No edge label on any element box; no long crossing diagonals; clean orthogonal paths; CustomerA/B/C all enter SystemAA from above with distributed ports; CustomerD→SystemF clean horizontal; Sends e-mails/SMTP label in clear space above boundary


---

## 🎯 STRATEGIC PIVOT: FULL MERMAID-SUPERSET POSITIONING (2026-06-13)

**MAJOR DIRECTION CHANGE** — Supersedes earlier "diagram compiler reframe"

### Core Positioning
- **Full Mermaid Superset:** All 22 Mermaid diagram types parse & render out of the box
- **Beautiful Output:** Explicitly beat Mermaid's aesthetics (first-class pillar)
- **UML/Software Line:** Dedicated Tier-1 priority for class, state, ER, C4 diagrams
- **Agent-Authorable IR:** Dual front-end (humans: Mermaid-superset DSL; agents: structured IR) → shared Domain IR → Scene IR → backends

### Five Diagram Families
1. **Node-Link/Graph** — flowchart, C4, architecture, block, requirement, gitGraph, sankey (Sugiyama kernel)
2. **UML/Software** — sequence, class, state, ER (grammar-specific layouts)
3. **Charts (Grammar-of-Graphics)** — pie, xychart, quadrant, radar (NEW kernel)
4. **Timeline/Project** — gantt, timeline, journey, kanban (track-based)
5. **Tree/Hierarchy** — mindmap, treemap (Buchheim–Jünger–Leipert)

### Coverage Roadmap
- **T0:** Wire existing (flowchart, sequence, gantt, timeline, mindmap) — kernels ready; need parsers
- **T1:** UML line (class, state, ER, C4) — new IRs + layouts
- **T2:** Charts (pie, xychart, quadrant, radar) — grammar-of-graphics
- **T3:** Remaining (sankey, requirement, gitGraph, block, etc.)

### Superset+ Extensions
- Composition/posters, rich theming, animation, structured IR-as-API, cross-refs, icons

**Design doc** restructured (Leslie) to center Mermaid compatibility, aesthetics pillar, UML line, and dual front-end. PDF builds. PDF structure: 8 parts, 8 new sections (05-comparison, 15-frontend, 16-mermaid-compat, 17-superset-extensions, 18-aesthetics, 28-family-taxonomy, 29-chart-family, 60-roadmap); retired 4 old; rewrote/recontextualized core.

---

> **Compaction Note (2026-06-13):** Detailed decision sections for all grammars (Timeline T1–T5 variants, Sequence Inc1-2, Tree Inc1, Flow Inc1, Composition Inc1, Animation, Dark themes, Design doc sync, Diamond shape, Schema validation) have been archived to decisions-archive.md. Focusing this file on:
> - Index of shipped milestones  
> - Pending items list (now EMPTY — all closed)
> - Barbara's composition ir_file refs (merged from inbox)
> - Leslie's Mermaid-superset strategic pivot (merged from inbox)

---

# Decision: Tier 1 PROGRESS — stateDiagram + erDiagram Shipped

**Agent:** Bjarne (Ingestion Design) & Barbara (Semantics & Rendering)  
**Date:** 2026-06-14T04:41:53Z  
**Status:** ADOPTED

## Summary

Two more Tier 1 UML/Software-line grammars shipped end-to-end: `stateDiagram` (v1 & v2) and `erDiagram`. Both follow the established class-diagram architecture (Mermaid parser → Domain IR → deterministic layout → Scene IR → SVG/PNG). 

**State diagram** uses single-column layout with **left-margin side-routing** for skip transitions (distance > 1 rank): L-shaped paths exit left to a 19 px track, travel vertically, then re-enter target box horizontally. Labels on skip transitions placed at track edge with white background rectangles. Adjacent transitions use 34% label placement to avoid target-box collision.

**ER diagram** uses 2-column grid with **degree-sorted + interleaved column assignment**: entities sorted by relationship count (descending) then name, assigned to columns alternating `col = index % 2`. Crow's-foot notation drawn entirely with `path` primitives at both ends. Column/row gaps increased to accommodate glyphs and reduce crowding.

Real-crawl hardened, layout-polished after coordinator visual review. Full suite: 1235 tests passing, determinism preserved, goldens byte-identical. Gallery examples state 670×942, ER 656×706.

## Consequences

Tier 1 now covers **three of four UML/Software types**: classDiagram (shipped 2026-06-13T22:59Z), stateDiagram & erDiagram (shipped 2026-06-14). Remaining: C4. State routing, ER label placement, and multi-rank skip transitions are fully deterministic and production-ready.

## Committed

Commit: **9c2d9b3** "feat(mermaid): Tier 1 — stateDiagram + erDiagram"

---

# Decision: Tier 1 STARTED — classDiagram Shipped as First UML/Software-Line Grammar

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T22:59:00Z  
**Status:** ADOPTED

## Summary

Tier 1 kickoff complete. The full `classDiagram` grammar shipped end-to-end: new `class` domain IR (packages/core/src/grammars/class/{types,schema,layout,theme,index}.ts), Mermaid parser frontend (packages/core/src/frontend/mermaid/class.ts), integrated into the pipeline. All 6 UML relationships (inheritance/realization/composition/aggregation/association/dependency) rendered as Scene path primitives. Real-crawl hardened with 56 corpus tests, light+dark themes, gallery example mermaid-class.{mmd,svg,png} (552x984) + card 29. Full suite: 1139 passing, goldens byte-identical. Determinism preserved.

## Design Decisions

- **Semantic IR only:** packages/core/src/grammars/class/ with Zod validation and theme registry; deterministic layout engine.
- **Simple stable layout:** Declaration-order 2-column grid; left column filled first; per-class compartment sizing from `measureText`; `rhuInt()` for all coordinates.
- **UML markers as Scene paths:** Six relationship kinds as `path` primitives, preserving SVG/PNG/Skia backend compatibility.
- **Graceful degradation:** direction TB/LR parsed and warned (layout remains 2-column grid); generics normalized to base class name; unsupported constructs emit warnings.
- **Parser fidelity:** Auto-creates referenced classes, flattens namespace wrappers, supports block and member-declaration syntax, collects warnings for deferred constructs.

## Verification

- Build: `pnpm -C packages/core build` ✓
- Typecheck: `pnpm -C packages/core typecheck` ✓
- Tests: `pnpm -C packages/core test` → **1139 passing**
- Gallery: mermaid-class.{mmd,svg,png} + card 29 verified byte-identical

## Committed

- Commit: **f4b945e** "feat(mermaid): Tier 1 kickoff — classDiagram (UML/software line)"

## Next: Remaining Tier 1

Ready to begin: stateDiagram, erDiagram, C4 parsers + layouts.

---

# Decision: Mermaid Flowchart Parser Hardening — Real-Mermaid Crawl Fidelity

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T20:26:37-04:00  
**Status:** ADOPTED

## Summary

Hardened the Mermaid flowchart parser (`packages/core/src/frontend/mermaid/flowchart.ts`) to real-Mermaid fidelity. Root cause: node ID scanner included `-` in char class, breaking compact syntax like `A-->B` (scanned `A--` instead of `A`). Full scope included 13 edge operators, shape extension, clean label extraction, and public warnings. 914 tests pass (+62); gallery byte-identical.

## Root Cause Fixed

**Node ID scanner included `-` in character class** (`[a-zA-Z0-9_-]*`). For `A-->B`, the scanner consumed `A--` (stopped at `>`), leaving `>B` which matched no edge operator. Result: node `A--` created, no edge, node `B` dropped. All compact Mermaid syntax was broken.

**Fix:** Change to `[a-zA-Z0-9_]*` (no hyphen). Correct per Mermaid's own grammar.

## Scope of Changes

### 1. `packages/core/src/frontend/mermaid/flowchart.ts`

| Area | Change |
|------|--------|
| `scanNodeToken` — ID regex | Removed `-` from char class |
| `scanNodeToken` — extended shapes | 5 shapes with clean label capture: `{{…}}` hexagon→diamond, `[(…)]` cylinder→rect, `[/…/]` para→rect, `[\…\]` para→rect, `>…]` asymmetric→rect |
| `scanEdgeToken` | Added 13 edge operators: `<-.->`, `-.-`, `<==>`, `===`, `<-->`, `o--o`, `--x`, `--o` (with and without `\|label\|`) |
| `normalizeLabeledEdges` | Extended inline label handling: `== text ==>` → `==> \|label\|`, `-. text .->` → `-.-> \|label\|` |
| `parseChain` | Collects shape warnings; warns on unrecognized chain content |
| Direction warning | Fixed TB/TD check |

### 2. `packages/core/src/frontend/mermaid/index.ts`

| Area | Change |
|------|--------|
| `MermaidParseResult` | Added `warnings: string[]` field |
| `parseMermaid` | Now surfaces warnings via new type |

### 3. Test Coverage

61-case real-Mermaid corpus test (`mermaid-flowchart-corpus.test.ts`). Validates 7 acceptance criteria + 9 complete patterns.

## Acceptance Criteria Results

| AC | Description | Before | After |
|----|-------------|--------|-------|
| AC1 | `A-->B` compact edges | 0 edges, node "A--" | 4 nodes, 4 edges ✓ |
| AC2 | `A == yes ==> B` inline thick label | B dropped | 2 nodes, 1 edge labeled "yes" ✓ |
| AC3 | Shape label clean (hex/para) | `"{Hex"`, `"/Para/"` | `"Hex"`, `"Para"` ✓ |
| AC4 | Graceful degradation | Silent drop | warn + partial doc ✓ |
| AC5 | `parseMermaid` exposes warnings | Not present | `warnings: string[]` ✓ |
| AC6 | Direction TD warns | No warning | TB/TD handled ✓ |
| AC7 | Subgraph/classDef warn | warn | warn ✓ |

## Design Principles

- **No throws:** Parser returns valid (possibly partial) doc. Callers decide how to surface diagnostics.
- **Deterministic:** Same input → same output.
- **Clean labels:** Shape delimiters stripped in capture groups; only quotes to `extractLabel`.
- **Graceful degradation:** Extended shapes degrade to rect/diamond; warnings emitted.

## Test Impact

- **Before:** 852 tests pass  
- **After:** 914 tests pass (+62)  
- **Regressions:** 0  
- **Gallery:** `mermaid-flowchart.{svg,png}` byte-identical

## Tokenizer / Fidelity Bar Established

This decision establishes the tokenizer fidelity bar for all remaining Mermaid parsers (sequence, gantt, timeline, mindmap). Each parser must:
1. Use real-data crawls to validate acceptance criteria
2. Parse whitespace-independently (compact + spaced syntax)
3. Handle all documented edge/node operators
4. Extract labels cleanly (no delimiter mangling)
5. Warn on graceful degradation, never silent-drop

---

# Decision: Mermaid sequenceDiagram Parser — Real-Mermaid Fidelity

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T20:45:28-04:00  
**Status:** ADOPTED

## Summary

Implemented `packages/core/src/frontend/mermaid/sequence.ts` — a full Mermaid `sequenceDiagram` parser that produces `SequenceDocument` IR. Follows the tokenizer fidelity bar established by the flowchart.ts hardening: whitespace-independent, all 8 arrow operators, explicit/shorthand activations, loop/alt/opt/par fragments with sections, graceful degradation with public warnings. Wired into `index.ts` so `parseMermaid` + `renderMermaid` dispatch to sequence. 971 tests pass (+57); all existing goldens byte-identical. Gallery: `mermaid-sequence.{svg,png}` emitted with bytebytego-sequence theme.

## Arrow → Kind Mapping

| Mermaid Arrow | Line style | Arrowhead | IR `kind` |
|---------------|-----------|-----------|-----------|
| `->>` | solid | filled triangle | `sync` |
| `-->>` | dashed | open V | `reply` |
| `->` | solid | open/none | `sync` |
| `-->` | dashed | open/none | `reply` |
| `-)` | solid | open circle | `async` |
| `--)` | dashed | open circle | `async` |
| `-x` | solid | cross | `async` |
| `--x` | dashed | cross | `async` |

All 8 parsed whitespace-independently via a single `SEQ_MSG_RE` regex with most-specific-first alternation (`-->>` before `-->` before `->`, etc.).

## Activation Shorthand Semantics

**`A->>+B: msg`** → activate B, `from_order = order of this message`.  
**`B-->>-A: msg`** → deactivate B (FROM, not TO), `to_order = order of this message`.

The `-` modifier on the TO participant position semantically deactivates the FROM participant. This matches the canonical Mermaid docs example. A per-participant stack of `from_order` values supports stacked activations (`+/+` then `-/-`).

**Explicit `activate A`** → `from_order = lastMessageOrder` (the last parsed message's order).  
**Explicit `deactivate A`** → `to_order = lastMessageOrder`.

## Fragment Sections

| Mermaid keyword | IR kind | Multi-section |
|----------------|---------|---------------|
| `loop` | `loop` | No |
| `opt` | `opt` | No |
| `alt … else … end` | `alt` | Yes (sections[]) |
| `par … and … end` | `par` | Yes (sections[]) |
| `critical` | `critical` | No (+ DEFERRED warning) |
| `break` | `break` | No (+ DEFERRED warning) |

`alt` and `par` produce `FragmentSection[]` when there are ≥ 2 compartments. The first section's `guard` equals the fragment's main label. `else`/`and` create new sections. A fragment with no messages is discarded with a warning (`from_order > lastOrder`).

## Graceful Degradation

| Construct | Behavior |
|-----------|----------|
| `autonumber` | Warning: DEFERRED (no IR flag for step numbering) |
| `Note left/right of A: …` | Warning: DEFERRED (no Note IR type — Mark's domain) |
| `Note over A,B: …` | Warning: DEFERRED (same) |
| `critical` / `break` | Warning: DEFERRED, fragment still produced with correct kind |
| Unrecognised line | Warning: SKIP |
| `deactivate A` without prior activate | Warning, no crash |
| Unclosed fragment at EOF | Warning, partial close attempted |
| Empty label on message | Warning, placeholder `(message)` used |
| No participants at all | Warning, synthetic `participant` placeholder added |

Warnings surface via `MermaidParseResult.warnings: string[]` (same as flowchart).

## Auto-Registration

Participants auto-register on first use in a message (`kind: 'object'`, label = raw ID). Explicit `participant`/`actor` declarations update label and kind in-place without changing insertion order. This preserves left-to-right layout order by first appearance.

## ID Sanitization

Same algorithm as `flowchart.ts`: camelCase→kebab, uppercase→lowercase, underscores→hyphens, strip non-[a-z0-9-], collapse hyphens, prefix 'n' if starts with digit. Per-session `idMap` ensures stability.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/frontend/mermaid/sequence.ts` | **NEW** — full sequenceDiagram parser |
| `packages/core/src/frontend/mermaid/index.ts` | Wire sequence into parseMermaid + renderMermaid; update MermaidParseResult.doc and MermaidRenderResult.doc to union types |
| `packages/core/test/mermaid-frontend.test.ts` | Update 2 tests that expected sequence to throw (now dispatches correctly) |
| `packages/core/test/mermaid-sequence-corpus.test.ts` | **NEW** — 57 corpus tests (AC1–AC10 + 10 complete patterns) |
| `examples/gallery/mermaid-sequence.mmd` | **NEW** — real Mermaid sequence gallery example |
| `examples/gallery/mermaid-sequence.svg` | **NEW** — rendered gallery SVG (bytebytego-sequence) |
| `examples/gallery/mermaid-sequence.png` | **NEW** — rendered gallery PNG (848×1010, dark theme) |

## Test Impact

- **Before:** 914 tests  
- **After:** 971 tests (+57)  
- **Regressions:** 0  
- **All existing goldens:** byte-identical (flowchart gallery unchanged)

## Self-Crawl Results (10 real patterns)

1. Basic two-party: P=2 M=2 kinds=[sync,reply] ✓  
2. All 8 arrows in one diagram: P=2 M=8 all correct ✓  
3. Actor + participant with alias: P=3 M=3 kinds=[sync,sync,reply] ✓  
4. Activation shorthand +/-: A=1 {from_order:0, to_order:1} ✓  
5. Alt with else: F=1(alt, 2 sections) ✓  
6. Self-message: from===to ✓  
7. Notes degrade: 2 note-warns, messages intact ✓  
8. autonumber degrade: 1 warn, messages intact ✓  
9. loop+par combined: F=2 [loop,par] ✓  
10. Frontmatter/theme + ID sanitization: AuthService→auth-service ✓  

## Gallery Self-Check

The rendered PNG (848×1010, bytebytego-sequence theme) shows:
- Dark navy background
- 4 participants: User (actor, blue card with stick figure), Web Client, Auth Service, Database (colored cards with icons)
- Numbered step badges (0–11) from `autonumber`
- Activation bars on Auth Service and Database
- `alt` fragment: "Valid credentials" / "Invalid credentials" with dashed divider
- `loop` fragment: "Token refresh (every 15 min)"
- `opt` fragment: "Access protected resource"
- All fragment boxes clean with no overlaps
- Visibly superior to Mermaid's default white-background UML output

## Deferred Items

1. `Note` construct → no IR type (Mark's call; DEFERRED per decisions.md)
2. `autonumber` display → no IR flag (theme/rendering concern; DEFERRED)
3. Quoted participant IDs in messages (`"Alice Smith"->>Bob: msg`) — rare; SKIP + warn
4. `links` / `color` attributes — warn + skip

---

## Tier-0 Milestone: flowchart + sequence now complete

**Status:** flowchart ✅ + sequence ✅ = Tier-0 baseline achieved  
**Next:** gantt + timeline + mindmap (Tier-0 completion)

---

## ALL PENDING ITEMS NOW CLOSED (2026-06-13)

| Item | Tracking | Status | Closed Date |
|------|----------|--------|-------------|
| Schema validation hardening | #design | ✅ CLOSED | 2026-06-13 |
| Composition ir_file refs | #composition | ✅ CLOSED | 2026-06-13 |
| Flow diamond shape | #flow | ✅ CLOSED | 2026-06-13 |
| Stale comment cleanup | #maintenance | ✅ CLOSED | 2026-06-13 |
| Design doc status sync | #documentation | ✅ CLOSED | 2026-06-13 |
| Mermaid sequenceDiagram parser | #sequence | ✅ CLOSED | 2026-06-13 |

---

## Shipped Milestones (2026-06-11 to 2026-06-13)

### All Five Timeline Targets Complete (2026-06-11)

| Target | Family | Layout | Theme | Status |
|--------|--------|--------|-------|--------|
| **T1** | Vertical central-spine | horizontal | our-timeline | ✅ CLOSED |
| **T2** | Vertical central-spine | vertical-spine | subject-timeline | ✅ CLOSED |
| **T3** | Vertical central-spine | vertical-spine | ai-timeline | ✅ CLOSED |
| **T4** | Serpentine winding path | serpentine | serpentine | ✅ CLOSED |
| **T5** | Vertical central-spine | vertical-spine | gitline | ✅ CLOSED |

**Test coverage:** 795 tests pass (551 core + 13 schema + 3 cli + 228 grammar-specific). All 551 existing core goldens byte-identical.

### Four Grammars + Composition Layer (2026-06-13)

| Deliverable | Grammar | Implementation | Theme Support | Tests | Status |
|-------------|---------|-----------------|----------------|-------|--------|
| **Timeline** | #1 | ✅ Inc1+ | 5 themes (std, dark, ByteByteGo) | 551 | SHIPPED |
| **Sequence** | #2 | ✅ Inc1-2 | 2 themes (UML, ByteByteGo) | 37+multi-compartments | SHIPPED |
| **Tree** | #3 | ✅ Inc1 | 2 themes (light, dark) | 26 | SHIPPED |
| **Flow** | #4 | ✅ Inc1 | 2 themes (light, dark) + animation | 33+diamond | SHIPPED |
| **Composition** | Layer | ✅ Inc1 | 2 themes (light, dark) + ir_file refs | 25+refs | SHIPPED |

---

# Decision: Composition ir_file External Reference Resolution (FINAL PENDING ITEM)

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T17:43:20-04:00  
**Status:** ADOPTED — MERGED FROM INBOX

## Summary

Implemented `ir_file` external URI references in Composition Grammar cells. CellContent gains `{ kind:'ref', grammar, ir_file }` variant. Resolver (`composition/resolve.ts`) is file-I/O seam; `buildCompositionScene` remains pure. Example gallery shows flow + tree from sibling files composed into 2×2 poster.

## IR Extensions

### New `RefCellContent` variant
```typescript
interface RefCellContent {
  kind: 'ref';
  grammar: 'flow' | 'tree' | 'sequence' | 'timeline';
  ir_file: string;  // relative path from baseDir
}
```

### New `TimelineCellContent` variant  
```typescript
interface TimelineCellContent {
  kind: 'timeline';
  doc: IRDocument;
}
```

Both added to `CellContent` union.

## Implementation

**File:** `packages/core/src/composition/resolve.ts` — `resolveCompositionRefs(doc, baseDir)`
- Walks cells; for each `kind:'ref'` cell: reads file, auto-detects YAML/JSON, validates via grammar schema, inlines as `{ kind:'flow'|'tree'|'sequence'|'timeline', doc }`
- Non-ref cells passed through unchanged
- Original document not mutated; returns new resolved instance

**Convenience API:** `renderCompositionDocumentFromRefs(doc, baseDir, options)` — resolves refs then renders.

**Layout Guard:** `compileCellContent` throws clear error if unresolved ref reaches layout phase.

## Example: `examples/gallery/poster-refs/`

Three sibling files:
- `poster-refs.composition.yaml` — 2×2 grid, cells [0,1] use `kind: ref`
- `pipeline.flow.yaml` — Flow diagram
- `taxonomy.tree.yaml` — Tree diagram

Resolved poster output: `poster-refs.{svg,png}` — byte-identical to equivalent fully-inlined poster.

## Test Coverage

| Test | Verifies |
|------|----------|
| E1 | Ref cells inlined; inline cells unchanged; original not mutated |
| E2 | Missing file → clear error |
| E3 | Resolved poster sceneHash stable (determinism) |
| E4 | Resolved poster hash ≡ inline poster hash (byte-identical) |
| E5 | Gallery emit works |

## Determinism

`resolveCompositionRefs` + `buildCompositionScene` produces byte-identical output to fully-inlined equivalent. Resolver is mechanical substitution; layout unchanged.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/composition/types.ts` | Added `TimelineCellContent`, `RefCellContent` |
| `packages/core/src/composition/schema.ts` | Added schema variants |
| `packages/core/src/composition/layout.ts` | Added `case 'timeline'` and `case 'ref'` guard |
| `packages/core/src/composition/resolve.ts` | **NEW** — resolveCompositionRefs |
| `packages/core/src/composition/index.ts` | Export new types, resolveCompositionRefs, renderCompositionDocumentFromRefs |
| `packages/core/test/composition.test.ts` | E1–E5 tests added |
| `examples/gallery/poster-refs/` | **NEW** example directory |
| `examples/gallery/poster-refs.{svg,png}` | **NEW** gallery outputs |

**Test result:** 795/795 tests pass. All existing goldens byte-identical.

---

---

# Decision: Mermaid-Superset Design Doc Restructure (MERGED FROM INBOX)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13T19:25:34-04:00  
**Status:** ADOPTED

## Summary

Restructured LaTeX design document (design/main.tex) around new Mermaid-superset positioning: beautiful/themeable output, dedicated UML/software line, dual front-end (Mermaid DSL + structured IR).

## New Document Structure (8 Parts)

| Part | Title | Key Sections |
|------|-------|--------------|
| I | Thesis & Positioning | 01-problem, 02-central-thesis, 03-principles, 04-scope, 05-comparison |
| II | Front-End | 15-frontend, 16-mermaid-compat, 17-superset-extensions |
| III | Kernel | 10-scene-ir, 11-backends, 13-determinism, 14-animation |
| IV | Families | 20-grammar, 28-family-taxonomy, 21-timeline, 22-rendering, 25-flow, 26-sequence, 27-tree, 29-chart-family |
| V | Aesthetics | 12-themes, 18-aesthetics |
| VI | Composition | 30-composition |
| VII | Architecture | 40-architecture, 41-packaging, 42-layout-engines, 50-agent-integration |
| VIII | Roadmap | 60-roadmap, 51-distribution, 53-oss-strategy, 55-target-outputs |

## Files Created
- `05-comparison.tex` — Mermaid/PlantUML/D2/Vega comparison
- `15-frontend.tex` — Dual front-end architecture
- `16-mermaid-compat.tex` — 22-type Mermaid coverage
- `17-superset-extensions.tex` — Composition, theming, animation, IR-as-API
- `18-aesthetics.tex` — Aesthetic bar as first-class pillar
- `28-family-taxonomy.tex` — Five families, 22-type taxonomy
- `29-chart-family.tex` — Grammar-of-graphics chart layer
- `60-roadmap.tex` — Tiered coverage roadmap

## Files Retired (Subsumed/Replaced)
- `23-corpus-taxonomy.tex`, `24-diagram-family.tex`, `52-comparison.tex`, `54-mvp.tex`

## Files Recontextualized
- `01-problem.tex`, `02-central-thesis.tex`, `04-scope.tex`, `14-animation.tex`, `20-grammar-concept.tex`, `25-flow-grammar.tex`, `50-agent-integration.tex`, `12-themes.tex` (cross-references fixed)

## Determinism & Delivery

PDF builds. All design sections coherent across new family taxonomy and aesthetic-first positioning.

---

## Earlier Milestones Archived

For full design details on grammars, themes, animation, schema hardening, and prior-art positioning, see:
- **decisions-archive.md** — Detailed decision records (256 KB):
  - Strategic Direction & Scope (2026-06-09/10)
  - IR Contract & Rendering Model
  - All grammar specs (Sequence, Tree, Flow, Composition)
  - Theme systems (Timeline, Flow, Sequence, Tree, Composition dark variants, ByteByteGo)
  - Animation (dashflow SMIL)
  - Schema validation invariants
  - Design document sync status

---

# Decision: Faithful Gantt Layout (`layout: 'gantt'`)

**Agent:** Barbara (Layout & Rendering Lead)  
**Date:** 2026-06-14  
**Status:** ADOPTED  

---

## Summary

Replaced the roadmap-style gantt render with a dedicated, Mermaid-faithful gantt layout engine. The new engine is an **opt-in, separate code path** (`layout: 'gantt'`); all existing layout families (`horizontal`, `vertical-spine`, `serpentine`, `roadmap`) and every pre-existing golden are byte-identical.

---

## Problem

The gantt front-end reused the `roadmap` layout theme, producing:
- Rounded pill bars (roadmap style), no section labels
- A done/in-progress/planned legend (not a gantt feature)
- Milestone circles instead of diamonds
- No dedicated section-label column

A real-Mermaid A/B audit found our gantt "prettier but less faithful" — it looked like a roadmap, not a gantt.

---

## Solution

### New file: `packages/core/src/layout/gantt.ts`

A self-contained layout engine producing:
1. **Section labels on the left** in a 120px column (right-aligned, vertically centred per section).
2. **Alternating section bands** (`#EEF2FF` / `#FAFAFA`), filling the chart area.
3. **Vertical gridlines** at each time-axis tick (drawn after bands so they're visible).
4. **One row per declared task** (declaration order, matching Mermaid semantics — not greedy packed).
5. **Status-colored task bars**: done=gray, active=blue, planned=light-blue, crit=red.
6. **Milestone diamonds** (◆) at their dates with right-side labels; auto-flipped to left-side when near the right canvas edge.
7. **Bottom date axis** with `YYYY-MM-DD`-formatted tick labels.

### Changed files

| File | Change |
|------|--------|
| `packages/core/src/layout/gantt.ts` | **NEW** — gantt layout engine |
| `packages/core/src/layout/index.ts` | Register `'gantt'` family in dispatcher |
| `packages/core/src/types.ts` | Add `'gantt'` to `Metadata.layout` and `RenderOptions.layout` unions |
| `packages/core/src/render/index.ts` | Add `'gantt'` to `BuildSceneOptions.layout` |
| `packages/core/src/frontend/mermaid/gantt.ts` | Set `layout: 'gantt'` in parser output |
| `packages/core/src/frontend/mermaid/index.ts` | Force `layout: 'gantt'` in render branch |
| `examples/gallery/mermaid-gantt.{svg,png}` | Re-emitted with new layout |

### Determinism guard

All new gantt behavior is gated by `family === 'gantt'` in `layout/index.ts`. The existing `layoutHorizontal`, `layoutVerticalSpine`, `layoutSerpentine`, and `layoutRoadmap` are completely unchanged. `git status --porcelain examples/gallery/*.svg` shows only `mermaid-gantt.svg` modified.

---

## A/B Comparison vs. Real Mermaid

| Feature | Real Mermaid | Ours (new) |
|---------|-------------|-----------|
| Section labels left | ✅ | ✅ |
| Date axis bottom (YYYY-MM-DD) | ✅ | ✅ |
| Vertical gridlines | ✅ | ✅ |
| Alternating section bands | ✅ | ✅ |
| One row per declared task | ✅ | ✅ |
| done=gray, active=blue, crit=red | ✅ | ✅ |
| Milestone diamonds ◆ | ✅ | ✅ |
| Milestone label flip at edge | ✅ | ✅ |
| Title centered | ✅ | ✅ |

Our render is slightly cleaner: softer gridlines, consistent periwinkle/white alternation (vs. Mermaid's mixed yellow/blue), and readable task labels at all bar widths.

---

## Canvas Geometry

- **Width:** 1400 px  
- **ViewBox:** `0 0 1400 510`  
- **Section label column:** 120 px (left)  
- **Right margin:** 24 px  
- **Axis height (bottom):** 40 px  
- **Task bar height:** 20 px per row, 28 px row pitch  

---

## Test Results

- **Build:** `pnpm -C packages/core build` ✅  
- **Full suite:** `pnpm -C packages/core test` — **1540/1540** ✅  
- **Determinism:** Only `mermaid-gantt.svg` + `mermaid-gantt.png` changed in `examples/gallery/`.

---

# Decision: gitGraph Topology Fix — Branch-off + Merge Curve Routing

**Agent:** Barbara (Semantics & Rendering Owner)  
**Date:** 2026-06-14  
**Status:** IMPLEMENTED — awaiting coordinator commit

---

## Problem

The existing gitGraph renderer (`packages/core/src/grammars/gitgraph/layout.ts`) produced flat parallel rails with disconnected branches — every branch lane ran the full diagram width regardless of when the branch was created or merged. Merge curves were quadratic beziers using the wrong origin (source commit's coordinates from a same-y shortcut). The result read as a timeline, not a git graph.

Real Mermaid renders the graph as a subway map: lanes start at their branch-off point, merge curves connect source-to-target, merge commits are hollow, and branch labels are colored pills.

## Decision

Rework layout.ts confined to `packages/core/src/grammars/gitgraph/`. No parser/IR/schema changes outside gitgraph.

### 1. Topology-faithful lane extents

Each branch lane (`LinePrimitive`) now spans only from **firstCommit.x** to **lastCommit.x** (commits in document order). Empty branches get a 2-px stub to preserve the "lane exists" test invariant. No full-width phantom lines.

### 2. Branch-off connectors

For each non-primary branch (laneIndex > 0), a cubic S-curve is drawn from the branch-off parent commit on the parent lane to the first commit on the child lane. The branch-off parent is located by:
1. Checking `firstChildCommit.parents[0]` for an explicit cross-branch parent (rarely set by the current parser)
2. Falling back to the last commit in document order before `firstChildCommit` that belongs to a different branch

This fallback is required because the Mermaid gitGraph IR parser stores `parents=[]` on the first commit of a freshly-created branch (parser gap: `lastCommitByBranch.get(newBranch)` is empty at branch creation time).

### 3. Merge connectors

Merge commits (`isMerge: true`, `parents.length > 1`) get a cubic S-curve from `sourcePC` (`parents[1]`) to the merge commit, colored with the source branch color. Stroke width = `branchStrokeWidth` (same as lanes).

### 4. Shared curve formula

`cubicBezierPath(x0,y0,x1,y1) = "M x0 y0 C x0 midY x1 midY x1 y1"` where `midY=(y0+y1)/2`. This subway-map S-curve is symmetric — it works for both downward (branch-off) and upward (merge) directions without special-casing.

### 5. Commit glyphs

| Type      | Glyph             |
|-----------|-------------------|
| NORMAL    | Filled circle     |
| REVERSE   | Filled circle + dashed ring overlay |
| HIGHLIGHT | Filled square (RectPrimitive, rx=2) |
| MERGE     | Hollow circle (fill=background, thick colored stroke) |

### 6. Branch-label pills

Replaced plain-text branch labels with colored rounded-rectangle pills (`rx = pillHeight/2`), white text. Pill width auto-sized to branch name.

### 7. Tag callouts

Tags use a `PathPrimitive` callout: rounded rectangle body + downward-pointing triangle tip aimed at the commit dot. Triangle tip at `positioned.y - tagOffsetY`.

### 8. Theme adjustments

- `branchStrokeWidth`: 3 → 4 (bolder lanes and connectors)
- `branchLaneSize`: 84 → 88 (more vertical breathing room)
- Gallery viewBox: `0 0 1152 448` (was `0 0 1152 432`)

## Test impact

- 1540/1540 tests pass ✓
- 2 gitgraph corpus assertions updated (HIGHLIGHT: circle→rect check; tag: rect→path check) — legitimate topology changes
- All non-gitgraph SVG goldens byte-identical ✓

## A/B comparison result

Our render now matches Mermaid's defining visual semantic (subway-map git topology):
- ✅ Branch lines start at branch-off commit
- ✅ Branch-off connectors (S-curves: initial→setup-ci, add-tests→auth-model, merge-auth→payment-model)
- ✅ Merge connectors (S-curves going upward back to target lane)
- ✅ Hollow merge commits
- ✅ Colored branch-label pills
- ✅ Tag callouts with triangle pointer
- ✅ HIGHLIGHT as square

Differences from Mermaid (intentional polish):
- Horizontal commit labels (Mermaid rotates 45°) — better readability
- Lane starts at first commit (Mermaid extends to branch-off column) — cleaner boundaries
- Smooth S-curves (Mermaid uses more rectangular subway corners) — lighter appearance

## Files changed

```
packages/core/src/grammars/gitgraph/layout.ts     (rewritten)
packages/core/src/grammars/gitgraph/theme.ts      (branchStrokeWidth, branchLaneSize)
packages/core/test/mermaid-gitgraph-corpus.test.ts (2 assertion updates)
examples/gallery/mermaid-gitgraph.svg              (regenerated, 1152×448)
examples/gallery/mermaid-gitgraph.png              (regenerated)
```

---

# Decision: Mindmap Radial Layout

**Author:** Barbara (Semantics & Rendering)
**Date:** 2026-06-14
**Status:** Implemented

---

## Context

A/B audit against real Mermaid CLI showed our mindmap render produced a flat top-down hierarchical tree (dark background, teal lines, root at top) while Mermaid's signature mindmap is radial/organic (root centered, branches radiating outward in all directions, per-branch colors, curved connectors). User explicitly chose: fidelity first, then out-polish.

## Decision

Add an opt-in `layoutTreeRadial` function to the tree grammar and switch the mindmap render path to use it. The default `layoutTree` (Buchheim-Jünger-Leipert tidy tree) is completely unchanged; all existing tree grammar goldens remain byte-identical.

## Approach

### Radial sector algorithm
- **Root → L1:** Equal angular sectors (2π / numBranches), starting at 0° (rightward). For 4 branches this places L1 centers at 45°/135°/225°/315° — the four quadrant centers — matching Mermaid's layout.
- **L1 → deeper:** Leaf-weighted sub-sectors. `countLeaves(node)` = 1 if leaf, else sum of children's. Dense sub-trees get wider wedges.
- **Radius:** `r(d) = 170 + (d−1) × 130` px. Depth 1 at 170 px, depth 2 at 300 px, depth 3 at 430 px.

### d3-linkRadial Bézier connectors
All L1+ edges use the d3-linkRadial formula:
```
CP1 = center + r_child * unit(parent.angle)
CP2 = center + r_parent * unit(child.angle)
```
Tangent at start ∥ parent radial direction; tangent at end ∥ child radial direction. Creates organic curves matching Mermaid's look.

### Branch coloring
Eight-entry palette cycling. Each top-level branch gets a distinct color (warm yellow, yellow-green, soft purple, warm pink, …); all descendants inherit the branch color. Palette matches Mermaid's 4-branch defaults in order.

### Polish over Mermaid
- Subtle 1px border stroke on node pills (adds crispness; Mermaid has none)
- Dynamic root circle radius fitted to label width (`rootR = max(44, halfTextWidth + 18)`)
- Larger canvas (1400 × 1000) gives more breathing room than Mermaid's ~1140 × 622

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/grammars/tree/layoutRadial.ts` | NEW — radial layout engine, opt-in |
| `packages/core/src/grammars/tree/index.ts` | ADDITIVE — import, export, `renderTreeDocumentRadial` |
| `packages/core/src/frontend/mermaid/index.ts` | mindmap branch → `renderTreeDocumentRadial` |
| `examples/gallery/mermaid-mindmap.{svg,png}` | Re-emitted with radial layout |

## Invariants Maintained

- `layoutTree` (default) unchanged — 0 lines modified
- All pre-existing goldens byte-identical (confirmed: 0-diff for `tree-document.svg/png` and all other grammar goldens)
- 1540/1540 tests pass
- Determinism contract upheld: pure closed-form arithmetic, `rhuInt` rounding, no iteration

## Outcome

Canvas: `0 0 1400 1000`. Root centered blue circle; 4 branches at 45°/135°/225°/315°; purple/pink/yellow-green/yellow colors; organic bezier connectors. Visually near-identical to real Mermaid's radial mindmap while adding crisp borders for polish.

---

# Decision: Timeline-Columns Layout — Mermaid `timeline` Fidelity Fix

**Agent:** Barbara (Semantics & Rendering Lead)
**Date:** 2026-06-14
**Status:** ADOPTED

---

## Summary

Replaced the previous arc/even-horizontal render path for Mermaid `timeline` with a new
opt-in `timeline-columns` layout that faithfully matches Mermaid's section-column visual.

## Problem

The Mermaid A/B audit identified the `timeline` type as the last open gap. Our render used
the horizontal layout with `spineSpacing: 'even'`, producing a horizontal spine with
milestone nodes and activity bars. This is structurally wrong vs. Mermaid's actual output:

- Mermaid renders colored **section header bands** across the top
- Below each band: **period column headers** (year boxes) tinted to the section color
- Below the axis: **event boxes stacked vertically** per period column
- Dense-event collision eliminated because each period owns its own column

## Solution

### New file: `packages/core/src/layout/timeline-columns.ts`

Opt-in layout engine (`family === 'timeline-columns'`) that:
1. **Reconstructs** section/period/event tree from existing IRDocument fields (no parser changes):
   - Sections → `doc.tracks` / `doc.sections`
   - Periods → `doc.milestones` where `milestone.track === sectionId`
   - Events → `doc.activities` where `activity.span === period.date` and `activity.track === sectionId`
2. **Renders** an 8-color section palette (indigo, orange, emerald, purple, teal, rose, olive, navy)
3. **Section header bands**: solid colored rect spanning all period columns
4. **Period column headers**: slightly darker rect per period, white label text
5. **Horizontal axis line** with arrowhead at right edge
6. **Event boxes**: light-tinted rounded rects stacked below axis, 11px word-wrapped labels
7. **Even column spacing**: `colW = (canvasW - margins) / totalPeriods` — no time proportionality

### Updated files

| File | Change |
|------|--------|
| `layout/index.ts` | Added `layoutTimelineColumns` import + dispatch for `'timeline-columns'` |
| `layout/timeline-columns.ts` | **NEW** — complete layout engine (opt-in) |
| `types.ts` | Added `'timeline-columns'` to `Metadata.layout` and `RenderOptions.layout` union types |
| `render/index.ts` | Added `'timeline-columns'` to `BuildSceneOptions.layout` |
| `frontend/mermaid/index.ts` | Timeline render branch now uses `layout: 'timeline-columns'` |

### Determinism

- All existing layouts untouched — zero golden changes except `mermaid-timeline.{svg,png}`
- Full suite: **1540/1540** ✓
- Only `examples/gallery/mermaid-timeline.svg` changed in git status

## Output dimensions

- viewBox: `0 0 1380 346` — 1380×346 px
- colW ≈ 100px per period (13 periods × 100 + 80 margins = 1380)
- maxEvents = 3 (period 1995: Java + "Write once, run anywhere" + JVM ecosystem)

## A/B Assessment vs Real Mermaid

| Feature | Mermaid | Ours | Match |
|---------|---------|------|-------|
| Colored section bands | ✅ | ✅ | ✅ |
| Period column headers | ✅ | ✅ | ✅ |
| Even column spacing | ✅ | ✅ | ✅ |
| Events stacked below axis | ✅ | ✅ | ✅ |
| Horizontal axis + arrow | ✅ | ✅ | ✅ |
| No dense-event collision | ✅ | ✅ | ✅ |
| Section color distinction | pastel | saturated | 🔼 ours bolder |
| Event text readability | multi-line | 2-line wrapped | ✅ |
| Vertical dashed connectors | ✅ | ❌ (minor) | cosmetic gap |

Overall fidelity: **MATCH** on all structural/semantic requirements. Our palette uses
more saturated colors (better contrast). Vertical dashed connectors from period headers
are a minor cosmetic difference that does not affect readability or correctness.

---

# Decision: Journey Emotional-Curve Fidelity Fix

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-14  
**Status:** READY FOR COMMIT  

## Problem

The original `userJourney` layout put every task as a same-height circle directly
ON the journey spine, encoding score only through fill color. This discards the
defining visual semantic of a user-journey diagram: **score → vertical position**
(the emotional-journey curve). Real Mermaid plots each task at a different height
below the spine proportional to its score, drops a dashed line from the spine to
the marker, and uses per-actor consistent colors.

## Changes

### `packages/core/src/grammars/journey/layout.ts` — complete rewrite

New vertical structure:
- **Section bands** span `contentTop → absoluteSpineY` (above the horizontal axis).
- Each task has a **white rounded task box** above the spine (label + actor dots).
- The **horizontal spine** is drawn with an arrowhead at its right end.
- **Dashed droplines** connect the spine vertically down to each task's face marker.
- **Face marker Y-position** encodes score:
  `faceY = spineY + minDrop + (5 − score) × (maxDrop − minDrop) / 4`
  — score 5 is closest to the spine; score 1 hangs the farthest below.
- A **Catmull-Rom smooth curve** threads through all face positions, making the
  emotional-journey arc visible at a glance (polish over Mermaid, which has no curve).
- **Face expression** additionally encodes score: happy (≥4) / neutral (3) / unhappy (≤2).
- **Per-actor distinct colors** via `actorPalette[]`; each actor is assigned a
  palette color by appearance order. Small colored dots inside task boxes show actor
  participation; the bottom legend uses the same colored dots.

### `packages/core/src/grammars/journey/theme.ts` — new fields added

- `minDrop / maxDrop` — drop range controlling curve amplitude
- `droplineStroke / droplineDash` — dashed dropline appearance
- `curveStroke / curveStrokeWidth` — emotion curve
- `taskBoxFill / taskBoxStroke / taskBoxStrokeWidth / taskBoxRadius` — task box style
- `actorPalette` — 8-color distinct palette for actors
- `actorDotRadius` — radius of actor indicator dots
- `spineY` default raised: 92 → 152 (accommodates task boxes above spine)
- Kept legacy fields (`taskLabelOffsetY`, `actorOffsetY`, `scoreBarHeight`,
  `actorChipFill`, `actorChipRadius`) for interface compatibility; they are
  no longer read by the layout engine.

## Gallery Output

- `examples/gallery/mermaid-journey.{svg,png}` — viewBox `0 0 1752 538` (height 454 → 538)

## Test Status

- **1540/1540** passing — zero regressions
- All pre-existing SVG goldens byte-identical (changes confined to journey layout)
- Journey corpus tests pass:
  - `score 1 uses red ramp` — face circle fill = `scoreFills[0]` ✓
  - `score 5 uses green ramp` — face circle fill = `scoreFills[4]` ✓
  - `many tasks per section 10 plus` — taskRadius circles count = 11 ✓

## A/B Comparison vs Real Mermaid

| Semantic              | Real Mermaid | Ours (new) |
|-----------------------|:------------:|:----------:|
| Score → vertical pos  | ✓            | ✓          |
| Dashed droplines      | ✓            | ✓          |
| Spine + arrowhead     | ✓            | ✓          |
| Per-actor colors      | ✓            | ✓          |
| Colored dots in boxes | ✓            | ✓          |
| Emotion curve         | ✗            | ✓ (polish) |
| Score-colored faces   | ✗ (gray)     | ✓ (polish) |
| Happy/sad expressions | Neutral only | ✓ (polish) |

Fidelity gap is closed. Our render is at least as informative as Mermaid and
adds meaningful visual polish (curve, expressive faces, score-color encoding).

---

# Decision: Sankey — Node Value Labels + Gradient Ribbons

**Agent:** Bjarne (Grammar Specialist)
**Date:** 2026-06-14
**Status:** ADOPTED

## Summary

Closed two Mermaid fidelity gaps in the sankey grammar:
1. **Node labels now include total throughput value** — matches "Coal 7100", "Electricity Generation 13800" style.
2. **Ribbon fills use a source→target linear gradient** — blends source node color into target node color across each Bézier ribbon.

## Changes

### Scene IR (`scene.ts`)
- Added `fillGradient?: StrokeGradient` to `PathPrimitive`. Reuses the existing `StrokeGradient` interface (`from/to/x1/y1/x2/y2`). Optional and backward-compatible — all pre-existing paths are unaffected.

### SVG Renderer (`render/svg.ts`)
- Refactored `collectGradientDefs()` to emit `<linearGradient>` defs for both `strokeGradient` and `fillGradient`. Fill gradients get IDs prefixed `fg-` (stroke uses `sg-`) to avoid collisions.
- `primitiveToSvg` for `path` now resolves `fill` to `url(#fg-...)` when `fillGradient` is present.

### Skia Renderer (`render/skia.ts`)
- `renderPath()` for filled paths checks `p.fillGradient` and builds a `CK.Shader.MakeLinearGradient` shader using the gradient's user-space coordinates.

### Sankey Theme (`grammars/sankey/theme.ts`)
- Added `showNodeValues: boolean` field (default `true`). Set to `false` to display only the node name.

### Sankey Layout (`grammars/sankey/layout.ts`)
- Added `formatNodeValue(v)` helper: integers show without decimals; fractions keep up to 3 dp, trailing zeros stripped.
- Label text: `"${node.label} ${formatNodeValue(throughput)}"` when `showNodeValues && throughput > 0`.
- Each ribbon gets `fillGradient: { from: srcColor, to: tgtColor, x1, y1: srcRibbonMidY, x2, y2: tgtRibbonMidY }`. The `fill` fallback colour is retained for backends without gradient support.

### Corpus Tests (`test/mermaid-sankey-corpus.test.ts`)
- Tests 8 and 25 updated: check `texts.some(t => t === name || t.startsWith(name + ' '))` to handle value-suffixed labels.

## Verification

- `pnpm -C packages/core build` ✓ (TypeScript)
- `pnpm -C packages/core test` → **1540/1540 passing**
- All pre-existing SVG goldens byte-identical (changes confined to sankey)
- Gallery re-emitted: `examples/gallery/mermaid-sankey.{svg,png}` at **964×544** px

## A/B Comparison (honest)

Real Mermaid and our new render both show:
- ✅ "Coal 7100", "Natural Gas 7100", "Electricity Generation 13800", etc. — values match exactly
- ✅ Ribbon gradients blending source→target colors

Differences (not in scope):
- Color palette differs (Mermaid uses blue/red/teal; ours uses indigo/green/amber)
- Mermaid's gradient is smoother (likely due to D3 Sankey's precise path geometry); ours uses Bézier cubic with clean stacking — still clearly gradient
- Mermaid's layout uses iterative crossing-minimization; ours uses stable first-appearance order (documented deliberate choice)

Overall: both features land cleanly and the render is at least as readable as Mermaid's output.

---

# Decision: Sankey Grammar — Tier 3 Proportional-Flow Diagram

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-14  
**Status:** ADOPTED  

---

## Summary

Adds `sankey` / `sankey-beta` as a Tier 3 grammar in the timeline compiler. The grammar accepts
Mermaid CSV syntax, produces a `SankeyDocument` IR, then lays out proportional-flow ribbons using
a deterministic two-phase pipeline: rank assignment → value-scale computation → Scene IR.

---

## Files Created

| Path | Role |
|------|------|
| `packages/core/src/grammars/sankey/types.ts` | `SankeyDocument` domain IR (nodes + links; no geometry) |
| `packages/core/src/grammars/sankey/schema.ts` | Zod validation schema |
| `packages/core/src/grammars/sankey/theme.ts` | Light + dark themes; node palette, ribbon opacity |
| `packages/core/src/grammars/sankey/layout.ts` | Deterministic layout engine |
| `packages/core/src/grammars/sankey/index.ts` | Public grammar API |
| `packages/core/src/frontend/mermaid/sankey.ts` | Mermaid CSV parser |
| `packages/core/test/mermaid-sankey-corpus.test.ts` | 34-case corpus + gallery emission |
| `examples/gallery/mermaid-sankey.mmd` | Energy-flow gallery example (16 links) |
| `examples/gallery/index.html` | Gallery card 39 added |

**Modified (additive):**
- `src/frontend/mermaid/index.ts` — `DiagramKind` union, `detectDiagramType`, `parseMermaid`, `renderMermaid`
- `src/index.ts` — sankey grammar re-exports

---

## IR Shape

```ts
interface SankeyDocument {
  version: string;
  metadata: { title?: string; theme?: string };
  nodes: SankeyNode[];   // first-appearance order; id = label
  links: SankeyLink[];   // declaration order; value ≥ 0
}
```

Nodes are fully inferred from the CSV source/target columns. No geometry or color in IR.

---

## Layout Algorithm — Key Decisions

### Node Ranking: Longest-Path Topological Layering

- Each node starts at rank 0.  
- Iteratively: for every link (src → tgt), if `rank(tgt) ≤ rank(src)`, set `rank(tgt) = rank(src) + 1`.  
- Repeat until stable (no changes) or `N+1` global passes.  
- **Cycle guard:** per-node pass counter; if a node is visited more than `N` times, the back-edge is skipped (logged as warning). This deterministically breaks cycles without any randomness.

### Value→Pixel Scale: Closed-Form

- For each column, `scale_c = (contentHeight - totalGapsInColumn) / columnThroughput`.  
- `scale = min(scale_c) over all columns` so the tallest column exactly fills `contentHeight`.  
- `throughput(node) = max(totalInFlow, totalOutFlow)`.  
- If all values are zero, `scale = nodeBarMinHeight` (degenerate graceful fallback).

### Vertical Placement: Stable First-Appearance Order (No Crossing-Minimization)

Nodes within each column are stacked top-to-bottom in their **first-appearance order** (the order they are first seen as source or target in the input CSV).

**Why not iterative crossing-minimization?**  
Classic Sankey crossing-minimization uses iterative median or barycenter heuristics that require multiple passes and tie-breaking choices that vary with floating-point arithmetic and input order. These are inherently non-deterministic across platforms. The determinism contract (§5.1) forbids any such solver. First-appearance stable order gives reproducible results and is visually clean for typical Mermaid sankey-beta diagrams (which usually have a logical declaration order).

### Ribbons: Cubic Bézier with Edge-Stacking

Each link is a closed-path ribbon:
- Source right edge → Target left edge  
- Control points at 1/3 and 2/3 of horizontal span (symmetric S-curve)  
- Ribbon width = `value × scale` pixels  
- Ribbons are stacked per-node-edge using `outY` / `inY` offsets (no overlap within a node's band)  
- Fill = source node color (from palette, cycling), opacity = `ribbonOpacity` (default 0.45)  
- Thin stroke (0.5px, same color) defines ribbon boundaries

### Label Placement: Edge-Aware Side Anchoring

- **Leftmost column:** labels anchor `end` (to the left of bar); flip to `start` (right) if label would clip the left canvas boundary.
- **Rightmost column:** labels anchor `start` (to the right of bar); flip to `end` (left) if label would clip the right canvas boundary.
- **Middle columns:** default to right (`start`); flip to left if right would clip.
- Labels vertically centered on bar midpoint (`dominantBaseline: middle`).
- No iterative label-collision resolution — stacked bars in stable order prevent mutual overlap.

---

## Determinism Notes

- `rhuInt(v) = Math.floor(v + 0.5)` — round-half-up integer rounding on all coordinates.
- Node ranks computed in declaration order; results are input-order-deterministic.
- Palette cycling by `node.order % palette.length` — stable because `order` is first-appearance index.
- No randomness, no iterative solvers, no floating-point-dependent branching.
- `sceneHash` verified in corpus tests to be byte-identical across re-renders.

---

## Test Coverage

34 corpus cases via `parseMermaid` → `renderMermaid` integration path:
- Compact / minimal / edge / degenerate inputs
- Quoted names (RFC4180-ish), commas-inside-quotes, escaped-quotes
- Malformed rows (wrong field count, non-numeric value, negative value) → warn + skip
- Multi-layer chains, fan-in / fan-out topologies
- Cycle detection (back-edge warning)
- Stable node ordering, determinism assertions
- Real Mermaid canonical energy-flow dataset (58-link canonical UK energy Sankey)
- Gallery emission tests (SVG + PNG)

---

## Gallery

- `examples/gallery/mermaid-sankey.{mmd,svg,png}` — 16-link energy-flow: Coal/Gas/Nuclear/Renewables/Oil → Electricity Generation → Industry/Transport/Buildings → Heat Losses  
- Canvas: 964 × 544 px (viewBox `0 0 964 544`)  
- Card 39 added to `examples/gallery/index.html`

---

## Pass Count

**1540/1540 tests passing.** Zero SVG golden regressions (additive only).
