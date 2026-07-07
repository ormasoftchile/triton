## Pie

Proportional arc chart where slices are sized by numeric value.

**Header keyword(s):** `pie`

---

### Config keywords

| Keyword    | Syntax                       | Notes                                          |
|------------|------------------------------|------------------------------------------------|
| `showData` | `pie showData …`             | Optional flag; placed before `title` if used  |
| `title`    | `pie … title <text>`         | Optional; plain text to end of header line     |

---

### Slice syntax

| Syntax              | Notes                                    |
|---------------------|------------------------------------------|
| `"Label" : <num>`   | Quoted label; value is a decimal number  |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
pie showData title Language Popularity
  "Python" : 28.5
  "JavaScript" : 22.3
  "Other" : 49.2
```
