# Squad Decisions — Timeline Compiler Design Spec (2026-06-09/10)

## Scope & Thesis

### Timeline Grammar vs Task Scheduling Grammar

**Decision:** Timeline Compiler adopts a Timeline Grammar (visual communication) abstraction, NOT a Task Scheduling Grammar (project management) abstraction.

**Rationale:**
- Task Scheduling Grammars (Gantt-style) require dependency resolution, resource leveling, critical path analysis — massive complexity irrelevant to visual communication.
- Timeline Grammar is flat, deterministic, agent-friendly: each element is independently valid.
- This aligns with all five optimization goals: presentation quality, agent generation, determinism, extensibility, simplicity.

**Implications for IR (Mark):**
- IR describes what to render, not what to compute.
- No dependency resolution. Dependencies are visual annotations only.
- Dates, progress, status are author-provided, not computed.
- IR primitives: tracks, activities, milestones, sections, annotations, legends — all visual/communicative, not operational.

### Scope Boundaries

**Decision:** Explicit exclusion of project-management semantics from Timeline Compiler.

**In Scope:**
- Timeline/roadmap/milestone/phase visualization
- IR elements: tracks, groups, activities, milestones, sections, date ranges, progress, status, labels, annotations, legends
- Theming, deterministic layout, SVG/PNG/PDF/PPTX output
- CLI, library API, schema validation

**Out of Scope:**
- Dependency scheduling/resolution (dates are provided, not computed)
- Resource management
- Critical path analysis
- Sprint/iteration tracking
- Cost management
- Portfolio optimization
- Baseline comparison
- Risk registers
- Data storage, collaboration, versioning
- Interactive/clickable output (MVP)
- WYSIWYG editing
- Native data source integrations

**Rationale:** The scope boundary is the rendering abstraction. If it requires understanding work semantics (dependencies, resources, costs), it's out. If it improves visual communication of a decided plan, it's in.

### Dependency Arrows

**Decision:** IN SCOPE as visual annotations only.

Dependencies in the IR (e.g., `depends_on: [other_activity]`) are rendered as arrows but do NOT constrain or compute dates. This is a visual hint for readers, not a scheduling input.

### Today Marker

**Decision:** IN SCOPE with explicit input.

The "today" date must be provided in the IR (`today: 2026-06-09`), not inferred from system clock. This ensures determinism.

### Distribution Architecture

**Decision:** Layered distribution: single core library, multiple distribution targets.

**Architecture:**
```
Core Library (render, validate, theme, schema)
    |
+---+---+---+---+---+
CLI | npm | MCP | VS Code | Docker
```

**MVP Priority:**
1. CLI Binary (scripting, CI/CD)
2. npm Package (JS/TS embedding)
3. VS Code Extension (authoring UX)
4. MCP Server (agent integration)
5. Docker Image (isolated execution)

**Implications:**
- Implementation language should support: standalone CLI without runtime, npm embedding, WASM compilation.
- MCP server is essential for agent use case — first-class target, not afterthought.

---

## IR Contract — Canonical Design

### Canonical Field Names

**Root Fields**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `version` | string | ✓ | — |
| `metadata` | object | ✓ | — |
| `tracks` | list<Track> | ✓ | — |
| `groups` | list<Group> | opt | `[]` |
| `activities` | list<Activity> | ✓ | — |
| `milestones` | list<Milestone> | opt | `[]` |
| `annotations` | list<Annotation> | opt | `[]` |
| `sections` | list<Section> | opt | `[]` |
| `legend` | Legend | opt | auto-generated |

**Metadata Fields**
| Field | Type | Required | Default |
|-------|------|----------|---------|
| `title` | string | ✓ | — |
| `subtitle` | string? | opt | `null` |
| `author` | string? | opt | `null` |
| `created` | date | opt | — |
| `updated` | date | opt | — |
| `time_range` | TimeRange | ✓ | — |
| `axis_unit` | AxisUnit | opt | inferred |
| `theme` | string? | opt | `"default"` |
| `locale` | string? | opt | `"en-US"` |
| `today` | date? | opt | eval time |
| `fiscal_year_start` | int [1..12] | opt | `1` (January) |

