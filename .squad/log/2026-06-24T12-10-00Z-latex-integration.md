# Session — LaTeX integration (vector PDF, isolated package)

**Date:** 2026-06-24 · **Requested by:** ormasoftchile · **Merged:** PR #24 (commit 771573c on `main`)

## What happened
Two-phase effort to let Triton diagrams be authored in LaTeX as a TikZ replacement.

- **David (Research Lead)** — Phase 1 research → `latex/RESEARCH.md`. Found the SVG→PDF format gap, recommended
  precompile + `\includegraphics`, flagged that no Triton CLI existed.
- **User decisions** — vector PDF (not PNG); core gains ZERO new deps; all PDF deps isolated in a separate
  `latex/` package; Overleaf is a hard requirement; precompile-only authoring for v1.
- **Barbara (Semantics & Rendering)** — Phase 2 build → isolated `@triton/latex` package. Vector PDF via pure-JS
  `pdfkit` + `svg-to-pdfkit` (no binaries, no Chromium). Fidelity gate PASSED. CLI `triton-latex`
  (`render`/`render-dir`) reusing core `renderSync()`. `triton.sty` (graphicx-only). Demo `demo.tex` +
  committed figures + Makefile. New `design/sections/09-latex-integration.tex` (design PDF rebuilt clean).

## Gate
Core untouched (root package diff EMPTY) · root `pnpm test` = 378 pass (unchanged) · latex typecheck 0 ·
esbuild exit 0 · 3 examples → valid vector PDFs.

## Scribe bookkeeping
Merged 3 inbox notes (2 latex + 1 ds-poster) into `decisions.md`; wrote 2 orchestration entries; summarized
`barbara/history.md` (over 15 KB gate); cross-agent notes added to leslie + mark.
