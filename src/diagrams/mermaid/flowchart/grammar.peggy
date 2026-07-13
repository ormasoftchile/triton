/**
 * Mermaid Flowchart Grammar — Peggy PEG
 *
 * Covers:
 *   - graph/flowchart header + direction (TD TB BT LR RL)
 *   - Node shapes: [] () (()) {{}} ([]) [[]] {} >/] [/] [\]
 *   - Edge operators: --> --- -.-> ==> and bidirectional variants
 *   - Edge labels: |text|
 *   - Chains: A --> B --> C
 *   - Subgraphs: subgraph id label NL ... end
 *   - Comments: %%
 *   - Frontmatter: --- yaml ---
 *   - style / classDef / click directives (captured, not interpreted)
 *   - Shared overlay directives: note "..." at id, legend ... end
 *
 * Output shape:
 *   { version, metadata, direction, flow: { nodes, edges }, overlays }
 */

{{
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

  function stripQuotes(text) {
    if (text.length >= 2 && text[0] === '"' && text[text.length - 1] === '"') {
      return text.slice(1, -1);
    }
    return text;
  }

  const nodeMap  = new Map();
  const edges    = [];
  const overlays = [];
  const idCounts = new Map();

  function registerNode(rawId, label, shape) {
    const id = sanitizeId(rawId);
    if (!nodeMap.has(id)) {
      nodeMap.set(id, { id, label: label || rawId, shape: shape || 'rect', status: 'default' });
    } else if (label !== null && label !== undefined) {
      const n = nodeMap.get(id);
      n.label = label;
      if (shape) n.shape = shape;
    }
    return id;
  }

  function addEdge(from, to, label, style, ann, edgeProps) {
    const e = { from, to, label: label || undefined, style: style || 'solid' };
    if (edgeProps) {
      if (edgeProps.bidirectional) e.bidirectional = true;
      if (edgeProps.undirected)    e.undirected    = true;
      if (edgeProps.endMarker)     e.endMarker     = edgeProps.endMarker;
    }
    if (ann) {
      if (ann.routing)   e.routing   = ann.routing;
      if (ann.exitWall)  e.exitWall  = ann.exitWall;
      if (ann.entryWall) e.entryWall = ann.entryWall;
    }
    edges.push(e);
  }

  function reset() {
    nodeMap.clear();
    edges.length = 0;
    overlays.length = 0;
    idCounts.clear();
  }
}}

{
  reset();
}

// ─── Document ─────────────────────────────────────────────────────────────────

