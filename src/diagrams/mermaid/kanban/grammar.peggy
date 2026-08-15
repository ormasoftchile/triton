// Kanban Grammar — Peggy PEG
//
// Mermaid-compatible kanban syntax: columns are unindented headers, cards are
// indented `id[Text]` (or bare text) lines beneath them.
//
//   kanban
//     Todo
//       t1[Design API endpoints]
//     In Progress
//       t5[Build auth service]

{{
}}

Document
  = fm:Frontmatter? _ "kanban"i LineEnd rows:Row* _ {
      const columns = [];
      for (const r of rows.filter(Boolean)) {
        if (r.t === 'col') columns.push({ label: r.label, cards: [] });
        else if (r.t === 'card') {
          if (columns.length === 0) columns.push({ label: '', cards: [] });
          columns[columns.length - 1].cards.push({ ...(r.id ? { id: r.id } : {}), text: r.text });
        }
      }
      return { version: '1.0', metadata: { ...(fm || {}) }, columns };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Row
  = Card / Column / BlankLine

Card
  = _ id:Ident? "[" text:$[^\]\n]+ "]" $[^\n]* LineEnd { return { t: 'card', id: id || undefined, text: text.trim() }; }

Column
  = _ label:$[^\n]+ LineEnd { return { t: 'col', label: label.trim() }; }

Ident = $[a-zA-Z0-9_-]+
NL = "\r"? "\n"
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*

