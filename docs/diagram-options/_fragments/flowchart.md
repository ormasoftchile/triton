## Flowchart

Generic directed/undirected graph with layered layout, node shapes, and edge styles.
Supports subgraphs, overlays (notes, legends), and optional YAML frontmatter.

**Header keyword(s):** `flowchart` · `graph`

---

### Directions

| Token | Meaning        |
|-------|----------------|
| `TD`  | Top → Down     |
| `TB`  | Top → Bottom (identical to TD) |
| `BT`  | Bottom → Top   |
| `LR`  | Left → Right   |
| `RL`  | Right → Left   |

---

### Node shapes

| Syntax           | Shape             |
|------------------|-------------------|
| `id[Label]`      | Rectangle (default) |
| `id(Label)`      | Rounded rectangle |
| `id((Label))`    | Circle            |
| `id([Label])`    | Stadium (pill)    |
| `id[[Label]]`    | Subroutine (double-bracket) |
| `id[(Label)]`    | Cylinder          |
| `id{{Label}}`    | Hexagon           |
| `id{Label}`      | Diamond           |
| `id[/Label/]`    | Parallelogram     |
| `id[\Label\]`    | Parallelogram (alt, reversed slant) |
| `id>Label]`      | Asymmetric (flag/arrow) |

---

### Edge types

| Operator   | Kind  | Style  | Notes                    |
|------------|-------|--------|--------------------------|
| `-->`      | sync  | solid  | Arrow (most common)      |
| `---`      | sync  | solid  | Line, no arrowhead       |
| `--->`     | sync  | solid  | Long arrow               |
| `==>`      | sync  | solid  | Thick arrow              |
| `===`      | sync  | solid  | Thick line               |
| `-.->`     | async | dotted | Dashed arrow             |
| `-..->`    | async | dotted | Dashed arrow (long)      |
| `<-->`     | sync  | solid  | Bidirectional            |
| `<.->`  / `<.->` | async | dotted | Bidirectional dotted |
| `--x`      | sync  | solid  | Cross terminus           |
| `--o`      | sync  | solid  | Circle terminus          |

**Edge labels:** append `|label text|` after the operator — e.g. `-->|yes|`.

**Chains:** `A --> B --> C` expands to two edges; mix operators: `A --> B -.-> C`.

---

### Block keywords

| Keyword                          | Purpose                          |
|----------------------------------|----------------------------------|
| `subgraph id [Label]` … `end`   | Cluster nodes into a named group |

---

### Directives (captured, not interpreted by Triton layout)

| Keyword     | Syntax                        |
|-------------|-------------------------------|
| `style`     | `style id fill:#fff,…`        |
| `classDef`  | `classDef name fill:#fff,…`   |
| `class`     | `class id1,id2 name`          |
| `click`     | `click id callback`           |

---

### Overlays

| Keyword  | Syntax |
|----------|--------|
| `note`   | `note "text" at id` · optional `offset dx, dy` |
| `legend` | `legend top-left "Title"` / key: value lines / `end` |

Legend corners: `top-left` · `top-right` · `bottom-left` · `bottom-right`

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
author: Leslie
---
flowchart LR
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
flowchart LR
  A[Start] --> B{Decision}
  B -->|yes| C([Done])
  B -->|no|  D(Retry)
  D --> A
```
