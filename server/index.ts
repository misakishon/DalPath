import path from 'node:path';
import fs from 'node:fs';
import express, { type Request, type Response } from 'express';
import cors from 'cors';
import {
  createSite,
  db,
  getAnalyticsSummary,
  getEvents,
  getSecurityEvents,
  getSessionTimeline,
  getSiteRaw,
  getTeamMembers,
  getVisitors,
  listSitePages,
  listSites,
  recordIngestedEvent,
  recordSecurityEvent,
  toSitePublicDto,
} from './db.js';
import { seedDatabaseIfEmpty } from './seed.js';
import {
  anomalyTracker,
  deriveApproxRegion,
  extractHostname,
  generateIntegrationKey,
  isDomainAllowed,
  maskIpAddress,
  normalizePath,
  sanitizeCollectPayload,
  verifyIntegrationKey,
} from './security.js';
import { buildClientSdkScript, buildDemoClientHtml } from './sdk.js';
import { startDemoSimulator } from './simulator.js';

seedDatabaseIfEmpty();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.use(cors({ origin: true, credentials: false }));
app.use(express.json({ limit: '64kb' }));

// SSE subscribers strictly partitioned by siteId
const sseClientsBySite = new Map<string, Set<Response>>();

function broadcastToSite(siteId: string, payload: unknown) {
  const clients = sseClientsBySite.get(siteId);
  if (!clients || clients.size === 0) return;
  const serialized = `data: ${JSON.stringify(payload)}\n\n`;
  for (const res of clients) {
    try {
      res.write(serialized);
    } catch {
      clients.delete(res);
    }
  }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'user-flow-analytics', timestamp: new Date().toISOString() });
});

// Serve lightweight browser SDK
app.get('/sdk/ufa.js', (req, res) => {
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host || `localhost:${PORT}`;
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache');
  res.send(buildClientSdkScript(`${proto}://${host}`));
});

// Serve interactive connected-site SDK test sandbox
app.get('/demo-site', (req, res) => {
  const requestedSiteId = typeof req.query.siteId === 'string' ? req.query.siteId : 'site_example';
  const site = getSiteRaw(requestedSiteId) || getSiteRaw('site_example');
  if (!site) {
    res.status(404).send('No site configured');
    return;
  }
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers.host || `localhost:${PORT}`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(
    buildDemoClientHtml({
      siteId: site.id,
      integrationKey: site.integration_key,
      domain: site.domain,
      origin: `${proto}://${host}`,
    })
  );
});

// Server-Sent Events stream scoped strictly to a single siteId
app.get('/api/v1/stream', (req, res) => {
  const siteId = typeof req.query.siteId === 'string' ? req.query.siteId : '';
  const site = getSiteRaw(siteId);
  if (!site) {
    res.status(404).json({ error: 'Unknown siteId' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  let bucket = sseClientsBySite.get(siteId);
  if (!bucket) {
    bucket = new Set();
    sseClientsBySite.set(siteId, bucket);
  }
  bucket.add(res);

  res.write(
    `data: ${JSON.stringify({ type: 'connected', siteId, status: site.status, demoMode: Boolean(site.demo_mode) })}\n\n`
  );

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      clearInterval(heartbeat);
    }
  }, 15_000);

  req.on('close', () => {
    clearInterval(heartbeat);
    bucket?.delete(res);
  });
});

