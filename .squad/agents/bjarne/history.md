# Bjarne — Ingestion Design

## Current Status (2026-06-16)

**Geometry-Quality Kernel: Feedback-Driven Layout + Post-Render Gate (2026-06-16)**: Barbara's deterministic kernel (detectors: edgeThroughNode/labelOverNode/labelLabelOverlap/outOfBounds) now consumed in two ways: (1) during overlay router layout — scores candidate routes, picks lowest-cost deterministically, no poisoned renders; (2) post-render gate — fails egregious defects, prints objective report. Validation caught real defect (state `__end__` stab) and fixed via pseudo-state exclusion from anchor registry. All 5 posters CLEAN (verdict matches visual). 2770 tests, determinism preserved. Committed b4b2f04.

**ASCII-to-Diagrams Batch 2 Complete (2026-06-16)**: Converted 2 remaining ASCII/box-drawing diagrams across 2 sections. §02 central-thesis: `central-pipeline` (dual-input pipeline from DSL/IR through Domain IR → Layout Engine → Scene IR → Rendering Backend → SVG/PNG/PDF). §51 distribution: `distribution-arch` (Core Library hub → CLI Binary / npm Package / MCP Server / VS Code Extension / Docker Image). Both executive theme, flowchart LR, pass dimension guard. PDF builds clean at 3.1MB. ASCII-diagram conversion is now COMPLETE across the full design document. Decision note: `.squad/decisions/inbox/bjarne-ascii-to-diagrams-batch2.md`.

**ASCII-to-Diagrams Batch 1 Complete (2026-06-16)**: Converted 7 ASCII/box-drawing diagrams across 6 sections to dogfood figures rendered by our compiler. Sections covered: §40-architecture (three-layers), §20-grammar-concept (two-ir-model, composition-ir), §15-frontend (dual-frontend), §11-backends (backend-arch), §22-rendering (canvas-layout), §30-composition (rag-poster-layout). All figures: executive theme, flowchart LR, multi-line labels, pass dimension guard. PDF builds clean at 3.1MB. Decision note written to `.squad/decisions/inbox/bjarne-ascii-to-diagrams-batch1.md`.

**Multi-Line Node Labels Implemented (2026-06-16)**: Barbara shipped multi-line label support (`<br>/\n`); C4 descriptions now wrap correctly.

**Dogfood Figures Pipeline Complete (2026-06-15)**: CLI now renders `.mmd` files via `parseMermaid`/`renderMermaid`. `make figures` in `design/` renders every `design/figures/src/*.mmd` → `design/figures/<name>.png` at 3× scale. Three dogfood figures authored and placed in §40-architecture, §28-family-taxonomy, §12-themes. `\ourdiagram` LaTeX macro added. PDF clean (2.5MB). 2659/2659 tests passing; existing goldens byte-identical.

**Trace Abstraction Spec'd (§30b.8; leslie)**: Multi-hop system traceability across poster layers — named/typed/ordered cross-diagram traces desugar to atomic links + trace-group. Committed af080b0.

**Excel Cell Addressing Complete (§17.2, 2026-06-15)**: `cell A1:` is now a full equivalent of `cell [0,0]:`. Both forms parse to the same `PosterDocument` cell positions, may be freely mixed within a poster, and are case-insensitive. `excelToRowCol` exported for test use. 2659/2659 tests passing; existing goldens byte-identical. Gallery demo `poster-excel.{mmd,svg,png}` emitted.

**Extended Timeline Spec'd (§16b; leslie)**: One IR × 6 layouts × 7 themes = 42 presentations. Two-tier superset of Mermaid `timeline` with full IRDocument field mapping. Four known IR gaps flagged: (1) Milestone no `shape` field, (2) schema.ts layout enum missing `gantt`/`timeline-columns`, (3) `density` not persisted, (4) legend auto-generation unspecified. Implementation TBD.

**Poster Keyword Complete (§17.2)**: The `poster` top-level keyword is implemented. Parser (`parsePosterInternal`), composition-theme factories (`buildCompositionThemeFor`), and full render branch (`renderPoster` + `renderCellScene`) wired into `frontend/mermaid/index.ts`. All 21 grammar types supported as cell content. Graceful degradation: unknown/failing cells warn + skip. 2451/2451 tests passing. Existing goldens byte-identical. Gallery demos: `poster-rag.{mmd,svg,png}` (executive, 2×2, flowchart+sequence+mindmap+xychart) and `poster-rag-midnight.{mmd,svg,png}` (midnight dark board).

**§17.1 Extension Mechanisms COMPLETE**: frontmatter/init config (bjarne-config-surface.md) + new top-level keyword (`poster`) are both shipped.

**Config Surface Complete**: Layout/density/themeOverrides now user-selectable via Mermaid-native config (frontmatter + `%%{init}%%`). `resolveContractTheme` helper added to theme-contract/. All 21 render branches wired. 2428/2428 tests passing. Determinism preserved.

**Recent:** Dogfood pipeline (2026-06-15). Poster keyword shipped (2026-06-15). Config surface implementation (2026-06-15). Prior: requirementDiagram + kanban (2026-06-14).

## Technical Details

See `history-archive.md` for detailed learnings on CLI rendering, Makefile pipeline, LaTeX macro integration, High-DPI PNG, ASCII-to-diagrams patterns, and architecture diagram authoring conventions.

**Cross-Diagram Links + Traces Implemented (§30b; barbara, 2026-06-16)**: Node-anchor registry on flow/class/state grammars enables cross-diagram linking via poster `link` (atomic) and `trace` (multi-hop, typed, colored) keywords. Traces render with categorical palette colors + legend. §30b now embeds a real traced-poster figure. 70d494f (Phase A), 9d57815 (Phase B).

**Kernel obstacle set = all rendered nodes (pseudo-states included); blindness fixed + regression-tested (2026-06-16)**: Geometry-quality kernel was blind to pseudo-state nodes because obstacle registry excluded them (correct for link endpoints, wrong for collision detection). Separated `anchors` (addressable targets only) from `obstacles` (full rendered set). Router now scores against full set, routing cleanly around end-bullseye. Regression tests E1/E2 added. 2772 tests passing; only `link-poster.png` changed. Committed 6d8df80.

**Aesthetic scorecard added (corpus-calibrated); objectively rates layout quality + feeds route-cost (2026-06-16)**: Barbara's geometry/aesthetics.ts adds five normalized metrics (gridBalance, congestion, alignment, spacingUniform, edgeCrossings) with corpus-calibrated conservative hard gates (gridBalance/congestion ≥ 0.30 so no existing example fails, rest soft scorecard). Scorecard objectively rates poster-trace MEDIOCRE (0.649), matching visual reality. Integrated into route-cost via congestion penalty (link-poster congestion 0.75→1.0). 2790 tests, goldens poster-trace updated. Committed 7f580e1.
