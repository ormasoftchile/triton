# Squad Decisions — Recent & Current (2026-06-13)

> **Compaction Note (2026-06-13):** Detailed decision sections for all grammars (Timeline T1–T5 variants, Sequence Inc1-2, Tree Inc1, Flow Inc1, Composition Inc1, Animation, Dark themes, Design doc sync, Diamond shape, Schema validation) have been archived to decisions-archive.md. Focusing this file on:
> - Index of shipped milestones  
> - Pending items list (now EMPTY — all closed)
> - Barbara's composition ir_file refs (just merged from inbox)

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
