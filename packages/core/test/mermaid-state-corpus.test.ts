/**
 * @file test/mermaid-state-corpus.test.ts — Real-Mermaid stateDiagram corpus validation.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseStateDiagram, parseStateDiagramInternal } from '../src/frontend/mermaid/state.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const STATE_MMD = join(GALLERY, 'mermaid-state.mmd');

const BASIC_SAMPLE = `stateDiagram-v2
  [*] --> Still
  Still --> [*]`;

const LIFECYCLE_SAMPLE = `stateDiagram-v2
  [*] --> Idle
  Idle --> Processing : order_placed
  Processing --> Authorized : authorize [amount > 0]
  Processing --> Failed : authorize [amount <= 0]
  Failed --> [*]
  Authorized --> Completed : capture
  Completed --> [*]`;

const COMPOSITE_SAMPLE = `stateDiagram-v2
  [*] --> Processing
  state Processing {
    [*] --> Validating
    Validating --> Charging : valid
    Charging --> [*]
  }
  Processing --> Done
  Done --> [*]`;

const FORK_JOIN_CHOICE_SAMPLE = `stateDiagram-v2
  [*] --> Start
  state fork1 <<fork>>
  state join1 <<join>>
  state choice1 <<choice>>
  Start --> fork1
  fork1 --> PathA
  fork1 --> PathB
  PathA --> join1
  PathB --> join1
  join1 --> choice1
  choice1 --> Success : [ok]
  choice1 --> Failure : [err]
  Success --> [*]
  Failure --> [*]`;

const TRAFFIC_LIGHT_SAMPLE = `stateDiagram-v2
  [*] --> Red
  Red --> Green : timer
  Green --> Yellow : timer
  Yellow --> Red : timer`;

const ORDER_PAYMENT_SAMPLE = `stateDiagram-v2
  [*] --> Draft
  Draft --> Submitted : submit
  Submitted --> Paid : payment_received
  Submitted --> Cancelled : cancel
  Paid --> Fulfilled : ship
  Fulfilled --> Refunded : refund
  Refunded --> [*]
  Cancelled --> [*]`;

describe('AC1 — empty diagram, single state, basic transitions', () => {
  it('parses an empty stateDiagram document', () => {
    const doc = parseStateDiagram('stateDiagram-v2');
    expect(doc.states).toHaveLength(0);
    expect(doc.transitions).toHaveLength(0);
  });

  it('parses a single declared state', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  state Idle');
    expect(doc.states).toHaveLength(1);
    expect(doc.states[0]!.id).toBe('Idle');
  });

  it('auto-creates states from a basic transition', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  A --> B');
    expect(doc.states.map((state) => state.id)).toEqual(['A', 'B']);
    expect(doc.transitions[0]).toMatchObject({ from: 'A', to: 'B' });
  });

  it('accepts stateDiagram header without -v2 suffix', () => {
    const doc = parseStateDiagram('stateDiagram\n  A --> B');
    expect(doc.transitions[0]).toMatchObject({ from: 'A', to: 'B' });
  });

  it('preserves frontmatter title/theme metadata', () => {
    const doc = parseStateDiagram('---\ntitle: Machine\ntheme: default-state\n---\nstateDiagram-v2\n  state Idle');
    expect(doc.metadata.title).toBe('Machine');
    expect(doc.metadata.theme).toBe('default-state');
  });
});

describe('AC2 — pseudostates: [*], fork, join, choice', () => {
  it('creates top-level start pseudostate from [*] source', () => {
    const doc = parseStateDiagram(BASIC_SAMPLE);
    expect(doc.states.find((state) => state.id === '__start__')?.isPseudo).toBe('start');
  });

  it('creates top-level end pseudostate from [*] target', () => {
    const doc = parseStateDiagram(BASIC_SAMPLE);
    expect(doc.states.find((state) => state.id === '__end__')?.isPseudo).toBe('end');
  });

  it('parses fork, join, and choice pseudostates', () => {
    const doc = parseStateDiagram(FORK_JOIN_CHOICE_SAMPLE);
    expect(doc.states.find((state) => state.id === 'fork1')?.isPseudo).toBe('fork');
    expect(doc.states.find((state) => state.id === 'join1')?.isPseudo).toBe('join');
    expect(doc.states.find((state) => state.id === 'choice1')?.isPseudo).toBe('choice');
  });

  it('creates composite-local start and end pseudostates', () => {
    const doc = parseStateDiagram(COMPOSITE_SAMPLE);
    const processing = doc.states.find((state) => state.id === 'Processing');
    expect(processing?.children?.some((child) => child.isPseudo === 'start')).toBe(true);
    expect(processing?.children?.some((child) => child.isPseudo === 'end')).toBe(true);
  });

  it('retains pseudostate transitions in declaration order', () => {
    const doc = parseStateDiagram(FORK_JOIN_CHOICE_SAMPLE);
    expect(doc.transitions[0]).toMatchObject({ from: '__start__', to: 'Start' });
    expect(doc.transitions[1]).toMatchObject({ from: 'Start', to: 'fork1' });
  });
});

describe('AC3 — labeled transitions (event / guard / action text)', () => {
  it('parses simple label text after colon', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  A --> B : click');
    expect(doc.transitions[0]!.label).toBe('click');
  });

  it('keeps event + guard labels intact', () => {
    const doc = parseStateDiagram(LIFECYCLE_SAMPLE);
    expect(doc.transitions[2]!.label).toBe('authorize [amount > 0]');
  });

  it('keeps bracket-only choice guards intact', () => {
    const doc = parseStateDiagram(FORK_JOIN_CHOICE_SAMPLE);
    expect(doc.transitions.find((transition) => transition.to === 'Success')?.label).toBe('[ok]');
    expect(doc.transitions.find((transition) => transition.to === 'Failure')?.label).toBe('[err]');
  });

  it('keeps multi-word action labels intact', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  A --> B : remaining paid');
    expect(doc.transitions[0]!.label).toBe('remaining paid');
  });
});

describe('AC4 — state descriptions (s : desc)', () => {
  it('attaches description text to an existing state', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  state Idle\n  Idle : waiting for work');
    expect(doc.states[0]).toMatchObject({ id: 'Idle', description: 'waiting for work' });
  });

  it('auto-creates described state when missing', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  Review : human approval');
    expect(doc.states[0]).toMatchObject({ id: 'Review', description: 'human approval' });
  });

  it('preserves description through parseMermaid dispatch', () => {
    const result = parseMermaid('stateDiagram-v2\n  Idle : ready');
    expect(result.kind).toBe('stateDiagram');
    expect(result.doc.states[0]).toMatchObject({ id: 'Idle', description: 'ready' });
  });

  it('allows description plus later transition', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  Idle : waiting\n  Idle --> Busy');
    expect(doc.transitions[0]).toMatchObject({ from: 'Idle', to: 'Busy' });
    expect(doc.states.find((state) => state.id === 'Idle')?.description).toBe('waiting');
  });
});

describe('AC5 — composite states (nested)', () => {
  it('parses a composite state with children', () => {
    const doc = parseStateDiagram(COMPOSITE_SAMPLE);
    const processing = doc.states.find((state) => state.id === 'Processing');
    expect(processing?.children?.map((child) => child.id)).toContain('Validating');
    expect(processing?.children?.map((child) => child.id)).toContain('Charging');
  });

  it('parses compact composite syntax on one line', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  state Worker { [*] --> Busy\n  Busy --> [*]\n  }');
    const worker = doc.states.find((state) => state.id === 'Worker');
    expect(worker?.children?.some((child) => child.id === 'Busy')).toBe(true);
  });

  it('supports two nested composite levels', () => {
    const { doc } = parseStateDiagramInternal(`stateDiagram-v2
  state A {
    state B {
      [*] --> C
      C --> [*]
    }
  }`);
    const a = doc.states.find((state) => state.id === 'A');
    const b = a?.children?.find((child) => child.id === 'B');
    expect(b?.children?.some((child) => child.id === 'C')).toBe(true);
  });

  it('warns for deep composite nesting beyond two levels', () => {
    const { warnings } = parseStateDiagramInternal(`stateDiagram-v2
  state A {
    state B {
      state C {
        D --> E
      }
    }
  }`);
    expect(warnings.some((warning) => /deeper than 2 levels/i.test(warning))).toBe(true);
  });
});

describe('AC6 — state "Label" as id syntax', () => {
  it('parses quoted display label with explicit id', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  state "Pending Review" as Pending');
    expect(doc.states[0]).toMatchObject({ id: 'Pending', displayLabel: 'Pending Review' });
  });

  it('allows transitions to the explicit id', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  state "Awaiting Capture" as PartialPay\n  PartialPay --> Done');
    expect(doc.transitions[0]).toMatchObject({ from: 'PartialPay', to: 'Done' });
  });

  it('supports label-only state declaration fallback', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  state "Human Review"');
    expect(doc.states[0]?.displayLabel).toBe('Human Review');
  });

  it('preserves display labels through parseMermaid', () => {
    const result = parseMermaid('stateDiagram-v2\n  state "In Progress" as Progressing');
    expect(result.kind).toBe('stateDiagram');
    expect(result.doc.states[0]).toMatchObject({ id: 'Progressing', displayLabel: 'In Progress' });
  });
});

describe('AC7 — notes (note right of / note left of)', () => {
  it('attaches right-side notes to states', () => {
    const doc = parseStateDiagram(`stateDiagram-v2
  state Idle
  note right of Idle
    Queue drained
  end note`);
    expect(doc.states[0]).toMatchObject({ note: 'Queue drained', notePosition: 'right' });
  });

  it('attaches left-side notes to states', () => {
    const doc = parseStateDiagram(`stateDiagram-v2
  state Busy
  note left of Busy
    Retry window
  end note`);
    expect(doc.states[0]).toMatchObject({ note: 'Retry window', notePosition: 'left' });
  });

  it('warns on unclosed note blocks', () => {
    const { warnings } = parseStateDiagramInternal(`stateDiagram-v2
  state Busy
  note right of Busy
    never closed`);
    expect(warnings.some((warning) => /Unclosed note block/i.test(warning))).toBe(true);
  });
});

describe('AC8 — whitespace variants (compact, spaced)', () => {
  it('parses compact transition syntax', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n[*]-->Idle\nIdle-->[*]');
    expect(doc.transitions).toHaveLength(2);
  });

  it('parses spaced transition syntax', () => {
    const doc = parseStateDiagram('stateDiagram-v2\n  [*]  -->  Idle\n  Idle  -->  [*]');
    expect(doc.transitions).toHaveLength(2);
  });

  it('parses compact composite braces without extra spaces', () => {
    const doc = parseStateDiagram('stateDiagram-v2\nstate Worker{\n[*]-->Busy\nBusy-->[*]\n}');
    expect(doc.states.find((state) => state.id === 'Worker')?.children?.some((child) => child.id === 'Busy')).toBe(true);
  });

  it('ignores Mermaid %% comments via preprocess', () => {
    const doc = parseStateDiagram(`stateDiagram-v2
  %% comment
  [*] --> A
  %% another
  A --> [*]`);
    expect(doc.transitions).toHaveLength(2);
  });
});

describe('AC9 — direction parse + warning', () => {
  it('parses direction TB with a warning', () => {
    const { warnings } = parseStateDiagramInternal('stateDiagram-v2\n  direction TB\n  A --> B');
    expect(warnings.some((warning) => /direction/i.test(warning))).toBe(true);
  });

  it('parses direction LR with a warning', () => {
    const { warnings } = parseStateDiagramInternal('stateDiagram-v2\n  direction LR\n  A --> B');
    expect(warnings.some((warning) => /cosmetic-only/i.test(warning))).toBe(true);
  });

  it('surfaces warnings through parseMermaid', () => {
    const result = parseMermaid('stateDiagram-v2\n  direction TB\n  A --> B');
    expect(result.kind).toBe('stateDiagram');
    expect(result.warnings.some((warning) => /direction/i.test(warning))).toBe(true);
  });
});

describe('AC10 — real Mermaid crawl samples', () => {
  it('parses the basic Still/Moving sample', () => {
    const doc = parseStateDiagram(`stateDiagram-v2
  [*] --> Still
  Still --> Moving
  Moving --> Still
  Moving --> Crash
  Crash --> [*]`);
    expect(doc.transitions).toHaveLength(5);
    expect(doc.states.some((state) => state.id === 'Crash')).toBe(true);
  });

  it('parses a traffic-light lifecycle', () => {
    const doc = parseStateDiagram(TRAFFIC_LIGHT_SAMPLE);
    expect(doc.states.map((state) => state.id)).toContain('Yellow');
    expect(doc.transitions[1]!.label).toBe('timer');
  });

  it('parses an order/payment lifecycle', () => {
    const doc = parseStateDiagram(ORDER_PAYMENT_SAMPLE);
    expect(doc.states.map((state) => state.id)).toContain('Refunded');
    expect(doc.transitions.some((transition) => transition.label === 'payment_received')).toBe(true);
  });

  it('parses a composite-order processing sample', () => {
    const doc = parseStateDiagram(COMPOSITE_SAMPLE);
    expect(doc.states.find((state) => state.id === 'Processing')?.children?.length).toBeGreaterThan(2);
  });

  it('parses a fork/join/choice concurrency sample', () => {
    const doc = parseStateDiagram(FORK_JOIN_CHOICE_SAMPLE);
    expect(doc.transitions.some((transition) => transition.to === 'join1')).toBe(true);
  });
});

describe('AC11 — gallery emit', () => {
  it('mermaid-state.mmd exists', () => {
    expect(existsSync(STATE_MMD)).toBe(true);
  });

  it('parses mermaid-state.mmd without error', () => {
    const text = readFileSync(STATE_MMD, 'utf8');
    expect(() => parseStateDiagram(text)).not.toThrow();
    const doc = parseStateDiagram(text);
    expect(doc.states.length).toBeGreaterThan(5);
    expect(doc.transitions.length).toBeGreaterThan(8);
  });

  it('emits mermaid-state.svg to examples/gallery/', () => {
    const text = readFileSync(STATE_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('stateDiagram');
    expect(result.svg).toContain('<svg');
    const outPath = join(GALLERY, 'mermaid-state.svg');
    writeFileSync(outPath, result.svg!, 'utf8');
    expect(statSync(outPath).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-state.png to examples/gallery/', () => {
    const text = readFileSync(STATE_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    expect(result.png).toBeDefined();
    const outPath = join(GALLERY, 'mermaid-state.png');
    writeFileSync(outPath, result.png!);
    expect(statSync(outPath).size).toBeGreaterThan(1000);
  });

  it('parseMermaid dispatches gallery stateDiagram correctly', () => {
    const text = readFileSync(STATE_MMD, 'utf8');
    const result = parseMermaid(text);
    expect(result.kind).toBe('stateDiagram');
    expect('transitions' in result.doc).toBe(true);
  });
});

describe('AC12 — determinism check', () => {
  it('parse twice yields identical JSON', () => {
    const a = parseStateDiagram(LIFECYCLE_SAMPLE);
    const b = parseStateDiagram(LIFECYCLE_SAMPLE);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('sceneHash is stable across repeated renders', () => {
    const h1 = renderMermaid(COMPOSITE_SAMPLE, { format: 'svg' }).sceneHash;
    const h2 = renderMermaid(COMPOSITE_SAMPLE, { format: 'svg' }).sceneHash;
    expect(h1).toBe(h2);
  });

  it('renders stateDiagram to PNG with non-zero bytes', () => {
    const result = renderMermaid(FORK_JOIN_CHOICE_SAMPLE, { format: 'png' });
    expect(result.kind).toBe('stateDiagram');
    expect(result.png).toBeDefined();
    expect(result.png!.length).toBeGreaterThan(1000);
  });
});
