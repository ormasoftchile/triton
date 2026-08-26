// Packet Grammar — Peggy PEG
//
// Mermaid-compatible packet-beta: bit ranges with labels.
//
//   packet-beta
//   title TCP Segment Header
//   0-3: "Data Offset"
//   10: "URG"
//   16-31: "Window Size"

{{
}}

Document
  = fm:Frontmatter? BlankLine* _ PacketHeader LineEnd stmts:Statement* _ {
      let title;
      const fields = [];
      for (const s of stmts.filter(Boolean)) {
        if (s.t === 'title') title = s.v;
        else if (s.t === 'field') {
          const sMin = Math.min(s.start, s.end);
          const sMax = Math.max(s.start, s.end);
          fields.push({ start: sMin, end: sMax, label: s.label });
        }
      }
      return { version: '1.0', metadata: { ...(fm || {}), ...(title ? { title } : {}) }, fields };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

PacketHeader
  = "packet-beta"i / "packet"i

Statement = TitleLine / FieldLine / BlankLine

TitleLine
  = _ "title"i _ (":" _)? v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }

FieldLine
  = _ start:Int end:(_ "-" _ e:Int { return e; })? _ ":" _ label:Quoted _ LineEnd {
      return { t: 'field', start, end: end != null ? end : start, label };
    }

Quoted
  = '"' s:$[^"]* '"' { return s.trim(); }
  / "'" s:$[^']* "'" { return s.trim(); }
  / s:$[^\r\n]+ { return s.trim(); }

Int = n:$[0-9]+ { return parseInt(n, 10); }
RestOfLine = $[^\r\n]+
BlankLine = _ Comment? NL { return null; }
Comment = "%%" [^\r\n]*
NL = "\r\n" / "\n" / "\r"
LineEnd = _ Comment? (NL / !.)
_ = [ \t]*
__ = [ \t]+



