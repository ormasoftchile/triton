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

  function addCell(explicitId, title, kind, rawContent, span) {
    cellCounter++;
    const id = explicitId || slugify(title) || `cell-${cellCounter}`;
    cells.push({ id, title: title || undefined, kind, rawContent: rawContent.trim(), span });
  }

  function addLink(from, arrow, to, label) {
    links.push({ from, ...arrow, to, label: label || undefined });
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
  = _ "cell" ids:CellIdTitle span:CellSpan? _ "::" _ kind:CellKind _ NL
    content:CellContent
    _ "end" _ NL? {
      addCell(ids.id, ids.title, kind, content, span || undefined);
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
  = _ "link" __ from:NodeRef __ arrow:Arrow __ to:NodeRef label:(_ QuotedString)? _ NL {
      addLink(from, arrow, to, label ? label[1] : null);
      return { type: 'link' };
    }

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
