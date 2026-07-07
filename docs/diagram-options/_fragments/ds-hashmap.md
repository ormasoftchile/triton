## DS — Hash Map

Hash map with separate chaining: a vertical index strip of buckets 0..N-1; non-empty buckets point right to a singly linked chain of key→value entry boxes.

**Header keyword(s):** `hashmap`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above map) |
| `buckets <N>` | Total bucket count (defaults to max referenced index + 1) |
| `bucket <idx>: <entries>` | Populate bucket `<idx>` with a comma-separated entry list |

**Entry syntax within a bucket line:**

| Separator | Example |
|-----------|---------|
| `->` | `alice->1` |
| `=>` | `alice=>1` |
| `:` | `alice:1` |
| `=` | `alice=1` |

Multiple entries per bucket are comma-separated: `alice->1, bob->2`.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `b0` · `b1` · … `bn` | Bucket index cells (0-based) |
| `b0e0` · `b0e1` · … | Entry boxes in bucket chain (bucket-index · entry-index) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
hashmap
  title users
  buckets 5
  bucket 0: alice->1, bob->2
  bucket 2: carol->3
```
