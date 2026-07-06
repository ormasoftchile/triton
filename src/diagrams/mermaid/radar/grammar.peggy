// Radar Grammar — Peggy PEG
//
// Mermaid-compatible radar-beta syntax:
//
//   radar-beta
//   title Developer Profile
//   axis sp["Speed"], rl["Reliability"], cm["Communication"]
//   curve sd["Senior Dev"]{9, 8, 7}
//   curve jd["Junior Dev"]{6, 5, 5}
//   max 10
//   min 0

{{
}}

Document
  = _ "radar-beta"i LineEnd stmts:Statement* _ {
      let title, min, max;
      const axes = [];
      const curves = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'title') title = s.v;
        else if (s.t === 'axis')  axes.push(...s.items);
        else if (s.t === 'curve') curves.push({ id: s.id, label: s.label, values: s.values });
        else if (s.t === 'max')   max = s.v;
        else if (s.t === 'min')   min = s.v;
      }
      return {
        version: '1.0',
        metadata: { ...(title ? { title } : {}) },
        axes,
        curves,
        ...(min !== undefined ? { min } : {}),
        ...(max !== undefined ? { max } : {}),
      };
    }

Statement
  = Title / AxisLine / CurveLine / MaxLine / MinLine / BlankLine

Title
  = _ "title"i _ v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }

AxisLine
  = _ "axis"i _ first:AxisDef rest:(_ "," _ a:AxisDef { return a; })* _ LineEnd {
      return { t: 'axis', items: [first, ...rest] };
    }

CurveLine
  = _ "curve"i _ id:Ident label:LabelBracket? _ "{" _ first:Num rest:(_ "," _ n:Num { return n; })* _ "}" _ LineEnd {
      return { t: 'curve', id, label: label != null ? label : id, values: [first, ...rest] };
    }

MaxLine = _ "max"i _ n:Num LineEnd { return { t: 'max', v: n }; }
MinLine = _ "min"i _ n:Num LineEnd { return { t: 'min', v: n }; }

AxisDef
  = id:Ident label:LabelBracket? { return { id, label: label != null ? label : id }; }

LabelBracket
  = "[" _ q:Quoted _ "]" { return q; }
  / "[" _ s:$[^\]\n]+ "]" { return s.trim(); }

Ident = $[a-zA-Z0-9_]+
Quoted = '"' s:$[^"]* '"' { return s; }
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
