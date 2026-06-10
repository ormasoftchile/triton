# Timeline Compiler

Deterministic timeline renderer — produces byte-stable SVG, PNG, and PPTX from a
declarative YAML/JSON IR. This repository is the implementation of the design spec
in [`design/main.pdf`](design/main.pdf).

## Quick Start

```bash
# Prerequisites: Node ≥ 20, pnpm (enabled via corepack or npm i -g pnpm)

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run all tests
pnpm test

# Type-check without emitting
pnpm typecheck

# Lint
pnpm lint
```

## CLI Usage

```bash
# After build:
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js --version

# Render a timeline file
node packages/cli/dist/index.js render path/to/timeline.yaml -o out.svg

# Validate a timeline file
node packages/cli/dist/index.js validate path/to/timeline.yaml

# Print the JSON Schema
node packages/cli/dist/index.js schema
```

## Repository Layout

```
packages/
  core/       — @timeline-compiler/core  — pure library, public API types + stubs
  cli/        — @timeline-compiler/cli   — commander-based CLI
  schema/     — @timeline-compiler/schema — versioned JSON Schema artefacts
design/       — LaTeX design specification (source of truth for IR contract)
.squad/       — Team agent state
```

## Status

**Phase 0 — Scaffold & Tooling** ✅  
Core API stubs, Zod schema, CLI skeleton, and CI wired up. Phase 1 will implement
the layout/validation/rendering pipeline.

## Development

The public API contract lives in [`packages/core/src/types.ts`](packages/core/src/types.ts)
and [`packages/core/src/api.ts`](packages/core/src/api.ts). All packages are ESM-only,
TypeScript-strict, and target Node ≥ 20 (ES2022).
