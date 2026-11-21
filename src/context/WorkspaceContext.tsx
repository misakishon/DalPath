import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import type {
  AnalyticsSummary,
  DiscoveredPage,
  FlowEvent,
  SecurityEvent,
  SecuritySummary,
  SiteDto,
  TimeRange,
  VisitorSession,
} from '../types/analytics';

export type StreamStatus = 'connecting' | 'connected' | 'disconnected';

interface WorkspaceContextValue {
  sites: SiteDto[];
  selectedSiteId: string;
  selectedSite: SiteDto | null;
  setSelectedSiteId: (id: string) => void;
  timeRange: TimeRange;
  setTimeRange: (range: TimeRange) => void;
  pages: DiscoveredPage[];
  visitors: VisitorSession[];
  events: FlowEvent[];
  bufferedEvents: FlowEvent[];
  analytics: AnalyticsSummary | null;
  securitySummary: SecuritySummary;
  securityEvents: SecurityEvent[];
  selectedVisitorId: string | null;
  setSelectedVisitorId: (id: string | null) => void;
  selectedPagePath: string | null;
  setSelectedPagePath: (path: string | null) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  stepNextBufferedEvent: () => void;
  resetEventStream: () => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  streamStatus: StreamStatus;
  loading: boolean;
  error: string | null;
  refreshAll: () => Promise<void>;
  refreshSites: () => Promise<void>;
  lastAnimatedEvent: FlowEvent | null;
  globalSearchOpen: boolean;
  setGlobalSearchOpen: (open: boolean) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

const EMPTY_SECURITY_SUMMARY: SecuritySummary = {
  Critical: 0,
  High: 0,
  Medium: 0,
  Low: 0,
  openTotal: 0,
};

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [sites, setSites] = useState<SiteDto[]>([]);
  const [selectedSiteId, setSelectedSiteIdState] = useState<string>('');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [pages, setPages] = useState<DiscoveredPage[]>([]);
  const [visitors, setVisitors] = useState<VisitorSession[]>([]);
  const [events, setEvents] = useState<FlowEvent[]>([]);
  const [bufferedEvents, setBufferedEvents] = useState<FlowEvent[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [securitySummary, setSecuritySummary] = useState<SecuritySummary>(EMPTY_SECURITY_SUMMARY);
  const [securityEvents, setSecurityEvents] = useState<SecurityEvent[]>([]);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string | null>(null);
  const [selectedPagePath, setSelectedPagePath] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastAnimatedEvent, setLastAnimatedEvent] = useState<FlowEvent | null>(null);
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const refreshTimerRef = useRef<number | null>(null);

  const refreshSites = useCallback(async () => {
    const res = await api.listSites();
    setSites(res.sites);
    setSelectedSiteIdState((prev) => {
      if (prev && res.sites.some((s) => s.id === prev)) return prev;
      return res.sites[0]?.id || '';
    });
  }, []);

  const setSelectedSiteId = useCallback((id: string) => {
    setSelectedSiteIdState(id);
    setSelectedVisitorId(null);
    setSelectedPagePath(null);
    setBufferedEvents([]);
  }, []);

  const refreshAll = useCallback(async () => {
    if (!selectedSiteId) return;
    setError(null);
    try {
      const [pagesRes, visitorsRes, eventsRes, analyticsRes, secRes] = await Promise.all([
        api.listPages(selectedSiteId, true),
        api.listVisitors(selectedSiteId),
        api.listEvents(selectedSiteId, { range: timeRange, limit: 120 }),
        api.getAnalytics(selectedSiteId, timeRange),
        api.listSecurityEvents(selectedSiteId),
      ]);
      setPages(pagesRes.pages);
      setVisitors(visitorsRes.visitors);
      setEvents(eventsRes.events);
      setAnalytics(analyticsRes);
      setSecuritySummary(secRes.summary);
      setSecurityEvents(secRes.events);

      setSelectedVisitorId((prev) => {
        if (prev && visitorsRes.visitors.some((v) => v.anonSessionId === prev)) return prev;
        const preferred =
          visitorsRes.visitors.find((v) => v.anonSessionId === 'v_8f3d2a7c') ||
          visitorsRes.visitors.find((v) => v.isActive) ||
          visitorsRes.visitors[0];
        return preferred ? preferred.anonSessionId : null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load workspace data.');
    } finally {
      setLoading(false);
    }
  }, [selectedSiteId, timeRange]);

  // Initial sites load
  useEffect(() => {
    setLoading(true);
    refreshSites().catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to connect to analytics backend.');
      setLoading(false);
    });
  }, [refreshSites]);

