/**
 * @file grammars/block/types.ts — Block Diagram Domain IR.
 */

export type BlockShape = 'rect' | 'rounded' | 'circle' | 'diamond' | 'flag' | 'space';

export interface BlockItem {
  id: string;
  label: string;
  shape: BlockShape;
  span: number;
  isSpace: boolean;
  group?: string;
  /** Stable declaration order within its parent scope. */
  order?: number;
}

export interface BlockGroup {
  id: string;
  label: string;
  span: number;
  childIds: string[];
  /** Parent group id when nested. */
  group?: string;
  /** Stable declaration order within its parent scope. */
  order?: number;
}

export interface BlockArrow {
  from: string;
  to: string;
  label?: string;
}

export interface BlockMetadata {
  title?: string;
  theme?: string;
}

export interface BlockDocument {
  version: string;
  metadata: BlockMetadata;
  columns: number;
  /** Ordered items, including synthetic space items for faithful placement. */
  items: BlockItem[];
  groups: BlockGroup[];
  arrows: BlockArrow[];
}
