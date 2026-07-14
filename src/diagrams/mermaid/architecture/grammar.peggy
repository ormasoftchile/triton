// Architecture Grammar — Peggy PEG
//
// Mermaid-compatible architecture-beta subset:
//   - groups (with optional `in <parentId>` nesting)
//   - services (with optional `in <groupId>`)
//   - junctions (4-way split nodes, with optional `in <groupId>`)
//   - side-anchored edges with arrow direction (--  -->  <--  <-->)
//     plus Triton connector styles (-.-> -_-> ==> -~-> and undirected/bidir forms)
//     and optional {group} endpoint modifier
//   - align directives (align row/column <id> <id> ...)
//   - icon slot accepts iconify-style `prefix:name` tokens

{{
  import { CONNECTOR_ANIMATIONS } from '../../../contracts/animations.js';

  const ANIMATION_SET = new Set([...CONNECTOR_ANIMATIONS, 'none']);

  const CONNECTOR_TOKEN_MAP = {
    '<-->':  { direction: 'bidirectional', style: 'solid',  startMarker: 'arrow', endMarker: 'arrow' },
    '<-.->': { direction: 'bidirectional', style: 'dotted', startMarker: 'arrow', endMarker: 'arrow' },
    '<==>':  { direction: 'bidirectional', style: 'thick',  startMarker: 'arrow', endMarker: 'arrow' },
    '<-_->': { direction: 'bidirectional', style: 'dashed', startMarker: 'arrow', endMarker: 'arrow' },
    '<-~->': { direction: 'bidirectional', style: 'wavy',   startMarker: 'arrow', endMarker: 'arrow' },

    '-->':   { direction: 'directed', style: 'solid',  startMarker: 'none', endMarker: 'arrow' },
    '-.->':  { direction: 'directed', style: 'dotted', startMarker: 'none', endMarker: 'arrow' },
    '==>':   { direction: 'directed', style: 'thick',  startMarker: 'none', endMarker: 'arrow' },
    '-_->':  { direction: 'directed', style: 'dashed', startMarker: 'none', endMarker: 'arrow' },
    '-~->':  { direction: 'directed', style: 'wavy',   startMarker: 'none', endMarker: 'arrow' },

    '---':   { direction: 'undirected', style: 'solid',  startMarker: 'none', endMarker: 'none' },
    '-.-':   { direction: 'undirected', style: 'dotted', startMarker: 'none', endMarker: 'none' },
    '===':   { direction: 'undirected', style: 'thick',  startMarker: 'none', endMarker: 'none' },
    '-_-':   { direction: 'undirected', style: 'dashed', startMarker: 'none', endMarker: 'none' },
    '-~-':   { direction: 'undirected', style: 'wavy',   startMarker: 'none', endMarker: 'none' },
  };

  function edgeFromConnectorToken(token) {
    const desc = CONNECTOR_TOKEN_MAP[token];
    return {
      left: desc.startMarker === 'arrow',
      right: desc.endMarker === 'arrow',
      style: desc.style,
      startMarker: desc.startMarker,
      endMarker: desc.endMarker,
    };
  }

  function assertAnim(value) {
    if (!ANIMATION_SET.has(value)) {
      throw new Error(`Invalid connector animation "${value}"`);
    }
    return value;
  }
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
          edges.push({ from: l.from, fromSide: l.fromSide, fromGroup: l.fromGroup, to: l.to, toSide: l.toSide, toGroup: l.toGroup, arrowLeft: l.arrowLeft, arrowRight: l.arrowRight, style: l.style, startMarker: l.startMarker, endMarker: l.endMarker, ...(l.animation !== undefined ? { animation: l.animation } : {}) });
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

// Edge: fromEp:Side ConnectorArrow Side:toEp
// Arrow order matters — longest match first to avoid prefix ambiguity.
EdgeLine
  = _ fromEp:EdgeEndpoint ":" fromSide:Side _ arrow:ConnectorArrow _ toSide:Side ":" toEp:EdgeEndpoint tail:EdgeTail LineEnd {
      const extra = tail || {};
      return {
        t: 'edge',
        from: fromEp.id, fromSide, fromGroup: fromEp.grp,
        to: toEp.id, toSide, toGroup: toEp.grp,
        arrowLeft: arrow.left, arrowRight: arrow.right,
        style: arrow.style,
        startMarker: arrow.startMarker,
        endMarker: arrow.endMarker,
        ...(extra.animation !== undefined ? { animation: extra.animation } : {}),
      };
    }

// Optional {group} modifier: means the edge attaches at the service's enclosing group boundary.
EdgeEndpoint
  = id:Ident grp:("{group}" { return true; })? { return { id, grp: grp === true }; }

ConnectorArrow
  = token:(
      "<-~->" / "<-_->" / "<-.->" / "<==>" / "<-->"
    / "-~->" / "-_->" / "-.->" / "==>" / "-->"
    / "<--"
    / "-~-" / "-_-" / "-.-" / "===" / "---" / "--"
    ) {
      if (token === "<--") return { left: true, right: false, style: 'solid', startMarker: 'arrow', endMarker: 'none' };
      if (token === "--")  return { left: false, right: false, style: 'solid', startMarker: 'none', endMarker: 'none' };
      return edgeFromConnectorToken(token);
    }

EdgeTail
  = anns:(_ "@" Annotation)* block:(_ PropBlock)? rest:$[^\n]* {
      if (/@anim:/.test(rest)) {
        throw new Error('Invalid connector animation annotation');
      }
      const result = {};
      if (block) {
        const b = block[1];
        if (b.anim !== undefined) result.animation = assertAnim(b.anim);
      }
      for (const ann of anns) {
        Object.assign(result, ann[2]);
      }
      return result;
    }

Annotation
  = "anim:" value:AnimValue { return { animation: value }; }

AnimValue
  = value:Ident { return assertAnim(value); }

PropBlock
  = "{" _ first:PropEntry rest:(_ "," _ PropEntry)* _ "}" {
      const result = {};
      result[first.key] = first.value;
      for (const r of rest) { result[r[3].key] = r[3].value; }
      return result;
    }

PropEntry
  = key:Ident _ ":" _ value:PropValue { return { key, value }; }

PropValue
  = value:Ident { return value; }

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
