/**
 * @file frontend/mermaid/flowchart.ts — Mermaid flowchart / graph → FlowDocument parser.
 *
 * Translates Mermaid `flowchart` / `graph` syntax into the Flow Grammar Domain IR
 * (FlowDocument). This is the Tier-0 Increment-1 parser.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * IMPLEMENTED (Tier 0 Inc 1)
 * ─────────────────────────────────────────────────────────────────────────
 *   Header
 *     flowchart TD|TB|LR|RL|BT  /  graph TD|...
 *     Direction: LR→LR (full layout support); TD/TB→TB (layout deferred);
 *                RL/BT→reverse of LR/TB (no flip in layout yet).
 *
 *   Node shapes
 *     A[Rect]          → kind: 'rect'
 *     A(Rounded)       → kind: 'rounded-rect'
 *     A((Circle))      → kind: 'circle'
 *     A{Diamond}       → kind: 'diamond'
 *     A([Stadium])     → kind: 'stadium'
 *     A[[Subroutine]]  → kind: 'rect'   (subroutine box → rect; no double-line rendering)
 *     A                → kind: 'rounded-rect' (default; implicit node)
 *
 *   Edges
 *     A --> B          → kind:'sync', style:'solid'
 *     A --- B          → kind:'sync', style:'solid' (undirected → treated as directed)
 *     A -.-> B         → kind:'async', style:'dotted'
 *     A ==> B          → kind:'sync', style:'solid'  (thick → solid; no thick style in IR)
 *     A -->|label| B   → with label
 *     A -- label --> B → with label (normalised to pipe form before scanning)
 *
 *   Chains
 *     A --> B --> C    → edges (A,B) and (B,C)
 *
 *   Multi-statement lines
 *     A --> B; B --> C → split on ';', each statement parsed independently
 *
 *   Implicit node creation
 *     First mention in an edge auto-registers a node (label = raw ID, shape = 'rounded-rect').
 *     A later explicit declaration with a shape label UPDATES the label and kind.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * DEFERRED (TODO — slot in on later increments of the Mermaid front-end)
 * ─────────────────────────────────────────────────────────────────────────
 *   1. Subgraphs            (`subgraph … end`) — deferred to Inc 2
 *   2. Class directives     (`classDef`, `class`, `style`) — deferred
 *   3. Click / href         (`click A href "…"`) — deferred
 *   4. Link curve styles    (`linkStyle 0 interpolate basis`) — deferred
 *   5. Markdown labels      (`A["\`text\`"]`) — deferred
 *   6. Multi-node edges     (`A & B --> C`) — deferred
 *   7. Extended shapes      hexagon `{{…}}`, trapezoid `[/…/]`, asymmetric `>[…]` — deferred
 *   8. Thick-edge labels    (`==label==>`) — deferred
 *   9. RL / BT layout flip  (direction reversal in layout engine) — deferred
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines are SKIPPED with a collected warning appended to
 *   FlowchartParseResult.warnings. The parser NEVER throws on syntax errors.
 *   It always returns a valid (possibly partial) FlowDocument.
 *   Callers that want diagnostics should use `parseFlowchartInternal`.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ID SANITIZATION
 * ─────────────────────────────────────────────────────────────────────────
 *   The Flow IR schema requires node IDs matching ^[a-z][a-z0-9-]*$.
 *   Mermaid IDs are arbitrary tokens (camelCase, PascalCase, underscores, etc.).
 *   This module maintains an idMap (raw→sanitized) per parse session:
 *     1. camelCase / PascalCase → kebab-case
 *     2. Uppercase → lowercase
 *     3. Underscores / spaces → hyphen
 *     4. Non-[a-z0-9-] chars stripped
 *     5. Leading hyphens stripped; leading digit → prefix 'n'
 *     6. Collision resolution: 'node' → 'node', second 'node' → 'node-2', etc.
 */

import type { FlowDocument, FlowNode, FlowEdge } from '../../grammars/flow/types.js';
import { preprocessMermaid } from './utils.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Parsed Mermaid direction keyword from the header. */
export type MermaidDirection = 'LR' | 'TB' | 'RL' | 'BT' | 'TD';

/**
 * Full parse result returned by `parseFlowchartInternal`.
 * Not re-exported from packages/core/src/index.ts — internal to the front-end.
 */
