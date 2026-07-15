# Ken — Visual QA Reviewer

## Spawn ken-5 (2026-07-12)

**Task:** Independent visual QA of sql-engine cross-link label fix (brian-7)  
**Approach:** PNG render inspection + SVG path audit + regression check  
**Result:** PASS — Red label now 18px below PageHeader, fully legible. All connector paths valid. No regressions.  
**Decision:** `.squad/orchestration-log/2026-07-12T11-32-29Z-ken-5.md`

---

## Review: Connector Style Matrix — 2026-07-12T10:05:00-04:00
**Requested by:** ormasoftchile  
**Subject:** Brian's connector redesign (style-matrix.svg)

### Test Artifact
- Rasterized with: `rsvg-convert -f png -w 1400 -o examples/triton/cross-link/style-matrix-ken.png examples/triton/cross-link/style-matrix.svg`
- Exit code: 0

### Visual Verification

| Style | Directed | Undirected | Bidir | Status |
|-------|----------|------------|-------|--------|
| Solid | ✅ unbroken | ✅ no arrows | ✅ both arrows | PASS |
| Dotted | ✅ short dots (4 3) | ✅ no arrows | ✅ both arrows | PASS |
| Thick | ✅ wide stroke, no dash | ✅ no arrows | ✅ both arrows | PASS |
| Dashed | ✅ long dashes (8 4) | ✅ no arrows | ✅ both arrows | PASS |
| Wavy | ✅ sine wave | ✅ no arrows | ✅ both arrows | PASS |

### SVG Attribute Verification

- **Solid:** `stroke-width="2"`, no dasharray ✅
- **Dotted:** `stroke-dasharray="4 3"` ✅
- **Thick:** `stroke-width="4"`, no dasharray ✅
- **Dashed:** `stroke-dasharray="8 4"` ✅
- **Wavy:** Many cubic Bézier `C` points, no NaN ✅

### Verdict

**✅ PASS** — All 5 styles × 3 directions render correctly. Dotted vs dashed visually distinct. Wavy has clean sine oscillation on both horizontal and vertical segments.

---

## Learnings

### Wavy Path QA Checklist (reusable)
When reviewing wavy/sinusoidal connector styles:
1. Verify path `d=` contains many `C` control points (not just `L`)
2. Grep for `NaN` — must return 0 matches
3. Check horizontal segments: regular Y oscillation with consistent amplitude
4. Check vertical segments: regular X oscillation
5. Inspect corners: no kinks, no amplitude blowup
6. Verify wave terminates cleanly near arrowheads (not mid-oscillation)

---

## Review — sql-engine.svg Connector-Label Overlap Fix
**Date:** 2026-07-12T11:30:00-04:00
**Requested by:** ormasoftchile
**Subject:** Brian's chromeRects fix for "leaf points to page" label overlap

### Visual Verification

Rendered fresh via `node scripts/preview.mjs examples/triton/poster/` then rasterized to PNG.

**sql-engine.svg inspection:**

| Element | Position | Status |
|---------|----------|--------|
| Red label "leaf points to page" | x=216.65, y=415.76 | ✅ CLEAR of PageHeader |
| PageHeader bar (blue) | y≈380.86 to y≈397.76 (absolute) | — |
| slot0/slot1/slot2 boxes | y≈405.56 to y≈419.86 (absolute) | — |
| Green "scan uses index" | x=377.69, y=108.49 | ✅ intact, routes from query to B+tree |
| Purple "tuple is a row" | x=409.90, y=454.76 | ✅ intact, routes from slot to Row |

**Position Analysis:**
- Red label y=415.76 is 18px BELOW PageHeader bottom (397.76)
- Label is vertically aligned with slot boxes — text is legible and clearly reads "leaf points to page"
- Red connector path: `M 471.35 132.05 L 327.3 132.05 L 327.3 406.99 L 106 406.99` — no NaN, clean L-shaped route from B+tree leaf to slot0

**Other connectors verified:**
- Green path: `M 284.03 252.28 L 284.03 110.49 L 471.35 110.49` — clean
- Purple path: `M 290.6 451.32 L 529.2 451.32` — clean horizontal

### Regression Check

| Poster | Render | Status |
|--------|--------|--------|
| poster.svg | ✅ renders | System Dashboard with 4 cells intact |
| ds-poster.svg | ✅ renders | Data Structures with 8 cells intact |
| sql-engine.svg | ✅ renders | Fix applied |
| row-spanning.svg | ✅ renders | No issues |
| spanning.svg | ✅ renders | No issues |

