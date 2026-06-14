/**
 * @file frontend/mermaid/sankey.ts — Mermaid sankey-beta parser.
 *
 * Parses the Mermaid `sankey-beta` CSV syntax:
 *
 *   sankey-beta
 *   source,target,value
 *   source2,target2,value2
 *   ...
 *
 * Features:
 *   - `sankey-beta` (or `sankey`) header detection.
 *   - `%%` comment lines and blank lines are ignored.
 *   - RFC 4180-ish CSV tokenizer: quoted fields (double-quotes), commas inside
 *     quotes, escaped quotes (double-double-quotes → single quote).
 *   - Graceful degradation: malformed row (wrong field count, non-numeric value,
 *     empty names) → warn + skip.
 *   - Nodes inferred from the union of all source/target names, in first-
 *     appearance order (stable, deterministic).
 *   - Frontmatter (---…---) and %%{init}%% directives handled by preprocessMermaid.
 */

import type { SankeyDocument, SankeyLink, SankeyNode } from '../../grammars/sankey/types.js';
import { preprocessMermaid } from './utils.js';

export interface SankeyParseResult {
  doc: SankeyDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CSV tokenizer
// ---------------------------------------------------------------------------

/**
 * Tokenise a single CSV row into fields.
 *
 * Handles:
 *   - Unquoted fields (split on comma).
 *   - Quoted fields: starts with `"`, ends with `"` (possibly after `,`).
 *     - `""` inside a quoted field → single `"`.
 *   - Trailing whitespace outside quotes is stripped.
 *
 * Returns `null` if the row is syntactically malformed (unclosed quote).
 */
function parseCSVRow(row: string): string[] | null {
  const fields: string[] = [];
  let i = 0;
  const n = row.length;

  while (i <= n) {
    if (i === n) {
      // End of input — push empty trailing field only if we had a leading comma
      // (no-op: loop exits naturally)
      break;
    }

    // Skip leading whitespace before field
    let start = i;
    while (start < n && row[start] === ' ') start++;

    if (start < n && row[start] === '"') {
      // Quoted field
      let j = start + 1;
      let field = '';
      while (j < n) {
        const ch = row[j];
        if (ch === '"') {
          if (j + 1 < n && row[j + 1] === '"') {
            // Escaped quote
            field += '"';
            j += 2;
          } else {
            // End of quoted field
            j++;
            break;
          }
        } else {
          field += ch;
          j++;
        }
      }
      // After closing quote, expect comma or end of row
      while (j < n && row[j] === ' ') j++; // skip trailing whitespace
      if (j < n && row[j] !== ',') {
        return null; // malformed: text after closing quote before comma
      }
      fields.push(field);
      i = j + 1; // skip comma
    } else {
      // Unquoted field — read until comma or end
      let end = start;
      while (end < n && row[end] !== ',') end++;
      const field = row.slice(start, end).trim();
      fields.push(field);
      i = end + 1; // skip comma
    }
  }

  return fields;
}

// ---------------------------------------------------------------------------
// Public parser
// ---------------------------------------------------------------------------

export function parseSankeyDiagram(text: string): SankeyDocument {
  return parseSankeyDiagramInternal(text).doc;
}

export function parseSankeyDiagramInternal(text: string): SankeyParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  // Find header line
  let headerIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;
    if (/^sankey(?:-beta)?\s*$/i.test(trimmed)) {
      headerIdx = i;
      break;
    }
    // First non-empty line is not a sankey header → warn
    warnings.push(`Expected "sankey-beta" or "sankey" header, found "${trimmed}". Treating as sankey-beta.`);
    headerIdx = i;
    break;
  }

  const nodeMap = new Map<string, SankeyNode>();
  const links: SankeyLink[] = [];
  let nodeOrder = 0;

  function ensureNode(id: string): SankeyNode {
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, label: id, order: nodeOrder++ });
    }
    return nodeMap.get(id)!;
  }

  // Parse data rows (after header)
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const raw = lines[i] ?? '';
    const trimmed = raw.trim();

    // Blank or comment
    if (!trimmed || trimmed.startsWith('%%')) continue;

    // Parse CSV row
    const fields = parseCSVRow(trimmed);

    if (fields === null) {
      warnings.push(`Malformed CSV row (unclosed quote): "${trimmed}". Skipping.`);
      continue;
    }

    if (fields.length !== 3) {
      warnings.push(`Expected 3 CSV fields (source,target,value), got ${fields.length} in "${trimmed}". Skipping.`);
      continue;
    }

    const [sourceName, targetName, valueRaw] = fields as [string, string, string];

    if (!sourceName) {
      warnings.push(`Empty source name in row "${trimmed}". Skipping.`);
      continue;
    }
    if (!targetName) {
      warnings.push(`Empty target name in row "${trimmed}". Skipping.`);
      continue;
    }

    const value = Number.parseFloat(valueRaw ?? '');
    if (!Number.isFinite(value)) {
      warnings.push(`Non-numeric value "${valueRaw}" in row "${trimmed}". Skipping.`);
      continue;
    }
    if (value < 0) {
      warnings.push(`Negative value ${value} in row "${trimmed}". Treating as 0.`);
    }

    ensureNode(sourceName);
    ensureNode(targetName);

    links.push({
      source: sourceName,
      target: targetName,
      value: Math.max(0, value),
    });
  }

  // Build nodes array in stable first-appearance order
  const nodes = [...nodeMap.values()].sort((a, b) => a.order - b.order);

  const title = directiveTitle ?? (typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined);
  const theme = directiveTheme ?? (typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined);

  const doc: SankeyDocument = {
    version: '1',
    metadata: {
      ...(title ? { title } : {}),
      ...(theme ? { theme } : {}),
    },
    nodes,
    links,
  };

  return { doc, warnings, frontmatter };
}
