import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { journeyDocumentSchema, resolveJourneyTheme } from '../src/grammars/journey/index.js';
import type { JourneyDocument } from '../src/grammars/journey/index.js';
import { detectDiagramType, parseMermaid, renderMermaid } from '../src/frontend/mermaid/index.js';
import { parseJourneyDiagram, parseJourneyDiagramInternal } from '../src/frontend/mermaid/journey.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..', '..');
const GALLERY = join(REPO_ROOT, 'examples', 'gallery');
const JOURNEY_MMD = join(GALLERY, 'mermaid-journey.mmd');
const JOURNEY_SVG = join(GALLERY, 'mermaid-journey.svg');
const JOURNEY_PNG = join(GALLERY, 'mermaid-journey.png');

const MY_WORKING_DAY = `journey
  title My working day
  section Go to work
    Make tea: 5: Me
    Go upstairs: 3: Me, Cat
    Do work: 1: Me, Cat
  section Go home
    Go downstairs: 5: Me, Cat
    Sit down: 5: Me`;

const CUSTOMER_JOURNEY = `journey
  title Customer Journey
  section Awareness
    Discover brand: 4: Customer, Marketing
    Visit landing page: 3: Customer
  section Consideration
    Compare options: 3: Customer, Sales
    Ask for demo: 4: Customer, Sales
  section Conversion
    Sign contract: 5: Customer, Finance
    Go live: 4: Customer, Success`;

interface JourneyCase {
  name: string;
  text: string;
  warningPattern?: RegExp;
  assert: (doc: JourneyDocument, warnings: string[], rendered: ReturnType<typeof renderMermaid>) => void;
}

function allTasks(doc: JourneyDocument) {
  return [...doc.preambleTasks, ...doc.sections.flatMap((section) => section.tasks)];
}

function sceneTexts(rendered: ReturnType<typeof renderMermaid>): string[] {
  return rendered.scene.primitives.flatMap((primitive) => {
    if (primitive.kind === 'text') return [primitive.text];
    if (primitive.kind === 'multitext') return primitive.lines;
    return [] as string[];
  });
}

