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

- 2026-07-06 (Group C diagram-options fragments): Catalogued grammar-derived options for pie, xychart, quadrant, radar, sankey, mindmap. Per-family `%%` support findings:
  - **pie** — `grep -c '%%' grammar.peggy` = 0. No `%%` Comment rule. No header added. Fallback note added to fragment. Fragment: `docs/diagram-options/_fragments/pie.md`.
  - **xychart** — `grep -c '%%' grammar.peggy` = 0. No `%%` Comment rule. No header added. Fallback note added. Fragment: `docs/diagram-options/_fragments/xychart.md`.
  - **quadrant** — `grep -c '%%' grammar.peggy` = 0. No `%%` Comment rule. No header added. Fallback note added. Fragment: `docs/diagram-options/_fragments/quadrant.md`.
  - **radar** — `grep -c '%%' grammar.peggy` = 0. No `%%` Comment rule. No header added. Fallback note added. Fragment: `docs/diagram-options/_fragments/radar.md`.
  - **sankey** — `grep -c '%%' grammar.peggy` = 2. `%%` supported via `Comment = _ "%%" $[^\n]* (…)` rule. Header block added to `examples/mermaid/sankey/sankey.mmd`. `node scripts/preview.mjs examples/mermaid/sankey/` → exit 0, `sankey.svg` regenerated. Fragment: `docs/diagram-options/_fragments/sankey.md`.
  - **mindmap** — `grep -c '%%' grammar.peggy` = 0. No `%%` Comment rule. Grammar returns raw indented lines; shape stripping (`((…))`, `(…)`, `[…]`, `{{…}}`) happens in `index.ts:cleanLabel`. `::icon(name)` directive attaches icon to preceding node (index.ts). Frontmatter rule present in grammar. No header added. Fallback note added. Fragment: `docs/diagram-options/_fragments/mindmap.md`.
  - Key invariant: mindmap grammar captures raw content only — shape semantics are in `index.ts`, not grammar.peggy. Listing them is valid per the spec ("grammar.peggy AND index.ts if hand-parsed").

