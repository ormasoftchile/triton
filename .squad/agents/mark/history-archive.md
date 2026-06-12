# Mark History Archive — Through 2026-06-11

This archive contains Mark's IR specification and reconciliation work from project initiation through Phase 1 completion. For current work, see history.md.

---

## Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of a deterministic diagram compiler. Mark leads IR design.
- **Stack:** LaTeX for design document; TypeScript/Node for implementation.
- **Created:** 2026-06-10

---

## Milestone: IR Core Shape Specified (2026-06-09/10)

✓ **IR Specification Complete (§4)**

### Core IR Envelope

Root structure: `version`, `metadata`, `tracks`, `groups` (opt), `activities`, `milestones` (opt), `annotations` (opt), `sections` (opt), `legend` (opt).

- **Tracks:** Swimlanes containing activities/milestones
- **Groups:** Hierarchical structure within tracks
- **Activities:** Time spans (start/end or span)
- **Milestones:** Point events in time
- **Status:** `planned`, `in-progress`, `done`, `at-risk`, `blocked`, `cancelled`, `tentative` (visual, not PM workflow)

### Date Model

- ISO dates (2026-06-09), partial (2026-06, 2026)
- Quarters (2026-Q2), halves (2026-H1), fiscal (FY26-Q2)
- Relative (+3m, -2w), symbolic (now)
- Uncertain: TBD, ongoing, unknown, ~prefix (approximate)
- DateRange: start/end pair or span shorthand

### ID/Ref System

- IDs: kebab-case slugs (`^[a-z][a-z0-9-]*$`), globally unique
- References: bare strings validated by schema context (ref<Track>, ref<Activity>, etc.)

### Well-formedness Invariants: 14 (later 17)

Covers version validity, required fields, ID uniqueness, reference resolution, no circular groups, temporal consistency (end >= start), progress [0,1], enum validity.

---

## Milestone: IR Reconciliation Complete (2026-06-10)

✓ **Resolved 6 Gaps with Barbara (Rendering) & Bjarne (Agent Integration)**

### New Fields Added

1. **`metadata.today`:** Date anchor for `now`, relative dates (+3m, -2w), today-marker. Resolution: `metadata.today` → `metadata.created` → hard error (DATE_ANCHOR_MISSING). Ensures byte-stable, deterministic output (no system clock).

2. **`metadata.fiscal_year_start`:** Int [1..12], default 1 (January). Maps fiscal dates (FYnn-Qk) to calendar dates.

3. **`metadata.logo`:** Logo asset. Shape: `{ src: string; position?: 'top-left'|'top-right'; width?: number; height?: number }`. (Later added by Mark.)

### Resolved Conflicts

- **Omitted end semantics:** Activity with start but no end = open/ongoing. Explicit valid state, not error.
- **`span` / `start`+`end` exclusivity:** Added Invariant #12 (SPAN_START_CONFLICT). Every activity must satisfy exactly one: `span` alone or `start` ± `end`.
- **Relative-date anchor:** Invariant #13 (DATE_ANCHOR_MISSING). Relative dates resolve against `metadata.today` → `metadata.created`.
- **`track.index` naming:** Renamed from `order` throughout §4 for consistency with downstream teams. Invariant #14: uniqueness.

### Invariant Expansion

14 → 17 after adding #12 (span exclusivity), #13 (date anchor), #14 (track index unique).

---

## Milestone: Parity & Phase 1 Implementation (2026-06-10/11)

✓ **Activity/Milestone Parity Achieved; Schema Tightened**

### Activity Gained Icon & Color (T1 support)

- **`Activity.icon?: string`:** Named icon from registry (e.g., "star", "flag"). Optional; unknown icon → silent fallback.
- **`Activity.color?: string`:** Opt; default theme color. Matches Milestone.color parity.

### Milestone Gained Metadata

- **`Milestone.metadata?: map<string, any>`:** Optional provenance map. Supports re-sync (T5/Gitline).

### ContentBlock Support (T2 Step 1)

- **`ContentBlock` interface:** `{ heading?: string; text: string }`
- **`Activity.blocks? ContentBlock[]`** & **`Milestone.blocks?: ContentBlock[]`:** Multi-section content for vertical-spine entries.
- **Precedence decision:** Renderers SHOULD prefer `blocks` over `description` when non-empty. Soft (documented, not hard invariant).

### Schema Tightening (packages/core/src/schema.ts)

- **`idSchema`:** Enforces `^[a-z][a-z0-9-]*$` regex
- **`irDateSchema`:** Comprehensive regex covering ISO, quarter, half, fiscal, relative, symbolic, uncertain, approximate
- **`contentBlockSchema`:** Zod sub-object wired into both Activity and Milestone
- **Metadata.logo:** Full shape validated

### Test Coverage

- Phase 0: 490 tests
- After ContentBlock: 556 tests (540 core + 13 schema + 3 CLI)
- All green; typecheck + lint clean

---

## Key Learning Points

- The IR is the **universal contract** between ingestion, domain reasoning, and rendering. Small, semantically tight domain IRs (timeline entities ≠ graph nodes) are LLM-friendly.
- Date resolution chain (metadata.today → metadata.created → error) ensures determinism and author control.
- Parity decisions (Activity/Milestone icon, color, blocks) keep the IR consistent and extensible.
- Well-formedness invariants (17 total) catch misconfigurations early, supporting deterministic rendering and agent generation.
- The two-IR-layer model (domain IR → Scene IR) decouples grammar-specific concerns from universal rendering primitives.

---

## Files & Specs

- Design: `design/sections/04-ir.tex` (~1340 lines, LaTeX source)
- Schema: `packages/core/src/schema.ts`, `packages/schema/v1/timeline.json`
- Types: `packages/core/src/types.ts`
- Validation: `packages/core/src/validate.ts`, `packages/core/src/load.ts`
- Tests: `packages/core/test/validate.test.ts`, `packages/schema/test/schema.test.ts`
