# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — a timeline creation tool. IR (intermediate representation) based rendering system.
- **Stack:** TypeScript/Node, LaTeX design doc, SVG/PNG/PDF/PPTX backends
- **Created:** 2026-06-10

## Key Learnings

- Design is authored in LaTeX with a bibliography (references.bib).
- Three-layer architecture: ingestion (data + prompt → IR) → IR spec → rendering semantics (IR → render).
- Six-phase deterministic layout pipeline (Axis → Tracks → Activities → Milestones → Sections/Annotations → Label Collision).
- All renderers must agree on the six-phase order and determinism contract (pure functions, stable sorts, round-half-up, integer arithmetic).
- Scene/Render IR is the backend-agnostic root; SVG is one backend, not the root.
- Themes are extensible with fidelity tiers (Tier 0 Minimal → Tier 3 Showcase).

## Session Summary — 2026-06-09 through 2026-06-11

### 2026-06-09 — Initial Design (Wave 1)
- Determinism contract: six-phase pipeline, binding for all renderers
- Edge-case rulings (zero-duration, TBD, approximate dates, partial overlap, etc.)
- Theme schema knobs + five built-in themes (Consulting, Executive, Product, Release, Minimal)
- Output priority: SVG → PNG → PDF → PPTX → HTML

### 2026-06-10 — Phase 1 Implementation Complete
**Deliverables:**
- Scene/Render IR architecture (backend-agnostic root)
- Layout engine: six-phase deterministic pipeline + dense overlap handling
- SVG/PNG backends (deterministic via resvg-js + embedded DejaVu Sans)
- Consulting theme (Tier 1, production-ready)
- 21 decision records merged from inbox (context: tight-spacing fixes, schema validation, label collision)
- Gallery: 8 example IR documents with SVG/PNG outputs
- Icon registry: 20 geometric icons + rendering paths (horizontal nodes, spine badges)
- Test coverage: 110/110 core tests passing → 461/461 tests (+ Skia integration)

**Key milestones:**
- Layout quality polish: sub-lane packing, header blocks, title/subtitle rendering
- Dense milestone decluttering: two-pass label collision resolution + alternating blocks
- Skia Graphics Library integration: deterministic canvas ops + drop shadows/glow effects
- Target outputs analysis: 5 reference images map to 3 layout families; vertical-spine prioritized for post-MVP

### 2026-06-11 — Activity Icons + Skia Fixes
**Activity Icon Feature (Two Steps):**
1. **Mark (IR Extension):** Added `Activity.icon?: string` field to IR (types.ts, schema.ts, JSON Schema regenerated)
2. **Barbara (Rendering Implementation):**
   - Horizontal: Icons at left edge of bar, size = barHeight−4, label shifted right
   - Vertical-spine: Icons flow through existing SpineEntry paths (badge + node)
   - All backends (SVG, PNG, Skia): transparently handle PathPrimitive transforms
   - Feature shipped: 10 new icon tests, 486/486 monorepo tests passing

**Concurrent Skia Fixes:**
- **Glow/Shadow Artifact:** Changed TileMode.Clamp → Decal for blur calls (hard shadow band → smooth falloff)
- **Legend Colors:** Showcase theme palette now uses perceptually distinct colors (planned→BLUE_SCHED, in-progress→TEAL_ACTIVE, standard-node→CYAN)
- Result: 465/465 tests passing, pixel-verified fixes

**Decision Records:** Three records merged into decisions.md (validation parity, placement semantics, TileMode ruling)

## Architecture Summary

**Rendering Pipeline:**
1. IR validation (schema, references, date anchors)
2. Theme resolution (five built-in themes + extensibility)
3. Six-phase deterministic layout (Axis → Tracks → Activities → Milestones → Sections → Labels)
4. Scene/Render IR output (backend-agnostic, deterministic)
5. Backend-specific rendering (SVG, PNG, PDF, PPTX, HTML)

**Key Contracts:**
- Six-phase order is binding for all renderers
- Determinism at three levels: Scene geometry (always), per-backend (given version), cross-backend (not promised)
- All sorts are stable and deterministic (index, start_ordinal, date_ordinal)
- No system entropy (random, Date.now(), locale)

## Known Issues & Deferred Work

