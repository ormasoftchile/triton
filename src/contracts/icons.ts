/**
 * Icons
 *
 * The unified icon data contract for Triton.
 *
 * Five shapes:
 *   IconData      — per-icon body + optional overrides within an IconifyJSON pack.
 *   IconAlias     — alternate name within a pack, pointing to a parent icon.
 *   IconifyJSON   — a complete loaded icon pack (IconifyJSON format).
 *   IconRef       — a parsed prefix:name token used in diagram IRs.
 *   ResolvedIcon  — the resolved form consumed by the SVG emitter (P2 seam).
 *   IconPackMap   — the map of loaded packs passed from host into core.
 *
 * Token grammar (canonical, enforced by the resolver):
 *   prefix  ::= [a-z][a-z0-9-]*      (starts with letter; e.g. "azure", "mdi")
 *   name    ::= [a-z0-9][a-z0-9-]*   (starts with alnum;  e.g. "app-service")
 *   iconRef ::= prefix ":" name       (e.g. "azure:app-service")
 *
 * Rendering contract (see ResolvedIcon):
 *   colorMode='monochrome' → renderer sets CSS color on the <svg> wrapper;
 *                            body uses currentColor and inherits the tint.
 *   colorMode='brand'      → renderer emits body verbatim, no color override;
 *                            hardcoded brand fills (e.g. #0078D4) appear as-is.
 *
 * Keep this module rendering-agnostic — no SVG emit, no file I/O, no process.
 */

// ─── Transforms ───────────────────────────────────────────────────────────────

/**
 * Quarter-turn rotation values.
 * 0 = 0°, 1 = 90°, 2 = 180°, 3 = 270° — all clockwise.
 */
export type IconRotate = 0 | 1 | 2 | 3;

/**
 * Geometric transforms applied to an icon body at render time.
 * Composed from alias-level and icon-level transform fields.
 * Rotation is applied before flips.
 */
export interface IconTransforms {
  /** Quarter-turns clockwise: 0=0°, 1=90°, 2=180°, 3=270°. */
  readonly rotate: IconRotate;
  /** Mirror around the vertical axis (left↔right). */
  readonly hFlip: boolean;
  /** Mirror around the horizontal axis (top↔bottom). */
  readonly vFlip: boolean;
}

// ─── IconData ─────────────────────────────────────────────────────────────────

/**
 * Per-icon data within an IconifyJSON pack.
 *
 * `body` is inner SVG markup — NO <svg> wrapper, NO xmlns attribute.
 * It is ready to embed directly inside a host <svg> element.
 *
 * Dimension fields (width/height/left/top) override the pack-level defaults
 * for this specific icon. The resolver merges icon → pack → system-defaults
 * (16×16 at origin 0,0) to produce the final IconViewBox.
 */
export interface IconData {
  /** Inner SVG markup. No <svg> wrapper. Required and non-empty. */
  readonly body: string;
  /** Viewport width in px. Overrides pack-level width for this icon. */
  readonly width?: number;
  /** Viewport height in px. Overrides pack-level height for this icon. */
  readonly height?: number;
  /** Viewport x-origin in px. Overrides pack-level left for this icon. */
  readonly left?: number;
  /** Viewport y-origin in px. Overrides pack-level top for this icon. */
  readonly top?: number;
  /** Quarter-turn rotation: 0–3. */
  readonly rotate?: IconRotate;
  /** Mirror horizontally. */
  readonly hFlip?: boolean;
  /** Mirror vertically. */
  readonly vFlip?: boolean;
}

// ─── IconAlias ────────────────────────────────────────────────────────────────

/**
 * An alias entry within an IconifyJSON pack.
 *
 * `parent` MUST name another icon (or alias) within the same pack.
 * Transform fields are composed on top of the resolved parent transforms:
 *   rotate is added modulo 4; hFlip and vFlip are XORed.
 * Dimension fields override the parent's resolved dimensions.
 */
export interface IconAlias {
  /** Bare name of the parent icon within the same pack. Required. */
  readonly parent: string;
  /** Additional rotation, composed on top of parent's rotation (mod 4). */
  readonly rotate?: IconRotate;
  /** Additional horizontal flip (XORed with parent's hFlip). */
  readonly hFlip?: boolean;
  /** Additional vertical flip (XORed with parent's vFlip). */
  readonly vFlip?: boolean;
  /** Override viewport width for this alias. */
  readonly width?: number;
  /** Override viewport height for this alias. */
  readonly height?: number;
  /** Override viewport x-origin for this alias. */
  readonly left?: number;
  /** Override viewport y-origin for this alias. */
  readonly top?: number;
}

// ─── IconifyJSON ──────────────────────────────────────────────────────────────

/**
 * A loaded icon pack in Triton's IconifyJSON format.
 * File extension: `.triton-icons.json`. Placed under `.triton/icons/`.
 *
 * This mirrors the @iconify/types IconifyJSON schema but is typed strictly for
 * Triton's subset. The `prefix` field is authoritative — it determines the
 * lookup key in IconPackMap, not the filename.
 *
 * Pack-level dimension fields (width/height/left/top) are the defaults for any
 * icon that does not specify its own dimensions. System fallback: 16×16 at (0,0).
 */
