/**
 * @file frontend/mermaid/radar.ts — Mermaid radar / radar-beta → ChartDocument parser.
 *
 * Supports two syntaxes:
 *   A) Mermaid radar-beta: axis definitions, curve series with curly/square brackets
 *   B) Design-doc simple: axes: [...], "Series": [...] lines
 */
import type { ChartDocument } from '../../grammars/chart/types.js';
import { preprocessMermaid } from './utils.js';

export interface RadarParseResult {
  doc: ChartDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
  syntax: 'radar-beta' | 'radar-simple';
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseNumberList(inner: string): number[] {
  return inner.split(',').map((part) => {
    const value = Number.parseFloat(part.trim());
    return Number.isFinite(value) ? value : Number.NaN;
  });
}

function parseRadarBetaAxes(raw: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of raw) {
    if (ch === '[' || ch === '{') depth += 1;
    else if (ch === ']' || ch === '}') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current.trim());

  return parts
    .map((part) => {
      const labeled = part.match(/^[A-Za-z0-9_-]+\["([^"]+)"\]$/)
        ?? part.match(/^[A-Za-z0-9_-]+\['([^']+)'\]$/)
        ?? part.match(/^[A-Za-z0-9_-]+$/);
      if (!labeled) return stripQuotes(part);
      if (labeled[1]) return labeled[1];
      return labeled[0];
    })
    .filter(Boolean);
}

function parseCurveValues(raw: string): number[] | null {
  const trimmed = raw.trim();
  const inner = trimmed.startsWith('{')
    ? trimmed.slice(1, -1)
    : trimmed.startsWith('[')
      ? trimmed.slice(1, -1)
      : null;
  if (inner === null) return null;
  const nums = parseNumberList(inner);
  return nums.every((value) => Number.isFinite(value)) ? nums : null;
}

export function parseRadarDiagram(text: string): ChartDocument {
  return parseRadarDiagramInternal(text).doc;
}

