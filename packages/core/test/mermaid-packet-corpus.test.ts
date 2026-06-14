/**
 * @file test/mermaid-packet-corpus.test.ts — Packet grammar corpus tests.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  packetDocumentSchema,
  buildPacketScene,
  resolvePacketTheme,
} from '../src/grammars/packet/index.js';
import type { PacketDocument } from '../src/grammars/packet/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parsePacketDiagram, parsePacketDiagramInternal } from '../src/frontend/mermaid/packet.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const PACKET_MMD = join(GALLERY, 'mermaid-packet.mmd');
const PACKET_SVG = join(GALLERY, 'mermaid-packet.svg');
const PACKET_PNG = join(GALLERY, 'mermaid-packet.png');

function texts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((p) => {
    if (p.kind === 'text') return [p.text];
    if (p.kind === 'multitext') return p.lines;
    return [] as string[];
  });
}

function count(rendered: ReturnType<typeof renderMermaid>, kind: string): number {
  return rendered.scene.primitives.filter((p) => p.kind === kind).length;
}

interface PacketCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: PacketDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

const BASE_PACKET_CASES: PacketCase[] = [
  {
    name: 'minimal 3 fields across 2 rows',
    text: `packet-beta
0-15: "Source Port"
16-31: "Destination Port"
32-63: "Sequence Number"`,
    assert: (doc, warnings, rendered) => {
      expect(doc.fields).toHaveLength(3);
      expect(warnings).toHaveLength(0);
      expect(count(rendered, 'rect')).toBe(3);
      expect(texts(rendered)).toContain('Source Port');
      expect(texts(rendered)).toContain('32');
    },
  },
  {
    name: 'single bit field parses',
    text: `packet-beta
0: "Bit0"`,
    assert: (doc) => {
      expect(doc.fields[0]?.startBit).toBe(0);
      expect(doc.fields[0]?.endBit).toBe(0);
    },
  },
  {
    name: 'title line parses',
    text: `packet-beta
title TCP Header
0-15: "Source Port"`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.metadata.title).toBe('TCP Header');
      expect(texts(rendered)).toContain('TCP Header');
    },
  },
  {
    name: 'blank lines and comments are ignored',
    text: `packet-beta
%% comment

0-7: "A"

8-15: "B"`,
    assert: (doc, warnings) => {
      expect(doc.fields).toHaveLength(2);
      expect(warnings).toHaveLength(0);
    },
  },
  {
    name: 'wrapping field splits across rows',
    text: `packet-beta
28-35: "Wrap"`,
    assert: (_doc, _warnings, rendered) => {
      expect(count(rendered, 'rect')).toBe(2);
      expect(texts(rendered)).toContain('28');
      expect(texts(rendered)).toContain('32');
    },
  },
  {
    name: 'multiple rows render labels',
    text: `packet-beta
0-31: "Row0"
32-63: "Row1"
64-95: "Row2"`,
    assert: (_doc, _warnings, rendered) => {
      expect(texts(rendered)).toContain('0');
      expect(texts(rendered)).toContain('32');
      expect(texts(rendered)).toContain('64');
      expect(rendered.scene.height).toBeGreaterThan(150);
    },
  },
  {
    name: 'header only yields empty document',
    text: `packet-beta`,
    assert: (doc, warnings, rendered) => {
      expect(doc.fields).toHaveLength(0);
      expect(warnings).toHaveLength(0);
      expect(count(rendered, 'rect')).toBe(0);
    },
  },
  {
    name: 'malformed row warns and skips',
    text: `packet-beta
0-15 "Broken"
16-31: "Good"`,
    warningPattern: /could not parse packet field/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /could not parse packet field/.test(w))).toBe(true);
      expect(doc.fields).toHaveLength(1);
    },
  },
  {
    name: 'reversed range warns and skips',
    text: `packet-beta
8-0: "Bad"
9-15: "Good"`,
    warningPattern: /end bit 0 is smaller/,
    assert: (doc, warnings) => {
      expect(warnings.some((w) => /smaller/.test(w))).toBe(true);
      expect(doc.fields).toHaveLength(1);
    },
  },
  {
    name: 'frontmatter theme and title are captured',
    text: `---
theme: dark-packet
title: FM Packet
---
packet-beta
0-15: "Source Port"`,
    assert: (doc) => {
      expect(doc.metadata.theme).toBe('dark-packet');
      expect(doc.metadata.title).toBe('FM Packet');
    },
  },
  {
    name: 'directive title is captured',
    text: `%%{init: {"theme": "dark-packet", "title": "Directive Packet"}}%%
packet-beta
0-15: "Source Port"`,
    assert: (doc) => {
      expect(doc.metadata.theme).toBe('dark-packet');
      expect(doc.metadata.title).toBe('Directive Packet');
    },
  },
  {
    name: 'schema validation passes',
    text: `packet-beta
0-15: "A"
16-31: "B"`,
    assert: (doc) => {
      expect(() => packetDocumentSchema.parse(doc)).not.toThrow();
    },
  },
  {
    name: 'dark theme renders without error',
    text: `packet-beta
0-15: "A"
16-31: "B"`,
    assert: (_doc) => {
      const rendered = renderMermaid(`packet-beta\n0-15: "A"\n16-31: "B"`, { format: 'svg', theme: 'dark-packet' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(200);
    },
  },
  {
    name: 'scene contains expected texts',
    text: `packet-beta
0-15: "Source"
16-31: "Dest"`,
    assert: (_doc, _warnings, rendered) => {
      const t = texts(rendered);
      expect(t).toContain('Source');
      expect(t).toContain('Dest');
      expect(t).toContain('0');
      expect(t).toContain('16');
      expect(t).toContain('31');
    },
  },
  {
    name: 'parsePacketDiagram helper returns document',
    text: `packet-beta
0-15: "Source"`,
    assert: (_doc) => {
      const parsed = parsePacketDiagram(`packet-beta\n0-15: "Source"`);
      expect(parsed.fields[0]?.label).toBe('Source');
    },
  },
  {
    name: 'direct parser returns warnings array',
    text: `packet-beta
broken`,
    warningPattern: /could not parse packet field/,
    assert: (_doc, warnings) => {
      const parsed = parsePacketDiagramInternal(`packet-beta\nbroken`);
      expect(parsed.warnings).toHaveLength(1);
      expect(warnings).toHaveLength(1);
    },
  },
  {
    name: 'scene width matches configured total width plus margins',
    text: `packet-beta
0-31: "Whole Row"`,
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.scene.width).toBe(984);
    },
  },
  {
    name: 'scene height grows with title and rows',
    text: `packet-beta
title With Title
0-31: "Row0"
32-63: "Row1"`,
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.scene.height).toBeGreaterThan(100);
    },
  },
  {
    name: 'bitsPerRow metadata defaults to 32',
    text: `packet-beta
0-15: "A"`,
    assert: (doc) => {
      expect(doc.metadata.bitsPerRow).toBe(32);
    },
  },
  {
    name: 'integration kind is packet',
    text: `packet-beta
0-15: "A"`,
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.kind).toBe('packet');
    },
  },
];

const GENERATED_PACKET_CASES: PacketCase[] = [
  ...Array.from({ length: 8 }, (_, index) => ({
    name: `generated field range ${index + 1}`,
    text: `packet-beta\n${index * 4}-${index * 4 + 3}: "F${index + 1}"`,
    assert: (doc: PacketDocument, _warnings: string[], rendered: ReturnType<typeof renderMermaid>) => {
      expect(doc.fields[0]?.label).toBe(`F${index + 1}`);
      expect(texts(rendered)).toContain(`F${index + 1}`);
    },
  })),
  ...Array.from({ length: 6 }, (_, index) => ({
    name: `generated single-bit flag ${index + 1}`,
    text: `packet-beta\n${index}: "B${index}"`,
    assert: (doc: PacketDocument) => {
      expect(doc.fields[0]?.startBit).toBe(index);
      expect(doc.fields[0]?.endBit).toBe(index);
    },
  })),
  ...Array.from({ length: 6 }, (_, index) => {
    const start = 24 + index;
    const end = 33 + index;
    return {
      name: `generated wrap case ${index + 1}`,
      text: `packet-beta\n${start}-${end}: "Wrap${index + 1}"`,
      assert: (_doc: PacketDocument, _warnings: string[], rendered: ReturnType<typeof renderMermaid>) => {
        expect(count(rendered, 'rect')).toBe(2);
      },
    };
  }),
];

const PACKET_CASES = [...BASE_PACKET_CASES, ...GENERATED_PACKET_CASES];

describe('mermaid-packet-corpus', () => {
  it('detectDiagramType recognises packet-beta', () => {
    expect(detectDiagramType('packet-beta\n0-15: "A"')).toBe('packet');
  });

  it('resolvePacketTheme returns default theme', () => {
    expect(resolvePacketTheme().totalWidth).toBeGreaterThan(0);
  });

  it('buildPacketScene works directly', () => {
    const doc = parsePacketDiagram(`packet-beta\n0-15: "A"`);
    const scene = buildPacketScene(doc);
    expect(scene.width).toBeGreaterThan(0);
  });

  for (const tc of PACKET_CASES) {
    it(tc.name, () => {
      const normalised = tc.text.trim();
      const { doc: rawDoc, warnings } = parseMermaid(normalised);
      const doc = rawDoc as PacketDocument;
      packetDocumentSchema.parse(doc);
      const rendered = renderMermaid(normalised, { format: 'svg' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(10);
      if (tc.warningPattern) {
        expect(warnings.some((w) => tc.warningPattern!.test(w))).toBe(true);
      }
      tc.assert(doc, warnings, rendered);
    });
  }

  it('emits mermaid-packet.svg to examples/gallery/', () => {
    const text = readFileSync(PACKET_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('packet');
    writeFileSync(PACKET_SVG, result.svg!, 'utf8');
    expect(statSync(PACKET_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-packet.png to examples/gallery/', () => {
    const text = readFileSync(PACKET_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(PACKET_PNG, result.png!);
    expect(statSync(PACKET_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts packet gallery files exist and are non-empty', () => {
    expect(existsSync(PACKET_SVG)).toBe(true);
    expect(existsSync(PACKET_PNG)).toBe(true);
    expect(statSync(PACKET_SVG).size).toBeGreaterThan(1000);
    expect(statSync(PACKET_PNG).size).toBeGreaterThan(1000);
  });
});
