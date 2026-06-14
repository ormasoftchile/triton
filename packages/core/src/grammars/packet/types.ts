/**
 * @file grammars/packet/types.ts — Packet Diagram Domain IR.
 */

export interface PacketField {
  startBit: number;
  endBit: number;
  label: string;
}

export interface PacketMetadata {
  title?: string;
  theme?: string;
  bitsPerRow?: number;
}

export interface PacketDocument {
  version: string;
  metadata: PacketMetadata;
  fields: PacketField[];
}
