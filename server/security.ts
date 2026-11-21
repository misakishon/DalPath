import crypto from 'node:crypto';

export interface SafeCollectPayload {
  siteId: string;
  integrationKey: string;
  sessionId: string;
  eventType: 'Page View' | 'Session Start' | 'SPA Navigation' | 'Auth Metadata' | 'Session End';
  path: string;
  previousPath: string | null;
  title: string | null;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  durationSec: number;
  authOutcome?: 'success' | 'failed';
  regionHint?: string;
  latencyMs: number;
}

const ALLOWED_EVENT_TYPES = new Set([
  'Page View',
  'Session Start',
  'SPA Navigation',
  'Auth Metadata',
  'Session End',
]);

/**
 * Normalizes a URL or path by removing origin, query strings, and fragments.
 * Ensures a canonical lowercase pathname starting with '/'.
 */
export function normalizePath(rawInput: string | undefined | null): string {
  if (!rawInput || typeof rawInput !== 'string') return '/';
  let cleaned = rawInput.trim();
  if (!cleaned) return '/';

  try {
    if (/^https?:\/\//i.test(cleaned)) {
      const parsed = new URL(cleaned);
      cleaned = parsed.pathname;
    }
  } catch {
    // Fall back to string stripping below
  }

  // Strip hash fragment and query string
  const hashIdx = cleaned.indexOf('#');
  if (hashIdx !== -1) cleaned = cleaned.slice(0, hashIdx);
  const queryIdx = cleaned.indexOf('?');
  if (queryIdx !== -1) cleaned = cleaned.slice(0, queryIdx);

  // Decode safe URI characters if possible
  try {
    cleaned = decodeURIComponent(cleaned);
  } catch {
    // Keep raw path segment if malformed encoding
  }

  // Collapse multiple slashes and ensure leading slash
  cleaned = cleaned.replace(/\\+/g, '/').replace(/\/+/g, '/');
  if (!cleaned.startsWith('/')) cleaned = '/' + cleaned;
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  // Canonicalize case and clamp length
  cleaned = cleaned.toLowerCase().slice(0, 180);
  return cleaned || '/';
}

export function deriveDefaultPageLabel(normalizedPath: string): string {
  if (normalizedPath === '/' || normalizedPath === '') return 'Home';
  const segments = normalizedPath.split('/').filter(Boolean);
  const last = segments[segments.length - 1] || 'Home';
  return last
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 48);
}

/**
 * Masks IPv4 and IPv6 addresses so raw visitor IPs are never stored or exposed.
 */
