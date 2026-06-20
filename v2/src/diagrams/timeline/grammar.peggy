/**
 * Timeline Grammar — Peggy PEG
 *
 * Two-layer design:
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ LAYER 1: MERMAID-COMPATIBLE                                         │
 * │   timeline header, title directive, section blocks,                  │
 * │   simple entries (date : Event text)                                 │
 * ├─────────────────────────────────────────────────────────────────────┤
 * │ LAYER 2: TRITON EXTENSIONS (gated by options.extensions ≠ false)    │
 * │   layout/axisUnit directives, date ranges (start -- end),           │
 * │   status annotations (:active/:done/:blocked),                       │
 * │   milestone keyword, track assignment (@track), frontmatter          │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Usage:
 *   parse(input)                      → full superset (extensions: true)
 *   parse(input, { extensions: false }) → strict Mermaid-only
 *
 * Target IR: TimelineDocument
 */

{{
  const tracks = new Map();
  const activities = [];
  const milestones = [];
  const sections = [];
  const overlays = [];
  let activityCounter = 0;
  let milestoneCounter = 0;
  let sectionCounter = 0;
  let currentSection = null;

  function ensureTrack(id) {
    if (!id) id = 'default';
    if (!tracks.has(id)) {
      tracks.set(id, { id, label: id.charAt(0).toUpperCase() + id.slice(1) });
    }
    return id;
  }

  function addActivity(start, end, label, status, trackId) {
    activityCounter++;
    const id = slugify(label) || `activity-${activityCounter}`;
    activities.push({
      id,
      label,
      track: ensureTrack(trackId),
      start,
      end: end || undefined,
      status: status || 'default',
    });
  }

  function addMilestone(date, label, trackId) {
    milestoneCounter++;
    const id = slugify(label) || `milestone-${milestoneCounter}`;
    milestones.push({
      id,
      label,
      date,
      track: trackId ? ensureTrack(trackId) : undefined,
    });
  }

  function openSection(label, start) {
    sectionCounter++;
    currentSection = {
      id: slugify(label) || `section-${sectionCounter}`,
      label,
      start,
      end: start,
    };
  }

  function closeSection(end) {
    if (currentSection) {
      if (end) currentSection.end = end;
      sections.push(currentSection);
      currentSection = null;
    }
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || '';
  }

  function reset() {
    tracks.clear();
    activities.length = 0;
    milestones.length = 0;
    sections.length = 0;
    overlays.length = 0;
    activityCounter = 0;
    milestoneCounter = 0;
    sectionCounter = 0;
    currentSection = null;
  }
}}

{
  // Per-parse init — options.extensions gates Layer 2 rules
  reset();
  const ext = options.extensions !== false;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Top-level
// ═══════════════════════════════════════════════════════════════════════════════

Document
  = frontmatter:ExtFrontmatter? _ header:Header _ directives:Directive* _ body:Body _ {
      closeSection(null);
      return {
        version: '1.0',
        metadata: { ...(frontmatter || {}), ...(directives.find(d => d.key === 'title') ? { title: directives.find(d => d.key === 'title').value } : {}) },
        layout: (directives.find(d => d.key === 'layout') || {}).value || 'horizontal',
        tracks: tracks.size > 0 ? [...tracks.values()] : [{ id: 'default', label: 'Default' }],
        activities,
        milestones,
        sections: sections.length > 0 ? sections : undefined,
        overlays,
      };
    }

Header
  = "timeline" NL { return 'timeline'; }

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1 — Mermaid-compatible directives
// ═══════════════════════════════════════════════════════════════════════════════

Directive
  = ExtDirective
  / MermaidDirective

MermaidDirective "mermaid directive"
  = _ "title" __ value:$[^\n]+ _ NL {
      return { key: 'title', value: value.trim() };
    }

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 1 — Mermaid-compatible body (section + simple entries)
// ═══════════════════════════════════════════════════════════════════════════════

Body
  = items:(NoteDirective / LegendBlock / SectionHeader / Entry / BlankLine)* { return items.filter(Boolean); }

SectionHeader "section header"
  = _ "section" __ label:$[^\n]+ NL {
      closeSection(null);
      const trimmed = label.trim();
      openSection(trimmed, trimmed);
      return null;
    }

Entry
  = _ entry:(ExtEntry / MermaidEntry) _ Comment? NL {
      return entry;
    }

// Mermaid basic: indented text : event description
// In standard Mermaid, the "date" part before colon is just display text
MermaidEntry "mermaid entry"
  = date:DateToken _ ":" _ label:MermaidLabel {
      // In mermaid-compat mode, everything is an activity (no milestone distinction)
      addActivity(date, null, label, 'default', null);
      if (currentSection) currentSection.end = date;
      return { type: 'activity', label };
    }

MermaidLabel "mermaid label"
  = text:$[^\n]+ { return text.trim(); }

// ═══════════════════════════════════════════════════════════════════════════════
// LAYER 2 — Triton extensions (gated by `ext`)
// ═══════════════════════════════════════════════════════════════════════════════

// --- Extension: frontmatter ---
ExtFrontmatter
  = &{ return ext; } "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {};
      for (const line of lines) {
        const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
        if (m) meta[m[1]] = m[2];
      }
      return meta;
    }

