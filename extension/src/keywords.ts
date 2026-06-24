import type { DiagramKind } from '../../src/contracts/index.js';

/**
 * IntelliSense keyword data (Phase 3).
 *
 * Two curated tables drive completion:
 *
 *  1. {@link DIAGRAM_HEADERS} — the diagram-HEADER keywords offered at the top
 *     of a document. This mirrors the header set in `src/frontend/detect.ts`
 *     (`MERMAID_PATTERNS`): every `insert` token here is a string that the core
 *     `detect()` recognises as the listed `kind`. It is the single source of
 *     truth for "which diagram can I start here". A sanity check (see the build
 *     verification) feeds each `insert` back through `detect()` to guarantee no
 *     invented kinds drift in.
 *
 *  2. {@link KIND_KEYWORDS} — a MODEST, hand-curated set of per-kind body
 *     keywords/snippets. The Peggy grammars are not introspectable for
 *     completion (a recognizer, not a queryable model), so this list is
 *     maintained by hand. Every entry is grounded in real `examples/` sources
 *     or the diagram's `grammar.peggy` literals — no invented syntax. It is
 *     intentionally not exhaustive.
 */

export interface HeaderKeyword {
  /** Text inserted on accept — MUST be recognised by core `detect()`. */
  readonly insert: string;
  /** The diagram kind this header selects. */
  readonly kind: DiagramKind;
  /** One-line detail shown beside the completion. */
  readonly detail: string;
  /** Longer documentation string. */
  readonly doc: string;
}

export interface KeywordEntry {
  /** Label shown in the completion list. */
  readonly label: string;
  /** Inserted text (defaults to `label`). May be a snippet when `snippet`. */
  readonly insert?: string;
  /** When true, `insert` is a VS Code snippet (with `${n}` placeholders). */
  readonly snippet?: boolean;
  /** One-line detail. */
  readonly detail: string;
  /** Optional longer documentation. */
  readonly doc?: string;
}

// ─── 1. Diagram headers (mirrors detect.ts MERMAID_PATTERNS) ────────────────────

