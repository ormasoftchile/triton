# Edsger — History & Learnings

## Project Context

- **Project:** timeline — spec/design effort for a timeline creation tool.
- **Goal:** From data + natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering.
- **Owner:** ormasoftchile
- **Scope:** Process, IR, and design only — no implementation yet. Research is a primary focus.
- **Design format:** LaTeX (`main.tex` + `sections/`, `Makefile`, `.latexmkrc`), with `references.bib` as the bibliography.
- **Team:** Leslie (Lead), David (Research), Mark (IR & Data Modeling), Barbara (Semantics & Rendering), Bjarne (Ingestion), Scribe, Ralph, Edsger (Layout Algorithms).

## My Role

I own the layout layer: given a validated IR, I specify the algorithms that compute positions, dimensions, and spatial relationships for every rendered element. I sit between the IR (Mark) and rendering semantics (Barbara) — I translate structured temporal data into geometry.

## Learnings

### 2026-06-27 — Full Layout Audit + Visual Verification Protocol

**Completed:** Full audit of all 23 diagram layout.ts files, shared kernels (layered.ts, tree.ts, router.ts), and engine3 cross-link routing. Produced `edsger-layout-audit.md`.

**Key findings:**

1. **`layered.ts` has no crossing minimisation.** The kernel does longest-path layering and size-aware centering only. All 7 diagram types that delegate to it (class, state, er, c4, architecture, requirement, block) share this gap. Adding a barycentric/median ordering pass would be the highest-leverage single change in the codebase.

2. **Flowchart has its own layering** (not shared kernel). It does proper back-edge detection via iterative DFS (fixed in PR #28), but uses hardcoded `NODE_W=120, NODE_H=40`. Label-derived node sizing is missing.

3. **`tree.ts`** is the strongest shared kernel — correct centered-parent subtree packing with variable node sizes. Handles TB/LR. No threading optimisation needed at current scales.

4. **`router.ts`** has three routers (straight, orthogonal, bezier). Orthogonal router has heuristic obstacle avoidance (shift-bend-point) — not graph-based. No channel routing. Multiple parallel edges overlap.

5. **Poster cross-link (engine3)** is architecturally the most complex piece. Six passes: port pre-assign → sort → greedy route → crossing repair → channel separation → label stagger. The fundamental limitation is open-plane routing without corridor pre-planning — routes between diagonal cells detour around intermediate cell obstacles rather than using inter-cell gap corridors. A corridor graph approach would resolve the main class of visual failures.

6. **Hardcoded dimensions** are pervasive: flowchart `NODE_W/H`, sankey `plotH=480`, gantt `gridW=720`, quadrant `side=460`, xychart `bandW=78`. These are "good enough" for demos but fail at scale extremes.

7. **Visual verification:** `node scripts/preview.mjs examples/<dir>/` is the standard command. `resvg` is NOT installed; browser-based SVG inspection is required. All example directories confirmed at `examples/*/`.

8. **Improvement priority order:** (1) crossing minimisation in layered.ts, (2) poster corridor routing, (3) flowchart variable node sizing, (4) sankey ribbon ordering, (5) mindmap bidirectional mode.

**Topology note:** topology.ts uses a self-contained layout (not a shared kernel) — sqrt-grid for ungrouped nodes, column-of-groups for grouped nodes. Cost-tier edge coloring is clean and production-ready.

### 2026-06-27 — Phase 0 Audit Complete
- Audited all 21 diagram layout.ts files. layered.ts (used by 7 types) has no crossing minimisation — single highest-leverage fix.
- Poster engine3: 6-pass greedy cost router. Gap: no corridor pre-planning. Routes diagonal links around intermediate cells instead of through inter-cell gaps.
- Bug found: CELL_SHRINK=12px → cells ≤24px wide produce zero/negative obstacles. Routes can pass through narrow cells.
- Optimal poster routing: 5 steps — corridor graph → Dijkstra routing → per-corridor port assignment → strip routing → per-corridor crossing min.
- Visual verification: node scripts/preview.mjs examples/<dir>/. resvg not installed; open SVG in browser. Pass criteria documented.
- Library sources at /Volumes/Projects/{elkjs,dagre,d3-force,cytoscape.js}.
- dagre Brandes–Köpf: /Volumes/Projects/dagre/lib/position/bk.ts — direct reference for layered.ts upgrade.