// --- Extension: layout, axisUnit directives ---
ExtDirective "extension directive"
  = &{ return ext; } _ key:("layout" / "axisUnit") __ value:$[^\n]+ _ NL {
      return { key, value: value.trim() };
    }

// --- Extension: entries with ranges, status, milestones, tracks ---
ExtEntry "extension entry"
  = &{ return ext; } entry:(ExtRangeActivity / ExtPointEntry) { return entry; }

// 2025-Q1 -- 2025-Q2 : label : status @track
ExtRangeActivity
  = start:DateToken _ "--" _ end:DateToken _ ":" _ label:ExtLabel status:(_ ":" _ s:ExtStatus { return s; })? track:(_ "@" id:Identifier { return id; })? {
      addActivity(start, end, label, status, track);
      if (currentSection) currentSection.end = end;
      return { type: 'activity', label };
    }

// 2025-01 : label : milestone @track   OR   2025-01 : label : active @track
ExtPointEntry
  = date:DateToken _ ":" _ label:ExtLabel ":" _ kind:ExtEntryKind track:(_ "@" id:Identifier { return id; })? {
      if (kind === 'milestone') {
        addMilestone(date, label, track);
      } else {
        addActivity(date, null, label, kind, track);
      }
      if (currentSection) currentSection.end = date;
      return { type: kind === 'milestone' ? 'milestone' : 'activity', label };
    }

ExtLabel "extension label"
  = text:$[^:\n@]+ { return text.trim(); }

ExtEntryKind
  = "milestone" / ExtStatus

ExtStatus
  = "active" / "done" / "blocked" / "default"

// ═══════════════════════════════════════════════════════════════════════════════
// Shared tokens
// ═══════════════════════════════════════════════════════════════════════════════

DateToken "date"
  = $([a-zA-Z0-9_\-/.]+)

Identifier
  = $([a-zA-Z_][a-zA-Z0-9_\-]*)

// ═══════════════════════════════════════════════════════════════════════════════
// Shared Overlay Directives (note, legend)
// ═══════════════════════════════════════════════════════════════════════════════

NoteDirective
  = _ "note" __ "\"" text:$[^"]* "\"" __ "at" __ target:$([a-zA-Z0-9_\-/.]+)
    offset:NoteOffset? _ Comment? NL {
      const note = { type: 'note', text, target, offset: offset || undefined };
      overlays.push(note);
      return note;
    }

NoteOffset
  = __ "offset" __ dx:SignedInt _ "," _ dy:SignedInt {
      return { dx, dy };
    }

SignedInt
  = sign:"-"? digits:$[0-9]+ { return parseInt((sign || '') + digits, 10); }

LegendBlock
  = _ "legend" __ corner:LegendCornerToken title:(_ "\"" t:$[^"]* "\"" { return t; })? _ NL
    entries:LegendEntryLine*
    _ "end" _ NL? {
      const legend = {
        type: 'legend',
        corner,
        title: title || undefined,
        entries,
      };
      overlays.push(legend);
      return legend;
    }

LegendCornerToken
  = "bottom-right" / "bottom-left" / "top-right" / "top-left"

LegendEntryLine
  = _ !("end" !([a-zA-Z0-9_])) key:$[^:\n]+ ":" value:$[^\n]+ NL {
      return { key: key.trim(), value: value.trim() };
    }

// ═══════════════════════════════════════════════════════════════════════════════
// Whitespace
// ═══════════════════════════════════════════════════════════════════════════════

BlankLine
  = _ Comment? NL { return null; }

Comment
  = "%%" [^\n]*

_ "optional whitespace"
  = [ \t]*

__ "required whitespace"
  = [ \t]+

NL "newline"
  = "\r\n" / "\n" / "\r"
