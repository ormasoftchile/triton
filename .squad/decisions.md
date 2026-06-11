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

## Target Output Gap Analysis (2026-06-11)

**Author:** Barbara (Semantics & Rendering specialist)  
**Date:** 2026-06-11  
**Scope:** Five target images vs current renderer capabilities  
**Replaces:** Target Output Coverage Analysis (2026-06-10, archived)

### Executive Summary

Since the 2026-06-10 analysis, significant progress has been made:
- **Vertical-spine layout family**: ✅ Shipped (covers T2, T3, T5 core structure)
- **Card entry style** (`entryStyle: 'card'`): ✅ Shipped (executive, product, showcase themes)
- **Icon support** on milestones AND activities: ✅ Shipped (20 built-in icons)
- **Glow/shadow effects** via Skia backend: ✅ Shipped (TileMode.Decal fix applied)
- **Gradient/cloud backgrounds**: ✅ Shipped (showcase theme)
- **Numbered milestone nodes** (`showOrdinalNumber: true`): ✅ Shipped

**Three targets are now substantially renderable**. The remaining gaps are mostly refinements and one layout family (serpentine) that was explicitly deferred to post-MVP.

### Per-Target Assessment

#### T1: Horizontal Numbered Timeline ("Our Timeline")

**Image:** `design/figures/target-horizontal-numbered.png`

**Verdict:** 🟡 **Partially renderable** (most of it)

**What We CAN Already Do:**
- Horizontal layout family ✅
- Large numbered circular milestone nodes (consulting theme: `showOrdinalNumber: true`, `shape: 'circle'`) ✅
- Date label above / title below milestone (consulting theme: `dateLabelAbove: true`, `titleLabelBelow: true`) ✅
- Light background (consulting/minimal theme) ✅
- Deterministic font sizing and positioning ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| T1-1 | [Theme] | **Alternating above/below node placement** — T1 shows node 02 raised above the line; nodes 01/03 below. Current horizontal layout places all milestones on a single baseline. Need `nodePlacement: 'alternating'` layout mode. | Barbara | M |
| T1-2 | [Theme] | **Centered document title** — title is center-aligned mid-canvas. Current header block is left-aligned in some themes. | Barbara | S |
| T1-3 | [Render] | **Brand logo/image slot** — top-right company logo. Needs `Scene.image` primitive or metadata.logo field + dedicated render slot. | Barbara/Mark | M |

#### T2: Vertical Spine Dark ("Subject Timeline")

**Image:** `design/figures/target-vertical-spine-dark.png`

**Verdict:** 🟡 **Partially renderable** (core structure done, visual polish needed)

**What We CAN Already Do:**
- Vertical-spine layout family ✅
- Alternating left/right entry blocks ✅
- Dark background (showcase theme: `#0D1B2A`) ✅
- Large year labels on spine ticks ✅
- Drop shadow on card blocks (showcase: `cardEffects`) ✅
- Icon badges at content-block corners ✅
- Multi-paragraph description text per entry ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| T2-1 | [Layout] | **Per-segment spine color** — T2 shows distinct spine segment colours (cyan/orange/pink/steel) between year nodes. Current spine is single-color (`axisLineColor`). Need `Milestone.spineColor?: string` or similar + segment-aware rendering. | Barbara/Mark | M |
| T2-2 | [Layout] | **Dashed leader lines + far-edge icon badges** — T2 shows large icon circles at canvas edges, connected back to spine nodes with dashed horizontal lines. Current badges are in-block corners only. Need dedicated `badgePosition: 'edge'` mode + dashed connector style. | Barbara | M |
| T2-3 | [Layout] | **Small arrowheads at spine/entry junction** — decorative chevrons where entries meet the spine. | Barbara | S |
| T2-4 | [IR Schema] | **Multiple sub-blocks ("Subject 1", "Subject 2") per entry** — T2 2023 entry has two named subject sections. Current IR has single `description` string. May need `description_blocks?: Array<{title: string, text: string}>` on Activity/Milestone. | Mark | M |
| T2-5 | [Icon] | **Pictographic icons** (surveyor, crane truck, building) — T2 uses illustrative icons not in our 20-icon registry. Add domain icons or support custom SVG injection. | Barbara | S–M |

#### T3: AI Timeline Dense ("THE AI TIMELINE")