export function parseRadarDiagramInternal(text: string): RadarParseResult {
  const { body, frontmatter, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  let headerIdx = -1;
  let isRadarBeta = false;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^radar-beta\b/i.test(trimmed)) {
      isRadarBeta = true;
      headerIdx = i;
      break;
    }
    if (/^radar\b/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    warnings.push(`Expected "radar" or "radar-beta" header; got: "${trimmed}". Parsing anyway.`);
    break;
  }

  let title: string | undefined;
  let radarAxes: string[] = [];
  let radarMin: number | undefined;
  let radarMax: number | undefined;
  let radarGraticule: number | undefined;
  const seriesRows: Array<Record<string, number | string>> = [];
  const contentLines = lines.slice(Math.max(0, headerIdx + 1));
  const hasAxesLine = contentLines.some((line) => /^\s*axes\s*:/i.test(line));
  const hasRadarBetaMarkers = contentLines.some((line) => /^\s*(axis|curve|graticule)\b/i.test(line));
  const syntax: 'radar-beta' | 'radar-simple' = isRadarBeta || (!hasAxesLine && hasRadarBetaMarkers) ? 'radar-beta' : 'radar-simple';

  if (syntax === 'radar-beta') {
    for (const rawLine of contentLines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^title\b/i.test(line)) {
        title = stripQuotes(line.replace(/^title\s+/i, ''));
        continue;
      }
      if (/^max\s+/i.test(line)) {
        radarMax = Number.parseFloat(line.replace(/^max\s+/i, ''));
        continue;
      }
      if (/^min\s+/i.test(line)) {
        radarMin = Number.parseFloat(line.replace(/^min\s+/i, ''));
        continue;
      }
      if (/^graticule\b/i.test(line)) {
        const match = line.match(/^graticule\s+(?:count\s+)?(\d+)/i);
        if (match) radarGraticule = Number.parseInt(match[1]!, 10);
        continue;
      }
      if (/^axis\b/i.test(line)) {
        radarAxes = parseRadarBetaAxes(line.replace(/^axis\s+/i, ''));
        continue;
      }

      const curveMatch = line.match(/^curve\s+(.+)$/i);
      if (curveMatch) {
        const rest = curveMatch[1]!.trim();
        const doubleQuoted = rest.match(/^"([^"]+)"\s*(\{[^}]*\}|\[[^\]]*\])/);
        const singleQuoted = rest.match(/^'([^']+)'\s*(\{[^}]*\}|\[[^\]]*\])/);
        const labeledId = rest.match(/^([A-Za-z0-9_-]+)\["([^"]+)"\]\s*(\{[^}]*\}|\[[^\]]*\])/);
        const bareId = rest.match(/^([A-Za-z0-9_-]+)\s*(\{[^}]*\}|\[[^\]]*\])/);

        let seriesName: string;
        let valuesText: string;

        if (doubleQuoted) {
          seriesName = doubleQuoted[1]!;
          valuesText = doubleQuoted[2]!;
        } else if (singleQuoted) {
          seriesName = singleQuoted[1]!;
          valuesText = singleQuoted[2]!;
        } else if (labeledId) {
          seriesName = labeledId[2]!;
          valuesText = labeledId[3]!;
        } else if (bareId) {
          seriesName = bareId[1]!;
          valuesText = bareId[2]!;
        } else {
          warnings.push(`Malformed curve line skipped: "${line}"`);
          continue;
        }

        const values = parseCurveValues(valuesText);
        if (!values) {
          warnings.push(`Could not parse curve values: "${line}"`);
          continue;
        }

        if (radarAxes.length > 0 && values.length !== radarAxes.length) {
          warnings.push(`Series "${seriesName}" has ${values.length} values but ${radarAxes.length} axes defined; padding/truncating.`);
        }

        const row: Record<string, number | string> = { _name: seriesName };
        radarAxes.forEach((axis, index) => {
          row[axis] = values[index] ?? 0;
        });
        if (radarAxes.length === 0) {
          values.forEach((value, index) => {
            row[`_axis${index}`] = value;
          });
        }
        seriesRows.push(row);
        continue;
      }

      warnings.push(`Unrecognised radar-beta line skipped: "${line}"`);
    }
  } else {
    for (const rawLine of contentLines) {
      const line = rawLine.trim();
      if (!line) continue;

      if (/^title\b/i.test(line)) {
        title = stripQuotes(line.replace(/^title\s+/i, ''));
        continue;
      }
      if (/^max\s+/i.test(line)) {
        radarMax = Number.parseFloat(line.replace(/^max\s+/i, ''));
        continue;
      }
      if (/^min\s+/i.test(line)) {
        radarMin = Number.parseFloat(line.replace(/^min\s+/i, ''));
        continue;
      }
      if (/^graticule\b/i.test(line)) {
        const match = line.match(/^graticule\s+(?:count\s+)?(\d+)/i);
        if (match) radarGraticule = Number.parseInt(match[1]!, 10);
        continue;
      }
      if (/^axes\s*:/i.test(line)) {
        const match = line.match(/axes\s*:\s*\[([^\]]+)\]/i);
        if (match) {
          radarAxes = match[1]!.split(',').map((part) => stripQuotes(part));
        }
        continue;
      }

      const seriesMatch = line.match(/^(?:"([^"]+)"|'([^']+)')\s*:\s*\[([^\]]+)\]/);
      if (seriesMatch) {
        const seriesName = seriesMatch[1] ?? seriesMatch[2] ?? 'Series';
        const values = parseNumberList(seriesMatch[3]!);
        if (values.some((value) => !Number.isFinite(value))) {
          warnings.push(`Non-numeric values in series "${seriesName}" skipped.`);
          continue;
        }
        if (radarAxes.length > 0 && values.length !== radarAxes.length) {
          warnings.push(`Series "${seriesName}" has ${values.length} values but ${radarAxes.length} axes; padding/truncating.`);
        }
        const row: Record<string, number | string> = { _name: seriesName };
        radarAxes.forEach((axis, index) => {
          row[axis] = values[index] ?? 0;
        });
        if (radarAxes.length === 0) {
          values.forEach((value, index) => {
            row[`_axis${index}`] = value;
          });
        }
        seriesRows.push(row);
        continue;
      }

      if (!/^radar\b/i.test(line)) {
        warnings.push(`Unrecognised radar line skipped: "${line}"`);
      }
    }
  }

  if (radarAxes.length > 0) {
    seriesRows.forEach((row) => {
      if ('_axis0' in row) {
        radarAxes.forEach((axis, index) => {
          if (!(axis in row)) row[axis] = row[`_axis${index}`] ?? 0;
          delete row[`_axis${index}`];
        });
      }
    });
  }

  if (radarAxes.length < 3 && seriesRows.length > 0) {
    warnings.push('Radar chart has fewer than 3 axes; at least 3 required for a meaningful chart.');
  }
  if (seriesRows.length === 0) {
    warnings.push('Radar chart has no series data.');
  }

  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  return {
    doc: {
      version: '1.0',
      chartType: 'radar',
      ...(title ?? fmTitle ?? directiveTitle ? { title: title ?? fmTitle ?? directiveTitle } : {}),
      data: { values: seriesRows },
      encoding: {
        color: { field: '_name', type: 'nominal' },
      },
      config: {
        radarAxes,
        ...(radarMin !== undefined ? { radarMin } : {}),
        ...(radarMax !== undefined ? { radarMax } : {}),
        ...(radarGraticule !== undefined ? { radarGraticule } : {}),
      },
    },
    warnings,
    frontmatter,
    syntax,
  };
}
