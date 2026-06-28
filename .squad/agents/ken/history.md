# Ken — History

## Context

- **Project:** triton — multi-diagram rendering engine (Mermaid superset)
- **Owner:** ormasoftchile
- **Hired:** 2026-06-27
- **Reason:** Brian's visual self-reports were passing renders with visible defects (diagonal edges, zigzag skip-edge paths, wrong arrowhead directions). Ken exists to independently validate every render before it reaches ormasoftchile.

## Learnings

_(append here)_

## 2026-06-27T17:19:00-04:00 — class-fix3 Review

**Diagram:** `examples/class/class.svg`  
**Verdict:** PASS ✅

All 7 pass criteria satisfied:
- Zero diagonal segments in any edge path
- All arrowheads axis-aligned
- "places" edge is a clear vertical path from Customer to Order
- "creates" edge correctly arrives at Order's top wall (y=419)
- No overlapping arrowheads
- No doubling-back segments
- Right column well-positioned

Full verdict: `.squad/decisions/inbox/ken-verdict-class-fix3.md`

## 2026-06-27T17:21:55-04:00 — class-fix3 Review

**Files:** `examples/class/class-for-ken.png`, `examples/class/class.svg`

**Verdict:** ✅ PASS

**Summary:** Independently verified all 6 edges. All paths are orthogonal (zero diagonals). L-shaped routes for "places" and "creates" use proper vertical→horizontal→vertical segments. All arrowheads axis-aligned and correctly directed. Right column (Payment hierarchy) positioned reasonably close. No overlaps, no double-backs, no visual defects.

## 2026-06-27T17:29:00-04:00 — class-92e839c Review

**Files:** `examples/class/class-brian-done.png`, `examples/class/class.svg`

**Verdict:** ✅ PASS

**Summary:** Re-rasterized and independently verified PNG. All 6 edges fully orthogonal (pure vertical or L-shaped with only H/V segments). "places" edge is straight vertical (x=144.72). "has" and "creates" use offset x=96.81 to avoid overlap. All arrowheads axis-aligned. Composition diamond on "contains" properly filled. Interface implementation arrow on Payment uses hollow triangle. No overlaps, no crossings, no visual defects. All 15 charter principles satisfied.

Full verdict: `.squad/decisions/inbox/ken-verdict-class-92e839c.md`

## 2026-06-27T17:37:00-04:00 — class-bypass Review

**Files:** `examples/class/class-bypass.png`, `examples/class/class.svg`

**Verdict:** ✅ PASS

**Summary:** The "places" skip edge (Customer→Order) now uses a proper 5-segment V→H→V→H→V bypass path routed through external corridor at x=4, completely outside all node bounding boxes (ShoppingCart starts at x=24). This eliminates any shared vertical corridor with the "has" and "creates" edges which use x=96.81. All 6 edges verified rectilinear. All 15 charter principles satisfied.

Full verdict: `.squad/decisions/inbox/ken-verdict-class-bypass.md`

## 2026-06-27T18:38:39-04:00 — Option A Review (commit 9783ff2)

**Files:** `examples/class/class-ken-optiona.png`, `examples/class/class.svg`

**Commit:** `9783ff2` — fix(class): BK dummy independence + lane routing (Option A)

**Verdict:** ✅ PASS

### What I Saw

**Layout:** E-Commerce Domain Model. Left column (top→bottom): Customer, ShoppingCart, Order, OrderItem, Product — all centered at x≈96.82, boxes spanning x=31.82 to x=161.82 (or x=169.63 for ShoppingCart). Right column: CreditCardPayment (top), Payment (below) — centered at x≈281, boxes spanning x=215.63 to x=345.63. Inter-column gap: approximately x=169 to x=215.

**Edges verified from SVG paths:**

1. **"places" (Customer → Order, 3-layer skip):**
   Path: `M 96.82 184 L 96.82 216 L 192.63 216 L 192.63 387 L 96.82 387 L 96.82 419`
   — Exits Customer bottom at x=96.82, goes right to x=192.63 (inter-column gap ✓, NOT right-side corridor), runs down alongside ShoppingCart (y=216→387) in the gap, returns left to x=96.82, enters Order top. Arrowhead at (96.82, 419) pointing down.
   — **KEY FINDING:** laneX = 192.63 is in the inter-column gap (right of left column edge x≈169, left of right column edge x=215.63). Option A objective achieved. ✓

2. **"has" (Customer → ShoppingCart):**
   Path: `M 128.81625 184 L 128.81625 219.75 L 96.81625 219.75 L 96.81625 255.5`
   — Exits Customer at x=128.82 (offset 32px from center), jogs left at y=219.75, enters ShoppingCart top at x=96.82. Horizontal jog uses y=219.75, not y=216 (no segment sharing with "places"). Arrowhead pointing down.

3. **"creates" (ShoppingCart → Order):**
   Path: `M 96.81625 347.5 L 96.81625 383.25 L 128.81625 383.25 L 128.81625 419`
   — Exits ShoppingCart bottom at x=96.82, jogs right to x=128.82, enters Order top at x=128.82. "creates" and "places" enter Order at different x positions (128.82 vs 96.82 — 32px gap). ✓

4. **"contains" (Order → OrderItem):** `M 96.81625 547 L 96.81625 611` — straight vertical. Composition diamond at Order bottom.

5. **"references" (OrderItem → Product):** `M 96.81625 703 L 96.81625 767` — straight vertical. Arrowhead pointing down.

6. **CreditCardPayment → Payment (implements):** `M 280.6325 248 L 280.6325 175` — vertical in right column. Open triangle arrowhead at Payment top. Dashed stroke.

**Label positions:** "places" label at x=193, on the vertical segment at x=192.63 in the inter-column gap — readable, not overlapping arrowheads. "has" at x=113, "creates" at x=113. All labels outside node boundaries.

### 15-Principle Checklist

