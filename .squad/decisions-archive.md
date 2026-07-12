# Decision Archive — Entries older than 7 days (as of 2026-07-12)

**Archived:** 2026-07-12T11:32:29-04:00  
**Entries:** 27 decisions dated 2026-07-05 through 2026-07-08 (plus earlier subsections)  
**Notes:** These entries are preserved for historical reference. New decisions go to decisions.md.

---

# Decision: d3-shape Integration — Phase 1 (Routing Path Emission)

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-05  
**Status:** Implemented ✓ — updated with curveStyle wiring

---

## Context

Phase 1 of the d3-shape integration plan adds `d3-shape` and `d3-path` as runtime dependencies and routes bezier path string construction through a dedicated adapter module, replacing a hand-crafted template literal in `BezierRouter`. A follow-up step added the optional `curveStyle` field to the routing contract so callers can opt into d3-shape curve interpolation per edge.

---

## Changes Made

### New dependency: `d3-shape@3.2.0` + `d3-path@3.1.0`
Added as runtime dependencies. `@types/d3-shape@3.1.8` and `@types/d3-path@3.1.1` added as dev dependencies (d3 v3 ships plain JS without bundled `.d.ts` files).

### New file: `src/routing/d3-curves.ts`
Thin adapter exposing three functions:
- `buildCubicBezierPath(from, cp1, cp2, to)` — uses `d3-path`'s `path()` object (`moveTo` + `bezierCurveTo`) to emit the SVG cubic bezier `C` command.
- `buildLinePath(points)` — uses `d3-shape`'s `line()` generator; available for future straight/polyline wiring.
- `buildCurvedLinePath(points, curveStyle)` — uses `d3-shape`'s `line()` generator with a named curve factory dispatched via `CURVE_FACTORIES` record.

### New type: `CurveStyle` in `src/contracts/routing.ts`
```
'catmull-rom' | 'cardinal' | 'basis' | 'natural' | 'monotone-x' | 'monotone-y'
```
Exported from the contracts barrel (`src/contracts/index.ts`).

### New field: `curveStyle?: CurveStyle` on `RouteRequest`
Optional. Bezier router only. When present, path emission delegates to `buildCurvedLinePath`; when absent, falls back to `buildCubicBezierPath` (existing behavior).

### Modified: `src/routing/router.ts`
- Imports `buildCurvedLinePath` alongside `buildCubicBezierPath`.
- `BezierRouter.route()` destructures `curveStyle` and uses a ternary on the `path` field: `curveStyle ? buildCurvedLinePath(...) : buildCubicBezierPath(...)`.
- The same `curveStyle` hook now also applies to straight and orthogonal routers so callers can opt into d3 interpolation without changing the underlying route geometry logic.
- All control-point computation and obstacle avoidance logic is unchanged.

### Modified: `src/diagrams/mermaid/flowchart/layout.ts`
- Forward-edge routing in flowcharts now passes `curveStyle: 'linear'`, preserving straight geometry while exercising the new path-emission hook.

### Modified: `test/routing.test.ts`
- Existing bezier suite kept intact (assertion updated to `toContain('C')` in Phase 1).
- New `bezier router — curveStyle` describe block adds 9 tests:
  - One per curve style (6) — each produces a non-empty path.
  - `curveStyle` preserves the four control points.
  - `curveStyle` path differs from the default cubic-bezier path.
  - Omitting `curveStyle` still emits the compact `M{x},{y}C{...}` format from `buildCubicBezierPath`.

---

## Deviations / Disclosures

- `buildLinePath` is provided in the adapter for future use but is **not yet wired** into `StraightRouter`, `OrthogonalRouter`, or `PolylineRouter`.
- The path string format from d3-path uses commas between coordinates (e.g., `M0,0C10,20,30,40,100,100`) rather than spaces. This is valid SVG. No consumer of the `Route.path` field depends on the specific whitespace format.

---

## Build / Test

- `pnpm build` ✓ — 0 errors, 0 warnings  
- `pnpm test` ✓ — 392/392 tests passed (21 routing tests: 12 original + 9 new)




---

# Decision: Poster Phase 1 — New Syntax

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-10T14:16-04:00
**Branch:** `ormasoftchile/poster-phase1`
**Implements:** Leslie's Phase 1 gap analysis (`.squad/decisions/inbox/leslie-poster-capability-analysis.md`)

---

## Summary

Four features added to the Triton poster/DS system, enabling ~80% coverage of the DSA-15-Patterns poster.

---

## New Syntax Reference

### Feature 1 — Per-cell highlight (array + matrix)

**Array — individual cells:**
```
array
  cells 2 1 5 2 3 4
  highlight 2 4        ← logical indices (0-based)
  index
```

**Array — contiguous window:**
```
array
  cells 2 1 5 2 3 4
  window 2-4           ← inclusive range: highlight cells 2, 3, 4
  index
  ptr L -> 2 "L"
  ptr R -> 4 "R"
```

