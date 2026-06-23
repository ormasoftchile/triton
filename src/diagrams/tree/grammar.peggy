{{
  function toObj(pairs) {
    const o = {};
    for (const [k, v] of pairs) o[k] = v;
    return o;
  }
}}

Start
  = _ ("tree" / "plan") dir:(__ d:Direction { return d; })? LineEnd
    title:TitleLine?
    lines:(NodeLine / BlankLine)*
    {
      return {
        version: "1.0",
        metadata: title ? { title } : {},
        direction: dir || "TB",
        lines: lines.filter(l => l !== null),
      };
    }

Direction
  = "TD" { return "TB"; }
  / "TB" { return "TB"; }
  / "LR" { return "LR"; }

TitleLine
  = _ "title" __ t:$[^\r\n]+ LineEnd { return t.trim(); }

BlankLine
  = _ "\r"? "\n" { return null; }

NodeLine
  = indent:$[ \t]* content:NodeContent LineEnd {
      return { indent: indent.length, ...content };
    }

NodeContent
  = edge:(e:EdgeLabel _ { return e; })? label:Label kinds:Kind* attrs:(_ a:AttrBlock { return a; })? {
      return {
        edgeLabel: edge || undefined,
        label: label.trim(),
        kinds: kinds,
        attrs: attrs || {},
      };
    }

EdgeLabel
  = "|" t:$[^|\r\n]* "|" { return t.trim(); }

Label
  = $([^ \t:{|\r\n] [^:{|\r\n]*)

Kind
  = ":" name:$([A-Za-z] [A-Za-z0-9_-]*) { return name; }

AttrBlock
  = "{" _ pairs:AttrPairs? _ "}" { return pairs ? toObj(pairs) : {}; }

AttrPairs
  = first:AttrPair rest:(_ "," _ p:AttrPair { return p; })* { return [first, ...rest]; }

AttrPair
  = k:Key v:(_ ":" _ val:Val { return val; })? { return [k, v === null ? true : v]; }

Key
  = $([A-Za-z_] [A-Za-z0-9_-]*)

Val
  = QuotedString
  / n:Number { return n; }
  / r:$([^,}\r\n]+) { return r.trim(); }

QuotedString
  = '"' s:$[^"]* '"' { return s; }

Number
  = n:$([0-9]+ ("." [0-9]+)?) { return parseFloat(n); }

LineEnd
  = _ ("\r"? "\n")?

_  = [ \t]*
__ = [ \t]+
