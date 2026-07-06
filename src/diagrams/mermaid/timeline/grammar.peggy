/**
 * Timeline Grammar — Peggy PEG
 *
 * Two-layer design:
 *
 * LAYER 1 (Mermaid-compatible):
 *   timeline header, title directive, section blocks,
 *   simple entries (date : Event text)
 *
 * LAYER 2 (Triton extensions — gated by options.extensions !== false):
 *   layout/axisUnit directives, frontmatter,
 *   date ranges (start -- end),
 *   status annotations (:active/:done/:blocked),
 *   milestone keyword, track assignment (@track)
 *
 * Usage:
 *   parse(input)                        → superset (extensions enabled)
 *   parse(input, { extensions: false }) → strict Mermaid-only
 */

{{
  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || '';
  }

  const tracks     = new Map();
  const activities = [];
  const milestones = [];
  const sections   = [];
  const overlays   = [];
  let actCounter  = 0;
  let msCounter   = 0;
  let secCounter  = 0;
  let currentSec  = null;

  function ensureTrack(id) {
    if (!id) id = 'default';
    if (!tracks.has(id)) tracks.set(id, { id, label: id.charAt(0).toUpperCase() + id.slice(1) });
    return id;
  }

  function addActivity(start, end, label, status, trackId, description) {
    actCounter++;
    activities.push({
      id: slugify(label) || `activity-${actCounter}`,
      label, track: ensureTrack(trackId),
      start, end: end || undefined,
      status: status || 'default',
      ...(description ? { description } : {}),
    });
  }

  function addMilestone(date, label, trackId, description) {
    msCounter++;
    milestones.push({
      id: slugify(label) || `milestone-${msCounter}`,
      label, date,
      track: trackId ? ensureTrack(trackId) : undefined,
      ...(description ? { description } : {}),
    });
  }

  function openSection(label) {
    secCounter++;
    currentSec = { id: slugify(label) || `section-${secCounter}`, label, start: null, end: null };
  }

  function updateSectionDate(date) {
    if (currentSec) {
      if (!currentSec.start) currentSec.start = date;
      currentSec.end = date;
    }
  }

  function closeSection() {
    if (currentSec && currentSec.start) {
      sections.push(currentSec);
    }
    currentSec = null;
  }

  function reset() {
    tracks.clear();
    activities.length = 0;
    milestones.length = 0;
    sections.length   = 0;
    overlays.length   = 0;
    actCounter  = 0;
    msCounter   = 0;
    secCounter  = 0;
    currentSec  = null;
  }
}}

{
  reset();
  const ext = options.extensions !== false;
}

// ─── Document ─────────────────────────────────────────────────────────────────

Document
  = fm:ExtFrontmatter? _ header:Header _ directives:Directive* _ body:Body _ {
      closeSection();
      const titleDir = directives.find(d => d && d.key === 'title');
      const subtitleDir = directives.find(d => d && d.key === 'subtitle');
      const themeDir = directives.find(d => d && d.key === 'theme');
      const layoutDir = directives.find(d => d && d.key === 'layout');
      return {
        version:  '1.0',
        metadata: {
          ...(fm || {}),
          ...(titleDir ? { title: titleDir.value } : {}),
          ...(subtitleDir ? { subtitle: subtitleDir.value } : {}),
          ...(themeDir ? { theme: themeDir.value } : {}),
        },
        layout:   layoutDir ? layoutDir.value : 'horizontal',
        tracks:   tracks.size > 0 ? [...tracks.values()] : [{ id: 'default', label: 'Default' }],
        activities, milestones,
        sections: sections.length > 0 ? sections : undefined,
        overlays,
      };
    }

Header
  = "timeline" NL { return 'timeline'; }

// ─── Directives ───────────────────────────────────────────────────────────────

Directive = ExtDirective / MermaidDirective

MermaidDirective
  = _ "title" __ value:$[^\n]+ _ NL { return { key: 'title', value: value.trim() }; }
  / _ "subtitle" __ value:$[^\n]+ _ NL { return { key: 'subtitle', value: value.trim() }; }
  / _ "theme" __ value:$[^\n]+ _ NL { return { key: 'theme', value: value.trim() }; }

