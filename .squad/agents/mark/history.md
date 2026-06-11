# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).
- **IR Core Shape (2026-06-09):** Root envelope with `version`, `metadata`, `tracks`, `groups` (optional), `activities`, `milestones` (optional), `annotations` (optional), `sections` (optional), `legend` (optional). Tracks are swimlanes containing activities/milestones. Groups provide hierarchical structure within tracks. Activities represent spans; milestones represent points in time.
- **Date Model:** Supports ISO dates (2026-06-09), partial dates (2026-06, 2026), quarters (2026-Q2), halves (2026-H1), fiscal periods (FY26-Q2), relative dates (+3m, -2w), and symbolic (now). Uncertain dates use TBD, ongoing, unknown, and ~prefix for approximate. DateRange is start/end pair or span shorthand.
- **Status Enum:** Visual-communication status (not PM workflow): `planned`, `in-progress`, `done`, `at-risk`, `blocked`, `cancelled`, `tentative`.
- **AxisUnit Enum:** `day`, `week`, `month`, `quarter`, `half`, `year` — determines timeline granularity and date coercion rules.
- **ID/Ref System:** IDs are kebab-case slugs (`^[a-z][a-z0-9-]*$`), globally unique within document. References are bare strings containing target id, validated by schema context (ref<Track>, ref<Activity>, etc.).
- **Well-formedness Invariants:** 14 invariants covering version validity, required fields, ID uniqueness, reference resolution, no circular groups, temporal consistency (end >= start), progress bounds [0,1], and enum validity.
- **IR File:** Specification written to `design/sections/04-ir.tex` (~1340 lines).

## Learnings — IR Reconciliation (2026-06-10)

Gaps surfaced by Barbara (Rendering) and Bjarne (Agent Integration) and resolved in §4 + the binding contract:

