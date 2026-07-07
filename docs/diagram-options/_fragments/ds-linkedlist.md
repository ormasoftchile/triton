## DS — Linked List

Singly linked list rendered as a chain of value|pointer node pairs with a head arrow.

**Header keyword(s):** `linkedlist`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `linkedlist <v1> <v2> …` | Inline node values on the header line |
| `title <text>` | Diagram title (bold, above chain) |
| `values <v1> <v2> …` · `nodes <v1> <v2> …` | Explicit node list (block form) |
| bare tokens | Any unrecognised line tokens are appended as node values |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `n0` · `n1` · … `nn` | Individual list nodes (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
linkedlist
  title queue
  values 3 7 9
```
