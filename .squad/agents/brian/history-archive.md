# Brian — History

## [ARCHIVED HISTORY]

Previously completed work:
- Context
- Project
- Known deficiencies in current codebase (as of 2026-06-27)
- Learnings
- 2026-06-27T17:20:00-04:00
- 2026-06-27T17:26 — Class diagram layout fixes (commit 92e839c)
- 2026-06-27T17:35:00-04:00 — 5-segment bypass corridor for skip edges (commit ed0f1c3)
- 2026-06-27T17:42:00-04:00 — Bypass corridor always routes right, inside margin (commit 111210d)
- 2026-06-27 — Degenerate laneX fallback (commit ecf9d44)
- 2026-06-27 — Restore skip edges in cascade port assignment (commit 29725de)
- 2026-06-27 — Use laneX as cascade ideal for skip edges (commit 23c3c84)
- 2026-06-28 — Skip-Edge Routing Optimizer
- 2026-06-28 — Adaptive left-margin candidate + canvas-expansion penalty

---

## 2026-06-28 — Multi-Wall Skip-Edge Routing (all wall pairs as scored candidates)

**Task:** Implement Edsger's multi-wall routing spec — replace `candidates: number[]` + `buildSegments(laneX)` with `candidates: RouteCandidate[]` covering six wall-pair strategies (A–F).

**Spec file:** `.squad/decisions/inbox/edsger-multiwall-routing.md`

**Changes made (`src/diagrams/class/layout.ts`, commit `b9b7eda`):**

1. **Added `RouteCandidate` interface** (module-level, after `RoutedSegment`): fields `strategy`, `laneX`, `segments`, `labelMid`, `isMixed`.

2. **Extended `scoreLane`** — added `wallPairPenalty: number = 0` parameter; appended to weighted sum (+2.0 for D/E/F mixed strategies).

3. **Six segment builder functions** (`buildSegmentsA`–`buildSegmentsF`) defined inside the skip-edge `if` block:
   - A: Bottom→Top (existing, unchanged geometry)
   - B: Left→Left (3 segments: H→V→H)
   - C: Right→Right (3 segments: H→V→H)
   - D: Left→Top (4 segments: H→V→H→V, mixed)
   - E: Right→Top (4 segments: H→V→H→V, mixed)
   - F: Bottom→Left (4 segments: V→H→V→H, mixed)

4. **Flat candidate pool** — six strategy loops produce `allCandidates: RouteCandidate[]`; each strategy uses its own lane candidate set (left-adaptive, right-adaptive, sweepCandidates filtered by geometric constraint).

5. **Extended blocking set** (`interBoxesExt`) — covers B/C/D/E/F horizontal segments hitting boxes at srcMidY/tgtMidY rows outside the strict inter-layer band; used uniformly across all strategies.

6. **Port override block** — after picking `bestCandidate`, set `effectiveFromPt/Wall`, `effectiveToPt/Wall` per strategy.

7. **Segment-driven SVG path renderer** — replaced hardcoded Strategy-A template with loop over `bestCandidate.segments`.

8. **Arrowhead calls** — updated to use `effectiveFromPt`/`effectiveToPt`/`effectiveFromWall`/`effectiveToWall`.

9. **Structural fix** — path and arrowhead rendering split inside `if (bends)` / `else` branches to avoid double-rendering.

**"places" edge result (Customer→Order):**
- **Winning strategy:** A (Bottom→Top)
- **Winning laneX:** `186.77` (inter-column midpoint)
- **d= path:** `M 145.82 184 L 145.82 216 L 186.77 216 L 186.77 387 L 145.82 387 L 145.82 419`
- No left-wall or right-wall route was selected — Strategy A remains optimal as the inter-column midpoint routes cleanly between nodes with no box hits.

**Build/test:** `pnpm build` ✓, `pnpm test` 387/387 ✓

**Commit:** `b9b7eda` — feat(layout): multi-wall skip-edge routing — all wall pairs as scored candidates

---


## 2026-06-28 — Generalized Edge Routing Optimizer (edsger-general-routing.md)

**Task:** Extend the multi-candidate routing optimizer to ALL edges (not just skip edges).

**Spec:** `.squad/decisions/inbox/edsger-general-routing.md`

**Changes made to `src/diagrams/class/layout.ts` only:**

1. **RouteCandidate.strategy** extended: added `'V' | 'X1' | 'X2'` to the union.

2. **Module-level helpers added:**
   - `labelInBox(lx, ly, boxes)` — true if point falls inside any box
   - `dedup(arr, tol)` — removes values within tol pixels of each other
   - `segmentsToPath(segs)` — renders segment list to SVG path string

