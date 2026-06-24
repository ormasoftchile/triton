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

- 2026-06-24 LATEX INTEGRATION (Phase 2) — built `latex/` (`@triton/latex`), an ISOLATED satellite package (own `node_modules`/`pnpm-workspace.yaml`/lockfile, NOT a root-workspace member) rendering Triton diagrams to **vector PDF** for `\includegraphics`. Mirrors `extension/`. Full detail in decisions.md "LATEX INTEGRATION — vector PDF, isolated package" block + my Phase-2 orchestration log. Durable facts:
  - **SVG→PDF = `pdfkit` + `svg-to-pdfkit`, pure-JS, NO system binaries** (no Inkscape/rsvg/Chromium). FIDELITY GATE PASSED (flowchart `<marker>`s, avl, 9-cell ds-poster): valid PDFs, **0 raster XObjects** (genuinely vector), text = real glyphs `<hex> Tj` in EMBEDDED base-14 fonts (Helvetica/-Bold) → **no font drift, no external TTF** (the win over resvg/rsvg/cairo). svg-to-pdfkit DID render `<marker>` + `orient="auto"` correctly (verified). SMIL dropped (static PDF). y-flip via `Tm 1 0 0 -1`.
  - **Inspect PDFs w/o pdffonts/pdfinfo**: node + `zlib.inflateSync` over `stream…endstream`, count `re`/`l`/`c` + `Tj`/`TJ`, scan raw for `/Subtype /Image` (raster guard) + `/BaseFont`.
  - **CLI** (`latex/src/cli.ts` → `dist/cli.cjs` CJS, bin `triton-latex`): `render <in> -o <out.pdf|.svg> [--theme N] [--scale S]` + `render-dir <src> -o <out>`. Reuses core `renderSync()`; `--theme` passes `getThemePreset(name)` as `themeInput`; hand-rolled argv (no commander).
  - **Build**: `latex/esbuild.mjs` cloned from `extension/` — same `ensureGrammars()` + `.js`→`.ts` plugin; entry `src/cli.ts`→`dist/cli.cjs`, cjs/node20, **`external: ['pdfkit','svg-to-pdfkit']`** (THIS keeps PDF deps out of core), core via `../../src/frontend/index.js`. Bundle 1.2 MB.
  - **`triton.sty`** graphicx-only (engine-agnostic): `\tritondir`/`\triton[opts]{name}`→`\includegraphics`/`\tritonfig`/`\tritonsetup`. Committed `latex/examples/figures/*.pdf` (Overleaf needs them). svg-to-pdfkit ships no types → added ambient `svg-to-pdfkit.d.ts`; tsconfig `moduleResolution:"Bundler"`.
  - **Design doc**: NEW `design/sections/09-latex-integration.tex`, `\input` after `08-status`.
  - **Gate**: esbuild exit 0 (1.2 MB); 3 examples → valid vector PDFs (2796/3424/12279 B); `render-dir` 3/3; latex typecheck 0; **root `pnpm test` = 378 pass** (unchanged); **root `git diff package.json pnpm-workspace.yaml tsconfig.json` EMPTY** (core ZERO new deps); latex NOT in root workspace. Merged PR #24 (771573c). Files: `latex/**`, `design/sections/09-latex-integration.tex`, `design/triton.tex` (+1 `\input`).

## Learnings — inline LaTeX authoring (triton env, like TikZ)
- **Goal delivered**: write Triton diagram SOURCE directly in `.tex` inside
  `\begin{triton}…\end{triton}` → renders to vector PDF at compile time and is
  `\includegraphics`'d, exactly like `tikzpicture`. Verified END-TO-END:
  `latex/examples/inline-demo.tex` compiles under tectonic (EXIT 0) → 24 KB
  `inline-demo.pdf` containing **2 Form XObjects, 0 Image XObjects** (pure
  vector), path ops l=67/m=24/c=56/re=6 + textShow=27. Both cache PDFs hold real
  geometry (2510 B: l=43 c=32; 2122 B: l=24 c=24 — curves are glyph outlines).
