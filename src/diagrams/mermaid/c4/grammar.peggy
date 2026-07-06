// C4 Grammar — Peggy PEG
//
// Mermaid-compatible C4 subset (C4Context / C4Container / …): Person/System
// nodes, nested boundaries, and Rel/Rel_Ext relationships. Boundary nesting is
// flattened into descendant-node sets with a depth.

{{
  function kindOf(k) {
    const s = k.toLowerCase();
    if (s === 'person') return 'person';
    if (s === 'person_ext') return 'person_ext';
    if (s === 'system_ext') return 'system_ext';
    if (s === 'systemdb' || s === 'containerdb') return 'db';
    if (s.startsWith('container')) return s.endsWith('_ext') ? 'container_ext' : 'container';
    if (s.startsWith('component')) return 'component';
    return 'system';
  }
}}

Document
  = fm:Frontmatter? _ "C4"i ("Context"i / "Container"i / "Component"i / "Dynamic"i / "Deployment"i) LineEnd stmts:Statement* _ {
      const nodes = [];
      const boundaries = [];
      const rels = [];
      let title;
      const walk = (list, depth) => {
        const ids = [];
        for (const s of list.filter(Boolean)) {
          if (s.t === 'title') title = s.v;
          else if (s.t === 'node') { nodes.push({ id: s.id, label: s.label, kind: s.kind, ...(s.descr ? { descr: s.descr } : {}) }); ids.push(s.id); }
          else if (s.t === 'rel') rels.push({ from: s.from, to: s.to, ext: s.ext, ...(s.label ? { label: s.label } : {}), ...(s.tech ? { tech: s.tech } : {}) });
          else if (s.t === 'boundary') {
            const inner = walk(s.inner, depth + 1);
            boundaries.push({ id: s.id, label: s.label, depth, nodeIds: inner });
            for (const id of inner) ids.push(id);
          }
        }
        return ids;
      };
      walk(stmts, 0);
      return { version: '1.0', metadata: { ...(fm || {}), ...(title ? { title } : {}) }, nodes, boundaries, rels };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Statement = TitleLine / BoundaryBlock / RelDecl / NodeDecl / BlankLine

TitleLine = _ "title"i __ v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }

BoundaryBlock
  = _ ("Enterprise_Boundary"i / "System_Boundary"i / "Container_Boundary"i / "Boundary"i) "(" _ id:Ident _ "," _ label:Quoted (_ "," _ Quoted)? _ ")" _ "{" _ "\r"? "\n" inner:Statement* _ "}" LineEnd {
      return { t: 'boundary', id, label, inner };
    }

NodeDecl
  = _ k:NodeKind "(" _ id:Ident _ "," _ label:Quoted descr:(_ "," _ d:Quoted { return d; })? (_ "," _ Quoted)* _ ")" LineEnd {
      return { t: 'node', kind: kindOf(k), id, label, descr: descr || undefined };
    }

RelDecl
  = _ kind:("Rel_Ext"i / "BiRel"i / "Rel"i) "(" _ from:Ident _ "," _ to:Ident label:(_ "," _ l:Quoted { return l; })? tech:(_ "," _ t:Quoted { return t; })? (_ "," _ Quoted)* _ ")" LineEnd {
      return { t: 'rel', from, to, label: label || undefined, tech: tech || undefined, ext: kind.toLowerCase() === 'rel_ext' };
    }

NodeKind = $([A-Za-z] [A-Za-z0-9_]* )
Quoted = '"' s:$[^"]* '"' { return s.replace(/<br\s*\/?>/gi, ' ').replace(/\s+/g, ' ').trim(); }
Ident = $[A-Za-z0-9_]+
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
