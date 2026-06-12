# Barbara — Semantics & Rendering Specialist

**Owner:** ormasoftchile  
**Project:** timeline — IR-based rendering system for timelines/roadmaps  
**Stack:** TypeScript/Node, SVG/PNG/Skia backends, deterministic layout engine

---
## 2026-06-11 — Strategic Alignment: Product Reframe to Diagram Compiler (Barbara)

📐 **Scene IR as Rendering Kernel Contract**

### Positioning Within Diagram Compiler Strategic Reframe

With Leslie's architectural reframe (Timeline is Grammar #1 of a larger diagram compiler), Barbara's rendering work is repositioned:

**Scene IR Becomes Shared Kernel Contract:**
- Scene IR (Rect, Line, Circle, Text, Path, Group, effects, animation hints) is the **universal rendering contract** shared by ALL future grammars (Timeline, Flow, Graph, Comparison, Stat, etc.)
- Timeline rendering → produces Scene IR → multiple backends (SVG/PNG/Skia/PDF) all consume Scene IR
- Backend diversity: SVG (text-deterministic), PNG (resvg WASM), Skia (art effects), PDF (exports)
- Animation hints on Scene primitives are backend-conditional (SVG honors; raster ignores)

### Phase 0→1 Implementation Path

In Phase 0, kernel/timeline seam drawn in `packages/core`. Barbara owns Scene IR primitives, rendering backends, and theme system. Future grammars' layout engines will compile domain IRs to Scene IR, reusing Barbara's existing backend infrastructure.

### No Changes to Current Implementation

All 5 targets (T1–T5) remain fully renderable. The three layout families (horizontal-swimlane, vertical-spine, serpentine) and five showcase themes (consulting, subject-timeline, ai-timeline, serpentine, gitline) are now positioned as Timeline grammar exemplars, not the whole product.

**Test status:** 570/570 tests pass. All golden images remain byte-identical.

---

## Cross-Agent Flags — David's Research Synthesis (2026-06-12)

**From David (Research Lead):**
- **Animated-Arrow Pattern:** ByteByteGo-style technical explainers use flowing data-stream effect via SVG `stroke-dashoffset` animation on connector paths. This is an animation hint on the Scene IR connector path. Static/raster backends ignore; SVG honors. Implication: Scene IR animation primitives are already the right abstraction.
- **Stress-Majorization Determinism:** Force-directed layout must use stress-majorization \[gansnerStressMaj2004\] with deterministic initial layout (only variant compatible with the determinism contract). This is a critical constraint for future Graph grammar.
- **Orthogonal TSM Framework:** For architecture diagrams, Tamassia's (1987) topology-shape-metrics framework using bend-minimisation as minimum-cost network flow is polynomial-time and deterministic. Consider for future specialized grammars.
