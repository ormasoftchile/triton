// Class Grammar — Peggy PEG
//
// Mermaid-compatible classDiagram subset: class blocks with members, stereotype
// lines (<<interface>>), and relationships with cardinality + label.

{{
  function relHeads(tok) {
    const dashed = tok.includes('..');
    let leftHead = 'none', rightHead = 'none';
    if (tok.startsWith('<|')) leftHead = 'triangle';
    else if (tok.startsWith('*')) leftHead = 'diamondF';
    else if (tok.startsWith('o')) leftHead = 'diamondO';
    else if (tok.startsWith('<')) leftHead = 'arrow';
    if (tok.endsWith('|>')) rightHead = 'triangle';
    else if (tok.endsWith('*')) rightHead = 'diamondF';
    else if (tok.endsWith('o')) rightHead = 'diamondO';
    else if (tok.endsWith('>')) rightHead = 'arrow';
    return { leftHead, rightHead, dashed };
  }
}}

Document
  = fm:Frontmatter? _ "classDiagram"i ("-v2")? LineEnd stmts:Statement* _ {
      const classes = [];
      const relations = [];
      const ensure = (name) => {
        let c = classes.find(x => x.name === name);
        if (!c) { c = { name, attributes: [], methods: [] }; classes.push(c); }
        return c;
      };
      const addMember = (c, raw) => {
        const s = raw.trim();
        if (!s) return;
        if (s.startsWith('<<')) { c.stereotype = s.replace(/[<>]/g, '').trim(); return; }
        const isMethod = s.includes('(');
        (isMethod ? c.methods : c.attributes).push({ text: s, isMethod });
      };
      for (const st of stmts.filter(Boolean)) {
        if (st.t === 'class') { const c = ensure(st.name); for (const m of st.members) addMember(c, m); }
        else if (st.t === 'member') addMember(ensure(st.name), st.content);
        else if (st.t === 'relation') {
          ensure(st.left); ensure(st.right);
          const { leftHead, rightHead, dashed } = relHeads(st.tok);
          relations.push({ left: st.left, right: st.right, leftHead, rightHead, dashed,
            ...(st.label ? { label: st.label } : {}),
            ...(st.lc ? { leftCard: st.lc } : {}),
            ...(st.rc ? { rightCard: st.rc } : {}) });
        }
      }
      return { version: '1.0', metadata: { ...(fm || {}) }, classes, relations };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Statement = ClassBlock / Relation / ClassMemberLine / NoteLine / BlankLine

ClassBlock
  = _ "class"i __ name:Ident _ "{" _ "\r"? "\n" rows:MemberRow* _ "}" LineEnd { return { t: 'class', name, members: rows.filter(Boolean) }; }

MemberRow
  = _ !"}" content:$[^\n]+ "\r"? "\n" { return content.trim(); }
  / _ "\r"? "\n" { return null; }

ClassMemberLine
  = _ name:Ident _ ":" _ content:RestOfLine LineEnd { return { t: 'member', name, content: content.trim() }; }

Relation
  = _ left:Ident _ lc:CardStr? _ tok:RelTok _ rc:CardStr? _ right:Ident label:(_ ":" _ l:RestOfLine { return l.trim(); })? LineEnd {
      return { t: 'relation', left, right, tok, lc: lc || undefined, rc: rc || undefined, label: label || undefined };
    }

NoteLine = _ "note"i __ $[^\n]+ LineEnd { return null; }

RelTok = $("<|--" / "<|.." / "--|>" / "..|>" / "*--" / "--*" / "o--" / "--o" / "<--" / "-->" / "<.." / "..>" / ".." / "--")
CardStr = '"' s:$[^"]* '"' { return s; }
Ident = $[A-Za-z0-9_~]+
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