**Image:** `design/figures/target-ai-timeline-dense.png`

**Verdict:** 🟡 **Partially renderable** (structure complete, polish needed)

**What We CAN Already Do:**
- Vertical-spine layout with alternating entries ✅
- Dense multi-decade timeline (1967→2024) — date engine handles long ranges ✅
- Year labels on spine, multi-line descriptions per entry ✅
- Light background theming ✅
- Automatic spacing adjustment for dense clustering ✅

**Remaining Gaps — ALL CLOSED 2026-06-11**

| Gap ID | Type | Description | Owner | Effort | Status |
|--------|------|-------------|-------|--------|--------|
| T3-1 | [Theme] | **Gradient background strip** — T3 has a subtle vertical gradient/wave decorative background. Need `sceneBackground: { kind: 'gradient' }` tuned for vertical layout (currently used in showcase for horizontal). | Barbara | S | ✅ CLOSED |
| T3-2 | [Layout] | **Year-label typography scaling** — T3 year labels are oversized bold (~36pt) vs entry text. Current `fontSizeAxis` is 10pt. Need separate `yearLabelFontSize` token. | Barbara | S | ✅ CLOSED (`fontSizeYearLabel: 16` in ai-timeline theme) |
| T3-3 | [IR Schema] | **Activity.color?: string** — T3 uses 12+ distinct accent colours. While `category` + `categoryMap` works, direct `color` on Activity would be more ergonomic. Milestone already has `color`. | Mark→Barbara | S | ✅ CLOSED (Mark added field; Barbara wired render) |

**T3 overall: FULLY RENDERABLE ✅**

#### T4: Serpentine Glow Path

**Image:** `design/figures/target-serpentine-glow.png`

**Verdict:** 🔴 **Not yet renderable** (serpentine layout family not implemented)

**What We CAN Already Do:**
- Glow effect (`effects: [{ kind: 'glow', ... }]`) via Skia backend ✅
- Start/end icons (`clock` icon exists, GitHub mark would need adding) ✅
- Gradient backgrounds via `sceneBackground` ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| T4-1 | [Layout] | **Serpentine/winding spine geometry** — Core architectural gap. Date-to-position must map onto a parametric Bézier S-curve. Explicitly deferred to **Post-MVP / Priority 3** per decisions-archive.md. | Barbara | L |
| T4-2 | [Icon] | **GitHub logo icon** — T4 has GitHub mark at path start. Not in registry (trademark concern — may need user-supplied SVG). | Barbara | S |

**Decision Reference:** The serpentine layout family was ruled "fundamentally novel, recommended for post-MVP release" in the 2026-06-10 Target Output Coverage Analysis.

#### T5: Gitline Cards (Dark App Timeline)

**Image:** `design/figures/target-gitline-cards.png`

**Verdict:** 🟡 **Partially renderable** (core timeline done, CTA buttons missing)

**What We CAN Already Do:**
- Vertical-spine layout ✅
- Card entry style (`entryStyle: 'card'`) with rounded-rect backgrounds ✅
- Dark theme (showcase) ✅
- Alternating left/right entries ✅
- Date + clock icon per entry (icon field + `clock` icon in registry) ✅
- Title, date, description text blocks ✅
- Shadow effects on cards (Skia backend) ✅
- Cloud/gradient decorative backgrounds (showcase theme) ✅

**Remaining Gaps:**

| Gap ID | Type | Description | Owner | Effort |
|--------|------|-------------|-------|--------|
| T5-1 | [Layout] | **CTA button ("VIEW REPOSITORY")** — T5 entries have a pill-shaped action button below description. Need `url` field to render as button + button primitive (`Scene.button` or styled rect+text). | Barbara | M |
| T5-2 | [Theme] | **Inline date icon** — T5 shows a small clock icon inline with the date text. Current date is text-only. Need icon+text inline block. | Barbara | S |
| T5-3 | N/A | **App chrome** (header, tabs, search, pagination) — **OUT OF SCOPE**. We render the timeline canvas only, not the application shell. | N/A | — |

### Consolidated Gap Table

Sorted by number of targets unblocked (highest leverage first):