export interface FlowchartParseResult {
  /** The validated-structure FlowDocument (may still fail schema cross-checks). */
  doc: FlowDocument;
  /** Direction as written in the Mermaid header. 'LR' when no header found. */
  direction: MermaidDirection;
  /** Collected non-fatal warnings (skipped lines, deferrals). */
  warnings: string[];
  /** Raw frontmatter key-value pairs, if a frontmatter block was present. */
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal token types
// ---------------------------------------------------------------------------

interface NodeToken {
  /** Raw Mermaid ID (before sanitization). */
  rawId: string;
  /** Label text extracted from the shape syntax, if present. */
  label?: string;
  /** Flow IR kind string. Undefined = use default. */
  shape?: string;
}

/** Result of scanNodeToken — optional degradation warning for unsupported shapes. */
interface ScanNodeResult {
  token: NodeToken;
  end: number;
  /** Non-fatal warning emitted when a shape is degraded to a supported kind. */
  shapeWarning?: string;
}

interface EdgeSpec {
  kind?: FlowEdge['kind'];
  style?: FlowEdge['style'];
  label?: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse Mermaid `flowchart` / `graph` text and return the Flow Grammar IR.
 *
 * Strips frontmatter and directives before parsing. The returned FlowDocument
 * passes structural requirements but MAY contain direction-as-theme info only
 * if a frontmatter `theme` is present.
 *
 * For direction-aware rendering (TB layout once supported) use
 * `parseFlowchartInternal` instead.
 *
 * Warnings are silently discarded; use `parseFlowchartInternal` if you need
 * diagnostic output.
 */
export function parseFlowchart(text: string): FlowDocument {
  return parseFlowchartInternal(text).doc;
}

/**
 * Full-fidelity parse: returns doc + direction + warnings + frontmatter.
 * Used by `renderMermaid` in index.ts to apply direction and theme overrides.
 * Not re-exported from core/index.ts.
 */
export function parseFlowchartInternal(text: string): FlowchartParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines = body.split('\n');
  const warnings: string[] = [];

  // ── 1. Locate header ────────────────────────────────────────────────────
  let direction: MermaidDirection = 'LR';
  let headerIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const trimmed = (lines[i] ?? '').trim();
    if (!trimmed) continue;

    const headerMatch = trimmed.match(/^(flowchart|graph)\s+(TD|TB|LR|RL|BT)\b/i);
    if (headerMatch) {
      direction = (headerMatch[2] ?? 'LR').toUpperCase() as MermaidDirection;
      headerIdx = i;
      break;
    }

    // If the first non-empty line is not a header, warn and treat as LR
    if (!/^\s*%%/.test(trimmed)) {
      warnings.push(
        `Expected "flowchart" or "graph" header on first content line; got: "${trimmed}". Defaulting to LR.`,
      );
      break;
    }
  }

  if (direction === 'TB' || direction === 'TD') {
    warnings.push(
      'DEFERRED: TB/TD top-to-bottom layout is not yet implemented in the layout engine (Inc 2). ' +
        'Rendering in LR orientation.',
    );
  } else if (direction === 'RL' || direction === 'BT') {
    warnings.push(
      `DEFERRED: ${direction} reverse-direction layout is not yet implemented. ` +
        'Rendering in forward direction.',
    );
  }

  // ── 2. Parse body lines ──────────────────────────────────────────────────
  /** Stable map: raw Mermaid ID → sanitized FlowDocument ID */
  const idMap = new Map<string, string>();
  /** Nodes in first-mention order (Map preserves insertion order). */
  const nodesMap = new Map<string, FlowNode>();
  const edges: FlowEdge[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();
    if (!trimmed) continue;

    // Split on ';' for multi-statement lines
    const stmts = trimmed.split(';');
    for (const stmt of stmts) {
      const s = stmt.trim();
      if (!s) continue;
      parseStatement(s, idMap, nodesMap, edges, warnings);
    }
  }

  // ── 3. Assemble FlowDocument ─────────────────────────────────────────────
  // Resolve theme: frontmatter.theme > directive theme
  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;
  const resolvedTheme = fmTheme ?? directiveTheme;
  const resolvedTitle = fmTitle ?? directiveTitle;

  const doc: FlowDocument = {
    version: '1.0',
    metadata: {
      ...(resolvedTheme !== undefined ? { theme: resolvedTheme } : {}),
      ...(resolvedTitle !== undefined ? { title: resolvedTitle } : {}),
    },
    flow: {
      nodes: Array.from(nodesMap.values()),
      edges,
    },
  };

