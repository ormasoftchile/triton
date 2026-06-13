# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

---

## Recent Summary (2026-06-12)

### Roadmap Layout Family (3 increments)

**INCREMENT 1:** Created `layout/roadmap.ts` — new layout family alongside horizontal/vertical-spine/serpentine. Three-zone infographic: header, milestone callouts (all above), phase band with icon badges, date axis below. Wired `metadata.layout` as IR field + render option. 577/577 tests pass; byte-identical goldens.

**INCREMENT 2:** Greedy left→right de-collision for callout placement. Forward pass (push blocks right to clear previous) + backward clamp (prevent overflow). GAP=12px ensures axis date labels don't overlap. Single x for all milestone elements (block/leader/dot/axis tick). Result: 6 callouts at 103, 553, 700, 840, 971, 1097px with ≥12px edges.

**INCREMENT 3:** Promoted 17 hardcoded geometry constants to optional theme tokens (RoadmapTheme: 5 padding + 6 gaps + 6 sizes). `breakGapPx` required AxisState wiring. All defaults match current constants → byte-identical goldens.

### Theme Tokens & Opt-In Features

- `axis.nodeWrap: 'over-under'` — spine arcs around nodes (our-timeline only)
- `milestone.labelWrap: boolean` — 2-line milestone wrap with dynamic box height  
- `axis.todayMarker.labelChip: boolean` — white chip backdrop under Today label
- `axis.todayMarker.onTop: boolean` — defer today marker after activity pills (z-order fix)
- `axis_breaks: Array<{from, to}>` — piecewise-linear layout with 24px gaps + "//" markers

### Test Coverage & Determinism

- 577/577 tests pass (564 core + 13 schema + 3 cli)
- All existing goldens byte-identical (0 regression)
- Determinism: `Math.floor(x + 0.5)` round-half-up throughout
- Timeline-goals fixture: 3 new outputs (SVG/PNG/Skia)

### Handoff Notes (Open Work)

**Mark (schema validation):** Defer `axis_breaks` field constraints:
- `from < to` enforcement
- Breaks within `time_range` bounds
- Non-overlapping, sorted validation
- Max breaks upper limit warning

Full learnings archived to `history-archive.md`.
