/**
 * Mermaid Flowchart Grammar — Peggy PEG
 *
 * Covers the full Mermaid flowchart/graph syntax:
 *   - graph/flowchart header + direction
 *   - Node shapes: [] () (()) {{}} ([]) [[]] {}, >/], [/], [\]
 *   - Edge operators: -->, --->, ---, -.->, ==> and bidirectional forms
 *   - Edge labels: |text| and inline (-- text -->)
 *   - Chains: A --> B --> C
 *   - Subgraphs: subgraph id ... end
 *   - Comments: %%
 *   - Frontmatter: --- yaml ---
 *   - Semicolon multi-statement lines
 *
 * Target IR: FlowDocument { nodes: FlowNode[], edges: FlowEdge[] }
 */

{{
  // --- Helper functions (module scope) ---

  function sanitizeId(raw) {
    let id = raw
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .toLowerCase()
      .replace(/[_\s]+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    if (!id || /^[0-9]/.test(id)) id = 'n' + id;
    return id;
  }

  const nodeMap = new Map();
  const edges = [];
  const overlays = [];
  let idCounter = new Map();

  function uniqueId(base) {
    if (!nodeMap.has(base)) return base;
    const count = (idCounter.get(base) || 1) + 1;
    idCounter.set(base, count);
    return `${base}-${count}`;
  }

  function registerNode(rawId, label, kind) {
    const id = sanitizeId(rawId);
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, label: label || rawId, kind: kind || 'rounded-rect' });
    } else if (label) {
      const existing = nodeMap.get(id);
      existing.label = label;
      if (kind) existing.kind = kind;
    }
    return id;
  }

  function addEdge(from, to, label, kind, style) {
    edges.push({ from, to, label: label || undefined, kind: kind || 'sync', style: style || 'solid' });
  }

  function stripQuotes(text) {
    if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
      return text.slice(1, -1);
    }
    return text;
  }

  function reset() {
    nodeMap.clear();
    edges.length = 0;
    overlays.length = 0;
    idCounter.clear();
  }
}}

{
  // --- Per-parse initializer ---
  reset();
}

// ═══════════════════════════════════════════════════════════════════════════════
// Top-level
// ═══════════════════════════════════════════════════════════════════════════════

Document
  = frontmatter:Frontmatter? _ header:Header _ statements:Statements _ {
      return {
        version: '1.0',
        metadata: frontmatter || {},
        direction: header.direction,
        flow: {
          nodes: [...nodeMap.values()],
          edges,
        },
        overlays,
      };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {};
      for (const line of lines) {
        const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
        if (m) meta[m[1]] = m[2];
      }
      return meta;
    }

Header
  = keyword:("flowchart" / "graph") __ dir:Direction {
      return { keyword, direction: dir };
    }

Direction
  = "TD" / "TB" / "BT" / "LR" / "RL"

// ═══════════════════════════════════════════════════════════════════════════════
// Statements
// ═══════════════════════════════════════════════════════════════════════════════

Statements
  = statements:(Statement / BlankLine)* { return statements.filter(Boolean); }

Statement
  = _ stmt:(NoteDirective / LegendBlock / SubgraphBlock / EdgeChain / NodeDecl / StyleDirective / ClassDirective / ClickDirective) _ Comment? (NL / ";" / &"end" / !.) {
      return stmt;
    }

BlankLine
  = _ Comment? NL { return null; }

Comment
  = "%%" [^\n]*

// ═══════════════════════════════════════════════════════════════════════════════
// Subgraph
// ═══════════════════════════════════════════════════════════════════════════════

SubgraphBlock
  = "subgraph" __ id:SubgraphId _ label:SubgraphLabel? _ NL
    body:Statements
    _ "end" {
      return { type: 'subgraph', id, label: label || id, body };
    }

SubgraphId
  = $([a-zA-Z_][a-zA-Z0-9_]*)

SubgraphLabel
  = "[" text:$[^\]]* "]" { return stripQuotes(text.trim()); }
  / label:$[^\n%]+ { return stripQuotes(label.trim()); }

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Chains: A --> B --> C
// ═══════════════════════════════════════════════════════════════════════════════

EdgeChain
  = head:NodeRef rest:(_ edge:EdgeOp _ target:NodeRef { return { edge, target }; })+ {
      let prev = head;
      for (const { edge, target } of rest) {
        addEdge(prev.id, target.id, edge.label, edge.kind, edge.style);
        prev = target;
      }
      return { type: 'chain', count: rest.length };
    }

// ═══════════════════════════════════════════════════════════════════════════════
// Edge Operators
// ═══════════════════════════════════════════════════════════════════════════════

EdgeOp
  = op:EdgeArrow label:EdgeLabel? { return { ...op, label }; }

EdgeLabel
  = "|" text:$[^|]+ "|" { return text.trim(); }

