// Mindmap Grammar — Peggy PEG
//
// Mermaid-compatible mindmap: indentation defines hierarchy. Lines are returned
// raw (with indent depth); the module builds the tree and strips node-shape
// decorations. `::icon(...)` lines are dropped.

{{
}}

Document
  = fm:Frontmatter? _ "mindmap"i LineEnd lines:Line* _ {
      return { version: '1.0', metadata: { ...(fm || {}) }, lines: lines.filter(Boolean) };
    }

Frontmatter
  = "---" NL fmlines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of fmlines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Line
  = indent:$[ \t]+ content:$[^\n]+ ("\r"? "\n" / !.) { return { indent: indent.length, raw: content.trim() }; }
  / content:$[^ \t\n][^\n]* ("\r"? "\n" / !.) { return { indent: 0, raw: content.trim() }; }
  / [ \t]* "\r"? "\n" { return null; }

NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
