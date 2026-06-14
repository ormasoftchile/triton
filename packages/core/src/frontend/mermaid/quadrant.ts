/**
 * @file frontend/mermaid/quadrant.ts — Mermaid quadrantChart → ChartDocument parser.
 */
import type { ChartDocument } from '../../grammars/chart/types.js';
import { preprocessMermaid } from './utils.js';

export interface QuadrantParseResult {
  doc: ChartDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

export function parseQuadrantDiagram(text: string): ChartDocument {
  return parseQuadrantDiagramInternal(text).doc;
}

export function parseQuadrantDiagramInternal(text: string): QuadrantParseResult {
  const { body, frontmatter, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^quadrantchart\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(`Expected "quadrantChart" header; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  let title: string | undefined;
  let xLow = 'Low';
  let xHigh = 'High';
  let yLow = 'Low';
  let yHigh = 'High';
  const quadrantLabels: [string, string, string, string] = ['', '', '', ''];
  const values: Array<Record<string, number | string>> = [];

  for (let i = Math.max(0, headerIdx + 1); i < lines.length; i++) {
    const raw = (lines[i] ?? '').trim();
    if (!raw) continue;

    const line = raw.replace(/:::[A-Za-z0-9_-]+\s*$/, '').trim();

    if (/^title\b/i.test(line)) {
      title = stripQuotes(line.replace(/^title\s+/i, ''));
      continue;
    }

    const xMatch = line.match(/^x-axis\s+(.+?)\s*-->\s*(.+)$/i);
    if (xMatch) {
      xLow = stripQuotes(xMatch[1]!.trim());
      xHigh = stripQuotes(xMatch[2]!.trim());
      continue;
    }

    const yMatch = line.match(/^y-axis\s+(.+?)\s*-->\s*(.+)$/i);
    if (yMatch) {
      yLow = stripQuotes(yMatch[1]!.trim());
      yHigh = stripQuotes(yMatch[2]!.trim());
      continue;
    }

    const qMatch = line.match(/^quadrant-([1-4])\s+(.+)$/i);
    if (qMatch) {
      const index = Number.parseInt(qMatch[1]!, 10) - 1;
      quadrantLabels[index as 0 | 1 | 2 | 3] = stripQuotes(qMatch[2]!.trim());
      continue;
    }

    const itemMatch = line.match(/^([^:[\]]+?)\s*:\s*\[([^\]]+)\]/);
    if (itemMatch) {
      const label = stripQuotes(itemMatch[1]!.trim());
      const coords = itemMatch[2]!.split(',').map((part) => Number.parseFloat(part.trim()));
      if (coords.length >= 2 && coords.every((value) => Number.isFinite(value))) {
        const x = Math.max(0, Math.min(1, coords[0]!));
        const y = Math.max(0, Math.min(1, coords[1]!));
        values.push({ label, x, y });
      } else {
        warnings.push(`Malformed quadrant item coordinates: "${line}"`);
      }
      continue;
    }

    if (!/^quadrantchart\b/i.test(line)) {
      warnings.push(`Unrecognised quadrantChart line skipped: "${line}"`);
    }
  }

  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  return {
    doc: {
      version: '1.0',
      chartType: 'quadrant',
      ...(title ?? fmTitle ?? directiveTitle ? { title: title ?? fmTitle ?? directiveTitle } : {}),
      data: { values },
      encoding: {
        x: { field: 'x', type: 'quantitative', scale: { domain: [0, 1] } },
        y: { field: 'y', type: 'quantitative', scale: { domain: [0, 1] } },
        label: { field: 'label', type: 'nominal' },
      },
      config: {
        quadrantLabels,
        xAxisLow: xLow,
        xAxisHigh: xHigh,
        yAxisLow: yLow,
        yAxisHigh: yHigh,
      },
    },
    warnings,
    frontmatter,
  };
}
