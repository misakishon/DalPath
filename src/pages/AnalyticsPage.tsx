import React from 'react';
import { ArrowRight, BarChart3, LogIn, LogOut, Route } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import type { TimeRange } from '../types/analytics';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateFeedback';

export function AnalyticsPage() {
  const { analytics, timeRange, setTimeRange, selectedSite, loading, error, refreshAll } =
    useWorkspace();

  if (error) return <ErrorState message={error} onRetry={refreshAll} />;
  if (loading && !analytics) return <LoadingSkeleton rows={6} label="Computing flow analytics..." />;

  const trend = analytics?.trend || [];
  const popular = analytics?.popularPages || [];
  const entryPages = analytics?.entryPages || [];
  const exitPages = analytics?.exitPages || [];
  const commonPaths = analytics?.commonPaths || [];
  const maxTrend = Math.max(1, ...trend.map((t) => Math.max(t.pageViews, t.visitors)));
  const maxPopular = Math.max(1, ...popular.map((p) => p.views));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0F294D]">Analytics &amp; Path Insights</h1>
          <p className="text-xs text-[#4A6587]">
            Date-filtered traffic trends, popular discovered pages, entry/exit pages, and common
            multi-step visitor journeys for <strong className="text-[#0F294D]">{selectedSite?.domain}</strong>.
          </p>
        </div>

        {/* Date-range quick switcher */}
        <div className="inline-flex rounded-lg border border-[#CBD9EC] bg-white p-0.5 text-xs">
          {(
            [
              ['1h', '1H'],
              ['24h', '24H'],
              ['7d', '7D'],
              ['30d', '30D'],
            ] as Array<[TimeRange, string]>
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTimeRange(val)}
              className={`rounded-md px-3 py-1 font-bold transition-colors ${
                timeRange === val
                  ? 'bg-[#1D6FE8] text-white'
                  : 'text-[#3A547A] hover:bg-[#EFF6FF]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="ufa-card p-4 lg:col-span-7">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#1D6FE8]" />
              <h2 className="text-sm font-bold text-[#0F294D]">Visitors &amp; Page Views Over Time</h2>
            </div>
            <span className="text-[11px] font-semibold text-[#4A6587]">
              {analytics?.kpis.pageViewsInRange || 0} events in window
            </span>
          </div>

          {trend.length === 0 ? (
            <EmptyState
              title="No data in selected date range"
              description="Try expanding the date range or generating live events."
            />
          ) : (
            <svg viewBox="0 0 640 220" className="h-56 w-full" role="img" aria-label="Visitors and page views chart">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = 185 - f * 150;
                return (
                  <g key={f}>
                    <line x1="34" y1={y} x2="624" y2={y} stroke="#E6EEF8" strokeWidth="1" />
                    <text x="28" y={y + 3} textAnchor="end" fontSize="9.5" fill="#647D9E">
                      {Math.round(maxTrend * f)}
                    </text>
                  </g>
                );
              })}

              {/* Area under Page Views */}
              <path
                d={`${trend
                  .map((pt, i) => {
                    const x = 44 + (i / Math.max(1, trend.length - 1)) * 570;
                    const y = 185 - (pt.pageViews / maxTrend) * 150;
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ')} L 614 185 L 44 185 Z`}
                fill="#1D6FE8"
                fillOpacity="0.1"
              />
              {/* Page Views line */}
              <path
                d={trend
                  .map((pt, i) => {
                    const x = 44 + (i / Math.max(1, trend.length - 1)) * 570;
                    const y = 185 - (pt.pageViews / maxTrend) * 150;
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#1D6FE8"
                strokeWidth="2.4"
              />
              {/* Visitors teal dashed line */}
              <path
                d={trend
                  .map((pt, i) => {
                    const x = 44 + (i / Math.max(1, trend.length - 1)) * 570;
                    const y = 185 - (pt.visitors / maxTrend) * 150;
                    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
                  })
                  .join(' ')}
                fill="none"
                stroke="#10B981"
                strokeWidth="2.2"
                strokeDasharray="5 3"
              />
              {trend.map((pt, i) => {
                const x = 44 + (i / Math.max(1, trend.length - 1)) * 570;
                const yPv = 185 - (pt.pageViews / maxTrend) * 150;
                return (
                  <g key={pt.label + i}>
                    <circle cx={x} cy={yPv} r="3.4" fill="#1D6FE8" />
                    <text x={x} y="204" textAnchor="middle" fontSize="9.5" fill="#4A6587">
                      {pt.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          )}
        </section>

        {/* Popular Pages Breakdown */}
        <section className="ufa-card p-4 lg:col-span-5">
          <h2 className="mb-3 text-sm font-bold text-[#0F294D]">Popular Pages</h2>
          {popular.length === 0 ? (
            <EmptyState title="No pages yet" description="Pages will populate once traffic arrives." />
          ) : (
            <div className="space-y-3">
              {popular.map((p) => (
                <div key={p.path}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#0F294D]">
                      {p.label}{' '}
                      <code className="font-normal text-[10px] text-[#647D9E]">{p.path}</code>
                    </span>
                    <span className="font-mono font-bold text-[#0F294D] tabular-nums">
                      {p.views.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#EFF5FC]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#1D6FE8] to-[#3B82F6]"
                      style={{ width: `${Math.max(6, Math.round((p.views / maxPopular) * 100))}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Entry Pages, Exit Pages, and Common Visitor Paths */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="ufa-card p-4 lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <LogIn className="h-4 w-4 text-[#10B981]" />
            <h2 className="text-sm font-bold text-[#0F294D]">Top Entry Pages</h2>
          </div>
          {entryPages.length === 0 ? (
            <p className="text-xs text-[#4A6587]">No session entry data yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {entryPages.slice(0, 6).map((ep) => (
                <li
                  key={ep.path}
                  className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#FAFDFE] px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-[#0F294D]">{ep.label}</div>
                    <code className="text-[10px] text-[#647D9E]">{ep.path}</code>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#0F294D]">{ep.sessions}</div>
                    <div className="text-[10px] font-semibold text-[#047857]">{ep.sharePct}% share</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ufa-card p-4 lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <LogOut className="h-4 w-4 text-[#1D6FE8]" />
            <h2 className="text-sm font-bold text-[#0F294D]">Top Exit Pages</h2>
          </div>
          {exitPages.length === 0 ? (
            <p className="text-xs text-[#4A6587]">No session exit data yet.</p>
          ) : (
            <ul className="space-y-2 text-xs">
              {exitPages.slice(0, 6).map((ex) => (
                <li
                  key={ex.path}
                  className="flex items-center justify-between rounded-lg border border-[#E6EEF8] bg-[#FAFDFE] px-3 py-2"
                >
                  <div>
                    <div className="font-semibold text-[#0F294D]">{ex.label}</div>
                    <code className="text-[10px] text-[#647D9E]">{ex.path}</code>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold text-[#0F294D]">{ex.sessions}</div>
                    <div className="text-[10px] font-semibold text-[#1D4ED8]">{ex.sharePct}% exits</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="ufa-card p-4 lg:col-span-4">
          <div className="mb-3 flex items-center gap-2">
            <Route className="h-4 w-4 text-[#1D6FE8]" />
            <h2 className="text-sm font-bold text-[#0F294D]">Common Page Paths</h2>
          </div>
          {commonPaths.length === 0 ? (
            <p className="text-xs text-[#4A6587]">Multi-step journeys will appear as visitors navigate.</p>
          ) : (
            <ul className="space-y-2.5 text-xs">
              {commonPaths.map((cp) => (
                <li
                  key={cp.sequence}
                  className="rounded-lg border border-[#DCE6F4] bg-[#F8FBFF] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-1 font-semibold text-[#0F294D]">
                    {cp.steps.map((step, i) => (
                      <React.Fragment key={`${step}-${i}`}>
                        <span className="rounded border border-[#BFD3EC] bg-white px-1.5 py-0.5 text-[11px]">
                          {step}
                        </span>
                        {i < cp.steps.length - 1 && (
                          <ArrowRight className="h-3 w-3 text-[#1D6FE8]" />
                        )}
                      </React.Fragment>
                    ))}
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#4A6587]">
                    <span>{cp.sessions} session(s)</span>
                    <span className="font-semibold text-[#047857]">{cp.sharePct}% of traffic</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
