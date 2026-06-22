// Quadrant Grammar — Peggy PEG
//
// Mermaid-compatible quadrantChart syntax:
//
//   quadrantChart
//       title Campaign Reach vs Engagement
//       x-axis Low Reach --> High Reach
//       y-axis Low Engagement --> High Engagement
//       quadrant-1 Expand & Scale
//       Viral Video: [0.81, 0.87]

{{
}}

Document
  = _ "quadrantChart"i LineEnd stmts:Statement* _ {
      let title, xl, xr, yb, yt;
      const quadrants = [undefined, undefined, undefined, undefined];
      const points = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'title') title = s.v;
        else if (s.t === 'x') { xl = s.left; xr = s.right; }
        else if (s.t === 'y') { yb = s.left; yt = s.right; }
        else if (s.t === 'q') quadrants[s.n - 1] = s.label;
        else if (s.t === 'p') points.push({ label: s.label, x: s.x, y: s.y });
      }
      return {
        version: '1.0',
        metadata: { ...(title ? { title } : {}) },
        ...(xl !== undefined ? { xAxisLeft: xl } : {}),
        ...(xr !== undefined ? { xAxisRight: xr } : {}),
        ...(yb !== undefined ? { yAxisBottom: yb } : {}),
        ...(yt !== undefined ? { yAxisTop: yt } : {}),
        quadrants,
        points,
      };
    }

Statement
  = Title / XAxis / YAxis / Quadrant / Point / BlankLine

Title
  = _ "title"i _ v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }

XAxis
  = _ "x-axis"i _ left:AxisText right:(_ "-->" _ r:RestOfLine { return r.trim(); })? LineEnd {
      return { t: 'x', left: left.trim(), right: right || undefined };
    }

YAxis
  = _ "y-axis"i _ left:AxisText right:(_ "-->" _ r:RestOfLine { return r.trim(); })? LineEnd {
      return { t: 'y', left: left.trim(), right: right || undefined };
    }

Quadrant
  = _ "quadrant-"i n:[1-4] _ label:RestOfLine LineEnd { return { t: 'q', n: parseInt(n, 10), label: label.trim() }; }

Point
  = _ label:$[^:\n]+ _ ":" _ "[" _ x:Num _ "," _ y:Num _ "]" _ LineEnd {
      return { t: 'p', label: label.trim(), x, y };
    }

AxisText = $(!("-->") [^\n])+
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
