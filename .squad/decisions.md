# Squad Decisions — Recent & Current (2026-06-13)

---

## 🎯 STRATEGIC PIVOT: FULL MERMAID-SUPERSET POSITIONING (2026-06-13)

**MAJOR DIRECTION CHANGE** — Supersedes earlier "diagram compiler reframe"

### Core Positioning
- **Full Mermaid Superset:** All 22 Mermaid diagram types parse & render out of the box
- **Beautiful Output:** Explicitly beat Mermaid's aesthetics (first-class pillar)
- **UML/Software Line:** Dedicated Tier-1 priority for class, state, ER, C4 diagrams
- **Agent-Authorable IR:** Dual front-end (humans: Mermaid-superset DSL; agents: structured IR) → shared Domain IR → Scene IR → backends

### Five Diagram Families
1. **Node-Link/Graph** — flowchart, C4, architecture, block, requirement, gitGraph, sankey (Sugiyama kernel)
2. **UML/Software** — sequence, class, state, ER (grammar-specific layouts)
3. **Charts (Grammar-of-Graphics)** — pie, xychart, quadrant, radar (NEW kernel)
4. **Timeline/Project** — gantt, timeline, journey, kanban (track-based)
5. **Tree/Hierarchy** — mindmap, treemap (Buchheim–Jünger–Leipert)

### Coverage Roadmap
- **T0:** Wire existing (flowchart, sequence, gantt, timeline, mindmap) — kernels ready; need parsers
- **T1:** UML line (class, state, ER, C4) — new IRs + layouts
- **T2:** Charts (pie, xychart, quadrant, radar) — grammar-of-graphics
- **T3:** Remaining (sankey, requirement, gitGraph, block, etc.)

### Superset+ Extensions
- Composition/posters, rich theming, animation, structured IR-as-API, cross-refs, icons

**Design doc** restructured (Leslie) to center Mermaid compatibility, aesthetics pillar, UML line, and dual front-end. PDF builds. PDF structure: 8 parts, 8 new sections (05-comparison, 15-frontend, 16-mermaid-compat, 17-superset-extensions, 18-aesthetics, 28-family-taxonomy, 29-chart-family, 60-roadmap); retired 4 old; rewrote/recontextualized core.

---

> **Compaction Note (2026-06-13):** Detailed decision sections for all grammars (Timeline T1–T5 variants, Sequence Inc1-2, Tree Inc1, Flow Inc1, Composition Inc1, Animation, Dark themes, Design doc sync, Diamond shape, Schema validation) have been archived to decisions-archive.md. Focusing this file on:
> - Index of shipped milestones  
> - Pending items list (now EMPTY — all closed)
> - Barbara's composition ir_file refs (merged from inbox)
> - Leslie's Mermaid-superset strategic pivot (merged from inbox)

---

## ALL PENDING ITEMS NOW CLOSED (2026-06-13)

| Item | Tracking | Status | Closed Date |
|------|----------|--------|-------------|
| Schema validation hardening | #design | ✅ CLOSED | 2026-06-13 |
| Composition ir_file refs | #composition | ✅ CLOSED | 2026-06-13 |
| Flow diamond shape | #flow | ✅ CLOSED | 2026-06-13 |
| Stale comment cleanup | #maintenance | ✅ CLOSED | 2026-06-13 |
| Design doc status sync | #documentation | ✅ CLOSED | 2026-06-13 |

---

## Shipped Milestones (2026-06-11 to 2026-06-13)

### All Five Timeline Targets Complete (2026-06-11)

| Target | Family | Layout | Theme | Status |
|--------|--------|--------|-------|--------|
| **T1** | Vertical central-spine | horizontal | our-timeline | ✅ CLOSED |
| **T2** | Vertical central-spine | vertical-spine | subject-timeline | ✅ CLOSED |
| **T3** | Vertical central-spine | vertical-spine | ai-timeline | ✅ CLOSED |
| **T4** | Serpentine winding path | serpentine | serpentine | ✅ CLOSED |
| **T5** | Vertical central-spine | vertical-spine | gitline | ✅ CLOSED |

