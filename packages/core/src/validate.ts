/**
 * @file validate.ts — Well-formedness validator for Timeline IR documents.
 *
 * `validateDocument` checks all 17 invariants from §4 (design/sections/04-ir.tex)
 * plus four soft-warning conditions.  It is pure and deterministic: no I/O, no
 * system clock, no side effects.  Diagnostics are emitted in a stable order.
 *
 * Invariant codes implemented:
 *   Structural:   VERSION_PRESENT, AT_LEAST_ONE_TRACK, UNIQUE_IDS, VALID_ID_FORMAT
 *   Referential:  REF_RESOLVES, REF_TYPE_MATCH, NO_CIRCULAR_GROUPS
 *   Temporal:     VALID_TIME_RANGE, ACTIVITY_DURATION_NONNEG, DATE_FORMAT_VALID,
 *                 SPAN_START_CONFLICT, DATE_ANCHOR_MISSING, TRACK_INDEX_UNIQUE
 *   Value:        PROGRESS_IN_RANGE, STATUS_VALID, AXIS_UNIT_VALID
 *   Soft warnings: OUTSIDE_TIME_RANGE, STALE_PROGRESS, VACUOUS_TIMELINE, UNUSED_TRACK
 */

import type {
  Activity,
  AxisUnit,
  Diagnostic,
  Group,
  IRDocument,
  Milestone,
  Status,
  ValidationResult,
} from './types.js';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ID_PATTERN = /^[a-z][a-z0-9-]*$/;

const IR_DATE_RE =
  /^(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?)?|\d{4}-Q[1-4]|\d{4}-H[12]|\d{4}-\d{2}|\d{4}|FY\d{2,4}-Q[1-4]|[+-]\d+[a-z]|now|tbd|ongoing|unknown|~.+)$/;

const RELATIVE_DATE_RE = /^[+-]\d+[a-z]$/;

const VALID_STATUSES: ReadonlySet<string> = new Set<Status>([
  'planned',
  'in-progress',
  'done',
  'at-risk',
  'blocked',
  'cancelled',
  'tentative',
]);

const VALID_AXIS_UNITS: ReadonlySet<string> = new Set<AxisUnit>([
  'day',
  'week',
  'month',
  'quarter',
  'half',
  'year',
]);

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

/**
 * Returns a Date representing the earliest instant of the given IRDate string,
 * or null when the date is non-concrete (tbd, ongoing, unknown, now, relative,
 * approximate, or fiscal-quarter which needs external context).
 */
function toComparableDate(s: string): Date | null {
  if (s === 'tbd' || s === 'ongoing' || s === 'unknown' || s === 'now') return null;
  if (s.startsWith('~') || RELATIVE_DATE_RE.test(s)) return null;
  // Fiscal quarters require fiscal_year_start context — skip comparisons.
  if (s.startsWith('FY')) return null;

  // ISO datetime or date: 2026-06-09T14:00 / 2026-06-09
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Quarter: 2026-Q2
  const qm = /^(\d{4})-Q([1-4])$/.exec(s);
  if (qm !== null) {
    const year = parseInt(qm[1] ?? '0', 10);
    const qnum = parseInt(qm[2] ?? '1', 10);
    const month = (qnum - 1) * 3 + 1;
    return new Date(`${year}-${String(month).padStart(2, '0')}-01`);
  }

  // Half: 2026-H1
  const hm = /^(\d{4})-H([12])$/.exec(s);
  if (hm !== null) {
    const year = parseInt(hm[1] ?? '0', 10);
    const hnum = parseInt(hm[2] ?? '1', 10);
    const month = (hnum - 1) * 6 + 1;
    return new Date(`${year}-${String(month).padStart(2, '0')}-01`);
  }

  // Year-month: 2026-06
  const ymm = /^(\d{4})-(\d{2})$/.exec(s);
  if (ymm !== null) {
    return new Date(`${ymm[1] ?? '2000'}-${ymm[2] ?? '01'}-01`);
  }

  // Year only: 2026
  const yrm = /^\d{4}$/.exec(s);
  if (yrm !== null) {
    return new Date(`${yrm[0]}-01-01`);
  }

  return null;
}

/** True when this date needs a resolved date anchor (today / created). */
function needsAnchor(s: string): boolean {
  return s === 'now' || RELATIVE_DATE_RE.test(s);
}

