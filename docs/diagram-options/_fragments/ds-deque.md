## DS — Deque

Double-ended queue: horizontal cell strip with push/pop double-headed arrows at both the front (left) and rear (right) ends; front/rear pointers below.

**Header keyword(s):** `deque`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `deque <v1> <v2> …` | Inline cells on the header line |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> …` · `items <v1> …` | Cell values (block form) |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
deque
  title work-stealing deque
  cells A B C D
```