- 2026-06-23 (Wave-4 light realign): Swept 04/13/20/21/25/26 + 30b path stragglers to the corrected thesis. Pattern for LIGHT consistency edits: keep correct concepts (the "two-IR-layer" = Domain IR→Scene IR and the god-IR rejection are BOTH already thesis-consistent — only renamed headings/captions, didn't gut the section), and surgically replace stale tokens — five-families/22-types → family-taxonomy + Triton-native families (no hard counts); multi-backend SVG/Skia/PPTX/PDF + svgBackend/pngBackend → single `renderSVG` + resvg PNG rasterization; `packages/core/src/grammars/*` → real `src/diagrams/<kind>/`, Scene at `src/contracts/scene.ts`, poster at `src/diagrams/poster/`; data-ingestion "source adapters (ADO/GitHub)" → direct YAML/agent authoring. Gate: `grep -ciE "undefined (reference|citation)|multiply.defined" triton.log` = 0; only hbox over/underfull typography warnings remain. PDF 1.29 MiB.

---

**Cross-agent note (Scribe, 2026-06-23):** A VS Code extension now consumes `render()` (which composes IR→Scene→SVG). IR/`DiagramKind` changes propagate to the extension preview and to its planned P3 completion (curated `DiagramKind → string[]` map). The 35-kind `DiagramKind` union in `src/contracts/diagram.ts` is now also an extension-facing surface.

**Cross-agent note (Scribe, 2026-06-24):** A new ISOLATED `latex/` package (`@triton/latex`) renders diagrams to **vector PDF** for LaTeX `\includegraphics` via a `triton-latex` CLI reusing core `renderSync()` → SVG → pure-JS `pdfkit`+`svg-to-pdfkit` (no system binaries). Schema/IR consequence: the **Scene element set** (`rect/circle/path/text/group` + `defs` markers) and the `renderSync()` `Result<string>` SVG contract are now ALSO consumed by the LaTeX PDF backend — any change to the Scene union or the render signature must keep `latex/src/{cli,pdf}.ts` in sync. Hard constraint: **core gains ZERO new deps** (PDF deps isolated in `latex/`; root package/workspace/tsconfig diffs EMPTY). Merged as PR #24.

**Cross-agent note (Scribe, 2026-06-24):** Barbara added 4 `DiagramKind`s — `queue`/`cqueue`/`deque`/`pqueue` (queue family) — to the union in `src/contracts/diagram.ts` (+`detect.ts` +`frontend/index.ts`). Hand-parsed, struct-style (no peggy), reuses `scene/strip`. Bumps the extension-facing kind count.

**Cross-agent note (Scribe, 2026-06-24):** CS data-structure families regrouped under **`src/diagrams/ds/`** (`struct`/`tree`/`queue` moved there; `topology` stays separate). Header keywords are UNCHANGED — folder-only move, `detect.ts` patterns untouched. **Taxonomy update for your sections:** 6 new `DiagramKind`s added under `ds/` — `stack`, `hashmap`, `matrix` (strip kernel), `trie`, `nodegraph`, `unionfind` (tree/graph kernels). ⚠️ The DS graph kind's keyword is **`nodegraph`** (alias `dsgraph`), **NOT `graph`** — Mermaid flowchart owns `graph` (`detect.ts` first pattern). `unionfind` also accepts `dsu`. `trie`/`unionfind` reuse the decorated-tree IR (`ds/tree/ir.ts`); `nodegraph` reuses `graph/layered.ts`. Kind count is now ~41; the family-taxonomy framing should fold these under the CS-structures family.

**Cross-agent note (Scribe, 2026-06-24):** CORE LAYOUT FIX (PR #28) — flowchart `assignLayers()` in `src/diagrams/flowchart/layout.ts` looped forever when a ROOT fed a cycle (longest-path BFS re-pushed ever-growing layers). Fixed with Sugiyama cycle breaking: new `findBackEdges()` DFS strips back-edges to a DAG before the SAME BFS; back-edges still drawn; acyclic output byte-identical. Relevant to the flow-grammar/layout sections (`25-flow*`): the flowchart layering is now provably terminating on ANY graph (cyclic included), deterministic. Flowchart has its OWN layering — it does NOT use `src/graph/layered.ts`. Regression test `test/flowchart-cycle.test.ts`; tests 378 → 385.

## 2026-07-06 — Diagram Options Reference (Team Delivery)

**Scribe note:** Diagram-options feature completed. All 45 fragments assembled into central reference; 4 families have inline `%%` headers in examples (flowchart/9, sankey/1, timeline/9, poster/7); pnpm test: 384 pass.

## 2026-07-07 — Central %% comment stripping (PR gate)

- **`stripComments` lives in:** `src/frontend/preprocess.ts` (exported for testing).
- **Exact semantics:**
  1. Full-line only: a line is a comment iff its first non-whitespace chars are `%%`. Matched by `/^\s*%%/`. Comment lines are **removed entirely** (not blanked) — safe because every grammar/hand-parser already handles blank/empty lines.
  2. Inline trailing comments (`A --> B %% note`) are NOT stripped. Distinguishing real trailing comments from `%%` inside quoted labels (`A["50%% off"]`) requires a full parse, which we do not have at the pre-processing stage.
  3. Pure-YAML inputs (first non-whitespace is `type:`) are returned untouched.
  4. Frontmatter block (`---\n…\n---`) is preserved verbatim; stripping applies only to the Mermaid body that follows.
  5. Malformed frontmatter (no closing `---`) is preserved conservatively.
- **Wire-up:** `compileSync` in `src/frontend/index.ts` computes `cleaned = stripComments(input)` once at the top; both `detect(cleaned)` and `module.parse*(cleaned)` receive the stripped string. All four entrypoints (`compileSync`, `renderSync`, `compile`, `render`) benefit automatically.
- **Test file:** `test/preprocess-comments.test.ts` — 20 tests covering full-line strip, indented `%%`, inline preservation, quoted-label safety, frontmatter preservation, pure-YAML no-op, empty input, detect integration (class/sankey/packet/array), and end-to-end render for 5 previously-unsupported families (class, packet, array, mindmap, pie).
- **`pnpm test` result:** 404 pass, 0 fail (baseline 384 + 20 new). `pnpm typecheck`: 0 errors.
- **Verified previously-unsupported families:** `classDiagram`, `packet-beta`, `array` (ds), `mindmap`, `pie` all render without error when a `%%` comment line precedes the header keyword.


## 2026-07-07 — Group C %% header blocks (pie / xychart / quadrant / radar / mindmap)

- **Supersedes:** earlier Group C fallback note in all five fragments.
- **Central `stripComments()` enables this:** because `src/frontend/preprocess.ts` strips full-line `%%` before parse, no grammar-level comment rule is required in any family. All five families now accept `%%` headers safely.
- **Pattern applied:** `%%` block inserted immediately after the header keyword line (or `mindmap` line at column 0, after any frontmatter). Block structure mirrors the flowchart/sankey exemplar: dashed separator lines, compact per-category one-liners, ends with `%% Comments: %% text  (stripped before parse — safe on any line)`.
- **Mindmap special care:** indentation is the parse signal for parent-child depth in mindmap; `%%` block lines start at column 0, no indentation. `stripComments()` removes them entirely before the indentation-sensitive parser sees the file — real node indentation is unaffected. Verified by `node scripts/preview.mjs examples/mermaid/mindmap/` → `mindmap.svg` exit 0.
- **Fragment updates:** removed the `> **Note:** This grammar does not define a %% comment rule…` blockquote from all five fragments; replaced with a `### Comments` section matching the flowchart fragment's wording (mindmap note adds "indentation of real nodes is unaffected").
- **Files changed:** `examples/mermaid/{pie/languages,xychart/xychart,quadrant/quadrant,radar/radar,mindmap/mindmap}.mmd` (1 file each family); `docs/diagram-options/_fragments/{pie,xychart,quadrant,radar,mindmap}.md`.
- **Preview results:** all five families → exit 0, `.svg` regenerated, layout unchanged. Mindmap hierarchy intact.
## 2026-07-07 — Central %% Comment Stripping + Group C headers

Implemented stripComments() in src/frontend/preprocess.ts (20 tests, 404 pass). Added %% options headers to Group C families (pie/xychart/quadrant/radar/mindmap). Coordination: central preprocessing unblocks all group A–E header additions.
## 2026-07-07 — Session Completion

Universal %% comment support feature complete. All 45 diagram families now accept %% comments centrally.
