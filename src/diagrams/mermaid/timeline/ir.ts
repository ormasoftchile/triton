import type { BaseIR } from '../../../contracts/index.js';

export type TimelineDate = string;
export type AxisUnit = 'day' | 'week' | 'month' | 'quarter' | 'half' | 'year';
export type TimelineLayout =
  | 'horizontal' | 'vertical-spine' | 'serpentine'
  | 'roadmap' | 'gantt' | 'timeline-columns' | 'numbered';
export type ActivityStatus = 'default' | 'active' | 'done' | 'blocked';

export interface Track {
  readonly id: string;
  readonly label: string;
  readonly color?: string;
}

export interface Activity {
  readonly id: string;
  readonly label: string;
  readonly track: string;
  readonly start: TimelineDate;
  readonly end?: TimelineDate;
  readonly status?: ActivityStatus;
  readonly description?: string;
}

export interface Milestone {
  readonly id: string;
  readonly label: string;
  readonly date: TimelineDate;
  readonly track?: string;
  readonly icon?: string;
  readonly description?: string;
}

export interface Section {
  readonly id: string;
  readonly label: string;
  readonly start: TimelineDate;
  readonly end: TimelineDate;
}

export interface TimelineDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly layout: TimelineLayout;
  readonly axisUnit?: AxisUnit;
  readonly tracks: readonly Track[];
  readonly activities: readonly Activity[];
  readonly milestones: readonly Milestone[];
  readonly sections?: readonly Section[];
}
