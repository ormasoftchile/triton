/**
 * @file frontend/mermaid/packet.ts — Mermaid packet-beta → PacketDocument parser.
 */

import type { PacketDocument, PacketField } from '../../grammars/packet/types.js';
import { preprocessMermaid } from './utils.js';

export interface PacketParseResult {
  doc: PacketDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

export function parsePacketDiagram(text: string): PacketDocument {
  return parsePacketDiagramInternal(text).doc;
}

export function parsePacketDiagramInternal(text: string): PacketParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const warnings: string[] = [];
  const fields: PacketField[] = [];
  const rawLines = body.split('\n');
  let headerSeen = false;
  let explicitTitle: string | undefined;

  for (let lineIndex = 0; lineIndex < rawLines.length; lineIndex++) {
    const trimmed = (rawLines[lineIndex] ?? '').trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    if (!headerSeen) {
      if (/^packet-beta\b/i.test(trimmed)) {
        headerSeen = true;
        continue;
      }
      warnings.push(`Line ${lineIndex + 1}: expected packet-beta header before '${trimmed}'`);
      headerSeen = true;
    }

    if (/^title\s+/iu.test(trimmed)) {
      explicitTitle = trimmed.replace(/^title\s+/iu, '').trim();
      continue;
    }

    const match = /^(\d+)(?:-(\d+))?\s*:\s*"([^"]+)"$/u.exec(trimmed);
    if (!match) {
      warnings.push(`Line ${lineIndex + 1}: could not parse packet field '${trimmed}'; skipped`);
      continue;
    }

    const startBit = Number.parseInt(match[1]!, 10);
    const endBit = match[2] ? Number.parseInt(match[2], 10) : startBit;
    if (!Number.isFinite(startBit) || !Number.isFinite(endBit)) {
      warnings.push(`Line ${lineIndex + 1}: invalid bit range '${trimmed}'; skipped`);
      continue;
    }
    if (endBit < startBit) {
      warnings.push(`Line ${lineIndex + 1}: end bit ${endBit} is smaller than start bit ${startBit}; skipped`);
      continue;
    }

    fields.push({ startBit, endBit, label: match[3]! });
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  const doc: PacketDocument = {
    version: '1.0',
    metadata: {
      title: explicitTitle ?? fmTitle ?? (typeof directiveTitle === 'string' ? directiveTitle : undefined),
      theme: fmTheme ?? (typeof directiveTheme === 'string' ? directiveTheme : undefined),
      bitsPerRow: 32,
    },
    fields,
  };

  return { doc, warnings, frontmatter };
}
