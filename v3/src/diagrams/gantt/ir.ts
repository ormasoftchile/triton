import type { BaseIR } from '../../contracts/index.js';

export type GanttStatus = 'done' | 'active' | 'crit' | 'default';

export interface GanttTask {
  readonly id?: string;
  readonly label: string;
  readonly status: GanttStatus;
  /** Resolved ISO start date (YYYY-MM-DD). */
  readonly start: string;
  /** Resolved ISO end date (YYYY-MM-DD); equals start for milestones. */
  readonly end: string;
  readonly isMilestone: boolean;
}

export interface GanttSection {
  readonly label: string;
  readonly tasks: readonly GanttTask[];
}

export interface GanttDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly sections: readonly GanttSection[];
}
