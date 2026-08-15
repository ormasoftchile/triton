/**
 * @file text/formatted.ts — Unified multi-line and two-tier text formatting across Triton.
 *
 * Supports:
 * - Semantic two-tier hierarchy: "Title :: Subtitle" (bold title + muted subtitle)
 * - Explicit line breaks: "<br>", "<br/>", "<br />", "\n", "\\n"
 * - Automatic word-boundary wrapping for lines exceeding width threshold
 * - Deterministic font measurement and vertical baseline placement
 */

import { measureText } from './metrics.js';
import { wrapText } from './wrap.js';
import type { SceneElement } from '../contracts/index.js';
import type { pen } from '../scene/build.js';
import { rhu } from '../util/round.js';

export interface FormattedTextLines {
  title?: string | undefined;
  subtitle?: string | undefined;
  titleLines?: string[] | undefined;
  subtitleLines?: string[] | undefined;
  lines: string[];
  maxLineWidth: number;
  lineCount: number;
}

export interface RenderFormattedTextOpts {
  align?: 'start' | 'middle' | 'end';
  paddingLeft?: number;
  paddingRight?: number;
  defaultBold?: boolean;
  opacity?: number;
}

export function measureFormattedText(
  rawText: string,
  font: number,
  smallFont: number,
  maxAutoWrapWidth = 260,
  maxWrapLines = 6,
): FormattedTextLines {
  const sepIdx = rawText.indexOf('::');
  if (sepIdx !== -1) {
    const rawTitle = rawText.slice(0, sepIdx).trim();
    const rawSubtitle = rawText.slice(sepIdx + 2).trim();

    const titleNorm = rawTitle.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');
    const subNorm = rawSubtitle.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');

    const titleRawLines = titleNorm
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const subtitleRawLines = subNorm
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const titleLines: string[] = [];
    for (const r of titleRawLines) {
      if (measureText(r, font).width > maxAutoWrapWidth) {
        const wrapped = wrapText(r, font, maxAutoWrapWidth, maxWrapLines);
        titleLines.push(...wrapped.lines);
      } else {
        titleLines.push(r);
      }
    }

    const subtitleLines: string[] = [];
    for (const r of subtitleRawLines) {
      if (measureText(r, smallFont).width > maxAutoWrapWidth) {
        const wrapped = wrapText(r, smallFont, maxAutoWrapWidth, maxWrapLines);
        subtitleLines.push(...wrapped.lines);
      } else {
        subtitleLines.push(r);
      }
    }

    let titleMaxW = 0;
    for (const t of titleLines) {
      titleMaxW = Math.max(titleMaxW, measureText(t, font).width * 1.05);
    }
    let subMaxW = 0;
    for (const s of subtitleLines) {
      subMaxW = Math.max(subMaxW, measureText(s, smallFont).width);
    }

    const firstTitle = titleLines[0];
    const firstSub = subtitleLines.length > 0 ? subtitleLines.join(' ') : undefined;

    return {
      title: firstTitle,
      subtitle: firstSub,
      titleLines: titleLines.length > 0 ? titleLines : undefined,
      subtitleLines: subtitleLines.length > 0 ? subtitleLines : undefined,
      lines: [...titleLines, ...subtitleLines],
      maxLineWidth: Math.max(titleMaxW, subMaxW),
      lineCount: titleLines.length + subtitleLines.length,
    };
  }

  const normalized = rawText.replace(/<br\s*\/?>/gi, '\n').replace(/\\n/g, '\n');
  const rawLines = normalized
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const lines: string[] = [];
  for (const r of rawLines) {
    if (measureText(r, font).width > maxAutoWrapWidth) {
      const wrapped = wrapText(r, font, maxAutoWrapWidth, maxWrapLines);
      lines.push(...wrapped.lines);
    } else {
      lines.push(r);
    }
  }

  const finalLines = lines.length > 0 ? lines : [rawText.replace(/<br\s*\/?>/gi, ' ').trim()];
  const maxLineWidth = finalLines.reduce((m, l) => Math.max(m, measureText(l, font).width), 0);

  return {
    lines: finalLines,
    maxLineWidth,
    lineCount: finalLines.length,
  };
}

export function renderFormattedText(
  p: ReturnType<typeof pen>,
  itemInfo: FormattedTextLines,
  x: number,
  y: number,
  w: number,
  h: number,
  font: number,
  smallFont: number,
  textColor: string,
  mutedColor: string,
  opts: RenderFormattedTextOpts = {},
): SceneElement[] {
  const elements: SceneElement[] = [];
  const align = opts.align ?? 'start';
  const paddingLeft = opts.paddingLeft ?? 0;
  const paddingRight = opts.paddingRight ?? 0;
  const defaultBold = opts.defaultBold ?? false;
  const opacity = opts.opacity;

  const targetX =
    align === 'middle'
      ? rhu(x + w / 2)
      : align === 'end'
        ? rhu(x + w - paddingRight)
        : rhu(x + paddingLeft);

  if (itemInfo.titleLines !== undefined) {
    const titleLines = itemInfo.titleLines;
    const subLines = itemInfo.subtitleLines ?? [];
    const titleLH = font * 1.25;
    const subLH = smallFont * 1.25;
    const totalH = titleLines.length * titleLH + subLines.length * subLH;
    const startY = y + (h - totalH) / 2 + font * 0.85;

    let curY = startY;
    for (let ti = 0; ti < titleLines.length; ti++) {
      elements.push(
        p.text(titleLines[ti]!, targetX, rhu(curY), font, textColor, {
          weight: 'bold',
          anchor: align,
          ...(opacity !== undefined ? { opacity } : {}),
        }),
      );
      curY += titleLH;
    }

    for (let si = 0; si < subLines.length; si++) {
      elements.push(
        p.text(subLines[si]!, targetX, rhu(curY), smallFont, mutedColor, {
          anchor: align,
          ...(opacity !== undefined ? { opacity } : {}),
        }),
      );
      curY += subLH;
    }

    return elements;
  }

  const lines = itemInfo.lines;
  const count = lines.length;
  const lineH = font * 1.25;

  if (count === 1) {
    const textY = rhu(y + h / 2 + font * 0.34);
    elements.push(
      p.text(lines[0]!, targetX, textY, font, textColor, {
        ...(defaultBold ? { weight: 'bold' } : {}),
        anchor: align,
        ...(opacity !== undefined ? { opacity } : {}),
      }),
    );
    return elements;
  }

  const startY = y + (h - (count - 1) * lineH) / 2 + font * 0.34;

  for (let li = 0; li < count; li++) {
    const lineY = rhu(startY + li * lineH);
    elements.push(
      p.text(lines[li]!, targetX, lineY, font, textColor, {
        ...(defaultBold ? { weight: 'bold' } : {}),
        anchor: align,
        ...(opacity !== undefined ? { opacity } : {}),
      }),
    );
  }

  return elements;
}