1. Every edge rectilinear ✅ — all paths use only H and V segments
2. No edge crosses another ✅ — left column edges stay at x≈96.82/128.82; "places" goes to x=192.63; right column at x=280.63
3. No edge through unconnected node ✅ — "places" vertical at x=192.63 passes through the inter-column gap, no node spans that x coordinate in those y ranges
4. No two edges share a segment ✅ — "places" horizontal at y=216, "has" horizontal at y=219.75 (different y); all vertical segments at different x or non-overlapping y ranges
5. Same-wall edges have distinct paths ✅ — Customer bottom: "places" at x=96.82, "has" at x=128.82 (32px gap); Order top: "places" at x=96.82, "creates" at x=128.82 (32px gap)
6. Skip edges visible end-to-end ✅ — "places" edge clearly traced from Customer to Order
7. Multiple ports on same wall have gap ✅ — both Customer bottom and Order top have 32px port separation
8. No overlapping arrowheads ✅ — arrowheads at Order top at distinct x positions
9. Ports on correct walls ✅ — all hierarchical edges exit bottom, enter top
10. Arrowhead axis-aligned ✅
11. Arrowhead direction matches last segment ✅ — last segments are all downward, arrowheads point down
12. Labels not overlapping arrowheads ✅ — "places" label at x=193, mid-segment
13. Labels readable, outside nodes ✅
14. No node overlaps ✅ — clear separation between all nodes
15. No excessive whitespace gaps ✅ — vertical spacing is used by the skip edge routing

### Minor Observation (not a FAIL)

The "has" edge exits Customer at x=128.82 (not center x=96.82) and jogs left before entering ShoppingCart. This slight bend is intentional — it gives "has" a distinct exit port from "places" on Customer's bottom wall, satisfying principle 5. Functionally correct.

Full verdict: `.squad/decisions/inbox/ken-verdict-optiona.md`

## 2026-06-27T19:51:00-04:00 — commit 1ef7cb7 Review (port rasterize)

**Files:** `examples/class/class-ken-port.png`, `examples/class/class.svg`

**Commit:** `1ef7cb7` — fix(layout): add dummy-protection conflicts to BK Phase 4

**Verdict:** ✅ PASS

### What I Saw

**Layout:** E-Commerce Domain Model. Left column (top→bottom): Customer, ShoppingCart, Order, OrderItem, Product. Customer and Order centered at x=89 (box x=24→154). ShoppingCart at x=112→257.63, y=255.5→347.5 (center x=184.815). Right column: CreditCardPayment (y=65→175), Payment (y=248→355). All nodes clear and non-overlapping.

### Edges verified from SVG paths

1. **"places" (Customer → Order, 3-layer skip):**
   Path: `M 89 184 L 89 216 L 89 216 L 89 387 L 89 387 L 89 419`
   — Straight vertical at **x=89**, y=184→419. Intermediate waypoints at y=216 and y=387 are degenerate (point doubles). Effectively one unbroken vertical. Arrowhead open V at (89, 419) pointing down.
   — **Principle #3 check:** ShoppingCart bounding box is x=112→257.63, y=255.5→347.5. The edge travels at x=89, which is **23 SVG pixels to the LEFT** of ShoppingCart's left border (x=112). No intersection. ✅

2. **"has" (Customer → ShoppingCart):**
   Path: `M 138 184 L 138 219.75 L 128 219.75 L 128 255.5`
   — Exits Customer bottom at x=138 (offset 49px from center), jogs left at y=219.75 to x=128, enters ShoppingCart top at (128, 255.5). L-shaped, fully orthogonal. Arrowhead pointing down. ✅

3. **"creates" (ShoppingCart → Order):**
   Path: `M 128 347.5 L 128 383.25 L 138 383.25 L 138 419`
   — Exits ShoppingCart bottom at (128, 347.5), jogs right at y=383.25 to x=138, enters Order top at (138, 419). L-shaped, fully orthogonal. Arrowhead pointing down. ✅
   — Customer and Order bottom/top ports: "places" uses x=89, "has"/"creates" use x=128/138. No port collision.

4. **"contains" (Order → OrderItem, composition):**
   Path: `M 89 547 L 89 611` — straight vertical. Filled diamond at (89, 547). Label "contains" at midpoint. ✅

5. **"references" (OrderItem → Product):**
   Path: `M 89 703 L 89 767` — straight vertical. Open arrowhead at (89, 767) pointing down. ✅

6. **CreditCardPayment → Payment (realizes):**
   Path: `M 368.6325 248 L 368.6325 175` — straight vertical, upward (Payment→CreditCardPayment direction). Dashed stroke. Hollow open triangle at Payment top, apex pointing toward Payment. ✅

### 15-Principle Checklist

1. Every edge rectilinear ✅ — all paths are pure H/V segments (zero diagonals)
2. No edge crosses another ✅ — "places" at x=89; "has"/"creates" at x=128/138; left column verticals at x=89; right column at x=368.63
3. No edge through unconnected node ✅ — "places" at x=89 is 23px left of ShoppingCart (left edge x=112); no other edge crosses unconnected nodes
4. No two edges share a segment ✅ — "places" vertical x=89 vs "has"/"creates" at x=128/138; no shared coordinates
5. Same-wall edges have distinct paths ✅ — Customer bottom: "places" x=89, "has" x=138 (49px gap); Order top: "places" x=89, "creates" x=138 (49px gap)
6. Skip edges visible end-to-end ✅ — "places" clean straight vertical, fully traceable
7. Multiple ports on same wall have gap ✅ — 49px port separation on Customer bottom and Order top
8. No overlapping arrowheads ✅ — arrowheads at distinct positions
9. Ports on correct walls ✅ — all downward hierarchical edges exit bottom, enter top
10. Arrowhead axis-aligned ✅
11. Arrowhead direction matches last segment ✅ — all downward last segments, arrowheads point down
12. Labels not overlapping arrowheads ✅ — "places" label at y=298, well clear of arrowhead at y=407.95
13. Labels readable, outside nodes ✅
14. No node overlaps ✅ — clear visual separation
15. No excessive whitespace ✅ — compact layout, right-column gap is natural inter-column spacing

### Key Technical Note

Commit 1ef7cb7's BK dummy-protection fix achieves a simpler and cleaner result than Option A (commit 9783ff2). Instead of routing the "places" skip edge through the inter-column corridor at x=192.63, the dummy node now aligns to x=89 (same as Customer and Order centers), producing a single clean vertical. This satisfies Principle #3 by route geometry (x=89 is left of ShoppingCart x=112) rather than by corridor routing.