const JOURNEY_CASES: JourneyCase[] = [
  {
    name: 'minimal journey',
    text: 'journey',
    assert: (doc) => {
      expect(doc.sections).toHaveLength(0);
      expect(doc.preambleTasks).toHaveLength(0);
      expect(allTasks(doc)).toHaveLength(0);
    },
  },
  {
    name: 'title only',
    text: 'journey\n  title My Working Day',
    assert: (doc) => {
      expect(doc.metadata.title).toBe('My Working Day');
      expect(allTasks(doc)).toHaveLength(0);
    },
  },
  {
    name: 'one section one task',
    text: 'journey\n  section Start\n    Begin: 4: Me',
    assert: (doc, _warnings, rendered) => {
      expect(doc.sections).toHaveLength(1);
      expect(doc.sections[0]!.tasks).toHaveLength(1);
      expect(sceneTexts(rendered)).toContain('Start');
    },
  },
  {
    name: 'multiple sections and tasks',
    text: 'journey\n  section A\n    Plan: 3\n    Review: 4: Team\n  section B\n    Ship: 5: Team, QA',
    assert: (doc) => {
      expect(doc.sections).toHaveLength(2);
      expect(allTasks(doc)).toHaveLength(3);
    },
  },
  {
    name: 'tasks before first section',
    text: 'journey\n  Kickoff: 4: PM\n  Prototype: 3: Dev\n  section Delivery\n    Launch: 5: Team',
    assert: (doc) => {
      expect(doc.preambleTasks).toHaveLength(2);
      expect(doc.sections).toHaveLength(1);
      expect(doc.sections[0]!.tasks).toHaveLength(1);
    },
  },
  {
    name: 'score 1 uses red ramp',
    text: 'journey\n  section Risk\n    Pain point: 1: Customer',
    assert: (_doc, _warnings, rendered) => {
      const theme = resolveJourneyTheme('default-journey');
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'circle' && primitive.fill === theme.scoreFills[0])).toBe(true);
    },
  },
  {
    name: 'score 5 uses green ramp',
    text: 'journey\n  section Delight\n    Win back: 5: Customer',
    assert: (_doc, _warnings, rendered) => {
      const theme = resolveJourneyTheme('default-journey');
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'circle' && primitive.fill === theme.scoreFills[4])).toBe(true);
    },
  },
  {
    name: 'score out of range clamps with warning',
    text: 'journey\n  section A\n    Too high: 9: Me',
    warningPattern: /out of range/i,
    assert: (doc) => {
      expect(allTasks(doc)[0]!.score).toBe(5);
    },
  },
  {
    name: 'missing score defaults to 3 with warning',
    text: 'journey\n  section A\n    Missing score:',
    warningPattern: /Missing journey score/i,
    assert: (doc) => {
      expect(allTasks(doc)[0]!.score).toBe(3);
    },
  },
  {
    name: 'task with no actors',
    text: 'journey\n  section Solo\n    Quiet work: 3',
    assert: (doc) => {
      expect(allTasks(doc)[0]!.actors).toEqual([]);
    },
  },
  {
    name: 'task with one actor',
    text: 'journey\n  section Solo\n    Quiet work: 3: Me',
    assert: (doc) => {
      expect(allTasks(doc)[0]!.actors).toEqual(['Me']);
    },
  },
  {
    name: 'task with multiple actors',
    text: 'journey\n  section Team\n    Pair review: 4: Me, Reviewer, QA',
    assert: (doc) => {
      expect(allTasks(doc)[0]!.actors).toEqual(['Me', 'Reviewer', 'QA']);
    },
  },
  {
    name: 'actors with spaces in names',
    text: 'journey\n  section Support\n    Help request: 2: Support Team, Customer Success',
    assert: (doc) => {
      expect(allTasks(doc)[0]!.actors).toEqual(['Support Team', 'Customer Success']);
    },
  },
  {
    name: 'duplicate section names are allowed',
    text: 'journey\n  section Repeat\n    First: 3\n  section Repeat\n    Second: 4',
    assert: (doc) => {
      expect(doc.sections.map((section) => section.name)).toEqual(['Repeat', 'Repeat']);
    },
  },
  {
    name: 'compact syntax parses',
    text: 'journey\nsection Compact\nTask:5:Me',
    assert: (doc) => {
      expect(doc.sections[0]!.tasks[0]!.name).toBe('Task');
      expect(doc.sections[0]!.tasks[0]!.actors).toEqual(['Me']);
    },
  },
  {
    name: 'extra whitespace formatting parses',
    text: 'journey\n   title   Spaced Out  \n  section   Alpha Beta   \n    Task One  :   4  :  Me,  Ops   ',
    assert: (doc) => {
      expect(doc.metadata.title).toBe('Spaced Out');
      expect(doc.sections[0]!.name).toBe('Alpha Beta');
      expect(doc.sections[0]!.tasks[0]!.actors).toEqual(['Me', 'Ops']);
    },
  },
  {
    name: 'frontmatter theme override is preserved',
    text: '---\ntheme: dark-journey\n---\njourney\n  section Theme\n    Night mode: 4: Team',
    assert: (doc) => {
      expect(doc.metadata.theme).toBe('dark-journey');
    },
  },
  {
    name: 'preamble tasks and sections together',
    text: 'journey\n  Discover: 4: Customer\n  section Purchase\n    Buy: 5: Customer\n  section Retain\n    Renew: 4: Customer, Success',
    assert: (doc) => {
      expect(doc.preambleTasks).toHaveLength(1);
      expect(doc.sections).toHaveLength(2);
      expect(allTasks(doc)).toHaveLength(3);
    },
  },
  {
    name: 'section with zero tasks',
    text: 'journey\n  section Empty\n  section Next\n    Work: 3: Team',
    assert: (doc, _warnings, rendered) => {
      expect(doc.sections[0]!.tasks).toHaveLength(0);
      expect(sceneTexts(rendered)).toContain('Empty');
    },
  },
  {
    name: 'scores exactly 1 3 and 5',
    text: 'journey\n  section Range\n    Bad: 1\n    Okay: 3\n    Great: 5',
    assert: (doc) => {
      expect(allTasks(doc).map((task) => task.score)).toEqual([1, 3, 5]);
    },
  },
  {
    name: 'float score rounds to nearest integer',
    text: 'journey\n  section Floaty\n    Maybe: 2.5: Team',
    assert: (doc) => {
      expect(allTasks(doc)[0]!.score).toBe(3);
    },
  },
  {
    name: 'task name with special characters',
    text: 'journey\n  section Weird\n    Call API / check-status? (#1): 4: Dev',
    assert: (doc) => {
      expect(allTasks(doc)[0]!.name).toBe('Call API / check-status? (#1)');
    },
  },
  {
    name: 'very long task name renders without crashing',
    text: 'journey\n  section Long\n    This is a deliberately very long user journey task name that should wrap safely without crashing the renderer or parser: 4: Customer, Design',
    assert: (_doc, _warnings, rendered) => {
      expect(rendered.scene.width).toBeGreaterThan(0);
      expect(rendered.scene.height).toBeGreaterThan(0);
      expect(rendered.scene.primitives.some((primitive) => primitive.kind === 'multitext')).toBe(true);
    },
  },
  {
    name: 'many sections 8 plus',
    text: `journey
  section S1
    A: 3
  section S2
    B: 3
  section S3
    C: 3
  section S4
    D: 3
  section S5
    E: 3
  section S6
    F: 3
  section S7
    G: 3
  section S8
    H: 3`,
    assert: (doc) => {
      expect(doc.sections).toHaveLength(8);
    },
  },
  {
    name: 'many tasks per section 10 plus',
    text: `journey
  section Bulk
    T1: 3
    T2: 3
    T3: 3
    T4: 3
    T5: 3
    T6: 3
    T7: 3
    T8: 3
    T9: 3
    T10: 3
    T11: 3`,
    assert: (doc, _warnings, rendered) => {
      expect(doc.sections[0]!.tasks).toHaveLength(11);
      const theme = resolveJourneyTheme('default-journey');
      const taskCircles = rendered.scene.primitives.filter((primitive) => primitive.kind === 'circle' && primitive.r === theme.taskRadius);
      expect(taskCircles).toHaveLength(11);
    },
  },
  {
    name: 'real Mermaid crawl sample My Working Day',
    text: MY_WORKING_DAY,
    assert: (doc) => {
      expect(doc.metadata.title).toBe('My working day');
      expect(doc.sections).toHaveLength(2);
      expect(allTasks(doc)).toHaveLength(5);
    },
  },
  {
    name: 'real Mermaid crawl sample Customer Journey',
    text: CUSTOMER_JOURNEY,
    assert: (doc) => {
      expect(doc.metadata.title).toBe('Customer Journey');
      expect(doc.sections).toHaveLength(3);
      expect(allTasks(doc)).toHaveLength(6);
    },
  },
  {
    name: 'task without any colon warns and defaults',
    text: 'journey\n  section Raw\n    Bare task line',
    warningPattern: /no score delimiter/i,
    assert: (doc) => {
      expect(allTasks(doc)[0]).toMatchObject({ name: 'Bare task line', score: 3, actors: [] });
    },
  },
  {
    name: 'directive title fallback applies',
    text: '%%{init: {"title": "Directive Journey"}}%%\njourney\n  section A\n    Task: 3',
    assert: (doc) => {
      expect(doc.metadata.title).toBe('Directive Journey');
    },
  },
  {
    name: 'frontmatter title fallback applies',
    text: '---\ntitle: FM Journey\n---\njourney\n  section A\n    Task: 3',
    assert: (doc) => {
      expect(doc.metadata.title).toBe('FM Journey');
    },
  },
];

