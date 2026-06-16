# Squad Decisions — Recent & Current (2026-06-16)

---

# Decision: ASCII DIAGRAMS → DOGFOOD FIGURES COMPLETE

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-16  
**Status:** COMPLETE — 9 hand-drawn ASCII/box diagrams across design doc replaced with real figures authored in our DSL + rendered by our compiler  

## Summary

Batch 1 and Batch 2 ASCII-to-diagrams conversion complete. All 9 convertible ASCII/box diagrams from the design document replaced with figures authored in our Mermaid-superset DSL, rendered by the timeline compiler, and embedded via the `\ourdiagram` LaTeX macro. Figures use `executive` theme with `flowchart LR` orientation and multi-line labels via `<br>` (enabled by the MULTI-LINE NODE LABELS implementation).

**Converted figures (12 total including prior dogfood):**
- Batch 1 (7): `three-layers` (§40), `two-ir-model` (§20), `composition-ir` (§20), `dual-frontend` (§15), `backend-arch` (§11), `canvas-layout` (§22), `rag-poster-layout` (§30)
- Batch 2 (2): `central-pipeline` (§02), `distribution-arch` (§51)

All figures pass dimension guards (height ≤ 5000px, aspect ≤ 4:1); no surrounding LaTeX `\begin{figure}` wrappers needed (provided by `\ourdiagram`). Original figure labels dropped (none referenced elsewhere via `\ref`).

Non-diagram blocks (code listings, YAML, DSL syntax, LaTeX tables) left as-is. §30b trace-overlay illustrations remain text (spec-only feature, no ASCII art exists in section).

**Commits:** 0ffed7f (Batch 1), 8559ed7 (Batch 2).

---

# Decision: DOGFOOD PIPELINE — Design Doc Diagrams Rendered by Our Compiler

**Agent:** Bjarne (Ingestion Design), Barbara (Semantics & Rendering), Coordinator  
**Date:** 2026-06-15  
**Status:** COMPLETE — CLI renders .mmd (--scale high-DPI PNG); design/Makefile `figures` target; \ourdiagram macro; 3 figures dogfooded (architecture §40, family-taxonomy §28, theme-contract §12); committed 8ac76cf; 2659/2659 tests passing

## Summary

Design document diagrams now rendered by the compiler they describe. CLI enhanced to render Mermaid-superset `.mmd` files with `--scale` zoom factor for high-DPI PNG output. Automated pipeline via `design/Makefile` `figures` target. Three figures authored in our DSL, placed in the document, and regenerated via `make figures`. Reusable recipe for other LaTeX documents: create `figures/src/*.mmd`, add `\ourdiagram` macro to preamble, run `make figures` before building PDF. PNG chosen over SVG→PDF (no converter installed; PDF already embeds PNG cleanly). **Native vector PDF output is a future enhancement.**

## Technical Details

- **CLI routing** (`packages/cli/src/index.ts`): `.mmd` detection → `parseMermaid` + `--scale` option (default 3 for .mmd)
- **svgToPng enhancement** (`packages/core/src/render/png.ts`): optional `scale?: number` parameter using Resvg `fitTo: { mode: 'zoom' }`
- **Makefile pattern rule**: `timeline render <src>.mmd --format png --scale 3 -o figures/<name>.png`
- **\ourdiagram macro** (`design/main.tex`): includes PNG, caption, source footnote
- **3 dogfood figures**: architecture (flowchart LR, executive), family-taxonomy (mindmap, blueprint), theme-contract (flowchart LR, executive)
- **Determinism**: all figures produce stable sceneHash; PNG bytes identical across runs

---

# Decision: PRODUCT GAP — Multi-Line Node Labels Unsupported

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-15  
**Status:** RESOLVED (implementation shipped; see MULTI-LINE NODE LABELS — IMPLEMENTED below)

## Summary