- **Mechanism** (`latex/triton.sty` v0.2.0): `\RequirePackage{graphicx,fancyvrb,pdftexcmds}`.
  1. `fancyvrb` `VerbatimOut` captures the env body BYTE-EXACT to
     `\jobname.triton-src.triton`. 2. `\pdf@filemdfivesum{file}` (pdftexcmds)
     content-hashes it (UPPERCASE hex). 3. `\IfFileExists` cache check on
     `\jobname.triton-cache/<hash>.pdf`; if absent, `\immediate\write18{\triton@cli
     space render "src" -o "pdf" --scale N --theme T}`. 4. `\includegraphics` the PDF.
     Guarded by `\ifnum\pdf@shellescape=\@ne` → clear `\PackageError` if off/CLI missing.
- **`\@currenvir` dispatch trick**: a command `\triton` and an environment `triton`
  can't coexist directly (`\begin{triton}` just calls `\triton`). Resolve by
  branching on `\@currenvir`: inside `\begin{triton}` → verbatim capture; bare
  `\triton[opts]{name}` → precompiled-PDF include (Overleaf fallback). Same name,
  two behaviours.
- **VERIFIED-IMPOSSIBLE**: a verbatim env CANNOT take an inline optional arg
  (`\begin{triton}[width=…]`). ANY lookahead for `[` (`\@ifnextchar` OR
  `\futurelet`) consumes the line-ending `^^M` that fancyvrb needs to delimit the
  begin line → "FancyVerb Error: Extraneous input … between \begin{…} and line
  end", swallowing the first body line. Probe A (optional-only) failed on no-arg;
  Probe B (no-optional) captured byte-exact. `minted` only escapes this via its
  MANDATORY `{lang}` arg on the same line. Workaround: one-shot `\tritonnext{opts}`
  (`\newif\iftriton@nextset`, reset in `\endtriton`) + global `\tritonsetup{opts}`.
- **graphicx gotcha**: `\includegraphics[\opts]{...}` where `\opts` is a `\def`
  macro = `width=\linewidth` throws "\! Missing \endcsname inserted / <to be read
  again> \linewidth". Literal `[width=\linewidth]` works; the unexpanded key-list
  MACRO in the optional arg breaks keyval on the dimen. FIX: expand once first —
  `\expandafter\includegraphics\expandafter[\triton@curopts]{\triton@pdf}`.
- **CLI fix**: `latex/src/cli.ts` `renderFile` now `mkdirSync(dirname(resolve(outPath)),
  {recursive:true})` so single-file `render` creates the content-hashed cache dir.
  Rebuilt `dist/cli.cjs` (1.2 MB), typecheck clean.
- **tectonic flags**: MUST run `-Z shell-escape -Z shell-escape-cwd=.`,
  UNSANDBOXED (panics in VS Code sandbox: macOS SCDynamicStore), network on first
  run (package/font fetch). tectonic searches ONLY the input file's own dir for
  local `.sty` (ignores TEXINPUTS) → `latex/examples/triton.sty` is a SYMLINK to
  `../triton.sty` (committable, standard). `pdflatex` honours TEXINPUTS so the
  symlink is unneeded there.
- **CORE renderer bug found (NOT mine to fix — left core untouched)**: a CYCLIC
  flowchart (`D --> B` back-edge) HANGS core layout indefinitely (`renderSync`
  never returns). Acyclic flowcharts render fine. Demo uses acyclic diagrams.
- **Scope honoured**: root `git diff package.json pnpm-workspace.yaml tsconfig.json
  src/` EMPTY — core triton zero changes.
- **Files**: `latex/triton.sty` (rewrite v0.2.0), `latex/src/cli.ts` (mkdir),
  `latex/examples/inline-demo.tex` (NEW dogfood), `latex/examples/triton.sty`
  (symlink), `latex/examples/.gitignore` (NEW), `latex/README.md` (leads with
  inline env now).

