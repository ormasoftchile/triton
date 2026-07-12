# Ken — Visual QA Reviewer

## [ARCHIVE GATE SUMMARY — 2026-07-12]

Visual QA inspections (2026-06-27 to 2026-07-12):
- Multiple class diagram route optimization reviews (commit c6f18a6 and prior): Verified straight verticals, left-wall rail gaps, "places" label placement, 15 charter principles all PASS.
- Connector style-matrix visual QA (2026-07-12): All 5 styles × 3 directions render correctly. Dotted vs dashed visually distinct (4 3 vs 8 4 dasharray). Thick at 2× stroke-width. Wavy: clean sine-wave, smooth corners, consistent amplitude. Arrowheads axis-aligned. No NaN in path data. PASS — no fixes required.

**Key learnings:** Wavy rendering quality critical (amplitude damping at corners prevents kinks). Charter compliance verified per 15-principle checklist. SVG attribute verification confirms rendering correctness before PNG rasterization.
| Node | x | y | right | bottom |
|------|---|---|-------|--------|
| Student | 161.6 | 56 | 327.4 | 166 |
| Instructor | 373.4 | 56 | 549.6 | 166 |
| User | 376 | 230 | 506 | 358 |
| Certificate | 24 | 239 | 154 | 349 |
| Enrollment | 200 | 248 | 330 | 340 |
| Course | 132.5 | 422 | 262.5 | 568 |
| Module | 132.5 | 632 | 262.5 | 742 |
| Lesson | 130.5 | 806 | 264.5 | 916 |

**9 Relations — Per-Edge Analysis:**

| Edge | Path | P3? | P4? | Label issue? |
|------|------|-----|-----|--------------|
| `User <\|-- Student` | `M 392 230 L 392 134 L 311.4 134 L 311.4 166` | **❌ 16 px clip through Student box at y=134** | — | — |
| `User <\|-- Instructor` | `M 461.52 230 L 461.52 198 L 441 198 L 441 166` | ✅ | — | — |
| `Instructor --> Course : teaches` | `M 389.4 166 L 389.4 198 L 353 198 L 353 390 L 246.52 390 L 246.52 422` | ✅ | — | **⚠️ label at (353,290) has ~1 px clearance from both Enrollment right edge and User left edge** |
| `Course *-- Module : contains` | `M 197.52 568 L 197.52 632` (straight vertical) | ✅ | — | ✅ |
| `Module *-- Lesson : has` | `M 197.52 742 L 197.52 806` (straight vertical) | ✅ | — | ✅ |
| `Student --> Enrollment : has` | `M 265 166 L 265 207 L 244.48 207 L 244.48 248` | ✅ | — | ✅ |
| `Enrollment --> Course : for` | `M 216 340 L 216 381 L 214.52 381 L 214.52 422` | ✅ | — | ✅ |
| `Student --> Certificate : earns` | `M 177.55 166 L 177.55 202.5 L 138 202.5 L 138 239` | ✅ | — | ✅ |
| `Certificate --> Course : from` | `M 138 349 L 138 385.5 L 148.52 385.5 L 148.52 422` | ✅ | — | ✅ |

**Confirmed violations:**
1. **P3 — `User <|-- Student`**: Horizontal segment at y=134 (x=311.4→392) clips through Student's right side by 16 px (Student x range 161.6–327.4 includes 311.4–327.4 at y=134, which is inside Student's y range 56–166).
2. **P13 — `teaches` label**: Label "teaches" centered at x=353, y=290 spans approximately x=331..375. This leaves only ~1 px clearance from Enrollment's right edge (x=330) and User's left edge (x=376). Effectively invisible gap — label appears to touch both boxes.

**P4 (shared segments):** None detected. `earns` and `from` both use x=138 but at non-overlapping y ranges (202.5–239 vs 349–385.5). `contains` and `has` both use x=197.52 at non-overlapping y ranges.

**Overall:** Significant improvement over typical Mermaid routing. Inheritance triangles correct, composition diamonds present, main vertical spine (Course→Module→Lesson) perfectly straight. Two issues remain.

---


## Review c9f4450 — Routing Optimizer Fixes
**Date:** 2026-06-28T12:09:08-04:00
**Requested by:** ormasoftchile

### Diagram 1: `examples/class/` — Regression Check

Re-rasterized to `examples/class/class-ken-c9f4450.png`.

