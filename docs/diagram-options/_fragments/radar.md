## Radar

Spider/radar chart plotting one or more datasets across named axes on a radial scale.

**Header keyword(s):** `radar-beta`

---

### Config keywords

| Keyword | Syntax         | Notes                        |
|---------|----------------|------------------------------|
| `title` | `title <text>` | Plain text; rest of line     |
| `max`   | `max <num>`    | Numeric upper bound of scale |
| `min`   | `min <num>`    | Numeric lower bound of scale |

---

### Axis definition

| Syntax                | Notes                                         |
|-----------------------|-----------------------------------------------|
| `axis id["Label"], …` | Comma-separated list; display label optional  |
| `axis id, …`          | Short form — id doubles as the display label  |

---

### Curve (dataset) definition

| Syntax                        | Notes                                                      |
|-------------------------------|------------------------------------------------------------|
| `curve id["Label"]{v, v, …}`  | Named dataset; values must match axis count in order       |
| `curve id{v, v, …}`           | Short form — id doubles as the display label               |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
radar-beta
title Team Skills
axis sp["Speed"], rl["Reliability"], cm["Communication"]
curve team["Our Team"]{8, 9, 7}
max 10
min 0
```