| Gap ID | Type | Description | Targets Affected | Owner | Effort |
|--------|------|-------------|-----------------|-------|--------|
| T2-1 | Layout | Per-segment spine color | T2 | Barbara/Mark | M |
| T2-2 | Layout | Dashed leader lines + far-edge icon badges | T2 | Barbara | M |
| T2-4 | IR Schema | Multiple sub-blocks per entry | T2 | Mark | M |
| T3-3 | IR Schema | Activity.color?: string (direct color) | T3 | Mark | S |
| T1-1 | Theme | Alternating above/below milestone placement | T1 | Barbara | M |
| T5-1 | Layout | CTA button rendering from url field | T5 | Barbara | M |
| T4-1 | Layout | **Serpentine spine geometry** | T4 | Barbara | **L** |
| T1-3 | Render | Brand logo/image slot | T1 | Barbara/Mark | M |
| T2-3 | Layout | Small arrowheads at spine/entry junction | T2 | Barbara | S |
| T3-1 | Theme | Gradient background for vertical layouts | T3 | Barbara | S |
| T3-2 | Layout | Year-label typography scaling | T3 | Barbara | S |
| T5-2 | Theme | Inline date icon rendering | T5 | Barbara | S |
| T2-5 | Icon | Domain-specific pictographic icons | T2 | Barbara | S–M |
| T4-2 | Icon | GitHub logo icon | T4 | Barbara | S |

### Gaps Closed Since 2026-06-10 Analysis

The following gaps from the prior analysis are now **resolved**:

| Prior Gap | Resolution |
|-----------|------------|
| Vertical-spine layout family (Render-1) | ✅ Shipped in `vertical-spine.ts` |
| Card-entry rendering (Render-4) | ✅ Shipped via `entryStyle: 'card'` in themes |
| Glow/bloom effects | ✅ Shipped in Skia backend + showcase theme |
| Shadow effects | ✅ Shipped in Skia backend + showcase theme |
| Milestone.icon | ✅ Shipped |
| Activity.icon | ✅ Shipped (2026-06-11) |
| Milestone.color | ✅ Shipped |
| Milestone.metadata | ✅ Shipped |
| Numbered-circle milestone shape | ✅ Shipped (`showOrdinalNumber: true`) |
| Gradient/cloud background | ✅ Shipped (`sceneBackground` in showcase) |

### Recommended Build Order

To maximize target coverage with minimal effort:

**Priority 1: Close T3 (AI Timeline Dense) — Already ~90% there**
1. **T3-3: Activity.color** (Mark, S) — enables direct color on Activity for 12+ accent palette
2. **T3-2: yearLabelFontSize token** (Barbara, S) — oversized year labels
3. **T3-1: Gradient background tuning** (Barbara, S) — already infrastructure exists

After these 3 small items, **T3 is fully renderable**.

**Priority 2: Close T5 (Gitline Cards)**
1. **T5-1: CTA button rendering** (Barbara, M) — renders `activity.url` as pill button
2. **T5-2: Inline date icon** (Barbara, S) — clock icon inline with date text

After these 2 items, **T5 is fully renderable** (excluding out-of-scope app chrome).

**Priority 3: Polish T2 (Vertical Spine Dark)**
1. **T2-1: Per-segment spine color** (Barbara/Mark, M) — visually distinctive
2. **T2-2: Far-edge badges + dashed leaders** (Barbara, M)
3. **T2-4: Multi-block descriptions** (Mark, M) — IR extension
4. **T2-3: Arrowheads** (Barbara, S)
5. **T2-5: Domain icons** (Barbara, S–M)

**Priority 4: Close T1 (Horizontal Numbered)**
1. **T1-1: Alternating node placement** (Barbara, M)
2. **T1-3: Logo slot** (Barbara/Mark, M)

**Post-MVP: T4 (Serpentine)**
- **T4-1: Serpentine layout** — L effort, explicitly deferred per prior decisions.

### Summary

| Target | Previous Verdict | Current Verdict | Change |
|--------|-----------------|-----------------|--------|
| T1 Horizontal Numbered | 🔴 Partial | 🟡 Partially renderable | ⬆️ |
| T2 Vertical Spine Dark | 🔴 No | 🟡 Partially renderable | ⬆️⬆️ |
| T3 AI Timeline Dense | 🔴 No | 🟡 Partially renderable | ⬆️⬆️ |
| T4 Serpentine Glow | 🔴 No | 🔴 Not yet (deferred) | — |
| T5 Gitline Cards | 🔴 No | 🟡 Partially renderable | ⬆️⬆️ |

