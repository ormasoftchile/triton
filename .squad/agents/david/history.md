# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings — Earlier research (summarized 2026-06-23 by Scribe)

Full prior-art / research detail moved to `history-archive.md`. ⚠️ Much of it served the SUPERSEDED timeline-compiler thesis (PPTX/Skia/multi-backend, NL-prompt + data ingestion, agent/MCP IR, published JSON-Schema/constrained decoding, "five families / 22 types", "Timeline Compiler" branding) and was purged from the design doc in the 2026-06-23 realignment. Keep as historical context only.

- **Build-vs-adopt survey:** no existing format adoptable wholesale; bespoke IR borrowing vocabulary from ISO 8601 / iCalendar / OWL-Time / Vega-Lite / Pandoc (timeline-era framing).
- **Prior-art landscape:** three clusters (diagram-as-code / visualization grammars / proprietary presentation). The "unoccupied cell" argument is now reframed as **Mermaid superset + byte-stable determinism + composable posters + net-new families** (CS-structures, struct/memory, topology).
- **LLM-DSL finding** (small TOTAL grammar = reliable generation) still valid — it underpins the no-god-IR policy (each Domain IR stays tight; charts are 4 sibling IRs, not one grammar-of-graphics).
- **references.bib conventions:** David is sole bib writer; `<tool><year>` keys; grep-before-delete (orphan entries are harmless; removing a still-cited key breaks the build). Header now "Triton Project Bibliography".

- 2026-06-23: Audited my assigned design/ LaTeX sections vs shipped Triton (plan-only, no prose rewrite). Verdicts (KEEP/REWRITE/DELETE) recorded in the consolidated "DESIGN-DOC AUDIT (2026-06-23)" block in decisions.md.

### 2026-06-23 — Wave-2 realign: positioning/strategy sections + bib prune (branch docs/realign-spec)

**What I rewrote (all compile clean; zero undefined cites/refs in my sections):**
- `05-comparison.tex` — repositioned on the REAL axes: zero-migration Mermaid superset, byte-stable determinism, composable cross-linked posters, net-new families (CS-structures/struct-memory/topology). Dropped the "Agent IR / structured-IR" axis and the UML "Tier-1 priority" framing. Kept vs PlantUML/D2/Vega-Lite.
- `16-mermaid-compat.tex` — grounded in `src/frontend/detect.ts`: 21 recognised Mermaid headers (table) + 14 Triton-only superset headers (poster + tree-family + struct-family + topology) → ~35 registered kinds. Dropped the stale "Status: Planned"/tier table. YAML = alt input syntax, not an agent API.
- `51-distribution.tex` — single package `triton` at repo root (ESM, TS-strict, Node≥20, pnpm, build=build:grammars(Peggy)+tsc, vitest 318 tests, SVG truth + resvg PNG). Three entry points: library API / CLI / VS Code preview (scripts/preview.mjs). Explicit NOT list: no monorepo, no MCP/agent server, no PPTX/PDF/HTML, no Go/Rust/Python.
- `53-oss-strategy.tex` — kept OSS-viability + Mermaid-gravity-well argument; replaced timeline-compiler/PPTX/agent-IR moats with superset+determinism+posters+net-new-families. Adopters reframed: dev-rel, engineering teams (topology), educators/authors (correct-by-construction CS-structures).

**references.bib prune (header → "Triton Project Bibliography"):**
- Method: grep every `\cite` key across `design/sections` AFTER my rewrites; only removed keys with ZERO surviving citations.
- Removed 14: ado-workitems, github-projects, github-graphql-projectv2, frappegantt, msproject, mcp-spec, python-pptx, slidev, obsidian, thinkcellgantt, thinkcell-charts, powerpoint-timeline, json-schema2020, timelinejs-github (+ their now-empty section comment headers for ingestion & presentation-idioms).
- KEPT (still cited by surviving non-mine sections — do NOT remove): `timelinejs`/`vistimeline` (§21 Mark), `thinkcell` (§12 Barbara), `openai-structured-outputs` (§20 Mark), `msprojectxml` (§21 Mark). Kept `plotlyjs` per audit core-keep list even though now orphaned (orphan bib entries are harmless — biber just omits them).

**Lessons:**
- `tectonic --print` shows FIRST-pass undefined cite/ref warnings before convergence — misleading. Authoritative check = full build then grep `triton.log` for "Citation/Reference ... undefined" (final pass). My sections: 0 undefined.
- An orphaned BibTeX entry causes NO build error, so the bib-prune risk is one-directional: only removing a still-cited key breaks the build. Always grep-before-delete; never delete a key cited by another agent's surviving section.
- Remaining undefined refs in the log (`sec:agent-integration` ×4 in §30b, etc.) are OTHER agents' repoint tasks (Barbara owns 30b per the Wave-2 plan) — not mine to touch.
