/**
 * @file text-wrap.ts — Deterministic text wrapping and truncation helper.
 *
 * Uses embedded font advance-width metrics from fonts/metrics.ts.
 * DETERMINISM: same input always yields same output — no randomness.
 */

import { measureText } from './fonts/metrics.js';

const ELLIPSIS = '…';

export interface WrappedText {
  lines: string[];
}

/**
 * Wrap text to fit maxWidth (px) at fontSizePx, with at most maxLines lines.
 * Breaks at word boundaries. Truncates last visible line with ellipsis if needed.
 */
export function wrapText(
  text: string,
  fontSizePx: number,
  maxWidth: number,
  maxLines: number,
): WrappedText {
  if (!text || maxLines <= 0 || maxWidth <= 0) return { lines: [] };

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [] };

  const lines: string[] = [];
  let current = '';

  for (let wi = 0; wi < words.length; wi++) {
    const word = words[wi]!;
    const candidate = current ? `${current} ${word}` : word;

    if (measureText(candidate, fontSizePx).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        if (lines.length === maxLines - 1) {
          const remaining = words.slice(wi).join(' ');
          const full = current ? `${current} ${remaining}` : remaining;
          lines.push(truncateText(full, fontSizePx, maxWidth));
          return { lines };
        }
        lines.push(current);
        current = word;
      } else {
        if (lines.length === maxLines - 1) {
          lines.push(truncateText(word, fontSizePx, maxWidth));
          return { lines };
        }
        lines.push(truncateText(word, fontSizePx, maxWidth));
        current = '';
      }
    }
  }

  if (current) {
    if (lines.length < maxLines) {
      lines.push(current);
    } else {
      const last = lines[lines.length - 1] ?? '';
      lines[lines.length - 1] = truncateText(`${last} ${current}`, fontSizePx, maxWidth);
    }
  }

  return { lines };
}

/**
 * Truncate text to fit maxWidth (px) at fontSizePx, appending an ellipsis if truncated.
 */
export function truncateText(
  text: string,
  fontSizePx: number,
  maxWidth: number,
): string {
  if (measureText(text, fontSizePx).width <= maxWidth) return text;

  const ellipsisWidth = measureText(ELLIPSIS, fontSizePx).width;
  const budget = maxWidth - ellipsisWidth;
  if (budget <= 0) return ELLIPSIS;

  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2);
    if (measureText(text.slice(0, mid), fontSizePx).width <= budget) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }

  return text.slice(0, lo) + ELLIPSIS;
}
