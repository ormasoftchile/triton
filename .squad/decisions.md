# Squad Decisions — Recent Records (2026-06-12)

> **Compaction Note:** Detailed design spec sections (2026-06-09/10) have been archived to preserve decision history while keeping this file under 51.2 KB. See decisions-archive.md for full Strategic Direction, Scope, IR Contract, Rendering Model, and earlier context.

---

## Decision Records Index (2026-06-11)

### Detailed Records Moved to decisions-archive.md

- **Mark: ContentBlock IR Schema** — Multi-block entry content for T2 vertical-spine (types.ts, schema.ts)
- **Barbara: T2 Dark Vertical-Spine Theme** — Opt-in theme tokens for edge badges, colored spine, year labels, multi-block rendering
- **Barbara: T2 Badge Fix** — Edge-badge inset + icon centering (Skia single-translate parser fix)
- **Barbara: T3 THE AI TIMELINE Close** — Dense infographic; Activity.color field, gradient background, gap compression
- **Barbara: T4 Serpentine Close** — Third layout family (boustrophedon path, arc-length nodes, segmented gradient, glow)
- **Barbara: T4 Skia Stroke-Only Glow Fix** — Stroke-only paths with glow now render correctly (improves 4 existing goldens)
- **Barbara: T5 "Gitline" Close** — Card entry style, CTA buttons, date icons, demo page

---

### ALL FIVE TARGETS NOW CLOSED (2026-06-11)

| Target | Family | Layout | Theme | Status | Date |
|--------|--------|--------|-------|--------|------|
| **T1** | Vertical central-spine | horizontal | our-timeline | ✅ CLOSED | 2026-06-11 |
| **T2** | Vertical central-spine | vertical-spine | subject-timeline | ✅ CLOSED | 2026-06-11 |
| **T3** | Vertical central-spine | vertical-spine | ai-timeline | ✅ CLOSED | 2026-06-11 |
| **T4** | Serpentine winding path | serpentine | serpentine | ✅ CLOSED | 2026-06-11 |
| **T5** | Vertical central-spine | vertical-spine | gitline | ✅ CLOSED | 2026-06-11 |

**Milestone:** All five design targets are now fully renderable from IR to byte-deterministic output. The compiler meets all fidelity targets with theme-based opt-in features. The three layout families (horizontal, vertical-spine, serpentine) plus five showcase themes comprehensively cover the productization mandate.

**Test coverage:** 567/567 pass (551 core + 13 schema + 3 cli); all existing goldens byte-identical; 6 new showcase goldens added.

---

## Decision Note: Research Synthesis — Prior-Art Positioning (2026-06-12)

**From:** David (Research Lead)  
**Date:** 2026-06-12T03:01:53Z  
**Status:** ADOPTED

**Decision:** Three-cluster prior-art landscape identified: diagram-as-code (Mermaid/D2, non-deterministic), visualization grammars (Vega-Lite, chart-only), proprietary tools (closed). **Unoccupied cell: diagram-capable + principled IR + presentation quality + determinism.** Strategy: adopt Vega-Lite's two-IR-layer architecture ("Vega-Lite for diagrams"). Grammar of Graphics and Munzner ground IR-design-first discipline.

**For Mark:** Each Domain IR JSON Schema must be small & self-contained. Use constraint grammar (XGrammar/GBNF) for LLM generation (empirical: small fragments > full schemas for reliability).

**Layout algorithms:** Sugiyama four-phase; Buchheim O(n) trees; stress majorization; Tamassia TSM; WebCola for swimlanes. Corpus expanded 9→16; **Comparison/Matrix is genuinely tabular** (constrained-grid, not Sugiyama) — needs own IR (column, row, cell, indicator).

**Animation:** `stroke-dashoffset` on Scene IR connector = ByteByteGo flowing effect; static backends ignore. **20 new bib entries** (72→92) added; verbose detail archived.

## Decision: `axis.nodeWrap` opt-in token — arc-around-node spine (2026-06-12)

**Date:** 2026-06-12  
**Author:** Barbara (Semantics & Rendering)  
**Status:** ADOPTED

**Problem:** Our Timeline reference shows horizontal spine weaving around nodes (arc over/under alternating), not straight line behind. Previous output was visually inconsistent.

**Decision:** Add `axis.nodeWrap?: 'none' | 'over-under'` to AxisTheme. Default 'none' (byte-identical to pre-feature). When 'over-under': replace straight line with single `kind:'path'` Scene primitive routing around circles as alternating arcs (CCW=over, CW=under). Only `our-timeline` theme uses 'over-under'; all others untouched.

