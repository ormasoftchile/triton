# Brian — Layout Implementation Engineer

## Spawn brian-6 (2026-07-12)

**Task:** Audit all 84 example .mmd files. Identify bad/redundant examples.  
**Result:** 0 bad, 1 redundant (launch-readiness.mmd). Removed with 13 companions = 14 files total. Tests 540/540 ✓.  
**Decision:** `.squad/orchestration-log/2026-07-12T11-32-29Z-brian-6.md`

## Spawn brian-7 (2026-07-12)

**Task:** (1) Remove engineering-dashboard.mmd (ugly + redundant). (2) Fix sql-engine label overlap.  
**Results:** Removed engineering-dashboard (1+13 files). Fixed label via chromeRects contract extension (3 files touched). Tests 539/539 ✓.  
**Decision:** `.squad/orchestration-log/2026-07-12T11-32-29Z-brian-7.md`

---

- Phase 2 (2026-07-10): Tree borders + arrowhead uniformity shipped. 499 tests ✓
- Connector redesign (2026-07-12): 5-style matrix, 30 files, 541 tests ✓
- Live-poster cost analysis: Tier 1 (cheap/2-3d), Tier 2 (expensive/2-3w), Tier 3 (deferred)

## Decisions
- 2026-07-12T11:00:47-04:00: Example Frontmatter Update — `%%` Quick-Ref Headers (COMPLETE). 15 .mmd files (7 poster, 3 flowchart, 5 cross-link) with new quick-ref headers. Tests 541/541 ✓. Merged to decisions.md.

## Learnings
- Example `%%` header edits (2026-07-12): `%%` comments are stripped before parse — they CANNOT affect SVG output. Any SVG diffs seen after re-rendering comment-only changes are from pre-existing engine/renderer changes in the working tree, not from the header edits themselves. Verify by checking which src/ files are modified vs which .mmd files changed.
- Label padding in poster/flowchart `%%` blocks follows a strict 13-char `label:+spaces` rule (e.g. `Animation:   ` = 10+3, `Props:       ` = 6+7, `Styles:      ` = 7+6, `Link:        ` = 5+8).
- Cross-link render failure (`parser.parse is not a function`) during connector redesign WIP is pre-existing; not caused by `%%` edits. Will resolve once crosslink engine changes are stabilised.
- Example cleanup (2026-07-12): All 84 .mmd files rendered cleanly (0 bad). The only true redundancy found was `examples/triton/poster/launch-readiness.mmd` — a 2-column poster with flowchart+stat+timeline+text cells identical in structure to `poster.mmd`. Removed it + its .svg + 12 theme SVGs (14 files total). Every other file has at least one distinct layout, directive, axis, diagram type, or feature combination. The `examples.test.ts` uses dynamic discovery so removing one .mmd reduces the test count by exactly 1 (541→540). High-count dirs: mermaid/timeline (9 distinct layouts), ds/tree (9 distinct diagram types: avl/btree/heap/rbtree/radix/segtree + plan/tree/decision), ds/queue (4 types × 2 axis = 8), poster (distinct grid widths + spanning features). `git rm -f` required because the file had uncommitted `%%`-only connector-syntax header changes.
- Cross-link label overlap (2026-07-12): The cross-link label de-collision pass only avoids `allNodeBounds` (anchor node rects) and `occupiedRects` (cell/poster titles). Internal visual chrome of child diagrams — e.g., the PageHeader bar in `page.ts` — is invisible to it. The de-collision can actually CAUSE overlap: if a label's initial position sits just below a chrome bar, a node below the label can push it UP into the bar. Fix layer: `LayoutResult` contract (`src/contracts/anchors.ts`) — added `chromeRects?: readonly Rect[]`; `page.ts` populates it with the PageHeader bar; poster `layout.ts` transforms and adds them to `textOccupied` (= `fixedRects` for de-collision). Any future child diagram with wide header chrome should do the same. The fix is zero-cost for diagrams that don't set `chromeRects`.
