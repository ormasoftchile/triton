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

## Learnings

### 2026-06-12 — Label Collision De-collision (`labelWrap`-gated tier gap)

**Defect:** Two milestone callouts ("MSI Installer / Install Path" at x≈632 and "80% adoption + queue signoff" at x≈741) were both assigned to tier 0 (y≈227.4) because the greedy tier packer used a `+2` horizontal gap which was too small to catch the visual overlap, compounded by `measureText` underestimating rendered text widths.

**Fix (determinism-safe, gated behind `ms.labelWrap`):**
- `LABEL_TIER_HGAP = ms.labelWrap ? 16 : 2` — replaces the hardcoded `+2` in both the above-side and below-side greedy tier loops.
- `LABEL_COLLISION_PAD = ms.labelWrap ? 12 : 0` — inflates the collision footprint (`bL/bR`) for tier-packing purposes only; the actual rendered label x/width is unchanged.
- When `labelWrap` is false (all existing themes), both constants collapse to the original values → all goldens byte-identical.
- When `labelWrap` is true (roadmap theme), near-adjacent labels are pushed to separate tiers. Result: 3 above-axis tiers for timeline-goals (tier 0 y≈279, tier 1 y≈227, tier 2 y≈176); MSI and 80% adoption now on different tiers with no visual overlap.

**Principle:** The `aboveZoneH` reservation already scales with `maxAboveTier`, so adding tiers automatically grows the top margin — no extra code needed.

**Goldens moved:** `timeline-goals.svg`, `timeline-goals.png`, `timeline-goals-skia.png` only.

---

### 2026-06-12 — Today-Marker `labelChip` Token (Readability over Phase Pills)

**Defect:** The "Today" label (red #EF4444) was positioned at `y = todayY1 + 4 + todayFontPx` where `todayY1` is the top of the draw band — which is exactly where the first activity pill row begins. In the `timeline-goals` roadmap slide, "Today" sat inside the Evangelization teal (#0F766E) pill band: red-on-teal, low contrast, partially occluded by the pill's own label text.

**Fix (determinism-safe, gated behind `theme.axis.todayMarker.labelChip`):**
- Added `labelChip?: boolean` to the `todayMarker` block in `AxisTheme` (`types.ts`). Default absent/false — all existing themes unaffected, byte-identical.
- Set `labelChip: true` in `roadmap.ts` only.
- In `horizontal.ts` today-marker block: when `labelChip` is true, measure the label text width with `measureText`, then emit a `kind: 'rect'` chip (fill: canvas backgroundColor, rx: 3, opacity: 0.9, padX: 4px, padY: 3px) **before** the text primitive. The chip sits under the red "Today" text, masking the teal pill behind it.
- When `labelChip` is false (all other themes), the chip block is skipped entirely → zero primitive delta → byte-identical goldens for all non-roadmap fixtures.

**Coordinates (timeline-goals.svg):** Chip at rect x=570, y=321.83, width=37.72, height=16.67 (rx=3). Text at x=574, y=335.5. Activity pill band at y=330.83–366.83. Chip creates white backdrop that spans the pill overlap zone, making red text clearly legible.

**Goldens moved:** `timeline-goals.svg`, `timeline-goals.png`, `examples/gallery/showcase/timeline-goals-skia.png` only. All 577 tests pass; 574 existing goldens byte-identical.

**Pattern:** Follows the same opt-in theme-token gating pattern as `labelWrap` (milestone tier gap) and `nodeWrap` (spine routing) — new visual behaviour is isolated to the roadmap theme via a boolean token, never leaking into other themes.

**⚠️ CORRECTION (2026-06-12):** The white chip alone was INSUFFICIENT. The chip appeared at SVG lines 24-25 but the activity pill rects were emitted at lines 28, 32, 36 — AFTER the chip — so the pills painted over the entire today marker (line + chip + text) regardless of the chip's opacity. Root cause was **SVG z-order (document order)**, not contrast. See fix below.

---

### 2026-06-12 — Today-Marker `onTop` Token (Z-Order Fix)

**Defect (2nd attempt):** Despite the white chip, Cristian still saw the "Today" label buried under the teal Evangelization pill. Root cause confirmed by inspecting `examples/gallery/timeline-goals.svg` paint order: today-marker primitives (line + chip + text) were emitted at SVG lines 24-26, while the three activity phase pills (#6B7280, #0F766E, #1e3a5f) were emitted at lines 28, 32, 36. SVG paints in document order (later = on top), so the pills covered the entire marker. **The chip was never visible — z-order was the real defect.**

**Fix (determinism-safe, gated behind `theme.axis.todayMarker.onTop`):**
- Added `onTop?: boolean` to the `todayMarker` block in `AxisTheme` (`types.ts`). Default absent/false — all existing themes unaffected, byte-identical.
- Set `onTop: true` in `roadmap.ts` only (alongside existing `labelChip: true`).
- In `horizontal.ts` today-marker block: introduced `const deferredTodayPrims: ScenePrimitive[] = []`. When `onTop` is true, all three marker primitives (line, chip, text) are pushed to `deferredTodayPrims` instead of `primitives`. When false, pushed inline as before.
- At the very end of primitive assembly (before `return`): `if (deferredTodayPrims.length > 0) primitives.push(...deferredTodayPrims)` — appended after activity bars, milestone nodes, legend, all annotations.
- When `onTop` is false (all other themes), `deferredTodayPrims` stays empty → zero delta → byte-identical for all non-roadmap fixtures.

**Verified SVG order (timeline-goals.svg after fix):**
- Phase pills: #6B7280 at line 25, #0F766E at line 29, #1e3a5f at line 33
- Today dashed line: line 85; white chip rect: line 86; "Today" text: line 87
- Today marker (85–87) > all pill rects (25, 29, 33) ✅ — marker now paints on top.

**Goldens moved:** `timeline-goals.svg`, `timeline-goals.png`, `timeline-goals-skia.png` only. All 577 tests pass.

**Key Learning:** A chip/backdrop behind the label only works if the chip itself is above the occluding element in z-order. When activities are emitted after the today-marker block, no amount of chip opacity can fix the visibility — the pill paints on top of everything in that block. The fix must be to move the entire marker to after the activity bars. Gate with `onTop` token to avoid moving other fixtures.

---

## Detailed Archive

Strategic context, nodeWrap learnings, Flow grammar open questions, and cross-agent flags are preserved in `history-archive.md`.
