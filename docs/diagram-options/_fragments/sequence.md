## Sequence

Chronological message-passing diagram between named participants (or actors), with activation lifebars, fragment blocks, and overlay notes.

**Header keyword(s):** `sequenceDiagram`

---

### Participants

| Syntax                      | Kind                |
|-----------------------------|---------------------|
| `participant id`            | Box (auto-labelled) |
| `participant id as Label`   | Box (aliased)       |
| `actor id as Label`         | Stick figure        |

---

### Message arrows

| Operator | Line   | Head  |
|----------|--------|-------|
| `->>`    | solid  | Arrow |
| `-->>`   | dashed | Arrow |
| `->`     | solid  | Open  |
| `-->`    | dashed | Open  |
| `-x`     | solid  | Cross |
| `--x`    | dashed | Cross |
| `-)`     | solid  | Async |
| `--)`    | dashed | Async |

**Activation suffix (inline, appended after arrow):** `+` activate target · `-` deactivate source

---

### Overlays

| Syntax                        | Placement      |
|-------------------------------|----------------|
| `Note over id1, id2 : text`   | Spans both     |
| `Note left of id : text`      | Left side      |
| `Note right of id : text`     | Right side     |

---

### Fragment blocks

| Keyword    | Separator | Purpose                      |
|------------|-----------|------------------------------|
| `alt`      | `else`    | Conditional alternatives     |
| `opt`      |           | Optional block               |
| `loop`     |           | Repeated sequence            |
| `par`      | `and`     | Parallel threads             |
| `critical` |           | Critical region              |
| `break`    |           | Break / abort flow           |

All fragment blocks close with `end`.

---

### Config keywords

| Keyword      | Syntax       | Effect                           |
|--------------|--------------|----------------------------------|
| `autonumber` | `autonumber` | Auto-number each message         |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
theme: default
---
sequenceDiagram
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
sequenceDiagram
  participant A as Alice
  participant B as Bob
  A->>+B: Hello
  B-->>-A: Hi back
  Note over A,B: Greeting complete
```
