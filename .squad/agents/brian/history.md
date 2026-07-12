# Brian — Layout Implementation Engineer

## Spawn brian-6 (2026-07-12)

**Task:** Audit all 84 example .mmd files. Identify bad/redundant examples.  
**Result:** 0 bad, 1 redundant (launch-readiness.mmd). Removed with 13 companions = 14 files total. Tests 540/540 ✓.  
**Decision:** `.squad/orchestration-log/2026-07-12T11-32-29Z-brian-6.md`

## Spawn brian-7 (2026-07-12)

**Task:** (1) Remove engineering-dashboard.mmd (ugly + redundant). (2) Fix sql-engine label overlap.  
**Results:** Removed engineering-dashboard (1+13 files). Fixed label via chromeRects contract extension (3 files touched). Tests 539/539 ✓.  
**Decision:** `.squad/orchestration-log/2026-07-12T11-32-29Z-brian-7.md`

## Spawn brian-8 (2026-07-12)

**Task:** Cut release v0.1.9.  
**Result:** PR #59, squash-merge 9b09b76, `publish-npm.yml` succeeded. Shipped connector superset syntax + example cleanup. Tagged v0.1.9.  
**Packages:** @bradygaster/triton-core, @bradygaster/triton-latex, @bradygaster/triton-extension published.

## Spawn brian-9 (2026-07-12)

**Task:** Fix preview toolbar buttons invisible in dark mode.  
**Root cause:** `preview.svg` uses `stroke="currentColor"`, which VS Code resolves to BLACK on toolbar icons. BLACK is invisible on dark background.  
**Fix:** Created two color-baked SVG variants: `preview-light.svg` (ink `#424242`) and `preview-dark.svg` (ink `#C5C5C5`). Updated both command blocks in `extension/package.json` to reference `"icon": { "light": "...", "dark": "..." }`.  
**Result:** Build passed. Buttons now visible on dark themes. `pnpm build:extension` completed (esbuild, 289ms).

## Spawn brian-10 (2026-07-12)

**Task:** Add distinct split/side glyph for `triton.openPreviewToSide`.  
**Rationale:** Both `triton.openPreview` and `triton.openPreviewToSide` buttons displayed identical glyphs. Following VS Code markdown extension pattern, side-preview command needs distinct two-pane glyph.  
**Created:** `preview-side-light.svg` (stroke `#424242`, rounded rect + vertical divider + checkmark in right pane) and `preview-side-dark.svg` (stroke `#C5C5C5`). Updated `triton.openPreviewToSide` command in `extension/package.json`; `triton.openPreview` retains plain glyph.  
**Result:** Visual distinction now clear. Build passed.

## Spawn brian-11 (2026-07-12)

**Task:** Cut release v0.1.10.  
**Result:** PR #60, squash-merge b6fc192, `publish-npm.yml` run 29204094255 succeeded. Shipped preview icon dark-mode + distinct-glyph fixes. Tagged v0.1.10.  
**Packages:** @bradygaster/triton-core, @bradygaster/triton-latex, @bradygaster/triton-extension published.  
**Verification:** Coordinator verified both icon variants render distinct and legible on dark/light backgrounds before release.

---

- Phase 2 (2026-07-10): Tree borders + arrowhead uniformity shipped. 499 tests ✓
- Connector redesign (2026-07-12): 5-style matrix, 30 files, 541 tests ✓
- Live-poster cost analysis: Tier 1 (cheap/2-3d), Tier 2 (expensive/2-3w), Tier 3 (deferred)

## Decisions
- 2026-07-12T11:00:47-04:00: Example Frontmatter Update — `%%` Quick-Ref Headers (COMPLETE). 15 .mmd files (7 poster, 3 flowchart, 5 cross-link) with new quick-ref headers. Tests 541/541 ✓. Merged to decisions.md.