export const DIAGRAM_HEADERS: readonly HeaderKeyword[] = [
  { insert: 'flowchart', kind: 'flowchart', detail: 'Flowchart', doc: 'Node-and-edge flow diagram. e.g. `flowchart LR`.' },
  { insert: 'graph', kind: 'flowchart', detail: 'Flowchart (graph alias)', doc: 'Alias for `flowchart`. e.g. `graph TD`.' },
  { insert: 'sequenceDiagram', kind: 'sequence', detail: 'Sequence diagram', doc: 'Participant lifelines and messages.' },
  { insert: 'timeline', kind: 'timeline', detail: 'Timeline', doc: 'Chronological sections of events.' },
  { insert: 'mindmap', kind: 'mindmap', detail: 'Mind map', doc: 'Indented hierarchy from a central root node.' },
  { insert: 'stateDiagram-v2', kind: 'state', detail: 'State diagram', doc: 'States and transitions; `[*]` marks start/end.' },
  { insert: 'classDiagram', kind: 'class', detail: 'Class diagram', doc: 'Classes, members, and relationships.' },
  { insert: 'erDiagram', kind: 'er', detail: 'Entity-relationship diagram', doc: 'Entities, attributes, and cardinalities.' },
  { insert: 'gantt', kind: 'gantt', detail: 'Gantt chart', doc: 'Tasks over time, grouped into sections.' },
  { insert: 'journey', kind: 'journey', detail: 'User journey', doc: 'Scored steps across journey sections.' },
  { insert: 'C4Context', kind: 'c4', detail: 'C4 context diagram', doc: 'System-context level of the C4 model.' },
  { insert: 'C4Container', kind: 'c4', detail: 'C4 container diagram', doc: 'Container level of the C4 model.' },
  { insert: 'C4Component', kind: 'c4', detail: 'C4 component diagram', doc: 'Component level of the C4 model.' },
  { insert: 'C4Dynamic', kind: 'c4', detail: 'C4 dynamic diagram', doc: 'Runtime interactions in the C4 model.' },
  { insert: 'C4Deployment', kind: 'c4', detail: 'C4 deployment diagram', doc: 'Deployment topology in the C4 model.' },
  { insert: 'sankey-beta', kind: 'sankey', detail: 'Sankey diagram', doc: 'Weighted flows as CSV `source,target,value` rows.' },
  { insert: 'kanban', kind: 'kanban', detail: 'Kanban board', doc: 'Columns of cards (`id[Label]`).' },
  { insert: 'requirementDiagram', kind: 'requirement', detail: 'Requirement diagram', doc: 'Requirements, elements, and relationships.' },
  { insert: 'gitGraph', kind: 'gitgraph', detail: 'Git graph', doc: 'Commits, branches, checkouts, and merges.' },
  { insert: 'packet-beta', kind: 'packet', detail: 'Packet diagram', doc: 'Bit/byte ranges of a binary layout.' },
  { insert: 'pie', kind: 'pie', detail: 'Pie chart', doc: 'Labelled slices; `pie showData title …`.' },
  { insert: 'xychart-beta', kind: 'xychart', detail: 'XY chart', doc: 'Bar/line series over an x/y axis.' },
  { insert: 'quadrantChart', kind: 'quadrant', detail: 'Quadrant chart', doc: 'Points placed across four labelled quadrants.' },
  { insert: 'radar-beta', kind: 'radar', detail: 'Radar chart', doc: 'Curves over named axes.' },
  { insert: 'block-beta', kind: 'block', detail: 'Block diagram', doc: 'Grid of blocks with `columns` and edges.' },
  { insert: 'architecture-beta', kind: 'architecture', detail: 'Architecture diagram', doc: 'Groups, services, and connections.' },
  { insert: 'poster', kind: 'poster', detail: 'Poster (composition)', doc: 'Grid composition of multiple diagrams.' },
  { insert: 'topology', kind: 'topology', detail: 'Topology', doc: 'Tiered interconnect of nodes with costs.' },
  { insert: 'tree', kind: 'tree', detail: 'Tree', doc: 'Generic indented tree; optional `tree TD`.' },
  { insert: 'plan', kind: 'plan', detail: 'Query plan tree', doc: 'Indented plan nodes with `{rows: N}` annotations.' },
  { insert: 'avl', kind: 'avl', detail: 'AVL tree', doc: 'Self-balancing BST: `avl insert 50 30 70 …`.' },
  { insert: 'rbtree', kind: 'rbtree', detail: 'Red-black tree', doc: '`rbtree insert 13 8 17 …`.' },
  { insert: 'btree', kind: 'btree', detail: 'B-tree', doc: '`btree order 3 insert 10 20 5 …`.' },
  { insert: 'radix', kind: 'radix', detail: 'Radix tree', doc: '`radix insert cat car card …`.' },
  { insert: 'segtree', kind: 'segtree', detail: 'Segment tree', doc: '`segtree over [5, 8, 13] reduce sum`.' },
  { insert: 'heap', kind: 'heap', detail: 'Heap', doc: '`heap max insert 50 30 70 …`.' },
  { insert: 'array', kind: 'array', detail: 'Array', doc: 'Indexed cells: `cells 5 8 13`, optional `index`.' },
  { insert: 'linkedlist', kind: 'linkedlist', detail: 'Linked list', doc: 'Chain of nodes; list the values per line.' },
  { insert: 'memory', kind: 'memory', detail: 'Memory diagram', doc: 'Regions and variables referencing objects.' },
  { insert: 'page', kind: 'page', detail: 'Heap page', doc: 'Slotted page with `slots` and `tuples`.' },
  { insert: 'queue', kind: 'queue', detail: 'Queue', doc: 'Linear queue with `cells` and `capacity`.' },
  { insert: 'cqueue', kind: 'cqueue', detail: 'Circular queue', doc: 'Ring buffer with `front`/`rear` indices.' },
  { insert: 'deque', kind: 'deque', detail: 'Deque', doc: 'Double-ended queue of `cells`.' },
  { insert: 'pqueue', kind: 'pqueue', detail: 'Priority queue', doc: 'Items with priorities: `item Deploy 9`.' },
  { insert: 'stack', kind: 'stack', detail: 'Stack', doc: 'LIFO `cells` with a `capacity`.' },
  { insert: 'hashmap', kind: 'hashmap', detail: 'Hash map', doc: 'Buckets of `key->value` entries.' },
  { insert: 'matrix', kind: 'matrix', detail: 'Matrix', doc: 'Grid of `row` lines.' },
  { insert: 'trie', kind: 'trie', detail: 'Trie', doc: '`trie insert cat car card …`.' },
  { insert: 'nodegraph', kind: 'nodegraph', detail: 'Node graph', doc: 'General graph; `directed`, `node`, edges.' },
  { insert: 'unionfind', kind: 'unionfind', detail: 'Union-find (DSU)', doc: 'Disjoint sets: `unionfind 7`, `parent …`.' },
];

