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

## 2026-06-11 — Skia Glow Artifact + Legend Color Fixes

**Two production defects diagnosed and fixed in Skia/PNG backend + showcase theme combination.**

### Defect 1 — Rectangular glow/shadow artifact on vertical-spine milestone nodes

**Root cause: `TileMode.Clamp` in `renderWithEffects` (`skia.ts`).**

`CK.ImageFilter.MakeBlur` was called with `CK.TileMode.Clamp` for both glow and shadow effects. For a filled rectangle, CanvasKit's Clamp tile mode replicates the rectangle's fill color at every pixel beyond the blur expansion margin (~3×sigma = 15px from rect edge). This produced a hard, full-opacity shadow band in the connector zone between the node circle and the card rect — even though those pixels are 15px outside the card.

Circles were unaffected: their bounding-box corners are transparent, so Clamp ≡ Decal for circles (clamping transparent = transparent).

**Pixel-confirmed:** Before fix, x=644=(4,178,217) → x=645=(2,83,101) — a hard dark step exactly matching the shadow paint blended over the connector: `0.533 * black + (1-0.533) * connector ≈ (2,83,101)`. After fix, x=644=(4,178,217) → x=645=(4,178,217) — smooth connector, no step.

**Fix:** Change both `MakeBlur` calls in `renderWithEffects` from `CK.TileMode.Clamp` to `CK.TileMode.Decal`. Decal treats out-of-bounds pixels as transparent `(0,0,0,0)`, giving natural Gaussian falloff with no hard boundary. `TileMode.Decal` is available in canvaskit-wasm 0.41.x.

### Defect 2 — Indistinguishable legend colors (in-progress / planned / standard-node)

**Root cause: theme palette — `showcase.ts` assigned identical/near-identical colors.**
- `planned.fill = CYAN (#00D4FF)` and `standard-node.fill = CYAN (#00D4FF)` — identical.
- `in-progress.fill = CYAN_DIM (#0099CC)` — very similar cyan, visually indistinguishable at 12px swatch size.

The legend code in `vertical-spine.ts` uses raw `theme.statusMap[s].fill` and `theme.categoryMap[c].fill` (not `resolveStatusStyle`), so any category override doesn't rescue the legend — the palette itself was wrong.

**Fix:** Introduced two new palette constants:
- `BLUE_SCHED = '#4D9AFF'` — periwinkle blue (for planned)
- `TEAL_ACTIVE = '#00CC88'` — teal green (for in-progress)

Reassigned: `planned → BLUE_SCHED`, `in-progress → TEAL_ACTIVE`, `standard-node → CYAN` (primary accent unchanged), `done → STEEL` (unchanged). Legend now has four visually distinct swatches: grey-blue / teal-green / periwinkle-blue / electric-cyan.

**Pixel-confirmed:** Swatch centers (996, 414/435/455/476) read (96,125,155) / (0,204,136) / (77,154,255) / (0,212,255) — exactly the expected hex values.

