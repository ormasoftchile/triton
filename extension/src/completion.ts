import * as vscode from 'vscode';
import { detect } from '../../src/frontend/detect.js';
import { themePresetNames } from '../../src/theme/preset.js';
import type { ThemeRegistry } from './theme-registry.js';
import type { IconRegistry } from './icon-registry.js';
import {
  DIAGRAM_HEADERS,
  KIND_KEYWORDS,
  FLOWCHART_SHAPES,
  FLOWCHART_ARROWS,
  SEQUENCE_ARROWS,
  FRONTMATTER_KEYS,
  type KeywordEntry,
  type ShapeSnippet,
} from './keywords.js';
import {
  resolveDiagramBlock,
  analyzeDiagramContext,
  type DiagramContext,
  type DiagramSymbol,
} from './completion-context.js';

/**
 * Intelligent completion provider for Triton diagrams across:
 *  • .triton files
 *  • .mmd files (Mermaid diagrams)
 *  • ```triton and ```mermaid fences in Markdown
 *
 * Context-aware dispatch:
 *  1. Header position → diagram headers (flowchart LR, sequenceDiagram, poster, etc.)
 *  2. Frontmatter / %%{init}%% → theme presets & config keys
 *  3. After arrow/edge operators (--> , ->> , etc.) → defined symbols (nodes, participants, states)
 *  4. After shape open brackets ([ , (( , etc.) → shape templates
 *  5. After ::icon( or icon: → available icons from IconRegistry
 *  6. General body → declared symbols, per-kind keywords, and arrow snippets
 */
export class TritonCompletionProvider implements vscode.CompletionItemProvider {
  constructor(
    private readonly themeRegistry?: ThemeRegistry,
    private readonly iconRegistry?: IconRegistry,
  ) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
  ): vscode.CompletionItem[] | undefined {
    const block = resolveDiagramBlock(document, position);
    if (!block) return undefined;

    const ctx = analyzeDiagramContext(block, position);

    switch (ctx.contextType) {
      case 'header':
        return this.headerCompletions();

      case 'frontmatter':
        return this.frontmatterCompletions();

      case 'theme':
        return this.themeCompletions();

      case 'icon':
        return this.iconCompletions();

      case 'shape':
        return this.shapeCompletions(ctx);

      case 'arrow-target':
        return this.arrowTargetCompletions(ctx);

      case 'body':
      default:
        return this.bodyCompletions(ctx);
    }
  }

  // ─── 1. Header position ───────────────────────────────────────────────────

  private headerCompletions(): vscode.CompletionItem[] {
    return DIAGRAM_HEADERS.map((h) => {
      const item = new vscode.CompletionItem(h.insert, vscode.CompletionItemKind.Class);
      item.insertText = h.insert;
      item.detail = h.detail;
      item.documentation = new vscode.MarkdownString(h.doc);
      item.sortText = `0_${h.insert}`;
      return item;
    });
  }

  // ─── 2. Frontmatter & Config ──────────────────────────────────────────────

  private frontmatterCompletions(): vscode.CompletionItem[] {
    return FRONTMATTER_KEYS.map((k) => keywordItem(k, '0'));
  }

  private themeCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Built-in presets
    for (const name of themePresetNames) {
      const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Color);
      item.detail = `Triton preset: ${name}`;
      item.documentation = new vscode.MarkdownString(`Apply built-in **${name}** theme.`);
      item.sortText = `0_${name}`;
      items.push(item);
    }

    // Custom external themes loaded in workspace
    if (this.themeRegistry) {
      for (const customName of this.themeRegistry.customNames()) {
        const item = new vscode.CompletionItem(customName, vscode.CompletionItemKind.Color);
        item.detail = `Custom theme: ${customName}`;
        item.documentation = new vscode.MarkdownString(`Apply workspace theme from \`.triton/themes/\`.`);
        item.sortText = `0_custom_${customName}`;
        items.push(item);
      }
    }

    return items;
  }

  // ─── 3. Icons ─────────────────────────────────────────────────────────────

  private iconCompletions(): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];
    if (!this.iconRegistry) return items;

    const packs = this.iconRegistry.iconPacks();
    for (const [prefix, pack] of packs) {
      if (!pack.icons) continue;
      for (const iconName of Object.keys(pack.icons)) {
        const fullId = `${prefix}:${iconName}`;
        const item = new vscode.CompletionItem(fullId, vscode.CompletionItemKind.Value);
        item.insertText = fullId;
        item.detail = `Icon from ${prefix}`;
        item.documentation = new vscode.MarkdownString(
          `Icon **\`${fullId}\`** from pack \`${prefix}\`.\n\nUse inside \`::icon(${fullId})\`.`,
        );
        items.push(item);
      }
    }

    return items;
  }

  // ─── 4. Shapes ────────────────────────────────────────────────────────────

  private shapeCompletions(ctx: DiagramContext): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    if (ctx.diagramType === 'flowchart') {
      for (const s of FLOWCHART_SHAPES) {
        items.push(shapeItem(s));
      }
    }

    return items;
  }

  // ─── 5. Arrow Target (Connecting to symbols) ───────────────────────────────

  private arrowTargetCompletions(ctx: DiagramContext): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // Prioritize declared symbols in this diagram
    for (const s of ctx.symbols) {
      items.push(symbolItem(s, '0'));
    }

    // If no symbols defined yet, offer sensible defaults
    if (items.length === 0) {
      if (ctx.diagramType === 'sequence') {
        items.push(new vscode.CompletionItem('Client', vscode.CompletionItemKind.Interface));
        items.push(new vscode.CompletionItem('Server', vscode.CompletionItemKind.Interface));
      } else {
        items.push(new vscode.CompletionItem('Target', vscode.CompletionItemKind.Variable));
      }
    }

    return items;
  }

  // ─── 6. General Body Completions ──────────────────────────────────────────

  private bodyCompletions(ctx: DiagramContext): vscode.CompletionItem[] {
    const items: vscode.CompletionItem[] = [];

    // 1. Declared symbols (high priority for reuse)
    for (const s of ctx.symbols) {
      items.push(symbolItem(s, '1'));
    }

    // 2. Per-kind body keywords and snippets
    const entries = KIND_KEYWORDS[ctx.diagramType];
    if (entries) {
      for (const e of entries) {
        items.push(keywordItem(e, '2'));
      }
    }

    // 3. Diagram-specific operator / arrow completions
    if (ctx.diagramType === 'flowchart') {
      for (const a of FLOWCHART_ARROWS) {
        items.push(keywordItem(a, '3'));
      }
      for (const s of FLOWCHART_SHAPES) {
        items.push(shapeItem(s, '4'));
      }
    } else if (ctx.diagramType === 'sequence') {
      for (const a of SEQUENCE_ARROWS) {
        items.push(keywordItem(a, '3'));
      }
    }

    return items;
  }
}

