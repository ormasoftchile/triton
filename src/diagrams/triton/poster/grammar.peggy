/**
 * Poster Grammar — Peggy PEG
 *
 * Triton-original text syntax for composition/poster diagrams.
 * A poster arranges child diagrams (flow, timeline) + text/stats in a grid.
 *
 * Example:
 *   poster "Architecture Overview"
 *       columns 2
 *
 *       cell "CI/CD Pipeline"
 *           flowchart LR
 *               Build --> Test --> Deploy
 *       end
 *
 *       cell "Roadmap"
 *           timeline
 *               title Milestones
 *               2025-01 : Kickoff : milestone
 *       end
 *
 *       cell "Metrics"
 *           99.9% | Uptime
 *       end
 *
 *       cell
 *           All systems nominal.
 *       end
 */

{{
  const cells = [];
  const links = [];
  let cellCounter = 0;

  function slugify(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
  }

  function addCell(explicitId, title, kind, rawContent, span, theme) {
    cellCounter++;
    const id = explicitId || slugify(title) || `cell-${cellCounter}`;
    cells.push({ id, title: title || undefined, kind, rawContent: rawContent.trim(), span, theme: theme || undefined });
  }

  function addLink(from, arrow, to, label, props) {
    links.push({ from, ...arrow, to, label: label || undefined, ...(props ? props : {}) });
  }

  function reset() {
    cells.length = 0;
    links.length = 0;
    cellCounter = 0;
  }
}}

{
  reset();
}