  return { doc, direction, warnings, frontmatter };
}

// ---------------------------------------------------------------------------
// Statement parser
// ---------------------------------------------------------------------------

/**
 * Parse a single statement (already split from multi-statement lines).
 * Mutates nodesMap and edges in-place.
 */
function parseStatement(
  stmt: string,
  idMap: Map<string, string>,
  nodesMap: Map<string, FlowNode>,
  edges: FlowEdge[],
  warnings: string[],
): void {
  // ── Deferred: subgraph / end ─────────────────────────────────────────────
  if (/^subgraph\b/i.test(stmt)) {
    warnings.push(`DEFERRED: subgraph not supported in Tier-0 Inc-1 (Inc-2): "${stmt}"`);
    return;
  }
  if (/^end\s*$/i.test(stmt)) {
    warnings.push('DEFERRED: "end" (subgraph close) skipped in Tier-0 Inc-1.');
    return;
  }

  // ── Deferred: classDef / class / style / click ───────────────────────────
  if (/^(classDef|class|style|click)\s/i.test(stmt)) {
    const kw = stmt.split(/\s/)[0] ?? stmt;
    warnings.push(`DEFERRED: "${kw}" directive not supported in Tier-0 Inc-1.`);
    return;
  }

  // ── Normalise: "A -- label --> B" → "A -->|label| B" ────────────────────
  const normalized = normalizeLabeledEdges(stmt);

  // ── Parse as chain ───────────────────────────────────────────────────────
  parseChain(normalized, idMap, nodesMap, edges, warnings);
}

// ---------------------------------------------------------------------------
// Chain parser
// ---------------------------------------------------------------------------

/**
 * Parse a chain of the form: nodeToken [edgeToken nodeToken]*
 *
 * Each nodeToken may carry a shape/label declaration. Edge tokens carry
 * kind/style/label. Multiple edges accumulate from left to right.
 *
 * Examples:
 *   A[label]                     → single node declaration
 *   A --> B                      → edge A→B, both nodes auto-created
 *   A[Label] --> B{Dec} --> C    → two edges, shapes set on A and B
 *   A -->|yes| B -->|no| C       → labeled edges
 */
function parseChain(
  input: string,
  idMap: Map<string, string>,
  nodesMap: Map<string, FlowNode>,
  edges: FlowEdge[],
  warnings: string[],
): void {
  let pos = 0;

  pos = skipWs(input, pos);
  const firstNodeResult = scanNodeToken(input, pos);
  if (!firstNodeResult) {
    // Not a node/edge line; skip silently if empty, warn otherwise
    if (input.trim()) {
      warnings.push(`Cannot parse statement (no node token found): "${input.trim()}"`);
    }
    return;
  }

  pos = firstNodeResult.end;
  if (firstNodeResult.shapeWarning) warnings.push(firstNodeResult.shapeWarning);
  registerNode(firstNodeResult.token, idMap, nodesMap);
  let prevId = resolveId(firstNodeResult.token.rawId, idMap);

  // Chain: [edge node]*
  while (pos < input.length) {
    pos = skipWs(input, pos);
    if (pos >= input.length) break;

    const edgeResult = scanEdgeToken(input, pos);
    if (!edgeResult) {
      // Remaining non-whitespace content that doesn't begin with a known edge operator.
      const remaining = input.slice(pos).trim();
      if (remaining) {
        warnings.push(
          `Unrecognised content in chain (unknown edge operator?): "${remaining}" ` +
            `(statement: "${input.trim()}")`,
        );
      }
      break;
    }

    pos = edgeResult.end;
    pos = skipWs(input, pos);

    const nextNodeResult = scanNodeToken(input, pos);
    if (!nextNodeResult) {
      warnings.push(`Edge without target node in: "${input.trim()}"`);
      break;
    }

    pos = nextNodeResult.end;
    if (nextNodeResult.shapeWarning) warnings.push(nextNodeResult.shapeWarning);
    registerNode(nextNodeResult.token, idMap, nodesMap);
    const nextId = resolveId(nextNodeResult.token.rawId, idMap);

    const edge: FlowEdge = {
      from: prevId,
      to: nextId,
    };
    if (edgeResult.spec.kind !== undefined) edge.kind = edgeResult.spec.kind;
    if (edgeResult.spec.style !== undefined) edge.style = edgeResult.spec.style;
    if (edgeResult.spec.label !== undefined && edgeResult.spec.label !== '') {
      edge.label = edgeResult.spec.label;
    }
    edges.push(edge);

    prevId = nextId;
  }
}

