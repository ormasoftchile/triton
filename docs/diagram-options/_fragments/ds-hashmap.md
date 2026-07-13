## DS — Hash Map

Hash map with separate chaining: a vertical bucket strip whose rows can be numbered (`0..N-1`) or labeled with arbitrary strings; non-empty buckets point right to a singly linked chain of key→value entry boxes.

**Header keyword(s):** `hashmap`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above map) |
| `buckets <N>` | Total bucket count (defaults to max referenced numeric index + 1) |
| `buckets <label>, <label>, ...` | Explicit bucket labels, e.g. `buckets name, email, phone` |
| `bucket <idx-or-label>: <entries>` | Populate bucket `<idx-or-label>` with a comma-separated entry list |

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
| `b0` · `b1` · … `bn` | Bucket rows in display order (positional, still 0-based for compatibility) |
| `b0e0` · `b0e1` · … | Entry boxes in bucket chains (bucket-row · entry-index) |

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
  buckets name, email, phone, zip
  bucket name: alice->1, bob->2
  bucket email: carol->carol@example.com
  bucket zip: dave->90210
```

Numeric bucket syntax remains valid:
```
hashmap
  buckets 5
  bucket 0: alice->1, bob->2
  bucket 2: carol->3
```
