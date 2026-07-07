## State

Mermaid-compatible state diagram: states, transitions with optional labels, composite states, and choice/fork/join pseudo-states.

**Header keyword(s):** `stateDiagram` · `stateDiagram-v2`

---

### Transitions

| Syntax                          | Meaning                                  |
|---------------------------------|------------------------------------------|
| `StateA --> StateB`             | Unlabelled transition                    |
| `StateA --> StateB : label`     | Labelled transition                      |
| `[*] --> StateA`                | Entry from start pseudo-state            |
| `StateA --> [*]`                | Exit to end pseudo-state                 |

`[*]` maps to the start pseudo-state when used as source and end pseudo-state when used as target.

---

### Block keywords

| Syntax                    | Meaning                                  |
|---------------------------|------------------------------------------|
| `state Name { … }`       | Composite state (inner statements promoted) |

---

### Special state declarations

| Syntax                     | Kind produced |
|----------------------------|---------------|
| `state id <<choice>>`      | Choice node   |
| `state id <<fork>>`        | Fork node     |
| `state id <<join>>`        | Join node     |
| `state "label" as id`      | Aliased state with display label |
| `state id`                 | State declaration (label = id)   |

---

### Config keywords

| Keyword     | Syntax              | Notes                              |
|-------------|---------------------|------------------------------------|
| `direction` | `direction LR`      | Accepted by parser; ignored by Triton layout |
| `note`      | `note text`         | Accepted by parser; discarded      |

---

### Frontmatter

Optional YAML block before the header:
```
---
title: My Diagram
---
stateDiagram-v2
```

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
stateDiagram-v2
  [*] --> Idle
  Idle --> Running : start
  Running --> Idle : stop
  Running --> [*] : done
  state Running {
    [*] --> Busy
    Busy --> [*]
  }
```
