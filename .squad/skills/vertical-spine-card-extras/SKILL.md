# Skill: Vertical-Spine Card Extras (CTA Buttons + Inline Icons)

**Created:** 2026-06-11  
**Author:** Barbara  
**Applies to:** `packages/core/src/layout/vertical-spine.ts`, `themes/types.ts`

---

## What This Skill Covers

How to add opt-in visual extras to vertical-spine card entries (`entryStyle: 'card'`) without breaking existing themes. Covers:
1. **CTA pill buttons** at the bottom of cards (T5-1)
2. **Inline icon + text combos** on a single line (T5-2 date icon pattern)

---

## Pattern: Opt-In Theme Token

The golden rule: gate ALL new rendering on theme tokens that default to `undefined`. Existing themes that don't set the token produce byte-identical output.

```typescript
// In themes/types.ts ResolvedTheme:
cardCtaLabel?: string;   // undefined → no button rendered
cardDateIcon?: string;   // undefined → no icon rendered

// In vertical-spine.ts, guard everything:
const ctaLabel = theme.cardCtaLabel;           // undefined if not set
const hasCta = (e: SpineEntry) =>
  entryStyle === 'card' && !!ctaLabel && !!e.url;

const dateIconName = theme.cardDateIcon;        // undefined if not set
if (dateIconName && entryStyle === 'card') { ... }
```

---

## Pattern: Card Height Accounting

When an extra element adds height to a card, update BOTH:
1. `blockH()` (used for card rect sizing and card centering)
2. The `evenStep` pre-calculation loop (runs BEFORE `blockH` is defined)

```typescript
// In blockH():
if (hasCta(e)) h += CTA_VERT_GAP + CTA_BTN_H;

// In evenStep loop (before blockH is defined):
if (entryStyle === 'card' && !!ctaLabel && !!e.url) bh += CTA_VERT_GAP + CTA_BTN_H;
```

---

## Pattern: Inline Icon + Text on One Line

To render an icon immediately before text on the same baseline:

```typescript
const iconR  = rhu(DATE_ICON_SZ / 2);
const iconCY = rhu(textY - datePx * 0.38); // align to cap-height midpoint
// For 'start' anchor (right-side cards):
const iconCX = rhu(textX + iconR);
const s = rhu(iconR / 12, 4);  // scale 24-unit viewBox to iconDiameter
const transform = `translate(${iconCX},${iconCY}) scale(${s}) translate(-12,-12)`;

// Render icon paths
for (const pathDef of iconDef.paths) {
  primitives.push({ kind: 'path', d: pathDef.d, fill: ..., stroke: ..., transform });
}

// Shift text anchor away from icon
const dateShift = rhu(DATE_ICON_SZ + DATE_ICON_GAP);
primitives.push({ kind: 'text', x: rhu(textX + dateShift), y: textY, ... });
```

For 'end' anchor (left-side cards): negate the shifts:
```typescript
iconCX = rhu(textX - iconR);
dateTextX = rhu(textX - dateShift); // text still uses textAnchor:'end'
```

---

## Pattern: CTA Pill Button

```typescript
const btnH   = CTA_BTN_H;  // rhuInt(datePx * 2.0)
const btnRx  = theme.cardCtaRadius ?? Math.floor(btnH / 2);  // default = true pill
const btnW   = Math.max(ceil(label.length * fontSize * 0.58) + 20, 80);
const btnLeft = side === 'right'
  ? rhu(blockLeft + BLOCK_INNER_PAD)
  : rhu(blockLeft + BLOCK_W - BLOCK_INNER_PAD - btnW);

// Pill rect
primitives.push({ kind:'rect', rx:btnRx, fill:ctaFill, stroke:ctaBorderColor, ... });
// Centred label
primitives.push({ kind:'text', x: rhu(btnLeft + btnW/2), textAnchor:'middle', ... });
```

---

## Pitfall: Header Title Width vs. First Card Entry

A centered header title at 22–29pt can produce a bbox that horizontally overlaps the first right-side card entry's date text (which starts at `SPINE_X + CONNECTOR_LEN + BLOCK_INNER_PAD`). The linter detects this as LABEL_OVERLAP.

**Rule:** For fixtures that use `spineSpacing: 'even'` with cards placed immediately below the header, keep the fixture title short enough that:

```
title_width / 2 < (SPINE_X + CONNECTOR_LEN + BLOCK_INNER_PAD) - canvas_mid + OVERLAP_EPSILON
```

With default geometry (SPINE_X=600, CONNECTOR_LEN=58, BLOCK_INNER_PAD=10, OVERLAP_EPSILON=4):
- Max half-width ≈ 80 px → max title width ≈ 160 px
- At 22pt (29px): approximately 5–8 characters
- Practical fix: use a short title (e.g. `"Releases"`) or don't have a title.
