# Leslie — History Summarized (2026-06-15)

**Summarization Date:** 2026-06-15T21:45:00Z

This document summarizes detailed work from Leslie (Spec Architect) for 2026-06-14 through 2026-06-15.

## Summary

### Theme Vocabulary Resolved (2026-06-14)
Closed all 5 open questions on theming architecture:
1. **Dual palette system:** Role palette (semantic/structural) + Data palette (quantities/sequences)
2. **Spacing:** Advisory, not binding; components consult as rhythm guidance
3. **Density:** Three discrete levels (compact | normal | comfortable)
4. **Three-tier architecture:** Primitives (Tier 1) → Semantic tokens (Tier 2) → Component-specific (Tier 3)
5. **Proof set + migration order:** flowchart + sequence + xychart validate contract; 5-stage migration planned

Decision committed to `.squad/decisions/inbox/leslie-theme-vocabulary-resolved.md`.

### Extended Timeline Syntax §16b (2026-06-15)
Spec'd two-tier timeline model:
- **Tier 1:** Mermaid-faithful (`section` + `period : event`)
- **Tier 2:** Extended syntax (all constructs map to existing IRDocument fields)

Discovered 5 IR gaps: `Milestone.shape` missing, schema.ts layout enum incomplete, `density` not persisted, legend auto-generation unspecified, global-axis milestone behavior unvalidated.

New section `design/sections/16b-extended-timeline.tex` added; PDF clean.

### Cross-Diagram Node Linking §30b (2026-06-15)
Spec'd link syntax: `link <cellAddr>.<nodeId> --> <cellAddr>.<nodeId> : "label"`.

**Prerequisite:** Grammar layout functions currently discard node positions (PlacedNode). Solution: sidecar `NodeAnchorRegistry` ({scene, anchors}) returning local coordinates, transformed by composition layer via translateAndScale.

Linkable-type rules established; overlay routing (two-phase: straight/elbow, then orthogonal); degradation contract (unresolved links warn+skip, never fatal).

New section `design/sections/30b-cross-diagram-links.tex` added; PDF clean.

---

For detailed decision notes and full decision record, see `.squad/decisions/inbox/` or `.squad/decisions/decisions.md`.

For earlier context (grammar specs, composition implementation, real-Mermaid fidelity), see `leslie/history-archive.md`.
