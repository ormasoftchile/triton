## DS — Tree

Generic indentation-based hierarchy; node shape, colour, info sub-line, badge, and parent-edge label are all set per node via inline decoration syntax.

**Header keyword(s):** `tree`

---

### Directions

| Token | Meaning |
|-------|---------|
| `TD` · `TB` | Top → Down (default) |
| `LR` | Left → Right |

---

### Node line syntax

```
<indent> [|edge-label|] <label> [:kind …] [{attr: val, …}]
```

| Part | Purpose |
|------|---------|
| Leading whitespace | Determines parent–child relationship (deeper = child) |
| `\|edge-label\|` | Label on the edge from this node's parent |
| `<label>` | Node display text |
| `:kind` | One or more decoration tags (see table below) |
| `{k: v, k2: v2}` | Attribute block for info sub-line, badge, or additional kinds |

---

### Node kinds

| Kind token | Visual effect |
|------------|---------------|
| `box` | Rectangle node |
| `circle` | Circle node |
| `leaf` | Leaf terminal node |
| `dot` | Small dot (branch, no label) |
| `strip` | Multi-key strip (B-tree node) |
| `active` | Highlighted / filled accent |
| `scan` | Scan operator colour |
| `join` | Join operator colour |
| `build` | Build/hash/sort operator colour |
| `red` · `black` | Red-black tree node colours |
| `muted` | Muted/greyed text |
| `primary` | Primary accent colour |

---

### Attribute block keys

| Key | Value | Effect |
|-----|-------|--------|
| `badge` | any string | Corner badge on the node |
| `sub` · `info` | any string | Muted sub-line under the label |
| `rows` | number | Rendered as `rows: N` info sub-line |
| `idx` | string | Rendered as `idx: <val>` info sub-line |
| any other key | string/number | Rendered as `key: val` info sub-line |

---

### Config keywords

| Line | Purpose |
|------|---------|
| `tree [TD\|TB\|LR]` | Header with optional direction |
| `title <text>` | Diagram title (stored in metadata) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
tree TD
  title Decision tree
  x1 < 0.5 ? :box
    |yes| A :leaf
    |no|  B :leaf
```