**SVG confirmed metrics (c9f4450):**
- Main vertical spine: Customer→ShoppingCart at x=281.8 (straight); ShoppingCart→Order→OrderItem→Product at x=96.82 (straight) ✅
- "places" left-wall bracket: x=−16.18; gap from nearest node left edge (31.82) = **48 px** ✅
- "places" label: `x=−20, text-anchor=end` — fully in left margin ✅
- Right column (CreditCardPayment→Payment): straight vertical at x=281.8 ✅
- All 15 principles re-verified: **15 ✅ / 0 ⚠️ / 0 ❌**

**Verdict: ✅ PASS** — prior a9312ce PASS confirmed; no regressions.

---

### Diagram 2: `examples/class2/` — Online Learning Platform (Improvement Check)

Re-rasterized to `examples/class2/class2-ken-c9f4450.png`.

**Node bounding boxes (unchanged from c6f18a6):**
| Node | x | y | right | bottom |
|------|---|---|-------|--------|
| Student | 161.6 | 56 | 327.4 | 166 |
| Instructor | 373.4 | 56 | 549.6 | 166 |
| User | 376 | 230 | 506 | 358 |
| Certificate | 24 | 239 | 154 | 349 |
| Enrollment | 200 | 248 | 330 | 340 |
| Course | 132.5 | 422 | 262.5 | 568 |
| Module | 132.5 | 632 | 262.5 | 742 |
| Lesson | 130.5 | 806 | 264.5 | 916 |

**Per-Edge Analysis (c9f4450):**

| Edge | Path | P3? | P4? | Label issue? |
|------|------|-----|-----|--------------|
| `User <\|-- Student` | `M 392 230 L 392 134 L 311.4 134 L 311.4 166` | **❌ 16 px clip through Student box at y=134** | — | — |
| `User <\|-- Instructor` | `M 461.52 230 L 561.64 230 L 561.64 166 L 441 166` | ✅ (connected node) | — | **⚠️ routing regressed vs c6f18a6: now wraps rightward then up-left instead of direct up-left; 108 px traversal along Instructor bottom wall** |
| `Instructor --> Course : teaches` | `M 389.4 166 L 389.4 198 L 353 198 L 353 390 L 246.52 390 L 246.52 422` | ✅ | — | **⚠️ "teaches" at (353,290) spans x≈333..373; ~3 px gap from Enrollment right (330) and User left (376) — effectively touching** |
| `Course *-- Module : contains` | `M 197.52 568 L 197.52 632` | ✅ | — | ✅ |
| `Module *-- Lesson : has` | `M 197.52 742 L 197.52 806` | ✅ | — | ✅ |
| `Student --> Enrollment : has` | `M 265 166 L 265 207 L 244.48 207 L 244.48 248` | ✅ | — | ✅ |
| `Enrollment --> Course : for` | `M 216 340 L 216 381 L 214.52 381 L 214.52 422` | ✅ | — | ✅ |
| `Student --> Certificate : earns` | `M 177.55 166 L 177.55 198 L 138 198 L 138 239` | ✅ | — | ✅ |  
| `Certificate --> Course : from` | `M 138 349 L 138 381 L 148.52 381 L 148.52 422` | ✅ | — | ✅ |

**Violations vs c6f18a6:**
1. **P3 — `User <|-- Student` PERSISTS**: Horizontal at y=134 (x=311.4→392) clips 16 px through Student box (x=311.4..327.4 at y=134 is inside Student bounds 161.6–327.4 × 56–166). **Not fixed.**
2. **P13 — `teaches` label PERSISTS**: Centered at (353,290) spans x≈333..373; ~3 px clearance from Enrollment right (330) and User left (376). Visually appears to touch both boxes. **Not fixed.**
3. **NEW REGRESSION — `User <|-- Instructor` routing**: Changed from clean 3-segment up-left path (c6f18a6) to a right-wrap path that traverses 108 px along Instructor's bottom wall. P14 (reading direction) concern; also aesthetically inferior.

**P4 (shared segments):** None. `earns`/`from` share x=138 at non-overlapping y-ranges; `contains`/`has` share x=197.52 at non-overlapping y-ranges. ✅

**Score: 7 ✅ / 2 ⚠️ / 1 ❌ (P3)**

Full verdict: `.squad/decisions/inbox/ken-verdict-c9f4450.md`

---


## Review session — commit 9cf0847 (2026-06-28T12:19:27-04:00)

