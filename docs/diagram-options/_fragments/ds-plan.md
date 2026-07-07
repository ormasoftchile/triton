## DS — Plan

Query-plan tree: same indentation syntax as `tree`, but operator node colours are automatically inferred from label text — no manual `:kind` tags required for standard operators.

**Header keyword(s):** `plan`

---

### Auto-inferred kinds (from label text)

| Label contains | Inferred kind | Visual |
|----------------|---------------|--------|
| `join` | `join` | Join operator colour |
| `scan` | `scan` | Scan operator colour |
| `hash`, `sort`, `aggregate`, `group`, `materialize`, `gather` | `build` | Build/hash colour |

Manual `:kind` tags on a node override inference for that node.

---

### Node line syntax (identical to `tree`)

```
<indent> [|edge-label|] <label> [:kind …] [{attr: val, …}]
```

All node syntax, directions, attribute block keys, and config keywords from the `tree` family apply unchanged. See **DS — Tree** for the full reference.

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
plan
  title Query plan
  Hash Join {rows: 980}
    Seq Scan orders {rows: 10000}
    Hash
      Index Scan customers {idx: idx_cust}
```
