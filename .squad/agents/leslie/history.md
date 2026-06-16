# Leslie — Spec Architect

**Owner:** Leslie (Spec Architect)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-14T20:30:00Z (Theming architecture confirmed; design/sections/12-themes.tex rewritten)

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

### Trace Abstraction — §30b Extension (2026-06-15)

**What was added:** New subsection §30b.8 in `design/sections/30b-cross-diagram-links.tex` specifying the `trace` construct: a named, ordered, optionally-typed multi-hop path of cross-diagram links.

**Core design decisions:**

- **trace = link sequence + group record.** A trace with `n` hops desugars at composition time to `n−1` atomic `link`s **plus** a `TraceRecord` (name, type, ordered member list). The `link` primitive is unchanged; `trace` is sugar and grouping metadata.

- **Typed-trace vocabulary confirmed against source.** The requirement-relationship group is the exact `RequirementRelKind` type from `packages/core/src/grammars/requirement/types.ts` (verified against `schema.ts` Zod enum): `satisfies`, `derives`, `verifies`, `refines`, `traces`, `contains`, `copies`. These seven tokens are shared verbatim with the `requirementDiagram` grammar — traceability semantics are uniform whether expressed inside a requirement cell or as a poster-level trace. The presentation-flow group (`calls`, `flowsTo`, `mapsTo`) is poster-layer only and deliberately excluded from `RequirementRelKind`.

- **Per-trace colour from the §12 categorical data palette.** Traces are assigned colours in declaration order from `categorical[0]`, `categorical[1]`, … of the active contract theme (same sub-palette used by chart-family components for series colours). Palette wraps with 20% lightness offset if trace count exceeds palette length. The semantic role palette (diagram internals) and data palette (traces + chart series) are non-colliding within every theme by design.

- **Trace legend auto-generated.** Swatch + name + «type» pill appended below the poster canvas; suppressed by `trace legend: off` frontmatter directive.

- **Three presentation modes specified at design level:** highlight (one trace at full opacity, rest dimmed), dim (any edge hovered, bare links at 60%), filter (only selected trace(s) visible, multiple traces allowed simultaneously). Rendering detail deferred.

- **Precise degradation contract:** one unresolvable hop → warn + render two sub-paths; all unresolvable → warn + skip; duplicate hop (cycle) → warn + loop arc; fewer than 2 resolvable hops → warn + skip. All non-fatal.

- **Three worked examples:** (a) C4 drill-down across four abstraction levels (`calls`); (b) distributed request trace across flowchart + architecture + ER (sequence non-linkable v1, shown as context only); (c) requirements traceability with two `satisfies` traces and legend — the flagship use case.

- **Agent IR type (`TraceRecord`).** Agents assert traceability by constructing `TraceRecord { name, type?, hops: TraceHop[], color? }` and pushing to `PosterDocument.traces`. Supports programmatic query (filter by type), filter-mode activation (`PosterRenderOptions.activeTraces`), and coverage-gap detection (requirements with no `satisfies`-trace origin).

**Design tensions flagged:**
1. Intra-cell hops within a trace are permitted (warn + loopback arc); bare intra-cell `link` statements remain wholly disallowed — slightly asymmetric but coherent within the path semantics.
2. Vocabulary boundary: presentation-flow types are poster-layer only, not added to `RequirementRelKind` — right boundary; domain grammars should define their own vocabulary.
3. Typed trace with no matching grammar cell is valid (type is presentational metadata at poster level; no semantic validation of origin node kind).

**Artefacts:** `design/sections/30b-cross-diagram-links.tex` extended; `design/main.pdf` clean (exit 0, 2026-06-15); decision note at `.squad/decisions/inbox/leslie-trace-abstraction-spec.md`.

---

**2026-06-15T23:30:00Z — Dogfood pipeline shipped (doc figures via our compiler); multi-line node labels flagged as a gap.**
