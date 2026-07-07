## DS — Heap

Binary heap built by real sift-up at parse time; rendered as the implicit complete binary tree (children of i are 2i+1, 2i+2); nodes are circles.

**Header keyword(s):** `heap`

---

### Item syntax

| Tokens | Purpose |
|--------|---------|
| `heap max <int1> <int2> …` | Max-heap (default) |
| `heap min <int1> <int2> …` | Min-heap |
| `insert` | Optional keyword (ignored; all integers in input are inserted) |

**Heap property selection:** presence of the word `min` anywhere in the input selects min-heap; otherwise max-heap.

**Key extraction:** all integers matching `/-?\d+/` in the entire input are extracted and inserted via sift-up in order.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
heap max insert 50 30 70 20 40 60 80
```
