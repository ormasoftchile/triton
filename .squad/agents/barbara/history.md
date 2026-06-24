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
