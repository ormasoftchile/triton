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
  let cellCounter = 0;

  function slugify(text) {
    if (!text) return '';
    return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || '';
  }

  function addCell(title, kind, rawContent, span) {
    cellCounter++;
    const id = slugify(title) || `cell-${cellCounter}`;
    cells.push({ id, title: title || undefined, kind, rawContent: rawContent.trim(), span });
  }

  function reset() {
    cells.length = 0;
    cellCounter = 0;
  }
}}

{
  reset();
}

Document
  = frontmatter:Frontmatter? _ header:PosterHeader _ directives:GridDirective* _ body:CellList _ {
      const columns = (directives.find(d => d.key === 'columns') || {}).value || 2;
      return {
        version: '1.0',
        metadata: { ...(frontmatter || {}), title: header.title || undefined },
        grid: { columns: parseInt(columns, 10) },
        cells,
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

CellList
  = items:(CellBlock / BlankLine)* { return items.filter(Boolean); }

CellBlock
  = _ "cell" title:(_ QuotedString)? span:CellSpan? _ "::" _ kind:CellKind _ NL
    content:CellContent
    _ "end" _ NL? {
      addCell(title ? title[1] : null, kind, content, span || undefined);
      return { type: 'cell' };
    }

CellSpan
  = _ "[" _ cols:Integer _ "x" _ rows:Integer _ "]" { return { colSpan: cols, rowSpan: rows }; }
  / _ "[" _ cols:Integer _ "]"                       { return { colSpan: cols, rowSpan: 1   }; }

CellKind
  = "flowchart" / "flow" / "timeline" / "stat" / "text"

CellContent
  = lines:(!(_ "end" _ (NL / !.)) line:$[^\n]* NL { return line; })* { return lines.join('\n'); }

QuotedString = "\"" text:$[^"]* "\"" { return text; }
Integer      = digits:$[0-9]+ { return parseInt(digits, 10); }
BlankLine    = _ Comment? NL { return null; }
Comment      = "%%" [^\n]*
_            = [ \t]*
__           = [ \t]+
NL           = "\r\n" / "\n" / "\r"