3. **`EdgeClass` type + `classifyEdge()` function** added module-level:
   - Uses |cx_a − cx_b| < 8 threshold for same-column detection
   - Returns `direct-same-column | direct-cross-column | skip-same-column | skip-cross-column`

4. **`scoreLane()` extended** with two new optional params:
   - `straightBonus: number = 0` — subtracted from score (reward)
   - `labelMid: { x, y } | null = null` — checked against allRealBoxes via labelInBox; adds 200 if inside any box
   - Existing skip-edge call updated: passes `0, c.labelMid`

5. **Processing-order sort** before main relation loop:
   - skip-cross-column → skip-same-column → direct-cross-column → direct-same-column
   - Within class: longest span first

6. **Direct-edge optimizer** (new `else` block replacing `routeEdge()` fallback):
   - `direct-same-column`: V candidate (straightBonus=40) + B/C left/right wall candidates
   - `direct-cross-column`: X1 (V→H→V, 3 midY candidates) + X2 (H→V→H, inter-column midpoints + margins)
   - Falls back to `routeEdge()` with `console.warn` only if all candidates score Infinity

7. **`routedSegments` registration** for ALL edges (direct + skip) — key change.

**Build/test:** `pnpm build` ✓, `pnpm test` 388/388 ✓

**Commit:** `c6f18a6` — feat(class): generalized edge routing optimizer — all edges, all candidates, label overlap penalty

### 2026-07-06 — Group D diagram-options fragments (architecture, block, packet, topology, poster)

**Task:** Write `docs/diagram-options/_fragments/triton-<family>.md` fragments for all 5 Group D Triton families; add `%%` headers to supported families' examples; run preview verification.

**`%%` comment support (greps on grammar files):**

| Family       | Source                                       | `%%` count | Supported |
|--------------|----------------------------------------------|------------|-----------|
| architecture | `triton/architecture/grammar.peggy`          | 0          | NO        |
| block        | `triton/block/grammar.peggy`                 | 0          | NO        |
| packet       | `triton/packet/grammar.peggy`                | 0          | NO        |
| topology     | `triton/topology/topology.ts` (no grammar)   | 0          | NO        |
| poster       | `triton/poster/grammar.peggy`                | 1          | YES       |

**Key option facts per family:**

- **architecture:** `architecture-beta` header; `group id(icon)[label]` containers; `service id(icon)[label] [in group]` nodes; side-anchored edges `from:Side --> Side:to`; sides L/R/T/B (and lowercase).
- **block:** `block-beta` header; `columns N` grid config; `id["Label"]` and `id["Label"]:N` (span) block defs; `-->` and `-->|label|` edges; multiple blocks per line.
- **packet:** `packet-beta` header; optional `title text`; field syntax `bit: "Label"` (single) and `start-end: "Label"` (range); labels quoted or unquoted.
- **topology:** `topology` header (hand-parsed `topology.ts`); `title`, `costs <unit>`, `tier name maxWeight color [dash]`; `group id : label`; `node id : label [: sub]`; edges `from -- to [: cost]` (undirected, cost-coloured by tier).
- **poster:** `poster ["Title"]`; `columns N`, `rows N`, `gap N`; `cell [id] ["Title"] [span] [:: kind] [@theme t] … end`; spans `[N]` and `[NxM]`; `link from.node arrow to.node`; 9 arrow types (3 styles × 3 directions); 4 routing annotations; `trace "name" [: type]`; 7 trace types; frontmatter; `%%` comments.

**Poster `%%` header placement finding:** Poster grammar parses `%%` comments only within `BodyItems` (`BlankLine = _ Comment? NL`), NOT in the `GridDirective*` phase between the `poster "Title"` header and the first `cell` block. Inserting the `%%` header immediately after the `poster "Title"` keyword line causes a PARSE_ERROR (preview fails). Correct placement: after the last `GridDirective` line (e.g. `columns N`) and before the first `cell` block. All 7 poster SVGs pass at exit 0 with this placement.

**Fragment paths written:**
- `docs/diagram-options/_fragments/triton-architecture.md`
- `docs/diagram-options/_fragments/triton-block.md`
- `docs/diagram-options/_fragments/triton-packet.md`
- `docs/diagram-options/_fragments/triton-topology.md`
- `docs/diagram-options/_fragments/triton-poster.md`

**Preview results:**
- `node scripts/preview.mjs examples/triton/poster/` → exit 0, all 7 SVGs ✓
- architecture, block, packet, topology: no `%%` headers added; fallback note in fragments.


