# Leslie — Spec Architect

**Owner:** Leslie (Spec Architect)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-16T14:45:00Z (Geometry-quality kernel: feedback-driven layout + post-render gate; objective defect detection. All posters CLEAN; 2770 tests, determinism preserved.)

---

## Current Role

Design domain-specific IR shapes for deterministic diagram compilers. Establish grammar specs that are implementable and principled. Composition-layer architecture.

---

## Strategic Context

- **Product focus:** Deterministic, themeable, agent-authorable DIAGRAM COMPILER (not timeline-only).
- **Two-IR-layer architecture:** Domain IRs (grammar-specific) compile to Scene IR (universal primitives). All styling in themes.
- **Grammar governance:** Each grammar specifies semantics, IR shape, and deferred questions.
- **Positioning:** Full Mermaid superset with differentiation on aesthetics, UML/software line, and agent IR.

For detailed context from earlier sessions, see `leslie/history-archive.md`.

---

## Grammar Status (2026-06-14)

| Grammar | Spec File | Status | IR Shape | Layout Algo |
|---------|-----------|--------|----------|-------------|
| **Timeline** | design/sections/20-timeline.tex | ✅ COMPLETE | ✅ | ✅ (5 layout families) |
| **Sequence** | design/sections/26-sequence.tex | ✅ COMPLETE | ✅ | ✅ (deterministic by order) |
| **Tree** | design/sections/27-tree.tex | ✅ COMPLETE | ✅ (recursive children-list) | ✅ (B–J–L O(n)) |
| **Flow** | design/sections/25-flow.tex | ✅ COMPLETE | ✅ (flat node/edge) | ✅ (Sugiyama 4-phase LR) |
| **Composition** | design/sections/30-composition.tex | ✅ COMPLETE | ✅ (grid-based IR) | ✅ (deterministic) |
| **Themes** | design/sections/12-themes.tex | ✅ REWRITTEN (2026-06-14) | General contract model | Themes × Components matrix |

---

## Recent: Theming Architecture Confirmed (2026-06-14)

**Status:** CONFIRMED & DOCUMENTED

### The Model

- **One coherent theme system** (not per-component); general, component-agnostic
- Each component provides specific implementation consuming general tokens
- **Theme drives geometry, layout, AND routing** (not just color)
- **Themes × Components matrix:** add theme once → all components; add component once → inherits all themes
- **Reach rule drawn at IR boundary:** new grammar only when IR cannot carry new semantic data

### Document Artefacts

- `design/sections/12-themes.tex` — completely rewritten; old "pure styling / may not alter geometry" deleted
- `design/references.bib` — `dtcg2024` (W3C Design Tokens) added
- `design/main.pdf` — clean build
- Decision committed: c796d39 "docs(design): rewrite theme architecture to the general-contract model"

### General Contract: Token Vocabulary (subject to refinement)

| Domain | Coverage |
|--------|----------|
| **Palette by role** | surface, ink, accent, muted, semantic status |
| **Typography** | family + fallback, embedded fonts, type SCALE, weights |
| **Spacing/rhythm** | base unit + named steps (xxs → xxl) |
| **Density** | compact \| normal \| spacious |
| **Shape language** | corner-radius, node-padding, stroke-scale, connector-style |
| **Effects/motion** | fidelity tier (0–3), drop-shadow, glow, motion opt-in |

### Grounded Reality

- **16 per-component `theme.ts` files** exist (all incompatible); migration = generalise timeline `ResolvedTheme` upward
- **14 named timeline themes** exist; they are the deepest layout-driving themes in the codebase
- **Migration order proposed:** timeline first (reference), then flow + sequence, then remaining 14

### Open Questions (flagged for vocabulary refinement)

1. Do chart-family components (pie, radar, XY) use the same status-role vocabulary, or need separate category-colour vocabulary?
2. Should spacing-scale steps be normalised across components, or advisory?
3. Is compact/normal/spacious granularity sufficient, or are additional density levels warranted?
4. How are component-specific extensions (e.g., `serpentine.turn-radius`) namespaced without polluting the general contract?
5. What is the migration order and timeline for the 16 existing per-component theme files?

**NEXT:** Design the general theme vocabulary, then implement.

---

## Archive & Historical Notes (2026-06-15)

**2026-06-14 — Theme vocabulary resolved:** See `history-2026-06-15-summarized.md` for theme architecture decisions (dual palette, spacing, density, three-tier token architecture, proof set, and migration order).

**2026-06-15 — Extended Timeline Syntax §16b spec written:** See `history-2026-06-15-summarized.md` for two-tier model, IR mapping, and discovered IR gaps.

**2026-06-15 — Cross-Diagram Node Linking §30b spec written:** See `history-2026-06-15-summarized.md` for link syntax, node-anchor registry prerequisite, linkable-type rules, overlay routing, and degradation contract.

