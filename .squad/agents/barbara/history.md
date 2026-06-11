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