Flow/tree (and likely other) layouts render `\n` and `<br>` in node labels LITERALLY (pass raw text to a single `TextPrimitive`, no line-break interpretation). Surfaced during dogfooding when figures showed literal backslash-n in node labels. Workaround: use single-line labels. **Tier-2 feature gap** — not a blocker for shipping, tracked on product backlog.

## Root Cause

`extractLabel` in flowchart parser and tree layout engine strip quotes but do NOT interpret `\n`/`<br>`. No code path reaches `MultiTextPrimitive` for node labels.

## Future Fix

In label extraction, detect `\n` (and optionally `<br>`/`<br/>`) and emit `MultiTextPrimitive` instead of `TextPrimitive`. Update `measureText`/node-sizing to use widest line for width and `lines × lineHeight` for height. **Determinism-sensitive:** verify no existing golden uses `\n` in a label (likely none — no existing golden should split).

## Workaround

Single-line labels. Both dogfood figures re-authored with single-line labels; no renderer code touched.

---

# Decision: MULTI-LINE NODE LABELS — IMPLEMENTED

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-15  
**Status:** SHIPPED — gap closed; 2687/2687 tests pass  
**Resolves:** PRODUCT GAP — Multi-Line Node Labels Unsupported (decision above)

## Summary

Multi-line node labels now supported. Authors use `<br>` / `<br/>` / `<br />` (case-insensitive) or `\n` in any node label; labels render as stacked lines with correct node sizing. New utility `packages/core/src/util/label-lines.ts` exports `splitLabelLines()`. Applied to flow, tree (tidy + radial/mindmap), state (title), C4 (description); mindmap parser preserves `<br>`.

## Grammars Updated

| Grammar | File | Coverage |
|---------|------|----------|
| **flow** | `grammars/flow/layout.ts` | Node labels (all shapes) |
| **tree** | `grammars/tree/layout.ts` | Node labels (tidy-tree) |
| **tree/radial** | `grammars/tree/layoutRadial.ts` | Root circle + child boxes (mindmap) |
| **state** | `grammars/state/layout.ts` | State title field |
| **C4** | `grammars/c4/layout.ts` | Element description (`<br>` → real line break) |
| **mindmap** | `frontend/mermaid/mindmap.ts` | Parser preserves `<br>` |

## Determinism

Grepped all fixtures/goldens: no existing flow/tree/state fixture had `<br>` or `\n` in a label. Change purely additive except:
- **C4 gallery SVG** (`examples/gallery/executive-c4.{svg,png}`): regenerated — C4 descriptions with `<br>` now wrap correctly (intentional improvement).
- **Mindmap corpus test**: one test updated (now correctly asserts `<br>` preserved).

## Tests & Dogfood

- 28 new tests in `packages/core/test/label-lines.test.ts` covering `splitLabelLines`, flow, tree multi-line assertions, node sizing.
- Dogfood figures (`design/figures/src/theme-contract.mmd`, `family-taxonomy.mmd`) now use real multi-line labels with `<br>`.
- All 2687 tests pass; existing goldens byte-identical except intentional C4 gallery improvement.

---

# Decision: TRACE ABSTRACTION SPEC (design §30b.8)

**Agent:** Leslie (Spec Architect)
**Date:** 2026-06-15
**Status:** SPEC WRITTEN — design/sections/30b-cross-diagram-links.tex extended; PDF clean

## Summary

Multi-hop named/typed/ordered cross-diagram traces represent system traceability across poster layers. A `trace` is the flagship application of the cross-diagram linking feature. Syntax: `trace "name" [type] : A1.x -> B1.y -> ...` desugars to ordered atomic links + a trace-group.

Typed traces reuse RequirementRelKind (satisfies/derives/verifies/refines/traces/contains/copies) + poster-layer types (calls/flowsTo/mapsTo). Each trace assigned categorical-palette color + legend + highlight/filter modes.

