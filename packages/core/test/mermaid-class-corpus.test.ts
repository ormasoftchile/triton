/**
 * @file test/mermaid-class-corpus.test.ts — Real-Mermaid classDiagram corpus validation.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseClassDiagram, parseClassDiagramInternal } from '../src/frontend/mermaid/class.js';
import { parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const CLASS_MMD = join(GALLERY, 'mermaid-class.mmd');

const ANIMAL_SAMPLE = `classDiagram
  class Animal {
    +String name
    +int age
    +makeSound()
  }
  class Dog {
    +bark()
  }
  Animal <|-- Dog`;

const INTERFACE_SAMPLE = `classDiagram
  class Shape {
    <<interface>>
    +draw()
    +area() float
  }
  class Circle {
    +float radius
    +draw()
    +area() float
  }
  Shape <|.. Circle`;

const BANK_ACCOUNT_SAMPLE = `classDiagram
  class BankAccount {
    +String owner
    +float balance
    +deposit(float amount)
    +withdraw(float amount) bool
  }`;

const ORDER_SAMPLE = `classDiagram
  direction TB
  class Order {
    +int id
    +Date createdAt
  }
  class OrderItem {
    +int quantity
    +float price
  }
  Order *-- OrderItem : contains`;

const CAR_SAMPLE = `classDiagram
  class Car {
    +Engine engine
    +List~Wheel~ wheels
  }
  class Engine {
    +int cylinders
    +start()
  }
  Car *-- Engine
  Car o-- Wheel`;

describe('AC1 — empty class / name / stereotype', () => {
  it('parses bare empty class declaration', () => {
    const doc = parseClassDiagram('classDiagram\n  class Foo');
    expect(doc.classes).toHaveLength(1);
    expect(doc.classes[0]).toMatchObject({ id: 'foo', name: 'Foo' });
    expect(doc.classes[0]!.members).toHaveLength(0);
  });

  it('parses inline empty block', () => {
    const doc = parseClassDiagram('classDiagram\n  class Foo {}');
    expect(doc.classes[0]!.name).toBe('Foo');
    expect(doc.classes[0]!.members).toHaveLength(0);
  });

  it('preserves PascalCase name and sanitizes id', () => {
    const doc = parseClassDiagram('classDiagram\n  class BankAccount');
    expect(doc.classes[0]).toMatchObject({ id: 'bankaccount', name: 'BankAccount' });
  });

  it('parses stereotype-only class body', () => {
    const doc = parseClassDiagram('classDiagram\n  class Shape {\n    <<interface>>\n  }');
    expect(doc.classes[0]!.stereotype).toBe('<<interface>>');
  });

  it('accepts classDiagram-v2 header', () => {
    const doc = parseClassDiagram('classDiagram-v2\n  class Foo');
    expect(doc.classes[0]!.name).toBe('Foo');
  });

  it('supports frontmatter title/theme metadata', () => {
    const doc = parseClassDiagram('---\ntitle: Domain\ntheme: default-class\n---\nclassDiagram\n  class Foo');
    expect(doc.metadata.title).toBe('Domain');
    expect(doc.metadata.theme).toBe('default-class');
  });
});

describe('AC2 — class blocks and standalone members', () => {
  it('parses block attributes and methods', () => {
    const doc = parseClassDiagram(BANK_ACCOUNT_SAMPLE);
    const cls = doc.classes[0]!;
    expect(cls.members.filter((m) => !m.isMethod)).toHaveLength(2);
    expect(cls.members.filter((m) => m.isMethod)).toHaveLength(2);
  });

  it('parses standalone member assignment attribute', () => {
    const doc = parseClassDiagram('classDiagram\n  Foo : +int x');
    expect(doc.classes[0]!.members[0]).toMatchObject({ visibility: '+', name: 'x', type: 'int', isMethod: false });
  });

  it('parses standalone member assignment method', () => {
    const doc = parseClassDiagram('classDiagram\n  Foo : +bar()');
    expect(doc.classes[0]!.members[0]).toMatchObject({ visibility: '+', name: 'bar', isMethod: true });
  });

  it('mixes block and standalone member forms', () => {
    const doc = parseClassDiagram(`classDiagram
  class Foo {
    +int x
  }
  Foo : +bar()`);
    expect(doc.classes[0]!.members).toHaveLength(2);
    expect(doc.classes[0]!.members[1]!.isMethod).toBe(true);
  });

  it('parses one-line block syntax', () => {
    const doc = parseClassDiagram('classDiagram\n  class Foo { +int x }');
    expect(doc.classes[0]!.members[0]).toMatchObject({ name: 'x', type: 'int' });
  });

  it('updates existing class instead of duplicating it', () => {
    const doc = parseClassDiagram(`classDiagram
  class Foo
  Foo : +int x
  Foo : +bar()`);
    expect(doc.classes).toHaveLength(1);
    expect(doc.classes[0]!.members).toHaveLength(2);
  });
});

describe('AC3 — relationship kind mapping', () => {
  it('maps inheritance A <|-- B as B -> A', () => {
    const doc = parseClassDiagram(ANIMAL_SAMPLE);
    expect(doc.relationships[0]).toMatchObject({ from: 'dog', to: 'animal', kind: 'inheritance' });
  });

  it('maps inheritance A --|> B as A -> B', () => {
    const doc = parseClassDiagram('classDiagram\n  A --|> B');
    expect(doc.relationships[0]).toMatchObject({ from: 'a', to: 'b', kind: 'inheritance' });
  });

  it('maps realization Shape <|.. Circle as Circle -> Shape', () => {
    const doc = parseClassDiagram(INTERFACE_SAMPLE);
    expect(doc.relationships[0]).toMatchObject({ from: 'circle', to: 'shape', kind: 'realization' });
  });

  it('maps realization A ..|> B as A -> B', () => {
    const doc = parseClassDiagram('classDiagram\n  A ..|> B');
    expect(doc.relationships[0]).toMatchObject({ from: 'a', to: 'b', kind: 'realization' });
  });

  it('maps composition A *-- B as A -> B', () => {
    const doc = parseClassDiagram(ORDER_SAMPLE);
    expect(doc.relationships[0]).toMatchObject({ from: 'order', to: 'orderitem', kind: 'composition' });
  });

  it('maps reverse composition A --* B as B -> A', () => {
    const doc = parseClassDiagram('classDiagram\n  A --* B');
    expect(doc.relationships[0]).toMatchObject({ from: 'b', to: 'a', kind: 'composition' });
  });

  it('maps aggregation A o-- B as A -> B', () => {
    const doc = parseClassDiagram(CAR_SAMPLE);
    expect(doc.relationships[1]).toMatchObject({ from: 'car', to: 'wheel', kind: 'aggregation' });
  });

  it('maps reverse aggregation A --o B as B -> A', () => {
    const doc = parseClassDiagram('classDiagram\n  A --o B');
    expect(doc.relationships[0]).toMatchObject({ from: 'b', to: 'a', kind: 'aggregation' });
  });

  it('maps association arrows and undirected lines to association', () => {
    const directed = parseClassDiagram('classDiagram\n  A --> B');
    const undirected = parseClassDiagram('classDiagram\n  A -- B');
    expect(directed.relationships[0]!.kind).toBe('association');
    expect(undirected.relationships[0]!.kind).toBe('association');
  });

  it('maps dependency dashed arrow', () => {
    const doc = parseClassDiagram('classDiagram\n  A ..> B');
    expect(doc.relationships[0]).toMatchObject({ from: 'a', to: 'b', kind: 'dependency' });
  });
});

describe('AC4 — cardinalities and relationship labels', () => {
  it('parses both cardinality labels', () => {
    const doc = parseClassDiagram('classDiagram\n  Customer "1" --> "*" Order');
    expect(doc.relationships[0]).toMatchObject({ fromCardinality: '1', toCardinality: '*' });
  });

  it('parses only target cardinality', () => {
    const doc = parseClassDiagram('classDiagram\n  Order --> "*" Item');
    expect(doc.relationships[0]).toMatchObject({ toCardinality: '*' });
  });

  it('parses relationship label text after colon', () => {
    const doc = parseClassDiagram('classDiagram\n  Order *-- OrderItem : contains');
    expect(doc.relationships[0]!.label).toBe('contains');
  });

  it('swaps cardinalities for reverse-direction inheritance', () => {
    const doc = parseClassDiagram('classDiagram\n  Parent "1" <|-- "*" Child');
    expect(doc.relationships[0]).toMatchObject({ fromCardinality: '*', toCardinality: '1' });
  });

  it('keeps multi-word relationship labels', () => {
    const doc = parseClassDiagram('classDiagram\n  Cart --> Order : creates order draft');
    expect(doc.relationships[0]!.label).toBe('creates order draft');
  });
});

describe('AC5 — visibility, methods, attributes, modifiers', () => {
  it('parses all visibility symbols on attributes', () => {
    const doc = parseClassDiagram(`classDiagram
  class Foo {
    +String pub
    -String priv
    #String prot
    ~String pkg
  }`);
    expect(doc.classes[0]!.members.map((m) => m.visibility)).toEqual(['+', '-', '#', '~']);
  });

  it('distinguishes methods from attributes', () => {
    const doc = parseClassDiagram(`classDiagram
  class Foo {
    +String name
    +bar()
  }`);
    expect(doc.classes[0]!.members[0]!.isMethod).toBe(false);
    expect(doc.classes[0]!.members[1]!.isMethod).toBe(true);
  });

  it('parses trailing return type syntax', () => {
    const doc = parseClassDiagram('classDiagram\n  class Foo {\n    ~method() ReturnType\n  }');
    expect(doc.classes[0]!.members[0]).toMatchObject({ visibility: '~', name: 'method', isMethod: true, type: 'ReturnType' });
  });

  it('parses leading return type syntax for methods', () => {
    const doc = parseClassDiagram('classDiagram\n  class Foo {\n    +void method(int a)\n  }');
    expect(doc.classes[0]!.members[0]).toMatchObject({ visibility: '+', name: 'method', type: 'void', params: 'int a' });
  });

  it('parses static and abstract modifiers', () => {
    const doc = parseClassDiagram(`classDiagram
  class Foo {
    +make()*
    +cache()$
  }`);
    expect(doc.classes[0]!.members[0]!.modifiers).toEqual(['abstract']);
    expect(doc.classes[0]!.members[1]!.modifiers).toEqual(['static']);
  });
});

describe('AC6 — generics, namespaces, comments', () => {
  it('strips generic suffixes from class names with warning', () => {
    const { doc, warnings } = parseClassDiagramInternal('classDiagram\n  class List~T~');
    expect(doc.classes[0]).toMatchObject({ name: 'List', id: 'list' });
    expect(warnings.some((w) => /Generic class name/.test(w))).toBe(true);
  });

  it('normalizes generic member types to angle-bracket form', () => {
    const doc = parseClassDiagram(CAR_SAMPLE);
    expect(doc.classes[0]!.members[1]).toMatchObject({ name: 'wheels', type: 'List<Wheel>' });
  });

  it('flattens multi-line namespaces', () => {
    const doc = parseClassDiagram(`classDiagram
  namespace Billing {
    class Invoice {}
    class Payment {}
  }
  Invoice --> Payment`);
    expect(doc.classes.map((c) => c.name)).toEqual(['Invoice', 'Payment']);
    expect(doc.relationships[0]).toMatchObject({ from: 'invoice', to: 'payment' });
  });

  it('flattens one-line namespace wrappers', () => {
    const doc = parseClassDiagram('classDiagram\n  namespace Ns { class Foo {} }');
    expect(doc.classes[0]!.name).toBe('Foo');
  });

  it('skips %% comments via preprocess', () => {
    const doc = parseClassDiagram(`classDiagram
  %% comment
  class Foo
  %% another comment
  class Bar
  Foo --> Bar`);
    expect(doc.classes).toHaveLength(2);
    expect(doc.relationships).toHaveLength(1);
  });
});

describe('AC7 — graceful degradation and warnings', () => {
  it('warns on unknown lines without crashing', () => {
    const { doc, warnings } = parseClassDiagramInternal(`classDiagram
  ???
  class Foo
  Foo --> Bar`);
    expect(doc.classes.map((c) => c.name)).toEqual(['Foo', 'Bar']);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('warns for direction but still parses the diagram', () => {
    const { doc, warnings } = parseClassDiagramInternal(ORDER_SAMPLE);
    expect(doc.relationships[0]!.kind).toBe('composition');
    expect(warnings.some((w) => /direction/.test(w))).toBe(true);
  });

  it('warns for invalid member content in class body', () => {
    const { warnings } = parseClassDiagramInternal(`classDiagram
  class Foo {
    ???
    +bar()
  }`);
    expect(warnings.some((w) => /Could not parse class member/.test(w))).toBe(true);
  });

  it('warns for malformed class declaration suffix', () => {
    const { warnings } = parseClassDiagramInternal('classDiagram\n  class Foo extends Bar');
    expect(warnings.some((w) => /suffix skipped/.test(w))).toBe(true);
  });

  it('parseMermaid surfaces warnings array for classDiagram', () => {
    const result = parseMermaid('classDiagram\n  direction TB\n  class Foo');
    expect(result.kind).toBe('classDiagram');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.some((w) => /direction/.test(w))).toBe(true);
  });
});

describe('AC8 — renderMermaid full-stack', () => {
  it('renders classDiagram to SVG with non-zero scene dimensions', () => {
    const result = renderMermaid(ANIMAL_SAMPLE, { format: 'svg' });
    expect(result.kind).toBe('classDiagram');
    expect(result.svg).toContain('<svg');
    expect(result.scene.width).toBeGreaterThan(0);
    expect(result.scene.height).toBeGreaterThan(0);
  });

  it('renders classDiagram to PNG', () => {
    const result = renderMermaid(INTERFACE_SAMPLE, { format: 'png' });
    expect(result.kind).toBe('classDiagram');
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
  });

  it('parseMermaid dispatches to classDiagram parser', () => {
    const result = parseMermaid(BANK_ACCOUNT_SAMPLE);
    expect(result.kind).toBe('classDiagram');
    expect('classes' in result.doc).toBe(true);
  });

  it('sceneHash is stable across repeated renders', () => {
    const h1 = renderMermaid(ORDER_SAMPLE, { format: 'svg' }).sceneHash;
    const h2 = renderMermaid(ORDER_SAMPLE, { format: 'svg' }).sceneHash;
    expect(h1).toBe(h2);
  });
});

describe('Gallery emit — mermaid-class', () => {
  it('mermaid-class.mmd exists', () => {
    expect(existsSync(CLASS_MMD)).toBe(true);
  });

  it('parses mermaid-class.mmd without error', () => {
    const text = readFileSync(CLASS_MMD, 'utf8');
    expect(() => parseClassDiagram(text)).not.toThrow();
    const doc = parseClassDiagram(text);
    expect(doc.classes.length).toBeGreaterThan(5);
    expect(doc.relationships.length).toBeGreaterThan(5);
  });

  it('emits mermaid-class.svg to examples/gallery/', () => {
    const text = readFileSync(CLASS_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.svg).toContain('<svg');
    const outPath = join(GALLERY, 'mermaid-class.svg');
    writeFileSync(outPath, result.svg!, 'utf8');
    expect(statSync(outPath).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-class.png to examples/gallery/', () => {
    const text = readFileSync(CLASS_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    expect(result.png).toBeDefined();
    const outPath = join(GALLERY, 'mermaid-class.png');
    writeFileSync(outPath, result.png!);
    expect(statSync(outPath).size).toBeGreaterThan(1000);
  });

  it('gallery renders are deterministic', () => {
    const text = readFileSync(CLASS_MMD, 'utf8');
    const r1 = renderMermaid(text, { format: 'svg' });
    const r2 = renderMermaid(text, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });
});

describe('Real Mermaid crawl snippets', () => {
  it('parses Animal/Dog inheritance sample', () => {
    const doc = parseClassDiagram(ANIMAL_SAMPLE);
    expect(doc.classes).toHaveLength(2);
    expect(doc.relationships[0]!.kind).toBe('inheritance');
  });

  it('parses interface/realization sample', () => {
    const doc = parseClassDiagram(INTERFACE_SAMPLE);
    expect(doc.classes[0]!.stereotype).toBe('<<interface>>');
    expect(doc.relationships[0]!.kind).toBe('realization');
  });

  it('parses BankAccount member signatures', () => {
    const doc = parseClassDiagram(BANK_ACCOUNT_SAMPLE);
    expect(doc.classes[0]!.members[2]).toMatchObject({ name: 'deposit', isMethod: true });
    expect(doc.classes[0]!.members[3]).toMatchObject({ name: 'withdraw', type: 'bool' });
  });

  it('parses direction TB + composition sample', () => {
    const { doc, warnings } = parseClassDiagramInternal(ORDER_SAMPLE);
    expect(doc.relationships[0]!.label).toBe('contains');
    expect(warnings.some((w) => /direction/.test(w))).toBe(true);
  });

  it('parses generics + composition/aggregation sample', () => {
    const doc = parseClassDiagram(CAR_SAMPLE);
    expect(doc.classes.map((c) => c.name)).toContain('Wheel');
    expect(doc.relationships.map((r) => r.kind)).toEqual(['composition', 'aggregation']);
  });
});
