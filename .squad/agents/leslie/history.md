# Leslie — Spec Architect

**Owner:** Leslie (Spec Architect)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-13T15:53:53Z

---

## Current Role

Design domain-specific IR shapes for deterministic diagram compilers. Establish grammar specs that are implementable and principled. Composition-layer architecture.

---

## Strategic Context (Summarized)

- **Product focus:** Deterministic, themeable, agent-authorable DIAGRAM COMPILER (not timeline-only).
- **Two-IR-layer architecture:** Domain IRs (grammar-specific) compile to Scene IR (universal primitives). All styling in themes.
- **Grammar governance:** Each grammar specifies semantics (layout determinism rationale), IR shape (no styling), and deferred schema/rendering questions.
- **De-risked sequencing:** Sequence chosen before Flow because layout is deterministic-by-construction (no iterative algorithms).

For detailed specs and design notes from earlier grammars (Sequence, Tree, Flow up to 2026-06-13 10:00Z), see `leslie/history-archive.md`.

---

## Grammar Status (2026-06-13)

| Grammar | Spec File | Status | IR Shape | Layout Algo | Schema | Rendering |
|---------|-----------|--------|----------|-------------|--------|-----------|
| **Timeline** | design/sections/20-timeline.tex | ✅ COMPLETE | ✅ | ✅ (5 layout families) | ✅ | ✅ |
| **Sequence** | design/sections/26-sequence.tex | ✅ COMPLETE | ✅ | ✅ (deterministic by order) | ✅ Mark | ✅ Barbara |
| **Tree** | design/sections/27-tree.tex | ✅ COMPLETE | ✅ (recursive children-list) | ✅ (B–J–L O(n)) | ✅ Mark | ✅ Barbara |
| **Flow** | design/sections/25-flow.tex | ✅ COMPLETE | ✅ (flat node/edge) | ✅ (Sugiyama 4-phase LR) | ✅ Mark | ✅ Barbara |
| **Composition** | design/sections/30-composition.tex | ✅ COMPLETE | ✅ (grid-based IR) | ✅ (deterministic) | 🚧 Awaiting Mark | 🚧 Awaiting Barbara |

**Milestone:** All four grammar specs finalized as of 2026-06-13.

---

## Current Work — Composition Layer (Complete Spec)

### What's Specced

**Artifact:** design/sections/30-composition.tex (enriched from sketch to full spec)

**IR Shape:**
- CompositionDocument: version, metadata, grid (columns, rows, gap, padding), cells[]
- Cell: id, row/col, rowSpan/colSpan, title/caption, content: CellContent
- CellContent: discriminated union (grammar | stat | text | title | image)
- GrammarContent: grammar name + inline ir OR ir_file reference

**Embed Algorithm:**
1. Compile each cell's content → independent sub-Scene
2. Grid sizing: column widths = max(sub-scene widths per column); row heights analogous
3. Uniform scale factor s = min(W_cell/w_scene, H_cell/h_scene), capped at 1.0
4. Center sub-Scene in cell rect; apply translateAndScale() to all primitives
5. Merge in painter's order → single Scene

**Worked Example:** RAG Architecture Poster (2×2 grid with flow, sequence, tree, stat) — verified clean composite output

### Blocking Points for Inc-1

**Mark (Schema):**
- CompositionDocument JSON Schema (discriminated union for CellContent)
- ir_file URI schemes (pkg:, file:, http:)
- Two-pass validation strategy (composition → sub-grammar)

**Barbara (Rendering):**
- Kernel helper `translateAndScale()` in packages/core/src/scene-transform.ts
- Handles all primitive kinds + Path d-string transformation + StrokeGradient coords + recursive GroupPrimitive
- Critical path: Once implemented, composition inc-1 rendering engine ships

### Deferred to Inc-2+

- Named grid tracks (CSS Grid style)
- Advanced scale policies (clip, overflow)
- Freeform/custom layout modes
- Deep nesting (depth > 3)

---

## Open Questions (For Mark/Barbara Intake)

**Mark:**
- Discriminated union syntax options (single `kind` field vs. separate keys)?
- ir_file URI scheme coverage and priority (pkg:, file:, http: all needed, or subset)?
- Validation rule precision (nested validation, XGrammar constraint grammar for ir_file)?

**Barbara:**
- Path d-string coordinate parsing strategy (regex, manual parser, or library)?
- StrokeGradient transformation constraints (linear only, or radial too)?
- GroupPrimitive recursive descent depth limit for safety?

---

## Archive

For detailed context from earlier sessions (Sequence spec, Tree spec refinement, Flow spec, de-risked grammar sequencing decision), see `leslie/history-archive.md`.

---

## Next Steps

