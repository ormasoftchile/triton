# Scribe: Decisions

Decisions guide future work. Never deleted; deferred decisions remain visible.

---

## Active Decisions

### Decision: POSTER EXCEL ADDRESSING

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-15  
**Status:** COMPLETE  
**Commit:** feaec9d

Poster cells now accept spreadsheet addresses (A1 ≡ [0,0]) in addition to [row,col], freely mixable. Bijective base-26 columns, col-then-row mapped to internal [row,col]. `excelToRowCol` helper exported. Demo poster-excel added to gallery (2×2 cells). §17.2 doc updated. All 2659 tests passing; existing goldens byte-identical.

---

### Decision: CROSS-DIAGRAM NODE LINKING SPEC (design §30b)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-15  
**Status:** SPEC WRITTEN  
**Commit:** 73d8c21

Spec'd cross-diagram node linking: `link <cellAddr>.<nodeId> --> <cellAddr>.<nodeId> : "label"` syntax (reuses bracket/Excel addressing + Mermaid edge styles). Recommended mechanism: sidecar node-anchor registry per linkable grammar ({scene, anchors}), transformed to poster coords via translateAndScale; overlay routing; linkable-type rules (stable-id grammars only: flowchart/class/state/ER/C4/block/architecture/mindmap/gitGraph). Charts excluded. Presentation-layer degradation contract: unresolved links warn+skip.

**BIG PREREQUISITE:** Grammar layout functions currently discard node positions (flow PlacedNode) — surfacing them as a sidecar unlocks linking AND is reusable (hit-testing/tooltips/agent node-addressing/accessibility). Spec-only, no code yet. NEXT when implementing: build the node-anchor sidecar on 2-3 grammars + the overlay link layer.

---

### Decision: NAMED CONTRACT THEMES ADDED (matrix proven) — 3 New Themes: midnight, blueprint, editorial

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-15  
**Status:** COMPLETE  
**Commit:** 2325c78

#### Summary

Authored 3 new `ThemeContract` instances as pure theme files (midnight.ts, blueprint.ts, editorial.ts) and registered them in `CONTRACT_THEMES`. The matrix promise held: all 21 diagram components light up with each new theme using ZERO per-component binding changes — only the theme file + registration were required.

#### The 3 Themes

- **midnight**: Dark dev-doc (charcoal `#0F1620`, cyan accent `#00D4FF`, Inter sans, curved connectors, vivid-on-dark data palette)
- **blueprint**: Architectural/technical (deep blue `#1A2B47`, cyan annotation `#00BFFF`, JetBrains Mono, square corners, orthogonal connectors, precision aesthetic)
- **editorial**: Warm print/magazine (cream `#FAF6EF`, burgundy accent `#8B2635`, Lora serif, elbow connectors, warm/muted data palette)

#### Proof & Artifacts

- **Test:** `contract-theme-matrix.test.ts` — 4 contract themes × 21 components × 2 assertions = 170 passing cases.
- **Gallery:** 36 new demo files (midnight/blueprint/editorial × 6 components) — determinism verified; all render identically on re-run.
- **Coherence:** All 3 themes pass coherence (consistent look across 21 components) AND distinctness (each visually unique from others and from executive).
- **Additive:** Existing goldens byte-identical; 2206 tests passing.

#### Finding: Advisory — `orthogonal` Connector Falls Through to `elbow`

The `blueprint` theme sets `connectorStyle: 'orthogonal'`. The flow binding maps `'orthogonal'` to `'elbow'` (same implementation). Per Design §12, `connectorStyle` is advisory — each binding maps it to its own implementation. Result is correct. Advisory: document `orthogonal` as an elbow alias for future orthogonal routing extension.

---

### Decision: THEME-CONTRACT MIGRATION COMPLETE — All 21 Diagram Types Adopted Tier-2 Contract

**Agent:** Barbara (Semantics & Rendering), Leslie (Spec Architect), Scribe  
**Date:** 2026-06-15  
**Status:** COMPLETE

#### Summary

The theme-contract migration is now complete. All 21 Mermaid diagram types adopt the Tier-2 `ThemeContract` via per-component bindings (`grammars/<c>/contract-binding.ts` + `themes/contract-binding.ts` for timeline). The `executive` contract theme renders all 21 diagram types coherently: white surface, Georgia serif, slate ink, navy accent, shared navy-anchored categorical data palette. Adoption is opt-in: contract theme names resolve via bindings; all legacy named themes remain byte-identical (legacy-wins precedence). Timeline section fills now consult `theme.sectionPalette` with fallback default preserving legacy behavior. Design §12 synced (4 step-1 tokens + implementation-status subsection). Determinism preserved across the entire migration; 1976/1976 tests passing. Gallery fully re-emitted; all 14 legacy timeline goldens and all showcase goldens byte-identical.

