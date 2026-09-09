import { describe, it, expect, vi } from 'vitest';

vi.mock('vscode', () => {
  class CompletionItem {
    label: string;
    kind?: number;
    insertText?: any;
    detail?: string;
    documentation?: any;
    sortText?: string;
    constructor(label: string, kind?: number) {
      this.label = label;
      this.kind = kind;
    }
  }

  class SnippetString {
    value: string;
    constructor(value: string) {
      this.value = value;
    }
  }

  class MarkdownString {
    value: string;
    constructor(value: string) {
      this.value = value;
    }
  }

  class Position {
    line: number;
    character: number;
    constructor(line: number, character: number) {
      this.line = line;
      this.character = character;
    }
  }

  const CompletionItemKind = {
    Text: 0,
    Method: 1,
    Function: 2,
    Constructor: 3,
    Field: 4,
    Variable: 5,
    Class: 6,
    Interface: 7,
    Module: 8,
    Property: 9,
    Unit: 10,
    Value: 11,
    Enum: 12,
    Keyword: 13,
    Snippet: 14,
    Color: 15,
    File: 16,
    Reference: 17,
    Folder: 18,
    EnumMember: 19,
    Constant: 20,
    Struct: 21,
    Event: 22,
    Operator: 23,
    TypeParameter: 24,
  };

  return {
    CompletionItem,
    SnippetString,
    MarkdownString,
    Position,
    CompletionItemKind,
    languages: {
      registerCompletionItemProvider: vi.fn(),
    },
  };
});

import * as vscode from 'vscode';
import { detect } from '../src/frontend/detect.js';
import {
  extractSymbols,
  analyzeDiagramContext,
  resolveDiagramBlock,
  isDiagramDocument,
} from '../extension/src/completion-context.js';
import {
  DIAGRAM_HEADERS,
  KIND_KEYWORDS,
  FLOWCHART_SHAPES,
} from '../extension/src/keywords.js';
import { TritonCompletionProvider } from '../extension/src/completion.js';

function mockDoc(text: string, languageId = 'triton', path = 'test.triton'): vscode.TextDocument {
  return {
    getText: () => text,
    languageId,
    uri: { path, toString: () => path } as any,
  } as vscode.TextDocument;
}