describe('Mermaid journey corpus', () => {
  it.each(JOURNEY_CASES)('$name', ({ text, warningPattern, assert }) => {
    expect(detectDiagramType(text)).toBe('journey');
    expect(() => parseJourneyDiagram(text)).not.toThrow();

    const parsed = parseJourneyDiagramInternal(text);
    const viaIndex = parseMermaid(text);
    expect(viaIndex.kind).toBe('journey');

    const doc = viaIndex.doc as JourneyDocument;
    const rendered = renderMermaid(text, { format: 'svg' });
    expect(rendered.kind).toBe('journey');
    expect(rendered.svg).toContain('<svg');

    if (warningPattern) {
      expect(parsed.warnings.some((warning) => warningPattern.test(warning))).toBe(true);
    }

    assert(doc, parsed.warnings, rendered);
  });

  it('detectDiagramType returns journey', () => {
    expect(detectDiagramType('journey\n  section A\n    Task: 3')).toBe('journey');
  });

  it('parseMermaid dispatches to journey', () => {
    const result = parseMermaid(MY_WORKING_DAY);
    expect(result.kind).toBe('journey');
    expect((result.doc as JourneyDocument).sections).toHaveLength(2);
  });

  it('JourneyDocument schema validation succeeds for valid docs', () => {
    expect(() => journeyDocumentSchema.parse(parseJourneyDiagram(MY_WORKING_DAY))).not.toThrow();
  });

  it('JourneyDocument schema validation rejects invalid scores', () => {
    expect(() => journeyDocumentSchema.parse({
      version: '1.0',
      metadata: {},
      sections: [{ name: 'A', tasks: [{ name: 'Bad', score: 9, actors: [] }] }],
      preambleTasks: [],
    })).toThrow();
  });

  it('mermaid-journey.mmd exists', () => {
    expect(existsSync(JOURNEY_MMD)).toBe(true);
  });

  it('emits mermaid-journey.svg to examples/gallery/', () => {
    const text = readFileSync(JOURNEY_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'svg' });
    expect(result.kind).toBe('journey');
    writeFileSync(JOURNEY_SVG, result.svg!, 'utf8');
    expect(statSync(JOURNEY_SVG).size).toBeGreaterThan(1000);
  });

  it('emits mermaid-journey.png to examples/gallery/', () => {
    const text = readFileSync(JOURNEY_MMD, 'utf8');
    const result = renderMermaid(text, { format: 'png' });
    writeFileSync(JOURNEY_PNG, result.png!);
    expect(statSync(JOURNEY_PNG).size).toBeGreaterThan(1000);
  });

  it('asserts journey gallery files exist and are non-empty', () => {
    expect(existsSync(JOURNEY_SVG)).toBe(true);
    expect(existsSync(JOURNEY_PNG)).toBe(true);
    expect(statSync(JOURNEY_SVG).size).toBeGreaterThan(1000);
    expect(statSync(JOURNEY_PNG).size).toBeGreaterThan(1000);
  });
});
