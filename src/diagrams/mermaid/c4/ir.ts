import type { BaseIR } from '../../../contracts/index.js';

export type C4Kind = 'person' | 'person_ext' | 'system' | 'system_ext' | 'container' | 'container_ext' | 'component' | 'db';

export interface C4Node {
  readonly id: string;
  readonly label: string;
  readonly descr?: string;
  readonly kind: C4Kind;
}

export interface C4Boundary {
  readonly id: string;
  readonly label: string;
  readonly depth: number;
  /** All descendant node ids (flattened). */
  readonly nodeIds: readonly string[];
}

export interface C4Rel {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly tech?: string;
  readonly ext: boolean;
}

export interface C4Document extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly nodes: readonly C4Node[];
  readonly boundaries: readonly C4Boundary[];
  readonly rels: readonly C4Rel[];
}