Full verdict: `.squad/decisions/inbox/ken-verdict-port.md`

---

## Review #5 — commit d15b9b9 — class-snap.png

**Date:** 2026-06-27T20:35:36-04:00
**Commit:** d15b9b9
**Task:** Post-balance dummy snap review — Customer/ShoppingCart/Order x=96.82 alignment

### What Changed (per brief)
- Dummy-protection conflicts removed
- Post-balance dummy snap added
- Skip edges excluded from cascade port assignment
- ShoppingCart, Customer, Order all at x=96.82 — "has", "creates", "places" expected as straight verticals

### Node Layout
- **Customer** — top-left, y=56–184, center x=96.82
- **ShoppingCart** — middle-left, y=255.5–347.5, center x=96.82
- **Order** — below ShoppingCart, y=419–547, center x=96.82
- **OrderItem** — y=611–703, center x=96.82
- **Product** — bottom, y=767+, center x=96.82
- **CreditCardPayment** — top-right, center x=280.63
- **Payment (interface)** — middle-right, y=175–248, center x=280.63

### Edge Paths (SVG ground truth)

| Edge | Path | Notes |
|------|------|-------|
| **has** (Customer→ShoppingCart) | `M 96.816 184 L 96.816 255.5` | Straight vertical ✓ |
| **creates** (ShoppingCart→Order) | `M 96.816 347.5 L 96.816 419` | Straight vertical ✓ |
| **places** (Customer→Order) | `M 96.82 184 L 96.82 216 L 96.82 216 L 96.82 387 L 96.82 387 L 96.82 419` | Same x=96.82 — full overlap ✗ |
| **contains** (Order→OrderItem) | `M 96.816 547 L 96.816 611` | Straight vertical ✓, filled diamond |
| **references** (OrderItem→Product) | `M 96.816 703 L 96.816 767` | Straight vertical ✓ |
| **implements** (CreditCardPayment→Payment) | `M 280.633 248 L 280.633 175` | Dashed vertical ✓ |

### Critical Findings

#### "places" is completely invisible
- **Segment y=184→255.5**: "places" path overlaps "has" path exactly (x=96.82, y=184→255.5). Drawn first, then "has" renders on top.
- **Segment y=255.5→347.5**: "places" path passes through the interior of the ShoppingCart box — invisible behind node fill.
- **Segment y=347.5→419**: "places" path overlaps "creates" path exactly (x=96.82). Both layers render the same pixels.
- **Label y=298**: "places" text falls inside the ShoppingCart box (y=255.5–347.5) — buried, invisible.
- **Arrowhead at y=419**: "places" arrowhead `M 101.49 407.95 L 96.82 419 L 92.14 407.95` is pixel-identical to "creates" arrowhead. Two arrowheads drawn at the same coordinates.

### 15-Principle Evaluation

1. All nodes visible ✅
2. All edges have visible path ❌ — "places" entirely invisible (buried under "has", ShoppingCart box, "creates")
3. No edge crosses a node it is not incident to ❌ — "places" passes through ShoppingCart interior
4. **No two edges share a segment** ❌ — "places" shares y=184→255.5 with "has"; shares y=347.5→419 with "creates"
5. Edge routing meaningful ❌ — "places" has redundant intermediate waypoints at y=216 and y=387 (no bends, same x)
6. Arrowheads correct type ✅ — open chevrons for associations, filled diamond for aggregation, open triangle for implements
7. **Multiple ports on same wall have gap** ❌ — "places" and "has" both exit Customer bottom at exactly x=96.82, y=184 — zero gap
8. **No overlapping arrowheads** ❌ — "places" and "creates" arrowheads pixel-identical at (96.82, 419)
9. Multiplicity labels readable ⚠️ — "1" (places, y=194) and "has" label (y=216) both in same corridor; "*" (places, y=409) near "creates" label (y=379), crowded
10. No label overlaps ❌ — "places" label (y=298) inside ShoppingCart node, invisible
11. Labels not overlapping arrowheads ❌ — "places" label is hidden inside ShoppingCart box
12. Labels readable, outside nodes ❌ — "places" label is inside ShoppingCart, not outside
13. No node overlaps ✅
14. No excessive whitespace ✅
15. Consistent visual style ✅ — consistent stroke colors and weights

### Verdict: ❌ FAIL

**Core failure:** The "places" (Customer→Order) skip edge was snapped to x=96.82 along with Customer, ShoppingCart, and Order — producing a straight vertical that is completely coincident with "has" (y=184→255.5) and "creates" (y=347.5→419). The edge is entirely invisible, its label is buried inside ShoppingCart, and its arrowhead overlaps "creates" arrowhead pixel-for-pixel. Principles #2, #3, #4, #7, #8, #10, #11, #12 are violated.

**Root cause:** Skip edges (Customer→Order) must NOT be snapped to the same x-coordinate as the intermediate node (ShoppingCart). The "skip edges excluded from cascade port assignment" fix is insufficient — the snap alignment itself must exclude skip edges, or route them on a lateral offset.

Full verdict: `.squad/decisions/inbox/ken-verdict-snap.md`

---

## Review: commit b254d5d — obstacle-aware dummy snap
**Date:** 2026-06-27  
**Requested by:** ormasoftchile  
**PNG:** `examples/class/class-ken-smart-snap.png`

### What Changed (per brief)
- Skip-edge dummies now snap to just past intermediate box right edge when blocked
- "places" (Customer→Order): laneX=181.63 (ShoppingCart right edge 169.63 + 12px gap)
- "has" and "creates": straight verticals at x=96.82 (unchanged)

### Node Layout (SVG ground truth)
| Node | x-range | y-range | center-x |
|------|---------|---------|---------|
| Customer | 31.82–161.82 | 56–184 | 96.82 |
| ShoppingCart | 24–169.63 | 255.5–347.5 | 96.82 |
| Order | 31.82–161.82 | 419–547 | 96.82 |
| OrderItem | 31.82–161.82 | 611–703 | 96.82 |
| Product | 31.82–161.82 | 767–877 | 96.82 |
| CreditCardPayment | 215.63–345.63 | 65–175 | 280.63 |
| Payment (interface) | 215.63–345.63 | 248–355 | 280.63 |

