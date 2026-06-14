/**
 * @file grammars/kanban/theme.ts — KanbanTheme token surface.
 *
 * Fidelity reference: real Mermaid kanban renders show colored column header
 * bands (Todo=green, Doing/In Progress=purple, Done=pink/salmon) with white
 * card boxes stacked beneath. Each card has a subtle shadow and rounded corners.
 * Theme owns the column color palette (cycling through a set of pastel hues).
 */

export interface KanbanTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;
  /** Width of each column (fixed). */
  columnWidth: number;
  /** Gap between columns. */
  columnGap: number;
  /** Column header height. */
  headerHeight: number;
  headerFontSize: number;
  headerFontWeight: number | string;
  headerTextColor: string;
  headerRx: number;
  /** Column header fill colors (cycled). */
  headerColors: string[];
  /** Card styling. */
  cardPadX: number;
  cardPadY: number;
  cardGap: number;
  cardRx: number;
  cardFill: string;
  cardStroke: string;
  cardStrokeWidth: number;
  cardFontSize: number;
  cardFontWeight: number | string;
  cardTextColor: string;
  cardMaxWidth: number;
  /** Priority badge colors. */
  priorityHighColor: string;
  priorityMedColor: string;
  priorityLowColor: string;
  /** Column outer rect (background). */
  columnFill: string;
  columnStroke: string;
  columnStrokeWidth: number;
  columnRx: number;
  /** Bottom padding inside column below last card. */
  columnBottomPad: number;
}

export const defaultKanbanTheme: KanbanTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 40,
  marginRight: 40,
  marginTop: 40,
  marginBottom: 40,
  columnWidth: 180,
  columnGap: 20,
  headerHeight: 40,
  headerFontSize: 14,
  headerFontWeight: 700,
  headerTextColor: '#ffffff',
  headerRx: 8,
  // Mermaid default palette: green (Todo), purple (In Progress), pink (Done)
  headerColors: ['#22c55e', '#a855f7', '#f43f5e', '#3b82f6', '#f59e0b', '#14b8a6'],
  cardPadX: 10,
  cardPadY: 8,
  cardGap: 8,
  cardRx: 6,
  cardFill: '#ffffff',
  cardStroke: '#e2e8f0',
  cardStrokeWidth: 1,
  cardFontSize: 12,
  cardFontWeight: 400,
  cardTextColor: '#0f172a',
  cardMaxWidth: 160,
  priorityHighColor: '#ef4444',
  priorityMedColor: '#f59e0b',
  priorityLowColor: '#22c55e',
  columnFill: '#f8fafc',
  columnStroke: '#e2e8f0',
  columnStrokeWidth: 1,
  columnRx: 8,
  columnBottomPad: 12,
};

export const darkKanbanTheme: KanbanTheme = {
  ...defaultKanbanTheme,
  background: '#0f172a',
  headerColors: ['#16a34a', '#7c3aed', '#be123c', '#1d4ed8', '#b45309', '#0f766e'],
  cardFill: '#1e293b',
  cardStroke: '#334155',
  cardTextColor: '#e2e8f0',
  columnFill: '#1e293b',
  columnStroke: '#334155',
  headerTextColor: '#f8fafc',
};

export const KANBAN_THEME_REGISTRY: Record<string, KanbanTheme> = {
  'default-kanban': defaultKanbanTheme,
  'dark-kanban': darkKanbanTheme,
};

export function resolveKanbanTheme(name?: string): KanbanTheme {
  if (!name) return defaultKanbanTheme;
  return KANBAN_THEME_REGISTRY[name] ?? defaultKanbanTheme;
}
