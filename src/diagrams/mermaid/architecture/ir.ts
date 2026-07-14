import type { BaseIR, CrossLinkEdgeStyle, CrossLinkEndpointMarker } from '../../../contracts/index.js';

export interface ArchService {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly group?: string;
}

export interface ArchGroup {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  /** ID of the enclosing group when this group is nested inside another. */
  readonly parent?: string;
}

/** A junction is a 4-way edge split node — no icon or label. */
export interface ArchJunction {
  readonly id: string;
  /** ID of the enclosing group, if any. */
  readonly group?: string;
}

export interface ArchEdge {
  readonly from: string;
  readonly fromSide: string;   // L R T B
  /** True when the `{group}` modifier is present on the from endpoint. */
  readonly fromGroup: boolean;
  readonly to: string;
  readonly toSide: string;
  /** True when the `{group}` modifier is present on the to endpoint. */
  readonly toGroup: boolean;
  /** Arrow points left (towards from): `<--` or `<-->`. */
  readonly arrowLeft: boolean;
  /** Arrow points right (towards to): `-->` or `<-->`. */
  readonly arrowRight: boolean;
  /** Triton connector visual style. Plain Mermaid architecture arrows default to solid. */
  readonly style: CrossLinkEdgeStyle;
  /** Marker rendered at the path start. */
  readonly startMarker: CrossLinkEndpointMarker;
  /** Marker rendered at the path end. */
  readonly endMarker: CrossLinkEndpointMarker;
}

export interface ArchAlign {
  readonly axis: 'row' | 'column';
  readonly members: readonly string[];
}

export interface ArchitectureDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly groups: readonly ArchGroup[];
  readonly services: readonly ArchService[];
  readonly junctions: readonly ArchJunction[];
  readonly edges: readonly ArchEdge[];
  /**
   * Alignment hints for layout — axis (row/column) + member IDs.
   * TODO(Brian/Phase B): honour these as layout constraints in layoutArchitecture().
   */
  readonly aligns: readonly ArchAlign[];
}