No `engineering-dashboard` references found — cleanup complete.

### SVG Audit

- No NaN values in any path `d=` attributes ✅
- No degenerate/undefined coordinates ✅
- All three cross-links have valid arrowhead markers ✅

### Verdict

**✅ PASS** — The red "leaf points to page" label is now clearly positioned 18px below the PageHeader bar, at y=415.76 (aligned with the slot boxes). Text is fully legible and no longer buried under the blue chrome. All three cross-link connectors render correctly with intact routing. No regressions in other poster files.

---

## Learnings

### chromeRects Label Repulsion
When cells contain prominent chrome elements (colored header bars, badges), the `chromeRects` mechanism in LayoutResult enables `deCollideLabels` to push connector labels away from these obstructions. Key verification points:
1. Calculate absolute coordinates accounting for cell transforms (`translate` + `scale`)
2. Verify label y-coordinate is outside chrome band (not just "looks okay" — do the math)
3. Confirm no NaN/degenerate values in path data
4. Check all other connectors remain intact after the fix

---

## Coordination Note — 2026-07-13T20:03:00Z

**Brian's Completed Work (2026-07-13):** Reclassified `architecture` diagram type from triton → mermaid family.
- **Why:** `architecture-beta` is a real Mermaid diagram type. Detection already returned `{ format: 'mermaid', diagramType: 'architecture' }`. Source/examples/docs folder placement now matches this truth.
- **Moves:** `src/diagrams/triton/architecture/` → `src/diagrams/mermaid/architecture/`, examples/docs fragments relocated, `src/frontend/index.ts` import updated.
- **Verification:** pnpm build ✅, typecheck ✅, 799 tests ✅, detect() behavior unchanged.
- **Syntax Gaps:** 11 documented (nested groups, junctions, edge labels, align, iconText, title/accTitle unsupported in Triton's subset).
- **Decision:** `.squad/decisions.md` (merged from inbox 2026-07-13)

This reclassification affects visual QA scope: `examples/mermaid/architecture/` is now the canonical example location for diagram-options verification.



## 2026-07-13 — Mermaid Fidelity Gallery Review

### Task
Visual QA of all 19 Mermaid-family diagram types for fidelity comparison against mermaid.live.

### Learnings

**Types that render cleanly (no visible defects):**
- class, er, flowchart, gantt, gitgraph, journey, kanban, pie, quadrant, radar, requirement, sankey, sequence, xychart

**Types with minor visual differences:**
- **c4**: Person shapes render as boxes not stick-figures
- **mindmap**: Icons (::icon) render as dots, not Font Awesome glyphs
- **state**: Long transition labels may truncate near composite state boundaries
- **architecture**: Edge routing sometimes suboptimal (extra bends)

**Type with significant divergence:**
- **timeline**: Renders as card-based column layout rather than horizontal time axis — fundamentally different from Mermaid's timeline visualization

### Cross-cutting Observations
1. Triton favors a clean, modern color palette that differs from Mermaid defaults but is internally consistent
2. Icon dependencies (Font Awesome) are avoided, using colored dots as placeholders
3. Edge routing is generally rectilinear and avoids crossings
4. All structural features (fragments, composites, cardinality, stereotypes) render correctly

### Deliverable
Created `examples/mermaid/FIDELITY-REVIEW.md` with:
- Per-type source code blocks for paste into mermaid.live
- Per-type fidelity checklists (5-10 items each)
- Pre-flagged defects for each type
- Cross-cutting gaps ranked by severity
- Summary table with pass/warn/fail status

---

## Architecture-beta Phase B Review — 2026-07-13T21:16:00-04:00

**Requested by:** ormasoftchile (Cristian)  
**Subject:** Independent visual QA of Brian's Phase B architecture-beta features

### Artifacts Reviewed
- `examples/mermaid/architecture/architecture.svg`
- `examples/mermaid/architecture/arrows.svg`
- `examples/mermaid/architecture/junctions.svg`
- `examples/mermaid/architecture/group-edges.svg`
- `examples/mermaid/architecture/nested-groups.svg`
- `examples/mermaid/architecture/align-grid.svg`

### Results

| Example | Verdict | Notes |
|---------|---------|-------|
| architecture.svg | ✅ PASS | Baseline clean |
| arrows.svg | ✅ PASS | All 4 arrow forms correct |
| junctions.svg | ✅ PASS | Junction dot + crosshair visible |
| group-edges.svg | ✅ PASS | {group} boundary attachment works |
| nested-groups.svg | ✅ PASS | Containment + padding correct |
| align-grid.svg | ❌ FAIL | B/D overlap at same coordinate |

### Critical Defect
**align-grid.svg:** The `align column b d` constraint places D at B's position (490,100) instead of below it (490,150). Two nodes render at identical SVG coordinates, causing visual overlap.

### Decision
`.squad/decisions/inbox/ken-architecture-phaseb.md`

## Learnings

### Architecture-beta align constraints
When reviewing `align row`/`align column` grids:
1. Extract all `<rect>` coordinates for service boxes
2. Verify row-aligned nodes share Y-coordinate
3. Verify column-aligned nodes share X-coordinate
4. Check that row+column constraints together produce a proper grid (no overlaps)
5. The constraint solver may place column-aligned nodes at the same Y if it doesn't account for row membership

### Junction rendering verification
Junctions render as:
- Small circle (r≈4) at the split point
- Crosshair lines (+) overlaid on the circle
- Edges terminate at junction, not passing through

---

## Architecture-beta Grid Layout Re-Review — 2026-07-13T21:52:00-04:00

**Requested by:** ormasoftchile (Cristian)  
**Subject:** Re-review after BFS grid placer replacement

### Context
Brian replaced the Sugiyama-based layout with a new BFS grid placer (`gridPlacer.ts`) that respects L/R/T/B side semantics.

### Results

| Example | Verdict |
|---------|---------|
| architecture.svg | ✅ PASS |
| arrows.svg | ✅ PASS |
| junctions.svg | ✅ PASS |
| group-edges.svg | ✅ PASS |
| nested-groups.svg | ✅ PASS |
| align-grid.svg | ✅ PASS |

**Overall: 6/6 PASS**

### Critical Fix Verified
The align-grid B/D overlap from last round is **FIXED**. SVG confirms distinct coordinates:
- A: (24,24), B: (244,24), C: (24,124), D: (244,124)
- Proper 2×2 grid layout with no overlaps.

### Deliverables
- Updated `examples/mermaid/FIDELITY-REVIEW.md` (Architecture-beta section)
- Created `.squad/decisions/inbox/ken-architecture-grid.md`

## Learnings

### BFS grid placer validation
The new grid placer produces correct layouts by:
1. Deriving (col,row) positions from edge L/R/T/B side declarations
2. Using BFS traversal to propagate positions
3. Respecting both `align row` and `align column` constraints simultaneously

When validating grid layouts, confirm:
- Row-aligned nodes share Y coordinate
- Column-aligned nodes share X coordinate
- All nodes occupy distinct (x,y) positions
- Edge routing matches the declared side connections

---

## 2026-07-13 — Visual QA follow-up: architecture-beta extensions

Brian added new architecture-beta visual surfaces: connector styles, connector animations, route hints, and service/group icon alignment. A visual pass is recommended on mixed connector/icon examples to verify rendering quality beyond parser/layout test coverage.



## 2026-07-14 — Group-aware Architecture Placement Visual QA

**Status:** IN FLIGHT at Scribe cutoff.

Assigned to review architecture example renders for containment correctness and regressions after Brian's group-aware placement fix. No `ken-group-aware-visual-qa.md` inbox deliverable was present when Scribe merged the local decision inbox.

## 2026-07-14T20:11:53-0400 — Cycle-3 obstacle routing visual QA

- Re-reviewed Edsger's obstacle-aware routing revision after prior grouped-layout failures.
- PASS: dense SVG sweep found 0 non-endpoint service crossings across all 7 architecture examples; `triton-features.svg` collector→stream and warehouse→dashboard now clear obstacles.

## 2026-07-15T00:54:19-04:00 — Nodegraph skip-edge visual QA

- Rejected Brian's first skip-edge routing fix despite node-overlap improvement: shared ports, overlapping arrowheads, label collision, and clipped title remained.
- Recommended Edsger for the lockout revision under reviewer protocol.
- Re-reviewed Edsger's revision and approved it: port fan-out, side lanes, label ordering, and title-aware bounds resolved all four prior defects with no new visual issues.