// ─── 2. Per-kind body keywords (modest, grounded) ───────────────────────────────

const FLOWCHART: KeywordEntry[] = [
  { label: '-->', detail: 'Arrow edge', doc: 'Directed edge: `A --> B`.' },
  { label: '---', detail: 'Open link', doc: 'Undirected link: `A --- B`.' },
  { label: '-->|label|', insert: '--> |${1:label}| ${2:Target}', snippet: true, detail: 'Labelled arrow', doc: 'Edge with a label: `A -->|yes| B`.' },
  { label: 'subgraph', insert: 'subgraph ${1:Title}\n\t$0\nend', snippet: true, detail: 'Subgraph block', doc: 'Group nodes: `subgraph … end`.' },
  { label: 'TD', detail: 'Direction top-down', doc: 'Header direction, e.g. `flowchart TD`.' },
  { label: 'LR', detail: 'Direction left-right', doc: 'Header direction, e.g. `flowchart LR`.' },
];

const SEQUENCE: KeywordEntry[] = [
  { label: 'participant', insert: 'participant ${1:Name}', snippet: true, detail: 'Declare a participant', doc: '`participant Auth as Auth Service`.' },
  { label: 'actor', insert: 'actor ${1:Name}', snippet: true, detail: 'Declare an actor', doc: 'Human participant: `actor User`.' },
  { label: 'autonumber', detail: 'Auto-number messages', doc: 'Numbers each message in order.' },
  { label: '->>', insert: '${1:A}->>${2:B}: ${3:message}', snippet: true, detail: 'Solid async message', doc: '`User->>Auth: login`.' },
  { label: '-->>', insert: '${1:B}-->>${2:A}: ${3:reply}', snippet: true, detail: 'Dashed reply', doc: 'Return message.' },
  { label: 'activate', detail: 'Activate lifeline', doc: 'Show an activation bar.' },
  { label: 'deactivate', detail: 'Deactivate lifeline', doc: 'End an activation bar.' },
  { label: 'loop', insert: 'loop ${1:condition}\n\t$0\nend', snippet: true, detail: 'Loop block', doc: '`loop … end`.' },
  { label: 'alt', insert: 'alt ${1:condition}\n\t$0\nelse ${2:otherwise}\n\nend', snippet: true, detail: 'Alternative block', doc: '`alt … else … end`.' },
  { label: 'opt', insert: 'opt ${1:condition}\n\t$0\nend', snippet: true, detail: 'Optional block', doc: '`opt … end`.' },
];

const CLASS: KeywordEntry[] = [
  { label: 'class', insert: 'class ${1:Name} {\n\t$0\n}', snippet: true, detail: 'Declare a class', doc: 'Members use `+ - #` visibility.' },
  { label: '<|--', detail: 'Inheritance', doc: '`Base <|-- Derived`.' },
  { label: '*--', detail: 'Composition', doc: '`Whole *-- Part`.' },
  { label: 'o--', detail: 'Aggregation', doc: '`Whole o-- Part`.' },
  { label: '-->', detail: 'Association', doc: '`A --> B`.' },
];

