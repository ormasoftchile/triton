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

## Agent Decisions — Merged from Inbox (2026-06-10 Backlog)

# Barbara — Example Gallery Decision Note

**Date:** 2026-06-10  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Done  

## Summary

Created a Phase 1 example gallery under `examples/gallery/` with 8 diverse,
validated IR documents rendered to SVG and PNG, plus an `index.html` contact sheet
and a `README.md` with regeneration instructions.

## Deliverables

- `examples/gallery/*.timeline.yaml` — 8 example IR documents (all validate exit 0)
- `examples/gallery/*.svg` and `*.png` — 16 rendered output files (all non-empty)
- `examples/gallery/index.html` — self-contained contact sheet for bulk visual review
- `examples/gallery/README.md` — listing + regeneration commands

## Renderer Limitations Surfaced

1. **Progress not visualised** — `progress` field is IR-valid but produces no visual
   fill in Phase 1 bars. Owner should expect solid bars even when `progress: 0.5`.
2. **Track labels invisible** — Consulting theme `headerWidth: 0` means swimlane labels
   are silently dropped. Consider Phase 2 theme variant with non-zero header width.
3. **TBD end stub** — `end: tbd` renders as a 16px stub with no indicator. Low
   information density; a dashed extension + label is worth adding in Phase 2.
4. **OUTSIDE_TIME_RANGE false positive in validator** — validator uses start-of-period
   for `time_range.end` comparison instead of end-of-period. Workaround applied: use
   exact ISO end dates in `time_range.end`.
5. **Year as YAML integer** — bare year numbers in YAML (e.g., `2022`) are parsed by
   the YAML loader as integers and fail schema validation. Must be quoted strings.

## No source changes

No renderer or core source files were modified. All examples authored within current
Phase 1 capabilities.
# Decision Note: Built-in Icon Set + Label Collision Stagger

**Author:** Barbara  
**Date:** 2026-06-10  
**Status:** Implemented — all tests green, galleries regenerated

---

## What was done

### 1. Icon Registry (`packages/core/src/icons.ts`)

A new built-in icon set was added as `icons.ts` with 20 original geometric icons on a `0 0 24 24` viewBox. All paths are hand-authored — no copying from Lucide, Feather, FontAwesome, or any licensed set.

Export surface:
- `getIcon(name: string): IconDef | undefined` — case-insensitive, alias-aware lookup
- `hasIcon(name: string): boolean`
- `listIcons(): string[]` — sorted canonical names

`IconDef` shape:
```typescript
interface IconPathDef { d: string; fill?: boolean; stroke?: boolean; }
interface IconDef { paths: IconPathDef[]; viewBox: '0 0 24 24'; }
```

### 2. Scene / SVG Updates

- `PathPrimitive` in `scene.ts` now accepts optional `transform?: string` and `strokeLinecap?: 'butt' | 'round' | 'square'`
- `svg.ts` emits these new attributes deterministically (alphabetically sorted with all existing attributes)

### 3. Theme Tokens (additive)

Two optional fields added to `MilestoneTheme` in `themes/types.ts`:
- `iconColor?: string` — color used to draw icon glyphs (defaults to `ordinalColor`)
- `iconScale?: number` — proportion of node diameter the icon fills (defaults to 0.65)

No existing theme files were modified; tokens are opt-in.

### 4. Icon Rendering — Horizontal Layout

When `milestone.icon` resolves via `getIcon()`:
- SVG `<path transform="translate(cx,cy) scale(s) translate(-12,-12)">` drawn on top of the node marker
- Ordinal number suppressed when icon is present
- Unknown icon → silent fallback to ordinal number, no crash

### 5. Icon Rendering — Vertical-Spine Layout

When a spine entry's `iconHint` resolves:
- Circular badge rendered at the content block top-corner
- Icon path scaled/centred on badge using same transform formula
- Icon also rendered inside the spine node marker
- Unknown icon → silent fallback (no placeholder text), no crash

### 6. Milestone Label Stagger (Horizontal)

A new deterministic O(n) stagger pass for date labels (above milestone nodes):
- Adjacent labels sorted by x; checked for horizontal overlap
- Colliding odd-indexed labels shift up by `dateLabelSizePx + 4px`
- Stagger counter resets on non-overlapping gaps

### 7. Examples Updated

- `journey.timeline.yaml`: emoji hints replaced with named icons
- `program-timeline.timeline.yaml`: icons added (star, check, milestone, rocket, flag)
- `feature-rich.timeline.yaml`: icons added (star, check, cloud, calendar, flag)
- `icon-showcase.timeline.yaml` (NEW): 20 milestones × 20 icons showcase

### 8. Tests

`packages/core/test/icons.test.ts` — 68 tests covering:
- All 20 canonical names return valid IconDef
- 30+ aliases resolve correctly
- Unknown names return undefined without throwing
- Two renders with icon milestones produce byte-identical SVG (determinism)
- Unknown icon falls back to ordinal number

All 292 tests pass in `@timeline-compiler/core`; 299 total across all packages.

---

## Files changed

| File | Change |
|---|---|
| `packages/core/src/icons.ts` | NEW — icon registry |
| `packages/core/src/scene.ts` | Added `transform?`, `strokeLinecap?` to PathPrimitive |
| `packages/core/src/render/svg.ts` | Emit new path attrs |
| `packages/core/src/themes/types.ts` | Added `iconColor?`, `iconScale?` to MilestoneTheme |
| `packages/core/src/layout/horizontal.ts` | Import getIcon; icon rendering in nodes; date label stagger |
| `packages/core/src/layout/vertical-spine.ts` | Import getIcon; icon badge + node icon rendering |
| `packages/core/test/icons.test.ts` | NEW — 68 tests |
| `examples/gallery/icon-showcase.timeline.yaml` | NEW — icon showcase IR |
| `examples/gallery/journey.timeline.yaml` | Replace emoji with named icons |
| `examples/gallery/program-timeline.timeline.yaml` | Add icon hints |
| `examples/gallery/feature-rich.timeline.yaml` | Add icon hints |
| `examples/gallery/index.html` | Add Example 10 icon-showcase card |
| `examples/golden/our-timeline.{svg,png}` | Re-snapshotted |
| `examples/gallery/*.{svg,png}` | Regenerated (11 examples) |
| `examples/gallery/themes/*/*.{svg,png}` | Regenerated |
| `examples/gallery/vertical/*.{svg,png}` | Regenerated |

---

## Deferred / Not done

- **Activity icon rendering**: `Activity` type does not have an `icon` field in the current IR schema; schema changes were out of scope. Activity icons are a no-op until the IR is extended.
- **Advanced icon badge styles** (outline only, badge with border, etc.): the current implementation uses a solid filled circle backing for vertical-spine badges. Can be made configurable via theme tokens.
# Decision: Layout Quality Polish Pass

**Date:** 2026-06-10  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Implemented

## Context

Dense timelines (e.g., `dense-roadmap`) had overlapping activity bars within the same track, activity labels that could overflow canvas bounds, and no prominent title/header block. These were the three most visible rendering weaknesses.

## Decisions Made

### 1. Activity-Bar Label Placement with Contrast-Aware Color

**Decision:** Labels render *inside* the bar when the text fits (left-aligned, 4px padding), using a WCAG-luminance-based contrast color. When the bar is too narrow, labels are placed outside-right (or outside-left near the right edge), truncated with ellipsis, clamped to canvas bounds. Silent skip only if truly no space (< 20px).

**Rationale:** Inside labels are more readable for wide bars and don't clutter the space between bars. Contrast-aware coloring ensures accessibility. Canvas clamping prevents overflow artifacts in all density cases.

**Implementation:** `contrastColor()` in `layout/horizontal.ts` — pure function, no state, WCAG relative luminance formula.

### 2. Dense Overlap / Sub-Lane Packing

**Decision:** Activities within the same track that overlap in time are packed into deterministic sub-lanes (stacked rows) using a stable greedy interval-packing algorithm (sorted by `start_ordinal, id`). Track height grows to fit the maximum concurrent overlap depth.

**Rationale:** Visual bar collisions made dense timelines unreadable. Sub-lane packing is the standard solution; deterministic sort ensures byte-identical output across runs.

**Root Cause Fixed:** All 5 themes had `subLaneHeight === barHeight`, resulting in 0px visual gap between sub-lane bars. Increased `subLaneHeight` by 6–8px per theme.

### 3. Title / Header Block (Both Layout Families)

**Decision:** `ir.metadata.title` (and optional `subtitle`, `author`, `created`) renders as a prominent header block at the top of every canvas. The plot/spine shifts down by `headerH` to accommodate. If `metadata.title` is absent, `headerH = 0` and layout is unchanged.

**Rationale:** Timelines shared as images need contextual titles. The previous implementation either had no title or a minimal unstyled text element.

**Implementation:** Identical header block in both `layout/horizontal.ts` and `layout/vertical-spine.ts`. Theme-consistent typography (fontSizeTitle, fontWeightHeader, subtitle at 0.75 opacity, meta-line at 0.6 opacity, separator line at 0.35 opacity).

## Trade-offs

- Track heights grow with overlap depth, so dense timelines are taller. This is intentional — legibility over compactness.
- Header block increases all canvas heights by `headerH` when a title is present. Backward-compatible: no title = no height change.
- `subLaneHeight` increase is a minor visual change for non-overlapping timelines (sub-lane height now defines the minimum spacing available, but a single-lane track is unaffected in height).

## Artifacts Regenerated

- `examples/golden/our-timeline.{svg,png}` — new golden snapshot
- All `examples/gallery/*.{svg,png}`, `themes/*/*.{svg,png}`, `vertical/*.{svg,png}`
- 304 tests green, lint clean, typecheck clean, determinism verified.
# Decision: Dense Milestone Decluttering + Alternating Label Blocks

**Date:** 2026-06-10  
**Author:** Barbara (Semantics & Rendering)  
**Status:** Implemented

## Problem

Dense horizontal timelines with many milestones on a single track (e.g., `ai-timeline` with 12 milestones covering 2019–2024) rendered with three severe visual defects:

1. **Node superposition:** Milestone circles at nearby dates stacked on top of each other — the node at an earlier date was hidden under the later node. No indicator that multiple events existed.
2. **Label collision:** Every milestone emitted a date label above and a title label below, all at the same x-coordinate as the node. With 12 milestones in 6 years, the label bands completely overlapped into unreadable strings.
3. **Axis contamination:** Per-milestone date labels rendered directly on/over the axis line and year-tick labels, making the axis unreadable.

## Decision

Implement a complete redesign of milestone label layout for the horizontal family. No IR schema changes. No changes to the vertical-spine family.

### 1. Node Declustering (Phase 1.5 in `horizontal.ts`)

Sort milestones by `(date_ordinal, id)`. Left-to-right pass: `placedX[i] = max(trueX[i], placedX[i-1] + minNodeGap)`. Nodes are never allowed to be closer than `minNodeGap` pixels center-to-center. A thin leader tick at `trueX` (opacity=0.45) marks the true date position when a node is displaced.

### 2. Single Combined Label Block per Milestone