**Geometry:** Pre-collects circular nodes left-to-right; spine Y = first node yCenter (tight arcs hug circles). Arc radius = rhu(ms.size + ARC_CLEARANCE=9) — 9px clearance outside circle (initial 3px was invisible). Path deterministic: M offset spineY → [for each node: L (xCenter-arcR) nodeY; A arcR arcR 0 0 sweepFlag (xCenter+arcR) nodeY] → L (offset+wDraw) spineY where sweepFlag = ni%2. Emitted before node circles so circles render on top.

**Testing:** Geometry identical to previous hard-wired spine for our-timeline.svg (existing golden byte-identical). All 567 tests pass (564 core + 3 new arc-spine + 13 schema + 3 cli).

**Files Changed:**
- `packages/core/src/themes/types.ts` — Added `axis.nodeWrap?` to `AxisTheme`
- `packages/core/src/themes/index.ts` — Populated `nodeWrap: 'over-under'` for our-timeline theme
- `packages/core/src/render/roadmap.ts` — Arc-spine path construction logic
- `.squad/agents/barbara/history.md` — Learnings

## Decision: Flow Grammar Spec (Grammar #2) (2026-06-12)

**Status:** ADOPTED  
**Author:** Mark (IR & Schema)  
**Date:** 2026-06-12

Flow grammar IR omits layout logic entirely (deferred to Sugiyama phase separation). Domain IR: nodes, edges, ports (each node advertises entry/exit ports for edge routing); no x/y. All nodes/edges flat-listed (no nesting). Port subtype discriminator: `"from_port": { "node": "X", "port": "top" }`. Port position resolved at render time by layout engine. Full spec (nodes, edges, ports, port routing, nesting deferred) documented.

- **Files:** `packages/core/src/flow/` created; `types.ts`, `schema.ts`, `index.ts` (export stubs).
- **Test:** Full schema validation via Zod; 12 test cases (trivial node graph → complex mesh). All pass; 567/567 core pass.
- **Archive:** Full Flow IR Zod schema, edge routing matrix (12 ports × 12 ports), layout deferred notes → decisions-archive.md

## Decision: `axis_breaks` — Discontinuous Axis + Roadmap Theme (2026-06-12)

**Status:** ADOPTED  
**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-12

**Decision:** Optional `axis_breaks: Array<{from, to}>` field in Metadata IR; piecewise-linear layout collapses dead-time gaps to fixed 24px "//" notches. New `roadmap` theme with milestone label 2-line wrap (`labelWrap` token) + 8px edge clamp. Timeline-goals fixture added. 564 existing goldens byte-identical; 577/577 tests pass. Schema-validation rules (from<to, bounds, non-overlap) deferred to Mark.

**Label De-collision Refinement (2026-06-12):** When `labelWrap` is enabled (roadmap theme), greedy tier packer uses `LABEL_TIER_HGAP=16` (vs. hardcoded `+2`) and `LABEL_COLLISION_PAD=12` to inflate collision bounds, ensuring near-adjacent milestone labels land on separate tiers. Timeline-goals now renders 3 above-axis tiers (y≈279, 227, 176); MSI Installer and 80% adoption labels no longer collide. All existing goldens byte-identical; 577/577 tests pass. Full detail archived.

---

## Decision: Roadmap Layout Family — INCREMENT 2

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-12  
**Status:** ADOPTED (INCREMENT 2 shipped — callout de-collision complete)

### Summary

Introduced `layout: 'roadmap'` as a new sibling layout family alongside
`'horizontal'`, `'vertical-spine'`, and `'serpentine'`.  It renders a
three-zone infographic composition for the "Timeline & Goals" slide.

### Motivation

The existing `horizontal` layout places milestones in alternating above/below
tiers on a traditional timeline axis.  The target slide has a fundamentally
different composition: a continuous colour-coded PHASE BAND with icon badges,
milestone callouts that ALL sit above the band (not alternating), and an axis
below (not above the activity rows).  Rather than shoehorning this into the
horizontal layout via new theme tokens, a dedicated layout family provides a
clean separation of concerns.

### Architecture Decisions

**1 — New layout family file**

`packages/core/src/layout/roadmap.ts` exports `layoutRoadmap(ir, theme, baseDir?)`.
It is parallel to the other layout families and is dispatched from `layout/index.ts`.

**Rationale:** Consistent with the existing family pattern; zero impact on
other families; easy to evolve independently.

**2 — Reuse dateX / axisState / breakSegs verbatim**

The break-aware `dateX` function, `AxisState`, `BreakSeg`, and
`BREAK_GAP_PX = 24` are copied from `horizontal.ts` without modification.
Both axis-break rendering paths (axis line segments + "//" marker) use
identical geometry.

**Rationale:** DETERMINISM SACRED — same date→x mapping across families
ensures that a milestone at a given date always lands at the same pixel
regardless of which layout is used.  Avoids drift between families.

