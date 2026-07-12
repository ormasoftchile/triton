# Brian — Layout Implementation Engineer

- Phase 2 (2026-07-10): Tree borders + arrowhead uniformity shipped. 499 tests ✓
- Connector redesign (2026-07-12): 5-style matrix, 30 files, 541 tests ✓
- Live-poster cost analysis: Tier 1 (cheap/2-3d), Tier 2 (expensive/2-3w), Tier 3 (deferred)

## Decisions
- 2026-07-12T11:00:47-04:00: Example Frontmatter Update — `%%` Quick-Ref Headers (COMPLETE). 15 .mmd files (7 poster, 3 flowchart, 5 cross-link) with new quick-ref headers. Tests 541/541 ✓. Merged to decisions.md.

## Learnings
- Example `%%` header edits (2026-07-12): `%%` comments are stripped before parse — they CANNOT affect SVG output. Any SVG diffs seen after re-rendering comment-only changes are from pre-existing engine/renderer changes in the working tree, not from the header edits themselves. Verify by checking which src/ files are modified vs which .mmd files changed.
- Label padding in poster/flowchart `%%` blocks follows a strict 13-char `label:+spaces` rule (e.g. `Animation:   ` = 10+3, `Props:       ` = 6+7, `Styles:      ` = 7+6, `Link:        ` = 5+8).
- Cross-link render failure (`parser.parse is not a function`) during connector redesign WIP is pre-existing; not caused by `%%` edits. Will resolve once crosslink engine changes are stabilised.