Document
  = frontmatter:Frontmatter? _ header:PosterHeader _ directives:GridDirective* _ body:BodyItems _ {
      const columns = (directives.find(d => d.key === 'columns') || {}).value || 2;
      return {
        version: '1.0',
        metadata: { ...(frontmatter || {}), title: header.title || undefined },
        grid: { columns: parseInt(columns, 10) },
        cells,
        ...(links.length > 0 ? { links } : {}),
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

PosterHeader
  = "poster" title:(_ QuotedString)? _ NL { return { title: title ? title[1] : null }; }

GridDirective
  = _ key:("columns" / "rows" / "gap") __ value:$[^\n]+ NL { return { key, value: value.trim() }; }

BodyItems
  = items:(CellBlock / LinkDecl / BlankLine)* { return items.filter(Boolean); }

CellBlock
  = _ "cell" ids:CellIdTitle span:CellSpan? explicitKind:(_ "::" _ kind:CellKind { return kind; })? theme:(_ "@theme" __ t:Identifier { return t; })? _ NL
    content:CellContent
    _ "end" _ NL? {
      addCell(ids.id, ids.title, explicitKind || null, content, span || undefined, theme || undefined);
      return { type: 'cell' };
    }

CellIdTitle
  = __ id:Identifier __ title:QuotedString { return { id, title }; }
  / __ id:Identifier { return { id, title: null }; }
  / __ title:QuotedString { return { id: null, title }; }
  / "" { return { id: null, title: null }; }

CellSpan
  = _ "[" _ cols:Integer _ "x" _ rows:Integer _ "]" { return { colSpan: cols, rowSpan: rows }; }
  / _ "[" _ cols:Integer _ "]"                       { return { colSpan: cols, rowSpan: 1   }; }

CellKind
  = "flowchart" / "flow" / "timeline" / "stat" / "text" / Identifier

// ─── Cross-Link Declarations ─────────────────────────────────────────────────

LinkDecl
  = _ "link" __ from:NodeRef __ arrow:Arrow __ to:NodeRef label:(_ QuotedString)? anns:(_ "@" Annotation)* block:(_ PropBlock)? _ NL {
      // Start with props from { } block (lower precedence)
      const result = {};
      if (block) {
        const b = block[1];
        if (b.route) { result.routing = b.route; delete b.route; }
        if (b.anim)  { result.animation = b.anim;  delete b.anim;  }
        if (b.curveStyle) { result.curveStyle = b.curveStyle; delete b.curveStyle; }
        if (b.curve)      { result.curveStyle = b.curve;      delete b.curve;      }
        if (Object.keys(b).length > 0) result.props = b;
      }
      // Apply @ annotations last — @ WINS on conflict (superset rule §4.3)
      for (const ann of anns) {
        Object.assign(result, ann[2]);
      }
      addLink(from, arrow, to, label ? label[1] : null, Object.keys(result).length > 0 ? result : null);
      return { type: 'link' };
    }

// ─── Annotations & Properties ────────────────────────────────────────────────

Annotation
  = "anim:" value:AnimValue { return { animation: value }; }
  / route:RouteWord walls:(":" WallPair)? {
      return { routing: route, ...(walls ? walls[1] : {}) };
    }
  / walls:WallPair { return walls; }

AnimValue
  = "march" / "particle" / "draw" / "pulse" / "glow"
  / "comet" / "stream" / "flow" / "colorcycle" / "none"

RouteAnnotation
  = route:RouteWord walls:(":" WallPair)? {
      return { routing: route, ...(walls ? walls[1] : {}) };
    }
  / walls:WallPair { return walls; }

RouteWord
  = "straight"   { return 'straight'; }
  / "orthogonal" { return 'orthogonal'; }
  / "bezier"     { return 'bezier'; }
  / "polyline"   { return 'polyline'; }

// Wall hints: EXIT ENTRY as two cardinal letters (e.g. EW = exit E, enter W).
WallPair
  = exit:Wall entry:Wall { return { exitWall: exit, entryWall: entry }; }
  / exit:Wall            { return { exitWall: exit }; }

Wall
  = w:("N" / "S" / "E" / "W") { return w; }

PropBlock
  = "{" _ first:PropEntry rest:(_ "," _ PropEntry)* _ "}" {
      const result = {};
      result[first.key] = first.value;
      for (const r of rest) { result[r[3].key] = r[3].value; }
      return result;
    }

PropEntry
  = key:Identifier _ ":" _ value:PropValue { return { key, value }; }

PropValue
  = num:$([0-9]+ ("." [0-9]+)?) { return parseFloat(num); }
  / QuotedString
  / Identifier

// ─── Arrows ──────────────────────────────────────────────────────────────────
// PEG ordered-choice: list extension+longest tokens BEFORE shorter ones.
// Bidirectional before directed (so <--> matches before -->).
// Directed before undirected (so -_-> matches before -_-).

Arrow
  // ── Bidirectional ───────────────────────────────────────────────────────
  = "<-~->" { return { direction: 'bidirectional', style: 'wavy'   }; }
  / "<-_->" { return { direction: 'bidirectional', style: 'dashed' }; }
  / "<-.->" { return { direction: 'bidirectional', style: 'dotted' }; }
  / "<==>"  { return { direction: 'bidirectional', style: 'thick'  }; }
  / "<-->"  { return { direction: 'bidirectional', style: 'solid'  }; }
  // ── Directed ────────────────────────────────────────────────────────────
  / "-~->"  { return { direction: 'directed', style: 'wavy'   }; }
  / "-_->"  { return { direction: 'directed', style: 'dashed' }; }
  / "-..->" { return { direction: 'directed', style: 'dotted' }; }
  / "-.->"  { return { direction: 'directed', style: 'dotted' }; }
  / "===>"  { return { direction: 'directed', style: 'thick'  }; }
  / "==>"   { return { direction: 'directed', style: 'thick'  }; }
  / "--->"  { return { direction: 'directed', style: 'solid'  }; }
  / "-->"   { return { direction: 'directed', style: 'solid'  }; }
  // ── Undirected ──────────────────────────────────────────────────────────
  / "-~-"   { return { direction: 'undirected', style: 'wavy'   }; }
  / "-_-"   { return { direction: 'undirected', style: 'dashed' }; }
  / "-.-"   { return { direction: 'undirected', style: 'dotted' }; }
  / "==="   { return { direction: 'undirected', style: 'thick'  }; }
  / "---"   { return { direction: 'undirected', style: 'solid'  }; }

// ─── Node References ─────────────────────────────────────────────────────────

NodeRef
  = cell:Identifier "[" index:SignedInteger "]" { return { cellPath: [cell], nodeId: "", elementIndex: index }; }
  / cell:Identifier "." node:Identifier { return { cellPath: [cell], nodeId: node }; }

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_-]*)

CellContent
  = lines:(!(_ "end" _ (NL / !.)) line:$[^\n]* NL { return line; })* { return lines.join('\n'); }

QuotedString = "\"" text:$[^"]* "\"" { return text; }
Integer      = digits:$[0-9]+ { return parseInt(digits, 10); }
SignedInteger = sign:("-" / "+")? digits:$[0-9]+ { return parseInt((sign || "") + digits, 10); }
BlankLine    = _ Comment? NL { return null; }
Comment      = "%%" [^\n]*
_            = [ \t]*
__           = [ \t]+
NL           = "\r\n" / "\n" / "\r"
