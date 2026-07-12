# Session Log — Cross-Diagram Icon Attachment Design

**Date:** 2026-07-12T23:37:39Z  
**Task:** Merge leslie-cross-diagram-icons.md → decisions.md; write logs

---

## Design Summary (1-line)

Two icon attachment forms (node-shape + inline-label) extend Icon Library Import across 13 entity diagrams (flowchart, sequence, state, class, c4, block, poster, architecture, mindmap, er, journey + 2 triton-only families).

---

## Two Attachment Forms

| Form | Token | Example | Diagrams |
|------|-------|---------|----------|
| **Node-shape** | `@{ icon: "prefix:name" }` | flowchart A@{icon: "azure:app-service"} | flowchart, sequence, state, class, c4, block, architecture (existing), mindmap (existing) |
| **Inline-label** | `:prefix:name:` | "Deploy :azure:app-service: to prod" | flowchart, sequence, block, poster |

---

## Applicability Matrix

13 compatible diagrams. 7 data-driven diagrams excluded (gantt, gitgraph, pie, radar, quadrant, xychart, sankey, packet) + entire ds family (value-semantic cells).

---

## Phasing Delta

| Phase | Scope | Estimate |
|-------|-------|----------|
| **P6a** | Flowchart `@{icon}` grammar, mindmap IconRef reinterpret, sequence participant icon, shared inline tokenizer | 6–8h |
| **P6b** | State, class, c4, block node-shape; text-metrics for inline icons | 4–5h |
| **P6c** | Poster inline-label, er/journey (if demand) | 2–3h |

**P6 revised:** 4–6h → 12–16h.  
**Overall feature:** ~30–40h (up from 22–30h for Icon Library Import).

---

## One Token, Many Hosts

Single `IconRef { prefix, name }` type. One resolver. Host provides `ResolvedIconRegistry` (Map<prefix, Map<name, ResolvedIcon>>). Core emits inline SVG paths (no `<image>`, no font glyphs, no `<foreignObject>`).

---

## Status

Design complete. NOT approved to build. Awaiting decision authority sign-off before P0 integration.
