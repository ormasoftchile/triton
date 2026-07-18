/**
 * Contracts — barrel re-export.
 *
 * Import everything from here. Do not import directly from sub-files
 * outside the contracts/ directory.
 *
 * Dependency order (each file imports only from files above it):
 *
 *   primitives   (no deps)
 *   animations   (no deps)
 *   scene        ← primitives, animations
 *   theme        ← primitives
 *   overlay      ← primitives
 *   routing      ← primitives
 *   result       (no deps)
 *   renderer     ← scene
 *   diagram      ← scene, theme, overlay
 */

export type {
  Point,
  Size,
  Rect,
  Color,
  FontFamily,
  TextAnchor,
  FontWeight,
} from './primitives.js';

export type {
  RenderedConnectorAnimation,
  CrossLinkAnimation,
} from './animations.js';

export {
  CONNECTOR_ANIMATIONS,
  isRenderedConnectorAnimation,
} from './animations.js';

export type {
  SceneRect,
  SceneCircle,
  ScenePath,
  SceneText,
  SceneGroup,
  SceneIcon,
  SceneElement,
  Scene,
} from './scene.js';

export type {
  ThemePalette,
  ThemeTypography,
  ThemeSpacing,
  ThemeEdges,
  ThemePanel,
  ResolvedTheme,
  ThemeInput,
} from './theme.js';

export type {
  RawNote,
  RawLegend,
  RawOverlay,
  LegendCorner,
  LegendEntry,
  Legend,
  Annotation,
  CompiledOverlays,
} from './overlay.js';

export type {
  RouteStyle,
  CurveStyle,
  PortDirection,
  RouteRequest,
  Route,
  Router,
} from './routing.js';

export type {
  DiagramParser,
  DiagramLayoutEngine,
  DiagramModule,
  DiagramKind,
  InputFormat,
  BaseIR,
} from './diagram.js';

export type {
  DiagramErrorCode,
  DiagramError,
  Result,
} from './result.js';

export { ok, err } from './result.js';

export type { Renderer } from './renderer.js';

export type {
  IconRotate,
  IconTransforms,
  IconData,
  IconAlias,
  IconifyJSON,
  IconRef,
  IconViewBox,
  ResolvedIcon,
  IconPackMap,
} from './icons.js';

export type {
  CardinalSide,
  CardinalPorts,
  NodeAnchor,
  NodeAnchorRegistry,
  OccupiedPort,
  LayoutResult,
  PortHint,
  LayoutOptions,
} from './anchors.js';

export type {
  RevealEffect,
  RevealStep,
  RevealTrack,
} from './reveal.js';

export type {
  NodeAddress,
  CrossLinkEdgeStyle,
  CrossLinkDirection,
  CrossLinkEndpointMarker,
  RenderedConnectorAnimation as CrossLinkRenderedAnimation,
  CrossLinkAnimation as CrossLinkAnimationName,
  CrossLink,
  ResolvedCrossLink,
  RouteQuality,
  PerturbationKind,
  Perturbation,
} from './crosslink.js';
