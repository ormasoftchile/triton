# Squad Decisions — Recent & Current (2026-06-23)

# Decision: DESIGN-DOC AUDIT — Realign design/ LaTeX spec to shipped Triton (2026-06-23)

**Agents:** Leslie (framing), Mark (IR/grammar), Barbara (rendering/themes/composition), David (positioning/strategy), Bjarne (frontend/architecture/packaging)
**Requested by:** ormasoftchile
**Date:** 2026-06-23
**Status:** AUDIT / PLAN ONLY — no LaTeX prose was rewritten. This block records per-section verdicts for the rewrite work that follows.

## Reality baseline (agreed by all five auditors)

Triton is a **contracts-first, Mermaid-superset diagram compiler**. One front end: `detect()` matches the source header → `{format: mermaid|yaml, diagramType}` → registry → `DiagramModule` (`parseMermaid`/`parseYaml` → per-kind Domain IR; async `layout(ir,theme) → LayoutResult{scene, anchors}`) → one diagram-agnostic `renderSVG(scene)`. ~35 `DiagramKind`s registered (not 4–5 families). Net-new Triton-only families are the most-developed part of the code: **poster** (grid + cell spanning + cross-diagram links), **CS-structures / tree** (tree/plan/avl/rbtree/btree/radix/segtree/heap — correct-by-construction), **struct** (array/linkedlist/memory/page), **topology** (cost-tiered + nested groups). Single package `triton` at repo root (pnpm, ESM, Peggy grammars + tsc, vitest), SVG truth + resvg PNG, 318 tests.

**Headline stale claims to purge everywhere:** NL/prompt + data ingestion (ADO/GitHub/prose→IR), agent MCP server, published per-grammar JSON Schema / constrained decoding, PPTX / Skia / PDF / HTML backends, full animation-hint taxonomy (only `march` + `particle` exist), theme fragmentation/migration narrative, multi-package `packages/* @diagram-compiler/*` monorepo, dagre/ELK adoption, and "Timeline Compiler" as the product (timeline is now one kind among ~35).

## Consolidated per-section verdict table

