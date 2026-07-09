### 2026-07-08: Forced wall routing must prove endpoint clearance
**By:** Edsger
**What:** Orthogonal forced-wall routes now reject straight shortcuts unless the segment leaves the source in the forced wall normal, approaches the target from that wall's outboard side, and has zero obstacle collisions. Engine3 supplies source/target anchor boxes as routing obstacles, and same-wall routes that would hit endpoint interiors add an outboard side detour.
**Why:** `@orthogonal:NN`/`SS`/`EE`/`WW`/opposed wall hints can face away from the other endpoint; collapsing them to a straight axis-aligned segment violates the wall contract and draws through endpoint boxes. Endpoint clearance must be decided during routing, not after SVG emission.

### 2026-07-08: Wall-faces-away detours must include containing visible geometry
**By:** Edsger
**What:** Refined the forced-wall obstacle model so wall-faces-away routing includes source/target container rects and same-cell visible anchors, not only the endpoint port anchor boxes. Side detour channels are selected outside the crossed container/content extent.
**Why:** A route can avoid tiny endpoint anchors while still visibly crossing the source cell body or tuple content. Geometry validation for forced wall hints must prove clearance against the shape the user sees.
