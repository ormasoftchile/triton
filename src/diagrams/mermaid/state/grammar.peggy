// State Grammar — Peggy PEG
//
// Mermaid-compatible stateDiagram / stateDiagram-v2 subset. Composite states
// are flattened (inner states/transitions promoted); [*] maps to shared
// start/end pseudo-states; <<choice>> declares a choice node.

{{
  function collect(stmts, states, transitions, composites) {
    const ensure = (id, label, kind) => {
      let s = states.find(x => x.id === id);
      if (!s) { s = { id, label: label || id, kind: kind || 'normal' }; states.push(s); }
      else if (kind && s.kind === 'normal') s.kind = kind;
      return s;
    };
    const ref = (r, side) => {
      if (r === '[*]') { const id = side === 'from' ? '__start__' : '__end__'; ensure(id, '', side === 'from' ? 'start' : 'end'); return id; }
      ensure(r); return r;
    };
    const localIds = new Set();
    for (const st of stmts.filter(Boolean)) {
      if (st.t === 'choice') { ensure(st.id, st.id, 'choice'); localIds.add(st.id); }
      else if (st.t === 'state') { ensure(st.id, st.label || st.id, 'normal'); localIds.add(st.id); }
      else if (st.t === 'trans') {
        const f = ref(st.from, 'from'), to = ref(st.to, 'to');
        transitions.push({ from: f, to: to, ...(st.label ? { label: st.label } : {}) });
        if (f !== '__start__' && f !== '__end__') localIds.add(f);
        if (to !== '__start__' && to !== '__end__') localIds.add(to);
      } else if (st.t === 'block') {
        ensure(st.name, st.name, 'normal');
        const innerIds = collect(st.inner, states, transitions, composites);
        const memberIds = [...innerIds].filter(id => id !== '__start__' && id !== '__end__');
        composites.push({ id: st.name, label: st.name, nodeIds: memberIds });
        for (const id of innerIds) localIds.add(id);
        localIds.add(st.name);
      }
    }
    return localIds;
  }
}}

Document
  = fm:Frontmatter? _ "stateDiagram"i ("-v2")? LineEnd stmts:Statement* _ {
      const states = [];
      const transitions = [];
      const composites = [];
      collect(stmts, states, transitions, composites);
      return { version: '1.0', metadata: { ...(fm || {}) }, states, transitions, ...(composites.length ? { composites } : {}) };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Statement = StateBlock / ChoiceDecl / Transition / StateDecl / DirectiveLine / BlankLine

StateBlock
  = _ "state"i __ name:Ident _ "{" _ "\r"? "\n" inner:Statement* _ "}" LineEnd { return { t: 'block', name, inner }; }

ChoiceDecl
  = _ "state"i __ id:Ident __ "<<" ("choice" / "fork" / "join") ">>" LineEnd { return { t: 'choice', id }; }

Transition
  = _ from:StateRef _ "-->" _ to:StateRef label:(_ ":" _ l:RestOfLine { return l.trim(); })? LineEnd {
      return { t: 'trans', from, to, label: label || undefined };
    }

StateDecl
  = _ "state"i __ label:QuotedOrId __ "as"i __ id:Ident LineEnd { return { t: 'state', id, label }; }
  / _ "state"i __ id:Ident LineEnd { return { t: 'state', id, label: id }; }

DirectiveLine
  = _ ("direction"i / "note"i) __ $[^\n]+ LineEnd { return null; }

StateRef = "[*]" { return '[*]'; } / Ident
QuotedOrId = '"' s:$[^"]* '"' { return s; } / Ident
Ident = $[A-Za-z0-9_]+
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
