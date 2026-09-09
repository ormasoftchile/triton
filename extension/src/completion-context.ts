import * as vscode from 'vscode';
import type { DiagramKind } from '../../src/contracts/index.js';
import { detect } from '../../src/frontend/detect.js';
import { headerLineIndex, frontmatterEnd } from './source-shape.js';
import { findTritonFences, type TritonFence } from './triton-fences.js';

export interface DiagramBlock {
  /** The full text of the diagram block. */
  readonly text: string;
  /** 0-based document line where the block starts. */
  readonly baseLine: number;
}

export interface DiagramSymbol {
  readonly name: string;
  readonly kind: vscode.CompletionItemKind;
  readonly detail: string;
}

export type LineContextType =
  | 'header'
  | 'frontmatter'
  | 'theme'
  | 'icon'
  | 'shape'
  | 'arrow-target'
  | 'body';

export interface DiagramContext {
  readonly blockText: string;
  readonly baseLine: number;
  readonly localLine: number;
  readonly localCol: number;
  readonly lineText: string;
  readonly linePrefix: string;
  readonly diagramType: DiagramKind;
  readonly contextType: LineContextType;
  /** The prefix or query typed so far for the context (e.g. icon name prefix, theme prefix, node prefix). */
  readonly query: string;
  /** Symbols defined in this diagram or cell. */
  readonly symbols: readonly DiagramSymbol[];
}

/**
 * Check if the document is a recognized diagram document (.triton, .mmd, or language triton/mermaid).
 */
export function isDiagramDocument(document: vscode.TextDocument): boolean {
  if (document.languageId === 'triton' || document.languageId === 'mermaid') return true;
  const path = document.uri.path.toLowerCase();
  return path.endsWith('.triton') || path.endsWith('.mmd');
}

/**
 * Locate the diagram block at `position`: either the whole document for a diagram file,
 * or the enclosing ```triton / ```mermaid fence in Markdown.
 */
export function resolveDiagramBlock(
  document: vscode.TextDocument,
  position: vscode.Position,
): DiagramBlock | undefined {
  if (isDiagramDocument(document)) {
    return { text: document.getText(), baseLine: 0 };
  }

  // Inside Markdown — find enclosing fence
  const fences = findTritonFences(document.getText());
  for (const f of fences) {
    if (position.line >= f.bodyStartLine && position.line < f.bodyEndLine) {
      return { text: f.body, baseLine: f.bodyStartLine };
    }
  }

  return undefined;
}

/** Regexes matching arrow/edge operators that point towards a target node/symbol. */
const ARROW_TARGET_PATTERN =
  /(?:-->|---|-\.->|==>|-~->|<-_->|<-~->|<-.->|<==>|<-->|->>|-->>|->|-x|--x|-\)|--\)|<\|--|\*--|o--|\.\.>|\.\.\|>|\|\|--o\{|\|\|--\|\{|\}\|--o\{|\}\|--\|\{|--|::)\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_-]*)$/;