### Edge Paths (SVG ground truth)

| Edge | Path | Notes |
|------|------|-------|
| **has** (Customer→ShoppingCart) | `M 96.816 184 L 96.816 255.5` | Straight vertical ✓ |
| **creates** (ShoppingCart→Order) | `M 96.816 347.5 L 96.816 419` | Straight vertical ✓ |
| **places** (Customer→Order) | `M 96.82 184 L 96.82 216 L 181.63 216 L 181.63 387 L 96.82 387 L 96.82 419` | 5-segment detour ✓ — matches expected exactly |
| **contains** (Order→OrderItem) | `M 96.816 547 L 96.816 611` | Straight vertical, filled diamond ✓ |
| **references** (OrderItem→Product) | `M 96.816 703 L 96.816 767` | Straight vertical, open chevron ✓ |
| **implements** (CreditCardPayment→Payment) | `M 280.633 248 L 280.633 175` | Dashed vertical, hollow triangle ✓ |

### Labels
| Label | Position | Notes |
|-------|---------|-------|
| "has" | x=97, y=216 (center) | Mid-edge ✓ |
| "creates" | x=97, y=379 (center) | Mid-edge ✓ |
| "places" | x=182, y=298 (center) | Right vertical midpoint — partially clips ShoppingCart right border ⚠️ |
| "contains" | x=97, y=575 (center) | Mid-edge ✓ |
| "references" | x=97, y=731 (center) | Mid-edge ✓ |
| Multiplicity "1" | x=106.82, y=194 | Source end of "places" |
| Multiplicity "*" | x=106.82, y=409 | Target end of "places" |

### Critical Findings

#### IMPROVEMENT: "places" is now visible ✅
Previous commit had "places" collinear with "has"+"creates" at x=96.82 — completely invisible. This commit routes "places" via laneX=181.63, producing a clearly visible 5-segment orthogonal path around ShoppingCart. The label "places" is visible to the right of ShoppingCart. Core objective achieved.

#### Remaining Violation A: Shared stub at Customer bottom (Principles #4, #7)
- "places" first segment: (96.82, 184→216) — 32px vertical
- "has" path: (96.82, 184→255.5) — includes the same 32px range
- Both edges exit Customer bottom at identical pixel (96.82, 184) — zero port gap
- Visually: the first 32px of "places" and "has" are co-rendered, indistinguishable

#### Remaining Violation B: Shared stub at Order top (Principles #4, #7)
- "places" last segment: (96.82, 387→419) — 32px vertical
- "creates" path: (96.82, 347.5→419) — last 32px of this range is identical
- Both edges enter Order top at identical pixel (96.82, 419) — zero port gap
- This 32px overlap at the bottom renders as a single thicker-than-expected line

#### Remaining Violation C: Duplicate arrowheads (Principle #8)
- "places" arrowhead SVG: `M 101.49 407.95 L 96.82 419 L 92.14 407.95`
- "creates" arrowhead SVG: `M 101.49 407.95 L 96.82 419 L 92.14 407.95`
- **Pixel-identical.** Two SVG `<path>` elements with same coordinates. Visually rendered as one arrowhead; semantically ambiguous — which edge is terminating where?

#### Minor: "places" label clips ShoppingCart (Principle #12)
- "places" centered at x=182, ~33px wide → left edge ≈ x=165.5
- ShoppingCart right edge = x=169.63 → ~4px overlap with box border

### 15-Principle Evaluation

1. All nodes visible ✅
2. All edges have visible path ✅ — **FIXED** from prior commit; "places" is now traceable
3. No edge crosses non-incident node ✅ — "places" clears ShoppingCart at x=181.63 (+12px)
4. No two edges share a collinear segment ❌ — "places"↔"has" share (96.82, y=184–216); "places"↔"creates" share (96.82, y=387–419)
5. Routing is purposeful ✅ — 5-segment detour is necessary; each bend justified
6. Arrowhead semantics correct ✅ — chevrons for associations, filled diamond for aggregation, hollow triangle for realization
7. Multiple ports on same wall spread with gap ❌ — "has" and "places" both exit Customer bottom at x=96.82; "creates" and "places" both enter Order top at x=96.82
8. No two arrowheads at same pixel ❌ — "places" and "creates" arrowheads are pixel-identical at (96.82, 419)
9. Multiplicity labels readable ⚠️ — "1" and "*" both sit in shared-stub zones; small but offset +10px right, just legible
10. No edge-label overlaps ⚠️ — "has" label at y=216 sits exactly at "places" bend row; visually adjacent but not overlapping text
11. Labels not overlapping arrowheads ✅
12. Labels readable, outside nodes ⚠️ — "places" text clips ShoppingCart right border by ~4px
13. No node overlaps ✅
14. No excessive whitespace ✅
15. Consistent visual style ✅

### Verdict: ❌ FAIL (with notable improvement)

**Major improvement:** "places" is visible and correctly routed around ShoppingCart. Principles #2 and #3 are now satisfied.  
**Remaining failures:** Principles #4, #7, and #8 — stub overlaps at both source and target ports, and duplicate arrowheads at Order top.  
**Root cause of remaining failures:** The obstacle-aware snap assigns laneX=181.63 for the *middle* segment but does not offset the exit port on Customer or the entry port on Order. "has" and "places" still share the Customer bottom port; "creates" and "places" still share the Order top port.  
**Fix required:** Assign distinct x-offset ports on Customer bottom (e.g., "has" at x=86.82, "places" at x=106.82) and on Order top (e.g., "creates" at x=86.82, "places" at x=106.82). This eliminates the shared stubs and duplicate arrowhead.

Full verdict: `.squad/decisions/inbox/ken-verdict-smart-snap.md`

---

## Review: commit 23c3c84 — Ideal Port Routing (2026-06-27)

**Task:** Review the "ideal" port routing commit. Verify three specific paths and assess all 15 principles.

