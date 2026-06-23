// Sequence Grammar — Peggy PEG
//
// Mermaid-compatible sequenceDiagram subset: participants/actors, messages with
// arrow styles + activation (+/-), alt/else/opt/loop/par/critical/break/end
// fragments, and Notes. autonumber supported.

{{
  function arrowStyle(a) {
    const line = a.startsWith('--') ? 'dashed' : 'solid';
    let head = 'open';
    if (a.endsWith('x')) head = 'cross';
    else if (a.endsWith(')')) head = 'async';
    else if (a.endsWith('>>')) head = 'arrow';
    else if (a.endsWith('>')) head = 'open';
    return { line, head };
  }
}}

Document
  = fm:Frontmatter? _ "sequenceDiagram"i LineEnd stmts:Statement* _ {
      const participants = [];
      const events = [];
      let autonumber = false;
      const ensure = (id, label, isActor) => {
        let pp = participants.find(x => x.id === id);
        if (!pp) { pp = { id, label: label || id, isActor: !!isActor }; participants.push(pp); }
        else if (label) pp.label = label;
        return pp;
      };
      for (const s of stmts.filter(Boolean)) {
        if      (s.t === 'autonumber') autonumber = true;
        else if (s.t === 'participant') ensure(s.id, s.label, s.isActor);
        else if (s.t === 'message') { ensure(s.from); ensure(s.to); events.push(s.ev); }
        else if (s.t === 'note') { for (const id of s.ev.participants) ensure(id); events.push(s.ev); }
        else if (s.t === 'event') events.push(s.ev);
      }
      return { version: '1.0', metadata: { ...(fm || {}) }, participants, events, autonumber };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {};
      for (const line of lines) { const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/); if (m) meta[m[1]] = m[2]; }
      return meta;
    }

Statement
  = AutoNumber
  / ParticipantDecl
  / NoteStmt
  / FragEnd / FragElse / FragStart
  / ActivateStmt
  / Message
  / BlankLine

AutoNumber
  = _ "autonumber"i (__ $[^\n]*)? LineEnd { return { t: 'autonumber' }; }

ParticipantDecl
  = _ kw:("participant"i / "actor"i) __ id:Ident label:(_ "as"i __ l:RestOfLine { return l.trim(); })? LineEnd {
      return { t: 'participant', id, label: label || undefined, isActor: kw.toLowerCase() === 'actor' };
    }

NoteStmt
  = _ "Note"i __ placement:NotePlacement __ ids:NoteIds _ ":" _ text:RestOfLine LineEnd {
      return { t: 'note', ev: { kind: 'note', placement, participants: ids, text: text.trim() } };
    }

NotePlacement
  = "over"i      { return 'over'; }
  / "left of"i   { return 'left'; }
  / "right of"i  { return 'right'; }

NoteIds
  = first:Ident rest:(_ "," _ i:Ident { return i; })* { return [first, ...rest]; }

FragStart
  = _ type:("alt"i / "opt"i / "loop"i / "par"i / "critical"i / "break"i) label:(__ l:RestOfLine { return l.trim(); })? LineEnd {
      return { t: 'event', ev: { kind: 'frag-start', type: type.toLowerCase(), label: label || '' } };
    }

FragElse
  = _ ("else"i / "and"i) label:(__ l:RestOfLine { return l.trim(); })? LineEnd {
      return { t: 'event', ev: { kind: 'frag-else', label: label || '' } };
    }

FragEnd
  = _ "end"i LineEnd { return { t: 'event', ev: { kind: 'frag-end' } }; }

ActivateStmt
  = _ ("activate"i / "deactivate"i) __ Ident LineEnd {
      // Explicit activate/deactivate statements are ignored; inline +/- is used.
      return { t: 'ignore' };
    }

Message
  = _ from:Ident _ arrow:Arrow act:[+-]? _ to:Ident _ ":" _ text:RestOfLine LineEnd {
      const { line, head } = arrowStyle(arrow);
      return { t: 'message', from, to, ev: {
        kind: 'message', from, to, text: text.trim(), line, head,
        ...(act === '+' ? { activateTarget: true } : {}),
        ...(act === '-' ? { deactivateSource: true } : {}),
      } };
    }

Arrow = $("-->>" / "->>" / "--x" / "-x" / "--)" / "-)" / "-->" / "->")

Ident = $[A-Za-z0-9_]+
RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