// ---------------------------------------------------------------------------
// Entity type lookup helpers
// ---------------------------------------------------------------------------

type EntityType = 'track' | 'group' | 'activity' | 'milestone' | 'section' | 'annotation';

interface EntityEntry {
  type: EntityType;
  /** JSON Pointer to the entity, e.g. /tracks/0 */
  path: string;
}

function buildEntityMap(ir: IRDocument): Map<string, EntityEntry> {
  const map = new Map<string, EntityEntry>();

  ir.tracks.forEach((t, i) => {
    if (t.id) map.set(t.id, { type: 'track', path: `/tracks/${i}` });
  });
  (ir.groups ?? []).forEach((g, i) => {
    if (g.id) map.set(g.id, { type: 'group', path: `/groups/${i}` });
  });
  ir.activities.forEach((a, i) => {
    if (a.id) map.set(a.id, { type: 'activity', path: `/activities/${i}` });
  });
  (ir.milestones ?? []).forEach((m, i) => {
    if (m.id) map.set(m.id, { type: 'milestone', path: `/milestones/${i}` });
  });
  (ir.sections ?? []).forEach((s, i) => {
    if (s.id) map.set(s.id, { type: 'section', path: `/sections/${i}` });
  });

  return map;
}

// ---------------------------------------------------------------------------
// Cycle detection for group parent chain
// ---------------------------------------------------------------------------

function detectGroupCycles(
  groups: Group[],
): Map<string, boolean> {
  const parentMap = new Map<string, string | undefined>(groups.map((g) => [g.id, g.parent]));
  const cycleSet = new Map<string, boolean>(); // id -> is_cyclic

  for (const group of groups) {
    if (cycleSet.has(group.id)) continue;

    const path = new Set<string>();
    let current: string | undefined = group.id;

    while (current !== undefined) {
      if (path.has(current)) {
        // Found a cycle — mark all nodes in the current path as cyclic
        for (const id of path) {
          cycleSet.set(id, true);
        }
        break;
      }
      path.add(current);
      current = parentMap.get(current);
    }

    // Mark all visited nodes as non-cyclic (if not already marked)
    for (const id of path) {
      if (!cycleSet.has(id)) {
        cycleSet.set(id, false);
      }
    }
  }

  return cycleSet;
}

// ---------------------------------------------------------------------------
// Date collection helper
// ---------------------------------------------------------------------------

interface DateField {
  path: string;
  value: string;
}

function collectAllDates(ir: IRDocument): DateField[] {
  const dates: DateField[] = [];

  const add = (path: string, value: string | undefined): void => {
    if (value !== undefined) dates.push({ path, value });
  };

  add('/metadata/time_range/start', ir.metadata.time_range.start);
  add('/metadata/time_range/end', ir.metadata.time_range.end);
  add('/metadata/created', ir.metadata.created);
  add('/metadata/updated', ir.metadata.updated);
  add('/metadata/today', ir.metadata.today);

  ir.activities.forEach((a, i) => {
    add(`/activities/${i}/start`, a.start);
    add(`/activities/${i}/end`, a.end);
    add(`/activities/${i}/span`, a.span);
  });

  (ir.milestones ?? []).forEach((m, i) => {
    add(`/milestones/${i}/date`, m.date);
  });

  (ir.annotations ?? []).forEach((ann, i) => {
    add(`/annotations/${i}/date`, ann.date);
    add(`/annotations/${i}/start`, ann.start);
    add(`/annotations/${i}/end`, ann.end);
  });

  (ir.sections ?? []).forEach((sec, i) => {
    add(`/sections/${i}/time_range/start`, sec.time_range?.start);
    add(`/sections/${i}/time_range/end`, sec.time_range?.end);
  });

  return dates;
}

// ---------------------------------------------------------------------------
// validateDocument
// ---------------------------------------------------------------------------

/**
 * Validate an already-parsed `IRDocument` against the 17 well-formedness
 * invariants from §4.  Safe to call on any IRDocument value (does not require
 * `parseIR` to have run first).
 *
 * Hard errors set `valid: false`; soft warnings are returned in `warnings`.
 * Diagnostics within each check are emitted in document order.
 */