const STATE: KeywordEntry[] = [
  { label: '[*]', detail: 'Start / end pseudostate', doc: '`[*] --> Idle` or `Done --> [*]`.' },
  { label: 'state', insert: 'state ${1:Name} {\n\t$0\n}', snippet: true, detail: 'Composite / named state', doc: 'Nest substates or declare a state.' },
  { label: '-->', insert: '${1:From} --> ${2:To} : ${3:event}', snippet: true, detail: 'Transition', doc: '`A --> B : event`.' },
  { label: '<<choice>>', detail: 'Choice pseudostate', doc: '`state c1 <<choice>>`.' },
];

const ER: KeywordEntry[] = [
  { label: '||--o{', insert: '${1:A} ||--o{ ${2:B} : ${3:relates}', snippet: true, detail: 'One-to-many', doc: 'One A to zero-or-more B.' },
  { label: '||--|{', insert: '${1:A} ||--|{ ${2:B} : ${3:relates}', snippet: true, detail: 'One-to-many (≥1)', doc: 'One A to one-or-more B.' },
  { label: 'PK', detail: 'Primary key', doc: 'Attribute marker inside an entity block.' },
  { label: 'FK', detail: 'Foreign key', doc: 'Attribute marker inside an entity block.' },
];

const GANTT: KeywordEntry[] = [
  { label: 'dateFormat', insert: 'dateFormat ${1:YYYY-MM-DD}', snippet: true, detail: 'Input date format', doc: 'Parsing format for task dates.' },
  { label: 'section', insert: 'section ${1:Name}', snippet: true, detail: 'Task section', doc: 'Group tasks under a heading.' },
  { label: 'done', detail: 'Completed task tag', doc: 'Task status: `:done, id, 2025-01-06, 30d`.' },
  { label: 'active', detail: 'Active task tag', doc: 'Task status marker.' },
  { label: 'crit', detail: 'Critical task tag', doc: 'Highlights a critical task.' },
  { label: 'after', detail: 'Relative start', doc: 'Start after another task: `after inf1`.' },
];

const JOURNEY: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Journey title', doc: 'Top title for the journey.' },
  { label: 'section', insert: 'section ${1:Name}', snippet: true, detail: 'Journey section', doc: 'Group steps. Step: `Task: 4: Actor`.' },
];

const GITGRAPH: KeywordEntry[] = [
  { label: 'commit', detail: 'Add a commit', doc: '`commit id: "x" tag: "v0.1"`.' },
  { label: 'branch', insert: 'branch ${1:name}', snippet: true, detail: 'Create a branch', doc: '`branch develop`.' },
  { label: 'checkout', insert: 'checkout ${1:name}', snippet: true, detail: 'Switch branch', doc: '`checkout develop`.' },
  { label: 'merge', insert: 'merge ${1:name}', snippet: true, detail: 'Merge a branch', doc: '`merge feature/auth`.' },
];

const REQUIREMENT: KeywordEntry[] = [
  { label: 'requirement', insert: 'requirement ${1:Name} {\n\tid: ${2:REQ-001}\n\ttext: ${3:…}\n\trisk: ${4:high}\n\tverifymethod: ${5:test}\n}', snippet: true, detail: 'Requirement block', doc: 'A requirement with id/text/risk/verifymethod.' },
  { label: 'functionalRequirement', detail: 'Functional requirement', doc: 'Typed requirement block.' },
  { label: 'risk', detail: 'Risk level', doc: '`risk: high | medium | low`.' },
  { label: 'verifymethod', detail: 'Verification method', doc: '`verifymethod: test | analysis | inspection | demonstration`.' },
];

const MINDMAP: KeywordEntry[] = [
  { label: 'root', insert: 'root((${1:Center}))', snippet: true, detail: 'Central root node', doc: '`root((Distributed Systems))`.' },
  { label: '::icon', insert: '::icon(${1:fa fa-check})', snippet: true, detail: 'Node icon', doc: 'Attach a Font Awesome icon to a node.' },
];

