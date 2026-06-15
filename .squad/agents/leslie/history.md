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

## Archive

For detailed context from earlier sessions (Composition implementation, design doc restructure, Tier 1/2/3 completions, real-Mermaid fidelity passes), see `leslie/history-archive.md`.