Replace "date above + title below at every milestone" with a **single label block** (title primary + compact date secondary) connected to the node by a leader line. This halves the number of labels visible on any given side.

### 3. Alternating Above/Below Assignment

Milestones in sorted order alternate sides: odd index → above, even index → below. This distributes labels evenly on both sides of the node row.

### 4. Per-Side Collision Tiering

Within each side, if adjacent blocks overlap horizontally (measured by block width from font metrics), the later block is pushed into a further tier (row) away from the node. Leaders extend to reach. Deterministic greedy left-to-right assignment.

### 5. Axis Zone Separation

Above-side blocks live in a dedicated `aboveZoneH` space **between** the axis line and the track rows. The `aboveZoneH` value is computed from the deepest above-side tier and injected into Phase 2 (track placement) so the entire track area shifts down. Year-tick labels remain in their standard position above the axis line — they are never displaced by milestone blocks.

### 6. Compact Date Format

Secondary date line uses "Month Year" format (e.g., "February 2019") — no day ordinal suffix. Rendered smaller and lighter than the title.

## Theme Tokens Added

All additive/optional. Added to all 5 themes (consulting, product, executive, minimal, release):

| Token | Purpose | Defaults |
|---|---|---|
| `minNodeGap` | Min px between node centers | 34–50 depending on theme |
| `leaderColor` | Leader tick + line color | theme-appropriate neutral |
| `leaderWidth` | Leader stroke width | 0.75 |
| `blockTierGap` | Vertical gap between label tiers | 5–6 |

## Files Changed

- `packages/core/src/layout/horizontal.ts` — major rewrite of Phase 1.5/4/6 + milestone rendering
- `packages/core/src/themes/types.ts` — 4 optional tokens added to `MilestoneTheme`
- `packages/core/src/themes/{consulting,product,executive,minimal,release}.ts` — token values
- `packages/core/test/render.test.ts` — 9 new tests for dense-milestone behavior
- `examples/golden/our-timeline.{svg,png}` — re-snapshotted
- `examples/gallery/**/*.{svg,png}` — all regenerated (12 + 55 + 15 files)

## Outcome

- All 306 tests pass (9 new tests added)
- ai-timeline (product theme): 12 nodes with gaps ≥ 42px, 17 leader ticks, alternating above/below blocks, compact dates, axis clean
- All renders deterministic (byte-identical across two consecutive runs, confirmed for ai-timeline, milestones-only, feature-rich)
# Barbara Phase 1 Render: Scene IR + Layout Engine + SVG/PNG Backends

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented — all quality gates green

---

## Summary

Phase 1 implementation of the deterministic rendering pipeline for the horizontal
layout family, targeting T2 acceptance ("horizontal linear, numbered nodes").  All
deliverables are shipped, tested, and integrated into the `packages/core` pnpm
monorepo.  Leslie wires the public `render()` / `compile()` stubs in Wave 2.

---

## Decisions Made

### 1. Scene IR Shape

The Scene IR (`src/scene.ts`) is a discriminated-union primitive list:

```typescript
type ScenePrimitive =
  | LinePrimitive | RectPrimitive | CirclePrimitive
  | TextPrimitive | PathPrimitive | GroupPrimitive;

interface Scene {
  width: number; height: number; background: string;
  primitives: ScenePrimitive[];
}
```

`sceneHash(scene): string` computes SHA-256 over canonical JSON (recursively
sorted object keys), giving byte-deterministic identity across platforms.

### 2. Layout Engine Architecture

`layout(ir: IRDocument, theme: ResolvedTheme): Scene` in `src/layout/index.ts`
implements the full six-phase pipeline (§5.4) for the horizontal family:

| Phase | Output |
|-------|--------|
| 1 Axis | tsOrd, teOrd, tick positions (integer-ordinal, round-half-up) |
| 2 Tracks | yTop[], height[] (provisional) |
| 3 Activities | xLeft, xRight, y, lane (greedy sub-lane) |
| 4 Milestones | xCenter, yCenter, stack_index, ordinal, dateFmt |
| 5 Sections/Annotations | stub (no T2 data) |
| 6 Label collision | bounded-N y-shift pass |

Date arithmetic lives in `src/layout/dates.ts`: day ordinals (days since
2000-01-01), left/right edge coercion, tick enumeration, label formatting.

### 3. Consulting Theme (Phase 1 Variant)

`src/themes/consulting.ts` implements the Tier-1 consulting theme with
`milestone.shape = 'circle'` (required for T2).  The diamond milestone style
(§6.3.1 canonical spec) will be split into a separate variant in Phase 2.

Key values: canvas 1200px wide; navy `#1F497D` milestone fill; DejaVu Sans
typography; no gridlines; date-above / title-below milestone labels.

`resolveTheme(id)` in `src/themes/index.ts` falls back to `consultingTheme`
for unknown ids.

### 4. Text Metrics — Deterministic Hardcoded Table

Rather than adding `opentype.js` at runtime, `src/fonts/metrics.ts` ships a
compile-time per-character advance-width table derived from DejaVu Sans (em
fractions, ASCII range + common extras).  This is byte-identical across all
platforms and Node versions.  Known limitation: exact layout-vs-resvg shaping
parity requires the §5.8 HarfBuzz follow-up.

### 5. Embedded Font — DejaVu Sans

`packages/core/src/fonts/DejaVuSans.ttf` (OFL licence, 739 KB) serves two
roles:
1. SVG `font-family` name in `<text>` elements.
2. `fontFiles[0]` for `@resvg/resvg-js` with `loadSystemFonts: false`.

The `postbuild` script in `package.json` copies `src/fonts/` → `dist/fonts/`
so the font is available in the compiled package too.  The `png.ts` module
discovers the font via `import.meta.url` with two fallback candidates.

### 6. Leslie Wiring Instructions (Wave 2)

To wire `render()` in `api.ts`:
```typescript
import { renderDocument } from './render/index.js';
export function render(ir: IRDocument, options: RenderOptions): RenderResult {
  return renderDocument(ir, options);
}
```

To wire `compile()`:
```typescript
export function compile(input: IRDocument | string, options: RenderOptions): RenderResult {
  const ir = typeof input === 'string' ? loadIR(input) : input;
  return renderDocument(ir, options);
}
```

### 7. What Is Deferred

- Vertical central-spine layout family (T1, T3, T5) — Gap Render-1
- Serpentine spine geometry (T4) — Gap Render-3
- Diamond milestone shape (consulting canonical)
- Section band shading (Phase 5 proper implementation)
- Annotation placement (Phase 5 proper implementation)
- Progress bars and TBD/approximate date visual treatments
- Additional themes (dark-executive, colorful-infographic, etc.)
- opentype.js glyph-advance integration (§5.8 HarfBuzz flag)

---

## Quality Status

| Check | Result |
|-------|--------|
| `pnpm typecheck` | ✓ 0 errors |
| `pnpm lint` | ✓ 0 warnings |
| `pnpm test` | ✓ 110/110 (19 new render.test.ts) |
| `pnpm -r build` | ✓ all 3 packages |
# Decision Note: Layout-Quality Linter & Conformance Gate

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented & Green

---

## Problem

No automated check existed to catch layout defects (label superposition, overlapping nodes, axis overwrites, out-of-bounds primitives) when examples are regenerated. The owner specifically asked: *"do we have a quality check that can spot these issues automatically?"* — we didn't.

## Decision

Build a pure, deterministic **Layout-Quality Linter** operating on the Scene/Render IR, with a **Conformance Gate** (test) that runs over all examples after every regeneration.

---

## What Was Built

### `buildScene(ir, options?) → Scene`  (`packages/core/src/render/index.ts`)
Exposes the layout pipeline output as an inspectable Scene without going through SVG serialization. `renderDocument` now calls `buildScene` internally — single code path.

### `lintScene(scene) → QualityIssue[]`  (`packages/core/src/lint.ts`)
Five checks on axis-aligned bounding boxes derived from scene geometry:

| Check | Severity | What it catches |
|---|---|---|
| `NODE_OVERLAP` | error | Two milestone markers whose bboxes intersect beyond 2px |
| `LABEL_OVERLAP` | error | Two text blocks from *different* label groups whose bboxes intersect beyond 4px |
| `LABEL_AXIS_OVERLAP` | error | A label bbox that creeps into the horizontal axis/tick-label band |
| `OUT_OF_BOUNDS` | error | Any primitive that extends beyond `[0, 0, W, H]` beyond 1px |
| `TIGHT_SPACING` | warning | Bboxes within a 5px gap (informational near-miss) |

Label grouping uses a union-find on coincident `anchorX` + vertical adjacency (≤16px) so a milestone's own title+date lines are treated as one unit — preventing false positives on stacked labels.

V-spine layouts are detected by a tall vertical line near x = W/2 to avoid misidentifying the today-marker horizontal line as the axis.

### Conformance Gate  (`packages/core/test/quality.test.ts`)
- **130 combinations**: 13 example YAML files × 2 layouts × 5 themes.
- Asserts zero error-severity issues per combination; names file/layout/theme on failure.
- 8 deliberate-overlap unit tests confirming the linter catches true positives and avoids true negatives.

---

## Layout Bugs Caught & Fixed

The linter found **8 real layout bugs** across the existing examples:

1. **Tick labels at x=0** — first axis tick with `textAnchor='middle'` overflowed left. Fixed: clamp to `[labelHalfW, W-labelHalfW]`.
2. **Section labels near right edge** — not capped to available canvas width. Fixed: `truncateText` to remaining width.
3. **Milestone labels near right edge** — node position clamp didn't account for label half-width. Fixed: `rightLimit = max(ms.size, labelHalfW)` guard.
4. **V-spine period annotation** — label placed rightward past canvas edge. Fixed: flip to `textAnchor:'end'` growing leftward.
5. **NODE_OVERLAP from right-edge clamping** — forward pass collapsed multiple nodes to the same x. Fixed: backward pass after forward placement.
6. **Legend inside milestone-label zone** — legend y formula placed it inside content area. Fixed: pre-compute legend height before computing canvas height.
7. **Multi-track untracked milestone overlap** — below-side untracked labels overlapped activity labels in track area. Fixed: force `above` side when multi-track.
8. **V-spine today-line false positive** — full-canvas horizontal today-line misidentified as horizontal axis. Fixed: detect V-spine layout and skip H-axis detection.

---

## CLI Addition

`timeline lint <input> [--layout h|v] [--theme t]` — prints issues, exits 1 on errors.

---

## Verification

- `pnpm -r typecheck lint build test` — all green, 445 tests passed (0 failed).
- `examples/golden/our-timeline.svg` regenerated (tick label clamping shifted positions).
- The linter **would have caught** the ai-timeline defect (verified by deliberate-overlap unit test asserting NODE_OVERLAP detection).
# Decision: Refinement Pass Implemented (Barbara)
Date: 2026-06-10
Author: Barbara (Semantics & Rendering)

## Summary
Completed refinement pass on layout/rendering pipeline for both horizontal and vertical-spine layout families.