**Test coverage:** 795 tests pass (551 core + 13 schema + 3 cli + 228 grammar-specific). All 551 existing core goldens byte-identical.

### Four Grammars + Composition Layer (2026-06-13)

| Deliverable | Grammar | Implementation | Theme Support | Tests | Status |
|-------------|---------|-----------------|----------------|-------|--------|
| **Timeline** | #1 | ✅ Inc1+ | 5 themes (std, dark, ByteByteGo) | 551 | SHIPPED |
| **Sequence** | #2 | ✅ Inc1-2 | 2 themes (UML, ByteByteGo) | 37+multi-compartments | SHIPPED |
| **Tree** | #3 | ✅ Inc1 | 2 themes (light, dark) | 26 | SHIPPED |
| **Flow** | #4 | ✅ Inc1 | 2 themes (light, dark) + animation | 33+diamond | SHIPPED |
| **Composition** | Layer | ✅ Inc1 | 2 themes (light, dark) + ir_file refs | 25+refs | SHIPPED |

---

# Decision: Composition ir_file External Reference Resolution (FINAL PENDING ITEM)

**Agent:** Barbara (Semantics & Rendering)  
**Date:** 2026-06-13T17:43:20-04:00  
**Status:** ADOPTED — MERGED FROM INBOX

## Summary

Implemented `ir_file` external URI references in Composition Grammar cells. CellContent gains `{ kind:'ref', grammar, ir_file }` variant. Resolver (`composition/resolve.ts`) is file-I/O seam; `buildCompositionScene` remains pure. Example gallery shows flow + tree from sibling files composed into 2×2 poster.

## IR Extensions

### New `RefCellContent` variant
```typescript
interface RefCellContent {
  kind: 'ref';
  grammar: 'flow' | 'tree' | 'sequence' | 'timeline';
  ir_file: string;  // relative path from baseDir
}
```

### New `TimelineCellContent` variant  
```typescript
interface TimelineCellContent {
  kind: 'timeline';
  doc: IRDocument;
}
```

Both added to `CellContent` union.

## Implementation

**File:** `packages/core/src/composition/resolve.ts` — `resolveCompositionRefs(doc, baseDir)`
- Walks cells; for each `kind:'ref'` cell: reads file, auto-detects YAML/JSON, validates via grammar schema, inlines as `{ kind:'flow'|'tree'|'sequence'|'timeline', doc }`
- Non-ref cells passed through unchanged
- Original document not mutated; returns new resolved instance

**Convenience API:** `renderCompositionDocumentFromRefs(doc, baseDir, options)` — resolves refs then renders.

**Layout Guard:** `compileCellContent` throws clear error if unresolved ref reaches layout phase.

## Example: `examples/gallery/poster-refs/`

Three sibling files:
- `poster-refs.composition.yaml` — 2×2 grid, cells [0,1] use `kind: ref`
- `pipeline.flow.yaml` — Flow diagram
- `taxonomy.tree.yaml` — Tree diagram

Resolved poster output: `poster-refs.{svg,png}` — byte-identical to equivalent fully-inlined poster.

## Test Coverage

| Test | Verifies |
|------|----------|
| E1 | Ref cells inlined; inline cells unchanged; original not mutated |
| E2 | Missing file → clear error |
| E3 | Resolved poster sceneHash stable (determinism) |
| E4 | Resolved poster hash ≡ inline poster hash (byte-identical) |
| E5 | Gallery emit works |

## Determinism

`resolveCompositionRefs` + `buildCompositionScene` produces byte-identical output to fully-inlined equivalent. Resolver is mechanical substitution; layout unchanged.

## Files Changed

