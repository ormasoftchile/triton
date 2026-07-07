## DS — Page

Slotted storage page: a PageHeader bar, a row of numbered slot pointers, a free-space region, and a row of tuples; arrows connect each slot to its tuple.

**Header keyword(s):** `page`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above page) |
| `slots <N>` | Number of slot pointers (defaults to tuple count) |
| `tuples <t1> <t2> …` | Tuple value tokens (space-separated, one per cell) |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `slot0` · `slot1` · … | Slot pointer cells (0-based) |
| `tuple0` · `tuple1` · … | Tuple cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
page
  title heap page
  slots 4
  tuples (10,Ann) (40,Bob) (50,Cy)
```
