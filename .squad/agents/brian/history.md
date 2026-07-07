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
