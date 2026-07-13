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

---

## Decision: Ken QA Verdict — "places" Left-Route (commit 2e259cd)

**Date:** 2026-06-28T11:00:25-04:00  
**Reviewer:** Ken (Visual QA)  
**Artifact:** `examples/class/class-ken-leftroute.png`  
**Commit:** 2e259cd

**Verdict:** ✅ PASS

All five routing requirements for Strategy B (Left→Left) are satisfied. The "places" edge routes down the left margin with 3.82px gap to lane rail. Label fully visible with ~6px SVG margin from viewBox left. All 15 visual principles satisfied; 1 minor observation (label y=298 vs ShoppingCart center y=301.5 is 3.5px offset, sub-threshold at render scale). Exit/entry points pixel-perfect at Customer/Order left-wall mid-heights. Approved for merge.

---

## Decision: Ken QA Verdict — commit 2c245f7 — Breathing Room and Label Fix

**Date:** 2026-06-28T11:13:04-04:00  
**Reviewer:** Ken (Visual QA)  
**Commit:** `2c245f7` — fix(class): LANE_CLEARANCE=48, expansion penalty 0.05, label viewBox extra margin

**Verdict:** ✅ PASS

Objectives achieved: (1) Label fix: LABEL_EXTRA=48 provides ~112px canvas clearance to left of "places" label, fully visible with zero clipping risk. (2) Breathing room: LANE_CLEARANCE increased 32→48; rendered lane-to-box gap now ~72.7px (up from ~36px). Rendered gaps: Customer/Order 72.7px, ShoppingCart 49px — all comfortable and visually unambiguous. All 15 principles satisfied; "*" multiplicity no longer cramped. Comparison with prior PASS (2e259cd): improved +36px lane-to-box, +92px label clearance, no regressions.

---

## Decision: Ken QA Verdict — commit a9312ce — Final Breathing Room Fix

**Date:** 2026-06-28T11:18:23-04:00  
**Reviewer:** Ken (Visual QA)  
**Artifact:** `examples/class/class-ken-final.png` (1400px wide)  
**Commit:** a9312ce

**Verdict:** ✅ PASS

Geometry: viewBox −90 to 390; lane rail at x=−16.18; ShoppingCart left x=24 (widest box) → **40.18px gap**; Customer/Order left x=31.82 → **48px gap**. "places" label at x=−20 (text-anchor end) with ~35px canvas margin to viewBox edge — zero clipping risk. All 15 visual principles satisfied; no regressions from prior PASS verdicts. Arrowhead semantically correct (open chevron →); all edges stroke #64748B 1.3/1.4pt; vertical plumb maintained (spine x≈96.82). Net effect: comfortable 40px bracket-to-box separation without wasting canvas; left margin occupies ~74px of 90px expansion — efficient.


---

## Decision: P3 — Icon CLI wiring + sty content-hash cache key

**Author:** Brian (Layout Implementation Engineer)  
**Date:** 2026-07-12T21:11:40-04:00  
**Status:** IMPLEMENTED

### Context

P0/P1/P2/P6/P7 shipped icon pack discovery, contract, rendering (774 tests). P3 wires icon packs into the triton-latex CLI and folds pack content into the TeX render cache key.

### Decisions

#### 1. `latex/src/icon-resolve.ts` — core-only module pattern

**Decision:** All CLI icon-resolution logic lives in a standalone `icon-resolve.ts` that imports ONLY `node:fs`, `node:path`, and `../../src/**` (Triton core). It is **never** imported from `cli.ts` tests.

**Rationale:** vitest runs `pnpm test` at root before `latex/node_modules` is installed and `latex/dist` exists. `cli.ts` imports `./pdf.js` → pdfkit (latex-only dep). Any test file that imports `cli.ts` would fail without the latex build. The core-only pattern (introduced with `theme-resolve.ts`) keeps tests hermetic. `icon-resolve.ts` mirrors `theme-resolve.ts` exactly.

