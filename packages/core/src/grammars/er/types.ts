/**
 * @file grammars/er/types.ts — ER Grammar Domain IR.
 */

export type ErCardinality = 'zero-or-one' | 'exactly-one' | 'zero-or-many' | 'one-or-many';

export interface ErAttribute {
  type: string;
  name: string;
  keys?: Array<'PK' | 'FK' | 'UK'>;
  comment?: string;
}

export interface ErEntity {
  name: string;
  attributes: ErAttribute[];
}

export interface ErRelationship {
  entityA: string;
  entityB: string;
  cardinalityA: ErCardinality;
  cardinalityB: ErCardinality;
  identifying: boolean;
  label: string;
}

export interface ErMetadata {
  title?: string;
  theme?: string;
}

export interface ErDocument {
  version: string;
  metadata: ErMetadata;
  entities: ErEntity[];
  relationships: ErRelationship[];
}
