import type { BaseIR } from '../../contracts/index.js';

export interface ErAttribute {
  readonly type: string;
  readonly name: string;
  readonly key?: string;     // PK | FK | UK
}

export interface ErEntity {
  readonly name: string;
  readonly attributes: readonly ErAttribute[];
}

export interface ErRelation {
  readonly left: string;
  readonly right: string;
  readonly leftCard: string;   // 2-char crow's-foot code, e.g. "||", "}o"
  readonly rightCard: string;
  readonly dashed: boolean;
  readonly label?: string;
}

export interface ErDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly entities: readonly ErEntity[];
  readonly relations: readonly ErRelation[];
}