// Secure Ingestion Endpoint (validates siteId, integrationKey, allowed domains, strips PII, masks IP)
app.post('/api/v1/collect', (req: Request, res: Response) => {
  const payload = sanitizeCollectPayload(req.body);
  if (!payload) {
    res.status(400).json({ error: 'Invalid event payload. Required: siteId, integrationKey.' });
    return;
  }

  const site = getSiteRaw(payload.siteId);
  if (!site) {
    res.status(404).json({ error: 'Unknown site ID.' });
    return;
  }

  const rawIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
  const maskedIp = maskIpAddress(rawIp, Boolean(site.ip_masking_enabled));

  if (site.status === 'disconnected') {
    res.status(403).json({ error: 'Site is disconnected. Reconnect in Settings to resume ingestion.' });
    return;
  }

  if (site.collection_paused) {
    res.status(202).json({ accepted: false, status: 'paused', message: 'Collection is currently paused for this site.' });
    return;
  }

  // Validate integration key using constant-time comparison
  if (!verifyIntegrationKey(site.integration_key, payload.integrationKey)) {
    const sec = recordSecurityEvent({
      siteId: site.id,
      severity: 'High',
      eventType: 'Invalid Integration Key',
      anonSessionId: payload.sessionId,
      maskedIp,
      sourcePath: payload.path,
      summary: 'Rejected event payload due to invalid integration key.',
      isDemo: false,
    });
    broadcastToSite(site.id, { type: 'security_event', securityEvent: sec });
    res.status(401).json({ error: 'Invalid integration key.' });
    return;
  }

  // Validate allowed domains against Origin / Referer / X-UFA-Test-Origin
  let allowedDomains: string[] = [];
  try {
    allowedDomains = JSON.parse(site.allowed_domains_json);
  } catch {
    allowedDomains = [site.domain];
  }

  const originHeader =
    (req.headers['x-ufa-origin'] as string | undefined) ||
    (req.headers.origin as string | undefined) ||
    (req.headers.referer as string | undefined);
  const hostName = extractHostname(originHeader);
  if (hostName && !isDomainAllowed(hostName, allowedDomains)) {
    const sec = recordSecurityEvent({
      siteId: site.id,
      severity: 'Medium',
      eventType: 'Disallowed Origin Domain',
      anonSessionId: payload.sessionId,
      maskedIp,
      sourcePath: payload.path,
      summary: `Blocked event from unauthorized domain "${hostName}".`,
      isDemo: false,
    });
    broadcastToSite(site.id, { type: 'security_event', securityEvent: sec });
    res.status(403).json({ error: `Origin domain "${hostName}" is not in allowedDomains.` });
    return;
  }

  // Anomaly checks
  const burst = anomalyTracker.recordRequest(site.id, payload.sessionId);
  if (burst.isBurst) {
    const sec = recordSecurityEvent({
      siteId: site.id,
      severity: 'High',
      eventType: 'Unusual Request Rate',
      anonSessionId: payload.sessionId,
      maskedIp,
      sourcePath: payload.path,
      summary: `Unusual request rate: ${burst.count} events in 10s from anonymous session ${payload.sessionId}.`,
      isDemo: false,
    });
    broadcastToSite(site.id, { type: 'security_event', securityEvent: sec });
  }

  let metadataNote: string | null = null;
  if (payload.eventType === 'Auth Metadata') {
    metadataNote =
      payload.authOutcome === 'failed'
        ? 'Failed login attempt recorded — credentials redacted.'
        : 'Login event recorded — credentials redacted.';

    if (payload.authOutcome === 'failed') {
      const failed = anomalyTracker.recordFailedLogin(site.id, payload.sessionId);
      if (failed.isRepeated) {
        const sec = recordSecurityEvent({
          siteId: site.id,
          severity: 'Critical',
          eventType: 'Repeated Failed Logins',
          anonSessionId: payload.sessionId,
          maskedIp,
          sourcePath: payload.path,
          summary: `${failed.count} failed login attempts within 60s on ${payload.path} (credentials never collected).`,
          isDemo: false,
        });
        broadcastToSite(site.id, { type: 'security_event', securityEvent: sec });
      }
    }
  }

  const region = deriveApproxRegion(rawIp, payload.regionHint);

  const recorded = recordIngestedEvent({
    siteId: site.id,
    sessionId: payload.sessionId,
    maskedIp,
    region,
    deviceType: payload.deviceType,
    eventType: payload.eventType,
    path: payload.path,
    previousPath: payload.previousPath,
    title: payload.title,
    status: payload.authOutcome === 'failed' ? 'Alert' : 'Success',
    latencyMs: payload.latencyMs,
    metadataNote,
    isDemo: false,
  });

  broadcastToSite(site.id, {
    type: 'event',
    event: recorded.event,
    discoveredNewPage: recorded.discoveredNewPage,
  });

  res.status(201).json({
    accepted: true,
    event: recorded.event,
    discoveredNewPage: recorded.discoveredNewPage,
  });
});

// ========================
// SITES & SETTINGS ROUTES
// ========================
app.get('/api/sites', (_req, res) => {
  res.json({ sites: listSites() });
});

app.post('/api/sites', (req, res) => {
  const { name, domain, allowedDomains } = req.body || {};
  if (!domain || typeof domain !== 'string' || !domain.trim()) {
    res.status(400).json({ error: 'Website domain is required.' });
    return;
  }
  const site = createSite({
    name: typeof name === 'string' && name.trim() ? name : domain,
    domain,
    allowedDomains: Array.isArray(allowedDomains) ? allowedDomains.map(String) : undefined,
  });
  res.status(201).json({ site });
});

