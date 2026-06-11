# Skill: serpentine-path-geometry

**Category:** Rendering / Layout  
**File:** `packages/core/src/layout/serpentine.ts`  
**Authored:** 2026-06-11 (Barbara, T4 close)

---

## What This Skill Is

Boustrophedon (serpentine) path geometry for SVG/Skia rendering: computing a winding
S-shaped path that runs left→right, makes a rounded U-turn down, runs right→left,
U-turns down, etc. Includes arc-length parameterization, gradient-via-segments, and
start/end icon badges.

---

## Key Geometry

### Canvas Layout

Given canvas width W and turn radius r:

```
PATH_XL = r + 10          // left row endpoint (10px breathing room past turn extent)
PATH_XR = W - r - 10      // right row endpoint
ROW_W   = PATH_XR - PATH_XL
```

The turn extremes extend to `xl - r ≥ 0` (left) and `xr + r ≤ W` (right). With the
`+10` margin, the stroke and nodes clear the canvas edge.

### Row / Turn Lengths

```
L_row  = ROW_W
L_turn = π * r            // each semicircular U-turn
L_total = nRows * L_row + (nRows−1) * L_turn
```

### SVG Path String

```
M xl y0
L xr y0
A r r 0 1 1 xr y1         ← right U-turn (clockwise, sweep=1)
L xl y1
A r r 0 1 0 xl y2         ← left U-turn (counter-clockwise, sweep=0)
L xr y2
...
```

The center of each semicircle is at `(xr, y+r)` (right) or `(xl, y+r)` (left).
Rightmost extent: `xr + r`. Leftmost extent: `xl − r`.

### Arc-Length Parameterization

```typescript
function pathPointAtS(s: number, geo: SerpentineGeo): { x: number; y: number } {
  // Walk segments: row → turn → row → turn → ...
  for (let row = 0; row < nRows; row++) {
    const y_row = pathStartY + row * rowSpacing;
    if (remaining <= L_row) {
      // On this row: linear interpolation
      return row % 2 === 0
        ? { x: xl + remaining, y: y_row }   // L→R
        : { x: xr - remaining, y: y_row };  // R→L
    }
    remaining -= L_row;
    if (row < nRows - 1 && remaining <= L_turn) {
      const alpha = remaining / r;           // 0 → π
      return row % 2 === 0
        ? { x: xr + r*sin(alpha), y: y_row + r*(1-cos(alpha)) }  // right turn
        : { x: xl - r*sin(alpha), y: y_row + r*(1-cos(alpha)) }; // left turn
    }
    remaining -= L_turn;
  }
  // clamp to endpoint
}
```

### Entry Node Placement: Centred Intervals

```typescript
for (let i = 0; i < n; i++) {
  const t = (i + 0.5) / n;   // centred interval — avoids t=0,1 (badge positions)
  const s = t * totalLength;
  const { x, y } = pathPointAtS(s, geo);
}
```

This prevents NODE_OVERLAP between dot nodes and the icon badges at `t=0` and `t=1`.

---

## Gradient via Segments

Draw `GRADIENT_SEGS = 64` short straight-line `PathPrimitive`s. Each covers
`L_total / 64` arc length, with a solid colour `lerpColor(from, to, i/64)`.

```typescript
for (let i = 0; i < GRADIENT_SEGS; i++) {
  const s0 = (i / GRADIENT_SEGS) * totalLength;
  const s1 = ((i + 1) / GRADIENT_SEGS) * totalLength;
  const color = lerpColor(gradientFrom, gradientTo, (i + 0.5) / GRADIENT_SEGS);
  const p0 = pathPointAtS(s0, geo);
  const p1 = pathPointAtS(s1, geo);
  // emit PathPrimitive: M p0.x p0.y L p1.x p1.y, stroke=color
}
```

Works in SVG, PNG/resvg, and Skia. 64 segments gives smooth colour transitions and
acceptable arc approximation (< 3px chord error for r=80 with 14px stroke).

---

## Glow Aura (Skia)

One full-path `PathPrimitive` (with arc commands) drawn BEFORE gradient segments:

```typescript
{
  kind: 'path',
  d: fullPathD,
  fill: 'none',
  stroke: gradientFrom,
  strokeWidth: pathStrokeWidth + 4,
  strokeLinecap: 'round',
  opacity: 0.6,
  effects: [{ kind: 'glow', color: glowColor, radius: glowRadius }],
}
```

SVG backend ignores `effects` (byte-identical). Skia renders the glow halo.

---

## Icon Badges

At path start (`pathPointAtS(0, geo)`) and end (`pathPointAtS(totalLength, geo)`):

```typescript
// CirclePrimitive for badge
// PathPrimitive for icon — single-translate form (works in SVG + Skia):
const s = iconScale * badgeDiameter / 24;
const transform = `translate(${cx - 12*s},${cy - 12*s}) scale(${s})`;
```

---

## Label Placement

- Even rows (L→R): label below node, `y + nodeR + 4 + fontPx * 0.8`, `dominantBaseline:'hanging'`
- Odd rows (R→L): label above node, `y - nodeR - 4`, `dominantBaseline:'alphabetic'`
- Text truncated at 16 chars with `…`

---

## Linter Compatibility

- `pathBBox` returns `null` for paths with curves (arc commands) → no false OUT_OF_BOUNDS
- Node circles (r=10): all at least `r+10=90px` from canvas edges → well within bounds
- Labels: rows ensure vertical separation between even/odd rows (> label height)
- NODE_OVERLAP: minimum arc-length gap between nodes ≈ L_total/(n) >> 2*nodeR

---

## Reference Files

- `packages/core/src/layout/serpentine.ts` — full implementation
- `packages/core/src/themes/serpentine.ts` — reference theme (Tier 3, green gradient)
- `packages/core/src/themes/types.ts` — `serpentine?` token block in ResolvedTheme
- `examples/showcase/serpentine-journey.timeline.yaml` — 9-entry fixture
- `examples/gallery/showcase/serpentine-journey-skia.png` — Skia golden (1200×556)
- `examples/gallery/showcase/serpentine-journey.svg` — SVG golden