### Additional changes
- Showcase Skia golden test updated to use `layout: 'vertical-spine'` (the showcase theme's intended layout; previous test used horizontal default, producing a mismatch between the committed golden and the described defect).
- Gallery showcase images regeneration tests added (4 PNGs: milestones-only, journey, feature-rich, ai-timeline).
- All goldens regenerated fresh.
- **All 465 tests pass.**

### Skia blur rendering mental model
- `TileMode.Clamp`: edge pixels of the layer replicate their nearest in-bounds color — creates hard boundary for filled shapes.
- `TileMode.Decal`: pixels outside the layer bounds are treated as fully transparent — correct for drop shadows and glows where you want smooth natural falloff.
- Rule: **always use `TileMode.Decal` for glow/shadow ImageFilter blurs on Scene primitives**.

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

---

## Learnings

### 2026-06-11 — Activity Icon Rendering (Step 2 of 2)

**Semantics chosen:**

Activity icons render as a small glyph at the **left (start) edge** of the activity bar, vertically centred inside the bar. This mirrors how milestone icons sit inside their node markers — icon always anchored to the activity's "origin point".

**Icon size rule:**
- `iconPx = theme.activity.barHeight − 4` (2 px top/bottom padding)
- Scale transform: `s = round((iconPx / 2) / 12, 4)` — same formula as milestone nodes (`ms.size * iconScale / 12`) with `iconScale = (barHeight−4)/barHeight`
- For the consulting theme (barHeight=20 px): iconPx=16 px; s=0.6667
- Transform string: `translate(iconCX, barMidY) scale(s) translate(-12,-12)` — identical geometry contract as milestones

**Label shift:**
- When an icon is drawn, the label's left edge shifts right by `iconGutterW = iconPx + LPAD (4 px)` = 20 px for a 20 px bar. Inside-available width shrinks correspondingly.

**Degenerate cases:**
- `getIcon(activity.icon) === undefined` → no icon emitted (no-op), label unchanged
- `activity.icon` absent → no icon emitted (no-op)
- Bar too narrow (`al.width < iconPx + 2*LPAD`) → icon skipped silently; label uses full bar width
- Outside label placement (bar extremely narrow) → icon is skipped for that bar, label goes outside unchanged

**Vertical-spine layout:**
- Activities were already typed with `iconHint?` in `SpineEntry` but the field was never populated. Fix: one-line addition `iconHint: act.icon` in the activity entry builder.
- The existing icon-badge and node-icon rendering code (lines 775–814 and 860–882 in vertical-spine.ts) handles both milestones and activities identically once `iconHint` is set — no backend changes needed.

**Backends:**
- SVG: no change needed — `PathPrimitive` with `transform` already renders correctly (same as milestones)
- PNG: no change needed — resvg handles SVG path transforms
- Skia: no change needed — `renderWithEffects` / `drawPath` already handles `PathPrimitive` transforms

**Layout phase:**
Phase 3 (Activity geometry) produces `ActivityLayout` records. Icon primitives are emitted in **Phase 6** (Activity bars) of `layoutHorizontal`, immediately before the label block. In `layoutVerticalSpine`, icon primitives flow through the existing `SpineEntry.iconHint` path in Phase 5 (card blocks) and Phase 7 (node markers).

**Files touched:**
- `packages/core/src/layout/horizontal.ts` — replaced activity label block with icon+label block
- `packages/core/src/layout/vertical-spine.ts` — added `iconHint: act.icon` to activity SpineEntry construction
- `examples/gallery/feature-rich.timeline.yaml` — added `icon:` to 5 activities (star, cloud, lock, people, gear)
- `examples/gallery/journey.timeline.yaml` — added `icon:` to 3 activities (code, people, rocket)
- `examples/gallery/feature-rich.svg` and `.png` — regenerated (11 icon transforms: 6 milestone + 5 activity)
- `examples/gallery/journey.svg` and `.png` — regenerated (8 icon transforms: 5 milestone + 3 activity)
- `examples/gallery/showcase/*.png` — regenerated by Skia gallery test (feature-rich, journey)
- `packages/core/test/icons.test.ts` — added 10 new activity-icon tests in section (g)

**Test results:** 478/478 pass (was 468; +10 new).

## 2026-06-11 — Activity Icon Feature Implementation (Steps 1–2)

✓ **Activity Icon Rendering Complete**

Implemented activity icon rendering on all three layout families (horizontal, vertical-spine) and all backends (SVG, PNG/resvg, Skia). Feature shipped with 486/486 monorepo tests passing.

### Step 1: Mark's IR Extension
Received `Activity.icon?: string` field from Mark. No validation surprises — icon names match Milestone behavior (silent fallback for unknowns). Handoff clear and clean.

### Step 2: Rendering Implementation

**Horizontal layout:**
- Icons drawn at **left edge of activity bar**, vertically centered
- Icon size = `barHeight − 4` (2px padding top/bottom)
- SVG transform: `translate(iconCX, barMidY) scale(s) translate(-12, -12)` (same as milestone)
- Label shifted right by `iconGutterW = iconPx + 4px` to avoid overlap
- Outside-placement logic unchanged (when label goes outside bar)

**Vertical-spine layout:**
- Icons flow through existing SpineEntry paths (icon badge + node icon)
- No new path primitives required
- `iconHint: act.icon` populated in SpineEntry for both badge and node rendering

**Backend compatibility:**
- All three backends (SVG, PNG/resvg, Skia) handle icon PathPrimitive transparently
- No backend-specific code needed

**Files changed:**
- `packages/core/src/layout/horizontal.ts`: Replaced label block with icon+label block; added size formula
- `packages/core/src/layout/vertical-spine.ts`: Added `iconHint: act.icon` to SpineEntry
- `examples/gallery/feature-rich.timeline.yaml`: Added 5 activity icons
- `examples/gallery/journey.timeline.yaml`: Added 3 activity icons
- `examples/gallery/*.{svg,png}`: Regenerated
- `packages/core/test/icons.test.ts`: Added 10 activity-icon rendering tests

**Test result:** 486/486 monorepo tests passing; all gallery goldens regenerated and verified.

### Concurrent Work: Skia Rendering Fixes

Fixed two critical Skia backend issues:

**Issue 1: Glow/Shadow Artifact (TileMode.Clamp)**
- Root cause: ImageFilter.MakeBlur using `TileMode.Clamp` for blur expansion
- For rectangles: Clamp replicates fill color at boundaries → hard shadow band in connector zone (vertical-spine)
- For circles: Invisible (corners are transparent)
- Fix: Use `TileMode.Decal` for all blur calls (transparent falloff, semantically correct)
- File: `packages/core/src/render/skia.ts`
- Confirmed: canvaskit 0.41.x has TileMode.Decal

**Issue 2: Legend Color Ambiguity (Showcase Theme)**
- Root cause: Palette assigned CYAN to both `planned` and `standard-node`; CYAN_DIM to `in-progress`
- At 12px legend swatch size: effectively indistinguishable
- Legend read directly from `theme.statusMap` and `theme.categoryMap` — not subject to `resolveStatusStyle` overrides
- Fix: Palette now uses perceptually distinct colors:
  - `planned → BLUE_SCHED (#4D9AFF)` periwinkle
  - `in-progress → TEAL_ACTIVE (#00CC88)` teal
  - `standard-node → CYAN (#00D4FF)` electric cyan
  - `done → STEEL (#607D9B)` unchanged
- File: `packages/core/src/themes/showcase.ts`

**Also changed:** Showcase golden test now uses `layout: 'vertical-spine'` explicitly (matches theme design intent).

**Test result:** 465/465 tests passing; pixel evidence confirms fixes (no hard shadow band, legend colors now distinct).

### Decision Records

Three decision records created and merged into decisions.md (from inbox):
1. **mark-activity-icon-field.md** — validation parity decision
2. **barbara-activity-icon-render.md** — placement semantics, size rules
3. **barbara-skia-glow-legend.md** — TileMode.Decal ruling, palette fix

All decisions documented for future maintainability and cross-team consistency.