Three worked examples: (a) C4 drill-down, (b) distributed request trace, (c) requirements traceability. Builds on cross-diagram link spec (same node-anchor-registry prerequisite). Engineering prerequisites added (items 8–9: parser extension, color assignment). Spec-only. Committed af080b0. **This is the flagship application of cross-diagram linking.**

---

# Decision: EXTENDED TIMELINE SPEC (design §16b)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-15  
**Status:** SPEC WRITTEN — design/sections/16b-extended-timeline.tex created; PDF clean

## Summary

Extended Timeline Syntax: strict superset of Mermaid `timeline` exposing full IRDocument power. Grounded in real field names (`packages/core/src/types.ts` + `schema.ts`). Two-tier portability model: Tier 1 (Mermaid-faithful `section` + `period : event`) yields no warnings; Tier 2 (extended constructs: `track`, `@status`, `@progress`, `@milestone`, `@shape`, `section [range]`, `annotation`, `break`, `legend`) emits WARNING. Opt-in suppression via `timeline extended`. All Tier-2 constructs map to existing IR — no new IR introduced.

**One IR, many layouts:** 6 layout values (`horizontal`, `vertical-spine`, `serpentine`, `roadmap`, `gantt`, `timeline-columns`) × 7 contract themes = 42 visual presentations. Dimension guard (height ≤ 5000px, aspect ≤ 4:1) on `vertical-spine` for long spans; warns and suggests `spineSpacing: even` or alternate layout.

**Degradation contract:** Tier-1 byte-compatible with vanilla Mermaid; Tier-2 warns and compiles normally; vanilla Mermaid fails predictably on Tier-2 files (clear signal).

## Document Artefacts

- `design/sections/16b-extended-timeline.tex` — §16b (wired into main.tex)
- `design/main.pdf` — clean build (2026-06-15)
- Committed: b067ebd

---

# Decision: IR GAPS FOUND (extended-timeline spec, to fix at implementation)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-15  
**Status:** SPEC-FIRST; gaps flagged; NOT YET FIXED

Four known IR gaps discovered during spec authoring; documented in spec §16b:

1. **Milestone has no `shape` field** — IR carries `icon?` (proxy) but no `shape` enum (diamond | circle | square | star | flag). Future: add `Milestone.shape?`.

2. **Schema layout-enum bug** — `types.ts` has all 6 layout values; `schema.ts` Zod enum only 4. `gantt` and `timeline-columns` MISSING → latent JSON-Schema round-trip validation bug (would reject those layouts).

3. **`density` not persisted** — resolved at theme time via `resolveContractTheme`; lost after IR round-trip. Open: promote to `Metadata`?

4. **`legend` auto-entry generation unspecified** — `legend show` without explicit `LegendEntry` objects is a rendering convention, not an IR invariant.

**Spec approach:** User requested spec-first; gaps documented as known-issues; implementation TBD.

---

# Decision: DIMENSION GUARD ADDED

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-15  
**Status:** COMPLETE — 2642/2642 tests passing; only config-layout re-emitted

Pathological renders (height > 5000px or aspect > 4:1) are now detected automatically. `gallery-dimensions.test.ts` scans all 190 `examples/gallery/**/*.svg` files, asserting height ≤ 5000px and H/W ≤ 4:1 (legitimate max: 2280px/1.92; pathological: 7357px/6.13). `vertical-spine.ts` emits a render-time warning when a time-proportional spine exceeds these thresholds, suggesting `spineSpacing:'even'` or `layout:'timeline-columns'` for multi-decade spans. `spineSpacing` is now a config-surface key. Root cause: `vertical-spine` is time-proportional and explodes over long spans (same class as the earlier 9233px Mermaid-timeline bug); `config-layout.mmd` previously rendered 7357px→2283px after adding `spineSpacing:even`. Gallery dimension guard: 191 tests (all passing). Render warning: geometry unchanged, goldens identical. Committed f256473.

---

# Decision: SUPERSET SURFACE COMPLETE (do-all batch)

