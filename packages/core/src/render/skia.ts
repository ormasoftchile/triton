/**
 * @file render/skia.ts — Skia raster backend via canvaskit-wasm.
 *
 * Exports `sceneToPngSkia(scene)` which produces a PNG Uint8Array from a Scene
 * using the Skia graphics library (CanvasKit WASM build).
 *
 * Capabilities over the SVG/resvg backend:
 *  - SceneEffect: glow (blurred colour copy underneath), shadow (offset blur)
 *  - SceneBackground: gradient (linear) and cloud (SkSL RuntimeEffect noise)
 *  - All Scene primitives faithfully rendered at the same coordinates
 *
 * DETERMINISM CONTRACT
 * --------------------
 *  - No Date.now(), Math.random(), or system-dependent state.
 *  - Cloud shader uses fixed-seed deterministic hash-based value noise.
 *  - Two renders of the same Scene in the same process produce byte-identical PNG.
 *  - Cross-backend pixel identity (Skia vs resvg) is NOT promised.
 *  - Determinism is per pinned canvaskit-wasm version (0.41.x).
 *
 * FONT HANDLING
 * -------------
 *  The same DejaVu Sans TTF used by the SVG/resvg path is loaded once and
 *  cached.  Text coordinates from the Scene (x/y + textAnchor + dominantBaseline)
 *  are mapped to Skia drawText coordinates with measured glyph widths.
 */

import { createRequire } from 'node:module';
import { readFileSync }   from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath }  from 'node:url';
import type {
  Scene,
  SceneEffect,
  ScenePrimitive,
  RectPrimitive,
  CirclePrimitive,
  LinePrimitive,
  PathPrimitive,
  TextPrimitive,
  MultiTextPrimitive,
  GroupPrimitive,
  ImagePrimitive,
} from '../scene.js';

// ---------------------------------------------------------------------------
// CanvasKit initialization (memoised — one initialisation per process)
// ---------------------------------------------------------------------------

// Use createRequire to load the CJS canvaskit-wasm package from ESM.
const _require = createRequire(import.meta.url);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ck: any = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _ckPromise: Promise<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getCanvasKit(): Promise<any> {
  if (_ck) return _ck;
  if (!_ckPromise) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const CanvasKitInit = _require('canvaskit-wasm') as (opts?: any) => Promise<any>;
    const wasmPath = _require.resolve('canvaskit-wasm/bin/canvaskit.wasm');
    _ckPromise = CanvasKitInit({
      locateFile: (file: string) => file.endsWith('.wasm') ? wasmPath : file,
    }).then((ck: unknown) => { _ck = ck; return ck; });
  }
  return _ckPromise;
}

// ---------------------------------------------------------------------------
// Font loading (memoised)
// ---------------------------------------------------------------------------

function findFontPath(): string {
  const thisFile = fileURLToPath(import.meta.url);
  const thisDir  = dirname(thisFile);
  // From src/render/ or dist/render/ — look for fonts/ sibling
  for (const rel of ['../fonts/DejaVuSans.ttf', '../../src/fonts/DejaVuSans.ttf']) {
    const p = resolve(join(thisDir, rel));
    try { readFileSync(p); return p; } catch { /* try next */ }
  }
  return resolve(join(thisDir, '../fonts/DejaVuSans.ttf'));
}

let _fontPath: string | undefined;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _typeface: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTypeface(CK: any): any {
  if (_typeface) return _typeface;
  if (!_fontPath) _fontPath = findFontPath();
  const fontData = readFileSync(_fontPath);
  _typeface = CK.Typeface.MakeFreeTypeFaceFromData(fontData.buffer);
  return _typeface;
}

// ---------------------------------------------------------------------------
// Colour parsing
// ---------------------------------------------------------------------------

