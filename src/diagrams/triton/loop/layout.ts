import type {
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
} from '../../../contracts/index.js';
import type { LoopDocument } from './ir.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { applyOverlays } from '../../../overlay/apply.js';

export function layoutLoop(doc: LoopDocument, theme: ResolvedTheme): LayoutResult {
  const p = pen(theme);
  const { palette, typography } = theme;
  const elements: SceneElement[] = [];

  const steps = doc.steps;
  const N = Math.max(steps.length, 1);

  const canvasW = 860;
  const canvasH = 720;
  const titleH = doc.metadata.title ? 60 : 30;
  const cx = canvasW / 2;
  const cy = titleH + 310;
  const radius = 200;

  // Title
  if (doc.metadata.title) {
    elements.push(
      p.text(String(doc.metadata.title), 60, 40, typography.titleFontSize, palette.text, {
        weight: 'bold',
      }),
    );
  }

  // Radial dashed spokes connecting to hub (drawn behind)
  if (doc.hub) {
    for (let i = 0; i < N; i++) {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
      const sx = cx + radius * Math.cos(angle);
      const sy = cy + radius * Math.sin(angle);
      elements.push(p.path(`M ${cx} ${cy} L ${sx} ${sy}`, palette.border, 1, { dash: '4 4' }));
    }
  }

  // Circular connecting arrows between step i and step (i+1) % N
  if (N > 1) {
    for (let i = 0; i < N; i++) {
      const nextIdx = (i + 1) % N;
      const a1 = -Math.PI / 2 + (2 * Math.PI * i) / N;
      const a2 = -Math.PI / 2 + (2 * Math.PI * nextIdx) / N;

      // Arc points offset along circle
      const midAngle = a1 + (a2 > a1 ? a2 - a1 : a2 + 2 * Math.PI - a1) / 2;
      const arcR = radius + 25;

      const p1x = cx + radius * Math.cos(a1 + 0.35);
      const p1y = cy + radius * Math.sin(a1 + 0.35);
      const p2x = cx + radius * Math.cos(a2 - 0.35);
      const p2y = cy + radius * Math.sin(a2 - 0.35);
      const cpx = cx + arcR * Math.cos(midAngle);
      const cpy = cy + arcR * Math.sin(midAngle);

      // Arc curve
      elements.push(p.path(`M ${p1x} ${p1y} Q ${cpx} ${cpy} ${p2x} ${p2y}`, palette.primary, 1.8));

      // Arrowhead at p2
      const tangentX = p2x - cpx;
      const tangentY = p2y - cpy;
      const len = Math.hypot(tangentX, tangentY) || 1;
      const ux = tangentX / len;
      const uy = tangentY / len;
      const arrowLen = theme.edges?.arrowSize ?? 8;
      const arrowW = arrowLen * 0.6;

      const ax1 = p2x - ux * arrowLen + uy * arrowW;
      const ay1 = p2y - uy * arrowLen - ux * arrowW;
      const ax2 = p2x - ux * arrowLen - uy * arrowW;
      const ay2 = p2y - uy * arrowLen + ux * arrowW;

      elements.push(
        p.path(`M ${ax1} ${ay1} L ${p2x} ${p2y} L ${ax2} ${ay2} Z`, palette.primary, 1, {
          fill: palette.primary,
        }),
      );
    }
  }

  // Central Hub Node
  if (doc.hub) {
    const hubW = 140;
    const hubH = 64;
    elements.push(
      p.rect(
        { x: cx - hubW / 2, y: cy - hubH / 2, width: hubW, height: hubH },
        palette.surface,
        palette.primary,
        2,
        { rx: 32 },
      ),
    );
    elements.push(
      p.text(
        doc.hub,
        cx,
        cy + typography.smallFontSize * 0.35,
        typography.smallFontSize,
        palette.text,
        { weight: 'bold', anchor: 'middle' },
      ),
    );
  }

  // Step Nodes
  const nodeW = 150;
  const nodeH = 52;

  for (let i = 0; i < N; i++) {
    const step = steps[i]!;
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / N;
    const nx = cx + radius * Math.cos(angle);
    const ny = cy + radius * Math.sin(angle);

    const isFocal = step.isFocal;
    const fill = isFocal ? palette.primary : palette.surface;
    const stroke = isFocal ? palette.primary : palette.border;
    const textFill = isFocal ? (theme.name.includes('dark') ? '#1E293B' : '#FFFFFF') : palette.text;
    const descFill = isFocal
      ? theme.name.includes('dark')
        ? '#334155'
        : 'rgba(255,255,255,0.85)'
      : palette.textMuted;

    elements.push(
      p.rect(
        { x: nx - nodeW / 2, y: ny - nodeH / 2, width: nodeW, height: nodeH },
        fill,
        stroke,
        isFocal ? 2 : 1.5,
        { rx: 6 },
      ),
    );

    const hasDesc = Boolean(step.desc);
    const titleY = hasDesc ? ny - 4 : ny + typography.smallFontSize * 0.35;

    elements.push(
      p.text(step.label, nx, titleY, typography.smallFontSize, textFill, {
        weight: 'bold',
        anchor: 'middle',
      }),
    );

    if (hasDesc && step.desc) {
      elements.push(
        p.text(step.desc, nx, ny + 12, typography.smallFontSize - 2, descFill, {
          anchor: 'middle',
        }),
      );
    }
  }

  const rawScene: Scene = {
    viewBox: { x: 0, y: 0, width: canvasW, height: canvasH },
    background: palette.background,
    elements,
  };

  const scene = applyOverlays(rawScene, doc.overlays, theme);
  const anchors: NodeAnchorRegistry = {};

  return { scene, anchors };
}
