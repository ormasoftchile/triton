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

---

## Tier 2 Complete — quadrantChart + radar/radar-beta (2026-06-14)

Completed the remaining Tier 2 chart types on the shared chart grammar foundation.

### Shipped
- `quadrantChart`: normalized `[0,1] × [0,1]` plot with tinted quadrants, semantic Low/High axis endpoints, quadrant region labels, and deterministic point-label collision handling.
- `radar` / `radar-beta`: explicit spoke axes, concentric polygon graticules, normalized radial scaling via closed-form `RadialScale`, multi-series filled/stroked polygons, and internal legend.

### Parser learnings
- `radar` needs syntax auto-detection: if `axes:` is absent but `axis`/`curve` markers appear, treat it as beta-style content rather than simple syntax.
- Beta curves can appear before axis declarations; preserve indexed values temporarily (`_axisN`) and backfill once axis names arrive.

### Rendering learnings
- Current `PathPrimitive` lacks separate `fillOpacity` and `strokeLinejoin`; the stable pattern is **two paths per radar polygon**: one translucent fill-only path and one stroke-only path.
- Quadrant labels and point annotations can reuse the existing pie label-box helpers for deterministic overlap avoidance without introducing a new solver.

### Verification
- `pnpm -C packages/core build` ✅
- `pnpm -C packages/core typecheck` ✅
- `pnpm -C packages/core test` ✅
- Gallery outputs generated: `examples/gallery/mermaid-quadrant.{mmd,svg,png}` and `examples/gallery/mermaid-radar.{mmd,svg,png}`

---

## Learnings

### Quadrant margin / edge-aware label placement (2026-06-14)

- **Y-axis end labels need ≥ 110 px left reserve.** With 12 px DejaVu Sans, a 15-char label like "High Engagement" measures ≈ 97 px wide. The label is anchored at `plotX − 8` with `textAnchor="end"`, so left clearance = `plotX − 8 − labelWidth`. Anything under ~113 px for `plotX` clips the left edge of the canvas.
- **Priority placement must check plot-boundary proximity, not just mutual label overlap.** An item at x ≈ 0.81 in a 378 px plot (px ≈ 448) lands within 6 px of the plot's right edge when the first right-side candidate is selected. Adding `EDGE_MARGIN = 6` to the boundary check and skipping candidates that would land within that margin of either horizontal plot edge prevents subtle clips that the mutual-overlap test alone cannot catch. Fallback path must mirror this: prefer the left-side anchor when the right-side placement would exceed `plotRight − EDGE_MARGIN`.
