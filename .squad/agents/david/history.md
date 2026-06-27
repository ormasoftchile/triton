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

### 2026-06-24 — LaTeX integration research (Phase 1, RESEARCH-only) → latex/RESEARCH.md

**Task:** options analysis for authoring/embedding Triton diagrams in LaTeX, optimized for ubiquity (pdf/Xe/LuaLaTeX × macOS/Linux/Windows/Overleaf). No .sty/.tex/build glue built.

**Core format gap (SVG→PDF):** Triton's public API (`renderSync` → `renderSVG`) emits an **SVG string**; `\includegraphics` accepts **PDF/PNG/JPG, never SVG** on any engine. So every path is "how does SVG become a PDF/PNG LaTeX can include." Triton already ships the PNG half: `@resvg/resvg-js` (devDep) in `design/figures/render.mjs` → and `\ourfig` already does precompile + `\includegraphics{figures/<name>.png}` — i.e. approach (A) applied to the spec itself. SVG→PDF converter candidates: `rsvg-convert` (librsvg, fast, not on Overleaf), `inkscape --export-type=pdf` (what the `svg` pkg uses; heavy/slow; text→path avoids font drift), `cairosvg`, in-process JS (`svg2pdf.js` — partial fidelity, risky), or a **native Triton Scene→PDF backend** (Scene is only 5 element types → tractable; zero external binary, no font drift). Font drift is the cross-cutting risk for every name-based-font converter (resvg/rsvg/cairo).

**CLI:** **NONE exists** — `package.json` has no `bin`, no `main`/`exports`; only dev scripts (build/test/preview/figures) + the library API. Any integration requires adding a `triton render in.triton -o out.{svg,pdf,png}` CLI first — keystone prerequisite.

**Candidate approaches:** (A) precompile + `\includegraphics` via `\triton{name}` — portable, Overleaf-friendly when assets committed, mirrors existing `pnpm figures`/`\ourfig`; (B) inline shell-escape `triton.sty` (minted-style, hash cache) — best ergonomics, needs `--shell-escape`+Node, ❌ Overleaf; (C) `svg` pkg/`\includesvg` via Inkscape — reuses mature pkg but heavy per-machine dep.

**Recommendation headline:** **(A) Precompile + `\includegraphics`, PNG-via-resvg default (zero deps, ✅ everywhere incl. Overleaf), vector PDF (rsvg-convert) opt-in, native Triton PDF backend as Phase-3 endgame; add a CLI now.** Folder: `latex/{RESEARCH.md,README.md,triton.sty,bin/,examples/,Makefile}`. Phase 2 adds the `design/sections/` "LaTeX integration" section (currently ends at 08-status) — noted, not written.

**Lessons:** the ubiquity matrix collapses to one fact — only *precompiled, committed* assets are ✅ on Overleaf, and PNG-via-resvg / a native PDF backend need *no LaTeX-side dependency at all*. Ubiquity ⇒ approach A + committed asset. The engine axis (pdf/Xe/Lua) barely matters because by `\includegraphics` time it's already a PDF/PNG.

### 2026-06-27 — Layout Algorithm Research (Phase 0 of Layout Improvement Initiative)

**Task:** Produce a thorough catalog of layout and routing algorithms for the Layout Algorithm Improvement Initiative, covering ELK.js, dagre, d3 layout modules, academic foundations, routing algorithms, and an applicability matrix for all Triton diagram types.

**Deliverable:** `.squad/decisions/inbox/david-layout-research.md`

**Key findings from direct code reading of `src/`:**

- **`src/graph/layered.ts`** is the shared layout kernel used by class, state, ER, C4, architecture, and requirement diagrams. It implements only: (1) longest-path ranking (Bellman-Ford relaxation with cycle cap), (2) centered coordinate assignment. **No crossing minimization. No Brandes–Köpf.** This is a "Sugiyama-lite" that omits phases 3 and 4.
- **Flowchart** (`src/diagrams/flowchart/layout.ts`) uses its own `assignLayers` + centering — same deficiency, separate code. It does not use `layeredLayout`.
- Diagrams with **correct, optimal layouts** for their types: sequence, gantt, timeline, gitgraph, sankey, kanban, journey, pie, radar, quadrant, xychart (all custom arithmetic/lane layouts — no graph algorithm needed).
- Mindmap and tree use custom post-order centering that approximates (but is not) the full Buchheim–Jünger–Leipert O(n) algorithm.
- ER is using a **directed** layered algorithm but should use an **undirected** stress/force approach (ELK `stress` or Kamada–Kawai).

**Library findings:**

- **ELK.js**: 9 algorithms. Flagship is `layered` (full 5-phase Sugiyama + ports + compound graphs + orthogonal routing). API: `elk.layout(graph)` returns a Promise of the mutated JSON graph with `x`/`y` on each node and `sections[].bendPoints` on each edge. ~500 KB bundle.
- **Dagre**: 4-phase Sugiyama; barycenter crossing min (not median, not ILP); Brandes–Köpf coordinate assignment (`lib/position/bk.js`); polyline edge routing only (no orthogonal). Largely abandoned (2020). d3-dag provides a drop-in shim.
- **d3-dag** (erikbrinkman): TypeScript-first; ILP-optimal crossing minimization (`decrossOpt`); `coordQuad` quadratic coordinate assignment; Zherebko and Grid layouts not available elsewhere; `~50×` smaller than elkjs. Drop-in dagre replacement.
- **d3-hierarchy**: 5 layouts; `tree()` uses Buchheim O(n) tidy tree; `cluster()` is tidy with uniform leaf depth; `treemap()` uses squarify; `pack()` greedy circle packing.
- **d3-force**: physics simulation; non-deterministic by default (random init); Barnes-Hut N-body. Unsuitable for byte-stable rendering.

**Algorithm recommendations per diagram type** (full table in research report):

- Flowchart / class / state / C4 / requirement: → full Sugiyama (d3-dag `sugiyama()` medium quality preset or ELK `layered`)
- ER: → ELK `stress` (Kamada–Kawai geodesic distance preservation) or ELK `layered` if hierarchy present
- Architecture: → ELK `layered` with compound-graph groups
- Mindmap / tree: → d3-hierarchy `tree()` (Buchheim O(n))
- Poster cross-links: → ELK `box` + orthogonal routing with channel allocation
- All chart types (gantt, pie, radar, etc.): → keep custom arithmetic layouts

**BibTeX keys added to research report** (not yet in `design/triton.bib` — awaiting Scribe/LaTeX agent integration):
`sugiyama1981`, `gansner1993`, `reingold1981`, `buchheim2002`, `brandeskoepf2002`, `kamada1989`, `tamassia1987`, `froehlich1997`, `elkjs2024`, `dagre2020`, `d3hierarchy2024`, `d3dag2024`, `d3force2024`

**Naming convention note:** Leslie's phase plan references `Schulze 2017 (ELK layered)` — this is the ELK layered algorithm's paper by Schulze & Rüegg; I was unable to locate the precise citation during this research session. Recommend a follow-up search for `Schulze Rüegg 2017 ELK layered` to complete the bib.

**Lessons:**
- The biggest layout gap in Triton is the **missing crossing minimization phase** — the shared `layeredLayout` kernel was clearly built as a placeholder. Adding barycenter sweeps + Brandes–Köpf is Phase 1 of the improvement initiative.
- d3-dag is the pragmatic upgrade for the JS/TS world: smaller bundle than elkjs, TypeScript-native, ILP crossing min available, dagre API compatible.
- ELK.js is the right choice if Triton needs compound graph layout (groups in architecture diagrams) or orthogonal edge routing with port awareness.