**Activity & Milestone Field Extensions**
- Activity and Milestone both support an optional `icon?: string` — a named icon from the built-in icon registry (packages/core/src/icons.ts). Icon names are NOT validated; unknown/absent names render as no-ops. (Shipped 2026-06-11.)

### Date Model

**Supported Date Formats**
| Format | Example | Resolution |
|--------|---------|------------|
| ISO full | `2026-06-09` | day |
| Year-month | `2026-06` | month |
| Year only | `2026` | year |
| Quarter | `2026-Q2` | quarter |
| Half | `2026-H1` | half |
| Fiscal quarter | `FY26-Q2` | quarter (see Fiscal Calendar below) |
| Relative | `+3m`, `-2w` | resolved via date anchor |
| Symbolic | `now` | resolved via date anchor |

**Date Anchor (normative)**

`now` and relative offsets (`+3m`, `-2w`, etc.) resolve against the **date anchor**:
1. `metadata.today` — if present, used exclusively.
2. `metadata.created` — fallback when `today` is absent.
3. **Hard error** (`DATE_ANCHOR_MISSING`) — if neither is present and any `now` or relative date appears.

Renderers **must not** consult the system clock. The today-marker annotation also uses this anchor.

**Determinism:** Authors and agents SHOULD set `today` explicitly whenever `now` or relative dates appear, so the document is byte-stable across rendering runs.

**Fiscal Calendar**

`fiscal_year_start` (int [1..12], default 1) sets the calendar month on which the fiscal year begins. `FY`*nn* denotes the fiscal year starting on month `fiscal_year_start` of calendar year 20*nn*. Fiscal quarter *k* (k ∈ {1,2,3,4}) spans three months starting at:

```
m_k = ((fiscal_year_start - 1) + (k - 1) × 3) mod 12 + 1
```

**Examples — `fiscal_year_start: 1` (default):** FY26-Q2 = Apr–Jun 2026 (fiscal == calendar).
**Examples — `fiscal_year_start: 4`:** FY26-Q1 = Apr–Jun 2026; FY26-Q2 = Jul–Sep 2026; FY26-Q4 = Jan–Mar 2027.

### Status Enum

| Value | Meaning |
|-------|---------|
| `planned` | Work not yet started (default) |
| `in-progress` | Work actively underway |
| `done` | Work completed |
| `at-risk` | Timeline or delivery threatened |
| `blocked` | Cannot proceed |
| `cancelled` | No longer planned |
| `tentative` | Uncertain if will happen |

### ID/Reference System

**ID Format**
- Regex: `^[a-z][a-z0-9-]*$`
- Kebab-case slugs: `alpha-release`, `platform-team`, `q2-planning`
- Globally unique within document (across all entity types)
- Stable for Git-friendliness (not auto-generated UUIDs)

**Reference Semantics**
- References are bare strings: `track: platform` (not `track: { ref: platform }`)
- Type determined by schema context (field name implies target type)
- Must resolve to existing entity of correct type

### Well-formedness Invariants (17 total)

1. **Version present:** `version` must be non-empty string
2. **Required fields:** All required fields present
3. **At least one track:** `tracks` non-empty
4. **Unique IDs:** All `id` values unique across all entities
5. **Valid ID format:** IDs match `^[a-z][a-z0-9-]*$`
6. **References resolve:** All ref fields point to existing entities
7. **Type-correct references:** `activity.track` → Track, `annotation.target` → Activity|Milestone
8. **No circular groups:** `group.parent` must not create cycles
9. **Valid time range:** `time_range.end >= time_range.start`
10. **Activity dates valid:** `end >= start` when both present and concrete
11. **Date format valid:** All date values conform to the date model
12. **Activity date-source exclusive** (`SPAN_START_CONFLICT`): Every activity must satisfy exactly one of: (a) `span` is present and neither `start` nor `end` is present; or (b) `start` is present and `span` is absent (`end` optional).
13. **Date anchor present when required** (`DATE_ANCHOR_MISSING`): If any date field contains `now` or a relative offset, at least one of `metadata.today` or `metadata.created` must be present.
14. **Track index values unique:** When `track.index` is present, all supplied values are unique non-negative integers.
15. **Progress bounds:** `progress` in `[0, 1]` when present
16. **Valid status:** Status values from enum
17. **Valid axis_unit:** AxisUnit values from enum

