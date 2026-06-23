import type { BaseIR } from '../../contracts/index.js';

export interface MindNode {
  readonly label: string;
  readonly icon?: string;
  readonly children: readonly MindNode[];
}

export interface MindmapDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly root?: MindNode;
}