## 2026-07-07 — Group D `%%` headers follow-up (architecture, block, packet, topology)

**Task:** `stripComments()` now centralised in `src/frontend/preprocess.ts` — full-line `%%` stripped before any grammar parse. The earlier fallback notes in Group D fragments are superseded. Add `%%` options-header blocks to every `.mmd` in these four families; update fragments to document comment support.

**`.mmd` files updated (7 total):**

| Family       | File(s) changed                                                    | Header placement          |
|--------------|--------------------------------------------------------------------|---------------------------|
| architecture | `examples/triton/architecture/architecture.mmd`                    | After `architecture-beta` |
| block        | `examples/triton/block/block.mmd`                                  | After `block-beta`        |
| packet       | `examples/triton/packet/packet.mmd`                                | After `packet-beta`       |
| topology     | `examples/triton/topology/numa.mmd`, `numa-detail.mmd`             | After `topology`          |

**Fragments updated (4 total):** removed `> **Note:** This grammar does not define a %% comment rule…` fallback; added `### Comments` section citing central `stripComments()` in `src/frontend/preprocess.ts`.

- `docs/diagram-options/_fragments/triton-architecture.md`
- `docs/diagram-options/_fragments/triton-block.md`
- `docs/diagram-options/_fragments/triton-packet.md`
- `docs/diagram-options/_fragments/triton-topology.md`

**Preview results (2026-07-07):**

| Family       | SVGs regenerated         | Exit code |
|--------------|--------------------------|-----------|
| architecture | `architecture.svg`       | 0 ✓       |
| block        | `block.svg`              | 0 ✓       |
| packet       | `packet.svg`             | 0 ✓       |
| topology     | `numa.svg`, `numa-detail.svg` | 0 ✓  |

**Key learning:** `%%` stripping is now upstream of all parsers — no grammar-level `%%` rule is required. Header comment blocks can be placed immediately after the diagram keyword line (first line) in all families.



**Scribe note:** Diagram-options feature completed. All 45 fragments assembled into central reference; 4 families have inline `%%` headers in examples (flowchart/9, sankey/1, timeline/9, poster/7); pnpm test: 384 pass.
## 2026-07-07 — Group D %% Headers (5 files)

Added %% options header blocks to 4 Triton-native families + poster. 5 .mmd examples (architecture/block/packet/topology/numa*), 4 fragment updates. All SVGs exit 0.

## 2026-07-10 — Poster Phase 1: Four New Primitives

### Features Shipped

#### 1. Per-cell highlight for `array` and `matrix`
- **array**: `highlight N N ...` marks logical indices; `window N-M` marks a contiguous range. Highlighted cells render with `palette.primary` fill at `fillOpacity: 0.22`, primary stroke, primary text.
- **matrix**: `highlight r,c r,c ...` marks specific (row,col) cells. Same accent style.
- `StripCell` extended with `fillOpacity?: number` and `stroke?: Color` so matrix can pass highlight info through `buildStrip`.
- Key files: `src/diagrams/triton/ds/struct/array.ts`, `src/diagrams/triton/ds/matrix/matrix.ts`, `src/scene/strip.ts`

#### 2. Caption slot per poster cell
- `caption "text"` as a directive inside a cell block (extracted from rawContent before sub-diagram parse).
- Caption rendered as `palette.textMuted` text, centered, below the sub-diagram at bottom of card. Caption height reserved in `rowHeights` calculation.
- Key files: `src/diagrams/triton/poster/ir.ts`, `src/diagrams/triton/poster/index.ts`, `src/diagrams/triton/poster/layout.ts`
- **Extraction approach**: `extractCellAnnotations()` strips `caption "..."` and `note "..."` lines from rawContent BEFORE passing to sub-parsers. Grammar unchanged.

#### 3. Freeform annotation overlay (`note`)
- `note "text"` or `note "text" at top-right` positions a pill-shaped text box over the sub-diagram.
- Positions: `top-left`, `top-right`, `bottom-left`, `bottom-right`, `center` (default: `top-right`).
- Rendered as a semi-transparent surface-fill + primary-border pill over the content rect.
- Key files: same as caption above. `NotePosition` and `PosterNote` types added to `ir.ts`.