### Path Verification
- **has:** `M 96.81625 184 L 96.81625 255.5` — ✅ exact match, straight vertical
- **creates:** `M 96.81625 347.5 L 96.81625 419` — ✅ exact match, straight vertical
- **places:** `M 145.82 184 L 145.82 216 L 181.63 216 L 181.63 387 L 145.82 387 L 145.82 419` — ✅ exact match, 5-segment bypass

### Key Findings
- P4 (no shared segments): ✅ **FIXED** — "places" now uses x=145.82 for stubs, completely separate from "has"/"creates" at x=96.81625
- P7 (port gaps): ✅ **FIXED** — Customer bottom: 49px gap between "has" (x=96.82) and "places" (x=145.82); Order top: same 49px gap
- P8 (no overlapping arrowheads): ✅ **FIXED** — "creates" arrowhead at (96.82, 419), "places" at (145.82, 419) — distinct coordinates
- P3 (no crossing non-incident node): ✅ — lane x=181.63 clears ShoppingCart right (169.63) by 12px
- P6 (arrowhead semantics): ✅ — chevrons, filled diamond, hollow triangle all correct
- P12 (labels outside nodes): ⚠️ minor — "places" label left edge ~165.5 slightly clips ShoppingCart right border at 169.63 by ~4px; cosmetic only

### 15-Principle Summary
1. All nodes visible ✅  2. All edges visible ✅  3. No crossing ✅  4. No shared segments ✅ FIXED  5. Purposeful routing ✅  6. Correct semantics ✅  7. Port spread ✅ FIXED  8. No dup arrowheads ✅ FIXED  9. Multiplicity readable ✅  10. No label overlap ✅  11. Labels clear of arrowheads ✅  12. Labels outside nodes ⚠️  13. No node overlap ✅  14. No excess whitespace ✅  15. Consistent style ✅

### Verdict: ✅ PASS
All three prior critical failures resolved. Cosmetic P12 hairline clip does not meet FAIL threshold.

Full verdict: `.squad/decisions/inbox/ken-verdict-ideal.md`

---

## Review: commit ea3e43c — dagre-faithful port (2026-06-27T21:55:00-04:00)

**Diagram:** `examples/class/class.svg`  
**PNG:** `examples/class/class-ken-dagre-port.png` (1400px)  
**Verdict:** ❌ FAIL

### Critical Finding: "has" and "creates" jog — visible regression

**has edge:** `M 96.81625 184 L 96.81625 219.75 L 100.724375 219.75 L 100.724375 255.5`  
**creates edge:** `M 100.724375 347.5 L 100.724375 383.25 L 96.81625 383.25 L 96.81625 419`

Both edges have a 3.9px horizontal jog (SVG) = **13.9px at 1400px rendered width**. The jog is visually apparent as a Z-step in what should be a clean straight vertical. Root cause: BK coordinate assignment yields Customer center x=100.720, ShoppingCart center x=96.815 — a 3.905px misalignment between nodes that should be co-linear in a TB layout.

**Regression:** Previous commit 23c3c84 had both edges as single-segment straight verticals (`M 96.81625 184 L 96.81625 255.5` and `M 96.81625 347.5 L 96.81625 419`).

### What was preserved
- "places" 5-segment bypass (x=149.72 stubs, lane x=181.63) unchanged ✅  
- Port separation on Customer bottom and Order top (52.9px gap) ✅  
- Distinct arrowheads on Order top ✅  
- All arrowhead semantics correct ✅  
- All other edges straight verticals ✅

### 15-Principle Summary
1 ✅ 2 ✅ 3 ✅ 4 ✅ **5 ❌** 6 ✅ 7 ✅ 8 ✅ 9 ✅ 10 ✅ 11 ✅ **12 ⚠️** 13 ✅ 14 ✅ 15 ✅

P5 FAIL: "has" and "creates" jogs are unjustified — no obstacle between nodes; straight vertical is achievable.  
P12 ⚠️: "places" label hairline-clips ShoppingCart right border by ~4px (cosmetic, not FAIL-level).

Full verdict: `.squad/decisions/inbox/ken-verdict-dagre-port.md`

---

## Review: commit 3448628 — column snap fix
**Date:** 2026-06-27T22:36:29-04:00  
**Requested by:** ormasoftchile  
**Artifact:** `examples/class/class-ken-chain-snap.png`

### Path data extracted from SVG
- **"has":** `M 96.81625 184 L 96.81625 255.5` — single-segment straight vertical ✅  
- **"creates":** `M 96.81625 347.5 L 96.81625 419` — single-segment straight vertical ✅  
- **"places":** `M 145.82 184 L 145.82 216 L 181.63 216 L 181.63 387 L 145.82 387 L 145.82 419` — 5-segment via laneX=181.63 ✅  

### Visual findings
"has" and "creates" are both clean, plumb vertical lines sharing x=96.81625. Zero horizontal jog. The P5 failure from the prior dagre-port review is fully resolved. "places" routes via the right bypass lane (x≈181.63) in exactly 5 segments. The "places" label remains hairline-clipped by ShoppingCart's right border (the "p" is obscured), a pre-existing cosmetic issue.

### 15-Principle Summary
1 ✅ 2 ✅ 3 ✅ 4 ✅ **5 ✅** 6 ✅ **7 ⚠️** 8 ✅ 9 ✅ 10 ✅ 11 ✅ **12 ⚠️** 13 ✅ 14 ✅ 15 ✅

P7 ⚠️ / P12 ⚠️: "places" label partially clipped by ShoppingCart right border (pre-existing cosmetic, non-blocking).

### Verdict: **PASS**
Previous P5 ❌ (column misalignment jog) is resolved. All spec paths confirmed correct.

---

## Review: commit e2a9d04 — routing optimizer
**Date:** 2026-06-28T10:20:09-04:00
**Requested by:** ormasoftchile
**Artifact:** `examples/class/class-ken-optimizer.png`

### Path data extracted from SVG
- **"places":** `M 145.82 184 L 145.82 216 L 186.77 216 L 186.77 387 L 145.82 387 L 145.82 419` — 5-segment via interColMidpoint laneX=186.77 ✅
- **Label:** `<text x="187" y="298" text-anchor="middle">places</text>` — centered on vertical bypass segment ✅
- **Multiplicity `1`:** `(155.82, 194)` — 10px right of exit segment, 10px below source ✅
- **Multiplicity `*`:** `(155.82, 409)` — 10px right of arrival segment, 10px above arrowhead ⚠️ (slightly cramped)
- **Arrowhead:** `M 150.49 407.95 L 145.82 419 L 141.14 407.95` — open arrow, arriving at Order ✅

