import type { DiagramKind, InputFormat } from '../contracts/index.js';

export interface DetectionResult {
  readonly format: InputFormat;
  readonly diagramType: DiagramKind;
}

/**
 * Detect whether input is YAML or Mermaid, and which diagram type it is.
 * Returns the result without parsing — no grammar is invoked here.
 */
export function detect(input: string): DetectionResult {
  const trimmed = input.trimStart();

  // YAML: starts with --- (frontmatter) or has a `type:` key
  if (trimmed.startsWith('---') || /^type:\s/m.test(trimmed)) {
    const typeMatch = trimmed.match(/^type:\s*(\w+)/m);
    const diagramType = (typeMatch?.[1] ?? 'flowchart') as DiagramKind;
    return { format: 'yaml', diagramType };
  }

  // Mermaid: match first non-comment, non-whitespace token
  const mermaid: [RegExp, DiagramKind][] = [
    [/^(flowchart|graph)\s/i,                            'flowchart'],
    [/^sequenceDiagram/i,                                'sequence'],
    [/^timeline/i,                                       'timeline'],
    [/^mindmap/i,                                        'mindmap'],
    [/^stateDiagram/i,                                   'state'],
    [/^classDiagram/i,                                   'class'],
    [/^erDiagram/i,                                      'er'],
    [/^gantt/i,                                          'gantt'],
    [/^C4(Context|Container|Component|Dynamic|Deployment)/i, 'c4'],
    [/^sankey/i,                                         'sankey'],
    [/^kanban/i,                                         'kanban'],
    [/^requirement(Diagram)?/i,                          'requirement'],
    [/^gitGraph/i,                                       'gitgraph'],
    [/^packet/i,                                         'packet'],
    [/^block/i,                                          'block'],
    [/^architecture/i,                                   'architecture'],
    [/^pie\b/i,                                          'pie'],
    [/^xychart(-beta)?/i,                                'xychart'],
    [/^quadrantChart/i,                                  'quadrant'],
    [/^radar(-beta)?/i,                                  'radar'],
    [/^poster/i,                                         'poster'],
  ];

  for (const [pattern, type] of mermaid) {
    if (pattern.test(trimmed)) return { format: 'mermaid', diagramType: type };
  }

  return { format: 'mermaid', diagramType: 'flowchart' };
}
