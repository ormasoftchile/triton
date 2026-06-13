
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

---

## Learnings — 2026-06-13 Sequence Theme (Increment-3)

### SequenceTheme Token Surface

Created `packages/core/src/grammars/sequence/theme.ts` — a standalone type file holding all styling tokens for the sequence diagram. Token groups:

| Group | Tokens |
|-------|--------|
| Canvas | `background`, `fontFamily` |
| Geometry | `marginH/Top/Bottom`, `headerPadX/Y`, `minColWidth`, `colGap`, `firstMsgGap`, `rowHeight`, `actorIconHeight`, `activationBarHalfW/MinH`, `arrowHeadSize`, `selfMsgLoopW/H`, `fragPadX/Y/Rx`, `fragTabPadX/Y` |
| Typography | `labelFontSize/Weight`, `msgFontSize/Weight`, `fragKeyFontSize/Weight`, `fragLabelFontSize/Weight` |
| Stroke widths | `participantBoxStrokeWidth`, `lifelineStrokeWidth`, `messageLineStrokeWidth`, `activationBarStrokeWidth`, `fragStrokeWidth` |
| Participant | `participantRenderMode` (`'box'`\|`'card'`), `participantBoxRx`, `participantBoxFill/Stroke`, `participantLabelColor` |
| Card mode | `cardIconAreaSize`, `cardKindColors` (per-kind `fill/textColor/accentColor/iconColor`), `cardKindIconMap` |
| Lifeline | `lifelineVisible`, `lifelineStroke`, `lifelineDash` |
| Messages | `messageLineStroke`, `messageLineDashSync/Async/Reply`, `messageLabelColor`, `arrowFill` |
| Activation bars | `activationBarFill/Stroke/Rx` |
| Fragments | `fragStroke/Fill`, `fragTabFill/TextColor`, `fragLabelColor` |
| Step badges | `showStepNumbers`, `stepBadgeRadius/Fill/TextColor/FontSize` |

### Grammar = Semantics / Theme = Style Split

The IR (`SequenceDocument`, `Participant`, `Message`, `Activation`, `Fragment`) captures only semantics — who talks to whom, in what order. All visual decisions live in `SequenceTheme`. Two documents with identical IR but different theme names (`default-sequence` vs `bytebytego-sequence`) render as UML vs ByteByteGo infographic without any IR change.

`metadata.theme` → `resolveSequenceTheme()` → `SEQUENCE_THEME_REGISTRY` lookup → theme struct → `layoutSequence(doc, theme)`. Callers can also pass an explicit `themeOverride` bypassing the registry.

### Participant Extensions

Added `icon?: string` (icon registry name, e.g. `'people'`, `'lock'`) and `color?: string` (per-participant fill override) to `Participant`. Both optional → zero effect on default theme / existing documents. Schema updated to accept both fields.

### ByteByteGo Theme (`sequenceByteByteGoTheme`)

Mimics the ByteByteGo infographic style:
- **Dark canvas**: `background: '#111827'`
- **Card mode**: `participantRenderMode: 'card'`, `participantBoxRx: 14`, colored cards per kind  
  - Actor `#2563eb`, Object `#7c3aed`, Boundary `#0891b2`, Control `#d97706`, Entity `#059669`, Database `#dc2626`
- **Icon glyphs**: `cardKindIconMap` maps `actor→people`, `object→gear`, `boundary→cloud`, `control→bolt`, `entity→doc`, `database→database`. Icons scaled via SVG `transform="translate(...) scale(...)"` on PathPrimitive.
- **Hidden lifelines**: `lifelineVisible: false`
- **Numbered step badges**: `showStepNumbers: true`, amber circles (`#f59e0b`) with dark number text, drawn at 25% along each message arrow
- **Light message text**: `messageLabelColor: '#e2e8f0'`, dashed reply arrows `8,5`

### Byte-Identical Default Theme

`defaultSequenceTheme` matches ALL previously hardcoded values in `layout.ts` exactly. New feature tokens (card mode, step badges, hidden lifelines) are off by default. Result: `git diff examples/gallery/sequence-rest-auth.* examples/gallery/sequence-agent-loop.*` shows **zero lines changed**. 607/607 tests pass.

### New Gallery Outputs

- `examples/gallery/sequence-rest-auth-bytebytego.{svg,png}` — ByteByteGo-theme render of REST auth  
- `examples/gallery/sequence-rest-auth-bytebytego.sequence.yaml` — matching fixture (participants with `icon` fields)

---

## Learnings — 2026-06-13 Sequence Theme Polish + Gallery Curation (Increment-4)

### Badge-Offset Token (`stepBadgeOffset`)

The previous badge placement (25% along from `effectiveFromX`) had two bugs in card mode:
1. `effectiveFromX` is the lifeline *centre*, so the badge landed **inside the participant card** (participant colW=140 → halfW=70; badge at +25% of arrow was well within card bounds).
2. Same-colour badge on same-colour card (both `#2563eb` for actor kind) → invisible.

**Fix:** New `stepBadgeOffset: number` token. When `> 0`, badge X = `fromCx + dir × (fromColHalfW + stepBadgeOffset)` — anchored to the **box edge**, not lifeline centre. `fromColHalfW` is now passed as a param to `renderMessage`. This reliably puts the badge on the dark-background gap between cards.

### `msgLabelYOffset` Token

The label alphabetic baseline was hardcoded at `rowY - 6`. With font-size 12, descenders extend to `baselineY + 4 ≈ rowY - 2`, which is only `badgeRadius - 2 = 9px` above the badge top (`rowY - 11`). This created vertical overlap. Token `msgLabelYOffset` (default 6, ByteByteGo 20) lifts the label clear of the badge circle.

### Blue Badge Colour

Reference (image copy 6.png) uses blue numbered circles. Changed `stepBadgeFill` from amber `#f59e0b` to `#2563eb` with `stepBadgeTextColor: '#ffffff'`. This harmonises with the actor card colour and matches ByteByteGo's blue palette.

### Activation / Fragment Legibility on Dark Background

On `#111827`, the previous `activationBarFill: '#374151'` was nearly invisible. Brightened to `#4b5563` fill / `#94a3b8` stroke. Fragment tab updated: `fragTabFill: '#4b5563'`, `fragTabTextColor: '#f3f4f6'`. Fragment box fill `#1e2433` remains (subtle dark-blue tint against pure-black bg is legible without being garish).

### Gallery Curation Pattern

Sequence cards follow the same card structure as timeline cards. Used existing CSS tag classes only (no new classes added). Cards 13+14 are presented as a pair (same YAML, different theme) to communicate the grammar=semantics / theme=style principle directly in the gallery. Card `card-num` uses the slug as the sub-label. All four PNGs/SVGs/YAMLs verified to exist before committing.

### New Output Files

| File | Type | Notes |
|------|------|-------|
| `examples/gallery/sequence-agent-loop-bytebytego.sequence.yaml` | Fixture | ByteByteGo theme, adds `icon` fields per kind |
| `examples/gallery/sequence-agent-loop-bytebytego.svg` | Gallery | Generated by test suite |
| `examples/gallery/sequence-agent-loop-bytebytego.png` | Gallery | Generated by test suite |

### Test Count

607 → 611 (4 new tests: agent-loop-bytebytego SVG emit, PNG emit, blue-badge assertion, determinism).  
All 611 pass; default-theme sequence goldens byte-identical.
