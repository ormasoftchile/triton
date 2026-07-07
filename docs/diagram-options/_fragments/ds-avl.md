## DS — AVL Tree

Self-balancing BST rendered as a top-down circle-node tree; real AVL insertion with rotations is performed at parse time — the structure is always balanced by construction. Each node shows its balance factor as a corner badge.

**Header keyword(s):** `avl`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `avl <int1> <int2> …` | Integer keys to insert (duplicates silently ignored) |
| `insert` | Optional keyword (ignored; all integers in input are inserted) |

**Key extraction:** all integers matching `/-?\d+/` in the entire input are extracted and inserted in order.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
avl insert 50 30 70 20 40 60 80
```