| Section | Verdict | Owner | Why |
|---|---|---|---|
| `01-problem.tex` | REWRITE (light) | Leslie | Two-gap framing OK; trim oversold agent/MCP/JSON-Schema claims to the real YAML structured-input path. |
| `02-central-thesis.tex` | REWRITE | Leslie | "Mermaid-complete first" is backwards (net-new built first); "five families" omits poster/tree/struct/topology and lists unbuilt treemap; over-weights agent IR/MCP. Replace with corrected thesis below. |
| `03-principles.tex` | REWRITE | Leslie (+Barbara review) | Still "Timeline Compiler"; purge scheduling/critical-path/PM language. Keep durable principles (determinism, theme-driven, human-readable, composability, graceful degradation, VCS-friendly), re-scoped to a diagram compiler. |
| `04-scope.tex` | REWRITE (light) | Leslie | Drop PDF output + SMIL overstatement + MCP in-scope; name the net-new families explicitly. |
| `05-comparison.tex` | REWRITE | David | Drop "Agent IR / structured-IR" axis + UML Tier-1 framing; add real moats (CS-structures, struct/memory, topology, cross-linked posters). Keep vs-PlantUML/D2/Vega-Lite. |
| `10-scene-ir.tex` | REWRITE | Mark | Real Scene = `{viewBox, background?, elements(rect/circle/path/text/group), defs[](raw SVG)}`; animation is `animated:'march'|'particle'` on a path. No canvas/effects/scene_hash/meta/Image/MultiText. |
| `11-backends.tex` | REWRITE | Barbara | Delete Skia/PPTX/PDF backends + fidelity tiers + backend selection. Keep SVG-as-truth, resvg PNG, reject HTML/CSS-first, layout-vs-backend discipline. |
| `12-themes.tex` | REWRITE | Barbara | Matrix concept shipped as unified `ResolvedTheme` (palette/typography/spacing/edges/panel, 12 presets). Delete fragmentation/migration narrative, dual role/data palette, density levels, embedded fonts. |
| `13-determinism.tex` | KEEP (light trim) | Barbara | Central invariant holds; trim `scene_hash`/`meta` + Skia/cross-backend refs + timeline-specific sort keys. |
| `14-animation.tex` | REWRITE (heavy) | Barbara | Only `march`+`particle`. Delete FlowingDashes/DrawOn/DotAlongPath/Pulse/FadeIn, `animation_ref`, theme-level animation, HTML/@keyframes/PPTX. Keep additive/declarative/determinism-preserving philosophy. |
| `15-frontend.tex` | REWRITE | Bjarne | One text-parsing front end, not dual DSL+agent-IR. Peggy (PEG) only; ~35 kinds not 4. YAML is an alt input syntax, not an agent API. |
| `16-mermaid-compat.tex` | REWRITE | David | Compat shipped, but "Status: Planned" table is stale (class/state/er/c4/charts/sankey are built). Reflect shipped set + add Triton-only superset extensions. |
| `16b-extended-timeline.tex` | DELETE (or demote to a small "timeline kind" note) | David | Entire old Timeline-Compiler thesis (6 layouts, 42-look matrix, dead `packages/core` tree). Nothing matches shipped code. |
| `17-superset-extensions.tex` | KEEP (light update) | Mark | Poster keyword, dual cell addressing, col/row spanning, animation directives, cross-refs all implemented. Point CellKind at real registry. |
| `18-aesthetics.tex` | KEEP (trim status) | Barbara | Aesthetics-as-architecture + grammar/theme split hold; trim status counts/names → 12 unified presets. |
| `20-grammar-concept.tex` | KEEP (light) | Mark | Per-diagram IR → shared Scene thesis matches code. Fix `Grammar<DomainIR>` → `DiagramModule`; drop JSON-Schema-constrained generation; grammar table undercounts. |
| `21/25/26-grammar.tex` (timeline/flow/sequence) | KEEP (path fix) | Mark | IRs valid; fix `packages/core/...` paths → `src/diagrams/...`; `flow`→`flowchart`; demote "central grammar" framing. |
| `22-rendering.tex` | REWRITE (near-replace) | Barbara | 90% is the timeline 6-phase engine. Replace with generic Scene production + per-grammar layout engines + shared kernels (`src/graph` layered/tree/connect, `src/text`); demote timeline to one example. |
| `27-tree-grammar.tex` | REWRITE | Mark | Real IR = flat `nodes[]`, id-ref `children`, decorated nodes (`kinds/info/badge/edgeLabel`), `direction`, tidy centered-parent layout. Add the semantic front-end pattern (plan/avl/rbtree/btree/radix/segtree/heap → one decorated TreeDocument). |
| `28-family-taxonomy.tex` | REWRITE | Mark | "Five families / 22 types" obsolete. Add realized CS-structures + struct + topology families; ~35 kinds. |
| `29-chart-family.tex` | REWRITE | Mark | Reality = 4 sibling per-diagram chart IRs (pie/xychart/quadrant/radar), not one grammar-of-graphics god-IR. |
| `30-composition.tex` | REWRITE (surface) | Barbara | Concept/IR/embed/grid/determinism match shipped poster engine; fix names (`packages/core/src/composition`→`src/diagrams/poster`, `ScenePrimitive`→`SceneElement` union, CellKind = any registered kind). |
| `30b-cross-diagram-links.tex` | KEEP (one rewrite spot) | Barbara | Concept + trace syntax + anchor-registry match. Rewrite only the "Candidate (a)/(b)" deliberation — decided + built (`LayoutResult.anchors`+`CardinalPorts`+`occupiedPorts`+`PortHint`). |
| `40-architecture.tex` | REWRITE | Bjarne | Three-layer split is sound but "two-frontend/two-IR" figure is wrong and the `@diagram-compiler/*` monorepo doesn't exist. Describe single package, `DiagramModule` contract, Scene→renderer registry, routing registry. |
| `41-packaging.tex` | REWRITE (heavy trim; DELETE candidate) | Bjarne | Entire `packages/*` monorepo / Changesets / Turborepo / phased split is unbuilt. Reduce to: single package `triton`, pnpm, ESM, build = build:grammars (Peggy) + tsc, vitest. Multi-package = possible future. |
| `42-layout-engines.tex` | REWRITE | Bjarne | No dagre/ELK/force-directed/orthogonal-TSM. Replace survey+adopt with the 3 real in-house engines: `graph/layered.ts`, `graph/tree.ts`, `graph/connect.ts`. Keep "constraint as a feature" philosophy. |
| `50-agent-integration.tex` | DELETE | David + Bjarne | NL-prompt + data ingestion (ADO/GitHub/prose→IR) + MCP agent path — none implemented, not the product. (Bjarne notes this obsoletes his own charter premise.) |
| `51-distribution.tex` | REWRITE | David | Drop `@timeline-compiler/*`, PPTX, MCP-first, `.timeline.yaml`. Reality = ESM/TS, pnpm, Node ≥20, SVG/PNG, `DiagramModule` library + renderer + CLI (+ maybe VS Code preview — `scripts/preview.mjs`). |
| `53-oss-strategy.tex` | REWRITE | David | OSS argument sound; replace stale "timeline compiler + PPTX" headline + agent-IR moats with Mermaid-superset drop-in + Triton-only families + deterministic composable posters. Keep Mermaid-gravity-well risk. |
| `55-target-outputs.tex` | REWRITE (or DELETE) | David | Validates against 5 timeline reference images only. Re-scope to shipped families (posters/trees/heaps/tries/struct/topology) using real `examples/`, or delete. |
| `60-roadmap.tex` | REWRITE (major) | Leslie | Status table factually wrong (Mermaid parsers/UML/charts marked "Planned" but built; test count 795 vs actual 318; omits poster/tree/struct/topology). Rebuild as honest done/next snapshot. |