// ---------------------------------------------------------------------------
// Node token scanner
// ---------------------------------------------------------------------------

/**
 * Try to match a node token at `pos` in `input`.
 * Returns the parsed token and the position after the match, or null.
 *
 * Node token grammar (applied in precedence order — multi-char delimiters
 * always checked before their single-char prefixes):
 *   ID  ([...])   → stadium
 *   ID  [[...]]   → rect  (subroutine → rect; no double-line rendering)
 *   ID  ((...)    → circle
 *   ID  [(...)    → rect  (cylinder → rect; DEFERRED shape)
 *   ID  {{...}}   → diamond  (hexagon → diamond; DEFERRED shape)
 *   ID  [/.../ ]  → rect  (parallelogram → rect; slashes stripped from label)
 *   ID  [\...\]   → rect  (parallelogram-left → rect; backslashes stripped)
 *   ID  [...]     → rect
 *   ID  (...)     → rounded-rect
 *   ID  {...}     → diamond
 *   ID  >...]     → rect  (asymmetric → rect; DEFERRED shape)
 *   ID            → rounded-rect (bare, default)
 *
 * ID = [a-zA-Z_][a-zA-Z0-9_]*
 * NOTE: hyphens are intentionally excluded from the ID charset to prevent
 * greedy consumption of edge operators (e.g. `A-->B` must not scan `A--`).
 */
function scanNodeToken(input: string, pos: number): ScanNodeResult | null {
  // Skip whitespace
  while (pos < input.length && /\s/.test(input[pos] ?? '')) pos++;

  // Match Mermaid node ID — NO hyphen in char class (avoids consuming '-–')
  const idMatch = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(input.slice(pos));
  if (!idMatch) return null;

  const rawId = idMatch[0]!;
  let p = pos + rawId.length;
  const rest = input.slice(p);

  // Stadium ([...])  — must check before plain rounded-rect (
  const stadiumM = rest.match(/^\(\[([^\]]*)\]\)/);
  if (stadiumM) {
    return {
      token: { rawId, label: extractLabel(stadiumM[1] ?? ''), shape: 'stadium' },
      end: p + stadiumM[0].length,
    };
  }

  // Subroutine [[...]]  — must check before plain rect [
  const subroutineM = rest.match(/^\[\[([^\]]*)\]\]/);
  if (subroutineM) {
    return {
      token: { rawId, label: extractLabel(subroutineM[1] ?? ''), shape: 'rect' },
      end: p + subroutineM[0].length,
      shapeWarning: `DEFERRED: subroutine [[...]] degraded to rect for node "${rawId}"`,
    };
  }

  // Circle ((...))  — must check before plain rounded-rect (
  const circleM = rest.match(/^\(\(([^)]*)\)\)/);
  if (circleM) {
    return {
      token: { rawId, label: extractLabel(circleM[1] ?? ''), shape: 'circle' },
      end: p + circleM[0].length,
    };
  }

  // Cylinder [(...)  — must check before plain rect [
  const cylinderM = rest.match(/^\[\(([^)]*)\)\]/);
  if (cylinderM) {
    return {
      token: { rawId, label: extractLabel(cylinderM[1] ?? ''), shape: 'rect' },
      end: p + cylinderM[0].length,
      shapeWarning: `DEFERRED: cylinder [(...)] degraded to rect for node "${rawId}"`,
    };
  }

  // Hexagon {{...}}  — must check before plain diamond {
  const hexagonM = rest.match(/^\{\{([^}]*)\}\}/);
  if (hexagonM) {
    return {
      token: { rawId, label: extractLabel(hexagonM[1] ?? ''), shape: 'diamond' },
      end: p + hexagonM[0].length,
      shapeWarning: `DEFERRED: hexagon {{...}} degraded to diamond for node "${rawId}"`,
    };
  }

  // Parallelogram [/.../ ]  — must check before plain rect [
  const paraRightM = rest.match(/^\[\/([^\/]*)\/\]/);
  if (paraRightM) {
    return {
      token: { rawId, label: extractLabel(paraRightM[1] ?? ''), shape: 'rect' },
      end: p + paraRightM[0].length,
      shapeWarning: `DEFERRED: parallelogram [/.../] degraded to rect for node "${rawId}"`,
    };
  }

  // Parallelogram-left [\...\]  — must check before plain rect [
  const paraLeftM = rest.match(/^\[\\([^\\]*)\\]/);
  if (paraLeftM) {
    return {
      token: { rawId, label: extractLabel(paraLeftM[1] ?? ''), shape: 'rect' },
      end: p + paraLeftM[0].length,
      shapeWarning: `DEFERRED: parallelogram [\\...\\] degraded to rect for node "${rawId}"`,
    };
  }

  // Rect [...]
  const rectM = rest.match(/^\[([^\]]*)\]/);
  if (rectM) {
    return {
      token: { rawId, label: extractLabel(rectM[1] ?? ''), shape: 'rect' },
      end: p + rectM[0].length,
    };
  }

  // Rounded-rect (...)
  const roundedM = rest.match(/^\(([^)]*)\)/);
  if (roundedM) {
    return {
      token: { rawId, label: extractLabel(roundedM[1] ?? ''), shape: 'rounded-rect' },
      end: p + roundedM[0].length,
    };
  }

  // Diamond {...}
  const diamondM = rest.match(/^\{([^}]*)\}/);
  if (diamondM) {
    return {
      token: { rawId, label: extractLabel(diamondM[1] ?? ''), shape: 'diamond' },
      end: p + diamondM[0].length,
    };
  }

  // Asymmetric >...]  — starts with > after the ID
  const asymmetricM = rest.match(/^>([^\]]*)\]/);
  if (asymmetricM) {
    return {
      token: { rawId, label: extractLabel(asymmetricM[1] ?? ''), shape: 'rect' },
      end: p + asymmetricM[0].length,
      shapeWarning: `DEFERRED: asymmetric >...] degraded to rect for node "${rawId}"`,
    };
  }

  // Bare ID — no shape, default 'rounded-rect'
  return { token: { rawId, shape: 'rounded-rect' }, end: p };
}

