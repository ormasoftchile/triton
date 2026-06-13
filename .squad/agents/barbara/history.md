# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

---

## Recent Summary (2026-06-12)

### Roadmap Layout Family (3 increments)

**INCREMENT 1:** Created `layout/roadmap.ts` — new layout family alongside horizontal/vertical-spine/serpentine. Three-zone infographic: header, milestone callouts (all above), phase band with icon badges, date axis below. Wired `metadata.layout` as IR field + render option. 577/577 tests pass; byte-identical goldens.

**INCREMENT 2:** Greedy left→right de-collision for callout placement. Forward pass (push blocks right to clear previous) + backward clamp (prevent overflow). GAP=12px ensures axis date labels don't overlap. Single x for all milestone elements (block/leader/dot/axis tick). Result: 6 callouts at 103, 553, 700, 840, 971, 1097px with ≥12px edges.

**INCREMENT 3:** Promoted 17 hardcoded geometry constants to optional theme tokens (RoadmapTheme: 5 padding + 6 gaps + 6 sizes). `breakGapPx` required AxisState wiring. All defaults match current constants → byte-identical goldens.

### Theme Tokens & Opt-In Features

- `axis.nodeWrap: 'over-under'` — spine arcs around nodes (our-timeline only)
- `milestone.labelWrap: boolean` — 2-line milestone wrap with dynamic box height  
- `axis.todayMarker.labelChip: boolean` — white chip backdrop under Today label
- `axis.todayMarker.onTop: boolean` — defer today marker after activity pills (z-order fix)
- `axis_breaks: Array<{from, to}>` — piecewise-linear layout with 24px gaps + "//" markers

### Test Coverage & Determinism

- 577/577 tests pass (564 core + 13 schema + 3 cli)
- All existing goldens byte-identical (0 regression)
- Determinism: `Math.floor(x + 0.5)` round-half-up throughout
- Timeline-goals fixture: 3 new outputs (SVG/PNG/Skia)

### Handoff Notes (Open Work)

**Mark (schema validation):** Defer `axis_breaks` field constraints:
- `from < to` enforcement
- Breaks within `time_range` bounds
- Non-overlapping, sorted validation
- Max breaks upper limit warning

Full learnings archived to `history-archive.md`.

---

## 2026-06-13 — Sequence Grammar Rendering Open Questions (Barbara Intake)