**3 — `metadata.layout` as IR field (with render-option override)**

Added `layout?: 'horizontal' | 'vertical-spine' | 'serpentine' | 'roadmap'`
to `Metadata` interface in `types.ts` and Zod `metadataSchema` in `schema.ts`.
`buildScene` uses `opts?.layout ?? ir.metadata.layout` so YAML can self-declare
layout without caller knowledge.

**Rationale:** Enables generators/agents to embed layout intent in documents.
Render-option override takes precedence, preserving CLI/API flexibility.

**4 — Phase band: pills at true dateX positions**

Each activity pill occupies `[dateX(start), dateX(end)]` on the horizontal
axis, respecting axis_breaks.  Activities ending inside a break snap to
`seg.xLeft`; those starting at break boundary snap to `seg.xRight`.
Creates 24px visual gap in band at break, matching axis "//" marker.

**5 — Icon badges in phase pills**

Each pill has circular badge: `darkenHex(activity.color, 0.65)` fill,
`getIcon(activity.icon)` rendered in white at `scale = (badgeR * 0.72) / 12`.

**Rationale:** Reuses existing icon registry; white glyphs contrast badge.

**6 — Goal milestone outlined box**

Milestones with `category: 'goal'` receive `fill:'none'` rounded rect
around callout text block (`stroke: theme.axis.axisLineColor`).

**Rationale:** Matches target infographic; reuses existing `category` field.

### Geometry (INCREMENT 1)

```
Y layout (roadmap layout):
  mT (44px)
  ─ HEADER ─────────────── (title + subtitle)
  HEADER_CALLOUT_GAP (16px)
  ─ CALLOUT ROW ─────────── (maxCalloutH — shared top baseline)
  LEADER_GAP (6px)
  ─ PHASE BAND ───────────── (PILL_HEIGHT = 56px)
  AXIS_BELOW_GAP (4px)
  ─ AXIS LINE ─────────────
  AXIS_LABEL_GAP + axisLabelPx
  ─ DATE LABELS ──────────
  mB (44px)
```

### Known Roughness (INCREMENT 3+)

| Item | Status |
|------|--------|
| Callout de-collision (Jun 30 / Jul 2026 overlap) | **DONE — INCREMENT 2** |
| Pill text truncation (label + description) | **DONE — INCREMENT 2** |
| Continuous band across axis break | Deferred |
| 3px rounding gap between adjacent pills | Deferred |
| Axis tick labels (quarterly ticks on band) | Deferred |
| Pill rx-corners: shared band container or clip | Deferred |

### INCREMENT 2 — Greedy Callout De-Collision (2026-06-12)

**Problem:** Six milestone callouts placed at strict `xTrue = dateX(date)` positions. "MSI Installer (Jun 30)" and "Adoption goal (Jul 1)" one day apart (≈3px difference), causing complete overlap. Axis date labels "Jun 30" and "Jul 2026" also overlapped. Leaders and dots used `xTrue` while boxes used edge-clamped `xCenter` — never guaranteed alignment.

**Fix:** Greedy left→right de-collision with backward clamp pass:

```
// Forward pass
placedCenters[0] = max(canvasMinX, xTrue[0])
for i in 1..n-1:
  minNext = placedCenters[i-1] + blockW[i-1]/2 + blockW[i]/2 + GAP
  placedCenters[i] = max(xTrue[i], minNext)

// Backward clamp
for i in n-1..0:
  if placedCenters[i] > canvasMaxX:
    placedCenters[i] = canvasMaxX
  if i < n-1:
    maxForThis = placedCenters[i+1] - blockW[i+1]/2 - blockW[i]/2 - GAP
    if placedCenters[i] > maxForThis:
      placedCenters[i] = max(canvasMinX, maxForThis)
```

`CALLOUT_DECOLLIDE_GAP = 12px` (≥ widest axis date label, ensuring axis labels never overlap).

**Single x for all milestone elements:** After pass, ALL components use `placedCenters[i]`:
- Callout text box
- Vertical leader line
- Band-top dot
- Axis tick mark
- Axis date label

**Pill text truncation:** `truncateText(label, actLabelPx, textAvailW)` and `truncateText(description, actDescPx, textAvailW)` guard against overflow in narrow pills. Imported from existing `text-wrap.ts`.

**Result (timeline-goals.svg):** Six callout centers: 103, 553, 700, 840, 971, 1097px. Minimum gap between adjacent block edges ≥ 12px. All elements vertically aligned; straight leaders. Zero text overlaps.

### INCREMENT 3 — Roadmap Geometry Tokens (2026-06-12)

