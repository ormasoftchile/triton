## DS — Matrix

2D rectangular grid of equal cells; row and column indices displayed by default; ragged rows are right-padded with blanks.

**Header keyword(s):** `matrix`

---

### Item syntax

| Line | Purpose |
|------|---------|
| `matrix <R>x<C>` | Empty R-row × C-column grid (on the header line) |
| `title <text>` | Diagram title (bold, above grid) |
| `noindex` | Hide row (left) and column (top) index labels |
| `row <v1> <v2> …` | One grid row of cell values |

**Shorthand:** `matrix 3x4` on its own line creates an empty 3×4 grid before any `row` lines.

---

### Anchor slots

| Pattern | Target |
|---------|--------|
| `r0c0` · `r0c1` · … | Individual cells — `r<row>c<col>` (both 0-based) |

---

### Comments

Full-line `%%` comments are supported and stripped centrally before any parser runs:
```
%% This is a comment
```

---

### Minimal snippet

```
matrix
  title weights
  row 1 2 3
  row 4 5 6
```