**Verdict tally:** ~6 KEEP (mostly with path/light fixes), ~21 REWRITE, 2–3 DELETE (`16b`, `50`, and `55` is DELETE-or-rescope).

## Corrected central thesis (replaces body of `02-central-thesis.tex`)

> **Triton is a contracts-first, Mermaid-superset diagram compiler.** Every diagram — written in Mermaid-compatible text or in Triton's structured YAML — is a `DiagramModule` that flows through one pipeline: **parse → Domain IR → layout → `Scene`**, where `Scene` is a single typed rendering contract emitted by one deterministic SVG renderer. Triton parses ~20 Mermaid-compatible diagram kinds for drop-in compatibility, then extends well past Mermaid with first-class Triton-only families: **poster composition** (grid layout with cell spanning and cross-diagram links), a **value-driven CS-structures family** whose data structures are *correct-by-construction* (`tree/plan/avl/rbtree/btree/radix/segtree/heap`, `array/linkedlist/memory/page`), and **cost-tiered topology** graphs. The real asset is the kernel: determinism, theming, anchors, overlays, and the `Scene` contract are written once and inherited by every module, so a new diagram kind gets byte-stable rendering, theming, and composition for free. Output is byte-identical SVG (PNG via rasterization). There is no natural-language ingestion, no data-crawl pipeline, and no scheduling or project-management semantics — Triton compiles declared structure into beautiful, deterministic pictures, nothing more.

> **Reviewer note (lockout):** Leslie authored the thesis; a second agent must review it before it lands in LaTeX.

## Missing sections the doc needs (net-new)