**Agent:** Bjarne (Ingestion Design), Barbara (Semantics & Rendering), Scribe (Coordination)  
**Date:** 2026-06-15  
**Status:** COMPLETE — 2451/2451 tests passing; existing goldens byte-identical

## Summary

Three-part do-all batch completed: (1) Mermaid config surface — frontmatter + `%%{init}%%` expose `layout`, `density`, `themeOverrides`; new `resolveContractTheme` helper applies density + token overrides to any of 7 named contract themes. (2) Three additional named contract themes — `terminal` (retro CRT: phosphor green on matte black, Courier New, square markers, compact), `pastel` (soft rounded: lavender on warm off-white, Nunito, 12px radius, curved), `mono` (chroma-free: grayscale only, pure white + mid-gray, Helvetica, elbow connectors). Total: 7 contract themes; matrix test (7×21 components) passes; zero per-component binding changes required; 18 new gallery files. (3) `poster` keyword — superset-only multi-diagram composition (new DSL parser `parsePosterInternal` in `packages/core/src/frontend/mermaid/poster.ts`); cells rendered via existing `parseMermaid` under a single poster theme; assembled via the existing composition engine (additive `SceneCellContent` kind). Two poster demos (executive and midnight themes, re-themeable by one frontmatter line).

Completes design §17.1 extension mechanisms (frontmatter + init directive + new top-level keywords). **2451 tests**; existing goldens **byte-identical** throughout.

## Commits

82d8736 (config surface + 3 themes), a39fb17 (poster).

---

# Decision: MIGRATION — NODE-LINK FAMILY ADOPTED THE CONTRACT

**Agent:** Barbara (Semantics & Rendering), Coordinator (VISUALLY VERIFIED)  
**Date:** 2026-06-15  
**Status:** ADOPTED & COMMITTED (8101a00)

## Summary

Node-link family (class, state, ER, C4, requirement, block, architecture) adopted the theme contract via binding. All seven diagram types now render via `grammars/<c>/contract-binding.ts` bindings with opt-in contract theme names. No legacy diagrams affected. 12 diagram types now coherent under `executive` design system (flow, sequence, xychart, gantt + these 7). Determinism preserved: existing goldens byte-identical, only new executive-* demos added. 1936 tests passing. Committed 8101a00.

## What Changed

