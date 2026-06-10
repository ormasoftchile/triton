# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).
- 2026-06-09: Built LaTeX scaffold under design/: main.tex inputs 13 sections, MastersThesis.cls provides professional styling, Makefile supports pdf/clean/watch targets, .latexmkrc configures biber.
- 2026-06-09: Authored sections 01-problem, 02-principles, 03-scope, 08-distribution, 11-mvp, 13-grammar-abstraction.
- 2026-06-09: Central thesis established: Timeline Grammar (visual communication) over Task Scheduling Grammar (project management). This frames the entire specification.
- 2026-06-09: Distribution architecture: core library → multiple distribution targets (CLI, npm, MCP server, VS Code extension, Docker).
- 2026-06-09: Scope boundaries explicitly exclude dependency scheduling, resource management, critical path, sprint tracking, cost management — all are project-management concerns, not rendering concerns.
- 2026-06-09: IR elements defined in scope: tracks, groups, activities, milestones, sections, date ranges, progress, status, labels, annotations, legends.
- 2026-06-09: Citation \cite{mermaid2023} used — already in references.bib.

## 2026-06-10 — Team Update: Design Spec Complete

🎯 **Design Specification Published**

The 13-section Timeline Compiler design spec is now complete and organized:

- **Location:** `design/` directory (LaTeX source)
- **Sections:** Problem (§1), Principles (§2), Scope (§3), IR (§4), Rendering (§5–7), Distribution (§8), Agent Integration (§9), Research (§10, §12), MVP (§11), Grammar (§13)
- **Build:** `cd design && make pdf` or `make watch`
- **Archive:** Decisions merged into `.squad/decisions.md` (24,782 bytes; see `.squad/log/2026-06-10T02-27-43Z-timeline-compiler-design.md`)

Two-wave execution proved efficient: parallel Wave 1 produced 6 independent sections; Wave 2 reconciliation by Mark resolved 6 gaps without redesign. All 17 IR invariants now consistent across Rendering, Agent Integration, and IR spec.

**Next:** Coordinator will compile PDF and commit.

## 2026-06-10 — Productization Plan Delivered

📋 **Comprehensive Productization Roadmap**

Created a full productization plan translating the design spec into an actionable implementation roadmap:

- **Key Decision:** Recommended TypeScript/Node as core language (best MCP/agent/npm ecosystem fit; owner is fluent). Go remains viable alternative if owner prefers simpler art-effects scope.
- **MVP Definition:** Horizontal swimlane layout, Consulting theme (Tier 1), SVG+PNG output, CLI with render/validate. Target T2 as acceptance fixture.
- **5-Phase Roadmap:** Phase 0 (foundations) → Phase 1 (MVP) → Phase 2 (themes+polish) → Phase 3 (agents+ingesters) → Phase 4 (art effects+PPTX)
- **Python Isolation:** python-pptx deferred and isolated as optional subprocess; evaluate pptxgenjs as non-Python alternative
- **Target Mapping:** T2 at Phase 1; T1/T3 at Phase 3; T4/T5 at Phase 4 (require serpentine layout + Tier 3 effects)
- **Conformance Strategy:** Golden-image suite using §14 worked IR fixtures as acceptance tests

## Learnings

- The five target images (§14) map to three distinct layout families: horizontal-swimlane (T2/default), vertical-spine (T1/T3/T5), serpentine (T4). Only horizontal-swimlane is covered by the current §5 pipeline.
- Rendering library ecosystem is fragmented: resvg/usvg (Rust), Skia (C++), python-pptx (Python), Canvas (JS). TypeScript + WASM bindings is the pragmatic integration point.
- The Scene/Render IR (§7) is the key architectural abstraction — it decouples layout from backends and enables per-backend golden-image testing.
- Owner's Go fluency + Python aversion are hard constraints that shaped the language recommendation.

## 2026-06-10 — TypeScript Core API & Phase 0/1 Design

📐 **Core API Design & Implementation Plan Delivered**

**Ratified Decision: TypeScript/Node Core**
- Owner excluded Python from core (PPTX via pptxgenjs, not python-pptx)
- VS Code extension must call core IN-PROCESS (no subprocess/IPC/WASM bridge) — "transparency contract"
- MCP/agent + npm ecosystem fit

**Package Architecture:**
- `@timeline-compiler/core` — pure library, webview/worker-safe (no Node-only deps in hot path)
- `@timeline-compiler/cli`, `@timeline-compiler/mcp`, `@timeline-compiler/schema`
- Future VS Code extension imports core directly

**API Design Highlights:**
- SVG output as string (extension drops into webview with zero serialization)
- Synchronous `compile(ir, options)` for live preview on keystroke
- Diagnostics shape matches `vscode.Diagnostic` directly
- Same API backs CLI + MCP + extension

**Phase 0 (Foundations):**
- pnpm monorepo with packages/core, cli, schema
- TypeScript/ESLint/Prettier/Vitest config
- JSON Schema (zod + zod-to-json-schema recommended)
- CI on macOS+Linux
- Empty public-API stubs as contract

**Phase 1 (MVP Core):**
- IR loader, 5-layer validator (17 invariants)
- 6-phase layout engine for horizontal swimlane
- SVG backend (deterministic), PNG backend (resvg-js WASM)
- Consulting theme (Tier 1), CLI commands
- Golden-image harness with T2 as acceptance fixture

**v0.1.0 Definition of Done:**
- T2 reproducible (byte-identical SVG+PNG)
- Schema published, CLI validate/render, 1 theme

## Learnings

- TypeScript/Node ratified as core language: Python-avoidance + transparent in-process VS Code extension + MCP/npm fit.
- Core API designed with SVG-as-string + synchronous compile path for webview live preview.
- Package boundary: `@timeline-compiler/core` must be pure (no Node-only deps) to enable future webview/worker execution.
- zod recommended for schema: single source of truth for TS types + JSON Schema generation + runtime validation.
- Extension transparency contract: never spawn process; diagnostics map 1:1 to vscode.Diagnostic.