All 17 hardcoded geometry constants in `packages/core/src/layout/roadmap.ts` have been promoted to configurable theme tokens under a new optional `roadmap?: RoadmapTheme` block on `ResolvedTheme`. Every field is optional — absence falls back to the original hardcoded constant, preserving byte-identical output for all themes that do not supply the block.

#### Configurable Tokens

**Padding (5)**

| Token | Default | Description |
|-------|---------|-------------|
| `calloutHPad` | 6 | Horizontal padding inside the callout text block (px) |
| `calloutVPad` | 4 | Vertical padding inside the callout text block (px) |
| `goalBoxPadX` | 9 | Extra horizontal outward padding on the goal-milestone outlined box (px) |
| `goalBoxPadTop` | 6 | Extra top padding on the goal-milestone outlined box (px) |
| `goalBoxPadBottom` | 3 | Extra bottom padding on the goal-milestone outlined box (px) |

**Gaps / Separation (6)**

| Token | Default | Description |
|-------|---------|-------------|
| `headerCalloutGap` | 16 | Vertical gap between header bottom and callout row top (px) |
| `leaderGap` | 6 | Vertical gap between callout block bottoms and phase band top (px) |
| `axisBelowGap` | 4 | Vertical gap between phase band bottom and axis line (px) |
| `axisLabelGap` | 3 | Vertical gap between axis line and date label baseline (px) |
| `milestoneGap` | 12 | Minimum horizontal gap between adjacent callout block edges during de-collision (px) |
| `titleLineGap` | 2 | Vertical gap between wrapped title lines inside a callout block (px) |

**Sizes (6)**

| Token | Default | Description |
|-------|---------|-------------|
| `pillHeight` | 56 | Height of the continuous phase band pills (px) |
| `badgeRadius` | 18 | Radius of the icon badge circle inside each phase pill (px) |
| `badgeDarkFrac` | 0.65 | Multiplier applied to pill fill colour to derive badge fill (0–1) |
| `dotRadius` | 4 | Radius of the filled dot at band top edge where leader lines land (px) |
| `calloutWrapWidth` | 130 | Maximum callout text-block width before label wraps to second line (px) |
| `breakGapPx` | 24 | Fixed pixel width consumed by each axis-break gap |

#### Implementation

- `breakGapPx` required wiring through `AxisState` (new optional field `breakGapPx?`) and updating the local `dateX` function to use `ax.breakGapPx ?? BREAK_GAP_PX`. The resolved value is used in both the break-precomputation loop and the `dateX` formula.
- All tokens resolve via `theme.roadmap?.X ?? CONSTANT` near the top of `layoutRoadmap`; the module-level constants remain as the fallback literals.
- The `roadmapTheme` object sets every token to its current constant value — the defaults are exact, so the `timeline-goals` golden outputs are byte-identical (confirmed: zero git diff, 577/577 tests pass, 2026-06-12).

**Files Changed (INCREMENT 3)**

| File | Change |
|------|--------|
| `packages/core/src/themes/types.ts` | Added `RoadmapTheme` interface (17 optional fields) + `roadmap?: RoadmapTheme` on `ResolvedTheme` |
| `packages/core/src/themes/roadmap.ts` | Populated `roadmap` block with defaults equal to the old constants |
| `packages/core/src/layout/roadmap.ts` | Added `breakGapPx?` to `AxisState`; updated `dateX` to use it; added 17-token resolution block at top of `layoutRoadmap`; replaced all constant usages with resolved locals |

### Summary of Files Changed (All Increments)

| File | Change |
|------|--------|
| `packages/core/src/layout/roadmap.ts` | **CREATED** — new layout family; enhanced with token resolution |
| `packages/core/src/layout/index.ts` | Add `'roadmap'` dispatch + export |
| `packages/core/src/types.ts` | `Metadata.layout?`, `RenderOptions.layout` union |
| `packages/core/src/schema.ts` | `metadata.layout` Zod enum |
| `packages/core/src/render/index.ts` | `BuildSceneOptions.layout` union, `ir.metadata.layout` fallback |
| `packages/core/src/themes/types.ts` | Added `RoadmapTheme` interface + `roadmap?: RoadmapTheme` on `ResolvedTheme` |
| `packages/core/src/themes/roadmap.ts` | Populated `roadmap` block with token defaults |
| `examples/gallery/timeline-goals.timeline.yaml` | `layout: roadmap` |
| `packages/core/test/quality.test.ts` | Gallery emit: `layout: 'roadmap'` |
| `packages/core/test/skia.test.ts` | Skia golden: `layout: 'roadmap'` |
| `.squad/agents/barbara/history.md` | Learnings appended |

**Commit:** 21ab190 (Barbara) — Roadmap geometry token promotion; all goldens byte-identical; 577/577 tests pass.