**Key Insight:** With ~8 small/medium items, we can close T1, T3, and T5 fully. T2 needs the most visual polish work. T4 remains a post-MVP target per architectural decisions.

---

## Decision: Activity.color Field Added (2026-06-11)

**Author:** Mark (IR & Data Modeling)  
**Status:** Accepted  
**Requested by:** ormasoftchile  
**Context:** Gap T3-3 from Barbara's target gap analysis — closing target T3 ("THE AI TIMELINE", dense vertical-spine timeline with 12+ distinct accent colors).

### Decision

Add an optional `color?: string` field to the `Activity` entity, mirroring the existing `Milestone.color?: string` field exactly.

### Motivation

Target T3 requires per-activity accent colors across 12+ activities. `Milestone.color` already existed for this purpose on milestones. `Activity` was the only top-level IR entity (alongside Track and Group, which already have `color`) that lacked a color override. This gap blocked Barbara's rendering work for T3.

### Field Specification

| Property | Value |
|---|---|
| Field name | `color` |
| Type | `string` (optional) |
| Default | `undefined` (renderer falls back to theme/status defaults) |
| Semantics | Explicit fill/accent color override for the activity bar. Any valid CSS color string (hex, named, rgb(), hsl(), etc.). Interpreted by the renderer; the IR carries it as a semantic hint only. |
| Validation | **None** — free CSS string, unvalidated, identical to `Milestone.color` behavior. |
| Palette enforcement | Not applied. If palette enforcement is introduced in future, it MUST be applied to `Activity.color`, `Milestone.color`, `Track.color`, and `Group.color` simultaneously to maintain parity. |

### Parity Rationale

`Milestone.color` has never been validated against a CSS palette or a restricted set of values. Applying stricter validation to `Activity.color` would create an asymmetry with no technical justification. The rendering layer (Barbara) is responsible for interpreting the color value and providing fallback behavior for invalid or missing colors.

### Files Changed

| File | Change |
|---|---|
| `packages/core/src/types.ts` | Added `color?: string` to `Activity` interface after `icon`, with doc comment |
| `packages/core/src/schema.ts` | Added `color: z.string().optional()` to `activitySchema` after `icon`, matching Milestone ordering |
| `packages/schema/v1/timeline.json` | Regenerated via `pnpm -r build`; Activity.color now appears as `{ type: "string" }`, not in `required` array |
| `packages/core/test/validate.test.ts` | Added 3 tests: hex color accepted, named CSS color accepted, omitted color accepted |
| `packages/schema/test/schema.test.ts` | Added 1 test: JSON Schema exposes Activity.color as optional string |

### Test Results

- **Preimage:** 478 tests passing  
- **Postimage:** 481 core + 6 schema + 3 CLI = **490 tests passing**, all green  
- `pnpm -r typecheck` ✅  
- `pnpm -r test` ✅  

### Handoff to Barbara

The field is live in the IR. Barbara can now read `activity.color` during rendering:
- `activity.color` — `string | undefined`, free CSS color
- If `undefined`, fall back to theme/status defaults (existing behavior unchanged)
- No palette validation is performed by the IR layer; Barbara may apply her own fallback for unrecognized values

**Note:** In the canonical **IR Contract** section above, Activity now has optional `color?: string` (free CSS, unvalidated, parity with Milestone.color).

---

## Decision: T3 "THE AI TIMELINE" — Gaps Closed (2026-06-11)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-11  
**Status:** MERGED

### Context

Target T3 is a dense vertical-spine timeline spanning 1967–2024 with per-entry accent colors,
large bold year labels, and a subtle gradient background. Three gaps remained from prior analysis.
This record documents the decisions taken to close all three.

### T3-3 — Activity.color Precedence Rule

**Decision:** Mirror Milestone.color precedence exactly.

Precedence chain (highest → lowest):
1. `activity.color` / `milestone.color` (explicit free CSS string on the IR entry)
2. `categoryMap[category]` fill (theme-level category override)
3. `statusMap[status]` fill (theme-level status color)
4. Theme default fill

**Implementation:**
- `vertical-spine.ts`: `resolveStatusStyle(status?, category?, colorOverride?)` — when `colorOverride`
  is set it overrides both `fill` and `stroke` in the returned style object.
