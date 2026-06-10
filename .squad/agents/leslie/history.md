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