1. **Mark:** CompositionDocument schema finalization (expected next turn)
2. **Barbara:** Kernel helper implementation (estimated 2–3 hours after schema)
3. **Leslie:** Awaits Mark/Barbara for composition inc-1 implementation kickoff

---

## 2026-06-13 — MILESTONE: Composition Layer Implemented End-to-End (Scribe)

**Date:** 2026-06-13T12:01:44Z  
**Status:** SHIPPED

### What Shipped

Barbara completed composition layer increment-1 (commit 9c092cc). The implementation validates the entire two-IR-layer architecture:

**Kernel Helper:** `packages/core/src/scene-transform.ts`
- `translateAndScale()` handles all 8 Scene primitive kinds
- `transformPathD()` parses/transforms SVG path d-strings (M/L/H/V/C/S/Q/T/A/Z commands)
- `embedSceneInRect()` fits sub-scenes to grid cells (scale capped at 1.0)
- Rounding via `rhu(2dp)` matching all existing layout engines

**Composition Module:** `packages/core/src/composition/` (types/schema/layout/theme/index pattern)
- Grid-based layout: column widths = max(sub-scene widths per column)
- Cell content compilation: each cell's grammar IR → independent sub-Scene
- Fit+center embed: uniform scale per cell, capped at 1.0
- Theme-driven chrome: poster title bar, per-cell title bars, 20px gaps, dark background

**Gallery:** `examples/gallery/poster-rag-architecture.composition.yaml`
- 2×2 RAG Architecture poster combining flow + tree + sequence + stat callout
- 1200×1062 px SVG + 67 KB PNG output
- Validates integration across all four shape grammars

### Architecture Validation

The implementation confirms:
1. **Domain IR → Scene IR pipeline works** — each cell's grammar IR compiles independently, then merges in painter's order
2. **Determinism verified** — no RNG in composition layout, same input → identical SVG hash
3. **Scale policy enforced** — fit policy never upscales, maintaining visual fidelity
4. **Grammar ≡ Semantics; Theme ≡ Style** — composition layer is styling-free, all chrome is theme-driven

### Test Results

- **694/694 tests pass** (669 prior core + 25 new composition)
- **All 669 prior goldens byte-identical** (translateAndScale used only by composition)
- New fixtures: poster-rag-architecture (svg + png)

### Deferred (Increment-2+)

- `ir_file` URI references (pkg:, file:, http:)
- Named grid tracks (CSS Grid style)
- Nested composition cycles (depth limit enforcement)
- Alt grid backends (CSS Grid, canvas native rendering)

### End-to-End Status

| Layer | Grammars | Status |
|-------|----------|--------|
| **Shape Grammars** | Timeline (5 themes), Flow (Sugiyama), Sequence (2 themes), Tree (B–J–L) | ✅ |
| **Scene Kernel** | 8 primitives, 3 backends (SVG/PNG/Skia) | ✅ |
| **Composition** | Grid-based multi-diagram posters | ✅ |
| **Determinism** | No RNG, all closed-form layouts | ✅ |

**Vision complete.** The deterministic diagram compiler is now functional end-to-end: all four grammars (timeline, flow, sequence, tree) + shared Scene kernel + theme-driven styling + composition layer for multi-diagram posters.

---

## 2026-06-13 — Design Doc Synced with Implementation (Leslie)

**Date:** 2026-06-13T17:45:35-04:00  
**Status:** COMPLETE

Added concise "Implementation status" paragraphs to the design document, syncing specs with the now-implemented reality. Each status note (1–3 sentences) appears immediately after the section introduction, indicating what is built, where it lives (file paths), and any deferred features.

### Sections Updated

- **21-timeline-grammar.tex** — all four layout families (horizontal, vertical-spine, serpentine, roadmap); ByteByteGo + dark rendering; arc-spine nodes
- **25-flow-grammar.tex** — Sugiyama four-phase layout; cycle detection, longest-path rank, barycenter crossing-min; FlowTheme + dark; **deferred:** force-directed, stress-majorization
- **26-sequence-grammar.tex** — participant/message/activation/fragment IR; all fragment kinds + multi-guard alt; self-message curves; stereotypes; SequenceTheme + ByteByteGo
- **27-tree-grammar.tex** — Buchheim–Jünger–Leipert O(n) tidy-tree; recursive nesting; TreeTheme + dark
- **30-composition.tex** — grid-based layout; \texttt{scene-transform.ts} kernel helpers; content-driven row sizing; CompositionTheme + dark-poster; **deferred:** ir\_file external URI references (pkg:, file:, http:)
- **14-animation.tex** — optional Scene animation field; SVG SMIL \texttt{<animate>}/\texttt{<animateMotion>}; raster resting-frame byte-identical; flowing dashes on flow edges

