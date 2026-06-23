/**
 * @file text/metrics.ts — Deterministic text-width measurement.
 *
 * General utility (any diagram). Uses a hardcoded per-character advance-width
 * table derived from DejaVu Sans (fraction of the em square), so measurements
 * are byte-identical across platforms — no font parser, no system locale.
 *
 * Ported from packages/core/src/fonts/metrics.ts.
 */

/**
 * Advance widths as a fraction of the em square for DejaVu Sans Regular.
 * Key is the Unicode code point (decimal). ASCII printable range plus a few
 * extras; everything else uses DEFAULT_ADVANCE.
 */
const ADVANCE: Record<number, number> = {
  32:  0.2793,
  33:  0.2793, 34:  0.3574, 35:  0.5576, 36:  0.5576, 37:  0.8906,
  38:  0.6699, 39:  0.1914, 40:  0.3340, 41:  0.3340, 42:  0.3906,
  43:  0.5859, 44:  0.2793, 45:  0.3340, 46:  0.2793, 47:  0.3125,
  48:  0.5576, 49:  0.5576, 50:  0.5576, 51:  0.5576, 52:  0.5576,
  53:  0.5576, 54:  0.5576, 55:  0.5576, 56:  0.5576, 57:  0.5576,
  58:  0.2793, 59:  0.2793, 60:  0.5859, 61:  0.5859, 62:  0.5859,
  63:  0.5576, 64:  1.0186,
  65:  0.6699, 66:  0.6699, 67:  0.7227, 68:  0.7227, 69:  0.6699,
  70:  0.6133, 71:  0.7793, 72:  0.7227, 73:  0.2783, 74:  0.5000,
  75:  0.6699, 76:  0.5576, 77:  0.8359, 78:  0.7227, 79:  0.7793,
  80:  0.6133, 81:  0.7793, 82:  0.7227, 83:  0.6133, 84:  0.6133,
  85:  0.7227, 86:  0.6699, 87:  0.9453, 88:  0.6699, 89:  0.6699,
  90:  0.6133,
  91:  0.2793, 92:  0.3125, 93:  0.2793, 94:  0.5859, 95:  0.5576,
  96:  0.3340,
  97:  0.5576,  98:  0.5576,  99:  0.5000, 100:  0.5576, 101:  0.5576,
  102:  0.2793, 103:  0.5576, 104:  0.5576, 105:  0.2217, 106:  0.2217,
  107:  0.5000, 108:  0.2217, 109:  0.8359, 110:  0.5576, 111:  0.5576,
  112:  0.5576, 113:  0.5576, 114:  0.3340, 115:  0.5000, 116:  0.3340,
  117:  0.5576, 118:  0.5000, 119:  0.7227, 120:  0.5000, 121:  0.5000,
  122:  0.5000,
  123:  0.3340, 124:  0.2598, 125:  0.3340, 126:  0.5859,
};

/** Fallback advance width for characters not in the table (em fraction). */
const DEFAULT_ADVANCE = 0.5576;

/** Line-height multiplier (leading). */
const LINE_HEIGHT_FACTOR = 1.2;

/**
 * Measure the rendered width/height of `text` at `fontSizePx` pixels.
 */
export function measureText(text: string, fontSizePx: number): { width: number; height: number } {
  let totalEm = 0;
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i) ?? 32;
    totalEm += ADVANCE[cp] ?? DEFAULT_ADVANCE;
  }
  return {
    width:  totalEm * fontSizePx,
    height: fontSizePx * LINE_HEIGHT_FACTOR,
  };
}

/** Convert point size to CSS pixels (at 96 dpi; 1pt = 96/72 px). */
export function ptToPx(pt: number): number {
  return pt * (96 / 72);
}
