// Requirement Grammar — Peggy PEG
//
// Mermaid-compatible requirementDiagram subset: requirement/element blocks with
// key: value fields, and `A - type -> B` relationships.

{{
}}

Document
  = fm:Frontmatter? _ "requirementDiagram"i LineEnd stmts:Statement* _ {
      const nodes = [];
      const relations = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'node') nodes.push({ id: s.name, kind: s.kind, fields: s.fields });
        else if (s.t === 'rel')  relations.push({ from: s.from, to: s.to, type: s.type });
      }
      return { version: '1.0', metadata: { ...(fm || {}) }, nodes, relations };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {}; for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; } return meta;
    }

Statement = Block / Relation / BlankLine

Block
  = _ kind:ReqKind __ name:Ident _ "{" _ "\r"? "\n" rows:FieldRow* _ "}" LineEnd {
      return { t: 'node', kind, name, fields: rows.filter(Boolean) };
    }

FieldRow
  = _ !"}" key:$[^:\n]+ ":" val:$[^\n]+ "\r"? "\n" { return { key: key.trim(), value: val.trim() }; }
  / _ "\r"? "\n" { return null; }

Relation
  = _ from:Ident _ "-" _ type:Ident _ "->" _ to:Ident _ LineEnd { return { t: 'rel', from, to, type }; }

ReqKind
  = "functionalRequirement"i / "interfaceRequirement"i / "performanceRequirement"i
  / "physicalRequirement"i / "designConstraint"i / "requirement"i / "element"i

Ident = $[A-Za-z0-9_]+
NL = "\r"? "\n"
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+

