/**
 * @file test/mermaid-c4-corpus.test.ts — Real-Mermaid C4 corpus validation.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { c4DocumentSchema, resolveC4Theme } from '../src/grammars/c4/index.js';
import type { C4Document } from '../src/grammars/c4/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseC4Diagram, parseC4DiagramInternal } from '../src/frontend/mermaid/c4.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const C4_MMD = join(GALLERY, 'mermaid-c4.mmd');
const C4_SVG = join(GALLERY, 'mermaid-c4.svg');
const C4_PNG = join(GALLERY, 'mermaid-c4.png');

const BASIC_CONTEXT = `C4Context
  Person(customer, "Customer", "Uses the banking system")
  System(banking, "Internet Banking System", "Allows customers to manage accounts")
  Rel(customer, banking, "Uses")`;

const CONTAINER_SAMPLE = `C4Container
  title Internet Banking Containers
  System_Boundary(s1, "Internet Banking System") {
    Container(web, "Web Application", "React", "Provides the customer interface")
    Container(api, "API Application", "Spring Boot", "Exposes banking capabilities")
    ContainerDb(db, "Accounts DB", "PostgreSQL", "Stores customer accounts")
  }
  Person(customer, "Customer")
  Rel(customer, web, "Uses")
  Rel(web, api, "Calls", "JSON/HTTPS")
  Rel(api, db, "Reads from and writes to", "JDBC")`;

const COMPONENT_SAMPLE = `C4Component
  Container_Boundary(c1, "API Application") {
    Component(ctrl, "Controller", "Express", "Routes HTTP requests")
    Component(service, "Account Service", "TypeScript", "Coordinates account logic")
    ComponentDb(repo, "Account Repository", "SQLite", "Persists account balances")
  }
  Rel(ctrl, service, "Uses")
  Rel(service, repo, "Reads/Writes")`;

const NESTED_BOUNDARY_SAMPLE = `C4Context
  Enterprise_Boundary(bank, "Bank") {
    System(core, "Core Banking")
    Boundary(team, "Payments Team") {
      Container(payments, "Payments API", "Node.js", "Runs the payment workflow")
      ContainerQueue(queue, "Payment Queue", "SQS", "Buffers payment jobs")
    }
  }
  Person(customer, "Customer")
  Rel(customer, payments, "Uses")`;

const ALL_ELEMENT_KINDS_SAMPLE = `C4Component
  Person(user, "User")
  Person_Ext(extUser, "External User")
  System(sys, "System")
  System_Ext(extSys, "External System")
  SystemDb(sysDb, "System DB", "Stores records")
  SystemDb_Ext(extSysDb, "External System DB", "Stores mirrored data")
  SystemQueue(sysQ, "System Queue", "Dispatches jobs")
  SystemQueue_Ext(extSysQ, "External Queue", "Receives notifications")
  Container(ctn, "Container", "Node.js", "Runs services")
  Container_Ext(extCtn, "External Container", "Go", "Integrates partner APIs")
  ContainerDb(ctnDb, "Container DB", "PostgreSQL", "Stores app data")
  ContainerDb_Ext(extCtnDb, "External Container DB", "Oracle", "Partner-owned DB")
  ContainerQueue(ctnQ, "Container Queue", "SQS", "Queues container jobs")
  ContainerQueue_Ext(extCtnQ, "External Container Queue", "Kafka", "Partner event stream")
  Component(cmp, "Component", "TypeScript", "Coordinates requests")
  Component_Ext(extCmp, "External Component", "Java", "Runs in a partner service")
  ComponentDb(cmpDb, "Component DB", "SQLite", "Local cache")
  ComponentDb_Ext(extCmpDb, "External Component DB", "Redis", "Remote cache")
  ComponentQueue(cmpQ, "Component Queue", "NATS", "Async work")
  ComponentQueue_Ext(extCmpQ, "External Component Queue", "RabbitMQ", "Cross-system queue")`;

const REL_KINDS_SAMPLE = `C4Context
  Person(a, "A")
  System(b, "B")
  System(c, "C")
  System(d, "D")
  System(e, "E")
  System(f, "F")
  System(g, "G")
  Rel(a, b, "Rel")
  BiRel(b, c, "Bi")
  Rel_U(c, d, "Up")
  Rel_D(d, e, "Down")
  Rel_L(e, f, "Left")
  Rel_R(f, g, "Right")
  Rel_Back(g, a, "Back")`;

const DYNAMIC_SAMPLE = `C4Dynamic
  Person(customer, "Customer")
  Container(app, "Web App", "Next.js", "Serves pages")
  Container(api, "API", "NestJS", "Handles requests")
  ContainerDb(db, "DB", "PostgreSQL", "Stores accounts")
  Rel(1, customer, app, "Submits login")
  Rel(2, app, api, "Calls authentication", "HTTPS")
  Rel(3, api, db, "Loads account")`;

const DEPLOYMENT_SAMPLE = `C4Deployment
  Deployment_Node(dc, "Primary DC", "AWS eu-west-1") {
    Deployment_Node(k8s, "Kubernetes Cluster", "EKS") {
      Container(api, "API", "Node.js", "Handles API traffic")
      ContainerDb(db, "Database", "PostgreSQL", "Stores application data")
    }
  }
  Rel(api, db, "Reads/Writes")`;

const QUOTED_SAMPLE = `C4Container
  Container(api, "API, Public", "Node.js, Express", "Handles login, payments, and transfers")
  ContainerDb(db, "Accounts DB", "PostgreSQL", "Stores balances, ledgers, and profiles")
  Rel(api, db, "Reads, writes, and reconciles", "SQL, JDBC")`;

const STYLES_SAMPLE = `C4Context
  Person(customer, "Customer")
  System(sys, "Banking System")
  UpdateElementStyle(customer, $fontColor="red")
  UpdateRelStyle(customer, sys, $textColor="blue")
  UpdateBoundaryStyle(sys, $bgColor="#fff")
  UpdateLayoutConfig($c4ShapeInRow="2")
  Rel(customer, sys, "Uses")`;

const INTERNET_BANKING_SAMPLE = `C4Context
  title System Context diagram for Internet Banking System
  Enterprise_Boundary(b0, "BankBoundary0") {
    Person(customerA, "Banking Customer A", "A customer of the bank, with personal bank accounts.")
    Person(customerB, "Banking Customer B")
    Person_Ext(customerC, "Banking Customer C", "desc")
    System(SystemAA, "Internet Banking System", "Allows customers to view information about their bank accounts, and make payments.")
    Boundary(b1, "BankBoundary") {
      System(SystemC, "Email System", "The internal Microsoft Exchange e-mail system.")
      System_Ext(SystemE, "Mainframe Banking System", "Stores all of the core banking information about customers, accounts, transactions, etc.")
    }
  }
  Person_Ext(customerD, "Banking Customer D", "A customer of the bank, <br/> with personal bank accounts.")
  System_Ext(SystemF, "Authentication Provider", "The external Authentication Provider, Okta.")
  Rel(customerA, SystemAA, "Uses")
  Rel(customerB, SystemAA, "Uses")
  Rel(customerC, SystemAA, "Uses")
  Rel(SystemAA, SystemC, "Sends e-mails", "SMTP")
  Rel(SystemAA, SystemE, "Uses")
  Rel_Ext(customerD, SystemF, "Authenticate", "REST")`;

describe('AC1 — empty and minimal C4 diagrams', () => {
  it('parses an empty C4Context document', () => {
    const doc = parseC4Diagram('C4Context');
    expect(doc.elements).toHaveLength(0);
    expect(doc.boundaries).toHaveLength(0);
    expect(doc.rels).toHaveLength(0);
  });

  it('parses a minimal single element document', () => {
    const doc = parseC4Diagram('C4Context\n  Person(user, "User")');
    expect(doc.elements).toHaveLength(1);
    expect(doc.elements[0]).toMatchObject({ alias: 'user', kind: 'Person', label: 'User' });
  });

  it('renders a minimal single element document', () => {
    const result = renderMermaid('C4Context\n  Person(user, "User")', { format: 'svg' });
    expect(result.kind).toBe('c4Context');
    expect(result.svg).toContain('<svg');
  });
});

describe('AC2 — basic context, title, and dispatch', () => {
  it('parses a basic Person + System + Rel sample', () => {
    const doc = parseC4Diagram(BASIC_CONTEXT);
    expect(doc.elements).toHaveLength(2);
    expect(doc.rels[0]).toMatchObject({ from: 'customer', to: 'banking', label: 'Uses' });
  });

  it('captures the title directive in metadata', () => {
    const doc = parseC4Diagram(CONTAINER_SAMPLE);
    expect(doc.metadata.title).toBe('Internet Banking Containers');
  });

  it('detects c4Context and c4Dynamic headers', () => {
    expect(detectDiagramType(BASIC_CONTEXT)).toBe('c4Context');
    expect(detectDiagramType(DYNAMIC_SAMPLE)).toBe('c4Dynamic');
  });

  it('parseMermaid dispatches to the C4 parser', () => {
    const result = parseMermaid(BASIC_CONTEXT);
    expect(result.kind).toBe('c4Context');
    expect((result.doc as C4Document).rels).toHaveLength(1);
  });

  it('renderMermaid dispatches to the C4 renderer for PNG', () => {
    const result = renderMermaid(BASIC_CONTEXT, { format: 'png' });
    expect(result.kind).toBe('c4Context');
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
  });
});

describe('AC3 — boundaries and nesting', () => {
  it('parses a System_Boundary containing containers', () => {
    const doc = parseC4Diagram(CONTAINER_SAMPLE);
    expect(doc.boundaries).toHaveLength(1);
    expect(doc.boundaries[0]!.boundaryKind).toBe('System_Boundary');
    expect(doc.boundaries[0]!.children).toHaveLength(3);
  });

  it('parses a Container_Boundary containing components', () => {
    const doc = parseC4Diagram(COMPONENT_SAMPLE);
    expect(doc.boundaries[0]!.boundaryKind).toBe('Container_Boundary');
    expect(doc.boundaries[0]!.children).toHaveLength(3);
  });

  it('supports nested boundaries two levels deep', () => {
    const doc = parseC4Diagram(NESTED_BOUNDARY_SAMPLE);
    const outer = doc.boundaries[0]!;
    expect(outer.children.some((child) => 'boundaryKind' in child)).toBe(true);
    const inner = outer.children.find((child): child is Extract<typeof child, { boundaryKind: string }> => 'boundaryKind' in child);
    expect(inner?.children).toHaveLength(2);
  });

  it('keeps boundary aliases available for schema validation', () => {
    const doc = parseC4Diagram(`C4Context
  Boundary(team, "Team") {
    System(api, "API")
  }
  Rel(team, api, "Contains")`);
    expect(() => c4DocumentSchema.parse(doc)).not.toThrow();
  });

  it('warns on unmatched closing braces', () => {
    const { warnings } = parseC4DiagramInternal('C4Context\n  }');
    expect(warnings.some((warning) => /Unmatched C4 boundary closing brace/i.test(warning))).toBe(true);
  });
});

describe('AC4 — all element kinds and styling categories', () => {
  it('parses all supported C4 element kinds', () => {
    const doc = parseC4Diagram(ALL_ELEMENT_KINDS_SAMPLE);
    expect(doc.elements.map((element) => element.kind)).toEqual([
      'Person', 'Person_Ext',
      'System', 'System_Ext', 'SystemDb', 'SystemDb_Ext', 'SystemQueue', 'SystemQueue_Ext',
      'Container', 'Container_Ext', 'ContainerDb', 'ContainerDb_Ext', 'ContainerQueue', 'ContainerQueue_Ext',
      'Component', 'Component_Ext', 'ComponentDb', 'ComponentDb_Ext', 'ComponentQueue', 'ComponentQueue_Ext',
    ]);
  });

  it('applies extFill to external elements', () => {
    const result = renderMermaid(`C4Context
  Person_Ext(ext, "External Person")
  System_Ext(sys, "External System")`, { format: 'svg' });
    const theme = resolveC4Theme('default-c4');
    const extRects = result.scene.primitives.filter(
      (primitive) => primitive.kind === 'rect' && primitive.fill === theme.extFill,
    );
    expect(extRects.length).toBeGreaterThanOrEqual(2);
  });

  it('renders database variants with extra path primitives', () => {
    const result = renderMermaid(`C4Container
  ContainerDb(db, "DB", "PostgreSQL", "Stores rows")`, { format: 'svg' });
    const arcPaths = result.scene.primitives.filter((primitive) => primitive.kind === 'path');
    expect(arcPaths.length).toBeGreaterThan(0);
  });

  it('renders queue variants without dropping them', () => {
    const doc = parseC4Diagram(`C4Container
  ContainerQueue(q, "Jobs", "SQS", "Buffers work")`);
    expect(doc.elements[0]).toMatchObject({ kind: 'ContainerQueue', alias: 'q' });
  });
});

describe('AC5 — relationship kinds and numbered dynamic rels', () => {
  it('parses all relationship kinds', () => {
    const doc = parseC4Diagram(REL_KINDS_SAMPLE);
    expect(doc.rels.map((rel) => rel.kind)).toEqual(['Rel', 'BiRel', 'Rel_U', 'Rel_D', 'Rel_L', 'Rel_R', 'Rel_Back']);
  });

  it('swaps from/to for Rel_Back', () => {
    const doc = parseC4Diagram(REL_KINDS_SAMPLE);
    expect(doc.rels[6]).toMatchObject({ from: 'a', to: 'g', label: 'Back' });
  });

  it('warns once for directional relationship hints', () => {
    const { warnings } = parseC4DiagramInternal(REL_KINDS_SAMPLE);
    expect(warnings.some((warning) => /directional C4 relationship hints/i.test(warning))).toBe(true);
  });

  it('parses numbered dynamic relationships with order', () => {
    const doc = parseC4Diagram(DYNAMIC_SAMPLE);
    expect(doc.metadata.diagramKind).toBe('C4Dynamic');
    expect(doc.rels.map((rel) => rel.order)).toEqual([1, 2, 3]);
  });

  it('keeps dynamic relationship technologies', () => {
    const doc = parseC4Diagram(DYNAMIC_SAMPLE);
    expect(doc.rels[1]).toMatchObject({ technology: 'HTTPS' });
  });

  it('renders all relationship kinds without dropping edges', () => {
    const result = renderMermaid(REL_KINDS_SAMPLE, { format: 'svg' });
    const lineLike = result.scene.primitives.filter((primitive) => primitive.kind === 'line' || primitive.kind === 'path');
    expect(lineLike.length).toBeGreaterThanOrEqual(7);
  });
});

describe('AC6 — technologies, quoted args, and ignored directives', () => {
  it('parses technology args on Container and Component kinds', () => {
    const doc = parseC4Diagram(`C4Component
  Container(api, "API", "Node.js", "Serves requests")
  Component(service, "Service", "TypeScript", "Handles logic")`);
    expect(doc.elements[0]).toMatchObject({ technology: 'Node.js' });
    expect(doc.elements[1]).toMatchObject({ technology: 'TypeScript' });
  });

  it('handles quoted args with commas inside', () => {
    const doc = parseC4Diagram(QUOTED_SAMPLE);
    expect(doc.elements[0]).toMatchObject({ label: 'API, Public', technology: 'Node.js, Express' });
    expect(doc.rels[0]).toMatchObject({ label: 'Reads, writes, and reconciles', technology: 'SQL, JDBC' });
  });

  it('ignores named args starting with $', () => {
    const doc = parseC4Diagram(`C4Context
  Person(customer, "Customer", $tags="external", "Uses portal")`);
    expect(doc.elements[0]).toMatchObject({ alias: 'customer', description: 'Uses portal' });
  });

  it('ignores Update* style directives with no warnings', () => {
    const { warnings } = parseC4DiagramInternal(STYLES_SAMPLE);
    expect(warnings).toHaveLength(0);
  });
});

describe('AC7 — schema validation and determinism', () => {
  it('rejects duplicate aliases across elements and boundaries', () => {
    expect(() => c4DocumentSchema.parse(parseC4Diagram(`C4Context
  Person(a, "A")
  Boundary(a, "Dup") {
    System(b, "B")
  }`))).toThrow(/Duplicate C4 alias/i);
  });

  it('rejects relationships that reference missing aliases', () => {
    expect(() => c4DocumentSchema.parse(parseC4Diagram(`C4Context
  Person(a, "A")
  Rel(a, missing, "Uses")`))).toThrow(/unknown alias 'missing'/i);
  });

  it('renders deterministically across repeated calls', () => {
    const r1 = renderMermaid(CONTAINER_SAMPLE, { format: 'svg' });
    const r2 = renderMermaid(CONTAINER_SAMPLE, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });

  it('parses deterministically across repeated calls', () => {
    const a = parseC4Diagram(COMPONENT_SAMPLE);
    const b = parseC4Diagram(COMPONENT_SAMPLE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('AC8 — frontmatter, deployment, and warnings', () => {
  it('preserves frontmatter theme metadata', () => {
    const doc = parseC4Diagram(`---
theme: dark-c4
---
C4Context
  Person(user, "User")`);
    expect(doc.metadata.theme).toBe('dark-c4');
  });

  it('applies frontmatter theme overrides during render', () => {
    const result = renderMermaid(`---
theme: dark-c4
---
C4Context
  Person(user, "User")`, { format: 'svg' });
    expect(result.doc.metadata.theme).toBe('dark-c4');
    expect(result.scene.background).toBe(resolveC4Theme('dark-c4').background);
  });

  it('approximates Deployment_Node as a boundary with a warning', () => {
    const { doc, warnings } = parseC4DiagramInternal(DEPLOYMENT_SAMPLE);
    expect(doc.metadata.diagramKind).toBe('C4Deployment');
    expect(doc.boundaries).toHaveLength(1);
    expect(warnings.some((warning) => /Deployment_Node/i.test(warning))).toBe(true);
  });

  it('surfaces Rel_Ext as a warning while parsing it as Rel', () => {
    const { doc, warnings } = parseC4DiagramInternal(INTERNET_BANKING_SAMPLE);
    expect(doc.rels[doc.rels.length - 1]).toMatchObject({ kind: 'Rel', from: 'customerD', to: 'SystemF' });
    expect(warnings.some((warning) => /Rel_Ext is treated as Rel/i.test(warning))).toBe(true);
  });

  it('renders a deployment sample after approximation', () => {
    const result = renderMermaid(DEPLOYMENT_SAMPLE, { format: 'svg' });
    expect(result.kind).toBe('c4Deployment');
    expect(result.svg).toContain('<svg');
  });
});

describe('AC9 — canonical internet banking corpus and scene checks', () => {
  it('parses the canonical Internet Banking sample', () => {
    const doc = parseC4Diagram(INTERNET_BANKING_SAMPLE);
    expect(doc.metadata.title).toBe('System Context diagram for Internet Banking System');
    expect(doc.boundaries).toHaveLength(1);
    expect(doc.rels).toHaveLength(6);
  });

  it('does not drop nested boundary children', () => {
    const doc = parseC4Diagram(INTERNET_BANKING_SAMPLE);
    const outer = doc.boundaries[0]!;
    expect(outer.children).toHaveLength(5);
    const inner = outer.children.find((child): child is Extract<typeof child, { boundaryKind: string }> => 'boundaryKind' in child);
    expect(inner?.children).toHaveLength(2);
  });

  it('renders at least one primary rect per element box', () => {
    const result = renderMermaid(INTERNET_BANKING_SAMPLE, { format: 'svg' });
    const rects = result.scene.primitives.filter(
      (primitive) => primitive.kind === 'rect' && primitive.width >= 120 && primitive.height >= 50,
    );
    expect(rects.length).toBeGreaterThanOrEqual(8);
  });

  it('keeps all top-level elements, boundaries, and rels', () => {
    const doc = parseC4Diagram(INTERNET_BANKING_SAMPLE);
    expect(doc.elements).toHaveLength(2);
    expect(doc.boundaries).toHaveLength(1);
    expect(doc.rels).toHaveLength(6);
  });

  it('produces non-empty scene dimensions', () => {
    const result = renderMermaid(INTERNET_BANKING_SAMPLE, { format: 'svg' });
    expect(result.scene.width).toBeGreaterThan(0);
    expect(result.scene.height).toBeGreaterThan(0);
  });
});

describe('AC10 — gallery assets', () => {
  it('mermaid-c4.mmd exists', () => {
    expect(existsSync(C4_MMD)).toBe(true);
  });

  it('parses mermaid-c4.mmd without error', () => {
    const text = readFileSync(C4_MMD, 'utf8');
    expect(() => parseC4Diagram(text)).not.toThrow();
    const doc = parseC4Diagram(text);
    expect(doc.boundaries.length).toBeGreaterThan(0);
    expect(doc.rels.length).toBeGreaterThan(4);
  });

  it('emits mermaid-c4.svg to examples/gallery/', () => {
    const text = readFileSync(C4_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('c4Context');
    writeFileSync(C4_SVG, result.svg!, 'utf8');
    expect(statSync(C4_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-c4.png to examples/gallery/', () => {
    const text = readFileSync(C4_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(C4_PNG, result.png!);
    expect(statSync(C4_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts gallery SVG and PNG exist and are non-empty', () => {
    expect(existsSync(C4_SVG)).toBe(true);
    expect(existsSync(C4_PNG)).toBe(true);
    expect(statSync(C4_SVG).size).toBeGreaterThan(1000);
    expect(statSync(C4_PNG).size).toBeGreaterThan(1000);
  });
});
