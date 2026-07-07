## Quadrant

Two-axis scatter chart divided into four labelled quadrant regions.

**Header keyword(s):** `quadrantChart`

---

### Config keywords

| Keyword      | Syntax                          | Notes                              |
|--------------|---------------------------------|------------------------------------|
| `title`      | `title <text>`                  | Plain text; rest of line           |
| `x-axis`     | `x-axis <left> --> <right>`     | Left and right end labels          |
| `y-axis`     | `y-axis <bottom> --> <top>`     | Bottom and top end labels          |
| `quadrant-1` | `quadrant-1 <label>`            | Top-right quadrant label           |
| `quadrant-2` | `quadrant-2 <label>`            | Top-left quadrant label            |
| `quadrant-3` | `quadrant-3 <label>`            | Bottom-left quadrant label         |
| `quadrant-4` | `quadrant-4 <label>`            | Bottom-right quadrant label        |

---

### Point syntax

| Syntax            | Notes                                            |
|-------------------|--------------------------------------------------|
| `Label: [x, y]`   | x and y are decimals in the range 0.0 – 1.0     |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
quadrantChart
  title Reach vs Engagement
  x-axis Low Reach --> High Reach
  y-axis Low Engagement --> High Engagement
  quadrant-1 Expand
  quadrant-2 Promote
  quadrant-3 Re-evaluate
  quadrant-4 Needs Attention
  Viral Video: [0.81, 0.87]
  Blog Post: [0.24, 0.68]
```
