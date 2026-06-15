/**
 * @file grammars/architecture/types.ts — Architecture Diagram Domain IR.
 */

export type PortSide = 'L' | 'R' | 'T' | 'B';
export type ArrowType = 'none' | 'arrow' | 'arrow-left' | 'arrow-both';

export interface ArchService {
  id: string;
  icon: string;
  title: string;
  parentGroup?: string;
}

export interface ArchGroup {
  id: string;
  icon: string;
  title: string;
  parentGroup?: string;
}

export interface ArchJunction {
  id: string;
  parentGroup?: string;
}

export interface ArchEdge {
  fromId: string;
  fromSide: PortSide;
  toId: string;
  toSide: PortSide;
  arrowType: ArrowType;
}

export interface ArchitectureIR {
  services: ArchService[];
  groups: ArchGroup[];
  junctions: ArchJunction[];
  edges: ArchEdge[];
}

export interface ArchitectureMetadata {
  title?: string;
  theme?: string;
}

export interface ArchitectureDocument extends ArchitectureIR {
  version: string;
  metadata: ArchitectureMetadata;
}
