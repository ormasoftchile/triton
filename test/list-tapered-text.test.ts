import { describe, expect, it } from 'vitest';
import { compileSync } from '../src/frontend/index.js';
import { resolveThemeFamily } from '../src/theme/family.js';
import type { SceneGroup, ScenePath, SceneText } from '../src/contracts/index.js';
import { measureText } from '../src/text/metrics.js';

const examples = [
  '- Review the actions\n- Trust the workspace\n- Inspect the result',
  '- Review the actions :: Check commands before running\n- Trust the workspace\n- Inspect the result',
  '- First line<br/>Second line\n- Middle\n- Last line\\nAnother line',
  '- Supercalifragilisticexpialidocious\n- Other\n- Final',
  '- Single band',
  Array.from({ length: 8 }, (_, index) => `- Stage ${index + 1} has a descriptive label`).join('\n'),
];

describe('tapered list text containment', () => {
  for (const style of ['pyramid', 'funnel']) {
    for (const mode of ['light', 'dark'] as const) {
      it.each(examples)(`${style}/${mode} keeps every line within the sloped sides: %s`, items => {
        const theme = resolveThemeFamily('default', mode).theme;
        const result = compileSync(`list\nstyle ${style}\nreveal sequence\n${items}\n`, theme);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        const groups = result.value.scene.elements.filter((element): element is SceneGroup => element.type === 'group');
        expect(groups.length).toBe(items.split('\n').filter(line => line.startsWith('- ')).length);
        for (const [index, group] of groups.entries()) {
          const band = group.children.find((element): element is ScenePath => element.type === 'path');
          expect(band).toBeDefined();
          const coordinates = band!.d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
          const [topLeft, top, topRight, , bottomRight, bottom, bottomLeft] = coordinates;
          const labels = group.children.filter((element): element is SceneText => element.type === 'text');
          expect(labels.length).toBeGreaterThan(0);
          const sourceText = items.split('\n')[index]!.slice(2)
            .replace(/::|<br\s*\/?>|\\n/gi, '').replace(/\s+/g, '');
          expect(labels.map(label => label.content).join('').replace(/\s+/g, '')).toBe(sourceText);
          for (const label of labels) {
            const halfWidth = measureText(label.content, label.fontSize).width / 2;
            for (const textY of [label.position.y - label.fontSize, label.position.y + label.fontSize * 0.25]) {
              expect(textY).toBeGreaterThanOrEqual(top!);
              expect(textY).toBeLessThanOrEqual(bottom!);
              const fraction = (textY - top!) / (bottom! - top!);
              const left = topLeft! + (bottomLeft! - topLeft!) * fraction;
              const right = topRight! + (bottomRight! - topRight!) * fraction;
              expect(label.position.x - halfWidth, label.content).toBeGreaterThanOrEqual(left + 4);
              expect(label.position.x + halfWidth, label.content).toBeLessThanOrEqual(right - 4);
            }
            expect([theme.typography.baseFontSize, theme.typography.smallFontSize]).toContain(label.fontSize);
          }
        }
        expect(result.value.reveal?.steps.length).toBe(groups.length);
      });
    }
  }
});