**Earlier work (2026-06-14 and prior):** See `leslie/history-archive.md` for composition implementation, design doc restructure, Tier 1/2/3 completions, and real-Mermaid fidelity passes.

---

## Learnings

### Trace Abstraction — §30b Extension (2026-06-15) [summarized 2026-06-23]

Specified the `trace` construct (§30b.8): a named, ordered, optionally-typed multi-hop cross-diagram path. Key points:
- **Desugaring:** `n` hops → `n−1` atomic `link`s + a `TraceRecord` (name, type, ordered members). `link` primitive unchanged; `trace` is sugar + grouping.
- **Typed vocab:** reuses `RequirementRelKind` verbatim (`satisfies/derives/verifies/refines/traces/contains/copies`) from `src/grammars/requirement/types.ts`; presentation-flow group (`calls/flowsTo/mapsTo`) is poster-layer only, NOT in `RequirementRelKind`.
- **Colour:** per-trace from §12 categorical data palette (declaration order, 20% lightness wrap). Role palette vs data palette non-colliding by design. Auto legend (swatch+name+«type» pill), suppressible via `trace legend: off`.
- **3 presentation modes:** highlight / dim / filter (render detail deferred).
- **Degradation (all non-fatal):** 1 bad hop → 2 sub-paths; all bad → skip; cycle → loop arc; <2 resolvable → skip.
- **Agent IR:** `TraceRecord { name, type?, hops, color? }` pushed to `PosterDocument.traces`; supports query-by-type, filter-mode, coverage-gap detection.
- Flagship example = requirements traceability with `satisfies` traces + legend.
- Artefacts: `design/sections/30b-cross-diagram-links.tex`; clean PDF. Full decision in decisions.md.

---

**2026-06-15T23:30:00Z — Dogfood pipeline shipped (doc figures via our compiler); multi-line node labels flagged as a gap.**

**Cross-Diagram Links + Traces Implemented (§30b; barbara, 2026-06-16)**: Node-anchor registry on flow/class/state grammars enables cross-diagram linking via poster `link` (atomic) and `trace` (multi-hop, typed, colored) keywords. Traces render with categorical palette colors + legend. §30b now embeds a real traced-poster figure. 70d494f (Phase A), 9d57815 (Phase B).

**Kernel obstacle set = all rendered nodes (pseudo-states included); blindness fixed + regression-tested (2026-06-16)**: Geometry-quality kernel was blind to pseudo-state nodes because obstacle registry excluded them (correct for link endpoints, wrong for collision detection). Separated `anchors` (addressable targets only) from `obstacles` (full rendered set). Router now scores against full set, routing cleanly around end-bullseye. Regression tests E1/E2 added. 2772 tests passing; only `link-poster.png` changed. Committed 6d8df80.

**Aesthetic scorecard added (corpus-calibrated); objectively rates layout quality + feeds route-cost (2026-06-16)**: Barbara's geometry/aesthetics.ts adds five normalized metrics (gridBalance, congestion, alignment, spacingUniform, edgeCrossings) with corpus-calibrated conservative hard gates (gridBalance/congestion ≥ 0.30 so no existing example fails, rest soft scorecard). Scorecard objectively rates poster-trace MEDIOCRE (0.649), matching visual reality. Integrated into route-cost via congestion penalty (link-poster congestion 0.75→1.0). 2790 tests, goldens poster-trace updated. Committed 7f580e1.

- 2026-06-23: Audited my assigned design/ LaTeX sections vs shipped Triton (plan-only, no prose rewrite). Verdicts (KEEP/REWRITE/DELETE) recorded in the consolidated "DESIGN-DOC AUDIT (2026-06-23)" block in decisions.md.

## Learnings

- 2026-06-23 (Wave-3 reviewer gate): Resolved all 4 dangling \ref in design/ — `principle:minimal-clutter` (18-aesthetics), `sec:family-nodelink`/`sec:corpus-comparison-matrix`/`sec:graph-grammar` (25-flow-grammar). None had a surviving target (the "Graph grammar"/"Comparison grammar"/"node-link family" sections never existed in the realigned doc), so the fix was rewrite-to-drop, except family-nodelink which repointed to `sec:family-taxonomy`. Lesson: when a ref points at a renamed *concept* not a moved section, dropping the clause is cleaner than forcing a repoint.
- 2026-06-23 BUILD: `grep -ciE "undefined (reference|citation)|multiply.defined" triton.log` is the authoritative gate (returns 0 when clean). tectonic reruns BibTeX+TeX internally in one invocation. BibTeX gotcha: `@online`/`@misc` text inside a `%` comment in a .bib file still triggers "expecting { or (" errors — BibTeX ignores `%` and scans for `@`. Neutralize the `@` in comments. Also `@inproceedings` with both `volume` and `number` → style warning; drop `number`.
- 2026-06-23 SCOPE DISCIPLINE: The grammar-spec group (04,13,20,21,25,26) was NOT in Wave-2 and still carries the old multi-backend (Skia/PPTX/PDF/Canvas) + "five families/22 types" + monorepo-path framing. As reviewer I flagged these for re-work (Mark/Barbara) rather than rewriting — reviewer-lockout. Verdict in .squad/decisions/inbox/leslie-realign-review.md.