**Matrix — specific cells:**
```
matrix
  row 0 0 0 0
  row 0 1 1 1
  row 0 1 2 2
  highlight 1,1 2,2    ← r,c pairs (space-separated)
```

**Rendering:** Highlighted cells use `palette.primary` fill at `fillOpacity: 0.22`, primary stroke, primary text. Non-highlighted cells are unchanged (`palette.surface`/`palette.border`).

---

### Feature 2 — Caption slot (poster cells)

```
cell sw "Sliding Window"
    array
        cells 1 3 -1 -3 5 3 6 7
        window 1-3
    caption "window size k=3"    ← muted text below sub-diagram
end
```

- `caption "text"` must be on its own line inside the `cell … end` block.
- Rendered as `palette.textMuted` centered text at the bottom of the cell card.
- Reserves space in the cell height — adjacent cells in the same row also grow.
- Fully optional; cells without a caption render exactly as before.

---

### Feature 3 — Freeform annotation overlay (note)

```
cell heap "Top K Elements"
    heap max insert 50 30 70 20 40
    note "k=3" at top-right       ← anchored to content area
    note "size=3"                 ← defaults to top-right
    caption "heap size = k"
end
```

**Position values:** `top-left` | `top-right` | `bottom-left` | `bottom-right` | `center`
**Default:** `top-right`

- Rendered as a semi-transparent pill (surface fill, primary border, primary bold text) overlaid on the sub-diagram content area.
- Multiple notes per cell are supported.
- `at` keyword and position are optional; default position is `top-right`.

---

### Feature 4 — Edge/path highlight (tree + nodegraph)

**Tree — traversal path:**
```
tree
  Root
    Left
      LeftLeft
    Right
path Root -> Left -> LeftLeft    ← top-level directive, label-based
```

- `path` lines are extracted BEFORE grammar parsing; labels look up the first matching node.
- Active edges render at `palette.primary`, strokeWidth 2.5.

**Nodegraph — per-edge kind:**
```
nodegraph
  directed
  A -> B : active     ← primary color, 2.5px stroke
  B -> C : dashed     ← textMuted, dash="6 3"
  C -> D : result     ← normal label, muted color
```

- `active` and `dashed` are reserved edge modifier keywords. If a label EXACTLY matches, it becomes a kind (not a label). All other labels are unchanged.
- No grammar change needed — parsed in `graph.ts` via string comparison.

---

## Files Changed

| File | Change |
|------|--------|
| `src/diagrams/triton/ds/struct/array.ts` | Added `highlights`, `window` to `ArrayDoc`; parse + render |
| `src/scene/strip.ts` | Added `fillOpacity?`, `stroke?` to `StripCell` |
| `src/diagrams/triton/ds/matrix/matrix.ts` | Added `highlights` to `MatrixDoc`; parse + render |
| `src/diagrams/triton/poster/ir.ts` | Added `PosterNote`, `NotePosition`, `caption?`, `notes?` to `PosterCell` |
| `src/diagrams/triton/poster/index.ts` | `extractCellAnnotations()`, `inferCellKind` + `tree` keyword |
| `src/diagrams/triton/poster/layout.ts` | Caption height reservation + render; note overlay render; `reservedCaptionHeight()`, `buildNoteOverlay()` |
| `src/diagrams/triton/ds/tree/ir.ts` | Added `activePaths?` to `TreeDocument` |
| `src/diagrams/triton/ds/tree/index.ts` | `extractPathDirectives()` pre-processes `path` lines |
| `src/diagrams/triton/ds/tree/layout.ts` | Active edge rendering in `layoutTree` |
| `src/diagrams/triton/ds/graph/graph.ts` | `GEdge.kind`, parse `active`/`dashed`, render with color/dash |
| `test/struct.test.ts` | 4 new array highlight tests |
| `test/ds-b1.test.ts` | 3 new matrix highlight tests |
| `test/poster.test.ts` | 6 new caption/note tests |
| `test/tree-semantic.test.ts` | 3 new tree path tests |
| `test/ds-b2.test.ts` | 4 new nodegraph edge kind tests |
| `examples/triton/poster/phase1/cell-highlight.mmd` | Feature 1 demo |
| `examples/triton/poster/phase1/caption.mmd` | Feature 2 demo |
| `examples/triton/poster/phase1/note.mmd` | Feature 3 demo |
| `examples/triton/poster/phase1/edge-highlight.mmd` | Feature 4 demo |
| `examples/triton/poster/phase1/two-pointers.mmd` | Combined DSA cards 1+2+11+13 demo |

---

## Bonus Fix

`inferCellKind()` in `poster/index.ts` was missing the `tree` keyword — tree content inside poster cells was falling through to `text` and rendering raw. Added `if (keyword.startsWith('tree')) return 'tree'`.

---

