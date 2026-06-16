# Bjarne — Ingestion Design

## Current Status (2026-06-16)

**Multi-Line Node Labels Implemented (2026-06-16)**: Barbara shipped multi-line label support (`<br>/\n`); C4 descriptions now wrap correctly.

**Dogfood Figures Pipeline Complete (2026-06-15)**: CLI now renders `.mmd` files via `parseMermaid`/`renderMermaid`. `make figures` in `design/` renders every `design/figures/src/*.mmd` → `design/figures/<name>.png` at 3× scale. Three dogfood figures authored and placed in §40-architecture, §28-family-taxonomy, §12-themes. `\ourdiagram` LaTeX macro added. PDF clean (2.5MB). 2659/2659 tests passing; existing goldens byte-identical.

**Trace Abstraction Spec'd (§30b.8; leslie)**: Multi-hop system traceability across poster layers — named/typed/ordered cross-diagram traces desugar to atomic links + trace-group. Committed af080b0.

**Excel Cell Addressing Complete (§17.2, 2026-06-15)**: `cell A1:` is now a full equivalent of `cell [0,0]:`. Both forms parse to the same `PosterDocument` cell positions, may be freely mixed within a poster, and are case-insensitive. `excelToRowCol` exported for test use. 2659/2659 tests passing; existing goldens byte-identical. Gallery demo `poster-excel.{mmd,svg,png}` emitted.

**Extended Timeline Spec'd (§16b; leslie)**: One IR × 6 layouts × 7 themes = 42 presentations. Two-tier superset of Mermaid `timeline` with full IRDocument field mapping. Four known IR gaps flagged: (1) Milestone no `shape` field, (2) schema.ts layout enum missing `gantt`/`timeline-columns`, (3) `density` not persisted, (4) legend auto-generation unspecified. Implementation TBD.

**Poster Keyword Complete (§17.2)**: The `poster` top-level keyword is implemented. Parser (`parsePosterInternal`), composition-theme factories (`buildCompositionThemeFor`), and full render branch (`renderPoster` + `renderCellScene`) wired into `frontend/mermaid/index.ts`. All 21 grammar types supported as cell content. Graceful degradation: unknown/failing cells warn + skip. 2451/2451 tests passing. Existing goldens byte-identical. Gallery demos: `poster-rag.{mmd,svg,png}` (executive, 2×2, flowchart+sequence+mindmap+xychart) and `poster-rag-midnight.{mmd,svg,png}` (midnight dark board).

**§17.1 Extension Mechanisms COMPLETE**: frontmatter/init config (bjarne-config-surface.md) + new top-level keyword (`poster`) are both shipped.

**Config Surface Complete**: Layout/density/themeOverrides now user-selectable via Mermaid-native config (frontmatter + `%%{init}%%`). `resolveContractTheme` helper added to theme-contract/. All 21 render branches wired. 2428/2428 tests passing. Determinism preserved.

**Recent:** Dogfood pipeline (2026-06-15). Poster keyword shipped (2026-06-15). Config surface implementation (2026-06-15). Prior: requirementDiagram + kanban (2026-06-14).

## Learnings

### CLI .mmd rendering (2026-06-15)

- CLI `render` command now detects `.mmd` by file extension first; secondary signal is content starting with a known Mermaid keyword or `---` frontmatter. Detection via `isMermaidInput(filePath, content)` helper.
- `.mmd` files route to `renderMermaid(text, { format: 'svg', theme? })` — always render to SVG first, then optionally rasterise with `svgToPng(svg, undefined, scale)` for PNG output.
- `--scale <n>` flag added to CLI `render` command. Default 3× for `.mmd` (high-DPI, print-ready), default 1× for IR files.
- `svgToPng` in `packages/core/src/render/png.ts` updated to accept optional `scale?: number`; uses `Resvg`'s `fitTo: { mode: 'zoom', value: scale }` option.
- `svgToPng` is now exported from `packages/core/src/index.ts` for CLI consumers.
- TD/top-bottom layout in flowchart is deferred (warns, falls back to LR). Design flowchart sources for LR when vertical isn't required.
- Subgraphs in flowchart are deferred (Inc-2). Avoid them in dogfood figures.

### Figures Makefile pipeline (2026-06-15)

- Pattern: `$(patsubst figures/src/%.mmd,figures/%.png,$(FIGURE_SRCS))` drives `figures/%.png: figures/src/%.mmd $(CLI_BIN)`.
- `REPO_ROOT := $(shell git -C . rev-parse --show-toplevel ...)` finds the monorepo root from within `design/`.
- `CLI_BIN` guard: if `packages/cli/dist/index.js` doesn't exist, the recipe builds core + cli first.
- `pdf` target now depends on `$(FIGURE_PNGS)` so `make pdf` always has current figures.
- `make figures` is incremental (Make timestamp semantics): only re-renders changed `.mmd` files.
- Command: `timeline render <f>.mmd --format png --scale 3 -o figures/<name>.png`

### `\ourdiagram` LaTeX macro (2026-06-15)

```latex
\newcommand{\ourdiagram}[3][\linewidth]{%
  \begin{figure}[htbp]
  \centering
  \includegraphics[width=#1]{figures/#2.png}
  \caption{#3}
  \par\vspace{0.4em}
  \textit{\small Rendered by the diagram compiler this document describes
    (source: \texttt{design/figures/src/#2.mmd}, built with \texttt{make figures}).}
  \end{figure}%
}
```

Placed in `design/main.tex` preamble before `\title{}`. Usage: `\ourdiagram{basename}{caption}` or `\ourdiagram[0.8\linewidth]{basename}{caption}`.

### High-DPI PNG for LaTeX (2026-06-15)

- Vector PDF embed is a future enhancement (no rsvg/inkscape/cairosvg installed; canvaskit-wasm doesn't emit clean PDF).
- PNG at 3× resvg zoom = `logical_px × 3` actual pixels. Tectonic/pdflatex include PNGs natively via `graphicx` — no conversion needed.
- 3× is sufficient for print-quality LaTeX at typical figure widths (120–150mm on A4).
- Dimension guard applies: H ≤ 5000px and H/W ≤ 4:1. Design diagram sources with LR layout (or mindmap) for clean proportions. Avoid subgraphs and TD layout (deferred).

### Dogfood figure results (2026-06-15)

| Figure | Type | Theme | Size (px at 3×) | W/H | Section |
|--------|------|-------|-----------------|-----|---------|
| `architecture` | flowchart LR | executive | 3810×921 | 4.14 | §40 |
| `family-taxonomy` | mindmap | blueprint | 4200×3000 | 1.40 | §28 |
| `theme-contract` | flowchart LR | executive | 4512×1650 | 2.73 | §12 |

All pass dimension guard. Existing §55 `target-*.png` files unchanged.

## Technical Details

See `history-archive.md` for detailed learnings on Excel addressing, config-surface parsing, theme-contract merge, layout wiring, poster DSL architecture, and 2026-06-14 work on requirementDiagram + kanban + parser fidelity.
