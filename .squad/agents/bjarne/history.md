# Bjarne — Ingestion Design

## Current Status (2026-06-16)

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

### ASCII-to-Diagrams Batch 1 patterns (2026-06-16)

**Converted diagrams — summary:**

| Figure | Section | What It Depicts | Dimensions | Aspect |
|--------|---------|-----------------|------------|--------|
| `three-layers` | §40 | Composition → Grammars → Kernel three-layer arch | 2676×1572 | 1.70:1 |
| `two-ir-model` | §20 | Domain IRs → Layout Engines → Scene IR → Backends | 3132×1380 | 2.27:1 |
| `composition-ir` | §20 | Composition IR dispatching to grammar engines | 3096×1074 | 2.88:1 |
| `dual-frontend` | §15 | DSL + structured IR → Domain IR → Layout → backends | 3678×1074 | 3.42:1 |
| `backend-arch` | §11 | Scene IR → SVG/Skia/PPTX backends, SVG→resvg+PDF | 2484×1074 | 2.31:1 |
| `canvas-layout` | §22 | Timeline canvas zones: header column + track rows | 3132×1227 | 2.55:1 |
| `rag-poster-layout` | §30 | 2×2 poster composition → unified Scene IR | 2586×1572 | 1.65:1 |

**Authoring patterns for architecture/pipeline diagrams:**

- Use `flowchart LR` + `executive` theme to match existing dogfood figures.
- Represent TOP-to-BOTTOM architecture stacks as LEFT-to-RIGHT by having the "highest-level" component (Composition) on the LEFT and the "foundation" (Kernel) on the RIGHT. Arrows point right (dependency direction).
- Pipeline stages: each stage is a node. Fan-in (multiple sources → one) and fan-out (one → multiple) render cleanly in LR.
- Multi-line labels via `<br>` are essential for keeping nodes compact in width while expressing multi-concept labels.
- **Semicolons (`;`) in node labels are statement separators in Mermaid** — must be avoided. Replace with commas, newlines via `<br>`, or rephrase.
- **Aspect ratio 4:1 limit**: at 3× scale, a 6-column flowchart pipeline reaches ~4500px width. To stay under 4:1, either reduce columns (merge intermediate stages) or increase height (more output nodes or multi-line labels). Merged `LE + Scene IR` into single "Layout Engine → Scene IR" node to bring `dual-frontend` from 4.22:1 to 3.42:1.
- **Inline Verbatim blocks** (not wrapped in `\begin{figure}`) can be replaced directly with `\ourdiagram` — the macro creates its own float wrapper.
- **Labels that exist only in their own section** (not `\ref`-ed elsewhere): safe to drop when converting `\begin{figure}...\label{...}...\end{figure}` to `\ourdiagram`.

**Skipped blocks in Batch 1:**
- `§13-determinism.tex`: only `lstlisting` JS code (test patterns). No ASCII structure diagrams.
- `§14-animation.tex`: Verbatim blocks are pseudocode type specs (FlowingDashes, DrawOn, etc.), not diagrams.
- All `lstlisting` blocks in §40, §20, §15, §11, §22, §30: code samples, API definitions, YAML examples — not diagrams.

### ASCII-to-Diagrams Batch 2 patterns (2026-06-16)

**Converted diagrams — summary:**

| Figure | Section | What It Depicts | Dimensions | Aspect |
|--------|---------|-----------------|------------|--------|
| `central-pipeline` | §02 | Dual-input pipeline: DSL/IR → Domain IR → Layout Engine → Scene IR → Rendering Backend → SVG/PNG/PDF | 4476×1227 | 3.65:1 |
| `distribution-arch` | §51 | Core Library hub → CLI Binary / npm Package / MCP Server / VS Code Extension / Docker Image | 1320×1917 | 1.45:1 |

**Batch 2 section survey — what was and wasn't converted:**

- **§12 themes**: Matrix is already a LaTeX `tabularx` table (not ASCII art). Three-tier token architecture is prose + YAML code listings. Theme pipeline described in prose. **Nothing to convert.**
- **§16 mermaid-compat**: LaTeX tables + `lstlisting` YAML examples only. **Nothing to convert.**
- **§17 superset-extensions**: All `lstlisting` blocks are DSL/YAML examples (poster DSL, theme config, animation, cross-diagram link syntax). **Nothing to convert.**
- **§29 chart-family**: `\begin{Verbatim}` blocks show Mermaid DSL examples (pie, xychart, quadrant, radar syntax) — language samples, not structural diagrams. **Nothing to convert.**
- **§30b cross-diagram-links**: All content is `lstlisting` pseudo-TypeScript types + DSL examples + LaTeX tables. No ASCII box-drawing structure diagram exists anywhere in §30b. The "trace-overlay illustration" caution was moot — no such illustration existed as ASCII art in the section. **Nothing to convert.**

**Aspect ratio fix pattern (central-pipeline):**

First render of `central-pipeline.mmd` was 5739×1074 (5.34:1) — failed dimension guard. Pipeline had 7 logical columns (Input A/B → Parser/Validation → Domain IR → Layout Engine → Scene IR → Backend → SVG/PNG/PDF). Fix: merge Layout Engine + Scene IR into one "Layout Engine → Scene IR" node (same pattern already used in `dual-frontend.mmd`). Re-render: 4476×1227 (3.65:1). **Rule: for each extra LR column, add ~650–750px to width at 3×; target ≤ 6 columns for safety in pipelines.**

**§30b caution follow-through:**

Per instructions, reviewed all content in §30b carefully. There are NO ASCII box-drawing diagrams (no `\begin{Verbatim}` or `\begin{verbatim}` blocks anywhere in the section). All illustrations in §30b are expressed as code listings or LaTeX tables. The "poster-layout illustration (2×2 grid)" mentioned in the caution does not appear in ASCII form — it's described only in prose via DSL examples. No diagram was skipped due to the caution — there was simply nothing to convert.

**ASCII-diagram conversion COMPLETE confirmation:**

As of 2026-06-16, all 12 dogfood figures are in place across the design document:
- `architecture`, `three-layers` (§40), `family-taxonomy` (§28), `theme-contract` (§12)
- `dual-frontend` (§15), `two-ir-model`, `composition-ir` (§20)
- `backend-arch` (§11), `canvas-layout` (§22), `rag-poster-layout` (§30)
- `central-pipeline` (§02), `distribution-arch` (§51)

No ASCII box-drawing diagrams remain unconverted in any section of the document.

## Technical Details

See `history-archive.md` for detailed learnings on Excel addressing, config-surface parsing, theme-contract merge, layout wiring, poster DSL architecture, and 2026-06-14 work on requirementDiagram + kanban + parser fidelity.