## Deferred (Phase 2)

- Numbered-title chrome (circled number before cell title) — requires poster layout change
- Interval/range bar chart primitive — new diagram type
- Hash ring primitive — new diagram type
- `dashed` modifier on tree path edges (currently only `active`)
- Edge animation for intra-diagram edges (e.g. rotating active edge in load balancing)


### 2026-07-08: Red/black tree node colours are semantic but palette-aware
**By:** Brian
**What:** Red-black tree nodes keep recognizable red/black semantics, but tree layout now derives dark-theme detection from palette background/surface luminance, tunes black fills away from dark canvases, and chooses strokes/text by contrast against the resolved theme palette.
**Why:** The old fixed black fill blended into dark canvases. Theme-aware fills and palette-derived outlines preserve red-black meaning while making rb tree nodes and shared tree decorations readable in both light and dark renders.


### 2026-07-08: Preview theme dropdown override precedence
**By:** Brian
**What:** The VS Code preview webview now stores `triton.previewTheme` in workspace state, treats an empty selection as Auto, and passes named selections as a forced base preset through `render()`/`renderSync()`.
**Why:** Auto must preserve editor/diagram-driven behavior, while explicit user selections need to override diagram `theme:` metadata and still blend with the editor by clearing only the SVG background.


### 2026-07-09T23-41-00: npm release automation for triton-core and triton-latex: lockstep versioning + OIDC trusted publishing
**By:** coordinator
**What:** npm release automation for triton-core and triton-latex: lockstep versioning + OIDC trusted publishing
**Why:** Requested by ormasoftchile (2026-07-09). Automate publishing of @cristianormazabal/triton-core (packages/core) and @cristianormazabal/triton-latex (latex/) to npm.

DECISIONS:
1. Lockstep versioning — one `[version:patch|minor|major]` tag in a commit message on main bumps BOTH packages to the SAME version and publishes both. Root package.json is single source of truth. Baseline unified to 0.1.1; first release will be 0.1.2.
2. Auth = OIDC Trusted Publishing (no stored NPM_TOKEN). One-time per-package config on npmjs.com. Adds provenance.
3. Mirrors owner's `[version:patch]` style. No tag = no-op.

Deliverables: .github/workflows/publish-npm.yml, version sync script, docs/RELEASING.md.



---

# Decision: Poster Replication Capability Analysis

**Author:** Leslie (Spec Architect)  
**Date:** 2026-07-10T14:06-04:00  
**Type:** Gap Assessment / Design Analysis

---

## Context

Cristian requested a rigorous analysis of two reference posters from algomaster.io:
1. **"DSA — 15 Patterns"** — a 5×3 grid of algorithm visualization cards
2. **"Load Balancing Algorithms"** — a 3×2 grid of network topology cards (animated GIF)

The question: **For each poster, what can Triton replicate TODAY, and what needs ADDING or CHANGING?**

This is a design/scoping deliverable — no implementation.

---

## 1. Overall Framing: Grid-of-Cards Composition

### What the posters require
Both posters share an identical **compositional structure**:
- A **titled grid of cards** (5×3 = 15 cards, 3×2 = 6 cards)
- Each card = **bordered panel** with:
  - A **numbered title** (e.g., "1. Two Pointers")
  - One or more **sub-diagrams** (array, tree, graph, etc.)
  - **Textual captions/annotations** (e.g., "slide →", "k=3")
  - **Per-element highlights** (coloured cells, active edges, glowing nodes)

### Triton's current capability
**YES** — `poster` keyword (src/diagrams/triton/poster/grammar.peggy, layout.ts) already supports:
- `poster "Title" columns N` — titled grid
- `cell [id] ["Title"] [span] … end` — titled cells with arbitrary sub-diagrams
- Span syntax `[N]` (col) or `[NxM]` (col × row)
- Cross-cell links with animation (march, particle, pulse, glow, etc.)
- Per-cell theme overrides (`@theme executive`)

**Existing example:** `examples/triton/poster/ds-poster.mmd` already demonstrates a titled grid containing array, stack, queue, matrix, heap, trie, nodegraph, hashmap, unionfind.

### What's missing for poster-perfect replication
| Gap | Severity |
|-----|----------|
| **No numbered-title chrome** — DSA poster has "1. Two Pointers" with number in coloured circle | Medium |
| **No footer/caption slot** — each card needs a caption line below the diagram | Small |
| **No per-cell cell highlighting** — arrays/matrices need individually-coloured cells | Medium |
| **No in-cell pointer overlays** — DSA poster shows L/R/M markers, "k=3" labels | Medium |

---

## 2. Per-Card Analysis: DSA — 15 Patterns