app.get('/api/sites/:siteId/key', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  res.json({ integrationKey: site.integration_key });
});

app.post('/api/sites/:siteId/rotate-key', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const nextKey = generateIntegrationKey();
  db.prepare('UPDATE sites SET integration_key = ? WHERE id = ?').run(nextKey, site.id);
  const updated = getSiteRaw(site.id)!;
  res.json({ site: toSitePublicDto(updated), integrationKey: nextKey });
});

app.patch('/api/sites/:siteId/settings', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const { name, allowedDomains, collectionPaused, retentionDays, ipMaskingEnabled, demoMode, status } = req.body || {};

  if (typeof name === 'string' && name.trim()) {
    db.prepare('UPDATE sites SET name = ? WHERE id = ?').run(name.trim().slice(0, 64), site.id);
  }
  if (Array.isArray(allowedDomains)) {
    const cleaned = Array.from(
      new Set(
        allowedDomains
          .map((d) => String(d).trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0])
          .filter(Boolean)
      )
    );
    db.prepare('UPDATE sites SET allowed_domains_json = ? WHERE id = ?').run(JSON.stringify(cleaned), site.id);
  }
  if (typeof collectionPaused === 'boolean') {
    db.prepare('UPDATE sites SET collection_paused = ? WHERE id = ?').run(collectionPaused ? 1 : 0, site.id);
  }
  if (typeof retentionDays === 'number' && [7, 14, 30, 90, 180, 365].includes(retentionDays)) {
    db.prepare('UPDATE sites SET retention_days = ? WHERE id = ?').run(retentionDays, site.id);
  }
  if (typeof ipMaskingEnabled === 'boolean') {
    db.prepare('UPDATE sites SET ip_masking_enabled = ? WHERE id = ?').run(ipMaskingEnabled ? 1 : 0, site.id);
  }
  if (typeof demoMode === 'boolean') {
    db.prepare('UPDATE sites SET demo_mode = ? WHERE id = ?').run(demoMode ? 1 : 0, site.id);
  }
  if (status === 'connected' || status === 'waiting' || status === 'disconnected') {
    db.prepare('UPDATE sites SET status = ? WHERE id = ?').run(status, site.id);
  }

  const updated = toSitePublicDto(getSiteRaw(site.id)!);
  broadcastToSite(site.id, { type: 'site_updated', site: updated });
  res.json({ site: updated });
});

app.post('/api/sites/:siteId/test-event', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  if (site.status === 'disconnected') {
    res.status(403).json({ error: 'Site is disconnected.' });
    return;
  }
  if (site.collection_paused) {
    res.status(409).json({ error: 'Collection is paused for this site.' });
    return;
  }
  const rawPath = typeof req.body?.path === 'string' ? req.body.path : '/dashboard?test=1#live';
  const sessionId = typeof req.body?.sessionId === 'string' && req.body.sessionId ? req.body.sessionId : 'v_live77a1';
  const recorded = recordIngestedEvent({
    siteId: site.id,
    sessionId,
    maskedIp: '***.***.127.**',
    region: 'North America',
    deviceType: 'desktop',
    eventType: 'Page View',
    path: normalizePath(rawPath),
    previousPath: '/',
    title: typeof req.body?.title === 'string' ? req.body.title : undefined,
    latencyMs: 54,
    isDemo: false,
  });
  broadcastToSite(site.id, {
    type: 'event',
    event: recorded.event,
    discoveredNewPage: recorded.discoveredNewPage,
  });
  res.status(201).json({ event: recorded.event, discoveredNewPage: recorded.discoveredNewPage });
});

// ========================
// SITE PAGES ROUTES
// ========================
app.get('/api/sites/:siteId/pages', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const includeHidden = req.query.includeHidden !== 'false';
  res.json({ pages: listSitePages(site.id, includeHidden) });
});

