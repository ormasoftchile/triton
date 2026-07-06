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
  = _ head:Header rows:Row* _ {
      const slices = rows.filter(Boolean);
      return {
        version: '1.0',
        metadata: { ...(head.title ? { title: head.title } : {}) },
        slices,
        ...(head.showData ? { showData: true } : {}),
      };
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
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