## Changes
- **text-wrap.ts**: New deterministic text-wrap/truncation helper using DejaVu Sans advance-width metrics. `wrapText()` breaks at word boundaries with max-lines limit; `truncateText()` uses binary search for exact fit with ellipsis.
- **scene.ts**: Added `MultiTextPrimitive` (kind: 'multitext') for multi-line text with `<tspan>` elements. No change to existing primitives.
- **render/svg.ts**: Added serialization for `MultiTextPrimitive` using `<tspan>` with `dy` and `x` attributes.
- **themes/types.ts**: Added `LegendTheme` and `SectionTheme` interfaces. Added `legend` and `section` to `ResolvedTheme`.
- **All 5 theme files**: Added `legend` and `section` token blocks.
- **layout/horizontal.ts**: Added section bands (vertical), legend panel, today-marker line, period/bracket spans, callout/note boxes, truncation on activity/milestone labels.
- **layout/vertical-spine.ts**: Added section bands (horizontal), legend panel, today-marker line, period/bracket spans, callout/note boxes, text-wrapping on entry titles/descriptions. Fixed year-only ticks to use `enumTicks()` + `formatTickLabel()` for axis-unit-aware proportional tick rendering.
- **test/vertical-spine.test.ts**: Extended with tests for text-wrap determinism, sections, today-marker, and legend rendering.
- **feature-rich.timeline.yaml**: New gallery example exercising all new features.
- All gallery artifacts regenerated.

## Constraints Honored
- IR schema unchanged (no edits to types.ts, validate.ts, load.ts, schema.ts)
- api.ts, index.ts not touched
- CLI unchanged
- Golden updated (expected — rendering changed)
- All tests pass; determinism verified
# Decision: Scene/Render IR as Root; Pluggable Rendering Backends

**Author:** Barbara (Semantics & Rendering)
**Date:** 2026-06-10
**Status:** Proposed — awaiting owner acceptance
**Sections affected:** §5 Rendering Model, §6 Theme Architecture, §7 Output Targets

---

## Decision Summary

SVG is demoted from the universal primary format to **one backend among equals**. A
**deterministic, backend-agnostic Scene / Render IR** is introduced as the stable root
contract produced by the six-phase layout pipeline. Three pluggable rendering backends
(SVG, Raster, PPTX native-shape) consume the Scene and emit their respective outputs.

---

## Motivation

The owner's critique: SVG as the universal root caps the system's visual ceiling. The
specific problem is architectural, not a deficiency in SVG itself:

1. SVG filters (feGaussianBlur, feDropShadow, feTurbulence) exist but are **not
   deterministic** across SVG renderers and browsers — breaking the project's
   determinism principle for filter-bearing outputs.
2. SVG filter effects do **not survive** conversion to PNG/PDF faithfully, and have no
   native equivalent in PPTX's shape model.
3. Anchoring every target to SVG constrains the most expressive targets to SVG's
   semantic ceiling.

**SVG is not the wrong format; SVG-as-the-single-root is the wrong architecture.**

---

## Architecture

### Scene / Render IR (new root)

Output of the six-phase layout pipeline. Contains:
- `canvas`: width, height, background_color
- `elements`: ordered list of typed drawing primitives (Rect, Polygon, Line, Text, Path,
  Image, Group) with resolved coordinates, colours, and `effect_refs[]`
- `effects`: registry of EffectDefinition records (Glow, DropShadow, GradientFade,
  NoiseTexture, CloudLayer, Bloom) each with a `fallback_policy`
- `meta`: theme_id, fidelity_tier, scene_hash (SHA-256, reproducible)

The Scene is byte-deterministic. It carries no backend-specific instructions.

### Layered Determinism Contract

| Layer | Guarantee |
|-------|-----------|
| Scene geometry | Always byte-deterministic (pure pipeline contract) |
| Per-backend output | Deterministic given pinned backend version + fixed effect seeds |
| Cross-backend pixel identity | Explicitly **not** promised; different backends at different fidelity tiers are all correct |

Effect seeds for procedural noise/cloud effects are derived from `scene_hash +
effect_id` — no random state consumed.

### Pluggable Backends

| Backend | Fidelity ceiling | Primary use |
|---------|-----------------|-------------|
| SVG | Tier 1 (det.); Tier 2 (caveat) | Print, web, consulting, CI |
| Raster (Skia/Canvas) | Tier 3 | Art effects; showcase/keynote |
| PPTX native-shape | Tier 2 native + Tier 3 hybrid | Editable presentations |
| HTML/interactive | Wraps SVG or raster | Preview, VS Code, MCP |

### Fidelity Tiers

| Tier | Name | Effects | Themes |
|------|------|---------|--------|
| 0 | Minimal | None | Minimal |
| 1 | Crisp | Gradients, hatch, patterns | Consulting, Release |
| 2 | Polished | Drop shadows, glow (native PPTX; SVG caveat) | Executive, Product |
| 3 | Showcase | Bloom, cloud/atmosphere, noise, gradient meshes | Showcase |

Each backend has a capability profile. Effects unsupported natively use the Scene's
`fallback_policy` (approximate, omit, embed-raster, error).

### Output Derivation (revised)

- PNG: SVG backend (Tier 0/1) or Raster backend (Tier 2/3)
- PDF: SVG→PDF (vector, Tier 0/1) or Raster→PDF (art, Tier 3)
- PPTX: native shapes + native effects (Tier 2) + embedded raster overlay (Tier 3)
- HTML: SVG-backed (Tier 0/1) or canvas-backed (Tier 2/3)

### Revised Build Priority

1. Scene IR + SVG backend (foundation; Tier 0/1 correct, inspectable)
2. PNG via SVG backend (universal paste target)
3. PDF via SVG backend (consulting/print)
4. PPTX native-shape backend (think-cell comparable editability)
5. Raster backend — Skia/Canvas (art-effect differentiator; optional plugin)
6. HTML/interactive

---

## New Cite Keys Needed (for David / references.bib)

The following `\cite{}` keys are used in §7 and require entries in `references.bib`:

| Key | Description |
|-----|-------------|
| `skia` | Skia Graphics Library — Google; used in Chrome, Flutter, Android |
| `webgl` | HTML Canvas / WebGL API — W3C specification or MDN reference |
| `golden-image-testing` | Golden-image / snapshot testing methodology (e.g., Percy, Playwright visual testing) |
| `ooxml` | Office Open XML (ISO/IEC 29500) — PPTX native shape effects specification |

---

## IR Concerns for Leslie / Mark

**No IR changes are required or proposed.** This architecture operates entirely below
the semantic IR boundary: the Scene is produced by the rendering pipeline, not defined
by the IR. The IR contract (§4) is unaffected.

