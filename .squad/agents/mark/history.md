# Mark — IR & Schema Architecture

**Owner:** Mark (IR & Schema Lead)  
**Project:** timeline — deterministic diagram compiler  
**Created:** 2026-06-10  
**Updated:** 2026-06-14T19:30:00Z (Tier 3 long-tail complete — 21 Mermaid types total)

---

> **Active entries below. Archived detailed IR design decisions and schema reference in history-archive.md.**

---

## 2026-06-13 — Schema Validation Hardening Complete (Scribe)

**Date:** 2026-06-13T17:45:35Z  
**Status:** SHIPPED

All grammars (sequence, tree, flow) + composition + axis_breaks now enforce exhaustive constraint sets via Zod superRefine:

**Sequence** — message order uniqueness, activation/fragment bounds, section ordering
**Tree** — root required (explicit guard), acyclicity structural guarantee  
**Flow** — duplicate edge id check, self-loops documented as legal
**Composition** — row+rowSpan ≤ grid.rows when grid.rows declared
**axis_breaks (timeline)** — from < to, breaks within time_range, no overlaps (sort-tolerant)

**Schema file:** `packages/core/test/schema-validation.test.ts` — 55 validation tests  
**Total:** 790 tests pass (735 pre-existing + 55 new); all prior goldens byte-identical.

**Key design:** IR date comparison via `parseIrDateToMs()` — converts ISO/year-month/year/quarter/half to UTC ms, skips symbolic/relative/approximate, preserving backwards compatibility.

---

## 2026-06-13 — Composition CellContent IR Extensions: ref + timeline (Scribe)

**Date:** 2026-06-13T17:43:20Z  
**Status:** ADOPTED + MERGED

### RefCellContent: External IR File References

```typescript
interface RefCellContent {
  kind: 'ref';
  grammar: 'flow' | 'tree' | 'sequence' | 'timeline';
  ir_file: string;  // relative path from baseDir
}
```

Enables composition cells to reference sibling YAML/JSON files. The resolver (`composition/resolve.ts`) reads, parses, validates, and inlines—transforming `kind:'ref'` into an inline variant before layout runs.

### TimelineCellContent: Explicit Inline Timeline IR

```typescript
interface TimelineCellContent {
  kind: 'timeline';
  doc: IRDocument;
}
```

Previously only `flow`/`tree`/`sequence` had explicit inline variants. Timeline now explicit, symmetric with other grammars.

**Schema updates:**
- `composition/schema.ts` — `refCellContentSchema`, `timelineCellContentSchema` (new validators in discriminated union)
- Grammar-specific constraints deferred to resolver (calls `irDocumentSchema` for timeline)

**Example:** `examples/gallery/poster-refs/` — composition YAML referencing `pipeline.flow.yaml` + `taxonomy.tree.yaml`; resolved outputs byte-identical to inline equivalent.

**Test additions (E1–E5):** ref inlining, error handling, determinism, byte-equivalence, gallery emit  
**Result:** 795 tests pass; all existing goldens byte-identical.

---

## 2026-06-13 — STRATEGIC PIVOT: Mermaid-Superset Positioning (Scribe Update)

**Status:** LOCKED — MAJOR DIRECTION CHANGE

Product repositioned as **full Mermaid superset** (all 22 types) compiling to shared deterministic Scene IR.

### Implications for IR & Schema

1. **Mermaid Front-End Coverage:** 22 diagram types → 5 families (node-link, UML, charts, timeline, tree)
   - IR must support dual path: **Mermaid DSL input** → Domain IR → Scene IR; **structured IR input** → Domain IR → Scene IR
   - Parser layer: Mermaid syntax tokenizer → AST → Domain IR
   - Domain IR: unified interface; grammar-specific validators

2. **UML/Software Line (Tier-1):** class, state, ER, C4 diagrams
   - New domain IRs: ClassDiagram IR, StateDiagram IR, ERDiagram IR, C4Diagram IR
   - Schema validation: UML constraints (inheritance, multiplicity, reachability)
   - Mark work: Define these IRs early; unblock Barbara's rendering