/**
 * Parse a CSS hex colour string (#rrggbb or #rrggbbaa) to a Float32Array [r,g,b,a]
 * using CanvasKit's parseColorString.  Opacity is scaled into the alpha channel.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseColor(CK: any, hex: string, opacity = 1): Float32Array {
  // Use CanvasKit's built-in colour parser (handles #RGB, #RRGGBB, named colours)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: Float32Array = CK.parseColorString(hex) as any;
  if (opacity !== 1) {
    const copy = new Float32Array(c);
    copy[3] = (copy[3] ?? 1) * opacity;
    return copy;
  }
  return c;
}

// ---------------------------------------------------------------------------
// Text measurement helpers
// ---------------------------------------------------------------------------

/**
 * Measure the total advance width of a string using the given font.
 * Returns 0 if the font or string is invalid.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function measureTextWidth(font: any, str: string): number {
  if (!str || !font) return 0;
  try {
    const ids    = font.getGlyphIDs(str) as Uint16Array;
    const widths = font.getGlyphWidths(ids) as Float32Array;
    let total = 0;
    for (const w of widths) total += w;
    return total;
  } catch {
    return str.length * (font.getSize() * 0.55); // rough fallback
  }
}

/**
 * Compute draw-x from Scene textAnchor and measured text width.
 * In Skia drawText: x is the LEFT edge, baseline at y.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textDrawX(sceneX: number, anchor: string | undefined, font: any, str: string): number {
  if (anchor === 'middle') return sceneX - measureTextWidth(font, str) / 2;
  if (anchor === 'end')    return sceneX - measureTextWidth(font, str);
  return sceneX; // 'start' default
}

/**
 * Compute draw-y from Scene dominantBaseline.
 * In Skia drawText: y is the ALPHABETIC baseline.
 * In SVG:
 *   alphabetic/auto → y is baseline → no adjustment.
 *   middle/central  → y is visual centre of cap-height.
 *   hanging         → y is top of text.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function textDrawY(sceneY: number, baseline: string | undefined, font: any): number {
  const metrics = font.getMetrics() as { ascent: number; descent: number };
  const ascent   = metrics.ascent;   // negative (up from baseline)
  const descent  = metrics.descent;  // positive (down from baseline)

  switch (baseline) {
    case 'middle':
    case 'central':
      // SVG middle: y is visual centre. Skia baseline is at y.
      // Adjustment to move Skia baseline so centre of [ascent..descent] sits at sceneY.
      return sceneY + (-ascent - descent) / 2;

    case 'hanging':
      // SVG hanging: y is top of text. Skia baseline is at y + abs(ascent).
      return sceneY - ascent; // ascent is negative → sceneY + abs(ascent)

    case 'alphabetic':
    case 'auto':
    default:
      return sceneY;
  }
}

// ---------------------------------------------------------------------------
// Effect rendering helpers
// ---------------------------------------------------------------------------

/**
 * Run a drawing function once per glow/shadow effect (under) and once for the
 * main shape (over).  Effects are rendered in order before the main shape.
 *
 * @param CK       CanvasKit instance
 * @param canvas   Target canvas
 * @param effects  Effect list (may be undefined — skipped if so)
 * @param drawFn   Function that draws the shape given a Paint (shared state)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderWithEffects(CK: any, canvas: any, effects: SceneEffect[] | undefined, drawFn: (dx: number, dy: number, extraPaint?: any) => void): void {
  if (!effects || effects.length === 0) {
    drawFn(0, 0);
    return;
  }

  for (const fx of effects) {
    if (fx.kind === 'glow') {
      const glowPaint = new CK.Paint();
      glowPaint.setColor(parseColor(CK, fx.color, 0.75));
      glowPaint.setStyle(CK.PaintStyle.Fill);
      // Decal: pixels outside the blur layer are transparent, preventing the
      // hard-edge clamping artifact that TileMode.Clamp produces on rect shapes.
      const blurFilter = CK.ImageFilter.MakeBlur(fx.radius / 2, fx.radius / 2, CK.TileMode.Decal, null);
      glowPaint.setImageFilter(blurFilter);
      drawFn(0, 0, glowPaint);
      blurFilter.delete();
      glowPaint.delete();
    } else if (fx.kind === 'shadow') {
      const shadowPaint = new CK.Paint();
      shadowPaint.setColor(parseColor(CK, fx.color));
      shadowPaint.setStyle(CK.PaintStyle.Fill);
      // Decal: prevents the shadow from bleeding full-opacity past the blur
      // expansion boundary (the TileMode.Clamp artifact on filled rectangles).
      const blurFilter = CK.ImageFilter.MakeBlur(fx.blur / 2, fx.blur / 2, CK.TileMode.Decal, null);
      shadowPaint.setImageFilter(blurFilter);
      drawFn(fx.dx, fx.dy, shadowPaint);
      blurFilter.delete();
      shadowPaint.delete();
    }
  }

  // Main shape (no extra paint = default rendering)
  drawFn(0, 0);
}

// ---------------------------------------------------------------------------
// Background rendering
// ---------------------------------------------------------------------------

/** SkSL cloud noise shader — deterministic value noise, two octaves. */
const CLOUD_SKSL = `
uniform float2 iResolution;
uniform float4 uBase;
uniform float4 uAccent;
uniform float  uIntensity;

float hash(float2 p) {
  p = fract(p * float2(127.1, 311.7));
  p += dot(p, p + 19.19);
  return fract(p.x * p.y);
}

float noise(float2 p) {
  float2 i = floor(p);
  float2 f = fract(p);
  float2 u = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + float2(1.0, 0.0));
  float c = hash(i + float2(0.0, 1.0));
  float d = hash(i + float2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

half4 main(float2 fragCoord) {
  float2 uv = fragCoord / iResolution;
  float n = noise(uv * 3.0) * 0.55
          + noise(uv * 7.0 + float2(4.2, 1.8)) * 0.28
          + noise(uv * 14.0 + float2(2.1, 6.3)) * 0.17;
  n = clamp(n * uIntensity, 0.0, 1.0);
  float4 col = mix(uBase, uAccent, n);
  return half4(col.r, col.g, col.b, 1.0);
}
`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderBackground(CK: any, canvas: any, scene: Scene): void {
  const bg = scene.sceneBackground;
  const W  = scene.width;
  const H  = scene.height;

  if (!bg) {
    // Plain solid fill from scene.background
    canvas.clear(parseColor(CK, scene.background));
    return;
  }

  switch (bg.kind) {
    case 'solid': {
      canvas.clear(parseColor(CK, bg.color));
      break;
    }

    case 'gradient': {
      const angleRad = (bg.angle * Math.PI) / 180;
      const cx = W / 2, cy = H / 2;
      const dx = Math.cos(angleRad) * Math.max(W, H) / 2;
      const dy = Math.sin(angleRad) * Math.max(W, H) / 2;
      const shader = CK.Shader.MakeLinearGradient(
        [cx - dx, cy - dy],
        [cx + dx, cy + dy],
        [parseColor(CK, bg.from), parseColor(CK, bg.to)],
        null,
        CK.TileMode.Clamp,
      );
      const paint = new CK.Paint();
      paint.setShader(shader);
      canvas.drawRect(CK.LTRBRect(0, 0, W, H), paint);
      paint.delete();
      shader.delete();
      break;
    }

    case 'cloud': {
      // Try RuntimeEffect SkSL cloud shader; fall back to gradient on failure.
      let shader = null;
      try {
        const effect = CK.RuntimeEffect.Make(CLOUD_SKSL);
        if (effect) {
          const baseC   = parseColor(CK, bg.baseColor);
          const accentC = parseColor(CK, bg.accentColor);
          const uniforms = new Float32Array([
            W, H,                                              // iResolution
            baseC[0]!, baseC[1]!, baseC[2]!, 1.0,            // uBase
            accentC[0]!, accentC[1]!, accentC[2]!, 1.0,      // uAccent
            bg.intensity,                                      // uIntensity
          ]);
          shader = effect.makeShader(uniforms);
          effect.delete();
        }
      } catch {
        // SkSL failed — fall through to gradient fallback
      }

      if (shader) {
        const paint = new CK.Paint();
        paint.setShader(shader);
        canvas.drawRect(CK.LTRBRect(0, 0, W, H), paint);
        paint.delete();
        shader.delete();
      } else {
        // Fallback: linear gradient between baseColor and accentColor
        const shader2 = CK.Shader.MakeLinearGradient(
          [0, 0], [0, H],
          [parseColor(CK, bg.baseColor), parseColor(CK, bg.accentColor)],
          null, CK.TileMode.Clamp,
        );
        const paint = new CK.Paint();
        paint.setShader(shader2);
        canvas.drawRect(CK.LTRBRect(0, 0, W, H), paint);
        paint.delete();
        shader2.delete();
      }
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Primitive rendering
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderRect(CK: any, canvas: any, p: RectPrimitive): void {
  const opacity = p.opacity ?? 1;
  const rect = CK.XYWHRect(p.x, p.y, p.width, p.height);
  const rrect = p.rx ? CK.RRectXY(rect, p.rx, p.rx) : null;

  renderWithEffects(CK, canvas, p.effects, (dx, dy, overridePaint) => {
    const paint = overridePaint ?? new CK.Paint();
    try {
      if (!overridePaint) {
        paint.setColor(parseColor(CK, p.fill, opacity));
        paint.setStyle(CK.PaintStyle.Fill);
      }
      const drawRect = dx !== 0 || dy !== 0
        ? (rrect ? CK.RRectXY(CK.XYWHRect(p.x + dx, p.y + dy, p.width, p.height), p.rx!, p.rx!) : CK.XYWHRect(p.x + dx, p.y + dy, p.width, p.height))
        : (rrect ?? rect);

      if (rrect && dx === 0 && dy === 0) {
        canvas.drawRRect(rrect, paint);
      } else if (rrect) {
        canvas.drawRRect(CK.RRectXY(CK.XYWHRect(p.x + dx, p.y + dy, p.width, p.height), p.rx!, p.rx!), paint);
      } else {
        canvas.drawRect(drawRect, paint);
      }
    } finally {
      if (!overridePaint) paint.delete();
    }
  });

  // Stroke pass
  if (p.stroke && (p.strokeWidth ?? 0) > 0) {
    const sp = new CK.Paint();
    sp.setColor(parseColor(CK, p.stroke, opacity));
    sp.setStyle(CK.PaintStyle.Stroke);
    sp.setStrokeWidth(p.strokeWidth!);
    if (rrect) canvas.drawRRect(rrect, sp);
    else       canvas.drawRect(rect, sp);
    sp.delete();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderCircle(CK: any, canvas: any, p: CirclePrimitive): void {
  const opacity = p.opacity ?? 1;

  renderWithEffects(CK, canvas, p.effects, (dx, dy, overridePaint) => {
    const paint = overridePaint ?? new CK.Paint();
    try {
      if (!overridePaint) {
        paint.setColor(parseColor(CK, p.fill, opacity));
        paint.setStyle(CK.PaintStyle.Fill);
      }
      canvas.drawCircle(p.cx + dx, p.cy + dy, p.r, paint);
    } finally {
      if (!overridePaint) paint.delete();
    }
  });

  if (p.stroke && (p.strokeWidth ?? 0) > 0) {
    const sp = new CK.Paint();
    sp.setColor(parseColor(CK, p.stroke, opacity));
    sp.setStyle(CK.PaintStyle.Stroke);
    sp.setStrokeWidth(p.strokeWidth!);
    canvas.drawCircle(p.cx, p.cy, p.r, sp);
    sp.delete();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderLine(CK: any, canvas: any, p: LinePrimitive): void {
  const opacity = p.opacity ?? 1;
  const paint = new CK.Paint();
  paint.setColor(parseColor(CK, p.stroke, opacity));
  paint.setStyle(CK.PaintStyle.Stroke);
  paint.setStrokeWidth(p.strokeWidth ?? 1);
  paint.setStrokeCap(CK.StrokeCap.Round);

  if (p.dashArray) {
    // Parse SVG dash array like "4,4" or "6,4"
    const parts = p.dashArray.split(',').map(Number).filter((n) => !isNaN(n));
    if (parts.length >= 2) {
      const dashEffect = CK.PathEffect.MakeDash(parts);
      if (dashEffect) {
        paint.setPathEffect(dashEffect);
        dashEffect.delete();
      }
    }
  }

  canvas.drawLine(p.x1, p.y1, p.x2, p.y2, paint);
  paint.delete();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPath(CK: any, canvas: any, p: PathPrimitive): void {
  const opacity = p.opacity ?? 1;
  // When fill='none' the path is stroke-only: do NOT fill it at all.
  // SVG natively handles fill="none" as no fill; Skia must be told explicitly.
  const strokeOnly = p.fill === 'none';

  const skPath = CK.Path.MakeFromSVGString(p.d);
  if (!skPath) return; // malformed path data — skip

  // Parse transform (translate/scale) as individual ops — more reliable than matrix concat
  const parsedTransform = p.transform ? parseSvgTransformOps(p.transform) : null;

  const applyTransform = () => {
    if (parsedTransform) {
      if (parsedTransform.tx !== 0 || parsedTransform.ty !== 0)
        canvas.translate(parsedTransform.tx, parsedTransform.ty);
      if (parsedTransform.s !== 1)
        canvas.scale(parsedTransform.s, parsedTransform.s);
    }
  };

  if (strokeOnly) {
    // Stroke-only path (fill='none'): never fill. Glow/shadow effects are
    // applied as stroked blurs so the effect follows the line, not a filled area.
    // strokeGradient takes precedence over a solid stroke colour.
    if ((p.stroke || p.strokeGradient) && (p.strokeWidth ?? 0) > 0) {
      if (p.effects && p.effects.length > 0) {
        for (const fx of p.effects) {
          if (fx.kind === 'glow') {
            const glowPaint = new CK.Paint();
            glowPaint.setColor(parseColor(CK, fx.color, 0.75));
            glowPaint.setStyle(CK.PaintStyle.Stroke);
            glowPaint.setStrokeWidth(p.strokeWidth!);
            if (p.strokeLinecap === 'round') glowPaint.setStrokeCap(CK.StrokeCap.Round);
            const blurFilter = CK.ImageFilter.MakeBlur(
              fx.radius / 2, fx.radius / 2, CK.TileMode.Decal, null,
            );
            glowPaint.setImageFilter(blurFilter);
            canvas.save();
            applyTransform();
            canvas.drawPath(skPath, glowPaint);
            canvas.restore();
            blurFilter.delete();
            glowPaint.delete();
          }
          // shadow on stroke-only paths: currently unused — skip silently
        }
      }

      // Main stroke pass — solid colour or linear gradient shader
      const sp = new CK.Paint();
      sp.setStyle(CK.PaintStyle.Stroke);
      sp.setStrokeWidth(p.strokeWidth!);
      if (p.strokeLinecap === 'round') sp.setStrokeCap(CK.StrokeCap.Round);

      if (p.strokeGradient) {
        // Build a linear gradient shader using the path's endpoint coordinates.
        const sg = p.strokeGradient;
        const shader = CK.Shader.MakeLinearGradient(
          [sg.x1, sg.y1],
          [sg.x2, sg.y2],
          [parseColor(CK, sg.from, opacity), parseColor(CK, sg.to, opacity)],
          null,
          CK.TileMode.Clamp,
        );
        sp.setShader(shader);
        shader.delete();
      } else {
        sp.setColor(parseColor(CK, p.stroke!, opacity));
      }

      canvas.save();
      applyTransform();
      canvas.drawPath(skPath, sp);
      canvas.restore();
      sp.delete();
    }
  } else {
    // Filled path: use fill gradient shader if present, otherwise flat colour.
    renderWithEffects(CK, canvas, p.effects, (dx, dy, overridePaint) => {
      const paint = overridePaint ?? new CK.Paint();
      try {
        if (!overridePaint) {
          paint.setStyle(CK.PaintStyle.Fill);
          if (p.fillRule === 'evenodd') paint.setFillType(CK.FillType.EvenOdd);
          if (p.fillGradient) {
            const fg = p.fillGradient;
            const shader = CK.Shader.MakeLinearGradient(
              [fg.x1, fg.y1],
              [fg.x2, fg.y2],
              [parseColor(CK, fg.from, opacity), parseColor(CK, fg.to, opacity)],
              null,
              CK.TileMode.Clamp,
            );
            paint.setShader(shader);
            shader.delete();
          } else {
            paint.setColor(parseColor(CK, p.fill, opacity));
          }
        }
        canvas.save();
        applyTransform();
        if (dx !== 0 || dy !== 0) canvas.translate(dx, dy);
        canvas.drawPath(skPath, paint);
        canvas.restore();
      } finally {
        if (!overridePaint) paint.delete();
      }
    });

    if (p.stroke && (p.strokeWidth ?? 0) > 0) {
      const sp = new CK.Paint();
      sp.setColor(parseColor(CK, p.stroke, opacity));
      sp.setStyle(CK.PaintStyle.Stroke);
      sp.setStrokeWidth(p.strokeWidth!);
      if (p.strokeLinecap === 'round') sp.setStrokeCap(CK.StrokeCap.Round);
      canvas.save();
      applyTransform();
      canvas.drawPath(skPath, sp);
      canvas.restore();
      sp.delete();
    }
  }

  skPath.delete();
}

function parseSvgTransformOps(transform: string): { tx: number; ty: number; s: number } | null {
  // Handle translate(tx[,ty]) and scale(sx) (uniform scale only)
  const translateMatch = transform.match(/translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/);
  const scaleMatch     = transform.match(/scale\(\s*([-\d.]+)\s*\)/);

  const tx = translateMatch ? parseFloat(translateMatch[1]!) : 0;
  const ty = translateMatch ? parseFloat(translateMatch[2]!) : 0;
  const s  = scaleMatch     ? parseFloat(scaleMatch[1]!)     : 1;

  if (tx === 0 && ty === 0 && s === 1) return null;
  return { tx, ty, s };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderText(CK: any, canvas: any, p: TextPrimitive, typeface: any): void {
  if (!p.text) return;
  const opacity = p.opacity ?? 1;
  const font = new CK.Font(typeface, p.fontSize);

  const drawX = textDrawX(p.x, p.textAnchor, font, p.text);
  const drawY = textDrawY(p.y, p.dominantBaseline, font);

  const paint = new CK.Paint();
  paint.setColor(parseColor(CK, p.fill, opacity));
  paint.setStyle(CK.PaintStyle.Fill);
  paint.setAntiAlias(true);

  canvas.drawText(p.text, drawX, drawY, paint, font);

  paint.delete();
  font.delete();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderMultiText(CK: any, canvas: any, p: MultiTextPrimitive, typeface: any): void {
  if (!p.lines || p.lines.length === 0) return;
  const opacity = p.opacity ?? 1;
  const font = new CK.Font(typeface, p.fontSize);
  const paint = new CK.Paint();
  paint.setColor(parseColor(CK, p.fill, opacity));
  paint.setStyle(CK.PaintStyle.Fill);
  paint.setAntiAlias(true);

  for (let i = 0; i < p.lines.length; i++) {
    const line = p.lines[i] ?? '';
    const lineY = i === 0 ? p.y : p.y + i * p.lineHeight;
    const drawX = textDrawX(p.x, p.textAnchor, font, line);
    const drawY = textDrawY(lineY, p.dominantBaseline, font);
    canvas.drawText(line, drawX, drawY, paint, font);
  }

  paint.delete();
  font.delete();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderGroup(CK: any, canvas: any, p: GroupPrimitive, typeface: any): void {
  const opacity = p.opacity ?? 1;
  if (opacity < 1) {
    const paint = new CK.Paint();
    paint.setAlphaf(opacity);
    canvas.saveLayer(paint);
    for (const child of p.primitives) renderPrimitive(CK, canvas, child, typeface);
    canvas.restore();
    paint.delete();
  } else {
    for (const child of p.primitives) renderPrimitive(CK, canvas, child, typeface);
  }
}

/**
 * Render an ImagePrimitive via CanvasKit.
 *
 * The `data` field must be a `data:<mime>;base64,<bytes>` URI.  The MIME type
 * determines decode support: PNG, JPEG, GIF, and WebP are supported by
 * `MakeImageFromEncoded`.  SVG data URIs are skipped (Skia cannot decode SVG).
 *
 * On any decode failure the image is silently skipped (graceful fallback).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderImage(CK: any, canvas: any, p: ImagePrimitive): void {
  // Parse the data URI: data:<mime>;base64,<b64>
  const match = p.data.match(/^data:([^;]+);base64,(.+)$/s);
  if (!match) return;

  const [, mimeType, b64] = match;

  // SVG images cannot be decoded by MakeImageFromEncoded — skip gracefully.
  if (mimeType?.includes('svg')) return;

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(Buffer.from(b64 ?? '', 'base64'));
  } catch {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const skImage: any = CK.MakeImageFromEncoded(bytes);
  if (!skImage) return; // Decode failure — skip gracefully

  try {
    const opacity = p.opacity ?? 1;
    const paint   = new CK.Paint();
    if (opacity < 1) paint.setAlphaf(opacity);
    paint.setAntiAlias(true);

    const srcRect = CK.XYWHRect(0, 0, skImage.width(), skImage.height());
    const dstRect = CK.XYWHRect(p.x, p.y, p.width, p.height);

    if (p.borderRadius) {
      const rrect = CK.RRectXY(dstRect, p.borderRadius, p.borderRadius);
      canvas.save();
      canvas.clipRRect(rrect, CK.ClipOp.Intersect, /* doAntiAlias */ true);
      canvas.drawImageRect(skImage, srcRect, dstRect, paint);
      canvas.restore();
    } else {
      canvas.drawImageRect(skImage, srcRect, dstRect, paint);
    }

    paint.delete();
  } finally {
    skImage.delete();
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPrimitive(CK: any, canvas: any, p: ScenePrimitive, typeface: any): void {
  switch (p.kind) {
    case 'rect':      renderRect(CK, canvas, p);                   break;
    case 'circle':    renderCircle(CK, canvas, p);                 break;
    case 'line':      renderLine(CK, canvas, p);                   break;
    case 'path':      renderPath(CK, canvas, p);                   break;
    case 'text':      renderText(CK, canvas, p, typeface);         break;
    case 'multitext': renderMultiText(CK, canvas, p, typeface);    break;
    case 'group':     renderGroup(CK, canvas, p, typeface);        break;
    case 'image':     renderImage(CK, canvas, p);                  break;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Render a Scene to a PNG byte array using the Skia (CanvasKit) backend.
 *
 * Applies SceneEffect (glow / shadow) per-primitive and renders
 * SceneBackground (solid / gradient / cloud) if present.
 *
 * @param scene  Fully-computed Scene from the layout pipeline.
 * @returns      PNG bytes (Uint8Array) — valid PNG with 0x89504E47 signature.
 */
export async function sceneToPngSkia(scene: Scene): Promise<Uint8Array> {
  const CK        = await getCanvasKit();
  const typeface  = getTypeface(CK);
  const { width: W, height: H } = scene;

  const surface = CK.MakeSurface(W, H);
  if (!surface) throw new Error(`CanvasKit: failed to create surface (${W}×${H})`);

  try {
    const canvas = surface.getCanvas();

    // ── Background ──────────────────────────────────────────────────────────
    // When sceneBackground is set, render it here; the first full-canvas rect
    // primitive (background rect) is skipped during primitive pass.
    renderBackground(CK, canvas, scene);

    const hasSceneBg = !!scene.sceneBackground;

    // ── Primitives ──────────────────────────────────────────────────────────
    for (const p of scene.primitives) {
      // Skip the canvas background rect if we rendered sceneBackground above.
      // Identified by: rect at (0,0) spanning full canvas.
      if (
        hasSceneBg &&
        p.kind    === 'rect'  &&
        p.x       === 0       &&
        p.y       === 0       &&
        p.width   === W       &&
        p.height  === H       &&
        !p.effects?.length
      ) {
        continue;
      }
      renderPrimitive(CK, canvas, p, typeface);
    }

    // ── Encode to PNG ───────────────────────────────────────────────────────
    const img   = surface.makeImageSnapshot();
    const bytes = img.encodeToBytes();
    img.delete();

    if (!bytes) throw new Error('CanvasKit: encodeToBytes returned null');
    return new Uint8Array(bytes);

  } finally {
    surface.delete();
  }
}