#### 4. Edge/path highlight for `tree` and `nodegraph`
- **tree**: `path A -> B -> C` directive (outside tree indentation). Pre-processed in `tree/index.ts` before grammar parse. Label→ID mapping used; results stored in `TreeDocument.activePaths: [string,string][]`. Active edges render in `palette.primary` at strokeWidth 2.5.
- **nodegraph**: `A -> B : active` or `A -> B : dashed` edge modifier. `GEdge.kind?: 'active' | 'dashed'` added. Active edges: primary color, 2.5px stroke. Dashed edges: textMuted, dash="6 3".
- Key files: `src/diagrams/triton/ds/tree/ir.ts`, `src/diagrams/triton/ds/tree/index.ts`, `src/diagrams/triton/ds/tree/layout.ts`, `src/diagrams/triton/ds/graph/graph.ts`

### Bonus Fix
- Added `tree` keyword to `inferCellKind()` in `poster/index.ts` — it was missing, causing tree content to degrade to text inside poster cells.

### Test Results
- pnpm build: ✓ (0 errors)
- pnpm test: 499 passed / 0 failed (18 new tests added)

### Gotchas
- `physicalToLogical[physical]` has type `(number | null | undefined)` in TypeScript strict mode — need `?? null` coercion.
- `require()` doesn't work in ESM test files — must use top-level `import` statements.
- `extractCellAnnotations` must be applied BEFORE sub-diagram parsing, not after, or the sub-parser sees the directive line as garbage.
- Grammar-level approach for caption/note would require CellContent lookahead change (complex). The rawContent stripping approach is simpler and keeps grammar clean.

## Phase 2 — Poster Primitives: intervals + hashring (2026-07-10)

### New Syntaxes

#### 1. Intervals (`intervals` or `interval` keyword)
```
intervals
  title My Chart
  axis 0 20           # optional axis override
  [1, 4] "A"          # interval with optional label
  [2, 5] "B"
  [7, 9]              # bare interval (uses "[start, end]" label)
  merge               # optional — renders merged result track
```
- Negatives supported; start/end auto-normalised (reversed intervals fixed).
- Merge computes the union of overlapping intervals and renders a separate track in `palette.secondary`.
- Axis auto-scales from data if `axis` is omitted.

#### 2. Hash Ring (`hashring` keyword)
```
hashring
  title "My Ring"     # optional
  node A              # evenly distributed if no "at"
  node B at 120       # explicit degree (0=top, CW)
  node C
  key "cart:7"        # deterministic placement via DJB2 hash
```
- Nodes with no explicit angle are distributed evenly (0, 360/n, 720/n, …).
- Keys are placed at `djb2(string) % 360` degrees.
- Each key shows a routing arc (dashed) to the next node clockwise.

### Registration Steps (5-step path)
1. `src/frontend/detect.ts` — add `[/^intervals?\b/i, 'intervals']` and `[/^hashring\b/i, 'hashring']` before `topology`.
2. `src/contracts/diagram.ts` — add `'intervals' | 'hashring'` to `DiagramKind`.
3. Create `src/diagrams/triton/ds/<name>/<name>.ts` exporting a `DiagramModule`.
4. `src/frontend/index.ts` — import + `registerDiagram('<name>', <fn>)`.
5. `src/diagrams/triton/poster/index.ts` — add keyword check in `inferCellKind()`.

### DJB2 Hash Function
```typescript
function djb2Hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) ^ s.charCodeAt(i)) | 0;
  return (h >>> 0) % 360;
}
```
Pure, deterministic, ~0 risk of platform variance. Same string → same angle.

### Gotchas
- `ThemePalette` has NO `accent` field — use `palette.warning` for key/highlight colors.
- Key labels must be placed at a LARGER radius than node labels (KEY_LABEL_R > RING_RADIUS + NODE_RADIUS + font). If you put key labels at the same radius as node labels, they will overlap with nearby node labels.
- For DJB2 hash placement, choose example keys that hash to well-separated angles. "cart:7"=4°, "user:42"=16° are dangerously close to 0° node; use "uid:1"=46°, "profile"=198°, "msg:4"=298° instead for 3-node examples.
- The `circle()` pen helper takes `fill: Color` where `Color = string`, so `'none'` is valid — no cast needed.
- examples.test.ts auto-discovers .mmd files in `examples/`, so new examples automatically get compilation-check tests (added 4 tests here).

### Test Results
- pnpm build: ✓ (0 errors)
- pnpm test: 534 passed / 0 failed (+35 new tests: 14 intervals + 17 hashring + 4 auto-examples)

## Tree Default Node Border Fix (2026-07-10)

**Root cause:** `nodeStyle()` fallback in `src/diagrams/triton/ds/tree/layout.ts` used `outlineStroke(fill, theme)` which resolves to `palette.text` (near-black on light theme) for the default/plain node — inconsistent with nodegraph default nodes which use `palette.primary` (blue).

