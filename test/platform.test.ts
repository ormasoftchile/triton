import { describe, expect, it } from 'vitest';
import { parsePlatform } from '../src/diagrams/triton/platform/parser.js';
import { layoutPlatform } from '../src/diagrams/triton/platform/layout.js';
import { lintPlatform } from '../src/diagrams/triton/platform/lint.js';
import { defaultTheme } from '../src/theme/preset.js';
import { renderSync, lintDiagram } from '../src/frontend/index.js';

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

  it('renders multi-to-multi dual-rail bus with gathering trunk, bridge, and distribution trunk', () => {
    const multiToMulti = `
platform "Dual-Rail Mesh"
  legend
    square token "Data Token" #3b82f6
  end

  tier sources "PRODUCERS"
    card s1 "Ingest A"
    card s2 "Ingest B"
  end

  tier targets "CONSUMERS"
    card t1 "Indexing 1"
    card t2 "Indexing 2"
    card t3 "Indexing 3"
  end

  bus s1, s2 -->|"Dual Rail Bridge"| t1, t2, t3 @anim:flow
`;
    const doc = parsePlatform(multiToMulti);
    const layout = layoutPlatform(doc);
    expect(layout.scene.elements.length).toBeGreaterThan(10);

    // Verify SVG renders properly
    const res = renderSync(multiToMulti);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value).toContain('Dual Rail Bridge');
    expect(res.value).toContain('Ingest A');
    expect(res.value).toContain('Indexing 3');
  });

  it('routes tier-skipping buses around intermediate tier obstacles', () => {
    const tierSkip = `
platform "Tier Skipping Architecture"
  tier edge "CLIENTS"
    card client "Edge Client"
  end

  tier middle "PROCESSING CORE"
    card p1 "Processor A"
    card p2 "Processor B"
  end

  tier sink "STORAGE"
    card db "Database"
  end

  bus client --> db @anim:stream
`;
    const doc = parsePlatform(tierSkip);
    const layout = layoutPlatform(doc);

    // Obstacle bypass path should be generated
    const bypassPath = layout.scene.elements.find(
      (el) => el.type === 'path' && el.d && el.d.includes('Q') && el.d.split('Q').length >= 4,
    );
    expect(bypassPath).toBeDefined();

    const res = renderSync(tierSkip);
    expect(res.ok).toBe(true);
  });

  it('dynamically spaces legend items for long descriptive labels', () => {
    const longLegend = `
platform "Legend Spacing Test"
  legend
    square l1 "Phase 1: Local Scope Infrastructure" #3b82f6
    circle l2 "Invariant Guarantee" #10b981
  end

  tier t "TIER"
    card c "Card"
  end
`;
    const doc = parsePlatform(longLegend);
    const { scene } = layoutPlatform(doc);

    const textElements = scene.elements.filter(
      (el) =>
        el.type === 'text' && (el.content.includes('Phase 1') || el.content.includes('Invariant')),
    );
    expect(textElements).toHaveLength(2);
    const t1 = textElements[0]!;
    const t2 = textElements[1]!;

    // Distance between labels should be dynamic (> 180px for long label) rather than fixed 130px
    const deltaX = t2.position.x - t1.position.x;
    expect(deltaX).toBeGreaterThan(180);
  });

  it('routes same-tier vertical downstream branch along the right margin', () => {
    const verticalBranch = `
platform "Vertical Fan-Out"
  tier col "SERVICES"
    card parent "Parent Service"
    card child1 "Child One"
    card child2 "Child Two"
  end

  bus parent --> child1, child2
`;
    const doc = parsePlatform(verticalBranch);
    const { scene } = layoutPlatform(doc);

    // Verify paths route cleanly
    expect(scene.elements.filter((el) => el.type === 'path').length).toBeGreaterThanOrEqual(2);
    const res = renderSync(verticalBranch);
    expect(res.ok).toBe(true);
  });

  it('lintPlatform detects unmatched bus endpoints with error severity', () => {
    const typoDiag = `
platform "Typo Test"
  tier edge "CLIENTS"
    card app "App"
  end

  tier core "BACKEND"
    card srv "Service"
  end

  bus app --> typoEndpoint
`;
    const doc = parsePlatform(typoDiag);
    const diagnostics = lintPlatform(doc);

    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors.length).toBeGreaterThanOrEqual(1);
    expect(errors[0]!.rule).toBe('unmatched-bus-endpoint');
    expect(errors[0]!.nodeOrBusId).toBe('typoEndpoint');
  });

  it('lintPlatform detects dangling nodes with warning severity', () => {
    const danglingDiag = `
platform "Dangling Node Test"
  tier edge "CLIENTS"
    card app "App"
    card unused "Unused Card"
  end

  tier core "BACKEND"
    card srv "Service"
  end

  bus app --> srv
`;
    const doc = parsePlatform(danglingDiag);
    const diagnostics = lintPlatform(doc);

    const warnings = diagnostics.filter((d) => d.severity === 'warning');
    const dangling = warnings.find((w) => w.nodeOrBusId === 'unused');
    expect(dangling).toBeDefined();
    expect(dangling!.rule).toBe('dangling-node');
  });

  it('lintDiagram compiles and returns 0 errors for fully connected platform diagrams', () => {
    const validDiag = `
platform "Valid Connected Diagram"
  tier edge "CLIENTS"
    card app "App"
  end

  tier core "BACKEND"
    card srv "Service"
  end

  bus edge --> core
`;
    const diagnostics = lintDiagram(validDiag);
    const errors = diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});