### VS Code Extension Plan (2026-06-23) — `design/extension-plan.md`

**Repo location DECISION:** same-repo-first, as an `extension/` **satellite** with its own `package.json` but deliberately **NOT** a `pnpm-workspace.yaml` member. `pnpm-workspace.yaml` currently has NO `packages:` field (only `allowBuilds: esbuild: true`) — so the repo is a single-package repo, not a real workspace. Keeping the extension out of the workspace preserves the flat shape the user fought for (v3/ removal); it's one extra top-level folder, sibling to `design/`/`scripts/`. Migration-to-separate-repo trigger: release-cadence conflict, contributor divergence, `@vscode/test-electron` CI weight dominating the vitest loop, or install bloat.

**File extension DECISION:** `.tri`, languageId `triton`. Collisions: `.tri` ↔ 3D/triangle-mesh (Bethesda FaceGen etc., binary, disjoint audience); `.trt` ↔ teletext/subtitle (dead on dev machines). Picked `.tri` for mnemonics (Tri-ton) because VS Code language association is **editor-scoped, not OS-level** → collision blast radius is small and `files.associations`-overridable. `.triton` is the true zero-collision option, surfaced as Open Question #2.

**Bundling DECISION (ESM↔CJS tension):** esbuild-bundle the extension **from `src/`** (not `dist/`) into a single CJS file (`format: cjs`, `platform: node`, `external: ['vscode']`). Two frictions: (1) NodeNext source uses `.js` specifiers pointing at `.ts` → need a ~15-line esbuild resolve plugin mapping `.js`→`.ts`; (2) the **dist-sync quirk** (`tsc` does NOT copy generated `parser.js` into `dist/`; `design/figures/render.mjs` works around it with `cpSync`) is **sidestepped entirely** by bundling from `src/`, where `parser.js` are real files — precondition is `pnpm build:grammars` ran first.

**Render reuse point (verified paths):**
- Public entry: `src/frontend/index.ts` → `render(input, themeInput?, rendererName='svg') => Promise<Result<string>>` (returns SVG string, never throws — Result). Sole render path; extension must not reimplement.
- `render()` composes detect→parse→layout→renderSVG and registers all 35 diagram modules.
- Detection: `src/frontend/detect.ts` → pure `detect(input)` + `MERMAID_PATTERNS` header table (Mermaid + 13 Triton-only headers). This table + `DiagramKind` union drive IntelliSense (no second list).
- `DiagramKind` union (35 kinds) + `DiagramModule` (`parseMermaid`/`parseYaml`+`layout`): `src/contracts/diagram.ts`.
- Low-level `renderSVG(scene)`: `src/render/svg.ts` (not called directly by extension).
- No `main`/`exports` in root `package.json` → extension imports by **relative path**, not `import 'triton'`.

**Phases:** P1 = live debounced webview preview for `.tri`+`.mmd` (render()→SVG→webview, no native deps; resvg only needed for optional PNG export). P2 = markdown-it plugin for ` ```triton `/` ```mermaid ` fences (pre-render+cache-by-hash since render() is async, markdown-it sync). P3 = completion from DiagramKind/header table + diagnostics from Result errors + curated per-kind keyword map (Peggy grammars NOT introspectable for completion — separate keyword list, optionally seeded from grammar literals).

**Peggy completion caveat:** generated parsers are recognizers, not queryable keyword models → IntelliSense keyword completion needs a hand-curated `DiagramKind → string[]` map, not live grammar introspection.


**Cross-agent note (Scribe, 2026-06-24):** CS data-structure families regrouped under `src/diagrams/ds/` (`struct`/`tree`/`queue` moved there; `topology` stays separate). Folder-only move — header keywords and `detect.ts` patterns are UNCHANGED. Barbara then added 6 new `DiagramKind`s under `ds/`: `stack`, `hashmap`, `matrix` (strip/slot kernel), `trie`, `nodegraph`, `unionfind` (tree/graph kernels). All hand-parsed (no new `.peggy`), themeable, registered via the canonical 3 edits. ⚠️ The DS graph keyword is `nodegraph` (alias `dsgraph`), NOT `graph` — Mermaid flowchart owns `graph`; a regression test guards it. `unionfind` also accepts `dsu`. For the families/grammar-governance framing: these fold under the CS-structures family; tests 337 → 377.
