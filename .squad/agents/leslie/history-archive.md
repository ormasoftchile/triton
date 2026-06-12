# Leslie History Archive — Through 2026-06-11

This archive contains Leslie's work from project initialization through Phase 1 completion. For current work, see history.md.

---

## Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings (Archived)

- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).
- 2026-06-09–10: LaTeX scaffold, 13 sections, two-wave execution (Wave 1 parallel sections, Wave 2 reconciliation).
- 2026-06-09–10: Central thesis established: Timeline Grammar (visual communication) NOT Task Scheduling Grammar (project management).
- 2026-06-09–10: Distribution architecture: core library → CLI, npm, MCP server, VS Code extension, Docker.
- 2026-06-10: Productization plan: TypeScript/Node core, 5-phase roadmap, three layout families (horizontal-swimlane, vertical-spine, serpentine), five showcase themes.
- 2026-06-10: Core API design: pure @timeline-compiler/core, sync compile, SVG-as-string, MCP/extension fit.
- 2026-06-10: Phase 0 scaffold: monorepo (pnpm), tsconfig, ESLint 9, prettier, vitest. All 22 tests passing.
- 2026-06-10: Phase 1 integration: API wired, golden harness (T2 fixture), CLI commands validated, 137 tests passing.
- TypeScript/Node ratified. Core API designed with SVG-as-string + synchronous compile for webview live preview.
- Scene/Render IR is key architectural abstraction — decouples layout from backends, enables per-backend testing.

---

## Milestone: Design Spec Complete (2026-06-10)

🎯 **13-Section Specification Published**

Design spec complete and organized in `design/` (LaTeX source).

- Sections: Problem (§1), Principles (§2), Scope (§3), IR (§4), Rendering (§5–7), Distribution (§8), Agent Integration (§9), Research (§10, §12), MVP (§11), Grammar (§13)
- Build: `cd design && make pdf` or `make watch`
- Archive: Decisions merged into `.squad/decisions.md` (24,782 bytes)

Two-wave execution efficient: parallel Wave 1 produced 6 sections; Wave 2 reconciliation resolved 6 gaps. All 17 IR invariants consistent.

---

## Milestone: Productization Plan (2026-06-10)

📋 **5-Phase Roadmap Delivered**

- TypeScript/Node recommended (MCP/agent/npm fit)
- MVP: Horizontal swimlane, Consulting theme, SVG+PNG, CLI, T2 acceptance fixture
- Phase 0–4 roadmap: foundations → MVP → themes → agents → art effects
- Three layout families mapped: horizontal-swimlane (T1/T2/T3/T5), vertical-spine (T1/T3/T5), serpentine (T4)
- Five showcase themes: our-timeline, subject-timeline, ai-timeline, serpentine, gitline

---

## Milestone: Phase 0 Scaffold (2026-06-10)

🏗️ **Monorepo Green**

```
packages/
  core/     — @timeline-compiler/core  (pure library)
  cli/      — @timeline-compiler/cli   (CLI)
  schema/   — @timeline-compiler/schema (JSON Schema)
pnpm, TypeScript 5.9.3, ESLint 9, prettier, vitest, zod
```

All 22 tests passing. Tool versions pinned. Verify commands all PASS.

---

## Milestone: Phase 1 Integration (2026-06-10)

🔗 **API Wired & Golden Harness Complete**

- API: loadIR, validate, render, compile, listThemes, getSchema, createSession
- CLI: validate (exit 0/1), render (SVG/PNG), schema, error diagnostics
- T2 Fixture: examples/our-timeline.timeline.yaml (consulting theme)
- Golden SVG + PNG committed as reference
- Golden harness: 10 tests covering validation, determinism, golden comparison

**Exit Criteria MET:** T2 renders byte-identical SVG+PNG via CLI with validate-before-render. 137 tests passing.

---

## Key References

- Design document: `design/main.tex` (13 sections, builds to PDF 2.6MB)
- Targets: `design/figures/targets/` (5 images: T1–T5)
- Corpus analysis: `design/figures/corpus/` (9 analyzed infographic patterns)
- Schema: `packages/schema/v1/timeline.json` (487 lines)