describe('Diagram Autocompletion Intelligence', () => {
  describe('DIAGRAM_HEADERS integrity', () => {
    it('round-trips all diagram headers through core detect() without drifting', () => {
      expect(DIAGRAM_HEADERS.length).toBeGreaterThanOrEqual(60);

      for (const h of DIAGRAM_HEADERS) {
        // e.g. "flowchart LR" or "sequenceDiagram"
        const probe = `${h.insert} sample`;
        const detected = detect(probe);
        expect(
          detected.diagramType,
          `Header '${h.insert}' must be recognized as kind '${h.kind}'`,
        ).toBe(h.kind);
      }
    });

    it('has keywords for all supported diagram kinds in KIND_KEYWORDS', () => {
      const allKinds = new Set(DIAGRAM_HEADERS.map((h) => h.kind));
      for (const kind of allKinds) {
        const entries = KIND_KEYWORDS[kind];
        expect(
          entries,
          `Diagram kind '${kind}' should have entries in KIND_KEYWORDS`,
        ).toBeDefined();
        expect(entries!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('extractSymbols', () => {
    it('extracts flowchart nodes, subgraphs, and edge endpoints', () => {
      const source = `flowchart LR
        client[Web Client] --> api[API Gateway]
        api -->|auth| auth_srv(Auth Service)
        subgraph backend [Backend Cluster]
          worker1 --> db[(Database)]
        end
        api --> worker1
      `;
      const symbols = extractSymbols('flowchart', source);
      const names = symbols.map((s) => s.name);

      expect(names).toContain('client');
      expect(names).toContain('api');
      expect(names).toContain('auth_srv');
      expect(names).toContain('backend');
      expect(names).toContain('worker1');
      expect(names).toContain('db');
    });

    it('extracts sequence diagram participants and actors', () => {
      const source = `sequenceDiagram
        autonumber
        actor User
        participant Client as Web Client
        participant Auth as Auth Service
        User->>Client: Login
        Client->>+Auth: Verify
        Auth-->>-Client: OK
      `;
      const symbols = extractSymbols('sequence', source);
      const names = symbols.map((s) => s.name);

      expect(names).toContain('User');
      expect(names).toContain('Client');
      expect(names).toContain('Auth');
    });

    it('extracts state diagram states and composite states', () => {
      const source = `stateDiagram-v2
        [*] --> Idle
        Idle --> Processing : start
        state Processing {
          [*] --> Step1
          Step1 --> Step2
        }
        Processing --> Done
        Done --> [*]
      `;
      const symbols = extractSymbols('state', source);
      const names = symbols.map((s) => s.name);

      expect(names).toContain('Idle');
      expect(names).toContain('Processing');
      expect(names).toContain('Step1');
      expect(names).toContain('Step2');
      expect(names).toContain('Done');
      expect(names).not.toContain('[*]');
    });

    it('extracts class diagram classes and relations', () => {
      const source = `classDiagram
        class Order {
          +String id
        }
        class Customer {
          +String name
        }
        Customer <|-- VIPCustomer
        Order *-- OrderItem
      `;
      const symbols = extractSymbols('class', source);
      const names = symbols.map((s) => s.name);

      expect(names).toContain('Order');
      expect(names).toContain('Customer');
      expect(names).toContain('VIPCustomer');
      expect(names).toContain('OrderItem');
    });

    it('extracts ER diagram entities', () => {
      const source = `erDiagram
        CUSTOMER ||--o{ ORDER : places
        CUSTOMER {
          string id PK
        }
        ORDER {
          int orderId PK
        }
      `;
      const symbols = extractSymbols('er', source);
      const names = symbols.map((s) => s.name);

      expect(names).toContain('CUSTOMER');
      expect(names).toContain('ORDER');
    });
  });

  describe('analyzeDiagramContext', () => {
    it('identifies header position on first line of an empty document', () => {
      const doc = mockDoc('');
      const block = resolveDiagramBlock(doc, new vscode.Position(0, 0))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(0, 0));

      expect(ctx.contextType).toBe('header');
    });

    it('identifies arrow-target context when typing after an arrow operator', () => {
      const text = `flowchart LR\n  start[Start] --> `;
      const doc = mockDoc(text);
      const block = resolveDiagramBlock(doc, new vscode.Position(1, 19))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(1, 19));

      expect(ctx.contextType).toBe('arrow-target');
      expect(ctx.symbols.map((s) => s.name)).toContain('start');
    });

    it('identifies arrow-target context with label: -->|yes| ', () => {
      const text = `flowchart LR\n  cond{Check} -->|yes| `;
      const doc = mockDoc(text);
      const block = resolveDiagramBlock(doc, new vscode.Position(1, 23))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(1, 23));

      expect(ctx.contextType).toBe('arrow-target');
      expect(ctx.symbols.map((s) => s.name)).toContain('cond');
    });

    it('identifies shape bracket context when typing node id with open bracket', () => {
      const text = `flowchart LR\n  myDb[(`;
      const doc = mockDoc(text);
      const block = resolveDiagramBlock(doc, new vscode.Position(1, 8))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(1, 8));

      expect(ctx.contextType).toBe('shape');
    });

    it('identifies frontmatter theme context', () => {
      const text = `---\ntitle: My Diagram\ntheme: \n---\nflowchart LR\n`;
      const doc = mockDoc(text);
      const block = resolveDiagramBlock(doc, new vscode.Position(2, 7))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(2, 7));

      expect(ctx.contextType).toBe('theme');
    });

    it('identifies icon trigger context ::icon(', () => {
      const text = `flowchart LR\n  srv[Server ::icon(`;
      const doc = mockDoc(text);
      const block = resolveDiagramBlock(doc, new vscode.Position(1, 20))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(1, 20));

      expect(ctx.contextType).toBe('icon');
    });

    it('detects nested sub-diagram in a poster cell', () => {
      const text = `poster "Dashboard"\n  columns 2\n  cell "Flow"\n    flowchart LR\n      a --> b\n  end\n`;
      const doc = mockDoc(text);
      const block = resolveDiagramBlock(doc, new vscode.Position(4, 13))!;
      const ctx = analyzeDiagramContext(block, new vscode.Position(4, 13));

      expect(ctx.diagramType).toBe('flowchart');
    });
  });

  describe('TritonCompletionProvider', () => {
    it('provides diagram headers at header line', () => {
      const provider = new TritonCompletionProvider();
      const doc = mockDoc('', 'triton', 'file.triton');
      const items = provider.provideCompletionItems(doc, new vscode.Position(0, 0));

      expect(items).toBeDefined();
      expect(items!.length).toBeGreaterThanOrEqual(60);
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('flowchart');
      expect(labels).toContain('sequenceDiagram');
      expect(labels).toContain('poster');
      expect(labels).toContain('bplustree');
    });

    it('offers defined symbols when completing after arrow in a .mmd file', () => {
      const text = `flowchart LR\n  client[Client] --> api[Gateway]\n  api --> `;
      const provider = new TritonCompletionProvider();
      const doc = mockDoc(text, 'mermaid', 'arch.mmd');
      const items = provider.provideCompletionItems(doc, new vscode.Position(2, 10));

      expect(items).toBeDefined();
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('client');
      expect(labels).toContain('api');
    });

    it('offers flowchart shapes when typing opening bracket', () => {
      const text = `flowchart LR\n  nodeA[`;
      const provider = new TritonCompletionProvider();
      const doc = mockDoc(text);
      const items = provider.provideCompletionItems(doc, new vscode.Position(1, 8));

      expect(items).toBeDefined();
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('[Rectangle]');
      expect(labels).toContain('[(Database)]');
      expect(labels).toContain('((Circle))');
      expect(labels).toContain('{{Hexagon}}');
    });

    it('offers theme presets in frontmatter', () => {
      const text = `---\ntheme: \n---\nflowchart LR\n`;
      const mockThemeRegistry: any = {
        customNames: () => ['my-corp-theme'],
      };
      const provider = new TritonCompletionProvider(mockThemeRegistry);
      const doc = mockDoc(text);
      const items = provider.provideCompletionItems(doc, new vscode.Position(1, 7));

      expect(items).toBeDefined();
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('default');
      expect(labels).toContain('executive');
      expect(labels).toContain('minimal');
      expect(labels).toContain('editorial-dark');
      expect(labels).toContain('my-corp-theme');
    });

    it('offers icons when typing ::icon(', () => {
      const text = `flowchart LR\n  srv[Server ::icon(`;
      const mockIconRegistry: any = {
        iconPacks: () =>
          new Map([
            ['lucide', { prefix: 'lucide', icons: { server: {}, database: {} } }],
          ]),
      };
      const provider = new TritonCompletionProvider(undefined, mockIconRegistry);
      const doc = mockDoc(text);
      const items = provider.provideCompletionItems(doc, new vscode.Position(1, 20));

      expect(items).toBeDefined();
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('lucide:server');
      expect(labels).toContain('lucide:database');
    });

    it('works inside Markdown ```mermaid fences', () => {
      const md = `# Title\n\n\`\`\`mermaid\nflowchart LR\n  api --> db\n\`\`\`\n`;
      const provider = new TritonCompletionProvider();
      const doc = mockDoc(md, 'markdown', 'doc.md');

      // Inside the fence on line 4
      const items = provider.provideCompletionItems(doc, new vscode.Position(4, 5));
      expect(items).toBeDefined();

      // Outside the fence on line 1
      const outside = provider.provideCompletionItems(doc, new vscode.Position(0, 2));
      expect(outside).toBeUndefined();
    });

    it('offers poster grid, cell, link, and animation keywords in a poster diagram', () => {
      const text = `poster "System Overview"\n  `;
      const provider = new TritonCompletionProvider();
      const doc = mockDoc(text);
      const items = provider.provideCompletionItems(doc, new vscode.Position(1, 2));

      expect(items).toBeDefined();
      const labels = items!.map((i) => i.label);
      expect(labels).toContain('columns');
      expect(labels).toContain('rows');
      expect(labels).toContain('link');
      expect(labels).toContain('trace');
      expect(labels).toContain('@anim:march');
      expect(labels).toContain('@orthogonal');
    });
  });
});
