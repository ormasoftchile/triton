## Class

Mermaid-compatible class diagram: class blocks with typed members, stereotypes, and relationships with cardinality and labels.

**Header keyword(s):** `classDiagram` · `classDiagram-v2`

---

### Relationship types

| Token   | Left head | Right head | Line   |
|---------|-----------|------------|--------|
| `<|--`  | triangle  | none       | solid  |
| `--|>`  | none      | triangle   | solid  |
| `<|..`  | triangle  | none       | dashed |
| `..|>`  | none      | triangle   | dashed |
| `*--`   | diamondF  | none       | solid  |
| `--*`   | none      | diamondF   | solid  |
| `o--`   | diamondO  | none       | solid  |
| `--o`   | none      | diamondO   | solid  |
| `<--`   | arrow     | none       | solid  |
| `-->`   | none      | arrow      | solid  |
| `<..`   | arrow     | none       | dashed |
| `..>`   | none      | arrow      | dashed |
| `--`    | none      | none       | solid  |
| `..`    | none      | none       | dashed |

**Cardinality:** quoted string on either side of the relation token — e.g., `"1"` · `"*"` · `"0..1"`.

**Relation label:** ` : label` appended after the right class name.

---

### Class body syntax

| Syntax               | Meaning                                       |
|----------------------|-----------------------------------------------|
| `class Name { … }`  | Class block with inline member rows           |
| `Name : memberText`  | Standalone member line outside a block        |
| `<<stereotype>>`     | Stereotype annotation inside a class block    |

Members whose text contains `(` are parsed as methods; all others are parsed as attributes.

---

### Config keywords

| Keyword | Syntax      | Notes                         |
|---------|-------------|-------------------------------|
| `note`  | `note text` | Accepted by parser; discarded |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
classDiagram
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
classDiagram
  class Animal {
    +String name
    +move() void
  }
  class Dog {
    +bark() void
  }
  Animal <|-- Dog : extends
  Animal "1" --o "*" Dog : owns
```