Document
  = frontmatter:Frontmatter? _ header:Header _ statements:Statements _ {
      return {
        version:   '1.0',
        metadata:  frontmatter || {},
        direction: header.direction,
        flow: { nodes: [...nodeMap.values()], edges },
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
  = ("flowchart" / "graph") __ dir:Direction { return { direction: dir }; }

Direction
  = "TD" / "TB" / "BT" / "LR" / "RL"

// ─── Statements ───────────────────────────────────────────────────────────────

Statements
  = stmts:(Statement / BlankLine)* { return stmts.filter(Boolean); }

Statement
  = _ stmt:(NoteDirective / LegendBlock / SubgraphBlock / EdgeChain / NodeDecl / StyleDirective / ClassDirective / ClickDirective) _ Comment? (NL / ";" / &"end" / !.) {
      return stmt;
    }

BlankLine
  = _ Comment? NL { return null; }

Comment
  = "%%" [^\n]*

// ─── Subgraph ─────────────────────────────────────────────────────────────────

SubgraphBlock
  = "subgraph" __ id:SubgraphId _ label:SubgraphLabel? _ NL
    body:Statements
    _ "end" {
      return { type: 'subgraph', id, label: label || id, body };
    }

SubgraphId    = $([a-zA-Z_][a-zA-Z0-9_]*)
SubgraphLabel
  = "[" text:$[^\]]* "]" { return stripQuotes(text.trim()); }
  / label:$[^\n%]+ { return stripQuotes(label.trim()); }

// ─── Edge Chains ──────────────────────────────────────────────────────────────

EdgeChain
  = head:NodeRef rest:(_ edge:EdgeOp _ target:NodeRef ann:(_ "@" RouteAnnotation)? { return { edge, target, ann: ann ? ann[2] : null }; })+ {
      let prev = head;
      for (const { edge, target, ann } of rest) {
        addEdge(prev.id, target.id, edge.label, edge.style, ann, edge);
        prev = target;
      }
      return { type: 'chain' };
    }

EdgeOp
  = op:EdgeArrow label:EdgeLabel? { return { ...op, label: label || undefined }; }

EdgeLabel
  = "|" text:$[^|]+ "|" { return text.trim(); }

EdgeArrow
  // ── Bidirectional ─────────────────────────────────────────────────────────
  = "<-~->" { return { style: 'wavy',   bidirectional: true  }; }
  / "<-_->" { return { style: 'dashed', bidirectional: true  }; }
  / "<-.->" { return { style: 'dotted', bidirectional: true  }; }
  / "<==>"  { return { style: 'thick',  bidirectional: true  }; }
  / "<-->"  { return { style: 'solid',  bidirectional: true  }; }
  // ── Directed — extension tokens before Mermaid tokens ─────────────────────
  / "-~->"  { return { style: 'wavy'   }; }
  / "-_->"  { return { style: 'dashed' }; }
  / "-..->" { return { style: 'dotted' }; }
  / "-.->"  { return { style: 'dotted' }; }
  / "===>"  { return { style: 'thick'  }; }
  / "==>"   { return { style: 'thick'  }; }
  / "--->"  { return { style: 'solid'  }; }
  / "-->"   { return { style: 'solid'  }; }
  / "--x"   { return { style: 'solid', endMarker: 'cross'  }; }
  / "--o"   { return { style: 'solid', endMarker: 'circle' }; }
  // ── Undirected ────────────────────────────────────────────────────────────
  / "-~-"   { return { style: 'wavy',   undirected: true }; }
  / "-_-"   { return { style: 'dashed', undirected: true }; }
  / "-.-"   { return { style: 'dotted', undirected: true }; }
  / "==="   { return { style: 'thick',  undirected: true }; }
  / "---"   { return { style: 'solid',  undirected: true }; }

// ─── Route Annotations (wall hints) ───────────────────────────────────────────
// Attach a routing/wall hint to an edge, e.g. A -->|label| B @orthogonal:EW
// EW = exit East wall of A, enter West wall of B.

RouteAnnotation
  = route:RouteWord walls:(":" WallPair)? { return { routing: route, ...(walls ? walls[1] : {}) }; }
  / walls:WallPair { return walls; }

RouteWord
  = "straight"   { return 'straight'; }
  / "orthogonal" { return 'orthogonal'; }
  / "bezier"     { return 'bezier'; }
  / "polyline"   { return 'polyline'; }

WallPair
  = exit:Wall entry:Wall { return { exitWall: exit, entryWall: entry }; }
  / exit:Wall            { return { exitWall: exit }; }

Wall
  = w:("N" / "S" / "E" / "W") { return w; }

// ─── Nodes ────────────────────────────────────────────────────────────────────

NodeRef
  = id:NodeId _ shape:Shape? {
      return { id: registerNode(id, shape ? shape.label : null, shape ? shape.shape : null) };
    }

NodeDecl
  = ref:NodeRef anns:(_ "@" key:$([a-z][a-z0-9-]*) ":" value:AnnotationValue { return { key, value }; })* !(_ EdgeArrow) {
      if (anns.length > 0) {
        const node = nodeMap.get(ref.id);
        if (node) {
          for (const ann of anns) {
            if (ann.key === 'shape')    node.shape = ann.value;
            if (ann.key === 'icon')     node.iconToken = ann.value;
          }
        }
      }
      return { type: 'node', ...ref };
    }

AnnotationValue
  = '"' val:$[^"]* '"' { return val; }
  / $([^ \t\r\n@\[\](){};]+)

NodeId
  = !("end" ![a-zA-Z0-9_]) !("subgraph" ![a-zA-Z0-9_]) id:$([a-zA-Z_][a-zA-Z0-9_]*) { return id; }

Shape
  = "(("  text:$[^)]+  "))"  { return { shape: 'circle',           label: stripQuotes(text.trim()) }; }
  / "(["  text:$[^\]]* "])"  { return { shape: 'stadium',          label: stripQuotes(text.trim()) }; }
  / "[["  text:$[^\]]* "]]"  { return { shape: 'subroutine',       label: stripQuotes(text.trim()) }; }
  / "[("  text:$[^)]*  ")]"  { return { shape: 'cylinder',         label: stripQuotes(text.trim()) }; }
  / "{{"  text:$[^}]*  "}}"  { return { shape: 'hexagon',          label: stripQuotes(text.trim()) }; }
  / "[/"  text:$[^/]*  "/]"  { return { shape: 'parallelogram',    label: stripQuotes(text.trim()) }; }
  / "[\\" text:$[^\\]* "\\]" { return { shape: 'parallelogram-alt',label: stripQuotes(text.trim()) }; }
  / ">"   text:$[^\]]*  "]"  { return { shape: 'asymmetric',       label: stripQuotes(text.trim()) }; }
  / "["   text:$[^\]]*  "]"  { return { shape: 'rect',             label: stripQuotes(text.trim()) }; }
  / "{"   text:$[^}]*   "}"  { return { shape: 'diamond',          label: stripQuotes(text.trim()) }; }
  / "("   text:$[^)]*   ")"  { return { shape: 'rounded-rect',     label: stripQuotes(text.trim()) }; }

// ─── Directives (captured, not interpreted) ───────────────────────────────────

StyleDirective = "style"    __ content:$[^\n;]+ { return { type: 'style',    raw: content }; }
ClassDirective = ("classDef" / "class") __ content:$[^\n;]+ { return { type: 'class', raw: content }; }
ClickDirective = "click"    __ content:$[^\n;]+ { return { type: 'click',    raw: content }; }

// ─── Overlays ─────────────────────────────────────────────────────────────────

NoteDirective
  = "note" __ "\"" text:$[^"]* "\"" __ "at" __ target:$([a-zA-Z_][a-zA-Z0-9_]*)
    offset:NoteOffset? {
      const note = { type: 'note', text, target, offset: offset || undefined };
      overlays.push(note);
      return note;
    }

NoteOffset
  = __ "offset" __ dx:SignedInt _ "," _ dy:SignedInt { return { dx, dy }; }

SignedInt
  = sign:"-"? digits:$[0-9]+ { return parseInt((sign || '') + digits, 10); }

LegendBlock
  = "legend" __ corner:LegendCorner title:(_ "\"" t:$[^"]* "\"" { return t; })? _ NL
    entries:LegendEntryLine*
    _ "end" {
      const legend = { type: 'legend', corner, title: title || undefined, entries };
      overlays.push(legend);
      return legend;
    }

LegendCorner     = "bottom-right" / "bottom-left" / "top-right" / "top-left"
LegendEntryLine  = _ !("end" ![a-zA-Z0-9_]) key:$[^:\n]+ ":" value:$[^\n]+ NL { return { key: key.trim(), value: value.trim() }; }

// ─── Whitespace ───────────────────────────────────────────────────────────────

_  "optional whitespace" = [ \t]*
__ "required whitespace" = [ \t]+
NL "newline"             = "\r\n" / "\n" / "\r"
