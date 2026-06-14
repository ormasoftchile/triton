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
