/**
 * @file frontend/mermaid/pie.ts — Mermaid pie → ChartDocument parser.
 */

import type { ChartDocument } from '../../grammars/chart/types.js';
import { preprocessMermaid } from './utils.js';

export interface PieParseResult {
  doc: ChartDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

function normalizeTitle(raw: string): string {
  const trimmed = raw.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parsePieDiagram(text: string): ChartDocument {
  return parsePieDiagramInternal(text).doc;
}

export function parsePieDiagramInternal(text: string): PieParseResult {
  const { body, frontmatter, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  let showData = false;
  let inlineTitle: string | undefined;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^pie\b(.*)$/i);
    if (match) {
      headerIdx = i;
      const tail = (match[1] ?? '').trim();
      if (/\bshowData\b/i.test(tail)) showData = true;
      const tailWithoutShowData = tail.replace(/\bshowData\b/ig, '').trim();
      if (/^title\b/i.test(tailWithoutShowData)) {
        inlineTitle = normalizeTitle(tailWithoutShowData.replace(/^title\s+/i, ''));
      }
      break;
    }
    warnings.push(`Expected "pie" header on first content line; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  let title = inlineTitle;
  const values: Array<Record<string, number | string>> = [];

  for (let i = Math.max(0, headerIdx + 1); i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    if (/^title\b/i.test(trimmed)) {
      title = normalizeTitle(trimmed.replace(/^title\s+/i, ''));
      continue;
    }

    const match = trimmed.match(/^(?:"([^"]+)"|'([^']+)'|([^:]+))\s*:\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) {
      warnings.push(`Malformed pie data row skipped: "${trimmed}"`);
      continue;
    }

    const label = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    const value = Number(match[4] ?? '0');
    if (!Number.isFinite(value)) {
      warnings.push(`Invalid pie value skipped for "${label}".`);
      continue;
    }
    if (value <= 0) {
      warnings.push(`Non-positive pie value skipped for "${label}".`);
      continue;
    }

    values.push({ label, value });
  }

  if (values.length === 0) warnings.push('Pie chart has no positive data rows.');
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  return {
    doc: {
      version: '1.0',
      chartType: 'pie',
      ...(title ?? fmTitle ?? directiveTitle ? { title: title ?? fmTitle ?? directiveTitle } : {}),
      data: { values },
      encoding: {
        theta: { field: 'value', type: 'quantitative' },
        color: { field: 'label', type: 'nominal' },
        label: { field: 'label', type: 'nominal' },
      },
      config: { showData },
    },
    warnings,
    frontmatter,
  };
}
