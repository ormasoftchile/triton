## Architecture

Arranges services and named groups with port-anchored edges for infrastructure and system-context diagrams.

**Header keyword(s):** `architecture-beta`

---

### Block keywords

| Keyword   | Syntax                                                          | Purpose                                               |
|-----------|-----------------------------------------------------------------|-------------------------------------------------------|
| `group`   | `group <id>(<icon>)[<label>]`                                   | Named container; child services cluster inside it     |
| `service` | `service <id>(<icon>)[<label>]`                                 | Node with icon; placed at top level                   |
| `service` | `service <id>(<icon>)[<label>] in <group>`                      | Node with explicit group membership                   |

Services may also be indented under a `group` line (indent-based membership).

---

### Edge types

| Operator | Kind          |
|----------|---------------|
| `-->`    | Directed      |
| `--`     | Undirected    |
| `<-->`   | Bidirectional |

**Edge syntax:** `<from>:<side> <operator> <side>:<to>`

---

### Port sides

| Token | Side   |
|-------|--------|
| `L`   | Left   |
| `R`   | Right  |
| `T`   | Top    |
| `B`   | Bottom |

Lowercase variants (`l`, `r`, `t`, `b`) are also accepted.

---

---

### Comments

Lines starting with `%%` are stripped before parsing (centrally via `stripComments()` in `src/frontend/preprocess.ts`):
```
%% This is a comment
```

---

### Minimal snippet

```
architecture-beta
  group cloud(cloud)[Cloud]
    service api(server)[API Server]
    service db(database)[Database]
  service client(internet)[Client]
  client:R --> L:api
  api:R --> L:db
```
