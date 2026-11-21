import React, { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Calendar,
  FileCode2,
  Globe,
  LayoutDashboard,
  Menu,
  Network,
  Search,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { TimeRange } from '../types/analytics';
import { DisconnectedBanner } from './StateFeedback';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, subtitle: 'Traffic, health & security overview' },
  { to: '/live', label: 'Live Visitor Journey', icon: Network, subtitle: 'Real-time website activity topology' },
  { to: '/visitors', label: 'Visitors', icon: Users, subtitle: 'Anonymous visitor sessions & timelines' },
  { to: '/security', label: 'Security Events', icon: ShieldAlert, subtitle: 'Rate anomalies & access protection' },
  { to: '/analytics', label: 'Analytics', icon: BarChart3, subtitle: 'Trends, entry/exit pages & common paths' },
  { to: '/pages', label: 'Site Pages', icon: FileCode2, subtitle: 'Dynamically discovered routes & visibility' },
  { to: '/settings', label: 'Settings', icon: Settings, subtitle: 'SDK integration, allowed domains & privacy' },
] as const;

const RANGE_LABELS: Record<TimeRange, string> = {
  '1h': 'Last 1 hour',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
};

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    sites,
    selectedSite,
    selectedSiteId,
    setSelectedSiteId,
    timeRange,
    setTimeRange,
    streamStatus,
    securitySummary,
    pages,
    visitors,
    events,
    setSelectedVisitorId,
    setSelectedPagePath,
    refreshAll,
    globalSearchOpen,
    setGlobalSearchOpen,
  } = useWorkspace();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const currentNav =
    NAV_ITEMS.find((n) => location.pathname.startsWith(n.to)) || NAV_ITEMS[1];

  const isLiveDataPresent = (selectedSite?.liveEventCount || 0) > 0;
  const isDemoMode = Boolean(selectedSite?.demoMode);

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) {
      return {
        pages: pages.slice(0, 4),
        visitors: visitors.slice(0, 4),
        events: events.slice(0, 4),
      };
    }
    return {
      pages: pages
        .filter((p) => p.label.toLowerCase().includes(q) || p.path.toLowerCase().includes(q))
        .slice(0, 5),
      visitors: visitors
        .filter(
          (v) =>
            v.anonSessionId.toLowerCase().includes(q) ||
            v.region.toLowerCase().includes(q) ||
            v.currentLabel.toLowerCase().includes(q)
        )
        .slice(0, 5),
      events: events
        .filter(
          (e) =>
            e.sourceLabel.toLowerCase().includes(q) ||
            e.anonSessionId.toLowerCase().includes(q) ||
            e.eventType.toLowerCase().includes(q)
        )
        .slice(0, 5),
    };
  }, [searchQuery, pages, visitors, events]);

  return (
    <div className="min-h-screen bg-[#F4F8FE] text-[#0F294D] flex flex-col overflow-x-clip">
      {/* Top Primary Header matching reference */}
      <header className="sticky top-0 z-30 border-b border-[#CBD9EC] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-3 px-3 py-2.5 sm:px-5">
          {/* Left: Brand + Status + Active Route Subtitle */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#CBD9EC] text-[#0F294D] hover:bg-[#EFF6FF] lg:hidden"
              aria-label="Toggle navigation menu"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>

            <NavLink to="/live" className="flex shrink-0 items-center gap-2.5 focus:outline-none">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#BFD3EC] bg-[#EFF6FF] text-[#0F294D]">
                <svg viewBox="0 0 28 28" className="h-5 w-5" aria-hidden="true">
                  <path
                    d="M14 3L23 8V18L14 23L5 18V8L14 3Z"
                    fill="#1D6FE8"
                    fillOpacity="0.16"
                    stroke="#0F294D"
                    strokeWidth="2"
                    strokeLinejoin="round"
                  />
                  <path d="M14 13L23 8M14 13L5 8M14 13V23" stroke="#1D6FE8" strokeWidth="1.8" />
                  <circle cx="14" cy="13" r="2.2" fill="#10B981" />
                </svg>
              </div>
              <span className="text-sm font-extrabold tracking-wide text-[#0F294D] sm:text-[15px]">
                USER FLOW ANALYTICS
              </span>
            </NavLink>

            <div className="hidden h-5 w-px bg-[#DCE6F4] md:block" />

            {/* Live / Demo Status Pill */}
            <div className="hidden items-center gap-2 md:flex">
              {selectedSite?.status === 'disconnected' ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-2.5 py-0.5 text-[11px] font-bold text-[#3730A3]">
                  <span className="h-2 w-2 rounded-full bg-[#6366F1]" />
                  Disconnected
                </span>
              ) : selectedSite?.collectionPaused ? (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#CBD9EC] bg-[#F1F5F9] px-2.5 py-0.5 text-[11px] font-bold text-[#334155]">
                  <span className="h-2 w-2 rounded-full bg-[#64748B]" />
                  Paused
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#047857]">
                  <span className="h-2 w-2 rounded-full bg-[#10B981] animate-live-dot" />
                  {streamStatus === 'connected' ? 'Live' : 'Reconnecting'}
                </span>
              )}

              {isDemoMode && (
                <span
                  title="Demo traffic simulator is active; seeded sample records are labeled Demo."
                  className="inline-flex items-center rounded-full border border-[#BFD3EC] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1D4ED8]"
                >
                  {isLiveDataPresent ? 'Live + Demo' : 'Demo Data'}
                </span>
              )}

              <span className="hidden truncate text-xs font-medium text-[#3A547A] xl:inline">
                <strong className="font-semibold text-[#0F294D]">{currentNav.label}</strong> — {currentNav.subtitle}
              </span>
            </div>
          </div>

          {/* Right Controls: Site Selector, Global Search (Ctrl K), Time Range */}
          <div className="flex items-center gap-2">
            {/* Connected Website Selector */}
            <div className="relative flex items-center">
              <Globe className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#1D6FE8]" />
              <select
                aria-label="Select connected website"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="h-8 max-w-[165px] cursor-pointer rounded-lg border border-[#CBD9EC] bg-white pl-8 pr-7 text-xs font-semibold text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none sm:max-w-[210px]"
              >
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.domain}
                  </option>
                ))}
              </select>
            </div>

            {/* Global Search Trigger */}
            <button
              type="button"
              onClick={() => setGlobalSearchOpen(true)}
              className="hidden h-8 items-center gap-2 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-2.5 text-xs text-[#4A6587] hover:border-[#93B4DF] hover:bg-white sm:inline-flex"
              aria-label="Open global search"
            >
              <Search className="h-3.5 w-3.5 text-[#647D9E]" />
              <span className="hidden lg:inline">Search (pages, visitors, events...)</span>
              <span className="lg:hidden">Search...</span>
              <kbd className="rounded border border-[#CBD9EC] bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#3A547A]">
                Ctrl K
              </kbd>
            </button>

            {/* Time Range Selector */}
            <div className="relative flex items-center">
              <Calendar className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[#4A6587]" />
              <select
                aria-label="Select time range"
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                className="h-8 cursor-pointer rounded-lg border border-[#CBD9EC] bg-white pl-8 pr-6 text-xs font-semibold text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none"
              >
                {(Object.keys(RANGE_LABELS) as TimeRange[]).map((k) => (
                  <option key={k} value={k}>
                    {RANGE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Persistent Horizontal Navigation Bar (All 7 Routes Always Visible on Desktop) */}
        <nav
          aria-label="Primary navigation"
          className="hidden border-t border-[#E6EEF8] bg-[#F8FBFF] lg:block"
        >
          <div className="mx-auto flex max-w-[1680px] items-center justify-between px-5">
            <div className="flex items-center gap-1 py-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const badgeCount =
                  item.to === '/security' && securitySummary.openTotal > 0
                    ? securitySummary.openTotal
                    : null;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isActive
                          ? 'bg-[#DBEAFE] text-[#0F294D] shadow-[inset_0_0_0_1px_#93C5FD]'
                          : 'text-[#3A547A] hover:bg-[#EFF6FF] hover:text-[#0F294D]'
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                    {badgeCount !== null && (
                      <span className="ml-0.5 rounded-full bg-[#1D4ED8] px-1.5 py-0.2 text-[10px] font-bold text-white">
                        {badgeCount}
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-[#4A6587]">
              <span className="inline-flex items-center gap-1">
                <Activity className="h-3.5 w-3.5 text-[#10B981]" />
                SSE Stream:{' '}
                <strong className="text-[#0F294D] capitalize">{streamStatus}</strong>
              </span>
              <span className="text-[#CBD9EC]">|</span>
              <span>
                Strict Site Scope:{' '}
                <code className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">
                  {selectedSiteId || '...'}
                </code>
              </span>
            </div>
          </div>
        </nav>

        {/* Mobile Collapsible Navigation */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="border-t border-[#DCE6F4] bg-white px-3 py-2 lg:hidden"
          >
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileMenuOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold ${
                        isActive
                          ? 'bg-[#DBEAFE] text-[#0F294D]'
                          : 'bg-[#F8FBFF] text-[#3A547A] hover:bg-[#EFF6FF]'
                      }`
                    }
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                );
              })}
            </div>
          </nav>
        )}
      </header>

      {/* Disconnected / Paused Site Notice */}
      <div className="mx-auto w-full max-w-[1680px] px-3 pt-2.5 sm:px-5">
        {streamStatus === 'disconnected' && (
          <div className="mb-2.5">
            <DisconnectedBanner
              reason="Real-time event stream disconnected. Reconnecting automatically via Server-Sent Events..."
              onReconnect={() => refreshAll()}
            />
          </div>
        )}
        {selectedSite?.status === 'disconnected' && (
          <div className="mb-2.5">
            <DisconnectedBanner
              reason={`Website "${selectedSite.domain}" is currently disconnected. Incoming SDK events are rejected until reconnected in Settings.`}
              onReconnect={() => navigate('/settings')}
            />
          </div>
        )}
      </div>

      {/* Page Main Content */}
      <main className="mx-auto flex-1 w-full max-w-[1680px] px-3 pb-6 pt-1 sm:px-5">
        {children}
      </main>

      {/* Ctrl+K Global Search Modal */}
      {globalSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-[#0F294D]/35 p-4 pt-20 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Global workspace search"
          onClick={() => setGlobalSearchOpen(false)}
        >
          <div
            className="w-full max-w-xl overflow-hidden rounded-xl border border-[#CBD9EC] bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 border-b border-[#DCE6F4] px-4 py-3">
              <Search className="h-4 w-4 text-[#1D6FE8]" />
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search discovered pages, anonymous visitor IDs, or recent events..."
                className="w-full text-sm text-[#0F294D] placeholder:text-[#647D9E] focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setGlobalSearchOpen(false)}
                className="rounded border border-[#CBD9EC] px-1.5 py-0.5 text-[10px] font-semibold text-[#4A6587]"
              >
                ESC
              </button>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-[#EEF4FC] p-3">
              <div className="pb-2.5">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#647D9E]">
                  Discovered Pages ({searchResults.pages.length})
                </div>
                {searchResults.pages.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-[#647D9E]">No matching pages</div>
                ) : (
                  searchResults.pages.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setSelectedPagePath(p.path);
                        setGlobalSearchOpen(false);
                        navigate('/live');
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#EFF6FF]"
                    >
                      <span>
                        <strong className="text-[#0F294D]">{p.label}</strong>{' '}
                        <code className="text-[11px] text-[#4A6587]">{p.path}</code>
                      </span>
                      <span className="text-[11px] font-medium text-[#4A6587]">
                        {p.views.toLocaleString()} views
                      </span>
                    </button>
                  ))
                )}
              </div>

              <div className="py-2.5">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#647D9E]">
                  Anonymous Visitors ({searchResults.visitors.length})
                </div>
                {searchResults.visitors.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-[#647D9E]">No matching visitors</div>
                ) : (
                  searchResults.visitors.map((v) => (
                    <button
                      key={v.anonSessionId}
                      type="button"
                      onClick={() => {
                        setSelectedVisitorId(v.anonSessionId);
                        setGlobalSearchOpen(false);
                        navigate('/live');
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#EFF6FF]"
                    >
                      <span className="flex items-center gap-2">
                        <code className="font-semibold text-[#1D4ED8]">{v.anonSessionId}</code>
                        <span className="text-[#4A6587]">{v.region}</span>
                        {v.isDemo && (
                          <span className="rounded bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-semibold text-[#1D4ED8]">
                            Demo
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] font-medium text-[#0F294D]">{v.currentLabel}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="pt-2.5">
                <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-[#647D9E]">
                  Recent Events ({searchResults.events.length})
                </div>
                {searchResults.events.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-[#647D9E]">No matching events</div>
                ) : (
                  searchResults.events.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setSelectedVisitorId(ev.anonSessionId);
                        setGlobalSearchOpen(false);
                        navigate('/live');
                      }}
                      className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs hover:bg-[#EFF6FF]"
                    >
                      <span>
                        <strong className="text-[#0F294D]">{ev.sourceLabel}</strong> · {ev.eventType}
                      </span>
                      <code className="text-[11px] text-[#4A6587]">{ev.anonSessionId}</code>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
