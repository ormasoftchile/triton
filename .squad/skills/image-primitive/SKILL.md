# Skill: Image Primitive Rendering

**Owner:** Barbara (Semantics & Rendering)  
**Added:** 2026-06-11  
**Status:** Shipped — T1-3 closed

## What This Skill Does

Adds image (raster/vector) support to the Scene render pipeline: an `ImagePrimitive` in the Scene IR is rendered correctly by all three backends (SVG, PNG/resvg, Skia), with base64-embedded bytes for byte-determinism.

## Key Files

| File | Role |
|------|------|
| `packages/core/src/scene.ts` | `ImagePrimitive` type + union member |
| `packages/core/src/asset-loader.ts` | `loadImageAsset(src, baseDir?)` — path/data-URI → LoadedAsset |
| `packages/core/src/render/svg.ts` | `case 'image':` + `collectImageClipDefs` + `<defs>` block |
| `packages/core/src/render/skia.ts` | `renderImage()` using `CK.MakeImageFromEncoded` |
| `packages/core/src/layout/horizontal.ts` | Logo placement in horizontal header |
| `packages/core/src/layout/vertical-spine.ts` | Logo placement in vertical-spine header |
| `packages/core/src/render/index.ts` | `BuildSceneOptions.baseDir` threading |

## Usage Pattern

### In IR (YAML):
```yaml
metadata:
  logo:
    src: "path/to/logo.png"   # or "data:image/png;base64,..."
    position: top-left         # or top-right
    width: 100
    height: 32
```

### In code (direct scene construction):
```typescript
import { loadImageAsset } from '../asset-loader.js';

const asset = loadImageAsset('path/to/logo.png', baseDir);
if (asset) {
  primitives.push({
    kind: 'image',
    x: 4, y: 10, width: 100, height: 32,
    data: asset.dataUri,
    mimeType: asset.mimeType,
    // borderRadius: 6,  // optional rounded corners
    // opacity: 0.9,     // optional
  });
}
```

### Rendering with baseDir:
```typescript
// CLI / tests: pass baseDir so relative paths resolve from document directory
const result = await renderDocumentAsync(ir, {
  format: 'png', backend: 'skia', baseDir: documentDir,
});
```

## Constraints & Limitations

1. **Data URI only in Scene** — `ImagePrimitive.data` MUST be a `data:` URI. Paths are resolved and embedded by `loadImageAsset` before Scene construction.
2. **Skia: raster only** — `CK.MakeImageFromEncoded` handles PNG/JPEG/GIF/WebP. SVG images are silently skipped (no crash, no logo).
3. **resvg SVG-in-SVG** — resvg may not support `data:image/svg+xml;base64,...` inside `<image>`. Use PNG/JPEG logos for the PNG/resvg backend.
4. **SVG backend** — handles all formats including SVG-in-SVG (SVG2 compliant).
5. **Graceful failure** — `loadImageAsset` returns `null` for missing files, unknown extensions, or I/O errors. Logo is silently omitted; render continues.
6. **Path resolution** — relative paths resolved against `baseDir` (defaults to `process.cwd()`). Pass the document's directory for portable fixtures.

## borderRadius Support

SVG backend: `<defs>/<clipPath>` pre-pass in `sceneToSvg`. Clip ID = `img-clip-{x}-{y}-{w}-{h}`.

Skia backend: `canvas.clipRRect(rrect, CK.ClipOp.Intersect, true)` wrapping `drawImageRect`.

## Supported MIME Types

`.png` → `image/png`, `.jpg/.jpeg` → `image/jpeg`, `.svg` → `image/svg+xml`, `.gif` → `image/gif`, `.webp` → `image/webp`

## Tests

See `packages/core/test/skia.test.ts` describe block **"Image Primitive — all backends + asset loading"** for:
- SVG emission, path embedding, graceful skip (missing/bad ext), data URI passthrough, SVG determinism, PNG backend, Skia backend, SVG logo graceful skip, borderRadius clipPath, golden regeneration
