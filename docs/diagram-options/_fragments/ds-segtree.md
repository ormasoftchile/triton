## DS — Segment Tree

Segment tree over a numeric array; each node stores the reduced value for its `[lo, hi]` range sub-line. Built bottom-up at parse time.

**Header keyword(s):** `segtree`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `segtree over [<n1>,<n2>,…] reduce <reducer>` | Array and reducer keyword |
| `over […]` | Source array literal (numbers extracted by `/-?\d+/`) |
| `reduce <reducer>` | Aggregation function keyword |

### Reducer keywords

| Token | Operation |
|-------|-----------|
| `sum` | Summation (default when no reducer keyword present) |
| `min` | Minimum |
| `max` | Maximum |

**Key extraction:** all integers/floats matching `/-?\d+/` in the entire input are used as the array elements in order.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
segtree over [5, 8, 13, 21] reduce sum
```
