/**
 * @file test/mermaid-sequence-corpus.test.ts — Real-Mermaid sequence corpus validation.
 *
 * Crawl-derived acceptance tests for the Mermaid sequenceDiagram parser.
 * Covers all arrow types, participant/actor declarations, activation shorthand,
 * loop/alt/opt/par fragments, self-messages, autonumber, and note degradation.
 *
 * Acceptance criteria (fidelity bar mirrors flowchart corpus):
 *   AC1  All eight arrow operators parsed to correct Message.kind
 *   AC2  Participant / actor declarations (with and without alias)
 *   AC3  Auto-registration of participants from messages
 *   AC4  Activation shorthand (+/-) and explicit activate/deactivate
 *   AC5  Fragments: loop, opt, alt+else, par+and with sections
 *   AC6  Self-messages (from === to)
 *   AC7  Graceful degradation: autonumber warns; note warns; unknown warns
 *   AC8  Determinism: parse twice → identical JSON; render twice → identical sceneHash
 *   AC9  Gallery emit: render mermaid-sequence.mmd → .svg and .png files
 *   AC10 Public warnings surface correctly (parseMermaid returns warnings[])
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  parseMermaid,
  renderMermaid,
} from '../src/frontend/mermaid/index.js';
import { parseSequence, parseSequenceInternal } from '../src/frontend/mermaid/sequence.js';
import type { SequenceDocument } from '../src/grammars/sequence/types.js';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY_DIR = join(REPO_ROOT, 'examples', 'gallery');
const SEQ_MMD_FILE = join(GALLERY_DIR, 'mermaid-sequence.mmd');

// ---------------------------------------------------------------------------
// Helper to cast doc to SequenceDocument (after kind-check)
// ---------------------------------------------------------------------------

function asSeq(text: string): SequenceDocument {
  return parseSequence(text);
}

// ---------------------------------------------------------------------------
// AC1 — All eight arrow operators → correct Message.kind
// ---------------------------------------------------------------------------

describe('AC1 — arrow operators → Message.kind', () => {
  it('->> (solid arrowhead) → sync', () => {
    const doc = asSeq('sequenceDiagram\n  A->>B: msg');
    expect(doc.sequence.messages[0]?.kind).toBe('sync');
  });

  it('-->> (dashed arrowhead) → reply', () => {
    const doc = asSeq('sequenceDiagram\n  A-->>B: reply');
    expect(doc.sequence.messages[0]?.kind).toBe('reply');
  });

  it('-> (solid open) → sync', () => {
    const doc = asSeq('sequenceDiagram\n  A->B: msg');
    expect(doc.sequence.messages[0]?.kind).toBe('sync');
  });

  it('--> (dashed open) → reply', () => {
    const doc = asSeq('sequenceDiagram\n  A-->B: msg');
    expect(doc.sequence.messages[0]?.kind).toBe('reply');
  });

  it('-) (solid open circle) → async', () => {
    const doc = asSeq('sequenceDiagram\n  A-)B: async msg');
    expect(doc.sequence.messages[0]?.kind).toBe('async');
  });

  it('--) (dashed open circle) → async', () => {
    const doc = asSeq('sequenceDiagram\n  A--)B: async msg');
    expect(doc.sequence.messages[0]?.kind).toBe('async');
  });

  it('-x (solid cross) → async', () => {
    const doc = asSeq('sequenceDiagram\n  A-xB: fail');
    expect(doc.sequence.messages[0]?.kind).toBe('async');
  });

  it('--x (dashed cross) → async', () => {
    const doc = asSeq('sequenceDiagram\n  A--xB: fail');
    expect(doc.sequence.messages[0]?.kind).toBe('async');
  });

  it('all eight operators in one diagram — 8 messages, correct kinds', () => {
    const text = `sequenceDiagram
      A->>B: sync solid
      A-->>B: reply dashed
      A->B: sync open
      A-->B: reply open
      A-)B: async circle
      A--)B: async dashed circle
      A-xB: async cross
      A--xB: async dashed cross`;
    const doc = asSeq(text);
    expect(doc.sequence.messages).toHaveLength(8);
    const kinds = doc.sequence.messages.map((m) => m.kind);
    expect(kinds).toEqual(['sync', 'reply', 'sync', 'reply', 'async', 'async', 'async', 'async']);
  });

  it('whitespace-independent: compact A->>B and spaced A ->> B produce identical kinds', () => {
    const compact = asSeq('sequenceDiagram\n  A->>B: msg');
    const spaced  = asSeq('sequenceDiagram\n  A ->> B: msg');
    expect(compact.sequence.messages[0]?.kind).toBe(spaced.sequence.messages[0]?.kind);
    expect(compact.sequence.messages[0]?.label).toBe(spaced.sequence.messages[0]?.label);
  });
});

// ---------------------------------------------------------------------------
// AC2 — Participant / actor declarations
// ---------------------------------------------------------------------------

describe('AC2 — participant / actor declarations', () => {
  it('participant A as Alice → label Alice, kind object', () => {
    const doc = asSeq('sequenceDiagram\n  participant A as Alice\n  A->>A: self');
    const p = doc.sequence.participants.find((x) => x.label === 'Alice');
    expect(p).toBeDefined();
    expect(p?.kind).toBe('object');
  });

  it('participant A (no alias) → label matches raw ID', () => {
    const doc = asSeq('sequenceDiagram\n  participant MyService\n  MyService->>MyService: loop');
    const p = doc.sequence.participants.find((x) => x.id === 'my-service');
    expect(p).toBeDefined();
    expect(p?.label).toBe('MyService');
  });

  it('actor A as Bob → kind actor, label Bob', () => {
    const doc = asSeq('sequenceDiagram\n  actor User as Bob\n  User->>Server: call');
    const p = doc.sequence.participants.find((x) => x.kind === 'actor');
    expect(p).toBeDefined();
    expect(p?.label).toBe('Bob');
  });

  it('actor without alias → kind actor', () => {
    const doc = asSeq('sequenceDiagram\n  actor Admin\n  Admin->>API: request');
    const p = doc.sequence.participants.find((x) => x.id === 'admin');
    expect(p?.kind).toBe('actor');
  });

  it('mixed participant + actor in first-declaration order', () => {
    const text = `sequenceDiagram
      actor User
      participant Server
      participant DB as Database`;
    const doc = asSeq(text + '\n  User->>Server: call');
    const ids = doc.sequence.participants.map((p) => p.id);
    expect(ids[0]).toBe('user');
    expect(ids[1]).toBe('server');
    expect(ids[2]).toBe('db');
  });

  it('participant declared AFTER use → label/kind updated, order retained from first-use', () => {
    const text = `sequenceDiagram
      Auth->>Client: token
      participant Auth as Auth Service`;
    const doc = asSeq(text);
    const p = doc.sequence.participants.find((x) => x.id === 'auth');
    expect(p?.label).toBe('Auth Service');
  });
});

// ---------------------------------------------------------------------------
// AC3 — Auto-registration from messages
// ---------------------------------------------------------------------------

describe('AC3 — auto-registration from messages', () => {
  it('participants not declared appear in first-use order', () => {
    const doc = asSeq('sequenceDiagram\n  Alice->>Bob: hello\n  Bob-->>Alice: hi');
    const ids = doc.sequence.participants.map((p) => p.id);
    expect(ids).toContain('alice');
    expect(ids).toContain('bob');
    // Alice appears first in messages
    expect(ids.indexOf('alice')).toBeLessThan(ids.indexOf('bob'));
  });

  it('duplicate message participants are not duplicated', () => {
    const doc = asSeq(`sequenceDiagram
      A->>B: msg1
      A->>B: msg2
      A->>B: msg3`);
    const ids = doc.sequence.participants.map((p) => p.id);
    expect(ids.filter((x) => x === 'a')).toHaveLength(1);
    expect(ids.filter((x) => x === 'b')).toHaveLength(1);
  });

  it('message order is 0-based and monotonically increasing', () => {
    const doc = asSeq('sequenceDiagram\n  A->>B: first\n  B-->>A: second\n  A->>C: third');
    const orders = doc.sequence.messages.map((m) => m.order);
    expect(orders).toEqual([0, 1, 2]);
  });
});

// ---------------------------------------------------------------------------
// AC4 — Activation (explicit + shorthand)
// ---------------------------------------------------------------------------

describe('AC4 — activations', () => {
  it('explicit activate / deactivate → Activation entry', () => {
    const text = `sequenceDiagram
      Alice->>John: Hello
      activate John
      John-->>Alice: Great
      deactivate John`;
    const doc = asSeq(text);
    expect(doc.sequence.activations).toHaveLength(1);
    const act = doc.sequence.activations![0]!;
    expect(act.participant).toBe('john');
    expect(act.from_order).toBe(0);
    expect(act.to_order).toBe(1);
  });

  it('+/- shorthand → same Activation as explicit', () => {
    const text = `sequenceDiagram
      Alice->>+John: Hello
      John-->>-Alice: Great`;
    const doc = asSeq(text);
    expect(doc.sequence.activations).toHaveLength(1);
    const act = doc.sequence.activations![0]!;
    expect(act.participant).toBe('john');
    expect(act.from_order).toBe(0);
    expect(act.to_order).toBe(1);
  });

  it('stacked activations (+/+ then -/-)', () => {
    const text = `sequenceDiagram
      Alice->>+John: Hello 1
      Alice->>+John: Hello 2
      John-->>-Alice: Reply 2
      John-->>-Alice: Reply 1`;
    const doc = asSeq(text);
    expect(doc.sequence.activations).toHaveLength(2);
  });

  it('activation from_order ≤ to_order (schema-valid)', () => {
    const text = `sequenceDiagram
      A->>+B: call
      B-->>-A: response`;
    const doc = asSeq(text);
    for (const act of doc.sequence.activations ?? []) {
      expect(act.from_order).toBeLessThanOrEqual(act.to_order);
    }
  });
});

// ---------------------------------------------------------------------------
// AC5 — Fragments: loop, opt, alt+else, par+and
// ---------------------------------------------------------------------------

describe('AC5 — fragments', () => {
  it('loop fragment → kind loop, correct order range', () => {
    const text = `sequenceDiagram
      loop Every minute
        A->>B: ping
        B-->>A: pong
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments).toHaveLength(1);
    const f = doc.sequence.fragments![0]!;
    expect(f.kind).toBe('loop');
    expect(f.label).toBe('Every minute');
    expect(f.from_order).toBe(0);
    expect(f.to_order).toBe(1);
  });

  it('opt fragment → kind opt', () => {
    const text = `sequenceDiagram
      opt Maybe
        A->>B: optional call
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments).toHaveLength(1);
    expect(doc.sequence.fragments![0]!.kind).toBe('opt');
    expect(doc.sequence.fragments![0]!.label).toBe('Maybe');
  });

  it('alt+else → kind alt, two sections', () => {
    const text = `sequenceDiagram
      alt Success
        A->>B: request
      else Failure
        A->>C: fallback
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments).toHaveLength(1);
    const f = doc.sequence.fragments![0]!;
    expect(f.kind).toBe('alt');
    expect(f.label).toBe('Success');
    expect(f.from_order).toBe(0);
    expect(f.to_order).toBe(1);
    expect(f.sections).toHaveLength(2);
    expect(f.sections![0]!.guard).toBe('Success');
    expect(f.sections![1]!.guard).toBe('Failure');
  });

  it('par+and → kind par, two sections', () => {
    const text = `sequenceDiagram
      par Do this
        A->>B: task1
      and Do that
        A->>C: task2
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments).toHaveLength(1);
    const f = doc.sequence.fragments![0]!;
    expect(f.kind).toBe('par');
    expect(f.sections).toHaveLength(2);
    expect(f.sections![0]!.guard).toBe('Do this');
    expect(f.sections![1]!.guard).toBe('Do that');
  });

  it('alt with three else blocks → three sections', () => {
    const text = `sequenceDiagram
      alt Case A
        A->>B: msg1
      else Case B
        A->>B: msg2
      else Case C
        A->>B: msg3
      end`;
    const doc = asSeq(text);
    const f = doc.sequence.fragments![0]!;
    expect(f.sections).toHaveLength(3);
  });

  it('nested loop inside alt → two fragments', () => {
    const text = `sequenceDiagram
      alt Condition
        loop Retry
          A->>B: try
        end
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments).toHaveLength(2);
    const kinds = doc.sequence.fragments!.map((f) => f.kind).sort();
    expect(kinds).toEqual(['alt', 'loop']);
  });

  it('fragment from_order ≤ to_order (schema-valid)', () => {
    const text = `sequenceDiagram
      loop Retry
        A->>B: request
        B-->>A: response
      end`;
    const doc = asSeq(text);
    for (const f of doc.sequence.fragments ?? []) {
      expect(f.from_order).toBeLessThanOrEqual(f.to_order);
    }
  });
});

// ---------------------------------------------------------------------------
// AC6 — Self-messages
// ---------------------------------------------------------------------------

describe('AC6 — self-messages (from === to)', () => {
  it('A->>A: self → from and to are the same participant id', () => {
    const doc = asSeq('sequenceDiagram\n  A->>A: internal call');
    const msg = doc.sequence.messages[0]!;
    expect(msg.from).toBe(msg.to);
    expect(msg.from).toBe('a');
  });

  it('self-message produces only one participant', () => {
    const doc = asSeq('sequenceDiagram\n  Service->>Service: health check');
    expect(doc.sequence.participants).toHaveLength(1);
    expect(doc.sequence.participants[0]!.id).toBe('service');
  });
});

// ---------------------------------------------------------------------------
// AC7 — Graceful degradation (autonumber, note, critical, break, unknown)
// ---------------------------------------------------------------------------

describe('AC7 — graceful degradation + warnings', () => {
  it('autonumber → warning, no corruption', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  autonumber\n  A->>B: msg',
    );
    expect(warnings.some((w) => /autonumber/i.test(w))).toBe(true);
    expect(doc.sequence.messages).toHaveLength(1);
  });

  it('Note left of A → warning, no corruption', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  A->>B: msg\n  Note left of A: annotation',
    );
    expect(warnings.some((w) => /note/i.test(w))).toBe(true);
    expect(doc.sequence.messages).toHaveLength(1);
  });

  it('Note right of A → warning', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  A->>B: msg\n  Note right of B: hint',
    );
    expect(warnings.some((w) => /note/i.test(w))).toBe(true);
    expect(doc.sequence.messages).toHaveLength(1);
  });

  it('Note over A,B → warning, messages intact', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  A->>B: msg\n  Note over A,B: overview',
    );
    expect(warnings.some((w) => /note/i.test(w))).toBe(true);
    expect(doc.sequence.messages).toHaveLength(1);
  });

  it('critical → DEFERRED warning, fragment still produced with kind critical', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  critical Section\n    A->>B: msg\n  end',
    );
    expect(warnings.some((w) => /critical/i.test(w))).toBe(true);
    // Fragment is produced (critical IS in the IR kind enum)
    expect(doc.sequence.fragments).toHaveLength(1);
    expect(doc.sequence.fragments![0]!.kind).toBe('critical');
  });

  it('break → DEFERRED warning, fragment produced with kind break', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  break Exception\n    A->>B: abort\n  end',
    );
    expect(warnings.some((w) => /break/i.test(w))).toBe(true);
    expect(doc.sequence.fragments).toHaveLength(1);
    expect(doc.sequence.fragments![0]!.kind).toBe('break');
  });

  it('unrecognised line → warning, document not corrupted', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  A->>B: msg\n  ??? random garbage',
    );
    expect(warnings.some((w) => /SKIP/i.test(w))).toBe(true);
    expect(doc.sequence.messages).toHaveLength(1);
    expect(doc.sequence.participants.length).toBeGreaterThanOrEqual(2);
  });

  it('deactivate without prior activate → warning, no throw', () => {
    const { doc, warnings } = parseSequenceInternal(
      'sequenceDiagram\n  A->>B: msg\n  deactivate B',
    );
    expect(warnings.some((w) => /deactivate/i.test(w))).toBe(true);
    expect(doc.sequence.messages).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// AC8 — Determinism
// ---------------------------------------------------------------------------

describe('AC8 — determinism', () => {
  const SAMPLE = `sequenceDiagram
    actor User
    participant Client as Web Client
    participant Server

    User->>+Client: Login
    Client->>+Server: POST /auth
    Server-->>-Client: JWT token
    Client-->>-User: Welcome

    loop Heartbeat
      Client->>Server: ping
      Server-->>Client: pong
    end`;

  it('parse twice → byte-identical SequenceDocument (JSON stable)', () => {
    const doc1 = asSeq(SAMPLE);
    const doc2 = asSeq(SAMPLE);
    expect(JSON.stringify(doc1)).toBe(JSON.stringify(doc2));
  });

  it('render twice → identical sceneHash', () => {
    const r1 = renderMermaid(SAMPLE, { format: 'svg' });
    const r2 = renderMermaid(SAMPLE, { format: 'svg' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
    expect(r1.sceneHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('render SVG then PNG → same sceneHash', () => {
    const rSvg = renderMermaid(SAMPLE, { format: 'svg' });
    const rPng = renderMermaid(SAMPLE, { format: 'png' });
    expect(rSvg.sceneHash).toBe(rPng.sceneHash);
  });
});

// ---------------------------------------------------------------------------
// AC10 — Public warnings surface via parseMermaid
// ---------------------------------------------------------------------------

describe('AC10 — public warnings via parseMermaid', () => {
  it('parseMermaid returns warnings: string[] for sequence', () => {
    const result = parseMermaid('sequenceDiagram\n  autonumber\n  A->>B: msg');
    expect(result.kind).toBe('sequence');
    expect(Array.isArray(result.warnings)).toBe(true);
    expect(result.warnings.some((w) => /autonumber/i.test(w))).toBe(true);
  });

  it('clean diagram → empty warnings array', () => {
    const result = parseMermaid('sequenceDiagram\n  A->>B: call\n  B-->>A: response');
    expect(result.warnings).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC9 — Gallery emit
// ---------------------------------------------------------------------------

describe('AC9 — Gallery emit: mermaid-sequence.mmd', () => {
  it('renders gallery MMD to SVG and PNG', () => {
    if (!existsSync(SEQ_MMD_FILE)) {
      throw new Error(`Gallery file not found: ${SEQ_MMD_FILE}`);
    }

    const text = readFileSync(SEQ_MMD_FILE, 'utf8');
    expect(detectDiagramType(text)).toBe('sequence');

    if (!existsSync(GALLERY_DIR)) {
      mkdirSync(GALLERY_DIR, { recursive: true });
    }

    // SVG
    const svgResult = renderMermaid(text, { format: 'svg', theme: 'bytebytego-sequence' });
    expect(svgResult.svg).toContain('<svg');
    expect(svgResult.kind).toBe('sequence');

    const svgPath = join(GALLERY_DIR, 'mermaid-sequence.svg');
    writeFileSync(svgPath, svgResult.svg!);
    expect(existsSync(svgPath)).toBe(true);

    // PNG
    const pngResult = renderMermaid(text, { format: 'png', theme: 'bytebytego-sequence' });
    expect(pngResult.png).toBeInstanceOf(Uint8Array);
    expect(pngResult.png![0]).toBe(0x89); // PNG signature byte

    const pngPath = join(GALLERY_DIR, 'mermaid-sequence.png');
    writeFileSync(pngPath, pngResult.png!);
    expect(existsSync(pngPath)).toBe(true);

    // Warnings: autonumber + note should both be warned
    expect(svgResult.warnings.some((w) => /autonumber/i.test(w))).toBe(true);
    expect(svgResult.warnings.some((w) => /note/i.test(w))).toBe(true);
  });

  it('gallery sceneHash is stable (determinism regression guard)', () => {
    if (!existsSync(SEQ_MMD_FILE)) return;
    const text = readFileSync(SEQ_MMD_FILE, 'utf8');
    const r1 = renderMermaid(text, { format: 'svg', theme: 'bytebytego-sequence' });
    const r2 = renderMermaid(text, { format: 'svg', theme: 'bytebytego-sequence' });
    expect(r1.sceneHash).toBe(r2.sceneHash);
  });
});

// ---------------------------------------------------------------------------
// Complete-pattern corpus snippets (real-world crawl patterns)
// ---------------------------------------------------------------------------

describe('Corpus: complete real-world patterns', () => {
  it('Pattern 1: simple two-party exchange', () => {
    const text = `sequenceDiagram
      Alice->>Bob: Hello Bob, how are you?
      Bob-->>Alice: Great!`;
    const doc = asSeq(text);
    expect(doc.sequence.participants).toHaveLength(2);
    expect(doc.sequence.messages).toHaveLength(2);
    expect(doc.sequence.messages[0]?.kind).toBe('sync');
    expect(doc.sequence.messages[1]?.kind).toBe('reply');
  });

  it('Pattern 2: API call with activation shorthand', () => {
    const text = `sequenceDiagram
      Client->>+Server: GET /data
      Server->>+DB: SELECT *
      DB-->>-Server: rows
      Server-->>-Client: JSON response`;
    const doc = asSeq(text);
    expect(doc.sequence.messages).toHaveLength(4);
    expect(doc.sequence.activations).toHaveLength(2);
  });

  it('Pattern 3: alt with two branches (OAuth flow)', () => {
    const text = `sequenceDiagram
      participant App
      participant OAuth
      App->>OAuth: Authorization request
      alt Approved
        OAuth-->>App: Access token
      else Denied
        OAuth-->>App: Error
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.messages).toHaveLength(3);
    expect(doc.sequence.fragments).toHaveLength(1);
    expect(doc.sequence.fragments![0]!.kind).toBe('alt');
    expect(doc.sequence.fragments![0]!.sections).toHaveLength(2);
  });

  it('Pattern 4: retry loop (common in microservices)', () => {
    const text = `sequenceDiagram
      participant Service
      participant DB
      loop Up to 3 retries
        Service->>DB: Query
        DB-->>Service: Result
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments![0]!.kind).toBe('loop');
    expect(doc.sequence.fragments![0]!.label).toBe('Up to 3 retries');
  });

  it('Pattern 5: par branch (event-driven notification)', () => {
    const text = `sequenceDiagram
      par Notify channels
        Server->>Email: Send email
      and
        Server->>SMS: Send SMS
      end`;
    const doc = asSeq(text);
    expect(doc.sequence.fragments![0]!.kind).toBe('par');
    expect(doc.sequence.fragments![0]!.sections).toHaveLength(2);
  });

  it('Pattern 6: async fire-and-forget messages', () => {
    const text = `sequenceDiagram
      Producer-)Queue: Publish event
      Queue--)Consumer: Deliver message`;
    const doc = asSeq(text);
    expect(doc.sequence.messages).toHaveLength(2);
    expect(doc.sequence.messages[0]?.kind).toBe('async');
    expect(doc.sequence.messages[1]?.kind).toBe('async');
  });

  it('Pattern 7: frontmatter + theme override', () => {
    const text = `---
title: Auth Flow
theme: default-sequence
---
sequenceDiagram
  participant Client
  participant Server
  Client->>Server: Request`;
    const doc = asSeq(text);
    expect(doc.metadata.title).toBe('Auth Flow');
    expect(doc.metadata.theme).toBe('default-sequence');
    expect(doc.sequence.participants).toHaveLength(2);
  });

  it('Pattern 8: %%{init}%% directive + mixed arrows', () => {
    const text = `%%{init: {"theme": "default-sequence"}}%%
sequenceDiagram
  A->>B: sync
  A-->>B: reply
  A-)B: async`;
    const doc = asSeq(text);
    expect(doc.metadata.theme).toBe('default-sequence');
    expect(doc.sequence.messages).toHaveLength(3);
  });

  it('Pattern 9: ID sanitization (camelCase and underscore IDs)', () => {
    const doc = asSeq('sequenceDiagram\n  AuthService->>UserDB: lookup');
    expect(doc.sequence.participants.find((p) => p.id === 'auth-service')).toBeDefined();
    expect(doc.sequence.participants.find((p) => p.id === 'user-db')).toBeDefined();
  });

  it('Pattern 10: large diagram — 6 participants, 10 messages, activations, fragments', () => {
    const text = `sequenceDiagram
      actor User
      participant Browser as Web Browser
      participant API as API Gateway
      participant Auth as Auth Service
      participant DB as Database
      participant Cache

      User->>+Browser: Navigate to app
      Browser->>+API: GET /dashboard
      API->>+Auth: Validate token
      Auth->>Cache: Check cache
      Cache-->>Auth: Miss
      Auth->>+DB: Query session
      DB-->>-Auth: Session data
      Auth-->>-API: Token valid
      API-->>-Browser: Dashboard data
      Browser-->>-User: Render page`;
    const doc = asSeq(text);
    expect(doc.sequence.participants).toHaveLength(6);
    expect(doc.sequence.messages).toHaveLength(10);
    expect(doc.sequence.activations!.length).toBeGreaterThanOrEqual(4);
    // All activation orders are valid
    for (const act of doc.sequence.activations ?? []) {
      expect(act.from_order).toBeLessThanOrEqual(act.to_order);
    }
  });
});

// ---------------------------------------------------------------------------
// Import detectDiagramType (needed for AC9)
// ---------------------------------------------------------------------------

import { detectDiagramType } from '../src/frontend/mermaid/index.js';
