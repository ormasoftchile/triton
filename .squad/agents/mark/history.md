# Mark — IR & Schema Architecture

**Owner:** Mark (IR & Schema Lead)  
**Project:** timeline — deterministic diagram compiler  
**Created:** 2026-06-10

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

