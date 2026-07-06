// Architecture Grammar — Peggy PEG
//
// Mermaid-compatible architecture-beta subset: groups, services (with icon and
// optional group membership via indentation or `in <group>`), and side-anchored
// edges (a:R --> L:b).

{{
}}

Document
  = _ "architecture-beta"i LineEnd lines:Line* _ {
      const groups = [];
      const services = [];
      const edges = [];
      let curGroup, curIndent = -1;
      for (const l of lines.filter(Boolean)) {
        if (l.t === 'group') { groups.push({ id: l.id, label: l.label, icon: l.icon }); curGroup = l.id; curIndent = l.indent; }
        else if (l.t === 'service') {
          const group = l.inGroup || (l.indent > curIndent && curGroup ? curGroup : undefined);
          services.push({ id: l.id, label: l.label, icon: l.icon, ...(group ? { group } : {}) });
        } else if (l.t === 'edge') edges.push({ from: l.from, fromSide: l.fromSide, to: l.to, toSide: l.toSide });
      }
      return { version: '1.0', metadata: {}, groups, services, edges };
    }

Line = GroupLine / ServiceLine / EdgeLine / BlankLine

GroupLine
  = ind:$[ \t]* "group"i __ id:Ident "(" icon:$[^)\n]* ")" "[" label:$[^\]\n]* "]" RestIgnore LineEnd {
      return { t: 'group', indent: ind.length, id, icon: icon.trim(), label: label.trim() };
    }

ServiceLine
  = ind:$[ \t]* "service"i __ id:Ident "(" icon:$[^)\n]* ")" "[" label:$[^\]\n]* "]" inG:(__ "in"i __ g:Ident { return g; })? RestIgnore LineEnd {
      return { t: 'service', indent: ind.length, id, icon: icon.trim(), label: label.trim(), inGroup: inG || undefined };
    }

EdgeLine
  = _ from:Ident ":" fromSide:Side _ ("-->" / "--" / "<-->") _ toSide:Side ":" to:Ident RestIgnore LineEnd {
      return { t: 'edge', from, fromSide, to, toSide };
    }

Side = $[LRTBlrtb]
RestIgnore = $[^\n]*
Ident = $[A-Za-z0-9_]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
