// Block Grammar — Peggy PEG
//
// Mermaid-compatible block-beta subset: a column count, block definitions
// (Id["Label"] with optional :span, several per line), and --> edges.

{{
}}

Document
  = _ "block-beta"i LineEnd stmts:Statement* _ {
      let columns = 1;
      const blocks = [];
      const edges = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'columns') columns = s.n;
        else if (s.t === 'blocks')  for (const b of s.items) blocks.push(b);
        else if (s.t === 'edge')    edges.push({ from: s.from, to: s.to, ...(s.label ? { label: s.label } : {}) });
      }
      return { version: '1.0', metadata: {}, columns, blocks, edges };
    }

Statement = ColumnsLine / EdgeLine / BlockLine / BlankLine

ColumnsLine
  = _ "columns"i __ n:Integer LineEnd { return { t: 'columns', n }; }

EdgeLine
  = _ from:Ident _ "-->" label:("|" l:$[^|\n]+ "|" { return l.trim(); })? _ to:Ident _ LineEnd {
      return { t: 'edge', from, to, label: label || undefined };
    }

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
