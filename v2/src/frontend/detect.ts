/**
 * Frontend — Input format detection and dispatch.
 *
 * Determines whether input is YAML or Mermaid text, detects the
 * diagram type, and routes to the appropriate parser/compiler.
 */

export type DiagramType =
  | 'flowchart'
  | 'sequence'
  | 'timeline'
  | 'mindmap'
  | 'state'
  | 'class'
  | 'er'
  | 'gantt'
  | 'c4'
  | 'sankey'
  | 'kanban'
  | 'requirement'
  | 'gitgraph'
  | 'packet'
  | 'block'
  | 'architecture';

export type InputFormat = 'mermaid' | 'yaml';

export interface DetectionResult {
  format: InputFormat;
  diagramType: DiagramType;
}

/**
 * Detect the input format and diagram type from raw text.
 */
export function detect(input: string): DetectionResult {
  const trimmed = input.trimStart();

  // YAML detection: starts with --- (frontmatter) or has YAML structure
  if (trimmed.startsWith('---') || /^\w+:\s/m.test(trimmed)) {
    // For YAML, detect type from `type:` field or file extension
    const typeMatch = trimmed.match(/^type:\s*(\w+)/m);
    const diagramType = (typeMatch?.[1] ?? 'flowchart') as DiagramType;
    return { format: 'yaml', diagramType };
  }

  // Mermaid detection: match first keyword
  const mermaidPatterns: [RegExp, DiagramType][] = [
    [/^(flowchart|graph)\s/i, 'flowchart'],
    [/^sequenceDiagram/i, 'sequence'],
    [/^timeline/i, 'timeline'],
    [/^mindmap/i, 'mindmap'],
    [/^stateDiagram/i, 'state'],
    [/^classDiagram/i, 'class'],
    [/^erDiagram/i, 'er'],
    [/^gantt/i, 'gantt'],
    [/^C4(Context|Container|Component|Dynamic|Deployment)/i, 'c4'],
    [/^sankey/i, 'sankey'],
    [/^kanban/i, 'kanban'],
    [/^requirement(Diagram)?/i, 'requirement'],
    [/^gitGraph/i, 'gitgraph'],
    [/^packet/i, 'packet'],
    [/^block/i, 'block'],
    [/^architecture/i, 'architecture'],
  ];

  for (const [pattern, type] of mermaidPatterns) {
    if (pattern.test(trimmed)) {
      return { format: 'mermaid', diagramType: type };
    }
  }

  // Default
  return { format: 'mermaid', diagramType: 'flowchart' };
}
