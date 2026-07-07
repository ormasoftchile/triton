## DS — Priority Queue

Vertical stack of cells ordered by priority (highest at top); each cell is shaded by priority tint and shows its label and numeric priority value.

**Header keyword(s):** `pqueue`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above stack) |
| `item <label words…> <priority>` | One entry; trailing numeric token is the priority; ties preserve input order |

**Ordering:** highest priority rendered at the top; numeric priorities (integer or float); negative values allowed.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Cells in sorted display order (top = highest priority) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
pqueue
  title scheduler
  item Deploy 9
  item Build 5
  item Lint 2
```
