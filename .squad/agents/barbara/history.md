# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-13T16:09:42-04:00

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

---

## Learnings — 2026-06-13T16:09:42-04:00 Panel-Balance Polish + Poster Gallery Card

### cellVAlign / cellHAlign alignment tokens

Added `cellVAlign: 'top' | 'center' | 'fill'` and `cellHAlign: 'left' | 'center'` to `CompositionTheme` in `composition/theme.ts`. Defaults set to `cellVAlign: 'top'` and `cellHAlign: 'center'`.

Design rationale:
- `'top'` anchors the sub-scene at the top of the embed area; excess vertical space accumulates at the bottom. This is the right default for mixed-height grids (e.g., the wide/short Flow pipeline and the tall Tree taxonomy sharing a row — the pipeline no longer floats in the vertical midpoint of the tall row).
- `'center'` preserves the original centering behavior (available but not default).
- `'fill'` reserved synonym for `'center'` (future stretch mode).
- `cellHAlign: 'center'` keeps the horizontal centering for wide-short scenes — most diagrams look best centered horizontally.

### Layout engine change (`composition/layout.ts`)

The `embedSceneInRect` helper always centered both axes. For top-alignment, the embed placement is computed inline in `layoutComposition` rather than via `embedSceneInRect`, using `translateAndScale` directly with `alignDy = embedY` for `'top'`. The `embedSceneInRect` export in `scene-transform.ts` is unchanged (still centers) — the A15 test verifies this and passes byte-identical.

Key constraint respected: `translateAndScale` (and thus `embedSceneInRect`) is called only from the composition layer; all other grammar outputs route through their own layout engines and are unaffected. Confirmed: only `poster-rag-architecture.svg` and `.png` changed in `git diff`.

### Determinism maintained

Scale factor computation is identical (`min(scaleW, scaleH, 1.0)`). Only the vertical offset changes (`embedY` vs `embedY + (embedH - scaledH) / 2`). All arithmetic is pure; no randomness. `sceneHash` produces a new-but-stable value for the updated poster.

### Gallery card — Example 20

Added `poster-rag-architecture` as card 20 in `examples/gallery/index.html`:
- Follows exact card structure: `card-num`, `card-title`, `card-desc`, `card-img` (PNG), `card-footer` (SVG + `.composition.yaml`).
- Describes the Composition layer: multi-panel poster assembling Flow, Tree, Sequence, and Stat grammars.
- Header blurb updated to mention the Composition Layer; badge updated to `Phase 1–5 Gallery · Horizontal + Sequence + Flow + Tree + Composition`.
- All three referenced files (`poster-rag-architecture.png`, `.svg`, `.composition.yaml`) verified present.

### Test results

694/694 tests pass (all 25 prior composition/scene-transform tests byte-identical except the re-emitted poster files). No non-poster golden changed.

---

## 2026-06-13 — Grammar Deferrals Resolved: Sequence Alt Multi-Compartments + Flow Crossing-Min (commit a5b324f)

**Date:** 2026-06-13T20:21:20Z  
**Status:** SHIPPED  
**Test Results:** 706/706 tests pass; non-affected goldens byte-identical; flow-rag-pipeline re-emitted

### Sequence `alt` Multi-Guard Sub-Compartments (Rendering Extension)

**Problem:** Previous `alt` fragments could not represent multi-section logic (e.g., HTTP response: success branch / 404 branch / else). Only a single guard label was supported.

**Solution:** Fragment IR gains optional `sections?: FragmentSection[]` field. When ≥ 2 sections:
- Outer rectangle still spans `from_order → to_order` (unchanged)
- Dashed dividers emitted at section boundaries (new `LinePrimitive` per divider)
- Section guard labels rendered below each divider (new `TextPrimitive` per section)
- Theme token `fragDividerDash: string` (default '6,4') controls dash pattern

**Backward Compat:** Fragments without `sections` or with <2 entries render identically to pre-feature. All 537 prior sequence tests pass byte-identical.

**Gallery:** Added `sequence-alt-multicompartment.sequence.yaml` — HTTP response with 3-section alt (success / 404 / else).

**Files Changed:**
- `packages/core/src/grammars/sequence/types.ts` — `FragmentSection` interface, `Fragment.sections?` field
- `packages/core/src/grammars/sequence/schema.ts` — `fragmentSectionSchema`, updated `fragmentSchema`
- `packages/core/src/grammars/sequence/layout.ts` — `renderFragments` refactored to emit dividers + section labels
- `packages/core/src/grammars/sequence/theme.ts` — `fragDividerDash` token added to `SequenceTheme`
- `examples/gallery/sequence-alt-multicompartment.sequence.yaml` — NEW fixture
- `examples/gallery/sequence-alt-multicompartment.{svg,png}` — NEW outputs

### Flow Crossing-Minimization: Deterministic Barycenter Heuristic

**Problem:** Flow layout layer assignment (Sugiyama Phase 1) produced non-deterministic node orderings within layers due to floating-point comparisons and tie-breaking by insertion order.

**Solution:** Deterministic crossing-minimization via barycenter heuristic (classical algorithm from Sugiyama 1993):
- 4 alternating sweeps (forward/backward)
- Sweep 0, 2 (forward): sort each layer by mean x-position of predecessors in previous layer
- Sweep 1, 3 (backward): sort by mean x-position of successors in next layer
- Lexicographic tie-breaking: compare node ids (fully deterministic)
- Nodes with no neighbors in reference layer retain position