---

## IR Reconciliation — Resolved Gaps (Mark)

**Date:** 2026-06-10
**Status:** Resolved — binding update to §4 and IR contract

### Summary

Barbara (Rendering/Themes §5–7) and Bjarne (Agent Integration §9) independently flagged six gaps in the published IR contract that blocked deterministic rendering and reliable agent generation. All six have been resolved by surgical updates to `design/sections/04-ir.tex` and the IR contract. No IR redesign was required.

### Gap 1 — `metadata.today`

**Problem:** The symbolic date `now`, relative dates (`+3m`, `-2w`), and the today-marker annotation had no deterministic anchor.

**Resolution:** Added `today: date?` (optional) to `metadata`. Resolution chain: `metadata.today` → `metadata.created` → hard error. Renderers must not consult the system clock.

### Gap 2 — `metadata.fiscal_year_start`

**Problem:** Two renderers using different fiscal calendar assumptions produce different x-coordinates for `FY26-Q2` dates.

**Resolution:** Added `fiscal_year_start: int [1..12]` (optional, default 1) to `metadata`. Specifies the calendar month on which the fiscal year begins.

### Gap 3 — Omitted `end` semantics

**Problem:** An Activity with `start` but no `end` (and no `span`) was ambiguous — could be treated as `ongoing` or as a validation error.

**Resolution:** Codified the rule explicitly: An Activity with `start` specified but `end` omitted is an **open/ongoing interval**, semantically identical to `end: ongoing`. Renderers must extend the bar to the canvas right edge and apply an open-end indicator.

### Gap 4 — `span` vs `start`/`end` co-presence

**Problem:** No rule governed what happens when both `span` and `start` (or `end`) are present on the same activity.

