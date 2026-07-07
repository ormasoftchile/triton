## Requirement

Mermaid-compatible requirement diagram: requirement and element blocks with key/value fields, connected by typed relationships.

**Header keyword(s):** `requirementDiagram`

---

### Block kinds

| Keyword                    | Meaning                                |
|----------------------------|----------------------------------------|
| `requirement`              | Generic requirement                    |
| `functionalRequirement`    | Functional requirement                 |
| `interfaceRequirement`     | Interface requirement                  |
| `performanceRequirement`   | Performance requirement                |
| `physicalRequirement`      | Physical requirement                   |
| `designConstraint`         | Design constraint                      |
| `element`                  | System element (implementation entity) |

Keywords are case-insensitive. Block syntax: `kind Name { key: value … }`.

---

### Relationship syntax

```
from - type -> to
```

`type` is an unconstrained identifier. Conventional types documented in the IR source:
`satisfies` · `contains` · `refines` · `derives`

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
requirementDiagram

requirement UserAuth {
  id: REQ-001
  text: The system shall authenticate users.
  risk: high
  verifymethod: test
}

element AuthService {
  type: microservice
}

AuthService - satisfies -> UserAuth
```
