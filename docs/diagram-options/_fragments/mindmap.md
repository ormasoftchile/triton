## Mindmap

Hierarchical radial tree where indentation depth defines parent-child relationships.

**Header keyword(s):** `mindmap`

---

### Node shapes

| Syntax      | Shape             |
|-------------|-------------------|
| `((text))`  | Circle            |
| `(text)`    | Rounded rectangle |
| `[text]`    | Rectangle         |
| `{{text}}`  | Hexagon           |

---

### Directives

| Syntax           | Notes                                                |
|------------------|------------------------------------------------------|
| `::icon(name)`   | Attaches an icon to the preceding node; one per node |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Mindmap
theme: dark-tree
---
mindmap
```

---

### Comments

Lines starting with `%%` are stripped before parsing (indentation of real nodes is unaffected):
```
%% This is a comment
```

---

### Minimal snippet

```
mindmap
  root((Central Topic))
    Branch One
      Leaf A
      Leaf B
    Branch Two
      Leaf C
```
