# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-23 (design-doc realignment; earlier 2026-06-17 detail archived)

---

## Current Status (2026-06-17) — archived

Full 2026-06-17 detail (configurable poster routing `routingStyle: 'orthogonal'|'straight'`, the orthogonal-vs-straight visual comparison, wall-centered exit/entry ports, greedy-switch + Brandes-Köpf, A* pathfinding, aesthetic metrics) moved to `history-archive.md` by Scribe 2026-06-24. The durable takeaways are kept in the "Learnings — Earlier work (summarized)" section below.

---

## Archive & Historical Notes

**Full detailed work (2026-06-15–2026-06-17):** See `history-2026-06-17-archived.md` (if created) for A* pathfinding, aesthetic metrics, and earlier June 17 work.

**Earlier work (2026-06-14 and prior):** See `history-archive.md` and dated archive files.

---

## Learnings — Earlier work (summarized 2026-06-23 by Scribe)

Full pre-realignment rendering/layout detail moved to `history-archive.md` (+ `history-2026-06-16-summarized.md`). ⚠️ Those notes reference the OLD `packages/core/...` tree — current code lives under `src/`, and the single-backend/Scene realignment supersedes the multi-backend framing.

- **Poster overlay routing:** configurable `routingStyle: 'orthogonal'|'straight'`; wall-face-centered exit/entry ports give balanced connectors; deterministic enumerated candidates with A* fallback; 6-metric aesthetic scorecard (ACCEPTABLE 0.73–0.81 is legitimate; reaching GOOD needs layout reorder, not routing).
- **Flow layout:** greedy-switch crossing minimization + simplified Brandes-Köpf alignment (full BK deferred); node-overlap is a hard constraint; lexicographic tie-breaking preserves determinism.
- **Old pipeline map:** preprocess → detect → parse→Domain IR → theme → layout→Scene → svg/png. Now described in the realigned doc as the single `renderSVG(scene)` + `Scene` contract.

- 2026-06-23: Audited my assigned design/ LaTeX sections vs shipped Triton (plan-only, no prose rewrite). Verdicts (KEEP/REWRITE/DELETE) recorded in the consolidated "DESIGN-DOC AUDIT (2026-06-23)" block in decisions.md.

## Learnings

- 2026-06-23: Executed the design-doc realignment for my 7 assigned sections (11-backends, 14-animation, 22-rendering, 19-render-contract, 12-themes, 30-composition, 30b cross-links). Grounded every claim in real `src/` files. Key corrections that recur across the whole doc:
  - Backend reality = ONE `renderSVG(scene)` in `src/render/svg.ts` (+ optional resvg PNG). NO Skia/PPTX/PDF/HTML — those were aspirational. Dropped fidelity-tier/backend-selection narrative everywhere.
  - Animation reality = exactly two effects via `ScenePath.animated?: 'march' | 'particle'` (SMIL: `<animate stroke-dashoffset>` and sibling `<circle><animateMotion>`). The old hint taxonomy (FlowingDashes/DrawOn/DotAlongPath/Pulse/FadeIn) does not exist.
  - Scene contract = `Scene{viewBox, background?, elements, defs?}` with a 5-variant `SceneElement` union (`rect|circle|path|text|group`). NOT `ScenePrimitive`, NOT Line/MultiText/Image. `renderSVG` walks groups uniformly — composition uses one `SceneGroup` transform (`embedScene(scene, into)` in `src/diagrams/poster/layout.ts`), so no per-element coordinate rewriting / no `translateAndScale`/`embedSceneInRect`/`sceneHash` (all fabricated).
  - Themes = unified `ResolvedTheme{name,palette,typography,spacing,edges,panel}` from `src/theme/preset.ts` (12 presets). The per-grammar FlowTheme/SequenceTheme fragmentation story and the Tier-1/2/3 contract were never built — deleted.
  - Real paths are `src/...` ALWAYS — never `packages/core/...` or `@diagram-compiler/*`. Poster IR is `PosterDocument`/`DiagramContent{kind:'diagram',diagramKind,doc}` in `src/diagrams/poster/ir.ts`; requirement vocab is `ReqRelation.type` (free string) in `src/diagrams/requirement/ir.ts` (no `RequirementRelKind` enum, no schema.ts).
