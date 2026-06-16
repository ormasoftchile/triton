/**
 * @file frontend/mermaid/poster.ts — Poster DSL parser and composition-theme factories.
 *
 * Implements §17.2 "Composition / Posters" — the `poster` top-level keyword.
 * A poster document composes multiple embedded diagrams into a single themed
 * grid layout, rendered via the composition engine (composition/index.ts).
 *
 * Syntax supported:
 * ```
 * ---
 * theme: executive
 * layout: grid 2x2
 * ---
 * poster "RAG Architecture"
 *   cell [0,0]: flowchart LR        ← bracket form (0-indexed row, col)
 *     A[Query] --> B[Retriever] --> C[Generator]
 *   cell A1: flowchart LR           ← Excel form (equivalent to cell [0,0])
 *     A[Query] --> B[Retriever]
 *   cell [0,1]: sequenceDiagram
 *     User->>API: request
 *   cell B1: sequenceDiagram        ← Excel form (equivalent to cell [0,1])
 *     User->>API: request
 * ```
 *
 * Cell address forms (both valid, mixable within one poster):
 *  - Bracket:  `cell [row, col]:` — 0-indexed row then col.
 *  - Excel:    `cell A1:` — column letter(s) then 1-indexed row number.
 *              Column letters use bijective base-26 (A=0, B=1, …, Z=25, AA=26, …).
 *              Row number is 1-indexed (row 1 → internal row 0).
 *              So A1≡[0,0], B1≡[0,1], A2≡[1,0], AA1≡[0,26].
 *
 * Design notes:
 *  - `parsePosterInternal` is pure: no I/O, no imports from index.ts.
 *  - Composition-theme factories (`buildCompositionThemeFor`) map contract
 *    theme names → CompositionTheme without touching the composition registry.
 *  - No circular dependency: this file does NOT import from index.ts.
 */

import type { CompositionTheme } from '../../composition/theme.js';
import { resolveCompositionTheme } from '../../composition/theme.js';
import { isContractTheme } from '../../theme-contract/index.js';
import { preprocessMermaid } from './utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PosterCellDef {
  /** 0-indexed row position. */
  row: number;
  /** 0-indexed column position. */
  col: number;
  /**
   * The diagram type header (everything after `cell [r,c]:`).
   * E.g. `"flowchart LR"`, `"sequenceDiagram"`, `"mindmap"`.
   * This is used as the first line when rendering the cell.
   */
  typeHeader: string;
  /**
   * De-indented body lines joined by `\n`.
   * The base indentation of the first non-empty line is stripped from all lines.
   */
  body: string;
}

/** Domain IR produced by the poster parser. */
export interface PosterDocument {
  /** Poster title (from `poster "…"` header). */
  title: string;
  /** Theme name from frontmatter, if present. */
  theme: string | undefined;
  /** Column count from `layout: grid RxC`, or derived from cell positions. */
  columns: number;
  /** Row count from `layout: grid RxC`, or `undefined` (derived by layout engine). */
  rows: number | undefined;
  /** Parsed cells in declaration order. */
  cells: PosterCellDef[];
  /** Cross-diagram links declared in this poster (§30b Phase A). */
  links: PosterLink[];
}

// ---------------------------------------------------------------------------
// PosterLink — §30b Phase A cross-diagram link
// ---------------------------------------------------------------------------

/** Edge style for a cross-diagram link (matches Mermaid edge style vocabulary). */
export type PosterLinkEdgeStyle = '-->' | '---' | '-.->' | '-.-' | '-..';

/**
 * A single cross-diagram link between two nodes in different cells.
 *
 * Syntax: `link <cellAddr>.<nodeId> <edge> <cellAddr>.<nodeId> [: "label"]`
 *
 * Graceful degradation: unresolvable links (unknown cell, unknown node, or
 * grammar without anchor support) emit a WARNING and are skipped at render time.
 */
export interface PosterLink {
  /** Source cell address (0-indexed). */
  fromCell: { row: number; col: number };
  /** Node id in the source cell's diagram (as authored in the source). */
  fromNodeId: string;
  /** Edge style. */
  edgeStyle: PosterLinkEdgeStyle;
  /** Target cell address (0-indexed). */
  toCell: { row: number; col: number };
  /** Node id in the target cell's diagram (as authored in the source). */
  toNodeId: string;
  /** Optional label displayed at the midpoint of the overlay edge. */
  label?: string;
}