export function validateDocument(ir: IRDocument): ValidationResult {
  const errors: Diagnostic[] = [];
  const warnings: Diagnostic[] = [];

  // ── Invariant 1: VERSION_PRESENT ──────────────────────────────────────────
  if (!ir.version || ir.version.trim() === '') {
    errors.push({
      path: '/version',
      code: 'VERSION_PRESENT',
      message: 'Document is missing the required `version` field.',
      severity: 'error',
      suggestion: 'Add `version: "1.0"` to the document root.',
    });
  } else {
    const [majorStr] = ir.version.split('.');
    const major = parseInt(majorStr ?? '', 10);
    if (isNaN(major) || major > 1) {
      warnings.push({
        path: '/version',
        code: 'VERSION_PRESENT',
        message: `Unrecognised specification major version: "${ir.version}". This validator targets version 1.x.`,
        severity: 'warning',
        suggestion: 'Use version "1.0" or a compatible 1.x version.',
      });
    }
  }

  // ── Invariant 3: AT_LEAST_ONE_TRACK ──────────────────────────────────────
  if (!Array.isArray(ir.tracks) || ir.tracks.length === 0) {
    errors.push({
      path: '/tracks',
      code: 'AT_LEAST_ONE_TRACK',
      message: 'The `tracks` list must contain at least one track.',
      severity: 'error',
      suggestion: 'Add at least one track with a unique `id` and a `label`.',
    });
  }

  // ── Build entity map (used by invariants 4, 5, 6, 7) ─────────────────────
  const entityMap = buildEntityMap(ir);

  // ── Invariant 4: UNIQUE_IDS ───────────────────────────────────────────────
  // Collect every id with its path; report duplicates at their second+ path.
  const idFirstSeen = new Map<string, string>(); // id -> first path

  const checkId = (id: string | undefined, path: string): void => {
    if (!id) return;
    const first = idFirstSeen.get(id);
    if (first !== undefined) {
      errors.push({
        path,
        code: 'UNIQUE_IDS',
        message: `Duplicate ID "${id}" — first seen at ${first}.`,
        severity: 'error',
        suggestion: `Rename one of the entities to use a unique ID (e.g. "${id}-2").`,
      });
    } else {
      idFirstSeen.set(id, path);
    }
  };

  ir.tracks.forEach((t, i) => checkId(t.id, `/tracks/${i}/id`));
  (ir.groups ?? []).forEach((g, i) => checkId(g.id, `/groups/${i}/id`));
  ir.activities.forEach((a, i) => checkId(a.id, `/activities/${i}/id`));
  (ir.milestones ?? []).forEach((m, i) => checkId(m.id, `/milestones/${i}/id`));
  (ir.sections ?? []).forEach((s, i) => checkId(s.id, `/sections/${i}/id`));
  (ir.annotations ?? []).forEach((ann, i) => {
    if (ann.id) checkId(ann.id, `/annotations/${i}/id`);
  });

  // ── Invariant 5: VALID_ID_FORMAT ─────────────────────────────────────────
  const checkIdFormat = (id: string | undefined, path: string): void => {
    if (!id) return;
    if (!ID_PATTERN.test(id)) {
      errors.push({
        path,
        code: 'VALID_ID_FORMAT',
        message: `ID "${id}" does not match ^[a-z][a-z0-9-]*$.`,
        severity: 'error',
        suggestion:
          'Use only lowercase letters, digits, and hyphens; start with a letter (e.g. "api-v2").',
      });
    }
  };

  ir.tracks.forEach((t, i) => checkIdFormat(t.id, `/tracks/${i}/id`));
  (ir.groups ?? []).forEach((g, i) => checkIdFormat(g.id, `/groups/${i}/id`));
  ir.activities.forEach((a, i) => checkIdFormat(a.id, `/activities/${i}/id`));
  (ir.milestones ?? []).forEach((m, i) => checkIdFormat(m.id, `/milestones/${i}/id`));
  (ir.sections ?? []).forEach((s, i) => checkIdFormat(s.id, `/sections/${i}/id`));
  (ir.annotations ?? []).forEach((ann, i) => {
    if (ann.id) checkIdFormat(ann.id, `/annotations/${i}/id`);
  });

  // ── Invariants 6 & 7: REF_RESOLVES + REF_TYPE_MATCH ─────────────────────
  type AllowedType = EntityType | EntityType[];

  const checkRef = (
    ref: string | undefined,
    fieldPath: string,
    expectedTypes: AllowedType,
  ): void => {
    if (!ref) return;
    const entry = entityMap.get(ref);
    if (entry === undefined) {
      errors.push({
        path: fieldPath,
        code: 'REF_RESOLVES',
        message: `Reference "${ref}" does not resolve to any entity in the document.`,
        severity: 'error',
        suggestion: `Ensure an entity with id "${ref}" exists, or correct the reference.`,
      });
      return;
    }
    const allowed = Array.isArray(expectedTypes) ? expectedTypes : [expectedTypes];
    if (!allowed.includes(entry.type)) {
      errors.push({
        path: fieldPath,
        code: 'REF_TYPE_MATCH',
        message: `Reference "${ref}" resolved to a ${entry.type} (at ${entry.path}), but expected ${allowed.join(' or ')}.`,
        severity: 'error',
        suggestion: `Check that the ID refers to a ${allowed.join(' or ')} entity.`,
      });
    }
  };

  // activity references
  ir.activities.forEach((a, i) => {
    checkRef(a.track, `/activities/${i}/track`, 'track');
    checkRef(a.group, `/activities/${i}/group`, 'group');
  });

  // milestone references
  (ir.milestones ?? []).forEach((m, i) => {
    checkRef(m.track, `/milestones/${i}/track`, 'track');
    checkRef(m.group, `/milestones/${i}/group`, 'group');
  });

  // track references
  ir.tracks.forEach((t, i) => {
    checkRef(t.group, `/tracks/${i}/group`, 'group');
  });

  // group references
  (ir.groups ?? []).forEach((g, i) => {
    checkRef(g.parent, `/groups/${i}/parent`, 'group');
    (g.children ?? []).forEach((childId, j) => {
      checkRef(childId, `/groups/${i}/children/${j}`, ['track', 'group']);
    });
    (g.members ?? []).forEach((memberId, j) => {
      checkRef(memberId, `/groups/${i}/members/${j}`, ['activity', 'milestone']);
    });
  });

  // section references
  (ir.sections ?? []).forEach((sec, i) => {
    (sec.tracks ?? []).forEach((tId, j) => {
      checkRef(tId, `/sections/${i}/tracks/${j}`, 'track');
    });
  });

  // annotation references
  (ir.annotations ?? []).forEach((ann, i) => {
    checkRef(ann.target, `/annotations/${i}/target`, ['activity', 'milestone']);
    (ann.targets ?? []).forEach((tId, j) => {
      checkRef(tId, `/annotations/${i}/targets/${j}`, ['activity', 'milestone']);
    });
  });

  // ── Invariant 8: NO_CIRCULAR_GROUPS ──────────────────────────────────────
  const groups = ir.groups ?? [];
  if (groups.length > 0) {
    const cycleMap = detectGroupCycles(groups);
    groups.forEach((g, i) => {
      if (cycleMap.get(g.id) === true) {
        errors.push({
          path: `/groups/${i}`,
          code: 'NO_CIRCULAR_GROUPS',
          message: `Group "${g.id}" is part of a circular parent chain.`,
          severity: 'error',
          suggestion:
            'Remove the circular `parent` reference so the group hierarchy is a tree.',
        });
      }
    });
  }

  // ── Invariant 9: VALID_TIME_RANGE ─────────────────────────────────────────
  {
    const { start, end } = ir.metadata.time_range;
    if (end !== undefined) {
      const s = toComparableDate(start);
      const e = toComparableDate(end);
      if (s !== null && e !== null && e < s) {
        errors.push({
          path: '/metadata/time_range',
          code: 'VALID_TIME_RANGE',
          message: `metadata.time_range.end "${end}" is before start "${start}".`,
          severity: 'error',
          suggestion: 'Ensure the time_range end date is on or after the start date.',
        });
      }
    }
  }

  // ── Invariant 10: ACTIVITY_DURATION_NONNEG ───────────────────────────────
  ir.activities.forEach((a: Activity, i: number) => {
    if (a.start !== undefined && a.end !== undefined) {
      const s = toComparableDate(a.start);
      const e = toComparableDate(a.end);
      if (s !== null && e !== null && e < s) {
        errors.push({
          path: `/activities/${i}`,
          code: 'ACTIVITY_DURATION_NONNEG',
          message: `Activity "${a.id}" has end "${a.end}" before start "${a.start}".`,
          severity: 'error',
          suggestion: 'Ensure the activity end date is on or after the start date.',
        });
      }
    }
  });

  // ── Invariant 11: DATE_FORMAT_VALID ──────────────────────────────────────
  collectAllDates(ir).forEach(({ path, value }) => {
    if (!IR_DATE_RE.test(value)) {
      errors.push({
        path,
        code: 'DATE_FORMAT_VALID',
        message: `"${value}" is not a valid IR date string.`,
        severity: 'error',
        suggestion:
          'Use ISO (2026-06-09), quarter (2026-Q2), half (2026-H1), year (2026), relative (+3m), symbolic (now), or uncertain (tbd, ongoing, unknown, ~approx).',
      });
    }
  });

  // ── Invariant 12: SPAN_START_CONFLICT ────────────────────────────────────
  ir.activities.forEach((a: Activity, i: number) => {
    const hasSpan = a.span !== undefined;
    const hasStart = a.start !== undefined;
    const hasEnd = a.end !== undefined;

    if (hasSpan && (hasStart || hasEnd)) {
      errors.push({
        path: `/activities/${i}`,
        code: 'SPAN_START_CONFLICT',
        message: `Activity "${a.id}" has \`span\` together with ${hasStart && hasEnd ? '`start` and `end`' : hasStart ? '`start`' : '`end`'}. \`span\` is mutually exclusive with \`start\`/\`end\`.`,
        severity: 'error',
        suggestion:
          'Use either `span: 2026-Q2` (shorthand) OR `start` / `start` + `end` (explicit form), not both.',
      });
    } else if (!hasSpan && !hasStart) {
      errors.push({
        path: `/activities/${i}`,
        code: 'SPAN_START_CONFLICT',
        message: `Activity "${a.id}" has neither \`span\` nor \`start\`. Every activity must specify a date source.`,
        severity: 'error',
        suggestion:
          'Add `span: <date>` for a single-unit shorthand, or add `start: <date>` (with optional `end`) for an explicit range.',
      });
    }
  });

  // ── Invariant 13: DATE_ANCHOR_MISSING ────────────────────────────────────
  {
    const allDates = collectAllDates(ir);
    const hasAnchorDep = allDates.some(({ value }) => needsAnchor(value));
    const hasAnchor =
      ir.metadata.today !== undefined || ir.metadata.created !== undefined;

    if (hasAnchorDep && !hasAnchor) {
      errors.push({
        path: '/metadata',
        code: 'DATE_ANCHOR_MISSING',
        message:
          'The document uses `now` or relative dates (+3m, -2w, etc.) but has neither `metadata.today` nor `metadata.created` to serve as the date anchor.',
        severity: 'error',
        suggestion:
          'Add `today: <ISO date>` (preferred) or `created: <ISO date>` to `metadata` so relative dates resolve deterministically.',
      });
    }
  }

  // ── Invariant 14: TRACK_INDEX_UNIQUE ─────────────────────────────────────
  {
    const indexSeen = new Map<number, string>(); // index value -> track path
    ir.tracks.forEach((t, i) => {
      if (t.index !== undefined) {
        const prev = indexSeen.get(t.index);
        if (prev !== undefined) {
          errors.push({
            path: `/tracks/${i}/index`,
            code: 'TRACK_INDEX_UNIQUE',
            message: `Track "${t.id}" has index ${t.index}, which is already used by the track at ${prev}.`,
            severity: 'error',
            suggestion: 'Each `track.index` value must be unique within the document.',
          });
        } else {
          indexSeen.set(t.index, `/tracks/${i}`);
        }
      }
    });
  }

  // ── Invariant 15: PROGRESS_IN_RANGE ──────────────────────────────────────
  ir.activities.forEach((a: Activity, i: number) => {
    if (a.progress !== undefined && (a.progress < 0 || a.progress > 1)) {
      errors.push({
        path: `/activities/${i}/progress`,
        code: 'PROGRESS_IN_RANGE',
        message: `Activity "${a.id}" has progress ${a.progress}, which is outside [0, 1].`,
        severity: 'error',
        suggestion: 'Set `progress` to a value between 0.0 and 1.0 (inclusive).',
      });
    }
  });

  // ── Invariant 16: STATUS_VALID ────────────────────────────────────────────
  const checkStatus = (
    status: unknown,
    entityId: string,
    path: string,
  ): void => {
    if (status !== undefined && !VALID_STATUSES.has(String(status))) {
      errors.push({
        path,
        code: 'STATUS_VALID',
        message: `"${String(status)}" is not a valid Status for entity "${entityId}".`,
        severity: 'error',
        suggestion: `Valid statuses: ${[...VALID_STATUSES].join(', ')}.`,
      });
    }
  };

  ir.activities.forEach((a: Activity, i: number) =>
    checkStatus(a.status, a.id, `/activities/${i}/status`),
  );
  (ir.milestones ?? []).forEach((m: Milestone, i: number) =>
    checkStatus(m.status, m.id, `/milestones/${i}/status`),
  );

  // ── Invariant 17: AXIS_UNIT_VALID ────────────────────────────────────────
  {
    const au = ir.metadata.axis_unit;
    if (au !== undefined && !VALID_AXIS_UNITS.has(String(au))) {
      errors.push({
        path: '/metadata/axis_unit',
        code: 'AXIS_UNIT_VALID',
        message: `"${String(au)}" is not a valid AxisUnit.`,
        severity: 'error',
        suggestion: `Valid axis units: ${[...VALID_AXIS_UNITS].join(', ')}.`,
      });
    }
  }

  // ── Soft warning: VACUOUS_TIMELINE ───────────────────────────────────────
  if (ir.activities.length === 0 && (ir.milestones ?? []).length === 0) {
    warnings.push({
      path: '',
      code: 'VACUOUS_TIMELINE',
      message: 'The document has no activities and no milestones — the timeline is empty.',
      severity: 'warning',
      suggestion: 'Add at least one activity or milestone.',
    });
  }

  // ── Soft warning: UNUSED_TRACK ───────────────────────────────────────────
  {
    const usedTracks = new Set(ir.activities.map((a) => a.track));
    ir.tracks.forEach((t, i) => {
      if (!usedTracks.has(t.id)) {
        warnings.push({
          path: `/tracks/${i}`,
          code: 'UNUSED_TRACK',
          message: `Track "${t.id}" has no activities referencing it.`,
          severity: 'info',
          suggestion: 'Consider removing unused tracks or adding activities to them.',
        });
      }
    });
  }

  // ── Soft warning: STALE_PROGRESS ─────────────────────────────────────────
  ir.activities.forEach((a: Activity, i: number) => {
    if (a.progress === 1.0 && a.status === 'in-progress') {
      warnings.push({
        path: `/activities/${i}`,
        code: 'STALE_PROGRESS',
        message: `Activity "${a.id}" has progress 1.0 but status "in-progress" — likely stale.`,
        severity: 'warning',
        suggestion: 'Update status to "done" or set progress to a value < 1.0.',
      });
    }
  });

  // ── Soft warning: OUTSIDE_TIME_RANGE ─────────────────────────────────────
  {
    const trStart = toComparableDate(ir.metadata.time_range.start);
    const trEnd =
      ir.metadata.time_range.end !== undefined
        ? toComparableDate(ir.metadata.time_range.end)
        : null;

    const checkOutside = (
      startDate: Date | null,
      endDate: Date | null,
      entityPath: string,
      label: string,
    ): void => {
      if (trEnd !== null && startDate !== null && startDate > trEnd) {
        warnings.push({
          path: entityPath,
          code: 'OUTSIDE_TIME_RANGE',
          message: `${label} starts after metadata.time_range.end and will be clipped.`,
          severity: 'warning',
          suggestion: 'Adjust the entity dates or widen metadata.time_range.',
        });
      } else if (trStart !== null && endDate !== null && endDate < trStart) {
        warnings.push({
          path: entityPath,
          code: 'OUTSIDE_TIME_RANGE',
          message: `${label} ends before metadata.time_range.start and will be clipped.`,
          severity: 'warning',
          suggestion: 'Adjust the entity dates or widen metadata.time_range.',
        });
      }
    };

    ir.activities.forEach((a: Activity, i: number) => {
      const aStart = toComparableDate(a.span ?? a.start ?? '');
      const aEnd =
        a.span !== undefined
          ? aStart
          : a.end !== undefined
            ? toComparableDate(a.end)
            : null;
      checkOutside(aStart, aEnd, `/activities/${i}`, `Activity "${a.id}"`);
    });

    (ir.milestones ?? []).forEach((m: Milestone, i: number) => {
      const mDate = toComparableDate(m.date);
      checkOutside(mDate, mDate, `/milestones/${i}`, `Milestone "${m.id}"`);
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
