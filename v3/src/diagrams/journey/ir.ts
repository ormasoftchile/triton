import type { BaseIR } from '../../contracts/index.js';

export interface JourneyTask {
  readonly label: string;
  /** Satisfaction score, typically 1..5. */
  readonly score: number;
  readonly actors: readonly string[];
}

export interface JourneySection {
  readonly label: string;
  readonly tasks: readonly JourneyTask[];
}

export interface JourneyDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly sections: readonly JourneySection[];
}
