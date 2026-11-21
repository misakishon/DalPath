import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Eye,
  Globe,
  Layers,
  ShieldAlert,
  ShieldCheck,
  Users,
  Zap,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { KpiCard } from '../components/KpiCard';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateFeedback';
import { formatRelativeTime } from '../api/client';

export function DashboardPage() {
  const {
    selectedSite,
    analytics,
    securitySummary,
    securityEvents,
    streamStatus,
    loading,
    error,
    refreshAll,
  } = useWorkspace();

  if (error) return <ErrorState message={error} onRetry={refreshAll} />;
  if (loading && !analytics) return <LoadingSkeleton rows={6} label="Loading dashboard overview..." />;

  const kpis = analytics?.kpis;
  const trend = analytics?.trend || [];
  const popular = analytics?.popularPages || [];
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.pageViews, t.visitors)));
  const maxPopularViews = Math.max(1, ...popular.map((p) => p.views));

  return (
    <div className="space-y-4">
      {/* Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0F294D]">Dashboard Overview</h1>
          <p className="text-xs text-[#4A6587]">
            Traffic, discovered page engagement, SDK ingestion health, and security posture for{' '}
            <strong className="text-[#0F294D]">{selectedSite?.domain}</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/live"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D6FE8] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8]"
          >
            Open Live Topology
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Summary Grid */}
      <div className="ufa-kpi-row-wrap">
        <div className="ufa-kpi-row">
          <KpiCard
            icon={<Users className="h-4 w-4" />}
            label="Active Visitors"
            value={kpis?.activeVisitors ?? 0}
            delta={kpis?.deltas.activeVisitors}
          />
          <KpiCard
            icon={<Layers className="h-4 w-4" />}
            label="Total Sessions"
            value={(kpis?.sessions ?? 0).toLocaleString()}
            delta={kpis?.deltas.sessions}
          />
          <KpiCard
            icon={<Eye className="h-4 w-4" />}
            label="All-Time Page Views"
            value={(kpis?.totalPageViews ?? 0).toLocaleString()}
            delta={kpis?.deltas.pageViews}
          />
          <KpiCard
            icon={<Zap className="h-4 w-4" />}
            label="Avg. Ingest Latency"
            value={`${kpis?.avgLatencyMs ?? 78} ms`}
            sparkline={analytics?.latencySeries}
            accent="teal"
          />
          <KpiCard
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Event Success Rate"
            value={`${kpis?.eventSuccessRate ?? 99.9}%`}
            sparkline={analytics?.successSeries}
            accent="teal"
          />
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Visitor & Page-View Trend Chart */}
        <section className="ufa-card p-4 lg:col-span-8">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[#0F294D]">Visitor &amp; Page-View Trend</h2>
              <p className="text-[11px] text-[#4A6587]">
                Observed anonymous sessions and recorded page views across the selected window.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="inline-flex items-center gap-1.5 text-[#1D6FE8]">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#1D6FE8]" />
                Page Views
              </span>
              <span className="inline-flex items-center gap-1.5 text-[#059669]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10B981]" />
                Unique Visitors
              </span>
            </div>
          </div>

          {trend.length === 0 ? (
            <EmptyState
              title="No traffic recorded in this time range"
              description="Connect your website SDK or trigger a test event in Settings to see visitor trends."
            />
          ) : (
            <div className="overflow-x-auto">
              <svg viewBox="0 0 680 215" className="h-52 w-full min-w-[460px]" role="img" aria-label="Visitor and page view trend chart">
                {/* Horizontal gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                  const y = 180 - f * 145;
                  return (
                    <g key={f}>
                      <line x1="34" y1={y} x2="664" y2={y} stroke="#E6EEF8" strokeWidth="1" />
                      <text x="28" y={y + 3} textAnchor="end" fontSize="9.5" fill="#647D9E">
                        {Math.round(maxTrend * f)}
                      </text>
                    </g>
                  );
                })}

                {/* Page view bars */}
                {trend.map((pt, i) => {
                  const slotW = 620 / trend.length;
                  const x = 42 + i * slotW;
                  const barH = Math.max(4, (pt.pageViews / maxTrend) * 145);
                  return (
                    <g key={pt.label + i}>
                      <rect
                        x={x + slotW * 0.18}
                        y={180 - barH}
                        width={Math.max(10, slotW * 0.45)}
                        height={barH}
                        rx="4"
                        fill="#DBEAFE"
                        stroke="#1D6FE8"
                        strokeWidth="1.2"
                      />
                      <text
                        x={x + slotW * 0.4}
                        y="198"
                        textAnchor="middle"
                        fontSize="9.5"
                        fill="#4A6587"
                      >
                        {pt.label}
                      </text>
                    </g>
                  );
                })}

                {/* Unique visitors teal line */}
                <path
                  d={trend
                    .map((pt, i) => {
                      const slotW = 620 / trend.length;
                      const x = 42 + i * slotW + slotW * 0.4;
                      const y = 180 - (pt.visitors / maxTrend) * 145;
                      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {trend.map((pt, i) => {
                  const slotW = 620 / trend.length;
                  const x = 42 + i * slotW + slotW * 0.4;
                  const y = 180 - (pt.visitors / maxTrend) * 145;
                  return (
                    <circle
                      key={`dot-${i}`}
                      cx={x}
                      cy={y}
                      r="3.8"
                      fill="#FFFFFF"
                      stroke="#10B981"
                      strokeWidth="2"
                    />
                  );
                })}
              </svg>
            </div>
          )}
        </section>

        {/* Website Health & Ingestion Status */}
        <section className="ufa-card flex flex-col justify-between p-4 lg:col-span-4">
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#0F294D]">Website Health</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#047857]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                {selectedSite?.status === 'disconnected' ? 'Disconnected' : 'Healthy'}
              </span>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#F8FBFF] px-3 py-2">
                <dt className="inline-flex items-center gap-1.5 text-[#4A6587]">
                  <Globe className="h-3.5 w-3.5 text-[#1D6FE8]" />
                  Connected Domain
                </dt>
                <dd className="font-bold text-[#0F294D]">{selectedSite?.domain}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#F8FBFF] px-3 py-2">
                <dt className="inline-flex items-center gap-1.5 text-[#4A6587]">
                  <Activity className="h-3.5 w-3.5 text-[#10B981]" />
                  Real-time SSE Transport
                </dt>
                <dd className="font-bold capitalize text-[#047857]">{streamStatus}</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#F8FBFF] px-3 py-2">
                <dt className="text-[#4A6587]">Last Observed Event</dt>
                <dd className="font-semibold text-[#0F294D]">
                  {formatRelativeTime(selectedSite?.lastEventAt || null)}
                </dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#F8FBFF] px-3 py-2">
                <dt className="text-[#4A6587]">IP Masking &amp; PII Redaction</dt>
                <dd className="font-bold text-[#047857]">Enforced</dd>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#F8FBFF] px-3 py-2">
                <dt className="text-[#4A6587]">Data Origin Mix</dt>
                <dd className="font-semibold text-[#1D4ED8]">
                  {selectedSite?.liveEventCount || 0} Live · {selectedSite?.demoEventCount || 0} Demo
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#E6EEF8] pt-3 text-xs">
            <Link to="/pages" className="font-semibold text-[#1D6FE8] hover:underline">
              Manage Site Pages
            </Link>
            <Link to="/settings" className="font-semibold text-[#0F294D] hover:underline">
              SDK &amp; Privacy Settings →
            </Link>
          </div>
        </section>

        {/* Popular Discovered Pages */}
        <section className="ufa-card p-4 lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F294D]">Popular Pages</h2>
              <p className="text-[11px] text-[#4A6587]">Top discovered routes by total page views</p>
            </div>
            <Link to="/analytics" className="text-xs font-semibold text-[#1D6FE8] hover:underline">
              Full Analytics →
            </Link>
          </div>

          {popular.length === 0 ? (
            <EmptyState
              title="No pages discovered yet"
              description="Pages appear here automatically once the site SDK sends its first page view."
            />
          ) : (
            <div className="space-y-2.5">
              {popular.slice(0, 6).map((p) => {
                const widthPct = Math.max(8, Math.round((p.views / maxPopularViews) * 100));
                return (
                  <div key={p.path}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#0F294D]">
                        {p.label}{' '}
                        <code className="font-normal text-[11px] text-[#647D9E]">{p.path}</code>
                      </span>
                      <span className="font-mono font-semibold text-[#1E3A63] tabular-nums">
                        {p.views.toLocaleString()} views
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-[#EFF5FC]">
                      <div
                        className="h-full rounded-full bg-[#1D6FE8]"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Security Events */}
        <section className="ufa-card p-4 lg:col-span-6">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#0F294D]">Recent Security Events</h2>
              <p className="text-[11px] text-[#4A6587]">
                {securitySummary.openTotal} open alert(s) • Failed login bursts, rate spikes &amp;
                domain blocks
              </p>
            </div>
            <Link to="/security" className="text-xs font-semibold text-[#1D6FE8] hover:underline">
              View All →
            </Link>
          </div>

          {securityEvents.length === 0 ? (
            <EmptyState
              title="No security alerts recorded"
              description="All recent requests passed integration key, domain allowlist, and rate checks."
            />
          ) : (
            <div className="space-y-2">
              {securityEvents.slice(0, 4).map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-start justify-between gap-3 rounded-lg border border-[#DCE6F4] bg-[#FAFDFE] px-3 py-2.5 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-[#1D4ED8]" />
                      <span className="font-bold text-[#0F294D]">{ev.eventType}</span>
                      <span
                        className={`rounded-full px-2 py-0.2 text-[10px] font-bold ${
                          ev.severity === 'Critical'
                            ? 'bg-[#FFE4E6] text-[#9F1239]'
                            : ev.severity === 'High'
                              ? 'bg-[#E0E7FF] text-[#3730A3]'
                              : ev.severity === 'Medium'
                                ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                                : 'bg-[#ECFDF5] text-[#047857]'
                        }`}
                      >
                        {ev.severity}
                      </span>
                      {ev.isDemo && (
                        <span className="rounded bg-[#EFF6FF] px-1.5 py-0.2 text-[10px] font-semibold text-[#1D4ED8]">
                          Demo
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#4A6587]">{ev.summary}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-mono text-[10px] text-[#647D9E]">
                      {formatRelativeTime(ev.createdAt)}
                    </div>
                    <div className="mt-1 text-[10px] font-semibold text-[#3A547A]">{ev.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
