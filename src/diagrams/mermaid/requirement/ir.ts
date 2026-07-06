import type { BaseIR } from '../../../contracts/index.js';

export interface ReqField {
  readonly key: string;
  readonly value: string;
}

export interface ReqNode {
  readonly id: string;
  readonly kind: string;           // requirement | functionalRequirement | designConstraint | element | …
  readonly fields: readonly ReqField[];
}

export interface ReqRelation {
  readonly from: string;
  readonly to: string;
  readonly type: string;           // satisfies | contains | refines | derives | …
}

export interface RequirementDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly nodes: readonly ReqNode[];
  readonly relations: readonly ReqRelation[];
}
