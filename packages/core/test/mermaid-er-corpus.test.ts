/**
 * @file test/mermaid-er-corpus.test.ts — Real-Mermaid erDiagram corpus validation.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseErDiagram, parseErDiagramInternal } from '../src/frontend/mermaid/er.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const ER_MMD = join(GALLERY, 'mermaid-er.mmd');

const BASIC_SAMPLE = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string id PK
    string name
  }
  ORDER {
    int id PK
  }`;

const KEY_SAMPLE = `erDiagram
  LINE_ITEM {
    int id PK
    int order_id FK
    string sku UK
    int warehouse_id PK FK
  }`;

const NON_IDENTIFYING_SAMPLE = `erDiagram
  USER |o..o{ SESSION : opens
  USER {
    int id PK
  }
  SESSION {
    int id PK
  }`;

const CARDINALITY_SAMPLE = `erDiagram
  A |o--|| B : one
  B ||--o{ C : many
  C }o--|{ D : mixed
  D ||..o{ E : optional`;

const ECOMMERCE_SAMPLE = `erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ LINE_ITEM : contains
  PRODUCT ||--o{ LINE_ITEM : "ordered in"
  CUSTOMER }o--o{ PRODUCT : wishlist
  CATEGORY ||--|{ PRODUCT : categorizes
  CUSTOMER {
    string id PK
    string name
    string email
  }
  ORDER {
    int id PK
    date created_at
    float total
  }
  LINE_ITEM {
    int id PK
    int order_id FK
    int product_id FK
    int quantity
  }
  PRODUCT {
    int id PK
    string sku UK
    string name
  }
  CATEGORY {
    int id PK
    string name
  }`;

describe('AC1 — empty diagram, single entity, entity with attributes', () => {
  it('parses an empty erDiagram document', () => {
    const doc = parseErDiagram('erDiagram');
    expect(doc.entities).toHaveLength(0);
    expect(doc.relationships).toHaveLength(0);
  });

  it('parses a single inline entity block', () => {
    const doc = parseErDiagram('erDiagram\n  USER { int id PK }');
    expect(doc.entities).toHaveLength(1);
    expect(doc.entities[0]!.name).toBe('USER');
  });

  it('parses multiple attributes in a block', () => {
    const doc = parseErDiagram(BASIC_SAMPLE);
    expect(doc.entities.find((entity) => entity.name === 'CUSTOMER')?.attributes).toHaveLength(2);
  });

  it('preserves frontmatter title/theme metadata', () => {
    const doc = parseErDiagram('---\ntitle: Schema\ntheme: default-er\n---\nerDiagram\n  USER { int id PK }');
    expect(doc.metadata.title).toBe('Schema');
    expect(doc.metadata.theme).toBe('default-er');
  });
});

describe('AC2 — all four cardinality types', () => {
  it('maps |o / o| to zero-or-one', () => {
    const doc = parseErDiagram('erDiagram\n  A |o--o| B : maybe\n  A { int id PK }\n  B { int id PK }');
    expect(doc.relationships[0]).toMatchObject({ cardinalityA: 'zero-or-one', cardinalityB: 'zero-or-one' });
  });

  it('maps || to exactly-one', () => {
    const doc = parseErDiagram('erDiagram\n  A ||--|| B : exact\n  A { int id PK }\n  B { int id PK }');
    expect(doc.relationships[0]).toMatchObject({ cardinalityA: 'exactly-one', cardinalityB: 'exactly-one' });
  });

  it('maps o{ / }o to zero-or-many', () => {
    const doc = parseErDiagram('erDiagram\n  A }o--o{ B : many\n  A { int id PK }\n  B { int id PK }');
    expect(doc.relationships[0]).toMatchObject({ cardinalityA: 'zero-or-many', cardinalityB: 'zero-or-many' });
  });

  it('maps |{ / }| to one-or-many', () => {
    const doc = parseErDiagram('erDiagram\n  A }|--|{ B : one-many\n  A { int id PK }\n  B { int id PK }');
    expect(doc.relationships[0]).toMatchObject({ cardinalityA: 'one-or-many', cardinalityB: 'one-or-many' });
  });
});

describe('AC3 — identifying vs non-identifying relationships', () => {
  it('treats -- as identifying', () => {
    const doc = parseErDiagram(BASIC_SAMPLE);
    expect(doc.relationships[0]!.identifying).toBe(true);
  });

  it('treats .. as non-identifying', () => {
    const doc = parseErDiagram(NON_IDENTIFYING_SAMPLE);
    expect(doc.relationships[0]!.identifying).toBe(false);
  });

  it('preserves labels for both relationship styles', () => {
    const a = parseErDiagram(BASIC_SAMPLE);
    const b = parseErDiagram(NON_IDENTIFYING_SAMPLE);
    expect(a.relationships[0]!.label).toBe('places');
    expect(b.relationships[0]!.label).toBe('opens');
  });

  it('renders identifying and non-identifying relationships', () => {
    const identifying = renderMermaid(BASIC_SAMPLE, { format: 'svg' });
    const nonIdentifying = renderMermaid(NON_IDENTIFYING_SAMPLE, { format: 'svg' });
    expect(identifying.svg).toContain('<svg');
    expect(nonIdentifying.svg).toContain('<svg');
  });
});

describe('AC4 — PK/FK/UK key designators', () => {
  it('parses PK keys', () => {
    const doc = parseErDiagram(KEY_SAMPLE);
    expect(doc.entities[0]!.attributes[0]!.keys).toEqual(['PK']);
  });

  it('parses FK keys', () => {
    const doc = parseErDiagram(KEY_SAMPLE);
    expect(doc.entities[0]!.attributes[1]!.keys).toEqual(['FK']);
  });

  it('parses UK keys', () => {
    const doc = parseErDiagram(KEY_SAMPLE);
    expect(doc.entities[0]!.attributes[2]!.keys).toEqual(['UK']);
  });

  it('parses multiple keys on a single attribute', () => {
    const doc = parseErDiagram(KEY_SAMPLE);
    expect(doc.entities[0]!.attributes[3]!.keys).toEqual(['PK', 'FK']);
  });
});

describe('AC5 — quoted and unquoted relationship labels', () => {
  it('parses unquoted relationship labels', () => {
    const doc = parseErDiagram(BASIC_SAMPLE);
    expect(doc.relationships[0]!.label).toBe('places');
  });

  it('parses double-quoted relationship labels', () => {
    const doc = parseErDiagram('erDiagram\n  PRODUCT ||--o{ LINE_ITEM : "ordered in"');
    expect(doc.relationships[0]!.label).toBe('ordered in');
  });

  it('parses single-quoted relationship labels after stripQuotes fallback', () => {
    const doc = parseErDiagram("erDiagram\n  CUSTOMER ||--o{ ORDER : 'places order'");
    expect(doc.relationships[0]!.label).toBe('places order');
  });

  it('keeps multi-word unquoted labels intact', () => {
    const doc = parseErDiagram('erDiagram\n  A ||--o{ B : belongs to');
    expect(doc.relationships[0]!.label).toBe('belongs to');
  });
});

describe('AC6 — entity defined after relationship (auto-creates entity)', () => {
  it('auto-creates both entities from the relationship line', () => {
    const doc = parseErDiagram('erDiagram\n  CUSTOMER ||--o{ ORDER : places');
    expect(doc.entities.map((entity) => entity.name)).toEqual(['CUSTOMER', 'ORDER']);
  });

  it('updates an auto-created entity when its block appears later', () => {
    const doc = parseErDiagram(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER {
    int id PK
  }`);
    expect(doc.entities.find((entity) => entity.name === 'ORDER')?.attributes[0]).toMatchObject({ name: 'id' });
  });

  it('parseMermaid dispatches to erDiagram parser', () => {
    const result = parseMermaid('erDiagram\n  CUSTOMER ||--o{ ORDER : places');
    expect(result.kind).toBe('erDiagram');
    expect(result.doc.entities.map((entity) => entity.name)).toEqual(['CUSTOMER', 'ORDER']);
  });

  it('schema-compatible graph renders after later entity definitions', () => {
    const result = renderMermaid(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string id PK
  }
  ORDER {
    int id PK
  }`, { format: 'svg' });
    expect(result.svg).toContain('<svg');
  });
});

describe('AC7 — multiple relationships per entity pair', () => {
  it('keeps multiple edges between the same entities', () => {
    const doc = parseErDiagram(`erDiagram
  USER ||--o{ ORDER : places
  USER ||--o{ ORDER : reviews`);
    expect(doc.relationships).toHaveLength(2);
    expect(doc.relationships[1]!.label).toBe('reviews');
  });

  it('preserves declaration order for repeated pairs', () => {
    const doc = parseErDiagram(`erDiagram
  USER ||--o{ ORDER : places
  USER ||--o{ ORDER : follows
  USER ||--o{ ORDER : audits`);
    expect(doc.relationships.map((relationship) => relationship.label)).toEqual(['places', 'follows', 'audits']);
  });

  it('renders repeated pairs without crashing', () => {
    const result = renderMermaid(`erDiagram
  USER ||--o{ ORDER : places
  USER ||--o{ ORDER : reviews`, { format: 'svg' });
    expect(result.svg).toContain('<svg');
  });
});

describe('AC8 — whitespace variants', () => {
  it('parses compact relationship syntax', () => {
    const doc = parseErDiagram('erDiagram\nA||--o{B:places');
    expect(doc.relationships[0]).toMatchObject({ entityA: 'A', entityB: 'B' });
  });

  it('parses spaced relationship syntax', () => {
    const doc = parseErDiagram('erDiagram\n  A  ||--o{  B  :  places');
    expect(doc.relationships[0]).toMatchObject({ entityA: 'A', entityB: 'B' });
  });

  it('parses inline entity blocks with semicolon-separated attributes', () => {
    const doc = parseErDiagram('erDiagram\n  USER { int id PK; string email }');
    expect(doc.entities[0]!.attributes).toHaveLength(2);
  });

  it('ignores Mermaid %% comments via preprocess', () => {
    const doc = parseErDiagram(`erDiagram
  %% comment
  A ||--o{ B : places
  %% another
  A { int id PK }
  B { int id PK }`);
    expect(doc.relationships).toHaveLength(1);
    expect(doc.entities).toHaveLength(2);
  });
});

describe('AC9 — attribute comments (quoted strings)', () => {
  it('parses quoted attribute comments', () => {
    const doc = parseErDiagram(`erDiagram
  USER {
    string email "login address"
  }`);
    expect(doc.entities[0]!.attributes[0]!.comment).toBe('login address');
  });

  it('parses attributes without comments', () => {
    const doc = parseErDiagram(`erDiagram
  USER {
    string email
  }`);
    expect(doc.entities[0]!.attributes[0]!.comment).toBeUndefined();
  });

  it('warns on malformed attribute rows', () => {
    const { warnings } = parseErDiagramInternal(`erDiagram
  USER {
    broken
  }`);
    expect(warnings.some((warning) => /Could not parse ER attribute/i.test(warning))).toBe(true);
  });
});

describe('AC10 — real Mermaid crawl samples', () => {
  it('parses a customer/order schema', () => {
    const doc = parseErDiagram(BASIC_SAMPLE);
    expect(doc.entities.map((entity) => entity.name)).toContain('CUSTOMER');
    expect(doc.relationships[0]!.label).toBe('places');
  });

  it('parses all four cardinalities in a combined sample', () => {
    const doc = parseErDiagram(CARDINALITY_SAMPLE);
    expect(doc.relationships.map((relationship) => relationship.cardinalityA)).toEqual([
      'zero-or-one',
      'exactly-one',
      'zero-or-many',
      'exactly-one',
    ]);
  });

  it('parses a non-identifying user/session schema', () => {
    const doc = parseErDiagram(NON_IDENTIFYING_SAMPLE);
    expect(doc.relationships[0]).toMatchObject({ identifying: false, label: 'opens' });
  });

  it('parses an e-commerce schema with line items and products', () => {
    const doc = parseErDiagram(ECOMMERCE_SAMPLE);
    expect(doc.entities.length).toBeGreaterThan(4);
    expect(doc.relationships.length).toBeGreaterThan(4);
  });

  it('renders the e-commerce schema to PNG', () => {
    const result = renderMermaid(ECOMMERCE_SAMPLE, { format: 'png' });
    expect(result.kind).toBe('erDiagram');
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
  });
});

describe('AC11 — gallery emit', () => {
  it('mermaid-er.mmd exists', () => {
    expect(existsSync(ER_MMD)).toBe(true);
  });

  it('parses mermaid-er.mmd without error', () => {
    const text = readFileSync(ER_MMD, 'utf8');
    expect(() => parseErDiagram(text)).not.toThrow();
    const doc = parseErDiagram(text);
    expect(doc.entities.length).toBeGreaterThan(4);
    expect(doc.relationships.length).toBeGreaterThan(4);
  });

  it('emits mermaid-er.svg to examples/gallery/', () => {
    const text = readFileSync(ER_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('erDiagram');
    expect(result.svg).toContain('<svg');
    const outPath = join(GALLERY, 'mermaid-er.svg');
    writeFileSync(outPath, result.svg!, 'utf8');
    expect(statSync(outPath).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-er.png to examples/gallery/', () => {
    const text = readFileSync(ER_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    expect(result.png).toBeDefined();
    const outPath = join(GALLERY, 'mermaid-er.png');
    writeFileSync(outPath, result.png!);
    expect(statSync(outPath).size).toBeGreaterThan(1000);
  });

  it('parseMermaid dispatches gallery erDiagram correctly', () => {
    const text = readFileSync(ER_MMD, 'utf8');
    const result = parseMermaid(text);
    expect(result.kind).toBe('erDiagram');
    expect('entities' in result.doc).toBe(true);
  });
});

describe('AC12 — determinism check', () => {
  it('parse twice yields identical JSON', () => {
    const a = parseErDiagram(ECOMMERCE_SAMPLE);
    const b = parseErDiagram(ECOMMERCE_SAMPLE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('sceneHash is stable across repeated renders', () => {
    const h1 = renderMermaid(ECOMMERCE_SAMPLE, { format: 'svg' }).sceneHash;
    const h2 = renderMermaid(ECOMMERCE_SAMPLE, { format: 'svg' }).sceneHash;
    expect(h1).toBe(h2);
  });

  it('surfaces warnings through parseMermaid for malformed attribute content', () => {
    const result = parseMermaid(`erDiagram
  USER {
    broken
  }`);
    expect(result.kind).toBe('erDiagram');
    expect(result.warnings.some((warning) => /Could not parse ER attribute/i.test(warning))).toBe(true);
  });
});
