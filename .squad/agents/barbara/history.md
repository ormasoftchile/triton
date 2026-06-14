# Barbara — Layout Specialist

**Owner:** Barbara (Layout & Rendering Lead)  
**Project:** timeline — deterministic diagram compiler  
**Updated:** 2026-06-14T19:24:39Z

---

## Current Status

**Tier 2 Foundation Complete:** Grammar-of-graphics chart layer shipped. Scales (LinearScale, BandScale), axes, marks, deterministic layout engine with priority-based label collision avoidance. First two chart types operational: pie + xychart-beta (bar+line). 1361 tests passing, all pre-existing regressions zero.

**Gallery:** mermaid-pie.png + mermaid-xychart.png (920×560), cards 33+34.

**Commit:** 5b709cf "feat(mermaid): Tier 2 kickoff — grammar-of-graphics + pie + xychart"

---

## Key Capabilities

- **Deterministic Rendering:** All geometry from direct arithmetic, `rhuInt()` rounding, no iterative solvers
- **Theme-Driven Architecture:** Grammar IR independent of rendering; external style via theme tokens
- **Two-IR-Layer Model:** Domain IR → Scene IR (universal kernel)
- **Shared Foundation Pattern:** Grammars reuse scale/axis/mark infrastructure

---

## Shipped Grammars

| Grammar | Status | Tests |
|---------|--------|-------|
| Timeline | SHIPPED | 551+ |
| Sequence | SHIPPED | 611+ |
| Tree | SHIPPED | 630+ |
| Flow | SHIPPED | 741+ |
| Composition | SHIPPED | 735+ |
| **Chart** | **SHIPPED (Tier 2)** | **1361 total** |
| Class (UML) | SHIPPED | 1281 |
| State (UML) | SHIPPED | 1281 |
| ER (UML) | SHIPPED | 1281 |
| C4 (UML) | SHIPPED | 1281 |

---

## Tier 2 — Chart Foundation Architecture

### ChartDocument (Domain IR)

Semantic chart intent: data rows, field encodings, lightweight config. Maps Mermaid syntax into unified structure for all chart families.

### Scales

- **LinearScale:** continuous numeric domain → pixel range, nicening for axis ticks
- **BandScale:** categorical domain → pixel bands with padding

### Layout Engine

- **Priority-based label placement:** largest slices first, inside when roomy, outside for small/conflicting, leader lines for spillover
- **Tick-label crowding:** deterministic skipping based on measured label width vs available space
- **No iterative solvers:** all geometry derives from direct arithmetic

### Scene IR Output

Existing primitives only: `rect`, `line`, `circle`, `text`, `path`. Serializers unchanged.

---

## Recent Milestones

### Tier 1 Complete (2026-06-14)

All four UML/Software-line types shipped: classDiagram, stateDiagram, erDiagram, C4. 1281 tests, determinism verified, gallery outputs finalized.

**Key layouts:**
- Class: 2-column deterministic grid
- State: rank-based skip-transition side routing + adjacent-label placement (skip-labels in left margin)
- ER: degree-sort + interleaved grid placement
- C4: top-level grid + boundary nesting, orthogonal edge routing with port distribution, edge labels clear of boxes

### Tier 2 Started (2026-06-14)

Chart grammar-of-graphics foundation + pie + xychart-beta. Foundation ready for quadrant + radar (only dispatch branch per type).

---

## Deferred / Known Limitations

- Quadrant + radar chart types (reuse foundation)
- Flow Inc-3+: Force-directed layout, stress-majorization
- Tree Inc-2+: Forest support, shape variation
- Composition Inc-2+: Scale policy modes, advanced URI schemes
- ER follow-up: Same-column side-routing for edge labels

---

## Archive

For detailed learnings from earlier work (2025 timeline polish, grammar-of-graphics, Tier 1 polish), see archived history files.
