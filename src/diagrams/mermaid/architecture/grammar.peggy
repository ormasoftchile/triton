// Architecture Grammar — Peggy PEG
//
// Mermaid-compatible architecture-beta subset:
//   - groups (with optional `in <parentId>` nesting)
//   - services (with optional `in <groupId>`)
//   - junctions (4-way split nodes, with optional `in <groupId>`)
//   - side-anchored edges with arrow direction (--  -->  <--  <-->)
//     and optional {group} endpoint modifier
//   - align directives (align row/column <id> <id> ...)
//   - icon slot accepts iconify-style `prefix:name` tokens

{{
}}

Document
  = _ "architecture-beta"i LineEnd lines:Line* _ {
      const groups = [];
      const services = [];
      const junctions = [];
      const edges = [];
      const aligns = [];
      let curGroup, curIndent = -1;
      for (const l of lines.filter(Boolean)) {
        if (l.t === 'group') {
          groups.push({ id: l.id, label: l.label, icon: l.icon, ...(l.inGroup ? { parent: l.inGroup } : {}) });
          curGroup = l.id; curIndent = l.indent;
        } else if (l.t === 'service') {
          const group = l.inGroup || (l.indent > curIndent && curGroup ? curGroup : undefined);
          services.push({ id: l.id, label: l.label, icon: l.icon, ...(group ? { group } : {}) });
        } else if (l.t === 'junction') {
          const group = l.inGroup || (l.indent > curIndent && curGroup ? curGroup : undefined);
          junctions.push({ id: l.id, ...(group ? { group } : {}) });
        } else if (l.t === 'edge') {
          edges.push({ from: l.from, fromSide: l.fromSide, fromGroup: l.fromGroup, to: l.to, toSide: l.toSide, toGroup: l.toGroup, arrowLeft: l.arrowLeft, arrowRight: l.arrowRight });
        } else if (l.t === 'align') {
          aligns.push({ axis: l.axis, members: l.members });
        }
      }
      return { version: '1.0', metadata: {}, groups, services, junctions, edges, aligns };
    }

Line = GroupLine / ServiceLine / JunctionLine / AlignLine / EdgeLine / BlankLine

GroupLine
  = ind:$[ \t]* "group"i __ id:Ident "(" icon:$[^)\n]* ")" "[" label:$[^\]\n]* "]" inG:(__ "in"i __ g:Ident { return g; })? RestIgnore LineEnd {
      return { t: 'group', indent: ind.length, id, icon: icon.trim(), label: label.trim(), inGroup: inG || undefined };
    }

ServiceLine
  = ind:$[ \t]* "service"i __ id:Ident "(" icon:$[^)\n]* ")" "[" label:$[^\]\n]* "]" inG:(__ "in"i __ g:Ident { return g; })? RestIgnore LineEnd {
      return { t: 'service', indent: ind.length, id, icon: icon.trim(), label: label.trim(), inGroup: inG || undefined };
    }

JunctionLine
  = ind:$[ \t]* "junction"i __ id:Ident inG:(__ "in"i __ g:Ident { return g; })? RestIgnore LineEnd {
      return { t: 'junction', indent: ind.length, id, inGroup: inG || undefined };
    }

// Edge: fromEp:Side Arrow Side:toEp
// Arrow order matters — longest match first to avoid prefix ambiguity.
EdgeLine
  = _ fromEp:EdgeEndpoint ":" fromSide:Side _ arrow:Arrow _ toSide:Side ":" toEp:EdgeEndpoint RestIgnore LineEnd {
      return { t: 'edge', from: fromEp.id, fromSide, fromGroup: fromEp.grp, to: toEp.id, toSide, toGroup: toEp.grp, arrowLeft: arrow.left, arrowRight: arrow.right };
    }

// Optional {group} modifier: means the edge attaches at the service's enclosing group boundary.
EdgeEndpoint
  = id:Ident grp:("{group}" { return true; })? { return { id, grp: grp === true }; }

Arrow
  = "<-->" { return { left: true,  right: true  }; }
  / "-->"  { return { left: false, right: true  }; }
  / "<--"  { return { left: true,  right: false }; }
  / "--"   { return { left: false, right: false }; }

// align row|column id id ...  (≥2 members)
AlignLine
  = _ "align"i __ axis:("row"i / "column"i) __ head:Ident tail:(__ id:Ident { return id; })+ RestIgnore LineEnd {
      return { t: 'align', axis: axis.toLowerCase(), members: [head, ...tail] };
    }

Side = $[LRTBlrtb]
RestIgnore = $[^\n]*
Ident = $[A-Za-z0-9_]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