### Visual findings
"places" routes from ShoppingCart's right-side exit (x=145.82, y=184), drops 32px vertically, jogs 40.95px right into the inter-column bypass lane at x=186.77, travels 171px south, jogs 40.95px left back to x=145.82, then drops 32px into Order's top (y=419). The label is placed at (187, 298) — the precise midpoint of the vertical bypass segment — with `text-anchor="middle"`, sitting squarely in the column gap whitespace. **This resolves the hairline-clip ⚠️ from commit 3448628** where laneX=181.63 caused the leading "p" of "places" to be obscured by ShoppingCart's right border.

The `*` multiplicity at (155.82, 409) sits 10px above the arrowhead terminus (419), leaving minimal breathing room but remaining legible. All other edges ("has", "creates", "contains", "references") are unaffected.

### 15-Principle Assessment
| # | Principle | Status |
|---|-----------|--------|
| P1 | Clarity of intent (ShoppingCart→Order places) | ✅ |
| P2 | Label legibility — "places" fully unclipped, clear | ✅ |
| P3 | Node-edge separation — exits cleanly at (145.82, 184) | ✅ |
| P4 | Routing efficiency — 5-seg bypass is necessary (avoids "creates" conflict) | ✅ |
| P5 | Vertical plumb — source x=145.82 = destination x=145.82 exactly | ✅ |
| P6 | Label positioning — midpoint of vertical bypass, text-anchor=middle | ✅ |
| P7 | Label overlap — x=187 is clear of right-column nodes (~x≥228) and all edges | ✅ |
| P8 | Visual hierarchy — top-to-bottom flow maintained | ✅ |
| P9 | Multiplicity legibility — `1` clear; `*` at y=409 slightly cramped near arrowhead | ⚠️ |
| P10 | Semantic correctness — ShoppingCart "places" Order is domain-correct | ✅ |
| P11 | Consistent styling — stroke #64748B w=1.3, same as all other edges | ✅ |
| P12 | Whitespace management — bypass lane x≈186.77 occupies clear inter-column gap | ✅ |
| P13 | Arrowhead clarity — open-chevron arrow, direction unambiguous | ✅ |
| P14 | Reading direction — South flow ShoppingCart→Order is canonical | ✅ |
| P15 | Overall composition — diagram reads cleanly; bypass adds no confusion | ✅ |

**Score: 14 ✅ / 1 ⚠️ / 0 ❌**

### Verdict: **PASS**
The optimizer's recalculation of interColMidpoint to laneX=186.77 (from 181.63) resolves the label-clip regression. "places" is now fully visible, correctly positioned, and non-overlapping. The only residual issue (P9 `*` cramped near arrowhead) is minor cosmetic and pre-existing in nature. No regressions on other edges.

---

## Review: commit b9b7eda — multi-wall routing
**Date:** 2026-06-28T10:43:14-04:00  
**Requested by:** ormasoftchile  
**Artifact:** `examples/class/class-ken-multiwall.png` (1400px wide)

### Context
Additive commit on top of 89e7b36. Added 5 new routing strategies to the candidate pool (multi-wall routing variants). "places" edge expected to route identically to prior PASS via Strategy A (laneX=186.77). Net visual effect: zero.

### Path data — byte-for-byte match with prior PASS
- **"places":** `M 145.82 184 L 145.82 216 L 186.77 216 L 186.77 387 L 145.82 387 L 145.82 419` ✅
- **Label:** `<text x="187" y="298" text-anchor="middle">places</text>` ✅
- **"has":** `M 96.81625 184 L 96.81625 255.5` ✅
- **"creates":** `M 96.81625 347.5 L 96.81625 419` ✅
- All other edges unchanged ✅

The 5 new multi-wall candidates were not elected for this diagram's geometry. Strategy A (laneX=186.77) remained optimal.

### 15-Principle Assessment
1 ✅ 2 ✅ 3 ✅ 4 ✅ 5 ✅ 6 ✅ 7 ✅ 8 ✅ **9 ⚠️** 10 ✅ 11 ✅ 12 ✅ 13 ✅ 14 ✅ 15 ✅

P9 ⚠️: `*` multiplicity cramped near arrowhead (pre-existing, non-blocking).

**Score: 14 ✅ / 1 ⚠️ / 0 ❌**

### Verdict: **PASS** ✅
Zero regression from 89e7b36. Geometry identical. Multi-wall strategies integrate cleanly without displacing winning Strategy A.

Full verdict: `.squad/decisions/inbox/ken-verdict-multiwall.md`

---

## Review: commit 89e7b36 — Adaptive left-margin candidate + expansion penalty
**Date:** 2026-06-28T10:32:00-04:00
**Requested by:** ormasoftchile
**Artifact:** `examples/class/class-ken-leftmargin.png` (1400px wide)

### Context
Additive commit on top of e2a9d04 (prior PASS). Adds adaptive left-margin candidate and expansion penalty to the lane optimizer. "places" edge still routes via `interColMidpoint` at laneX=186.77 — net visual effect should be identical to prior PASS.

### Visual findings
Rasterization confirmed. "places" routes identically to e2a9d04: ShoppingCart right-side exit → inter-column bypass at laneX≈186.77 → Order top. Label positioned at midpoint of vertical bypass segment, fully unclipped and legible. No visual change from the new optimizer logic — the adaptive left-margin candidate and expansion penalty were not elected for this diagram's geometry.

All other edges ("has", "creates", "contains", "references") and relationship markers (filled diamond on "contains", dashed realization CreditCardPayment→Payment, hollow triangle arrowhead) are unchanged and correct.