app.patch('/api/sites/:siteId/pages/:pageId', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const pageId = Number(req.params.pageId);
  const existing = db
    .prepare('SELECT * FROM site_pages WHERE id = ? AND site_id = ?')
    .get(pageId, site.id);
  if (!existing) {
    res.status(404).json({ error: 'Discovered page not found for this site' });
    return;
  }

  const { label, group, isHidden } = req.body || {};
  if (typeof label === 'string' && label.trim()) {
    db.prepare('UPDATE site_pages SET label = ? WHERE id = ? AND site_id = ?').run(
      label.trim().slice(0, 48),
      pageId,
      site.id
    );
  }
  if (typeof group === 'string' && group.trim()) {
    db.prepare('UPDATE site_pages SET page_group = ? WHERE id = ? AND site_id = ?').run(
      group.trim().slice(0, 32),
      pageId,
      site.id
    );
  }
  if (typeof isHidden === 'boolean') {
    db.prepare('UPDATE site_pages SET is_hidden = ? WHERE id = ? AND site_id = ?').run(
      isHidden ? 1 : 0,
      pageId,
      site.id
    );
  }

  const pages = listSitePages(site.id, true);
  broadcastToSite(site.id, { type: 'pages_updated' });
  res.json({ pages });
});

// ========================
// VISITORS, EVENTS, ANALYTICS, SECURITY, TEAM
// ========================
app.get('/api/sites/:siteId/visitors', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const visitors = getVisitors(site.id, {
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    status: typeof req.query.status === 'string' ? req.query.status : undefined,
    region: typeof req.query.region === 'string' ? req.query.region : undefined,
    origin: typeof req.query.origin === 'string' ? req.query.origin : undefined,
  });
  res.json({ visitors });
});

app.get('/api/sites/:siteId/visitors/:sessionId', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const all = getVisitors(site.id);
  const visitor = all.find((v) => v.anonSessionId === req.params.sessionId);
  if (!visitor) {
    res.status(404).json({ error: 'Visitor session not found' });
    return;
  }
  res.json({ visitor, timeline: getSessionTimeline(site.id, visitor.anonSessionId) });
});

app.get('/api/sites/:siteId/events', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const events = getEvents(site.id, {
    range: typeof req.query.range === 'string' ? req.query.range : '24h',
    eventType: typeof req.query.eventType === 'string' ? req.query.eventType : 'all',
    page: typeof req.query.page === 'string' ? req.query.page : 'all',
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
    limit: req.query.limit ? Number(req.query.limit) : 120,
  });
  res.json({ events });
});

app.get('/api/sites/:siteId/analytics', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const range = typeof req.query.range === 'string' ? req.query.range : '24h';
  res.json(getAnalyticsSummary(site.id, range));
});

app.get('/api/sites/:siteId/security-events', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const data = getSecurityEvents(site.id, {
    severity: typeof req.query.severity === 'string' ? req.query.severity : 'all',
    status: typeof req.query.status === 'string' ? req.query.status : 'all',
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
  });
  res.json(data);
});

app.patch('/api/sites/:siteId/security-events/:eventId', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const eventId = Number(req.params.eventId);
  const { status } = req.body || {};
  if (!['Open', 'Acknowledged', 'Resolved'].includes(status)) {
    res.status(400).json({ error: 'Invalid status' });
    return;
  }
  db.prepare('UPDATE security_events SET status = ? WHERE id = ? AND site_id = ?').run(status, eventId, site.id);
  res.json(getSecurityEvents(site.id));
});

app.get('/api/sites/:siteId/team', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  res.json({ members: getTeamMembers(site.id) });
});

app.post('/api/sites/:siteId/team', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  const { name, email, role } = req.body || {};
  if (!name || !email) {
    res.status(400).json({ error: 'Name and email are required' });
    return;
  }
  const safeRole = ['Owner', 'Admin', 'Security Analyst', 'Analyst', 'Viewer'].includes(role) ? role : 'Analyst';
  db.prepare(`
    INSERT INTO team_members (site_id, name, email, role, added_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(site.id, String(name).trim().slice(0, 64), String(email).trim().slice(0, 96), safeRole, new Date().toISOString());
  res.status(201).json({ members: getTeamMembers(site.id) });
});

app.delete('/api/sites/:siteId/team/:memberId', (req, res) => {
  const site = getSiteRaw(req.params.siteId);
  if (!site) {
    res.status(404).json({ error: 'Site not found' });
    return;
  }
  db.prepare('DELETE FROM team_members WHERE id = ? AND site_id = ?').run(Number(req.params.memberId), site.id);
  res.json({ members: getTeamMembers(site.id) });
});

// Serve built frontend in production when dist/ exists
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distDir, 'index.html'));
  });
}

startDemoSimulator(broadcastToSite);

app.listen(PORT, () => {
  console.log(`[UserFlowAnalytics] API & SSE server listening on http://localhost:${PORT}`);
});