**Code Location:** `packages/core/src/grammars/flow/layout.ts`, Phase 3.5, new functions `computeBarycenter()` and `minimizeCrossings()`

**Effect on flow-rag-pipeline:** Layer 2 reorders from `(rank, direct)` to `(direct, rank)` (lexicographic tie-break favors 'd' < 'r'). SVG/PNG outputs updated.

**Determinism:** Same input → byte-identical output (verified by "same hash twice" test). `CROSSING_MIN_SWEEPS = 4` is a constant; no RNG.

**Files Changed:**
- `packages/core/src/grammars/flow/layout.ts` — Phase 3.5 crossing-minimization integration, `computeBarycenter()`, `minimizeCrossings()`
- Flow layer assignment tests updated to verify determinism
- Gallery flow-rag-pipeline outputs re-emitted with new node order

**Test Results:** All 33 flow tests pass. Non-flow/non-sequence goldens (timeline, tree, composition) byte-identical.

### Test Coverage Update

- Baseline: 694 tests (prior composition milestone)
- New: 12 tests (sequence alt multi-compartment validation, flow crossing-min determinism check)
- **Final:** 706/706 pass

---

## Concurrent Passes (2026-06-13T16:35–16:36Z) — Animation + Dark Themes

**Note:** Both agents routed decisions to inbox to avoid write race on history.md. Scribe merged both passes and consolidated into decisions.md. This section summarizes cross-agent context.

### Pass A: Animation (Dashflow SMIL)

**Status:** SHIPPED (10 new tests)

Scene IR gained optional `animation?: DashflowAnimation` field on Path and Line primitives. When both `animation` and `dashArray` are present, SVG serializer emits SMIL `<animate>` with:
- `attributeName="stroke-dashoffset"`
- `from="{dashPeriod}"` (computed from dashArray CSS string)
- `to="0"` (resting position)
- `dur="{animationDurSec}s"` (controlled by FlowTheme token, default 1.2s)
- `repeatCount="indefinite"`

Additive design: animation field undefined by default. Canonical JSON omits undefined → existing hashes unchanged.

**Raster guarantee:** resvg ignores SMIL; `stroke-dashoffset="0"` is SVG default → PNG renders byte-identically to pre-animation resting frame.

**Flow integration:** Animated forward edges (via `edge.animated === true`) receive `animHint` in layout phase. Back-edges (structural feedback) do not animate.

**Gallery:** `flow-rag-pipeline.svg` gains 2 `<animate>` elements (augment→llm, llm→answer); PNG unchanged.

**Files:** scene.ts (Scene IR), render/svg.ts (SMIL emission), grammars/flow/theme.ts (animationDurSec token), grammars/flow/layout.ts (edge attachment), flow.test.ts (10 tests).

### Pass B: Dark Theme Set + Row-Sizing

**Status:** SHIPPED (9 new tests: 3 rowSizing + 6 dark poster)

**rowSizing token:** New `CompositionTheme` field `rowSizing: 'content' | 'equal'`. Default 'content' (per-row heights computed from each row's tallest cell — eliminates dead space in mixed-height grids). Mode 'equal' normalizes all rows to global max height (uniform panels). Layout engine: pure arithmetic after min-height floor.

**darkFlowTheme** ('dark-flow'): Navy background #111827; node fill #1e293b, stroke teal #2dd4bf; kind-specific fills (stadium→#0d9488, rounded-rect→#1e40af, diamond→#7c3aed, circle→#064e3b); animated edge stroke #38bdf8 (sky-400 for dark contrast); node text #f1f5f9.

**darkCompositionTheme** ('dark-poster'): GitHub dark canvas #0d1117; cell bg #161b22 (vs #1e293b); cell border #30363d; title color #58a6ff (blue accent), stat value #2dd4bf (teal); tighter gap 16px (vs 20), padding 24px (vs 28); border radius 12px (softer).

**Per-cell themes:** Grammar cells (flow/tree/sequence) honor `doc.metadata.theme` independently. Stat/text/title cells use composition theme surface tokens (dark-poster provides dark colors). No new plumbing — existing grammar-as-semantics / theme-as-style split handles it.

**Gallery:** New `poster-rag-architecture-dark.composition.yaml` (2×2 grid with dark themes: dark-flow, dark-tree, bytebytego-sequence, stat). Output 1200×1144 px SVG/PNG. Light poster unchanged.

**Tests (9 new):** composition.test.ts Suite C (rowSizing: 3 tests, content vs equal, hash differences), Suite D (dark poster: 6 tests, determinism, SVG/PNG emit).

**Files:** composition/theme.ts (rowSizing, darkCompositionTheme), composition/layout.ts (equal-mode normalization), composition/index.ts (export), grammars/flow/theme.ts (darkFlowTheme), grammars/flow/index.ts (export), composition.test.ts (9 tests), gallery dark poster (3 new files).

### Combined Metrics

- **Baseline:** 706 tests (prior milestone)
- **Animation:** +10 (flow animation determinism, SVG structure, PNG validity)
- **Dark Themes:** +9 (3 rowSizing + 6 dark poster)
- **Final:** 725/725 deterministic tests pass
- **Determinism:** Fixed geometry, rounding (rhu 2dp), lexicographic tie-breaking; no RNG
- **Byte-Safety:** All 706 prior goldens byte-identical except flow-rag-pipeline SVG (gains animation markers); PNG byte-stable (raster ignores SMIL)

---