3. **Charts (Tier-2):** Grammar-of-graphics backend (pie, xychart, quadrant, radar)
   - New domain IR family: ChartData → ChartSpec → ChartScene
   - Marks work: Domain IR shape; schema for aggregate functions

4. **IR-as-API (Agent Path):** Structured IR input is first-class
   - Agents generate domain IRs directly
   - Implication: Domain IRs must be stable, well-documented, schema-locked
   - Mark work: Publish IR spec as part of CLI/SDK surface

### Current State
- 4 grammars shipped; 790/790 tests pass; all goldens byte-identical
- Schema: Exhaustive validation across all grammars

### Next Build Phase
- **T0 wiring:** Mermaid flowchart/sequence/gantt/timeline/mindmap → existing domain IRs
- **T1 UML:** Define class/state/ER/C4 IRs; pass to Barbara for rendering
- **T2 charts:** Design ChartData family IR; pass to Barbara

---

## 2026-06-14 — Mermaid Front-End Tier 0 Integration Note (Scribe)

**Date:** 2026-06-14T00:10:54Z  
**Status:** INTEGRATION IN PROGRESS

Bjarne's Mermaid flowchart parser (Tier 0 Inc 1) now targets the grammar IRs.
Mermaid DSL → preprocessed flowchart text → `parseFlowchart()` → FlowDocument IR → existing `buildFlowScene()` path.

**Implication for Mark:** Future parsers (sequence, timeline, mindmap) need their respective IR coverage. Sequence parser → SequenceDocument; timeline parser → TimelineDocument; mindmap parser → TreeDocument (existing structure sufficient). Architecture decision: Mermaid IDs sanitized to kebab-case at parse time; IR remains schema-consistent.

## 2026-06-13 — Tier 1 Kickoff: classDiagram IR Architecture (Bjarne)

**Date:** 2026-06-13T22:59:00Z  
**Status:** SHIPPED

Class domain IR (packages/core/src/grammars/class/) introduces new UML relationship types (inheritance/realization/composition/aggregation/association/dependency). Semantic-only IR independent of rendering; shape compartment sizing via measureText() follows established pattern. Barbara will render via Scene path primitives. Mark: class IR schema includes 6 relationship union types; future state/ER/C4 IRs will extend this pattern.
Tier 1 complete (class/state/er/c4)

## 2026-06-14 — Tier 2 Started

Tier 2 grammar-of-graphics chart foundation shipped: ChartDocument Domain IR, LinearScale/BandScale, deterministic layout with priority-based label collision avoidance. Pie + xychart-beta operational. 1361 tests, zero regressions. Foundation for quadrant + radar (reuse only). Commit 5b709cf.

**2026-06-14:** Real-Mermaid fidelity pass: 6 diagram types fixed & A/B-verified (gitGraph, journey, mindmap, sankey, gantt, timeline).

## 2026-06-15 — Theme-Contract Migration COMPLETE

**Date:** 2026-06-15T11:35:00Z  
**Status:** SHIPPED

All 21 Mermaid diagram types now adopt the Tier-2 `ThemeContract`. The `executive` contract theme renders all 21 coherently (white surface, Georgia serif, slate ink, navy accent, shared navy-anchored categorical palette). Adoption is opt-in; legacy themes byte-identical. Timeline section fills now theme-driven. Design §12 synced (4 tokens + implementation status). 1976/1976 tests passing; determinism preserved. Commits: bd2ccc4 (spike), 4a943e9 (step1), 8101a00 (node-link), a6a2ff5 (charts+specialized), 703c4cd (timeline fills), 0e8a5fb (doc).
- (2026-06-15T15:00:00Z) Superset surface complete: config keys + 7 themes + poster keyword (§17.1 extension mechanisms shipped)
- (2026-06-15T15:55:53Z) Dimension guard added; vertical-spine warns on pathological height
