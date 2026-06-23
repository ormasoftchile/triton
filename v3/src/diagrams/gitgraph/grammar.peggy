// Gitgraph Grammar — Peggy PEG
//
// Mermaid-compatible gitGraph subset: commit / branch / checkout / merge with
// optional id:, tag:, type: options. The module simulates branch state.

{{
  function opts(list) {
    const o = {};
    for (const it of list) o[it.k.toLowerCase()] = it.v;
    return o;
  }
}}

Document
  = _ "gitGraph"i (_ ":"? _ $[^\n]*)? LineEnd stmts:Statement* _ {
      return { version: '1.0', metadata: {}, statements: stmts.filter(Boolean) };
    }

Statement = Commit / Branch / Checkout / Merge / BlankLine

Commit
  = _ "commit"i o:Opt* LineEnd { const x = opts(o); return { t: 'commit', id: x.id, tag: x.tag, type: x.type }; }

Branch
  = _ "branch"i __ name:BranchName (_ "order:" _ [0-9]+)? LineEnd { return { t: 'branch', name }; }

Checkout
  = _ ("checkout"i / "switch"i) __ name:BranchName LineEnd { return { t: 'checkout', name }; }

Merge
  = _ "merge"i __ name:BranchName o:Opt* LineEnd { const x = opts(o); return { t: 'merge', name, id: x.id, tag: x.tag, type: x.type }; }

Opt
  = __ k:("id"i / "tag"i / "type"i) _ ":" _ v:OptVal { return { k, v }; }

OptVal = '"' s:$[^"]* '"' { return s; } / $[A-Za-z0-9_]+
BranchName = $[A-Za-z0-9_/.-]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