// ---------------------------------------------------------------------------
// parsePosterInternal
// ---------------------------------------------------------------------------

/** Cell header — bracket form: `  cell [row,col]: typeHeader` */
const CELL_HEADER_RE = /^(\s*)cell\s*\[(\d+)\s*,\s*(\d+)\]\s*:\s*(.+)$/i;

/**
 * Cell header — Excel form: `  cell A1: typeHeader`
 * Capture groups: (indent)(colLetters)(rowNumber)(typeHeader)
 */
const CELL_HEADER_EXCEL_RE = /^(\s*)cell\s+([A-Za-z]+)(\d+)\s*:\s*(.+)$/i;

/** Detects any line starting with the `cell` keyword (used for malformed-address warning). */
const CELL_KEYWORD_RE = /^(\s*)cell\s/i;

/** Poster title regex: `poster "Title"` or `poster Title` */
const POSTER_TITLE_RE = /^poster\s+"([^"]+)"\s*$|^poster\s+'([^']+)'\s*$|^poster\s+(.+)$/i;

/** Grid layout regex: `grid 2x2` or `grid 2 x 2` */
const GRID_RE = /^grid\s+(\d+)\s*[xX×]\s*(\d+)\s*$/;

/**
 * Cross-diagram link regex.
 *
 * Matches: `link <cellAddr>.<nodeId> <edge> <cellAddr>.<nodeId> [: "label"]`
 *
 * Edge styles: --> --- -.-> -.- -..
 * Cell address: bracket [r,c] OR Excel A1 (col letters + row digit).
 *
 * Capture groups (both bracket + Excel forms handle `<addr>.<nodeId>`):
 *   Group 1:  fromAddr  — e.g. "[0,1]" or "A1"
 *   Group 2:  fromNode  — node id in that cell
 *   Group 3:  edgeStyle — one of --> | --- | -.-> | -.- | -..
 *   Group 4:  toAddr    — e.g. "[0,2]" or "B1"
 *   Group 5:  toNode    — node id in that cell
 *   Group 6:  label     — optional, inside quotes (may be absent)
 */
const LINK_RE =
  /^link\s+(\[[^\]]+\]|[A-Za-z]+\d+)\.(\S+)\s+(-->|---|-->|-\.->|-\.-|--\.)\s+(\[[^\]]+\]|[A-Za-z]+\d+)\.(\S+)(?:\s*:\s*"([^"]*)")?/i;

/** Edge style normaliser — maps raw match to PosterLinkEdgeStyle. */
const EDGE_STYLE_MAP: Record<string, PosterLinkEdgeStyle> = {
  '-->': '-->',
  '---': '---',
  '-..': '-..',
  '-.-': '-.-',
  '-.->': '-.->',
  // Tolerate alternative spellings
  '--->': '-->',
  '---.': '-.-',
};

// ---------------------------------------------------------------------------
// Excel address helpers
// ---------------------------------------------------------------------------

/**
 * Convert an Excel-style cell address to 0-indexed {row, col}.
 *
 * Column letters use bijective base-26 (A=0, B=1, …, Z=25, AA=26, …).
 * Row number is 1-indexed in Excel; we convert to 0-indexed.
 *
 * Examples: excelToRowCol("A","1")→{row:0,col:0}, excelToRowCol("AA","1")→{row:0,col:26}.
 */
export function excelToRowCol(colLetters: string, rowNum: string): { row: number; col: number } {
  let col = 0;
  for (const ch of colLetters.toUpperCase()) {
    col = col * 26 + (ch.charCodeAt(0) - 65 /* 'A' */ + 1);
  }
  col -= 1; // bijective base-26 → 0-indexed
  const row = parseInt(rowNum, 10) - 1; // 1-indexed → 0-indexed
  return { row, col };
}

/**
 * Parse a raw cell address string (bracket `[r,c]` or Excel `A1`) into
 * 0-indexed {row, col}.  Returns `null` for unrecognised formats.
 */
function addrToRowCol(addr: string): { row: number; col: number } | null {
  const bracketM = /^\[(\d+)\s*,\s*(\d+)\]$/.exec(addr.trim());
  if (bracketM) {
    return { row: parseInt(bracketM[1]!, 10), col: parseInt(bracketM[2]!, 10) };
  }
  const excelM = /^([A-Za-z]+)(\d+)$/.exec(addr.trim());
  if (excelM) {
    return excelToRowCol(excelM[1]!, excelM[2]!);
  }
  return null;
}

