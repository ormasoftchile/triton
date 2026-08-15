// Sankey Grammar — Peggy PEG
//
// Mermaid-compatible sankey-beta: CSV rows of `Source,Target,Value`.
// `%%` comment lines and blank lines are ignored. Node names may contain spaces.

{{
}}

Document
  = fm:Frontmatter? _ "sankey-beta"i LineEnd rows:Row* _ {
      const links = rows.filter(Boolean);
      return { version: '1.0', metadata: { ...(fm || {}) }, links };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Row
  = Comment
  / _ src:Field "," tgt:Field "," _ val:Num _ LineEnd { return { source: src.trim(), target: tgt.trim(), value: val }; }
  / _ "\r"? "\n" { return null; }

Comment = _ "%%" $[^\n]* ("\r"? "\n" / !.) { return null; }
Field = $[^,\n]+
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*