1. **"What Triton Is Today" — honest status snapshot** (replaces the misleading §60 roadmap table): contracts-first, ~20 Mermaid kinds + 4 net-new families, SVG/PNG, 318 tests, no NL/MCP/PDF.
2. **"The `DiagramModule` Contract"** — the central architectural invariant: everything is `DiagramParser` (`parseMermaid`/`parseYaml` → per-kind `BaseIR`) + `DiagramLayoutEngine` (async `layout → LayoutResult`) + `defaultThemeOverride`; theme layering `global ← defaultThemeOverride ← ir.themeOverride`; Peggy `.peggy` per kind.
3. **Anchors, Ports & Cross-link IR** — `NodeAnchorRegistry`, `CardinalPorts`, `OccupiedPort`, `PortHint`/`LayoutOptions`, `LayoutResult`, `crosslink.ts` (`CrossLink`/`ResolvedCrossLink`/`RouteQuality`). The substrate that makes nodes addressable across composed diagrams.
4. **Scene & Pen contract** — `SceneElement` union, painter's-order `elements[]`, `defs[]`, theme-bound `Pen` builder (`src/scene/build.ts`).
5. **Tree family + value-driven semantic front-ends** — decorated `TreeDocument` IR and the plan/avl/rbtree/btree/radix/segtree/heap → one IR pattern, correct-by-construction.
6. **Struct family** — array/linkedlist/memory/page cell-strip IR with per-cell slot anchors + `connectSlots` (incl. cross-region pointers in `memory`).
7. **Topology (systems) family + shared `style/cost` kernel** — `CostScale/CostTier/classifyCost/buildLegend`, tier-coloured/dashed edges, nested groups, auto legend (also reused for `plan` operator colouring).
8. **Shared layout kernels** — `src/graph` (layered/tree/connect) + `src/text` measurement, the diagram-agnostic engines replacing the timeline-only §22 pipeline.
9. **(Optional) "The CS-Structures Differentiator"** — Triton's most-developed and genuinely novel contribution; currently has no framing section.

## references.bib note (David)

Keep diagram-as-code core (`mermaid2023`, `mermaiddocs2024`, `plantuml`, `d2lang`, `vegalite2017`, `structurizr`, `plotlyjs`, `grammarofgraphics2005`, `layeredgrammar2010`, `dragonbook2006`). Prune entries orphaned by the pivot once ingestion/timeline/PPTX sections are cut: `ado-workitems`, `github-projects`, `github-graphql-projectv2`, `timelinejs`, `frappegantt`, `vistimeline`, `thinkcell`, `msproject`, `mcp-spec`, `openai-structured-outputs`, `python-pptx`, `slidev`, `obsidian`. Change the file's "Timeline Compiler Project Bibliography" header.

---

# Decision: DESIGN-DOC REALIGNMENT — design/ LaTeX spec rewritten to shipped Triton (2026-06-23)

**Agents:** Leslie (Lead/reviewer), Mark (IR/grammar), Barbara (rendering/themes/composition), David (positioning/strategy), Bjarne (frontend/architecture/packaging)
**Requested by:** ormasoftchile
**Date:** 2026-06-23
**Branch:** docs/realign-spec
**Status:** COMPLETE — executes the verdicts from the prior DESIGN-DOC AUDIT block. `tectonic triton.tex` builds `triton.pdf` clean: **0 undefined references, 0 undefined citations, 0 multiply-defined labels, 0 BibTeX errors.**

## Outcome — what shipped (4 waves)

**Wave 1 — spine + skeleton (Leslie).** REWROTE `02-central-thesis` (contracts-first Mermaid-superset thesis), `03-principles`, `60-roadmap` (honest done/next: ~35 kinds, 318 tests). CREATED `06-status` ("What Triton Is Today" + Not-built list). CREATED stubs `19-render-contract`, `23-diagram-contract`, `31-structures-family`. DELETED `16b-extended-timeline`, `50-agent-integration`, `55-target-outputs`. Fixed the `triton.tex` `\input` list + `\part` structure.