#### Artifacts

- **Commits:** bd2ccc4 (spike), 4a943e9 (step1 timeline), 8101a00 (node-link), a6a2ff5 (charts+specialized), 703c4cd (timeline fills), 0e8a5fb (doc sync).
- **Files changed:** 21 diagram families (12 core grammar bindings + timeline binding + 3 theme support files + design doc + gallery).
- **New Tier-2 tokens discovered:** `surfacePanel`, `inkPanel`, `markerShape`, `pattern`.

#### Next Steps (Future)

- Add more named contract themes beyond `executive`.
- Expose theme/token/layout selection via Mermaid config surface.
- Explore superset extensions (e.g., data-driven per-diagram palettes).

---

### Decision: MIGRATION STEP 1 DONE — Timeline ResolvedTheme → Tier-2 Contract

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-14  
**Status:** COMPLETE

Timeline `ResolvedTheme` generalized into the Tier-2 `ThemeContract`. Contract enriched (additive) with 4 general tokens: `RolePalette.surfacePanel`, `RolePalette.inkPanel`, `ShapeLanguage.markerShape`, `StatusRole.pattern`. `bindTimelineTheme(contract)` binding added; precedence rule enforced (legacy component theme names ALWAYS win for determinism; 14 timeline goldens byte-identical). `executive-gantt` fully coheres; `executive-timeline` frame coheres but section/event fills still hardcoded in `timeline-columns.ts` (timeline-adoption step planned for Step 4). 1887 tests passing. Committed 4a943e9. Migration order remaining: node-link family → remaining charts → timeline adoption (section-fill→palette) → specialised. **DESIGN DOC §12 needs sync to add surfacePanel, inkPanel, markerShape, pattern.**

---

### Decision: Mermaid Front-End Architecture — Tier 0 Increment 1

**Agent:** Bjarne (Ingestion Design)
**Date:** 2026-06-13T19:49:35-04:00
**Status:** ADOPTED

---

#### Summary

Implemented the Mermaid front-end (Path A of the dual front-end architecture, §15).
Tier-0 Increment-1 delivers: the front-end module layout, the `flowchart` parser, and
the public surface (`detectDiagramType`, `parseMermaid`, `renderMermaid`).
All 852 tests pass. Gallery PNG rendered with `dark-flow` theme is visibly cleaner than
Mermaid's default.

---

#### Architecture Decisions

##### 1. Three-file module layout

```
packages/core/src/frontend/mermaid/
├── utils.ts      — preprocessMermaid: frontmatter + directives + comments
├── flowchart.ts  — parseFlowchart + parseFlowchartInternal (inc direction/warnings)
└── index.ts      — detectDiagramType, parseMermaid, renderMermaid
```

**Rationale:** `utils.ts` is shared preprocessing used by both `index.ts` and
`flowchart.ts`. Splitting it avoids circular imports. `flowchart.ts` exports a
public `parseFlowchart(text): FlowDocument` and an internal
`parseFlowchartInternal(text): FlowchartParseResult` (with direction + warnings)
used by `renderMermaid`. The internal function is not re-exported from core `index.ts`.

##### 2. Preprocessing before grammar parsing

`preprocessMermaid(text)` runs before any grammar-specific parsing:
1. Strip YAML frontmatter (`--- … ---`) via the `yaml` package already in dependencies.
2. Extract `%%{init}%%` directive fields (theme/title) via JSON parse + single-quote fallback + regex fallback.
3. Drop `%% comment` lines.

**Interface contract:** Any grammar parser in this front-end receives a **clean body**
(no frontmatter, no directives, no comment lines). Frontmatter/directive metadata is
returned as structured fields (`frontmatter`, `directiveTheme`, `directiveTitle`).

##### 3. Ambiguity made explicit: ID sanitization

**Problem:** Mermaid node IDs are arbitrary tokens; the Flow IR schema requires
`^[a-z][a-z0-9-]*$`. This is a genuine ambiguity at the input boundary.

**Resolution:** A per-session `idMap: Map<string, string>` translates raw Mermaid IDs
to valid kebab-case IR IDs. The map is stable within one parse: same raw ID → same
sanitized ID. Algorithm: camelCase/PascalCase→kebab, lowercase, underscore→hyphen,
strip non-[a-z0-9-], prefix 'n' if starts with digit, collision resolution via
numeric suffix (-2, -3, …).

**Why explicit:** Mermaid diagrams commonly use single-letter IDs (`A`, `B`, `C`),
camelCase (`codePush`, `dockerBuild`), and underscores (`fail_lint`). All of these
map cleanly. Collision resolution is rarely needed in practice but is correct and
documented.