// ---------------------------------------------------------------------------
// Edge token scanner
// ---------------------------------------------------------------------------

/**
 * Try to match an edge token at `pos` in `input`.
 * Returns the EdgeSpec and position after the match, or null.
 *
 * All Mermaid edge operators are supported. Operators without a direct IR
 * equivalent are mapped to the closest supported (kind, style) pair:
 *
 *   Labeled (pipe syntax)                Unlabeled
 *   ─────────────────────────────────    ──────────────────────────────
 *   <-.->|label|  async dotted           <-.->   async dotted
 *   -.->|label|   async dotted           -.->    async dotted
 *   <==>|label|   sync  solid            -.-     async dotted (undirected dotted)
 *   ==>|label|    sync  solid            <==>    sync  solid
 *   <-->|label|   sync  solid            ==>     sync  solid  (thick)
 *   -->|label|    sync  solid            ===     sync  solid  (thick undirected)
 *   o--o|label|   sync  solid            <-->    sync  solid  (bidirectional)
 *   --x|label|    sync  solid (cross)    -->     sync  solid
 *   --o|label|    sync  solid (circle)   o--o    sync  solid  (circle-circle)
 *                                        --x     sync  solid  (cross terminus)
 *                                        --o     sync  solid  (circle terminus)
 *                                        ---     sync  solid  (undirected)
 */