## Learnings
- VS Code `currentColor` pitfall in contributed command icons (2026-07-12): SVGs using `stroke="currentColor"` or `fill="currentColor"` render as BLACK when used as VS Code contributed command icons (editor-title toolbar). VS Code masks/composites these as background images; `currentColor` does not inherit the theme icon-foreground color. Fix: provide two color-baked SVG variants — `preview-light.svg` (ink `#424242`, VS Code light-theme icon foreground) and `preview-dark.svg` (ink `#C5C5C5`, VS Code dark-theme icon foreground) — and reference them via `"icon": { "light": "...-light.svg", "dark": "...-dark.svg" }` in `package.json` contributes.commands. HC-dark falls back to `dark`, HC-light falls back to `light` — no additional variants needed.


- Example `%%` header edits (2026-07-12): `%%` comments are stripped before parse — they CANNOT affect SVG output. Any SVG diffs seen after re-rendering comment-only changes are from pre-existing engine/renderer changes in the working tree, not from the header edits themselves. Verify by checking which src/ files are modified vs which .mmd files changed.
- Label padding in poster/flowchart `%%` blocks follows a strict 13-char `label:+spaces` rule (e.g. `Animation:   ` = 10+3, `Props:       ` = 6+7, `Styles:      ` = 7+6, `Link:        ` = 5+8).
- Cross-link render failure (`parser.parse is not a function`) during connector redesign WIP is pre-existing; not caused by `%%` edits. Will resolve once crosslink engine changes are stabilised.
- Example cleanup (2026-07-12): All 84 .mmd files rendered cleanly (0 bad). The only true redundancy found was `examples/triton/poster/launch-readiness.mmd` — a 2-column poster with flowchart+stat+timeline+text cells identical in structure to `poster.mmd`. Removed it + its .svg + 12 theme SVGs (14 files total). Every other file has at least one distinct layout, directive, axis, diagram type, or feature combination. The `examples.test.ts` uses dynamic discovery so removing one .mmd reduces the test count by exactly 1 (541→540). High-count dirs: mermaid/timeline (9 distinct layouts), ds/tree (9 distinct diagram types: avl/btree/heap/rbtree/radix/segtree + plan/tree/decision), ds/queue (4 types × 2 axis = 8), poster (distinct grid widths + spanning features). `git rm -f` required because the file had uncommitted `%%`-only connector-syntax header changes.
- Cross-link label overlap (2026-07-12): The cross-link label de-collision pass only avoids `allNodeBounds` (anchor node rects) and `occupiedRects` (cell/poster titles). Internal visual chrome of child diagrams — e.g., the PageHeader bar in `page.ts` — is invisible to it. The de-collision can actually CAUSE overlap: if a label's initial position sits just below a chrome bar, a node below the label can push it UP into the bar. Fix layer: `LayoutResult` contract (`src/contracts/anchors.ts`) — added `chromeRects?: readonly Rect[]`; `page.ts` populates it with the PageHeader bar; poster `layout.ts` transforms and adds them to `textOccupied` (= `fixedRects` for de-collision). Any future child diagram with wide header chrome should do the same. The fix is zero-cost for diagrams that don't set `chromeRects`.
- openPreviewToSide icon (2026-07-12): Gets a distinct split/side glyph (preview-side-light.svg / preview-side-dark.svg) — rounded rect with vertical divider + checkmark in right pane — so the two editor-title toolbar buttons can be visually told apart (like VS Code markdown).

## External Theming Plan Approved (2026-07-12)

**Note:** Leslie's design analysis + 6-phase Tier-1 implementation plan for external `.triton-theme.json` files approved by Cristian (5 decisions resolved). Plan includes phases that may involve Brian (layout-independent; primarily core validator, shared discovery, CLI, docs).

**Key decisions affecting implementation:**
- Unknown-key policy = STRICT / ERROR (not forward-compat warning).
- Phase 0 (triton.sty cache-key fix) can start immediately.
- Phases 1–5 sequence by dependency graph (Phase 1 independent, Phases 2–5 blocked on 1+0).

**Plan:** `.squad/decisions.md` (merged 2026-07-12T19:09Z); inbox files deleted.
