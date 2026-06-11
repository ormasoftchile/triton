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
- TIGHT_SPACING linter: 5px gap detection with union-find grouping for same-block labels.

## Major Milestones

### 2026-06-09 — Sections 5–7 (Design Spec Wave 1)
- Determinism contract: six-phase pipeline, binding for all renderers
- Edge-case rulings (zero-duration, TBD, approximate dates, partial overlap, etc.)
- Theme schema knobs + five built-in themes (Consulting, Executive, Product, Release, Minimal)
- Output priority: SVG → PNG → PDF → PPTX → HTML

### 2026-06-10 — IR Gaps Resolved (Wave 2)
- metadata.today (date anchor for determinism)
- metadata.fiscal_year_start (fiscal calendar normative)
- Omitted end semantics = ongoing open interval
- Relative-date anchor (same chain as now: today → created → error)
- Status: All 17 IR invariants consistent; no redesign needed

### 2026-06-10 — Scene/Render IR Architecture Rework
- Demoted SVG to one backend; introduced backend-agnostic Scene/Render IR as root
- Four fidelity tiers with capability profiles and fallback policies
- Determinism levels: Scene geometry (always), per-backend output (given pinned version), cross-backend (not promised)
- Themes: Minimal (T0), Consulting/Release (T1), Executive/Product (T2), Showcase/Keynote (T3 new)

### 2026-06-10 — Phase 1 Implementation: Layout + SVG/PNG + Consulting Theme
- Deliverables: Scene IR, layout engine (six-phase), Consulting theme, text metrics, SVG/PNG backends, `renderDocument` wiring
- Determinism approach: stable sorts, round-half-up, day-ordinal arithmetic, hardcoded font metrics, canonical JSON → SHA-256
- Embedded font: DejaVu Sans (OFL)
- Green status: 0 typecheck errors, 0 lint warnings, 110/110 tests, all builds pass

### 2026-06-10 — Target Outputs Coverage Analysis (§14)
- Five reference images map to three layout families: horizontal (current), vertical-spine (T1,T3,T5), single-line milestones (T2)
- IR coverage: All five targets representable; no new IR gaps
- Layout coverage: 1/5 current pipeline; 3/5 need vertical-spine; 1/5 serpentine (post-MVP)
- Prioritised additions: vertical-spine, dark-executive/showcase-dark themes, card entry renderer, numbered-circle milestone shape

### 2026-06-10 — Phase 1 Example Gallery
- 8 example IR documents + rendered SVG/PNG outputs + index.html contact sheet
- Gallery location: `examples/gallery/`
- Renderer limitations surfaced: progress not visualized, track labels invisible (headerWidth=0), TBD stub (low info density), validator edge cases, YAML integer parsing
- No source changes; all examples within Phase 1 capabilities

### 2026-06-10 — Built-in Icon Set + Label Collision Stagger
- Icon registry: 20 original geometric icons on 0 0 24 24 viewBox (hand-authored, no licensing issues)
- Export: getIcon(), hasIcon(), listIcons()
- Scene/SVG updates: PathPrimitive now accepts optional transform and strokeLinecap
- Theme tokens: iconColor, iconScale (optional, opt-in)
- Icon rendering: horizontal layout (nodes) + vertical-spine layout (badges + nodes)
- Milestone label stagger: deterministic O(n) pass for date labels (adjacent sorted by x, colliding odd-indexed labels shift up)
- Examples updated: journey, program-timeline, feature-rich + new icon-showcase
- Tests: 68 icon tests; 292 core tests pass; 299 total

### 2026-06-10 — Layout Quality Polish Pass
- Activity-bar label placement: inside when fits (contrast-aware color), outside-right when narrow, clamped to canvas bounds
- Dense overlap / sub-lane packing: deterministic greedy interval-packing (sorted by start_ordinal, id)
- Title/header block: renders ir.metadata.title at top; plot/spine shifts down by headerH; opt-in (absent title = no change)
- Trade-offs: track heights grow with overlap depth (legibility over compactness); all heights +headerH when title present; subLaneHeight increase is minor visual change
- Artifacts regenerated; 304 tests green; determinism verified

