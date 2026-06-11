/**
 * @file validate.test.ts — Tests for validateDocument (validate.ts).
 *
 * Each test targets ONE invariant (or soft warning) to keep failures
 * self-contained.  All fixtures are minimal valid documents modified just
 * enough to trigger (or not trigger) the relevant check.
 */

import { describe, expect, it } from 'vitest';
import { validateDocument } from '../src/validate.js';
import type { Activity, IRDocument } from '../src/types.js';

// ---------------------------------------------------------------------------
// Minimal valid document factory
// ---------------------------------------------------------------------------

/** Returns a fresh minimal valid IRDocument for use as a test base. */
function makeMinimal(): IRDocument {
  return {
    version: '1.0',
    metadata: {
      title: 'Minimal',
      time_range: { start: '2026-01-01', end: '2026-12-31' },
    },
    tracks: [{ id: 'main', label: 'Main' }],
    activities: [
      { id: 'task-a', label: 'Task A', track: 'main', start: '2026-Q1' },
    ],
  };
}

// ---------------------------------------------------------------------------
// Baseline: valid document
// ---------------------------------------------------------------------------

describe('validateDocument — valid document', () => {
  it('returns valid:true and empty errors for a minimal valid document', () => {
    const result = validateDocument(makeMinimal());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns a ValidationResult shape', () => {
    const result = validateDocument(makeMinimal());
    expect(typeof result.valid).toBe('boolean');
    expect(Array.isArray(result.errors)).toBe(true);
    expect(Array.isArray(result.warnings)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 1: VERSION_PRESENT
// ---------------------------------------------------------------------------

describe('validateDocument — VERSION_PRESENT', () => {
  it('emits VERSION_PRESENT error for empty version string', () => {
    const doc = makeMinimal();
    (doc as Record<string, unknown>).version = '';
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'VERSION_PRESENT')).toBe(true);
  });

  it('emits VERSION_PRESENT warning for unrecognised major version', () => {
    const doc = makeMinimal();
    (doc as Record<string, unknown>).version = '9.0';
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'VERSION_PRESENT')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 3: AT_LEAST_ONE_TRACK
// ---------------------------------------------------------------------------

describe('validateDocument — AT_LEAST_ONE_TRACK', () => {
  it('emits AT_LEAST_ONE_TRACK when tracks is empty', () => {
    const doc = makeMinimal();
    (doc as Record<string, unknown>).tracks = [];
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'AT_LEAST_ONE_TRACK')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 4: UNIQUE_IDS
// ---------------------------------------------------------------------------

describe('validateDocument — UNIQUE_IDS', () => {
  it('emits UNIQUE_IDS when two activities share an id', () => {
    const doc = makeMinimal();
    doc.activities.push({
      id: 'task-a', // duplicate
      label: 'Duplicate',
      track: 'main',
      start: '2026-Q2',
    });
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'UNIQUE_IDS')).toBe(true);
  });

  it('UNIQUE_IDS path points to the duplicate entity', () => {
    const doc = makeMinimal();
    doc.activities.push({ id: 'task-a', label: 'Dup', track: 'main', start: '2026-Q2' });
    const result = validateDocument(doc);
    const err = result.errors.find((e) => e.code === 'UNIQUE_IDS');
    expect(err?.path).toContain('activities');
  });

  it('emits UNIQUE_IDS for cross-entity duplicates (track vs activity)', () => {
    const doc = makeMinimal();
    // activity already has id 'task-a'; add a track with the same id
    doc.tracks.push({ id: 'task-a', label: 'Same id as activity' });
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'UNIQUE_IDS')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 5: VALID_ID_FORMAT
// ---------------------------------------------------------------------------

describe('validateDocument — VALID_ID_FORMAT', () => {
  it('emits VALID_ID_FORMAT for an uppercase ID', () => {
    const doc = makeMinimal();
    (doc.tracks[0] as Record<string, unknown>).id = 'BadTrack';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'VALID_ID_FORMAT')).toBe(true);
  });

  it('emits VALID_ID_FORMAT for an ID starting with a digit', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Record<string, unknown>).id = '1task';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'VALID_ID_FORMAT')).toBe(true);
  });

  it('emits VALID_ID_FORMAT for an ID with underscores', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Record<string, unknown>).id = 'bad_id';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'VALID_ID_FORMAT')).toBe(true);
  });

  it('accepts a valid kebab-case id', () => {
    const doc = makeMinimal();
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'VALID_ID_FORMAT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 6: REF_RESOLVES
// ---------------------------------------------------------------------------

describe('validateDocument — REF_RESOLVES', () => {
  it('emits REF_RESOLVES when activity.track does not exist', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Record<string, unknown>).track = 'nonexistent-track';
    const result = validateDocument(doc);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.code === 'REF_RESOLVES')).toBe(true);
  });

  it('REF_RESOLVES error path includes the referencing field', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Record<string, unknown>).track = 'ghost';
    const result = validateDocument(doc);
    const err = result.errors.find((e) => e.code === 'REF_RESOLVES');
    expect(err?.path).toContain('/activities/0/track');
  });

  it('emits REF_RESOLVES for dangling milestone.track ref', () => {
    const doc = makeMinimal();
    doc.milestones = [{ id: 'ms-one', label: 'Milestone', date: '2026-06-01', track: 'ghost' }];
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'REF_RESOLVES')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 7: REF_TYPE_MATCH
// ---------------------------------------------------------------------------

describe('validateDocument — REF_TYPE_MATCH', () => {
  it('emits REF_TYPE_MATCH when activity.track references a group', () => {
    const doc = makeMinimal();
    doc.groups = [{ id: 'my-group', label: 'Group' }];
    (doc.activities[0] as Record<string, unknown>).track = 'my-group'; // group, not track
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'REF_TYPE_MATCH')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 8: NO_CIRCULAR_GROUPS
// ---------------------------------------------------------------------------

describe('validateDocument — NO_CIRCULAR_GROUPS', () => {
  it('emits NO_CIRCULAR_GROUPS for a two-group cycle', () => {
    const doc = makeMinimal();
    doc.groups = [
      { id: 'group-a', label: 'A', parent: 'group-b' },
      { id: 'group-b', label: 'B', parent: 'group-a' },
    ];
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'NO_CIRCULAR_GROUPS')).toBe(true);
  });

  it('emits NO_CIRCULAR_GROUPS for a self-referencing group', () => {
    const doc = makeMinimal();
    doc.groups = [{ id: 'group-a', label: 'A', parent: 'group-a' }];
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'NO_CIRCULAR_GROUPS')).toBe(true);
  });

  it('does NOT emit NO_CIRCULAR_GROUPS for a valid linear hierarchy', () => {
    const doc = makeMinimal();
    doc.groups = [
      { id: 'parent-grp', label: 'Parent' },
      { id: 'child-grp', label: 'Child', parent: 'parent-grp' },
    ];
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'NO_CIRCULAR_GROUPS')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 9: VALID_TIME_RANGE
// ---------------------------------------------------------------------------

describe('validateDocument — VALID_TIME_RANGE', () => {
  it('emits VALID_TIME_RANGE when end is before start', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-12-31', end: '2026-01-01' };
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'VALID_TIME_RANGE')).toBe(true);
  });

  it('does NOT emit VALID_TIME_RANGE when end equals start', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-06-01', end: '2026-06-01' };
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'VALID_TIME_RANGE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 10: ACTIVITY_DURATION_NONNEG
// ---------------------------------------------------------------------------

describe('validateDocument — ACTIVITY_DURATION_NONNEG', () => {
  it('emits ACTIVITY_DURATION_NONNEG when activity end < start', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).end = '2025-01-01'; // before start 2026-Q1
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'ACTIVITY_DURATION_NONNEG')).toBe(true);
  });

  it('does NOT emit ACTIVITY_DURATION_NONNEG when end equals start', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).start = '2026-06-01';
    (doc.activities[0] as Activity).end = '2026-06-01';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'ACTIVITY_DURATION_NONNEG')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 11: DATE_FORMAT_VALID
