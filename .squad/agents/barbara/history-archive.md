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

---

## Learnings — 2026-06-13 Flow Grammar (Grammar #2 / Increment-1)

### Module Structure Created

New grammar module: `packages/core/src/grammars/flow/`

| File | Purpose |
|------|---------|
| `types.ts` | Flow domain IR: `FlowDocument`, `FlowMetadata`, `FlowNode` (id/label/kind/icon/status), `FlowEdge` (from/to/label/kind/animated/style) |
| `schema.ts` | Zod schema — unique node ids, edge from/to resolve to declared node ids, kebab-case ids |
| `layout.ts` | `layoutFlow(doc, theme?)` — deterministic layered layout (inc-1 scope) |
| `theme.ts` | `FlowTheme` token surface + `defaultFlowTheme` + `FLOW_THEME_REGISTRY` + `resolveFlowTheme` |
| `index.ts` | Public API: `buildFlowScene`, `renderFlowDocument`, re-exports types/schema/theme |

### Layered Layout Algorithm (Increment-1)

Four-phase pipeline:

1. **Cycle detection (DFS gray-path coloring)**: Iterative DFS (avoids stack overflow) marks edges as back-edges when target is GRAY (on current path). Self-loops are always marked. Back-edges are extracted and rendered separately.

2. **Rank assignment (longest-path from sources)**: Iterative DFS post-order topological sort over the residual DAG (back-edges removed). Rank propagation: `rank[v] = max(rank[u]+1)` for each predecessor u in topological order. Source nodes (in-degree 0) stay at rank 0. Declaration order is tie-breaking everywhere → determinism guaranteed.

3. **Layer organization**: Nodes grouped by rank, sorted by declaration order within each rank. No crossing minimization (increment-2 deferred).

4. **Coordinate assignment**: Uniform column width = global max node width. Column center x = `marginLeft + rank * (colW + layerGap)`. Nodes centered vertically within each column relative to the tallest column: `startY[r] = marginTop + (contentH - colH[r]) / 2`. All arithmetic via `rhuInt()`.

### FlowTheme Token Surface

| Group | Tokens |
|-------|--------|
| Canvas | `background`, `fontFamily` |
| Layout | `orientation` (`LR`\|`TB`), `marginLeft/Right/Top/Bottom` |
| Geometry | `nodePadX/Y`, `minNodeWidth`, `layerGap`, `nodeGap` |
| Node visual | `nodeFill/Stroke/StrokeWidth/Rx/TextColor` |
| Kind overrides | `kindFills`, `kindTextColors` |
| Status overrides | `statusFills`, `statusTextColors` (6 states: default/active/success/warning/error/muted) |
| Typography | `nodeFontSize/Weight`, `edgeLabelFontSize/Weight/Color` |
| Edge routing | `edgeStyle` (`curved`\|`elbow`\|`straight`), `edgeStroke/Width`, `edgeDash`, `edgeDotted`, `animatedEdgeDash/Stroke` |
| Arrowhead | `arrowSize`, `arrowFill` |
| Back-edges | `backEdgeCurvature`, `backEdgeStroke`, `backEdgeDash` |
| Icons | `showIcons`, `iconSize`, `iconLabelGap` |

### defaultFlowTheme

Clean light-background pipeline style:
- White canvas, curved Bézier edges, rounded-rect nodes (rx=8), LR orientation
- Blue palette: node fill `#e8f0fe`, stroke `#4a6cf7`
- Status fills: success `#d1fae5` (green), error `#fee2e2` (red), warning `#fef3c7` (amber)
- Animated edges: blue `#4a6cf7` with `8,5` dash pattern (resting frame in PNG)
- Back-edges: grey `#94a3b8` with `5,4` dash

### Cycle Handling

Cycles do not crash the layout:
- Back-edges are detected before ranking and skipped during rank assignment
- Back-edges render as cubic Bézier arcs below the main flow (bottom ports)
- Self-loops render as small right-side loops off the source node
- The layout is still deterministic with cycles: identical cyclic IR → identical scene hash (verified by test)

