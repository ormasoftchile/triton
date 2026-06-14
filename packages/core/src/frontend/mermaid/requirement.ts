/**
 * @file frontend/mermaid/requirement.ts — Mermaid requirementDiagram → RequirementDocument parser.
 *
 * Translates Mermaid `requirementDiagram` syntax into the Requirement Grammar
 * Domain IR (RequirementDocument). Whitespace-independent, graceful degradation,
 * public warnings.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * SUPPORTED SYNTAX
 * ─────────────────────────────────────────────────────────────────────────
 *   Header:
 *     requirementDiagram  (case-insensitive)
 *
 *   Requirement blocks (all five typed variants):
 *     requirement <name> {
 *       id: <value>
 *       text: <value>
 *       risk: high | medium | low
 *       verifymethod: test | analysis | inspection | demonstration
 *     }
 *     functionalRequirement, interfaceRequirement, performanceRequirement,
 *     physicalRequirement, designConstraint — same body syntax.
 *
 *   Element blocks:
 *     element <name> {
 *       type: <value>
 *       docref: <value>
 *     }
 *
 *   Relationships:
 *     <src> - <kind> -> <dst>   (directed)
 *     <src> - <kind> - <dst>    (undirected, treated as directed src→dst)
 *     kinds: satisfies | contains | copies | derives | verifies | refines | traces
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ERROR POLICY
 * ─────────────────────────────────────────────────────────────────────────
 *   Unrecognised lines → skip + warning. Never throws.
 *   Unknown risk/verifymethod → default omitted + warning.
 */

import type {
  RequirementDocument,
  RequirementElement,
  RequirementKind,
  RequirementNode,
  RequirementRelKind,
  RequirementRelationship,
  RequirementRisk,
  RequirementVerifyMethod,
} from '../../grammars/requirement/types.js';
import { preprocessMermaid } from './utils.js';

