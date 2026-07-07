## # Bjarne — Ingestion Design


## Learnings

**Diagram-Options Group A — class, state, er, c4, requirement (2026-07-06)**:
Wrote 5 grammar-derived option fragments to `docs/diagram-options/_fragments/`:
- `class.md`, `state.md`, `er.md`, `c4.md`, `requirement.md`

**`%%` comment support (Group A):** ALL FIVE families return 0 from
`grep -c '%%' src/diagrams/mermaid/<family>/grammar.peggy`. None define a Comment rule.
No `%%` headers were added to any example `.mmd` files. All 5 fragments carry the
fallback note and omit the Comments section.

**Key grammar facts per family:**
- **class** — RelTok has 14 explicit alternatives (`<|--`, `--|>`, `<|..`, `..|>`, `*--`, `--*`,
  `o--`, `--o`, `<--`, `-->`, `<..`, `..>`, `--`, `..`). Cardinality = quoted string on
  either side. Stereotype = `<<name>>` inside class block. `note` keyword accepted-but-discarded.
- **state** — Only one transition arrow (`-->`). Special nodes via `state id <<choice|fork|join>>`.
  `direction` keyword accepted by DirectiveLine but returns null (Triton ignores it). Composite
  states via `state name { … }`. `[*]` maps to start (source) or end (target) pseudo-state.
- **er** — ErTok pattern: `[|}{o][|}{o](--|..)[|}{o][|}{o]`. Attribute keys: `PK`, `FK`, `UK`.
  Relation label is required (quoted or bare text). No direction rule.
- **c4** — 5 header variants (C4Context/Container/Component/Dynamic/Deployment). NodeKind is
  freeform identifier mapped by `kindOf()` to 8 IR kinds. 4 boundary types. Relations:
  `Rel`, `Rel_Ext`, `BiRel`. `title` is the only config keyword.
- **requirement** — ReqKind has 7 alternatives (case-insensitive). No Frontmatter rule (unique
  in Group A). Relationship type is unconstrained `Ident`; conventional types from ir.ts comment:
  `satisfies`, `contains`, `refines`, `derives`.

**Fragment paths:**
- `docs/diagram-options/_fragments/class.md`
- `docs/diagram-options/_fragments/state.md`
- `docs/diagram-options/_fragments/er.md`
- `docs/diagram-options/_fragments/c4.md`
- `docs/diagram-options/_fragments/requirement.md`

**Extension Phase 3 — IntelliSense (completion + diagnostics) (2026-06-24)**:
Built two providers, confined to `extension/` (core `src/` untouched — verified `git diff src package.json` empty).
- **Completion source = `src/frontend/detect.ts` MERMAID_PATTERNS, not invented.** Authored
  `extension/src/keywords.ts` with `DIAGRAM_HEADERS` (50 header entries) mirroring the real
  detect table — each `insert` token feeds back through core `detect()` to the expected
  `DiagramKind` (sanity check: 50 checked, 0 mismatches). `flowchart`/`graph` alone reach
  'flowchart' via detect's DEFAULT (patterns need trailing `\s`), still the correct kind.
  Per-kind body keywords (`KIND_KEYWORDS`) are a MODEST hand-curated set grounded in real
  `examples/*.mmd` and `grammar.peggy` literals (verified c4/sequence literals via grep);
  Peggy grammars are NOT introspectable for completion (per the plan), so curation is expected.
- **Diagnostics error→range mapping: core `DiagramError` carries NO position** (just
  `{code, message}` in `src/contracts/result.ts`). BUT parse failures wrap the thrown Peggy
  `SyntaxError` as `error.cause`, and that DOES carry `.location.start/end {line, column}`
  (1-based; confirmed in generated `parser.js` `peg$SyntaxError`). So `diagnostics.ts` maps to
  the precise Range when `cause.location` is present (1-based→0-based, zero-width widened to
  line end), else FALLS BACK to underlining the first non-blank line. `renderSync` returns a
  Result and never throws (broken `flowchart LR\n A --> ` → PARSE_ERROR, loc 2:9). Debounced
  by `triton.preview.debounceMs` (default 150). Severity Error; `diag.code` = error code.
