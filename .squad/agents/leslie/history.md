# Project Context

- **Owner:** ormasoftchile
- **Project:** timeline — spec/design of a deterministic diagram compiler. Timeline is Grammar #1.
- **Stack:** LaTeX for design document; TypeScript/Node for implementation (Phase 0–1+ under way).
- **Created:** 2026-06-10

## Current Learnings

- The product is a **deterministic, themeable, agent-authorable DIAGRAM COMPILER** — not a timeline-only tool.
- Two-IR-layer model: domain IRs (grammar-specific) compile to Scene IR (universal primitives). God-IR rejected.
- Kernel/Grammar/Composition layering: shared infrastructure, peer grammars, composition atop.
- SVG as source of truth; PNG/PDF/Skia are exports. HTML/CSS-first rejected (determinism, font variance).
- Animation is declarative, backend-conditional, additive.
- Phase 0→2 incremental packaging: draw kernel/timeline seam, prove grammar-agnosticism with Flow, extract on demand.
- Grammar sequencing: Flows first (demo impact), Graph+auto-layout (hardest), Stat+Comparison (cheap wins), Composition.

## 2026-06-11 — Strategic Reframe: Diagram Compiler Architecture (Leslie)

📐 **Design Document Reframed & Archived to Decisions**

### The Strategic Insight

The real asset is NOT "a timeline tool" — it is a **deterministic, themeable, agent-authorable DIAGRAM COMPILER** with Timeline as the first grammar proof-of-concept. This reframe elevates the product from single-purpose to a platform for multiple visual grammar families sharing a common kernel.


## 2026-06-11 — Design Doc Strategic Reframe Complete (Leslie)

📐 **Diagram Compiler Architecture Specification Delivered**

### The Strategic Reframe

The design document has been restructured to articulate a major insight: the real asset is NOT "a timeline tool" — it is a **deterministic, themeable, agent-authorable DIAGRAM COMPILER**. Timeline is Grammar #1, the first proof of the engine, not the whole product.

**Document Retitled:** "A Deterministic Diagram Compiler — Architecture & Specification (with Timeline as the First Grammar)"

### New Document Structure (6 Parts, 24 Sections)

```
Part I — Thesis & Strategy
  §01 Problem Statement (preserved)
  §02 Central Thesis (NEW) — engine-as-asset, pipeline model, grammar family
  §03 Guiding Principles (renumbered from §02)
  §04 Scope (renumbered from §03)

Part II — The Kernel (Universal Infrastructure)
  §10 Scene IR (NEW) — universal render contract, primitives, effects
  §11 Rendering Backends (NEW) — SVG-as-truth, PNG/Skia exports, HTML/CSS rejection
  §12 Theming (renumbered from §06)
  §13 Determinism (NEW) — consolidated determinism contract across all layers
  §14 Animation (NEW) — additive, declarative, backend-conditional animation

Part III — Grammars
  §20 Grammar Concept (NEW) — two-IR-layer model, grammar interface, god-IR rejection
  §21 Timeline Grammar (reframed from §04) — "Grammar #1"
  §22 Timeline Layout Engine (reframed from §05)
  §23 Inspiration Corpus (NEW) — taxonomy from 9 analyzed images
  §24 Diagram Grammar Family (NEW) — flow, comparison, stat, graph, step-cards

Part IV — Composition
  §30 Composition IR (NEW) — multi-panel poster composition

Part V — Architecture & Packaging
  §40 Architecture Overview (NEW) — kernel/grammars/composition layering
  §41 Packaging Strategy (NEW) — monorepo, incremental extraction path
  §42 Layout Engines (NEW) — graph auto-layout algorithms, risk analysis

Part VI — Ecosystem
  §50–§55 (preserved and renumbered) — agent integration, distribution, comparison, OSS, MVP, targets
```

### Key Architectural Decisions Captured

1. **Two-IR-Layer Model:** Domain IRs (grammar-specific, small) compile to Scene IR (universal primitives). Explicitly rejects "god-IR" approach — a mega-schema is semantically muddy, brittle, and hostile to LLM generation.

2. **SVG as Source of Truth:** PNG/PDF are exports from SVG, not parallel targets. HTML/CSS-first architecture explicitly rejected (browser/font variance, heavy headless-browser dependency, sacrifices determinism).

3. **Animation is Additive:** Declarative hints on Scene primitives (SceneAnimationHints). Backends that don't support animation render the resting frame. Determinism preserved — animated SVG is still byte-identical markup.

4. **Kernel/Grammar/Composition Layering:**
   - Kernel = Scene IR + backends + themes + determinism + animation
   - Grammars = Timeline, Flow, Graph, Comparison, Stat (each with own Domain IR + Layout Engine)
   - Composition = multi-panel poster layout

5. **Incremental Packaging Strategy:**
   - Phase 0: Draw kernel/timeline seam inside packages/core
   - Phase 1: Build Flow grammar as kernel-only consumer
   - Phase 2: Extract packages when publishing/team boundaries justify it
   - Phase 3: Additional grammars, composition layer

6. **Grammar Sequencing:** Flows first (max reuse, best animation demo), then Graph + auto-layout (hardest), with Stat + Comparison as cheap parallel wins.

### Corpus Analysis

Analyzed 9 technical infographic images. Extracted visual vocabulary: Node-Link Graph, Flow/Pipeline, Numbered Step-Cards, Comparison Matrix, Stat Callout, Swimlane/Gantt, Nested Containers, Section-Stacked Poster.

Key insight: Many corpus patterns are ALREADY expressible with what the timeline engine built. The genuinely new work is (a) node-link graph layout and (b) multi-panel composition.

### References Added

Graph layout: Sugiyama 1981, Reingold-Tilford 1981, Fruchterman-Reingold 1991, Eades 1984. Layout engines: ELK, dagre. DSL prior art: Graphviz, Mermaid, PlantUML, D2, Excalidraw, C4. Animation: SMIL, CSS Animations, Lottie.

### Build Status

PDF builds successfully with `make pdf`. Minor cosmetic warnings only.

---

## 2026-06-12 — First Opt-In Axis-Routing Token: Pattern for Future Grammars (Barbara)

📐 **Axis Theme Tokenization Establishes Rendering Pattern for Grammar Extensions**

Barbara implemented **`axis.nodeWrap?: 'none' | 'over-under'`** on AxisTheme to enable arc-around-node spine routing in horizontal layout (enabled in our-timeline theme).

### What This Establishes

- **Theme tokens as grammar extensions:** Layout algorithms, routing styles, and visual variations are now *theme-level opt-in knobs* (not IR changes or new language features).
- **Determinism path:** Default `'none'` produces byte-identical output for all existing themes; `'over-under'` is gated to our-timeline only.
- **Pattern for future grammars:** Flow, Graph, Comparison grammars can define their own axis-routing, node-positioning, or edge-routing tokens on their respective theme types without polluting domain IRs.
- **Implication:** Rendering concern cleanly separated from IR concern. Domain IRs remain small and semantic; layout algorithms live in theme + layout engine.

This is the **first precedent** for how future grammars extend the rendering system: via principled, opt-in theme tokens with clear determinism contracts — NOT unplanned proliferation of theme fields or IR polymorphism.
