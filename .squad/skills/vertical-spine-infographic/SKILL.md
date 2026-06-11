# Skill: vertical-spine-infographic

**Category:** Rendering / Layout  
**File:** `packages/core/src/layout/vertical-spine.ts`  
**Authored:** 2026-06-11 (Barbara, T2 close)

---

## What This Skill Is

A set of opt-in theme tokens and rendering behaviors that transform a standard vertical-spine timeline into a high-fidelity dark infographic — segmented colored spine, edge icon badges with dashed leaders, node chevrons, colored year labels, and multi-block entry content.

All behaviors are **off by default** so existing themes and goldens are byte-identical.

---

## Theme Tokens

Add to `ResolvedTheme` (already present as of T2):

```typescript
spineSegmentColor?: boolean;          // default false — per-segment colored spine
badgePlacement?: 'inline' | 'edge';   // default 'inline' — edge badge + dashed leader
spineNodeArrow?: boolean;             // default false — chevron at each node
yearLabelUsesEntryColor?: boolean;    // default false — year label / heading in entry color
spineNodeFillOverride?: string;       // default undefined — override node fill (e.g. '#FFFFFF')
```

---

## How to Use

Create a theme like `subject-timeline` that sets:
```typescript
spineSegmentColor: true,
badgePlacement: 'edge',
spineNodeArrow: true,
yearLabelUsesEntryColor: true,
spineNodeFillOverride: '#FFFFFF',
fontSizeYearLabel: 28,   // required for yearLabelUsesEntryColor to activate
```

Set entries to use `milestone.color` / `activity.color` for distinct segment colors.

Use `blocks: [{heading: 'Subject 1', text: '...'}, ...]` on a milestone/activity for multi-block content.

---

## Layout Rules

- **Segmented spine** (`spineSegmentColor: true`): Draws `n+1` colored `LinePrimitive`s. Segment above/below each node uses `entry.statusFill` (resolved from `milestone.color`/`activity.color` or theme accent cycle).
- **Edge badges** (`badgePlacement: 'edge'`): Badge circle (r=36) pinned at canvas margin edge on entry's text side. Dashed `LinePrimitive` (`strokeDasharray: '6 4'`) from spine-node X to badge edge. Canvas side margins automatically widened by `EDGE_BADGE_R * 2 + EDGE_BADGE_MARGIN`.
- **Chevrons** (`spineNodeArrow: true`): `PathPrimitive` triangle after each node. Right-pointing for right-side entries, left-pointing for left-side entries. Fixed size (8px half-height, 10px depth).
- **Colored year** (`yearLabelUsesEntryColor: true`): Year label and optional `blocks[0].heading` use `entry.statusFill` instead of theme accent.
- **Multi-block** (`blocks` field on entry): Each block = optional bold/colored heading + paragraph. Falls back to `description` if `blocks` is absent. `blockH()` accounts for block heights in even-spacing pre-computation.

---

## Critical Byte-Identity Rules

- `DATE_LINE_H = rhuInt(datePx * 1.4)` must be defined **before** `ENTRY_DATE_LINE_H`.
- `ENTRY_DATE_LINE_H` must equal `DATE_LINE_H` when `yearLabelUsesEntryColor = false`.
- `SPINE_TOP_PAD_EFFECTIVE` is widened only when `yearLabelUsesEntryColor && isEvenSpacing`.
- Do NOT change the multipliers used by existing themes.

---

## Reference Files

- `packages/core/src/themes/subject-timeline.ts` — reference theme
- `packages/core/src/themes/types.ts` — token definitions
- `examples/showcase/subject-timeline.timeline.yaml` — reference fixture
- `examples/gallery/showcase/subject-timeline-skia.png` — reference golden