export function maskIpAddress(rawIp: string | undefined | null, enabled = true): string {
  if (!rawIp) return '***.***.113.**';
  let ip = rawIp.split(',')[0].trim();
  if (ip.startsWith('::ffff:')) {
    ip = ip.slice(7);
  }
  if (!enabled) {
    // Even when relaxed, keep final octet redacted for privacy hygiene
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.**`;
    }
    return '***.***.***.**';
  }

  if (ip === '::1' || ip === '127.0.0.1') {
    return '***.***.127.**';
  }
  if (ip.includes('.')) {
    const parts = ip.split('.');
    if (parts.length === 4) {
      return `***.***.${parts[2]}.**`;
    }
  }
  if (ip.includes(':')) {
    const segs = ip.split(':').filter(Boolean);
    const mid = segs[Math.min(2, segs.length - 1)] || '0';
    return `****:****:${mid}:**`;
  }
  return '***.***.***.**';
}

const REGIONS = [
  'North America',
  'Europe',
  'Asia-Pacific',
  'South America',
  'Oceania',
] as const;

export function deriveApproxRegion(rawIp: string | undefined | null, hint?: string): string {
  if (hint && REGIONS.includes(hint as (typeof REGIONS)[number])) {
    return hint;
  }
  if (!rawIp || rawIp === '::1' || rawIp.includes('127.0.0.1')) {
    return 'North America';
  }
  const hash = crypto.createHash('sha256').update(rawIp).digest()[0];
  return REGIONS[hash % REGIONS.length];
}

export function generateIntegrationKey(): string {
  return `ufa_live_${crypto.randomBytes(16).toString('hex')}`;
}

export function maskIntegrationKey(key: string): string {
  if (!key || key.length < 14) return 'ufa_live_••••••••';
  return `${key.slice(0, 13)}••••••••${key.slice(-4)}`;
}

export function verifyIntegrationKey(expected: string, provided: string | undefined | null): boolean {
  if (!expected || !provided || typeof provided !== 'string') return false;
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function extractHostname(originOrReferer: string | undefined | null): string | null {
  if (!originOrReferer || typeof originOrReferer !== 'string') return null;
  try {
    const parsed = new URL(originOrReferer);
    return parsed.hostname.toLowerCase();
  } catch {
    return originOrReferer.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/:]/)[0] || null;
  }
}

export function isDomainAllowed(hostname: string | null, allowedDomains: string[]): boolean {
  if (!hostname) return false;
  const normalizedHost = hostname.toLowerCase();
  return allowedDomains.some((pattern) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    if (p === '*') return true;
    if (p.startsWith('*.')) {
      const base = p.slice(2);
      return normalizedHost === base || normalizedHost.endsWith('.' + base);
    }
    return normalizedHost === p;
  });
}

export function sanitizeAnonymousSessionId(raw: unknown): string {
  if (typeof raw === 'string' && /^v_[a-zA-Z0-9_-]{4,24}$/.test(raw.trim())) {
    return raw.trim();
  }
  return `v_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Strictly whitelists safe analytics metadata.
 * Never reads or retains passwords, form values, payment data, message contents, or keystrokes.
 */
export function sanitizeCollectPayload(body: unknown): SafeCollectPayload | null {
  if (!body || typeof body !== 'object') return null;
  const raw = body as Record<string, unknown>;

  const siteId = typeof raw.siteId === 'string' ? raw.siteId.trim().slice(0, 64) : '';
  const integrationKey = typeof raw.integrationKey === 'string' ? raw.integrationKey.trim().slice(0, 128) : '';
  if (!siteId || !integrationKey) return null;

  const rawType = typeof raw.eventType === 'string' ? raw.eventType : 'Page View';
  const eventType = (ALLOWED_EVENT_TYPES.has(rawType) ? rawType : 'Page View') as SafeCollectPayload['eventType'];

  const path = normalizePath(typeof raw.path === 'string' ? raw.path : '/');
  const previousPath =
    typeof raw.previousPath === 'string' && raw.previousPath.trim()
      ? normalizePath(raw.previousPath)
      : null;

  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim().replace(/[<>]/g, '').slice(0, 80)
      : null;

  const deviceRaw = typeof raw.deviceType === 'string' ? raw.deviceType.toLowerCase() : 'desktop';
  const deviceType: SafeCollectPayload['deviceType'] =
    deviceRaw === 'mobile' || deviceRaw === 'tablet' ? deviceRaw : 'desktop';

  const durationSec =
    typeof raw.durationSec === 'number' && Number.isFinite(raw.durationSec) && raw.durationSec >= 0
      ? Math.min(Math.round(raw.durationSec), 86400)
      : 0;

  const authOutcome =
    raw.authOutcome === 'failed' || raw.authOutcome === 'success' ? raw.authOutcome : undefined;

  const regionHint = typeof raw.regionHint === 'string' ? raw.regionHint : undefined;

  const latencyMs =
    typeof raw.latencyMs === 'number' && Number.isFinite(raw.latencyMs) && raw.latencyMs > 0
      ? Math.min(Math.round(raw.latencyMs), 5000)
      : Math.floor(42 + Math.random() * 58);

  return {
    siteId,
    integrationKey,
    sessionId: sanitizeAnonymousSessionId(raw.sessionId),
    eventType,
    path,
    previousPath,
    title,
    deviceType,
    durationSec,
    authOutcome,
    regionHint,
    latencyMs,
  };
}

/**
 * In-memory sliding window detector for unusual request rates & repeated failed logins.
 */
class AnomalyTracker {
  private requestWindows = new Map<string, number[]>();
  private failedLoginWindows = new Map<string, number[]>();

  recordRequest(siteId: string, actorKey: string): { isBurst: boolean; count: number } {
    const now = Date.now();
    const key = `${siteId}:${actorKey}`;
    const list = (this.requestWindows.get(key) || []).filter((t) => now - t < 10_000);
    list.push(now);
    this.requestWindows.set(key, list);
    return { isBurst: list.length >= 16 && list.length % 8 === 0, count: list.length };
  }

  recordFailedLogin(siteId: string, actorKey: string): { isRepeated: boolean; count: number } {
    const now = Date.now();
    const key = `${siteId}:${actorKey}`;
    const list = (this.failedLoginWindows.get(key) || []).filter((t) => now - t < 60_000);
    list.push(now);
    this.failedLoginWindows.set(key, list);
    return { isRepeated: list.length >= 3, count: list.length };
  }
}

export const anomalyTracker = new AnomalyTracker();
