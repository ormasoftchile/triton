import { describe, it, expect } from 'vitest';
import { renderSync } from '../src/index.js';

describe('Unified Formatted Text & Title :: Subtitle across diagram types', () => {
  it('renders Title :: Subtitle and breaks in mindmap', () => {
    const src = `mindmap
  root((Core System))
    Security :: OAuth2 & OIDC
    Database :: PostgreSQL Primary<br>Cluster Replica
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('Security');
    expect(svg).toContain('OAuth2 &amp; OIDC');
    expect(svg).toContain('Database');
    expect(svg).toContain('PostgreSQL Primary');
    expect(svg).toContain('Cluster Replica');
  });

  it('renders Title :: Subtitle and breaks in kanban', () => {
    const src = `kanban
  Todo
    TASK-101 :: Implement OAuth login
    TASK-102 :: Database migration<br>Run in staging first
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('TASK-101');
    expect(svg).toContain('Implement OAuth login');
    expect(svg).toContain('TASK-102');
    expect(svg).toContain('Database migration');
    expect(svg).toContain('Run in staging first');
  });

  it('renders Title :: Subtitle and breaks in architecture', () => {
    const src = `architecture-beta
  service api(server)[API Gateway :: Public Entrypoint]
  service db(database)[Postgres :: Primary Cluster<br>Read Replica]
  api:R -- L:db
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('API Gateway');
    expect(svg).toContain('Public Entrypoint');
    expect(svg).toContain('Postgres');
    expect(svg).toContain('Primary Cluster');
    expect(svg).toContain('Read Replica');
  });

  it('renders Title :: Subtitle and breaks in state diagram (state ... as and id : desc)', () => {
    const src = `stateDiagram-v2
  [*] --> Active
  state "Active State :: Processing incoming requests<br>Worker thread pool" as Active
  Active --> Processing
  Processing : Background Job :: Handling queue tasks<br>Retry on failure
  Processing --> [*]
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('Active State');
    expect(svg).toContain('Processing incoming requests');
    expect(svg).toContain('Worker thread pool');
    expect(svg).toContain('Background Job');
    expect(svg).toContain('Handling queue tasks');
    expect(svg).toContain('Retry on failure');
  });

  it('renders Title :: Subtitle and breaks in c4 diagram', () => {
    const src = `C4Context
  Person(user, "Branch User :: Support Staff", "Uses the banking portal")
  System(bank, "Core Banking :: Transaction Engine<br>v2.4", "Processes accounts")
  Rel(user, bank, "Uses", "HTTPS")
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('Branch User');
    expect(svg).toContain('Support Staff');
    expect(svg).toContain('Core Banking');
    expect(svg).toContain('Transaction Engine');
  });

  it('renders Title :: Subtitle and breaks in block diagram', () => {
    const src = `block-beta
  columns 2
  b1["Frontend Client :: Next.js Web App"]
  b2["API Backend :: GraphQL Gateway<br>v3.0"]
  b1 --> b2
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('Frontend Client');
    expect(svg).toContain('Next.js Web App');
    expect(svg).toContain('API Backend');
    expect(svg).toContain('GraphQL Gateway');
    expect(svg).toContain('v3.0');
  });

  it('renders Title :: Subtitle and breaks in timeline (vertical spine)', () => {
    const src = `timeline
  title 2024 Product Roadmap
  layout vertical-spine
  2024-01-15 : Alpha Release :: Closed Preview<br>Invited beta testers
  2024-06-01 : GA Release :: Global Launch
`;
    const res = renderSync(src);
    expect(res.ok).toBe(true);
    const svg = res.value;
    expect(svg).toContain('Alpha Release');
    expect(svg).toContain('Closed Preview');
    expect(svg).toContain('Invited beta testers');
    expect(svg).toContain('GA Release');
    expect(svg).toContain('Global Launch');
  });
});
