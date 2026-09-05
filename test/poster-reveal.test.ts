import { describe, expect, it } from 'vitest';
import { compileAndRenderSync } from '../src/frontend/index.js';

describe('poster child reveals', () => {
  const cells = 'poster "Delivery"\n  columns 2\n  cell left\n    list\n    style process\n    - Author\n    - Present\n  end\n  cell right\n    list\n    style process\n    - Record\n    - Publish\n  end\n';

  it.each(['', '  link left.item-0 --> right.item-0 "handoff"\n'])(
    'composes child tracks with unique namespaced IDs and preserves links: %s', suffix => {
      const result = compileAndRenderSync(cells + suffix);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.reveal?.steps.map(step => step.index)).toEqual([1, 2, 3, 4]);
      const groups = result.value.reveal?.steps.flatMap(step => step.enter) ?? [];
      expect(groups).toEqual(['left.item-0', 'left.item-1', 'right.item-0', 'right.item-1']);
      for (const id of groups) expect(result.value.svg.split(`id="${id}"`)).toHaveLength(2);
      expect(result.value.svg).not.toContain('id="item-0"');
      if (suffix) expect(result.value.svg).toContain('handoff');
    },
  );

  it('preserves grouped steps and leaves static diagrams reveal-free', () => {
    const grouped = compileAndRenderSync(cells.replaceAll('style process', 'style process\n    group 2'));
    expect(grouped.ok).toBe(true);
    if (grouped.ok) expect(grouped.value.reveal?.steps.map(step => step.enter.length)).toEqual([2, 2]);
    const staticResult = compileAndRenderSync(cells.replaceAll('style process', 'style process\n    reveal none'));
    expect(staticResult.ok).toBe(true);
    if (staticResult.ok) expect(staticResult.value.reveal).toBeUndefined();
  });
});