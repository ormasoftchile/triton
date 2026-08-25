import type {
  DiagramLayoutEngine,
  ResolvedTheme,
  LayoutResult,
  Scene,
  SceneElement,
  NodeAnchorRegistry,
  Rect,
} from '../../../contracts/index.js';
import type { FishboneDocument } from './ir.js';
import { pen } from '../../../scene/build.js';
import { measureText } from '../../../text/metrics.js';
import { applyOverlays } from '../../../overlay/apply.js';

export function layoutFishbone(doc: FishboneDocument, theme: ResolvedTheme): LayoutResult {
  const p = pen(theme);
  const { palette, typography } = theme;
  const elements: SceneElement[] = [];

  const categories = doc.categories;
  const numCats = categories.length;
  const topCats = categories.filter((_, i) => i % 2 === 0);
  const botCats = categories.filter((_, i) => i % 2 === 1);
  const numPairs = Math.max(topCats.length, botCats.length, 1);

  const colWidth = 240;
  const marginX = 60;
  const titleH = doc.metadata.title ? 60 : 20;
  const spineStartX = marginX;
  const spineEndX = marginX + numPairs * colWidth + 40;
  const effectBoxW = 180;
  const effectBoxH = 64;
  const effectBoxX = spineEndX + 10;
  const spineY = titleH + 260;
  const canvasW = effectBoxX + effectBoxW + marginX;
  const canvasH = spineY + 280;

  // Title
  if (doc.metadata.title) {
    elements.push(
      p.text(String(doc.metadata.title), marginX, 40, typography.titleFontSize, palette.text, {
        weight: 'bold',
      }),
    );
  }

  // Central Spine
  elements.push(p.path(`M ${spineStartX} ${spineY} L ${spineEndX} ${spineY}`, palette.primary, 3));

  // Spine Arrowhead to Effect Box
  elements.push(
    p.path(
      `M ${spineEndX - 10} ${spineY - 8} L ${spineEndX + 6} ${spineY} L ${spineEndX - 10} ${spineY + 8} Z`,
      palette.primary,
      1,
      { fill: palette.primary },
    ),
  );

  // Effect Box
  elements.push(
    p.rect(
      { x: effectBoxX, y: spineY - effectBoxH / 2, width: effectBoxW, height: effectBoxH },
      palette.surface,
      palette.primary,
      2,
      { rx: 6 },
    ),
  );

  // Effect Text
  const effectMeasured = measureText(doc.effect, typography.baseFontSize);
  elements.push(
    p.text(
      doc.effect,
      effectBoxX + effectBoxW / 2,
      spineY + typography.baseFontSize * 0.35,
      typography.baseFontSize,
      palette.text,
      { weight: 'bold', anchor: 'middle' },
    ),
  );

  // Render Categories (Top & Bottom)
  for (let pairIdx = 0; pairIdx < numPairs; pairIdx++) {
    const spineAttachX = spineStartX + 120 + pairIdx * colWidth;

    // Top Category
    if (pairIdx < topCats.length) {
      const cat = topCats[pairIdx]!;
      const ribStartX = spineAttachX - 100;
      const ribStartY = spineY - 200;

      // Diagonal rib line
      elements.push(
        p.path(`M ${ribStartX} ${ribStartY} L ${spineAttachX} ${spineY}`, palette.border, 2),
      );

      // Category Header Box
      const catTextW = Math.max(90, measureText(cat.name, typography.smallFontSize).width + 20);
      const catBoxH = 26;
      elements.push(
        p.rect(
          { x: ribStartX - catTextW / 2, y: ribStartY - catBoxH, width: catTextW, height: catBoxH },
          palette.surface,
          palette.border,
          1.5,
          { rx: 4 },
        ),
      );
      elements.push(
        p.text(
          cat.name,
          ribStartX,
          ribStartY - catBoxH / 2 + typography.smallFontSize * 0.35,
          typography.smallFontSize,
          palette.text,
          { weight: 'bold', anchor: 'middle' },
        ),
      );

      // Causes along rib
      const numCauses = cat.causes.length;
      for (let cIdx = 0; cIdx < numCauses; cIdx++) {
        const t = (cIdx + 1) / (numCauses + 1);
        const ribPtX = ribStartX + (spineAttachX - ribStartX) * t;
        const ribPtY = ribStartY + (spineY - ribStartY) * t;
        const branchW = 100;
        const branchEndX = ribPtX - branchW;

        // Horizontal branch line
        elements.push(
          p.path(`M ${branchEndX} ${ribPtY} L ${ribPtX} ${ribPtY}`, palette.border, 1.2),
        );
        // Cause label
        elements.push(
          p.text(
            cat.causes[cIdx]!.label,
            branchEndX + 4,
            ribPtY - 4,
            typography.smallFontSize - 1,
            palette.textMuted,
          ),
        );
      }
    }

    // Bottom Category
    if (pairIdx < botCats.length) {
      const cat = botCats[pairIdx]!;
      const ribStartX = spineAttachX - 100;
      const ribStartY = spineY + 200;

      // Diagonal rib line
      elements.push(
        p.path(`M ${ribStartX} ${ribStartY} L ${spineAttachX} ${spineY}`, palette.border, 2),
      );

      // Category Header Box
      const catTextW = Math.max(90, measureText(cat.name, typography.smallFontSize).width + 20);
      const catBoxH = 26;
      elements.push(
        p.rect(
          { x: ribStartX - catTextW / 2, y: ribStartY, width: catTextW, height: catBoxH },
          palette.surface,
          palette.border,
          1.5,
          { rx: 4 },
        ),
      );
      elements.push(
        p.text(
          cat.name,
          ribStartX,
          ribStartY + catBoxH / 2 + typography.smallFontSize * 0.35,
          typography.smallFontSize,
          palette.text,
          { weight: 'bold', anchor: 'middle' },
        ),
      );

      // Causes along rib
      const numCauses = cat.causes.length;
      for (let cIdx = 0; cIdx < numCauses; cIdx++) {
        const t = (cIdx + 1) / (numCauses + 1);
        const ribPtX = ribStartX + (spineAttachX - ribStartX) * t;
        const ribPtY = ribStartY + (spineY - ribStartY) * t;
        const branchW = 100;
        const branchEndX = ribPtX - branchW;

        // Horizontal branch line
        elements.push(
          p.path(`M ${branchEndX} ${ribPtY} L ${ribPtX} ${ribPtY}`, palette.border, 1.2),
        );
        // Cause label
        elements.push(
          p.text(
            cat.causes[cIdx]!.label,
            branchEndX + 4,
            ribPtY - 4,
            typography.smallFontSize - 1,
            palette.textMuted,
          ),
        );
      }
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
