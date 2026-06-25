/**
 * @triton/core — public entry point.
 *
 * Importing this module registers all diagram types and renderers.
 * The four exported functions are the complete public API.
 */

// ─── Public API ────────────────────────────────────────────────────────────────
export { compileSync, renderSync, compile, render } from './frontend/index.js';

// ─── Types ─────────────────────────────────────────────────────────────────────
export type {
  // Primitives
  Point, Size, Rect, Color, FontFamily, TextAnchor, FontWeight,
  // Scene
  SceneRect, SceneCircle, ScenePath, SceneText, SceneGroup, SceneElement, Scene,
  // Theme
  ThemePalette, ThemeTypography, ThemeSpacing, ThemeEdges, ThemePanel,
  ResolvedTheme, ThemeInput,
  // Diagram
  DiagramModule, DiagramKind, InputFormat, BaseIR,
  // Layout
  LayoutResult, NodeAnchor, NodeAnchorRegistry,
  // Result
  DiagramError, DiagramErrorCode, Result,
  // Routing
  RouteStyle, Route, Router,
} from './contracts/index.js';
