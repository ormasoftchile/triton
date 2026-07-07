## Er

Mermaid-compatible entity-relationship diagram: entity blocks with typed attributes and key constraints, connected by crow's-foot relationships.

**Header keyword(s):** `erDiagram`

---

### Relationship types (crow's-foot notation)

Relationship token format: `<left-card><line><right-card>` — e.g., `||--o{`.

| Side token | Cardinality meaning |
|------------|---------------------|
| `\|\|`     | Exactly one         |
| `\|o`      | Zero or one         |
| `\|{`      | One or more         |
| `}o`       | Zero or more        |

**Line style:** `--` (solid / identifying) · `..` (dashed / non-identifying)

**Relation label:** required; quoted (`"label"`) or bare text — e.g., `ENTITY ||--o{ OTHER : places`.

---

### Attribute keys

| Keyword | Meaning       |
|---------|---------------|
| `PK`    | Primary key   |
| `FK`    | Foreign key   |
| `UK`    | Unique key    |

Attribute row syntax inside an entity block: `type name [PK|FK|UK]` — e.g., `string id PK`.

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
erDiagram
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
erDiagram
  CUSTOMER ||--o{ ORDER : places
  CUSTOMER {
    string id PK
    string name
  }
  ORDER {
    int id PK
    string status
  }
```
