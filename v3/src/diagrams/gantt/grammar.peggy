// Gantt Grammar — Peggy PEG
//
// Mermaid-compatible gantt syntax. Task metadata (after the colon) is captured
// raw; the module resolves status / id / start / duration and `after <id>`
// dependencies into concrete dates.
//
//   gantt
//       title Roadmap
//       dateFormat YYYY-MM-DD
//       section Infrastructure
//           Containerise services :done, inf1, 2025-01-06, 30d
//           Kubernetes migration  :done, inf2, after inf1, 45d

{{
}}

Document
  = fm:Frontmatter? _ "gantt"i LineEnd lines:Line* _ {
      let title, dateFormat;
      const sections = [];
      for (const l of lines.filter(Boolean)) {
        if      (l.t === 'title')      title = l.v;
        else if (l.t === 'dateFormat') dateFormat = l.v;
        else if (l.t === 'section')    sections.push({ label: l.label, tasks: [] });
        else if (l.t === 'task') {
          if (sections.length === 0) sections.push({ label: '', tasks: [] });
          sections[sections.length - 1].tasks.push({ name: l.name, meta: l.meta });
        }
      }
      return {
        version: '1.0',
        metadata: { ...(fm || {}), ...(title ? { title } : {}) },
        dateFormat: dateFormat || 'YYYY-MM-DD',
        sections,
      };
    }

Frontmatter
  = "---" NL lines:(!("---" NL) line:$[^\n]* NL { return line; })* "---" NL {
      const meta = {};
      for (const line of lines) {
        const m = line.match(/^\s*(\w+)\s*:\s*(.+?)\s*$/);
        if (m) meta[m[1]] = m[2];
      }
      return meta;
    }

Line
  = TitleLine / DateFormatLine / ExcludesLine / SectionLine / TaskLine / BlankLine

TitleLine      = _ "title"i __ v:RestOfLine LineEnd { return { t: 'title', v: v.trim() }; }
DateFormatLine = _ "dateFormat"i __ v:RestOfLine LineEnd { return { t: 'dateFormat', v: v.trim() }; }
ExcludesLine   = _ ("excludes"i / "axisFormat"i / "todayMarker"i / "tickInterval"i) __ RestOfLine LineEnd { return null; }
SectionLine    = _ "section"i __ label:RestOfLine LineEnd { return { t: 'section', label: label.trim() }; }

TaskLine
  = _ name:$[^:\n]+ ":" meta:$[^\n]+ LineEnd { return { t: 'task', name: name.trim(), meta: meta.trim() }; }

RestOfLine = $[^\n]+
BlankLine = _ "\r"? "\n" { return null; }
NL = "\r"? "\n"
LineEnd = "\r"? "\n" / !.
_ = [ \t]*
__ = [ \t]+
