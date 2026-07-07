## Poster

Composes multiple diagrams, stats, and text blocks into a multi-column grid layout.

**Header keyword(s):** `poster`

Optional title: `poster "Dashboard Title"`

---

### Config keywords

| Keyword   | Syntax        | Purpose                              |
|-----------|---------------|--------------------------------------|
| `columns` | `columns <N>` | Number of grid columns (default 2)   |
| `rows`    | `rows <N>`    | Number of grid rows                  |
| `gap`     | `gap <N>`     | Gap between cells                    |

---

### Block keywords

| Keyword | Syntax                                                                          | Purpose                                            |
|---------|---------------------------------------------------------------------------------|----------------------------------------------------|
| `cell`  | `cell [id] ["Title"] [span] [:: kind] [@theme name]` … `end`                   | Grid cell containing a sub-diagram or text content |
| `link`  | `link <from.node> <arrow> <to.node> ["label"] [@routing] [{props}]`            | Cross-cell link overlay                            |
| `trace` | `trace "name" [: type] [color "hex"] <from.n> --> <to.n>`                      | Semantic trace path across cell boundaries         |

---

### Cell spans

| Syntax  | Meaning                          |
|---------|----------------------------------|
| `[N]`   | Span N columns, 1 row            |
| `[NxM]` | Span N columns × M rows          |

---

### Cell kinds

| Kind                              | Content                                   |
|-----------------------------------|-------------------------------------------|
| `flowchart` · `flow`              | Flowchart sub-diagram                     |
| `timeline`                        | Timeline sub-diagram                      |
| `stat`                            | Stat block: `value \| label`              |
| `text`                            | Plain text block                          |
| any identifier                    | Custom or `ds` sub-diagram kind           |

---

### Link arrows

| Operator  | Direction     | Style  |
|-----------|---------------|--------|
| `-->`     | directed      | solid  |
| `-.->`    | directed      | dashed |
| `..>`     | directed      | dotted |
| `<-->`    | bidirectional | solid  |
| `<-.->`   | bidirectional | dashed |
| `<..>`    | bidirectional | dotted |
| `---`     | undirected    | solid  |
| `-.-`     | undirected    | dashed |
| `...`     | undirected    | dotted |

---

### Link routing

| Annotation    | Routing style        |
|---------------|----------------------|
| `@straight`   | Straight line        |
| `@orthogonal` | Right-angle segments |
| `@bezier`     | Bézier curve         |
| `@polyline`   | Polyline segments    |

---

### Trace types

| Type                                   | Semantics                              |
|----------------------------------------|----------------------------------------|
| `satisfies` · `triggers` · `calls`     | Dependency or invocation               |
| `reads` · `writes`                     | Data-flow direction                    |
| `extends` · `custom`                   | Extension or user-defined              |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: Dashboard
author: Alice
---
poster "My Poster"
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
poster "System Dashboard"
  columns 2

  cell "Services"
    flowchart LR
      api[API] --> db[(Database)]
  end

  cell "Uptime"
    99.9% | uptime
  end
```