### Kernel Extension: PathPrimitive.dashArray

Added `dashArray?: string` to `PathPrimitive` in `scene.ts` and `'stroke-dasharray'` emission in `render/svg.ts`. This is backward-compatible (undefined fields omitted from canonicalJSON, no existing golden affected). All 630 previous tests remained byte-identical.

### Gallery Example

`examples/gallery/flow-rag-pipeline.flow.yaml` → 7-node RAG pipeline with branch:
- Layers: question (0) → retrieve (1) → [rank, direct] (2) → augment (3) → llm (4) → answer (5)
- `flow-rag-pipeline.svg` (4 KB) and `flow-rag-pipeline.png` (19 KB, 1356×208 px) verified:
  - Clean L→R pipeline, stadium shapes on terminals, green success fills, dashed animated edges
  - Branch at column 2 (Re-rank + Direct Match stacked, vertically centered)
  - No overlapping node boxes (tested)

### Kernel Reuse

No new Scene IR primitive *types* needed. Flow lowers to: `RectPrimitive` (rounded-rect/stadium/rect nodes), `CirclePrimitive` (circle nodes), `TextPrimitive` (labels, edge labels), `PathPrimitive` (edges, arrowheads, icons). Only added `dashArray?` field to existing `PathPrimitive`.

### Test Coverage

663/663 tests pass (630 previous + 33 new flow tests).
All 630 previous goldens byte-identical.
New flow tests: schema validation (12), scene structure (10), determinism (4), cycle handling (4), non-overlap (1), gallery SVG (1), gallery PNG (1).

### Deferred to Increment-2+

- Crossing minimization (barycenter sweeps — no crossing reduction in inc-1)
- CSS/SMIL animation for `animated: true` edges (SVG `stroke-dashoffset`)
- `TB` orientation (top-to-bottom layout)
- `diamond` shape node
- Group/lane containers
- Multi-edge offset (parallel edges between same pair)

---

## 2026-06-13 — Flow Grammar Shipped + Composition Kernel Helper Flagged (Scribe)

**Date:** 2026-06-13T15:53:53Z  
**Status:** Flow delivered; kernel helper flagged as critical path for composition inc-1

### Flow Grammar Delivery Summary

- **Module:** packages/core/src/grammars/flow/ complete (types, schema, theme, layout, index)
- **Layout:** Sugiyama LR, deterministic, cycle-safe (back-edges routed via bottom-port Bézier arcs)
- **Kernel extension:** Added PathPrimitive.dashArray? (backward-compatible, all 630 prior tests byte-identical)
- **Tests:** 663/663 pass (630 prior + 33 new flow tests)
- **Gallery:** flow-rag-pipeline (7-node, clean branches, SVG+PNG verified)

### Composition Layer Blocking Point

Leslie's composition spec is complete and specifies a critical kernel helper for Barbara:

**Function needed:** `translateAndScale(p: ScenePrimitive, dx: number, dy: number, scale: number) → ScenePrimitive`

**Scope:** Transform all primitive kinds (Line, Rect, Circle, Text, MultiText, Path, Group, Image), including:
- Path d-string coordinate transformation
- StrokeGradient coordinate transformation  
- Recursive GroupPrimitive descent
- Rounding via rhu(2dp) for determinism

**Proposed location:** packages/core/src/scene-transform.ts

**Urgency:** Critical path for composition inc-1. Once implemented (2–3 hours), Mark's schema + Barbara's helper = go signal for composition rendering.

### Open Questions for Mark (Schema)

Composition layer ready for schema finalization:
- CompositionDocument JSON Schema (discriminated union for CellContent)
- ir_file URI schemes (pkg:, file:, http:)
- Two-pass validation strategy (composition → sub-grammar)

Mark intake expected next turn.

---