##### 4. Node creation policy

Nodes are created on first mention — either in a standalone declaration or as part of
an edge chain. First-mention label = raw ID (before sanitization); a later declaration
with an explicit shape/label UPDATES the label and kind. This mirrors Mermaid's
semantics: `A --> B` creates both A and B with default shape; `B{Decision}` later
updates B's label and kind to diamond.

##### 5. Direction mapping

| Mermaid | FlowTheme.orientation | Layout behaviour |
|---------|----------------------|-----------------|
| `LR`    | `'LR'`               | Fully implemented |
| `RL`    | `'LR'`               | Deferred: no flip |
| `TD`/`TB` | `'TB'`             | Deferred: layout renders as LR |
| `BT`    | `'TB'`               | Deferred: layout renders as LR |

Direction is passed as a `FlowTheme` orientation override to `buildFlowScene`, not
stored in the `FlowDocument` (which has no direction field). This is the correct
seam: direction is a style/layout concern, not a semantic concern.

##### 6. Theme precedence in renderMermaid

```
options.theme > frontmatter theme > %%{init}%% directive theme > 'default-flow'
```

The resolved theme name is also written back to `doc.metadata.theme` before calling
`buildFlowScene`, so the schema-validation path has a consistent view.

##### 7. Error policy

- **Syntax errors:** Skip the offending line; collect a human-readable warning.
  The parser NEVER throws on malformed input.
- **Unsupported diagram types:** `parseMermaid` and `renderMermaid` throw with a
  `[Tier 0 Inc 1]` label, naming the unsupported type and the planned increment.
- **Deferred features:** A WARNING is collected with the string "DEFERRED:" + feature
  name + planned increment. The diagram still renders (without the deferred feature).

---

#### Implemented Subset (Tier 0 Inc 1)

##### Nodes
| Mermaid syntax | IR kind        |
|----------------|----------------|
| `A[label]`     | `'rect'`       |
| `A(label)`     | `'rounded-rect'` |
| `A((label))`   | `'circle'`     |
| `A{label}`     | `'diamond'`    |
| `A([label])`   | `'stadium'`    |
| `A[[label]]`   | `'rect'`       |
| `A` (bare)     | `'rounded-rect'` |

##### Edges
| Mermaid syntax       | IR kind  | IR style  |
|----------------------|----------|-----------|
| `-->`                | `'sync'` | `'solid'` |
| `---`                | `'sync'` | `'solid'` |
| `-.->`               | `'async'`| `'dotted'`|
| `==>`                | `'sync'` | `'solid'` |
| `-->|label|`         | sync/solid + label |
| `-- label -->`       | normalised to `-->|label|` |

---

#### Deferred Features (Explicit TODO List)

1. Subgraphs (`subgraph … end`) — Inc 2
2. Class directives (`classDef`, `class`, `style`) — Inc 2
3. Click / href callbacks — Inc 2
4. Link curve styles (`linkStyle`) — Inc 2
5. Markdown-string labels (`["\`text\`"]`) — Inc 2
6. Multi-node edges (`A & B --> C`) — Inc 2
7. Extended node shapes: hexagon `{{…}}`, trapezoid `[/…/]`, asymmetric `>[…]` — Inc 2
8. Thick-edge labels (`==label==>`) — Inc 2
9. RL/BT layout flip (reverse direction in layout engine) — Inc 2 / layout engine
10. sequenceDiagram parser — Inc 2
11. gantt/timeline parser — Inc 2
12. mindmap parser — Inc 2

---

#### Files Created

```
packages/core/src/frontend/mermaid/utils.ts       (preprocessing shared utility)
packages/core/src/frontend/mermaid/flowchart.ts    (Mermaid flowchart parser)
packages/core/src/frontend/mermaid/index.ts        (front-end entry: detect/parse/render)
packages/core/test/mermaid-frontend.test.ts        (57 tests)
examples/gallery/mermaid-flowchart.mmd             (CI/CD pipeline example)
examples/gallery/mermaid-flowchart.svg             (rendered gallery output)
examples/gallery/mermaid-flowchart.png             (rendered gallery output)
```

**Modified:**
```
packages/core/src/index.ts  (added front-end exports)
```

---

#### Test Results

- **852 total tests passed** (57 new + 795 existing).
- All existing goldens byte-identical.
- Determinism: parse twice → identical JSON; render twice → identical sceneHash.
- Gallery PNG self-check: dark navy background, correct shapes (stadium/rect/diamond),
  teal curved edges, labeled edges, dotted async edge, back-edge arc.
  Visually superior to Mermaid's default (explicit project pitch criterion met).
