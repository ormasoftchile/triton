# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-13T15:53:53Z

---

## Current Role

Render domain IRs to Scene IR primitives with deterministic, themeable output. Implement visualization grammars following grammar ≡ semantics / theme ≡ style principle.

---

## Key Learnings (Summarized)

- **Two-IR-Layer Model:** Domain IR → Scene IR (universal kernel). All styling in theme tokens.
- **Deterministic Rendering:** `measureText()`, `rhuInt()` rounding, fixed geometry — reproducible across platforms.
- **Theme-Driven Architecture:** Grammar IR independent of rendering; external style mimicry (e.g., ByteByteGo infographic) without IR changes.
- **Grammar governance pattern:** Spec semantics → define domain IR (no styling) → implement theme-driven layout → create GrammarTheme type + registry.

For detailed implementation notes from Sequence/Tree/Flow grammars (June 10–13), see `barbara/history-archive.md`.

---

## Current Status (2026-06-13)

### ✅ Shipped Grammars

| Grammar | Module | Tests | Theme(s) | Status |
|---------|--------|-------|----------|--------|
| **Timeline** | packages/core/src/grammars/timeline/ | 551+ | 5 | SHIPPED |
| **Sequence** | packages/core/src/grammars/sequence/ | 611+ | 2 | SHIPPED (Inc-4) |
| **Tree** | packages/core/src/grammars/tree/ | 630+ | 1 | SHIPPED (Inc-1) |
| **Flow** | packages/core/src/grammars/flow/ | 663 | 1 | SHIPPED (Inc-1) — Commit: 48d3673 |

**Total test pass rate:** 663/663 (all prior goldens byte-identical)

**Kernel extensions:** PathPrimitive.dashArray? added (backward-compatible, only used by Flow)

---

## Active Work — Composition Layer ✅ SHIPPED

The kernel helper (`scene-transform.ts`) and composition module (`composition/`) are implemented and passing all tests. See Learnings section below for details.

---

## Deferred Items

- Flow Inc-2: Crossing minimization (barycenter sweeps), CSS animation, TB orientation, diamond shape
- Tree Inc-2: Forest support, shape variation per kind, depth/width lint warnings
- Composition Inc-2+: Scale policy modes (clip, overflow), advanced URI schemes

---

## Archive

For detailed notes from earlier sessions (Sequence Inc-1/2/3, Tree implementation learnings), see `barbara/history-archive.md`.

---

## Learnings — 2026-06-13T11:56Z Second Tree Theme + Gallery (All 4 Grammars)

### treeDarkTheme — dark-tree

Added `treeDarkTheme` to `packages/core/src/grammars/tree/theme.ts` and registered it as `'dark-tree'` in `TREE_THEME_REGISTRY`. Exported from `grammars/tree/index.ts`.

Design choices:
- Background `#111827` (dark navy, matches ByteByteGo sequence dark canvas)
- Root kind `#0d9488` (teal-600), chapter `#0f766e` (teal-700), section `#134e4a` (teal-900)
- Edge style `straight` (vs `elbow` in default) — visually distinct, teal `#2dd4bf`
- Node corner radius rx=8 (vs rx=6 in default) — slightly softer
- Resulting canvas: 923×294 px, 9 straight `<line>` edges, all nodes non-overlapping

### Gallery — 4 grammars now represented

`examples/gallery/index.html` updated:
- Header blurb updated to name all four grammar families
- Badge updated: `Phase 1–4 Gallery · Horizontal + Sequence + Flow + Tree`
- Card 17: `flow-rag-pipeline` (Flow Grammar — layered L→R RAG pipeline)
- Card 18: `tree-document` (Tree Grammar — default light theme)  
- Card 19: `tree-document-dark` (same IR, dark-tree theme — grammar/theme split demo)
- Cards 18+19 mimic the sequence 13/14 pair pattern: same IR shown in two themes side-by-side

### Determinism & Byte-Identical Defaults

- `tree-document.svg` and `tree-document.png` unchanged (git diff = 0 bytes changed)
- `flow-rag-pipeline.svg` and `.png` unchanged
- All 663 previous goldens byte-identical; 669/669 total tests pass (+6 new dark-theme tests)

### Test Structure (tree.test.ts additions)

Sections 7–9 added:
- Section 7: Dark theme determinism — hash stability, hash differs from default, background token
- Section 8: Dark theme SVG emit → `tree-document-dark.svg`
- Section 9: Dark theme PNG emit → `tree-document-dark.png`

