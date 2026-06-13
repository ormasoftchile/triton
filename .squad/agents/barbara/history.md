# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Created:** 2026-06-10

---

## Current Role

Render domain IRs to Scene IR primitives with deterministic, themeable output. Design and implement visualization grammars following the grammar ≡ semantics / theme ≡ style principle.

---

## Key Learnings

- **Two-IR-Layer Model:** Domain IR → Scene IR (universal kernel). All styling lives in theme tokens, never in IR.
- **Deterministic Rendering:** `measureText()`, `rhuInt()` rounding, fixed coordinate geometry — reproducible across platforms.
- **Theme-Driven Architecture:** `SequenceTheme` type system enables external style mimicry (ByteByteGo infographic) without IR changes.
- **Gallery Semantics:** Multiple examples per grammar with different themes demonstrate reusability principle directly.

---

## Active Work

### Sequence Grammar — SHIPPED (Increments 1–4)

**Status:** Production-ready (611 tests pass; byte-identical defaults)  
**Module:** `packages/core/src/grammars/sequence/`

**Increment-1 (2026-06-13T06:43Z):** Baseline IR + deterministic layout
- `SequenceDocument`: participants[], messages[], activations[], fragments[]
- Kernel reuse (Rect, Line, Path, Text primitives)
- No new Scene IR types needed

**Increment-2 (2026-06-13T10:13Z):** Activations + Fragments
- Self-messages (3-segment LinePrimitive dashes)
- Activation bars (thin rects on lifelines)
- Fragment rectangles (loop/alt/opt/par/critical/break with keyword tabs)
- Painter order: fragments → headers → messages

**Increment-3 (2026-06-13T14:13Z):** SequenceTheme Token System
- `SequenceTheme` type: Canvas, Geometry, Typography, Stroke, Participant, Lifeline, Messages, Activations, Fragments, Badges
- `SEQUENCE_THEME_REGISTRY` + `resolveSequenceTheme(name?)`
- `defaultSequenceTheme` (backward-compatible, UML style)
- `sequenceByteByteGoTheme` (ByteByteGo infographic style)
- Participant `icon?` and `color?` fields (optional, zero impact on defaults)

**Increment-4 (2026-06-13T15:22Z):** Badge Offset + Gallery Curation
- `stepBadgeOffset` token: badge X = `fromCx + dir × (fromColHalfW + offset)` (fixes card-mode overlap)
- `msgLabelYOffset` token: message label baseline clearance above badge
- `stepBadgeFill: '#2563eb'` (blue, harmonizes with actor card)
- Dark-background legibility: `activationBarFill: '#4b5563'`, `fragTabFill: '#4b5563'`
- Gallery cards 13–16: rest-auth + agent-loop in default/ByteByteGo themes (pair pattern)

**Gallery Curation:** Cards 13/14 presented as a pair to demonstrate grammar/theme split principle.

### Tree Grammar — SPEC COMPLETE (Pending Implementation)

**Status:** Awaiting Mark schema + Barbara rendering design  
**Spec Artifact:** `design/sections/27-tree-grammar.tex`

**Key Decisions:**
- Canonical IR: recursive `TreeNode` with embedded `children[]` list
- Layout algorithm: Buchheim–Jünger–Leipert O(n) deterministic tidy-tree
- Theme-driven: All styling (node shapes, edge routing, colors, orientation) in TreeTheme
- No kernel changes: Lowering uses existing Scene IR (Rect, Text, Path, Line, Image, Group)

**Deferred to Barbara (Rendering):**
1. Edge routing style (elbow geometry, straight, curved)
2. Collapsed-node indicator visual design
3. TreeTheme token surface (complete list)
4. Kind → shape default mappings
5. Label overflow behavior (truncate, wrap, auto-expand)

---

## Open Work

### Sequence Increment-5 (Future)

