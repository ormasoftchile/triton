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

  it('renders high-contrast styling in bw-dark theme', () => {
    const res = renderSync(sample, undefined, 'svg', 'bw-dark');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const svg = res.value;
    // Dark canvas background
    expect(svg).toContain('#171717');
    // Crisp white borders, titles, and bus lines
    expect(svg).toContain('#FAFAFA');
    // Card surface fill
    expect(svg).toContain('#262626');
  });

  it('renders high-contrast styling in bw-light theme', () => {
    const res = renderSync(sample, undefined, 'svg', 'bw-light');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const svg = res.value;
    // Light canvas background
    expect(svg).toContain('#FFFFFF');
    // Inverted routing bar with black fill and white text
    expect(svg).toContain('fill="#171717"');
    expect(svg).toContain('fill="#FFFFFF"');
  });

  it('renders generalized 2-tier architecture diagram', () => {
    const twoTier = `
platform "Microservice Gateway"
  tier edge "CLIENT APPS"
    card web "Web Portal"
    card ios "iOS App"
    card android "Android App"
  end

  tier services "BACKEND MESH"
    card gateway "API Gateway" [Kong Envoy]
    card auth "Auth Service"
    card orders "Orders Service"
  end

  bus edge --> gateway @anim:stream
  bus gateway --> auth, orders
`;
    const doc = parsePlatform(twoTier);
    expect(doc.tiers).toHaveLength(2);
    expect(doc.buses).toHaveLength(2);

    const res = renderSync(twoTier);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('Microservice Gateway');
    expect(res.value).toContain('CLIENT APPS');
    expect(res.value).toContain('BACKEND MESH');
  });

  it('renders generalized 4-tier data platform with multi-source bus', () => {
    const fourTier = `
platform "Data Ingestion Pipeline"
  tier producers "PRODUCERS"
    card sensors "IoT Telemetry"
    card clickstream "Web Clicks"
  end

  tier ingress "INGRESS"
    card kafka "Event Broker"
  end

  tier compute "STREAM PROCESSING"
    card flink "Apache Flink"
    card spark "Apache Spark"
  end

  tier sink "LAKEHOUSE"
    card iceberg "Apache Iceberg" [Data Lake]
    card snowflake "Snowflake" [Analytics]
  end

  bus producers --> kafka @anim:stream
  bus kafka --> flink, spark
  bus flink, spark --> iceberg, snowflake @anim:flow
`;
    const doc = parsePlatform(fourTier);
    expect(doc.tiers).toHaveLength(4);
    expect(doc.buses).toHaveLength(3);
    expect(Array.isArray(doc.buses[2]!.from)).toBe(true);
    expect(doc.buses[2]!.from).toEqual(['flink', 'spark']);

    const res = renderSync(fourTier);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('Data Ingestion Pipeline');
    expect(res.value).toContain('STREAM PROCESSING');
    expect(res.value).toContain('LAKEHOUSE');
  });

  it('parses and renders protocol labels on buses', () => {
    const labeled = `
platform "Service Mesh"
  tier edge "CLIENTS"
    card app "Mobile App"
  end

  tier mesh "SERVICES"
    card gw "API Gateway"
    card srv "User Service"
  end

  bus app -->|"HTTPS / TLS 1.3"| gw @anim:stream
  bus gw -->|"gRPC / Protobuf"| srv
`;
    const doc = parsePlatform(labeled);
    expect(doc.buses).toHaveLength(2);
    expect(doc.buses[0]!.label).toBe('HTTPS / TLS 1.3');
    expect(doc.buses[1]!.label).toBe('gRPC / Protobuf');

    const res = renderSync(labeled);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('HTTPS / TLS 1.3');
    expect(res.value).toContain('gRPC / Protobuf');
  });

  it('dynamically computes box height and expands canvas for 3-row capability grids', () => {
    const bigGrid = `
platform "Enterprise Gateway"
  tier core "CORE PLATFORM"
    box engine "Platform Engine"
      grid 3
        card c1 "Auth"
        card c2 "Rate Limit"
        card c3 "Cache"
        card c4 "Metrics"
        card c5 "Tracing"
        card c6 "Audit"
        card c7 "Encryption"
        card c8 "Validation"
        card c9 "Routing"
      end
      card egress "Egress Router" [Cross-region]
    end
  end
`;
    const doc = parsePlatform(bigGrid);
    expect(doc.tiers[0]!.items[0]).toBeDefined();

    const { scene } = layoutPlatform(doc);
    expect(scene.viewBox.height).toBeGreaterThanOrEqual(780);
    const engineBox = scene.elements.find(
      (el) => el.type === 'rect' && el.bounds && el.bounds.width === 660,
    );
    expect(engineBox).toBeDefined();
    // 3 rows = 3 * 56 + 2 * 10 = 188px grid height + header + routing bar (54) + padding > 300px
    expect(engineBox!.bounds.height).toBeGreaterThan(290);
  });
});
