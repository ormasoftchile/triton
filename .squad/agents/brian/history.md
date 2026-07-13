# Brian — Layout Implementation Engineer

## Current Focus

External theming implementation (Phases 0–5) — feature shipped v0.1.15.
- **Recent work:** Phases 4–5 implementation + 3-round CI fix (theme-resolve.ts extraction)
- **PRs merged:** #61–#67 (all shipped in v0.1.15)
- **Test status:** 621/621 ✓

## Recent Spawns

### Spawn brian-12 (2026-07-12) — Phase 0 Cache-Key Fix
Phase 0 of external theming: triton.sty `%%triton-key:` cache line now includes theme path. Used `echo` (not `printf`) to prevent `%%` escape-sequence interpretation. See decisions.md for rationale.

### Spawn brian-13 (2026-07-12) — Phase 1 Validator
Phase 1: Core `validateThemeInput()` with strict unknown-key rejection, new `THEME_VALIDATION_ERROR` code, CSS injection guard, hand-maintained schema.json (draft-07). PR #62.

### Spawn brian-14 (2026-07-12) — Phase 2 Discovery  
Phase 2: Shared `discoverThemes`/`loadThemeFile`/`findTritonThemesDir` utility. Purity seam via relative-path imports. Fixture files committed; tests use `test/.tmp-discover/` (not /tmp). PR #63.

### Spawn brian-15 (2026-07-12) — Phase 3 VS Code UI
Phase 3: VS Code extension `.triton/themes/` discovery + dropdown + live reload. `ThemeRegistry` pattern with per-workspace-folder watchers. Force external theme via full `ResolvedTheme` as `themeInput`. In-place dropdown refresh (no webview teardown). PR #64.

### Spawn brian-16 (2026-07-12) — Phase 4 LaTeX CLI
Phase 4: triton-latex `--theme-file` / `--themes-dir` CLI flags + auto-discovery. Cache key extended (path-based, not content-aware; Tier-2 deferral). New .sty macros `\tritonthemefile` / `\tritonthemesdir`. PR #65.
- **KNOWN LIMITATION:** Path-based cache-key; in-place theme file edits leave stale cache. Mitigation: `rm -r <cachedir>`.
- **Verification:** All 4 theme-resolution tests passing (621/621 total).

