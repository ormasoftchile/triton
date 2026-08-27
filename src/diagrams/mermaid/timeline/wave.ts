/**
 * @file diagrams/timeline/wave.ts — Wave / Undulating-Ribbon infographic timeline.
 *
 * A continuous, organic sinusoidal wave ribbon with alternating peaks and
 * valleys. Each node is an organic teardrop/map-pin merged seamlessly into the
 * ribbon, containing an inner white medallion with an icon glyph or step index.
 * The ribbon and pins transition through a multi-hue spectral gradient.
 *
 * Deterministic; no clock; full theme and overlay support.
 */

import type { TimelineDocument } from "./ir.js";
import type { Scene, SceneElement, LayoutResult, LayoutOptions, Color } from "../../../contracts/index.js";
import type { ResolvedTheme } from "../../../contracts/index.js";
import { pen } from "../../../scene/build.js";
import { applyOverlays } from "../../../overlay/apply.js";
import { wrapText } from "../../../text/wrap.js";
import { formatDate } from "../../../time/dates.js";
import { collectEntries, statusColor, type TimelineEntry } from "./shared.js";
import { rhu, rhuInt } from "../../../util/round.js";
import { relativeLuminance } from "../../../theme/contrast.js";
import { parseIconRef, resolveIcon } from "../../../icons/resolver.js";

const SPECTRAL_PALETTE: readonly Color[] = [
  "#00C49F", // Teal
  "#82CA9D", // Lime
  "#FFBB28", // Yellow / Warm Gold
  "#FF8042", // Orange
  "#FF4877", // Magenta / Pink
  "#A855F7", // Purple
  "#3B82F6", // Blue
  "#06B6D4", // Cyan
];

const LIGHT_PALETTE: readonly Color[] = [
  "#0284C7", // Sky Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#F59E0B", // Amber
  "#10B981", // Emerald
  "#14B8A6", // Teal
];

function resolveNodeColor(
  i: number,
  n: number,
  theme: ResolvedTheme,
  entry: TimelineEntry,
): Color {
  if (entry.status && entry.status !== "default") {
    return statusColor(theme.palette, entry.status);
  }
  const isMono =
    theme.name === "minimal" ||
    theme.name.startsWith("bw-") ||
    theme.name === "executive";
  if (isMono) {
    return i % 2 === 0 ? theme.palette.primary : theme.palette.secondary;
  }
  const lum = relativeLuminance(theme.palette.background);
  const isDark = lum !== undefined ? lum < 0.5 : false;
  const base = isDark ? SPECTRAL_PALETTE : LIGHT_PALETTE;
  return base[i % base.length]!;
}

function valleyPinPath(cx: number, cy: number, r: number, cusp: number): string {
  const tipY = cy + r + cusp;
  return `M ${rhu(cx - r)} ${rhu(cy)} A ${r} ${r} 0 1 1 ${rhu(cx + r)} ${rhu(cy)} Q ${rhu(cx + r * 0.85)} ${rhu(cy + r * 0.65)} ${rhu(cx)} ${rhu(tipY)} Q ${rhu(cx - r * 0.85)} ${rhu(cy + r * 0.65)} ${rhu(cx - r)} ${rhu(cy)} Z`;
}

function peakPinPath(cx: number, cy: number, r: number): string {
  return `M ${rhu(cx - r)} ${rhu(cy)} A ${r} ${r} 0 1 1 ${rhu(cx + r)} ${rhu(cy)} A ${r} ${r} 0 1 1 ${rhu(cx - r)} ${rhu(cy)} Z`;
}

