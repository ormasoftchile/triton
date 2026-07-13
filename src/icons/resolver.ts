/**
 * Icon resolution — pure, no I/O.
 *
 * Three exported functions:
 *
 *   parseIconRef(token)          — parse "prefix:name" → Result<IconRef>
 *   resolveIcon(ref, packs)      — resolve IconRef against IconPackMap → Result<ResolvedIcon>
 *   detectColorMode(body)        — classify body as 'monochrome' | 'brand'
 *
 * All functions are pure: they take data in and return data out.
 * No filesystem access, no network, no process.
 *
 * ViewBox merge order (highest priority first):
 *   1. Alias-level dimension overrides (if the reference was an alias)
 *   2. Icon-level dimension overrides
 *   3. Pack-level dimension defaults
 *   4. System defaults: width=16, height=16, left=0, top=0
 *
 * Transform composition (alias-level on top of icon-level):
 *   rotate : (aliasRotate + iconRotate) mod 4
 *   hFlip  : aliasHFlip XOR iconHFlip
 *   vFlip  : aliasVFlip XOR iconVFlip
 *
 * Color-mode detection heuristic (precise, documented):
 *   Scan body for fill="..." and stroke="..." attribute values.
 *   If any value is not in {none, currentColor, inherit} → brand.
 *   If body contains <linearGradient or <radialGradient → brand.
 *   Otherwise → monochrome.
 *
 * Alias depth limit: MAX_ALIAS_DEPTH (4) to prevent infinite loops.
 */

import type {
  IconRef,
  IconViewBox,
  IconTransforms,
  IconRotate,
  ResolvedIcon,
  IconifyJSON,
  IconPackMap,
  IconData,
  IconAlias,
} from '../contracts/icons.js';
import { ok, err, type Result } from '../contracts/result.js';

// ─── Token grammar ────────────────────────────────────────────────────────────

/**
 * Valid prefix: starts with a lowercase letter, followed by lowercase alnum or hyphens.
 * Examples: "azure", "mdi", "my-pack"
 */
const PREFIX_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Valid name: starts with lowercase alnum, followed by lowercase alnum or hyphens.
 * Examples: "app-service", "server", "12px" (unusual but valid per grammar)
 */
const NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

// ─── System defaults ──────────────────────────────────────────────────────────

const DEFAULT_WIDTH  = 16;
const DEFAULT_HEIGHT = 16;
const DEFAULT_LEFT   = 0;
const DEFAULT_TOP    = 0;

/** Maximum alias chain depth. Prevents infinite loops from circular aliases. */
const MAX_ALIAS_DEPTH = 4;

// ─── parseIconRef ─────────────────────────────────────────────────────────────

/**
 * Parse an icon token string of the form "prefix:name" into an IconRef.
 *
 * Valid: "azure:app-service", "mdi:server", "lucide:0-circle"
 * Invalid: "no-colon", ":name" (empty prefix), "prefix:" (empty name),
 *          "Azure:App" (uppercase), "prefix:name:extra" (too many colons)
 *
 * Returns err(ICON_NOT_FOUND, ...) on parse failure (not ICON_VALIDATION_ERROR
 * since this is a reference parse, not a pack-structure validation).
 */
export function parseIconRef(token: string): Result<IconRef> {
  if (typeof token !== 'string' || token.length === 0) {
    return err('ICON_NOT_FOUND', `Icon token must be a non-empty string, got ${JSON.stringify(token)}`);
  }

  const colonIdx = token.indexOf(':');
  if (colonIdx === -1) {
    return err('ICON_NOT_FOUND', `Invalid icon token ${JSON.stringify(token)}: must be "prefix:name"`);
  }

  // Only one colon allowed
  if (token.indexOf(':', colonIdx + 1) !== -1) {
    return err(
      'ICON_NOT_FOUND',
      `Invalid icon token ${JSON.stringify(token)}: too many colons — expected "prefix:name"`,
    );
  }

  const prefix = token.slice(0, colonIdx);
  const name   = token.slice(colonIdx + 1);

  if (!PREFIX_RE.test(prefix)) {
    return err(
      'ICON_NOT_FOUND',
      `Invalid icon token ${JSON.stringify(token)}: prefix ${JSON.stringify(prefix)} must match ^[a-z][a-z0-9-]*$`,
    );
  }

  if (!NAME_RE.test(name)) {
    return err(
      'ICON_NOT_FOUND',
      `Invalid icon token ${JSON.stringify(token)}: name ${JSON.stringify(name)} must match ^[a-z0-9][a-z0-9-]*$`,
    );
  }

  return ok({ prefix, name });
}