- **`metadata.today` (new field):** Optional `date?` field. The date anchor for `now`, relative dates (+3m, -2w), and the today-marker annotation. Resolution chain: `metadata.today` → `metadata.created` → hard error (`DATE_ANCHOR_MISSING`). Renderers must never consult the system clock. Authors/agents SHOULD set `today` explicitly for byte-stable output.
- **`metadata.fiscal_year_start` (new field):** Optional `int [1..12]`, default 1 (January). Determines how `FYnn-Qk` fiscal dates map to calendar dates. Formula: fiscal quarter *k* starts at calendar month `((fiscal_year_start - 1) + (k-1)×3) mod 12 + 1` of the fiscal year's starting calendar year. Default (1) makes fiscal == calendar.
- **Ongoing/open-end semantics (codified):** An Activity with `start` but no `end` (and no `span`) is an open/ongoing interval — semantically identical to `end: ongoing`. Renderers extend the bar to the canvas right edge with an open indicator. This is an explicit valid state, not an error.
- **`span` / `start`+`end` exclusivity (new invariant #12):** `span` is mutually exclusive with `start` and `end`. Co-presence is a hard well-formedness error: `SPAN_START_CONFLICT`. Every activity must satisfy exactly one of: `span` alone, or `start` (+ optional `end`).
- **Relative-date anchor (codified):** Relative dates and `now` resolve against `metadata.today` → `metadata.created` → hard error. This is now stated explicitly in §4 date model and the contract date anchor section.
- **`track.index` vs `track.order` (resolved):** §4 previously used `order`; the contract and downstream teams (Barbara, Bjarne) used `index`. Renamed to `index` throughout §4 for consistency. Invariant #14 enforces uniqueness of `track.index` values.
- **Invariant count:** Grew from 14 to 17 after adding #12 (span exclusivity), #13 (date anchor required), #14 (track index unique); former value invariants renumbered to #15–17.

## 2026-06-10 — Team Update: IR Contract Finalized

✓ **IR Reconciliation Complete (Wave 2)**

All 6 gaps flagged by Barbara & Bjarne have been resolved:

1. **Gap 1 (metadata.today)** — Added; date anchor chain explicit
2. **Gap 2 (metadata.fiscal_year_start)** — Added; fiscal calendar normative
3. **Gap 3 (omitted end semantics)** — Codified: omitted end = ongoing
4. **Gap 4 (span/start co-presence)** — Invariant #12 (SPAN_START_CONFLICT)
5. **Gap 5 (relative-date anchor)** — Invariant #13 (DATE_ANCHOR_MISSING)
6. **Gap 6 (track.index naming)** — Renamed from order; now consistent

**IR Invariants:** 14 → 17 (added #12, #13; renumbered; clarified #14)

**Files Updated:**
- `design/sections/04-ir.tex` — Spec updated
- `mark-ir-contract.md` — Contract updated
- Cross-checked consistency matrix with §5 (Barbara) and §9 (Bjarne)

**Design Spec Location:** `design/` (LaTeX source, ready to compile)

No IR schema changes required — surgical fixes only.
- **Milestone parity (2026-06-10):** Milestone gained `color` (string?, opt, default theme) and `metadata` (map<string,any>, opt, default {}) in §4 for parity with Activity, supporting the owner's target outputs: colored markers (T1, T3) and source provenance for re-sync (T5/Gitline).

## Learnings — Activity.icon field (2026-06-11)

- **`Activity.icon?: string` added (2026-06-11):** The `Activity` interface (packages/core/src/types.ts) now carries an optional `icon?: string` field with doc comment "A named icon from the built-in icon registry (e.g. \"star\", \"flag\")." This mirrors `Milestone.icon?: string` exactly.
- **Field position in Activity schema:** Inserted between `category` and `description`, matching Milestone's field ordering (packages/core/src/schema.ts, activitySchema).
- **Icon-name validation:** `validate.ts` does NOT validate `Milestone.icon` against the icon registry (no `hasIcon`/`getIcon` calls in validate.ts). Parity decision: `Activity.icon` is also NOT validated — unknown icon names pass through silently. This keeps rendering-side fallback behaviour (unknown icon → silent fallback to ordinal/no-op) consistent across both entity types.
- **JSON Schema regen:** After schema.ts change, run `pnpm -r build` (or `pnpm -C packages/schema build`) to regenerate packages/schema/v1/timeline.json. The regenerated file carries Activity.icon at the same structural level as Milestone.icon.
- **Files touched:** packages/core/src/types.ts, packages/core/src/schema.ts, packages/schema/v1/timeline.json (auto-generated), packages/core/test/validate.test.ts, packages/schema/test/schema.test.ts.
- **Test counts after change:** core 468 tests (validate.test.ts: 71), schema 5 tests — all green.

## Phase 1 Implementation — 2026-06-10

### Modules Added

**`packages/core/src/schema.ts`** (tightened from Phase 0 stub):
- `idSchema` tightened to enforce `^[a-z][a-z0-9-]*$` regex.
- `irDateSchema` tightened with comprehensive `IR_DATE_RE` regex covering: ISO date/datetime, quarter, half, year-month, year, fiscal quarter (FY26-Q2), relative (+3m/-2w), symbolic (now), uncertain (tbd/ongoing/unknown), approximate (~prefix).
- Added `title?: string` to `legendSchema` (missing from Phase 0, per §4 spec table).
- `buildJsonSchema()` export preserved with same signature.

**`packages/core/src/load.ts`** (new):
```typescript
export class IRParseError extends Error {
  readonly diagnostics: readonly Diagnostic[];
  constructor(message: string, diagnostics: Diagnostic[])
}

export function parseIR(text: string, format?: 'yaml' | 'json'): IRDocument
```
- Auto-detects format: `{`-prefix → JSON, else YAML.
- On YAML parse failure: throws `IRParseError` with `YAML_PARSE_ERROR` code and `range` (line/column from `yaml` package's `linePos`).
- On JSON parse failure: throws `IRParseError` with `JSON_PARSE_ERROR` code.
- On Zod schema failure: throws `IRParseError` with `SCHEMA_<code>` diagnostics carrying JSON-Pointer paths.

**`packages/core/src/validate.ts`** (new):
```typescript
export function validateDocument(ir: IRDocument): ValidationResult
```

### Invariant Codes Implemented

All 17 well-formedness invariants from §4:

| # | Code | Severity | Description |
|---|------|----------|-------------|
| 1 | `VERSION_PRESENT` | error/warning | Version field non-empty; warn on unknown major |
| 3 | `AT_LEAST_ONE_TRACK` | error | tracks.length >= 1 |
| 4 | `UNIQUE_IDS` | error | All entity ids globally unique |
| 5 | `VALID_ID_FORMAT` | error | IDs match `^[a-z][a-z0-9-]*$` |
| 6 | `REF_RESOLVES` | error | All references point to existing entities |
| 7 | `REF_TYPE_MATCH` | error | References point to correct entity type |
| 8 | `NO_CIRCULAR_GROUPS` | error | Group parent chain is acyclic |
| 9 | `VALID_TIME_RANGE` | error | metadata.time_range end >= start |
| 10 | `ACTIVITY_DURATION_NONNEG` | error | Activity end >= start (concrete dates) |
| 11 | `DATE_FORMAT_VALID` | error | All date strings match IR_DATE_RE |
| 12 | `SPAN_START_CONFLICT` | error | span mutually exclusive with start/end |
| 13 | `DATE_ANCHOR_MISSING` | error | today/created present when now/relative used |
| 14 | `TRACK_INDEX_UNIQUE` | error | track.index values unique when present |
| 15 | `PROGRESS_IN_RANGE` | error | progress in [0, 1] |
| 16 | `STATUS_VALID` | error | status in Status enum |
| 17 | `AXIS_UNIT_VALID` | error | axis_unit in AxisUnit enum |

Soft warnings: `VACUOUS_TIMELINE`, `UNUSED_TRACK`, `STALE_PROGRESS`, `OUTSIDE_TIME_RANGE`.

### Type Refinements in types.ts

- Added `title?: string` to `Legend` interface (parity with §4 spec, §4 legend table).

### Wiring Notes for Leslie (Wave 2)

`api.ts` stubs (`loadIR`, `validate`) can be wired to:
```typescript
// In api.ts:
import { parseIR, IRParseError } from './load.js';
import { validateDocument } from './validate.js';

export function loadIR(text: string, format?: 'yaml' | 'json'): IRDocument {
  return parseIR(text, format);
}

export function validate(ir: IRDocument): ValidationResult {
  return validateDocument(ir);
}
```
`IRParseError` should be re-exported from `index.ts` for consumer access.

### Test Coverage

- `test/load.test.ts` — 21 tests: YAML/JSON parsing, format auto-detection, IRParseError diagnostics, schema violations.
- `test/validate.test.ts` — 55 tests: each invariant targeted individually, soft warnings, roadmap example from §4.

### Build Status

- `pnpm typecheck` ✅
- `pnpm lint` ✅ (also fixed pre-existing unused-var in layout/index.ts from concurrent agent)
- `pnpm test` ✅ (110 tests, 4 test files)
- `pnpm -r build` ✅

## Learnings
- **Role-aware coarse-date coercion for range containment (Bug #4, 2026-06-10):** For OUTSIDE_TIME_RANGE checks, START boundaries coerce to period-start (left-edge) and END boundaries coerce to period-end (right-edge), e.g. `2026-Q4` as an end → Dec 31 not Oct 1, preventing false-positive clipping warnings at the trailing edge of the time range.

## 2026-06-11 — Activity Icon Feature Implementation (Step 1)

✓ **Activity.icon Field Added**

Extended the IR with `Activity.icon?: string` field to unblock Barbara's rendering work.

**Changes:**
- `packages/core/src/types.ts`: Added `icon?: string` field to Activity interface with doc comment
- `packages/core/src/schema.ts`: Added `icon: z.string().optional()` to activitySchema (positioned between category and description, matching Milestone)
- `packages/schema/v1/timeline.json`: Regenerated via `pnpm -r build`
- `packages/core/test/validate.test.ts`: Added 3 activity.icon validation tests
- `packages/schema/test/schema.test.ts`: Added JSON Schema conformance test

**Validation Parity Decision:**
- Icon-name validation NOT added for Activity.icon (consistent with Milestone.icon behavior)
- Unknown icon names silently pass validation; rendering layer fallback is Barbara's responsibility
- This asymmetry is intentional to maintain consistency — if icon validation is added in future, apply to both Milestone and Activity simultaneously

**Test Status:**
- Preimage: 476/476 tests passing
- Postimage: 478/478 tests passing
- All green, ready for Barbara's rendering step

**Handed off to Barbara** with clear semantics: optional string field, use `getIcon()` to resolve, unknown names fallback silently.