- **Bindings:** `grammars/{class,state,er,c4,requirement,block,architecture}/contract-binding.ts` — Tier-3 contract bindings added (7 files)
- **Frontend wiring:** `frontend/mermaid/index.ts` — opt-in; theme names in CONTRACT_THEMES resolve via binding
- **Gallery demos:** 7 new executive-* demos (executive-class, executive-state, executive-er, executive-c4, executive-requirement, executive-block, executive-architecture)
- **Tests:** Binding unit tests + gallery emit tests; 1936 all passing
- **Visual coherence:** Coordinator verified all 12 diagram types render as one executive design system (navy #1F497D accent, Georgia serif, white surface)

## Remaining Migration

1. **Chart family** (pie, quadrant, radar) — reuse chart binding
2. **Timeline adoption** — section/event fills → categorical palette
3. **Specialised** (sankey, gitGraph, journey, kanban, mindmap, packet)

## PENDING

**Design doc §12 sync:** 4 contract tokens added in step 1 need documentation (surfacePanel, inkPanel, markerShape, pattern).

---

# Decision: THEME CONTRACT SPIKE SUCCEEDED

**Agent:** Barbara (Semantics & Rendering), Coordinator (VISUALLY VERIFIED)  
**Date:** 2026-06-14  
**Status:** SUCCEEDED — contract proven, vocabulary finalized, vocabulary conventions documented

## Summary

Tier-2 ThemeContract proof spike complete. The `executive` theme was applied to all three proof-set components (flowchart, sequence, xychart), producing three diagrams that read as **one coherent design system** (navy #1F497D accent, Georgia serif, white surface). Determinism preserved: all 1822 tests passing, existing goldens byte-identical.

## What Was Built

- `packages/core/src/theme-contract/` — Tier-2 ThemeContract interface + executive concrete theme
- `grammars/{flow,sequence,chart}/contract-binding.ts` — Tier-3 contract bindings
- `frontend/mermaid/index.ts` — opt-in wiring; theme name in CONTRACT_THEMES resolves via binding
- 3 new gallery examples (executive-flowchart, executive-sequence, executive-xychart)
- 63 new tests (theme-contract-bindings + executive-gallery-emit)

## Vocabulary Conventions Finalized

1. **categorical[0] SHOULD equal palette.accent** — primary series color = brand accent for chart contracts
2. **Axis & gridlines:** axis lines use palette.ink, gridlines use palette.border (Tier-3 binding conventions, not contract)
3. **Density → geometry:** documented as binding guidance for migration

## Status

- All 1822 tests passing
- Existing goldens byte-identical (only 3 new executive-* files)
- Coordinator VISUALLY VERIFIED the three diagrams cohere as one design system
- **NEXT:** migration per decided order — generalise timeline ResolvedTheme → node-link family → remaining charts → timeline adoption → specialised

---

# Decision: THEME VOCABULARY RESOLVED (design §12)

**Agent:** Leslie (Spec Architect), Cristian (@ormasoftchile)  
**Date:** 2026-06-14  
**Status:** DECIDED — design/sections/12-themes.tex updated, PDF clean

## Summary

All five open vocabulary questions resolved. General theme contract now complete. Open-questions subsection replaced with Three-Tier Token Architecture, Contract Vocabulary Summary, and Contract Adoption Plan.

## Resolutions

**(1) Dual palette:** semantic/role palette (surface, ink, accent, muted, border, status roles, IR workflow states) + separate data palette (categorical sequence, sequential ramp, diverging ramp).

**(2) Spacing:** advisory base-unit + steps scale (xxs–xxl); not binding across components.

**(3) Density:** three discrete levels: compact | normal | comfortable.

**(4) THREE-TIER TOKEN ARCHITECTURE:**
| Tier | Name | Contents | Who References |
|------|------|----------|---|
| 1 | Primitives | Raw colour ramps, type families, spacing base unit | Themes only |
| 2 | Semantic tokens | Role palette, data palette, type scale, spacing steps, density, shape, effects | Every component |
| 3 | Component tokens | `components.<name>.<token>` — defaults from Tier 2, optional theme overrides | Component engines |

**Binding invariants:** Tier 2 NEVER references Tier 3; components reference upward only; themes may override Tier 3 optionally.

**(5) PROOF SET & MIGRATION:** Validate with one `executive` theme across flowchart + sequence + xychart (exercises structural tokens, density+spacing, data palette). After spike: (1) generalise timeline ResolvedTheme upward, (2) node-link family, (3) remaining charts, (4) timeline adoption, (5) specialised. Each step independently shippable.

## Document Artefacts

- `design/sections/12-themes.tex` — §12.1 Three-Tier Token Architecture, §12.2 Contract Vocabulary Summary, §12.3 Contract Adoption Plan
- `design/main.pdf` — clean build (exit 0, 2026-06-14)

---

# Decision: TIER 3 LONG-TAIL COMPLETE — 21 Mermaid Diagram Types Shipped

**Agent:** Bjarne (Ingestion), Barbara (Semantics & Rendering), Scribe (Coordination)  
**Date:** 2026-06-14T19:30:00Z  
**Status:** ADOPTED & COMMITTED

## Summary

Tier 3 long-tail grammar completion shipped this session. All five remaining standard Mermaid diagram types are now production-ready: `requirementDiagram`, `kanban`, `block-beta`, `packet-beta`, `architecture-beta`. This completes the full standard Mermaid set: **21 diagram types total**. 1759 tests passing; determinism preserved; all goldens byte-identical. Commits: 34934b0, f4726f7, 72346d6.

## Details — See Inbox Merges

- **requirementDiagram + kanban** (Bjarne): 2-column grid layout, 70 tests. Compartment boxes, «kind» edge pills.
- **block-beta + packet-beta** (Barbara): N-column grid + 32-bit packet layout. 91 tests. Block spans/groups/arrows; packet fields with boundary wrapping.
- **architecture-beta** (Barbara): Icon services + dashed groups + port-anchored edges. 41 tests. Cloud/database/server/disk/internet glyphs added to icon registry.

## A/B Fidelity

All structural elements A/B-verified against real Mermaid. Layout positioning differs (ours deterministic, Mermaid uses heuristic solvers), but all semantic features present.

---

# Decision: Mermaid Flowchart Parser Hardening — Real-Mermaid Crawl Fidelity

**Agent:** Bjarne (Ingestion Design)  
**Date:** 2026-06-13T20:26:37-04:00  
**Status:** ADOPTED

## Summary

Hardened the Mermaid flowchart parser (`packages/core/src/frontend/mermaid/flowchart.ts`) to real-Mermaid fidelity. Root cause: node ID scanner included `-` in char class, breaking compact syntax like `A-->B` (scanned `A--` instead of `A`). Full scope included 13 edge operators, shape extension, clean label extraction, and public warnings. 914 tests pass (+62); gallery byte-identical.

## Root Cause Fixed

**Node ID scanner included `-` in character class** (`[a-zA-Z0-9_-]*`). For `A-->B`, the scanner consumed `A--` (stopped at `>`), leaving `>B` which matched no edge operator. Result: node `A--` created, no edge, node `B` dropped. All compact Mermaid syntax was broken.

**Fix:** Change to `[a-zA-Z0-9_]*` (no hyphen). Correct per Mermaid's own grammar.

## Scope of Changes

### 1. `packages/core/src/frontend/mermaid/flowchart.ts`

| Area | Change |
|------|--------|
| `scanNodeToken` — ID regex | Removed `-` from char class |
| `scanNodeToken` — extended shapes | 5 shapes with clean label capture: `{{…}}` hexagon→diamond, `[(…)]` cylinder→rect, `[/…/]` para→rect, `[\…\]` para→rect, `>…]` asymmetric→rect |
| `scanEdgeToken` | Added 13 edge operators: `<-.->`, `-.-`, `<==>`, `===`, `<-->`, `o--o`, `--x`, `--o` (with and without `\|label\|`) |
| `normalizeLabeledEdges` | Extended inline label handling: `== text ==>` → `==> \|label\|`, `-. text .->` → `-.-> \|label\|` |
| `parseChain` | Collects shape warnings; warns on unrecognized chain content |
| Direction warning | Fixed TB/TD check |

### 2. `packages/core/src/frontend/mermaid/index.ts`

| Area | Change |
|------|--------|
| `MermaidParseResult` | Added `warnings: string[]` field |
| `parseMermaid` | Now surfaces warnings via new type |

### 3. Test Coverage

61-case real-Mermaid corpus test (`mermaid-flowchart-corpus.test.ts`). Validates 7 acceptance criteria + 9 complete patterns.

## Acceptance Criteria Results

| AC | Description | Before | After |
|----|-------------|--------|-------|
| AC1 | `A-->B` compact edges | 0 edges, node "A--" | 4 nodes, 4 edges ✓ |
| AC2 | `A == yes ==> B` inline thick label | B dropped | 2 nodes, 1 edge labeled "yes" ✓ |
| AC3 | Shape label clean (hex/para) | `"{Hex"`, `"/Para/"` | `"Hex"`, `"Para"` ✓ |
| AC4 | Graceful degradation | Silent drop | warn + partial doc ✓ |
| AC5 | `parseMermaid` exposes warnings | Not present | `warnings: string[]` ✓ |
| AC6 | Direction TD warns | No warning | TB/TD handled ✓ |
| AC7 | Subgraph/classDef warn | warn | warn ✓ |

## Design Principles

- **No throws:** Parser returns valid (possibly partial) doc. Callers decide how to surface diagnostics.
- **Deterministic:** Same input → same output.
- **Clean labels:** Shape delimiters stripped in capture groups; only quotes to `extractLabel`.
- **Graceful degradation:** Extended shapes degrade to rect/diamond; warnings emitted.

## Test Impact

- **Before:** 852 tests pass  
- **After:** 914 tests pass (+62)  
- **Regressions:** 0  
- **Gallery:** `mermaid-flowchart.{svg,png}` byte-identical

## Tokenizer / Fidelity Bar Established

This decision establishes the tokenizer fidelity bar for all remaining Mermaid parsers (sequence, gantt, timeline, mindmap). Each parser must:
1. Use real-data crawls to validate acceptance criteria
2. Parse whitespace-independently (compact + spaced syntax)
3. Handle all documented edge/node operators
4. Extract labels cleanly (no delimiter mangling)
5. Warn on graceful degradation, never silent-drop

---

# Decision: THEMING ARCHITECTURE DECIDED (design-doc captured, §12 rewritten)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-14  
**Status:** CONFIRMED (design/sections/12-themes.tex rewritten, PDF clean)

## The Model

A theme is ONE coherent, component-agnostic system. Each component provides a specific implementation of it (NOT per-component themes). Themes drive geometry, layout, and routing (not just color); the layout engine consults the theme. **Themes × Components matrix:** add a theme once → all components inherit it; add a component once → it inherits all themes.

## General Contract: Token Vocabulary

Proposed domains (subject to refinement):

| Domain | Coverage |
|--------|----------|
| **Palette by role** | surface, ink, accent, muted, semantic status (not raw hex) |
| **Typography** | family + fallback, embedded fonts, type SCALE (named steps), weights |
| **Spacing/rhythm** | base unit + named steps (xxs → xxl) |
| **Density** | compact \| normal \| spacious — consulted by layout engines |
| **Shape language** | corner-radius, node-padding, stroke-scale, connector-style |
| **Effects/motion** | fidelity tier (0–3), drop-shadow, glow, motion opt-in |

## Reach Rule (IR Boundary)

- **New grammar** = only when IR cannot carry new semantic data
- **Layout argument** = same data, different positioning
- **Theme tokens** = look-and-feel within a layout

**Example:** timeline is ONE IR + ONE engine that becomes vertical-spine, horizontal-arc, roadmap, serpentine, gantt, timeline-columns via `{layout + theme tokens}` alone.

## Grounded Reality

- **16 per-component `theme.ts` files** exist (all incompatible); migration = generalise the timeline `ResolvedTheme` upward.
- **14 named timeline themes** exist; they are the deepest layout-driving themes in the codebase.
- **Migration order proposed:** timeline first (reference), then flow + sequence (highest traffic), then remaining 14.

## Surface: Mermaid Superset

All user surface is Mermaid or Mermaid-like:
- **Frontmatter:** `theme:`, `layout:`, `density:`, `tokens:` (overrides)
- **Init directive:** same fields, for tool compatibility

## Document Artefacts

- **Section rewritten:** `design/sections/12-themes.tex` — old "pure styling / may not alter geometry" deleted; new model expressed.
- **Reference added:** `design/references.bib` — `dtcg2024` (W3C Design Tokens Community Group) cited.
- **PDF build:** clean (exit 0).

## Open Questions (flagged for vocabulary refinement)

1. Do chart-family components (pie, radar, XY) use the same status-role vocabulary, or need separate category-colour vocabulary?
2. Should spacing-scale steps be normalised across components, or advisory?
3. Is compact/normal/spacious granularity sufficient, or are additional density levels warranted?
4. How are component-specific extensions (e.g., `serpentine.turn-radius`) namespaced without polluting the general contract?
5. What is the migration order and timeline for the 16 existing per-component theme files?

**NEXT:** Design the general theme vocabulary, then implement.

---
