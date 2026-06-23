// Sankey Grammar — Peggy PEG
//
// Mermaid-compatible sankey-beta: CSV rows of `Source,Target,Value`.
// `%%` comment lines and blank lines are ignored. Node names may contain spaces.

{{
}}

Document
  = _ "sankey-beta"i LineEnd rows:Row* _ {
      const links = rows.filter(Boolean);
      return { version: '1.0', metadata: {}, links };
    }

Row
  = Comment
  / _ src:Field "," tgt:Field "," _ val:Num _ LineEnd { return { source: src.trim(), target: tgt.trim(), value: val }; }
  / _ "\r"? "\n" { return null; }

Comment = _ "%%" $[^\n]* ("\r"? "\n" / !.) { return null; }
Field = $[^,\n]+
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