### 15-Principle Assessment
| # | Principle | Status |
|---|-----------|--------|
| P1 | Clarity of intent — domain model readable at a glance | ✅ |
| P2 | Label legibility — "places" fully unclipped, laneX=186.77 preserved | ✅ |
| P3 | Node-edge separation — clean exits on all nodes | ✅ |
| P4 | Routing efficiency — 5-seg bypass unchanged from prior PASS | ✅ |
| P5 | Vertical plumb — left-column spine alignment maintained | ✅ |
| P6 | Label positioning — "places" at bypass midpoint, text-anchor=middle | ✅ |
| P7 | Label overlap — no label/node/edge overlap detected | ✅ |
| P8 | Visual hierarchy — top-to-bottom flow maintained | ✅ |
| P9 | Multiplicity legibility — `1` clear; `*` slightly cramped near arrowhead (pre-existing ⚠️) | ⚠️ |
| P10 | Semantic correctness — all relationship labels domain-correct | ✅ |
| P11 | Consistent styling — stroke, color, font uniform across all nodes/edges | ✅ |
| P12 | Whitespace management — bypass lane in clear inter-column gap | ✅ |
| P13 | Arrowhead clarity — open chevron, hollow triangle, filled diamond all correct | ✅ |
| P14 | Reading direction — south flow canonical and unambiguous | ✅ |
| P15 | Overall composition — diagram reads cleanly, no regression introduced | ✅ |

**Score: 14 ✅ / 1 ⚠️ / 0 ❌**

### Verdict: **PASS**
Visually identical to prior PASS (e2a9d04). Additive optimizer changes (adaptive left-margin candidate + expansion penalty) produced no net visual effect. No regressions on any edge or label.


---

## Review: commit 2e259cd — "places" left-side routing (Strategy B)
**Date:** 2026-06-28T11:00:25-04:00
**Requested by:** ormasoftchile
**Artifact:** `examples/class/class-ken-leftroute.png`

### SVG Geometry (measured)
| Item | Value | Expected | Match |
|------|-------|----------|-------|
| Customer box | y=56, h=128 | — | — |
| Customer mid-height | y=120.0 | y=120 | ✅ exact |
| Order box | y=419, h=128 | — | — |
| Order mid-height | y=483.0 | y=483 | ✅ exact |
| ShoppingCart mid-height | y=301.5 | — | — |
| Route exit point | (31.82, 120) | Customer left wall, mid | ✅ |
| Lane x | 19.82 | ≈19.82 | ✅ |
| Route entry point | (31.82, 483) | Order left wall, mid | ✅ |
| Arrowhead tip | (31.82, 483) | Order left wall mid | ✅ |
| Label x/anchor | x=16, text-anchor=end | left of lane | ✅ |
| Label y | 298 | ≈301.5 (ShoppingCart mid) | ≈ (Δ3.5px) |
| Label left clearance | ≈6px SVG / ≈20px PNG | >0 | ✅ |

### Route Path (SVG line 4)
```
M 31.82 120 L 19.82 120 L 19.82 483 L 31.82 483
```
Three segments: Customer-left exit → lane entry → vertical descent → Order-left entry. ✅

### Arrowhead (SVG line 5)
```
M 20.76 478.33 L 31.82 483 L 20.76 487.67
```
Open chevron, tip at Order left wall (31.82, 483), pointing right (→). Correct direction for Customer→Order. ✅

### "has" (SVG line 17–19)
`M 96.81625 184 L 96.81625 255.5` — pure vertical, x constant. ✅

### "creates" (SVG line 20–22)
`M 96.81625 347.5 L 96.81625 419` — pure vertical, x constant. ✅

### 15-Principle Audit
1. **Visibility** — "places" fully legible in rendered PNG. ✅
2. **Correctness** — Route follows Strategy B spec (Left→Left). ✅
3. **Precision** — Entry/exit at exact mid-heights (pixel-perfect). ✅
4. **Label placement** — Right-edge at x=16, left of lane at x=19.82, anchor=end. ✅
5. **Label vertical alignment** — y=298 vs ShoppingCart center y=301.5 (Δ3.5px). Acceptable. ⚠️ minor
6. **Arrowhead direction** — Points right into Order. ✅
7. **Arrowhead type** — Open chevron (association/navigation). Consistent with "has"/"creates"/"references". ✅
8. **Arrowhead position** — Tip touches Order left wall exactly. ✅
9. **No overlap** — Left margin lane (x=19.82) does not intersect any box (Customer/ShoppingCart/Order all start at x=31.82). ✅
10. **Straight verticals preserved** — "has" and "creates" unchanged. ✅
11. **Canvas left margin** — No clipping; label clears viewBox left (x=-24) with ≈6px SVG margin. ✅
12. **Stroke consistency** — stroke="#64748B", stroke-width=1.3/1.4, matches all other edges. ✅
13. **Color consistency** — "#64748B" label fill matches all relation labels. ✅
14. **Font consistency** — Inter, 11px, same as "has"/"creates"/"contains"/"references". ✅
15. **No artifacts** — No stray lines or ghost paths in left margin. ✅

### Verdict
**PASS** — All five routing requirements satisfied. One minor note: label y=298 is 3.5px above ShoppingCart mid-height (301.5) — sub-threshold, no visual impact.

---

## Review: commit 2c245f7 — breathing room and label fix
**Date:** 2026-06-28T11:13:04-04:00
**Requested by:** ormasoftchile
**Artifact:** `examples/class/class-ken-breathing.png` (1400px wide)

### What Changed (per diff)
- `LANE_CLEARANCE`: 32 → 48 (wider breathing gap from boxes to lane rail)
- `expansionPenalty`: 1.0 → 0.05 (canvas expansion no longer penalised heavily)
- `LABEL_EXTRA = 48`: viewBox expanded 48 extra SVG units leftward to ensure "places" label is never clipped

### SVG Geometry (measured)

| Item | SVG Value | Rendered px @ 1400w |
|------|-----------|---------------------|
| Lane rail x | 7.82 | — |
| Customer/Order box left | 31.82 | — |
| Lane-to-box gap | **24 SVG units** | **~72.7 px** |
| ShoppingCart box left | 24.00 | — |
| Lane-to-ShoppingCart gap | 16.18 SVG units | ~49 px |
| "places" text right edge (text-anchor=end, x=4) | x=4 | — |
| Gap: label right → lane rail | **3.82 SVG units** | **~11.6 px** |
| ViewBox left edge | x=−72 | — |
| Label left extent (6 chars × ~6.5 SVG) | x≈−35 | — |
| Canvas left clearance for label | ~37 SVG units | ~112 px ✅ |
| "1" cardinal position | x=21.82, y=110 | 42 px right of rail |
| "*" cardinal position | x=21.82, y=473 | 42 px right of rail |

