import type { DiagramKind, InputFormat } from '../contracts/index.js';

export interface DetectionResult {
  readonly format: InputFormat;
  readonly diagramType: DiagramKind;
}

/**
 * Detect whether input is YAML or Mermaid, and which diagram type it is.
 * Returns the result without parsing — no grammar is invoked here.
 *
 * A leading `---` frontmatter block is allowed in front of Mermaid source
 * (e.g. gantt with title/theme); the diagram type is detected from the body
 * after the closing fence. Only a `type:` key without a Mermaid body routes
 * to the YAML path.
 */
const MERMAID_PATTERNS: [RegExp, DiagramKind][] = [
  [/^(flowchart|graph)\s/i,                            'flowchart'],
  [/^sequenceDiagram/i,                                'sequence'],
  [/^timeline/i,                                       'timeline'],
  [/^mindmap/i,                                        'mindmap'],
  [/^stateDiagram/i,                                   'state'],
  [/^classDiagram/i,                                   'class'],
  [/^erDiagram/i,                                      'er'],
  [/^gantt/i,                                          'gantt'],
  [/^journey/i,                                        'journey'],
  [/^C4(Context|Container|Component|Dynamic|Deployment)/i, 'c4'],
  [/^sankey/i,                                         'sankey'],
  [/^kanban/i,                                         'kanban'],
  [/^requirement(Diagram)?/i,                          'requirement'],
  [/^gitGraph/i,                                       'gitgraph'],
  [/^packet/i,                                         'packet'],
  [/^pie\b/i,                                          'pie'],
  [/^xychart(-beta)?/i,                                'xychart'],
  [/^quadrantChart/i,                                  'quadrant'],
  [/^radar(-beta)?/i,                                  'radar'],
  [/^block/i,                                          'block'],
  [/^architecture/i,                                   'architecture'],
  [/^poster/i,                                         'poster'],
  [/^tree\b/i,                                          'tree'],
  [/^plan\b/i,                                          'plan'],
  [/^avl\b/i,                                           'avl'],
  [/^rbtree\b/i,                                        'rbtree'],
  [/^btree\b/i,                                         'btree'],
  [/^radix\b/i,                                         'radix'],
  [/^segtree\b/i,                                       'segtree'],
  [/^heap\b/i,                                          'heap'],
  [/^array\b/i,                                        'array'],
  [/^linkedlist\b/i,                                   'linkedlist'],
  [/^memory\b/i,                                       'memory'],
  [/^page\b/i,                                         'page'],
  [/^cqueue\b/i,                                       'cqueue'],
  [/^deque\b/i,                                        'deque'],
  [/^pqueue\b/i,                                       'pqueue'],
  [/^queue\b/i,                                        'queue'],
  [/^stack\b/i,                                        'stack'],
  [/^hashmap\b/i,                                      'hashmap'],
  [/^matrix\b/i,                                       'matrix'],
  [/^topology\b/i,                                     'topology'],
];

function matchMermaid(text: string): DiagramKind | undefined {
  for (const [pattern, type] of MERMAID_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return undefined;
}

export function detect(input: string): DetectionResult {
  const trimmed = input.trimStart();

  // Frontmatter block (--- … ---): peek at the body for a Mermaid keyword.
  if (trimmed.startsWith('---')) {
    const fm = trimmed.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
    if (fm) {
      const body = trimmed.slice(fm[0].length).trimStart();
      const bodyType = matchMermaid(body);
      if (bodyType) return { format: 'mermaid', diagramType: bodyType };
      const typeInFm = fm[0].match(/^\s*type:\s*(\w+)/m);
      if (typeInFm) return { format: 'yaml', diagramType: typeInFm[1] as DiagramKind };
    }
    const typeMatch = trimmed.match(/^type:\s*(\w+)/m);
    return { format: 'yaml', diagramType: (typeMatch?.[1] ?? 'flowchart') as DiagramKind };
  }

  // YAML with a leading `type:` key (first line only — avoid matching a
  // `type:` field inside a diagram body, e.g. requirement element blocks).
  if (/^type:\s/.test(trimmed)) {
    const typeMatch = trimmed.match(/^type:\s*(\w+)/);
    return { format: 'yaml', diagramType: (typeMatch?.[1] ?? 'flowchart') as DiagramKind };
  }

  // Mermaid: match the first non-comment, non-whitespace token.
  return { format: 'mermaid', diagramType: matchMermaid(trimmed) ?? 'flowchart' };
}
