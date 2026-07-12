# Session Log: Example Cleanup Round

**Date:** 2026-07-12T11:32:29-04:00  
**Scope:** Audit and clean example files; fix cross-link label overlap  
**Agents:** Brian (2 spawns), Ken (1 spawn), Scribe (archival + commit)

## Summary

Three background agents executed cleanup work:
1. **brian-6**: Audited all 84 .mmd files across 27 directories. Removed 1 redundant file (launch-readiness + 13 companions).
2. **brian-7**: Removed engineering-dashboard example + fixed sql-engine cross-link label overlap via chromeRects.
3. **ken-5**: Visual QA of label fix. Confirmed 18px clearance, zero NaN, no regressions.

Test progression: 541 → 540 → 539 (each removal drops count by 1 due to dynamic test discovery).

## Files Changed

**Removed:**
- examples/triton/poster/launch-readiness.mmd + .svg + 12 theme SVGs
- examples/triton/poster/engineering-dashboard.mmd + .svg + 13 theme SVGs

**Modified (source):**
- src/contracts/anchors.ts — added chromeRects field to LayoutResult
- src/diagrams/triton/ds/struct/page.ts — populate chromeRects with PageHeader bar
- src/diagrams/triton/poster/layout.ts — transform chromeRects into textOccupied

All source changes remain uncommitted pending Cristian's PR review.

## Decisions Archived

27 decisions dated 2026-07-05 through 2026-07-08 moved to decisions-archive.md (threshold: >= 7 days). Inbox files merged into decisions.md (2 entries added).

## Team State

- decisions.md: 165,831 → ~110KB (after archival + inbox merge)
- decisions-archive.md: created (98,389 bytes)
- brian/history.md: updated with spawns (brian-6, brian-7)
- ken/history.md: updated with spawn (ken-5) and archived old reviews
- ken/history-archive.md: created
- orchestration-log/: 3 new files (ISO 8601 UTC format)
- .squad/log/: session log recorded

## Next Steps

All changes remain staged in .squad/. User will review PR implications and decide on commit/push.