/**
 * Parse raw poster DSL text into a `PosterDocument`.
 *
 * Parses frontmatter (`theme:`, `layout:`), the `poster "Title"` header,
 * and all `cell [row,col]: typeHeader` blocks with their indented bodies.
 *
 * Non-fatal issues are collected in `warnings`. No exception is thrown for
 * malformed cell headers or unknown fields — graceful degradation is handled
 * at render time (unknown cell types log a warning and are skipped).
 */
export function parsePosterInternal(text: string): {
  doc: PosterDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
} {
  const warnings: string[] = [];

  // Step 1: Extract frontmatter + cleaned body
  const { body, frontmatter } = preprocessMermaid(text);

  // Step 2: Parse theme + layout from frontmatter
  const fmTheme  = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmLayout = typeof frontmatter['layout'] === 'string' ? frontmatter['layout'] : undefined;

  let columns = 2;
  let rows: number | undefined;

  if (fmLayout) {
    const m = GRID_RE.exec(fmLayout.trim());
    if (m) {
      columns = parseInt(m[1]!, 10);
      rows    = parseInt(m[2]!, 10);
    } else {
      warnings.push(`[poster] Unrecognised layout "${fmLayout}". Expected "grid RxC". Using 2x2.`);
    }
  }

  // Step 3: Walk the body lines
  const lines = body.split('\n');

  let title = 'Untitled Poster';
  const cells: PosterCellDef[] = [];
  const links: PosterLink[] = [];

  // Parser state
  let currentCell: { row: number; col: number; typeHeader: string; rawLines: string[] } | null = null;
  let foundPosterLine = false;

  const flushCurrentCell = () => {
    if (!currentCell) return;
    const deindented = deindentLines(currentCell.rawLines);
    cells.push({
      row: currentCell.row,
      col: currentCell.col,
      typeHeader: currentCell.typeHeader,
      body: deindented,
    });
    currentCell = null;
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();

    // Skip pure blank lines at the top before we find `poster`
    if (!foundPosterLine && trimmed.trim() === '') continue;

    // Detect poster title line
    if (!foundPosterLine) {
      const m = POSTER_TITLE_RE.exec(trimmed.trim());
      if (m) {
        title = (m[1] ?? m[2] ?? m[3] ?? 'Untitled Poster').trim();
        foundPosterLine = true;
        continue;
      }
      // Skip non-poster lines before we find the poster keyword
      continue;
    }

    // ── Detect `link` statement (§30b Phase A) ────────────────────────────
    // `link` is a top-level poster directive at position 0 (same level as `cell`).
    // We detect it by the absence of leading whitespace in `trimmed` (which is
    // only trailing-stripped).  When a valid LINK_RE match is found, flush the
    // current cell and process the link.  If the line starts with `link` at
    // position 0 but does NOT match LINK_RE, it is a malformed link → warn + skip.
    // Indented `link` inside a cell body falls through to the body collector.
    const isTopLevelLink = /^link\s/i.test(trimmed); // no leading whitespace → top level
    if (isTopLevelLink) {
      const linkM = LINK_RE.exec(trimmed.trim());
      if (linkM) {
        // Valid link — flush any open cell then process.
        flushCurrentCell();

        const fromAddr = linkM[1]!;
        const fromNode = linkM[2]!;
        const rawEdge  = linkM[3]!;
        const toAddr   = linkM[4]!;
        const toNode   = linkM[5]!;
        const label    = linkM[6]; // may be undefined

        const fromCellAddr = addrToRowCol(fromAddr);
        const toCellAddr   = addrToRowCol(toAddr);

        if (!fromCellAddr) {
          warnings.push(`[poster] link: unrecognised source address "${fromAddr}" — skipped.`);
        } else if (!toCellAddr) {
          warnings.push(`[poster] link: unrecognised target address "${toAddr}" — skipped.`);
        } else {
          const edgeStyle: PosterLinkEdgeStyle =
            (EDGE_STYLE_MAP[rawEdge] ?? '-->') as PosterLinkEdgeStyle;
          const linkRecord: PosterLink = {
            fromCell: fromCellAddr,
            fromNodeId: fromNode,
            edgeStyle,
            toCell: toCellAddr,
            toNodeId: toNode,
          };
          if (label !== undefined) linkRecord.label = label;
          links.push(linkRecord);
        }
      } else {
        // Malformed top-level link → flush open cell, warn, skip.
        flushCurrentCell();
        warnings.push(`[poster] Unrecognised link statement: "${trimmed.trim()}" — skipped.`);
      }
      continue;
    }

    // Detect cell header — try bracket form first, then Excel form.
    const cellM = CELL_HEADER_RE.exec(trimmed);
    if (cellM) {
      flushCurrentCell();
      const row        = parseInt(cellM[2]!, 10);
      const col        = parseInt(cellM[3]!, 10);
      const typeHeader = (cellM[4] ?? '').trim();
      currentCell = { row, col, typeHeader, rawLines: [] };
      continue;
    }

    const excelM = CELL_HEADER_EXCEL_RE.exec(trimmed);
    if (excelM) {
      flushCurrentCell();
      const { row, col } = excelToRowCol(excelM[2]!, excelM[3]!);
      const typeHeader   = (excelM[4] ?? '').trim();
      currentCell = { row, col, typeHeader, rawLines: [] };
      continue;
    }

    // Line starts with `cell` keyword but matched neither valid form → warn + skip.
    if (CELL_KEYWORD_RE.test(trimmed)) {
      warnings.push(`[poster] Unrecognised cell address in: "${trimmed.trim()}". Use "cell [row,col]:" or "cell A1:" form. Skipping.`);
      flushCurrentCell();
      continue;
    }

    // If inside a cell, collect the body line
    if (currentCell) {
      currentCell.rawLines.push(trimmed);
    }
    // Lines between poster title and first cell are silently ignored
  }

  // Flush last cell
  flushCurrentCell();

  // Derive columns from cell positions if not specified in frontmatter
  if (!fmLayout && cells.length > 0) {
    const maxCol = cells.reduce((m, c) => Math.max(m, c.col), 0);
    columns = maxCol + 1;
  }

  if (cells.length === 0) {
    warnings.push('[poster] No cells found in poster document.');
  }

  const doc: PosterDocument = { title, theme: fmTheme, columns, rows, cells, links };
  return { doc, warnings, frontmatter };
}