- **Markdown ```triton fences supported for BOTH providers** via `extension/src/triton-fences.ts`
  (`findTritonFences`/`tritonFenceAt` — line-offset aware, unlike markdown.ts `extractFencedBlocks`
  which only returns body text). `extension/src/source-shape.ts` shares frontmatter/header-line
  logic between completion (header-vs-body) and diagnostics (fallback range).
- Files: `extension/src/{keywords,completion,diagnostics,triton-fences,source-shape}.ts`;
  registered in `extension/src/extension.ts` `activate()` via `registerCompletion(context)` +
  `registerDiagnostics(context)`. Build: `node extension/esbuild.mjs` → 1.2 MB (1,278,181 bytes),
  exit 0. `tsc -p extension/tsconfig.json --noEmit` → 0 errors. Decision note:
  `.squad/decisions/inbox/bjarne-extension-intellisense.md`.

**Wave-2 design realign — front-end/architecture/packaging/layout (2026-06-23)**:
Rewrote `15-frontend`, `40-architecture`, `41-packaging`, `42-layout-engines` to match
shipped Triton. Key reality (grounded in code, blunt about the obsolete charter premise):
- My charter's "data + prompt → IR" ingestion premise is DEAD. There is NO data ingestion
  and NO NL pipeline. The real front end is pure text parsing: `src/frontend/detect.ts`
  matches the source HEADER (ordered regex table, ~35 patterns) → `{format, diagramType}`;
  `src/frontend/registry.ts` maps `DiagramKind` → `DiagramModule`; module `parseMermaid`
  or `parseYaml` lowers text → per-kind Domain IR. YAML is just an alternate syntax for the
  same IR (NO published JSON Schema, NO agent API, NO constrained decoding).
- Architecture is 3 layers in ONE package via import direction (front-end → modules →
  kernel), NOT separate artifacts and NOT two IRs. One render contract `Scene`, one
  `renderSVG`. Held together by 3 in-process registries (diagram/renderer/router) populated
  in `src/frontend/index.ts`. `layout(ir,theme)` is async → `LayoutResult{scene,anchors}`.
- Packaging: single root package `triton` (pnpm, ESM, node>=20, only runtime dep `peggy`).
  Build = `scripts/build-grammars.mjs` (peggy.generate per `src/diagrams/*/grammar.peggy`
  → parser.js+parser.d.ts) then `tsc`. 318 vitest tests. NO `@diagram-compiler/*` monorepo,
  NO Changesets/Turborepo/phased split — multi-package is a possible future only.
- Layout: NO dagre/ELK/force-directed/orthogonal-TSM. Exactly 3 in-house engines in
  `src/graph/`: `layered.ts` (longest-path Sugiyama-lite, used by class/state/er),
  `tree.ts` (centered-parent tidy tree, used by tree/avl/rbtree/btree/radix/segtree/heap/plan),
  `connect.ts` (borderPoint/slotAnchor/connectSlots edge helpers). Charts/strips/posters use
  direct kind-specific geometry, no general engine. Kept "constraint as a feature" philosophy.
- Dropped 3 stale figures (`dual-frontend`, two-IR `architecture`, `three-layers`) — their
  .mmd sources depict the obsolete pipeline; dropping the `\ourdiagram` includes keeps the
  doc compiling without shipping misleading figures.
- Build gate PASSED: `cd design && tectonic triton.tex` → triton.pdf (1.88 MiB), only
  cosmetic hbox warnings, no undefined refs/cites. tectonic panics under the sandbox
  (macOS system-configuration network probe) — must run UNSANDBOXED.


## Current Status (2026-06-16)

**Geometry-Quality Kernel: Feedback-Driven Layout + Post-Render Gate (2026-06-16)**: Barbara's deterministic kernel (detectors: edgeThroughNode/labelOverNode/labelLabelOve

(Earlier work summarized — see history-archive.md for full details.)


## Technical Details

See `history-archive.md` for detailed learnings on CLI rendering, Makefile pipeline, LaTeX macro integration, High-DPI PNG, ASCII-to-diagrams patterns, and architecture diagram authoring conventions.

**Cross-Diagram Links + Traces Implemented (§30b; barbara, 2026-06-16)**: Node-anchor registry on flow/class/state grammars enables cross-diagram linking via poster `link` (atomic) and `trace` (multi-hop, typed, colored) keywords. Traces render with categorical palette colors + legend. §30b now embeds a real traced-poster figure. 70d494f (Phase A), 9d57815 (Phase B).

**Kernel obstacle set = all rendered nodes (pseudo-states included); blindness fixed + regression-tested (2026-06-16)**: Geometry-quality kernel was blind to pseudo-state nodes because obstacle registry excluded them (correct for link endpoints, wrong for collision detection). Separated `anchors` (addressable targets only) from `obstacles` (full rendered set). Router now scores against full set, routing cleanly around end-bullseye. Regression tests E1/E2 added. 2772 tests passing; only `link-poster.png` changed. Committed 6d8df80.

**Aesthetic scorecard added (corpus-calibrated); objectively rates layout quality + feeds route-cost (2026-06-16)**: Barbara's geometry/aesthetics.ts adds five normalized metrics (gridBalance, congestion, alignment, spacingUniform, edgeCrossings) with corpus-calibrated conservative hard gates (gridBalance/congestion ≥ 0.30 so no existing example fails, rest soft scorecard). Scorecard objectively rates poster-trace MEDIOCRE (0.649), matching visual reality. Integrated into route-cost via congestion penalty (link-poster congestion 0.75→1.0). 2790 tests, goldens poster-trace updated. Committed 7f580e1.

- 2026-06-23: Audited my assigned design/ LaTeX sections vs shipped Triton (plan-only, no prose rewrite). Verdicts (KEEP/REWRITE/DELETE) recorded in the consolidated "DESIGN-DOC AUDIT (2026-06-23)" block in decisions.md.

- 2026-06-24: **Extension Phase 3 — IntelliSense SHIPPED** (completion + diagnostics). Merged to decisions.md "EXTENSION PHASE 3 — IntelliSense (completion + diagnostics) (2026-06-24)" block. Completion headers sourced from real `src/frontend/detect.ts` (50 entries, 0 mismatches with core `detect()`); per-kind keywords curated from real `examples/` + `grammar.peggy`. Diagnostics map Peggy `SyntaxError.location` (1-based line/column) to precise VSCode Range (zero-width → line end fallback). Markdown ` ```triton ` fences first-class for both providers via shared offset-aware `tritonFenceAt()`. Confined to `extension/` (core untouched). Bundle 1.2 MB, typecheck 0.


## 2026-07-06 — Diagram Options Reference (Team Delivery)

**Scribe note:** Diagram-options feature completed. All 45 fragments assembled into central reference; 4 families have inline `%%` headers in examples (flowchart/9, sankey/1, timeline/9, poster/7); pnpm test: 384 pass.


## Learnings

**Group A inline `%%` headers — post central-stripping (2026-07-07)**:
`%%` comments now work in ALL diagram families via central preprocessor `stripComments()` in
`src/frontend/preprocess.ts` (strips full-line `%%` comment lines before parsing — 404 tests pass).
Added `%%` options-header blocks to the 1 `.mmd` file in each of the 5 Group A families:
- `examples/mermaid/class/class.mmd` — after `classDiagram`
- `examples/mermaid/state/state.mmd` — after `stateDiagram-v2`
- `examples/mermaid/er/er.mmd` — after `erDiagram`
- `examples/mermaid/c4/c4.mmd` — after `C4Context`
- `examples/mermaid/requirement/requirement.mmd` — after `requirementDiagram`

Removed the fallback note ("> **Note:** This grammar does not define a `%%` comment rule…") and
added `### Comments` section to each corresponding fragment:
- `docs/diagram-options/_fragments/class.md`
- `docs/diagram-options/_fragments/state.md`
- `docs/diagram-options/_fragments/er.md`
- `docs/diagram-options/_fragments/c4.md`
- `docs/diagram-options/_fragments/requirement.md`

All 5 `node scripts/preview.mjs examples/mermaid/<family>/` runs: exit 0, SVG regenerated clean.
Header content strictly grammar-derived (matches each fragment). No invented tokens.

## 2026-07-07 — Group A %% Headers (5 files)

Added %% options header blocks to 5 Group A Mermaid families (class/state/er/c4/requirement). Updated 5 fragments: removed fallback notes, added ### Comments sections. All SVGs exit 0.
