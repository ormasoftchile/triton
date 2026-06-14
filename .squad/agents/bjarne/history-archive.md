# Bjarne — Ingestion Design

## Current Status (2025-01-01)

**Tier 0 COMPLETE**: All five mermaid parsers finalized (flowchart, sequence, gantt, timeline, mindmap).
- Suite: **1083 tests** (+112 corpus), 0 regressions
- All existing goldens byte-identical
- Commit: a7f543b "feat(mermaid): complete Tier 0 with gantt, timeline, mindmap parsers"
- Gallery: 3 new renders (mermaid-gantt, mermaid-timeline, mermaid-mindmap)

**Even-spacing horizontal timeline** (Barbara): 9233px → 792px, no collisions.

## Recent Work (2026-06-13)

Three new parsers implemented (gantt.ts, timeline.ts, mindmap.ts), all following tokenizer fidelity bar:
- Real-data crawl validation (AC1–AC9 corpus tests per parser)
- Whitespace-independent parsing (compact and spaced syntax)
- Graceful degradation + warnings (never silent-drop)
- Clean label extraction (shape delimiters stripped)

**gantt** (35 tests):
- `title` → metadata, `section` → tracks + sections, task lines → activities/milestones
- Status flags: done, active, planned, critical; dependencies (after X); durations (Nd/Nw/Nm/Ny/Nh)
- Deferred: axisFormat, excludes, todayMarker, click, href, until

**timeline** (38 tests):
- Period lines → IRDate (year/year-month/ISO) + milestone + activities
- Events → activity with span or start+end
- Deferred: disableMulticolor, accTitle, accDescr
- Layout: vertical-spine (natural for historical/product timelines)

