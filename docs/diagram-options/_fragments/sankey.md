## Sankey

Flow diagram representing quantities transferred between nodes as proportional-width bands.

**Header keyword(s):** `sankey-beta`

---

### Link syntax

| Syntax                 | Notes                                              |
|------------------------|----------------------------------------------------|
| `Source,Target,Value`  | One CSV row per directed link; names may contain spaces |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
sankey-beta
Coal,Electricity Generation,4200
Natural Gas,Electricity Generation,3100
Electricity Generation,Industry,3600
```