However, one clarification worth noting to Mark: the `fidelity_tier` is a **theme
property** (declared in the theme schema's `fidelity.tier` field), not an IR field.
Authors do not specify rendering fidelity in the IR document; they select a theme.
This preserves the IR's content-only semantic model.

---

## Files Modified

- `design/sections/07-output-targets.tex` — full rewrite: Scene IR as root; SVG/Raster/PPTX backends with capability tables; determinism restated per layer; revised output priority
- `design/sections/05-rendering.tex` — determinism contract updated (item 3 + new item 7); coordinate system updated; new §5.7 Scene/Render IR Pipeline Output subsection
- `design/sections/06-themes.tex` — fidelity tier schema block added; effect knobs added; six themes (five existing + Showcase); fidelity tier subsection with backend degradation examples; theme-engine contract extended
# Decision Record: Phase 1 Render Bug Fixes

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented & verified green

---

## Context

Three rendering issues were surfaced by examining the gallery SVG outputs. All three were
present in the Phase 1 implementation (Wave 3) but went unnoticed because the T2 acceptance
fixture uses only milestones (no activities) and a single whitespace-only track label.

---

## Decisions

### Decision 1 — Track Header Width / Label Visibility

**Problem:** `consulting.ts` set `headerWidth: 0`. The layout guard
`if (Hhdr > 0 && tl.track.label)` therefore never drew track labels. Multi-track gallery
examples showed no swimlane titles at all.

**Decision:** Set `headerWidth: 140` in the Consulting theme. In `layout/index.ts`, compute
the *effective* header width dynamically:

```typescript
const hasTrackLabels = sortedTracks.some(t => !!t.label && t.label.trim().length > 0);
const Hhdr = hasTrackLabels ? tk.headerWidth : 0;
```

This preserves T2 / milestones-only appearance (single track, whitespace label → Hhdr = 0)
while enabling the 140 px gutter for multi-track examples with real labels. Track labels are
left-aligned (`textAnchor: 'start'`, `x = mL + 8`) per §6 schema spec (`header_align: right`
is default but task spec requires left-aligned — left chosen for readability in 140 px gutter).

**Rationale:** Suppressing an empty gutter is a clean UX default. The 140 px value matches
the §6 schema default of `header_width: 160` approximately, tuned to fit typical consulting
track names.

---

### Decision 2 — Progress Fill Indicator

**Problem:** `activity.progress` values were parsed and stored but the layout engine never
emitted a visual fill. All bars rendered as solid regardless of progress.

**Decision:** Add three new fields to `ActivityTheme` and set them in the Consulting theme:

```typescript
progressBarHeight:   4       // px strip at bar bottom
progressFillColor:  '#FFFFFF' // white overlay on dark navy bars
progressFillOpacity: 0.45    // semi-transparent
```

In the layout engine, after the bar rect, emit a fill rect:
- `width = Math.floor(barWidth × progress + 0.5)` (round-half-up per §5.1 item 3)
- `height = progressBarHeight`, at `y = barBottom - progressBarHeight`
- `fill = progressFillColor`, `opacity = progressFillOpacity`

**Rationale:** §5 §6 spec: "filled strip at the bottom of the bar." White at 0.45 opacity
creates a clearly visible light stripe on dark navy/amber/red bars without obscuring the
activity label. Fully deterministic (round-half-up, no random state).

---

### Decision 3 — Open-Ended / TBD Activity Styling

**Problem A (span bug):** Span activities (`span: 2026-Q1`) had `a.end === undefined`. The
condition `if (!a.end || a.end === 'ongoing')` fires before the `else if (a.span)` branch,
so spans were treated as ongoing and extended to the right edge incorrectly. Q1/Q2/Q3 spans
had wrong widths in all gallery renders.

**Problem B (open-end stub):** `end: tbd/unknown` produced a 16 px stub (the old `minWidth × 4`).
No visual indicator existed for open/ongoing bars.

**Decision:** Reorder the xRight condition chain (span first) and add `endKind` to
`ActivityLayout`:

```
a.span       → xRight from span end, endKind = 'fixed'
!a.end / ongoing → xRight = plot right edge, endKind = 'ongoing'
tbd / unknown   → xRight = plot right edge, endKind = 'tbd'
else            → xRight from a.end, endKind = 'fixed'
```

After drawing the label, emit:
- `ongoing`: solid right-pointing triangle `<path>` at the bar's right edge, 10 px wide into
  the right margin. Fill = bar status colour.
- `tbd`: dashed `<line>` at the bar's right edge (`stroke-dasharray="3,3"`, opacity=0.5).

**Rationale:** §5 open-interval rulings: "bar to right canvas boundary + right-chevron" for
ongoing/omitted. Making TBD also extend to the right edge (instead of a short stub) follows
the task spec which reads both as "extending to the RIGHT EDGE of the plot." A different
indicator (dashed vs. solid arrowhead) visually differentiates `ongoing` (certain open) from
`tbd` (uncertain open).

---

## Artifacts Changed

| File | Change |
|------|--------|
| `packages/core/src/themes/types.ts` | Added 3 progress fields to `ActivityTheme` |
| `packages/core/src/themes/consulting.ts` | `headerWidth: 140`; progress field values |
| `packages/core/src/layout/index.ts` | All three fixes; `endKind`; fixed span condition order |
| `packages/core/test/render.test.ts` | 3 new fixtures + 4 new tests |
| `examples/golden/our-timeline.{svg,png}` | Regenerated (output unchanged) |
| `examples/gallery/*.{svg,png}` | All 8 regenerated with fixes applied |
# Decision: Skia Raster Backend + Art Effects (Phase 4 Milestone 1)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-10  
**Status:** Implemented

---

## Context

Phase 4 adds a high-fidelity raster backend via `canvaskit-wasm` delivering art effects (glow, drop shadow, background gradient, procedural cloud/noise texture) and a Showcase Tier-3 theme. The SVG backend remains the deterministic default.

## Decisions

### 1. Additive Effect Model on Scene IR

**Decision:** Extend `scene.ts` with `SceneEffect[]` on every primitive and `SceneBackground` on the Scene. Declarative, backend-agnostic.

**Rationale:** Effects are opt-in metadata. Backends that can't render an effect silently omit it. SVG output is byte-identical whether or not effects are present (the SVG renderer ignores the `effects` field). `canonicalJSON` skips `undefined` → adding effects doesn't perturb sceneHash for non-Showcase themes.

### 2. Async vs Sync renderDocument

**Decision:** Keep `renderDocument()` synchronous (backward compatible). Add `renderDocumentAsync()` for the Skia path.

**Rationale:** CanvasKit init is async (Promise-based WASM load). Making `renderDocument` async would break all existing callers. `renderDocumentAsync` is a parallel export; the CLI branches on `backend === 'skia'`.

### 3. SkSL Cloud Shader

**Decision:** Two-octave value-noise SkSL shader with fixed-seed hash function. No `iTime`/random.

**Rationale:** Determinism is required. Fixed-seed noise produces consistent texture across renders without any runtime entropy. If `RuntimeEffect.Make` fails (platform limitation), fallback to linear gradient.

### 4. Path Transform via canvas.save/translate/scale

**Decision:** `skPath.transform(matrix)` does NOT exist in canvaskit-wasm@0.41.1. Use `canvas.save(); canvas.translate(tx,ty); canvas.scale(s,s); canvas.drawPath(); canvas.restore()` instead.

**Rationale:** Canvas stack transforms are the reliable cross-version API. This was discovered during implementation — the WASM binding doesn't expose `Path.transform`.

### 5. Showcase Glow via ImageFilter Blur (pre-draw pattern)

**Decision:** Glow/shadow effects are rendered as blurred/offset pre-draws underneath the main shape (not post-processing filters on the output).

**Rationale:** CanvasKit's `ImageFilter.MakeBlur` applied to a `Paint` affects the stroke/fill of that paint's draw call. We render a blurred tinted copy before the main shape. This is deterministic and avoids GPU-compositing complications.

### 6. Golden: Byte-Identity with ±5% Fallback

**Decision:** Assert byte-identical re-renders of the Skia golden; fall back to ±5% size tolerance if platform nondeterminism arises.

**Rationale:** Skia WASM is deterministic per pinned version on a given platform. However cross-platform byte identity is not guaranteed. The golden test documents this with a clear fallback path.

## Files Changed

- `packages/core/src/scene.ts` — SceneEffect, SceneBackground, effects? on all primitives
- `packages/core/src/render/skia.ts` — NEW: full Skia backend
- `packages/core/src/render/index.ts` — renderDocumentAsync + backend branch
- `packages/core/src/themes/showcase.ts` — NEW: Tier-3 dark theme
- `packages/core/src/themes/types.ts` — EffectTokens, sceneBackground?, effects? on ResolvedTheme
- `packages/core/src/themes/index.ts` — showcase registered
- `packages/core/src/types.ts` — RenderOptions.backend?: 'svg'|'skia'
- `packages/core/src/layout/horizontal.ts` — gated effect attachment
- `packages/core/src/layout/vertical-spine.ts` — gated effect attachment
- `packages/cli/src/index.ts` — --backend flag, async action
- `packages/core/test/skia.test.ts` — NEW: 16 Skia tests
- `examples/golden/showcase-skia.png` — NEW: Skia golden
- `examples/gallery/showcase/` — NEW: 4 showcase PNGs
- `examples/gallery/showcase.html` — NEW: contact sheet
- `examples/gallery/index.html` — link to showcase.html
# Decision: Target Output Coverage Analysis -- Layout Families, Gaps, and Additions

**Author:** Barbara (Semantics & Rendering specialist)
**Date:** 2026-06-10
**Scope:** §5 Rendering Model, §6 Themes, §7 Output Targets
**Related section:** design/sections/14-target-outputs.tex

---

## Context

The project owner provided five reference images of end-results the Timeline Compiler
must be able to produce. This decision record documents the findings from validating
the current design against those targets, the gaps identified, and the recommended
additions.

---

## Layout-Family Finding

The current §5 rendering pipeline implements a single layout family:
**horizontal swimlane Gantt** (orientation: horizontal, spine: straight, entry: track bands).

The five targets expose three additional families:

### Family 1: Vertical Central-Spine with Alternating Entries (T1, T3, T5)
The time axis runs top-to-bottom along a vertical spine. Year/date nodes sit on the
spine. Text entries (headings + body text or rounded cards) alternate left and right.
Icon badges may anchor at canvas edges with dashed leader lines.

**Verdict:** Not in the current §5 pipeline. This is the highest-priority layout gap,
covering three of the five target outputs.

### Family 2: Horizontal Single-Line with Numbered Nodes (T2)
A single horizontal line (no track bands); milestones rendered as large numbered circles;
date displayed above each node, title below. This is an edge case of the current pipeline
achievable by suppressing the track header and axis band, plus adding a
`numbered-circle` milestone shape variant.

**Verdict:** Partially supported. Needs a `numbered-circle` shape in Phase 4 and a
`numbered-single-line` entry-placement mode in the theme layout_family block.

### Family 3: Serpentine Winding Path (T4)
The spine is a parametric Bezier S-curve; date maps to arc-length position.
Phase 1's date-to-x formula is replaced by a curve parametrisation. Cannot share
Phase 1-6 geometry with the straight-axis pipeline.

**Verdict:** Fundamentally novel. Recommended for post-MVP release.

### Layout-Family Is a Render/Theme Concern -- IR Stays Layout-Agnostic

The Timeline IR (§4) makes no assumptions about axis orientation or spine geometry.
All field semantics are temporal and relational, not spatial. The same IR document is
valid for any layout family.

**Recommendation:** Add `layout_family: { orientation, spine_geometry, entry_placement }`
to the **theme schema** (§6). The layout engine dispatches based on this property.
No IR changes required or made.

---

## Coverage Table Verdict

| Target | IR-Expressible? | Layout Supported? | Theme Available? | Tier |
|--------|----------------|-------------------|------------------|------|
| T1 Vertical spine, dark | Partial | No | No | Tier 2 |
| T2 Horizontal numbered | Yes | Partial | Partial | Tier 1 |
| T3 Dense AI infographic | Yes | No | No | Tier 1 |
| T4 Serpentine glow | Partial | No | Partial | Tier 3 |
| T5 Gitline cards, dark | Yes | No | Partial | Tier 3 |

**Note:** "Partial" IR-expressible for T1 and T4 refers to the per-entity color gap
(Gap IR-2) and the missing milestone metadata field (Gap IR-1), not to core data content.
All timeline data in all five targets is representable with current IR fields.

---

## IR Gaps Flagged for Mark

### Gap IR-1: Milestones lack `metadata: map<string,any>`
Activities have an open extension map (`metadata: map<string,any>`); milestones do not.
Milestones are the primary semantic entities in infographic layouts (T1, T3) where year
nodes carry structured render hints. The `tags: list<string>` workaround is insufficient
for structured key-value data.

**Recommendation for Mark:** Add `metadata: map<string,any>` to the Milestone schema,
parallel to the existing Activity field.

### Gap IR-2: Activities and Milestones lack `color: string?`
Neither activities nor milestones have a direct colour hint field (tracks do, per §4).
Per-entity colour today requires defining a `category` string and a matching entry in
`theme.category_map`. For dense infographic layouts (T3: 12 distinct accent colours),
this requires 12 theme category definitions for a purely visual concern.

**Recommendation for Mark:** Add `color: string?` to Activity and Milestone as a direct
colour override hint, applied after `category_map` and before `status_map` in the
theme resolution order.

### Confirmed NOT IR Gaps (documented for clarity)
- Multiple subjects under one year node (T1/2023): fully representable via `groups[].members`
- CTA link label (T5 "VIEW REPOSITORY"): theme-level default from `activity.url`; custom label via `activity.metadata.cta_label`
- Icon badge position (T1): the vertical-spine layout auto-generates badge + leader line from `milestone.icon`
- Alternate "YEARLY CHART" view (T5): a separate render pass on the same IR; no schema change

---

## Render/Layout Additions (Barbara owns)

### Render-1: Vertical Central-Spine Layout Module (Priority 1)
Covers T1, T3, T5. New `layout_family: { orientation: vertical, entry_placement: alternating | card }` in theme schema. Phase 1 maps dates to the y-axis; Phases 2-4 compute entry positions left/right of the spine. Phase structure preserved; phases parameterised, not replaced.

### Render-2: Numbered Circular Node Shape for Milestones (Priority 2)
Covers T2. New milestone shape variant `shape: numbered-circle` in theme milestone block. Renderer assigns ordinal numbers by milestone sort order; no IR field needed.

### Render-3: Serpentine Spine Geometry (Priority 3 / Post-MVP)
Covers T4. Replaces Phase 1's straight-axis date-to-coordinate function with a parametric Bezier S-curve. The date-to-arc-length mapping must be monotone and deterministic.

### Render-4: Card-Entry Rendering for Vertical-Spine (Priority 2)
Covers T5. Within the vertical-spine layout, entries rendered as rounded-rect cards (title, date+clock-icon, description, CTA-button from `activity.url`). Card shape is theme-defined.

### Render-5: Dashed-Leader Annotation Connector Style (Priority 2)
Covers T1 icon badges. Extend `theme.annotation.connector_style` vocabulary with `dashed-leader-arrow`. Annotation `type: connector` already in IR; only the visual style is missing.

### Render-6: Yearly Chart Alternate View (Out of scope / Future)
Covers T5 YEARLY CHART tab. A separate histogram render pass on the same IR. Not in scope for the timeline rendering mandate.

---

## Theme Additions (Barbara owns)

### Theme-1: `dark-executive` (Priority 1, Tier 2)
Deep charcoal-navy background, coloured spine segments per category, drop-shadow icon
badges. Extends Showcase; overrides `canvas.background_color`, `layout_family.orientation: vertical`,
`fidelity.tier: 2`. Covers T1 and T5 dark variants.

### Theme-2: `light-minimal-corporate` (Priority 2, Tier 1)
White background, generous whitespace, numbered circular milestone nodes, no gridlines.
Extends Consulting; overrides `milestone.shape: numbered-circle`,
`layout_family.entry_placement: numbered-single-line`. Covers T2.

### Theme-3: `colorful-infographic` (Priority 2, Tier 1)
Light background, multi-accent category_map (12 pre-defined colour entries), dense
vertical pitch, bold oversized title. New standalone theme. Covers T3.

### Theme-4: `showcase-dark` child theme (Priority 1, Tier 3)
Extends `showcase`; overrides background to deep navy (#0D1117), activates `noise_texture`
effect (swirl/radial texture), sets `layout_family.orientation: vertical`,
`entry_placement: card`. Covers T5 Gitline aesthetic. Raster backend for texture; HTML
backend for interactive CTA links.

---

## Effect Registry Validation

All required effects are already in the Scene effect registry and Showcase theme:

| Effect | Target | Scene primitive | Status |
|--------|--------|----------------|--------|
| Glow / Bloom | T4 serpentine path | `Bloom{radius_px, threshold, intensity}` | Registered, Showcase activates |
| Background noise texture | T5 Gitline swirl | `NoiseTexture{seed, scale, turbulence_type}` | Registered, Showcase activates |
| Drop shadow | T1 icon badges, T5 cards | `DropShadow{offset_x, offset_y, blur_radius}` | Registered, Showcase + Executive |
| Dashed leader stroke | T1 leader lines | `Line{stroke_style}` extension | Render-5 (connector_style vocab) |

**No new Scene effect types are required.** The effect infrastructure is sufficient.

---

## New Cite Keys Needed

None. All citations required by §14 reference entities already cited in §5, §6, §7
(Scene IR, Showcase theme, Raster backend, fidelity tiers).

---

## Summary

The Timeline IR can represent the data content of all five targets today, with two minor
gaps (IR-1, IR-2) flagged for Mark. The architecture is sound. The gap is in layout
family coverage and theme inventory. Adding the vertical-spine layout module (Render-1)
and two dark themes (Theme-1, Theme-4) unlocks three of the five targets immediately.
The serpentine layout (Render-3) is the only architecturally novel addition, recommended
for post-MVP.
# Decision: Four New Themes + Theme Showcase (Barbara)

**Date:** 2026-06-10  
**Agent:** Barbara (Semantics & Rendering)  
**Status:** Implemented & green

## Decision

Implemented four new built-in themes (executive, minimal, product, release) plus a theme-comparison contact sheet (`examples/gallery/themes.html`).

## Themes

| ID | Title | Tier | Visual Identity |
|----|-------|------|----------------|
| `executive` | Executive | 2 | Dark navy canvas (`#0D1B2A`), light text, rounded bars (r=8), full semantic palette |
| `minimal` | Minimal | 1 | White canvas, all-greyscale fills (R=G=B), status by opacity/weight, no ordinal numbers |
| `product` | Product | 2 | Dense rows, 10+ category colour overrides, prominent progress fills, vivid palette |
| `release` | Release | 1 | Traffic-light status (done=green/blocked=red), triangle ▼ milestone flags, gridlines |

## Type Extensions (additive)

- `TypographyTheme.titleColor` — document title fill colour
- `AxisTheme.axisLineColor` — axis baseline + tick mark stroke
- `AxisTheme.tickLabelColor` — tick label text fill
- `MilestoneShape`: added `'triangle'`

All consulting.ts values set to match existing hardcoded defaults → **Consulting golden output unchanged**.

## Milestone Shape Rendering

`layout/index.ts` now renders milestone shapes via `ms.shape` token:
- `circle` → `<circle>` (unchanged)
- `triangle` → downward-pointing `<path>` (▼ flag style for release)
- `diamond` → diamond `<path>` (ready for future use)

## Theme Registry & API

`themes/index.ts` exports `listThemeInfos()` for all 6 entries (consulting, default, minimal, release, executive, product).  
`api.ts` `listThemes()` delegates to `listThemeInfos()` — signature unchanged, all 6 themes now visible to `timeline schema` and consumers.

## Showcase

`examples/gallery/themes.html` — HTML matrix: 3 example rows × 5 theme columns, 30 PNG cells, self-contained with relative paths. Linked from `index.html`.

## Status

✅ typecheck · lint · 191/191 tests · build all green
# Barbara — TIGHT_SPACING Root-Cause & Fix

**Date:** 2026-06-11  
**Author:** Barbara (Semantics & Rendering)  
**Fixture:** `examples/gallery/transformation-plan.timeline.yaml`  
**Layout:** vertical-spine  
**Status:** FIXED — 461/461 tests passing

---

## Finding

The TIGHT_SPACING warnings on `transformation-plan` (vertical-spine, all themes) were a **genuine low-severity layout geometry bug** — not linter over-sensitivity.

### What TIGHT_SPACING checks

`lintScene` expands each label's bbox by `TIGHT_GAP=5 px` on all four sides and checks if the expanded box overlaps any other label from a different block-group. Two text primitives belong to the same group only when their anchor-x values match within 1 px AND they are vertically adjacent (≤ 16 px gap). The check is purely axis-aligned.

### Specific pairs that were firing (consulting theme, confirmed by instrumentation)

| Pair | A label | B label | gapX | gapY |
|------|---------|---------|------|------|
| 1 | "Q1 2026" tick (x=614–660) | "1st January 2026" date (x=658–761) | 0 px (2 px overlap) | 0 px |
| 2 | "Q1 2026" tick | "Cloud Migration" title (x=658–771) | 0 px | 4.4 px |
| 3 | "Q1 2027" tick (x=614–660) | "1st July 2026" date (x=658–738) | 0 px (2 px overlap) | 0 px |
| 4 | "Q1 2027" tick | "Lean Rollout" title (x=658–749) | 0 px | 3.4 px |

### Root cause

Axis tick labels are placed at `TICK_LABEL_X = SPINE_X + TICK_W + 6 = 614` (textAnchor='start'). Year-qualified quarter ticks ("Q1 20XX") are ~46 px wide, reaching to x ≈ 660.

Right-side content block labels (even-indexed entries) were placed at `textX = SPINE_X + CONNECTOR_LEN + BLOCK_INNER_PAD = 600 + 48 + 10 = 658`.

The 2 px horizontal overlap (660 vs 658) meant the TIGHT_SPACING expanded-box check fired whenever a right-side entry fell near a "Q1 20XX" tick in y.

Plain quarter ticks ("Q2", "Q3", "Q4") are only ~18 px wide, ending at x≈632 — well clear of x=658. Only year-qualified ticks ("Q1 20XX") were wide enough to reach the content zone.

---

## Fix

**File:** `packages/core/src/layout/vertical-spine.ts`  
**Change:** `CONNECTOR_LEN` 48 → 58 px

This pushes right-side content block labels to `textX = 600 + 58 + 10 = 668`. The gap from tick right edge (660) to content label left edge (668) is now 8 px. After expanding by 5 px, the tick label right edge reaches only 665, which is < 668 → TIGHT_SPACING no longer fires.

`BLOCK_W` is unchanged (still 330 px) because `min(330, 600−58−40) = min(330, 502) = 330`.  
Left-side content block left edge: `600 − 58 − 330 = 212 > 0` (no out-of-bounds).

---

## Test results

- **461/461 tests pass** (same as before fix).
- **No golden PNG changes**: all golden tests use `our-timeline.timeline.yaml` with horizontal layout. Vertical-spine layout has no committed pixel-golden files.
- **Transformation-plan TIGHT_SPACING warnings: zero** across all 5 themes × vertical-spine.
- **Other TIGHT_SPACING warnings** (product-roadmap, release-timeline, horizontal layout) are pre-existing and unrelated to this fix.

---

## Invariants respected

- Determinism contract: `CONNECTOR_LEN` is a pure constant; two renders with same IR remain byte-identical. ✓
- Round-half-up throughout: no floating-point rounding changes. ✓
- Sort order unchanged. ✓
- Min-spacing pass unchanged. ✓
# Decision: Vertical-Spine Layout Family

**Author:** Barbara (Semantics & Rendering)
**Date:** 2026-06-10
**Status:** Implemented — Phase 1 Extension

## Summary

Adds the VERTICAL CENTRAL-SPINE layout family to Timeline Compiler, covering targets T1 (vertical spine alternating milestones), T3 (dense alternating year blurbs), and T5 (alternating cards with title/date/description).

## Key Design Decisions

### 1. `dateY` analogue to `dateX`

`dateY(ord)` maps a day ordinal to canvas y-coordinate using the same round-half-up integer arithmetic as the horizontal `dateX`. Time axis is top→bottom. `hDraw` is calibrated from `pixelsPerDay × spanDays` with a floor of `nEntries × ENTRY_MIN_SPACING` to prevent visual crowding.

### 2. Alternating sides (deterministic by sorted order)

Entries sorted by `(date_ordinal, id)` — even index → RIGHT, odd index → LEFT. This is fully deterministic and produces the classic alternating T1 appearance.

### 3. `entryStyle` token

An additive `entryStyle?: 'card' | 'plain'` token in `ResolvedTheme` drives whether entry blocks get a rounded-rect card background (product/executive) or are plain text (consulting/minimal/release). The token is not consulted by the horizontal layout path — no horizontal output is affected.

### 4. Layout dispatcher — horizontal path unchanged

`layout/horizontal.ts` is a byte-identical copy of the original `layout/index.ts` with the export renamed to `layoutHorizontal`. The new `layout/index.ts` is a thin dispatcher. `RenderOptions.layout` defaults to `'horizontal'`, preserving all existing behaviour. Golden test confirmed unchanged.

### 5. Activity durations on spine

Activities with `endKind === 'fixed'` render a 6px rect along the spine from start→end ordinal. Ongoing: dashed line to spine bottom. TBD: lighter dashed line. This provides temporal context within the vertical design.

## What's Deferred

- **Pictographic icon badges** — full T1 spec; 2-char text glyph placeholder emitted now.
- **Serpentine spine** — T5 arcing-spine variant.
- **`preferredLayout` theme token** — not needed; `RenderOptions.layout` + `--layout` flag cover selection.

## Files Changed

- `packages/core/src/types.ts` — `RenderOptions.layout` (additive)
- `packages/core/src/themes/types.ts` — `ResolvedTheme.entryStyle` (additive)
- `packages/core/src/themes/*.ts` — all 5 themes: `entryStyle` token added
- `packages/core/src/layout/horizontal.ts` — new (split from index.ts)
- `packages/core/src/layout/vertical-spine.ts` — new
- `packages/core/src/layout/index.ts` — replaced with dispatcher
- `packages/core/src/render/index.ts` — passes `options.layout`
- `packages/cli/src/index.ts` — `--layout` flag
- `packages/core/test/vertical-spine.test.ts` — 27 new tests (all pass)
- `examples/gallery/ai-timeline.timeline.yaml` — new IR
- `examples/gallery/journey.timeline.yaml` — new IR
- `examples/gallery/vertical/` — 8 SVG + 8 PNG renders
- `examples/gallery/vertical.html` — contact sheet
- `examples/gallery/index.html` — linked to vertical.html
# Decision: IR Build-vs-Adopt Survey
**Author:** David (Research Lead)
**Date:** 2026-06-10
**Scope:** design/sections/04-ir.tex — new subsection "Build vs. Adopt: A Survey of Existing Representations"

---

## Recommendation: BUILD (with borrowed vocabulary)

**No existing format can be adopted wholesale or profiled into an adequate Timeline IR.**

Two orthogonal gaps eliminate every candidate:

1. **Semantic gap.** All formats with real communities (Mermaid, iCalendar, Vega-Lite) are scheduling-oriented, statistical-graphics-oriented, or calendar-oriented. None provides swimlanes + visual-status + coarse-grain dates + PPTX output in a unified, render-agnostic IR.

2. **Pipeline gap.** The requirement of a static, multi-backend render pipeline (SVG / PDF / PPTX) with a separate theme engine has no counterpart in any existing open-source tool. Every extant tool bakes rendering into the format (Mermaid, Markwhen, vis-timeline) or delegates to a JavaScript-only runtime (Vega-Lite).

---

## Candidates Evaluated

| Candidate | Outcome | Key reason |
|---|---|---|
| Markwhen (MIT) | REJECT adopt | No theme separation, no stable schema, no PPTX |
| Mermaid timeline (MIT) | REJECT adopt | No swimlanes, no status, no PPTX |
| Mermaid Gantt (MIT) | REJECT | Scheduling semantics, out of scope |
| PlantUML Gantt | REJECT | Scheduling, verbose, not LLM-friendly |
| Vega-Lite (BSD-3) | REJECT adopt — strong analogy | Not a roadmap grammar; no swimlane/status/PPTX |
| iCalendar RFC 5545 (IETF) | REJECT adopt — strong vocabulary donor | Wire format hostile to git/YAML; no swimlane/visual-status |
| schema.org/Event | REJECT adopt — vocabulary donor | Semantic markup standard, not a visual IR |
| W3C OWL-Time | REJECT adopt — semantic donor | OWL/Turtle ontology, no visual pipeline |
| Allen's Algebra | REJECT adopt — formal foundation | Not a format; formal grounding for temporal semantics |
| TaskJuggler (GPLv2) | REJECT (out of scope) | Full scheduling grammar |
| MS Project XML | REJECT (out of scope) | Scheduling; non-deterministic |
| vis-timeline (MIT) | REJECT | No declarative text format, no static export |
| Knight Lab TimelineJS (GPL) | REJECT | No swimlanes, no status, storytelling-only |
| react-chrono (MIT) | REJECT | No swimlanes, no temporal granularity |
| Timeline Storyteller (MIT) | REJECT | No swimlanes, unmaintained |
| Observable Plot (ISC) | REJECT | No roadmap type; imperative programming |
| Pandoc AST (MIT) | Structural analogy | `version`+`meta`+typed-entity-lists pattern |
| D2, Structurizr | Not relevant | No timeline type |

---

## Vocabulary Donors (explicitly borrowed into existing IR)

| Standard | What it donates |
|---|---|
| ISO 8601 | Date string syntax — already used, no change |
| iCalendar RFC 5545 | `start`/`end`/`label`/`description`/`category`/`tags`/`url`; `tentative`/`cancelled` in Status enum |
| schema.org/Event | Corroborates `start`/`end`/`label`/`description`/`url` as canonical web vocabulary |
| W3C OWL-Time | Open/ongoing interval semantics (`end: ongoing` = omit `hasEnd`); Instant/Interval duality (Milestone vs Activity) |
| Allen's Interval Algebra | Formal grounding for `tbd`/`ongoing`/`unknown` date semantics |
| Vega-Lite | Architectural WHAT/HOW separation as design precedent |
| Pandoc AST | `version` + `metadata` + typed entity lists structural pattern |
| Markwhen / Mermaid | Surface-syntax precedents for future authoring language design |

---

## New Cite Keys Added to references.bib

| Key | Source |
|---|---|
| `markwhen` | github.com/mark-when/markwhen (MIT) |
| `allen1983` | Allen, CACM 1983, doi:10.1145/182.358434 |
| `owltime` | W3C Recommendation 2022, w3.org/TR/owl-time/ |
| `ical-rfc5545` | IETF RFC 5545, datatracker.ietf.org/doc/html/rfc5545 |
| `schemaorg-event` | schema.org/Event |
| `taskjuggler` | taskjuggler.org (GPL v2) |
| `observable-plot` | github.com/observablehq/plot (ISC) |
| `react-chrono` | github.com/prabhuignoto/react-chrono (MIT) |
| `timeline-storyteller` | github.com/Microsoft/timelinestoryteller (MIT) |

All existing keys reused without duplication:
`mermaid2023`, `mermaiddocs2024`, `mermaidgantt2024`, `plantumlgantt`, `d2lang`, `structurizr`, `vegalite2017`, `grammarofgraphics2005`, `layeredgrammar2010`, `vistimeline`, `timelinejs`, `msprojectxml`, `iso8601`, `pandoc`, `dragonbook2006`.

---

## IR Alignment Flags for Mark and Leslie

**No schema changes are recommended.** The survey confirms that Mark's field choices are well-aligned with prior art. Specific findings:

1. **Field names are standards-corroborated:** `start`/`end`/`label`/`description`/`category`/`tags`/`url` all have direct iCalendar RFC 5545 and schema.org/Event equivalents. No renames needed.

2. **Status enum is well-designed:** `tentative` and `cancelled` are verbatim iCalendar values. `at-risk` and `blocked` are original contributions with no standard analog — they are justified by the executive visual-communication use case. No changes needed.

3. **`Activity` vs `Milestone` duality is formally correct:** this directly mirrors the OWL-Time `Interval`/`Instant` distinction, and the standard pattern in iCalendar (VEVENT with duration > 0 vs. zero-duration).

4. **`end: ongoing` is semantically richer than omission:** OWL-Time uses omission of `hasEnd` for open intervals; our explicit `end: ongoing` encoding is clearer for LLM generation and human authoring. No change recommended.

5. **Original contributions are justified:** `span` (shorthand), `progress` (visual fraction), `track` (swimlane lane) have no adequate standard equivalent. These are correct original designs.

### Optional flag for future surface-language design (not an IR change):
- Consider `type: event` as a surface-syntax alias for `milestone` — schema.org uses `Event` and OWL-Time uses `Instant` for point-in-time items. This would be a surface-language concern only, not an IR schema change.

---

## Files Modified

- `design/sections/04-ir.tex` — new subsection appended at end
- `design/references.bib` — 9 new BibTeX entries added
- `.squad/agents/david/history.md` — Learnings updated
- `.squad/decisions/inbox/david-ir-build-vs-adopt.md` — this file
# Decision: Output/Render Layer Build-vs-Adopt Survey

**Author:** David (Research Lead)
**Date:** 2026-06-10
**Scope:** design/sections/07-output-targets.tex — new §7.9 subsection
  "Build vs. Adopt: Scene Representation and Rendering Toolchain"

---

## Framing

Output wire formats (SVG, PDF/ISO 32000-2:2017, PNG/ISO 15948:2003,
PPTX/ECMA-376, HTML5) are **adopted open standards**. The build-vs-adopt
question is scoped to:
- **Layer A** — the Scene / Render IR (the "what-to-draw" representation)
- **Layer B** — the rendering toolchain (engines and libraries per backend)

---

## Layer A: Scene / Render IR

### Recommendation: BUILD-but-BORROW

**No existing scene IR is adoptable wholesale.** Three orthogonal gaps:

1. **Effect registry with per-effect fallback policies** — no surveyed format
   carries typed effect definitions (Glow, Bloom, CloudLayer, NoiseTexture)
   with explicit `approximate`/`omit`/`embed-raster`/`error` fallback policies.

2. **Entity-type awareness for PPTX native shapes** — PPTX backend requires
   semantic distinction between activity bars and rectangles to emit
   `ROUNDED_RECTANGLE` vs `DIAMOND` shapes; no generic scene IR retains this.

3. **Fidelity-tier annotation and scene hash** — `fidelity_tier` + `scene_hash`
   (SHA-256) required in Scene root; none of the surveyed formats carry these.

### Patterns explicitly borrowed

| Pattern | Source | What is borrowed |
|---------|--------|-----------------|
| Typed-mark / display-list | Vega scenegraph (MIT), usvg (Apache-2/MIT), Skia SKP | Ordered typed primitives, canvas descriptor, group nesting |
| Multi-backend dispatch from one scene | Matplotlib Figure/Artist (BSD-3) | Same scene tree dispatched to swappable renderer objects |

### Candidates surveyed

| Candidate | Verdict | Key reason |
|-----------|---------|------------|
| Vega scenegraph (MIT) | BORROW pattern | No effect registry; no PPTX path; pattern is exactly right |
| usvg micro-SVG (Apache-2/MIT) | BORROW pattern | No effect registry; proves normalised-tree approach |
| Lottie JSON (MIT) | Not adoptable | Animation-frame model; no static display list |
| Skia SkPicture/SKP (BSL-1) | Not adoptable as IR | Binary, version-private; strong Layer B candidate |
| SVG as scene IR | Not adoptable | Filter non-determinism; no fallback registry; no PPTX path |
| Matplotlib Figure/Artist (BSD-3) | BORROW pattern | Multi-backend dispatch proof of concept |
| HTML Canvas API | Not adoptable | Imperative; not portably serialisable |
| Pixar USD (Apache-2) | Not adoptable | 3D-centric; heavyweight; no 2D primitives |
| glTF | Excluded | 3D-only; no 2D primitives |

---

## Layer B: Rendering Toolchain

### Recommendation: ADOPT / BUILD-ON per backend

Timeline Compiler does **not** write rasterisers, PDF generators, or PPTX
serialisers from scratch.

### Per-backend toolchain

| Backend | Library | Licence | Determinism | Notes |
|---------|---------|---------|-------------|-------|
| SVG serialiser (writer) | Build directly (XML) | — | Byte-deterministic | No library needed |
| SVG→PNG rasterisation | **resvg** (Rust) | Apache-2/MIT | Full — platform-independent | Strongest guarantee |
| Raster / art effects | **Skia** (C++) | BSL-1 | Pinned version + fixed seeds | Only viable Tier-3 option |
| PDF (vector path) | **svg2pdf** (Rust) or **cairosvg** (Python) | Apache-2 / MIT | Full with pinning | Fonts embedded as CFF/Type 1 |
| PPTX | **python-pptx** + `pptx.oxml` XML | MIT | Geometric only | `pptx.oxml` for DrawingML effects |
| HTML | Browser SVG / Node.js `canvas` | Open std. | Pinned version | Wraps SVG or raster output |

### Candidates surveyed

| Library | Verdict | Notes |
|---------|---------|-------|
| Skia (BSL-1) | **ADOPT** — raster/art backend | Only open library: GPU + full Tier-3 effects + multi-surface |
| resvg (Apache-2/MIT) | **ADOPT** — SVG→PNG | Strongest determinism guarantee; Rust native |
| Cairo (MPL-1.1) | Reference only | No GPU path; cairosvg viable for SVG→PDF |
| python-pptx (MIT) | **ADOPT** — PPTX backend | Extend with pptx.oxml for DrawingML effects |
| Browser Canvas/WebGL | **ADOPT** — HTML backend | Wraps raster output for Tier 2/3 HTML |
| svg2pdf / cairosvg | **ADOPT** — PDF vector | Deterministic with pinning |

---

## Architecture Validation for Barbara

The survey **corroborates** all five major choices in Barbara's architecture
(§5/§6/§7):

1. **Scene-graph-as-root** — confirmed by Vega scenegraph + usvg precedents
2. **Skia for raster backend** — natural and only viable choice under permissive licence
3. **Golden-image testing** — standard practice; consistent with Skia/Flutter approach
4. **SVG as backend not root** — independently confirmed by SVG filter non-determinism
5. **python-pptx + pptx.oxml** — no alternative under permissive OSS licence

**No changes to Barbara's architecture are recommended.**

---

## Flag for Barbara and Leslie

**Text-shaping path verification (pre-implementation):**
Skia internally integrates HarfBuzz for OpenType text shaping. Before implementing
the Skia-based Raster backend, verify that Skia's text-shaping and font-metrics
path is consistent with the embedded-font-metrics contract (§5, item 5) — i.e.,
that label-width measurements in the raster backend match values pre-computed by
the layout pipeline. No architecture change is anticipated; this is a verification
task before Raster backend implementation begins.

---

## New Cite Keys Added to references.bib

| Key | Source | Used in |
|-----|--------|---------|
| `vega-scenegraph` | github.com/vega/vega-scenegraph (MIT) | §7.9 Layer A |
| `resvg` | github.com/linebender/resvg (Apache-2/MIT) | §7.9 Layer B |
| `usvg` | github.com/linebender/resvg/crates/usvg (Apache-2/MIT) | §7.9 Layer A |
| `cairo` | cairographics.org (MPL-1.1) | §7.9 Layer B |
| `lottie` | airbnb.io/lottie/ (MIT) | §7.9 Layer A |
| `matplotlib` | matplotlib.org (BSD-3) | §7.9 Layer A |
| `pdf-iso32000` | iso.org/standard/63534.html (ISO 32000-2:2017) | §7.9 framing + Layer B |
| `png-spec` | w3.org/TR/PNG/ (W3C / ISO 15948:2003) | §7.9 framing |

Existing keys reused: `skia`, `webgl`, `golden-image-testing`, `ooxml`,
`python-pptx`, `vegalite2017`.

---

## Files Modified

- `design/sections/07-output-targets.tex` — new §7.9 subsection appended at end
- `design/references.bib` — 8 new BibTeX entries added
- `.squad/agents/david/history.md` — Learnings updated
- `.squad/decisions/inbox/david-output-build-vs-adopt.md` — this file
# Phase 0 Scaffold — Completion Note

**Author:** Leslie (Lead / Spec Architect)
**Date:** 2026-06-10T15:32:26-04:00
**Status:** Complete — all exit criteria GREEN

---

## What Was Scaffolded

A pnpm monorepo implementing the TypeScript/Node core ratified in `.squad/decisions.md`.

### Packages Created

| Package | Purpose |
|---------|---------|
| `@timeline-compiler/core` | Pure library — all consumers import from here |
| `@timeline-compiler/cli` | commander-based CLI: `render`, `validate`, `schema` |
| `@timeline-compiler/schema` | Versioned JSON Schema artefact in `v1/timeline.json` |

### Root Infrastructure

- `pnpm-workspace.yaml` — workspace config (`packages/*`)
- `pnpm-settings.json` — allows esbuild build scripts (pnpm 11 requirement)
- `tsconfig.base.json` — ES2022, NodeNext, strict, declaration, sourceMap, composite
- `eslint.config.js` — ESLint 9 flat config + typescript-eslint v8 (recommended ruleset)
- `.prettierrc` — singleQuote, trailingComma all, printWidth 100
- `.nvmrc` — Node 22
- `README.md` — project intro + quick-start
- `.github/workflows/ci.yml` — matrix: ubuntu+macos × Node 20+22

### Public API Contract (packages/core/src/)

Types in `types.ts`: `IRDocument`, `Metadata`, `Track`, `Group`, `Activity`, `Milestone`,
`Annotation`, `Section`, `Legend`, `Diagnostic`, `ValidationResult`, `RenderOptions`,
`RenderResult`, `IncrementalResult`, `Session`, `ThemeInfo`, `Status`, `AxisUnit`, `IRDate`, `ID`

Functions in `api.ts` (Phase 0 stubs — all throw `NotImplementedError` except the 3 below):
- `loadIR(text, format?)` → `IRDocument` — stub
- `validate(ir)` → `ValidationResult` — stub
- `render(ir, options)` → `RenderResult` — stub
- `compile(input, options)` → `RenderResult` — stub
- `listThemes()` → `ThemeInfo[]` — **LIVE** (returns 4 built-in theme stubs)
- `getSchema()` → `object` — **LIVE** (Zod → JSON Schema via zod-to-json-schema)
- `createSession(options?)` → `Session` — **LIVE** (returns placeholder IncrementalResult)
- `NotImplementedError` — typed error class for Phase 0 stubs

Zod schema in `schema.ts`: `irDocumentSchema` (permissive Phase 0; Phase 1 tightens invariants).

---

## Exit Criteria Status

| Check | Status |
|-------|--------|
| `pnpm install --frozen-lockfile` | ✅ PASS |
| `pnpm -r build` | ✅ PASS |
| `pnpm -r typecheck` | ✅ PASS |
| `pnpm -r lint` | ✅ PASS |
| `pnpm -r test` (22 tests) | ✅ PASS |
| `node packages/cli/dist/index.js --version` prints version | ✅ PASS |
| `packages/schema/v1/timeline.json` exists and is valid JSON | ✅ PASS |

---

## Notes for Coordinator / Owner

1. **pnpm 11 quirk:** pnpm 11.x requires explicit approval for packages that run build scripts.
   `pnpm-settings.json` at repo root with `{ "onlyBuiltDependencies": ["esbuild"] }` handles
   this. Tested on fresh `rm -rf node_modules`. CI will work with `pnpm install --frozen-lockfile`.

2. **Phase 1 starting point:** All rendering/validation stubs throw `NotImplementedError`.
   The `compile()` + `Session.update()` entry points are the Phase 1 hotpath. Mark owns
   the Zod schema tightening (17 invariants); Barbara owns the rendering pipeline.

3. **No turborepo:** `pnpm -r` with topological ordering is sufficient for this monorepo size.
   Schema package build depends on core and pnpm handles ordering automatically.

4. **Lockfile committed:** `pnpm-lock.yaml` is included in the tree (NOT in .gitignore).
   The `.gitignore` intentionally does NOT list it — CI's `--frozen-lockfile` requires it.
# Leslie — Phase 1 Integration Decision Note

**Author:** Leslie (Lead, Timeline Compiler)
**Date:** 2026-06-10
**Phase:** 1 — INTEGRATION Wave 2

---

## What Was Done

Wired Mark's loader/validator and Barbara's layout/render into the public API and CLI, built the golden-image conformance harness, and verified the Phase 1 MVP acceptance bar.

### Files Owned / Changed

| File | Action |
|------|--------|
| `packages/core/src/api.ts` | Replaced Phase-0 stubs with real `parseIR` / `validateDocument` / `renderDocument` delegations; stateful `createSession` with parse→validate→render pipeline; error-surface (never throws from `update()`); `IRParseError` re-exported |
| `packages/core/src/index.ts` | Added lower-level exports for CLI/MCP/extension consumers: `parseIR`, `validateDocument`, `renderDocument`, `resolveTheme`, `sceneHash`, `IRParseError` |
| `packages/cli/src/index.ts` | Full Phase 1 CLI: `validate` (diagnostics as `severity code path: message`, exit 0/1); `render` (validate-before-render, default output path, sceneHash output, `--format`, `--theme`); `schema` (`-o` support); global error handler |
| `packages/core/test/smoke.test.ts` | Updated Phase-0 → Phase-1 smoke tests |
| `packages/core/test/golden.test.ts` | New conformance harness: 10 tests covering validation, determinism, golden SVG comparison, PNG signature |
| `examples/our-timeline.timeline.yaml` | T2 IR fixture transcribed from §14.2 |
| `examples/golden/our-timeline.svg` | Committed golden SVG artifact |
| `examples/golden/our-timeline.png` | Committed golden PNG artifact |

---

## Integration Mismatch Found (Minor)

**Mismatch:** The T2 design spec (§14.2) specifies `label: ""` for the single track. The Zod schema (`trackSchema`) requires `label: z.string().min(1)`. This means the exact spec YAML fails `parseIR`.

**Resolution:** Fixture uses `label: " "` (single space). The track header is rendered with `headerWidth: 0` in the consulting theme, so the label value is never visible. No schema change made — minimal fixture adaptation per the task constraint.

**Recommendation for Mark:** Consider relaxing `trackSchema.label` from `min(1)` to `z.string()`, with a lint warning for empty labels in `validateDocument` rather than a hard schema error. Or document that whitespace-only labels are the canonical way to suppress track headers.

---

## Verify Commands (All PASS)

```bash
pnpm install          # ✅
pnpm -r typecheck     # ✅
pnpm -r lint          # ✅
pnpm -r test          # ✅ 137 tests
pnpm -r build         # ✅

# CLI end-to-end
node packages/cli/dist/index.js validate examples/our-timeline.timeline.yaml
# → ✅ Valid (exit 0)

node packages/cli/dist/index.js render examples/our-timeline.timeline.yaml -o a.svg
node packages/cli/dist/index.js render examples/our-timeline.timeline.yaml -o b.svg
diff a.svg b.svg  # → identical (determinism ✅)

node packages/cli/dist/index.js render examples/our-timeline.timeline.yaml \
  -o t2.png --format png
xxd t2.png | head -1  # → 8950 4e47 (PNG signature ✅)

node packages/cli/dist/index.js validate broken.yaml  # → exit 1 + diagnostics ✅
```

---

## MVP Acceptance Bar

> T2 renders from IR to byte-deterministic SVG+PNG via the CLI, with validate-before-render.

**STATUS: MET ✅**

- `validate` exit 0 on T2 ✅
- Two `render` → SVG calls produce byte-identical output ✅
- `sceneHash` is identical across renders ✅
- `render --format png` produces valid PNG (0x89 50 4E 47) ✅
- Broken IR → `validate` exits 1 with structured diagnostics ✅
- Broken IR → `render` would exit 1 before reaching renderer (validate-before-render) ✅
# Productization Plan Decisions — 2026-06-10

**Author:** Leslie (Lead / Spec Architect)
**Topic:** Productization Plan for Timeline Compiler

---

## Key Decision 1: Implementation Language Recommendation

**Decision:** TypeScript/Node as core language with Rust for the SVG→PNG path (resvg/usvg), Python isolated as an optional sidecar for PPTX only.

**Rationale:**
- **Owner constraints:** Owner dislikes Python, prefers Go or TypeScript. Owner is fluent in Go (cmd/gert, gert-tui) and TypeScript (VS Code extensions).
- **Ecosystem fit:** TypeScript is the optimal choice for the IR/schema/CLI/MCP/agent ecosystem. The MCP SDK, VS Code extension, and npm distribution are all native TypeScript.
- **Rendering library access:** `resvg-js` (WASM-compiled resvg) provides deterministic SVG→PNG in Node. Skia access via `skia-canvas` or `canvaskit-wasm` for future raster/art effects.
- **Go alternative:** Go is viable but has weaker MCP/agent-tooling ecosystem and thinner Skia bindings. If owner prefers Go, accept reduced art-effects scope in early phases.
- **Python isolation:** python-pptx is the only mature OOXML library. If PPTX is needed, spawn as subprocess behind an interface. Evaluate JS OOXML alternatives (pptxgenjs) for native option.
- **Rust for PNG:** Use native resvg via N-API binding or WASM for byte-deterministic SVG→PNG conversion.

**Trade-offs explicit for owner to ratify:**
| Factor | TypeScript/Node | Go |
|--------|-----------------|-----|
| MCP/Agent ecosystem | Native | Requires custom JSON-RPC |
| VS Code extension | Native embedding | Subprocess or WASM |
| npm distribution | Native | WASM or subprocess |
| CLI standalone binary | Requires pkg/sea-orm or Deno compile | Native |
| Skia/art-effects | skia-canvas/canvaskit bindings exist | Thinner ecosystem |
| Owner familiarity | High (VS Code work) | High (cmd/gert) |

**Recommendation:** TypeScript core, with explicit acknowledgment that Go is viable if owner prefers simplicity over art-effects maturity.

---

## Key Decision 2: MVP Slice Definition

**Decision:** MVP is the smallest end-to-end capability that validates the thesis:
- **One layout family:** Horizontal swimlane (the default §5 pipeline) — most directly covered by spec, most common use case
- **One theme:** Consulting (Tier 1, Crisp) — clean, executive-presentable without art effects
- **Outputs:** SVG (primary) + PNG (via resvg-js)
- **Inputs:** Native IR authoring (YAML/JSON), JSON Schema published
- **Interface:** CLI with `render` and `validate` commands
- **Validator:** Full 5-layer validation pipeline (syntactic → schema → well-formedness → render-readiness → semantic advisory)

**Acceptance bar:** Reproduce target T2 (horizontal numbered nodes, light minimal) from IR via CLI to SVG+PNG. Target T2 is the simplest (milestones-only, single line, Tier 1) and proves core loop without requiring vertical-spine layout.

**Explicitly deferred to Phase 2+:**
- Vertical-spine layout family (T1, T3, T5)
- Serpentine layout family (T4)
- Raster/art effects (Tier 2/3)
- PPTX output
- MCP server
- VS Code extension
- Ingesters (ADO, GitHub, Mermaid)

---

## Key Decision 3: Phased Roadmap

| Phase | Goal | Deliverables | Exit Criteria | Targets Covered |
|-------|------|--------------|---------------|-----------------|
| **0** | Foundations | Repo scaffold, JSON Schema published, CI, TypeScript project structure | Schema validates, CI green, build produces CLI stub | — |
| **1** | MVP Core | IR parser, validator, horizontal swimlane layout engine, SVG backend, CLI, Consulting theme | T2 reproducible from IR to SVG+PNG, byte-deterministic | T2 partial |
| **2** | Themes + Polish | PNG via resvg-js, 3 themes (Consulting, Minimal, Executive), sections, status/progress viz, today marker, npm package | Custom theme loading works, npm installable | T2 full |
| **3** | Agents + Ingesters | MCP server, VS Code extension (preview+export), GitHub ingester (Gitline flow), vertical-spine layout module | Agent can generate IR and invoke rendering | T1, T3 partial |
| **4** | Art Effects + PPTX | Raster backend (Skia/Canvas), PPTX native-shape backend, Tier 2/3 themes (Showcase) | T4, T5 reproducible at full fidelity | T1, T3, T4, T5 full |

---

## Key Decision 4: Python-PPTX Isolation Strategy

**Decision:** PPTX backend is deferred to Phase 4. When implemented, python-pptx is isolated as a subprocess:
1. CLI exposes `timeline render input.yaml -o output.pptx`
2. TypeScript core produces Scene/Render IR JSON
3. A Python subprocess consumes Scene IR, produces PPTX
4. The Python sidecar is optional; CLI works without it (fails gracefully with "PPTX backend not installed")
5. Evaluate `pptxgenjs` (MIT, JS) as a non-Python alternative before committing to python-pptx

**Rationale:** Owner explicitly dislikes Python. Isolation keeps Python out of the core dependency graph while preserving PPTX capability for users who need it.

---

## Key Decision 5: Target Image → Phase Mapping

| Target | Layout Family | Theme | Fidelity | Phase |
|--------|---------------|-------|----------|-------|
| T2 (Horizontal numbered) | Horizontal single-line | Light-minimal-corporate | Tier 1 | Phase 1 (MVP acceptance) |
| T1 (Vertical spine, dark) | Vertical central-spine | Dark-executive | Tier 2 | Phase 3 |
| T3 (Dense AI infographic) | Vertical central-spine | Colorful-infographic | Tier 1 | Phase 3 |
| T4 (Serpentine glow) | Serpentine winding | Showcase | Tier 3 | Phase 4 |
| T5 (Gitline cards) | Vertical central-spine | Showcase-dark | Tier 3 | Phase 4 |

---

## Key Decision 6: Conformance Test Strategy

**Decision:** Golden-image conformance suite using the five target images as acceptance fixtures:
1. Each target has a worked IR fixture (from §14 worked examples)
2. CI renders fixture → SVG → PNG
3. Compare against golden PNG (pixel-exact for geometry; configurable tolerance for anti-aliasing)
4. Per-backend golden images (SVG backend and Raster backend expected to differ)
5. Scene hash (SHA-256) included in output metadata; CI asserts hash stability across runs

---

## Pending Owner Input

- [ ] Ratify TypeScript vs Go decision
- [ ] Confirm MVP acceptance bar (T2 from IR to SVG+PNG)
- [ ] Confirm Phase 3 timeline for MCP/agent integration
- [ ] Confirm PPTX deferral + python-pptx isolation strategy
# TypeScript Core API Design & Phase 0/1 Work Breakdown

**Author:** Leslie (Lead / Spec Architect)  
**Date:** 2026-06-10T14:02:12-04:00  
**Status:** RATIFIED

---

## Ratified Decision: TypeScript/Node Core

The owner has ratified **TypeScript/Node** as the core implementation language based on three constraints:

1. **Python exclusion:** Owner dislikes Python for core code. PPTX support will use `pptxgenjs` (not `python-pptx`).
2. **Transparent VS Code extension:** The future extension must import and call the core library **in-process** (no subprocess, IPC, or WASM bridge).
3. **MCP/agent + npm ecosystem fit:** Native TypeScript aligns with MCP server patterns and npm distribution.

---

## 1. Core Public API Design

See deliverable output for full TypeScript signatures.

**Package Boundaries:**
- `@timeline-compiler/core` — pure library (no Node-only deps in hot path)
- `@timeline-compiler/cli` — CLI wrapper
- `@timeline-compiler/mcp` — MCP server
- `@timeline-compiler/schema` — JSON Schema package
- Future: VS Code extension imports core directly

**Transparency Contract:**
- SVG output is a string (extension drops into webview directly)
- Diagnostics map cleanly to `vscode.Diagnostic`
- Same API backs CLI + MCP + extension
- Extension never spawns a process

---

## 2. Phase 0 — Foundations

See deliverable output for full task table.

**Exit Criteria:**
- pnpm monorepo builds with `pnpm build` producing TS declarations
- Empty public-API stubs compile against the type signatures
- JSON Schema validates example IR documents
- CI passes on macOS + Linux (lint, typecheck, test)
- Versioning policy documented

---

## 3. Phase 1 — MVP Core

See deliverable output for full task table.

**Acceptance Bar:**
- Reproduce target T2 from IR to byte-deterministic SVG+PNG via CLI
- validate-before-render workflow
- Golden-image conformance harness with T2 as gating fixture

---

## 4. Critical Path Summary

```
P0.1 (monorepo) → P0.2 (tooling) → P0.3 (schema) → P0.4 (CI) → P0.5 (stubs)
                                          ↓
P1.1 (loader) → P1.2 (validator) → P1.3 (layout) → P1.4 (SVG) → P1.5 (PNG)
                                                         ↓
                              P1.6 (theme) → P1.7 (CLI) → P1.8 (golden)
```

**v0.1.0 Definition of Done:**
- T2 reproducible (byte-identical SVG+PNG on macOS/Linux)
- JSON Schema published in `@timeline-compiler/schema`
- CLI commands: `render`, `validate`, `schema`
- 1 theme: Consulting (light-minimal-corporate, Tier 1)
- All 17 IR invariants validated
- Golden-image harness passes with T2 fixture

---

## 5. Extension-Readiness Checklist

See deliverable output for full checklist.

---

**Note:** Full deliverable with TypeScript signatures and task tables provided as plain-text output to coordinator.
# Milestone Fields Addition — IR Gap Closure

**Date:** 2026-06-10T12:06:30-04:00
**Author:** Mark (IR & Data Modeling)
**Status:** Pending merge into decisions.md IR Contract section

## Summary

Two fields have been added to the **Milestone** entity in `design/sections/04-ir.tex` (Milestone Fields table, §4.4) to achieve parity with Activity and satisfy the owner's five target outputs (colored markers + source provenance for re-sync).

## Added Fields

| Field | Type | Req | Default | Description |
|-------|------|-----|---------|-------------|
| `color` | `string?` | opt | theme | Color hint (theme may override) |
| `metadata` | `map<string,any>` | opt | `{}` | Application data; renderers ignore unknown keys |

### `color` (string?, opt, default theme)

Identical semantics to `Track.color` and `Group.color`. A hint to the theme engine; the theme may override it. Enables per-marker colored dots/badges as seen in target outputs T1 (cyan/amber/pink/slate year nodes) and T3 (colorful connector dots).

### `metadata` (map<string,any>, opt, default {})

Identical semantics to `Activity.metadata`. Carries application-specific data and source round-trip fidelity (provenance). Renderers **MUST** ignore unrecognized keys. Required for Gitline target T5, where repositories are represented as dated markers that must carry source provenance for re-sync.

## Scope

Surgical addition only. No other entity modified. No new invariants required (the existing extensibility note in §4 "Renderers should ignore unrecognized metadata keys" already covers all entities with `metadata`, including Milestone).