### 2026-06-10 — Dense Milestone Decluttering + Alternating Label Blocks
- Dense milestone fix: limited date-label characters, two-pass collision resolution, smart positioning
- Alternating label blocks: horizontal layout uses offset alternation; vertical-spine uses card entry renderer
- Section renderers: horizontal layout places inline; vertical-spine renders as separate entry types
- Results: deterministic multi-phase pipeline for label collision; all examples render without warnings

### 2026-06-10 — Phase 1 Render Completion (SVG/PNG)
- Phase 1 scope: horizontal swimlane layout, consulting theme, SVG+PNG backends
- Verification: 100+ new tests, golden image snapshots (our-timeline.svg, our-timeline.png), cross-render pixel consistency
- All 110/110 tests pass; determinism verified

### 2026-06-10 — Render Backends & Output Format Selection
- SVG: deterministic, universal, scalable; foundation for all other formats
- PNG: universal raster via @resvg/resvg-js (deterministic, embedded DejaVu Sans)
- PDF: consulting/print use case; cairosvg deterministic
- PPTX: think-cell editability via python-pptx native shapes (highest complexity)
- HTML: developer/agent preview; trivially derived from SVG
- Selection criteria: output use case, determinism requirement, target fidelity tier
- Theme adoption matrix: which themes for which backends/outputs

### 2026-06-10 — Render Fixes & Edge Cases
- Milestone stacking: simultaneous milestones stack downward by stack_offset_y (sorted by id)
- Approximate date rendering: nominal geometry + gradient fade at approximate edges
- Clipping indicator: angled cut on clipped edges
- TBD extension: dashed extension + label (vs stub)
- Sub-lane cap handling: excess activities go to last lane with warning
- Canvas boundary clamping: labels clamped to canvas bounds, no overflow
- Determinism verified across all edge cases

### 2026-06-10 — Skia C++ Backend (Showcase Theme Effects)
- Skia Graphics Library: deterministic per pinned canvaskit-wasm version
- Setup: canvaskit-wasm initialization (~2–3s), deterministic canvas ops, no system entropy
- Showcase theme effects: drop shadows (blur + offset + dark copy), glow (blur + colored copy), noise texture
- renderWithEffects pattern: before drawFn(), render each effect; all deterministic
- Golden approach: first run writes showcase-skia.png; subsequent runs byte-identical (fallback: ±5% size tolerance)
- Gallery: showcase.html dark contact sheet with captions (backend=skia, theme=showcase)
- Final count: 461 tests pass

### 2026-06-10 — IR Schema & Validation
- Canonical IR fields: version, metadata, tracks, groups, activities, milestones, annotations, sections, legend
- Metadata fields: title, subtitle, author, created, today, fiscal_year_start, time_range
- Validation layer: schema checks, date anchor resolution, reference resolution, progress bounds
- Error message contract: deterministic, agent-friendly error reporting
- Ingestion contract: IR must be valid; optional provenance metadata; no implicit state

### 2026-06-10 — Team Coordination Notes
- Design spec sections published (§5–7, then §14)
- IR gaps resolved surgically (metadata.today, fiscal_year_start, omitted end, relative-date anchor)
- All 17 IR invariants consistent across Rendering, Agent Integration (Bjarne), and IR spec (Mark)
- Output coverage analysis: 5 targets map to 3 layout families; prioritised roadmap established

---

## 2026-06-11 — Session Recovery (Crash + Decision Inbox Merge)

**Incident:** Prior session hung mid-task investigating TIGHT_SPACING warnings.

**Status:** Tight-spacing fix verified complete (CONNECTOR_LEN: 48→58px, vertical-spine layout, all 5 themes pass, 461/461 core tests green). Result: 8px clear gap between axis tick labels and content block edges.

**Inbox Merge:** All 21 barbara-*.md decision notes merged into `.squad/decisions.md` with timestamp marker "Agent Decisions — Merged from Inbox (2026-06-10 Backlog)". Inbox files deleted. Deduplication complete.

**Pipeline:** Full test suite (484 tests) remains green. No regressions.

---

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