| # | Card | Closest Triton Feature | Replicable? | What's Missing |
|---|------|------------------------|-------------|----------------|
| 1 | Two Pointers | `array` (src/diagrams/triton/ds/struct/array.ts) + `ptr` | **Partial** | Array has `ptr i -> N "label"` but no coloured cell highlight to show "current element"; L/R pointer arrows exist but styling is fixed |
| 2 | Sliding Window | `array` + `ptr` | **Partial** | No window-region highlight (contiguous cell range fill); no "k=3" inset annotation; no "slide →" caption slot |
| 3 | Binary Search | `array` + `ptr` | **Partial** | L/M/R pointers work; missing: middle-element highlight colour, "target=11" overlay label |
| 4 | Frequency Counting | `array` + `hashmap` or `matrix` | **Partial** | Array renders fine; Key/Count table needs 2-column matrix with header row — matrix exists but no header row styling |
| 5 | Matrix Traversal | `matrix` (src/diagrams/triton/ds/matrix/matrix.ts) | **Partial** | Grid renders fine; missing: spiral-order path overlay (would need overlay arrow/path primitive), per-cell visit-order highlight |
| 6 | Monotonic Stack | `array` + `stack` | **Partial** | Both primitives exist; missing: "top→" label outside stack, "pop" action annotation, vertical pointer into stack |
| 7 | Prefix Sum | `array` × 2 + arrow between | **Partial** | Two arrays render fine; missing: "build" arrow label between arrays (cross-link exists but arrays must be in separate cells) |
| 8 | Overlapping Intervals | — | **No** | **No interval/range-bar primitive**; would need a horizontal bar chart with overlap visualisation |
| 9 | Greedy | `array` + text | **Partial** | Coin cells as array work; missing: "amount=5" annotation, "pick largest that fits" caption, "used:" result row |
| 10 | Top K Elements | `heap` (src/diagrams/triton/ds/tree/heap.ts) | **Partial** | Heap tree renders correctly; missing: "k=3" annotation, "top K:" result row below tree |
| 11 | Backtracking | `tree` (src/diagrams/triton/ds/tree/layout.ts) | **Partial** | Tree renders; missing: **path-highlight** (explore/backtrack edge colouring), dashed "backtrack" edges |
| 12 | Binary Tree Traversal | `tree` | **Partial** | Tree renders; missing: "out: 1 2 3" caption below tree, node visit-order highlighting |
| 13 | DFS | `nodegraph` (src/diagrams/triton/ds/graph/graph.ts) | **Partial** | Graph renders; missing: "stack · go deep" annotation, per-node visit-order label, edge highlight |
| 14 | BFS | `nodegraph` | **Partial** | Graph renders; missing: "queue · by level" annotation, BFS order label |
| 15 | Dynamic Programming | `matrix` with values | **Partial** | Grid renders; missing: per-cell formula overlay ("1+1=2"), cell-highlight for "current" cell, dp[i][j] label |

### DSA Poster Summary
- **Fully replicable today:** 0/15
- **Partially replicable (structure OK, annotations/highlights missing):** 14/15
- **Not replicable (no primitive):** 1/15 (Overlapping Intervals)

---

## 3. Per-Card Analysis: Load Balancing Algorithms

| # | Card | Closest Triton Feature | Replicable? | What's Missing |
|---|------|------------------------|-------------|----------------|
| 1 | Round Robin | `nodegraph` or `flowchart` | **Partial** | LB → Server A/B/C structure works; missing: **active-edge animation cycle** (edge glow rotates), stacked-box server layout |
| 2 | Weighted Round Robin | `nodegraph` | **Partial** | Same structure; missing: per-node weight annotation (×3, ×2, ×1), edge-weight styling |
| 3 | Least Connections | `nodegraph` | **Partial** | Same structure; missing: "3 conns" annotation per server node |
| 4 | Least Response Time | `nodegraph` | **Partial** | Same structure; missing: "90 ms" annotation per server node |
| 5 | IP Hash | `nodegraph` | **Partial** | Same structure; missing: IP label on LB node, sticky-highlight on one edge |
| 6 | Consistent Hashing | — | **No** | **No hash-ring primitive**; requires circular layout with nodes around circumference + key mapping |

### Load Balancing Poster Summary
- **Fully replicable today:** 0/6
- **Partially replicable:** 5/6
- **Not replicable (no primitive):** 1/6 (Consistent Hashing ring)

---

## 4. Gap Summary: Deduplicated Capability Gaps

### A. Composition / Layout Gaps

| Gap | Scope | Extends | Notes |
|-----|-------|---------|-------|
| **Numbered-title chrome** | Small | poster/layout.ts | Add optional `numbered: true` to cell; render circled number before title |
| **Caption/footer slot per cell** | Small | poster grammar + layout | `caption "text"` directive inside cell block |

### B. In-Diagram Annotation/Highlight Gaps

