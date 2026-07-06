// ER Grammar — Peggy PEG
//
// Mermaid-compatible erDiagram subset: entity blocks with typed attributes
// (PK/FK/UK), and crow's-foot relationships (||--o{ etc.).

{{
}}

Document
  = fm:Frontmatter? _ "erDiagram"i LineEnd stmts:Statement* _ {
      const entities = [];
      const relations = [];
      const ensure = (name) => { let e = entities.find(x => x.name === name); if (!e) { e = { name, attributes: [] }; entities.push(e); } return e; };
      for (const st of stmts.filter(Boolean)) {
        if (st.t === 'entity') { const e = ensure(st.name); for (const a of st.attrs) e.attributes.push(a); }
        else if (st.t === 'rel') {
          ensure(st.left); ensure(st.right);
          const dashed = st.tok.includes('..');
          const leftCard = st.tok.slice(0, 2);
          const rightCard = st.tok.slice(-2);
          relations.push({ left: st.left, right: st.right, leftCard, rightCard, dashed, ...(st.label ? { label: st.label } : {}) });
        }
      }
      return { version: '1.0', metadata: { ...(fm || {}) }, entities, relations };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Statement = EntityBlock / Relation / BlankLine

EntityBlock
  = _ name:Ident _ "{" _ "\r"? "\n" rows:AttrRow* _ "}" LineEnd { return { t: 'entity', name, attrs: rows.filter(Boolean) }; }

AttrRow
  = _ !"}" type:Ident __ name:Ident key:(__ k:Key { return k; })? (__ '"' [^"]* '"')? _ "\r"? "\n" {
      return { type, name, ...(key ? { key } : {}) };
    }
  / _ "\r"? "\n" { return null; }

Relation
  = _ left:Ident __ tok:ErTok __ right:Ident _ ":" _ label:RelLabel LineEnd {
      return { t: 'rel', left, right, tok, label };
    }

RelLabel
  = '"' s:$[^"]* '"' { return s; }
  / s:$[^\n]+ { return s.trim(); }

ErTok = $([|}{o] [|}{o] ("--" / "..") [|}{o] [|}{o])
Key = "PK" / "FK" / "UK"
Ident = $[A-Za-z0-9_]+
NL = "\r"? "\n"
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