const PIE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Chart title', doc: '`pie title Popularity`.' },
  { label: 'showData', detail: 'Show slice values', doc: 'Render numeric values on slices.' },
];

const C4: KeywordEntry[] = [
  { label: 'Person', insert: 'Person(${1:id}, "${2:Name}", "${3:desc}")', snippet: true, detail: 'A person', doc: 'A human actor.' },
  { label: 'Person_Ext', detail: 'External person', doc: 'An actor outside the system boundary.' },
  { label: 'System', insert: 'System(${1:id}, "${2:Name}", "${3:desc}")', snippet: true, detail: 'A system', doc: 'A software system.' },
  { label: 'System_Ext', detail: 'External system', doc: 'A system outside your boundary.' },
  { label: 'Container', insert: 'Container(${1:id}, "${2:Name}", "${3:tech}", "${4:desc}")', snippet: true, detail: 'A container', doc: 'An app/service/data store.' },
  { label: 'Component', detail: 'A component', doc: 'A component within a container.' },
  { label: 'Boundary', insert: 'Boundary(${1:id}, "${2:Name}") {\n\t$0\n}', snippet: true, detail: 'Grouping boundary', doc: 'Group elements within a boundary.' },
  { label: 'Enterprise_Boundary', detail: 'Enterprise boundary', doc: 'Top-level enterprise grouping.' },
  { label: 'Rel', insert: 'Rel(${1:from}, ${2:to}, "${3:label}")', snippet: true, detail: 'Relationship', doc: 'A directed relationship between elements.' },
];

const QUADRANT: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Chart title', doc: 'Top title.' },
  { label: 'x-axis', insert: 'x-axis ${1:Low} --> ${2:High}', snippet: true, detail: 'X axis range', doc: '`x-axis Low Reach --> High Reach`.' },
  { label: 'y-axis', insert: 'y-axis ${1:Low} --> ${2:High}', snippet: true, detail: 'Y axis range', doc: '`y-axis Low --> High`.' },
  { label: 'quadrant-1', detail: 'Quadrant 1 label', doc: 'Label for the top-right quadrant (also -2, -3, -4).' },
];

const XYCHART: KeywordEntry[] = [
  { label: 'title', insert: 'title "${1:Title}"', snippet: true, detail: 'Chart title', doc: 'Top title.' },
  { label: 'x-axis', insert: 'x-axis [${1:Jan, Feb, Mar}]', snippet: true, detail: 'X axis', doc: 'Category axis: `x-axis [Jan, Feb]`.' },
  { label: 'y-axis', insert: 'y-axis "${1:label}" ${2:0} --> ${3:100}', snippet: true, detail: 'Y axis', doc: 'Value axis with range.' },
  { label: 'bar', insert: 'bar [${1:1, 2, 3}]', snippet: true, detail: 'Bar series', doc: '`bar [1800, 2600]`.' },
  { label: 'line', insert: 'line [${1:1, 2, 3}]', snippet: true, detail: 'Line series', doc: '`line [2000, 2500]`.' },
];

const TIMELINE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Timeline title', doc: 'Top title.' },
  { label: 'section', insert: 'section ${1:Name}', snippet: true, detail: 'Timeline section', doc: 'Group events. Event: `2025-Q1 : Research`.' },
];

const BLOCK: KeywordEntry[] = [
  { label: 'columns', insert: 'columns ${1:3}', snippet: true, detail: 'Grid column count', doc: 'Number of columns in the block grid.' },
];

const RADAR: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Chart title', doc: 'Top title.' },
  { label: 'axis', insert: 'axis ${1:id["Label"]}', snippet: true, detail: 'Declare axes', doc: '`axis sp["Speed"], rl["Reliability"]`.' },
  { label: 'curve', insert: 'curve ${1:id["Label"]}{${2:9, 8, 7}}', snippet: true, detail: 'Declare a curve', doc: '`curve sd["Senior Dev"]{9, 8, 7}`.' },
  { label: 'max', detail: 'Axis maximum', doc: '`max 10`.' },
  { label: 'min', detail: 'Axis minimum', doc: '`min 0`.' },
];