1. **Alt sub-compartment dividers** — Multiple guard conditions in alt fragments require divider lines
2. **Participant kind icons** — Boundary (bar), Control (arrow), Entity (underline), Database (cylinder)
3. **Self-message curve styles** — Rounded corners vs. smooth arc vs. sharp angles
4. **Arrowhead sizing** — Scale with stroke width or fixed pixel; theme token `sequence.arrowHeadScale`

### Tree Increment-1 (Pending Mark Schema)

1. **TreeTheme token surface** — Complete list (node shape, edge style, orientation, spacing, colors)
2. **Kind → shape mappings** — Built-in defaults (person→circle, folder→rounded-rect, etc.)
3. **Edge routing implementation** — Elbow (corner radius calc), straight, or curved (Bézier)
4. **Collapsed-node rendering** — Glyph design and placement

---

## Principle: Grammar ≡ Semantics; Theme ≡ Style

**Established 2026-06-13T15:01:41Z**

- Domain IR carries **only** structure and semantic hints (e.g., `kind`, `icon`, `collapsed`)
- **Zero visual fields** in the IR (no colors, shapes, spacing — all theme concerns)
- Theme provides all rendering rules (node shapes, edge routing, colors, typography, spacing)
- Consequence: Same IR + different theme = different visual style, same semantics

**Governance:** All future grammars (Flow, Tree, Composition) must follow this pattern:
1. Spec grammar semantics (layout determinism rationale, IR shape)
2. Define domain IR (no styling)
3. Implement theme-driven layout
4. Create `{GrammarName}Theme` type + registry
5. Register default (backward-compatible) + showcase themes

---

## Files & Artifacts

### Sequence Grammar

| File | Status |
|------|--------|
| `packages/core/src/grammars/sequence/types.ts` | ✅ Complete |
| `packages/core/src/grammars/sequence/schema.ts` | ✅ Complete (Zod validation) |
| `packages/core/src/grammars/sequence/layout.ts` | ✅ Complete (deterministic layout) |
| `packages/core/src/grammars/sequence/theme.ts` | ✅ Complete (SequenceTheme + registry) |
| `packages/core/src/grammars/sequence/index.ts` | ✅ Complete (public API) |
| `examples/gallery/sequence-rest-auth.sequence.yaml` | ✅ Fixture |
| `examples/gallery/sequence-rest-auth-bytebytego.sequence.yaml` | ✅ Fixture |
| `examples/gallery/sequence-agent-loop.sequence.yaml` | ✅ Fixture |
| `examples/gallery/sequence-agent-loop-bytebytego.sequence.yaml` | ✅ Fixture |
| `examples/gallery/index.html` | ✅ 4 new cards (13–16) |
| `test/sequence.test.ts` | ✅ 611 tests pass |

### Test Coverage

- **611/611 tests pass** (607 legacy timeline + 4 new sequence increment-4)
- **All existing goldens byte-identical** (default theme unchanged)
- **New goldens:** 4 sequence ByteByteGo renders (rest-auth + agent-loop SVG/PNG)

---

## Archived Detail

Pre-2026-06-13 Sequence Increment-1/2/3 detailed learnings archived to `barbara/history-archive.md` (25,000+ bytes).

---

## Next: Tree Grammar Rendering Design

**Awaiting:** Mark's TreeNode schema + validation rules (2026-06-13 spec complete, schema design pending).

**Design scope:**
1. TreeTheme token surface (30–50 tokens, grouped by concern)
2. Node shape rendering (kind → default shapes + theme overrides)
3. Edge routing geometry (elbow radius calc, straight-line simplification)
4. Orientation support (default top-down; theme option for left-to-right)

**Target:** Tree Increment-1 implementation follows Sequence template (deterministic layout + theme-driven rendering).

---

## Learnings — 2026-06-13 Tree Grammar (Grammar #4)

### Module Structure Created

New grammar module: `packages/core/src/grammars/tree/`

