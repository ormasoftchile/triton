## DS — Queue

Linear FIFO queue: horizontal cell strip with dequeue arrow at the front (left) and enqueue arrow at the rear (right); front/rear pointers below the filled span.

**Header keyword(s):** `queue`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `queue <v1> <v2> …` | Inline filled cells on the header line |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> …` · `items <v1> …` | Filled cell values (block form) |
| `capacity <N>` | Total slot count (N ≥ filled); trailing empty slots shown |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual cells (0-based, including empty slots) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
queue
  title task queue
  cells A B C
  capacity 5
```
