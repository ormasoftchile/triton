# Ken — Visual QA Reviewer

## Spawn ken-5 (2026-07-12)

**Task:** Independent visual QA of sql-engine cross-link label fix (brian-7)  
**Approach:** PNG render inspection + SVG path audit + regression check  
**Result:** PASS — Red label now 18px below PageHeader, fully legible. All connector paths valid. No regressions.  
**Decision:** `.squad/orchestration-log/2026-07-12T11-32-29Z-ken-5.md`

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

---

## Review — sql-engine.svg Connector-Label Overlap Fix
**Date:** 2026-07-12T11:30:00-04:00
**Requested by:** ormasoftchile
**Subject:** Brian's chromeRects fix for "leaf points to page" label overlap

### Visual Verification

Rendered fresh via `node scripts/preview.mjs examples/triton/poster/` then rasterized to PNG.

**sql-engine.svg inspection:**

| Element | Position | Status |
|---------|----------|--------|
| Red label "leaf points to page" | x=216.65, y=415.76 | ✅ CLEAR of PageHeader |
| PageHeader bar (blue) | y≈380.86 to y≈397.76 (absolute) | — |
| slot0/slot1/slot2 boxes | y≈405.56 to y≈419.86 (absolute) | — |
| Green "scan uses index" | x=377.69, y=108.49 | ✅ intact, routes from query to B+tree |
| Purple "tuple is a row" | x=409.90, y=454.76 | ✅ intact, routes from slot to Row |

**Position Analysis:**
- Red label y=415.76 is 18px BELOW PageHeader bottom (397.76)
- Label is vertically aligned with slot boxes — text is legible and clearly reads "leaf points to page"
- Red connector path: `M 471.35 132.05 L 327.3 132.05 L 327.3 406.99 L 106 406.99` — no NaN, clean L-shaped route from B+tree leaf to slot0

**Other connectors verified:**
- Green path: `M 284.03 252.28 L 284.03 110.49 L 471.35 110.49` — clean
- Purple path: `M 290.6 451.32 L 529.2 451.32` — clean horizontal

### Regression Check

| Poster | Render | Status |
|--------|--------|--------|
| poster.svg | ✅ renders | System Dashboard with 4 cells intact |
| ds-poster.svg | ✅ renders | Data Structures with 8 cells intact |
| sql-engine.svg | ✅ renders | Fix applied |
| row-spanning.svg | ✅ renders | No issues |
| spanning.svg | ✅ renders | No issues |

No `engineering-dashboard` references found — cleanup complete.

### SVG Audit

- No NaN values in any path `d=` attributes ✅
- No degenerate/undefined coordinates ✅
- All three cross-links have valid arrowhead markers ✅

### Verdict

**✅ PASS** — The red "leaf points to page" label is now clearly positioned 18px below the PageHeader bar, at y=415.76 (aligned with the slot boxes). Text is fully legible and no longer buried under the blue chrome. All three cross-link connectors render correctly with intact routing. No regressions in other poster files.

---

## Learnings

### chromeRects Label Repulsion
When cells contain prominent chrome elements (colored header bars, badges), the `chromeRects` mechanism in LayoutResult enables `deCollideLabels` to push connector labels away from these obstructions. Key verification points:
1. Calculate absolute coordinates accounting for cell transforms (`translate` + `scale`)
2. Verify label y-coordinate is outside chrome band (not just "looks okay" — do the math)
3. Confirm no NaN/degenerate values in path data
4. Check all other connectors remain intact after the fix

---

## Coordination Note — 2026-07-13T20:03:00Z

**Brian's Completed Work (2026-07-13):** Reclassified `architecture` diagram type from triton → mermaid family.
- **Why:** `architecture-beta` is a real Mermaid diagram type. Detection already returned `{ format: 'mermaid', diagramType: 'architecture' }`. Source/examples/docs folder placement now matches this truth.
- **Moves:** `src/diagrams/triton/architecture/` → `src/diagrams/mermaid/architecture/`, examples/docs fragments relocated, `src/frontend/index.ts` import updated.
- **Verification:** pnpm build ✅, typecheck ✅, 799 tests ✅, detect() behavior unchanged.
- **Syntax Gaps:** 11 documented (nested groups, junctions, edge labels, align, iconText, title/accTitle unsupported in Triton's subset).
- **Decision:** `.squad/decisions.md` (merged from inbox 2026-07-13)

This reclassification affects visual QA scope: `examples/mermaid/architecture/` is now the canonical example location for diagram-options verification.