### Spawn brian-17 (2026-07-12) — Phase 5 Docs + CI Fix
Phase 5: External theming documentation. Template `.triton-theme.json` omits `$schema` (rejected by validator). Users get editor hints via VS Code `json.schemas` settings.
- **Root cause CI failure (Phase 4):** Test spawned `latex/dist/cli.cjs` (not built at test time); module entry ran on import; transitive pdfkit import failed.
- **Fix (PR #67):** Extracted `resolveCliTheme` to `latex/src/theme-resolve.ts` (node + core only). Test imports that; CLI imports that. No dist/ spawn, no pdfkit drag-in.
- **Verification:** `rm -rf latex/dist latex/node_modules && pnpm test` → 621/621 ✓

---

## Learnings

### CI Robustness (2026-07-12)

**Four patterns to AVOID in test imports:**

1. **Never spawn `dist/` files in CI tests.** CI runs `pnpm test` before `pnpm build`. Non-existent dist files cause test failures.
   - Fix: Extract and export testable functions; import from TS source instead of CLI module.

2. **Guard module entry points with `import.meta.url` check.** Top-level `main()` calls trigger when modules are imported.
   - Fix: `if (process.argv[1] === fileURLToPath(import.meta.url)) { main().catch(...) }`

3. **Avoid importing CLI modules from tests if they have non-root dependencies.** `pdfkit` (latex-only) breaks CI.
   - Fix: Move testable logic to a pure module (node + core only). CLI imports that; tests import that directly.

4. **Don't use `vi.spyOn(process, 'exit')`.** vitest intercepts globally; reports error even when spy + test logic are correct.
   - Fix: Use `.toThrow()` on error paths instead.

**Evidence:** PR #67 CI fix. 3 cascading failures → 1 extraction → all 4 tests restored (621/621 ✓).

### Earlier Learnings (prior to 2026-07-12)

- **VS Code icon color:** SVGs using `stroke="currentColor"` render BLACK on contributed toolbar icons (VS Code composites them as background images). Fix: provide color-baked variants (`-light.svg` / `-dark.svg`) + reference via `"icon": { "light": "...", "dark": "..." }` in `package.json`.
- **Example comments:** `%%` lines stripped before parse — they don't affect SVG output. Verify by checking which src/ files changed, not just .mmd files.
- **Label padding in examples:** Strict 13-char `label:+spaces` rule in poster/flowchart `%%` headers.
- **Example cleanup (2026-07-12):** All 84 .mmd files tested — 0 bad, 1 redundant (launch-readiness.mmd, identical to poster.mmd). Removed + 13 companions = 14 files.
- **Cross-link label dedup:** De-collision pass misses internal child diagram chrome (PageHeader bars). Fix layer: `LayoutResult.chromeRects` → added to `textOccupied` for layout. Zero-cost if unused.
- **Tree node borders:** Plain nodes now use `palette.primary` (blue) instead of outline stroke, matching nodegraph.
- **Arrowhead size uniformity:** SVG marker `markerUnits="userSpaceOnUse"` (fixed pixels, not stroke-width-scaled). Active edges now same arrowhead size as normal edges.

---

## Decisions Recorded

All 6 inbox decisions merged to `.squad/decisions.md` (2026-07-12):
- **brian-external-themes-docs:** `$schema` omitted from template (validator rejects); workaround via VS Code `json.schemas`.
- **brian-latex-cachekey:** Cache-key fix: `echo` vs `printf` escape behavior.
- **brian-latex-themes:** Path-based cache key (content-hash deferred to Tier-2).
- **brian-theme-discover:** Theme name derivation; purity seam at discover.ts; fixture files + test/.tmp-discover/.
- **brian-theme-validator:** Strict unknown-key, THEME_VALIDATION_ERROR code, CSS injection guard, hand-maintained schema.
- **brian-vscode-themes:** Force-external-theme via themeInput; ThemeRegistry pattern; in-place dropdown refresh.

See `.squad/decisions.md` for full context.

---

## Earlier Work Summary

**2026-07-10 (Phases 1–2):**
- Poster Phase 1: Per-cell highlight (array/matrix), caption slot, freeform notes (top/bottom/center positioning), edge highlight (tree/nodegraph).
- Arrowhead uniformity fix + Tree default node border fix (blue primary).
- Phase 2 primitives (intervals/hashring) prototyped, then dropped per Cristian's decision.

**2026-06-28 (Layout optimizer):**
- Multi-wall skip-edge routing (6 strategy candidates: A–F wall pairs). Generalized to all edges (direct + skip).
- Processed edges by span (longest first); skip-cross-column → direct-same-column ordering.

**Archived spawns (brian-1 through brian-11):** Moved to history-archive.md. Includes early poster primitives, example audits, v0.1.9–v0.1.10 releases, and icon dark-mode fixes.

---

## Learnings — P2 Icon Render (2026-07-12)

**Scene icon element (P6 seam Bjarne populates):**
- Type name: `SceneIcon` (discriminant `type: 'icon'`)
- Fields:
  - `icon: ResolvedIcon` — fully resolved icon from `resolveIcon()` (P0 output)
  - `x: number` — top-left x of the target bounding box (scene coords)
  - `y: number` — top-left y of the target bounding box (scene coords)
  - `size: number` — side length of the square target box (scene units)
  - `color?: string` — CSS color token for monochrome tint (e.g. `"#1e293b"`); ignored for brand icons
  - `opacity?: number` — optional element opacity
- Location: `src/contracts/scene.ts` (added to `SceneElement` union), exported from `src/contracts/index.ts`
- Pen helper: `pen.icon(resolvedIcon, x, y, size, opts?)` in `src/scene/build.ts`

**Mono-tint vs brand-verbatim emit rules:**
- `colorMode='monochrome'` → add `style="color:{color}"` on the nested `<svg>` wrapper; body's `currentColor` inherits the tint. No separate fill attribute is emitted.
- `colorMode='brand'` → emit body verbatim inside nested `<svg>` with NO color style override. Brand hex fills (e.g. `#0078D4`) and gradients render as-is.

**Gradient ID namespacing approach:**
- Module-level `iconEmitCounter` (monotonic integer) increments once per brand icon emitted.
- Prefix: `icn{n}` (e.g. `icn0`, `icn7`).
- All `id="foo"` in the brand body → `id="icn{n}-foo"`.
- Matching `url(#foo)` and `href="#foo"` refs → `url(#icn{n}-foo)` / `href="#icn{n}-foo"`.
- Monochrome icons are never namespaced (no IDs in their bodies by convention).

**Transform strategy:**
- `ResolvedIcon.transforms` (rotate 0–3 × 90°, hFlip, vFlip) are applied in viewBox coordinate space inside the nested `<svg>`.
- Transform string (SVG right-to-left): `translate(cx cy) scale(sf vf) rotate(deg) translate(-cx -cy)` where cx/cy = viewBox center.
- When transforms are identity (rotate=0, hFlip=false, vFlip=false), no `<g>` wrapper is emitted.

**Aspect-ratio scaling:**
- `scale = min(size / vbW, size / vbH)` — fills one axis, leaves padding on the other.
- Icon is centered within the `size × size` box (offset = `(size - scaled) / 2`).
- Nested `<svg x y width height viewBox>` approach — clean coordinate isolation.

**rsvg safety:**
- Renderer adds only `<svg>`, `<g>`, and passes body verbatim (no `<foreignObject>`, no `<image>`).

**File paths:**
- Contract: `src/contracts/scene.ts` — `SceneIcon` interface
- Exports: `src/contracts/index.ts` — added `SceneIcon` to barrel
- Pen: `src/scene/build.ts` — `icon()` method on `Pen`
- Emit: `src/render/svg.ts` — `renderIcon()`, `buildIconTransform()`, `namespaceIconIds()`, `iconEmitCounter`
- Tests: `test/icon-render.test.ts` — 25 tests, all passing
- Example: `examples/triton/icons/icon-render.ts` → `icon-render.svg` → `icon-render.png`

**⚠️ SceneElement union membership — exhaustive switch sites to update:**
Adding any new member to the `SceneElement` union requires updating three switch sites
that pattern-match over all element types:
1. `src/overlay/layout.ts` — `elementBoundsAt()`: return bounds `{ x: el.x+ox, y: el.y+oy, width, height }`.
2. `src/diagrams/triton/ds/queue/shared.ts` — `translateElement()`: return translated copy with `rhu()` rounding.
3. `src/diagrams/triton/ds/struct/array.ts` — `translateElement()`: same pattern as queue/shared.ts.
These are non-exhaustive switches (TS2366). All three were fixed for `SceneIcon` in P2 follow-up (2026-07-12).

## Learnings — P7: Card Node (2026-07-12T20:34:10-04:00)

### Card layout: two-region composition
- Card = bg rect + LEFT icon region (40×40px, icon glyph 32px centered within) + RIGHT text region (title bold + body wrapped ≤3 lines)
- `splitCardLabel(label)` splits on `/\\n|\n/` — handles both actual newline chars and literal `\n` two-char escape sequences (as written in .mmd files)
- Title top-aligned when body present; vertically centered (y = card_center + fontSize*0.35) when title-only
- Body wrapped via `wrapText(bodyText, smallFontSize, rightW, 3)` at render time (rightW = card.width − 2*pad − iconBox − iconGap)
- Icon region ALWAYS reserved (even when no icon) — text starts at `pad + iconBox + iconGap` from card left edge

### Per-node sizing mechanism
- `measureCardNode(node, typography)` called before BK coordinate assignment for every `shape==='card'` node
- Result stored in `nodeSizeMap: Map<string, {width, height}>` (non-cards use default NODE_W×NODE_H)
- Map passed as optional last argument to `assignCoordinatesBK`
- BK modification: `globalCrossSize` = max cross-size across ALL nodes in ALL layers (uniform slot width)
- Main axis: per-layer `layerMainSizes[]` computed; cumulative `fwdMainPos[]` used instead of uniform `margin + layerNum * mainStep`
- Each node centered within its slot: `x = slotLeft + (globalCrossSize − nodeW) / 2` and `y = layerTop + (layerMainSize − nodeH) / 2`
- `nodePos` Rects reflect ACTUAL node bounds → edges attach to real card bounds (not phantom 120×40)

### Card constants (Leslie's geometry contract)
- `CARD_PAD = 8` (unit*1), `CARD_ICON_BOX = 40` (unit*5), `CARD_ICON_GAP = 12` (unit*1.5)
- `CARD_MIN_W = 192` (unit*24), `CARD_MAX_W = 400` (unit*50), `CARD_MAX_BODY_LINES = 3`
- Card height = `max(CARD_ICON_BOX=40, textH) + 2*CARD_PAD` where `textH = titleLH + bodyH`
- Short body (< icon box height) → card height dominated by icon box: `max(40, titleLH+shortBodyH) = 40`

### Title/body split corner case
- Test: "card with body is taller" only holds if bodyH makes textH > CARD_ICON_BOX (40px).
  Short one-line bodies (textH < 40) produce the same height as title-only cards.
  Test must use a body that wraps to ≥2 lines (textH > 40) to prove height increase.

### DISCLOSED deviations from ideal per-node sizing:
1. **Cross-axis slot size is global max** — in mixed diagrams (card + small nodes in same layer), small nodes get extra horizontal gaps equal to the difference between global max cross-size and their own cross-size. This is visually acceptable and guarantees no overlaps without restructuring BK.
2. **Icon region always reserved** — a card with no icon reserves the icon column width (text starts at pad+iconBox+iconGap). Text does not reflow to full-width when icon is absent. Minor wasted space.
3. **Body width uses maxRightW at CARD_MAX_W for measureCardNode** — wrapping in `measureCardNode` uses maxRightW = 332px; actual render uses actual rightW. If body fits in fewer lines at 332px but could differ at actual width, there is a minor inconsistency. In practice, actual rightW ≤ maxRightW so actual render may wrap MORE aggressively, which is safe (no overflow).

### Files changed
- `src/diagrams/mermaid/flowchart/layout.ts` — card constants, `splitCardLabel`, `measureCardNode`, per-node sizing in BK, card render loop, `'card'` case in `renderNodeShape`
- `test/flowchart-card.test.ts` — 27 new tests
- `examples/triton/icons/cards-render.ts` — render script
- `examples/triton/icons/cards.svg` + `cards.png` — visual verification artifacts
