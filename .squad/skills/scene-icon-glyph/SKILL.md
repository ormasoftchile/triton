# Skill: Scene Icon Glyph — Embedding Icons in Geometric Primitives

**Author:** Barbara (Semantics & Rendering)
**Created:** 2026-06-11
**Scope:** Timeline Compiler — any layout that needs to embed an icon glyph inside a bar, node, or badge.

---

## What This Skill Covers

How to correctly emit a `PathPrimitive` (from the icon registry) so it renders inside a geometric shape (activity bar, milestone node, badge circle) at the right scale and position — working identically across SVG, PNG, and Skia backends.

---

## The Core Formula

All icon rendering in this codebase uses the same SVG transform trick:

```typescript
const s         = rhu((halfBoxPx) / 12, 4);
const transform = `translate(${cx}, ${cy}) scale(${s}) translate(-12, -12)`;
```

Where:
- `halfBoxPx` = half of the desired icon bounding box size in pixels
- `cx`, `cy`  = centre of the target region (node centre, bar midpoint, etc.)
- `rhu(..., 4)` = round-half-up to 4 decimal places (determinism contract)

The `translate(-12,-12)` shifts the 24×24 icon so its centre (12,12) maps to the origin before scaling. The outer `translate(cx, cy)` then places the scaled, centred icon at the target position.

---

## Icon Color Selection

```typescript
for (const pathDef of iconDef.paths) {
  const iconFill   = pathDef.fill   ? iconColor : 'none';
  const iconStroke = pathDef.stroke !== false ? iconColor : undefined;
  primitives.push({
    kind:          'path',
    d:             pathDef.d,
    fill:          iconFill,
    stroke:        iconStroke,
    strokeWidth:   iconStroke ? 2 : undefined,
    strokeLinecap: iconStroke ? 'round' : undefined,
    transform,
  });
}
```

- `iconColor` should contrast with the background shape (use `contrastColor()` for bars; use `theme.milestone.iconColor ?? theme.canvas.backgroundColor` for dark nodes).
- `strokeWidth: 2` is standard for all stroked icons in this registry.
- `strokeLinecap: 'round'` applies to all stroked icons.

---

## Sizing Rules

| Context | Formula | Typical value (20px bar) |
|---------|---------|--------------------------|
| Activity bar | `iconPx = barHeight − 4` | 16 px |
| Milestone node | `iconPx = ms.size * iconScale` (iconScale ≈ 0.65) | ~10 px |
| Badge circle | `iconPx = BADGE_R * iconScale` | ~7 px |

---

## Degenerate Cases (Always Handle These)

1. **`activity.icon` / `milestone.icon` absent** → skip silently.
2. **`getIcon(name) === undefined`** → skip silently (unknown icon names are not validated in the IR).
3. **Container too small** → skip if `containerWidth < iconPx + 2*LPAD` (prevents icon clipping outside the shape).

---

## Where This Pattern Lives

| Location | Purpose |
|----------|---------|
| `layout/horizontal.ts` lines ~933 | Activity bars (icon + label block) |
| `layout/horizontal.ts` lines ~1153 | Milestone nodes |
| `layout/vertical-spine.ts` lines ~773 | Card badge (top corner circle + icon) |
| `layout/vertical-spine.ts` lines ~860 | Spine node markers |

---

## Extending to New Primitives

The same transform string works for any new `PathPrimitive` in the Scene. No backend changes are needed; the pattern is transparent to SVG, PNG (resvg), and Skia.

If a new shape type (e.g. hexagon) needs an embedded icon:
1. Compute `cx`, `cy` (centre of the shape in scene coordinates).
2. Compute `halfBoxPx` (half of desired icon size, ≤ inner-radius of shape).
3. Use the formula above.
