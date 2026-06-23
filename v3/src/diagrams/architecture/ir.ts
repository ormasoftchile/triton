import type { BaseIR } from '../../contracts/index.js';

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
}

export interface ArchEdge {
  readonly from: string;
  readonly fromSide: string;   // L R T B
  readonly to: string;
  readonly toSide: string;
}

export interface ArchitectureDocument extends BaseIR {
  readonly metadata: { readonly title?: string; readonly theme?: string; readonly [key: string]: string | undefined };
  readonly groups: readonly ArchGroup[];
  readonly services: readonly ArchService[];
  readonly edges: readonly ArchEdge[];
}
