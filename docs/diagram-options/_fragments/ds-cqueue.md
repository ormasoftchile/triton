## DS — Circular Queue

Ring-buffer queue: horizontal cell strip (same as linear queue) with a curved wrap-around arc from the rear cell back to the front cell; front/rear markers below.

**Header keyword(s):** `cqueue`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above strip) |
| `capacity <N>` | Total ring capacity (required or inferred from cells) |
| `cells <v1> …` · `items <v1> …` | Cell values; use `_`, `.`, or `-` for empty slots |
| `front <idx>` | 0-based index of the front pointer (inferred if omitted) |
| `rear <idx>` | 0-based index of the rear pointer (inferred if omitted) |

**Empty-slot tokens:** `_` · `.` · `-`

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual ring cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
cqueue
  title ring buffer
  capacity 6
  cells _ B C D _ _
  front 1
  rear 3
```
