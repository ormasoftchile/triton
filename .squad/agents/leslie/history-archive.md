# Leslie — History Archive

**Owner:** Leslie (Spec Architect)  
**Project:** timeline — deterministic diagram compiler  
**Archive Date:** 2026-06-14 (consolidated for size)

---

## 2026-06-13 — MILESTONE: Composition Layer Implemented End-to-End (Scribe)

**Date:** 2026-06-13T12:01:44Z  
**Status:** SHIPPED

### What Shipped

Barbara completed composition layer increment-1 (commit 9c092cc). The implementation validates the entire two-IR-layer architecture:

**Kernel Helper:** `packages/core/src/scene-transform.ts`
- `translateAndScale()` handles all 8 Scene primitive kinds
- `transformPathD()` parses/transforms SVG path d-strings
- `embedSceneInRect()` fits sub-scenes to grid cells
- Rounding via `rhu(2dp)` matching all existing layout engines

**Composition Module:** `packages/core/src/composition/`
- Grid-based layout; cell content compilation
- Fit+center embed; theme-driven chrome

**Gallery:** `examples/gallery/poster-rag-architecture.composition.yaml` (2×2 RAG Architecture poster; 1200×1062 px)

### Test Results
- **694/694 tests pass** (669 prior core + 25 new composition)
- All prior goldens byte-identical
- New fixtures: poster-rag-architecture (svg + png)

### End-to-End Status
| Layer | Grammars | Status |
|-------|----------|--------|
| **Shape Grammars** | Timeline (5 themes), Flow (Sugiyama), Sequence (2 themes), Tree (B–J–L) | ✅ |
| **Scene Kernel** | 8 primitives, 3 backends (SVG/PNG/Skia) | ✅ |
| **Composition** | Grid-based multi-diagram posters | ✅ |
| **Determinism** | No RNG, all closed-form layouts | ✅ |

**Vision complete.** The deterministic diagram compiler is now functional end-to-end.

---

## 2026-06-13 — Design Doc Synced with Implementation (Leslie)

**Date:** 2026-06-13T17:45:35-04:00  
**Status:** COMPLETE

Added "Implementation status" paragraphs to the design document, syncing specs with the now-implemented reality.

### Sections Updated
- **21-timeline-grammar.tex** — all four layout families
- **25-flow-grammar.tex** — Sugiyama four-phase layout
- **26-sequence-grammar.tex** — participant/message/activation/fragment IR
- **27-tree-grammar.tex** — Buchheim–Jünger–Leipert O(n) tidy-tree
- **30-composition.tex** — grid-based layout
- **14-animation.tex** — optional Scene animation field

### Learnings
1. Doc as living record improves traceability from principle to code
2. Two-IR-layer validated across all sections
3. Deferred features clearly marked; determinism preserved

---

## 2026-06-13 — Design Doc Restructured for Mermaid-Superset Positioning (Leslie)

**Date:** 2026-06-13T19:25:34-04:00  
**Status:** COMPLETE

Major restructure of the LaTeX design document around the new product positioning: **full Mermaid superset** with differentiation on aesthetics, UML/software line, and agent IR.

### New Document Structure (8 Parts, was 6)
| Part | Title |
|------|-------|
| I | Thesis & Positioning |
| II | The Front-End (NEW) |
| III | The Kernel |
| IV | The Diagram Families |
| V | Aesthetics & Theming (ELEVATED) |
| VI | Composition |
| VII | Architecture & Packaging |
| VIII | Roadmap & MVP (NEW) |

### New Section Files
- `05-comparison.tex` — Positioning vs Mermaid/PlantUML/D2/Vega-Lite
- `15-frontend.tex` — Dual front-end architecture (DSL + structured IR)
- `16-mermaid-compat.tex` — All 22 Mermaid types; compatibility strategy
- `17-superset-extensions.tex` — Poster, rich theming, animation
- `18-aesthetics.tex` — Aesthetic bar; design system; default theme
- `28-family-taxonomy.tex` — 5 families; per-family types; tier definitions
- `29-chart-family.tex` — Grammar-of-graphics layer
- `60-roadmap.tex` — Tiered roadmap; reframed MVP

### Key Learnings
1. Positioning drives structure (front-end, families, aesthetics)
2. Aesthetics as first-class architecture pillar
3. Family taxonomy = roadmap taxonomy
4. Dual front-end (parser layer) is the key new architectural concept
5. Most new types need only parsers; Tier-1 UML needs new IRs + layouts

---

## 2026-06-14 — Tier 1 Complete

Tier 1 grammars (class/state/er) shipped. classDiagram (2026-06-13T22:59Z), stateDiagram + erDiagram (2026-06-14T04:41:53Z). State diagram uses left-margin side-routing for skip transitions; ER uses degree-sorted + interleaved column assignment. 1235 tests passing; determinism preserved; all goldens byte-identical.

---

## 2026-06-14 — Tier 2 Complete

Tier 2 complete (pie/xychart/quadrant/radar). Quadrant + radar implemented on shared foundation. Quadrant: tinted regions, edge-aware non-clipping labels. Radar: radial scale, dual-syntax parser. 1425/1425 tests ✓. Commits 5b709cf, ecfc418.

---

## 2026-06-14 — Tier 3 Started

Tier 3 started (journey/gitGraph). journey: horizontal score-ramp with section bands + actor legend. gitGraph: per-branch lanes with merge curves, tags, commit types. 1503/1503 tests ✓. Commit a2a1b37. Remaining Tier 3: sankey, then breadth completion.

---

## 2026-06-14 — Real-Mermaid Fidelity Pass

Real-Mermaid fidelity pass: 6 diagram types fixed & A/B-verified (gitGraph, journey, mindmap, sankey, gantt, timeline). Flowchart parser hardening established tokenizer fidelity bar for all remaining parsers.