- `horizontal.ts`: simple `??` chain: `activity.color ?? catOverride?.fill ?? base?.fill ?? defaultFill`
- Undefined or invalid color strings are passed as-is; if the SVG or Skia renderer rejects them
  they fall back to the theme default transparently (no crash).

### T3-2 — Year-label Typography Token

**Token name:** `fontSizeYearLabel` (added to `TypographyTheme` in `themes/types.ts`)
**Type:** `number` (point size, optional)
**Default:** unset → falls back to `fontSizeAxis` (existing behaviour, zero regression)

When set, `vertical-spine.ts` computes:
```
yearFontPx    = ptToPx(theme.typography.fontSizeYearLabel)
yearFontWeight = 700   (always bold when the token is explicitly set)
```

Geometry constraint at 16pt on a 1200px canvas:
- TICK_LABEL_X = 614px
- Entry-text start (right side) = SPINE_X + CONNECTOR_LEN + BLOCK_INNER_PAD = 668px
- "1967" text width at 16pt ≈ 41.6px → right edge = 655.6px → gap = 12.4px > OVERLAP_EPSILON (4px) ✅

The `ai-timeline` theme sets `fontSizeYearLabel: 16`. All other built-in themes remain unaffected.

### T3-1 — Gradient Background for Vertical Layouts

**Decision:** No new infrastructure required. Use existing `SceneBackground { kind:'gradient' }`.

The `sceneBackground` gradient path was already implemented and production-verified by the
`showcase` theme (Skia backend, cloud + gradient). Enabling it for vertical-spine requires only
that the theme's `canvas.sceneBackground` field be set.

**`ai-timeline` theme declaration:**
```typescript
canvas: {
  sceneBackground: { kind: 'gradient', from: '#EEF0FF', to: '#F8F0FF', angle: 90 },
  backgroundColor: '#F7F8FF',  // SVG fallback
}
```

`angle: 90` → top-to-bottom (cos(90°)=0, sin(90°)=1 in Skia backend). SVG backend ignores
`sceneBackground` per existing contract and uses `backgroundColor` instead.

### New Theme: `ai-timeline`

**File:** `packages/core/src/themes/ai-timeline.ts`
**Fidelity tier:** Tier 2 (Skia art effects, card style, gradient)
**Key tokens:**
| Token | Value |
|-------|-------|
| `entryStyle` | `'card'` |
| `fontSizeYearLabel` | 16 |
| `sceneBackground` | `{ kind:'gradient', from:'#EEF0FF', to:'#F8F0FF', angle:90 }` |
| `backgroundColor` | `'#F7F8FF'` (SVG fallback) |

Vivid status palette tuned for AI-history content:
- planned → #7C3AED (deep violet)
- in-progress → #0EA5A8 (teal)
- done → #2D9E67 (green)
- risk → #D97706 (amber)
- delayed → #E05B5B (red)
- milestone (default) → #5B4FCF (indigo)

### New Fixtures

| File | Purpose | Quality gate |
|------|---------|--------------|
| `examples/gallery/ai-timeline.timeline.yaml` | Gallery discovery; 4 milestones, 4 activities, single track | Scanned; passes all 5 themes × 2 layouts |
| `examples/showcase/ai-timeline.timeline.yaml` | Full T3 dense showcase; 12 milestones, 8 activities, 2 tracks | Not scanned (showcase/ not in quality gate glob) |

The showcase fixture is loaded directly by `skia.test.ts` for the T3 Skia golden.

### Bonus: Horizontal Tick-label Density Fix

Added `tickLabelVisible[]` pre-computation in `horizontal.ts` before the tick loop.
Labels are suppressed when their left edge is within `MIN_TICK_LABEL_GAP` (4px) of the
previous label's right edge. This is a pure deterministic function and does not change
existing rendered output for timelines with adequate tick spacing (all existing goldens unaffected).

### Validation

- `pnpm -C packages/core test` → 486/486 ✅
- `pnpm -r test` → 495/495 ✅
- `pnpm -r typecheck` → clean ✅
- `pnpm -r lint` → clean ✅
- Skia determinism test → unchanged ✅
- Existing theme goldens → unchanged ✅

---

## Decision: Vertical-Spine Even-Spacing Mode (2026-06-11)