export function layoutWave(
  ir: TimelineDocument,
  theme: ResolvedTheme,
  options?: LayoutOptions,
): LayoutResult {
  const { palette, typography, spacing } = theme;
  const p = pen(theme);
  const margin = spacing.diagramMargin + 20;
  const elements: SceneElement[] = [];

  const entries = collectEntries(ir);
  const n = Math.max(entries.length, 1);

  // ── Geometry Constants ──────────────────────────────────────────────────────
  const circleR = 26;
  const innerR = 17;
  const pinCusp = 14;
  const ribbonWidth = 26;
  const amplitude = 38;
  const pitch = Math.max(160, rhuInt(typography.baseFontSize * 12));
  const innerW = pitch - 20;

  const titleFont = typography.baseFontSize;
  const titleLH = rhuInt(titleFont * 1.3);
  const dateFont = typography.smallFontSize;
  const dateLH = rhuInt(dateFont * 1.3);

  // Precompute colors for each node
  const colors: Color[] = entries.map((e, i) => resolveNodeColor(i, n, theme, e));

  // Precompute labels and height needs
  const placed = entries.map((e) => {
    const isSyntheticDate =
      /^(?:date-|step-|activity-|milestone-|\d+$)/i.test(e.date) || e.ord === 0;
    const dateStr = !isSyntheticDate ? formatDate(e.date, 'axis') : undefined;
    const titleLines = wrapText(e.label, titleFont, innerW, 2).lines;
    const descLines = e.description ? wrapText(e.description, dateFont, innerW, 2).lines : [];
    return {
      ...e,
      dateStr,
      titleLines,
      descLines,
    };
  });

  const maxTitleLines = Math.max(1, ...placed.map((e) => e.titleLines.length));
  const maxDescLines = Math.max(0, ...placed.map((e) => e.descLines.length));
  const hasDates = placed.some((e) => e.dateStr !== undefined);

  const labelStackH =
    (hasDates ? dateLH + 4 : 0) +
    maxTitleLines * titleLH +
    (maxDescLines > 0 ? maxDescLines * dateLH + 4 : 0);

  // Header geometry
  const subtitle = typeof ir.metadata.subtitle === "string" ? ir.metadata.subtitle : undefined;
  const title = ir.metadata.title;
  const headerH = title
    ? typography.titleFontSize + 8 + (subtitle ? typography.baseFontSize + 8 : 0) + 28
    : 0;

  // Vertical anchors
  const y_center = margin + headerH + circleR + amplitude;
  const y_peak = y_center - amplitude;
  const y_valley = y_center + amplitude;

  const leftX = margin + circleR + 10;
  const nodeX = (i: number): number => leftX + i * pitch;
  const nodeY = (i: number): number => (i % 2 === 0 ? y_valley : y_peak);

  const totalW = rhuInt(nodeX(n - 1) + circleR + margin + 16);
  const labelTopY = y_valley + circleR + pinCusp + 22;
  const totalH = rhuInt(labelTopY + labelStackH + margin);

  // ── 1. Header (Title & Subtitle) ───────────────────────────────────────────
  if (title) {
    const titleY = margin + typography.titleFontSize;
    elements.push(
      p.text(title, totalW / 2, titleY, typography.titleFontSize + 6, palette.text, {
        anchor: "middle",
        weight: "bold",
      }),
    );
    if (subtitle) {
      elements.push(
        p.text(subtitle, totalW / 2, titleY + typography.baseFontSize + 10, typography.baseFontSize, palette.textMuted, {
          anchor: "middle",
        }),
      );
    }
  }

  // Node coordinate array
  const pts: { x: number; y: number }[] = Array.from({ length: n }, (_, i) => ({
    x: nodeX(i),
    y: nodeY(i),
  }));

  // ── 2. Continuous Wave Ribbon ──────────────────────────────────────────────
  const defs: string[] = [];
  if (n > 1) {
    const gradId = "triton-wave-ribbon-grad";
    const stops = colors
      .map((c, idx) => {
        const pct = rhu((idx / (n - 1)) * 100);
        return `<stop offset="${pct}%" stop-color="${c}" />`;
      })
      .join("");
    defs.push(
      `<linearGradient id="${gradId}" gradientUnits="userSpaceOnUse" x1="${rhu(pts[0]!.x)}" y1="0" x2="${rhu(pts[n - 1]!.x)}" y2="0">${stops}</linearGradient>`,
    );

    let d = `M ${rhu(pts[0]!.x)} ${rhu(pts[0]!.y)}`;
    for (let i = 0; i < n - 1; i++) {
      const p0 = pts[i]!;
      const p1 = pts[i + 1]!;
      const dx = p1.x - p0.x;
      const cp1x = rhu(p0.x + dx * 0.5);
      const cp1y = rhu(p0.y);
      const cp2x = rhu(p1.x - dx * 0.5);
      const cp2y = rhu(p1.y);
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${rhu(p1.x)} ${rhu(p1.y)}`;
    }

    elements.push(
      p.path(d, `url(#${gradId})`, ribbonWidth),
    );
  }

  // ── 3. Pins, Inner Medallions, Glyphs, and Labels ───────────────────────────
  const anchors: Record<string, { bounds: { x: number; y: number; width: number; height: number } }> = {};

  for (let i = 0; i < n; i++) {
    const pt = pts[i]!;
    const color = colors[i]!;
    const entry = placed[i]!;
    const isValley = i % 2 === 0;

    // Teardrop / Disc Pin Shape
    const pinD = isValley
      ? valleyPinPath(pt.x, pt.y, circleR, pinCusp)
      : peakPinPath(pt.x, pt.y, circleR);

    elements.push(p.path(pinD, color, 1, { fill: color }));

    // Inner White Medallion Disc
    elements.push(p.circle({ x: pt.x, y: pt.y }, innerR, "#FFFFFF", "#FFFFFF", 0));

    // Glyph / Icon / Step Number inside Medallion
    let renderedIcon = false;
    if (entry.icon && options?.icons) {
      const ref = parseIconRef(entry.icon);
      if (ref.ok) {
        const resolved = resolveIcon(ref.value, options.icons);
        if (resolved.ok) {
          const iconSize = 18;
          elements.push(
            p.icon(resolved.value, rhu(pt.x - iconSize / 2), rhu(pt.y - iconSize / 2), iconSize),
          );
          renderedIcon = true;
        }
      }
    }

    if (!renderedIcon) {
      const stepNumber = String(i + 1).padStart(2, "0");
      elements.push(
        p.text(stepNumber, pt.x, pt.y + 4.5, 12, "#1E293B", {
          anchor: "middle",
          weight: "bold",
        }),
      );
    }

    // Node Labels (placed below the wave ribbon)
    let curY = labelTopY;

    if (entry.dateStr) {
      elements.push(
        p.text(entry.dateStr, pt.x, curY, dateFont, palette.textMuted, {
          anchor: "middle",
        }),
      );
      curY += dateLH + 2;
    }

    for (let li = 0; li < entry.titleLines.length; li++) {
      const lineText = entry.titleLines[li] ?? "";
      elements.push(
        p.text(lineText, pt.x, curY + li * titleLH, titleFont, palette.text, {
          anchor: "middle",
          weight: "bold",
        }),
      );
    }
    curY += entry.titleLines.length * titleLH;

    for (let li = 0; li < entry.descLines.length; li++) {
      const lineText = entry.descLines[li] ?? "";
      elements.push(
        p.text(lineText, pt.x, curY + li * dateLH, dateFont, palette.textMuted, {
          anchor: "middle",
        }),
      );
    }

    // Anchor registry
    anchors[entry.id] = {
      bounds: {
        x: pt.x - circleR,
        y: pt.y - circleR,
        width: circleR * 2,
        height: isValley ? circleR * 2 + pinCusp : circleR * 2,
      },
    };
  }

  // ── 4. Overlays & Final Scene ──────────────────────────────────────────────
  const baseScene: Scene = {
    viewBox: { x: 0, y: 0, width: totalW, height: totalH },
    background: palette.background,
    elements,
    ...(defs.length > 0 ? { defs } : {}),
  };

  const finalScene = applyOverlays(baseScene, (ir as any).overlays, theme);

  return { scene: finalScene, anchors };
}
