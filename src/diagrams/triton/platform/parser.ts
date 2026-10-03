import type {
  PlatformDocument,
  PlatformTier,
  PlatformBox,
  PlatformCard,
  PlatformGrid,
  PlatformBranch,
  PlatformLegendItem,
  PlatformBus,
} from './ir.js';
import { extractFrontmatter } from '../../../frontend/frontmatter.js';

function stripQuotes(str: string): string {
  return str.replace(/^["']|["']$/g, '').trim();
}

function parseCardLine(line: string): PlatformCard | null {
  // card id "Title" ["Subtitle"] [@icon:name]
  const cardMatch = line.match(/^card\s+([\w-]+)\s+(.+)$/i);
  if (!cardMatch) return null;

  const id = cardMatch[1]!;
  let rest = cardMatch[2]!.trim();

  let icon: string | undefined;
  const iconMatch = rest.match(/@icon:([\w:-]+)/i);
  if (iconMatch) {
    icon = iconMatch[1];
    rest = rest.replace(/@icon:[\w:-]+/i, '').trim();
  }

  // Look for quoted strings
  const quoted = [...rest.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? '');

  let title = '';
  let subtitle: string | undefined;

  if (quoted.length >= 2) {
    title = quoted[0]!;
    subtitle = quoted[1]!;
  } else if (quoted.length === 1) {
    title = quoted[0]!;
    // Check if there is an unquoted bracket [Subtitle]
    const bracketMatch = rest.match(/\[([^\]]+)\]/);
    if (bracketMatch) {
      subtitle = bracketMatch[1]!.trim();
    }
  } else {
    // No quotes, split on space or brackets
    const bracketMatch = rest.match(/^([^[]+)\[([^\]]+)\]/);
    if (bracketMatch) {
      title = bracketMatch[1]!.trim();
      subtitle = bracketMatch[2]!.trim();
    } else {
      title = rest;
    }
  }

  return {
    id,
    title: stripQuotes(title),
    ...(subtitle ? { subtitle: stripQuotes(subtitle) } : {}),
    ...(icon ? { icon } : {}),
  };
}

export function parsePlatform(input: string): PlatformDocument {
  const { metadata, body } = extractFrontmatter(input);
  const lines = body.split(/\r?\n/);

  let title = typeof metadata.title === 'string' ? metadata.title : undefined;
  let figure: string | undefined;
  let desc: string | undefined;
  const legend: PlatformLegendItem[] = [];
  const tiers: PlatformTier[] = [];
  const buses: PlatformBus[] = [];

  // State stack for nested parsing
  type State =
    | { type: 'root' }
    | { type: 'legend' }
    | { type: 'tier'; tier: PlatformTier; items: (PlatformCard | PlatformBox)[] }
    | {
        type: 'box';
        box: PlatformBox;
        cards: PlatformCard[];
        inGrid?: PlatformCard[];
        inBranch?: PlatformCard[];
        gridCols?: number;
      }
    | { type: 'grid'; cols: number; cards: PlatformCard[] }
    | { type: 'branch'; cards: PlatformCard[] };

  const stack: State[] = [{ type: 'root' }];

  for (const rawLine of lines) {
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('%%') || trimmed.startsWith('#')) {
      continue;
    }

    const current = stack[stack.length - 1]!;

    // Header: platform "Title"
    const headerMatch = trimmed.match(/^platform(?:\s*::\s*|\s+)(.+)$/i);
    if (headerMatch && !title) {
      title = stripQuotes(headerMatch[1]!.trim());
      continue;
    }
    if (/^platform$/i.test(trimmed)) {
      continue;
    }

    // End statement
    if (/^end\b/i.test(trimmed)) {
      if (current.type === 'legend') {
        stack.pop();
      } else if (current.type === 'grid') {
        stack.pop();
        const parent = stack[stack.length - 1]!;
        if (parent.type === 'box') {
          (parent as any).grid = { columns: current.cols, cards: current.cards };
        }
      } else if (current.type === 'branch') {
        stack.pop();
        const parent = stack[stack.length - 1]!;
        if (parent.type === 'box') {
          (parent as any).branch = { cards: current.cards };
        }
      } else if (current.type === 'box') {
        stack.pop();
        const parent = stack[stack.length - 1]!;
        if (parent.type === 'tier') {
          const finalBox: PlatformBox = {
            ...current.box,
            ...(current.cards.length > 0 ? { cards: current.cards } : {}),
            ...((current as any).grid ? { grid: (current as any).grid } : {}),
            ...((current as any).branch ? { branch: (current as any).branch } : {}),
          };
          parent.items.push(finalBox);
        }
      } else if (current.type === 'tier') {
        stack.pop();
        tiers.push({
          ...current.tier,
          items: current.items,
        });
      }
      continue;
    }

    // Top-level metadata
    if (current.type === 'root') {
      const figMatch = trimmed.match(/^figure\s+(.+)$/i);
      if (figMatch) {
        figure = stripQuotes(figMatch[1]!.trim());
        continue;
      }

      const descMatch = trimmed.match(/^desc(?:ription)?\s+(.+)$/i);
      if (descMatch) {
        desc = stripQuotes(descMatch[1]!.trim());
        continue;
      }

      if (/^legend\b/i.test(trimmed)) {
        stack.push({ type: 'legend' });
        continue;
      }

      // Tier: tier id "Title"
      const tierMatch = trimmed.match(/^tier\s+([\w-]+)\s+(.+)$/i);
      if (tierMatch) {
        const id = tierMatch[1]!;
        const tierTitle = stripQuotes(tierMatch[2]!.trim());
        const newTier: PlatformTier = { id, title: tierTitle, items: [] };
        stack.push({ type: 'tier', tier: newTier, items: [] });
        continue;
      }

      // Bus declaration: bus from --> to1, to2 [@anim:stream] [@shape:diamond]
      const busMatch = trimmed.match(/^bus\s+([\w.-]+)\s*(-->|==>|->)\s*(.+)$/i);
      if (busMatch) {
        const from = busMatch[1]!.trim();
        let rest = busMatch[3]!.trim();

        let animation: PlatformBus['animation'];
        const animMatch = rest.match(/@anim:(\w+)/i);
        if (animMatch) {
          animation = animMatch[1] as PlatformBus['animation'];
          rest = rest.replace(/@anim:\w+/i, '').trim();
        }

        let tokenShape: PlatformBus['tokenShape'];
        const shapeMatch = rest.match(/@shape:(\w+)/i);
        if (shapeMatch) {
          tokenShape = shapeMatch[1] as PlatformBus['tokenShape'];
          rest = rest.replace(/@shape:\w+/i, '').trim();
        }

        let tokenColor: string | undefined;
        const colorMatch = rest.match(/@color:([#\w]+)/i);
        if (colorMatch) {
          tokenColor = colorMatch[1];
          rest = rest.replace(/@color:[#\w]+/i, '').trim();
        }

        const toList = rest
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);

        buses.push({
          from,
          to: toList,
          ...(animation ? { animation } : {}),
          ...(tokenShape ? { tokenShape } : {}),
          ...(tokenColor ? { tokenColor } : {}),
        });
        continue;
      }
    }

    // Inside legend
    if (current.type === 'legend') {
      const legMatch = trimmed.match(/^(square|circle|diamond)\s+([\w-]+)\s+(.+)$/i);
      if (legMatch) {
        const shape = legMatch[1]!.toLowerCase() as 'square' | 'circle' | 'diamond';
        const key = legMatch[2]!;
        const legRest = legMatch[3]!.trim();
        const parts = legRest.match(/"([^"]+)"|'([^']+)'|(\S+)/g)?.map((s) => stripQuotes(s)) ?? [];
        const label = parts[0] ?? key;
        const color =
          parts[1] ?? (shape === 'square' ? '#3b82f6' : shape === 'circle' ? '#10b981' : '#8b5cf6');
        legend.push({ key, label, shape, color });
        continue;
      }
    }

    // Inside tier
    if (current.type === 'tier') {
      // Box: box id "Title" ["Subtitle"] [@dock:bottom]
      const boxMatch = trimmed.match(/^box\s+([\w-]+)\s+(.+)$/i);
      if (boxMatch) {
        const id = boxMatch[1]!;
        let rest = boxMatch[2]!.trim();

        let dock: 'top' | 'bottom' | undefined;
        const dockMatch = rest.match(/@dock:(top|bottom)/i);
        if (dockMatch) {
          dock = dockMatch[1]!.toLowerCase() as 'top' | 'bottom';
          rest = rest.replace(/@dock:(top|bottom)/i, '').trim();
        }

        const quoted = [...rest.matchAll(/"([^"]*)"|'([^']*)'/g)].map((m) => m[1] ?? m[2] ?? '');

        let boxTitle = '';
        let subtitle: string | undefined;
        if (quoted.length >= 2) {
          boxTitle = quoted[0]!;
          subtitle = quoted[1]!;
        } else if (quoted.length === 1) {
          boxTitle = quoted[0]!;
          const bracketMatch = rest.match(/\[([^\]]+)\]/);
          if (bracketMatch) subtitle = bracketMatch[1]!.trim();
        } else {
          boxTitle = rest;
        }

        const newBox: PlatformBox = {
          id,
          title: stripQuotes(boxTitle),
          ...(subtitle ? { subtitle: stripQuotes(subtitle) } : {}),
          ...(dock ? { dock } : {}),
        };

        stack.push({ type: 'box', box: newBox, cards: [] });
        continue;
      }

      // Card inside tier
      const card = parseCardLine(trimmed);
      if (card) {
        current.items.push(card);
        continue;
      }
    }

    // Inside box
    if (current.type === 'box') {
      // grid <cols>
      const gridMatch = trimmed.match(/^grid(?:\s+(\d+))?/i);
      if (gridMatch) {
        const cols = gridMatch[1] ? parseInt(gridMatch[1], 10) : 3;
        stack.push({ type: 'grid', cols, cards: [] });
        continue;
      }

      // branch
      if (/^branch\b/i.test(trimmed)) {
        stack.push({ type: 'branch', cards: [] });
        continue;
      }

      // direct card inside box (e.g. routing spanning the bottom)
      const card = parseCardLine(trimmed);
      if (card) {
        current.cards.push(card);
        continue;
      }
    }

    // Inside grid
    if (current.type === 'grid') {
      const card = parseCardLine(trimmed);
      if (card) {
        current.cards.push(card);
        continue;
      }
    }

    // Inside branch
    if (current.type === 'branch') {
      const card = parseCardLine(trimmed);
      if (card) {
        current.cards.push(card);
        continue;
      }
    }
  }

  return {
    version: '1',
    metadata: { ...metadata, ...(title ? { title } : {}) },
    ...(figure ? { figure } : {}),
    ...(title ? { title } : {}),
    ...(desc ? { desc } : {}),
    ...(legend.length > 0 ? { legend } : {}),
    tiers,
    buses,
  };
}