**Resolution:** `span` is mutually exclusive with `start` and `end`. Co-presence is a hard well-formedness error (**Invariant #12**, `SPAN_START_CONFLICT`).

### Gap 5 — Relative-date anchor undefined

**Problem:** Relative dates and `now` were under-specified. Two renderers could disagree.

**Resolution:** Both relative dates and `now` explicitly resolve via the same date anchor chain: `metadata.today` → `metadata.created` → hard error. (**Invariant #13**, `DATE_ANCHOR_MISSING`).

### Gap 6 — `track.index` vs `track.order` naming

**Problem:** The IR spec used the field name `track.order`; the binding contract and both downstream teams used `track.index`. Same concept, different names.

**Resolution:** Renamed `order` → `index` in `04-ir.tex`. Field description clarified: "unique non-negative integer; tracks render top-to-bottom in ascending `index` order."

---

## Rendering Model & Themes

### Determinism Contract (binding for all renderers)

A conforming renderer satisfies these conditions, applied at three layers:

**Layer 1 — Scene geometry (always byte-deterministic):**
1. **Pure function** — output is a function of (IR, theme) only; no system clock, random values, environment variables.
2. **Stable sort keys** — tracks by `index` asc; activities per track by `(start_ordinal, id)` asc; milestones by `(date_ordinal, id)` asc; annotations/sections by `id` asc. IDs break all ties (globally unique by IR invariant).
3. **Fixed rounding** — round-half-up (`floor(v + 0.5)`) throughout; Scene geometry values to 2 decimal places.
4. **Symbolic/relative date anchor** — `now` and `+Nm` dates resolve to `metadata.today` → `metadata.created` → hard error. Never the system clock.
5. **Embedded font metrics** — label-width computations use bundled WOFF2 font metrics; system fonts are never consulted for layout.
6. **Version governance** — renderer verifies `version` field before layout begins; mismatch is a hard error.

**Layer 2 — Per-backend output (deterministic given pinned backend version):**
Effect seeds for procedural effects (NoiseTexture, CloudLayer) are derived from `scene_hash + effect_id`. Backend version is recorded in output metadata.

**Layer 3 — Cross-backend pixel identity: explicitly NOT promised.**
SVG and Raster backends are expected and correct to differ. Cross-backend tests use per-backend golden images, not cross-backend pixel equality.

### Date→X Coordinate Formula (normative)

```
x(T) = H_hdr + m_L + floor( (T_ord - T_s_ord) * W_draw / (T_e_ord - T_s_ord) + 0.5 )
```

Where `T_ord` is the integer day ordinal since 2000-01-01 (epoch day 0). Integer arithmetic throughout. Coarser-precision dates coerce to period-start day when used as a left edge, period-end day when used as a right edge.

### Six-Phase Layout Order (binding)

1. **Axis Computation** — resolve axis domain, infer axis_unit, enumerate ticks
2. **Track Placement** — sort by `index`, assign `y_top` (provisional heights)
3. **Activity Geometry** — greedy sub-lane assignment, resolve end-date specials, label placement (3-way deterministic rule), progress strips
4. **Milestone Geometry** — diamond vertices, stacking within (track, x_center) groups
5. **Sections & Annotations** — background bands, annotation quadrant placement
6. **Label Collision Resolution** — milestone labels only; bounded scan (N iterations); activity labels placed definitively in Phase 3

No phase may invoke logic from a later phase.

### Edge-Case Rulings (normative — all renderers must agree)

| Case | Rule |
|------|------|
| Zero-duration (`start == end`) | Render bar at `min_width` px centred at `x(start)`. Never 0-width. |
| Overlapping activities (same track) | Greedy sub-lane assignment; track height expands; cap at `max_sub_lanes`. |
| `end: ongoing` or `end` absent | Bar to right canvas boundary + right-chevron decoration. |
| `end: tbd` | Dashed extension of `tbd_extension_px` past `x_left`. "TBD" label inside extension. |
| Both dates TBD/unknown | Full-track-width hatched block at 40% opacity. Label + "(TBD)". |
| `start: unknown` | Left edge at `x(T_s)`; left-fade gradient. |
| Approximate date (`~date`) | Nominal geometry; gradient fade at approximate edge(s). |
| Activity fully outside `time_range` | Not rendered; warning emitted; appears in legend. |
| Activity partially outside range | Clipped at boundary; clip indicator (angled cut) on clipped edge. |
| `x_right - x_left < min_width` | Render at `min_width`; centre on logical midpoint. |
| Simultaneous milestones (same track) | Stack downward by `stack_offset_y`, sorted by `id` asc. |
| Simultaneous milestones (cross-track) | Stack at full-timeline vertical centre, sorted by `id` asc. |
| Milestone outside `time_range` | Not rendered; warning; appears in legend. |
| Empty track | Rendered at `row_height`; never collapsed or removed. |
| Sub-lane cap exceeded | Excess activities placed in last lane (visible overlap); warning. |

### Theme Schema Knobs (summary)

A theme configures:
- `canvas`: width (fixed), background, margins
- `typography`: font_family, font_files (WOFF2, required for metric determinism), font sizes/weights
- `axis`: height, tick_height, gridline style/color/opacity, today_marker
- `track`: header_width, row_height, sub_lane_height, max_sub_lanes, row_gap, separators
- `activity`: bar_height, bar_radius, min_width, tbd_extension_px, approx_fade_px, label_inside_min_width, label_truncate_chars, progress_bar_height
- `milestone`: diamond_size, label_offset_x, label_max_width, stack_offset_y, label_stack_offset
- `annotation`: font_size, background, connector_style
- `legend`: position, font_size, swatch_size
- `status_map`: complete 7-entry map (planned/in-progress/done/at-risk/blocked/cancelled/tentative → fill/stroke/opacity/pattern)
- `category_map`: optional; string → {fill, stroke}; overrides status fill/stroke; pattern and opacity from status_map
- `fidelity`: tier (0=Minimal/1=Crisp/2=Polished/3=Showcase) + effect knobs (drop_shadow, glow, cloud_layer, noise_texture), each with fallback_policy

Theme-engine contract: MUST accept all valid IR; MUST NOT require additional IR fields; MUST have all 7 status_map entries (missing entry = malformed theme, detectable at load time). Fidelity tier and effects are theme properties; backend selection is not.

### Six Built-in Themes (summary)

| Theme | Fidelity Tier | Visual Identity | Use Case |
|-------|--------------|----------------|----------|
| **Consulting** | Tier 1 Crisp | Navy + black + white; square bars; no gridlines; no legend | Board presentations, transformation roadmaps |
| **Executive** | Tier 2 Polished | Serif headings; rounded bars; full status palette + icons; today marker | QBRs, investor roadmaps, slide decks |
| **Product** | Tier 2 Polished | Dense; colored track headers; category-colored bars; progress always shown | Engineering product roadmaps |
| **Release** | Tier 1 Crisp | Traffic-light colors; monospace font; bold today marker; triangle milestones | Release calendars, sprint plans |
| **Minimal** | Tier 0 Minimal | All bars dark grey; pattern-only status signals; no legend; print-safe | Academic papers, LaTeX reports |
| **Showcase** | Tier 3 Showcase | Drop shadows; glow; cloud layer; Raster backend required for full fidelity | Keynotes, investor presentations |

### Scene / Render IR Architecture (2026-06-10 rework)

SVG is **no longer the universal root**. The pipeline output is the **Scene/Render IR** — a
byte-deterministic, backend-agnostic record of all drawing primitives and effect requests.
Three pluggable backends (SVG, Raster, PPTX native-shape) consume the Scene.

**Backend capability ceilings:**
- SVG: Tier 1 (fully deterministic); Tier 2 (safe SVG filters, determinism caveat)
- Raster (Skia/Canvas): Tier 3 (all art effects; deterministic given pinned version)
- PPTX: Tier 2 native (a:glow, a:outerShdw); Tier 3 hybrid (native + embedded raster overlay)

### Output Priority Recommendation

1. **Scene IR + SVG backend** — foundation; correct, inspectable, Tier 0/1 full byte-determinism
2. **PNG via SVG backend** — immediate universal value; one library call on SVG output
3. **PDF via SVG backend** — consulting/print; deterministic via svg2pdf or cairosvg
4. **PPTX native-shape backend** — think-cell-comparable editability; Tier 2 native effects
5. **Raster backend (Skia/Canvas)** — art-effect differentiator; optional plugin; Tier 3
6. **HTML** — developer/agent preview; SVG-backed (Tier 0/1) or canvas-backed (Tier 2/3)

### Rendering-Validation Notes for Agent Integration

An IR document must satisfy the following to be renderable unambiguously:

1. `metadata.time_range.start` must be a concrete, resolvable date (not `tbd` / `unknown`).
2. `metadata.time_range.end` must be a concrete, resolvable date (same constraint).
3. All `track` references in activities must resolve to declared tracks.
4. All `track.index` values must be unique non-negative integers.
5. If any date field contains `now` or a relative date, `metadata.today` or `metadata.created` must be present.
6. If any `FY...` fiscal date is used, `metadata.fiscal_year_start` must be present (once Gap 2 is resolved).
7. `activity.progress` must be in `[0, 1]` when present.
8. An IR with valid structure but no activities and no milestones is renderable (produces empty track rows); this is a renderer warning, not an error.

Agents generating IR should prefer concrete ISO dates (`2026-Q2`, `2026-06-09`) over `now` or relative dates to maximise rendering determinism without relying on date anchor resolution.

### Renderer Implementation Notes

- **Skia raster backend** — glow/shadow blur uses `TileMode.Decal` (NOT Clamp) so filled-rect effects fade to transparent at layer edges instead of bleeding the fill color into the connector zone. (Fixed 2026-06-11.)
- **Vertical-spine layout** — `CONNECTOR_LEN = 58` px (raised from 48) so right-side content-block labels clear year-qualified axis tick labels ("Q1 20XX", ~46px wide) with an 8px gap, avoiding TIGHT_SPACING. (Fixed 2026-06-11.) Vertical-spine in `'time'` mode auto-compresses empty gaps when average spacing >4× ENTRY_MIN_SPACING, capping compressed gaps at 2× ENTRY_MIN_SPACING (200px) to keep sparse long-span timelines compact. `spineSpacing: 'time' | 'even'` is available as both a theme token and a render option (`RenderOptions`).
- **Activity icon placement** — Activity icons render at the left (start) edge of the activity bar, size = barHeight−4, preceding the label; reuses the milestone icon path-primitive pipeline; too-narrow bars skip the icon.
- **Vertical-spine card entries** — Support opt-in CTA button (from entry `url` + `cardCtaLabel` token) and inline date icon (`cardDateIcon` token); all tokens default to `undefined` for backward compatibility.

---

## Ingestion & Agent Integration

### Validation Layer Architecture

**Decision:** Five-layer validation pipeline, each layer a hard gate that blocks later layers on error.

| Layer | Name | Failure mode |
|---|---|---|
| 1 | Syntactic parse (YAML/JSON) | Hard error: stop |
| 2 | JSON Schema conformance | Hard error: all violations |
| 3 | Well-formedness invariants (Mark's contract) | Hard error: all violations |
| 4 | Render-readiness (Rendering Model) | Error or warning per severity |
| 5 | Semantic advisory | Warning only |

**Rationale:** Separating syntactic from schema from well-formedness errors produces much cleaner error messages for agents. A missing `id` field (Layer 2) should not produce a cascade of referential-integrity errors (Layer 3) — the cascade is suppressed until the earlier error is fixed.

### Error Message Contract

**Decision:** All validation errors are path-anchored with: path (e.g. `activities[2].track`), machine-readable error code (e.g. `UNRESOLVED_REF`, `INVALID_ID_FORMAT`, `DATE_ORDER_VIOLATION`), human-readable message, and a suggested fix string.

**Rationale:** Agents can apply mechanical repairs from path + suggested fix without re-reading the whole document. This is the key design enabling the Generate → Validate → Repair → Re-validate cycle.

### MCP Tool Surface

**Decision:** Four tools on the MCP server.

| Tool | Purpose |
|---|---|
| `validate_timeline` | Full pipeline validation; returns structured errors/warnings |
| `render_timeline` | Deterministic rendering; returns base64 output |
| `describe_schema` | Returns JSON Schema + per-field docs for agent bootstrapping |
| `suggest_time_range` | Derives time_range + axis_unit from a list of date hints |

**Deployment:** Local subprocess (CLI `timeline mcp-server`) and hosted cloud endpoint. Both expose identical tool contracts.

**Rationale:** Agents need to validate before rendering (separate tool calls). `describe_schema` is essential for bootstrapping generation without an external schema reference. `suggest_time_range` solves a common agent problem: sources often lack explicit time windows.

### Ingestion Contract

**Decision:** Four categories of ingestion decision formalised as the binding ingestion contract:
- **Assumed**: facts taken from the prompt without source evidence (title, version)
- **Inferred**: derived from source by deterministic rule (axis_unit, time_range, track from AreaPath)
- **Defaulted**: omitted, relying on schema defaults (status: planned, locale)
- **Rejected**: discarded with logged reason (bugs when prompt says features-only, items outside time window)

**The prompt is a first-class input**: read and parsed before the source data is touched. Track structure, entity filters, time horizon, title, and milestone promotion all come from the prompt.

**Prohibitions:** Ingestion must not compute dates (use `tbd` if absent), must not import the whole backlog, must not generate non-stable sequential IDs.

### Provenance-via-Metadata Strategy

**Decision:** Every ingested entity includes a `metadata` block with: `source` (reserved key), source-system ID (`ado_id`, `github_issue`), revision/ETag for change detection, and `ingested_at` timestamp.

**Re-sync rules:**
1. Match by source ID (not IR `id`) — the IR `id` slug may have been renamed by a human
2. Update only source-mapped fields; preserve human-edited fields (label, description, color, progress)
3. Never regenerate the IR `id` slug after first ingestion
4. Log changes before writing; flag source deletions as warnings (require human/agent confirmation)

**Git-friendliness:** Canonical field order + consistent quoting conventions in YAML serialisation prevent spurious diffs. IR `id` slugs are stable, making diffs meaningful.

---

## Research Constraints & Prior-Art

### Binding Constraints (from research crawl)

1. **Must ingest Mermaid `timeline` and `gantt` syntax.** Mermaid is the lowest-common-denominator format already embedded in millions of documents. A compatible ingester is essential for zero-friction adoption.

2. **IR must support ISO-8601 dates natively.** ADO work items, GitHub Projects, and all surveyed roadmap sources use ISO-8601 (`YYYY-MM-DD`, `YYYY-QN`, `YYYY`). The IR date type must accept all three granularities.

3. **Quarter granularity must be a first-class time-axis unit.** Observed in 100% of McKinsey/BCG-style roadmaps. The renderer must be able to scale the time axis to year/quarter/month/week without requiring the author to specify pixel widths.

4. **`lane` and `milestone` must be first-class IR entities.** Swimlane + diamond-milestone is the dominant visual idiom in executive roadmaps. These are not optional extensions; they must be in the core IR.

5. **Spans and point-events must coexist as distinct IR types.** Real roadmaps mix duration spans ("Migration: Q2–Q4 2025") with instantaneous events ("GA Launch: 15 Sep 2025"). Both are required.

6. **Deterministic rendering is a hard requirement.** MS Project XML proves that non-deterministic output breaks the git workflow. The renderer must produce bit-identical output from identical IR.

7. **The IR schema must be published as a JSON Schema document.** OpenAI Structured Outputs and similar LLM-constrained generation features require a machine-readable schema. Without this, agent generation is unreliable. The schema is a first-class deliverable.

8. **PPTX output must use python-pptx (not LibreOffice or headless Chrome).** For pip-installability and CI-friendliness.

### Recommendations (informing, not binding)

R1. **Scope the initial IR to five canonical types:** quarterly product roadmap, programme/transformation timeline, architecture evolution timeline, conference/event timeline, executive milestone map.

R2. **Visual quality bar: approach think-cell, not Mermaid.** The presentation quality gap is the primary differentiator. Target of "executive-presentable without post-editing".

R3. **Expose an MCP tool interface from day one.** The agent-generation use case is the strongest long-term adoption vector.

R4. **Publish a Mermaid-compatible syntax alias.** Allow a subset of Mermaid `timeline` syntax to be accepted verbatim.

R5. **Avoid gantt-chart defaults in the IR and renderer.** The IR must not have fields for `progress`, `dependencies`, `critical_path`, or `resource`. Signals "this is a project management tool" and confuses the positioning.

### Prior-Art Cite Keys Established

| Key | What it refers to |
|---|---|
| `mermaid2023` | Mermaid GitHub repo (88k+ stars, MIT) |
| `json-schema2020` | IETF JSON Schema draft 2020-12 (https://json-schema.org/draft/2020-12) |
| `thinkcell` | think-cell official site |
| `python-pptx` | python-pptx (MIT, programmatic PPTX) |
| *(+ 38 more keys in references.bib)* | *(See design/references.bib for complete list)* |

---

## Productization

### Core Implementation Language — RATIFIED: TypeScript/Node

**Decision (owner-ratified 2026-06-10):** The Timeline Compiler core (`@timeline-compiler/core`) and its CLI, MCP server, and npm package are implemented in **TypeScript/Node**.

**Rationale (three constraints satisfied simultaneously):**
- **Python excluded** (owner preference): no Python in the core dependency graph; PPTX later via `pptxgenjs` (pure JS), not python-pptx.
- **Transparent VS Code extension** (owner's stated follow-on goal): a TS core lets the future extension `import { render, validate }` and call it IN-PROCESS — no subprocess, IPC, or WASM bridge. SVG output is a string dropped straight into a webview; diagnostics map to `vscode.Diagnostic`. The extension becomes a thin UI shell over the same library the CLI uses.
- **Agent/MCP + npm ecosystem fit**: MCP SDK and VS Code APIs are TS-native; one core serves CLI + MCP + extension with zero glue.

**Render backends (cross-ecosystem libs, adopted not built):** SVG (native serialization) + PNG via `resvg-js` (WASM) for MVP; Skia raster (`skia-canvas`/`canvaskit`) for art effects and `pptxgenjs` for PPTX in later phases.

**Trade-off accepted:** standalone single-binary is less turnkey than Go (use Node SEA / `pkg` / `bun build --compile`).

**Implications:** core must avoid Node-only assumptions in the hot path so it can also run in a webview/worker (extension live preview); SVG-as-string + a synchronous `compile()` path are part of the public API contract.

### Ratified Productization Parameters (owner-confirmed 2026-06-10)

1. **MVP acceptance bar:** reproduce target **T2** (horizontal numbered nodes) from its IR to **byte-deterministic SVG + PNG via the CLI**, with validate-before-render and a published JSON Schema. This is the v0.1.0 gate.
2. **PPTX strategy:** use **`pptxgenjs`** (pure JS, MIT) — **no Python**. python-pptx is not used; if any Python path is ever revisited it must be an isolated optional sidecar, never in the core dependency graph.
3. **Phase ordering:** **agents/MCP (Phase 3) before art effects/PPTX (Phase 4)** — the MCP server + agent generation is the primary differentiator and ships before the Skia raster backend and PPTX.

---

## Governance

- All meaningful changes require team consensus
- Document architectural decisions here
- Keep history focused on work, decisions focused on direction

---

### Gitline Demo Page (2026-06-11, Barbara)

**What:** Self-contained demo page for T5 renderer at `examples/gallery/gitline-demo.html` wrapping rendered SVG. App chrome (header, tabs, pagination) added as pure HTML/CSS, renderer unchanged. SVG chosen for crisp browser scaling.

**Tests:** 512/512 pass; typecheck and lint clean.

---

### T1 "Our Timeline" Close — Barbara (2026-06-11)

**Date:** 2026-06-11T12:30:33-04:00  
**Status:** ✅ FULLY CLOSED — T1-3 Logo implemented 2026-06-11  
**Fidelity:** 100% — all nodes, labels, alternation, filled-vs-outlined, AND brand logo match target.

#### T1 Gaps Resolved

| Gap | Description | Resolution |
|-----|-------------|-----------|
| T1-1 | ~~Alternating above/below label placement~~ | Pre-existing (horizontal layout: index 0→below, 1→above, 2→below). No code change. ✅ |
| T1-2 | ~~Centered document title~~ | Pre-existing (`x = W/2`, `text-anchor="middle"`). Formalized with new `titleAlign?: 'left'\|'center'` token on TypographyTheme (opt-in, default=center → byte-identical output). ✅ |
| T1-new | ~~Filled vs outlined node differentiation~~ | Closed via pure theme change: `statusMap` (planned/done→white fill, in-progress→navy fill) + new `ordinalColorContrast?: boolean` token on MilestoneTheme (WCAG contrast-aware ordinal text). ✅ |
| T1-3 | ~~Brand logo top-left corner~~ | `ImagePrimitive` + `asset-loader` + all 3 backends + header layout; `brand-logo.png` created; T1 fixture updated. ✅ |

#### Artifacts Shipped (all sessions combined)

- `titleAlign?: 'left'\|'center'` token (TypographyTheme) — both layout engines
- `ordinalColorContrast?: boolean` token (MilestoneTheme) — WCAG contrast-aware ordinal text
- `our-timeline` theme (Tier-1 light infographic)
- `ImagePrimitive` in scene.ts, `asset-loader.ts`, all 3 backends updated
- `BuildSceneOptions.baseDir` for portable asset path resolution
- Fixture: `examples/gallery/our-timeline-numbered.timeline.yaml` (with logo)
- Assets: `examples/gallery/assets/brand-logo.{png,svg}`
- Goldens: `examples/gallery/our-timeline-numbered.svg` + `showcase/our-timeline-numbered-skia.png` (both with logo)
- Tests: 15 image primitive / T1 tests added

**Test results:** 545/545 pass (533 core + 9 schema + 3 cli). Typecheck and lint clean. All existing goldens byte-identical (logo only appears where `metadata.logo` is set).

#### ~~Backlog: T1-3 Logo / Image Primitive~~ — IMPLEMENTED ✅

Built as specced + Mark's IR schema. See `.squad/decisions/inbox/barbara-image-primitive-logo.md` for full decision record.

---

### Archived Batch 2026-06-11

- **Target Output Gap Analysis** — Comprehensive coverage report (T1–T5, merged) → decisions-archive.md
- **Activity.color Field Added** — IR schema extension for per-activity accent colors (Mark, closed T3-3) → decisions-archive.md
- **T3 "THE AI TIMELINE" Gaps Closed** — Dense vertical-spine timeline fully renderable; year-label sizing + gradient backgrounds shipped (Barbara) → decisions-archive.md
- **Vertical-Spine Gap Compression + spineSpacing Render Option** — Automatic gap compression for sparse long-span timelines; render-level `spineSpacing` override (Barbara, fixed 8×→990 px canvas height reduction) → decisions-archive.md