## Decision: Routing Optimizer Implementation Complete

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-06-28  
**Status:** COMPLETE  
**Commit:** `e2a9d04`

The skip-edge routing optimizer selects optimal lane x from candidates (BK sweep x values, margins, source x, inter-column midpoints) by scoring for path length, segment count, box intersections, and directional preference. The "places" edge wins with laneX=186.77 (inter-column midpoint), routing via 5-segment bypass with no box hits.

---

## Decision: Adaptive Left-Margin Routing Candidate

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-06-28  
**Status:** COMPLETE  
**Commit:** `89e7b36`

Introduced adaptive left-margin lane candidate (filtered for intermediate boxes at edge exit/entry y-coords) and expansion penalty term in lane scoring. The candidate provides a valid left-side route when column-gap lanes are blocked. Existing "places" edge continues routing via inter-column midpoint (laneX=186.77) with no regression.

---

## Decision: Multi-Wall Skip-Edge Routing Implementation Complete

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-06-28  
**Status:** COMPLETE  
**Commit:** `b9b7eda`  
**Spec:** `.squad/decisions/inbox/edsger-multiwall-routing.md`

Implemented six wall-pair routing strategies (A–F) via RouteCandidate interface. Strategy A (bottom→top) remains optimal for "places" edge at laneX=186.77. All new B–F strategies (left-wall, right-wall, mixed) integrated into candidate pool; geometry scored dynamically with wallPairPenalty (+2.0 for mixed strategies). No regression; 387/387 tests pass.

---

## Decision: Skip-Edge Routing Optimizer — Implementation Spec

**Author:** Edsger (Layout Algorithms)  
**Date:** 2026-06-28  
**Status:** SPEC WRITTEN  
**Target:** `src/diagrams/class/layout.ts` + `src/graph/layered.ts`

Comprehensive spec for multi-candidate skip-edge lane selection optimizer in TB layouts. Defines:
- `LayeredResult` extensions: `dummySweepXs` (pre-balance x values per dummy node across 4 BK sweeps) and `dummyChainIds` (original-edge-index → dummy-chain mapping)
- `RoutedSegment` interface for overlap-detection
- Candidate generation from BK sweeps, margins, source x, inter-column midpoints
- Scoring function: `pathLength * 0.3 + segmentCount * 10.0 + boxHits * 1000 + overlapHits * 50 + dirPenalty`
- Edge processing in descending-span order to build dense routed-segment registry
- Degenerate-case handlers: all candidates blocked (margins always win), straight vertical, ties
- Complexity analysis: O((K+R) · S · (B+P)) per skip edge; negligible for diagrams ≤50 nodes
- Non-goals: LR optimization (deferred), curved paths (out of scope)

---

## Decision: Ken QA Verdict — commit e2a9d04 (routing optimizer)

**Date:** 2026-06-28T10:20:09-04:00  
**Reviewer:** Ken (Visual QA)  
**Artifact:** `examples/class/class-ken-optimizer.png`

**Verdict:** ✅ PASS

The "places" edge routes via 5-segment bypass at laneX=186.77 with label fully unclipped in inter-column whitespace. All 15 visual principles satisfied; 1 pre-existing cosmetic issue (∗ multiplicity 10px above arrowhead, non-blocking). Commit approved for merge.

---

## Decision: Ken QA Verdict — commit 89e7b36 (adaptive left-margin)

**Date:** 2026-06-28T10:32:00-04:00  
**Reviewer:** Ken (Visual QA)  
**Commit:** 89e7b36  
**Prior baseline:** e2a9d04

**Verdict:** ✅ PASS — No Regression

Additive commit introducing adaptive left-margin candidate and expansion penalty. "places" edge continues routing identically (laneX=186.77, inter-column midpoint). New optimizer logic not elected for this diagram's geometry. All 15 principles satisfied; 1 pre-existing ⚠️ (P9 ∗ multiplicity cramped, non-blocking). Safe to merge.

---

## Decision: Ken QA Verdict — commit b9b7eda (multi-wall routing)

**Date:** 2026-06-28T10:43:14-04:00  
**Requested by:** ormasoftchile  
**Artifact:** `examples/class/class-ken-multiwall.png` (1400px wide)  
**Prior PASS:** commit 89e7b36

**Verdict:** ✅ PASS — Zero Regression

Byte-for-byte SVG path match with prior PASS. Five new multi-wall routing strategies integrated cleanly; Strategy A (bottom→top) remains winner at laneX=186.77. All 15 visual principles satisfied; 1 pre-existing ⚠️ (P9 ∗ multiplicity cramped). Net effect: zero visual regression. Approved for merge.

