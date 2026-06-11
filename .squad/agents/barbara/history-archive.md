# Barbara History Archive

Older sessions summarized for reference. See history.md for current 2026-06-11 sessions.

## 2026-06-11 Early Sessions (Archived)

- **T1-3 ImagePrimitive & Logo:** Implemented ImagePrimitive scene primitive (data URI embedding, asset-loader.ts). SVG native support; Skia via MakeImageFromEncoded; PNG/resvg pass-through. Header integration with top-left logo positioning. BuildSceneOptions.baseDir for portable asset resolution. Tests added.

- **T1 Close:** Horizontal numbered timeline (01/02/03). Alternating labels pre-existing. Centered title formalized with `titleAlign?: 'left'|'center'` token. Filled vs outlined via `ordinalColorContrast?: boolean` token + theme statusMap. New `our-timeline` theme (Tier 1, light). 545 tests pass.

- **T5 Gitline Cards:** CTA button rendering with `cardCtaLabel`, `cardCtaFill`, `cardCtaTextColor`, `cardCtaBorderColor`, `cardCtaBorderWidth`, `cardCtaRadius` tokens. Inline date icon with `cardDateIcon` token. Dark navy `gitline` theme (Tier 2). Demo page HTML/CSS chrome.

- **Vertical-Spine Gap Compression:** Auto-compress sparse timelines (1967–2024 span: 8732px → 990px). `spineSpacing: 'time'|'even'` option for gap compression (avg spacing >400px/entry triggers compression; cap gaps at 200px).

- **Gitline Demo Page:** Self-contained HTML demo (examples/gallery/gitline-demo.html) wrapping rendered SVG. Browser chrome (header, tabs, pagination) in pure HTML/CSS. SVG chosen for universal browser scaling.

- **T2 Close (Multi-Block Entries):** Five opt-in theme tokens (spineSegmentColor, badgePlacement:'edge', spineNodeArrow, yearLabelUsesEntryColor, spineNodeFillOverride). Multi-block ContentBlock rendering via `blocks?: { heading?: string; text: string }[]` field. Four geometric domain icons (hardhat, wrench, truck, building). New `subject-timeline` theme (Tier 2, dark infographic). 561 tests pass.

- **T2 Badge Fix:** Edge-badge clipped at canvas border; moved from margin-relative to canvas-relative positioning. Icon off-center in Skia; collapsed compound transform to single equivalent form. 561 tests pass; subject-timeline-skia.png regenerated.

- **T3 Gaps Closed:** Activity.color field (mirrors Milestone.color). Gradient background via SceneBackground primitive. Year label sizing + color via `fontSizeYearLabel` token. Dense infographic palette in new `ai-timeline` theme (Tier 2). Gap compression auto-compresses sparse timelines. 567 tests pass.

---

## Architecture & Design Notes

**Layout Families:**
- Horizontal: numbered nodes on horizontal axis
- Vertical-spine: alternating entries left/right of central spine
- Serpentine: boustrophedon winding path (NEW)

**Rendering Determinism Layers:**
1. Scene geometry: always byte-deterministic (pure function IR + theme)
2. Per-backend: deterministic given pinned version
3. Cross-backend: not promised (SVG vs Raster expected to differ)

**Theme Strategy:** Eight built-in base themes + extensible token system (15+ tokens per theme). All new features shipped as opt-in tokens; existing themes byte-identical.

**Constraint Satisfaction:** Every feature solves a target gap with backward compatibility (opt-in tokens, new fields defaulting to undefined, new layout registered independently).

