// Block Grammar — Peggy PEG
//
// Mermaid-compatible block-beta subset: a column count, block definitions
// (Id["Label"] with optional :span, several per line), and connector edges.

{{
  import { CONNECTOR_ANIMATIONS } from '../../../contracts/animations.js';

  const ANIMATION_SET = new Set(CONNECTOR_ANIMATIONS);
  const CONNECTOR_TOKEN_MAP = {
    '<-->':  { style: 'solid',  startMarker: 'arrow', endMarker: 'arrow' },
    '<-.->': { style: 'dotted', startMarker: 'arrow', endMarker: 'arrow' },
    '<==>':  { style: 'thick',  startMarker: 'arrow', endMarker: 'arrow' },
    '<-_->': { style: 'dashed', startMarker: 'arrow', endMarker: 'arrow' },
    '<-~->': { style: 'wavy',   startMarker: 'arrow', endMarker: 'arrow' },

    '-->':   { style: 'solid',  startMarker: 'none', endMarker: 'arrow' },
    '-.->':  { style: 'dotted', startMarker: 'none', endMarker: 'arrow' },
    '==>':   { style: 'thick',  startMarker: 'none', endMarker: 'arrow' },
    '-_->':  { style: 'dashed', startMarker: 'none', endMarker: 'arrow' },
    '-~->':  { style: 'wavy',   startMarker: 'none', endMarker: 'arrow' },

    '---':   { style: 'solid',  startMarker: 'none', endMarker: 'none' },
    '-.-':   { style: 'dotted', startMarker: 'none', endMarker: 'none' },
    '===':   { style: 'thick',  startMarker: 'none', endMarker: 'none' },
    '-_-':   { style: 'dashed', startMarker: 'none', endMarker: 'none' },
    '-~-':   { style: 'wavy',   startMarker: 'none', endMarker: 'none' },
  };

  function assertAnim(value) {
    if (value === 'none') return value;
    if (!ANIMATION_SET.has(value)) {
      throw new Error(`Invalid connector animation "${value}"`);
    }
    return value;
  }
}}

Document
  = _ "block-beta"i LineEnd stmts:Statement* _ {
      let columns = 1;
      const blocks = [];
      const edges = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'columns') columns = s.n;
        else if (s.t === 'blocks')  for (const b of s.items) blocks.push(b);
        else if (s.t === 'edge')    edges.push({ from: s.from, to: s.to, ...(s.label ? { label: s.label } : {}), style: s.style, startMarker: s.startMarker, endMarker: s.endMarker, ...(s.animation !== undefined ? { animation: s.animation } : {}) });
      }
      return { version: '1.0', metadata: {}, columns, blocks, edges };
    }

Statement = ColumnsLine / EdgeLine / BlockLine / BlankLine

ColumnsLine
  = _ "columns"i __ n:Integer LineEnd { return { t: 'columns', n }; }

EdgeLine
  = _ from:Ident _ conn:Connector _ label:("|" l:$[^|\n]+ "|" { return l.trim(); })? _ to:Ident tail:EdgeTail LineEnd {
      return { t: 'edge', from, to, label: label || undefined, ...conn, ...(tail.animation !== undefined ? { animation: tail.animation } : {}) };
    }

Connector
  = token:(
      "<-~->" / "<-_->" / "<-.->" / "<==>" / "<-->"
    / "-~->" / "-_->" / "-.->" / "==>" / "-->"
    / "-~-" / "-_-" / "-.-" / "===" / "---"
    ) {
      return CONNECTOR_TOKEN_MAP[token];
    }

EdgeTail
  = anns:(_ "@" Annotation)* block:(_ PropBlock)? rest:$[^\n]* {
      if (/@anim:/.test(rest)) {
        throw new Error('Invalid connector annotation');
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

BlockLine
  = _ first:BlockDef rest:(__ b:BlockDef { return b; })* _ LineEnd {
      return { t: 'blocks', items: [first, ...rest] };
    }

BlockDef
  = id:Ident label:("[" t:$[^\]\n]+ "]" { return t; })? span:(":" n:Integer { return n; })? {
      return { id, label: label != null ? label.replace(/^["']|["']$/g, '') : id, span: span || 1 };
    }

Ident = $[A-Za-z0-9_]+
Integer = n:$[0-9]+ { return parseInt(n, 10); }
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
