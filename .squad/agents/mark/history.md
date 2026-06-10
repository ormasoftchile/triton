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
