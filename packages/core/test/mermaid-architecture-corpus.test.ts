/**
 * @file test/mermaid-architecture-corpus.test.ts — Architecture grammar corpus tests.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  architectureDocumentSchema,
  buildArchitectureScene,
  resolveArchitectureTheme,
} from '../src/grammars/architecture/index.js';
import type { ArchitectureDocument } from '../src/grammars/architecture/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseArchitectureDiagram, parseArchitectureDiagramInternal } from '../src/frontend/mermaid/architecture.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const ARCH_MMD = join(GALLERY, 'mermaid-architecture.mmd');
const ARCH_SVG = join(GALLERY, 'mermaid-architecture.svg');
const ARCH_PNG = join(GALLERY, 'mermaid-architecture.png');

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

interface ArchitectureCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: ArchitectureDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

const ARCHITECTURE_CASES: ArchitectureCase[] = [
  {
    name: 'minimal single service no groups',
    text: `architecture-beta
  service api(server)[API]`,
    assert: (doc, warnings, rendered) => {
      expect(doc.services).toHaveLength(1);
      expect(doc.groups).toHaveLength(0);
      expect(doc.edges).toHaveLength(0);
      expect(warnings).toHaveLength(0);
      expect(texts(rendered)).toContain('API');
    },
  },
  {
    name: 'single group with one service',
    text: `architecture-beta
  group cloud(cloud)[Cloud]
    service api(server)[API]`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.groups).toHaveLength(1);
      expect(doc.services[0]?.parentGroup).toBe('cloud');
      expect(texts(rendered)).toContain('Cloud');
    },
  },
  {
    name: 'two services connected by edge',
    text: `architecture-beta
  service api(server)[API]
  service db(database)[Database]
  api:R -- L:db`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.edges).toHaveLength(1);
      expect(count(rendered, 'path')).toBeGreaterThanOrEqual(2);
    },
  },
  {
    name: 'all four port sides parse',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  service c(server)[C]
  service d(server)[D]
  a:R -- L:b
  a:B -- T:c
  b:L -- R:d
  c:T -- B:d`,
    assert: (doc) => {
      expect(doc.edges.map((edge) => edge.fromSide)).toEqual(['R', 'B', 'L', 'T']);
      expect(doc.edges.map((edge) => edge.toSide)).toEqual(['L', 'T', 'R', 'B']);
    },
  },
  {
    name: 'bidirectional edge',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  a:R <--> L:b`,
    assert: (doc) => {
      expect(doc.edges[0]?.arrowType).toBe('arrow-both');
    },
  },
  {
    name: 'left arrow',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  a:R <-- L:b`,
    assert: (doc) => {
      expect(doc.edges[0]?.arrowType).toBe('arrow-left');
    },
  },
  {
    name: 'right arrow',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  a:R --> L:b`,
    assert: (doc) => {
      expect(doc.edges[0]?.arrowType).toBe('arrow');
    },
  },
  {
    name: 'no arrow edge',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  a:R -- L:b`,
    assert: (doc) => {
      expect(doc.edges[0]?.arrowType).toBe('none');
    },
  },
  {
    name: 'group with icon and title',
    text: `architecture-beta
  group cloud(cloud)[Cloud Services]`,
    assert: (doc) => {
      expect(doc.groups[0]?.icon).toBe('cloud');
      expect(doc.groups[0]?.title).toBe('Cloud Services');
    },
  },
  {
    name: 'service outside group',
    text: `architecture-beta
  group cloud(cloud)[Cloud]
    service api(server)[API]
  service client(internet)[Client]`,
    assert: (doc) => {
      expect(doc.services.find((service) => service.id === 'client')?.parentGroup).toBeUndefined();
    },
  },
  {
    name: 'service in group with explicit in',
    text: `architecture-beta
  group cloud(cloud)[Cloud]
  service api(server)[API] in cloud`,
    assert: (doc) => {
      expect(doc.services[0]?.parentGroup).toBe('cloud');
    },
  },
  {
    name: 'nested groups',
    text: `architecture-beta
  group cloud(cloud)[Cloud]
    group app(server)[App] in cloud
      service api(server)[API]
    service db(database)[DB]`,
    assert: (doc) => {
      expect(doc.groups).toHaveLength(2);
      expect(doc.groups.find((group) => group.id === 'app')?.parentGroup).toBe('cloud');
      expect(doc.services.find((service) => service.id === 'api')?.parentGroup).toBe('app');
    },
  },
  {
    name: 'junction node',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  junction j
  a:R --> L:j
  j:R --> L:b`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.junctions).toHaveLength(1);
      expect(count(rendered, 'circle')).toBeGreaterThanOrEqual(1);
    },
  },
  {
    name: 'multiple groups',
    text: `architecture-beta
  group cloud(cloud)[Cloud]
    service api(server)[API]
  group data(cloud)[Data]
    service db(database)[DB]`,
    assert: (doc) => {
      expect(doc.groups).toHaveLength(2);
    },
  },
  {
    name: 'edge crossing groups',
    text: `architecture-beta
  group cloud(cloud)[Cloud]
    service api(server)[API]
  group data(cloud)[Data]
    service db(database)[DB]
  api:R --> L:db`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.edges).toHaveLength(1);
      expect(rendered.scene.width).toBeGreaterThan(200);
    },
  },
  {
    name: 'service with cloud icon',
    text: `architecture-beta
  service cloudSvc(cloud)[Cloud Service]`,
    assert: (doc) => {
      expect(doc.services[0]?.icon).toBe('cloud');
    },
  },
  {
    name: 'service with database icon',
    text: `architecture-beta
  service db(database)[Database]`,
    assert: (doc) => {
      expect(doc.services[0]?.icon).toBe('database');
    },
  },
  {
    name: 'service with server icon',
    text: `architecture-beta
  service api(server)[Server]`,
    assert: (doc) => {
      expect(doc.services[0]?.icon).toBe('server');
    },
  },
  {
    name: 'service with disk icon',
    text: `architecture-beta
  service storage(disk)[Storage]`,
    assert: (doc) => {
      expect(doc.services[0]?.icon).toBe('disk');
    },
  },
  {
    name: 'service with internet icon',
    text: `architecture-beta
  service client(internet)[Client]`,
    assert: (doc) => {
      expect(doc.services[0]?.icon).toBe('internet');
    },
  },
  {
    name: 'edge T-B vertical',
    text: `architecture-beta
  service top(server)[Top]
  service bottom(server)[Bottom]
  top:B --> T:bottom`,
    assert: (doc) => {
      expect(doc.edges[0]?.fromSide).toBe('B');
      expect(doc.edges[0]?.toSide).toBe('T');
    },
  },
  {
    name: 'edge B-T vertical reverse',
    text: `architecture-beta
  service top(server)[Top]
  service bottom(server)[Bottom]
  bottom:T --> B:top`,
    assert: (doc) => {
      expect(doc.edges[0]?.fromSide).toBe('T');
      expect(doc.edges[0]?.toSide).toBe('B');
    },
  },
  {
    name: 'multiple edges',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  service c(server)[C]
  a:R --> L:b
  b:R --> L:c`,
    assert: (doc) => {
      expect(doc.edges).toHaveLength(2);
    },
  },
  {
    name: 'long titles wrap',
    text: `architecture-beta
  service api(server)[Application Programming Interface Gateway]`,
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.scene.height).toBeGreaterThan(80);
      expect(texts(rendered).join(' ')).toContain('Application');
    },
  },
  {
    name: 'minimal valid header plus one service',
    text: `architecture-beta
  service a(server)[A]`,
    assert: (doc) => {
      expect(doc.services).toHaveLength(1);
    },
  },
  {
    name: 'group with no children',
    text: `architecture-beta
  group empty(cloud)[Empty]`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.groups).toHaveLength(1);
      expect(texts(rendered)).toContain('Empty');
    },
  },
  {
    name: 'three services in chain',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  service c(server)[C]
  a:R --> L:b
  b:R --> L:c`,
    assert: (doc) => {
      expect(doc.services).toHaveLength(3);
      expect(doc.edges).toHaveLength(2);
    },
  },
  {
    name: 'star topology',
    text: `architecture-beta
  service hub(server)[Hub]
  service l(server)[L]
  service r(server)[R]
  service t(server)[T]
  service b(server)[B]
  hub:L --> R:l
  hub:R --> L:r
  hub:T --> B:t
  hub:B --> T:b`,
    assert: (doc) => {
      expect(doc.edges).toHaveLength(4);
    },
  },
  {
    name: 'unknown icon warns not crash',
    text: `architecture-beta
  service mystery(unknownicon)[Mystery]`,
    warningPattern: /unknown architecture icon/,
    assert: (doc, warnings, rendered) => {
      expect(doc.services[0]?.icon).toBe('unknownicon');
      expect(warnings.some((warning) => /unknown architecture icon/.test(warning))).toBe(true);
      expect(rendered.svg).toBeDefined();
    },
  },
  {
    name: 'case sensitivity lowercase sides',
    text: `architecture-beta
  service a(server)[A]
  service b(server)[B]
  a:r --> l:b`,
    assert: (doc) => {
      expect(doc.edges[0]?.fromSide).toBe('R');
      expect(doc.edges[0]?.toSide).toBe('L');
    },
  },
  {
    name: 'canonical architecture header parses too',
    text: `architecture
  service a(server)[A]`,
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.kind).toBe('architecture');
    },
  },
  {
    name: 'edge to unknown node warns and skips',
    text: `architecture-beta
  service a(server)[A]
  a:R --> L:missing`,
    warningPattern: /unknown target/,
    assert: (doc, warnings) => {
      expect(doc.edges).toHaveLength(0);
      expect(warnings.some((warning) => /unknown target/.test(warning))).toBe(true);
    },
  },
  {
    name: 'frontmatter title and theme are captured',
    text: `---
theme: dark-architecture
title: Architecture Title
---
architecture-beta
  service a(server)[A]`,
    assert: (doc) => {
      expect(doc.metadata.theme).toBe('dark-architecture');
      expect(doc.metadata.title).toBe('Architecture Title');
    },
  },
  {
    name: 'parser helper returns document',
    text: `architecture-beta
  service a(server)[A]`,
    assert: (_doc) => {
      const parsed = parseArchitectureDiagram(`architecture-beta\n  service a(server)[A]`);
      expect(parsed.services[0]?.title).toBe('A');
    },
  },
  {
    name: 'direct parser returns warnings',
    text: `architecture-beta
  nonsense`,
    warningPattern: /could not parse architecture statement/,
    assert: (_doc, warnings) => {
      const parsed = parseArchitectureDiagramInternal(`architecture-beta\n  nonsense`);
      expect(parsed.warnings).toHaveLength(1);
      expect(warnings).toHaveLength(1);
    },
  },
];

describe('mermaid-architecture-corpus', () => {
  it('detectDiagramType recognises architecture-beta and architecture', () => {
    expect(detectDiagramType('architecture-beta\n  service a(server)[A]')).toBe('architecture');
    expect(detectDiagramType('architecture\n  service a(server)[A]')).toBe('architecture');
  });

  it('resolveArchitectureTheme returns default theme', () => {
    expect(resolveArchitectureTheme().gridCellWidth).toBeGreaterThan(0);
  });

  it('buildArchitectureScene works directly', () => {
    const doc = parseArchitectureDiagram(`architecture-beta\n  service a(server)[A]`);
    const scene = buildArchitectureScene(doc);
    expect(scene.width).toBeGreaterThan(0);
  });

  for (const tc of ARCHITECTURE_CASES) {
    it(tc.name, () => {
      const normalised = tc.text.trim();
      const { doc: rawDoc, warnings } = parseMermaid(normalised);
      const doc = rawDoc as ArchitectureDocument;
      architectureDocumentSchema.parse(doc);
      const rendered = renderMermaid(normalised, { format: 'svg' });
      expect(rendered.svg).toBeDefined();
      expect(rendered.svg!.length).toBeGreaterThan(10);
      if (tc.warningPattern) {
        expect(warnings.some((warning) => tc.warningPattern!.test(warning))).toBe(true);
      }
      tc.assert(doc, warnings, rendered);
    });
  }

  it('emits mermaid-architecture.svg to examples/gallery/', () => {
    const text = readFileSync(ARCH_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('architecture');
    writeFileSync(ARCH_SVG, result.svg!, 'utf8');
    expect(statSync(ARCH_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-architecture.png to examples/gallery/', () => {
    const text = readFileSync(ARCH_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(ARCH_PNG, result.png!);
    expect(statSync(ARCH_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts architecture gallery files exist and are non-empty', () => {
    expect(existsSync(ARCH_SVG)).toBe(true);
    expect(existsSync(ARCH_PNG)).toBe(true);
    expect(statSync(ARCH_SVG).size).toBeGreaterThan(1000);
    expect(statSync(ARCH_PNG).size).toBeGreaterThan(1000);
  });
});
