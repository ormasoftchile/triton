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

## Learnings — Activity.color field (2026-06-11)

- **`Activity.color?: string` added (2026-06-11):** The `Activity` interface (packages/core/src/types.ts) now carries an optional `color?: string` field with doc comment "Explicit fill/accent color override. Any valid CSS color string (e.g. \"#FF8800\", \"coral\")." This mirrors `Milestone.color?: string` exactly.
- **Field position in Activity schema:** Inserted after `icon` and before `description` in both types.ts and schema.ts (activitySchema), matching Milestone's field ordering.
- **No palette validation:** `Milestone.color` is a free CSS string with no palette enforcement. `Activity.color` follows the same parity — unvalidated, passes through as-is. If palette validation is ever added, it must be applied to both simultaneously.
- **JSON Schema regen:** After schema.ts change, run `pnpm -r build` (or `pnpm -C packages/schema build`) to regenerate packages/schema/v1/timeline.json. The regenerated file carries Activity.color at the same structural level as Milestone.color (type: string, not in required array).
- **Files touched:** packages/core/src/types.ts, packages/core/src/schema.ts, packages/schema/v1/timeline.json (auto-generated), packages/core/test/validate.test.ts, packages/schema/test/schema.test.ts.
- **Test counts after change:** core 481 tests (validate.test.ts: +3 Activity.color tests), schema 6 tests (+1 Activity.color JSON Schema test) — all green.
- **Gap closed:** This is gap T3-3 from Barbara's target gap analysis for target T3 ("THE AI TIMELINE", dense vertical-spine with 12+ accent colors). Barbara's rendering step follows.

## 2026-06-11 — Activity.color Field Implementation (Step 2)

✓ **Activity.color Field Added + Decision Merged**

Completed the Activity.color field addition to unblock Barbara's T3 rendering work (gap T3-3).

**Changes:**
- `packages/core/src/types.ts`: Added `color?: string` field to Activity interface with doc comment "Explicit fill/accent color override. Any valid CSS color string (hex, named, rgb(), hsl(), etc.)."
- `packages/core/src/schema.ts`: Added `color: z.string().optional()` to activitySchema (positioned after icon, matching Milestone)
- `packages/schema/v1/timeline.json`: Regenerated via `pnpm -r build`
- `packages/core/test/validate.test.ts`: Added 3 validation tests (hex color, named CSS color, omitted color)
- `packages/schema/test/schema.test.ts`: Added JSON Schema conformance test

**Validation Parity Decision (Reconfirmed):**
- No palette validation (matches Milestone.color exactly)
- Free CSS string, unvalidated, renderer interprets with fallback
- If palette enforcement is ever introduced, must be applied to Activity.color, Milestone.color, Track.color, Group.color simultaneously

**Test Status:**
- Preimage: 478 tests passing
- Postimage: 490 tests passing (481 core + 6 schema + 3 CLI)
- All green; typecheck + lint clean
- Ready for Barbara's rendering integration

**Decision Record:**
- File: `.squad/decisions/inbox/mark-activity-color-field.md` → merged to decisions.md
- Status: Accepted
- Handoff to Barbara complete; field is live and production-ready

**Learnings:**
- Parity across all top-level IR color fields (Track, Group, Milestone, Activity) maintains consistency and supports future palette enforcement without schema retrofit
- Free CSS strings in the IR (with renderer fallback) prove robust for multi-backend support (SVG + Skia)
- Activity now complete feature parity with Milestone for visual customization (icon, color, category, status override)

## Learnings — metadata.logo field (2026-06-11)

- **`metadata.logo?: LogoSpec` added (2026-06-11):** The `Metadata` interface (packages/core/src/types.ts) now carries an optional `logo?: LogoSpec` field. `LogoSpec` is a named interface with four fields: `src: string` (required, non-empty), `position?: 'top-left' | 'top-right'`, `width?: number` (positive, points), `height?: number` (positive, points).
- **`src` validation scope (parity decision):** `src` is enforced non-empty by `z.string().min(1)` in the Zod schema. It is NOT validated for existence (filesystem path) or URI well-formedness (data: URI). This matches the precedent set by `Activity.icon`/`Activity.color` (rendering-side fallback, not IR responsibility). If file-existence or URI validation is ever added, it belongs in the rendering/runtime layer, not in validate.ts.
- **Field position in metadataSchema:** Appended after `description` in metadataSchema (schema.ts). Mirrors convention of adding new optional metadata fields at the end.
- **Zod sub-schema:** `logoSchema = z.object({ src: z.string().min(1), position: z.enum(['top-left','top-right']).optional(), width: z.number().positive().optional(), height: z.number().positive().optional() })`, wired as `logo: logoSchema.optional()` in metadataSchema.
- **JSON Schema regen:** After schema.ts change, run `pnpm -r build` (or `pnpm -C packages/schema build`) to regenerate packages/schema/v1/timeline.json. The regenerated file carries metadata.logo with `src` in required[], position as enum, width/height as `exclusiveMinimum: 0` numbers.
- **Files touched:** packages/core/src/types.ts, packages/core/src/schema.ts, packages/schema/v1/timeline.json (auto-generated), packages/core/test/validate.test.ts (+4 logo tests), packages/schema/test/schema.test.ts (+3 logo JSON Schema tests).
- **Test counts after change:** core 522 tests (validate.test.ts: 78), schema 9 tests — all green. Typecheck clean.

## 2026-06-11 — metadata.logo Field Implementation (Step 1 of T1-3)

