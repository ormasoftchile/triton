// XYChart Grammar — Peggy PEG
//
// Mermaid-compatible xychart-beta syntax (categorical x, numeric y):
//
//   xychart-beta
//       title "Monthly Revenue"
//       x-axis [Jan, Feb, Mar]
//       y-axis "Revenue" 0 --> 6000
//       bar [1800, 2600, 3400]
//       line [2000, 2500, 3000]

{{
}}

Document
  = _ "xychart-beta"i (_ ("horizontal"i / "vertical"i))? LineEnd stmts:Statement* _ {
      let title;
      let categories = [];
      let yLabel, yMin, yMax;
      const series = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'title') title = s.v;
        else if (s.t === 'x')     categories = s.cats;
        else if (s.t === 'y')   { yLabel = s.label; yMin = s.min; yMax = s.max; }
        else if (s.t === 'series') series.push({ kind: s.kind, values: s.values });
      }
      return {
        version: '1.0',
        metadata: { ...(title ? { title } : {}) },
        categories,
        ...(yLabel !== undefined ? { yLabel } : {}),
        ...(yMin !== undefined ? { yMin } : {}),
        ...(yMax !== undefined ? { yMax } : {}),
        series,
      };
    }

Statement
  = Title / XAxis / YAxis / Series / BlankLine

Title
  = _ "title"i _ v:(Quoted / RestOfLine) LineEnd { return { t: 'title', v: typeof v === 'string' ? v.trim() : v }; }

XAxis
  = _ "x-axis"i _ "[" _ first:AxisItem rest:(_ "," _ i:AxisItem { return i; })* _ "]" _ LineEnd {
      return { t: 'x', cats: [first, ...rest] };
    }

YAxis
  = _ "y-axis"i label:(_ q:Quoted { return q; })? range:(_ a:Num _ "-->" _ b:Num { return { min: a, max: b }; })? _ LineEnd {
      return { t: 'y', label: label || undefined, min: range ? range.min : undefined, max: range ? range.max : undefined };
    }

Series
  = _ kind:("bar"i / "line"i) _ "[" _ first:Num rest:(_ "," _ n:Num { return n; })* _ "]" _ LineEnd {
      return { t: 'series', kind: kind.toLowerCase(), values: [first, ...rest] };
    }

AxisItem
  = Quoted
  / $[^,\]\n]+

Quoted = '"' s:$[^"]* '"' { return s.trim(); }
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
