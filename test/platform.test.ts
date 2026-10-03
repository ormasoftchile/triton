import { describe, expect, it } from 'vitest';
import { parsePlatform } from '../src/diagrams/triton/platform/parser.js';
import { layoutPlatform } from '../src/diagrams/triton/platform/layout.js';
import { defaultTheme } from '../src/theme/preset.js';
import { renderSync } from '../src/frontend/index.js';

describe('platform diagram module', () => {
  const sample = `
platform "Online storage platform"
  figure "FIGURE 01 · WHAT IS HABITAT?"
  desc "Habitat is the online storage platform we built so OpenAI products can quickly and reliably access needed information."

  legend
    square request "Request" #3b82f6
    circle response "Response" #10b981
    diamond cdc "Changes (CDC)" #8b5cf6
  end

  tier clients "CLIENTS"
    card chatgpt "ChatGPT" @icon:openai
    card api "API" @icon:api
  end

  tier platform "ONLINE STORAGE PLATFORM"
    box habitat "Habitat"
      grid 2
        card caching "Caching" [Caches]
        card acl "ACL policies" [Authorization]
      end
      card routing "Routing" [Schema lookup]
    end

    box cdc "CDC Services" [Change Data Capture]
      branch
        card databricks "Databricks" @icon:databricks
        card kafka "Kafka" @icon:kafka
      end
    end
  end

  tier storage "STORAGE RESOURCES"
    card cosmos "Azure Cosmos DB" [Online storage] @icon:database
    card valkey "Valkey" [Caches] @icon:lightning
  end

  bus clients --> habitat.routing @anim:stream
  bus habitat.routing --> storage @anim:stream
  bus habitat.routing --> cdc @anim:particle
`;

  it('parses platform IR correctly', () => {
    const doc = parsePlatform(sample);
    expect(doc.title).toBe('Online storage platform');
    expect(doc.figure).toBe('FIGURE 01 · WHAT IS HABITAT?');
    expect(doc.legend).toHaveLength(3);
    expect(doc.tiers).toHaveLength(3);
    expect(doc.buses).toHaveLength(3);

    const platformTier = doc.tiers[1]!;
    expect(platformTier.items).toHaveLength(2);
  });

  it('generates a valid Scene and anchors via layoutPlatform', () => {
    const doc = parsePlatform(sample);
    const layout = layoutPlatform(doc, defaultTheme);
    expect(layout.scene.viewBox.width).toBeGreaterThan(1000);
    expect(layout.scene.viewBox.height).toBeGreaterThan(600);
    expect(layout.scene.elements.length).toBeGreaterThan(10);
    expect(layout.anchors['chatgpt']).toBeDefined();
    expect(layout.anchors['cosmos']).toBeDefined();
  });

  it('compiles end-to-end to SVG via renderSync', () => {
    const res = renderSync(sample);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('<svg');
    expect(res.value).toContain('Online storage platform');
    expect(res.value).toContain('id="platform-dots"');
  });
});