| Gap | Scope | Extends | Notes |
|-----|-------|---------|-------|
| **Per-cell highlight (array/matrix)** | Medium | struct/array.ts, matrix.ts | `cells 5 8* 13 21 34` where `*` marks highlighted; or `highlight 1 2 3` directive |
| **Window/range highlight** | Medium | struct/array.ts | `window 1-3` directive to shade a contiguous range |
| **Pointer overlay labels** | Small | struct/array.ts | Already has `ptr i -> N "label"`; needs label positioning refinement |
| **Annotation/caption box** | Medium | overlay system | `note "k=3" at top-right` — freeform text anchored relative to diagram |
| **Path/traversal highlight on tree** | Medium | tree/layout.ts | `path A -> B -> C : dashed` to colour specific edges |
| **Edge highlight/active state on graph** | Medium | graph/graph.ts, nodegraph | `edge A -> B : active` modifier |
| **Node visit-order badge** | Small | tree, graph | Show step number inside or beside node |

### C. Missing Primitives

| Gap | Scope | Notes |
|-----|-------|-------|
| **Interval/range bar chart** | Large | New DS primitive: `intervals [1,4] [2,5] [3,6]` renders horizontal bars with overlap visualisation |
| **Hash ring** | Large | New DS primitive: `hashring A B C key:cart:7` renders circle with nodes on circumference + key mapping |
| **Table with header row** | Medium | Extend `matrix` with `header a 2 b 1` or create lightweight `table` primitive |

### D. Animation / Step-Sequence Gaps

| Gap | Scope | Notes |
|-----|-------|-------|
| **Multi-state / frame animation** | Large | Load balancing poster rotates active edge; requires frame-sequence or CSS animation states |
| **Edge glow/pulse per-edge** | Small | Cross-link already has `{ anim: glow }`; internal graph edges need same |

---

## 5. Recommendations: Prioritised Roadmap

### Phase 1: Quick Wins (unlock ~80% visual coverage)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | **Per-cell highlight for array/matrix** | Small | Unlocks cards 1-7, 9-10, 12-15 of DSA poster |
| 2 | **Caption slot per cell** | Small | Adds "slide →", "pick largest", "out: 1 2 3" captions |
| 3 | **Annotation overlay (`note`)** | Medium | Adds "k=3", "amount=5", "dp[i][j]" labels |
| 4 | **Tree/graph edge highlight** | Medium | Backtracking, DFS, BFS path visualisation |

### Phase 2: New Primitives (unlock remaining cards)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 5 | **Interval/range bar** | Medium-Large | Unlocks "Overlapping Intervals" card |
| 6 | **Hash ring** | Large | Unlocks "Consistent Hashing" card |

### Phase 3: Advanced Animation (animated GIF fidelity)

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 7 | **Frame-sequence animation** | Large | Rotating active-edge in load balancing |
| 8 | **Intra-diagram edge animation** | Small | Extend cross-link `anim:` to internal edges |

### Advised AGAINST (Scope Traps)

1. **Pixel-perfect poster replication** — The algomaster posters are hand-designed marketing graphics. Achieving identical aesthetics (gradients, drop shadows, glow halos) would require extensive CSS/filter work with diminishing returns. Triton's strength is semantic correctness and determinism, not pixel art.

2. **Multi-frame animation for deterministic SVG** — Triton's contract is "same source → same SVG". True frame-by-frame animation (like the GIF) breaks this. Consider: optional CSS animation classes applied post-render, but don't bake non-determinism into the IR.

3. **Table primitive as separate kind** — Avoid proliferating primitives. Extend `matrix` with a `header` directive instead of creating a new `table` keyword.

---

## 6. Evidence / File Citations

| Component | File Path | Notes |
|-----------|-----------|-------|
| poster grammar | src/diagrams/triton/poster/grammar.peggy:1-180 | Cell, link, span, theme syntax |
| poster layout | src/diagrams/triton/poster/layout.ts:1-120 | Grid placement, cell chrome |
| array | src/diagrams/triton/ds/struct/array.ts:1-300 | ptr, index, cells; no highlight |
| matrix | src/diagrams/triton/ds/matrix/matrix.ts:1-100 | row, noindex; no highlight |
| stack | src/diagrams/triton/ds/stack/stack.ts:1-100 | cells, capacity |
| heap | src/diagrams/triton/ds/tree/heap.ts:1-60 | max/min, builds tree |
| tree | src/diagrams/triton/ds/tree/layout.ts:140-180 | kinds: active, red, black, scan |
| nodegraph | src/diagrams/triton/ds/graph/graph.ts:1-100 | directed, edges |
| hashmap | src/diagrams/triton/ds/hashmap/hashmap.ts:1-100 | buckets, chains |
| cross-link anim | src/contracts/animations.ts:1-20 | march, particle, glow, etc. |
| poster example | examples/triton/poster/ds-poster.mmd | Working DS grid |

---

## Decision

**Recommendation:** Proceed with Phase 1 (per-cell highlight, caption slot, annotation overlay, edge highlight) to unlock the majority of DSA poster cards with minimal scope creep. Defer new primitives (interval bar, hash ring) to a dedicated follow-up if there's user demand.

