## Journey

User-journey diagram mapping tasks to satisfaction scores and named actors, grouped into named phases.

**Header keyword(s):** `journey`

---

### Config keywords

| Keyword | Syntax           |
|---------|------------------|
| `title` | `title My Title` |

---

### Block keywords

| Syntax          | Purpose                         |
|-----------------|---------------------------------|
| `section Label` | Groups tasks into a named phase |

---

### Entry / Event syntax

| Syntax                                 | Description                              |
|----------------------------------------|------------------------------------------|
| `Task label : score : Actor1, Actor2`  | Task with satisfaction score and actors  |

**Score:** numeric value (integer or decimal; grammar permits negative values).

**Actors:** comma-separated list of actor names; multiple actors may share one task.

---

### Comments

Lines starting with `%%` are stripped before parsing:
```
%% This is a comment
```

---

### Minimal snippet

```
journey
  title E-commerce Customer Journey
  section Discovery
    Search online: 4: Customer, Analytics
    Read reviews:  3: Customer
  section Purchase
    Add to cart: 5: Customer
    Checkout:    4: Customer, Payment
```
