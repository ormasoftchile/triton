# Brian — History

## 2026-07-10 — Phase 2: Visual Consistency Fixes (Theming)

**Status:** COMPLETE  
**Outcome:** Two visual fixes shipped; Phase 2 primitives dropped  
**Branch:** `ormasoftchile/poster-phase2`  
**Commit:** 7bf9ad0  
**Tests:** 499/499 ✓

---

## Work Summary

### Scope: Primitives Implementation (DROPPED per Cristian)

Initially implemented two new `ds` subkind primitives to unblock poster cards from Leslie's gap analysis:

1. **Intervals** — Overlapping interval visualization
   - Syntax: `intervals` with labeled/unlabeled intervals [start, end]
   - Features: stacked bars, merge track (union of intervals)
   - Tests: 14 (intervals.test.ts)
   - Examples: 2 (.mmd + card8)

2. **Hashring** — Consistent hashing ring
   - Syntax: `hashring` with nodes + keys
   - Features: circular ring, node placement (evenly distributed or explicit degrees), key routing via DJB2 hash
   - Tests: 17 (hashring.test.ts)
   - Examples: 2 (.mmd + card6)

**Total new:** 35 tests, 4 examples. Build clean. Tests 534/534.

**Decision:** Dropped entirely per Cristian (2026-07-10) — both primitives, their tests, examples, and all registration code removed.

---

### Scope: Visual Consistency Fixes (SHIPPED)

#### Fix 1: Tree Default Node Border

**File:** `src/diagrams/triton/ds/tree/layout.ts`  
**Problem:** Plain/default tree nodes rendered with near-black border, inconsistent with nodegraph default nodes (blue)  
**Solution:** Changed nodeStyle() fallback to use `palette.primary` (blue) for plain nodes.

**Scope:** Only plain/default nodes. Semantic kinds (RB red, RB black, active, scan, join, build/muted) unchanged.

**Tests:** `test/tree-builders.test.ts` — updated assertions for plain/AVL nodes  
**Verification:** edge-highlight.png — Binary Tree DFS nodes now have blue borders ✓

---

#### Fix 2: Arrowhead Size Uniformity

**File:** `src/diagrams/triton/ds/struct/shared.ts`  
**Problem:** Active edges had arrowheads ~1.67× larger than normal edges  
**Solution:** Changed to `markerUnits="userSpaceOnUse"` with fixed geometry.

**Impact:** Affects all diagrams using shared `ARROW_ID`: nodegraph, linkedlist, hashmap, array, page, memory

**Verification:** edge-highlight.png — uniform arrowheads regardless of stroke width ✓

---

## Final State

**Branch files:** 3 modified
- `src/diagrams/triton/ds/tree/layout.ts`
- `src/diagrams/triton/ds/struct/shared.ts`
- `test/tree-builders.test.ts`

**Build:** clean  
**Tests:** 499/499 ✓

---

## See Also

- Decision: "Phase 2: Theming Fixes Shipped (Primitives Dropped)"
- Visual QA: "Visual QA: Phase 2 Theming Fixes — PASS"
- PR #56

## AVL Badge Circle Fill Fix (2026-07-10)

**Root cause:** Badge circle fill was `palette.background`. In VS Code preview `palette.background=''` → `svg.ts` normalises to `fill="none"` → transparent badge, node body visible through it, count illegible.

**Fix:** One-line change in `src/diagrams/triton/ds/tree/layout.ts`:
```diff
- p.circle(..., 9, palette.background, bc, 1.5)
+ p.circle(..., 9, palette.surface,    bc, 1.5)
```
`palette.surface` is always solid and opaque. Nothing else changed.

**Tests:** 499/499, no test asserted old fill value.
**PNG:** `examples/triton/ds/tree/avl.png` — badge circles solid white/surface, green for 0, blue for ±1, counts clearly readable.

## Circle Tree Connector Clip Fix (2026-07-10)

**Root cause:** `connectSlots` clips to the bounding BOX border. Circle-shaped nodes are inscribed in their box; diagonal edges from box-border to circle surface leave a visible gap (~7 px at root, ~1 px deeper).

