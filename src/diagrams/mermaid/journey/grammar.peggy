// Journey Grammar — Peggy PEG
//
// Mermaid-compatible user-journey syntax:
//
//   journey
//     title E-commerce Customer Journey
//     section Discovery
//       Search online: 4: Customer, Analytics
//       Read reviews: 3: Customer

{{
}}

Document
  = _ "journey"i LineEnd stmts:Statement* _ {
      let title;
      const sections = [];
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'title') title = s.v;
        else if (s.t === 'section') sections.push({ label: s.label, tasks: [] });
        else if (s.t === 'task') {
          if (sections.length === 0) sections.push({ label: '', tasks: [] });
          sections[sections.length - 1].tasks.push({ label: s.label, score: s.score, actors: s.actors });
        }
      }
      return { version: '1.0', metadata: { ...(title ? { title } : {}) }, sections };
    }

Statement
  = Title / Section / Task / BlankLine

Title
  = _ "title"i _ v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }

Section
  = _ "section"i _ label:RestOfLine LineEnd { return { t: 'section', label: label.trim() }; }

Task
  = _ label:$[^:\n]+ ":" _ score:Num _ ":" _ actors:Actors _ LineEnd {
      return { t: 'task', label: label.trim(), score, actors };
    }

Actors
  = first:Actor rest:(_ "," _ a:Actor { return a; })* { return [first, ...rest].filter(Boolean); }

Actor = a:$[^,\n]+ { return a.trim(); }
Num = n:$("-"? [0-9]+ ("." [0-9]+)?) { return parseFloat(n); }
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
