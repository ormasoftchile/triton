## Xychart

Categorical-x, numeric-y chart supporting bar and line series on a shared axis pair.

**Header keyword(s):** `xychart-beta`

---

### Directions

| Token        | Meaning                   |
|--------------|---------------------------|
| `horizontal` | Horizontal layout         |
| `vertical`   | Vertical layout (default) |

---

### Config keywords

| Keyword  | Syntax                          | Notes                                  |
|----------|---------------------------------|----------------------------------------|
| `title`  | `title "text"` · `title text`   | Quoted or plain; one per chart         |
| `x-axis` | `x-axis [cat, cat, …]`          | Categorical labels in square brackets  |
| `y-axis` | `y-axis "label" min --> max`    | Optional quoted label; optional range  |

---

### Series types

| Keyword | Syntax           | Notes                                         |
|---------|------------------|-----------------------------------------------|
| `bar`   | `bar [v, v, …]`  | Bar series; one value per x-axis category     |
| `line`  | `line [v, v, …]` | Line series; one value per x-axis category    |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
xychart-beta
  title "Monthly Revenue"
  x-axis [Jan, Feb, Mar]
  y-axis "Revenue" 0 --> 6000
  bar [1800, 2600, 3400]
  line [2000, 2500, 3000]
```
