export const CONNECTOR_ANIMATIONS = [
  'march',
  'particle',
  'draw',
  'pulse',
  'glow',
  'comet',
  'stream',
  'flow',
  'colorcycle',
] as const;

export type RenderedConnectorAnimation = typeof CONNECTOR_ANIMATIONS[number];
export type CrossLinkAnimation = RenderedConnectorAnimation | 'none';

export function isRenderedConnectorAnimation(value: unknown): value is RenderedConnectorAnimation {
  return typeof value === 'string' && (CONNECTOR_ANIMATIONS as readonly string[]).includes(value);
}