// ---------------------------------------------------------------------------

describe('validateDocument — DATE_FORMAT_VALID', () => {
  it('emits DATE_FORMAT_VALID for a nonsense date string', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).start = 'not-a-date';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'DATE_FORMAT_VALID')).toBe(true);
  });

  it('accepts all recognised date forms', () => {
    const forms = [
      '2026-06-09',
      '2026-06-09T14:00',
      '2026-06',
      '2026',
      '2026-Q2',
      '2026-H1',
      'FY26-Q2',
      '+3m',
      '-2w',
      'now',
      'tbd',
      'ongoing',
      'unknown',
      '~2026-Q3',
    ];
    for (const date of forms) {
      const doc = makeMinimal();
      doc.metadata.today = '2026-01-01'; // anchor for 'now'/relative
      (doc.activities[0] as Activity).start = date;
      const result = validateDocument(doc);
      const dateFmtErrors = result.errors.filter((e) => e.code === 'DATE_FORMAT_VALID');
      expect(dateFmtErrors, `date "${date}" should be valid`).toHaveLength(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Invariant 12: SPAN_START_CONFLICT
// ---------------------------------------------------------------------------

describe('validateDocument — SPAN_START_CONFLICT', () => {
  it('emits SPAN_START_CONFLICT when span and start coexist', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).span = '2026-Q2';
    (doc.activities[0] as Activity).start = '2026-04-01';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'SPAN_START_CONFLICT')).toBe(true);
  });

  it('emits SPAN_START_CONFLICT when span and end coexist', () => {
    const doc = makeMinimal();
    // Replace start with span, then add end
    (doc.activities[0] as Record<string, unknown>).start = undefined;
    (doc.activities[0] as Activity).span = '2026-Q2';
    (doc.activities[0] as Activity).end = '2026-06-30';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'SPAN_START_CONFLICT')).toBe(true);
  });

  it('emits SPAN_START_CONFLICT when neither span nor start is present', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Record<string, unknown>).start = undefined;
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'SPAN_START_CONFLICT')).toBe(true);
  });

  it('does NOT emit SPAN_START_CONFLICT for span alone', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Record<string, unknown>).start = undefined;
    (doc.activities[0] as Activity).span = '2026-Q2';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'SPAN_START_CONFLICT')).toBe(false);
  });

  it('does NOT emit SPAN_START_CONFLICT for start alone (no span, no end)', () => {
    const result = validateDocument(makeMinimal());
    expect(result.errors.some((e) => e.code === 'SPAN_START_CONFLICT')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 13: DATE_ANCHOR_MISSING
// ---------------------------------------------------------------------------

describe('validateDocument — DATE_ANCHOR_MISSING', () => {
  it('emits DATE_ANCHOR_MISSING when "now" is used and no anchor is present', () => {
    const doc = makeMinimal();
    // Remove any existing anchor
    doc.metadata.today = undefined;
    doc.metadata.created = undefined;
    doc.activities[0] = { id: 'task-a', label: 'Task A', track: 'main', start: 'now' };
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'DATE_ANCHOR_MISSING')).toBe(true);
  });

  it('emits DATE_ANCHOR_MISSING for relative dates without anchor', () => {
    const doc = makeMinimal();
    doc.metadata.today = undefined;
    doc.metadata.created = undefined;
    (doc.activities[0] as Activity).start = '+3m';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'DATE_ANCHOR_MISSING')).toBe(true);
  });

  it('does NOT emit DATE_ANCHOR_MISSING when metadata.today is set', () => {
    const doc = makeMinimal();
    doc.metadata.today = '2026-01-01';
    (doc.activities[0] as Activity).start = 'now';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'DATE_ANCHOR_MISSING')).toBe(false);
  });

  it('does NOT emit DATE_ANCHOR_MISSING when metadata.created is set', () => {
    const doc = makeMinimal();
    doc.metadata.created = '2026-01-01';
    (doc.activities[0] as Activity).start = '+3m';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'DATE_ANCHOR_MISSING')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 14: TRACK_INDEX_UNIQUE
// ---------------------------------------------------------------------------

describe('validateDocument — TRACK_INDEX_UNIQUE', () => {
  it('emits TRACK_INDEX_UNIQUE when two tracks share the same index', () => {
    const doc = makeMinimal();
    (doc.tracks[0] as Record<string, unknown>).index = 0;
    doc.tracks.push({ id: 'second', label: 'Second', index: 0 }); // duplicate index
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'TRACK_INDEX_UNIQUE')).toBe(true);
  });

  it('does NOT emit TRACK_INDEX_UNIQUE for unique indices', () => {
    const doc = makeMinimal();
    (doc.tracks[0] as Record<string, unknown>).index = 0;
    doc.tracks.push({ id: 'second', label: 'Second', index: 1 });
    doc.activities.push({ id: 'task-b', label: 'Task B', track: 'second', start: '2026-Q2' });
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'TRACK_INDEX_UNIQUE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 15: PROGRESS_IN_RANGE
// ---------------------------------------------------------------------------

describe('validateDocument — PROGRESS_IN_RANGE', () => {
  it('emits PROGRESS_IN_RANGE when progress > 1', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).progress = 1.5;
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'PROGRESS_IN_RANGE')).toBe(true);
  });

  it('emits PROGRESS_IN_RANGE when progress < 0', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).progress = -0.1;
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'PROGRESS_IN_RANGE')).toBe(true);
  });

  it('does NOT emit PROGRESS_IN_RANGE for progress 0.0', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).progress = 0.0;
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'PROGRESS_IN_RANGE')).toBe(false);
  });

  it('does NOT emit PROGRESS_IN_RANGE for progress 1.0', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).progress = 1.0;
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'PROGRESS_IN_RANGE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Invariant 16: STATUS_VALID
// ---------------------------------------------------------------------------

