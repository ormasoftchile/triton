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

## Learnings — 2026-06-14 (Theme vocabulary resolved, §12 finalised)

**Resolved by Cristian (@ormasoftchile). All 5 open questions closed.**

### Q1 — Dual palette system (DECIDED)
The general contract carries **two distinct palette systems**, both at Tier 2:
- **Role palette (semantic/structural):** `surface`, `ink`, `accent`, `muted`, `border`, plus status roles `success`, `warning`, `error`, `info`, and IR workflow states `planned/active/done/cancelled/uncertain`. Structural components consume this.
- **Data palette (quantities/sequences):** An ordered `categorical` sequence (min 6, for pie slices / chart series / kanban columns / branch colours), a `sequential` ramp (low→mid→high, for sankey throughput / heat / radar), and a `diverging` ramp (negative→zero→positive). Chart and data components consume this.

### Q2 — Spacing: advisory, not binding (DECIDED)
Spacing is expressed as `base unit + named steps` (xxs, xs, sm, md, lg, xl, xxl). Components consult the scale as **advice**; step values are not pixel-identical/binding across components. This preserves each component's layout judgement while sharing a common rhythm.

### Q3 — Density: three discrete levels (DECIDED)
`compact | normal | comfortable` (not "spacious"; not continuous). Density modulates the spacing scale, padding, and layout thresholds (label truncation length, whether secondary labels show). Changed "spacious" → "comfortable" throughout §12.

### Q4 — Three-tier token architecture (DECIDED — the mechanism)
- **Tier 1 — Primitives:** raw colour ramps, type families, spacing base unit. Component-agnostic, never referenced directly by components.
- **Tier 2 — Semantic tokens (the general contract):** role palette, data palette, type scale + weights, spacing steps, density, shape language, effects. The interface every component implements.
- **Tier 3 — Component tokens:** `components.<name>.<token>` (e.g. `components.serpentine.turnRadius`, `components.sankey.ribbonOpacity`). Derived from Tier 2 by default; a concrete theme MAY override as optional fine-tuning.
- **Binding invariants:** Tier 2 NEVER references a Tier-3 token. Components reference upward only. A theme may reach downward into `components.<name>` as an optional override only.

### Q5 — Proof set and migration order (DECIDED)
**Proof set (contract validation spike):** `flowchart` + `sequence` + `xychart`. Together they exercise the entire Tier-2 contract: node/edge routing + shape language (flow), compartment geometry + density (sequence), data palette + axes (xychart). The spike proves one `executive` theme renders all three coherently.

**Migration order (after spike):**
1. Generalise timeline `ResolvedTheme` (`packages/core/src/themes/types.ts`) upward into Tier-2.
2. Node-link family: class, state, ER, C4, requirement, block, architecture.
3. Remaining charts: pie, quadrant, radar.
4. Timeline-family adoption of the general contract (with Tier-3 overrides retained).
5. Specialised: sankey, gitGraph, journey, kanban, mindmap, packet.

### Document artefacts
- `design/sections/12-themes.tex` — open questions replaced with §12 "Three-Tier Token Architecture", §12 "Contract Vocabulary Summary", §12 "Contract Adoption Plan".
- `design/main.pdf` — clean build (exit 0).
- Decision note: `.squad/decisions/inbox/leslie-theme-vocabulary-resolved.md`


For detailed context from earlier sessions (Composition implementation, design doc restructure, Tier 1/2/3 completions, real-Mermaid fidelity passes), see `leslie/history-archive.md`.
- (2026-06-14T23:32:53Z) Theme contract spike succeeded; binding pattern established
- (2026-06-15T04:09:23Z) **Migration step 1 done** — contract gained 4 tokens (surfacePanel, inkPanel, markerShape, pattern); doc §12 sync pending
- (2026-06-15T00:15:00Z) **Migration step 2 done** — node-link family on contract; 12 types coherent under executive
- (2026-06-15) Synced §12 with 4 step-1 contract tokens (surfacePanel, inkPanel, markerShape, status-pattern) and added Implementation Status (2026) subsection; PDF clean.
- (2026-06-15T17:04:29Z) **3 named contract themes added; matrix proven** — midnight (dark), blueprint (technical), editorial (warm print); zero per-component changes required; all 21 components light up deterministically; 2206 tests passing (Commit 2325c78)
- (2026-06-15T15:00:00Z) Superset surface complete: config keys + 7 themes + poster keyword (§17.1 extension mechanisms shipped)

---

## Learnings — 2026-06-15 (Extended Timeline Syntax spec written, §16b)

**Extended Timeline Syntax: §16b added to design/sections/16b-extended-timeline.tex**

### Two-Tier Model (DECIDED for spec)

- **Tier 1 (Mermaid-faithful):** `section` + `period : event` only; vanilla-portable; no warning.
- **Tier 2 (Extended):** any extended construct; superset-only; WARNING emitted, compile proceeds.
- Opening line `timeline extended` suppresses the warning (explicit opt-in).
- No new IR introduced — all constructs map to existing `IRDocument` fields.

### Construct → IR Mapping (real field names confirmed from types.ts + schema.ts)

| DSL | IR | Note |
|---|---|---|
| `track Name` | `Track { id, label }` | id = kebab-slug |
| `Label: start..end` | `Activity { track, label, start, end }` | IRDate strings |
| `Label: date` | `Activity { track, label, span }` | single-date/span form |
| `@status value` | `Activity.status` / `Milestone.status` | 7-value Status enum |
| `@progress N` | `Activity.progress = N/100` | author writes 0-100; IR stores [0,1] |
| `@milestone Label: date` | `Milestone { id, label, date, track }` | |
| `@shape token` | `Milestone.icon` (proxy) | IR gap: no shape field |
| `section Name [s..e]` | `Section { id, label, time_range }` | |
| `annotation "text" @ date` | `Annotation { type:'callout', text, date }` | |
| `annotation "text" @ s..e` | `Annotation { type:'period', text, start, end }` | |
| `legend show` | `Legend { show: true }` | |
| `break s..e` | `Metadata.axis_breaks: [{ from, to }]` | |

### One IR, Many Layouts — the reach principle

- 6 layouts × 7 contract themes = 42 visual presentations from one source.
- `layout:` key in frontmatter is the single switch.
- Dimension guard enforced: `vertical-spine` warns on multi-decade spans (height > 5000px or aspect > 4:1), suggests `spineSpacing: even` or `roadmap`/`timeline-columns`.

### IR Gaps Discovered (flag for future IR revision)

1. **`Milestone.shape` missing** — `icon` is a proxy; conflates pictogram with marker geometry. Future: add `Milestone.shape?: enum`.
2. **Schema gap: `gantt` + `timeline-columns` not in `metadataSchema.layout` Zod enum** — `types.ts` has 6 values; `schema.ts` only has 4. JSON Schema round-trip broken for those two layouts.
3. **`density` not in `Metadata`** — config-time only, lost after IR round-trip.
4. **`legend` auto-entry generation** — rendering convention, not IR invariant.
5. **`@milestone` outside a `track`** — `Milestone.track = undefined` allowed by IR; layout behavior on global axis not yet validated.

### Document Artefacts

- `design/sections/16b-extended-timeline.tex` — new section between §16 and §17
- `design/main.tex` — `\input{sections/16b-extended-timeline}` added in The Front-End part
- `design/main.pdf` — clean build (exit 0, 2026-06-15)
- Decision note: `.squad/decisions/inbox/leslie-extended-timeline-spec.md`