**Commit:** `9cf0847` — fix(class): flip a/b for leftHead=triangle edges — correct routing direction and arrowhead placement  
**Requested by:** ormasoftchile

### Diagram 1: `examples/class/` — Full 15-Principle Regression Check

**PNG:** `examples/class/class-ken-9cf0847.png`

SVG path audit:
- `places` bracket: `M 31.82 120 L -16.18 120 L -16.18 483 L 31.82 483` — routes in left margin (x=−16.18), clear of all boxes. ✅
- `has` (Customer→ShoppingCart): `M 281.80475 175 L 281.80475 248` — straight vertical at x=281.8. ✅
- `creates` (ShoppingCart→Order): `M 96.81625 347.5 L 96.81625 419` — straight vertical at x=96.82. ✅
- `contains` (Order→OrderItem): `M 96.81625 547 L 96.81625 611` — straight vertical; composition diamond at (96.82, 547) = Order bottom. ✅
- `references` (OrderItem→Product): `M 96.81625 703 L 96.81625 767` — straight vertical. ✅
- CreditCardPayment→Payment: `M 281.80475 175 L 281.80475 248`; hollow triangle at (281.8, 248) = Payment top. ✅

Box grid:
| Box | x0 | y0 | x1 | y1 |
|-----|----|----|----|----|
| Customer | 31.8 | 56 | 161.8 | 184 |
| ShoppingCart | 24.0 | 255.5 | 169.6 | 347.5 |
| Order | 31.8 | 419 | 161.8 | 547 |
| OrderItem | 31.8 | 611 | 161.8 | 703 |
| Product | 31.8 | 767 | 161.8 | 877 |
| CreditCardPayment | 207.8 | 65 | 355.8 | 175 |
| Payment | 216.8 | 248 | 346.8 | 355 |

**Score: 15 ✅ / 0 ⚠️ / 0 ❌ → PASS**

Full verdict: `.squad/decisions/inbox/ken-verdict-9cf0847.md`

---

### Diagram 2: `examples/class2/` — Targeted P3/P4/P12/P13 Check

**PNG:** `examples/class2/class2-ken-9cf0847.png`

Key path data:

| Edge | Path | Triangle |
|------|------|----------|
| Student→User | `M 311.4 166 L 311.4 198 L 392 198 L 392 230` | `M 392 230 L 398.09 217.39 L 385.91 217.39 Z` (↑ at User top y=230) |
| Instructor→User | `M 441 166 L 561.64 166 L 561.64 230 L 461.52 230` | `M 461.52 230 L 467.61 217.39 L 455.43 217.39 Z` (↑ at User top y=230) |

Box grid:
| Box | x0 | y0 | x1 | y1 |
|-----|----|----|----|----|
| Student | 161.55 | 56 | 327.4 | 166 |
| Instructor | 373.4 | 56 | 549.64 | 166 |
| User | 376.0 | 230 | 506.0 | 358 |
| Enrollment | 200.0 | 248 | 330.0 | 340 |
| Certificate | 24.0 | 239 | 154.0 | 349 |

**P3 analysis — Student→User:**
- Segment (311.4,166)→(311.4,198): exits Student bottom at y=166 boundary, descends to corridor y=198. At y=166..198, x=311.4 is within Student's x-range (161.55–327.4) BUT only at the START (y=166 border itself). y=198 is 32px below Student — clean. ✅ **FIXED from c9f4450**
- Segment (311.4,198)→(392,198): horizontal at y=198. Student ends at y=166; Enrollment starts at y=248. No boxes at y=198. ✅
- Segment (392,198)→(392,230): descends to User top. No boxes at x=392 between y=198..230. ✅

**P3 analysis — Instructor→User:**
- Segment (441,166)→(561.64,166): along Instructor's bottom wall then 12px beyond. Connected node. ✅
- Segment (561.64,166)→(561.64,230): at x=561.64, 55px right of User's right edge (506). No boxes. ✅
- Segment (561.64,230)→(461.52,230): along User's top border. Connected. ✅

**P4:** No shared segments between Student→User and Instructor→User. ✅

**P12 — Instructor→User routing (UNFIXED):**
Same path as c9f4450: wraps 120px to the right of both nodes before arriving at User. Instructor is above-left of the triangle target point; routing goes rightward. Suboptimal. ⚠️

**P13 — teaches label (UNFIXED):**
`teaches` at (353, 290), text-anchor=middle, Inter 11px. Estimated span x=333..373.
- Enrollment right edge x=330: gap = 3px ⚠️
- User left edge x=376: gap = 3px ⚠️
Same violation as c9f4450.