/** Pattern detecting icon triggers like ::icon( or icon: */
const ICON_TRIGGER_PATTERN = /(?:::icon\(|icon:\s*|::icon\s+)([\w-]*)$/;

/** Pattern detecting theme property completion in frontmatter or %%{init}%% */
const THEME_PROPERTY_PATTERN = /(?:theme|themePreset|style)\s*:\s*["']?([\w-]*)$/;

/** Pattern detecting node shape open bracket */
const SHAPE_OPEN_PATTERN = /\b([A-Za-z0-9_-]+)\s*(\[|\(|\{|\{\{|\[\(|\[\[|\[\/|>)$/;

/**
 * Build the full context at `position` within the diagram block.
 */
export function analyzeDiagramContext(
  block: DiagramBlock,
  position: vscode.Position,
): DiagramContext {
  const lines = block.text.split(/\r?\n/);
  const localLine = Math.min(Math.max(0, position.line - block.baseLine), lines.length - 1);
  const lineText = lines[localLine] ?? '';
  const localCol = Math.min(position.character, lineText.length);
  const linePrefix = lineText.slice(0, localCol);

  // Check frontmatter
  const fmEnd = frontmatterEnd(lines);
  const isFrontmatter = fmEnd > 0 && localLine < fmEnd;

  // Header line index
  const headerIdx = headerLineIndex(lines);
  const isHeader = !isFrontmatter && localLine <= headerIdx;

  // Detect overall diagram kind
  const { diagramType } = detect(block.text);

  // If this is a poster, check if cursor is inside a cell containing a sub-diagram
  let activeKind = diagramType;
  let activeText = block.text;

  if (diagramType === 'poster') {
    const cell = findEnclosingPosterCell(lines, localLine);
    if (cell) {
      const cellKind = detect(cell.text).diagramType;
      if (cellKind && cellKind !== 'poster') {
        activeKind = cellKind;
        activeText = cell.text;
      }
    }
  }

  // Extract declared symbols from the active diagram
  const symbols = extractSymbols(activeKind, activeText);

  // Determine line context type
  let contextType: LineContextType = 'body';
  let query = '';

  if (isHeader) {
    contextType = 'header';
    query = linePrefix.trim();
  } else if (isFrontmatter) {
    const themeMatch = THEME_PROPERTY_PATTERN.exec(linePrefix);
    if (themeMatch) {
      contextType = 'theme';
      query = themeMatch[1] ?? '';
    } else {
      contextType = 'frontmatter';
      query = linePrefix.trim();
    }
  } else {
    // Check icon trigger
    const iconMatch = ICON_TRIGGER_PATTERN.exec(linePrefix);
    if (iconMatch) {
      contextType = 'icon';
      query = iconMatch[1] ?? '';
    } else {
      // Check arrow target
      const arrowMatch = ARROW_TARGET_PATTERN.exec(linePrefix);
      if (arrowMatch) {
        contextType = 'arrow-target';
        query = arrowMatch[1] ?? '';
      } else {
        // Check shape bracket open
        const shapeMatch = SHAPE_OPEN_PATTERN.exec(linePrefix);
        if (shapeMatch) {
          contextType = 'shape';
          query = shapeMatch[1] ?? '';
        } else {
          // Check %%{init: ... theme: ...}%%
          const initThemeMatch = THEME_PROPERTY_PATTERN.exec(linePrefix);
          if (initThemeMatch && linePrefix.includes('init')) {
            contextType = 'theme';
            query = initThemeMatch[1] ?? '';
          }
        }
      }
    }
  }

  return {
    blockText: block.text,
    baseLine: block.baseLine,
    localLine,
    localCol,
    lineText,
    linePrefix,
    diagramType: activeKind,
    contextType,
    query,
    symbols,
  };
}

/**
 * Helper to detect if cursor is within a `cell ... end` block inside a poster.
 */
function findEnclosingPosterCell(
  lines: readonly string[],
  localLine: number,
): { text: string; startLine: number; endLine: number } | undefined {
  let cellStart = -1;
  for (let i = localLine; i >= 0; i--) {
    const trimmed = lines[i]!.trim();
    if (trimmed.startsWith('cell ') || trimmed === 'cell') {
      cellStart = i;
      break;
    }
  }
  if (cellStart === -1) return undefined;

  let cellEnd = lines.length;
  for (let i = cellStart + 1; i < lines.length; i++) {
    const trimmed = lines[i]!.trim();
    if (trimmed === 'end' || trimmed.startsWith('cell ') || trimmed === 'cell') {
      cellEnd = i;
      break;
    }
  }

  if (localLine > cellStart && localLine <= cellEnd) {
    const cellLines = lines.slice(cellStart + 1, cellEnd);
    return {
      text: cellLines.join('\n'),
      startLine: cellStart + 1,
      endLine: cellEnd,
    };
  }

  return undefined;
}

/**
 * Extract declared symbols (node IDs, participants, states, classes, entities) from diagram text.
 */
export function extractSymbols(kind: DiagramKind, text: string): readonly DiagramSymbol[] {
  const symbols = new Map<string, DiagramSymbol>();

  const add = (name: string, symbolKind: vscode.CompletionItemKind, detail: string) => {
    const clean = name.trim();
    if (!clean || clean.length < 1 || clean === '[*]' || clean === 'end') return;
    if (!symbols.has(clean)) {
      symbols.set(clean, { name: clean, kind: symbolKind, detail });
    }
  };

  const lines = text.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('%%') || line.startsWith('---')) continue;

    switch (kind) {
      case 'flowchart': {
        // Node with label/shape: id[Label], id(Label), id{Label}, id[(Label)], etc.
        const nodeShapeRegex = /\b([A-Za-z0-9_-]+)\s*(?:\[|\(|\{|\{\{|\[\(|\[\[|\[\/|>)/g;
        let m: RegExpExecArray | null;
        while ((m = nodeShapeRegex.exec(line)) !== null) {
          const id = m[1]!;
          if (!isFlowchartKeyword(id)) {
            add(id, vscode.CompletionItemKind.Variable, 'Flowchart node');
          }
        }

        // Subgraph: subgraph id [Label]
        const subMatch = line.match(/^subgraph\s+([A-Za-z0-9_-]+)/);
        if (subMatch) {
          add(subMatch[1]!, vscode.CompletionItemKind.Module, 'Subgraph');
        }

        // Edges: A --> B, A --- B, etc.
        const edgeRegex =
          /\b([A-Za-z0-9_-]+)\s*(?:-->|---|==>|-\.->|-~->)\s*(?:\|[^|]*\|\s*)?([A-Za-z0-9_-]+)\b/g;
        while ((m = edgeRegex.exec(line)) !== null) {
          if (!isFlowchartKeyword(m[1]!)) add(m[1]!, vscode.CompletionItemKind.Variable, 'Flowchart node');
          if (!isFlowchartKeyword(m[2]!)) add(m[2]!, vscode.CompletionItemKind.Variable, 'Flowchart node');
        }
        break;
      }

      case 'sequence': {
        // participant id [as Label] or actor id [as Label]
        const partMatch = line.match(/^(?:participant|actor)\s+([A-Za-z0-9_-]+)/);
        if (partMatch) {
          add(partMatch[1]!, vscode.CompletionItemKind.Interface, 'Participant');
        }
        // Messages: A->>B: message, A-->>+B: message
        const msgMatch = line.match(/^([A-Za-z0-9_-]+)\s*(?:->>|-->>|->|-->|-x|--x|-\)|--\))\s*[+-]?\s*([A-Za-z0-9_-]+)/);
        if (msgMatch) {
          add(msgMatch[1]!, vscode.CompletionItemKind.Interface, 'Participant');
          add(msgMatch[2]!, vscode.CompletionItemKind.Interface, 'Participant');
        }
        break;
      }

      case 'state': {
        // state "label" as id, state id, state id {
        const stateAsMatch = line.match(/^state\s+"[^"]*"\s+as\s+([A-Za-z0-9_-]+)/);
        if (stateAsMatch) {
          add(stateAsMatch[1]!, vscode.CompletionItemKind.EnumMember, 'State');
        } else {
          const stateMatch = line.match(/^state\s+([A-Za-z0-9_-]+)/);
          if (stateMatch) {
            add(stateMatch[1]!, vscode.CompletionItemKind.EnumMember, 'State');
          }
        }
        // Transitions: A --> B
        const trMatch = line.match(/^([A-Za-z0-9_*-]+|\[\*\])\s*-->\s*([A-Za-z0-9_*-]+|\[\*\])/);
        if (trMatch) {
          if (trMatch[1] !== '[*]') add(trMatch[1]!, vscode.CompletionItemKind.EnumMember, 'State');
          if (trMatch[2] !== '[*]') add(trMatch[2]!, vscode.CompletionItemKind.EnumMember, 'State');
        }
        break;
      }

      case 'class': {
        // class Name {
        const clsMatch = line.match(/^class\s+([A-Za-z0-9_-]+)/);
        if (clsMatch) {
          add(clsMatch[1]!, vscode.CompletionItemKind.Class, 'Class');
        }
        // Relationships: A <|-- B
        const relMatch = line.match(/^([A-Za-z0-9_-]+)\s*(?:<\|--|--\|>|<\|\.\.|\.\.\|>|\*--|--\*|o--|--o|<--|-->|\.\.>|<\.\.|--|\.\.)\s*([A-Za-z0-9_-]+)/);
        if (relMatch) {
          add(relMatch[1]!, vscode.CompletionItemKind.Class, 'Class');
          add(relMatch[2]!, vscode.CompletionItemKind.Class, 'Class');
        }
        break;
      }

      case 'er': {
        // ENTITY {
        const entMatch = line.match(/^([A-Za-z0-9_-]+)\s*\{/);
        if (entMatch) {
          add(entMatch[1]!, vscode.CompletionItemKind.Struct, 'Entity');
        }
        // Relations: ENTITY1 ||--o{ ENTITY2
        const erRelMatch = line.match(/^([A-Za-z0-9_-]+)\s*(?:\|\||\|o|\|\{|\}o|\}\{|\}o|\}\|)\s*--\s*(?:\|\||o\{|\|\{|o\|)\s*([A-Za-z0-9_-]+)/);
        if (erRelMatch) {
          add(erRelMatch[1]!, vscode.CompletionItemKind.Struct, 'Entity');
          add(erRelMatch[2]!, vscode.CompletionItemKind.Struct, 'Entity');
        }
        break;
      }

      case 'c4': {
        const c4Match = line.match(/^(?:Person|Person_Ext|System|System_Ext|Container|ContainerDb|Component|Boundary)\s*\(\s*([A-Za-z0-9_-]+)/);
        if (c4Match) {
          add(c4Match[1]!, vscode.CompletionItemKind.Variable, 'C4 Element');
        }
        break;
      }

      case 'topology': {
        const topMatch = line.match(/^node\s+([A-Za-z0-9_-]+)\s*:/);
        if (topMatch) {
          add(topMatch[1]!, vscode.CompletionItemKind.Variable, 'Topology Node');
        }
        break;
      }

      case 'poster': {
        const cellMatch = line.match(/^cell\s+(?:\[[^\]]*\]\s*)?([A-Za-z0-9_-]+)/);
        if (cellMatch && !cellMatch[1]!.startsWith('"')) {
          add(cellMatch[1]!, vscode.CompletionItemKind.Module, 'Poster Cell');
        }
        break;
      }

      default:
        break;
    }
  }

  return Array.from(symbols.values());
}

function isFlowchartKeyword(word: string): boolean {
  return /^(?:flowchart|graph|subgraph|end|direction|TB|TD|BT|RL|LR|style|class|classDef|click|linkStyle)$/i.test(
    word,
  );
}