function scanEdgeToken(
  input: string,
  pos: number,
): { spec: EdgeSpec; end: number } | null {
  const s = input.slice(pos);

  // ── Labeled forms (pipe syntax) — most-specific prefix first ─────────────

  // <-.->|label|  dotted bidirectional labeled
  const dotBiLabelM = s.match(/^<-\.->[ \t]*\|([^|]*)\|/);
  if (dotBiLabelM) {
    return {
      spec: { kind: 'async', style: 'dotted', label: dotBiLabelM[1]!.trim() },
      end: pos + dotBiLabelM[0].length,
    };
  }

  // -.->|label|  async dotted labeled
  const dottedLabelM = s.match(/^-\.->[ \t]*\|([^|]*)\|/);
  if (dottedLabelM) {
    return {
      spec: { kind: 'async', style: 'dotted', label: dottedLabelM[1]!.trim() },
      end: pos + dottedLabelM[0].length,
    };
  }

  // <==>|label|  thick bidirectional labeled
  const thickBiLabelM = s.match(/^<==>[ \t]*\|([^|]*)\|/);
  if (thickBiLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: thickBiLabelM[1]!.trim() },
      end: pos + thickBiLabelM[0].length,
    };
  }

  // ==>|label|  thick directed labeled
  const thickLabelM = s.match(/^==>[ \t]*\|([^|]*)\|/);
  if (thickLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: thickLabelM[1]!.trim() },
      end: pos + thickLabelM[0].length,
    };
  }

  // <-->|label|  bidirectional labeled
  const biLabelM = s.match(/^<-->[ \t]*\|([^|]*)\|/);
  if (biLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: biLabelM[1]!.trim() },
      end: pos + biLabelM[0].length,
    };
  }

  // -->|label|  directed labeled
  const arrowLabelM = s.match(/^-->[ \t]*\|([^|]*)\|/);
  if (arrowLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: arrowLabelM[1]!.trim() },
      end: pos + arrowLabelM[0].length,
    };
  }

  // o--o|label|  circle-circle labeled
  const circBiLabelM = s.match(/^o--o[ \t]*\|([^|]*)\|/);
  if (circBiLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: circBiLabelM[1]!.trim() },
      end: pos + circBiLabelM[0].length,
    };
  }

  // --x|label|  cross terminus labeled
  const crossLabelM = s.match(/^--x[ \t]*\|([^|]*)\|/);
  if (crossLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: crossLabelM[1]!.trim() },
      end: pos + crossLabelM[0].length,
    };
  }

  // --o|label|  circle terminus labeled
  const circTermLabelM = s.match(/^--o[ \t]*\|([^|]*)\|/);
  if (circTermLabelM) {
    return {
      spec: { kind: 'sync', style: 'solid', label: circTermLabelM[1]!.trim() },
      end: pos + circTermLabelM[0].length,
    };
  }

  // ── Unlabeled forms — most-specific prefix first ──────────────────────────

  // <-.->  dotted bidirectional
  if (s.startsWith('<-.->')) return { spec: { kind: 'async', style: 'dotted' }, end: pos + 5 };

  // -.->  async dotted
  if (s.startsWith('-.->')) return { spec: { kind: 'async', style: 'dotted' }, end: pos + 4 };

  // -.-  undirected dotted
  if (s.startsWith('-.-')) return { spec: { kind: 'async', style: 'dotted' }, end: pos + 3 };

  // <==>  thick bidirectional
  if (s.startsWith('<==>')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 4 };

  // ==>  thick directed
  if (s.startsWith('==>')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 3 };

  // ===  thick undirected
  if (s.startsWith('===')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 3 };

  // <-->  bidirectional
  if (s.startsWith('<-->')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 4 };

  // -->  directed
  if (s.startsWith('-->')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 3 };

  // o--o  circle-circle bidirectional
  if (s.startsWith('o--o')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 4 };

  // --x  cross terminus
  if (s.startsWith('--x')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 3 };

  // --o  circle terminus
  if (s.startsWith('--o')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 3 };

  // ---  undirected
  if (s.startsWith('---')) return { spec: { kind: 'sync', style: 'solid' }, end: pos + 3 };

  return null;
}

// ---------------------------------------------------------------------------
// Node registration
// ---------------------------------------------------------------------------

/**
 * Register or update a node in nodesMap.
 * - First mention: create with sanitized ID, label (or rawId), and shape.
 * - Later mention WITH a label: update label and shape.
 * - Later mention WITHOUT a label (bare ID reference): do nothing.
 */
function registerNode(
  token: NodeToken,
  idMap: Map<string, string>,
  nodesMap: Map<string, FlowNode>,
): void {
  const sanitized = sanitizeId(token.rawId, idMap);

  if (!nodesMap.has(sanitized)) {
    // First mention: create the node
    const node: FlowNode = {
      id: sanitized,
      label: token.label ?? token.rawId, // label from shape syntax or raw ID as fallback
    };
    if (token.shape !== undefined) node.kind = token.shape;
    nodesMap.set(sanitized, node);
  } else if (token.label !== undefined) {
    // Later explicit declaration with label: update label and shape
    const existing = nodesMap.get(sanitized)!;
    existing.label = token.label;
    if (token.shape !== undefined) existing.kind = token.shape;
  }
  // Bare-ID reference (token.label === undefined): no update needed
}

/**
 * Retrieve the sanitized ID for a raw Mermaid ID that was already registered.
 * Assumes sanitizeId was already called (i.e. idMap has the entry).
 */