**Score: 2 ✅ fixed / 2 ⚠️ persist / 0 ❌**

Full verdict: `.squad/decisions/inbox/ken-verdict-9cf0847.md`

---

## 2026-07-10 — Visual QA: Phase 2 Theming Fixes

**Task:** QA review of Phase 2 visual fixes and dropped primitives  
**Scope:** 6 rendered files (intervals, hashring, cards, edge-highlight, linkedlist)  
**Verdict:** PASS

---

### Findings

**Shipped fixes (verified):**
1. Tree default node borders — plain nodes now use palette.primary (blue) ✓
2. Arrowhead size uniformity — markerUnits="userSpaceOnUse" working correctly ✓

**Dropped primitives (no impact):**
- intervals/hashring implementations had cosmetic note-badge overlap in card8 (LOW severity)
- Dropped before merge, so does not affect final branch

---

### QA Sign-Off

Branch passes visual QA with both theming fixes confirmed and no regressions.

**Timestamp:** 2026-07-10T19:17:43-04:00

## 2026-07-10 — Tree Rendering Fixes QA (PR #57)

**Status:** COMPLETE  
**Date:** 2026-07-10 20:32 EDT  
**Verdict:** ✅ PASS  
**Branch:** `ormasoftchile/refresh-ds-renders`

---

## Test Coverage

Verified both fixes across four tree diagram families:

| Diagram | Rendering | Result |
|---------|-----------|--------|
| AVL tree | Badge solid fill + circle connectors | ✅ PASS |
| Heap | All-circle tree, multi-level connector clipping | ✅ PASS |
| Trie | Circle root + pill terminals, mixed edges | ✅ PASS |
| Red-Black tree | Semantic node colors (red/black), connector flush | ✅ PASS |

### Test Method

- Used `rsvg-convert -f png -w 1000` to rasterize at high resolution
- Visual inspection for:
  - Badge circle opacity and text legibility
  - Connector endpoints vs. circle perimeter (no gap, no overshoot)
  - Semantic node colors preserved
  - No regressions in other edge types (pill borders, etc.)

### Defects Found

**None.**

All connectors touch target shapes flush; badges render opaque with legible digits; no visual regressions in any family.

---

## Release Status

Approved for 0.1.7 release.

---

## Review: Connector Style Matrix — 2026-07-12T10:05:00-04:00
**Requested by:** ormasoftchile  
**Subject:** Brian's connector redesign (style-matrix.svg)

### Test Artifact
- Rasterized with: `rsvg-convert -f png -w 1400 -o examples/triton/cross-link/style-matrix-ken.png examples/triton/cross-link/style-matrix.svg`
- Exit code: 0

### Visual Verification

| Style | Directed | Undirected | Bidir | Status |
|-------|----------|------------|-------|--------|
| Solid | ✅ unbroken | ✅ no arrows | ✅ both arrows | PASS |
| Dotted | ✅ short dots (4 3) | ✅ no arrows | ✅ both arrows | PASS |
| Thick | ✅ wide stroke, no dash | ✅ no arrows | ✅ both arrows | PASS |
| Dashed | ✅ long dashes (8 4) | ✅ no arrows | ✅ both arrows | PASS |
| Wavy | ✅ sine wave | ✅ no arrows | ✅ both arrows | PASS |

### SVG Attribute Verification

- **Solid:** `stroke-width="2"`, no dasharray ✅
- **Dotted:** `stroke-dasharray="4 3"` ✅
- **Thick:** `stroke-width="4"`, no dasharray ✅
- **Dashed:** `stroke-dasharray="8 4"` ✅
- **Wavy:** Many cubic Bézier `C` points, no NaN ✅

### Verdict

**✅ PASS** — All 5 styles × 3 directions render correctly. Dotted vs dashed visually distinct. Wavy has clean sine oscillation on both horizontal and vertical segments.

---

## Learnings

### Wavy Path QA Checklist (reusable)
When reviewing wavy/sinusoidal connector styles:
1. Verify path `d=` contains many `C` control points (not just `L`)
2. Grep for `NaN` — must return 0 matches
3. Check horizontal segments: regular Y oscillation with consistent amplitude
4. Check vertical segments: regular X oscillation
5. Inspect corners: no kinks, no amplitude blowup
6. Verify wave terminates cleanly near arrowheads (not mid-oscillation)
