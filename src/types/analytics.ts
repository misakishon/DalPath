export type TimeRange = '1h' | '24h' | '7d' | '30d';

export interface SiteDto {
  id: string;
  name: string;
  domain: string;
  maskedIntegrationKey: string;
  allowedDomains: string[];
  status: 'connected' | 'waiting' | 'disconnected';
  collectionPaused: boolean;
  retentionDays: number;
  ipMaskingEnabled: boolean;
  demoMode: boolean;
  createdAt: string;
  lastEventAt: string | null;
  pageCount: number;
  liveEventCount: number;
  demoEventCount: number;
}

export interface DiscoveredPage {
  id: number;
  siteId: string;
  path: string;
  label: string;
  group: string;
  isHidden: boolean;
  views: number;
  activeVisitors: number;
  firstSeenAt: string;
  lastSeenAt: string;
  discoveryStatus: 'Discovered' | 'Hidden';
}

export interface TimelineStep {
  id: number;
  eventType: string;
  path: string;
  label: string;
  previousPath: string | null;
  status: string;
  latencyMs: number;
  metadataNote: string | null;
  isDemo: boolean;
  createdAt: string;
  dwellSec: number;
}

export interface VisitorSession {
  id: number;
  siteId: string;
  anonSessionId: string;
  maskedIp: string;
  region: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  currentPath: string;
  currentLabel: string;
  previousPath: string | null;
  previousLabel: string | null;
  entryPath: string;
  entryLabel: string;
  exitPath: string;
  exitLabel: string;
  isActive: boolean;
  isDemo: boolean;
  startedAt: string;
  lastSeenAt: string;
  durationSec: number;
  pageViews: number;
  routePaths: string[];
  routeLabels: string[];
  timeline: TimelineStep[];
}

export interface FlowEvent {
  id: number;
  siteId: string;
  anonSessionId: string;
  eventType: string;
  sourcePath: string;
  sourceLabel: string;
  previousPath: string | null;
  destination: string;
  status: string;
  latencyMs: number;
  metadataNote: string | null;
  isDemo: boolean;
  createdAt: string;
}

export interface SecurityEvent {
  id: number;
  siteId: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  eventType: string;
  anonSessionId: string | null;
  maskedIp: string;
  sourcePath: string;
  summary: string;
  status: 'Open' | 'Acknowledged' | 'Resolved';
  isDemo: boolean;
  createdAt: string;
}

export interface SecuritySummary {
  Critical: number;
  High: number;
  Medium: number;
  Low: number;
  openTotal: number;
}

export interface AnalyticsSummary {
  kpis: {
    activeVisitors: number;
    sessions: number;
    pageViewsInRange: number;
    totalPageViews: number;
    avgLatencyMs: number;
    eventSuccessRate: number;
    deltas: {
      activeVisitors: string;
      sessions: string;
      pageViews: string;
    };
  };
  dataMode: 'live' | 'demo' | 'mixed' | 'empty';
  trend: Array<{ label: string; pageViews: number; visitors: number }>;
  popularPages: Array<{ path: string; label: string; views: number; activeVisitors: number; group: string }>;
  entryPages: Array<{ path: string; label: string; sessions: number; sharePct: number }>;
  exitPages: Array<{ path: string; label: string; sessions: number; sharePct: number }>;
  commonPaths: Array<{ sequence: string; steps: string[]; sessions: number; sharePct: number }>;
  latencySeries: number[];
  successSeries: number[];
}

export interface TeamMember {
  id: number;
  siteId: string;
  name: string;
  email: string;
  role: string;
  addedAt: string;
}
