## DS — B-Tree

B-tree with configurable order; real insertion with node splitting at parse time — valid B-tree structure by construction. Internal nodes render as multi-key strip boxes.

**Header keyword(s):** `btree`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `btree order <N> insert <int1> …` | B-tree of order N with keys to insert |
| `order <N>` | Tree order (minimum 3; defaults to 3 if omitted) |
| `insert` | Optional keyword (ignored; all integers after `order <N>` are inserted) |

**Key extraction:** `order <N>` is stripped first; then all remaining integers matching `/-?\d+/` are inserted in order. Duplicates are silently ignored.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
btree order 3 insert 10 20 5 6 12 30 7 17
```