- 2026-06-23: `50-agent-integration.tex` was deleted, leaving 4 dangling `\ref{sec:agent-integration}` in 30b. Repointed all to `sec:diagram-contract` (the surviving IR-as-API surface) and de-agented the adjacent prose. The anchor-registry concept in 30b is sound — kept.
- 2026-06-23 TOOLING: `tectonic` panics under the VS Code sandbox (macOS SCDynamicStore / `system-configuration` NULL object) — must run UNSANDBOXED to compile. `cd design && tectonic -X compile triton.tex --keep-logs` then grep `triton.log` for "undefined reference". Doc compiles to a 1.29 MiB PDF; the only remaining undefined refs (`sec:family-nodelink`, `sec:corpus-comparison-matrix`, `sec:graph-grammar`, `principle:minimal-clutter`) live in 18-aesthetics/25-flow-grammar — NOT my files, pre-existing.
- 2026-06-23 EDIT TECHNIQUE: For large LaTeX rewrites, replace_string_in_file is the only available tool (create_file can't edit; terminal edits forbidden). Read the file's CURRENT bytes immediately before each large deletion so the oldString matches exactly; stage big rewrites as (A) replace head with new content, (B) delete the stale tail in a second edit.
- 2026-06-23 VS CODE EXTENSION (Phase 1 live preview) — built the `extension/` satellite. Full detail archived 2026-06-24 in `history-archive.md` (+ decisions.md "VS CODE EXTENSION — Phase 1" block). Key durable facts: `render(text) → Promise<Result<string>>` (NEVER throws, `{ok,value}|{ok,error}`) is the SOLE render path, imported `../../src/frontend/index.js`; esbuild bundles the compiler from `src/` with a `.js`→`.ts` `onResolve` plugin that returns `undefined` for the generated Peggy `parser.js`; CJS-importing-ESM needs `moduleResolution:"Bundler"` (TS1479); Mermaid coexistence gated behind `triton.enableMermaid` (default false) via `pickRenderable()`; SVG-only in P1 (no resvg). Output ≈1.1 MB, typecheck 0.

- 2026-06-23 QUEUE FAMILY — built the 4-variant queue family (queue/cqueue/deque/pqueue), PR #17, 337 tests. Full detail archived 2026-06-24 in `history-archive.md` (+ decisions.md "QUEUE DIAGRAM FAMILY" block). Key durable facts: hand-parsed like struct (NO peggy — only flowchart/timeline/poster own `parser.js`); one content-detectable header per variant; canonical 3-edit registration (miss one → silently routes to flowchart); all four reuse `buildStrip` for cells + `c0..cn` slot anchors; deque double-head uses TWO fixed markers `ARROW_FWD`/`ARROW_REV` (NOT `auto-start-reverse` — resvg-unsafe); pqueue shades via a LOCAL `mixHex` hex-lerp (repo has no color-mix util); regenerate examples with `node scripts/preview.mjs examples/queue/` (`tsx` not installed, npm 403).

---

**Cross-agent note (Scribe, 2026-06-23):** The new VS Code extension (`extension/`) reuses `render()` (`src/frontend/index.ts`) as its SOLE render path and esbuild-bundles the compiler from `src/`. Any change to the `render(input, themeInput?, rendererName?)` signature, its `Result<string>` SVG contract, or the `src/frontend/detect.ts` `MERMAID_PATTERNS` header table is now a downstream dependency for the extension preview + future IntelliSense. Keep these stable or update `extension/src/extension.ts` in the same PR. SVG-only in P1 (no resvg).

- 2026-06-23 DS REGROUP (Phase A — pure refactor). Grouped `struct`/`tree`/`queue` under `src/diagrams/ds/` via `git mv` (history preserved); examples → `examples/ds/*`; `topology` stays separate. Headers/kind names + `detect.ts` UNCHANGED. Full detail in decisions.md "DATA-STRUCTURE FAMILY" block. Durable gotchas: grammar discovery is now RECURSIVE in `scripts/build-grammars.mjs` + `extension/esbuild.mjs` (`findGrammarDirs`, keyed relative to `src/diagrams/`, count still 23) so future nested families need no build-script edit; families one level deeper use `../../../` for src-escaping imports but intra-`ds` siblings stay single-`../`. Gate: build:grammars 23, typecheck 0, 337 tests, extension exit 0, git 58 renames.

- 2026-06-23 DS PHASE B1 — `stack`, `hashmap`, `matrix` under `ds/`, hand-parsed (NO peggy), strip/slot kernel. Full detail in decisions.md "DATA-STRUCTURE FAMILY" block. Durable: stack = VERTICAL `buildStrip`, last-pushed = top (smallest y); hashmap = bucket column → horizontal `key:value` chains, IR keeps `chains` as a plain ARRAY not a Map (serializable — important rule); matrix = one strip per row + `RxC` shorthand. Anchors `c0..cn` / `b{i}e{j}` / `r{i}c{j}`. ⚠️ Fixed `scripts/preview.mjs`: its Step-3 hardcoded `['flowchart','timeline','poster']` copy list never copied `ds/tree/parser.js` → replaced with recursive `copyParsers()` mirroring every `src/diagrams/**/parser.js`. Gate: `test/ds-b1.test.ts` (17) → 357 pass, 0 tsc errors, build:grammars 23.

- 2026-06-23 DS PHASE B2 — `trie`, `nodegraph`, `unionfind` under `ds/`, tree/graph kernels, hand-parsed. Full detail in decisions.md "DATA-STRUCTURE FAMILY" block. Durable: trie compiles to the shared decorated-tree IR + `layoutTree` (like `radix` but uncompressed — one char/edge, terminal nodes = filled pills); unionfind = DSU forest also on the tree IR (`layoutTree` already lays out a forest → sets side by side), IR carries `parent[]`/`roots[]`/`count`, representatives filled; nodegraph on `graph/layered.ts` + `connectSlots`, `directed`→arrowheads+defs / `undirected`→none. ⚠️ GRAPH KEYWORD COLLISION: Mermaid flowchart owns `graph` (`detect.ts` first pattern) → DS graph uses `nodegraph` (alias `dsgraph`), NEVER a bare `^graph`; regression test asserts `detect('graph TD …')==='flowchart'`. `unionfind` alias `dsu`. trie/unionfind import the tree family as a sibling (`../tree/…`). Gate: `test/ds-b2.test.ts` (17) → 377 pass, 0 tsc errors, build:grammars 23. SVGs valid (trie 258×442, nodegraph 164×456, unionfind 230×314).

- 2026-06-24 DS GALLERY POSTER — built ONE composition showcase `examples/gallery/ds-poster.mmd` (+ rendered `.svg`) titled "Data Structures". Composes 9 DS kinds in a fully-filled 4×3 grid using the poster family's occupancy-aware `assignPositions`: row0 = array / stack / queue / unionfind; row1 = hashmap / matrix / heap[1x2] / trie[1x2]; row2 = nodegraph[2] (fills the two cols left free under the rowSpan-2 tree cells). Durable facts:
  - **CellKind accepts ANY registered kind verbatim** (grammar's `CellKind = ... / Identifier`), so `array`/`stack`/`queue`/`hashmap`/`matrix`/`heap`/`trie`/`unionfind`/`nodegraph` all embed as cells with no poster changes. The `:: kind` after the cell id is what routes the inner block.
  - **Span syntax is inline before `::`**: `[N]` = colSpan N (rowSpan 1); `[CxR]` = `[1x2]` etc. Occupancy-aware flow fills around spanned cells top-to-bottom/left-to-right → use a rowSpan-2 tall cell (trees) in the same row as two shorter cells, then a colSpan-2 cell on the next row to fill the gap = a clean rectangle with zero holes.
  - **Kinds that compose cleanly in a cell** (small + visually varied): array (1-line `array 5 8 …`), stack/queue/cqueue/deque (multiline `cells … / capacity N`), hashmap (`buckets N` + `bucket i: k->v`), matrix (`row …` lines), heap/avl/btree/rbtree/radix (1-line `heap max insert …`), trie (1-line `trie insert …`), nodegraph (`directed` + `node X : label` + `A -> B : edge`), unionfind (`unionfind N` + `parent …`). Trees/trie are the tallest → give them rowSpan 2.
  - **Render path**: `node scripts/preview.mjs examples/gallery/` writes the `.svg` next to the `.mmd` (build:grammars → tsc → copyParsers → `render()` from dist). The `examples.test` globs `examples/**/*.mmd` recursively so the new poster is auto-covered — no test edit needed.

- 2026-06-24 LATEX INTEGRATION (Phase 2, PR #24) — built ISOLATED `latex/` (`@triton/latex`, mirrors `extension/`, NOT a root-workspace member) rendering diagrams to **vector PDF** for `\includegraphics`. Full detail in decisions.md "LATEX INTEGRATION — vector PDF, isolated package" block. Durable: SVG→PDF = **`pdfkit` + `svg-to-pdfkit`, pure-JS, no system binaries**; 0 raster XObjects, embedded base-14 fonts (no font drift); SMIL dropped (static PDF); y-flip `Tm 1 0 0 -1`. Inspect PDFs via node `zlib.inflateSync` (count `re`/`l`/`c`/`Tj`, scan `/Subtype /Image` + `/BaseFont`). CLI `triton-latex` (`dist/cli.cjs` CJS): `render`/`render-dir`, reuses core `renderSync()`, hand-rolled argv. esbuild cloned from `extension/`, **`external:['pdfkit','svg-to-pdfkit']`** keeps PDF deps out of core. `triton.sty` graphicx-only. Gate: root `pnpm test` 378 pass, core deps diff EMPTY, latex not in root workspace.

## Learnings (2026-06-24) — LaTeX inline env, design dogfood, cyclic-flowchart fix (summarized 2026-06-24 by Scribe)

Full verbose detail moved to `history-archive.md`; canonical detail in decisions.md blocks
"LATEX INLINE ENVIRONMENT + DESIGN DOGFOOD" and "CORE FIX: flowchart cycle breaking".

- **Inline `triton` LaTeX env (PR #25)** — author Triton source in `.tex` between
  `\begin{triton}…\end{triton}` → vector PDF at compile time (`fancyvrb` VerbatimOut →
  `pdftexcmds` content hash → `\write18` triton-latex CLI → `\includegraphics`), guarded by
  `\pdf@shellescape`; `\triton{name}` precompile = Overleaf fallback. `\@currenvir` dispatch
  lets command+env share the name. **Verified-impossible:** inline `[width=]` on a verbatim env
  (lookahead eats fancyvrb's line-end) → use `\tritonnext`/`\tritonsetup`. graphicx macro opts
  need `\expandafter`. tectonic = `-Z shell-escape -Z shell-escape-cwd=.`, unsandboxed, local
  `.sty` only in input dir (symlink `examples/triton.sty`). Gate: inline-demo.pdf, 0 Image
  XObjects (pure vector). Core untouched.
- **Design doc dogfoods inline figures (PR #27)** — all 8 `\ourfig` PNGs → inline
  `\begin{triton}` blocks; `design/triton.sty` symlink + `\tritoncli{node ../latex/dist/cli.cjs}`;
  PNG pipeline + `\ourfig` deleted; design build now shell-escape (exit 0, 21 pages, ~134 KiB).
- **Core fix: cyclic flowcharts no longer hang (PR #28)** — `assignLayers()` in
  `src/diagrams/flowchart/layout.ts` looped forever when a ROOT fed a cycle (BFS re-pushed
  ever-growing layers). Fix = Sugiyama cycle breaking: `findBackEdges()` DFS strips back-edges
  to a DAG, same longest-path BFS on the forward subset (provably terminates, deterministic);
  back-edges still drawn; acyclic byte-identical. Regression test `test/flowchart-cycle.test.ts`
  (7). `pnpm test` 378 → **385**. The earlier "cyclic flowcharts hang" caveat is now removed
  from `design/sections/09-latex-integration.tex` (design PDF rebuilt clean).
- Tooling: vitest `--testTimeout` can't interrupt a sync infinite loop → `perl -e 'alarm N;
  exec @ARGV' node …`; Node 25 `--experimental-strip-types` doesn't rewrite `.js`→`.ts`
  specifiers → build to `dist/`.

- 2026-06-24 BACK-EDGE VISUAL ROUTING (follow-up to PR #28). PR #28 made cyclic flowcharts
  terminate but drew back-edges like forward edges (orthogonal router) → they sliced straight
  back through the node column. Now the flowchart edge loop in `src/diagrams/flowchart/layout.ts`
  classifies each edge BEFORE drawing and routes three ways:
  - **Self-loop** (`from === to`) → `selfLoopRoute()`: a small cubic loop off the East wall
    (vertical flow) or South wall (LR), `loop = 28`. Previously the orthogonal router turned
    A→A into a zero-length/degenerate vertical line straight through the node.
  - **Back-edge** (the SAME `findBackEdges()` set already excluded from ranks) →
    `backEdgeRoute()`: a cubic Bézier that bows OUT to one lateral side — endpoints on the side
    wall (East for vertical flow, South for LR), control points pushed further out by
    `bow = max(NODE_W*0.75 | NODE_H*0.9, span*0.35)`. The endpoints sit OUTSIDE the centered
    node column, so the arc clears the nodes without any obstacle-avoiding router. Arrowhead
    still lands on the target wall (tangent at the cubic's end points back into the node, so
    `markerEnd orient="auto"` is correct).
  - **Forward edge** → UNCHANGED orthogonal-router code path (kept character-identical).
  Durable facts / gotchas:
  - **Byte-identical guarantee for acyclic:** the viewBox now grows only for bow extents via
    `bowMaxX/bowMaxY` (init `-Infinity`); when there are no back-edges/self-loops the
    `Number.isFinite(...) ? Math.max(...) : nodeRight` falls through to the original
    `nodeRight + margin`, so acyclic output is identical. PROVEN: regenerated all 3 acyclic
    flowchart examples (+ theme variants) with `node scripts/preview.mjs examples/flowchart/`
    → `git status --porcelain examples/flowchart/` EMPTY (zero diff).
  - Without the viewBox growth, cyclic bows would be CLIPPED (viewBox was node-rects only).
  - The edge loop switched `for…of` → indexed `for (let ei…)` to pass the index to
    `backEdges.has(ei)`; `dash`/stroke colour computed once at top, forward branch kept verbatim.
  - SVG renderer (`src/render/svg.ts`) emits `path.d` VERBATIM, so cubic `C x y, x y, x y`
    strings render fine — no escaping/normalization. The orthogonal router only ever emits
    `M…L…` (no `C`), which is what the new test keys on to tell forward vs back-edge apart.
  - `occupiedPorts` left UNCHANGED (still edgeAnchor-based) — it's only consumed by overlays
    and isn't part of the scene SVG, so it doesn't affect the byte-identical guarantee.
  - Tests: extended `test/flowchart-cycle.test.ts` (+2 → 9 there): a 2-cycle asserts the forward
    path has no `C` while the back-edge path does; a self-loop asserts its `d` contains `C` and
    has non-zero extent in BOTH axes (non-degenerate). `pnpm test` 385 → **387**, typecheck 0,
    build:grammars 23. Confined to `src/diagrams/flowchart/` + test — core/latex/extension untouched.


- 2026-06-24: Made design build portable — removed the committed `design/triton.sty` symlink (broke on Windows checkouts as a plain text file). Tectonic does NOT honor TEXINPUTS for .sty resolution (tested: `File triton.sty not found`), so the Makefile now COPYs `../latex/triton.sty` into `design/` as a build step (`pdf: triton.sty` prereq) and `.gitignore` excludes the copy. Full `make clean && make` → exit 0, triton.pdf 133 KiB with inline figures rendered.

- 2026-06-27 PHASE 1 — Flowchart Full Sugiyama Upgrade (commit 23cee08, PR pending). Added Sugiyama phases 3 and 4 to `src/diagrams/flowchart/layout.ts`. Gate: `pnpm test` **387/387**. Decision written: `.squad/decisions/inbox/barbara-phase1-complete.md`.

  **Phase 3 — `minimizeCrossings()`:** Barycentric bi-directional sweeps, MAX_PASSES=4. Nodes without anchoring neighbours in the reference layer use current position index as barycenter (keeps relative order). Stable sort: equal barycenters tie-break on original insertion index. Back-edges and self-loops excluded.

  **Phase 4 — `assignCoordinatesBK()`:** Two-pass simplified B-K. Pass1 top-down (predecessor-aligned), Pass2 bottom-up (successor-aligned). Preference = mean cross-axis position of forward-edge neighbours (mean gives centred result for symmetric trees, matching dagre). Nodes with no neighbours fall back to the OLD centering formula (`margin + (maxNodesInLayer-count)*crossStep/2 + i*crossStep`) so roots/leaves remain stable. Block start = `max(margin, medianOfPrefs - ½·totalSpan)`. Final position = average of the two passes — proven non-overlapping because both passes use uniform crossStep and averaging uniform sequences preserves spacing. Back-edges/self-loops excluded.

  **Durable gotchas:**
  - `findBackEdges()` was previously called INSIDE the edge-drawing loop (line 91). Moved it earlier (right after `groupByLayer`) so the same `Set<number>` is reused by crossing-min, B-K, and the edge router — one DFS instead of two.
  - Averaging two passes eliminates the need for a forward+backward pass correction loop; the algebra guarantees no overlaps.
  - `scripts/preview.mjs` had a stale dist path (`../dist/frontend/index.js`). The tsconfig `outDir` is `./packages/core/dist`. Fixed import + parser-copy destination in the same commit.
  - Vitest doesn't need the compiled output (uses TypeScript directly), so `pnpm test` was always passing. The stale path only affected the preview script.
  - Phase 2: same `minimizeCrossings` + `assignCoordinatesBK` should be lifted into `src/graph/layered.ts` so class/state/ER/C4/block/requirement inherit it (Leslie's phase plan §Phase 2).

