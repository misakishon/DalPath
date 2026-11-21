import { db, recordIngestedEvent, recordSecurityEvent } from './db.js';

function agoIso(secondsAgo: number): string {
  return new Date(Date.now() - secondsAgo * 1000).toISOString();
}

export function seedDatabaseIfEmpty() {
  const existing = db.prepare('SELECT COUNT(*) as c FROM sites').get() as { c: number };
  if (existing.c > 0) return;

  const created = agoIso(86400 * 14);

  // Site 1: example-site.com (matches visual reference topology & routes)
  db.prepare(`
    INSERT INTO sites (
      id, name, domain, integration_key, allowed_domains_json, status,
      collection_paused, retention_days, ip_masking_enabled, demo_mode, created_at, last_event_at
    ) VALUES (?, ?, ?, ?, ?, 'connected', 0, 30, 1, 1, ?, ?)
  `).run(
    'site_example',
    'Example Portal',
    'example-site.com',
    'ufa_live_8f3d2a7c91e4b605a21d8c7f3e4b19a0',
    JSON.stringify(['example-site.com', 'www.example-site.com', 'localhost', '127.0.0.1']),
    created,
    agoIso(15)
  );

  // Site 2: shop.acme-cloud.io (strictly isolated second website)
  db.prepare(`
    INSERT INTO sites (
      id, name, domain, integration_key, allowed_domains_json, status,
      collection_paused, retention_days, ip_masking_enabled, demo_mode, created_at, last_event_at
    ) VALUES (?, ?, ?, ?, ?, 'connected', 0, 90, 1, 1, ?, ?)
  `).run(
    'site_acme',
    'Acme Cloud Store',
    'shop.acme-cloud.io',
    'ufa_live_4c91e7b208f5a319d62e4b8c1f7a30e2',
    JSON.stringify(['shop.acme-cloud.io', '*.acme-cloud.io', 'localhost', '127.0.0.1']),
    created,
    agoIso(40)
  );

  // Seed discovered pages for example-site.com with realistic view counts matching visual reference
  const examplePages = [
    { path: '/', label: 'Home', group: 'Pages', views: 2847 },
    { path: '/about', label: 'About', group: 'Pages', views: 312 },
    { path: '/login', label: 'Login', group: 'Pages', views: 2148 },
    { path: '/dashboard', label: 'Dashboard', group: 'Pages', views: 1796 },
    { path: '/products', label: 'Products', group: 'Pages', views: 683 },
    { path: '/support', label: 'Support', group: 'Pages', views: 145 },
  ];
  for (const p of examplePages) {
    db.prepare(`
      INSERT INTO site_pages (site_id, path, label, page_group, is_hidden, views_count, first_seen_at, last_seen_at)
      VALUES ('site_example', ?, ?, ?, 0, ?, ?, ?)
    `).run(p.path, p.label, p.group, p.views, agoIso(86400 * 7), agoIso(20));
  }

  // Seed discovered pages for shop.acme-cloud.io (completely distinct routes)
  const acmePages = [
    { path: '/', label: 'Storefront', group: 'Store', views: 1640 },
    { path: '/catalog', label: 'Catalog', group: 'Store', views: 1120 },
    { path: '/pricing', label: 'Pricing', group: 'Store', views: 745 },
    { path: '/checkout', label: 'Checkout', group: 'Store', views: 318 },
    { path: '/docs', label: 'API Docs', group: 'Resources', views: 590 },
    { path: '/account', label: 'Account', group: 'Resources', views: 412 },
  ];
  for (const p of acmePages) {
    db.prepare(`
      INSERT INTO site_pages (site_id, path, label, page_group, is_hidden, views_count, first_seen_at, last_seen_at)
      VALUES ('site_acme', ?, ?, ?, 0, ?, ?, ?)
    `).run(p.path, p.label, p.group, p.views, agoIso(86400 * 6), agoIso(45));
  }

  // Seed featured Demo visitor v_8f3d2a7c (matches reference Home -> Login -> Dashboard!)
  const exampleJourneys: Array<{
    sessionId: string;
    maskedIp: string;
    region: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    steps: Array<{ path: string; eventType: string; secondsAgo: number; note?: string; latency?: number }>;
    durationSec?: number;
  }> = [
    {
      sessionId: 'v_8f3d2a7c',
      maskedIp: '***.***.113.**',
      region: 'North America',
      deviceType: 'desktop',
      durationSec: 183,
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 210, latency: 62 },
        {
          path: '/login',
          eventType: 'Auth Metadata',
          secondsAgo: 192,
          note: 'Login event recorded — credentials redacted.',
          latency: 74,
        },
        { path: '/dashboard', eventType: 'Page View', secondsAgo: 155, latency: 78 },
      ],
    },
    {
      sessionId: 'v_2c91e4bd',
      maskedIp: '***.***.84.**',
      region: 'Europe',
      deviceType: 'desktop',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 380, latency: 88 },
        { path: '/about', eventType: 'SPA Navigation', secondsAgo: 320, latency: 69 },
        { path: '/login', eventType: 'Page View', secondsAgo: 260, latency: 75 },
        { path: '/dashboard', eventType: 'Page View', secondsAgo: 120, latency: 71 },
      ],
    },
    {
      sessionId: 'v_9a7f6e11',
      maskedIp: '***.***.201.**',
      region: 'North America',
      deviceType: 'mobile',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 440, latency: 92 },
        { path: '/products', eventType: 'SPA Navigation', secondsAgo: 360, latency: 79 },
        { path: '/support', eventType: 'Page View', secondsAgo: 180, latency: 83 },
      ],
    },
    {
      sessionId: 'v_4d2b9c8f',
      maskedIp: '***.***.52.**',
      region: 'Asia-Pacific',
      deviceType: 'desktop',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 510, latency: 104 },
        { path: '/about', eventType: 'Page View', secondsAgo: 410, latency: 96 },
        { path: '/products', eventType: 'SPA Navigation', secondsAgo: 240, latency: 88 },
      ],
    },
    {
      sessionId: 'v_7e1c3a90',
      maskedIp: '***.***.19.**',
      region: 'Europe',
      deviceType: 'tablet',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 290, latency: 67 },
        { path: '/login', eventType: 'Auth Metadata', secondsAgo: 230, note: 'Login event recorded — credentials redacted.', latency: 72 },
        { path: '/dashboard', eventType: 'SPA Navigation', secondsAgo: 95, latency: 65 },
        { path: '/support', eventType: 'Page View', secondsAgo: 42, latency: 71 },
      ],
    },
    {
      sessionId: 'v_6b5a1f20',
      maskedIp: '***.***.144.**',
      region: 'North America',
      deviceType: 'mobile',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 170, latency: 74 },
        { path: '/products', eventType: 'Page View', secondsAgo: 85, latency: 68 },
      ],
    },
    {
      sessionId: 'v_3f8e0d41',
      maskedIp: '***.***.77.**',
      region: 'Oceania',
      deviceType: 'desktop',
      steps: [
        { path: '/about', eventType: 'Session Start', secondsAgo: 620, latency: 112 },
        { path: '/', eventType: 'Page View', secondsAgo: 520, latency: 98 },
        { path: '/login', eventType: 'Page View', secondsAgo: 400, latency: 89 },
      ],
    },
    {
      sessionId: 'v_1a9d4c63',
      maskedIp: '***.***.166.**',
      region: 'South America',
      deviceType: 'mobile',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 90, latency: 84 },
        { path: '/about', eventType: 'SPA Navigation', secondsAgo: 35, latency: 77 },
      ],
    },
    {
      sessionId: 'v_5c2e8b19',
      maskedIp: '***.***.210.**',
      region: 'North America',
      deviceType: 'desktop',
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 780, latency: 61 },
        { path: '/login', eventType: 'Auth Metadata', secondsAgo: 720, note: 'Login event recorded — credentials redacted.', latency: 68 },
        { path: '/dashboard', eventType: 'Page View', secondsAgo: 660, latency: 64 },
        { path: '/dashboard', eventType: 'Session End', secondsAgo: 540, latency: 62 },
      ],
    },
    {
      sessionId: 'v_8d4f2a05',
      maskedIp: '***.***.33.**',
      region: 'Europe',
      deviceType: 'desktop',
      steps: [
        { path: '/products', eventType: 'Session Start', secondsAgo: 960, latency: 73 },
        { path: '/support', eventType: 'Page View', secondsAgo: 840, latency: 70 },
        { path: '/support', eventType: 'Session End', secondsAgo: 710, latency: 69 },
      ],
    },
  ];

  for (const j of exampleJourneys) {
    let prev: string | null = null;
    for (const step of j.steps) {
      recordIngestedEvent({
        siteId: 'site_example',
        sessionId: j.sessionId,
        maskedIp: j.maskedIp,
        region: j.region,
        deviceType: j.deviceType,
        eventType: step.eventType,
        path: step.path,
        previousPath: prev,
        latencyMs: step.latency || 76,
        metadataNote: step.note || null,
        isDemo: true,
        createdAt: agoIso(step.secondsAgo),
      });
      prev = step.path;
    }
    if (j.durationSec) {
      db.prepare('UPDATE visitor_sessions SET duration_sec = ? WHERE site_id = ? AND anon_session_id = ?').run(
        j.durationSec,
        'site_example',
        j.sessionId
      );
    }
  }

  // Restore exact reference view counts on example-site.com after seeding baseline journeys
  for (const p of examplePages) {
    db.prepare('UPDATE site_pages SET views_count = ? WHERE site_id = ? AND path = ?').run(
      p.views,
      'site_example',
      p.path
    );
  }

  // Seed journeys for Site 2 (shop.acme-cloud.io)
  const acmeJourneys: Array<{
    sessionId: string;
    maskedIp: string;
    region: string;
    deviceType: 'desktop' | 'mobile' | 'tablet';
    steps: Array<{ path: string; eventType: string; secondsAgo: number; note?: string; latency?: number }>;
  }> = [
    {
      sessionId: 'v_a41c90e2',
      maskedIp: '***.***.91.**',
      region: 'Europe',
      deviceType: 'desktop' as const,
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 260, latency: 64 },
        { path: '/catalog', eventType: 'SPA Navigation', secondsAgo: 200, latency: 71 },
        { path: '/pricing', eventType: 'SPA Navigation', secondsAgo: 140, latency: 68 },
        { path: '/checkout', eventType: 'Page View', secondsAgo: 70, latency: 75 },
      ],
    },
    {
      sessionId: 'v_b73e12f8',
      maskedIp: '***.***.48.**',
      region: 'North America',
      deviceType: 'mobile' as const,
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 310, latency: 82 },
        { path: '/docs', eventType: 'Page View', secondsAgo: 210, latency: 79 },
        { path: '/account', eventType: 'Auth Metadata', secondsAgo: 90, note: 'Login event recorded — credentials redacted.', latency: 73 },
      ],
    },
    {
      sessionId: 'v_c92d41a5',
      maskedIp: '***.***.155.**',
      region: 'Asia-Pacific',
      deviceType: 'desktop' as const,
      steps: [
        { path: '/catalog', eventType: 'Session Start', secondsAgo: 180, latency: 94 },
        { path: '/pricing', eventType: 'Page View', secondsAgo: 80, latency: 88 },
      ],
    },
    {
      sessionId: 'v_e18f7b33',
      maskedIp: '***.***.119.**',
      region: 'North America',
      deviceType: 'tablet' as const,
      steps: [
        { path: '/', eventType: 'Session Start', secondsAgo: 420, latency: 70 },
        { path: '/catalog', eventType: 'Page View', secondsAgo: 330, latency: 67 },
        { path: '/checkout', eventType: 'Page View', secondsAgo: 210, latency: 72 },
        { path: '/checkout', eventType: 'Session End', secondsAgo: 120, latency: 69 },
      ],
    },
  ];

  for (const j of acmeJourneys) {
    let prev: string | null = null;
    for (const step of j.steps) {
      recordIngestedEvent({
        siteId: 'site_acme',
        sessionId: j.sessionId,
        maskedIp: j.maskedIp,
        region: j.region,
        deviceType: j.deviceType,
        eventType: step.eventType,
        path: step.path,
        previousPath: prev,
        latencyMs: step.latency,
        metadataNote: step.note || null,
        isDemo: true,
        createdAt: agoIso(step.secondsAgo),
      });
      prev = step.path;
    }
  }
  for (const p of acmePages) {
    db.prepare('UPDATE site_pages SET views_count = ? WHERE site_id = ? AND path = ?').run(
      p.views,
      'site_acme',
      p.path
    );
  }

  // Seed historical trend events across last 18 hours so charts look realistic right away
  const trendPaths = ['/', '/login', '/dashboard', '/products', '/about', '/support'];
  for (let i = 1; i <= 36; i++) {
    const secs = i * 1650;
    const path = trendPaths[i % trendPaths.length];
    db.prepare(`
      INSERT INTO events (site_id, anon_session_id, event_type, source_path, previous_path, destination, status, latency_ms, metadata_note, is_demo, created_at)
      VALUES ('site_example', ?, 'Page View', ?, '/', 'Database (Event Data)', 'Success', ?, NULL, 1, ?)
    `).run(`v_hist${String(i).padStart(4, '0')}`, path, 62 + (i % 28), agoIso(secs));
  }
  const acmeTrendPaths = ['/', '/catalog', '/pricing', '/checkout', '/docs', '/account'];
  for (let i = 1; i <= 24; i++) {
    const secs = i * 2100;
    const path = acmeTrendPaths[i % acmeTrendPaths.length];
    db.prepare(`
      INSERT INTO events (site_id, anon_session_id, event_type, source_path, previous_path, destination, status, latency_ms, metadata_note, is_demo, created_at)
      VALUES ('site_acme', ?, 'Page View', ?, '/', 'Database (Event Data)', 'Success', ?, NULL, 1, ?)
    `).run(`v_ahis${String(i).padStart(4, '0')}`, path, 58 + (i % 30), agoIso(secs));
  }

  // Seed Security Events for Site 1 (Demo)
  recordSecurityEvent({
    siteId: 'site_example',
    severity: 'Critical',
    eventType: 'Repeated Failed Logins',
    anonSessionId: 'v_3f8e0d41',
    maskedIp: '***.***.77.**',
    sourcePath: '/login',
    summary: '5 consecutive failed login metadata signals in 45s (credentials never collected).',
    status: 'Open',
    isDemo: true,
    createdAt: agoIso(320),
  });
  recordSecurityEvent({
    siteId: 'site_example',
    severity: 'High',
    eventType: 'Unusual Request Rate',
    anonSessionId: 'v_4d2b9c8f',
    maskedIp: '***.***.52.**',
    sourcePath: '/products',
    summary: 'Burst of 24 page-view events in 9 seconds from a single anonymous session.',
    status: 'Open',
    isDemo: true,
    createdAt: agoIso(940),
  });
  recordSecurityEvent({
    siteId: 'site_example',
    severity: 'Medium',
    eventType: 'Disallowed Origin Domain',
    anonSessionId: null,
    maskedIp: '***.***.198.**',
    sourcePath: '/',
    summary: 'Blocked ingestion attempt from unauthorized origin "staging-clone.untrusted.net".',
    status: 'Acknowledged',
    isDemo: true,
    createdAt: agoIso(2800),
  });
  recordSecurityEvent({
    siteId: 'site_example',
    severity: 'Low',
    eventType: 'Invalid Integration Key',
    anonSessionId: null,
    maskedIp: '***.***.64.**',
    sourcePath: '/dashboard',
    summary: 'Rejected collection payload with expired or malformed integration key.',
    status: 'Resolved',
    isDemo: true,
    createdAt: agoIso(6400),
  });

  // Seed Security Events for Site 2 (Demo)
  recordSecurityEvent({
    siteId: 'site_acme',
    severity: 'High',
    eventType: 'Unusual Request Rate',
    anonSessionId: 'v_c92d41a5',
    maskedIp: '***.***.155.**',
    sourcePath: '/pricing',
    summary: 'Automated scraping pattern detected: 20 rapid route hits across /catalog and /pricing.',
    status: 'Open',
    isDemo: true,
    createdAt: agoIso(520),
  });
  recordSecurityEvent({
    siteId: 'site_acme',
    severity: 'Medium',
    eventType: 'Repeated Failed Logins',
    anonSessionId: 'v_b73e12f8',
    maskedIp: '***.***.48.**',
    sourcePath: '/account',
    summary: '3 failed authentication attempts recorded on /account (form fields redacted).',
    status: 'Acknowledged',
    isDemo: true,
    createdAt: agoIso(1900),
  });

  // Seed Team Members for both sites
  const team = [
    ['site_example', 'Elena Rostova', 'elena@example-site.com', 'Owner'],
    ['site_example', 'Marcus Chen', 'marcus@example-site.com', 'Admin'],
    ['site_example', 'Priya Nair', 'priya@example-site.com', 'Analyst'],
    ['site_acme', 'Jordan Blake', 'jordan@acme-cloud.io', 'Owner'],
    ['site_acme', 'Sora Takahashi', 'sora@acme-cloud.io', 'Security Analyst'],
  ];
  for (const [siteId, name, email, role] of team) {
    db.prepare(`
      INSERT INTO team_members (site_id, name, email, role, added_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(siteId, name, email, role, created);
  }
}