**Fix:** In the edge loop in `src/diagrams/triton/ds/tree/layout.ts`, check `style.get(id).shape`. For `'circle'`, compute the exact perimeter point using unit direction vector:
```typescript
function circleBorder(center, radius, dir, sign: 1|-1) {
  return { x: center.x + sign * radius * dir.x, y: center.y + sign * radius * dir.y };
}
```
Non-circle shapes still use `connectSlots`. Mixed trees (circle+rect) clip each end independently.

**Tests:** 499/499, no coordinate assertions broken.
**PNGs:** avl.png — root connectors flush with circle. heap.png — all edges flush at every level.
**Gotcha:** Must use `style.get(id)!.shape` (not re-call `nodeStyle`) — the style map is built before the edge loop, so it's O(1) lookup.

## 2026-07-10 — Tree Layout Fixes (PR #57)

**Status:** COMPLETE  
**Outcome:** Two visual fixes shipped in 0.1.7  
**Branch:** `ormasoftchile/refresh-ds-renders`  
**Commit:** Squash merged to main with [version:patch]  
**Tests:** 499/499 ✓

---

## Work Summary

Two targeted visual-consistency improvements to tree layout:

### Fix 1: AVL Badge Circle Solid Fill
- **Problem:** Badge circles filled with `palette.background` (empty string in preview), rendering as transparent
- **Solution:** Changed fill to `palette.surface` (solid, opaque, theme-aware)
- **File:** `src/diagrams/triton/ds/tree/layout.ts:287`
- **Impact:** Badges now show count digits clearly against node background

### Fix 2: Circle Tree Node Connector Clipping
- **Problem:** Edges to circle nodes clipped to bounding box, not circle perimeter; visible gap on diagonal edges (5–7 px)
- **Solution:** Added `circleBorder()` helper to compute exact circle perimeter intersection
- **Files:** `src/diagrams/triton/ds/tree/layout.ts` (edge-drawing loop)
- **Impact:** Edges meet circle perimeters flush across all tree variants (AVL, heap, trie, red-black)

### Supporting Changes
- Updated `test/tree-builders.test.ts` assertions for new border colour
- No visual regression in other diagram families

---

## Release Status

Version 0.1.7 published to npm (lockstep with triton-latex).

---

## Learnings — 2026-07-11 (node-ref-tooltip MVP, branch: ormasoftchile/node-ref-tooltip)

### New APIs

**`compileAndRenderSync(input, themeInput?, rendererName?, forcedThemeName?)`** — `src/frontend/index.ts`
- Same parameter list as `renderSync`; returns `Result<{ svg: string; anchors: NodeAnchorRegistry }>`
- Compiles → renders → calls `embedAnchorManifest` → returns both the enriched SVG and the raw anchors
- Use in interactive contexts (VS Code preview) where node-ref discovery is wanted

**`embedAnchorManifest(svg, anchors)`** — `src/render/svg.ts`
- Inserts `<script type="application/json" id="triton-anchors">{sorted JSON}</script>` immediately before `</svg>`
- Keys sorted with `Object.keys(anchors).sort()` for deterministic output
- Escapes `</` → `<\/` inside the JSON to prevent early tag termination
- Pure string function; has no side-effects on rendering geometry

### renderSync stays anchor-free
`renderSync` deliberately does NOT embed the manifest. All golden SVG tests use `renderSync`; any change to that function would cause golden breaks. `compileAndRenderSync` is the only render path that embeds the manifest.

### Webview tooltip mechanism
- The anchor manifest rides inside the SVG string as an inert `<script type="application/json">` data block (no CSP change needed)
- In `preview-html.ts` the inline `<script nonce=...>` adds `attachToSvg(svgEl)` per SVG element, called via `refreshAnchorListeners()` after every `content.innerHTML = msg.svg` assignment
- Alt key state is tracked globally (keydown/keyup/blur); on `mousemove` while Alt is held, a 16 ms debounce hit-tests all anchor bounds in SVG user space using `getScreenCTM().inverse()` + `createSVGPoint().matrixTransform()`
- Smallest-area hit wins (innermost node); tooltip positioned near cursor with viewport clamping
- `navigator.clipboard.writeText()` on tooltip click; brief "copied!" flash

