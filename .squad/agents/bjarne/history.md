# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).

## 2026-06-09 — Section 09 Agent Integration

### Ingestion Flows Designed

Four end-to-end ingestion workflows designed for §9:

1. **ADO Work Items → IR**: ADO fields map to IR as follows — `System.Title` → `label`, `System.State` → `status` (via state-to-enum table), `System.WorkItemType` → `category` or entity promotion (Milestone type → IR milestone), `System.IterationPath` → `span` (e.g. `Platform\2026\Q2` → `span: 2026-Q2`), `System.AreaPath` → track. The prompt controls what work item types are included, which time window is used, and how AreaPath segments become tracks. Bugs/tasks are rejected when the prompt says so — not imported as noise.

2. **Natural Language Prose → IR**: Free text is parsed for temporal mentions (H1, Q3, specific dates), named teams/phases, and event types. Uncertain dates use `tbd`/`ongoing` explicitly rather than null or a guessed date. The prompt provides the track structure that the prose lacks.

3. **GitHub Projects → IR**: ProjectV2 ITERATION custom fields map to `span`; DATE fields map to `start`/`milestone.date`; status select fields map to IR enum. GitHub does not have a work item type concept — filtering requires label/custom field conventions specified in the prompt.

4. **Mermaid Timeline → IR**: `title` → `metadata.title`, `section` → `sections[]`, events → activities on a default single track. Mermaid has no swimlane concept; multi-track structure requires prompt instruction.

### Ingestion Contract

Established the four-category ingestion contract (Assumed / Inferred / Defaulted / Rejected) as the formal boundary for what ingestion may do. The prompt is always a first-class input that must be read before the source data is touched. Key prohibitions: must not compute dates, must not import the whole backlog, must not generate non-stable sequential IDs.

### Validation / Error-Repair Loop Design

Five-layer validation pipeline:
- Layer 1: Syntactic YAML/JSON parse
- Layer 2: JSON Schema conformance (required fields, types, enums, ID regex, oneOf for start/span)
- Layer 3: Well-formedness invariants from Mark's contract (referential integrity, ID uniqueness, date ordering, progress bounds, group acyclicity)
- Layer 4: Render-readiness (delegated to Barbara §5 — referenced, not duplicated)
- Layer 5: Semantic advisory (degenerate documents, out-of-range items — warnings only)

Error messages are path-anchored with three components: path (e.g. `activities[2].track`), machine-readable code (e.g. `UNRESOLVED_REF`), and a suggested fix. The agent repair cycle is: Generate → Validate → Report errors → Agent applies surgical patches → Re-validate → Render.

### MCP Tool Surface

Four tools defined:
- `validate_timeline`: input IR (object or string), output structured errors/warnings with path anchors
- `render_timeline`: input IR + format + theme, output base64-encoded bytes + mime type
- `describe_schema`: input optional version/entity, output JSON Schema + per-field docs
- `suggest_time_range`: input list of date hints, output recommended time_range + axis_unit + rationale

Two deployment modes: local subprocess (CLI `timeline mcp-server`) and hosted cloud endpoint.

### Round-Trip / Provenance Approach

Provenance stored in `metadata` block per entity: `source`, `ado_id`/`github_issue`, `ado_revision`, `ingested_at`. Re-sync uses source ID (not IR id) as stable foreign key. Only source-mapped fields are overwritten on re-sync; human-edited fields (label, description, color, progress) are preserved. IR id slugs are frozen after first ingestion — never regenerated. YAML serialisation uses canonical field order and consistent quoting to minimise spurious git diffs.

### IR Gaps Flagged (for Leslie + Mark)

1. **`today` field missing from metadata** — `now` symbolic date is non-deterministic without an explicit `today: date?` in metadata. Leslie's scope spec requires explicit input for determinism but Mark's contract does not include this field.
2. **`index` vs `order` naming discrepancy** — Mark's binding contract (invariant 14) uses `track.index`; the 04-ir.tex spec uses `track.order`. Need canonical name.
3. **`span` + `start` co-presence undefined** — No rule for what happens if both `span` and `start`/`end` are present on the same activity. Suggested fix: treat as schema error.

## 2026-06-10 — Team Update: Design Spec & Agent Integration Design Complete

✓ **Design Spec Section Published (Wave 1)**
- §9 Agent Integration (validation pipeline, MCP tools, ingestion contract)

✓ **IR Gaps Flagged & Resolved (Wave 2)**
Your gap reports (Gap A, Gap B, Gap C) were essential for IR contract refinement:
- metadata.today field (date anchor for deterministic now/relative dates)
- track.index vs track.order naming (consensus on field name)
- span/start co-presence exclusivity (Invariant #12: SPAN_START_CONFLICT)

Mark's reconciliation resolved all gaps — no changes needed to agent generation contract.

**Design Spec Location:** `design/` (LaTeX, ready to compile)  
**MCP Tools (normative):**
- `validate_timeline` — 5-layer pipeline
- `render_timeline` — Deterministic rendering
- `describe_schema` — JSON Schema + docs
- `suggest_time_range` — Infer axis from dates

**Validation Layers:** Syntax → Schema → Invariants → Render-readiness → Advisory

Five built-in themes ready; error contract with path-anchored codes and suggested fixes enables Generate → Validate → Repair cycle.
