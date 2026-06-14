export interface GitGraphTheme {
  background: string;
  fontFamily: string;
  marginLeft: number;
  marginRight: number;
  marginTop: number;
  marginBottom: number;

  branchColors: string[];
  branchStrokeWidth: number;
  branchLaneSize: number;
  branchLabelFontSize: number;
  branchLabelFontWeight: number | string;
  branchLabelColor: string;
  branchLabelWidth: number;

  commitRadius: number;
  commitStrokeWidth: number;

  commitLabelFontSize: number;
  commitLabelColor: string;
  commitLabelOffsetY: number;

  tagFill: string;
  tagStroke: string;
  tagFontSize: number;
  tagFontWeight: number | string;
  tagColor: string;
  tagPadX: number;
  tagPadY: number;
  tagOffsetY: number;

  highlightFill: string;
  reverseFill: string;

  mergeEdgeStrokeWidth: number;
  commitGapX: number;
}

export const defaultGitGraphTheme: GitGraphTheme = {
  background: '#ffffff',
  fontFamily: 'DejaVu Sans, sans-serif',
  marginLeft: 48,
  marginRight: 48,
  marginTop: 48,
  marginBottom: 48,

  branchColors: ['#4a6cf7', '#f97316', '#22c55e', '#a855f7', '#ef4444', '#06b6d4', '#eab308', '#ec4899'],
  branchStrokeWidth: 3,
  branchLaneSize: 84,
  branchLabelFontSize: 13,
  branchLabelFontWeight: 700,
  branchLabelColor: '#334155',
  branchLabelWidth: 136,

  commitRadius: 10,
  commitStrokeWidth: 2,

  commitLabelFontSize: 11,
  commitLabelColor: '#0f172a',
  commitLabelOffsetY: 24,

  tagFill: '#fef3c7',
  tagStroke: '#f59e0b',
  tagFontSize: 10,
  tagFontWeight: 700,
  tagColor: '#92400e',
  tagPadX: 8,
  tagPadY: 4,
  tagOffsetY: 22,

  highlightFill: '#fde047',
  reverseFill: '#e5e7eb',

  mergeEdgeStrokeWidth: 2,
  commitGapX: 92,
};

export const darkGitGraphTheme: GitGraphTheme = {
  ...defaultGitGraphTheme,
  background: '#020617',
  branchLabelColor: '#e2e8f0',
  commitLabelColor: '#cbd5e1',
  tagFill: '#1e293b',
  tagStroke: '#38bdf8',
  tagColor: '#e2e8f0',
  highlightFill: '#facc15',
  reverseFill: '#334155',
};

export const GITGRAPH_THEME_REGISTRY: Record<string, GitGraphTheme> = {
  'default-gitgraph': defaultGitGraphTheme,
  'dark-gitgraph': darkGitGraphTheme,
};

export function resolveGitGraphTheme(name?: string): GitGraphTheme {
  if (!name) return defaultGitGraphTheme;
  return GITGRAPH_THEME_REGISTRY[name] ?? defaultGitGraphTheme;
}
