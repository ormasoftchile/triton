# SKILL: Skia ImageFilter Blur — TileMode Selection

**Domain:** CanvasKit / Skia raster rendering  
**Created:** 2026-06-11T06:46:49-04:00  
**Author:** Barbara (Semantics & Rendering)

---

## Rule

**Always use `TileMode.Decal` for `ImageFilter.MakeBlur` calls that implement glow or shadow effects on Scene primitives.**

```ts
// CORRECT — smooth Gaussian falloff, no boundary artifact
const blurFilter = CK.ImageFilter.MakeBlur(sigma, sigma, CK.TileMode.Decal, null);

// WRONG — hard full-opacity band at layer boundary for filled shapes
const blurFilter = CK.ImageFilter.MakeBlur(sigma, sigma, CK.TileMode.Clamp, null);
```

---

## Why TileMode.Clamp is wrong for shadows/glows

`TileMode.Clamp` replicates the edge pixel of the blur layer at every out-of-bounds
coordinate. For a **filled rectangle**, the layer edge pixel carries the rectangle's
fill color at (nearly) full opacity. Consequently, all pixels within the blur expansion
margin (~3×sigma from the rect edge) that fall *outside* the layer bounds receive the
full fill color — creating a hard, full-opacity band instead of a smooth falloff.

For **circles**, the bounding-box corners are transparent. Clamping transparent pixels
is still transparent, so the artifact does not appear. This asymmetry between circles
and rectangles is the diagnostic tell: if glows work on circles but rectangles get
a rectangular halo, the cause is `TileMode.Clamp`.

`TileMode.Decal` treats all out-of-bounds pixels as `(0,0,0,0)`. This gives the
natural Gaussian falloff that glow and shadow effects require.

---

## Quantitative confirmation

Shadow config: `color=#00000088` (black at 53%), `blur=10` (sigma=5).  
Expansion margin: 3×sigma = 15px.  
Card rect left edge: x=660. Layer left boundary: 660−15=645.  

With `Clamp`:  
- x=645: full shadow pixel (0,0,0,0.53) blended over connector (3,174,212)  
  ≈ `alpha_composite = (0.53*0 + 0.47*3, 0.53*0 + 0.47*174, 0.53*0 + 0.47*212)`  
  ≈ `(1.4, 81.8, 99.6)` ≈ `(2, 83, 101)` ← confirmed by pixel read  
- x=644: (4,178,217) — connector visible, no shadow (outside layer)  
- Step ΔG = 178−83 = 95 → clearly visible dark band

With `Decal`:  
- x=645: (4,178,217) — connector, no shadow contribution (transparent layer)  
- Smooth fade begins at x=649 as the actual Gaussian tail arrives

---

## Availability

`CK.TileMode.Decal` is present in canvaskit-wasm **0.41.x** (verified in this project).

---

## Diagnostic checklist

When a Skia-rendered PNG shows a rectangular halo or hard-edge shadow band around
a filled shape:

1. Search `skia.ts` for `MakeBlur` — check all three tile mode arguments.
2. Replace any `TileMode.Clamp` → `TileMode.Decal`.
3. Re-render and compare pixel values at `rectEdge − 3×sigma` to confirm the step is gone.
4. Delete and regenerate all affected golden PNGs.
5. Run the full test suite — byte-identical determinism must hold.
