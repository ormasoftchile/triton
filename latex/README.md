# `@triton/latex` — Triton diagrams in LaTeX

Author Triton diagrams **inline in your `.tex` file** — write the diagram source
between `\begin{triton} … \end{triton}` and it renders to a **vector PDF** at
compile time, dropped in exactly like a `tikzpicture`. No pre-render step, no
figure files to manage.

```latex
\usepackage{triton}

\begin{triton}
flowchart LR
  A[Start] --> B{Choice}
  B -->|yes| C[Ship it]
  B -->|no|  D[Fix it]
  D --> E[Review]
\end{triton}
```

Compile with shell-escape:

```sh
tectonic -Z shell-escape -Z shell-escape-cwd=. mydoc.tex
pdflatex  -shell-escape mydoc.tex
lualatex  -shell-escape mydoc.tex
```

For environments where shell-escape is off (e.g. **Overleaf**), the same package
also supports a **precompile + `\includegraphics`** workflow — see
[Overleaf / no-shell-escape fallback](#overleaf--no-shell-escape-fallback).

## How inline rendering works

When LaTeX hits `\begin{triton}`, the package:

1. **Captures the body verbatim** (via `fancyvrb`'s `VerbatimOut`) to a temp file,
   `\jobname.triton-src.triton` — brackets, indentation and all.
2. **Content-hashes** that file with `\pdf@filemdfivesum` (from `pdftexcmds`).
3. **Shells out** (`\write18`) to the Triton CLI to render it to
   `\jobname.triton-cache/<hash>.pdf` — but only if that PDF doesn't already
   exist, so unchanged diagrams are **not** re-rendered on subsequent runs.
4. **`\includegraphics`** the resulting vector PDF.

The render is **pure-JS, no system binaries** (no Inkscape, `rsvg-convert`, or
Chromium). Text becomes real vector glyphs in the embedded base-14 fonts
(Helvetica/Times/Courier), so there is no font-drift between dev, CI, and the PDF.

If shell-escape is **off** or the CLI is **missing**, the environment fails with a
clear `\PackageError` telling you exactly what to fix — it never silently emits a
blank.

## Setup

```sh
cd latex
pnpm install            # pdfkit + svg-to-pdfkit (isolated from core triton)
node esbuild.mjs        # → dist/cli.cjs  (runs build:grammars first)
```

This builds the `triton-latex` CLI. Point the package at it once with
`\tritoncli` (or put `triton-latex` on `PATH` and skip this — it's the default):

```latex
\tritoncli{node /abs/path/to/latex/dist/cli.cjs}
```

## Per-diagram sizing

A verbatim environment **cannot** carry an inline optional argument — peeking for
a `[` on the `\begin{triton}` line tokenises the line break that `fancyvrb` needs
to find the end of that line, which swallows the diagram's first line. (`minted`
sidesteps this only because of its mandatory `{language}` argument.) So
`\begin{triton}[width=…]` is **not** supported.

Instead, set the `\includegraphics` options for the **next** diagram just before
it, or change the default globally:

```latex
\tritonnext{width=0.55\linewidth}   % applies to the NEXT \begin{triton} only
\begin{triton}
flowchart TD
  P[Parse] --> L[Layout] --> R[Render]
\end{triton}

\tritonsetup{width=0.8\linewidth}   % new global default for all later diagrams
```

## One-liners

For a single line of source, `\tritoninline` takes a verbatim argument delimited
by any character (here `|`) and an optional `\includegraphics` key list:

```latex
\tritoninline[width=3cm]|flowchart LR; A --> B|
```

## Macro reference

| Macro | Effect |
| --- | --- |
| `\begin{triton} … \end{triton}` | Inline authoring → render → include (needs shell-escape). |
| `\tritonnext{<opts>}` | `\includegraphics` options for the **next** inline diagram only. |
| `\tritoninline[<opts>]\|…\|` | One-line inline source (verbatim, any delimiter). |
| `\tritonsetup{<opts>}` | Default `\includegraphics` options (default `width=\linewidth`). |
| `\tritoncli{<cmd>}` | CLI invocation (default `triton-latex`). |
| `\tritontheme{<name>}` | Theme preset passed to the CLI for inline renders. |
| `\tritonscale{<n>}` | Scale passed to the CLI (default `1`). |
| `\tritoncachedir{<dir>}` | Render cache directory (default `\jobname.triton-cache`). |
| `\triton[<opts>]{<name>}` | **Precompile fallback:** `\includegraphics` of `<dir>/<name>.pdf`. |
| `\tritonfile[<opts>]{<name>}` | Explicit alias of the precompile include form. |
| `\tritonfig[<opts>]{<name>}{<caption>}` | Precompile include wrapped in a captioned `figure`. |
| `\tritondir{<path>}` | Directory holding precompiled `<name>.pdf` (default `triton-figures`). |

Depends only on `graphicx`, `fancyvrb`, and `pdftexcmds` — engine-agnostic
(pdfLaTeX / XeLaTeX / LuaLaTeX / tectonic).

## Example

[`examples/inline-demo.tex`](examples/inline-demo.tex) authors two diagrams inline
and renders them at compile time. From `examples/`:

```sh
tectonic -Z shell-escape -Z shell-escape-cwd=. inline-demo.tex
```

> **`triton.sty` discovery:** `tectonic` only searches the input file's own
> directory for local `.sty` files (it ignores `TEXINPUTS`). `examples/triton.sty`
> is therefore a symlink to `../triton.sty`. With a real package install (or
> `pdflatex`, which honours `TEXINPUTS`) the symlink is unnecessary.

## CLI

The same CLI powers both the inline environment and manual/precompile rendering:

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

## Overleaf / no-shell-escape fallback

Overleaf (and any compile with shell-escape disabled) can't run the CLI, so render
the diagrams to PDF **ahead of time** and include the committed assets:

```latex
\usepackage{triton}
\tritondir{figures}
\triton{flowchart}                       % \includegraphics figures/flowchart.pdf
\tritonfig[width=0.6\linewidth]{avl}{An AVL tree.}
```

```sh
cd examples
make figures     # render diagrams/ → figures/ (vector PDF)
make pdf         # compile demo.tex (tectonic or pdflatex)
```

Workflow:

1. Render locally: `make figures` (or `render-dir`).
2. Commit `figures/*.pdf`, `triton.sty`, and your `.tex`.
3. Upload to Overleaf — it compiles with no Node, no Triton, no shell-escape.

Regenerate the PDFs whenever a diagram source changes. Because the bare
`\triton{<name>}` command and the `triton` environment share a name, the package
dispatches on context (`\@currenvir`): `\begin{triton}` authors inline, while
`\triton{<name>}` includes a precompiled PDF.

## Why a separate package

This is an **isolated satellite package** (its own `node_modules`,
`pnpm-workspace.yaml`, and lockfile), exactly like `extension/`. The PDF toolchain
(`pdfkit`, `svg-to-pdfkit`) lives here and **only** here — the core `triton`
package gains **zero** new dependencies. The CLI imports the compiler by relative
path from `../src` and esbuild bundles it in.