**Fix:** One-line change in `nodeStyle()` final fallback:
```diff
- return { shape, fill, stroke: outlineStroke(fill, theme), text: palette.text };
+ return { shape, fill, stroke: palette.primary, text: palette.text };
```
Only the default fallback changed. RB-red, RB-black, active, scan, join, build/muted semantic kinds are untouched.

**Test update:** `test/tree-builders.test.ts` had a snapshot asserting `plain.stroke === outlineStroke(palette.surface, theme)` and `NOT === palette.primary`. Updated to assert `plain.stroke === theme.palette.primary`.

**Result:** `pnpm build` ✓, `pnpm test` 534/534 ✓. Tree plain nodes now show blue primary border matching nodegraph.

## Arrowhead Size Uniformity Fix (2026-07-10)

**Root cause:** `arrowDef()` in `src/diagrams/triton/ds/struct/shared.ts` used no `markerUnits` attribute → SVG default `markerUnits="strokeWidth"`. Arrowhead scaled with edge stroke width: active edges (sw=2.5) got arrowheads 1.67× larger than normal edges (sw=1.5).

**Fix:** Switch to `markerUnits="userSpaceOnUse"` and scale geometry from old sw-relative units to fixed pixels (8 sw-units × 1.5 = 12 px baseline):
```diff
- `<marker id="${ARROW_ID}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8 z" fill="${color}" /></marker>`
+ `<marker id="${ARROW_ID}" markerWidth="12" markerHeight="12" refX="10" refY="6" orient="auto" markerUnits="userSpaceOnUse"><path d="M0 0 L12 6 L0 12 z" fill="${color}" /></marker>`
```
Also applied same fix to hashring's inline marker.

**`motionArrowheadClearance`:** Already handles `userSpaceOnUse` in svg.ts — returns `refX` directly (10 px) instead of `refX * strokeWidth`. For normal edges was 10.5 px (7 × 1.5), now 10 px. Negligible change, no visible regression on animated paths.

**Test result:** No tests asserted old marker geometry strings; 534/534 still pass.

**Gotchas:**
- Queue diagrams have their own separate `arrowDefs()` in `queue/shared.ts` — those are NOT affected by this change.
- Only `struct/shared.ts` arrowDef is shared across nodegraph, linkedlist, hashmap, array, page, memory.
- The `crosslink.test.ts` custom marker has `markerWidth="40"` — completely separate, unaffected.

## Phase 2 Primitives Dropped — Decision (2026-07-10)

Cristian decided to drop intervals and hashring primitives entirely. Only the two visual-consistency fixes remain on the branch:
1. Tree default-node border = palette.primary (layout.ts)
2. Arrowhead markerUnits=userSpaceOnUse uniformity (shared.ts)

Removed: src/diagrams/triton/ds/intervals/, src/diagrams/triton/ds/hashring/, test/intervals.test.ts, test/hashring.test.ts, examples/triton/poster/phase2/, all DiagramKind union entries, detect.ts patterns, frontend/index.ts imports+registers, poster/index.ts inferCellKind entries.

Final: pnpm build clean, 499/499 tests (back to Phase 1 baseline). Zero references to 'intervals' or 'hashring' in src/test (the one match in array.ts is a local variable, unrelated).

---

## 2026-07-12 — Pre-External-Theming Work (Spawns brian-6 through brian-11)

### Spawn brian-6 — Example Audit
Audited all 84 .mmd files. Found 0 bad, 1 redundant (launch-readiness.mmd). Removed 14 files total (1 .mmd + 1 .svg + 12 theme SVGs). Tests: 541 → 540.

### Spawn brian-7 — Label Overlap Fix  
Removed engineering-dashboard.mmd redundancy. Fixed cross-link label overlap via chromeRects contract extension. Tests: 540 → 539.

### Spawn brian-8 — Release v0.1.9
Cut v0.1.9: Connector superset syntax + example cleanup. PR #59, merged 9b09b76.

### Spawn brian-9 — Dark Mode Icon Fix
Fixed preview toolbar icons invisible in dark mode. Root cause: `stroke="currentColor"` renders BLACK on VS Code toolbar icons. Created color-baked variants (preview-light.svg, preview-dark.svg).

### Spawn brian-10 — Preview-To-Side Glyph
Added distinct split/side glyph for `triton.openPreviewToSide` (preview-side-light.svg / preview-side-dark.svg) vs plain glyph for `triton.openPreview`.

### Spawn brian-11 — Release v0.1.10
Cut v0.1.10: Icon dark-mode + distinct-glyph fixes. PR #60, merged b6fc192.