function symbolItem(s: DiagramSymbol, sortPriority = '0'): vscode.CompletionItem {
  const item = new vscode.CompletionItem(s.name, s.kind);
  item.detail = s.detail;
  item.sortText = `${sortPriority}_${s.name}`;
  return item;
}

function keywordItem(e: KeywordEntry, sortPriority = '2'): vscode.CompletionItem {
  const kind = e.snippet ? vscode.CompletionItemKind.Snippet : vscode.CompletionItemKind.Keyword;
  const item = new vscode.CompletionItem(e.label, kind);
  if (e.snippet && e.insert) {
    item.insertText = new vscode.SnippetString(e.insert);
  } else if (e.insert) {
    item.insertText = e.insert;
  }
  item.detail = e.detail;
  if (e.doc) item.documentation = new vscode.MarkdownString(e.doc);
  item.sortText = `${sortPriority}_${e.label}`;
  return item;
}

function shapeItem(s: ShapeSnippet, sortPriority = '0'): vscode.CompletionItem {
  const item = new vscode.CompletionItem(s.label, vscode.CompletionItemKind.Snippet);
  item.insertText = new vscode.SnippetString(s.insert);
  item.detail = s.detail;
  item.sortText = `${sortPriority}_${s.label}`;
  return item;
}

const TRIGGER_CHARACTERS = ['-', '>', ':', '[', '(', '{', '@', '%', ' ', ',', '.', '"', '|'];

const DIAGRAM_SELECTORS: vscode.DocumentSelector = [
  { language: 'triton' },
  { language: 'mermaid' },
  { language: 'markdown' },
  { pattern: '**/*.triton' },
  { pattern: '**/*.mmd' },
];

/**
 * Register the universal completion provider for Triton and Mermaid diagrams.
 */
export function registerCompletion(
  context: vscode.ExtensionContext,
  themeRegistry?: ThemeRegistry,
  iconRegistry?: IconRegistry,
): void {
  const provider = new TritonCompletionProvider(themeRegistry, iconRegistry);
  context.subscriptions.push(
    vscode.languages.registerCompletionItemProvider(
      DIAGRAM_SELECTORS,
      provider,
      ...TRIGGER_CHARACTERS,
    ),
  );
}