// ---------------------------------------------------------------------------
// De-indentation helper
// ---------------------------------------------------------------------------

/**
 * Strip the common leading indentation from an array of raw (non-trimmed) lines.
 * Empty-only lines are preserved but excluded from indentation measurement.
 */
function deindentLines(lines: string[]): string {
  // Measure minimum indentation of non-empty lines
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim() === '') continue;
    const indent = line.length - line.trimStart().length;
    if (indent < minIndent) minIndent = indent;
  }
  if (minIndent === Infinity) minIndent = 0;

  return lines
    .map((line) => (line.trim() === '' ? '' : line.slice(minIndent)))
    .join('\n')
    .trimEnd();
}

// ---------------------------------------------------------------------------
// Composition-theme factories — one per contract theme
// ---------------------------------------------------------------------------

/**
 * Derive a `CompositionTheme` that visually matches the named contract theme.
 * This ensures the poster chrome (header, cell title bars, canvas background)
 * shares the same design language as the diagram cells inside each panel.
 *
 * For non-contract names, falls through to the composition theme registry.
 */
export function buildCompositionThemeFor(themeName: string | undefined): CompositionTheme {
  if (!isContractTheme(themeName)) {
    return resolveCompositionTheme(themeName);
  }
  switch (themeName) {
    case 'executive':  return EXECUTIVE_COMPOSITION_THEME;
    case 'midnight':   return MIDNIGHT_COMPOSITION_THEME;
    case 'blueprint':  return BLUEPRINT_COMPOSITION_THEME;
    case 'editorial':  return EDITORIAL_COMPOSITION_THEME;
    case 'terminal':   return TERMINAL_COMPOSITION_THEME;
    case 'pastel':     return PASTEL_COMPOSITION_THEME;
    case 'mono':       return MONO_COMPOSITION_THEME;
    default:           return resolveCompositionTheme(undefined);
  }
}

