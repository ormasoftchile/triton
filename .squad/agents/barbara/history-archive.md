# Barbara History Archive (Pre-2026-06-11)

## Session Summary — 2026-06-09 through 2026-06-10

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

## Known Issues & Deferred Work (2026-06-10)

- **Advanced icon badge styles** (outline, border): Current implementation uses solid filled circle; can be made configurable via theme tokens
- **Vertical-spine layout:** Ready for Phase 3; prioritized for agent/ingester integration
- **Serpentine layout:** Post-MVP; prioritized for later phases
- **Art effects** (Tier 2/3): Deferred to Phase 4
- **PPTX backend:** Deferred to Phase 4; will use isolated subprocess pattern with pptxgenjs (not python-pptx)

## Target Output Coverage Map (2026-06-10)

| Target | Verdict | Key Blockers |
|--------|---------|--------------|
| T1 Horizontal Numbered | 🟡 Partial | Alternating above/below placement, logo slot |
| T2 Vertical Spine Dark | 🟡 Partial | Per-segment spine color, far-edge badges, multi-block descriptions |
| T3 AI Timeline Dense | 🔴 Not Yet | Activity.color field, fontSizeYearLabel token, gradient background |
| T4 Serpentine Glow | 🔴 Not yet | Serpentine layout (deferred post-MVP per decisions) |
| T5 Gitline Cards | 🟡 Partial | CTA button from url, inline date icon |

## Known Gaps (2026-06-10)

1. **T3-3: Activity.color** — enables 12+ accent palette without categoryMap boilerplate (Mark, S)
2. **T5-1: CTA button rendering** — renders activity.url as pill button (Barbara, M)
3. **T2-1: Per-segment spine color** — distinct spine colours between nodes (Barbara/Mark, M)
4. **T1-1: Alternating milestone placement** — above/below baseline layout mode (Barbara, M)
5. **T4-1: Serpentine layout** — explicitly deferred to post-MVP (Barbara, L)

---

*Archived from main history.md on 2026-06-11T15:33:14Z to maintain 15KB threshold.*
