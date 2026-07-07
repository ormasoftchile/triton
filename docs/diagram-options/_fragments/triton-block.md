## Block

Arranges blocks in a responsive column grid with optional column spans and directed edges.

**Header keyword(s):** `block-beta`

---

### Config keywords

| Keyword   | Syntax        | Purpose                           |
|-----------|---------------|-----------------------------------|
| `columns` | `columns <N>` | Set the grid column count (default 1) |

---

### Block definitions

| Syntax             | Meaning                                              |
|--------------------|------------------------------------------------------|
| `id["Label"]`      | Block with label; bare identifiers also accepted     |
| `id["Label"]:<N>`  | Block spanning N columns                             |

Multiple block definitions may appear on the same line, separated by spaces.

---

### Edge types

| Syntax                        | Meaning                                  |
|-------------------------------|------------------------------------------|
| `<from> --> <to>`             | Directed arrow                           |
| `<from> --> \|<label>\| <to>` | Directed arrow with inline label         |

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
block-beta
  columns 3
  A["Frontend"]
  B["API Layer"]:2
  C["Auth"] D["Database"]:2
  A --> B
  B --> D
```