---

## Learnings — 2026-06-13T12:03Z Composition Layer (Increment 1)

### translateAndScale kernel helper (`packages/core/src/scene-transform.ts`)

Implemented as a pure function over `ScenePrimitive`. Key design decisions:

- **Rounding**: `rhu(v) = Math.floor(v * 100 + 0.5) / 100` (2dp, round-half-up) — matches the layout engine convention; used on every output coordinate.
- **Path d-string handling**: Tokenises the SVG path string with a regex `([MmLlHhVvCcSsQqTtAaZz])(...)`, extracts numbers with `/-?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g`, and transforms per-command:
  - Absolute commands (M,L,T,H,V,C,S,Q,A): coordinates get `x*scale+dx`, `y*scale+dy`.
  - Relative commands (m,l,t,h,v,c,s,q,a): deltas get `delta*scale` only (no translation — they are offsets from the current point).
  - A/a arc: `rx`, `ry` scale only (no translation); `x-rotation`, `flags` unchanged; endpoint gets the full absolute/relative rule.
  - Z/z: passed through unchanged.
- **StrokeGradient x1,y1,x2,y2**: treated as absolute scene coordinates — full `v*scale+d` transform.
- **dashArray**: split on `[\s,]+`, scale each number, rejoin with commas.
- **GroupPrimitive**: recursively calls `translateAndScale` on every child — the composition is transparent to nesting depth.
- **`embedSceneInRect`**: computes uniform scale = `min(W/w, H/h, 1.0)` (never upscales), centers the scaled sub-scene within the target rect, then maps every primitive.

### Composition module (`packages/core/src/composition/`)

Follows the grammar module pattern (types/schema/layout/theme/index):

- **types.ts**: `CompositionDocument { metadata, grid, cells }`. `Cell { id, col, row, colSpan, rowSpan, title, content }`. `CellContent` discriminated union on `kind`: `flow|tree|sequence|stat|text|title` — each grammar kind carries an inline `doc`.
- **schema.ts**: Zod validates version, grid.columns ≥ 1, unique cell ids, no overlapping slots, `col+colSpan ≤ columns`. Grammar sub-docs validated via their own Zod schemas (`flowDocumentSchema` / `treeDocumentSchema` / `sequenceDocumentSchema`).
- **theme.ts**: `CompositionTheme` — `canvasBackground`, `gap`, `padding`, `cellBackground`, `cellBorder {color,width,radius}`, `cellPadding`, `cellTitleHeight`, `posterTitleFont`, `statValueFont`, `statLabelFont` etc. Default: dark-poster style (`#0f172a` canvas, `#1e293b` cell bg, `#334155` border).
- **layout.ts**: deterministic grid engine — content-driven column widths (max single-span cell width per col), proportional scale if total exceeds available width. Row heights likewise. `embedSceneInRect` handles sub-scene fit+center. Chrome: background rect, optional title-bar rect + text per cell, poster header.
- **index.ts**: `buildCompositionScene` + `renderCompositionDocument` (svg/png/skia) — reuses kernel serialisers unchanged.

### Grid embed contract

1. Each grammar cell: compile via `buildFlowScene` / `buildTreeScene` / `buildSequenceScene` → sub-Scene.
2. Cell rect computed from cumulative col widths + row heights + gaps.
3. `embedSceneInRect(subScene, {x, y, W, H})` → transformed primitives (scale-to-fit, centered).
4. Chrome (cell background, border, title bar) rendered as Rect/Text primitives.
5. All primitives merged into one Scene — deterministic via `sceneHash`.

### Gallery output

`examples/gallery/poster-rag-architecture.composition.yaml` — 2×2 grid with:
- [0,0] Flow: RAG pipeline (7 nodes, 6 edges)
- [0,1] Tree: knowledge base taxonomy (3 chapters, 6 sections)
- [1,0] Sequence: retrieval request/response (4 participants, 6 messages)
- [1,1] Stat: "98.7%" / "retrieval accuracy on BEIR benchmark"

Output: `poster-rag-architecture.svg` (15 KB, 1200×1062 px) + `poster-rag-architecture.png` (67 KB).
Poster title "RAG Architecture Deep Dive" at top; each panel has a title bar; nothing overflows its cell.

### Test counts

- 669 prior goldens: **byte-identical** (scene-transform used only by composition layer)
- +25 new composition/scene-transform tests
- **694/694** total tests pass
