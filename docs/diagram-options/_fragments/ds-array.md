## DS — Array

Contiguous cell strip with optional index row and named pointer annotations.

**Header keyword(s):** `array`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `array <v1> <v2> …` | Inline cells on the header line |
| `title <text>` | Diagram title (bold, above strip) |
| `cells <v1> <v2> …` | Cell values (block form) |
| `index` | Show zero-based index row below cells |
| `ptr <name> -> <idx>` | Named pointer arrow below cell at 0-based `<idx>` |

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `c0` · `c1` · … `cn` | Individual cells (0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
array
  title nums
  cells 5 8 13 21 34
  index
  ptr i -> 2
```
