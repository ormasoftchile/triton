# Phase 1 Gallery — Timeline Compiler Examples

Eight representative IR documents rendered with the **Horizontal layout** engine
and the **Consulting (Tier-1)** theme.  Open `index.html` in a browser to view
the contact sheet.

---

## Examples

| # | Slug | Axis | Tracks | Key features |
|---|------|------|--------|--------------|
| 1 | `milestones-only` | quarter | 1 | 6 numbered milestones, no activities, label collision resolution |
| 2 | `open-ended` | month | 2 | Ongoing bars (omitted end + `end: ongoing`), `span` shorthand, `end: tbd` stub |
| 3 | `architecture-evolution` | year | 3 | 7-year span, overlapping phase bars, done / in-progress / planned |
| 4 | `release-timeline` | month | 2 | Sequential short bars, `at-risk` status, 4 release milestones |
| 5 | `program-timeline` | month | 3 | `blocked` status, 5 milestones incl. GA, milestone track assignment |
| 6 | `product-roadmap` | quarter | 4 | 16 activities, mixed statuses + progress, sub-lane stacking |
| 7 | `transformation-plan` | quarter | 4 | 8-quarter span, 13 long bars, all status colours, multi-year axis |
| 8 | `dense-roadmap` | month | 3 | 15 overlapping activities, sub-lane stress test, 4 milestones |

---

## How to regenerate

Ensure the build is current first:

```sh
pnpm -r build
```

Then for each `<slug>`:

```sh
# Validate
node packages/cli/dist/index.js validate examples/gallery/<slug>.timeline.yaml

# Render to SVG
node packages/cli/dist/index.js render examples/gallery/<slug>.timeline.yaml \
  -o examples/gallery/<slug>.svg

# Render to PNG
node packages/cli/dist/index.js render examples/gallery/<slug>.timeline.yaml \
  -o examples/gallery/<slug>.png --format png
```

### Regenerate all at once

```sh
pnpm -r build

for slug in milestones-only open-ended architecture-evolution \
            release-timeline program-timeline product-roadmap \
            transformation-plan dense-roadmap; do
  node packages/cli/dist/index.js render \
    examples/gallery/$slug.timeline.yaml \
    -o examples/gallery/$slug.svg
  node packages/cli/dist/index.js render \
    examples/gallery/$slug.timeline.yaml \
    -o examples/gallery/$slug.png --format png
done
```

---

## Renderer capabilities exercised (Phase 1 / Horizontal / Consulting)

- **Axis units**: `quarter`, `month`, `year` — tick labels, gridlines disabled
- **Activity bars**: status-based fill (`done` grey, `in-progress` navy, `at-risk` amber,
  `blocked` red, `planned` navy, `tentative` light-grey, `cancelled` diagonal-hatch)
- **Activity labels**: inside bar when wide enough, outside (right or left) when narrow
- **Sub-lane stacking**: greedy assignment when activities overlap in the same track
- **Milestones**: numbered circles (T2 shape), date label above, title label below,
  stacking when multiple milestones share the same x-coordinate
- **Ongoing / open-ended bars**: extend to canvas right edge
- **Span shorthand**: single-period bars (e.g., `span: 2026-Q1`)
- **TBD end**: `end: tbd` renders as a short stub (`minWidth × 4` px)

## Known Phase 1 limitations (noted for owner)

- **Progress not visualised**: `progress` values are stored in IR and validated, but the
  Phase 1 renderer does not draw a progress fill on activity bars. All bars render as solid.
- **Track labels not shown**: the Consulting theme sets `headerWidth: 0`, so track `label`
  fields are valid IR but produce no visible column header. Track identity is implicit from
  row position.
- **TBD end stub is very short**: `end: tbd` draws a `minWidth × 4 = 16px` stub with no
  "TBD" label — it is valid but visually indistinguishable from a very short planned bar.
- **OUTSIDE_TIME_RANGE false positive**: the validator compares milestone/activity dates
  against the *start* of the time_range end period (e.g., Q4 → Oct 1) rather than the
  *end* (Dec 31), so late-Q4 dates trigger an OUTSIDE_TIME_RANGE warning even when they
  are within the rendered axis. Worked around by using `YYYY-MM-DD` end dates in the
  time_range metadata.