function resolveId(rawId: string, idMap: Map<string, string>): string {
  return idMap.get(rawId) ?? sanitizeId(rawId, idMap);
}

// ---------------------------------------------------------------------------
// ID sanitization
// ---------------------------------------------------------------------------

/**
 * Convert a raw Mermaid node ID to a valid FlowDocument ID (`^[a-z][a-z0-9-]*$`).
 *
 * Algorithm:
 *   1. camelCase / PascalCase → kebab-case
 *   2. Uppercase → lowercase
 *   3. Underscores / spaces → hyphens
 *   4. Strip non-[a-z0-9-] characters
 *   5. Collapse runs of hyphens; strip leading/trailing hyphens
 *   6. If result starts with a digit or is empty, prefix with 'n'
 *   7. Collision resolution: if sanitized ID already maps to a DIFFERENT
 *      raw ID, append -2, -3, … until unique.
 *
 * The mapping is stable within a parse session: calling sanitizeId twice
 * with the same rawId always returns the same sanitized ID.
 */
function sanitizeId(rawId: string, idMap: Map<string, string>): string {
  if (idMap.has(rawId)) return idMap.get(rawId)!;

  let s = rawId;

  // 1. camelCase / PascalCase → kebab-case (two passes)
  // Pass A: insert hyphen before a run of caps followed by a cap+lowercase
  //   e.g. "ABCDef" → "ABC-Def"
  s = s.replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2');
  // Pass B: insert hyphen between lowercase and uppercase
  //   e.g. "camelCase" → "camel-Case"
  s = s.replace(/([a-z])([A-Z])/g, '$1-$2');

  // 2. Lowercase
  s = s.toLowerCase();

  // 3. Underscores / spaces → hyphens
  s = s.replace(/[_\s]+/g, '-');

  // 4. Strip non-[a-z0-9-] characters
  s = s.replace(/[^a-z0-9-]/g, '');

  // 5. Collapse multiple hyphens; strip leading/trailing hyphens
  s = s.replace(/-+/g, '-').replace(/^-+|-+$/g, '');

  // 6. If empty or starts with digit → prefix 'n'
  if (!s || /^\d/.test(s)) s = 'n' + s;

  // 7. Collision resolution
  const existingValues = new Set(idMap.values());
  if (!existingValues.has(s)) {
    idMap.set(rawId, s);
    return s;
  }

  let candidate = s;
  let counter = 2;
  while (existingValues.has(candidate)) {
    candidate = `${s}-${counter}`;
    counter++;
  }
  idMap.set(rawId, candidate);
  return candidate;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Skip whitespace at position `pos` in string `input`. Returns new pos. */
function skipWs(input: string, pos: number): number {
  while (pos < input.length && /[ \t]/.test(input[pos] ?? '')) pos++;
  return pos;
}

/**
 * Extract the visible label from a raw shape-interior string.
 *
 * Strips outer double-quotes (for `["label"]` syntax) and trims whitespace.
 * Single-quoted labels are left as-is (uncommon in flowchart context).
 *
 * TODO (deferred): handle Mermaid markdown-string labels ("\`text\`").
 */
function extractLabel(raw: string): string {
  const t = raw.trim();
  if (t.startsWith('"') && t.endsWith('"') && t.length > 1) {
    return t.slice(1, -1).trim();
  }
  return t;
}

/**
 * Normalise inline-label edge syntax to the canonical pipe form `op|label|`.
 *
 * Handles all three inline-label forms from Mermaid's docs:
 *   "-- label -->"  →  "-->|label|"
 *   "== label ==>"  →  "==>|label|"
 *   "-. label .->"  →  "-.->|label|"
 *
 * Applied before chain parsing so the edge scanner only needs to handle the
 * canonical pipe form. Global replace handles multi-edge chains on one line.
 *
 * Does NOT match `---` (undirected link without label — no space follows `--`).
 */
function normalizeLabeledEdges(line: string): string {
  let result = line;
  // "== text ==>" → "==>|text|"
  result = result.replace(/==\s+(.+?)\s*==>/g, '==>|$1|');
  // "-. text .->" → "-.->|text|"
  result = result.replace(/-\.\s+(.+?)\s*\.->/g, '-.->|$1|');
  // "-- text -->" → "-->|text|"
  result = result.replace(/--\s+(.+?)\s*-->/g, '-->|$1|');
  return result;
}
