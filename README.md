# Triton

Deterministic, contracts-first **diagram compiler** — turns declarative text into
byte-stable SVG (and PNG). Triton renders a broad family of diagrams behind a
single rendering kernel: a Mermaid-compatible surface plus Triton-only extensions
(posters/composition, cross-diagram links, timelines, and a CS-structures family).

The design spec lives in [`design/`](design/) (LaTeX source of truth for the IR
and rendering contracts).

## Layout

```
src/           — contracts, kernel (graph/scene/text/style), diagrams, renderer
test/          — vitest suites
examples/      — *.mmd sources + rendered *.svg
scripts/       — build-grammars.mjs (Peggy), preview.mjs
design/        — LaTeX design specification (figures rendered by Triton itself)
```

> Built as a contracts-first rewrite; earlier generations (`packages/` v1, `v2/`) were removed once superseded.

## Quick Start

```bash
# Prerequisites: Node >= 20, pnpm (via corepack)
corepack enable pnpm
pnpm install

# Generate parsers, type-check, and run the full test suite
pnpm typecheck
pnpm test
pnpm build
```

## What it renders

- **Mermaid-compatible**: flowchart, sequence, state, class, ER, gantt, journey,
  mindmap, gitgraph, pie, xychart, quadrant, radar, sankey, kanban, requirement,
  block, c4, architecture, packet, timeline.
- **Triton extensions**:
  - **poster** — compose child diagrams in a grid (with `[cols]` / `[cols x rows]`
    cell spanning) and **cross-diagram links** between panels.
  - **tree family** — `tree` plus value-driven `plan`, `avl`, `rbtree`, `btree`,
    `radix`, `segtree`, `heap` (structures are correct-by-construction).
  - **struct family** — `array`, `linkedlist`, `memory`, `page` (slotted page).
  - **topology** — cost-tiered node graphs with legends and nested groups (NUMA).

Each diagram kind has runnable examples under [`examples/`](examples/)
(`.mmd` source beside its rendered `.svg`).

## Development

All code is ESM-only, TypeScript-strict, targeting Node >= 20 (ES2022).
The architecture is contracts-first: every diagram implements a `DiagramModule`
(parse → IR → layout → `Scene`), and a single renderer turns a `Scene` into SVG.