### Learnings

1. **Doc as living record:** The design document now carries both spec and implementation status in a single place, improving traceability from principle to code.
2. **Two-IR-layer validated:** All six sections confirm the grammar ≡ semantics; theme ≡ style discipline holds across timeline, flow, sequence, tree, composition, and animation.
3. **Deferred features clearly marked:** Future work (general non-layered flow layouts, ir_file URI refs, interactive animation) is explicit in the doc, reducing ambiguity.
4. **Determinism preserved:** Animation implementation maintains byte-identical SVG hashes; raster backends render static resting frames without branching.

---

## 2026-06-13 — Design Doc Restructured for Mermaid-Superset Positioning (Leslie)

**Date:** 2026-06-13T19:25:34-04:00  
**Status:** COMPLETE

Major restructure of the LaTeX design document around the new product positioning: **full Mermaid superset** with differentiation on aesthetics, UML/software line, and agent IR.

### New Document Structure (8 Parts, was 6)

| Part | Title | Key Content |
|------|-------|-------------|
| I | Thesis & Positioning | Problem (Mermaid ubiquitous but ugly); central thesis; principles; scope; sharpened comparison |
| II | The Front-End | **NEW** — Dual front-end (Mermaid DSL + structured IR); full 22-type compat strategy; superset extensions |
| III | The Kernel | Scene IR, backends, determinism, animation (recontextualized) |
| IV | The Diagram Families | 5-family taxonomy; 22-type coverage; per-family grammar specs (4 built + chart layer spec) |
| V | Aesthetics & Theming | **ELEVATED** — Aesthetic bar as first-class pillar; theme architecture |
| VI | Composition | Posters/grids/refs (existing) |
| VII | Architecture & Packaging | Layered arch incl. parser layer; agent surface (MCP/SDK/CLI) |
| VIII | Roadmap & MVP | **NEW** — Tier 0→3 coverage roadmap; reframed MVP |

### New Section Files Created

- `05-comparison.tex` — Positioning matrix vs Mermaid/PlantUML/D2/Vega-Lite
- `15-frontend.tex` — Dual front-end architecture (DSL + structured IR convergence)
- `16-mermaid-compat.tex` — All 22 Mermaid types; compatibility strategy; kernel reuse
- `17-superset-extensions.tex` — Poster keyword, rich theming, animation, cross-refs, icons
- `18-aesthetics.tex` — Aesthetic bar; design system; default theme craft; verification
- `28-family-taxonomy.tex` — 5 families; per-family types/kernel/status; tier definitions
- `29-chart-family.tex` — Grammar-of-graphics layer for pie/xy/quadrant/radar
- `60-roadmap.tex` — Tiered roadmap; reframed MVP = Tier 0 complete + aesthetic bar

### Learnings

1. **Positioning drives structure:** The Mermaid-superset positioning naturally organizes into front-end (how we accept Mermaid), families (how we cover 22 types), and aesthetics (how we beat Mermaid visually). These became Parts II, IV, V.
2. **Aesthetics as architecture:** Elevating aesthetics to its own Part (not buried in themes) reflects the strategic decision that "looking better" is the primary reason users switch.
3. **Family taxonomy = roadmap taxonomy:** The 5-family / 4-tier structure serves both the technical architecture (shared kernels) and the product roadmap (prioritization).
4. **Dual front-end is the key new concept:** The parser layer (Mermaid DSL → Domain IR) is the major new architectural component; everything below it (Domain IR → Scene IR → backends) is proven and built.
5. **Most new types need only parsers:** Of 22 types, the 5 Tier-0 types only need parsers (kernels exist), Tier-1 UML needs new IRs + layouts, and only Tier-2 charts require a genuinely new kernel.
Tier 1 complete (class/state/er/c4)
## 2026-06-14 — Tier 2 Complete

Tier 2 complete (pie/xychart/quadrant/radar). Quadrant + radar implemented on shared foundation. Quadrant: tinted regions, edge-aware non-clipping labels (defects fixed). Radar: radial scale, dual-syntax parser (Mermaid radar-beta + doc form). 1425/1425 tests ✓. Commits 5b709cf (foundation+pie+xy), ecfc418 (quadrant+radar).
## 2026-06-14 — Tier 3 Started

Tier 3 started (journey/gitGraph). journey: horizontal score-ramp with section bands + actor legend. gitGraph: per-branch lanes with merge curves, tags, commit types. 1503/1503 tests ✓. Commit a2a1b37. Remaining Tier 3: sankey (in progress), then breadth.

**2026-06-14:** Real-Mermaid fidelity pass: 6 diagram types fixed & A/B-verified (gitGraph, journey, mindmap, sankey, gantt, timeline).
