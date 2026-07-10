# Barbara — Semantics & Rendering (Summarized)

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-07-10 (summarized by Scribe from 30105 → 8900 bytes)

---

## Archive Notice

Full detailed work (2026-06-15–2026-06-27) moved to `history-archive.md` and predecessor archive files. This summary captures durable learnings and recent completions.

---

## Major Phases Completed

### Phase 1 — Flowchart Full Sugiyama Upgrade (Complete, PR #28)

Implemented Sugiyama phases 3 & 4 in `src/diagrams/flowchart/layout.ts`:
- **Phase 3 (minimizeCrossings):** Barycentric bi-directional sweeps (MAX_PASSES=4) with insertion-order tie-breaking.
- **Phase 4 (assignCoordinatesBK):** Two-pass simplified B–K alignment (top-down + bottom-up), averaging for non-overlapping placement.
- **Gate:** 387/387 tests pass.

**Key gotchas:** findBackEdges() moved earlier to reuse DFS by crossing-min, B–K, and edge router. Averaging eliminates forward-backward pass correction loop. Phase 2: same logic lifted to `src/graph/layered.ts` for all 7 callers (class/state/er/c4/architecture/requirement/ds-nodegraph).

### Phase 2 — Lift Sugiyama into Kernel (Complete, PR #24)

All 7 diagram families now inherit crossing minimization + B–K via `src/graph/layered.ts`. Key changes:
- **Node dimensions:** Support variable `width`/`height` (not fixed NODE_W/NODE_H).
- **Positioning:** Nodes placed by cross-axis **centre** (not left edge).
- **Per-node:** `byLayer` changed from `GraphNode[][]` to `Map<number, GraphNode[]>`.
- **Gate:** All tests pass, zero caller changes.

### Phase 2 Bug Fixes (Complete)

**Bug 1 (Composite boundary):** Iterate non-member boxes; clamp rect if y-range overlaps and x-range intersects. Padding reduced 22→16px. Edge labels for cross-boundary transitions only.

**Bug 2 (Edges cutting through nodes):** Added `routeEdge(fromBox, toBox, allBoxes, yOff)` in `src/graph/layered.ts`. Infers port directions, builds obstacle list, delegates to `orthogonalRouter`. All graph families (class/state/er/c4/requirement) use `routeEdge`; architecture uses orthogonal directly with explicit L/R/T/B ports.

**Durable gotchas:** Composite `containerRect` is in WORLD coords (with yOff); `laid.boxes` is LAYOUT coords (no yOff). routeEdge must apply yOff to shift obstacles for borderPoint computation. Raw router path used directly; labels still use `rhuInt()`.

### Class Diagram Visual Fixes (Complete)

Fixed four issues on `examples/class/class.svg`:

1. **Straight edges:** Added `straightLineObstacleFree(p1, p2, obstacles, padding)` (Liang–Barsky clipping). Direct segment checked before routing.

2. **B–K snap:** Added `snapAlignedPairs` after B–K assignment. Snaps upper node to match lower if cross-axis centres differ by < nodeGap (no sibling overlap).

3. **Port fan-out:** Precomputed `toPortMap` before relations loop. Each edge gets t-value `(idx+1)/(n+1)` distributed across arrival wall via `wallPoint(box, wall, t, yOff)`.

4. **Visibility:** End markers use same attachment points; `safePath` fallback ensures no silent edge disappearance.

**Result:** Clean straight diagonals (Customer→Order), x-aligned verticals (payments), visibly fanned ports (Order top), full visibility of all labels.

### VS Code Extension Marketplace Icon (Complete, 2026-07-09)

Created `extension/resources/icon.svg` (256×256) and rasterized to PNG via rsvg-convert.

**Design:** Stylized trident with three tines terminating in graph nodes (circles + curved edges). Navy→purple gradient background (#0D1B2A → #1a1040), cyan→teal nodes and prongs (#67E8F9 → #14B8A6), white glow cores.

**Key learnings:**
- VS Code Marketplace requires PNG (min 128×128, 256×256 ideal), not SVG.
- Gradients on SVG strokes don't render in rsvg-convert — use filled `<rect>` with `rx` or filled `<path>` instead.
- Always provide solid/gradient background (not transparent) for light/dark theme compatibility.
- Test small-size legibility (32×32 favicon) — if unreadable there, won't work in VS Code sidebar.
- Avoid symmetric gestalt (two nodes read as "eyes") — adjust composition and high-contrast colors.

**Revision (2026-07-09):** Fixed "sad face" problem by increasing brightness (cyan→teal), using filled shapes with gradients, straightening crossbar, and subordinating node size.

---

## Durable Cross-Codebase Facts

- **VS Code Extension render path:** Uses `render(input, themeInput?, rendererName?)` from `src/frontend/index.ts` as SOLE render path, esbuild-bundles compiler from `src/`. Any change to signature, SVG contract, or `src/frontend/detect.ts` MERMAID_PATTERNS is a downstream dependency — keep stable or update `extension/src/extension.ts` in same PR.

- **Graph layout kernel stability:** `src/graph/layered.ts` is now the authoritative Sugiyama implementation — all 7 families inherit, zero caller customization needed.

- **Real paths always `src/`:** Never `packages/core/` or `@diagram-compiler/*`. Diagram IR defined in respective family `ir.ts` files (e.g., PosterDocument in poster/ir.ts).

---

## Archived Detail

Full 2026-06-15–2026-06-27 detail, including:
- A* pathfinding & aesthetic metrics (poster routing)
- Poster configurable `routingStyle: 'orthogonal'|'straight'`
- Greedy-switch crossing minimization
- Wall-centered port assignment
- Earlier June code realignment (Single-backend Scene contract, no Skia/PPTX/PDF/HTML)
- Design-doc realignment Waves 1–4 (02-central-thesis, 03-principles, 60-roadmap, 06-status, 19-render-contract, 23-diagram-contract, 31-structures-family)
- LaTeX integration (pdfkit + svg-to-pdfkit, Phase 2 PR #24)
- Inline Triton in .tex via fancyverb + pdftexcmds + shell-escape
- Design dogfood (all PNG → inline triton blocks)
- Core fix: flowchart cycles (DFS back-edge detection, PR #28)
- Back-edge visual routing (self-loops + back-edge cubic bends)
- DS family regroup & phases A/B1/B2 (stack, hashmap, matrix, trie, nodegraph, unionfind)
- DS gallery poster (9 DS kinds in 4×3 grid with rowSpan support)
- C4 connector routing analysis

See `history-archive.md`, `history-2026-06-17-archived.md`, `history-2026-06-16-summarized.md`, `history-2026-06-15-summarized.md`, `history-2026-06-14-archived.md` for the complete record.

