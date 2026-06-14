/**
 * @file grammars/c4/types.ts — C4 Grammar Domain IR.
 */

export type C4ElementKind =
  | 'Person' | 'Person_Ext'
  | 'System' | 'System_Ext' | 'SystemDb' | 'SystemDb_Ext' | 'SystemQueue' | 'SystemQueue_Ext'
  | 'Container' | 'Container_Ext' | 'ContainerDb' | 'ContainerDb_Ext' | 'ContainerQueue' | 'ContainerQueue_Ext'
  | 'Component' | 'Component_Ext' | 'ComponentDb' | 'ComponentDb_Ext' | 'ComponentQueue' | 'ComponentQueue_Ext';

export interface C4Element {
  alias: string;
  kind: C4ElementKind;
  label: string;
  technology?: string;
  description?: string;
}

export interface C4Boundary {
  alias: string;
  label: string;
  boundaryKind: 'Boundary' | 'Enterprise_Boundary' | 'System_Boundary' | 'Container_Boundary';
  boundaryType?: string;
  children: Array<C4Element | C4Boundary>;
}

export type C4RelKind = 'Rel' | 'BiRel' | 'Rel_U' | 'Rel_D' | 'Rel_L' | 'Rel_R' | 'Rel_Back';

export interface C4Rel {
  kind: C4RelKind;
  from: string;
  to: string;
  label: string;
  technology?: string;
  order?: number;
}

export type C4DiagramKind = 'C4Context' | 'C4Container' | 'C4Component' | 'C4Dynamic' | 'C4Deployment';

export interface C4Metadata {
  title?: string;
  theme?: string;
  diagramKind: C4DiagramKind;
}

export interface C4Document {
  version: string;
  metadata: C4Metadata;
  elements: C4Element[];
  boundaries: C4Boundary[];
  rels: C4Rel[];
}
