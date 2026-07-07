## Kanban

Work-item board with named columns and optionally-identified cards.

**Header keyword(s):** `kanban`

---

### Block keywords

| Syntax                          | Purpose              |
|---------------------------------|----------------------|
| Column label (unindented line)  | Declares a new column|

---

### Card syntax

| Syntax          | Description                      |
|-----------------|----------------------------------|
| `id[Card text]` | Card with an explicit identifier |
| `[Card text]`   | Anonymous card (no identifier)   |

Cards are indented beneath their column header. Identifier characters: `[a-zA-Z0-9_-]`.

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
kanban
  Todo
    t1[Design API endpoints]
    t2[Write specs]
  In Progress
    t3[Build auth service]
  Done
    t4[Project kickoff]
```
