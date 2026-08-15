import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/index.js';

const SAMPLES: Record<string, string> = {
  flowchart: 'flowchart TD\n  A --> B',
  timeline: 'timeline\n  title 2024 Roadmap\n  2024-01-01 : Alpha\n  2024-06-01 : Beta',
  poster: 'poster "Test"\n  columns 1\n  cell arr "Array"\n    array 1 2 3\n  end',
  pie: 'pie title Pets\n  "Dogs" : 386\n  "Cats" : 85',
  xychart:
    'xychart-beta\n  title "Sales"\n  x-axis [jan, feb]\n  y-axis "revenue" 0 --> 100\n  bar [50, 80]',
  quadrant:
    'quadrantChart\n  title Reach vs Impact\n  x-axis Low Reach --> High Reach\n  y-axis Low Impact --> High Impact\n  Campaign A: [0.3, 0.6]',
  radar: 'radar-beta\n  title "Skills"\n  axis sp["Speed"], rl["Power"]\n  curve sd["Dev"]{80, 90}',
  gantt: 'gantt\n  title A Gantt Diagram\n  section Section\n  A task :a1, 2014-01-01, 30d',
  journey: 'journey\n  title My working day\n  section Go to work\n    Make tea: 5: Me',
  kanban: 'kanban\n  Todo\n    Task 1',
  sequence: 'sequenceDiagram\n  Alice->>Bob: Hello',
  class: 'classDiagram\n  class Animal {\n    +String name\n  }',
  state: 'stateDiagram-v2\n  [*] --> Still\n  Still --> [*]',
  er: 'erDiagram\n  CUSTOMER ||--o{ ORDER : places',
  block: 'block-beta\n  columns 1\n  b1["Block"]',
  requirement:
    'requirementDiagram\n  requirement test_req {\n    id: 1\n    text: the test text.\n    risk: high\n    verifymethod: test\n  }',
  sankey: 'sankey-beta\n  Bio-conversion,Losses,26.862',
  mindmap: 'mindmap\n  root((Mindmap))\n    Origins',
  gitgraph: 'gitGraph\n  commit\n  branch develop\n  checkout develop\n  commit',
  c4: 'C4Context\n  Person(user, "User")',
  architecture:
    'architecture-beta\n  service api(server)[API]\n  service db(database)[DB]\n  api:R -- L:db',
  packet: 'packet-beta\n  0-15: "Source Port"\n  16-31: "Dest Port"',
  tree: 'tree\n  1\n    2\n    3',
  list: 'list\n  style block\n  Item 1',
  nodegraph: 'nodegraph\n  A -> B',
  topology: 'topology\n  router R1\n  switch S1\n  R1 -- S1',
  hashmap: 'hashmap\n  key1 => val1',
  queue: 'queue\n  1 -> 2 -> 3',
  stack: 'stack\n  1 -> 2 -> 3',
  array: 'array\n  [1, 2, 3]',
  matrix: 'matrix\n  [[1, 2], [3, 4]]',
  avl: 'avl\n  insert 10\n  insert 20',
  rbtree: 'rbtree\n  insert 10\n  insert 20',
};

describe('Universal Theme & Frontmatter Support across ALL Diagram Types', () => {
  for (const [kind, src] of Object.entries(SAMPLES)) {
    it(`supports theme preset override for ${kind}`, () => {
      const res = renderSync(src, undefined, 'svg', 'executive');
      expect(res.ok).toBe(true);
      if (res.ok) {
        // Executive theme uses #0D1B2A background
        expect(res.value).toContain('#0D1B2A');
      }
    });

    it(`supports YAML frontmatter --- theme: executive --- for ${kind}`, () => {
      const fmSrc = `---\ntheme: executive\n---\n${src}`;
      const res = renderSync(fmSrc);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.value).toContain('#0D1B2A');
      }
    });
  }
});
