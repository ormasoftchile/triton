// Pie Grammar — Peggy PEG
//
// Mermaid-compatible pie chart syntax:
//
//   pie showData title Programming Language Popularity
//       "Python" : 28.5
//       "JavaScript" : 22.3
//
// `showData` and `title` are both optional; slices are quoted label : value.

{{
}}

Document
  = fm:Frontmatter? _ head:Header rows:Row* _ {
      const slices = rows.filter(Boolean);
      return {
        version: '1.0',
        metadata: { ...(fm || {}), ...(head.title ? { title: head.title } : {}) },
        slices,
        ...(head.showData ? { showData: true } : {}),
      };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Header
  = "pie"i sd:(_ "showData"i)? t:(_ "title"i _ r:RestOfLine { return r; })? LineEnd {
      return { showData: !!sd, title: t ? t.trim() : null };
    }

Row
  = _ label:Quoted _ ":" _ value:Num _ LineEnd { return { label, value }; }
  / _ "\r"? "\n" { return null; }

Quoted = '"' s:$[^"]* '"' { return s; }
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
RestOfLine = $[^\n]+
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
