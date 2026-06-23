import type { BaseIR } from '../../contracts/index.js';

export interface ClassMember {
  readonly text: string;
  readonly isMethod: boolean;
}

export interface ClassBox {
  readonly name: string;
  readonly stereotype?: string;
  readonly attributes: readonly ClassMember[];
  readonly methods: readonly ClassMember[];
}

export type RelEnd = 'none' | 'triangle' | 'diamondF' | 'diamondO' | 'arrow';

export interface ClassRelation {
  readonly left: string;
  readonly right: string;
  readonly leftHead: RelEnd;
  readonly rightHead: RelEnd;
  readonly dashed: boolean;
  readonly label?: string;
  readonly leftCard?: string;
  readonly rightCard?: string;
}

export interface ClassDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly classes: readonly ClassBox[];
  readonly relations: readonly ClassRelation[];
}