## Learnings — design doc LaTeX chapter now documents inline env + caveats (2026-06-24)
- `design/sections/09-latex-integration.tex` REFRAMED to lead with the inline
  `triton` environment as the headline authoring mode (was precompile-and-commit
  only). Format-gap section now presents two paths (inline via shell-escape =
  default; precompiled-and-committed = Overleaf fallback). New subsection
  "Inline authoring: the triton environment" describes the verbatim→hash→write18→
  includegraphics pipeline + `\@currenvir` dispatch.
- NEW "Caveats and limitations" subsection (three `\paragraph`s):
  1. No optional `[width=]` on `\begin{triton}` (verbatim lookahead eats fancyvrb's
     line-ending → swallows first source line; minted escapes only via its
     mandatory `{lang}` arg). Workaround: `\tritonnext{}` / `\tritonsetup{}`.
  2. `--shell-escape` required (needs Node + triton-latex CLI; clear `\PackageError`
     otherwise; Overleaf → precompiled `\triton{name}` path).
  3. Cyclic flowcharts hang core `renderSync` (known core bug, tracked separately;
     use acyclic).
- Also updated Workflow/portability prose (inline = no render step) and the path
  table rows (triton.sty = env + macros; examples = inline-demo.tex). Uses only
  existing preamble macros (lstlisting `triton`/`ts`, `\texttt`, `\textbackslash`,
  `\paragraph`). Did NOT run tectonic (coordinator rebuilds the PDF). Core untouched.

## Learnings (2026-06-24) — design doc dogfoods Triton via inline figures