// ─── detectColorMode ──────────────────────────────────────────────────────────

/**
 * Classify an icon body as 'monochrome' or 'brand'.
 *
 * Heuristic (precise):
 *   1. Scan body for fill="..." and stroke="..." attribute values.
 *      If any value is not one of {none, currentColor, inherit} → brand.
 *   2. If body contains "<linearGradient" or "<radialGradient" → brand.
 *   3. Otherwise → monochrome.
 *
 * Rationale:
 *   Monochrome icons (MDI, Lucide, Heroicons) use only fill="currentColor" or
 *   fill="none", allowing the renderer to tint them via CSS color inheritance.
 *   Brand icons (Azure architecture icons, logos) embed hardcoded hex fills
 *   and/or gradient definitions that must render verbatim.
 *
 *   The gradient check is necessary because some icons use fill="url(#grad1)"
 *   which would pass the fill-value check but still requires brand rendering.
 *
 * Note: this is a string scan heuristic, not a full SVG parser. It handles
 * well-formed IconifyJSON bodies as produced by @iconify/tools. Pathological
 * bodies with fill/stroke in non-attribute contexts (e.g. CSS text) could
 * produce false positives, but this is acceptable for the BYOP use case.
 */
export function detectColorMode(body: string): 'monochrome' | 'brand' {
  // Gradient definitions always → brand
  if (body.includes('<linearGradient') || body.includes('<radialGradient')) {
    return 'brand';
  }

  // Scan fill="..." and stroke="..." attribute values
  // Match: fill="value" or stroke="value" (handles single/double quotes)
  const ATTR_RE = /(?:fill|stroke)=["']([^"']+)["']/g;
  const NEUTRAL = new Set(['none', 'currentcolor', 'inherit']);

  let match: RegExpExecArray | null;
  while ((match = ATTR_RE.exec(body)) !== null) {
    const value = match[1];
    if (value === undefined) continue;
    // Normalize to lowercase for case-insensitive comparison
    const lower = value.toLowerCase();
    if (!NEUTRAL.has(lower)) {
      return 'brand';
    }
  }

  return 'monochrome';
}

// ─── Internal: dimension merge ────────────────────────────────────────────────

type DimSource = {
  width?: number;
  height?: number;
  left?: number;
  top?: number;
};

function mergeViewBox(
  aliasLevel: DimSource,
  iconLevel: DimSource,
  packLevel: DimSource,
): IconViewBox {
  return {
    width:  aliasLevel.width  ?? iconLevel.width  ?? packLevel.width  ?? DEFAULT_WIDTH,
    height: aliasLevel.height ?? iconLevel.height ?? packLevel.height ?? DEFAULT_HEIGHT,
    left:   aliasLevel.left   ?? iconLevel.left   ?? packLevel.left   ?? DEFAULT_LEFT,
    top:    aliasLevel.top    ?? iconLevel.top    ?? packLevel.top    ?? DEFAULT_TOP,
  };
}

// ─── Internal: transform composition ─────────────────────────────────────────

