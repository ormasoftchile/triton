# Publishing Triton

## Packages

| Package | npm | Install |
|---------|-----|---------|
| `@cristianormazabal/triton-core` | [npmjs.com/package/@cristianormazabal/triton-core](https://www.npmjs.com/package/@cristianormazabal/triton-core) | `npm i @cristianormazabal/triton-core` |
| `@cristianormazabal/triton-latex` | [npmjs.com/package/@cristianormazabal/triton-latex](https://www.npmjs.com/package/@cristianormazabal/triton-latex) | `npm i -g @cristianormazabal/triton-latex` |

---

## npm Publishing

### Prerequisites

- npm account: `cristianormazabal`
- Auth: passkey via NordPass (browser-based)
- Login: `npm login --auth-type=web`

### Build

```bash
cd /Volumes/Projects/triton

# Build core (esbuild bundle + declarations)
pnpm build:core

# Build latex CLI
pnpm build:latex
```

### Publish

```bash
# Core
cd packages/core
npm publish --auth-type=web

# LaTeX CLI
cd ../../latex
npm publish --auth-type=web
```

Both have `publishConfig.access: "public"` so no `--access public` flag needed after first publish.

### Version Bump

```bash
# In the package directory:
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.1 → 0.2.0
npm version major   # 0.2.0 → 1.0.0

# Then rebuild and publish
```

### Verify

```bash
npm view @cristianormazabal/triton-core
npm view @cristianormazabal/triton-latex
```

---

## @cristianormazabal/triton-core

### What it is

The Triton diagram compiler as a Node.js library. Parses Mermaid-compatible syntax (plus Triton extensions) and renders deterministic SVG.

### API

```typescript
import { renderSync } from '@cristianormazabal/triton-core';

const result = renderSync('flowchart LR\n  A --> B');
if (result.ok) {
  console.log(result.value); // <svg>...</svg>
} else {
  console.error(result.error.message);
}
```

#### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `renderSync` | `(input: string, theme?: ThemeInput) => Result<string>` | Parse + layout + render to SVG (sync) |
| `render` | `(input: string, theme?: ThemeInput) => Promise<Result<string>>` | Async wrapper |
| `compileSync` | `(input: string, theme?: ThemeInput) => Result<LayoutResult>` | Parse + layout without rendering |
| `compile` | `(input: string, theme?: ThemeInput) => Promise<Result<LayoutResult>>` | Async wrapper |

#### Result type

```typescript
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: string; message: string } };
```

#### Supported diagram types

flowchart, sequence, class, state, ER, C4, journey, gitgraph, gantt, pie, xychart, quadrant, radar, mindmap, sankey, requirement, kanban, block, packet, architecture, timeline, poster, tree, plan, avl, rbtree, btree, radix, segtree, heap, array, linkedlist, memory, page, queue, cqueue, deque, pqueue, stack, hashmap, matrix, trie, graph, topology, unionfind

---

## @cristianormazabal/triton-latex

### What it is

CLI tool + LaTeX package for rendering Triton diagrams inside LaTeX documents.

### Install

```bash
npm i -g @cristianormazabal/triton-latex
```

This gives you the `triton-latex` command and ships `triton.sty`.

### CLI Usage

```bash
# Single file → PDF
triton-latex render diagram.mmd -o figures/diagram.pdf

# Single file → SVG
triton-latex render diagram.mmd -o diagram.svg

# Batch render all diagrams in a directory
triton-latex render-dir diagrams/ -o figures/

# With options
triton-latex render diagram.mmd -o out.pdf --theme executive --scale 1.5
```

### LaTeX Setup

Copy `triton.sty` to your project (it ships inside the npm package at `node_modules/@cristianormazabal/triton-latex/triton.sty`), or symlink it:

```bash
# Find where it is
npm root -g
# e.g. /usr/local/lib/node_modules/@cristianormazabal/triton-latex/triton.sty

# Symlink into your LaTeX project
ln -s $(npm root -g)/@cristianormazabal/triton-latex/triton.sty .
```

### LaTeX Usage — Inline Authoring (primary workflow)

Requires `-shell-escape`. Diagrams are authored directly in `.tex` files:

```latex
\documentclass{article}
\usepackage{triton}
\begin{document}

\begin{triton}
flowchart LR
  A[Start] --> B{Choice}
  B -->|Yes| C[End]
  B -->|No| D[Loop]
\end{triton}

\end{document}
```

Compile with:
```bash
pdflatex -shell-escape file.tex
lualatex -shell-escape file.tex
tectonic -Z shell-escape -Z shell-escape-cwd=. file.tex
```

How it works: the environment captures the body verbatim, hashes it (MD5), shells out to `triton-latex render` to produce a cached PDF, then `\includegraphics` it. Unchanged diagrams are not re-rendered.

### LaTeX Usage — Precompiled (Overleaf / no shell-escape)

Pre-render diagrams to PDF, commit them, include by name:

```bash
# Pre-render
triton-latex render-dir diagrams/ -o figures/
```

```latex
\usepackage{triton}
\tritondir{figures}

\triton{flowchart}                         % includes figures/flowchart.pdf
\triton[width=0.6\linewidth]{avl}          % with sizing
\tritonfig{sequence}{My sequence diagram}  % in a figure environment with caption
```

### LaTeX Macro Reference

| Macro | Description |
|-------|-------------|
| `\begin{triton}…\end{triton}` | Inline diagram (shell-escape required) |
| `\tritoninline\|source\|` | One-line inline source |
| `\triton[opts]{name}` | Include precompiled `<dir>/name.pdf` |
| `\tritonfile[opts]{name}` | Explicit alias of the include form |
| `\tritonfig[opts]{name}{caption}` | Precompiled include in a `figure` float |
| `\tritonnext{opts}` | `\includegraphics` options for next inline diagram only |
| `\tritonsetup{opts}` | Default `\includegraphics` options (default: `width=\linewidth`) |
| `\tritondir{path}` | Directory for precompiled PDFs (default: `triton-figures`) |
| `\tritoncli{cmd}` | CLI command (default: `triton-latex`) |
| `\tritontheme{name}` | Theme preset for inline renders |
| `\tritonscale{n}` | Scale factor (default: 1) |
| `\tritoncachedir{dir}` | Cache directory (default: `\jobname.triton-cache`) |

### Themes

Available presets: `default`, `executive`, `minimal`

```latex
\tritontheme{executive}  % applies to all subsequent inline diagrams
```

Or per-render via CLI:
```bash
triton-latex render diagram.mmd -o out.pdf --theme executive
```

---

## CTAN Submission (future)

To make `triton.sty` installable via `tlmgr install triton`:

1. Write a standalone user manual PDF (from a `.dtx` or standalone `.tex`)
2. Package: `triton.sty` + `triton.pdf` (manual) + `README`
3. License: LPPL 1.3c (standard for LaTeX packages)
4. Submit at https://ctan.org/upload
5. Enters TeX Live in the next release cycle (~yearly, with tlcontrib faster)

The `triton.sty` is already feature-complete for CTAN — it just needs the documentation PDF and LPPL header.