**Author:** Barbara (Semantics & Rendering)
**Status:** Shipped

### Problem

The `ai-timeline` fixture spans ~57 years (1967–2024 ≈ 20,800 days) with only ~20 entries.
In the time-proportional spine layout, `pixelsPerDay` hits its hard floor of `0.4`, producing
`hDraw = spanDays × 0.4 ≈ 8,300 px` → canvas 1200×8839 px.  The vast empty space between
sparse entries (e.g. the 18-year gap 1967→1985 with no entries) makes the output unusable.

The target design (T3 AI Timeline) is an **infographic sequence** — years are labels, not
proportional axis positions.  Entries should be equidistant.

### Decision

Add a `spineSpacing?: 'time' | 'even'` token to `ResolvedTheme` controlling how the
vertical-spine layout engine assigns y-coordinates to entries.

#### `'time'` (default, existing behaviour — unchanged)
- Time-proportional: `dateY(ord)` maps ordinals to y via `pixelsPerDay`.
- Min-spacing pass enforces `ENTRY_MIN_SPACING = 100 px` minimum between adjacent nodes.
- All existing themes unaffected; golden outputs byte-identical.

#### `'even'` (new mode, opt-in)
- Entries are placed at **uniform intervals** regardless of temporal gaps:
  ```
  nodeYs[i] = spineTopY + i × evenStep
  ```
- `evenStep = max(ENTRY_MIN_SPACING, maxBlockHeight + BLOCK_VERT_GAP_EVEN)` where
  `BLOCK_VERT_GAP_EVEN = 20 px`.  This guarantees no card overlap.
- The min-spacing pass is **skipped** (entries are already uniformly spaced).
- Canvas height shrinks to `O(nEntries × evenStep)` regardless of time span.

#### Duration bands in `'even'` mode
Activity duration bands (`endKind = 'fixed'`) still render on the spine, but the
end-y coordinate is determined by **`evenDateY`** — linear interpolation between the
even-spaced positions of the two adjacent entries that bracket `endOrd`:

```
t = (endOrd − entries[i].ord) / (entries[i+1].ord − entries[i].ord)
yEnd = nodeYs[i] + t × (nodeYs[i+1] − nodeYs[i])
```

