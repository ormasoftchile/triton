# Edsger — History & Learnings

## [ARCHIVED HISTORY]

Previously completed work (detailed history archived — see decisions.md for specs):
- 2026-06-27: Bypass Right-Side Fix, post-balance dummy snap (commit d15b9b9), Dagre-faithful port
- 2026-06-28: Multi-Wall Skip-Edge Routing Spec, Skip-Edge Routing Optimizer Spec, Generalized Edge Routing Optimizer Spec
- 2026-07-06: Group E DS Diagram-Options Fragments (22 subkinds, 21 examples, all SVGs exit 0)
- 2026-07-12: Card-Edge Bounds Fix (Brian-lockout revision, 774/774 tests pass)

## 2026-07-13 — Directional Grid Placer Spec for Architecture-Beta

**Task:** Replace Sugiyama with direction-constrained grid placer for architecture-beta  
**Status:** ✅ COMPLETE — spec delivered to inbox

### Key Algorithm

- **BFS propagation** from seed node using direction-pair delta table
- **Direction pairs** (L/R/T/B) encode grid offsets: `L→R=(-1,0)`, `R→L=(+1,0)`, `T→B=(0,+1)`, `B→T=(0,-1)`
- **Handles**: cycles (first-visit wins), contradictions (silent degradation), disconnected components (reseed), collisions (bump to next row)
- **Output**: `Map<id, {col, row}>` integer grid coordinates
- **Pixel conversion**: `x = col * (nodeW + gap) + margin`
- **Scope**: New `gridPlacer.ts` (~80 LOC), modified `layout.ts` (~15 lines), no other changes

### Mermaid Reference

Verified against `mermaid-js/mermaid` develop:
- `architectureDb.ts:217–275` (BFS + position shift)
- `architectureTypes.ts:102–120` (direction-pair delta table)
- `architectureRenderer.ts:180–280` (constraint feed to fcose)

Triton can skip fcose — pure BFS grid is sufficient for node placement.

### Deviations (discovered post-spec by Brian)

Brian's implementation found delta table inversion in T/B rows:
- **Spec (incorrect):** `T|B=(0,+1)`, `B|T=(0,-1)`
- **Corrected:** `T|B=(0,-1)`, `B|T=(0,+1)` (canonical grid test validates)

## 2026-07-13 — Directional Grid Placer Implementation Review (Brian-2 Agent)

**Status:** ✅ APPROVED — gridPlacer.ts live, 853 tests green, canonical grid matches mermaid.live

- New `src/diagrams/mermaid/architecture/gridPlacer.ts` with BFS constraint propagation
- Modified `src/diagrams/mermaid/architecture/layout.ts` (replaced `layeredLayout` call)
- New `test/gridPlacer.test.ts` with 23 tests (canonical 2×2 grid, axis pairs, cycles, disconnects, junctions)
- All 6 architecture example SVGs re-rendered, PNGs rasterized
- Delta table correction verified: server(0,0), db(1,0), disk1(0,1), disk2(1,1) = canonical 2×2 grid

## 2026-07-13 — Architecture-Beta Visual QA Re-Audit (Ken-2 Agent)

**Status:** ✅ APPROVED — 6/6 examples PASS, critical B/D overlap fixed

- Previous defect (B/D node overlap at y=100): **RESOLVED**
- New SVG coords confirm proper 2×2 grid with zero overlap
- All 4 arrow forms, junctions, group edges, nested groups render correctly
- Ready for merge

---

## Key Learnings

- **Sugiyama unsuitability**: Rank-based layering ignores directional placement semantics; BFS grid is correct algorithm
- **First-visit determinism**: BFS cycle handling (first-visit wins) guarantees deterministic output without explicit conflict resolution
- **Disconnected graph resilience**: Multi-start BFS with column offset handles graph with isolated nodes cleanly
- **Mermaid fidelity**: Triton's pure-BFS approach matches Mermaid's grid output without fcose post-processing


## 2026-07-14 — Group-aware Architecture Placement Spec

**Status:** ✅ COMPLETE — decision merged by Scribe.

Specified recursive clustered grid placement for architecture-beta: groups are atomic clusters at their parent level, child groups lay out locally, cross-group/external edges collapse to direct child cluster constraints, and align must never break containment.

## 2026-07-14T20:11:53-0400 — Obstacle-aware architecture routing

- Owned the Brian-lockout revision for grouped architecture routing after Ken's re-review.
- Added obstacle-aware mixed-axis orthogonal detours and stronger Bezier deflection/fallback for clustered group members.
- Verified `triton-features.svg` with 0 foreign node crossings and 940 passing tests; coordinator committed as d3258bd.

## 2026-07-15T00:54:19-04:00 — Nodegraph port fan-out revision

- Took over after Brian's Visual QA rejection/lockout for `src/diagrams/triton/ds/graph/graph.ts`.
- Reworked renderer-local routing with per-wall port fan-out, skip-edge side lanes outside spanned node columns, label-over-edge ordering, and title-aware viewBox width.
- Validation passed: typecheck and 951/951 tests green; `examples/triton/ds/graph/graph.svg` regenerated. Ken approved; coordinator committed `ef0a043`.

## 2026-07-15T01:26:33-04:00 — layeredLayout edgeBends audit and state artifact refresh

- Audited layeredLayout consumers for straight-edge-through-node risk: nodegraph was the only renderer using raw `connectSlots` instead of `routeEdge`/`edgeBends`; class already consumes `edgeBends`.
- Requirement, C4, and ER ignore `edgeBends` but remain protected by the kernel's obstacle-aware `routeEdge` path.
- Verified the state diagram symptom as a stale artifact, not a code bug; regenerated `examples/mermaid/state/state.svg` so the transition detours PartialPay. Coordinator committed the artifact refresh as `20d2fbd` after typecheck and 951/951 tests passed.

## 2026-07-16T16:25:15.615-04:00 — Animated export POC and block-beta spacing

- Built animated-export POC on branch `ormasoftchile/animated-export-poc` (commit `affbb2c`): SMIL bake-per-frame, inline `animateMotion` comet sampling, export-side speed, temporal-supersampling motion blur, shutter control, and canonical comet variant c.
- Dropped GIF as unsuitable; APNG is the animated diagram export target.
- Added block-beta `space` / `space:N` support via `SpaceDef` / `isSpace`, advancing layout without rendering filler blocks while preserving hue indexing.
- Coordinator verified rendered frames, path-scoped commit hygiene, and 989 passing tests.