| File | Purpose |
|------|---------|
| `types.ts` | Tree domain IR: `TreeDocument`, `TreeMetadata`, `TreeDefinition`, `TreeNode` (recursive children-list) |
| `schema.ts` | Zod schema — validates id uniqueness (recursive collectIds), non-empty labels, kebab-case ids |
| `layout.ts` | `layoutTree(doc, theme?)` — Buchheim–Jünger–Leipert tidy-tree (O(n), deterministic) |
| `theme.ts` | `TreeTheme` token surface + `defaultTreeTheme` + `TREE_THEME_REGISTRY` |
| `index.ts` | Public API: `buildTreeScene`, `renderTreeDocument`, re-exports types/schema/theme |

### Tidy-Tree Algorithm (Buchheim–Jünger–Leipert 2002)

Implemented the BJ+L algorithm in three phases:

1. **firstWalk (bottom-up)**: assigns `prelim` (preliminary x) and `mod` (modifier) to each node. Leaf nodes receive preliminary positions from their left sibling + separation. Internal nodes run `apportion()` to resolve overlapping subtrees via thread contour walking, then center above their children by setting `mod = prelim - midpoint`. `executeShifts` propagates accumulated shift/change values.

2. **secondWalk (top-down)**: computes final `x = prelim + m` (accumulating `mod` from ancestors) and `y = depth × (nodeH + levelGap)`.

3. **Normalize + emit**: shift all x by `(marginLeft - minX)` so the leftmost node starts at the canvas margin. Canvas dimensions = maxX + marginRight × maxY + marginBottom.

Key BJ+L data structures: `prelim`, `mod`, `shift`, `change`, `thread`, `ancestor`. The thread pointer enables O(n) contour walking without re-visiting inner nodes.

### TreeTheme Token Surface

| Group | Tokens |
|-------|--------|
| Canvas | `background`, `fontFamily` |
| Layout | `orientation` (`top-down`\|`left-right`), `marginLeft/Right/Top/Bottom` |
| Geometry | `nodePadX/Y`, `minNodeWidth`, `levelGap`, `siblingGap`, `subtreeGap` |
| Node visual | `nodeFill/Stroke/StrokeWidth/Rx/TextColor` |
| Kind overrides | `kindFills`, `kindTextColors` (per-kind color maps) |
| Typography | `nodeFontSize/Weight` |
| Edges | `edgeStyle` (`elbow`\|`straight`\|`curved`), `edgeStroke/StrokeWidth`, `elbowMidFraction` |
| Icons | `showIcons`, `iconSize`, `iconLabelGap` |
| Collapsed indicator | `showCollapsedIndicator`, `collapsedIndicatorRadius/Fill/TextColor` |

### defaultTreeTheme

Clean light-background org-chart:
- White canvas (`#ffffff`), elbow edges, rounded nodes (rx=6)
- Root kind → `#3949ab` (dark indigo) with white text
- Chapter kind → `#5c6bc0` (medium indigo) with white text
- Section kind → `#c5cae9` (light lavender) with dark text
- Edge color: `#9fa8da` (soft indigo)

### Determinism

All coordinate arithmetic uses `rhuInt(v) = Math.floor(v + 0.5)` (round-half-up integer). The BJ+L algorithm is a pure function over the tree structure and sibling order — no randomness, no iteration count. **630/630 tests pass; all 611 existing goldens byte-identical.**

### Gallery Example

`examples/gallery/tree-document.tree.yaml` → 10-node document hierarchy (root + 3 chapters + 6 sections). `tree-document.svg` (4 KB) and `tree-document.png` (18 KB) generated and verified:
- Root "Document" centered at top
- Chapter nodes balanced below root
- Section nodes spread under their chapters
- No overlapping bounding boxes (tested)
- Non-overlap assertion: `a.x + a.width <= b.x || ...` passes for all pairs

### Kernel Reuse

No new Scene IR primitives needed. Tree lowers to: `RectPrimitive` (node box), `TextPrimitive` (label), `PathPrimitive` (edge — elbow/straight/curved), `CirclePrimitive` + `TextPrimitive` (collapsed indicator). Serializers unchanged.
