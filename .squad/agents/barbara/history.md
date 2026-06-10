# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a spec/design effort for a timeline creation tool. From data plus a natural-language prompt, produce an IR (intermediate representation) of a timeline for later rendering. This work is about the *process, the IR, and the design* — not implementation, not yet. Research is a primary focus.
- **Stack:** LaTeX for the design document (main.tex + sections/, Makefile, .latexmkrc, references.bib for the bibliography). No code implementation at this stage.
- **Created:** 2026-06-10

## Learnings

<!-- Append new learnings below. Each entry is something lasting about the project. -->
- Design is authored in LaTeX with a bibliography (references.bib) where research papers and references are collected.
- The architecture separates three layers: ingestion (data + prompt -> IR), the IR itself, and rendering semantics (IR -> render).

---

## 2026-06-09 — Sections 5, 6, 7 (Rendering, Themes, Output Targets)

### Determinism Contract
The rendering model is a six-phase pipeline (Axis → Tracks → Activities → Milestones → Sections/Annotations → Label Collision). Each phase is a pure function of its inputs; no system state, randomness, or runtime entropy is consulted. Sort keys are: tracks by `index` asc; activities by `(start_ordinal, id)` asc; milestones by `(date_ordinal, id)` asc. Rounding is round-half-up throughout. The date→x coordinate formula uses integer arithmetic with the ordinal-day representation (epoch: 2000-01-01 = day 0) to prevent floating-point divergence across platforms.

### Key Edge-Case Rulings
- **Zero-duration**: render at `min_width` px centred at `x(start)`; never invisible.
- **Ongoing/omitted end**: bar to right canvas boundary + right-chevron; omitted `end` treated as `ongoing` (IR gap flagged).
- **TBD end**: dashed extension of `tbd_extension_px` with "TBD" label.
- **Approximate dates (~prefix)**: nominal geometry; gradient fade at approximate edge(s).
- **Outside time_range**: not rendered; renderer warning; appears in legend.
- **Partial overlap with range**: clipped; clip indicator (angled cut) on clipped edge.
- **Very short span (< min_width)**: render at `min_width` centred on logical midpoint.
- **Simultaneous milestones**: stack downward by `stack_offset_y`, sorted by `id` asc.
- **Empty track**: never collapsed; rendered at `row_height` with empty body.
- **Sub-lane cap exceeded**: excess activities go to last lane (visible overlap); warning emitted.

### IR Gaps Found (flagged for Mark + Leslie)
1. **`metadata.today` missing** — needed for `now` resolution and today-marker; blocks determinism without a fallback chain.
2. **`metadata.fiscal_year_start` missing** — `FY26-Q2` dates cannot be deterministically resolved without knowing the fiscal calendar start month.
3. **Relative date anchor undefined** — `+3m` / `-2w` need an explicit anchor; proposed: same chain as Gap 1.
4. **Omitted `end` semantics ambiguous** — rendering model rules it equals `ongoing`; IR spec should be explicit.

### Theme Schema Knobs
Complete theme schema blocks: `canvas`, `typography` (with embedded WOFF2 font files required), `axis`, `track`, `activity`, `milestone`, `annotation`, `legend`, `status_map` (all 7 statuses mandatory), `category_map` (optional; overrides fill/stroke only; pattern/opacity from status_map). Patterns vocabulary: `solid`, `diagonal-hatch` (45° lines, 4px spacing), `dashed-border` (dashed stroke). Theme inheritance: single-level via `extends`; status_map and category_map merged entry-by-entry.

### Five Built-in Themes
| Theme | Signature characteristic |
|-------|------------------------|
| Consulting | Navy + black; square bars; no gridlines; no legend; print-optimised |
| Executive | Serif headings; rounded bars; full status palette + icons; today marker |
| Product | Dense; colored track headers; category-colored; progress always shown |
| Release | Traffic-light colors; monospace; triangle milestones; bold today marker |
| Minimal | All bars dark grey; pattern-only status; no legend; greyscale-safe |

### Output Priority
1. SVG — foundation; everything derives from it
2. PNG — universal paste target; one library call on top of SVG
3. PDF — consulting/print use case; deterministic via svg2pdf/cairosvg
4. PPTX — think-cell-comparable editability via python-pptx native shapes; highest complexity
5. HTML — developer/agent preview; trivially derived from SVG

### Rendering-Validation Notes for Bjarne
An IR is unambiguously renderable if: `time_range` start/end are concrete dates; all `track` refs resolve; `track.index` values are unique; symbolic/relative dates have a `today`/`created` anchor; `progress` in [0,1]. Agents should prefer concrete ISO dates over `now` or relative dates.

## 2026-06-10 — Team Update: Design Spec & Gaps Resolved

✓ **Design Spec Sections Published (Wave 1)**
- §5 Rendering Model (determinism contract, 6-phase layout, edge-case rulings)
- §6 Theme Architecture (5 built-in themes, schema knobs)
- §7 Output Targets (SVG→PNG→PDF→PPTX→HTML priority)

✓ **IR Gaps Flagged & Resolved (Wave 2)**
Your gap reports (Gap 1, Gap 2, Gap 3, Gap 5) were critical for IR contract refinement:
- metadata.today (date anchor for determinism)
- metadata.fiscal_year_start (fiscal calendar normative)
- Omitted end semantics (= ongoing open interval)
- Relative-date anchor (same chain as now: today → created → error)

Mark's reconciliation resolved all gaps surgically — no IR redesign required.

**Design Spec Location:** `design/` (LaTeX, ready to compile)  
**Status:** All 17 IR invariants now consistent across Rendering (this), Agent Integration (Bjarne), and IR spec (Mark)

Six-phase layout order and determinism contract are normative for all renderers.