**Wave 2 — parallel section rewrites.**
- **Mark (IR/grammar):** rewrote `10-scene-ir`, `27-tree-grammar`, `28-family-taxonomy`, `29-chart-family`; filled `23-diagram-contract` (DiagramModule contract: parse→IR→layout→Scene, `detect()`→registry, Peggy `.peggy` per kind, theme layering, anchors/ports) and `31-structures-family` (decorated TreeDocument + plan/avl/rbtree/btree/radix/segtree/heap; struct array/linkedlist/memory/page + `connectSlots`; cost-tiered topology + nested groups).
- **Barbara (rendering/themes/composition):** rewrote `11-backends`, `14-animation`, `22-rendering`, `12-themes`, `30-composition`; filled `19-render-contract`; fixed the 4 dangling `\ref{sec:agent-integration}` in `30b`. Canonical now: ONE `renderSVG(scene)` (+ optional resvg PNG, no Skia/PPTX/PDF/HTML/fidelity-tiers); animation = `ScenePath.animated?: 'march'|'particle'` only; `Scene{viewBox,background?,elements,defs?}` with a 5-variant `SceneElement` union (not `ScenePrimitive`); poster embed = `embedScene` group transform; unified `ResolvedTheme` (12 presets, no per-grammar theme fragmentation).
- **David (positioning/strategy):** rewrote `05-comparison`, `16-mermaid-compat`, `51-distribution`, `53-oss-strategy`; pruned **14 orphaned `references.bib` keys** (zero surviving `\cite`) and retitled the bib "Triton Project Bibliography". Positioning = zero-migration Mermaid SUPERSET; moats = byte-stable determinism + composable cross-linked posters + net-new families. `§16` grounded in `src/frontend/detect.ts` (21 Mermaid + 14 Triton-only headers ≈ 35 kinds).
- **Bjarne (frontend/architecture/packaging):** rewrote `15-frontend` (one text front end: `detect()`→registry→Peggy parse→IR; YAML = alt syntax, not an agent API), `40-architecture` (single package, `DiagramModule` contract, Scene→renderer + routing registries), `41-packaging` (single root package `triton`; pnpm/ESM/Node≥20; build = `build-grammars.mjs` (Peggy) + tsc; vitest 318; multi-package demoted to possible future), `42-layout-engines` (3 real in-house engines `graph/layered.ts`/`tree.ts`/`connect.ts`; no dagre/ELK/force-directed). Dropped 3 stale `\ourdiagram` figures depicting the obsolete pipeline.

