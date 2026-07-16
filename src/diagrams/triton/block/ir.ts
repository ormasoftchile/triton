import type { BaseIR } from '../../../contracts/index.js';
import type { CrossLinkEdgeStyle, CrossLinkEndpointMarker } from '../../../contracts/crosslink.js';
import type { RenderedConnectorAnimation } from '../../../contracts/animations.js';

export interface BlockNode {
  readonly id: string;
  readonly label: string;
  readonly span: number;
  readonly isSpace?: boolean;
}

export interface BlockEdge {
  readonly from: string;
  readonly to: string;
  readonly label?: string;
  readonly style?: CrossLinkEdgeStyle;
  readonly startMarker?: CrossLinkEndpointMarker;
  readonly endMarker?: CrossLinkEndpointMarker;
  readonly animation?: RenderedConnectorAnimation | 'none';
}

export interface BlockDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly columns: number;
  readonly blocks: readonly BlockNode[];
  readonly edges: readonly BlockEdge[];
}
