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
 *       cell "CI/CD Pipeline" :: flow
 *           flowchart LR
 *               Build --> Test --> Deploy
 *       end
 *
 *       cell "Roadmap" :: timeline
 *           timeline
 *               title Milestones
 *               2025-01 : Kickoff : milestone
 *       end
 *
 *       cell "Metrics" :: stat
 *           99.9% | Uptime
 *       end
 *
 *       cell :: text
 *           All systems nominal.
 *       end
 */

{{
  const cells = [];
  const links = [];
  const traces = [];
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

  function addTrace(name, type, hops, color) {
    const id = slugify(name) || `trace-${traces.length + 1}`;
    traces.push({ id, name, type: type || undefined, hops, color: color || undefined });
  }

  function reset() {
    cells.length = 0;
    links.length = 0;
    traces.length = 0;
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
        ...(traces.length > 0 ? { traces } : {}),
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
  = items:(CellBlock / LinkDecl / TraceDecl / BlankLine)* { return items.filter(Boolean); }

CellBlock
  = _ "cell" ids:CellIdTitle span:CellSpan? _ "::" _ kind:CellKind theme:(_ "@theme" __ t:Identifier { return t; })? _ NL
    content:CellContent
    _ "end" _ NL? {
      addCell(ids.id, ids.title, kind, content, span || undefined, theme || undefined);
      return { type: 'cell' };
    }

CellIdTitle
  = __ id:Identifier __ title:QuotedString { return { id, title }; }
  / __ id:Identifier &(_ CellSpan? _ "::") { return { id, title: null }; }
  / __ title:QuotedString { return { id: null, title }; }
  / &(_ CellSpan? _ "::") { return { id: null, title: null }; }

CellSpan
  = _ "[" _ cols:Integer _ "x" _ rows:Integer _ "]" { return { colSpan: cols, rowSpan: rows }; }
  / _ "[" _ cols:Integer _ "]"                       { return { colSpan: cols, rowSpan: 1   }; }

CellKind
  = "flowchart" / "flow" / "timeline" / "stat" / "text"

// ─── Cross-Link Declarations ─────────────────────────────────────────────────

LinkDecl
  = _ "link" __ from:NodeRef __ arrow:Arrow __ to:NodeRef label:(_ QuotedString)? ann:(_ "@" RouteAnnotation)? block:(_ PropBlock)? _ NL {
      const result = {};
      if (ann) result.routing = ann[2];
      if (block) {
        const b = block[1];
        // Map { route: X } → routing field
        if (b.route) { result.routing = b.route; delete b.route; }
        // Map { anim: X } → animation field
        if (b.anim)  { result.animation = b.anim;  delete b.anim;  }
        if (Object.keys(b).length > 0) result.props = b;
      }
      addLink(from, arrow, to, label ? label[1] : null, Object.keys(result).length > 0 ? result : null);
      return { type: 'link' };
    }

// ─── Annotations & Properties ────────────────────────────────────────────────

RouteAnnotation
  = "straight"   { return 'straight'; }
  / "orthogonal" { return 'orthogonal'; }
  / "bezier"     { return 'bezier'; }
  / "polyline"   { return 'polyline'; }

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

// ─── Trace Declarations ──────────────────────────────────────────────────────

TraceDecl
  = _ "trace" __ name:QuotedString type:(_ ":" _ TraceType)? color:(_ "color" _ QuotedString)? __ hops:HopList _ NL {
      addTrace(name, type ? type[3] : null, hops, color ? color[3] : null);
      return { type: 'trace' };
    }

TraceType
  = "satisfies" / "triggers" / "calls" / "reads" / "writes" / "extends" / "custom"

HopList
  = first:NodeRef rest:(__ "-->" __ NodeRef)* {
      return [first, ...rest.map(r => r[3])];
    }

// ─── Arrows ──────────────────────────────────────────────────────────────────

Arrow
  = "<-->"  { return { direction: 'bidirectional', style: 'solid' }; }
  / "<-.->" { return { direction: 'bidirectional', style: 'dashed' }; }
  / "<..>"  { return { direction: 'bidirectional', style: 'dotted' }; }
  / "-->"   { return { direction: 'directed', style: 'solid' }; }
  / "-.->"  { return { direction: 'directed', style: 'dashed' }; }
  / "..>"   { return { direction: 'directed', style: 'dotted' }; }
  / "---"   { return { direction: 'undirected', style: 'solid' }; }
  / "-.-"   { return { direction: 'undirected', style: 'dashed' }; }
  / "..."   { return { direction: 'undirected', style: 'dotted' }; }

// ─── Node References ─────────────────────────────────────────────────────────

NodeRef
  = cell:Identifier "." node:Identifier { return { cellPath: [cell], nodeId: node }; }

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_-]*)

CellContent
  = lines:(!(_ "end" _ (NL / !.)) line:$[^\n]* NL { return line; })* { return lines.join('\n'); }

QuotedString = "\"" text:$[^"]* "\"" { return text; }
Integer      = digits:$[0-9]+ { return parseInt(digits, 10); }
BlankLine    = _ Comment? NL { return null; }
Comment      = "%%" [^\n]*
_            = [ \t]*
__           = [ \t]+
NL           = "\r\n" / "\n" / "\r"
