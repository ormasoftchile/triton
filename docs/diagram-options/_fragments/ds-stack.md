## DS — Stack

LIFO stack: vertical cell strip with push/pop arrow at the top; a `top` pointer on the left marks the top-of-stack cell; optional empty slots above show remaining capacity.

**Header keyword(s):** `stack`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `stack <v1> <v2> …` | Inline cells on the header line (last token = top of stack) |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> …` · `items <v1> …` | Cell values in push order; last = top (block form) |
| `capacity <N>` | Total slot count (N ≥ filled); empty slots shown above top |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Cells in display order (top = index of first empty slot, or 0) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
stack
  title call stack
  cells main parse layout
  capacity 6
```
