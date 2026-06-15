/**
 * @file grammars/packet/layout.ts — Packet Diagram layout engine.
 */

import type { RectPrimitive, Scene, ScenePrimitive, TextPrimitive } from '../../scene.js';
import { measureText } from '../../fonts/metrics.js';

import type { PacketDocument } from './types.js';
import type { PacketTheme } from './theme.js';
import { resolvePacketTheme } from './theme.js';

function rhuInt(v: number): number {
  return Math.floor(v + 0.5);
}

interface PacketSegment {
  startBit: number;
  endBit: number;
  label: string;
  rowIndex: number;
}

function splitFieldIntoSegments(startBit: number, endBit: number, label: string, bitsPerRow: number): PacketSegment[] {
  const segments: PacketSegment[] = [];
  let cursor = startBit;
  while (cursor <= endBit) {
    const rowIndex = Math.floor(cursor / bitsPerRow);
    const rowEndBit = rowIndex * bitsPerRow + bitsPerRow - 1;
    const segEnd = Math.min(endBit, rowEndBit);
    segments.push({ startBit: cursor, endBit: segEnd, label, rowIndex });
    cursor = segEnd + 1;
  }
  return segments;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [text];
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && measureText(candidate, fontSize).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text];
}

export function layoutPacket(doc: PacketDocument, themeOverride?: PacketTheme): Scene {
  const tk = themeOverride ?? resolvePacketTheme(doc.metadata.theme);
  const bitsPerRow = doc.metadata.bitsPerRow ?? tk.bitsPerRow;
  const bitWidth = tk.totalWidth / bitsPerRow;
  const segments = doc.fields.flatMap((field) => splitFieldIntoSegments(field.startBit, field.endBit, field.label, bitsPerRow));
  const rowCount = segments.length === 0 ? 0 : Math.max(...segments.map((segment) => segment.rowIndex)) + 1;
  const titleGap = doc.metadata.title ? 12 : 0;
  const titleHeight = doc.metadata.title ? tk.titleFontSize * 1.4 : 0;
  const contentHeight = rowCount === 0
    ? 0
    : rowCount * (tk.bitLabelHeight + tk.rowHeight) + Math.max(0, rowCount - 1) * tk.rowGap;

  const width = rhuInt(tk.marginLeft + tk.totalWidth + tk.marginRight);
  const height = rhuInt(tk.marginTop + titleHeight + titleGap + contentHeight + tk.marginBottom);
  const primitives: ScenePrimitive[] = [];

  let yCursor = tk.marginTop;
  if (doc.metadata.title) {
    primitives.push({
      kind: 'text',
      x: rhuInt(width / 2),
      y: rhuInt(yCursor + tk.titleFontSize),
      text: doc.metadata.title,
      fontFamily: tk.fontFamily,
      fontSize: tk.titleFontSize,
      fontWeight: tk.titleFontWeight,
      fill: tk.titleColor,
      textAnchor: 'middle',
      dominantBaseline: 'alphabetic',
    } satisfies TextPrimitive);
    yCursor = rhuInt(yCursor + titleHeight + titleGap);
  }

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const rowBaseY = rhuInt(yCursor + rowIndex * (tk.bitLabelHeight + tk.rowHeight + tk.rowGap));
    const rowFieldY = rhuInt(rowBaseY + tk.bitLabelHeight);
    const rowStartBit = rowIndex * bitsPerRow;
    const rowSegments = segments.filter((segment) => segment.rowIndex === rowIndex);

    const labelBits = new Set<number>();
    for (const segment of rowSegments) labelBits.add(segment.startBit);
    if (rowSegments.length > 0) labelBits.add(rowSegments[rowSegments.length - 1]!.endBit);
    const sortedLabelBits = [...labelBits].sort((a, b) => a - b);

    for (const bit of sortedLabelBits) {
      const localBit = bit - rowStartBit;
      const isEndLabel = bit === rowStartBit + bitsPerRow - 1 || bit === rowSegments[rowSegments.length - 1]?.endBit;
      const x = rhuInt(tk.marginLeft + (isEndLabel ? (localBit + 1) * bitWidth : localBit * bitWidth));
      primitives.push({
        kind: 'text',
        x,
        y: rhuInt(rowBaseY + tk.bitLabelFontSize),
        text: String(bit),
        fontFamily: tk.fontFamily,
        fontSize: tk.bitLabelFontSize,
        fontWeight: 500,
        fill: tk.bitLabelColor,
        textAnchor: isEndLabel ? 'end' : 'start',
        dominantBaseline: 'alphabetic',
      } satisfies TextPrimitive);
    }

    rowSegments.forEach((segment, idx) => {
      const localStart = segment.startBit - rowStartBit;
      const bitSpan = segment.endBit - segment.startBit + 1;
      const x = rhuInt(tk.marginLeft + localStart * bitWidth);
      const widthPx = rhuInt(bitSpan * bitWidth);
      const fill = idx % 2 === 0 ? tk.fieldFill : (tk.altFieldFill ?? '#d5e8d4');

      primitives.push({
        kind: 'rect',
        x,
        y: rowFieldY,
        width: widthPx,
        height: tk.rowHeight,
        fill,
        stroke: tk.fieldStroke,
        strokeWidth: tk.fieldStrokeWidth,
        rx: 0,
      } satisfies RectPrimitive);

      const maxTextWidth = Math.max(18, widthPx - 8);
      let fontSize = tk.fieldFontSize;
      while (fontSize > 8 && measureText(segment.label, fontSize).width > maxTextWidth && widthPx < 120) {
        fontSize -= 1;
      }
      const lines = widthPx >= 120 ? wrapText(segment.label, fontSize, maxTextWidth) : [segment.label];
      const lineHeight = fontSize * 1.15;
      const textTop = rowFieldY + tk.rowHeight / 2 - (lines.length * lineHeight) / 2;
      lines.slice(0, 2).forEach((line, lineIndex) => {
        primitives.push({
          kind: 'text',
          x: rhuInt(x + widthPx / 2),
          y: rhuInt(textTop + lineIndex * lineHeight + fontSize * 0.88),
          text: line,
          fontFamily: tk.fontFamily,
          fontSize,
          fontWeight: tk.fieldFontWeight,
          fill: tk.fieldTextColor,
          textAnchor: 'middle',
          dominantBaseline: 'alphabetic',
        } satisfies TextPrimitive);
      });
    });
  }

  return {
    width,
    height,
    background: tk.background,
    primitives,
  };
}
