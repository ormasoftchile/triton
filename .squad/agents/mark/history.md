# Mark — IR & Schema Architecture

**Owner:** Mark (IR & Schema Lead)  
**Project:** timeline — deterministic diagram compiler  
**Created:** 2026-06-10  
**Updated:** 2026-06-14T19:30:00Z (Tier 3 long-tail complete — 21 Mermaid types total)

---

> **Active entries below. Archived detailed IR design decisions and schema reference in history-archive.md.**

---

## Pre-realignment summaries (2026-06-13 → 2026-06-17) — archived 2026-06-24 by Scribe

The detailed `packages/core`-era Scribe summaries (schema-validation hardening, composition CellContent ref/timeline extensions, the Mermaid-superset strategic pivot, Tier-0/1/2 kickoffs, theme-contract migration, and the dead-code audit) were moved to `history-archive.md` to keep this file under the size gate. ⚠️ That framing (5 families / 22 types, dual Mermaid-DSL+agent-IR, `ThemeContract`, Skia, god-chart-IR) is SUPERSEDED by the 2026-06-23 design-doc realignment — see the realignment block in `.squad/decisions.md` and the Learnings below.

---

- 2026-06-23: Audited my assigned design/ LaTeX sections vs shipped Triton (plan-only, no prose rewrite). Verdicts (KEEP/REWRITE/DELETE) recorded in the consolidated "DESIGN-DOC AUDIT (2026-06-23)" block in decisions.md.

- 2026-06-23: Wave 2 — executed the rewrites. Rewrote `10-scene-ir`, `27-tree-grammar`, `28-family-taxonomy`, `29-chart-family`; filled stubs `23-diagram-contract`, `31-structures-family`; light-aligned `17-superset-extensions`. Build gate `cd design && tectonic triton.tex` passes (PDF written). Key modeling facts now anchored in the doc:
  - **Scene is the single render contract** (`src/scene`): root = `{viewBox, background?, elements, defs}`; `SceneElement` union = rect/circle/path/text/group; animation is `march`/`particle` only on `ScenePath`; NO scene_hash/meta/canvas/effects/Image/MultiText. One `renderSVG`; resvg for PNG.
  - **DiagramModule** (sec:diagram-contract, `src/diagrams/<kind>`) is the per-kind contract: `parseMermaid`/`parseYaml` → Domain IR, async `layout` → `LayoutResult{scene,anchors,occupiedPorts}`, `defaultThemeOverride`. `detect()` → registry dispatch. Theme layering: `global ← defaultThemeOverride ← ir.themeOverride`.
  - **Tree** = flat decorated id-referenced `TreeDocument` + centered-parent tidy layout in `src/graph/tree.ts` (NOT Buchheim/Walker — dropped those cites). Semantic front-ends (avl/rbtree/btree/radix/segtree/heap/plan) are correct-by-construction lowerings into the same tree IR.
  - **Charts = FOUR separate sibling DiagramModules** (`src/diagrams/{pie,xychart,quadrant,radar}`), each with its own minimal Domain IR. Explicitly NOT a unified ChartDocument/ChartEncoding/FieldEncoding god-IR, NOT grammar-of-graphics, and they ARE built (removed "Not yet built" + Vega-Lite cites).
  - **Taxonomy** = ~35 realized DiagramKinds (~20 Mermaid-compatible + 4 net-new families: CS-structures/tree, struct/memory, topology, poster composition). Dropped "5 families / 22 types" framing and the stale `family-taxonomy` figure.
  - Cost/tier kernel lives in `src/style/cost.ts` and is specified once in Barbara's render-contract section (sec:render-contract); 31 cross-refs it rather than duplicating.
  - **Gotcha:** agent cast-names had leaked into published prose ("by Barbara", "Barbara's render contract") in `31-structures-family.tex` — removed both. Names are easter eggs; never let them appear in build output.
  - **Build gotcha:** `tectonic` panics inside the terminal sandbox (reqwest/system-configuration NULL object); must run unsandboxed. Final-pass undefined refs that remain (`sec:agent-integration`, `sec:graph-grammar`, `sec:ir`, `sec:outputs`, `sec:schema-fidelity`, `principle:minimal-clutter`, `sec:corpus-comparison-matrix`) are all in OTHER agents' sections — none originate from my 7 files.


## Learnings

- 2026-06-23 (Wave-4 light realign): Swept 04/13/20/21/25/26 + 30b path stragglers to the corrected thesis. Pattern for LIGHT consistency edits: keep correct concepts (the "two-IR-layer" = Domain IR→Scene IR and the god-IR rejection are BOTH already thesis-consistent — only renamed headings/captions, didn't gut the section), and surgically replace stale tokens — five-families/22-types → family-taxonomy + Triton-native families (no hard counts); multi-backend SVG/Skia/PPTX/PDF + svgBackend/pngBackend → single `renderSVG` + resvg PNG rasterization; `packages/core/src/grammars/*` → real `src/diagrams/<kind>/`, Scene at `src/contracts/scene.ts`, poster at `src/diagrams/poster/`; data-ingestion "source adapters (ADO/GitHub)" → direct YAML/agent authoring. Gate: `grep -ciE "undefined (reference|citation)|multiply.defined" triton.log` = 0; only hbox over/underfull typography warnings remain. PDF 1.29 MiB.

---

**Cross-agent note (Scribe, 2026-06-23):** A VS Code extension now consumes `render()` (which composes IR→Scene→SVG). IR/`DiagramKind` changes propagate to the extension preview and to its planned P3 completion (curated `DiagramKind → string[]` map). The 35-kind `DiagramKind` union in `src/contracts/diagram.ts` is now also an extension-facing surface.

**Cross-agent note (Scribe, 2026-06-24):** Barbara added 4 `DiagramKind`s — `queue`/`cqueue`/`deque`/`pqueue` (queue family) — to the union in `src/contracts/diagram.ts` (+`detect.ts` +`frontend/index.ts`). Hand-parsed, struct-style (no peggy), reuses `scene/strip`. Bumps the extension-facing kind count.

**Cross-agent note (Scribe, 2026-06-24):** CS data-structure families regrouped under **`src/diagrams/ds/`** (`struct`/`tree`/`queue` moved there; `topology` stays separate). Header keywords are UNCHANGED — folder-only move, `detect.ts` patterns untouched. **Taxonomy update for your sections:** 6 new `DiagramKind`s added under `ds/` — `stack`, `hashmap`, `matrix` (strip kernel), `trie`, `nodegraph`, `unionfind` (tree/graph kernels). ⚠️ The DS graph kind's keyword is **`nodegraph`** (alias `dsgraph`), **NOT `graph`** — Mermaid flowchart owns `graph` (`detect.ts` first pattern). `unionfind` also accepts `dsu`. `trie`/`unionfind` reuse the decorated-tree IR (`ds/tree/ir.ts`); `nodegraph` reuses `graph/layered.ts`. Kind count is now ~41; the family-taxonomy framing should fold these under the CS-structures family.
