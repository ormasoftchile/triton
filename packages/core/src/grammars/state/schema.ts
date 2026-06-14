/**
 * @file grammars/state/schema.ts — Zod schema for StateDocument.
 */

import { z } from 'zod';

import type { StateDocument, StateNode } from './types.js';

const pseudostateKindSchema = z.enum(['start', 'end', 'fork', 'join', 'choice']);

const stateNodeSchema: z.ZodType<StateNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1, 'State id must not be empty'),
    label: z.string().optional(),
    displayLabel: z.string().optional(),
    description: z.string().optional(),
    isPseudo: pseudostateKindSchema.optional(),
    children: z.array(stateNodeSchema).optional(),
    note: z.string().optional(),
    notePosition: z.enum(['left', 'right']).optional(),
  }),
);

const stateTransitionSchema = z.object({
  from: z.string().min(1, 'Transition from must reference a state id'),
  to: z.string().min(1, 'Transition to must reference a state id'),
  label: z.string().optional(),
});

const stateMetadataSchema = z.object({
  title: z.string().optional(),
  theme: z.string().optional(),
});

function cloneState(node: StateNode): StateNode {
  return {
    id: node.id,
    ...(node.label !== undefined ? { label: node.label } : {}),
    ...(node.displayLabel !== undefined ? { displayLabel: node.displayLabel } : {}),
    ...(node.description !== undefined ? { description: node.description } : {}),
    ...(node.isPseudo !== undefined ? { isPseudo: node.isPseudo } : {}),
    ...(node.note !== undefined ? { note: node.note } : {}),
    ...(node.notePosition !== undefined ? { notePosition: node.notePosition } : {}),
    ...(node.children ? { children: node.children.map(cloneState) } : {}),
  };
}

function collectStateIds(states: StateNode[], ids: Set<string>): void {
  for (const state of states) {
    ids.add(state.id);
    if (state.children) collectStateIds(state.children, ids);
  }
}

export function normalizeStateDocument(doc: StateDocument): StateDocument {
  const states = doc.states.map(cloneState);
  const transitions = doc.transitions.map((transition) => ({ ...transition }));
  const normalized: StateDocument = {
    version: doc.version,
    metadata: { ...doc.metadata },
    states,
    transitions,
  };

  const ids = new Set<string>();
  collectStateIds(states, ids);
  const missing = new Set<string>();
  for (const transition of transitions) {
    if (!ids.has(transition.from)) missing.add(transition.from);
    if (!ids.has(transition.to)) missing.add(transition.to);
  }

  for (const id of missing) {
    normalized.states.push({ id });
    ids.add(id);
  }

  return normalized;
}

export const stateDocumentSchema = z
  .object({
    version: z.string().min(1, 'version is required'),
    metadata: stateMetadataSchema,
    states: z.array(stateNodeSchema),
    transitions: z.array(stateTransitionSchema),
  })
  .superRefine((doc, ctx) => {
    const ids = new Set<string>();

    function visit(states: StateNode[], path: Array<string | number>): void {
      for (let i = 0; i < states.length; i++) {
        const state = states[i]!;
        if (ids.has(state.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, i, 'id'],
            message: `Duplicate state id: '${state.id}'`,
          });
        }
        ids.add(state.id);
        if (state.children) visit(state.children, [...path, i, 'children']);
      }
    }

    visit(doc.states, ['states']);
  });

export type StateDocumentInput = z.input<typeof stateDocumentSchema>;