This keeps bands visually meaningful (they still span proportionally between the entries
that bookend the activity's duration) without being time-scaled to the full axis.

Ongoing/TBD activities extend to `finalSpineBottomY - 8` unchanged.

#### Tick labels in `'even'` mode
The standard time-based `vsTicks` loop is **skipped**.  Instead, one year label is
rendered per entry at its sequence y-position, on the **left** side of the spine
(`textAnchor: 'end'` at `SPINE_X − TICK_W − 6`).  Year is derived from
`ordinalToDate(entry.ord)[0]`.  This gives the characteristic "large year on the left"
infographic look matching the T3 target.

#### Other date-mapped elements (today marker, period/bracket annotations, callout notes)
All use `effectiveDateY(ord)` which delegates to `evenDateY` in even mode and `dateY`
in time mode.  This ensures annotations remain positioned at semantically correct
(interpolated) y-coordinates.

### Degenerate cases

| Case | Behaviour |
|------|-----------|
| 0 entries | `hDraw = 200 px`, "No entries in time range" message, spine renders normally |
| 1 entry | `evenStep = ENTRY_MIN_SPACING`, single entry at `spineTopY` |
| Entries at same ordinal | Sorted by id (stable), placed at consecutive even positions (no collision) |
| Activity without duration (`endKind = 'none'`) | No band drawn (unchanged) |
| Activity with `endOrd < firstEntry.ord` | `evenDateY` clamps to `spineTopY` |
| Activity with `endOrd > lastEntry.ord` | `evenDateY` clamps to last entry's y |

### Token placement

`spineSpacing` is declared in `ResolvedTheme` (themes/types.ts) alongside `entryStyle`
and `sceneBackground` — the other vertical-spine-specific tokens.

### Themes opting in

Only `ai-timeline` sets `spineSpacing: 'even'`.  All other themes omit the token
(→ default `'time'`, byte-identical output).

### Result

| Metric | Before | After |
|--------|--------|-------|
| Canvas height (ai-timeline showcase) | 8839 px | 2370 px |
| Tests | 486 / 486 | 486 / 486 |
| Existing goldens changed | — | 0 (only ai-timeline-ai-theme-skia.png) |
| typecheck | ✅ | ✅ |
| lint | ✅ | ✅ |
# Decision: Vertical-Spine Gap Compression + spineSpacing Render Option

**Date:** 2026-06-11  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Shipped

---

## Problem

Sparse long-span timelines (e.g. 1967–2024 with ~8–20 entries) produce absurdly tall canvases
when rendered with any theme that uses the default 'time' spacing mode.  Root cause: the
`pixelsPerDay` floor is 0.4, so `hDraw = spanDays × 0.4 = 8328 px` for a 57-year fixture.
The minimum-spacing pass only grows positions — it cannot compress empty multi-decade gaps.

This affected every gallery render of `ai-timeline.timeline.yaml` that was NOT using the
`ai-timeline` theme (which already had `spineSpacing: 'even'` from the previous session).
Confirmed giant files: `ai-timeline-showcase-skia.png` (8762 px), `ai-timeline.png` (8732 px),
`ai-timeline.svg` (8760 px).

---

## Decision A — Gap Compression in 'time' Mode (Robustness Guard)

**File:** `packages/core/src/layout/vertical-spine.ts`

Add an automatic gap-compression pass to 'time' mode that fires ONLY when the average
time-proportional spacing per entry exceeds a threshold:

```
isGapCompressed = !isEvenSpacing && nEntries > 1
               && hDrawTime / nEntries > GAP_K_TRIGGER × ENTRY_MIN_SPACING
```

Constants: `GAP_K_TRIGGER = 4` (400 px), `GAP_K_CAP = 2` (200 px).

When triggered, each consecutive raw gap is capped:
```
nodeYs[i] = nodeYs[i-1] + min(rawNodeYs[i] - rawNodeYs[i-1], 200)
```

`hDraw` for gap-compressed mode is set from the final `nodeYs` (not `hDrawTime`), so the
canvas height is proportionally compact.  `effectiveDateY` delegates to `evenDateY` (piecewise
linear between entry positions) in both even and gap-compressed modes, keeping all derived
primitives (ticks, sections, annotations) geometrically consistent.

**Determinism contract:** Normal timelines whose average ≤ 400 px/entry produce zero change.
Verified by checking all gallery fixtures (avg ≤ 100 px/entry) and the committed SVG golden
(`examples/golden/our-timeline.svg`) which remains byte-identical.

---

## Decision B — spineSpacing as a Render Option

**File:** `packages/core/src/types.ts`, `packages/core/src/render/index.ts`

Added `spineSpacing?: 'time' | 'even'` to `RenderOptions`.  When set, it overrides the theme's
own `spineSpacing` declaration:

```typescript
if (options?.spineSpacing !== undefined) {
  theme = { ...theme, spineSpacing: options.spineSpacing };
}
```

This allows callers to force even spacing for any fixture/theme combination without modifying
the IR or the theme, satisfying the "render-level option preferred" principle.

**Gallery/showcase wiring:**
- `skia.test.ts` showcase gallery spec for `ai-timeline.timeline.yaml`: `spineSpacing: 'even'`
  added so the showcase PNG is always compact regardless of theme.
- `quality.test.ts`: new "Gallery emit" section writes `examples/gallery/ai-timeline.svg` and
  `examples/gallery/ai-timeline.png` with `{ theme:'consulting', spineSpacing:'even' }` so
  these committed gallery files are always regenerated compact.

---

## Before → After Heights

| File | Before | After |
|------|--------|-------|
| `examples/gallery/ai-timeline.png` | 8732 px | **990 px** |
| `examples/gallery/ai-timeline.svg` | 8760 px | **990 px** |
| `examples/gallery/showcase/ai-timeline-showcase-skia.png` | 8762 px | **1076 px** |
| `examples/gallery/showcase/ai-timeline-ai-theme-skia.png` | 2370 px | 2370 px (no change) |

---

## Test Results

- `pnpm -C packages/core test`: **488/488 pass**
- `pnpm -r typecheck`: clean
- `pnpm -r lint`: clean
- `examples/golden/our-timeline.svg`: byte-identical (golden.test.ts passes)
- `examples/golden/showcase-skia.png`: size-identical (skia golden passes)