ExtDirective
  = &{ return ext; } _ key:("layout" / "axisUnit") __ value:$[^\n]+ _ NL { return { key, value: value.trim() }; }

ExtFrontmatter
  = &{ return ext; } "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {};
      for (const line of lines) {
        const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
        if (m) meta[m[1]] = m[2];
      }
      return meta;
    }

// ─── Body ─────────────────────────────────────────────────────────────────────

Body
  = items:(NoteDirective / LegendBlock / SectionHeader / Entry / BlankLine)*
    { return items.filter(Boolean); }

SectionHeader
  = _ "section" __ label:$[^\n]+ NL {
      closeSection();
      openSection(label.trim());
      return null;
    }

Entry
  = _ entry:(ExtEntry / MermaidEntry) _ Comment? NL { return entry; }

// ─── Layer 1: Mermaid-compatible entry ────────────────────────────────────────

MermaidEntry
  = date:DateToken _ ":" _ label:MermaidLabel {
      addActivity(date, null, label, 'default', null);
      updateSectionDate(date);
      return { type: 'activity', label };
    }

MermaidLabel = text:$[^\n]+ { return text.trim(); }

// ─── Layer 2: Extension entries ───────────────────────────────────────────────

ExtEntry
  = &{ return ext; } entry:(ExtRangeActivity / ExtPointEntry) { return entry; }

ExtRangeActivity
  = start:DateToken _ "--" _ end:DateToken _ ":" _ label:ExtLabel
    status:(_ ":" _ s:ExtStatus { return s; })?
    track:(_ "@" id:Identifier { return id; })?
    desc:(_ "|" _ d:DescText { return d; })? {
      addActivity(start, end, label, status, track, desc);
      updateSectionDate(start);
      updateSectionDate(end);
      return { type: 'activity', label };
    }

ExtPointEntry
  = date:DateToken _ ":" _ label:ExtLabel ":" _ kind:ExtEntryKind
    track:(_ "@" id:Identifier { return id; })?
    desc:(_ "|" _ d:DescText { return d; })? {
      if (kind === 'milestone') addMilestone(date, label, track, desc);
      else addActivity(date, null, label, kind, track, desc);
      updateSectionDate(date);
      return { type: kind === 'milestone' ? 'milestone' : 'activity', label };
    }

ExtLabel     = text:$[^:\n@|]+ { return text.trim(); }
DescText     = text:$[^\n]+ { return text.trim(); }
ExtEntryKind = "milestone" / ExtStatus
ExtStatus    = "active" / "done" / "blocked" / "default"

// ─── Shared tokens ────────────────────────────────────────────────────────────

DateToken  = $([a-zA-Z0-9_\-/.]+)
Identifier = $([a-zA-Z_][a-zA-Z0-9_\-]*)

// ─── Overlays ─────────────────────────────────────────────────────────────────

NoteDirective
  = _ "note" __ "\"" text:$[^"]* "\"" __ "at" __ target:$([a-zA-Z0-9_\-/.]+)
    offset:NoteOffset? _ Comment? NL {
      const note = { type: 'note', text, target, offset: offset || undefined };
      overlays.push(note);
      return note;
    }

NoteOffset
  = __ "offset" __ dx:SignedInt _ "," _ dy:SignedInt { return { dx, dy }; }

SignedInt
  = sign:"-"? digits:$[0-9]+ { return parseInt((sign || '') + digits, 10); }

LegendBlock
  = _ "legend" __ corner:LegendCornerToken title:(_ "\"" t:$[^"]* "\"" { return t; })? _ NL
    entries:LegendEntryLine*
    _ "end" _ NL? {
      const legend = { type: 'legend', corner, title: title || undefined, entries };
      overlays.push(legend);
      return legend;
    }

LegendCornerToken = "bottom-right" / "bottom-left" / "top-right" / "top-left"
LegendEntryLine   = _ !("end" ![a-zA-Z0-9_]) key:$[^:\n]+ ":" value:$[^\n]+ NL { return { key: key.trim(), value: value.trim() }; }

// ─── Whitespace ───────────────────────────────────────────────────────────────

BlankLine = _ Comment? NL { return null; }
Comment   = "%%" [^\n]*
_  = [ \t]*
__ = [ \t]+
NL = "\r\n" / "\n" / "\r"
