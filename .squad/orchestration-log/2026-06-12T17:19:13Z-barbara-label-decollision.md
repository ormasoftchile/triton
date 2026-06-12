# Barbara — Label De-collision Refinement
**Timestamp:** 2026-06-12T17:19:13Z

**Agent:** Barbara (Semantics & Rendering, claude-sonnet-4.6)

**Work Summary:**
Fixed milestone callout label de-collision in horizontal layout. When `labelWrap` token is on (roadmap theme), greedy tier-packer now uses `LABEL_TIER_HGAP=16` + `LABEL_COLLISION_PAD=12` so near-adjacent labels land on separate tiers.

**Results:**
- Timeline-goals June/August milestones now on distinct tiers (3 above-axis tiers)
- All existing goldens byte-identical
- 577/577 tests pass; only timeline-goals outputs moved
- Commit: 708fc45

**Files Modified:**
- packages/core/src/layout/horizontal.ts

**Decision Merged:**
Folded label de-collision refinement into `axis_breaks` decision (deduped; minor refinement already recorded).