| File | Change |
|------|--------|
| `packages/core/src/composition/types.ts` | Added `TimelineCellContent`, `RefCellContent` |
| `packages/core/src/composition/schema.ts` | Added schema variants |
| `packages/core/src/composition/layout.ts` | Added `case 'timeline'` and `case 'ref'` guard |
| `packages/core/src/composition/resolve.ts` | **NEW** — resolveCompositionRefs |
| `packages/core/src/composition/index.ts` | Export new types, resolveCompositionRefs, renderCompositionDocumentFromRefs |
| `packages/core/test/composition.test.ts` | E1–E5 tests added |
| `examples/gallery/poster-refs/` | **NEW** example directory |
| `examples/gallery/poster-refs.{svg,png}` | **NEW** gallery outputs |

**Test result:** 795/795 tests pass. All existing goldens byte-identical.

---

---

# Decision: Mermaid-Superset Design Doc Restructure (MERGED FROM INBOX)

**Agent:** Leslie (Spec Architect)  
**Date:** 2026-06-13T19:25:34-04:00  
**Status:** ADOPTED

## Summary

Restructured LaTeX design document (design/main.tex) around new Mermaid-superset positioning: beautiful/themeable output, dedicated UML/software line, dual front-end (Mermaid DSL + structured IR).

## New Document Structure (8 Parts)

| Part | Title | Key Sections |
|------|-------|--------------|
| I | Thesis & Positioning | 01-problem, 02-central-thesis, 03-principles, 04-scope, 05-comparison |
| II | Front-End | 15-frontend, 16-mermaid-compat, 17-superset-extensions |
| III | Kernel | 10-scene-ir, 11-backends, 13-determinism, 14-animation |
| IV | Families | 20-grammar, 28-family-taxonomy, 21-timeline, 22-rendering, 25-flow, 26-sequence, 27-tree, 29-chart-family |
| V | Aesthetics | 12-themes, 18-aesthetics |
| VI | Composition | 30-composition |
| VII | Architecture | 40-architecture, 41-packaging, 42-layout-engines, 50-agent-integration |
| VIII | Roadmap | 60-roadmap, 51-distribution, 53-oss-strategy, 55-target-outputs |

## Files Created
- `05-comparison.tex` — Mermaid/PlantUML/D2/Vega comparison
- `15-frontend.tex` — Dual front-end architecture
- `16-mermaid-compat.tex` — 22-type Mermaid coverage
- `17-superset-extensions.tex` — Composition, theming, animation, IR-as-API
- `18-aesthetics.tex` — Aesthetic bar as first-class pillar
- `28-family-taxonomy.tex` — Five families, 22-type taxonomy
- `29-chart-family.tex` — Grammar-of-graphics chart layer
- `60-roadmap.tex` — Tiered coverage roadmap

## Files Retired (Subsumed/Replaced)
- `23-corpus-taxonomy.tex`, `24-diagram-family.tex`, `52-comparison.tex`, `54-mvp.tex`

## Files Recontextualized
- `01-problem.tex`, `02-central-thesis.tex`, `04-scope.tex`, `14-animation.tex`, `20-grammar-concept.tex`, `25-flow-grammar.tex`, `50-agent-integration.tex`, `12-themes.tex` (cross-references fixed)

## Determinism & Delivery

PDF builds. All design sections coherent across new family taxonomy and aesthetic-first positioning.

---

## Earlier Milestones Archived

For full design details on grammars, themes, animation, schema hardening, and prior-art positioning, see:
- **decisions-archive.md** — Detailed decision records (256 KB):
  - Strategic Direction & Scope (2026-06-09/10)
  - IR Contract & Rendering Model
  - All grammar specs (Sequence, Tree, Flow, Composition)
  - Theme systems (Timeline, Flow, Sequence, Tree, Composition dark variants, ByteByteGo)
  - Animation (dashflow SMIL)
  - Schema validation invariants
  - Design document sync status
