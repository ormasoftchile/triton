import type {
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
} from '../../../contracts/index.js';
import type { PyramidDocument } from './ir.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { applyOverlays } from '../../../overlay/apply.js';

export function layoutPyramid(doc: PyramidDocument, theme: ResolvedTheme): LayoutResult {
  const p = pen(theme);
  const { palette, typography } = theme;
  const elements: SceneElement[] = [];

  const tiers = doc.tiers;
  const N = Math.max(tiers.length, 1);
  const isFunnel = doc.direction === 'funnel';

  const marginX = 80;
  const titleH = doc.metadata.title ? 60 : 30;
  const tierH = 54;
  const tierGap = 6;
  const totalTierH = N * tierH + (N - 1) * tierGap;

  const minW = 200;
  const maxW = 560;
  const canvasW = 860;
  const centerX = 380;
  const canvasH = titleH + totalTierH + 60;

  // Title
  if (doc.metadata.title) {
    elements.push(
      p.text(String(doc.metadata.title), marginX, 40, typography.titleFontSize, palette.text, {
        weight: 'bold',
      }),
    );
  }

  for (let i = 0; i < N; i++) {
    const tier = tiers[i]!;
    const curY = titleH + i * (tierH + tierGap);

    let topFrac: number;
    let botFrac: number;

    if (!isFunnel) {
      // Pyramid: top narrow, bottom wide
      topFrac = i / N;
      botFrac = (i + 1) / N;
    } else {
      // Funnel: top wide, bottom narrow
      topFrac = (N - i) / N;
      botFrac = (N - i - 1) / N;
    }

    const wTop = minW + (maxW - minW) * topFrac;
    const wBot = minW + (maxW - minW) * botFrac;

    const x1 = centerX - wTop / 2;
    const x2 = centerX + wTop / 2;
    const x3 = centerX + wBot / 2;
    const x4 = centerX - wBot / 2;
    const y1 = curY;
    const y2 = curY + tierH;

    const isFocal = tier.isFocal;
    const fill = isFocal ? palette.primary : palette.surface;
    const stroke = isFocal ? palette.primary : palette.border;
    const textFill = isFocal ? (theme.name.includes('dark') ? '#1E293B' : '#FFFFFF') : palette.text;

    // Trapezoid path
    const pathD = `M ${x1} ${y1} L ${x2} ${y1} L ${x3} ${y2} L ${x4} ${y2} Z`;
    elements.push(p.path(pathD, stroke, 1.5, { fill }));

    // Tier Label
    elements.push(
      p.text(
        tier.label,
        centerX,
        curY + tierH / 2 + typography.baseFontSize * 0.35,
        typography.baseFontSize,
        textFill,
        { weight: isFocal ? 'bold' : 'normal', anchor: 'middle' },
      ),
    );

    // Optional Value indicator on right
    if (tier.value !== undefined) {
      const rightX = Math.max(x2, x3) + 24;
      const valText = String(tier.value);
      // Guide dash
      elements.push(
        p.path(
          `M ${Math.max(x2, x3) + 4} ${curY + tierH / 2} L ${rightX - 6} ${curY + tierH / 2}`,
          palette.border,
          1,
          { dash: '3 2' },
        ),
      );
      // Value badge
      elements.push(
        p.text(
          valText,
          rightX,
          curY + tierH / 2 + typography.smallFontSize * 0.35,
          typography.smallFontSize,
          palette.primary,
          { weight: 'bold' },
        ),
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
