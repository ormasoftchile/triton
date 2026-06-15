# Squad Decisions — Recent & Current (2026-06-15)

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
