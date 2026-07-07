## Timeline

Horizontal (or custom-layout) timeline with sections, dated activity entries, range spans, milestones, status annotations, and overlays. Supports Triton extension directives.

**Header keyword(s):** `timeline`

---

### Config keywords

| Keyword    | Layer | Syntax              |
|------------|-------|---------------------|
| `title`    | L1    | `title My Title`    |
| `subtitle` | L1    | `subtitle Subtitle` |
| `theme`    | L1    | `theme name`        |
| `layout`   | L2    | `layout value`      |
| `axisUnit` | L2    | `axisUnit value`    |

L1 = Mermaid-compatible; L2 = Triton extension (requires `extensions !== false`).

---

### Block keywords

| Syntax          | Purpose                          |
|-----------------|----------------------------------|
| `section Label` | Groups entries into a named span |

---

### Entry / Event syntax

| Syntax                                         | Kind                   |
|------------------------------------------------|------------------------|
| `date : Event text`                            | Point activity (L1)    |
| `start -- end : Label`                         | Range activity (L2)    |
| `start -- end : Label : status`                | Range with status (L2) |
| `start -- end : Label : status @track \| desc` | Full range form (L2)   |
| `date : Label : active\|done\|blocked`         | Annotated point (L2)   |
| `date : Label : milestone`                     | Milestone (L2)         |

**Status values:** `active` · `done` · `blocked` · `default`

**Track assignment:** `@trackId` — groups entries into a named swim-lane.

**Inline description:** `| description text` — appended after optional track assignment.

---

### Overlays

| Keyword  | Syntax                                               |
|----------|------------------------------------------------------|
| `note`   | `note "text" at target` · optional `offset dx, dy`  |
| `legend` | `legend corner "Title"` / `key: value` lines / `end`|

Legend corners: `top-left` · `top-right` · `bottom-left` · `bottom-right`

---

### Frontmatter

Optional YAML block before the header (Triton extension):
```
---
title: My Timeline
author: Team
---
timeline
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

> **Grammar constraint:** `%%` comment lines are only valid inside the `Body` section — i.e., after all directive lines (`title`, `subtitle`, `theme`, `layout`, `axisUnit`). Placing `%%` comments between the `timeline` keyword and the directives causes a parse error.

---

### Minimal snippet

```
timeline
  title 2025 Milestones
  section Q1
    2025-01-15 : Kickoff
    2025-03-01 : Alpha release
  section Q2
    2025-06-01 : Beta launch
```
