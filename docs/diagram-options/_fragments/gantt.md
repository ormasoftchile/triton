## Gantt

Horizontal bar chart for project schedules with sections, task statuses, `after` dependencies, and critical-path markers.

**Header keyword(s):** `gantt`

---

### Config keywords

| Keyword        | Syntax                  | Behaviour                                   |
|----------------|-------------------------|---------------------------------------------|
| `title`        | `title My Title`        | Chart title                                 |
| `dateFormat`   | `dateFormat YYYY-MM-DD` | Input date format used by the resolver      |
| `excludes`     | `excludes weekends`     | Parsed; not rendered by Triton              |
| `axisFormat`   | `axisFormat %m/%d`      | Parsed; not rendered by Triton              |
| `todayMarker`  | `todayMarker off`       | Parsed; not rendered by Triton              |
| `tickInterval` | `tickInterval 1week`    | Parsed; not rendered by Triton              |

---

### Block keywords

| Syntax          | Purpose                        |
|-----------------|--------------------------------|
| `section Label` | Groups tasks into a named band |

---

### Entry / Event syntax

Task lines use `name : meta` where `meta` is a comma-separated list of tokens resolved by `index.ts`:

| Meta token          | Meaning                              |
|---------------------|--------------------------------------|
| `done`              | Task is complete                     |
| `active`            | Task is in progress                  |
| `crit`              | Mark as critical-path                |
| `milestone`         | Zero-duration milestone marker       |
| `id`                | Unique task identifier               |
| `YYYY-MM-DD`        | Absolute start date                  |
| `after id`          | Start after the named task ends      |
| `Nd` · `Nw` · `Nh` | Duration in days · weeks · hours     |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Gantt
theme: roadmap
---
gantt
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
gantt
  title Project Roadmap
  dateFormat YYYY-MM-DD
  section Phase 1
    Planning : done, p1, 2025-01-01, 14d
    Design   : active, p2, after p1, 14d
  section Phase 2
    Build    : p3, after p2, 30d
    Release  : crit, milestone, 2025-04-15, 0d
```
