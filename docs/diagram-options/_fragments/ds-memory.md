## DS — Memory

Named memory regions side-by-side, containing variable slots and heap objects; cross-region pointer arrows connect slots to their targets.

**Header keyword(s):** `memory`

---

### Region syntax

| Line | Purpose |
|------|---------|
| `title <text>` | Diagram title (bold, above regions) |
| `region <NAME>` | Start a named region block |
| `var <name>` | A plain variable slot inside the current region |
| `var <name> -> <target-id>` | Slot with a pointer arrow to `<target-id>` in any region |
| `object <id> : <title> : <k>=<v>, …` | Heap object with fields (colon-delimited sections) |

**Entry separator for object fields:** `,` between `key=value` pairs.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `<var-name>` | The var slot box |
| `<object-id>` | The object box |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
memory
  title Stack → Heap
  region STACK
    var p -> obj
  region HEAP
    object obj : Point : x=1, y=2
```