EdgeArrow
  // Bidirectional forms (longest first)
  = "<-.->" { return { kind: 'async', style: 'dotted' }; }
  / "<-->" { return { kind: 'sync', style: 'solid' }; }
  / "<==>" { return { kind: 'sync', style: 'solid' }; }
  / "o--o" { return { kind: 'sync', style: 'solid' }; }
  / "x--x" { return { kind: 'sync', style: 'solid' }; }
  // Directed forms (longest first)
  / "-..->" { return { kind: 'async', style: 'dotted' }; }
  / "-.->" { return { kind: 'async', style: 'dotted' }; }
  / "--->" { return { kind: 'sync', style: 'solid' }; }
  / "-->" { return { kind: 'sync', style: 'solid' }; }
  / "==>" { return { kind: 'sync', style: 'solid' }; }
  / "--x" { return { kind: 'sync', style: 'solid' }; }
  / "--o" { return { kind: 'sync', style: 'solid' }; }
  // Undirected (treated as directed in IR)
  / "-.-" { return { kind: 'async', style: 'dotted' }; }
  / "---" { return { kind: 'sync', style: 'solid' }; }
  / "===" { return { kind: 'sync', style: 'solid' }; }

// ═══════════════════════════════════════════════════════════════════════════════
// Node References (with optional shape declaration)
// ═══════════════════════════════════════════════════════════════════════════════

NodeRef
  = id:NodeId shape:Shape? {
      const label = shape ? shape.label : null;
      const kind = shape ? shape.kind : null;
      const registeredId = registerNode(id, label, kind);
      return { id: registeredId, rawId: id };
    }

NodeDecl
  = ref:NodeRef !(_ EdgeArrow) { return { type: 'node', ...ref }; }

NodeId
  = !("end" !([a-zA-Z0-9_])) !("subgraph" !([a-zA-Z0-9_])) id:$([a-zA-Z_][a-zA-Z0-9_]*) { return id; }

// ═══════════════════════════════════════════════════════════════════════════════
// Node Shapes — ordered longest-delimiter-first to avoid ambiguity
// ═══════════════════════════════════════════════════════════════════════════════

Shape
  // Double-delimiter shapes (must precede single-delimiter)
  = "((" text:$[^)]+ "))" { return { kind: 'circle', label: stripQuotes(text.trim()) }; }
  / "([" text:$[^\]]* "])" { return { kind: 'stadium', label: stripQuotes(text.trim()) }; }
  / "[[" text:$[^\]]* "]]" { return { kind: 'subroutine', label: stripQuotes(text.trim()) }; }
  / "[(" text:$[^)]* ")]" { return { kind: 'cylinder', label: stripQuotes(text.trim()) }; }
  / "{{" text:$[^}]* "}}" { return { kind: 'hexagon', label: stripQuotes(text.trim()) }; }
  / "[/" text:$[^/]* "/]" { return { kind: 'parallelogram', label: stripQuotes(text.trim()) }; }
  / "[\\" text:$[^\\]* "\\]" { return { kind: 'parallelogram-alt', label: stripQuotes(text.trim()) }; }
  / ">" text:$[^\]]* "]" { return { kind: 'asymmetric', label: stripQuotes(text.trim()) }; }
  // Single-delimiter shapes
  / "[" text:$[^\]]* "]" { return { kind: 'rect', label: stripQuotes(text.trim()) }; }
  / "{" text:$[^}]* "}" { return { kind: 'diamond', label: stripQuotes(text.trim()) }; }
  / "(" text:$[^)]* ")" { return { kind: 'rounded-rect', label: stripQuotes(text.trim()) }; }

// ═══════════════════════════════════════════════════════════════════════════════
// Directives (style, class, click — captured but not deeply parsed)
// ═══════════════════════════════════════════════════════════════════════════════

StyleDirective
  = "style" __ content:$[^\n;]+ { return { type: 'style', raw: content }; }

ClassDirective
  = ("classDef" / "class") __ content:$[^\n;]+ { return { type: 'class', raw: content }; }

ClickDirective
  = "click" __ content:$[^\n;]+ { return { type: 'click', raw: content }; }

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Overlay Directives (note, legend)
// ═══════════════════════════════════════════════════════════════════════════════

NoteDirective
  = "note" __ "\"" text:$[^"]* "\"" __ "at" __ target:$([a-zA-Z_][a-zA-Z0-9_]*)
    offset:NoteOffset? {
      const note = { type: 'note', text, target, offset: offset || undefined };
      overlays.push(note);
      return note;
    }

NoteOffset
  = __ "offset" __ dx:SignedInt _ "," _ dy:SignedInt {
      return { dx, dy };
    }

SignedInt
  = sign:"-"? digits:$[0-9]+ { return parseInt((sign || '') + digits, 10); }

LegendBlock
  = "legend" __ corner:LegendCorner title:(_ "\"" t:$[^"]* "\"" { return t; })? _ NL
    entries:LegendEntryLine*
    _ "end" {
      const legend = {
        type: 'legend',
        corner,
        title: title || undefined,
        entries,
      };
      overlays.push(legend);
      return legend;
    }

LegendCorner
  = "bottom-right" / "bottom-left" / "top-right" / "top-left"

LegendEntryLine
  = _ !("end" !([a-zA-Z0-9_])) key:$[^:\n]+ ":" value:$[^\n]+ NL {
      return { key: key.trim(), value: value.trim() };
    }

// ═══════════════════════════════════════════════════════════════════════════════
// Whitespace & Newline Primitives
// ═══════════════════════════════════════════════════════════════════════════════

_ "optional whitespace"
  = [ \t]*

__ "required whitespace"
  = [ \t]+

NL "newline"
  = "\r\n" / "\n" / "\r"
