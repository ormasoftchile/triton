# Bjarne — Ingestion Design

## Current Status (2026-06-16)

**Trace Abstraction Spec'd (§30b.8; leslie)**: Multi-hop system traceability across poster layers — named/typed/ordered cross-diagram traces desugar to atomic links + trace-group. Committed af080b0.

**Excel Cell Addressing Complete (§17.2, 2026-06-15)**: `cell A1:` is now a full equivalent of `cell [0,0]:`. Both forms parse to the same `PosterDocument` cell positions, may be freely mixed within a poster, and are case-insensitive. `excelToRowCol` exported for test use. 2659/2659 tests passing; existing goldens byte-identical. Gallery demo `poster-excel.{mmd,svg,png}` emitted.

**Extended Timeline Spec'd (§16b; leslie)**: One IR × 6 layouts × 7 themes = 42 presentations. Two-tier superset of Mermaid `timeline` with full IRDocument field mapping. Four known IR gaps flagged: (1) Milestone no `shape` field, (2) schema.ts layout enum missing `gantt`/`timeline-columns`, (3) `density` not persisted, (4) legend auto-generation unspecified. Implementation TBD.

**Poster Keyword Complete (§17.2)**: The `poster` top-level keyword is implemented. Parser (`parsePosterInternal`), composition-theme factories (`buildCompositionThemeFor`), and full render branch (`renderPoster` + `renderCellScene`) wired into `frontend/mermaid/index.ts`. All 21 grammar types supported as cell content. Graceful degradation: unknown/failing cells warn + skip. 2451/2451 tests passing. Existing goldens byte-identical. Gallery demos: `poster-rag.{mmd,svg,png}` (executive, 2×2, flowchart+sequence+mindmap+xychart) and `poster-rag-midnight.{mmd,svg,png}` (midnight dark board).

**§17.1 Extension Mechanisms COMPLETE**: frontmatter/init config (bjarne-config-surface.md) + new top-level keyword (`poster`) are both shipped.

**Config Surface Complete**: Layout/density/themeOverrides now user-selectable via Mermaid-native config (frontmatter + `%%{init}%%`). `resolveContractTheme` helper added to theme-contract/. All 21 render branches wired. 2428/2428 tests passing. Determinism preserved.

**Recent:** Poster keyword shipped (2026-06-15). Config surface implementation (2026-06-15). Prior: requirementDiagram + kanban (2026-06-14).

## Technical Details

See `history-archive.md` for detailed learnings on Excel addressing, config-surface parsing, theme-contract merge, layout wiring, poster DSL architecture, and 2026-06-14 work on requirementDiagram + kanban + parser fidelity.