### Extension change
`renderInto()` in `extension/src/extension.ts` now calls `compileAndRenderSync` (sync) instead of awaiting `render()`. The async wrapper `render` is retained for other callers (markdown path unchanged).


---

## Learnings — 2026-07-11 (dev-host extension-id collision fix)

### Dev Extension Host: use `--disable-extensions` (plural) to avoid same-id collision

When `extension/package.json` shares the same id (`focus-space.triton-vscode`) as an already-installed marketplace extension, F5 loads both under one id in the Extension Development Host — breaking the webview↔extension message handshake. Per-id `--disable-extension=<id>` flags cannot solve this: disabling the marketplace copy by id also disables the dev extension (same id). Disabling only competing ids (`deckpilot-triton`, `deckpilot-mermaid`) leaves the same-id marketplace copy active, causing collisions.

**Fix:** Use `--disable-extensions` (plural) in `.vscode/launch.json` args. This disables ALL installed extensions in the dev host while still loading the extension under `--extensionDevelopmentPath` (which is not treated as an "installed" extension). Only the dev build runs — no same-id collision, no competing renderers.

**Final args:**
```json
["--extensionDevelopmentPath=${workspaceFolder}/extension", "--disable-extensions"]
```

---

## Learnings — 2026-07-11 (anchor postMessage fix — CSP/innerHTML safety)

### Don't embed `<script>` inside SVG sent to webview innerHTML

Injecting a `<script type="application/json">` block inside the SVG string and then writing it via `content.innerHTML = msg.svg` caused the VS Code webview to blank (black render). The webview CSP blocks or interferes with any `<script>` encountered during innerHTML parsing, even inert data scripts.

**Fix:** Keep the SVG string byte-identical to `renderSync` output (no `embedAnchorManifest` call in `compileAndRenderSync`). Anchors travel as a separate `anchors` field in the postMessage payload — serialised as `JSON.stringify(result.value.anchors)`. The webview script reads `msg.anchors` into a module-scope `currentAnchors` object and persists it in `vscodeApi.setState` alongside the SVG, so tooltip state survives webview reloads. `embedAnchorManifest` remains exported in `svg.ts` for future static-export use cases where no CSP applies.


---

## Learnings — 2026-07-11 (missing-import runtime bug + esbuild type-check gap)

### esbuild does NOT type-check — undefined identifiers escape the build

`compileAndRenderSync` was called in `extension/src/extension.ts` but the import on line 8 only listed `render`. esbuild bundles without running tsc, so this produced a valid `.cjs` file that threw `ReferenceError: compileAndRenderSync is not defined` at runtime. The build step showed no errors. The fix was simply correcting the import to `import { compileAndRenderSync } from '../../src/frontend/index.js'` (dropping the unused `render`).

**Guard:** `extension/tsconfig.json` exists. Running `npx tsc -p extension/tsconfig.json --noEmit` catches undefined identifier errors (and also caught a missing `anchors` field on `WebviewMessage`). This should be run after any extension source change before relying on the F5 dev host.

### launch.json: `--disable-extensions` supersedes per-id disable flags

Per-id `--disable-extension=<id>` flags are insufficient when the dev extension shares its id with a marketplace copy. Use `--disable-extensions` (plural) instead — it disables all installed extensions while preserving the `--extensionDevelopmentPath` dev build.
## Learnings — 2026-07-11 (flex-center scroll-clipping fix)

**Flex `safe center` for overflow:** `align-items: center; justify-content: center` on a flex container with `overflow: auto` clips the top/left overflow of oversized content — unreachable by scrolling. Fix: `align-items: safe center; justify-content: safe center` centers when content fits, falls back to start-alignment when it overflows, restoring scroll access. Applied to `#stage` in `extension/src/preview-html.ts`.

## Learnings — 2026-07-11 (Alt-key tooltip gating)

**Use `e.altKey` not `document keydown/keyup`:** Keyboard events only fire in the webview when it has focus; the user typically holds Option while hovering the preview from the editor, so `altDown` via keydown/keyup stays false and the tooltip never shows. `e.altKey` on the mousemove event is always correct regardless of focus. Removed the `altDown` var and all three key/blur listeners.