**From:** Scribe (recording Leslie's deferred work) | **Date:** 2026-06-13T06:43:00Z  
**Artifact:** `design/sections/26-sequence-grammar.tex` (Grammar #3 Specification)  
**Status:** Ready for Barbara's rendering semantics refinement

### Sequence Rendering Specification Queries (Priority: Barbara intake for Phase 2)

1. **Self-Message Curve Geometry**
   - Current spec: self-messages (participant → same participant) render as 3-segment Path (exit right, descend, return left).
   - **Options:** Sharp right angles vs. smooth arc at corners vs. Bézier curves?
   - **Impact:** Visual clarity, aesthetics, font size scaling.
   - **Pattern:** Align with existing activation-bar styling; consider `axis.nodeWrap` precedent for opt-in routing tokens.

2. **Fragment Nesting Depth Recommendation**
   - Fragments can nest (alt inside loop, etc.). Any soft limit for readability?
   - **Example:** Warn if depth > 3? Visual precedent from UML diagram tools?
   - **Impact:** LLM generation guidance; user feedback.

3. **Participant Stereotype Icon Geometries**
   - `kind` values: `actor|object|boundary|control|entity|database`
   - **Actor:** Stick figure (circle head, line arms/body, legs) — existing precedent from Timeline icons
   - **Boundary:** Vertical bar (left edge line)
   - **Control:** Arrowhead shape or state machine symbol?
   - **Entity:** Underline or special box?
   - **Database:** Cylinder (concentric ellipses + vertical offset)?
   - **Decision:** Fixed icon set vs. customizable?

4. **Arrowhead Sizing & Style**
   - Current spec: message `kind` (sync|async|reply) implies arrow style.
     - sync: filled triangle arrow
     - async: open (outline-only) arrow
     - reply: dashed line + open arrow
   - **Sizing:** Scale with stroke width or fixed pixel size? Min/max bounds?
   - **Impact:** Clarity at different zoom levels; theme token extensibility (e.g., `sequence.arrowHeadScale`).

5. **Activation Bar Width**
   - Thin Rect on lifeline during activation span. Fixed width or proportional?
   - **Pattern:** Compare to Timeline badge width precedent.
   - **Decision:** `sequence.activationBarWidth: number` as theme token?

6. **Fragment Tab Label Styling**
   - Fragment keyword tab (loop, alt, etc.) + guard label. Typography, padding, icon?
   - **Pattern:** Align with existing callout/box styling from roadmap layout.

---

## Learnings — 2026-06-13 Sequence Grammar Increment-1

### Module Structure Created

New grammar module: `packages/core/src/grammars/sequence/`

| File | Purpose |
|------|---------|
| `types.ts` | Sequence domain IR: `SequenceDocument`, `Participant`, `Message`, `Activation` (stub), `Fragment` (stub) |
| `schema.ts` | Zod schema — validates participant id uniqueness, message from/to refs, order ≥ 0 |
| `layout.ts` | `layoutSequence(doc)` — deterministic-by-construction Scene emission |
| `index.ts` | Public API: `buildSequenceScene`, `renderSequenceDocument`, re-exports types/schema |

### Kernel Reuse Pattern

The Sequence Grammar emits only existing Scene IR primitives (rect/line/path/text). No new kernel primitives were added. Serialisers (`sceneToSvg`, `svgToPng`, `sceneToPngSkia`) are imported unchanged from `render/`. This is the two-IR-layer architecture: Sequence Domain IR → `layoutSequence()` → Scene → existing backends.

Layout is deterministic-by-construction: participant x = cumulative column widths (measured via `measureText`); message y = `headerBottom + firstMsgGap + rank * rowHeight`. Rounding uses `rhuInt` (round-half-up, integer). All 577+12=589 tests pass; 577 existing goldens byte-identical.

### What Is Deferred to Increment-2

- **Activations**: thin filled rect on lifeline; `Activation` type exists in types.ts, schema accepts it, layout ignores it
- **Fragments**: combined fragment (loop/alt/opt/par/critical/break) rect+tab; `Fragment` type exists, deferred
- **Self-message curve geometry**: currently sharp right angles; increment-2 may add rounded corners via theme token
- **Additional participant kinds**: `boundary`, `control`, `entity`, `database` — currently fall back to `object` box styling; increment-2 adds their specific icons/shapes
- **Theme integration**: sequence uses fixed DEFAULTS; increment-2 adds a `SequenceTheme` block on `ResolvedTheme` with configurable tokens

---

## Learnings — 2026-06-13 Sequence Grammar Increment-2

### Activations (Increment-2)

**Implementation:** `renderActivationBars()` in layout.ts emits a `RectPrimitive` per activation, colored `#c5cae9` fill / `#5c6bc0` stroke, `rx:2`, `activationBarHalfW=5px` each side, rendered **after** lifelines but **before** messages (painter order).

**Minimum height:** When `from_order == to_order` the bar would be zero-height. `activationBarMinH=20px` clamps with vertical centering on the row Y.

**Edge attachment:** Messages arriving/leaving an active participant offset their endpoint by `±barHalfW` so arrows visually land on the activation bar edge rather than the bare lifeline center. The offset direction is computed per-message in `layoutSequence()`: right edge for outgoing-right / incoming-right, left edge for outgoing-left / incoming-left. Self-messages exit/return at the right edge.

**Order→Y map:** `buildOrderToRowY()` maps message order values to row Y coordinates (first occurrence wins for duplicate orders). Used by both activations and fragments to convert order references to pixel positions.

### Fragments (Increment-2)

**Rendering:** `renderFragments()` sorts fragments by span size descending (outer first, inner on top — painter's algorithm). Emits:
1. Main `RectPrimitive` (`#eff1fb` fill, `#7986cb` stroke, `rx:6`) — light indigo background.
2. Tab `RectPrimitive` (`#5c6bc0` fill) in upper-left corner — sized to keyword text width.
3. Keyword `TextPrimitive` (white, bold, 11px) centered in tab.
4. Guard label `TextPrimitive` (dark indigo, 11px) immediately after the tab.

**Horizontal extent:** When `fragment.participants` is absent, use the leftmost participant's `boxX - fragPadX` to the rightmost participant's `boxX + boxW + fragPadX`, clamped to `[0, canvasW]`.

**Vertical extent:** `rowY(from_order) - fragPadY` to `rowY(to_order) + fragPadY` (fragPadY=14px).

**Painter order:** Fragments rendered as step 6 (right after background), before participant headers (step 7) and messages (step 9). This puts fragments visually behind all content.

**Alt sub-compartment dividers deferred:** Only a single guard label per fragment. Multiple operands/guards in `alt` fragments require divider line primitives — deferred to increment-3.

### Self-messages (Increment-2 fix)

**3-segment LinePrimitives:** Changed from a single `PathPrimitive` (which lacked `dashArray` support) to 3 separate `LinePrimitive`s (horizontal right → vertical down → horizontal left). This correctly supports `dashArray` for dashed reply self-messages.

**Label placement:** Changed from "centered above the exit segment" to "to the right of the loop, vertically centered on the loop height" (`textAnchor: 'start'`). This matches the spec and avoids overlap with the fragment box above.

**Activation edge attachment:** Self-message exit/return point shifts to `cx + barHalfW` when the participant has an active activation bar at that message order.

### Schema Updates

Added fragment validation in `superRefine`:
- `from_order > to_order` → validation error
- `fragment.participants` refs unknown participant → validation error
(Activation validation was already present in increment-1.)

### Determinism

All new rendering paths use `rhuInt(v) = Math.floor(v + 0.5)` for coordinate rounding. The fragment tab width uses `measureText()` which is deterministic (same font/size → same width). Activation bar rendering uses the same deterministic `orderToRowY` map. **603/603 tests pass; all existing goldens byte-identical.**

### Open Work (Increment-3+)

- Alt fragment sub-compartment dividers (multiple guard conditions per alt)
- Additional participant kinds: boundary/control/entity/database icons
- Theme integration: `SequenceTheme` tokens on `ResolvedTheme`
- Fragment partial-overlap validation (currently only `from_order <= to_order` is enforced)
- Soft nesting depth limit (recommend max 3 levels with lint warning)


---

## 2026-06-13 — Sequence Grammar Increment-1 SHIPPED (Barbara)

**Date:** 2026-06-13T14:13:38Z | **Commit:** 301a188

### Completed

✅ Module created: `packages/core/src/grammars/sequence/` (types, schema, layout, index)  
✅ Kernel reuse verified: no new Scene IR primitives needed  
✅ All 577 timeline goldens byte-identical  
✅ 589/589 tests pass (577 legacy + 12 new sequence)  
✅ Example fixture: `examples/gallery/sequence-rest-auth.{sequence.yaml, svg, png}`

### Architecture Achievement

The two-IR-layer model is now production-proven with a second grammar. Sequence eliminates the "hard problem" (Sugiyama auto-layout) entirely via deterministic-by-construction placement. The `grammars/sequence/` module is the template for all future grammars (own IR → deterministic layout → shared Scene kernel → backends).

### Increment-2 Roadmap

Barbara will implement (in priority order):
1. Self-message curve geometry (rounded corners or smooth arc vs. sharp angles)
2. Activation bar width + styling
3. Fragment rectangles + tab labels
4. Participant stereotype icons (actor stick-figure, boundary bar, control arrow, entity underline, database cylinder)
5. `SequenceTheme` integration on `ResolvedTheme` + arrowhead sizing tokens