- **Advanced icon badge styles** (outline, border): Current implementation uses solid filled circle; can be made configurable via theme tokens
- **Vertical-spine layout:** Ready for Phase 3; prioritized for agent/ingester integration
- **Serpentine layout:** Post-MVP; prioritized for later phases
- **Art effects** (Tier 2/3): Deferred to Phase 4
- **PPTX backend:** Deferred to Phase 4; will use isolated subprocess pattern with pptxgenjs (not python-pptx)

## Test Status

- **Phase 1 Core (110 tests):** All passing
- **Skia Integration (351 tests):** All passing
- **Total Monorepo (486 tests):** All passing
- **Determinism:** Verified across all edge cases; byte-identical output across runs

## Files Changed (2026-06-11)
- `packages/core/src/layout/horizontal.ts` — icon+label block, size formulas
- `packages/core/src/layout/vertical-spine.ts` — iconHint for activities
- `packages/core/src/render/skia.ts` — TileMode.Decal for blur calls
- `packages/core/src/themes/showcase.ts` — palette updates (legend colors)
- `examples/gallery/*.{svg,png}` — regenerated with activity icons
- `packages/core/test/icons.test.ts` — 10 activity-icon tests
- `.squad/decisions.md` — 3 decision records merged from inbox

## Learnings

### Target Output Coverage Map (2026-06-11 Update)

| Target | Verdict | Key Blockers |
|--------|---------|--------------|
| T1 Horizontal Numbered | 🟡 Partial | Alternating above/below placement, logo slot |
| T2 Vertical Spine Dark | 🟡 Partial | Per-segment spine color, far-edge badges, multi-block descriptions |
| T3 AI Timeline Dense | ✅ Closed | Closed 2026-06-11: Activity.color, fontSizeYearLabel, gradient bg |
| T4 Serpentine Glow | 🔴 Not yet | Serpentine layout (deferred post-MVP per decisions) |
| T5 Gitline Cards | 🟡 Partial | CTA button from url, inline date icon |

### Gaps Closed Since Prior Analysis
- Vertical-spine layout family ✅
- Card entry style (entryStyle:'card') ✅
- Glow/shadow effects (Skia backend) ✅
- Activity.icon field ✅
- Milestone.icon, Milestone.color, Milestone.metadata ✅
- Numbered-circle milestones ✅
- Gradient/cloud background ✅

### Top Remaining Gaps (by target coverage)
1. **T3-3: Activity.color** — enables 12+ accent palette without categoryMap boilerplate (Mark, S)
2. **T5-1: CTA button rendering** — renders activity.url as pill button (Barbara, M)
3. **T2-1: Per-segment spine color** — distinct spine colours between nodes (Barbara/Mark, M)
4. **T1-1: Alternating milestone placement** — above/below baseline layout mode (Barbara, M)
5. **T4-1: Serpentine layout** — explicitly deferred to post-MVP (Barbara, L)

### T3 AI Timeline — CLOSED 2026-06-11

All three T3 gaps are now closed.

**T3-3 — Activity.color wiring**
- Precedence (mirrors Milestone.color): `explicit .color field > categoryMap > statusMap > theme default`
- `vertical-spine.ts`: `resolveStatusStyle(status?, category?, colorOverride?)` — colorOverride sets both fill and stroke; applied for every milestone/activity
- `horizontal.ts`: `al.activity.color ?? catOverride?.fill ?? base?.fill ?? defaultFill` and same chain for milestones

**T3-2 — Year-label typography token**
- Added `fontSizeYearLabel?: number` to `TypographyTheme` in `themes/types.ts`
- When set, vertical-spine applies `yearFontPx = ptToPx(fontSizeYearLabel)` and bold weight for year/tick labels
- Falls back to `fontSizeAxis` when unset → zero impact on existing themes
- Geometry constraint: at 16pt the year label "1967" spans ~41.6px, leaving a 12.4px gap before entry text starts (safely above OVERLAP_EPSILON=4px)
- `ai-timeline` theme sets `fontSizeYearLabel: 16` (vs default 10pt axis)

**T3-1 — Gradient background for vertical layouts**
- Infrastructure was already complete in `SceneBackground { kind:'gradient', from, to, angle }` + Skia backend
- `ai-timeline` theme declares `sceneBackground: { kind:'gradient', from:'#EEF0FF', to:'#F8F0FF', angle:90 }` (top-to-bottom subtle lavender)
- SVG backend ignores `sceneBackground` per existing contract; Skia renders it via top-to-bottom linear gradient

