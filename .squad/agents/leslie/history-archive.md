# Leslie — Archive (Pre-2026-06-13)

## 2026-06-11 — Strategic Reframe: Diagram Compiler Architecture

**Diagram Compiler Architecture Specification Delivered**

The design document was restructured to articulate the core insight: the real asset is a **deterministic, themeable, agent-authorable DIAGRAM COMPILER**, not a timeline-only tool. Timeline is Grammar #1, the first proof of the engine.

**Document Retitled:** "A Deterministic Diagram Compiler — Architecture & Specification (with Timeline as the First Grammar)"

**New Structure (6 Parts, 24 Sections):**
- Part I — Thesis & Strategy (Problem, Central Thesis, Principles, Scope)
- Part II — Kernel (Scene IR, Rendering Backends, Theming, Determinism, Animation)
- Part III — Grammars (Grammar Concept, Timeline, Layout Engine, Inspiration Corpus, Diagram Grammar Family)
- Part IV — Composition (Composition IR)
- Part V — Architecture & Packaging (Architecture, Packaging, Layout Engines)
- Part VI — Ecosystem (Agent integration, distribution, comparison, OSS, MVP, targets)

**Corpus Analysis:** Analyzed 9 technical infographic images; extracted visual vocabulary. Key insight: Many patterns already expressible with Timeline engine; genuinely new work is node-link graph layout and multi-panel composition.

**Build Status:** PDF builds successfully.

---

## 2026-06-12 — Flow Grammar Spec Authored (Leslie)

**Flow Grammar: Domain IR — Concrete Spec (Grammar #2)**

**Flow Domain IR Shape:**
- FlowNode: `id` (unique), `label`, `shape`, `icon`, `status`, `description`, `group`
- FlowEdge: positional identity (source + target + ports), `label`, `style`, `animated`, `directedness`
- FlowGroup: `id`, `label`, `nodes[]`, `style` (lane|cluster|outline)
- Direction: `left-to-right` | `top-to-bottom`

**Layout Decisions:**
- Linear sequence for simple chains (in/out-degree ≤ 1)
- Sugiyama layered (4 phases) for DAGs and cyclic flows
- Orthogonal edge routing (TSM principles)
- NO force-directed (stress majorization only if needed, deterministic init)
- Topology auto-detected

**Lowering:** Nodes → Group{Rect/Circle + Text + Image}; Edges → Path + arrowhead + optional label; Groups → Rect + label + container.

**Open Questions:** Mark (JSON Schema, edge id field, port extensibility); Barbara (self-loop curves, back-edge rendering, multi-edge offset, group details, label collision).

**Wiring:** Created `sections/25-flow-grammar.tex`; added `\input{...}` to main.tex; cross-ref in 24-diagram-family.tex.

---