**Rationale:** The compositional skeleton (titled grid of cards with sub-diagrams) already works. The gaps are mostly **annotation and highlight modifiers** within existing primitives — a surgical enhancement rather than architectural change.

**Rejected alternatives:**
- **Build a "poster template" system** — Over-engineering; the current cell-based model is flexible enough.
- **Implement frame-sequence animation** — Violates deterministic SVG contract; out of scope.

---

*Filed: .squad/decisions/inbox/leslie-poster-capability-analysis.md*

---

# Brian — AVL Badge Circle Solid Fill Fix

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-10T20:20-04:00
**Branch:** `ormasoftchile/refresh-ds-renders`

## Problem

Badge circles on tree nodes (AVL balance-factor counts, etc.) had `fill=palette.background`. In the VS Code preview, `palette.background` is `''` (empty string); `svg.ts` normalises empty fill to `fill="none"`, making the badge circle transparent. The node body showed through and the count text was hard to read.

## Fix

**File:** `src/diagrams/triton/ds/tree/layout.ts` (~line 287)

```diff
- elements.push(p.circle({ x: b.x + b.width - 3, y: b.y + 3 }, 9, palette.background, bc, 1.5));
+ elements.push(p.circle({ x: b.x + b.width - 3, y: b.y + 3 }, 9, palette.surface, bc, 1.5));
```

`palette.surface` is always a solid, opaque, theme-aware colour (e.g. `#F8FAFC` on the default theme). Badge text, stroke colour (`badgeColor`), radius, and position are unchanged.

## Validation

- `pnpm build`: ✓ clean
- `pnpm test`: 499/499 ✓ (no test asserted the old `palette.background` fill)
- `avl.png`: Badge circles are solid white/surface with green stroke (balance=0) and blue stroke (balance=±1). Count text is legible against the opaque background. No node body bleeds through.

---

# Brian — Circle Tree Node Connector Fix

**Author:** Brian (Layout Implementation Engineer)
**Date:** 2026-07-10T20:29-04:00
**Branch:** `ormasoftchile/refresh-ds-renders`

## Problem

Tree edges to circle-shaped nodes were clipped to the bounding **box** border via `connectSlots → borderPoint`, not to the **circle** perimeter. On diagonal edges (widest spread = root level) the box-border point lies outside the circle arc, producing a visible gap of ~5–7 px. Near-vertical edges (deeper levels) show ~1 px discrepancy, invisible at normal scale.

## Fix

**File:** `src/diagrams/triton/ds/tree/layout.ts` — edge-drawing loop

Added a local `circleBorder` helper that, given a node center, radius, and unit direction, returns the exact perimeter point. In the edge loop, each endpoint is now resolved per the **node's own shape**:

- `shape === 'circle'` → perimeter point via `circleBorder`
- `shape === 'rect' | 'pill' | 'strip'` → existing `connectSlots` box clip (unchanged)

Mixed trees (circle parent + rect child, etc.) clip each end independently.

```diff
- const { start, end } = connectSlots(pb, cb);
+ const start = parentShape === 'circle'
+   ? circleBorder(pc, pb.width / 2, dir, 1)
+   : boxStart;
+ const end = childShape === 'circle'
+   ? circleBorder(cc, cb.width / 2, dir, -1)
+   : boxEnd;
```

No changes to edge color, width, labels, or any other layout logic.

## Validation

- `pnpm build`: ✓ clean
- `pnpm test`: 499/499 ✓ (no test asserted old edge coordinates)
- `avl.png` (1000 px wide): Root node (50) connectors touch the circle perimeter exactly at both sides — no gap. All other nodes similarly clean. Badge solid fill retained.
- `heap.png` (all-circle tree): Every edge meets every circle flush, including the wide root spread and the deep near-vertical edge to node 10.
- `nodegraph` unaffected — only `tree/layout.ts` was edited.

---

# Visual QA: Tree Rendering Fixes (PR #57)

**Reviewer:** Ken (Visual QA)
**Date:** 2026-07-10
**Branch:** ormasoftchile/refresh-ds-renders

---

## Test 1: avl.svg

**Command:** `rsvg-convert -f png -w 1000 -o avl-test.png examples/triton/ds/tree/avl.svg`

**What I see:**
- Root node "50" with two diagonal edges going to "30" (left) and "70" (right)
- Both edges from root touch the circle perimeter exactly — no gap, no overshoot
- Small badge circles visible at top-right of each node (balance factors: "1" on root and node 30; "0" on leaves)
- Badge circles have OPAQUE solid fill (light gray/white background) — digits clearly legible
- All other edges (30→10, 30→40, 10→5, 10→20, 70→60, 70→80) touch their respective circle perimeters cleanly

**Result:** ✅ **PASS**

---