  // Load site-scoped data when site or range changes
  useEffect(() => {
    if (!selectedSiteId) return;
    setLoading(true);
    refreshAll();
  }, [selectedSiteId, timeRange, refreshAll]);

  // Global Ctrl+K shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setGlobalSearchOpen((open) => !open);
      }
      if (e.key === 'Escape') {
        setGlobalSearchOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Real-time Server-Sent Events subscription strictly scoped to selectedSiteId
  useEffect(() => {
    if (!selectedSiteId) return;
    setStreamStatus('connecting');
    const es = new EventSource(`/api/v1/stream?siteId=${encodeURIComponent(selectedSiteId)}`);

    es.onopen = () => {
      setStreamStatus('connected');
    };

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data.type === 'connected') {
          setStreamStatus('connected');
          return;
        }
        if (data.type === 'event' && data.event) {
          const evt: FlowEvent = data.event;
          if (evt.siteId !== selectedSiteId) return;

          if (isPausedRef.current) {
            setBufferedEvents((prev) => [evt, ...prev].slice(0, 80));
            return;
          }

          setLastAnimatedEvent(evt);
          setEvents((prev) => [evt, ...prev.filter((e) => e.id !== evt.id)].slice(0, 150));

          // Debounced light refresh of pages, visitors, and KPIs
          if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
          refreshTimerRef.current = window.setTimeout(() => {
            Promise.all([
              api.listPages(selectedSiteId, true),
              api.listVisitors(selectedSiteId),
              api.getAnalytics(selectedSiteId, timeRange),
            ])
              .then(([pRes, vRes, aRes]) => {
                setPages(pRes.pages);
                setVisitors(vRes.visitors);
                setAnalytics(aRes);
              })
              .catch(() => {});
          }, Math.round(450 / Math.max(0.5, playbackSpeed)));
          return;
        }
        if (data.type === 'security_event' && data.securityEvent) {
          api.listSecurityEvents(selectedSiteId).then((secRes) => {
            setSecuritySummary(secRes.summary);
            setSecurityEvents(secRes.events);
          }).catch(() => {});
          return;
        }
        if (data.type === 'pages_updated' || data.type === 'site_updated') {
          refreshSites().catch(() => {});
          refreshAll().catch(() => {});
        }
      } catch {
        // ignore malformed keepalive
      }
    };

    es.onerror = () => {
      setStreamStatus('disconnected');
    };

    return () => {
      es.close();
      if (refreshTimerRef.current) window.clearTimeout(refreshTimerRef.current);
    };
  }, [selectedSiteId, timeRange, playbackSpeed, refreshAll, refreshSites]);

  const stepNextBufferedEvent = useCallback(() => {
    setBufferedEvents((prev) => {
      if (prev.length === 0) {
        // If no live buffer queued, cycle review selection through recent events
        setEvents((curr) => {
          if (curr.length > 0) {
            const picked = curr[0];
            setSelectedVisitorId(picked.anonSessionId);
            setLastAnimatedEvent(picked);
          }
          return curr;
        });
        return prev;
      }
      const nextEvt = prev[prev.length - 1];
      setEvents((curr) => [nextEvt, ...curr.filter((e) => e.id !== nextEvt.id)].slice(0, 150));
      setLastAnimatedEvent(nextEvt);
      setSelectedVisitorId(nextEvt.anonSessionId);
      return prev.slice(0, -1);
    });
  }, []);

  const resetEventStream = useCallback(() => {
    setIsPaused(false);
    setBufferedEvents([]);
    setPlaybackSpeed(1);
    refreshAll();
  }, [refreshAll]);

  const selectedSite = sites.find((s) => s.id === selectedSiteId) || null;

  return (
    <WorkspaceContext.Provider
      value={{
        sites,
        selectedSiteId,
        selectedSite,
        setSelectedSiteId,
        timeRange,
        setTimeRange,
        pages,
        visitors,
        events,
        bufferedEvents,
        analytics,
        securitySummary,
        securityEvents,
        selectedVisitorId,
        setSelectedVisitorId,
        selectedPagePath,
        setSelectedPagePath,
        isPaused,
        setIsPaused,
        stepNextBufferedEvent,
        resetEventStream,
        playbackSpeed,
        setPlaybackSpeed,
        streamStatus,
        loading,
        error,
        refreshAll,
        refreshSites,
        lastAnimatedEvent,
        globalSearchOpen,
        setGlobalSearchOpen,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used within WorkspaceProvider');
  return ctx;
}