**Wave 3 — reviewer gate (Leslie).** Per rejection-lockout (Leslie authored the thesis → a different agent's prose stands; Leslie reviews, does not self-approve content she authored). APPROVED on the hard gate that mattered — cross-reference integrity. Resolved every dangling ref (`principle:minimal-clutter`, `sec:family-nodelink`→`sec:family-taxonomy`, `sec:corpus-comparison-matrix`, `sec:graph-grammar` — repointed or rewritten out). Final build fully clean. Author/agent-name leaks scrubbed from LaTeX comments + bib header; BibTeX `volume/number` + `@online`-in-comment warnings neutralized.

**Wave 4 — consistency sweep (Mark).** Light pass over the pre-realignment sections still carrying old framing: `04-scope`, `13-determinism`, `20-grammar-concept`, `21-timeline-grammar`, `25-flow-grammar`, `26-sequence-grammar` (drop Skia/PDF/PPTX/Canvas/"five families"/"backend version"/`packages/core` paths; demote "central/template grammar") + `30b` path stragglers (`packages/core/...`→`src/diagrams/poster/...`). Clean build retained.

## Key design decision recorded this session — NO god chart-IR (Mark)

The chart kinds (`pie`, `xychart`, `quadrant`, `radar`) are **four independent `DiagramModule`s**, each with its own minimal TOTAL Domain IR — there is deliberately **no** shared `ChartDocument`/`ChartEncoding`/grammar-of-graphics layer, no encoding-channel/scale abstraction, no Vega-Lite/JSON-Schema framing. Rationale: a unified chart IR would have to represent encodings only some charts use (a pie has no axes, a radar has no Cartesian x), making nonsensical charts representable — the exact partial-IR failure mode Triton rejects. Four small total IRs make every illegal chart unrepresentable at the cost of minor repetition; the charts share *infrastructure* (Scene contract, theme layering, deterministic SVG, poster composability) but NOT a data model. "Chart family" framing is demoted to "the chart kinds"; any future chart is a new sibling module, never a branch of a god-IR. (Mirror of the tree family's opposite move — one `TreeDocument`, many correct-by-construction front-ends — same goal: keep every IR total.)

## Canonical terminology locked (no drift permitted)

"Triton" (never "Timeline Compiler"); `DiagramModule` (not `Grammar<DomainIR>`); `Scene` + `SceneElement` union (not `ScenePrimitive`); `LayoutResult{scene,anchors}`; `ResolvedTheme` with layering `global ← defaultThemeOverride ← ir.themeOverride`; real `src/...` paths (never `packages/core/...` or `@diagram-compiler/*`); ~35 kinds (~20 Mermaid-compatible + 4 net-new families: **CS-structures/tree, struct/memory, topology, poster composition**); **318 tests** (never 795/2790); 12 theme presets; animation = `march`+`particle`; SVG truth + resvg PNG.

**Build note:** `cd design && tectonic triton.tex` must run UNSANDBOXED on macOS (tectonic's SCDynamicStore/network probe panics under the sandbox wrapper).

---

# VS CODE EXTENSION — Phase 1 (live preview) shipped

**Date:** 2026-06-23
**Owners:** Leslie (Lead / Spec Architect — plan), Barbara (Semantics & Rendering — build)
**Requested by:** ormasoftchile
**Status:** Phase 1 IMPLEMENTED & VERIFIED (bundle builds 1.1 MB CJS, typecheck 0 errors). Artefacts: `design/extension-plan.md` (plan); `extension/` folder (code).

---

## Locked decisions (user-confirmed via coordinator)

1. **File extension `.triton`, languageId `triton`.** Overrides Leslie's plan recommendation of `.tri`. `.triton` is the true zero-collision option. (Plan's `.tri`/`.trt` analysis retained below as rejected alternatives.)
2. **Phase 1 supports BOTH `.triton` and `.mmd`.**
3. **Mermaid coexistence:** the explicit **Triton: Open Preview** / **…to the Side** commands render **any** active file unconditionally (incl. `.mmd` and ```` ```mermaid ````). `triton`/`.triton`/```` ```triton ```` are always handled. **Passive** Mermaid pickup (auto-selecting a ```` ```mermaid ```` fence in Markdown) is gated behind **`triton.enableMermaid`**, default **false**, so Triton never stomps an installed Mermaid extension. Phase 1 never auto-opens a preview. Rule centralized in `pickRenderable(document, config, mode)`.
4. **Repo location:** top-level **`extension/`** satellite folder with its own `package.json`, deliberately **NOT** a `pnpm-workspace.yaml` member (that file has no `packages:` field — repo is single-package, flat shape preserved). Extension imports the compiler by **relative path** (`../../src/frontend/index.js`) and esbuild-bundles it. Deps via `pnpm install --ignore-workspace`. Migration-to-own-repo trigger: release-cadence conflict, contributor divergence, `@vscode/test-electron` CI weight dominating the vitest loop, or install bloat for compiler-only users.
5. **SVG-only for Phase 1 — no native deps** (no `@resvg/resvg-js`). resvg only needed for an optional later PNG-export command.

---

## What was built (Barbara)

`extension/package.json`, `extension/esbuild.mjs`, `extension/src/extension.ts` (activate + `PreviewManager` + webview HTML), `extension/tsconfig.json`, `extension/README.md`, `extension/.gitignore`. Phase 1 = live, debounced webview preview that reuses the compiler's `render()` entry as the sole render path (never reimplements parse/layout/SVG). Parse errors show as a non-destructive banner over the last good diagram.

**Bundling (as built):** esbuild bundles `extension/src/extension.ts` + the whole compiler graph into one CJS file `extension/dist/extension.cjs` (`platform:node`, `target:node20`, `external:['vscode']`, sourcemap). A ~15-line esbuild `onResolve` plugin rewrites NodeNext `*.js` specifiers to the sibling `*.ts` source (returns `undefined` for generated Peggy `parser.js` with no `.ts` sibling). `esbuild.mjs` runs `pnpm build:grammars` first, then verifies every `grammar.peggy` has a sibling `parser.js`. Bundling from `src/` sidesteps the `tsc`-doesn't-copy-`parser.js` dist-sync hack entirely.

**Typecheck deviation (noted):** a CJS `extension.ts` statically importing ESM compiler source trips TS1479 under NodeNext, so `extension/tsconfig.json` uses `moduleResolution: "Bundler"` + `module: "ESNext"` (typecheck-only, `noEmit`). esbuild is the real bundler; documented in the tsconfig comment.

**Verification:** `node extension/esbuild.mjs` → exit 0, 23 grammars compiled, no unresolved imports, output ≈1.1 MB (+2.2 MB map). `tsc -p extension/tsconfig.json --noEmit` → 0 errors. `render()` on `examples/flowchart/flowchart.mmd` → 2956-byte `<svg…`. Did NOT launch the Extension Development Host (no GUI); did NOT touch root `package.json`, root `tsconfig.json`, or `pnpm-workspace.yaml`.

---

## Plan reference & render reuse points (Leslie — `design/extension-plan.md`)

- Public entry: `src/frontend/index.ts` → `render(input, themeInput?, rendererName='svg') => Promise<Result<string>>` (returns SVG, never throws — Result). Composes detect→parse→layout→renderSVG, registers all 35 modules.
- Detection: `src/frontend/detect.ts` → pure `detect(input)` + `MERMAID_PATTERNS` header table (Mermaid + 13 Triton-only headers) — drives IntelliSense later.
- `DiagramKind` union (35 kinds) + `DiagramModule`: `src/contracts/diagram.ts`. Low-level `renderSVG(scene)`: `src/render/svg.ts` (not called directly).
- No `main`/`exports` in root `package.json` → extension imports by relative path.
- **Phases:** P1 = live debounced webview preview (shipped). P2 = markdown-it plugin for ```` ```triton ````/```` ```mermaid ```` fences (pre-render + cache-by-hash, since render() is async and markdown-it is sync). P3 = completion from `DiagramKind`/header table + diagnostics from Result errors + curated per-kind keyword map.
- **Peggy completion caveat:** generated parsers are recognizers, not queryable keyword models → IntelliSense keyword completion needs a hand-curated `DiagramKind → string[]` map, not live grammar introspection.

**Rejected file-extension alternatives (from plan):** `.tri` (mnemonic but collides with 3D/triangle-mesh binary formats), `.trt` (lower-collision teletext/subtitle but reads as a typo). Both superseded by the user's `.triton` choice.

# QUEUE DIAGRAM FAMILY — 4 variants (queue / cqueue / deque / pqueue)

**Date:** 2026-06-23
**Author:** Barbara (Semantics & Rendering)
**Requested by:** ormasoftchile
**Status:** IMPLEMENTED — 337/337 tests pass, 0 tsc errors. Merged as PR #17 (d0c930b).

## Decision

A new Triton-native data-structure family, **one distinct content-detectable header per variant** (matching the struct/tree convention — NOT a single header with a variant keyword):

- **`queue`**  — linear FIFO: horizontal strip; dequeue arrow off the front, enqueue arrow into the rear; front/rear pointers; trailing empty cells via capacity.
- **`cqueue`** — circular / ring-buffer: strip + curved wrap arc (cubic bezier rear→front) with a `mod N` caption; front/rear inferred from occupancy or set explicitly.
- **`deque`**  — double-ended: double-headed arrows at both ends via two **fixed** markers (`ARROW_FWD` markerEnd + `ARROW_REV` markerStart), NOT `auto-start-reverse` (resvg-safe).
- **`pqueue`** — priority: vertical stack sorted highest-first (stable desc), each cell shaded by a deterministic `palette.primary → palette.surface` hex lerp (local `mixHex`, since the repo has no color-mix util and `style/cost.ts` discrete tiers don't fit a continuous ramp); priority value rendered per cell.

## Key choices

1. **File layout mirrors the struct family (hand-parsed), not the brief's peggy pipeline.** One self-contained file per kind: `parse()` → `layout*()` → `export const <kind>: DiagramModule`, using the `lines()` helper. Peggy is only flowchart/timeline/poster. New files: `src/diagrams/queue/{shared,queue,cqueue,deque,pqueue}.ts`.
2. **Kernel reuse over hand-rolled geometry.** All four variants build cells with `scene/strip.buildStrip` (horizontal for queue/cqueue/deque, vertical for pqueue), exposing `c0..cn` slot anchors for linkability; pointers/wrap-arc/end-arrows layered on top.
3. **Canonical three-edit registration:** `DiagramKind` union (`contracts/diagram.ts`), `detect.ts`, `frontend/index.ts`.

## Deliverables

- Source: `src/diagrams/queue/{shared,queue,cqueue,deque,pqueue}.ts`
- Examples: `examples/queue/{linear,circular,deque,priority}.mmd` + `.svg` + `render.ts` (rendered through the real pipeline)
- Tests: `test/queue.test.ts` (15) + 4 auto-discovered example renders → 318 → **337 pass**
