# Barbara — Semantics & Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-14T19:30:00Z (Tier 3 long-tail complete)

---

## 2026-06-14 — Tier 3 Long-Tail Grammars Shipped

### block-beta + packet-beta + architecture-beta (2026-06-14T19:30:00Z)

Completed Tier 3 long-tail shipment. All five remaining standard Mermaid diagram types production-ready:

**block-beta:** N-column fixed-grid layout with row-major placement, spans, groups as background containers, straight arrows with midpoint labels. Gallery: 472×196 viewBox.

**packet-beta:** 32-bit field grid with row wrapping. Fields crossing boundaries split into segments with boundary labels. Adaptive typography for narrow fields. Gallery: 984×180 viewBox.

**architecture-beta:** Services, groups (indentation-nested + explicit `in`), junctions, port-anchored edges (L/R/T/B sides). Constraint-grid placement deterministic. Icon registry extended: server, disk, internet glyphs. Gallery: card 44.

**Key design principles:**
- All coordinates use `rhuInt()` for determinism
- Layout uses deterministic algorithms (no heuristic solvers)
- Graceful degradation: unknown icons/endpoints warn but don't fail
- Width parity with real Mermaid where possible (e.g., packet 984px); visual compactness acceptable for deterministic rendering

**Test suite:** 1759/1759 passing. All pre-existing goldens byte-identical.

### A/B Verification Results

| Grammar | Structure | Layout |
|---------|-----------|--------|
| block-beta | ✓ grid, spans, groups, arrows | Deterministic, more spacious |
| packet-beta | ✓ 32-bit fields, wrapping | Width-parity; taller but semantic |
| architecture-beta | ✓ services, groups, edges | Constraint-grid, deterministic |

All semantic elements present. Visual layout more compact/spacious than real Mermaid but structurally faithful.

---

## Earlier Work (Archived)

For detailed notes on gantt-faithful layout, timeline-columns refactor, radar curve syntax, see history-2026-06-14-archived.md.
- (2026-06-14) Theming architecture decided — general-contract model, §12 rewritten; will implement per-component theme contract
