/**
 * @file grammars/packet/theme.ts — PacketTheme token surface.
 */

export interface PacketTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  totalWidth: number;
  bitsPerRow: number;
  rowHeight: number;
  bitLabelHeight: number;
  rowGap: number;
  fieldFill: string;
  fieldStroke: string;
  fieldStrokeWidth: number;
  fieldFontSize: number;
  fieldFontWeight: number | string;
  fieldTextColor: string;
  bitLabelFontSize: number;
  bitLabelColor: string;
  titleFontSize: number;
  titleFontWeight: number | string;
  titleColor: string;
}

export const defaultPacketTheme: PacketTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 32,
  marginRight: 32,
  marginTop: 28,
  marginBottom: 28,
  totalWidth: 920,
  bitsPerRow: 32,
  rowHeight: 40,
  bitLabelHeight: 20,
  rowGap: 4,
  fieldFill: '#dae8fc',
  fieldStroke: '#6c8ebf',
  fieldStrokeWidth: 1,
  fieldFontSize: 13,
  fieldFontWeight: 600,
  fieldTextColor: '#1a1a2e',
  bitLabelFontSize: 11,
  bitLabelColor: '#555555',
  titleFontSize: 16,
  titleFontWeight: 700,
  titleColor: '#1e293b',
};

export const darkPacketTheme: PacketTheme = {
  ...defaultPacketTheme,
  background: '#0f172a',
  fieldFill: '#1d4ed8',
  fieldStroke: '#93c5fd',
  fieldTextColor: '#eff6ff',
  bitLabelColor: '#cbd5e1',
  titleColor: '#e2e8f0',
};

export const PACKET_THEME_REGISTRY: Record<string, PacketTheme> = {
  'default-packet': defaultPacketTheme,
  'dark-packet': darkPacketTheme,
};

export function resolvePacketTheme(name?: string): PacketTheme {
  if (!name) return defaultPacketTheme;
  return PACKET_THEME_REGISTRY[name] ?? defaultPacketTheme;
}
