## Gitgraph

Git-history branching diagram with commit, branch, checkout, and merge operations.

**Header keyword(s):** `gitGraph`

---

### Statements

| Syntax                           | Purpose                            |
|----------------------------------|------------------------------------|
| `commit`                         | Add a commit to the current branch |
| `branch name`                    | Create a new branch                |
| `checkout name` · `switch name`  | Move HEAD to a named branch        |
| `merge name`                     | Merge named branch into HEAD       |

---

### Commit / Merge options

Appended as `key: value` pairs after the keyword; all are optional:

| Option | Syntax         | Value format                         |
|--------|----------------|--------------------------------------|
| `id`   | `id: "hash"`   | Quoted string                        |
| `tag`  | `tag: "v1.0"`  | Quoted string                        |
| `type` | `type: NORMAL` | Unquoted identifier or quoted string |

---

### Branch options

| Syntax     | Effect                                                      |
|------------|-------------------------------------------------------------|
| `order: N` | Integer render-order hint (parsed; value not stored in IR)  |

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
gitGraph
  commit
  branch feature
  checkout feature
  commit id: "feat-1" tag: "v0.1"
  checkout main
  merge feature tag: "v1.0"
```
