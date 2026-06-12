# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

---

## Recent Work Summary

### 2026-06-12 — `axis_breaks` Discontinuous Axis + Phase Pills (Multi-Pass)

**Status:** Rendering ADOPTED; schema validation deferred to Mark

#### Pass 1: IR Field + Piecewise-Linear Layout
- Added `AxisBreak { from: IRDate; to: IRDate }` interface to `types.ts`
- Added `axis_breaks?: AxisBreak[]` to `Metadata` (optional; absent → ZERO behaviour change)
- Schema validation open questions flagged for Mark (from<to, bounds, non-overlap)
- Piecewise-linear `dateX` approach: effective time = `teOrd − tsOrd − Σ(break durations)`, draw width = `wDraw − nBreaks × 24px`
- Break gap = exactly 24px per break (calendar-independent)
- "//" marker: two forward-diagonal line primitives per break
- Activity description rendering: 2-line wrap for `barHeight ≥ 28`
- New `roadmap` theme: `barHeight: 36`, `barRadius: 8`

#### Pass 2: Milestone Label Robustness
- Milestone label left-edge clamp: `labelClampX = Math.max(blockW/2 + 8, Math.min(W − blockW/2 − 8, xCenter))`
- New `labelWrap?: boolean` theme token: 2-line wrap with dynamic `blockH` expansion
- Only `roadmap` activates `labelWrap: true`; all other themes byte-identical

#### Pass 3: Roadmap Margin + Edge Clipping Fix
- Root cause: `canvas.margin.left: 0` → first pill at `x=0` (clipped)
- Fix A: `canvas.margin.left: 0 → 48` (symmetric `right: 48`)
- Fix B: `LABEL_EDGE_PAD = 8` in clamp formula
- Confirmed: first pill at `x="48"`, first milestone label `x≈59.02` (8px from edge)

**Test Results:** 577/577 pass; 564 existing goldens byte-identical; 3 new fixture outputs (timeline-goals SVG, PNG, Skia)

**Determinism:** All paths use `Math.floor(x + 0.5)` round-half-up; no floating non-determinism

#### Files Changed
- `types.ts`: `labelWrap?: boolean` to `MilestoneTheme`
- `roadmap.ts`: new theme with fixed margins + `labelWrap: true`
- `horizontal.ts`: piecewise scale + label clamp + 2-line render loop
- `timeline-goals.yaml`: `axis_breaks[0].from: 2025-12-01 → 2026-01-15`
- `quality.test.ts`, `skia.test.ts`: new gallery tests

---

## Architecture Notes

**Scene IR as Kernel:** Scene IR (Rect, Line, Circle, Text, Path, Group) is the universal rendering contract shared by all future grammars (Timeline, Flow, Graph, etc.). Backend diversity (SVG/PNG/Skia/PDF) all consume Scene IR.

**Theme Tokens for Layout:** Features like `axis.nodeWrap` and `labelWrap` demonstrate that layout modifications can be expressed as opt-in theme tokens (not embedded in domain IR).

---

## Open Work (Flagged for Handoff)

### Schema Validation — Mark (2026-06-12)

Deferred rules for `axis_breaks` IR field:

1. **`from < to` enforcement** — Emit `BREAK_FROM_AFTER_TO` at parse time
2. **Breaks within `time_range` bounds** — Emit `BREAK_OUT_OF_RANGE` warning
3. **Non-overlapping, sorted** — Validate; emit `BREAKS_OVERLAP` / `BREAKS_UNSORTED`
4. **Max breaks upper limit** — Warn if N excessive (e.g., > 20) or draw width < 100px

**Files to update:** `schema.ts` (Zod), `types.ts` (TypeScript), `validate.ts` (invariants)

---

## Detailed Archive

Strategic context, nodeWrap learnings, Flow grammar open questions, and cross-agent flags are preserved in `history-archive.md`.
