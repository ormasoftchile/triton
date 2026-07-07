## DS — Red-Black Tree

Left-leaning red-black tree (LLRB / Sedgewick); real insertion with rotations and colour flips at parse time — valid red-black colouring by construction. Each node is tagged `red` or `black`.

**Header keyword(s):** `rbtree`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `rbtree <int1> <int2> …` | Integer keys to insert (duplicates silently ignored) |
| `insert` | Optional keyword (ignored; all integers in input are inserted) |

**Key extraction:** all integers matching `/-?\d+/` in the entire input are extracted and inserted in order. The root is always forced black after each insertion.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
rbtree insert 13 8 17 1 11 15 25 6
```