export interface IconifyJSON {
  /**
   * Pack identifier. Token grammar: [a-z][a-z0-9-]*.
   * Used as the first segment of `prefix:name` icon references.
   * Examples: "azure", "mdi", "lucide".
   */
  readonly prefix: string;
  /**
   * Icon entries keyed by bare name (no prefix prefix).
   * Each key matches [a-z0-9][a-z0-9-]*. At least one entry required.
   */
  readonly icons: Record<string, IconData>;
  /**
   * Optional alternate names for existing icons within this pack.
   * Alias transforms are composed on top of the parent icon's transforms.
   */
  readonly aliases?: Record<string, IconAlias>;
  /** Default viewport width in px. Falls back to system default of 16. */
  readonly width?: number;
  /** Default viewport height in px. Falls back to system default of 16. */
  readonly height?: number;
  /** Default viewport x-origin in px. Falls back to system default of 0. */
  readonly left?: number;
  /** Default viewport y-origin in px. Falls back to system default of 0. */
  readonly top?: number;
}

// ─── IconRef ──────────────────────────────────────────────────────────────────

/**
 * A parsed icon reference, carried by any IR node or label that references an icon.
 *
 * Produced by parsing an icon token string of the form "prefix:name".
 *
 * Token grammar:
 *   prefix  ::= [a-z][a-z0-9-]*      — pack identifier
 *   name    ::= [a-z0-9][a-z0-9-]*   — icon name within the pack
 *   iconRef ::= prefix ":" name
 *
 * The raw token string (e.g. "azure:app-service") is called an icon token.
 * Use `parseIconRef` from src/icons/resolver.ts to parse tokens into IconRef.
 */
export interface IconRef {
  /** Pack prefix, e.g. "azure". Matches [a-z][a-z0-9-]*. */
  readonly prefix: string;
  /** Icon name within the pack, e.g. "app-service". Matches [a-z0-9][a-z0-9-]*. */
  readonly name: string;
}

// ─── ResolvedIcon ─────────────────────────────────────────────────────────────

/**
 * Final viewport dimensions for a resolved icon, in px.
 * Produced by merging: icon-level dims → pack-level dims → system defaults (16×16, 0,0).
 * The renderer uses this as the viewBox attribute value on the <svg> wrapper.
 */
export interface IconViewBox {
  /** Viewport width in px. Always positive. */
  readonly width: number;
  /** Viewport height in px. Always positive. */
  readonly height: number;
  /** Viewport x-origin in px. */
  readonly left: number;
  /** Viewport y-origin in px. */
  readonly top: number;
}

/**
 * The resolved form of an icon — the P0↔P2 seam.
 *
 * This is what the SVG emitter (P2, Brian) receives. It never needs to access
 * packs, follow aliases, or apply merge logic — that is all done here in P0.
 *
 * Rendering contract for colorMode:
 *
 *   'monochrome' — body uses ONLY currentColor, none, or inherit for fill/stroke.
 *                  No hardcoded color values, no gradient definitions.
 *                  The renderer wraps body in:
 *                    <svg viewBox="..." style="color: {paletteToken}">
 *                  and currentColor inherits the active theme palette token.
 *
 *   'brand'      — body contains hardcoded fill/stroke values OR gradient
 *                  definitions (<linearGradient>, <radialGradient>).
 *                  The renderer wraps body in <svg viewBox="..."> with NO color
 *                  override. Brand fills render verbatim (e.g. Azure's #0078D4).
 *                  NOTE: the renderer MUST namespace gradient IDs per icon
 *                  instance (e.g. "icon-{n}-{id}") to prevent ID collisions
 *                  when multiple brand icons appear in the same output SVG.
 *
 * Detection heuristic (implemented in detectColorMode):
 *   Scan body for fill="..." and stroke="..." attribute values.
 *   If any value is not one of {none, currentColor, inherit} → brand.
 *   If body contains <linearGradient or <radialGradient → brand.
 *   Otherwise → monochrome.
 */
export interface ResolvedIcon {
  /** Inner SVG markup ready to embed. No <svg> wrapper. */
  readonly body: string;
  /**
   * Final viewBox after dimension merge.
   * Renderer uses: viewBox="{left} {top} {width} {height}".
   */
  readonly viewBox: IconViewBox;
  /**
   * Composed transforms (icon-level + alias-level if applicable).
   * Renderer applies rotate/flip around the icon center at emit time.
   * Rotation is clockwise; hFlip mirrors left↔right; vFlip mirrors top↔bottom.
   */
  readonly transforms: IconTransforms;
  /**
   * Color rendering mode.
   * 'monochrome' → renderer applies palette tint via CSS currentColor.
   * 'brand'      → renderer emits body verbatim with no color override.
   */
  readonly colorMode: 'monochrome' | 'brand';
}

// ─── IconPackMap ──────────────────────────────────────────────────────────────

/**
 * The set of loaded icon packs passed from the host layer into core.
 *
 * Keyed by each pack's `prefix` field (the authoritative key — not filename).
 * Built by the host (P1: discover → load → validate); core never touches the FS.
 *
 * Parallels how the host passes a resolved ThemeInput into core for themes.
 */
export type IconPackMap = Map<string, IconifyJSON>;
