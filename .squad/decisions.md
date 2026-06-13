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

## Decision: De-Risked Grammar Sequencing (Taxonomy Refinement)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13T02:42:44-04:00  
**Status:** ADOPTED

**Strategic Insight:** After analyzing the inspiration corpus (sample-images 5–11) and scope alignment with IR contract, the team adopted a **de-risked grammar roadmap** where **Sequence is the first new grammar** (ahead of general-DAG Flow layout extension).

**Core Reason:** Sequence layout is **deterministic-by-construction** (declared participant order → x-position; explicit message `order` field → y-position). No Sugiyama four-phase, no force-directed, no RNG, no convergence. Contrast: Flow (Grammar #2) requires full Sugiyama layer-assignment + crossing-minimization + coordinate assignment with pinned determinism. Sequence eliminates the "hard problem" (§42 Graph Auto-Layout) entirely.

**Taxonomy Refinement:**

- **Shape Grammars** (diagram structure & deterministic layout): Flow (pipeline/linear first scope), **Sequence (new — de-risked first)**, Tree (hierarchical)
- **Composition Layer** (multi-diagram comparison/panel arrangement): Grids (tabular-constrained), Panels (multi-diagram posters) — these are NOT standalone grammars; they compose shape grammars

**Roadmap Priority:**
1. Flow scoped to linear/pipeline (avoids Sugiyama complexity for MVP)
2. **Sequence [chosen first NEW grammar for de-risk]** — IR in place; Mark refines JSON Schema; Barbara defines rendering (self-message curves, fragment nesting, stereotype icons)
3. Tree (hierarchical layout, Buchheim O(n), self-contained)
4. Composition/Grid (tabular + multi-panel layouts)
5. Later: general-DAG Flow layout, data-structure diagrams (niche)

**Journey/Roadmap Images Mapping:** Existing serpentine + roadmap layout families already cover these visualization intents; no new grammar needed.

---

## Decision: Sequence Grammar = De-Risked First New Grammar (Grammar #3)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13  
**Status:** ADOPTED

### Summary

The Sequence Grammar is the third grammar in the diagram compiler (after Timeline #1 and Flow #2) and the **first de-risked new grammar** — its layout is deterministic-by-construction, requiring no graph auto-layout algorithm.

### IR Shape

```
sequence:
  participants: [{id, label, kind?, description?}]   # declared order = x-position
  messages: [{from, to, label, order, kind?}]        # order field = y-position
  activations: [{participant, from_order, to_order}]  # optional lifeline bars
  fragments: [{kind, label, from_order, to_order, participants?}]  # optional combined fragments
```

- **Participant**: id (unique), label (display text), kind (actor|object|boundary|control|entity|database), description
- **Message**: from/to (participant refs), label, order (explicit integer — the deterministic backbone), kind (sync|async|reply)
- **Activation**: participant ref + message order range
- **Fragment**: loop|alt|opt|par|critical|break + guard label + message order range + optional participant subset

### Deterministic-by-Construction Layout Rationale

The critical insight: sequence diagram placement is **fully determined by two ordered lists**:
1. Participants declared left-to-right → x-positions via cumulative label widths
2. Messages with explicit `order` field → y-positions via `rank × rowHeight`

**No optimization required.** No Sugiyama layer assignment, no crossing minimization, no coordinate assignment, no force-directed simulation, no RNG, no convergence. Placement is a closed-form arithmetic function of declaration order.

**Contrast with Flow Grammar:** Flow requires four-phase Sugiyama (cycle removal → network simplex → barycenter crossing min. → Brandes–Köpf coordinate assignment) with careful determinism pinning (fixed 24 sweeps, canonical tie-breaking). Sequence needs none of this.

This makes Sequence the lowest-risk grammar to add — the "hard problem" of §42 (Graph Auto-Layout) simply does not apply.

### Lowering to Scene IR

All sequence constructs map to existing kernel primitives:
- Participant headers → Rect + Text
- Lifelines → dashed Line
- Messages → Line + arrowhead Path + label Text
- Activations → thin Rect
- Fragments → rounded Rect + tab Rect + Text

**No new Scene IR primitives required.**

### Deferred to Mark (IR Schema Detail)

- Exact JSON Schema (enum values, string patterns, min/max on `order`)
- Whether Message needs an explicit `id` field
- Whether `order` can alternatively be implicit (list position as default)
- Exhaustive semantic validation rule set (fragment overlap detection, activation range validation)

### Deferred to Barbara (Rendering Semantics)

- Self-message curve geometry (rounded corners vs. smooth arc vs. sharp bends)
- Fragment nesting depth recommendation (soft limit for readability)
- Participant stereotype icon geometries (actor stick-figure, boundary bar, control arrow, entity underline, database cylinder)
- Arrowhead sizing (scale with stroke or fixed pixel)
- Activation bar width

### Files

- `design/sections/26-sequence-grammar.tex` — full concrete spec
- `design/main.tex` — `\input{sections/26-sequence-grammar}` added
- `design/sections/24-diagram-family.tex` — cross-reference added
- `design/references.bib` — `uml25`, `itu-msc` entries added

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


---

# Decision: Sequence Grammar — Increment-1 Implementation

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T09:49:15-04:00  
**Status:** ADOPTED

---

## Summary

The Sequence Grammar is now implemented as the first `grammars/*` module — the first real test of the multi-grammar architecture (Flow Grammar has IR stubs only; Sequence has full layout + render). Increment-1 covers: participants, messages (sync/async/reply), lifelines, actor stick-figure icons. Activations and Fragments are deferred to increment-2.

---

## Kernel Reuse Pattern

The two-IR-layer model works cleanly:

```
SequenceDocument (domain IR)
       │
       ▼
 layoutSequence()            ← new, in grammars/sequence/
       │
       ▼
    Scene (kernel IR)        ← unchanged
       │
       ├──► sceneToSvg()     ← unchanged
       ├──► svgToPng()       ← unchanged
       └──► sceneToPngSkia() ← unchanged
```

No new Scene IR primitives were needed. The existing kernel (scene.ts + render/) is sufficient for a complete sequence diagram. All 577 pre-existing golden outputs are byte-identical.

---

## Module Structure

```
packages/core/src/grammars/sequence/
  types.ts    — SequenceDocument domain IR
  schema.ts   — Zod validation (participant uniqueness, message refs)
  layout.ts   — layoutSequence() → Scene (deterministic-by-construction)
  index.ts    — buildSequenceScene() + renderSequenceDocument() public API
```

Exported from `packages/core/src/index.ts` as `buildSequenceScene`, `renderSequenceDocument`, `sequenceDocumentSchema`, and all sequence types.

---

## Example Fixture

`examples/gallery/sequence-rest-auth.sequence.yaml` — REST API token auth flow (Client → Auth Server, 4 messages). Gallery outputs:
- `examples/gallery/sequence-rest-auth.svg`
- `examples/gallery/sequence-rest-auth.png`

---

## Test Results

- **589/589 tests pass** (577 existing + 12 new sequence tests)
- Determinism verified: two builds → identical `sceneHash`
- Gallery files emitted and valid

---

## Open Questions for Mark (IR & Schema)

1. **YAML loader integration**: The fixture is loaded as raw YAML then parsed by Zod. Should the `compile()` / `loadIR()` API be extended to dispatch on document type (timeline vs sequence vs flow), or is sequence always a separate entry point? Recommend: add a `kind` field to root document and a dispatcher.

2. **Version field semantics**: The `version: "1.0"` field is validated as a non-empty string. Should there be a Zod `.refine` enforcing semver format or an allowlist of supported versions?

3. **Theme token block**: Sequence layout currently uses hardcoded DEFAULTS. When the `SequenceTheme` block is added to `ResolvedTheme`, the layout will accept a theme name and call `resolveTheme()`. Needs Mark's sign-off on where `sequence?` sits in the `ResolvedTheme` interface.

4. **Activation schema validation**: `Activation.from_order` and `to_order` should reference valid message `order` values. Currently accepted structurally but not cross-validated. This is a semantic check (like `validate.ts` for the timeline grammar) — deferred to increment-2.

---

## Deferred to Increment-2

- Activation bar rendering (thin rect on lifeline)
- Fragment rectangles (loop/alt/opt/par/critical/break tabs)
- Self-message curve geometry (currently sharp right angles)
- Additional participant kinds: `boundary`, `control`, `entity`, `database` icons
- Theme token integration (SequenceTheme on ResolvedTheme)

---

# Decision: Sequence Grammar — Increment-2 Implementation (Self-messages, Activations, Fragments)

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T10:13:06-04:00  
**Status:** ADOPTED; Increment-2 complete

---

## Summary

Increment-2 builds on the increment-1 foundation (participants, messages, lifelines) with three new features:
1. **Self-messages:** Fixed layout using dashed `LinePrimitive` segments (replaced `PathPrimitive` which lacks `dashArray`).
2. **Activations:** Thin filled rectangles on lifelines, anchored to message order ranges.
3. **Fragments:** Labeled rounded boxes (`loop`, `alt`, `opt`, `par`, `critical`, `break`) with keyword tabs and guard labels.

All 603 tests pass (589 existing + 14 new). Pre-existing goldens byte-identical.

---

## Features Added

### 1. Self-messages (Layout Refinement)

**Problem:** Increment-1 rendered self-messages as single `PathPrimitive` (sharp right angles), but `PathPrimitive` lacks `dashArray` field → dashed reply arrows didn't render.

**Solution:** Split each self-message into 3 `LinePrimitive` segments:
- Downstroke: vertical line from participant lifeline
- Right segment: horizontal line offset to the right
- Return segment: vertical line back to lifeline with optional dash

Label moved to right side of loop (`textAnchor: 'start'`, x=loopX+6, y=midpoint of loop height) per spec.

**Geometry:** Sharp right angles; no curves; deterministic by construction.

### 2. Activations

**Semantics:** Thin filled rectangles (`activationBarHalfW=5`, `#c5cae9` fill / `#5c6bc0` stroke, `rx:2`) on participant lifelines, spanning `from_order` to `to_order`.

**Rendering:** `renderActivationBars()` draws bars after lifelines, before messages. Message endpoint attachment: `±barHalfW` offset in direction of message travel, so arrows visually land on bar edge.

**Layout:** `buildOrderToRowY()` maps message order→Y coordinate; bars positioned accordingly.

### 3. Fragments

**Semantics:** Optional labeled boxes for control flow (loop, alt, opt, par, critical, break). Each fragment spans `from_order` to `to_order` and may nest.

**Rendering:** `renderFragments()` renders before participant headers (outer fragments first). Each:
- Rounded rect with light-indigo background
- Keyword tab (small filled rect, `#5c6bc0` fill, white text) top-left
- Guard label inside tab

**Geometry:**
- Horizontal extent: leftmost/rightmost participant boxX ± fragPadX (clamped to canvas)
- Vertical: rowY(from_order) - fragPadY … rowY(to_order) + fragPadY
- Nesting: inner fragments layer on top (z-order resolved by render order)

**Deferral:** Alt sub-compartments (multiple guard conditions with divider lines) → increment-3.

---

## New Fixture

`examples/gallery/sequence-agent-loop.sequence.yaml`:
- 3 participants: User (actor), Agent, Tool
- 7 messages including 1 self-message (Agent → Agent: "reflect")
- 1 activation: Agent (orders 2–6)
- 2 fragments: `loop [retry until 200]` (orders 2–6), `opt [if token valid]` (order 7)
- Outputs: `sequence-agent-loop.svg` + `.png`

Validates full integration: self-message, activation, nested fragments.

---

## Test Results

- **603/603 tests pass** (589 pre-existing + 14 new)
- All pre-existing goldens byte-identical
- New sequence-agent-loop fixture rendered correctly

---

## Commit

**0f21596** — Barbara, Sequence grammar increment-2: self-messages (dashed), activations (bars), fragments (loops/opts/etc). 603/603 tests; goldens byte-identical.

---

## Open for Increment-3+

- Alt sub-compartment dividers (multiple guard conditions with horizontal separators)
- Participant kinds: `boundary`, `control`, `entity`, `database` icons (visual subtypes)
- SequenceTheme tokens on ResolvedTheme (layout currently uses hardcoded defaults)
- Fragment partial-overlap validation (e.g., warn if fragment spans don't align with message ranges)
- Soft nesting depth limit (recommend ≤3, lint warning if exceeded)

---

## Questions for Mark (IR & Schema)

1. **Order-range validation:** Should `Activation` and `Fragment` ranges be validated cross-semantically (e.g., `from_order < to_order`, both within message count) at schema or layout time?

2. **Alt multi-guard schema:** When alt sub-compartments are implemented, the schema will need to support multiple guards per alt fragment. Current design: `guard?: string` on Fragment. Should multi-guard be `guard?: string | string[]` or a nested `guards: Array<{label, from_order, to_order}>`?

3. **Nesting depth:** Is there a maximum nesting depth for fragments? Current design allows arbitrary nesting. Recommend soft limit (≤3) with lint warning in validation pass.


---

## PRINCIPLE: Grammar ≡ Semantics; Theme ≡ Style (2026-06-13)

**Author:** Barbara (Semantics & Rendering), affirmed by Leslie (Spec Architect)  
**Date:** 2026-06-13T10:44:40-04:00  
**Status:** ESTABLISHED — governs all grammars

### The Principle

The two-IR-layer architecture (Domain IR → Scene IR) is now reinforced by a categorical principle:

- **Grammar** captures the diagram **structure and layout semantics** only:
  - Participant order, message order (deterministic-by-construction placement)
  - Fragment nesting, activation ranges
  - Connector routing rules, hierarchy definitions
  - No visual styling decisions → no hardcoded colors, fonts, stroke widths, geometry offsets

- **Theme** captures **all visual presentation**:
  - Canvas color, typography (font family, size, weight, line-height)
  - Participant render modes (`'box'` ≡ plain UML, `'card'` ≡ infographic)
  - Color palettes per diagram kind/participant/message type
  - Geometry tokens (padding, gaps, badge sizes, corner radii)
  - Feature flags (lifeline visibility, step-number badges, message dashes)

### Rationale

1. **Reusability:** The same domain IR can be re-skinned by swapping themes (e.g., sequence-rest-auth rendered in UML style vs. ByteByteGo style).
2. **Consistency:** All grammars follow the same pattern → layered, testable, deterministic.
3. **Specification Clarity:** Designers define themes; engineers define grammars. Clean responsibility boundary.
4. **Non-Duplication:** Existing codebases (Vega-Lite, Mermaid) conflate grammar and style; this architecture avoids that trap.

### Enforced By

- `SequenceTheme` type on `grammars/sequence/theme.ts` — all styling from theme tokens, defaulting to UML values.
- Registry pattern: `SEQUENCE_THEME_REGISTRY`, `resolveSequenceTheme(name?)`.
- Future grammars (Flow, Tree) must follow the same pattern before receiving layout implementation.

### External Style Mimicry

Themes can intentionally mimic external visual languages (e.g., `sequenceByteByteGoTheme` mimics the ByteByteGo "5 REST API Methods" infographic style). This is **design by choice**, not accident — the grammar remains deterministic UML semantics; the theme provides the visual voice.

**Consequence:** The compiler is a presentation-engine for diagram semantics, not a rigid diagram-style enforcer.

---
# Decision: Sequence Grammar Theme System

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T10:44:40-04:00  
**Status:** ACCEPTED — implemented in increment-3

---

## Context

The Sequence Grammar (increment-1 and -2) had all styling hardcoded in `layout.ts`. The project direction is: grammar captures SEMANTICS only; ALL visual styling must be THEME-DRIVEN so the same IR can be re-skinned.

---

## Decision

### 1. `SequenceTheme` type lives in `grammars/sequence/theme.ts`

Every styling decision that was hardcoded in `layout.ts` is now a token in `SequenceTheme`. The interface covers: canvas, geometry, typography, stroke widths, participant rendering mode, card-mode card colors, lifeline visibility, message line styles, step number badges, activation bars, and fragments.

**The `defaultSequenceTheme` constant reproduces the original UML look byte-identically** — all previous hardcoded values are preserved as defaults.

### 2. `participantRenderMode: 'box' | 'card'`

- `'box'` (default): plain rectangular headers (UML style)
- `'card'`: colored rounded cards with a per-kind icon glyph + label (infographic style)

Card colors are defined per `kind` via `cardKindColors: Partial<Record<string, CardKindStyle>>`. The `CardKindStyle` has `fill`, `textColor`, `accentColor`, `iconColor`.

### 3. Icon support on `Participant`

Added `icon?: string` (icon registry name) and `color?: string` (per-participant color override) to the `Participant` IR. Both are optional → zero impact on existing documents/schemas.

Card mode looks up `p.icon ?? tk.cardKindIconMap[p.kind]` and renders the 24×24 icon path scaled into the `cardIconAreaSize` area via SVG `transform="translate(...) scale(...)"` on `PathPrimitive`.

### 4. `lifelineVisible: boolean`

When `false`, lifeline dashed vertical lines are not emitted. Infographic themes (ByteByteGo) hide lifelines; messages span between card columns directly.

### 5. Step number badges

`showStepNumbers: boolean` — when true, a filled circle (`stepBadgeFill`) with the `msg.order` number is drawn at 25% along each message arrow line, using the `circle` Scene primitive. Self-messages get the badge at the loop corner.

### 6. `SEQUENCE_THEME_REGISTRY` + `resolveSequenceTheme(name?)`

Named themes are stored in `SEQUENCE_THEME_REGISTRY` keyed by name string. `doc.metadata.theme` → `resolveSequenceTheme()` → theme struct. Currently registered: `'default-sequence'`, `'bytebytego-sequence'`. Callers can also pass an explicit `themeOverride` to `layoutSequence()`.

### 7. `sequenceByteByteGoTheme` — ByteByteGo infographic style

Mimics the ByteByteGo "5 REST API Authentication Methods" style:
- Dark canvas `#111827`
- Card mode: per-kind vibrant fills (actor=blue, object=purple, entity=green, database=red, …)
- Icon glyphs from icon registry
- Hidden lifelines
- Amber step-number badges
- Light message text and dashed reply arrows

---

## Consequences

- Any future sequence diagram can choose its visual style by setting `metadata.theme`
- Adding a new named theme requires only a new `SequenceTheme` object + registry entry — zero layout code changes
- The grammar=semantics / theme=style split is now formally enforced by the type boundary
- The `defaultSequenceTheme` acts as the living spec for what the UML style values are

---

## Files Changed

| File | Change |
|------|--------|
| `grammars/sequence/theme.ts` | NEW — SequenceTheme type, defaultSequenceTheme, sequenceByteByteGoTheme, registry |
| `grammars/sequence/types.ts` | Add `icon?`, `color?` to Participant |
| `grammars/sequence/schema.ts` | Accept `icon`, `color` on participant |
| `grammars/sequence/layout.ts` | Full refactor: all styling from theme, card mode, badges, lifelineVisible |
| `grammars/sequence/index.ts` | Export theme API, thread themeOverride through |
| `examples/gallery/sequence-rest-auth-bytebytego.sequence.yaml` | NEW ByteByteGo fixture |
| `test/sequence.test.ts` | 4 new ByteByteGo theme tests (gallery emit + scene assertions) |

---

## Decision: Sequence Theme Polish — Badge Offset + Gallery Curation

**From:** Barbara (Semantics & Rendering) | **Date:** 2026-06-13T11:17:00-04:00  
**Status:** ADOPTED

---

### Decision 1 — `stepBadgeOffset` + `msgLabelYOffset` tokens

**Problem:** In card-mode (ByteByteGo theme), the step-number badge was drawn at the
lifeline centre (25% along the arrow from `effectiveFromX`). Since the participant box
half-width is 70 px and `effectiveFromX` is the lifeline centre, the badge landed
**inside the participant card** — invisible (same colour) and overlapping the card.

**Fix:** Added two tunable tokens to `SequenceTheme`:

| Token | Default | ByteByteGo | Semantics |
|-------|---------|-----------|-----------|
| `stepBadgeOffset` | 0 | 14 | Pixels past the participant box edge to badge centre. `0` ↔ legacy ¼-along. |
| `msgLabelYOffset` | 6 | 20 | Pixels above the row Y to the label alphabetic baseline. Separates label descenders from badge circle. |

**Algorithm change in `layout.ts`:**
- When `stepBadgeOffset > 0`: `badgeX = fromCx + dir × (fromColHalfW + stepBadgeOffset)`
  where `fromColHalfW = pl.colW / 2` (box edge). This puts the badge on the dark-background
  arrow segment between cards, regardless of arrow direction.
- When `stepBadgeOffset === 0`: old ¼-along formula preserved for backward compat.
- `renderMessage` accepts two new params `fromColHalfW` and `toColHalfW`; default theme
  is unaffected (`showStepNumbers: false` means badge code path is never entered).

**Determinism:** Zero impact on default-theme outputs. All 611 tests pass;
`sequence-rest-auth.*` and `sequence-agent-loop.*` are byte-identical.

---

### Decision 2 — Blue step badges (#2563eb, white text)

Reference image (sample-images/image copy 6.png) uses blue numbered circles.
The prior amber (#f59e0b) was inconsistent with the ByteByteGo colour palette.

**Changed in `sequenceByteByteGoTheme`:**
- `stepBadgeFill: '#2563eb'` (matches actor card colour — harmonious)
- `stepBadgeTextColor: '#ffffff'` (white, high contrast on blue)

---

### Decision 3 — Activation + fragment legibility on dark background

Adjusted for the `bytebytego-sequence` theme:
- `activationBarFill: '#4b5563'` (up from `#374151`) — more visible on `#111827`
- `activationBarStroke: '#94a3b8'` (brighter border)
- `fragTabFill: '#4b5563'` (up from `#374151`) — legible tab on dark bg
- `fragTabTextColor: '#f3f4f6'` (up from `#d1d5db`) — higher contrast

---

### Decision 4 — Gallery curation

Four sequence examples added to `examples/gallery/index.html`:

| Card | Slug | Theme | Highlights |
|------|------|-------|-----------|
| 13 | `sequence-rest-auth` | default-sequence | UML reference render |
| 14 | `sequence-rest-auth-bytebytego` | bytebytego-sequence | Same IR, different style — grammar/theme split |
| 15 | `sequence-agent-loop` | default-sequence | Activation + loop/opt fragments + self-message |
| 16 | `sequence-agent-loop-bytebytego` | bytebytego-sequence | Dark theme with all advanced features |

Card descriptions explicitly name the grammar=semantics / theme=style principle for
cards 13/14 (presented as a pair).

New file: `examples/gallery/sequence-agent-loop-bytebytego.sequence.yaml` — same IR as
`sequence-agent-loop` with `theme: bytebytego-sequence` and participant icon fields.

---

## Decision Record: Tree Grammar Spec (Grammar #4, De-Risked)

**From:** Leslie (Spec Architect)  
**Date:** 2026-06-13T11:02:15-04:00  
**Status:** PROPOSED (pending Mark/Barbara review)

---

### Summary

The Tree Grammar is now fully specified as Grammar #4 in the deterministic diagram compiler. It is de-risked: the Buchheim–Jünger–Leipert (2002) tidy-tree algorithm is O(n), deterministic, and a solved problem.

**Artifact:** `design/sections/27-tree-grammar.tex`

---

### Key Decisions Made

#### 1. Canonical IR Form: Children-List (not Parent-Ref)

The Tree Domain IR uses a **recursive `TreeNode` with an embedded `children[]` list** as its canonical representation. Rationale:
- Natural top-down authoring (mirrors mental model).
- Structural validity guarantee (no cycles or orphans possible in nested form).
- Sibling order is implicit in list position.

A flat parent-ref alternative is documented as a possible input convenience, deferred to Mark for schema acceptance decision.

#### 2. Forest Handling: Rejected (Single Root Required)

Multiple roots are a validation error. Forest layout is a composition concern — authors use the Composition layer with multiple Tree panels. Rationale: avoids ambiguity in how disjoint trees are arranged relative to each other.

#### 3. Layout Algorithm: Buchheim–Jünger–Leipert 2002

- Reingold–Tilford / Walker / Buchheim lineage.
- O(n) time and space (thread-pointer technique).
- Deterministic: pure function of tree structure + sibling order.
- Top-down default orientation; left-to-right as theme option.

#### 4. Grammar = Semantics; Theme = Style

The IR carries structure and semantic hints only (`kind`, `icon`, `collapsed`). All visual styling (node shapes, edge routing, colors, spacing, orientation) is deferred to a `TreeTheme` type, consistent with `SequenceTheme` and `FlowTheme` precedent.

#### 5. No New Kernel Primitives

Lowering uses existing Scene IR primitives (Rect, Text, Path, Line, Image, Group). No kernel changes needed.

---

### Deferred to Mark (Schema)

- Parent-ref vs children-list: accept both, or canonical form only?
- `kind` field: free string or closed enum?
- Forest support: confirmed rejected, or revisit later?
- Validation invariants: exhaustive list needed.
- Node `id` format: kebab-case flat namespace vs path-based namespacing.

### Deferred to Barbara (Rendering)

- Edge routing style: elbow geometry (corner radius, midpoint), straight, curved.
- Collapsed-node indicator: visual design ("+" glyph, ellipsis, count badge).
- TreeTheme token surface: complete token list for default + showcase themes.
- Kind → shape mappings: built-in defaults (person→circle, folder→rounded-rect, etc.).
- Label overflow behavior: truncate, wrap, or auto-expand.

---

### Wiring

- Created `design/sections/27-tree-grammar.tex`
- Added `\input{sections/27-tree-grammar}` in `design/main.tex` (after sequence grammar)
- Updated grammar sequencing note in `design/sections/24-diagram-family.tex`
- Reused existing bib keys: `reingold1981`, `walker1990`, `buchheim2002`, `garey1983`
# MILESTONE DECISION: All Four Grammars Implemented + Composition Layer Specced (2026-06-13)

**From:** Scribe (Orchestration)  
**Date:** 2026-06-13T11:53:53-04:00  
**Status:** MILESTONE ACHIEVED

## Summary

As of 2026-06-13, two critical deliverables are complete:

1. **Flow Grammar (Grammar #2) fully implemented** — Barbara shipped packages/core/src/grammars/flow/ with deterministic Sugiyama layering, cycle-safe routing (back-edges), and cubic-Bézier forward edges. Includes 33 new tests; 663/663 pass. Commit: 48d3673.

2. **Composition Layer fully specced** — Leslie completed design/sections/30-composition.tex with grid-based IR, sub-Scene embed mechanism, and deterministic layout contract. RAG-poster (2×2) example renders clean. PDF rebuilt. Commit: 8ae0ff7.

## Grammar Status Summary

| Grammar | Spec | IR | Layout | Theme | Tests | Gallery | Status |
|---------|------|----|----|-------|-------|---------|--------|
| Timeline (T1-T5) | ✅ | ✅ | ✅ | ✅ (5) | 551/663 | ✅ | SHIPPED |
| Sequence Inc-1 | ✅ | ✅ | ✅ | ✅ (2) | 580/663 | ✅ | SHIPPED |
| Tree Inc-1 | ✅ | ✅ | ✅ B–J–L | ✅ | 630/663 | ✅ | SHIPPED |
| Flow Inc-1 | ✅ | ✅ | ✅ Sugiyama | ✅ | 663/663 | ✅ | SHIPPED |

**Total:** 663/663 pass (630 prior + 33 new flow). All 630 prior goldens byte-identical.

## Composition Layer Readiness

- **IR shape finalized:** CompositionDocument(grid, cells[], CellContent union)
- **Embed algorithm specified:** Sub-Scene → grid sizing → fit-to-rect scale → merge
- **Blocked on:** Barbara's `translateAndScale()` kernel helper (Mark schema ready; Leslie spec done)
- **Next:** Mark finalizes CompositionDocument JSON Schema; Barbara implements kernel helper; integration

## Cross-Agent Status

- **Mark:** CompositionDocument schema + ir_file URI schemes
- **Barbara:** Kernel helper `scene-transform.ts` — critical path for composition inc-1
- **Leslie:** Spec complete; composition-inc-1 awaits Mark/Barbara

## Artifacts Merged

- Barbara decision: `.squad/decisions/inbox/barbara-flow-impl.md` → decisions.md
- Leslie decision: `.squad/decisions/inbox/leslie-composition.md` → decisions.md
- Tree implementation detail → decisions-archive.md (compaction)
- Commits: 48d3673 (flow), 8ae0ff7 (composition spec)


---

# Decision: Flow Grammar — Increment-1 Implementation

**Author:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T11:32:58-04:00  
**Status:** Implemented  
**Refs:** `design/sections/25-flow-grammar.tex`, `packages/core/src/grammars/flow/`, Commit: 48d3673

## Context

The Flow Grammar (Grammar #2) has been implemented at Increment-1 scope. This document records the design decisions made during implementation that deviate from or extend the spec.

## Design Decisions Summary

1. **IR Field Names:** `from`/`to` (consistent with SequenceMessage)
2. **Cycle Handling:** Iterative DFS (stack-safe for production)
3. **Column Width:** Uniform global max (simple, clean pipeline look)
4. **PathPrimitive.dashArray:** Non-breaking kernel extension (backward-compatible)
5. **Edge Routing:** Cubic Bézier default (S-curve, visual superiority)
6. **Animated Edges:** Resting frame only (CSS animation deferred)
7. **Back-Edge Routing:** Bottom-port Bézier arc (cycle-safe, visually distinct)

## Files Created/Modified

```
packages/core/src/grammars/flow/
  types.ts, schema.ts, theme.ts, layout.ts, index.ts
packages/core/src/scene.ts  — PathPrimitive.dashArray? added
packages/core/src/render/svg.ts  — stroke-dasharray emission
packages/core/test/flow.test.ts  — 33 new tests
examples/gallery/flow-rag-pipeline.{flow.yaml,svg,png}
```

## Test Results

- **663/663 pass** (630 prior + 33 new)
- **All 630 prior goldens byte-identical** (dashArray undefined on all existing scenes)
- New flow tests: schema (12), scene structure (10), determinism (4), cycles (4), gallery (2), non-overlap (1)

---

# Decision Record: Composition Layer Concretized

**From:** Leslie (Spec Architect)  
**Date:** 2026-06-13T11:32:58-04:00  
**Status:** SPEC COMPLETE (implementation blocked on Mark schema + Barbara kernel helper)

## Summary

The Composition Layer spec (design/sections/30-composition.tex) has been enriched from sketch into a precise, implementable specification covering IR shape, embed mechanism, layout contract, and edge cases.

## Composition IR Shape

- **CompositionDocument:** version, metadata, grid (columns, rows, gap, padding), cells[]
- **Cell:** id, row/col, rowSpan/colSpan, title/caption, content: CellContent
- **CellContent union:** grammar | stat | text | title | image
- **GrammarContent:** grammar name (timeline/sequence/tree/flow) + inline ir OR ir_file reference
- **Canonical model:** Grid-based (rows×cols). Stack = grid with C=1. No custom/freeform.

## Sub-Scene Embed Mechanism

1. **Compile:** Each cell's content → independent sub-Scene
2. **Grid sizing:** Column widths = max(sub-scene widths per column); row heights analogous
3. **Translate + Scale:** s = min(W_cell/w_scene, H_cell/h_scene), capped at 1.0; center; apply translateAndScale()
4. **Merge:** All transformed primitives + chrome in painter's order → one Scene

## Kernel Helper Required

**Function:** `translateAndScale(p: ScenePrimitive, dx, dy, scale) → ScenePrimitive`

Must handle ALL primitive kinds (Line, Rect, Circle, Text, MultiText, Path, Group, Image), including Path d-string and StrokeGradient coordinate transformation, recursive GroupPrimitive descent, rounding via rhu(2dp).

**Location:** packages/core/src/scene-transform.ts  
**Blocker on:** Barbara (Mark schema ready; Leslie spec complete)

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout model | Grid only | Totality, determinism, small IR |
| Scale policy | fit (scale-down) | All content visible, no pixelation |
| Nested compositions | Allowed (depth ≤ 3) | Complex layouts without richer primitives |
| Empty cells | Valid, grid-allocated | Ragged grids natural |

## Deferred

- Mark: CompositionDocument JSON Schema, ir_file URI schemes, two-pass validation, named grid tracks
- Barbara: translateAndScale kernel helper (critical path), Path d-string strategy, clip policy, chrome rendering