// ── executive — white canvas, navy accent, Georgia serif ───────────────────
const EXECUTIVE_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#FFFFFF',
  gap: 16,
  padding: 24,
  cellBackground: '#F8F9FB',
  cellBorder: { color: '#1F497D', width: 1, radius: 6 },
  cellPadding: 12,
  cellTitleFont: { family: 'Georgia, serif', size: 12, weight: 700, color: '#FFFFFF' },
  cellTitleHeight: 28,
  cellTitleBackground: '#1F497D',
  posterTitleFont: { family: 'Georgia, serif', size: 24, weight: 700, color: '#FFFFFF' },
  posterHeaderHeight: 60,
  posterHeaderBackground: '#1F497D',
  statValueFont: { family: 'Georgia, serif', size: 44, weight: 700, color: '#1F497D' },
  statLabelFont: { family: 'Georgia, serif', size: 13, weight: 400, color: '#666666' },
  cellVAlign: 'top',
  cellHAlign: 'center',
  rowSizing: 'content',
  textFont: { family: 'Georgia, serif', size: 13, weight: 400, color: '#333333' },
  titleFont: { family: 'Georgia, serif', size: 18, weight: 700, color: '#1F497D' },
};

// ── midnight — near-black canvas, indigo accent, Inter sans ────────────────
const MIDNIGHT_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#0A0E1A',
  gap: 16,
  padding: 24,
  cellBackground: '#111827',
  cellBorder: { color: '#6366F1', width: 1, radius: 8 },
  cellPadding: 12,
  cellTitleFont: { family: 'Inter, sans-serif', size: 12, weight: 600, color: '#E0E7FF' },
  cellTitleHeight: 28,
  cellTitleBackground: '#1E1B4B',
  posterTitleFont: { family: 'Inter, sans-serif', size: 22, weight: 700, color: '#E0E7FF' },
  posterHeaderHeight: 56,
  posterHeaderBackground: '#1E1B4B',
  statValueFont: { family: 'Inter, sans-serif', size: 44, weight: 700, color: '#818CF8' },
  statLabelFont: { family: 'Inter, sans-serif', size: 13, weight: 400, color: '#94A3B8' },
  cellVAlign: 'top',
  cellHAlign: 'center',
  rowSizing: 'content',
  textFont: { family: 'Inter, sans-serif', size: 13, weight: 400, color: '#CBD5E1' },
  titleFont: { family: 'Inter, sans-serif', size: 18, weight: 700, color: '#E0E7FF' },
};

// ── blueprint — deep-blue canvas, cyan accent, monospace ───────────────────
const BLUEPRINT_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#0A1628',
  gap: 16,
  padding: 24,
  cellBackground: '#0F2040',
  cellBorder: { color: '#00A8E8', width: 1, radius: 4 },
  cellPadding: 12,
  cellTitleFont: { family: "'Courier New', monospace", size: 12, weight: 700, color: '#00A8E8' },
  cellTitleHeight: 28,
  cellTitleBackground: '#050D1A',
  posterTitleFont: { family: "'Courier New', monospace", size: 22, weight: 700, color: '#00A8E8' },
  posterHeaderHeight: 56,
  posterHeaderBackground: '#050D1A',
  statValueFont: { family: "'Courier New', monospace", size: 44, weight: 700, color: '#00A8E8' },
  statLabelFont: { family: "'Courier New', monospace", size: 12, weight: 400, color: '#5B8DB8' },
  cellVAlign: 'top',
  cellHAlign: 'center',
  rowSizing: 'content',
  textFont: { family: "'Courier New', monospace", size: 12, weight: 400, color: '#7EB8E0' },
  titleFont: { family: "'Courier New', monospace", size: 18, weight: 700, color: '#00A8E8' },
};

// ── editorial — cream canvas, burgundy accent, Garamond serif ──────────────
const EDITORIAL_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#FDFBF5',
  gap: 16,
  padding: 24,
  cellBackground: '#FFFFFF',
  cellBorder: { color: '#A0522D', width: 1, radius: 4 },
  cellPadding: 12,
  cellTitleFont: { family: 'Garamond, Georgia, serif', size: 12, weight: 700, color: '#A0522D' },
  cellTitleHeight: 28,
  cellTitleBackground: '#F5EFE0',
  posterTitleFont: { family: 'Garamond, Georgia, serif', size: 24, weight: 700, color: '#A0522D' },
  posterHeaderHeight: 60,
  posterHeaderBackground: '#F5EFE0',
  statValueFont: { family: 'Garamond, Georgia, serif', size: 44, weight: 700, color: '#A0522D' },
  statLabelFont: { family: 'Garamond, Georgia, serif', size: 13, weight: 400, color: '#666666' },
  cellVAlign: 'top',
  cellHAlign: 'center',
  rowSizing: 'content',
  textFont: { family: 'Garamond, Georgia, serif', size: 13, weight: 400, color: '#333333' },
  titleFont: { family: 'Garamond, Georgia, serif', size: 18, weight: 700, color: '#A0522D' },
};

