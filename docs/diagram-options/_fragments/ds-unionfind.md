## DS — Union-Find (DSU)

Disjoint Set Union forest: one tree per set, rooted at the set representative (filled circle); member nodes are plain circles; edges are parent pointers drawn top-down.

**Header keyword(s):** `unionfind` · `dsu`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `unionfind <N>` · `dsu <N>` | N elements (0-based), initialised as singletons |
| `title <text>` | Diagram title (stored in metadata) |
| `parent <p0> <p1> … <pN-1>` | Explicit parent array; `parent[i] == i` marks a representative |
| `union <a> <b>` | Attach the root of set(a) under the root of set(b) |

**Precedence:** `parent` array is applied first (seeding identities), then `union` operations are applied in order.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `e0` · `e1` · … `en` | Element nodes (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
unionfind 7
  parent 0 0 1 3 3 5 5
```
