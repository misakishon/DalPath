import type {
  AnalyticsSummary,
  DiscoveredPage,
  FlowEvent,
  SecurityEvent,
  SecuritySummary,
  SiteDto,
  TeamMember,
  TimeRange,
  VisitorSession,
} from '../types/analytics';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const errBody = await res.json();
      if (errBody?.error) msg = errBody.error;
    } catch {
      // ignore json parse failure
    }
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  listSites: () => requestJson<{ sites: SiteDto[] }>('/api/sites'),

  createSite: (payload: { name: string; domain: string; allowedDomains?: string[] }) =>
    requestJson<{ site: SiteDto }>('/api/sites', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  revealKey: (siteId: string) =>
    requestJson<{ integrationKey: string }>(`/api/sites/${encodeURIComponent(siteId)}/key`),

  rotateKey: (siteId: string) =>
    requestJson<{ site: SiteDto; integrationKey: string }>(
      `/api/sites/${encodeURIComponent(siteId)}/rotate-key`,
      { method: 'POST' }
    ),

  updateSiteSettings: (
    siteId: string,
    payload: Partial<{
      name: string;
      allowedDomains: string[];
      collectionPaused: boolean;
      retentionDays: number;
      ipMaskingEnabled: boolean;
      demoMode: boolean;
      status: 'connected' | 'waiting' | 'disconnected';
    }>
  ) =>
    requestJson<{ site: SiteDto }>(`/api/sites/${encodeURIComponent(siteId)}/settings`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  sendTestEvent: (siteId: string, payload?: { path?: string; title?: string; sessionId?: string }) =>
    requestJson<{ event: FlowEvent; discoveredNewPage: boolean }>(
      `/api/sites/${encodeURIComponent(siteId)}/test-event`,
      { method: 'POST', body: JSON.stringify(payload || {}) }
    ),

  listPages: (siteId: string, includeHidden = true) =>
    requestJson<{ pages: DiscoveredPage[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/pages?includeHidden=${includeHidden}`
    ),

  updatePage: (
    siteId: string,
    pageId: number,
    payload: Partial<{ label: string; group: string; isHidden: boolean }>
  ) =>
    requestJson<{ pages: DiscoveredPage[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/pages/${pageId}`,
      { method: 'PATCH', body: JSON.stringify(payload) }
    ),

  listVisitors: (
    siteId: string,
    params?: { search?: string; status?: string; region?: string; origin?: string }
  ) => {
    const q = new URLSearchParams();
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.region) q.set('region', params.region);
    if (params?.origin) q.set('origin', params.origin);
    return requestJson<{ visitors: VisitorSession[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/visitors?${q.toString()}`
    );
  },

  listEvents: (
    siteId: string,
    params?: { range?: TimeRange; eventType?: string; page?: string; search?: string; limit?: number }
  ) => {
    const q = new URLSearchParams();
    if (params?.range) q.set('range', params.range);
    if (params?.eventType) q.set('eventType', params.eventType);
    if (params?.page) q.set('page', params.page);
    if (params?.search) q.set('search', params.search);
    if (params?.limit) q.set('limit', String(params.limit));
    return requestJson<{ events: FlowEvent[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/events?${q.toString()}`
    );
  },

  getAnalytics: (siteId: string, range: TimeRange) =>
    requestJson<AnalyticsSummary>(
      `/api/sites/${encodeURIComponent(siteId)}/analytics?range=${encodeURIComponent(range)}`
    ),

  listSecurityEvents: (
    siteId: string,
    params?: { severity?: string; status?: string; search?: string }
  ) => {
    const q = new URLSearchParams();
    if (params?.severity) q.set('severity', params.severity);
    if (params?.status) q.set('status', params.status);
    if (params?.search) q.set('search', params.search);
    return requestJson<{ summary: SecuritySummary; events: SecurityEvent[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/security-events?${q.toString()}`
    );
  },

  updateSecurityEventStatus: (
    siteId: string,
    eventId: number,
    status: 'Open' | 'Acknowledged' | 'Resolved'
  ) =>
    requestJson<{ summary: SecuritySummary; events: SecurityEvent[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/security-events/${eventId}`,
      { method: 'PATCH', body: JSON.stringify({ status }) }
    ),

  listTeam: (siteId: string) =>
    requestJson<{ members: TeamMember[] }>(`/api/sites/${encodeURIComponent(siteId)}/team`),

  addTeamMember: (siteId: string, payload: { name: string; email: string; role: string }) =>
    requestJson<{ members: TeamMember[] }>(`/api/sites/${encodeURIComponent(siteId)}/team`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  removeTeamMember: (siteId: string, memberId: number) =>
    requestJson<{ members: TeamMember[] }>(
      `/api/sites/${encodeURIComponent(siteId)}/team/${memberId}`,
      { method: 'DELETE' }
    ),
};

export function formatDuration(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatShortDuration(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function formatTimeHms(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
