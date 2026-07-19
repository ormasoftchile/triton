import type { Color } from '../contracts/primitives.js';
import type { ResolvedTheme } from '../contracts/theme.js';

function parseHex(c: Color): [number, number, number] | null {
  const s = c.trim();
  const m3 = s.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (m3) return [parseInt(m3[1]! + m3[1]!, 16), parseInt(m3[2]! + m3[2]!, 16), parseInt(m3[3]! + m3[3]!, 16)];
  const m6 = s.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (m6) return [parseInt(m6[1]!, 16), parseInt(m6[2]!, 16), parseInt(m6[3]!, 16)];
  return null;
}

export function relativeLuminance(color: Color): number | undefined {
  const rgb = parseHex(color);
  if (!rgb) return undefined;
  const linear = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(rgb[0]) + 0.7152 * linear(rgb[1]) + 0.0722 * linear(rgb[2]);
}

export function contrastRatio(a: Color, b: Color): number {
  const la = relativeLuminance(a), lb = relativeLuminance(b);
  if (la === undefined || lb === undefined) return 1;
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

export function bestContrast(fill: Color, candidates: readonly Color[], fallback: Color): Color {
  let best = fallback, score = contrastRatio(fallback, fill);
  for (const c of candidates) {
    if (relativeLuminance(c) === undefined) continue;
    const next = contrastRatio(c, fill);
    if (next > score) { best = c; score = next; }
  }
  return best;
}

export function readableText(fill: Color, theme: ResolvedTheme): Color {
  // Pick the most-contrasting NEUTRAL theme token for text drawn on `fill`.
  // Considering the full neutral set (not just text+background) keeps labels
  // readable even when a token is blank — e.g. the VS Code extension forces a
  // preset but overrides palette.background to '' for a transparent canvas,
  // which would otherwise leave only the (light) text token and yield white
  // labels on light fills. bestContrast skips unparseable/blank candidates.
  const p = theme.palette;
  return bestContrast(
    fill,
    [p.text, p.background, p.surface, p.textMuted, p.border],
    p.text,
  );
}
