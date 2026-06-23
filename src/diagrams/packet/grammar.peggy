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
  = _ "packet-beta"i LineEnd stmts:Statement* _ {
      let title;
      const fields = [];
      for (const s of stmts.filter(Boolean)) {
        if (s.t === 'title') title = s.v;
        else if (s.t === 'field') fields.push({ start: s.start, end: s.end, label: s.label });
      }
      return { version: '1.0', metadata: { ...(title ? { title } : {}) }, fields };
    }

Statement = TitleLine / FieldLine / BlankLine

TitleLine
  = _ "title"i __ v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }

FieldLine
  = _ start:Int end:("-" e:Int { return e; })? _ ":" _ label:Quoted _ LineEnd {
      return { t: 'field', start, end: end != null ? end : start, label };
    }

Quoted = '"' s:$[^"]* '"' { return s.trim(); } / s:$[^\n]+ { return s.trim(); }
Int = n:$[0-9]+ { return parseInt(n, 10); }
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