### Point-by-Point Assessment

**"places" label — fully visible?**
Yes. Text right edge at x=4 with text-anchor=end. ViewBox starts at x=−72, so there is ~112px of rendered canvas to the left of the label — no clipping. LABEL_EXTRA=48 fully resolved the prior canvas-clip risk. Gap to the lane rail is 11.6px — tight but identical to prior PASS commit (2e259cd), consistent, and legible at 1400px render.

**Lane-to-box distance — rendered pixels?**
~72.7px to Customer/Order (left edge x=31.82 − lane x=7.82 = 24 SVG × 3.03).
~49px to ShoppingCart (left edge x=24 − lane x=7.82 = 16.18 SVG × 3.03).
Clear improvement over prior commit where the gap was ~36px.

**"1" and "*" cardinality — readable and adjacent?**
Both at x=21.82 — midway between lane rail (x=7.82) and box left wall (x=31.82). "1" sits 10px below the top horizontal connector bracket; "*" sits 10px above the arrowhead terminus. Both are legible and unambiguous at render size.

**Any clipping?**
None. All connector paths, arrowheads, labels, and node content are within the expanded viewBox. The CreditCardPayment title fits tightly in its 130-wide box (pre-existing, not introduced by this commit).

### 15-Principle Assessment

| # | Status | Note |
|---|--------|------|
| P1 — Clarity of intent | ✅ | Domain model reads cleanly top-to-bottom |
| P2 — Label legibility | ✅ | "places" fully unclipped; canvas clearance ~112px |
| P3 — Node-edge separation | ✅ | Lane rail at x=7.82 clears all boxes |
| P4 — Routing efficiency | ✅ | 3-segment bracket is the minimal correct form |
| P5 — Vertical plumb | ✅ | Left-column vertical spine (x=96.82) unchanged |
| P6 — Label positioning | ✅ | "places" at y=298, midpoint of vertical span (y=120–483) |
| P7 — Label/node overlap | ✅ | Label in left margin, outside all node bounding boxes |
| P8 — Visual hierarchy | ✅ | Top-to-bottom flow maintained |
| P9 — Multiplicity legibility | ✅ | "1" and "*" readable, adjacent to connector ends |
| P10 — Semantic correctness | ✅ | Association with 1-to-many multiplicity correctly rendered |
| P11 — Consistent styling | ✅ | stroke #64748B, weight 1.3/1.4, font Inter 11px |
| P12 — Whitespace management | ✅ | Lane is in left margin; ~72px gap from box; no excess |
| P13 — Arrowhead clarity | ✅ | Open chevron pointing right (→) into Order left wall |
| P14 — Reading direction | ✅ | Customer→Order south flow unambiguous |
| P15 — Overall composition | ✅ | No regressions; right column clean; no artifacts |

**Score: 15 ✅ / 0 ⚠️ / 0 ❌**

### Verdict: ✅ PASS

Both commit objectives achieved:
1. **Label fix**: "places" is fully visible with ~112px canvas clearance left (LABEL_EXTRA=48 worked).
2. **Breathing room**: Lane-to-box gap is now ~72.7px (up from ~36px prior) — comfortable and unambiguous.

The 11.6px label-to-rail gap is tight but unchanged from prior PASS commit (2e259cd); not a regression. CreditCardPayment box label tightness is pre-existing and out of scope for this commit.

Full verdict: `.squad/decisions/inbox/ken-verdict-breathing.md`

---

## Review #4 — commit a9312ce · 2026-06-28T11:18:23-04:00
**Task:** "final breathing room fix"
**Artifact:** `examples/class/class-ken-final.png`

### Key Measurements
- viewBox: `-90 0 480 925`
- laneX = `-16.18`
- ShoppingCart left edge (widest box): `x=24` → gap **40 px** ✅
- Customer / Order left edges: `x=31.82` → gap **48 px** ✅
- "places" label at `x=-20, text-anchor=end` → ~35 px margin to canvas edge ✅

### Principle Scorecard

| # | Status | Note |
|---|--------|------|
| P1 — Clarity of intent | ✅ | E-Commerce domain model reads cleanly |
| P2 — Label legibility | ✅ | All edge labels unclipped, legible |
| P3 — Node-edge separation | ✅ | 40 px gap (min) between rail and box edge |
| P4 — Routing efficiency | ✅ | 3-segment bracket; single-segment all other edges |
| P5 — Vertical plumb | ✅ | Left-column spine x≈96.82 unchanged |
| P6 — Label positioning | ✅ | "places" at y=298, midpoint of 120–483 span |
| P7 — Label/node overlap | ✅ | "places" entirely in left margin, x=−20 |
| P8 — Visual hierarchy | ✅ | Bold title → bold class names → regular members |
| P9 — Multiplicity legibility | ✅ | "1" and "*" adjacent to bracket arm endpoints |
| P10 — Semantic correctness | ✅ | Association, composition diamond, realization triangle all correct |
| P11 — Consistent styling | ✅ | Uniform stroke #64748B / Inter 11px throughout |
| P12 — Whitespace management | ✅ | 40–48 px breathing room; 90 px expansion used efficiently |
| P13 — Arrowhead clarity | ✅ | Open chevron, filled diamond, open triangle semantically distinct |
| P14 — Reading direction | ✅ | Top-to-bottom main flow; rightward arrowhead into Order for "places" |
| P15 — Overall composition | ✅ | No overlap, no artefacts, clean two-column layout |

**Score: 15 ✅ / 0 ⚠️ / 0 ❌**

### Verdict: ✅ PASS

Both commit objectives confirmed: 40 px breathing room between bracket rail and box edge; "places" label fully visible with ~35 px canvas margin. No regressions. Full verdict: `.squad/decisions/inbox/ken-verdict-final.md`
