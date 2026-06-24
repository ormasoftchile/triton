# `@triton/latex` — Triton diagrams in LaTeX

Render Triton diagrams to **vector PDF** and include them in LaTeX with a single
macro. Works on pdfLaTeX, XeLaTeX, LuaLaTeX, and **Overleaf**.

```latex
\usepackage{triton}
\tritondir{figures}
\triton{flowchart}                 % \includegraphics the vector PDF by name
\tritonfig[width=0.6\linewidth]{avl}{An AVL tree.}
```

## Why a separate package

This is an **isolated satellite package** (its own `node_modules`,
`pnpm-workspace.yaml`, and lockfile), exactly like `extension/`. The PDF toolchain
(`pdfkit`, `svg-to-pdfkit`) lives here and **only** here — the core `triton`
package gains **zero** new dependencies. The CLI imports the compiler by relative
path from `../src` and esbuild bundles it in.

## The model: precompile + `\includegraphics`

LaTeX's `\includegraphics` cannot ingest SVG (only PDF/PNG/JPG). Triton emits SVG,
so this package converts it to a **vector PDF** ahead of time. You commit the PDFs;
the `.tex` includes them. Because the assets are committed, **Overleaf needs no
Node/Triton toolchain** — it just sees ordinary vector PDFs.

The conversion is **pure-JS, no system binaries** (no Inkscape, no `rsvg-convert`,
no Chromium). Text becomes real vector glyphs in the embedded base-14 fonts
(Helvetica/Times/Courier), so there is no font-drift between dev, CI, and Overleaf.

## Setup

```sh
cd latex
pnpm install            # pdfkit + svg-to-pdfkit (isolated from core triton)
node esbuild.mjs        # → dist/cli.cjs  (runs build:grammars first)
```

## CLI

```sh
# one file → vector PDF
node dist/cli.cjs render diagram.mmd -o figures/diagram.pdf

# one file → SVG pass-through (convenience)
node dist/cli.cjs render diagram.mmd -o diagram.svg

# whole directory of *.triton / *.mmd → <name>.pdf
node dist/cli.cjs render-dir diagrams/ -o figures/

# options
node dist/cli.cjs render diagram.mmd -o out.pdf --theme executive --scale 2
```

Installed as the `triton-latex` bin when the package is linked.

## The `triton.sty` package

| Macro | Effect |
| --- | --- |
| `\tritondir{<path>}` | Directory holding the rendered `<name>.pdf` (default `triton-figures`). |
| `\triton[<opts>]{<name>}` | `\includegraphics[<opts>]{<dir>/<name>.pdf}` (default `width=\linewidth`). |
| `\tritonfig[<opts>]{<name>}{<caption>}` | `\triton` wrapped in a captioned `figure`. |
| `\tritonsetup{<opts>}` | Change the default `\includegraphics` options globally. |

Only depends on `graphicx`, so it is engine-agnostic.

## Example

See [`examples/`](examples/): three sample sources in `examples/diagrams/`, their
committed vector PDFs in `examples/figures/`, and a `demo.tex` that compiles them.

```sh
cd examples
make figures     # render diagrams/ → figures/ (vector PDF)
make pdf         # compile demo.tex (tectonic or pdflatex)
```

## Overleaf workflow

1. Render locally: `make figures` (or `render-dir`).
2. Commit `figures/*.pdf`, `triton.sty`, and your `.tex`.
3. Upload to Overleaf — it compiles with no Node, no Triton, no shell-escape.

Regenerate the PDFs whenever a diagram source changes.