✓ **metadata.logo IR Field Added**

Added `LogoSpec` interface and `metadata.logo?: LogoSpec` to close the IR/schema half of target T1-3.

**Changes:**
- `packages/core/src/types.ts`: Added `LogoSpec` interface (with JSDoc per field) and `logo?: LogoSpec` on `Metadata`
- `packages/core/src/schema.ts`: Added `logoSchema` Zod sub-object; wired as `logo: logoSchema.optional()` in `metadataSchema`
- `packages/schema/v1/timeline.json`: Regenerated via `pnpm -r build`
- `packages/core/test/validate.test.ts`: Added 4 validation tests (full spec, src-only, data URI, absent logo)
- `packages/schema/test/schema.test.ts`: Added 3 JSON Schema conformance tests (logo object optional, src required, position enum)

**Validation Parity Decision:**
- `src` non-empty enforced at schema level (min(1)); path existence and URI syntax NOT validated
- Matches Activity.icon / Activity.color precedent; rendering layer handles missing/invalid asset
- Documented in decision record: `.squad/decisions/inbox/mark-metadata-logo.md`

**Test Status:**
- Preimage: 490 tests passing
- Postimage: 534 tests passing (522 core + 9 schema + 3 CLI)
- All green; typecheck + lint clean

**Handoff to Barbara:** Field live. Exact shape: `metadata.logo?: { src: string; position?: 'top-left'|'top-right'; width?: number; height?: number }`. Barbara owns SceneImage primitive, backend rendering, and header layout. IR does not encode how the asset is loaded or embedded.

## Learnings — ContentBlock / blocks field (2026-06-11)

- **`ContentBlock` interface added (2026-06-11):** New named interface `ContentBlock { heading?: string; text: string }` defined in packages/core/src/types.ts, positioned before `TimeRange` in the structural sub-types section.
- **`blocks?: ContentBlock[]` added to both `Activity` and `Milestone` (2026-06-11):** Field placed after `description` in both interfaces. Parity decision: Activities can carry multi-section content (sprint phases, project sub-topics) just as milestones can — adding to both is consistent with the icon/color parity pattern applied throughout the IR.
- **description-vs-blocks rendering precedence (documented, not enforced):** If `blocks` is present and non-empty, renderers SHOULD use `blocks` and ignore `description`. If `blocks` is absent or empty, renderers fall back to `description`. Both fields MAY coexist at the schema level (no hard invariant), but authors SHOULD NOT set both. A soft preference for `blocks` over `description` is documented via JSDoc on `ContentBlock`, `Activity.blocks`, and `Milestone.blocks`. No hard well-formedness invariant was added — the minimal documentation approach was chosen.
- **Zod schema:** `contentBlockSchema = z.object({ heading: z.string().optional(), text: z.string().min(1) })`. Wired as `blocks: z.array(contentBlockSchema).optional()` in both `activitySchema` and `milestoneSchema` in packages/core/src/schema.ts.
- **JSON Schema regen:** Run `pnpm -r build` (or `pnpm -C packages/schema build`). The regenerated timeline.json carries `blocks` as `type: array` with `items: { properties: { heading: {type: string}, text: {type: string, minLength: 1} }, required: ['text'] }` on both milestones.items and activities.items.
- **Files touched:** packages/core/src/types.ts, packages/core/src/schema.ts, packages/schema/v1/timeline.json (auto-generated), packages/core/test/validate.test.ts (+7 blocks tests), packages/schema/test/schema.test.ts (+4 blocks tests).
- **Test counts after change:** core 540 tests, schema 13 tests — all green. Typecheck clean. (Preimage: 545 total; Postimage: 556 total.)

## 2026-06-11 — ContentBlock (blocks field) Implementation (T2 Step 1)

✓ **blocks?: ContentBlock[] Added to Milestone and Activity**

Added structured multi-block content field to support T2 dark vertical-spine entries with multiple titled sub-sections.

**Changes:**
- `packages/core/src/types.ts`: Added `ContentBlock` interface with JSDoc; added `blocks?: ContentBlock[]` to both `Activity` and `Milestone` interfaces (after `description`)
- `packages/core/src/schema.ts`: Added `contentBlockSchema` Zod sub-object; wired as `blocks: z.array(contentBlockSchema).optional()` in both `activitySchema` and `milestoneSchema`
- `packages/schema/v1/timeline.json`: Regenerated via `pnpm -r build`
- `packages/core/test/validate.test.ts`: Added 7 validation tests (4 Milestone.blocks, 3 Activity.blocks)
- `packages/schema/test/schema.test.ts`: Added 4 JSON Schema conformance tests (2 Milestone.blocks, 2 Activity.blocks)

**description-vs-blocks Precedence Decision:**
- Soft documentation approach (no hard invariant). Renderers SHOULD prefer `blocks` over `description` when `blocks` is non-empty.
- Both MAY coexist (schema-level); authors SHOULD NOT set both.
- Decision record: `.squad/decisions/inbox/mark-content-blocks.md`

**Test Status:**
- Preimage: 545 tests passing
- Postimage: 556 tests passing (540 core + 13 schema + 3 CLI)
- All green; typecheck + lint clean

**Handoff to Barbara:** Field live on both entities. Exact shape: `blocks?: { heading?: string; text: string }[]`. Rendering precedence: if `blocks` non-empty → use blocks; else fallback to `description`. JSON Schema regenerated and verified. Barbara owns all layout/render logic for ContentBlock display.