// ── terminal — near-black, phosphor green, monospace ───────────────────────
const TERMINAL_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#0D0D0D',
  gap: 12,
  padding: 20,
  cellBackground: '#111111',
  cellBorder: { color: '#33FF33', width: 1, radius: 2 },
  cellPadding: 10,
  cellTitleFont: { family: "'Courier New', monospace", size: 11, weight: 700, color: '#33FF33' },
  cellTitleHeight: 24,
  cellTitleBackground: '#0D0D0D',
  posterTitleFont: { family: "'Courier New', monospace", size: 18, weight: 700, color: '#33FF33' },
  posterHeaderHeight: 48,
  posterHeaderBackground: '#0D0D0D',
  statValueFont: { family: "'Courier New', monospace", size: 40, weight: 700, color: '#33FF33' },
  statLabelFont: { family: "'Courier New', monospace", size: 11, weight: 400, color: '#228822' },
  cellVAlign: 'top',
  cellHAlign: 'left',
  rowSizing: 'content',
  textFont: { family: "'Courier New', monospace", size: 11, weight: 400, color: '#AAFFAA' },
  titleFont: { family: "'Courier New', monospace", size: 16, weight: 700, color: '#33FF33' },
};

// ── pastel — soft white canvas, lavender accent, Inter ─────────────────────
const PASTEL_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#FAF8FF',
  gap: 16,
  padding: 24,
  cellBackground: '#FFFFFF',
  cellBorder: { color: '#B794F4', width: 1, radius: 10 },
  cellPadding: 12,
  cellTitleFont: { family: 'Inter, sans-serif', size: 12, weight: 600, color: '#6B46C1' },
  cellTitleHeight: 28,
  cellTitleBackground: '#EDE9FE',
  posterTitleFont: { family: 'Inter, sans-serif', size: 22, weight: 700, color: '#6B46C1' },
  posterHeaderHeight: 56,
  posterHeaderBackground: '#EDE9FE',
  statValueFont: { family: 'Inter, sans-serif', size: 44, weight: 700, color: '#805AD5' },
  statLabelFont: { family: 'Inter, sans-serif', size: 13, weight: 400, color: '#9F7AEA' },
  cellVAlign: 'top',
  cellHAlign: 'center',
  rowSizing: 'content',
  textFont: { family: 'Inter, sans-serif', size: 13, weight: 400, color: '#4A3F6B' },
  titleFont: { family: 'Inter, sans-serif', size: 18, weight: 700, color: '#6B46C1' },
};

// ── mono — off-white canvas, charcoal accent, system mono ──────────────────
const MONO_COMPOSITION_THEME: CompositionTheme = {
  canvasBackground: '#F5F5F0',
  gap: 16,
  padding: 24,
  cellBackground: '#FFFFFF',
  cellBorder: { color: '#333333', width: 1, radius: 3 },
  cellPadding: 12,
  cellTitleFont: { family: "'Courier New', monospace", size: 12, weight: 700, color: '#FFFFFF' },
  cellTitleHeight: 28,
  cellTitleBackground: '#333333',
  posterTitleFont: { family: "'Courier New', monospace", size: 22, weight: 700, color: '#FFFFFF' },
  posterHeaderHeight: 56,
  posterHeaderBackground: '#333333',
  statValueFont: { family: "'Courier New', monospace", size: 44, weight: 700, color: '#333333' },
  statLabelFont: { family: "'Courier New', monospace", size: 12, weight: 400, color: '#666666' },
  cellVAlign: 'top',
  cellHAlign: 'center',
  rowSizing: 'content',
  textFont: { family: "'Courier New', monospace", size: 12, weight: 400, color: '#444444' },
  titleFont: { family: "'Courier New', monospace", size: 18, weight: 700, color: '#333333' },
};