- **Converted all 8 `\ourfig{name}` PNG includes in design/ to inline `\begin{triton}` figures.** The spec now authors every diagram as Triton source in the .tex and renders it at LaTeX compile time. Figure→source map: sql-engine→poster/sql-engine.mmd, flowchart→flowchart/flowchart.mmd, avl→ds/tree/avl.mmd, radix→ds/tree/radix.mmd, array→ds/struct/array.mmd, memory→ds/struct/memory.mmd, numa→topology/numa-detail.mmd (NOT numa.mmd — render.mjs mapped numa→numa-detail), spanning→poster/spanning.mmd. **All 8 are acyclic** (the lone flowchart is a DAG: start→validate→{process,reject}, process→notify→done) so none hit the cyclic-renderSync hang.
- **sty discoverability:** symlink `design/triton.sty -> ../latex/triton.sty` (same trick as latex/examples), then `\usepackage{triton}`. No TEXINPUTS needed.
- **CLI path resolution:** the inline env shells out to `\triton@cli render ...` with cwd = build dir. Set `\tritoncli{node ../latex/dist/cli.cjs}` in the preamble so it resolves design/../latex/dist/cli.cjs. The bundle must exist → `pnpm -C latex build` (Makefile `cli` target does this).
- **Per-figure width:** the verbatim env can't take `[width=]`, so widths are set with `\tritonnext{width=0.6\linewidth}` etc. just BEFORE `\begin{triton}`. Posters (sql-engine, spanning) + numa kept default `\linewidth`.
- **Build:** `tectonic -Z shell-escape -Z shell-escape-cwd=. triton.tex`. Needs unsandboxed exec on macOS (write18 spawns node + network for package fetch). Clean build EXIT=0, 21 pages, triton.pdf ~134 KiB. Cache: 8 content-hashed PDFs in triton.triton-cache/ (2.4–9.2 KB each, all real vector). Verified the two posters visually (rasterized via `sips -s format png` — also needs unsandboxed for its /var/folders temp).
- **Removed dead pipeline:** deleted design/figures/*.png + render.mjs, dropped the root `figures` npm script (it solely drove those PNGs — src/ and core deps untouched), removed `\ourfig` from triton.tex, added design/.gitignore (ignores *.triton-cache/ + *.triton-src.triton), rewrote design/Makefile (cli+pdf targets, shell-escape). Fixed a stale `pnpm figures`/`\ourfig` reference in 09-latex-integration.tex.
- **Gotcha:** `\tritonnext` resets after each render (`\triton@nextsetfalse` in `\endtriton`), so it must be repeated per figure. Default `\triton@opts` = width=\linewidth.

## Learnings (2026-06-24) — FIXED the cyclic-flowchart `renderSync` hang (core layout)

- **Location of the infinite loop:** `assignLayers()` in `src/diagrams/flowchart/layout.ts` (flowchart has its OWN longest-path layering — it does NOT use `src/graph/layered.ts`, whose `assignLayers` already caps cycles with a pass count; that was a red herring). The BFS re-pushes a successor whenever it finds a STRICTLY greater layer (`if (item.layer <= current) continue; ... queue.push({to, item.layer+1})`). On a cycle reachable from a root the layer number grows without bound → the queue never drains → `renderSync` never returns.
- **Precise trigger (reproduced under a `perl -e 'alarm 6'` hard kill against `dist/`):**
  - Pure cycles where EVERY node is in the cycle — 2-cycle `A→B→A`, 3-cycle `A→B→C→A`, self-loop `A→A` — DO terminate (no root ⇒ BFS queue starts empty ⇒ all nodes fall to the layer-0 disconnected fallback; degenerate/overlapping but valid SVG). They were never the hang.
  - The HANG needs a ROOT feeding a cycle, e.g. `S→A; A→B; B→C; C→A`. S is a root → BFS starts → loops the cycle forever.
- **Fix (cycle breaking, Sugiyama-standard, ~70 lines, localized to that one file):** added `findBackEdges(nodes, edges)` — an iterative (explicit-stack) DFS with WHITE/GRAY/BLACK colouring that returns the set of edge indices closing a cycle (a GRAY target, which also covers self-loops). `assignLayers` now removes those back-edges and runs the SAME longest-path BFS over the forward (acyclic) subset. Removing a DFS's back-edge set always yields a DAG ⇒ BFS provably terminates on ANY graph. Determinism preserved (nodes/edges visited in given order).
- **Back-edges are NOT dropped from the picture:** the edge-drawing loop in `layoutFlowchart` iterates ALL `ir.edges` independently of layering, so the cyclic edge is still drawn source→target. Verified by a test asserting `<path>` count ≥ edge count for a 3-cycle.
- **Acyclic is byte-identical:** when `findBackEdges` returns ∅, `forwardEdges === edges`, so the common case is unchanged (regression test asserts 3 distinct rows for `A→B→C`).
- **Regression test:** NEW `test/flowchart-cycle.test.ts` (7 tests): 5 cyclic shapes render to valid `<svg` (2-cycle/3-cycle/self-loop/root-into-cycle/two-back-edges), 1 back-edge-still-drawn, 1 acyclic-unaffected. ⚠️ A real hang blocks the event loop so vitest's per-test timeout can't interrupt it — a reintroduced bug stalls the whole suite (a hang IS the failure signal).
- **Repro tooling gotcha:** vitest's `--testTimeout` CANNOT interrupt a synchronous infinite loop (the timer never fires while the JS thread is stuck) → the suite hangs past 120s. Use a process-level hard kill instead: `perl -e 'alarm N; exec @ARGV' node …`. Also: Node 25 `--experimental-strip-types` does NOT rewrite `.js` import specifiers to `.ts`, so it can't run the `src/` tree directly (the repo uses TS bundler-style `.js` specifiers) → build to `dist/` and run the compiled JS, or use vitest.
- **Scope:** ONLY `src/diagrams/flowchart/layout.ts` (+ new test). latex/, extension/, other diagrams untouched. Gate: typecheck 0, **`pnpm test` 378 → 385** (+7), build:grammars 23. Removes the "cyclic flowcharts hang" caveat noted earlier in the LaTeX work.