export interface RequirementParseResult {
  doc: RequirementDocument;
  warnings: string[];
  frontmatter: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUIREMENT_KEYWORDS = new Set([
  'requirement',
  'functionalrequirement',
  'interfacerequirement',
  'performancerequirement',
  'physicalrequirement',
  'designconstraint',
]);

const RELATIONSHIP_KINDS = new Set([
  'satisfies', 'contains', 'copies', 'derives', 'verifies', 'refines', 'traces',
]);

const VALID_RISKS = new Set(['high', 'medium', 'low']);
const VALID_METHODS = new Set(['test', 'analysis', 'inspection', 'demonstration']);

function toRequirementKind(kw: string): RequirementKind {
  switch (kw.toLowerCase()) {
    case 'functionalrequirement':  return 'functionalRequirement';
    case 'interfacerequirement':   return 'interfaceRequirement';
    case 'performancerequirement': return 'performanceRequirement';
    case 'physicalrequirement':    return 'physicalRequirement';
    case 'designconstraint':       return 'designConstraint';
    default:                       return 'requirement';
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function parseRequirementDiagram(text: string): RequirementDocument {
  return parseRequirementDiagramInternal(text).doc;
}

export function parseRequirementDiagramInternal(text: string): RequirementParseResult {
  const { body, frontmatter, directiveTheme, directiveTitle } = preprocessMermaid(text);
  const lines   = body.split('\n');
  const warnings: string[] = [];

  const requirements: RequirementNode[]    = [];
  const elements:     RequirementElement[] = [];
  const relationships: RequirementRelationship[] = [];

  // Track known names for relationship validation
  const knownNames = new Set<string>();

  let headerFound = false;

  // Block parsing state
  type BlockState =
    | { kind: 'requirement'; node: RequirementNode }
    | { kind: 'element';     node: RequirementElement }
    | null;

  let block: BlockState = null;
  let inBlock = false;

  function applyField(
    b: NonNullable<BlockState>,
    key: string,
    value: string,
    lineNum: number,
  ): void {
    if (b.kind === 'requirement') {
      switch (key) {
        case 'id':           b.node.id   = value; break;
        case 'text':         b.node.text = value; break;
        case 'risk': {
          const r = value.toLowerCase();
          if (VALID_RISKS.has(r)) {
            b.node.risk = r as RequirementRisk;
          } else {
            warnings.push(`Unknown risk value '${value}' on line ${lineNum}; expected: high|medium|low`);
          }
          break;
        }
        case 'verifymethod': {
          const m = value.toLowerCase();
          if (VALID_METHODS.has(m)) {
            b.node.verifymethod = m as RequirementVerifyMethod;
          } else {
            warnings.push(`Unknown verifymethod '${value}' on line ${lineNum}; expected: test|analysis|inspection|demonstration`);
          }
          break;
        }
        default:
          warnings.push(`Unknown requirement field '${key}' on line ${lineNum}; skipped`);
      }
    } else {
      switch (key) {
        case 'type':   b.node.type   = value; break;
        case 'docref': b.node.docref = value; break;
        default:
          warnings.push(`Unknown element field '${key}' on line ${lineNum}; skipped`);
      }
    }
  }

  /** Parse inline fields from a string like "id: 1 text: foo risk: high" */
  function parseInlineFields(
    raw: string,
    b: NonNullable<BlockState>,
    lineNum: number,
    _w: string[],
  ): void {
    const fieldRe = /\b(id|text|risk|verifymethod|type|docref)\s*:/gi;
    const matches: Array<{ key: string; valueStart: number; matchIndex: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = fieldRe.exec(raw)) !== null) {
      matches.push({ key: m[1]!.toLowerCase(), valueStart: fieldRe.lastIndex, matchIndex: m.index });
    }
    for (let j = 0; j < matches.length; j++) {
      const match = matches[j]!;
      const nextMatchIndex = j + 1 < matches.length ? matches[j + 1]!.matchIndex : raw.length;
      const value = raw.slice(match.valueStart, nextMatchIndex).trim().replace(/[,;]$/, '').trim();
      if (value) applyField(b, match.key, value, lineNum);
    }
  }

  function flushBlock(): void {
    if (!block) return;
    if (block.kind === 'requirement') {
      requirements.push(block.node);
      knownNames.add(block.node.name);
    } else {
      elements.push(block.node);
      knownNames.add(block.node.name);
    }
    block = null;
    inBlock = false;
  }

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%')) continue;

    // Header detection
    if (!headerFound) {
      if (/^requirementdiagram\b/i.test(trimmed)) {
        headerFound = true;
        continue;
      }
      // First non-empty non-header line: still try to parse (graceful)
    }

    // Inside a block: accumulate field lines until '}'
    if (inBlock && block) {
      if (trimmed === '}') {
        flushBlock();
        continue;
      }

      // Field line: "key: value" (single field per line)
      const colonIdx = trimmed.indexOf(':');
      if (colonIdx > 0 && !trimmed.includes('}')) {
        const key   = trimmed.slice(0, colonIdx).trim().toLowerCase();
        const value = trimmed.slice(colonIdx + 1).trim();
        applyField(block, key, value, i + 1);
      } else if (trimmed.includes('}')) {
        // Closing brace possibly with trailing content
        const closeIdx = trimmed.indexOf('}');
        const before   = trimmed.slice(0, closeIdx).trim();
        if (before) {
          const colIdx = before.indexOf(':');
          if (colIdx > 0) {
            const key   = before.slice(0, colIdx).trim().toLowerCase();
            const value = before.slice(colIdx + 1).trim();
            applyField(block, key, value, i + 1);
          }
        }
        flushBlock();
      } else if (trimmed !== '{') {
        warnings.push(`Unrecognised line inside block on line ${i + 1}: "${trimmed}"`);
      }
      continue;
    }

    // Relationship line: <src> - <kind> -> <dst>  or  <src> - <kind> - <dst>
    const relMatch = /^(\S+)\s*-\s*(\w+)\s*(?:->|-)\s*(\S+)$/.exec(trimmed);
    if (relMatch) {
      const [, src, kindRaw, dst] = relMatch;
      if (src && kindRaw && dst) {
        const kind = kindRaw.toLowerCase();
        if (RELATIONSHIP_KINDS.has(kind)) {
          relationships.push({ src, dst, kind: kind as RequirementRelKind });
        } else {
          warnings.push(`Unknown relationship kind '${kindRaw}' on line ${i + 1}; skipped`);
        }
      }
      continue;
    }

    // Block opener: <keyword> <name> { ... }  (inline or multi-line)
    // Handles:
    //   requirement foo {             (multi-line, close on separate line)
    //   requirement foo { id: 1 }     (fully inline)
    //   requirement foo { id: 1       (inline open, close on separate line)
    const blockOpenMatch = /^(requirement|functionalrequirement|interfacerequirement|performancerequirement|physicalrequirement|designconstraint|element)\s+(\S+)\s*\{(.*)$/i.exec(trimmed);
    if (blockOpenMatch) {
      const [, kwRaw, name, afterBrace = ''] = blockOpenMatch;
      if (kwRaw && name) {
        const kw = kwRaw.toLowerCase();
        if (kw === 'element') {
          block = { kind: 'element', node: { name } };
        } else {
          block = {
            kind: 'requirement',
            node: { name, kind: toRequirementKind(kw) },
          };
        }
        inBlock = true;

        // Check if block is closed on same line: everything before optional '}'
        const closeIdx = afterBrace.indexOf('}');
        const bodyStr  = closeIdx >= 0 ? afterBrace.slice(0, closeIdx) : afterBrace;

        // Parse any inline fields (semicolon or whitespace-separated key:value pairs)
        if (bodyStr.trim()) {
          parseInlineFields(bodyStr, block, i, warnings);
        }

        if (closeIdx >= 0) {
          // Fully closed on this line
          flushBlock();
        }
      }
      continue;
    }

    // Block opener WITHOUT brace: <keyword> <name>  (brace on next line)
    const blockNobraceMatch = /^(requirement|functionalrequirement|interfacerequirement|performancerequirement|physicalrequirement|designconstraint|element)\s+(\S+)\s*$/i.exec(trimmed);
    if (blockNobraceMatch) {
      const [, kwRaw, name] = blockNobraceMatch;
      if (kwRaw && name) {
        const kw = kwRaw.toLowerCase();
        if (kw === 'element') {
          block = { kind: 'element', node: { name } };
        } else {
          block = {
            kind: 'requirement',
            node: { name, kind: toRequirementKind(kw) },
          };
        }
        inBlock = true;
        // Look ahead for opening brace on the next line
        const nextLine = (lines[i + 1] ?? '').trim();
        if (nextLine === '{') {
          i++; // consume the '{' line
        }
      }
      continue;
    }

    // Bare '{' when we've just seen a block opener without brace
    if (trimmed === '{' && block) {
      // already in block, continue
      continue;
    }

    warnings.push(`Unrecognised line ${i + 1}: "${trimmed}"; skipped`);
  }

  // Flush any unclosed block
  if (block && inBlock) {
    warnings.push(`Unclosed block for '${block.kind === 'requirement' ? block.node.name : block.node.name}'; flushed`);
    flushBlock();
  }

  // Auto-create unknown nodes referenced in relationships (graceful degradation)
  for (const rel of relationships) {
    if (!knownNames.has(rel.src)) {
      requirements.push({ name: rel.src, kind: 'requirement' });
      knownNames.add(rel.src);
      warnings.push(`Auto-created requirement node '${rel.src}' (referenced in relationship but not declared)`);
    }
    if (!knownNames.has(rel.dst)) {
      requirements.push({ name: rel.dst, kind: 'requirement' });
      knownNames.add(rel.dst);
      warnings.push(`Auto-created requirement node '${rel.dst}' (referenced in relationship but not declared)`);
    }
  }

  const fmTheme = typeof frontmatter['theme'] === 'string' ? frontmatter['theme'] : undefined;
  const fmTitle = typeof frontmatter['title'] === 'string' ? frontmatter['title'] : undefined;

  const doc: RequirementDocument = {
    version: '1.0',
    metadata: {
      title: fmTitle ?? (typeof directiveTitle === 'string' ? directiveTitle : undefined),
      theme: fmTheme ?? (typeof directiveTheme === 'string' ? directiveTheme : undefined),
    },
    requirements,
    elements,
    relationships,
  };

  return { doc, warnings, frontmatter };
}
