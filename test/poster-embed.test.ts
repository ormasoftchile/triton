import { describe, it, expect } from 'vitest';
import { render } from '../src/frontend/index.js';

describe('poster embeds CS-structure panels with cross-links', () => {
  const src = [
    'poster "Engine"',
    '    columns 2',
    '',
    '    cell q "Plan" :: plan',
    '        plan',
    '            Hash Join',
    '                Seq Scan orders',
    '                Index Scan customers',
    '    end',
    '',
    '    cell a "Array" :: array',
    '        array 5 8 13',
    '    end',
    '',
    '    link q.n2 --> a.c0 "uses index"',
    '',
  ].join('\n');

  it('renders a poster with plan + array cells and a resolved cross-link', async () => {
    const r = await render(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('Plan');
    expect(r.value).toContain('Array');
    // operator + array content came from the embedded child diagrams
    expect(r.value).toContain('Index Scan customers');
    // the cross-link label only renders if q.n2 / a.c0 anchors resolved across cells
    expect(r.value).toContain('uses index');
  });

  it('renders cross-links to array bracket references', async () => {
    const src = [
      'poster "Engine"',
      '    columns 2',
      '',
      '    cell q "Plan" :: plan',
      '        plan',
      '            Hash Join',
      '                Seq Scan orders',
      '                Index Scan customers',
      '    end',
      '',
      '    cell a "Array" :: array',
      '        array 5 8 13',
      '    end',
      '',
      '    link q.n2 --> a[2] "positive index"',
      '    link q.n1 --> a[-1] "negative index"',
      '',
    ].join('\n');
    const r = await render(src);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toContain('positive index');
    expect(r.value).toContain('negative index');
  });
});