**New theme: `ai-timeline`** (`packages/core/src/themes/ai-timeline.ts`)
- Tier-2 light theme, `entryStyle:'card'`, `fontSizeYearLabel:16`
- Gradient sceneBackground (#EEF0FF → #F8F0FF)
- Vivid per-status palette (purple planned, teal in-progress, amber done, red risk, etc.)
- Registered in `themes/index.ts` and `listThemeInfos()`

**New fixtures:**
- `examples/gallery/ai-timeline.timeline.yaml` — gallery-quality (4 milestones, 4 activities, single AI track, horizontal-safe)
- `examples/showcase/ai-timeline.timeline.yaml` — full dense version (12 milestones, 8 activities, 2 tracks) for vertical-spine showcase only (not scanned by quality gate)

**Horizontal tick-label density fix:**
- `horizontal.ts` now pre-computes `tickLabelVisible[]` before the tick loop; labels are skipped when `leftEdge < lastLabelRight + MIN_TICK_LABEL_GAP`, preventing overlap on 50+ year canvases

**Goldens touched:**
- `examples/gallery/showcase/ai-timeline-ai-theme-skia.png` — new T3 Skia golden (written by skia.test.ts)
- `examples/gallery/ai-timeline.svg`, `examples/gallery/ai-timeline.png` — regenerated with simplified gallery fixture

**Files changed:**
- `packages/core/src/themes/types.ts` — `fontSizeYearLabel?: number`
- `packages/core/src/themes/ai-timeline.ts` — new theme
- `packages/core/src/themes/index.ts` — registration
- `packages/core/src/layout/vertical-spine.ts` — colorOverride + yearFontPx/yearFontWeight
- `packages/core/src/layout/horizontal.ts` — activity.color precedence + tick-label density
- `packages/core/test/skia.test.ts` — T3 golden tests (5 tests)
- `examples/gallery/ai-timeline.timeline.yaml` — simplified gallery fixture
- `examples/showcase/ai-timeline.timeline.yaml` — full dense showcase fixture

**Test result:** 486/486 passing, typecheck clean, lint clean. T3 coverage: ✅

## 2026-06-11 — Target Gap Analysis + T3 Gap Close (Scribe Merge)

✓ **Decisions Merged + Session Complete**

**Decisions Merged into decisions.md:**
1. `barbara-target-gap-analysis-2026-06-11.md` — comprehensive 5-target evaluation; merged under "## Target Output Gap Analysis (2026-06-11)"
2. `barbara-t3-close.md` — T3 gap closure record; merged as two separate decisions
3. `mark-activity-color-field.md` — Activity.color decision; merged with IR Contract update

**Decision Merge Actions:**
- Added note in IR Contract section: "Activity now has optional `color?: string` (free CSS, unvalidated, parity with Milestone.color)"
- Updated Target Output gap-analysis section: T3 row status changed to CLOSED (shipped 2026-06-11)
- Removed "Agent Implementation Notes (Archived)" index from decisions.md (was pointing to decisions-archive.md; freed 2.9KB)
- Final size: 49826 bytes (< 51200 byte gate) ✅

**Archival:**
- Archival gate triggered after merge (52806 > 51200 bytes)
- Action: Removed archived index pointing to decisions-archive.md (no new entries archived)
- Inbox files deleted after merge

**Session logs written:**
- `.squad/orchestration-log/2026-06-11T13-19-01Z-mark.md` — Mark's work summary
- `.squad/orchestration-log/2026-06-11T13-19-01Z-barbara.md` — Barbara's work summary (gap analysis + T3 close)
- `.squad/log/2026-06-11T13-19-01Z-target-gap-analysis-and-t3.md` — session-level summary

**Agent histories updated:**
- Mark: Appended Activity.color implementation details + T3-3 closure context
- Barbara: Appended T3 gaps closure details + AI Timeline target coverage summary

**No history summarization needed:** Mark 14.4KB, Barbara 10.1KB (both < 15KB threshold)

**Quality gates:**
- All 495 monorepo tests passing ✅
- typecheck + lint clean ✅
- No regressions detected ✅

---