describe('validateDocument — STATUS_VALID', () => {
  it('emits STATUS_VALID for an invalid status value', () => {
    const doc = makeMinimal();
    // Cast around TypeScript's type checking to simulate a bad runtime value
    (doc.activities[0] as unknown as { status: string }).status = 'invalid-status';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'STATUS_VALID')).toBe(true);
  });

  it('emits STATUS_VALID error path pointing to the status field', () => {
    const doc = makeMinimal();
    (doc.activities[0] as unknown as { status: string }).status = 'not-a-status';
    const result = validateDocument(doc);
    const err = result.errors.find((e) => e.code === 'STATUS_VALID');
    expect(err?.path).toBe('/activities/0/status');
  });

  it('accepts all valid Status enum values', () => {
    const validStatuses = [
      'planned',
      'in-progress',
      'done',
      'at-risk',
      'blocked',
      'cancelled',
      'tentative',
    ] as const;
    for (const s of validStatuses) {
      const doc = makeMinimal();
      (doc.activities[0] as Activity).status = s;
      const result = validateDocument(doc);
      expect(result.errors.some((e) => e.code === 'STATUS_VALID')).toBe(false);
    }
  });

  it('emits STATUS_VALID for invalid milestone status', () => {
    const doc = makeMinimal();
    doc.milestones = [{ id: 'ms-one', label: 'M1', date: '2026-06-01' }];
    (doc.milestones[0] as unknown as { status: string }).status = 'pending'; // not valid
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'STATUS_VALID')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Invariant 17: AXIS_UNIT_VALID
// ---------------------------------------------------------------------------

describe('validateDocument — AXIS_UNIT_VALID', () => {
  it('emits AXIS_UNIT_VALID for an invalid axis_unit', () => {
    const doc = makeMinimal();
    (doc.metadata as unknown as { axis_unit: string }).axis_unit = 'fortnight';
    const result = validateDocument(doc);
    expect(result.errors.some((e) => e.code === 'AXIS_UNIT_VALID')).toBe(true);
  });

  it('accepts all valid AxisUnit values', () => {
    const units = ['day', 'week', 'month', 'quarter', 'half', 'year'] as const;
    for (const u of units) {
      const doc = makeMinimal();
      doc.metadata.axis_unit = u;
      const result = validateDocument(doc);
      expect(result.errors.some((e) => e.code === 'AXIS_UNIT_VALID')).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// Soft warning: VACUOUS_TIMELINE
// ---------------------------------------------------------------------------

describe('validateDocument — VACUOUS_TIMELINE (warning)', () => {
  it('emits VACUOUS_TIMELINE warning when both activities and milestones are empty', () => {
    const doc = makeMinimal();
    (doc as Record<string, unknown>).activities = [];
    const result = validateDocument(doc);
    expect(result.valid).toBe(true); // not an error
    expect(result.warnings.some((w) => w.code === 'VACUOUS_TIMELINE')).toBe(true);
  });

  it('does NOT emit VACUOUS_TIMELINE when milestones are present', () => {
    const doc = makeMinimal();
    (doc as Record<string, unknown>).activities = [];
    doc.milestones = [{ id: 'ms-one', label: 'M1', date: '2026-06-01' }];
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'VACUOUS_TIMELINE')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Soft warning: UNUSED_TRACK
// ---------------------------------------------------------------------------

describe('validateDocument — UNUSED_TRACK (info warning)', () => {
  it('emits UNUSED_TRACK info for a track not referenced by any activity', () => {
    const doc = makeMinimal();
    doc.tracks.push({ id: 'idle-track', label: 'Idle' });
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'UNUSED_TRACK')).toBe(true);
  });

  it('does NOT emit UNUSED_TRACK when all tracks are used', () => {
    const result = validateDocument(makeMinimal());
    expect(result.warnings.some((w) => w.code === 'UNUSED_TRACK')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Soft warning: STALE_PROGRESS
// ---------------------------------------------------------------------------

describe('validateDocument — STALE_PROGRESS (warning)', () => {
  it('emits STALE_PROGRESS when progress=1.0 and status=in-progress', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).progress = 1.0;
    (doc.activities[0] as Activity).status = 'in-progress';
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'STALE_PROGRESS')).toBe(true);
  });

  it('does NOT emit STALE_PROGRESS when progress=1.0 and status=done', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity).progress = 1.0;
    (doc.activities[0] as Activity).status = 'done';
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'STALE_PROGRESS')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Diagnostics shape
// ---------------------------------------------------------------------------

describe('validateDocument — diagnostic shape', () => {
  it('each error has path, code, message, severity=error', () => {
    const doc = makeMinimal();
    (doc as Record<string, unknown>).tracks = [];
    const result = validateDocument(doc);
    for (const err of result.errors) {
      expect(typeof err.path).toBe('string');
      expect(typeof err.code).toBe('string');
      expect(typeof err.message).toBe('string');
      expect(err.severity).toBe('error');
    }
  });

  it('each warning has severity warning or info', () => {
    const doc = makeMinimal();
    doc.tracks.push({ id: 'unused', label: 'Unused' });
    const result = validateDocument(doc);
    for (const w of result.warnings) {
      expect(['warning', 'info']).toContain(w.severity);
    }
  });
});

// ---------------------------------------------------------------------------
// Real-world scenario: the roadmap example from §4
// ---------------------------------------------------------------------------

describe('validateDocument — roadmap example', () => {
  it('validates the example roadmap from §4 without errors', () => {
    const doc: IRDocument = {
      version: '1.0',
      metadata: {
        title: 'Product Roadmap 2026',
        subtitle: 'Engineering & Design',
        author: 'Product Team',
        created: '2026-06-09',
        time_range: { start: '2026-Q1', end: '2026-Q4' },
        axis_unit: 'quarter',
        theme: 'corporate-blue',
      },
      tracks: [
        { id: 'platform', label: 'Platform', description: 'Core infrastructure and APIs' },
        { id: 'mobile', label: 'Mobile Apps' },
        { id: 'design', label: 'Design System' },
      ],
      groups: [
        { id: 'foundation', label: 'Foundation Work', members: ['api-v2', 'component-lib'] },
      ],
      activities: [
        { id: 'api-v2', label: 'API v2 Migration', track: 'platform', start: '2026-Q1', end: '2026-Q2', status: 'in-progress', progress: 0.6, category: 'infrastructure' },
        { id: 'mobile-redesign', label: 'Mobile App Redesign', track: 'mobile', start: '2026-Q2', end: '2026-Q3', status: 'planned' },
        { id: 'component-lib', label: 'Component Library', track: 'design', start: '2026-Q1', end: '2026-Q4', status: 'in-progress', progress: 0.3 },
        { id: 'analytics', label: 'Analytics Integration', track: 'platform', span: '2026-Q3', status: 'planned' },
      ],
      milestones: [
        { id: 'api-ga', label: 'API v2 GA', date: '2026-06-30', track: 'platform', status: 'planned', icon: 'flag' },
        { id: 'app-launch', label: 'App Store Launch', date: '2026-Q4', track: 'mobile', status: 'planned', category: 'launch' },
      ],
      annotations: [
        { type: 'today-marker', date: 'now' },
      ],
      legend: {
        show: true,
        entries: [
          { key: 'infrastructure', label: 'Infrastructure', category: true },
          { key: 'launch', label: 'Launch Event', category: true },
        ],
      },
    };
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Soft warning: OUTSIDE_TIME_RANGE — role-aware coarse-date coercion (Bug #4)
// ---------------------------------------------------------------------------

describe('validateDocument — OUTSIDE_TIME_RANGE coarse-date coercion', () => {
  // ── True-positive: genuinely out-of-range items still get flagged ──────

  it('flags an activity whose start is after the range end (exact dates)', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-12-31' };
    doc.activities[0] = { id: 'task-a', label: 'Task A', track: 'main', start: '2030-01-01' };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(true);
  });

  it('flags an activity whose end is before the range start (exact dates)', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-12-31' };
    doc.activities[0] = {
      id: 'task-a', label: 'Task A', track: 'main',
      start: '2020-01-01', end: '2020-06-30',
    };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(true);
  });

  // ── False-positive fixes: coarse END dates at the trailing edge ────────

  it('does NOT flag activity with coarse end 2026-Q4 when range ends 2026-Q4', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-Q4' };
    doc.activities[0] = {
      id: 'task-a', label: 'Task A', track: 'main',
      start: '2026-Q1', end: '2026-Q4',
    };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('does NOT flag activity with coarse end 2026 when range ends 2026', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026' };
    doc.activities[0] = {
      id: 'task-a', label: 'Task A', track: 'main',
      start: '2026-01-01', end: '2026',
    };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('does NOT flag activity starting in Nov (within Q4) when range ends 2026-Q4', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-Q4' };
    doc.activities[0] = { id: 'task-a', label: 'Task A', track: 'main', start: '2026-11-01' };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('does NOT flag activity starting in Dec (within year) when range ends 2026', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026' };
    doc.activities[0] = { id: 'task-a', label: 'Task A', track: 'main', start: '2026-12-01' };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  // ── Half and month coarse ends at trailing edge ────────────────────────

  it('does NOT flag activity with coarse end 2026-H2 when range ends 2026-H2', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-H2' };
    doc.activities[0] = {
      id: 'task-a', label: 'Task A', track: 'main',
      start: '2026-H1', end: '2026-H2',
    };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('does NOT flag activity with coarse end 2026-12 when range ends 2026-12', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-12' };
    doc.activities[0] = {
      id: 'task-a', label: 'Task A', track: 'main',
      start: '2026-06-01', end: '2026-12',
    };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('does NOT flag activity starting Nov 15 when range ends 2026-11 (month coarse end)', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-11' };
    doc.activities[0] = { id: 'task-a', label: 'Task A', track: 'main', start: '2026-11-15' };
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  // ── Span uses period-end for its right boundary ────────────────────────

  it('does NOT flag a span of 2026-Q4 when range ends 2026-Q4', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-Q4' };
    doc.activities[0] = {
      id: 'task-a', label: 'Task A', track: 'main',
      span: '2026-Q4',
    } as Activity;
    (doc.activities[0] as Record<string, unknown>).start = undefined;
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  // ── Milestone period straddles / touches the range boundary ───────────

  it('does NOT flag a milestone with date 2026-Q4 when range ends 2026-Q4', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-Q4' };
    doc.milestones = [{ id: 'ms-one', label: 'Launch', date: '2026-Q4', track: 'main' }];
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('does NOT flag a milestone with date 2026-12 when range ends 2026-Q4', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-Q4' };
    doc.milestones = [{ id: 'ms-one', label: 'Launch', date: '2026-12', track: 'main' }];
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(false);
  });

  it('flags a milestone in 2030 when range ends 2026', () => {
    const doc = makeMinimal();
    doc.metadata.time_range = { start: '2026-01-01', end: '2026-12-31' };
    doc.milestones = [{ id: 'ms-one', label: 'Future', date: '2030-06-01', track: 'main' }];
    const result = validateDocument(doc);
    expect(result.warnings.some((w) => w.code === 'OUTSIDE_TIME_RANGE')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Activity.icon — field parity with Milestone.icon
// ---------------------------------------------------------------------------

describe('validateDocument — Activity.icon field', () => {
  it('accepts an activity with a known icon name', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity & { icon?: string }).icon = 'star';
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts an activity with an unknown icon name (silently passes — parity with Milestone)', () => {
    const doc = makeMinimal();
    (doc.activities[0] as Activity & { icon?: string }).icon = 'totally-unknown-icon';
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts an activity without an icon (icon is optional)', () => {
    const doc = makeMinimal();
    const result = validateDocument(doc);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