**mindmap** (39 tests):
- Indentation → tree structure via pop-stack
- Shapes: ((…)), [[…]], […], (…), {{…}}, ))..(( , >..]  → kind + clean label
- Icon extraction: ::icon(fa fa-x) → stripped to base name
- Deferred: :::className, multiple roots (warning + attach), FontAwesome name mismatch (ICON warning)

**Gallery self-check:**
- gantt: 1200×324px (horizontal roadmap)
- timeline: 1200×9233px → 1296×792px (even-spacing fixed)
- mindmap: 1932×402px (top-down tree)

## Next: Tier 1

Ready: class, state, ER, C4 parsers + new IRs + layout engines.

---

For archived history, see history-archive.md.

## Learnings (Tier 1 · classDiagram)

- Added a dedicated `ClassDocument` IR + schema + theme + deterministic 2-column compartment layout for Mermaid `classDiagram`.
- Endpoint markers are emitted as Scene `path` primitives (hollow triangle, filled/hollow diamond, open arrow), so SVG/PNG backends stayed unchanged.
- Parser strategy mirrors Tier 0: preprocess frontmatter/comments, flatten namespaces, auto-create referenced classes, and warn on deferred/unknown syntax instead of throwing.
- Current deliberate degradations: `direction` is accepted but does not affect layout yet; generic class names like `List~T~` are stripped to the base name for stable IDs/display.
- Verification: `pnpm -C packages/core build`, `typecheck`, and full `test` all passed; suite is now 1139/1139 green, and `examples/gallery/mermaid-class.{svg,png}` emit correctly.

## Learnings (Tier 1 · stateDiagram + erDiagram)

- Added two new Mermaid Tier 1 verticals without touching the shared renderer kernel: `stateDiagram` and `erDiagram` now lower through dedicated Domain IRs into the existing Scene pipeline.
- `stateDiagram` uses a deterministic vertical state-machine layout with additive pseudostates (start/end circles, fork/join bars, choice diamonds), scoped composite-state children, note attachments, and warning-driven parsing for cosmetic-only `direction` lines.
- `erDiagram` uses a deterministic compartment-style entity layout plus crow's-foot endpoints built entirely from Scene `path` primitives, so cardinality glyphs work in both SVG and PNG backends with no backend branching.
- Parser policy matches the rest of Mermaid Tier 0/Tier 1: auto-create referenced nodes/entities on first mention, enrich them later when explicit declarations appear, and never crash on malformed lines when a warning is sufficient.
- Verification: `pnpm -C packages/core build`, `pnpm -C packages/core typecheck`, and full `pnpm -C packages/core test` all passed; the suite is now 1235/1235 green, and `examples/gallery/mermaid-state.{svg,png}` plus `examples/gallery/mermaid-er.{svg,png}` emit correctly.

## Learnings (Tier 1 · C4 diagram — 2026-06-14)

- Added `grammars/c4/{types,schema,layout,theme,index}.ts` and `frontend/mermaid/c4.ts` — the final Tier 1 UML/Software grammar. Five C4 sub-kinds wired into detect/parse/render pipeline: C4Context, C4Container, C4Component, C4Dynamic, C4Deployment.
- **Element kind model**: 20 constructors in 4 categories (Person, System, Container, Component), each with optional `_Ext` (external/muted gray), `Db` (cylinder arc hint), `Queue` (shape deferred). `technology` field appears in the `«stereotype: tech»` line.
- **Boundary-as-container reuse**: Recursive `C4Boundary` (modelled after state composite containers) — `z.lazy()` in Zod schema for recursive nesting; `measureBoundary()` → `placeBoundary()` recursive layout functions. Dashed border via `path` `d` with rounded rect SVG path (not `rect` + `strokeDasharray`, which required workaround). Header label above interior padding.
- **External styling**: `_Ext` suffix → theme `extFill`/`extStroke`/`extTextColor` (gray/muted). Internal elements get category-based fills (Person/System=blue, Container=medium-blue, Component=light-blue). Theme resolves per-element style via `resolveElementStyle(kind, tk)` helper.
- **Parser arg-tokenizing**: `tokenizeArgs(argStr)` handles quoted strings with commas inside, strips `$named` args, unquotes tokens. Boundary block nesting uses an explicit `Array<C4Boundary | C4Document>` scope stack — clean and depth-independent.
- **C4Dynamic numbered rels**: First arg integer → `rel.order`; label prefixed `"N: label"` in layout. Rel_Back parsed as swapped from/to. Rel_U/D/L/R → plain Rel + layout-hint warning (spatial grid ignores directional hints).
- **Real-crawl findings**: Canonical Internet Banking System corpus exposed `Rel_Ext` (non-standard, parsed as `Rel` + warning), `<br/>` in description strings (kept as-is, renders harmlessly), empty-alias boundaries (alias required, warn + skip). Real examples confirmed technology arg order varies per element kind.
- **Spacing deliberateness**: elementGapX=80, elementGapY=60, boundaryPadX=24, boundaryPadY=20, boundaryHeaderHeight=36. Edge labels placed at midpoint with white background rect. Some crowding persists in dense nested diagrams — acceptable for MVP; Barbara may polish spacing in a follow-up pass.
- **Deferred**: Rel_U/D/L/R spatial placement; C4Deployment full Node semantics; Person circle icon; Queue shape icon; `$tags`/`$link` named args (silently ignored).
- **Verification**: `pnpm -C packages/core build` ✓, `pnpm -C packages/core typecheck` ✓, `pnpm -C packages/core test` → **1281/1281 passing** (46 new C4 corpus tests). Gallery: `mermaid-c4.{mmd,svg,png}` at **1445×728** px. Gallery card 32 added to `examples/gallery/index.html`. All 1235 pre-existing tests byte-identical (zero regressions).

## Milestone: Tier 1 COMPLETE — C4 Shipped (2026-06-14)

**Status:** COMPLETE
**Coverage:** All 4 Tier 1 UML/Software types done (classDiagram, stateDiagram, erDiagram, C4)
**Suite:** 1281/1281 green (46 new C4 tests), zero regressions
**Gallery:** mermaid-c4 1445×728px (Internet Banking System C4Context)
**Decision note:** .squad/decisions/inbox/bjarne-tier1-c4.md

---

## Milestone: Tier 1 PROGRESS — stateDiagram + erDiagram Shipped (2026-06-14T04:41:53Z)

**Status:** COMPLETE, layout-polished by Barbara  
**Commit:** 9c2d9b3 "feat(mermaid): Tier 1 — stateDiagram + erDiagram"  
**Coverage:** 3 of 4 Tier 1 UML/Software types done (class, state, ER; remaining C4)

- Both grammars real-crawl hardened, 96 corpus tests, 1235 full suite passing
- Deterministic layout engines with zero regression (goldens byte-identical)
- Gallery: mermaid-state 670×942, mermaid-er 656×706
- Left-margin skip-transition routing in state (see Barbara history for polish details)
- Degree-sort + interleaved ER grid placement eliminating long-diagonal routing
- Ready for C4 implementation next

## 2026-06-14 — Tier 2 Started

Tier 2 grammar-of-graphics chart foundation shipped: scales (LinearScale, BandScale), axes, marks, deterministic layout engine. First two chart types operational: pie + xychart-beta (bar+line). 1361 tests, all prior regressions zero. Foundation reusable for quadrant + radar (dispatch branch per type). Commit 5b709cf.
## 2026-06-14 — Tier 2 Complete

Tier 2 complete (pie/xychart/quadrant/radar). Quadrant + radar implemented on shared foundation. Quadrant: tinted regions, edge-aware non-clipping labels (defects fixed). Radar: radial scale, dual-syntax parser (Mermaid radar-beta + doc form). 1425/1425 tests ✓. Commits 5b709cf (foundation+pie+xy), ecfc418 (quadrant+radar).

## Learnings (journey: score→vertical-position emotional curve — 2026-06-14)

**Problem fixed:** The original journey layout plotted all task circles at the same
Y (the spine), encoding score only through fill color. This discarded the DEFINING
semantic of a user-journey diagram.

**Score → vertical position formula:**
```
faceY = absoluteSpineY + minDrop + (5 − score) × (maxDrop − minDrop) / 4
```
`minDrop = 16` (score 5 is 16 px below spine); `maxDrop = 140` (score 1 is 140 px below).
The face circles carry the same `scoreFills[scoreIndex]` as before (keeps existing tests).

**Droplines:** a dashed `line` primitive from `(centerX, absoluteSpineY)` to
`(centerX, faceY − taskRadius)`. Color = `droplineStroke`; dashArray = `'4,4'`.

**Emotion curve:** Catmull-Rom spline (→ cubic Bézier via `cp = p[i] ± (p[i+1] − p[i-1])/6`)
threaded through all face-circle centres in left-to-right order. Emitted as a single
`path` primitive BEFORE the circles so the curve appears behind the markers.

**Face expressions:** separate `path` primitive per task encodes score via mouth shape:
- score ≥ 4: happy (Q-bezier curving upward)
- score = 3: neutral (horizontal L)
- score ≤ 2: unhappy (Q-bezier curving downward)
Eye circles use `r = ceil(taskRadius / 8)` so they scale if `taskRadius` changes.

**Actor color assignment:** `allActors` (in order of first appearance, preamble first)
are mapped to `actorPalette[i % len]`. Applies consistently in task-box indicator dots
and the bottom legend. The `actorColorMap` is a `Map<string, string>`.

**Task boxes above spine:** white rounded rects (`taskBoxFill`, `taskBoxStroke`).
`boxBottom = absoluteSpineY − 6`; `boxTop = boxBottom − taskBoxH`.
`taskBoxH` is computed dynamically from the maximum label-line count across all tasks
plus the actor-dot row height, ensuring visual uniformity.

**File paths:**
- `packages/core/src/grammars/journey/layout.ts` — full layout rewrite
- `packages/core/src/grammars/journey/theme.ts` — 10 new theme fields; spineY default 92→152

**Test compat invariant:** face circles at `faceY` must have `r === tk.taskRadius` and
`fill === tk.scoreFills[scoreIndex(score)]` to satisfy the two score-ramp corpus tests
and the 10-plus-task count test.

**Gallery dimensions:** 1752×538 (width unchanged; height grew 84 px for the curve area).

**Decision note:** `.squad/decisions/inbox/bjarne-journey-curve-fix.md`

## Learnings (Tier 3 · journey + gitGraph — 2026-06-14)

- Added two new Tier 3 Mermaid verticals with dedicated IRs, schemas, themes, layouts, parsers, dispatch wiring, corpus suites, and gallery assets: `journey` → `JourneyDocument`, `gitGraph` → `GitGraphDocument`.
- `journey` preserves `preambleTasks` before the first `section`, rounds/clamps scores into the 1–5 ramp, renders alternating section bands over a horizontal spine, and emits actor chips plus a bottom-right actor legend entirely with existing Scene primitives.
- `gitGraph` starts on implicit `main`, tracks branch/checkout/merge/cherry-pick state with stable auto IDs (`commit-0`, `commit-1`, ...), and lays out commits in chronological LR columns with branch-colored lanes, merge/cherry-pick curves, tag chips, and HIGHLIGHT/REVERSE commit glyphs.
- Determinism stayed additive: all coordinates use `rhuInt()`, existing goldens remained byte-identical, and the new gallery renders emitted successfully at `mermaid-journey` 1752×454 and `mermaid-gitgraph` 1152×432.
- Verification: `pnpm -C packages/core build` ✓, `pnpm -C packages/core typecheck` ✓, `pnpm -C packages/core test` ✓ → **1503/1503 passing**.

## Learnings (Sankey value-in-label + gradient ribbons — 2026-06-14)

**Node value labels:**
- Added `showNodeValues: boolean` to `SankeyTheme` (default `true` to match Mermaid).
- Format helper `formatNodeValue(v)`: integers display without decimals; fractions keep up to 3 dp with trailing zeros stripped.
- Label composed as `"${node.label} ${formatNodeValue(throughput)}"` where throughput = `max(inFlow, outFlow)`.
- Updated corpus tests 8 and 25 to check `texts.some(t => t === name || t.startsWith(name + ' '))`.

**Gradient ribbons:**
- Added `fillGradient?: StrokeGradient` to `PathPrimitive` in `scene.ts` (reuses existing `StrokeGradient` interface — same `from/to/x1/y1/x2/y2` fields).
- Updated `svg.ts`: refactored `collectGradientDefs()` to handle both stroke and fill gradients; fill uses `fg-` ID prefix. `primitiveToSvg` for `path` uses `url(#fg-...)` when `fillGradient` is set.
- Updated `skia.ts`: `renderPath()` for filled paths checks `p.fillGradient` and builds `CK.Shader.MakeLinearGradient` shader instead of flat colour.
- In `layout.ts`: each ribbon gets `fillGradient: { from: srcColor, to: tgtColor, x1, y1: srcMidY, x2, y2: tgtMidY }` for a left-to-right horizontal gradient. `fill` field retained as backend fallback.

**File paths:**
- `packages/core/src/scene.ts` — added `fillGradient?: StrokeGradient` to `PathPrimitive`
- `packages/core/src/render/svg.ts` — `collectGradientDefs` now handles both stroke + fill; `primitiveToSvg` path case uses `fillGradientId()`
- `packages/core/src/render/skia.ts` — `renderPath()` handles `fillGradient` via `MakeLinearGradient` shader
- `packages/core/src/grammars/sankey/theme.ts` — added `showNodeValues: boolean` (default `true`)
- `packages/core/src/grammars/sankey/layout.ts` — `formatNodeValue()`, label composition with value, `StrokeGradient` import, gradient ribbon generation
- `packages/core/test/mermaid-sankey-corpus.test.ts` — updated tests 8 and 25 for value-in-label

**Suite:** 1540/1540 passing. All pre-existing non-sankey goldens byte-identical. Gallery: `mermaid-sankey.{svg,png}` at 964×544 (canvas dims unchanged).

## Learnings (sequence autonumber + notes — 2026-06-14)

- Fixed sequence-diagram step badge fidelity without changing IR semantics: `Message.order` stays zero-based, but rendered autonumber badges now display `msgRank + 1` (1-indexed sequential rank among messages), matching Mermaid. Using rank rather than `order + 1` also keeps YAML fixtures (which use 1-based orders) correct.
- Added first-class `SequenceNote` support across the sequence stack (`types.ts`, `schema.ts`, Mermaid parser, theme, layout, exports), with `afterOrder` used to interleave notes among messages while preserving message order invariants.
- Parser now lowers `Note left of`, `Note right of`, and `Note over A[,B]` into IR instead of warning-and-dropping, and `autonumber` now sets `sequence.autonumber = true` while still surfacing a note-level warning.
- Layout now renders note boxes/text and uses a unified message+note sort, so notes occupy visual rows without affecting message `order` values or fragment / activation semantics.
- `renderMessage` received a new `stepNumber: number` parameter (1-based rank) so callers control the displayed number; the layout loop tracks `msgRank` separately from the unified item rank.
- Notes are positioned using `afterOrder + 0.5` as the sort key, placing them after the named message and before the next one in the visual sequence without altering any existing message order values.

**File paths:**
- `packages/core/src/grammars/sequence/types.ts` — added `SequenceNote`; `autonumber?` + `notes?` in `SequenceDefinition`
- `packages/core/src/grammars/sequence/schema.ts` — `sequenceNoteSchema`; note participant cross-validation
- `packages/core/src/grammars/sequence/theme.ts` — 8 new `note*` tokens; defaults + dark overrides
- `packages/core/src/grammars/sequence/layout.ts` — `renderNote()`; `SortedItem` union type; unified render loop; rank-based `stepNumber`
- `packages/core/src/grammars/sequence/index.ts` — exported `SequenceNote`
- `packages/core/src/frontend/mermaid/sequence.ts` — note parsing; `autonumber` flag; notes array
- `packages/core/test/mermaid-sequence-corpus.test.ts` — updated AC7 + AC9; new fidelity describe block (8 tests)

**Verification:** `pnpm -C packages/core build` ✓, `pnpm -C packages/core typecheck` ✓, `pnpm -C packages/core test` → **1552/1552 passing**; only `mermaid-sequence.{svg,png}` changed in gallery goldens.
