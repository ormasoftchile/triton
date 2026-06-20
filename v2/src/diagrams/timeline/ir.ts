/**
 * TimelineDocument — Canonical IR for timeline/temporal diagrams.
 *
 * Supports: horizontal, vertical-spine, serpentine, roadmap, gantt,
 * and Mermaid-compatible column layouts — all from one IR.
 */

import type { RawOverlay } from '../../scene/compile-overlays.js';

// ─── Date & Time ───────────────────────────────────────────────────────────────

/** Flexible date: ISO string, relative ("Q1 2025"), or symbolic ("Phase 1") */
export type TimelineDate = string;

export type AxisUnit = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';

// ─── Core Entities ─────────────────────────────────────────────────────────────

export interface Track {
  id: string;
  label: string;
  color?: string;
}

export interface Activity {
  id: string;
  label: string;
  track: string;       // reference to Track.id
  start: TimelineDate;
  end?: TimelineDate;  // omit for point-in-time
  status?: 'default' | 'active' | 'done' | 'blocked';
  description?: string;
}

export interface Milestone {
  id: string;
  label: string;
  date: TimelineDate;
  track?: string;
  icon?: string;
}

export interface Section {
  id: string;
  label: string;
  start: TimelineDate;
  end: TimelineDate;
}

// ─── Layout Families ───────────────────────────────────────────────────────────

export type TimelineLayout =
  | 'horizontal'
  | 'vertical-spine'
  | 'serpentine'
  | 'roadmap'
  | 'gantt'
  | 'timeline-columns';

// ─── Document ──────────────────────────────────────────────────────────────────

export interface TimelineDocument {
  version: string;
  metadata: {
    title?: string;
    theme?: string;
    [key: string]: string | undefined;
  };
  layout: TimelineLayout;
  axisUnit?: AxisUnit;
  tracks: Track[];
  activities: Activity[];
  milestones: Milestone[];
  sections?: Section[];
  overlays?: RawOverlay[];
}