const PACKET: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Packet title', doc: 'Top title. Fields: `0-3: "Name"`.' },
];

const TOPOLOGY: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Topology title', doc: 'Top title.' },
  { label: 'costs', insert: 'costs ${1:ns}', snippet: true, detail: 'Cost unit + tiers', doc: 'Begins a `tier …` cost block.' },
  { label: 'tier', insert: 'tier ${1:local} ${2:90} ${3:#27ae60}', snippet: true, detail: 'Cost tier', doc: '`tier local 90 #27ae60`.' },
  { label: 'node', insert: 'node ${1:N0} : ${2:Label} : ${3:detail}', snippet: true, detail: 'Topology node', doc: '`node N0 : Node 0 : CPU+RAM`.' },
];

// DS one-liners and simple block kinds.
const TREE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Tree title', doc: 'Top title.' },
  { label: 'TD', detail: 'Top-down layout', doc: 'Header direction: `tree TD`.' },
];
const PLAN: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Plan title', doc: 'Top title. Nodes carry `{rows: N}`.' },
];
const INSERT_ONLY: KeywordEntry[] = [
  { label: 'insert', insert: 'insert ${1:10 20 5}', snippet: true, detail: 'Insert values', doc: 'Space-separated values to insert.' },
];
const BTREE: KeywordEntry[] = [
  { label: 'order', insert: 'order ${1:3}', snippet: true, detail: 'B-tree order', doc: '`btree order 3 insert …`.' },
  { label: 'insert', insert: 'insert ${1:10 20 5}', snippet: true, detail: 'Insert values', doc: 'Values to insert.' },
];
const HEAP: KeywordEntry[] = [
  { label: 'max', detail: 'Max-heap', doc: '`heap max insert …`.' },
  { label: 'min', detail: 'Min-heap', doc: '`heap min insert …`.' },
  { label: 'insert', insert: 'insert ${1:50 30 70}', snippet: true, detail: 'Insert values', doc: 'Values to insert.' },
];
const SEGTREE: KeywordEntry[] = [
  { label: 'over', insert: 'over [${1:5, 8, 13}] reduce ${2:sum}', snippet: true, detail: 'Array + reducer', doc: '`segtree over [5, 8, 13] reduce sum`.' },
];
const ARRAY: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Array title', doc: 'Top title.' },
  { label: 'cells', insert: 'cells ${1:5 8 13 21}', snippet: true, detail: 'Array cells', doc: 'Space-separated cell values.' },
  { label: 'index', detail: 'Show indices', doc: 'Render index numbers under cells.' },
];
const MEMORY: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Memory title', doc: 'Top title.' },
  { label: 'region', insert: 'region ${1:STACK}', snippet: true, detail: 'Memory region', doc: '`region STACK` then `var …`.' },
  { label: 'var', insert: 'var ${1:p} -> ${2:obj}', snippet: true, detail: 'Variable', doc: '`var p -> obj`.' },
];
const PAGE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Page title', doc: 'Top title.' },
  { label: 'slots', insert: 'slots ${1:3}', snippet: true, detail: 'Slot count', doc: 'Number of slots in the page.' },
  { label: 'tuples', insert: 'tuples ${1:(10,Ann) (40,Bob)}', snippet: true, detail: 'Tuples', doc: '`tuples (10,Ann) (40,Bob)`.' },
];
const QUEUE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Queue title', doc: 'Top title.' },
  { label: 'cells', insert: 'cells ${1:A B C}', snippet: true, detail: 'Queue cells', doc: 'Space-separated values.' },
  { label: 'capacity', insert: 'capacity ${1:6}', snippet: true, detail: 'Capacity', doc: 'Maximum number of cells.' },
];
const CQUEUE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Ring buffer title', doc: 'Top title.' },
  { label: 'capacity', insert: 'capacity ${1:6}', snippet: true, detail: 'Capacity', doc: 'Ring size.' },
  { label: 'cells', insert: 'cells ${1:_ B C D _ _}', snippet: true, detail: 'Cells', doc: '`_` marks empty slots.' },
  { label: 'front', insert: 'front ${1:1}', snippet: true, detail: 'Front index', doc: 'Index of the front element.' },
  { label: 'rear', insert: 'rear ${1:3}', snippet: true, detail: 'Rear index', doc: 'Index of the rear element.' },
];
const PQUEUE: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Priority queue title', doc: 'Top title.' },
  { label: 'item', insert: 'item ${1:Deploy} ${2:9}', snippet: true, detail: 'Item + priority', doc: '`item Deploy 9`.' },
];
const STACK: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Stack title', doc: 'Top title.' },
  { label: 'cells', insert: 'cells ${1:main parse layout}', snippet: true, detail: 'Stack cells', doc: 'Space-separated frames.' },
  { label: 'capacity', insert: 'capacity ${1:6}', snippet: true, detail: 'Capacity', doc: 'Maximum frames.' },
];
const HASHMAP: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Hash map title', doc: 'Top title.' },
  { label: 'buckets', insert: 'buckets ${1:5}', snippet: true, detail: 'Bucket count', doc: 'Number of buckets.' },
  { label: 'bucket', insert: 'bucket ${1:0}: ${2:alice->1, bob->2}', snippet: true, detail: 'Bucket entries', doc: '`bucket 0: alice->1, bob->2`.' },
];
const MATRIX: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Matrix title', doc: 'Top title.' },
  { label: 'row', insert: 'row ${1:1 2 3 4}', snippet: true, detail: 'Matrix row', doc: 'Space-separated row values.' },
];
const NODEGRAPH: KeywordEntry[] = [
  { label: 'directed', detail: 'Directed graph', doc: 'Edges have direction.' },
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Graph title', doc: 'Top title.' },
  { label: 'node', insert: 'node ${1:A} : ${2:label}', snippet: true, detail: 'Declare a node', doc: '`node A : parse`.' },
];
const UNIONFIND: KeywordEntry[] = [
  { label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'Union-find title', doc: 'Top title.' },
  { label: 'parent', insert: 'parent ${1:0 0 1 3 3 5 5}', snippet: true, detail: 'Parent array', doc: 'Parent pointer per element.' },
];