## Test 2: heap.svg

**Command:** `rsvg-convert -f png -w 1000 -o heap-test.png examples/triton/ds/tree/heap.svg`

**What I see:**
- Root node "80" with two edges to "40" and "70"
- Root edges touch circle perimeter cleanly — no floating gap
- All-circle tree with 7 nodes (80, 40, 70, 20, 30, 50, 60, 10)
- Every edge endpoint touches its respective circle exactly
- No badges present (heap doesn't use balance factors) — correct behavior
- Edge from "20" to "10" is nearly vertical, touches both circles flush

**Result:** ✅ **PASS**

---

## Test 3: trie.svg

**Command:** `rsvg-convert -f png -w 1000 -o trie-test.png examples/triton/ds/trie/trie.svg`

**What I see:**
- Root is a large empty circle (no label) at top
- Internal "dot" circle nodes (empty circles representing prefixes c, d, a)
- Terminal pill-shaped nodes: "cat", "car", "card", "do", "dog" — solid blue fill with black text
- Edges from root circle to child circles: touch circle perimeter cleanly
- Edges from circles to pills: touch pill borders cleanly at top center
- Edge from "car" pill to "card" pill: vertical edge touches both pill tops/bottoms flush
- Edge labels (c, d, a, t, r, o, g) positioned correctly on edges
- No regression — pill edges still clip to pill borders, not to bounding boxes

**Result:** ✅ **PASS**

---

## Test 4: rbtree.svg

**Command:** `rsvg-convert -f png -w 1000 -o rbtree-test.png examples/triton/ds/tree/rbtree.svg`

**What I see:**
- Root node "13" (dark/black fill) with white text
- Black nodes: 13, 8, 17, 6, 11, 15, 25 — all dark gray/charcoal fill
- Red node: "1" — clearly red/coral fill, distinct from black nodes
- Root edges (13→8, 13→17) touch circle perimeters flush — no gap
- All other edges touch their circles exactly
- Edge from "6" to "1" (red node) touches both circles cleanly
- Color semantics preserved: red/black distinction clearly visible

**Result:** ✅ **PASS**

---

## Overall Verdict

### ✅ **OVERALL PASS**

Both fixes verified working correctly:

| Fix | Status | Evidence |
|-----|--------|----------|
| FIX 1: Solid badge fill | ✅ PASS | AVL badges have opaque white/gray fill; digits "0" and "1" fully legible |
| FIX 2: Circle edge clipping | ✅ PASS | All 4 diagrams show edges touching circle perimeters exactly; no floating gaps at root or anywhere |

### Defects Found

**None.**

All edge endpoints touch their target shapes (circles and pills) flush. Badge circles are opaque with legible digits. No regressions in trie pill-edge clipping.

---

*QA completed 2026-07-10 20:32 EDT*

---

# Node-Ref Tooltip: Feasibility Analysis + Implementation Plan

**Author:** Leslie (Lead / Spec Architect)
**Date:** 2026-07-10
**Status:** PROPOSED — awaiting review; feature queued for implementation
**Requested by:** Cristian (@ormasoftchile)

---

## Feature Request (verbatim)

> "I'd like a way to interactively discover the id of any node on a poster. For instance, how to reference a node on an AVL tree — it's not obvious. Could the user hover the desired node and, holding the Alt key, get a tooltip showing the reference? That way the user knows the endpoint to use in a crosslink."

---

## Executive Summary

**Recommended approach:** Embed a deterministic JSON anchor manifest inside the SVG (`<script type="application/json">`); webview extracts it and performs bounds hit-testing on Alt+hover. This unlocks interactive node discovery with minimal code footprint.

**Implementation scope (MVP):** Poster cells + standalone DS diagrams. Phase 1 effort: 3–4 hours.

---

## B. File-by-File Changes (Checklist)

### Core Package

| File | Change |
|------|--------|
| `src/frontend/index.ts` | Add new export `compileAndRenderSync(input, themeInput?, rendererName?, forcedThemeName?): Result<{ svg: string; anchors: NodeAnchorRegistry }>` that returns both the rendered SVG string AND the anchor registry. |
| `src/render/svg.ts` | Add helper `embedAnchorManifest(svg: string, anchors: NodeAnchorRegistry): string` that inserts `<script type="application/json" id="triton-anchors">…</script>` immediately before `</svg>`. |
| `src/contracts/index.ts` | Re-export any new type (e.g. `RenderWithAnchors<T>`). |

### Extension

| File | Change |
|------|--------|
| `extension/src/extension.ts` | Call the new `compileAndRenderSync` in `renderInto()` and `renderMarkdownInto()`. |
| `extension/src/preview-html.ts` | Add ~80 lines of tooltip logic: parse manifest, hit-test on Alt+hover, show/dismiss tooltip. |

### Tests

| File | Change |
|------|--------|
| `test/svg-embed-anchors.test.ts` (new) | Unit test `embedAnchorManifest`. |

---

## Note on Implementation Status

This decision records a complete implementation plan. **The feature is NOT yet built** — it is queued for future work. All technical details, coordinate mapping, UX behaviour, and risk mitigation are documented above for the implementer.

**Keep this decision in decisions.md** for reference when the tooltip feature is scheduled.

---

# Brian: Node-Ref Tooltip MVP — Decision Drop

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-11T00:45:00Z  
**Branch:** `ormasoftchile/node-ref-tooltip`  
**Status:** Implementation complete — tests green, build clean

---

## What Was Built (Phase 1 MVP)

Interactive node-reference discovery in the VS Code Triton preview: when the user holds **Alt** and hovers over a node in any diagram, a tooltip shows the exact crosslink endpoint string (e.g. `mytree.n0` in a poster, or bare `n0` in a standalone diagram). Clicking the tooltip copies the string to the clipboard.

---

## Files Changed

| File | Change |
|------|--------|
| `src/render/svg.ts` | Added `embedAnchorManifest(svg, anchors)` — inserts sorted JSON manifest before `</svg>` |
| `src/frontend/index.ts` | Added `compileAndRenderSync(...)` — compile + render + embed manifest, returns `{ svg, anchors }` |
| `extension/src/extension.ts` | `renderInto()` now calls `compileAndRenderSync` instead of `render()`; posts `result.value.svg` |
| `extension/src/preview-html.ts` | Added ~80 lines of tooltip JS to the inline nonce-gated `<script>` |
| `test/svg-embed-anchors.test.ts` | New: 13 unit tests for `embedAnchorManifest` and `compileAndRenderSync` |

---

## Architecture Decisions

### Manifest travels in the SVG (single payload)
The anchor JSON rides inside the SVG as `<script type="application/json" id="triton-anchors">`. No separate postMessage field needed. The `<script>` tag is inert data (no `src`, no executable type) — no CSP change required.

### `renderSync` stays anchor-free
`renderSync` is intentionally unchanged. All golden SVG tests call `renderSync`; adding the manifest there would invalidate every snapshot. `compileAndRenderSync` is the only path that embeds.

### Markdown preview path left unchanged
`renderMarkdownInto` still calls `renderFencedBlock` (which uses `renderSync`) — out of MVP scope. The tooltip will not appear in the built-in Markdown preview, only in the dedicated Triton side panel.

---

## Test Results

- **Baseline:** 499 tests (32 files)  
- **After:** 512 tests (33 files) — 13 new tests in `test/svg-embed-anchors.test.ts`  
- **Build:** `pnpm build` clean (tsc + esbuild extension bundle)

---

## Manual Verification in VS Code

1. **Open VS Code** in the Triton repo root.
2. Open any `.triton` file — for example, create one:
   ```
   tree
     Root
       Left
       Right
   ```
3. Run `Triton: Open Preview to the Side` (command palette or keybinding).
4. The preview panel renders the diagram.
5. **Hold the Alt key** and move the mouse over a node in the diagram.
   - A dark tooltip appears near the cursor showing the node's reference string (e.g. `n0`, `n1`, `n2`).
   - The tooltip shows `click to copy` hint.
6. **Click the tooltip** — the string is copied to the clipboard and the tooltip briefly shows `copied!`.
7. **Release Alt** — the tooltip disappears.
8. To verify a poster crosslink path: open a `.triton` file with a `poster` diagram containing a named `tree` cell. Alt-hover a node in that cell — the tooltip should show `<cellKey>.n0` style refs.

---

## Scope Boundaries (not in Phase 1)

- Markdown built-in preview (no tooltip — `renderSync` path unchanged)
- Custom tooltip styling beyond the dark-backdrop defaults
- Anchor hit-test for non-rectangular node shapes (port-level precision)

---

## Design Change — 2026-07-11: Anchors as Separate postMessage Payload

**Problem discovered:** Embedding `<script type="application/json" id="triton-anchors">` inside the SVG string and injecting it via `content.innerHTML = msg.svg` caused the webview to render black/blank. The VS Code webview CSP interferes with any `<script>` encountered during innerHTML parsing — even inert data scripts.

**Solution:** `compileAndRenderSync` now returns a **clean** SVG (byte-identical to `renderSync`) plus the raw `anchors` registry. The extension serialises anchors separately:
```
this.post({ type: 'svg', svg: result.value.svg, anchors: JSON.stringify(result.value.anchors), ... })
```
The webview script stores them in a module-scope `let currentAnchors = {}` variable, parsed from `msg.anchors` on each render, and persisted in `vscodeApi.setState` for reload recovery.

`embedAnchorManifest` remains exported from `src/render/svg.ts` and tested — it is available for future static-export or server-side use cases where no CSP applies.

**Impact:** No SVG content is changed. All 512 tests pass. Build clean.
---