function composeTransforms(
  icon: Pick<IconData, 'rotate' | 'hFlip' | 'vFlip'>,
  alias: Pick<IconAlias, 'rotate' | 'hFlip' | 'vFlip'> | null,
): IconTransforms {
  const iconRotate  = icon.rotate  ?? 0;
  const iconHFlip   = icon.hFlip   ?? false;
  const iconVFlip   = icon.vFlip   ?? false;

  if (alias === null) {
    return {
      rotate: iconRotate as IconRotate,
      hFlip:  iconHFlip,
      vFlip:  iconVFlip,
    };
  }

  const aliasRotate = alias.rotate ?? 0;
  const aliasHFlip  = alias.hFlip  ?? false;
  const aliasVFlip  = alias.vFlip  ?? false;

  return {
    rotate: ((iconRotate + aliasRotate) % 4) as IconRotate,
    hFlip:  iconHFlip  !== aliasHFlip,   // XOR
    vFlip:  iconVFlip  !== aliasVFlip,   // XOR
  };
}

// ─── resolveIcon ─────────────────────────────────────────────────────────────

/**
 * Resolve an IconRef against an IconPackMap to produce a ResolvedIcon.
 *
 * Resolution steps:
 *   1. Look up the pack by ref.prefix. → ICON_NOT_FOUND if absent.
 *   2. Look for ref.name in pack.icons. If found, use it directly.
 *   3. Else look in pack.aliases. Follow the alias chain up to MAX_ALIAS_DEPTH.
 *      → ICON_NOT_FOUND if name not in icons or aliases, or chain too deep.
 *   4. Merge viewBox dimensions: alias-level → icon-level → pack-level → defaults.
 *   5. Compose transforms: alias-level on top of icon-level.
 *   6. Detect colorMode from the resolved body.
 *
 * Pure — never throws, never touches the filesystem.
 */
export function resolveIcon(ref: IconRef, packs: IconPackMap): Result<ResolvedIcon> {
  const pack = packs.get(ref.prefix);
  if (pack === undefined) {
    return err('ICON_NOT_FOUND', `Icon pack "${ref.prefix}" not loaded (looking up "${ref.prefix}:${ref.name}")`);
  }

  // Try direct icon lookup first
  const directIcon = pack.icons[ref.name];
  if (directIcon !== undefined) {
    const viewBox    = mergeViewBox({}, directIcon, pack);
    const transforms = composeTransforms(directIcon, null);
    return ok({
      body:       directIcon.body,
      viewBox,
      transforms,
      colorMode:  detectColorMode(directIcon.body),
    });
  }

  // Try alias lookup
  const aliases = pack.aliases;
  if (aliases === undefined || !(ref.name in aliases)) {
    return err(
      'ICON_NOT_FOUND',
      `Icon "${ref.name}" not found in pack "${ref.prefix}" (checked icons and aliases)`,
    );
  }

  // Follow alias chain, accumulating the first alias's transform/dim overrides
  let currentName  = ref.name;
  let currentAlias: IconAlias | null = aliases[ref.name] ?? null;
  const topAlias = currentAlias;  // preserve top-level alias for dim/transform composition

  for (let depth = 0; depth < MAX_ALIAS_DEPTH; depth++) {
    if (currentAlias === null) break;

    const parentName = currentAlias.parent;
    const parentIcon = pack.icons[parentName];

    if (parentIcon !== undefined) {
      // Found the base icon — compose transforms and merge viewBox
      const viewBox    = mergeViewBox(topAlias ?? {}, parentIcon, pack);
      const transforms = composeTransforms(parentIcon, topAlias);
      return ok({
        body:      parentIcon.body,
        viewBox,
        transforms,
        colorMode: detectColorMode(parentIcon.body),
      });
    }

    // Parent is itself an alias — follow one more level
    const parentAlias = aliases[parentName];
    if (parentAlias === undefined) {
      return err(
        'ICON_NOT_FOUND',
        `Alias "${currentName}" in pack "${ref.prefix}" points to parent "${parentName}" which does not exist`,
      );
    }

    currentName  = parentName;
    currentAlias = parentAlias;
  }

  return err(
    'ICON_NOT_FOUND',
    `Alias chain for "${ref.name}" in pack "${ref.prefix}" exceeds maximum depth of ${MAX_ALIAS_DEPTH}`,
  );
}