**Precedence (lowest → highest):**
1. Auto-discovery — `findTritonIconsDir(inputDir)` + `discoverIconPacks` (Bjarne's API)
2. `--icons-dir <dir>` — overlaid on auto, overrides on duplicate prefix
3. `--icon-pack <path>` — loaded last, highest precedence; throws on error

Duplicate prefix: last-wins (consistent with `discoverIconPacks` policy).

#### 2. `latex/src/cli.ts` — flag wiring

**Decision:** Add `--icons-dir` and `--icon-pack` to `parseArgs`, resolve via `resolveCliIcons(args, inputDir)` wrapped in try/catch → `console.error + exit(1)`. Pass resulting `IconPackMap` as the 5th argument of `renderSync`. Both `render` and `render-dir` commands updated.

**Rationale:** Mirrors the theme flag pattern exactly, keeping CLI structure uniform.

#### 3. `latex/triton.sty` — icon macros + content-hash cache key

**Decision:**
- `\tritoniconsdir{dir}` → appends `--icons-dir dir` to CLI invocation; dir path folded into `%% triton-key` comment (path-only, same caveat as themes).
- `\tritoniconpack{path}` → appends `--icon-pack path` to CLI invocation; **content-hashed** via `\pdf@filemdfivesum{path}` (pdftexcmds, already required). The MD5 of the pack file's content is embedded in the `%% triton-key` comment, so editing a pack in-place invalidates the cache automatically.

**Why better than themes:** Themes use path-only cache keys (documented limitation in sty lines 102–105). Icon packs improve on this: explicit `--icon-pack` files are content-hashed. Cache invalidation on in-place edit is guaranteed for the `--icon-pack` case.

**Residual limitation (disclosed):** `--icons-dir` packs and auto-discovered packs are still keyed by path only (not content). Full content-hashing of a directory of JSON files would require a `\write18` shell pipeline that is fragile across platforms (no portable `md5sum`/`shasum` invocation that works on macOS + Linux + Windows). Clear cache manually with `rm -r <cachedir>` or `latexmk -C` when editing packs inside a directory in-place.

#### 4. Tests

**Decision:** `test/latex-cli-icons.test.ts` imports `resolveCliIcons` from `../latex/src/icon-resolve.js` (source, core-only). Covers all five scenarios: `--icon-pack` loads specific pack, `--icons-dir` loads a dir, auto-discovery via ancestor `.triton/icons/`, precedence/merge order (all three layers), bad `--icon-pack` throws.

Fixtures added:
- `test/fixtures/icons/valid-heroicons.triton-icons.json` — third valid pack for merge tests
- `test/fixtures/icons-discovery/.triton/icons/azure.triton-icons.json` — auto-discovery walk-up test

**CI verification:** `rm -rf latex/dist latex/node_modules && pnpm test` → 787/787 ✓ (proves zero pdfkit dependency).

### Test totals after P3
- Before P3: 774 tests
- After P3: **787 tests** (+13)
- After `rm -rf latex/dist latex/node_modules`: **787/787 ✓**

---

## Decision: P4 Icon Registry — Extension Multi-Root Scan + Render Threading

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-07-12T21:11:40-04:00  
**Status:** Implemented

### Context

P4 extends the VS Code extension to discover `.triton/icons/` packs from workspace folders and pass the loaded `IconPackMap` into the render pipeline. This is the extension-side complement to P1 (`discoverIconPacks`) and the P6 `icons` param on `renderSync`/`compileSync`.

### Decision

#### 1. `IconRegistry` mirrors `ThemeRegistry` exactly

`extension/src/icon-registry.ts` is the icon twin of `ThemeRegistry`:

| Concern | ThemeRegistry | IconRegistry |
|---------|--------------|--------------|
| Discovery fn | `discoverThemes(dir)` | `discoverIconPacks(dir)` |
| Storage | `Map<string, ResolvedTheme>` | `Map<string, IconifyJSON>` (i.e. `IconPackMap`) |
| Merge key | theme name | pack prefix |
| Duplicate policy | last-scanned wins + warning | same |
| Watcher glob | `.triton/themes/*.triton-theme.json` | `.triton/icons/*.triton-icons.json` |
| Output accessor | `resolve(name)`, `customNames()` | `iconPacks()` (returns full map) |
| Event | `onDidChange` | `onDidChange` |
| Lifecycle | `buildWatchers()` + `refresh()` at activation | same |

Rationale: exact structural mirror keeps the codebase coherent and makes the pattern immediately recognizable to any contributor who has worked with `ThemeRegistry`.

#### 2. `compileAndRenderSync` extended with optional `icons` param

`src/frontend/index.ts: compileAndRenderSync` previously had no `icons` parameter (unlike `renderSync`/`compileSync` which already had it from P6). Added `icons?: IconPackMap` as 5th optional param, forwarded into `compileSync`. The extension webview render path uses `compileAndRenderSync` (for the anchors), so this was the required extension point.

#### 3. `renderFencedBlock` extended with optional `icons` param

`extension/src/markdown.ts: renderFencedBlock` adds `icons?: IconPackMap` as 5th param, forwarded into `renderSync`. This covers:
- The built-in Markdown preview fence renderer
- The PreviewManager's multi-block Markdown stacked render

#### 4. Threading pattern in PreviewManager

`IconRegistry` is instantiated alongside `ThemeRegistry` in `PreviewManager.__constructor__`:
```ts
this.iconRegistry = new IconRegistry();
context.subscriptions.push(this.iconRegistry);
this.iconRegistry.buildWatchers();
this.iconRegistry.refresh();
this.iconRegistry.onDidChange(() => this.onIconRegistryChange());
```

`onIconRegistryChange` is a thin re-render trigger (no dropdown or state to update — icons are stateless from the webview's perspective). Both render paths use `this.iconRegistry.iconPacks()` at render time, so any watcher-triggered `refresh()` is automatically picked up on the next call.

#### 5. No unit tests for `IconRegistry` (mirrors ThemeRegistry)

`ThemeRegistry` has no unit tests in the test suite — extension code is integration-tested manually via the VS Code host. `IconRegistry` follows the same policy. Validation: `pnpm typecheck` (0 errors), `pnpm build` (clean extension bundle), `pnpm test` (774/774 pass).

### Files Changed

- `extension/src/icon-registry.ts` — new (IconRegistry class)
- `extension/src/extension.ts` — import IconRegistry; add `iconRegistry` field + watcher lifecycle; `onIconRegistryChange` handler; pass `iconRegistry.iconPacks()` into both render calls
- `extension/src/markdown.ts` — add `icons?: IconPackMap` to `renderFencedBlock`, thread into `renderSync`
- `src/frontend/index.ts` — add `icons?: IconPackMap` to `compileAndRenderSync`, forward to `compileSync`