export const KIND_KEYWORDS: Partial<Record<DiagramKind, readonly KeywordEntry[]>> = {
  flowchart: FLOWCHART,
  sequence: SEQUENCE,
  class: CLASS,
  state: STATE,
  er: ER,
  gantt: GANTT,
  journey: JOURNEY,
  gitgraph: GITGRAPH,
  requirement: REQUIREMENT,
  mindmap: MINDMAP,
  pie: PIE,
  c4: C4,
  quadrant: QUADRANT,
  xychart: XYCHART,
  timeline: TIMELINE,
  block: BLOCK,
  radar: RADAR,
  packet: PACKET,
  topology: TOPOLOGY,
  tree: TREE,
  plan: PLAN,
  avl: INSERT_ONLY,
  rbtree: INSERT_ONLY,
  btree: BTREE,
  radix: INSERT_ONLY,
  segtree: SEGTREE,
  heap: HEAP,
  trie: INSERT_ONLY,
  array: ARRAY,
  linkedlist: [{ label: 'title', insert: 'title ${1:Title}', snippet: true, detail: 'List title', doc: 'Top title; then values per line.' }],
  memory: MEMORY,
  page: PAGE,
  queue: QUEUE,
  cqueue: CQUEUE,
  deque: QUEUE,
  pqueue: PQUEUE,
  stack: STACK,
  hashmap: HASHMAP,
  matrix: MATRIX,
  nodegraph: NODEGRAPH,
  unionfind: UNIONFIND,
};
