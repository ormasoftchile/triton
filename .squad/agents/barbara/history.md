# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-23 (design-doc realignment; earlier 2026-06-17 detail archived)

---

## Current Status (2026-06-17)

**STRAIGHT ROUTING IMPLEMENTED — VISUAL COMPARISON COMPLETE.** Added configurable routing styles for poster overlay connectors: `routingStyle: 'orthogonal'` (default, Manhattan routing with horizontal/vertical segments) vs `routingStyle: 'straight'` (direct diagonal lines). Implementation: (1) Added 'direct' routing candidate to `enumerateHopCandidates()` that creates single-segment paths from source to target, selecting exit/entry ports based on predominant direction (horizontal vs vertical). (2) Added `routingStyle` field to PosterDocument interface, parsed from frontmatter. (3) Filter candidates based on style: 'straight' keeps ONLY direct candidates, 'orthogonal' (default) filters out direct candidates to preserve existing Manhattan routing. (4) Created link-poster-orthogonal.mmd and link-poster-straight.mmd for side-by-side comparison. **All 2790/2790 tests pass.**

**VISUAL COMPARISON RESULTS:**
- **Orthogonal (Manhattan):** Uses 3-segment paths (horizontal-vertical-horizontal) via intermediate vertical gutters. Example: Payment→PaymentGateway goes right to x=489, down to target y, then right to target. Clean 90° turns, respects grid structure, feels intentional and structured. Label boxes sit on vertical gutter segments.
- **Straight (Direct):** Uses 1-segment diagonal paths. Example: Payment→PaymentGateway goes directly from (416.93,171.11)→(579.04,203.60). Minimal ink, shorter paths, more organic feel. Labels sit on diagonal midpoints.
- **Which looks better?** DEPENDS ON INTENT. Orthogonal feels more **architectural and intentional** — connectors follow the implicit grid, creating visual alignment and regularity (gutters at x=489, x=509, x=726.5 create vertical rhythm). Straight feels more **organic and minimal** — fewer bends, less visual clutter, direct "as the crow flies" connections. For diagrams emphasizing flow/causality (traces, data pipelines), straight may be cleaner. For architectural/structural diagrams (system boundaries, layered architectures), orthogonal maintains grid discipline.
- **Trade-offs:** Straight routing COULD cross obstacles if source/target aren't cleanly separated (not an issue in link-poster due to grid layout, but could be problematic in denser posters with overlapping cells). Orthogonal routing ALWAYS respects cell boundaries via gutters, but adds extra path length and visual complexity (3 segments vs 1).

**Earlier (2026-06-17):** Wall-centered connector exit/entry points fix; greedy-switch crossing minimization; Brandes-Köpf structure; A* pathfinding; aesthetic metrics. See earlier notes below.

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
- 2026-06-23 VS CODE EXTENSION (Phase 1 live preview) — built the `extension/` satellite. Key facts for next time:
  - **Files:** `extension/package.json` (name `triton-vscode`, private, `main: ./dist/extension.cjs`, no `type` field, `engines.vscode ^1.90.0`, contributes languages/commands/menus/configuration), `extension/esbuild.mjs` (bundler + `.js`→`.ts` plugin + build:grammars precondition), `extension/src/extension.ts` (activate + PreviewManager + webview HTML, all in one file), `extension/tsconfig.json` (typecheck-only, noEmit), `extension/README.md`, `extension/.gitignore` (node_modules/, dist/).
  - **render() Result shape:** `render(text)` → `Promise<Result<string>>` where `Result` is `{ok:true,value:string} | {ok:false,error:{code,message,cause?}}`. NEVER throws. Extension does `const r = await render(text); if (r.ok) post(r.value) else post('['+r.error.code+'] '+r.error.message)`. Import path from `extension/src/extension.ts` is `../../src/frontend/index.js` (two up from src → triton root → src/frontend). Verified render returns a 2956-byte SVG starting with `<svg` for examples/flowchart.
  - **esbuild `.js`→`.ts` plugin:** `onResolve({filter:/\.js$/})` → skip entry-point + bare imports, else `resolve(resolveDir, path).replace(/\.js$/,'.ts')` and return `{path}` IF the `.ts` exists; return `undefined` otherwise so esbuild's default handles the REAL generated Peggy `parser.js` files (they have no sibling `.ts`). ~15 lines, self-contained. Bundling from `src/` (not `dist/`) inlines the parsers directly and sidesteps the tsc-doesn't-copy-parser.js dist-sync `cpSync` hack in design/figures/render.mjs.
  - **build:grammars precondition:** `esbuild.mjs` spawns `pnpm build:grammars` in the repo ROOT first (23 grammars), then verifies every `src/diagrams/<kind>/grammar.peggy` has a sibling `parser.js`, failing loudly with the missing list if not. Output: `extension/dist/extension.cjs` ≈ 1.1 MB (+2.2 MB sourcemap), build ~85ms, exit 0, NO unresolved imports.
  - **TS module-resolution gotcha:** the user asked for NodeNext, but `extension.ts` is CJS (no `type:module`) statically importing ESM compiler source (root `type:module`) → NodeNext throws **TS1479** (CJS can't `require` ESM via static import). Resolution: `moduleResolution: "Bundler"` + `module: "ESNext"` in extension/tsconfig.json — esbuild IS the bundler, so Bundler resolution is the faithful model; it still does the `.js`→`.ts` rewrite and drops the require-interop rule that esbuild collapses by inlining everything. Documented the deviation in tsconfig comment. typecheck = 0 errors.
  - **deps:** esbuild + @types/vscode + @types/node + typescript installed into `extension/node_modules` via `pnpm install --ignore-workspace` (extension is NOT a pnpm-workspace member — keeps repo flat per Leslie's plan). esbuild postinstall gets `ERR_PNPM_IGNORED_BUILDS` warning but the platform binary (@esbuild/darwin-arm64 optional dep) works fine — build succeeded.
  - **Sandbox quirk:** the VS Code terminal sandbox re-quotes `!` → `\!` inside heredocs, breaking JS that uses `!`. Avoid `!` in heredoc'd scripts (use `=== false` / `r.ok === false`).
  - **Mermaid coexistence (LOCKED):** `.triton`/```triton always handled; explicit Open Preview command renders ANY active file unconditionally; passive Mermaid (.mmd / ```mermaid-in-markdown) gated behind `triton.enableMermaid` (default false). Phase 1 never auto-opens, so it never stomps an installed Mermaid extension. Logic lives in `pickRenderable(document, config, mode)`.

---

**Cross-agent note (Scribe, 2026-06-23):** The new VS Code extension (`extension/`) reuses `render()` (`src/frontend/index.ts`) as its SOLE render path and esbuild-bundles the compiler from `src/`. Any change to the `render(input, themeInput?, rendererName?)` signature, its `Result<string>` SVG contract, or the `src/frontend/detect.ts` `MERMAID_PATTERNS` header table is now a downstream dependency for the extension preview + future IntelliSense. Keep these stable or update `extension/src/extension.ts` in the same PR. SVG-only in P1 (no resvg).
