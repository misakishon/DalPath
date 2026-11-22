import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Monitor, Network, Search, Smartphone, Tablet, Users } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { VisitorDetailsPanel } from '../components/VisitorDetailsPanel';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateFeedback';
import { formatDuration, formatRelativeTime } from '../api/client';

export function VisitorsPage() {
  const navigate = useNavigate();
  const {
    visitors,
    selectedVisitorId,
    setSelectedVisitorId,
    loading,
    error,
    refreshAll,
  } = useWorkspace();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'ended'>('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'live' | 'demo'>('all');

  const regions = useMemo(() => {
    return Array.from(new Set(visitors.map((v) => v.region))).sort();
  }, [visitors]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visitors.filter((v) => {
      if (statusFilter === 'active' && !v.isActive) return false;
      if (statusFilter === 'ended' && v.isActive) return false;
      if (regionFilter !== 'all' && v.region !== regionFilter) return false;
      if (originFilter === 'live' && v.isDemo) return false;
      if (originFilter === 'demo' && !v.isDemo) return false;
      if (!q) return true;
      return (
        v.anonSessionId.toLowerCase().includes(q) ||
        v.region.toLowerCase().includes(q) ||
        v.currentLabel.toLowerCase().includes(q) ||
        v.maskedIp.toLowerCase().includes(q) ||
        v.routeLabels.join(' ').toLowerCase().includes(q)
      );
    });
  }, [visitors, search, statusFilter, regionFilter, originFilter]);

  if (error) return <ErrorState message={error} onRetry={refreshAll} />;
  if (loading && visitors.length === 0) return <LoadingSkeleton rows={6} label="Loading visitor sessions..." />;

  const selectedVisitor =
    filtered.find((v) => v.anonSessionId === selectedVisitorId) || filtered[0] || null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0F294D]">Anonymous Visitor Sessions</h1>
          <p className="text-xs text-[#4A6587]">
            First-party anonymous sessions with masked IPs and approximate regions. Zero credentials
            or form inputs stored.
          </p>
        </div>
        {selectedVisitor && (
          <button
            type="button"
            onClick={() => {
              setSelectedVisitorId(selectedVisitor.anonSessionId);
              navigate('/live');
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#1D6FE8] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#1D4ED8]"
          >
            <Network className="h-3.5 w-3.5" />
            Inspect {selectedVisitor.anonSessionId} on Topology
          </button>
        )}
      </div>

      {/* Filters Toolbar */}
      <div className="ufa-card flex flex-wrap items-center gap-2.5 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#647D9E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search session ID, masked IP, region, or page..."
            className="h-9 w-full rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] pl-8 pr-3 text-xs text-[#0F294D] focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by session status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'ended')}
          className="h-9 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active (Live)</option>
          <option value="ended">Ended</option>
        </select>

        <select
          aria-label="Filter by region"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D]"
        >
          <option value="all">All Regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by data source"
          value={originFilter}
          onChange={(e) => setOriginFilter(e.target.value as 'all' | 'live' | 'demo')}
          className="h-9 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D]"
        >
          <option value="all">Live &amp; Demo</option>
          <option value="live">Live SDK Only</option>
          <option value="demo">Demo Only</option>
        </select>
      </div>

      {/* Split View: Session List + Detailed Inspector */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12 lg:items-start">
        <div className="ufa-card overflow-hidden lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[#E6EEF8] bg-[#FAFDFE] px-4 py-2.5">
            <span className="inline-flex items-center gap-2 text-xs font-bold text-[#0F294D]">
              <Users className="h-4 w-4 text-[#1D6FE8]" />
              Sessions ({filtered.length})
            </span>
            <span className="text-[11px] text-[#4A6587]">Select a row to inspect timeline</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                title="No visitor sessions match your filters"
                description="Try clearing search or region filters, or generate a live test session."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] border-collapse text-left text-xs">
                <thead className="bg-[#F4F8FE] text-[10px] font-bold uppercase tracking-wider text-[#4A6587]">
                  <tr className="border-b border-[#DCE6F4]">
                    <th className="px-4 py-2.5">Session ID</th>
                    <th className="px-3 py-2.5">Masked IP &amp; Region</th>
                    <th className="px-3 py-2.5">Route Journey</th>
                    <th className="px-3 py-2.5">Duration</th>
                    <th className="px-3 py-2.5">Last Seen</th>
                    <th className="px-4 py-2.5 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EEF4FC]">
                  {filtered.map((v) => {
                    const isSel = selectedVisitor?.anonSessionId === v.anonSessionId;
                    const DevIcon =
                      v.deviceType === 'mobile'
                        ? Smartphone
                        : v.deviceType === 'tablet'
                          ? Tablet
                          : Monitor;
                    return (
                      <tr
                        key={v.anonSessionId}
                        onClick={() => setSelectedVisitorId(v.anonSessionId)}
                        className={`cursor-pointer transition-colors ${
                          isSel ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FBFF]'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <DevIcon className="h-3.5 w-3.5 text-[#1D6FE8]" />
                            <code className="font-mono font-bold text-[#0F294D]">
                              {v.anonSessionId}
                            </code>
                            {v.isDemo && (
                              <span className="rounded bg-[#EFF6FF] px-1.5 py-0.2 text-[10px] font-bold text-[#1D4ED8]">
                                Demo
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="font-mono text-[11px] text-[#1E3A63]">{v.maskedIp}</div>
                          <div className="text-[11px] text-[#4A6587]">{v.region}</div>
                        </td>
                        <td className="px-3 py-2.5 max-w-[230px]">
                          <div className="truncate font-semibold text-[#1D4ED8]">
                            {v.routeLabels.join(' → ')}
                          </div>
                          <div className="text-[10px] text-[#647D9E]">
                            {v.pageViews} recorded events
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[#0F294D] tabular-nums">
                          {formatDuration(v.durationSec)}
                        </td>
                        <td className="px-3 py-2.5 text-[#4A6587]">
                          {formatRelativeTime(v.lastSeenAt)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              v.isActive
                                ? 'bg-[#ECFDF5] text-[#047857]'
                                : 'bg-[#F1F5F9] text-[#475569]'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                v.isActive ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
                              }`}
                            />
                            {v.isActive ? 'Live' : 'Ended'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="lg:sticky lg:top-[104px] lg:col-span-4">
          <VisitorDetailsPanel
            visitor={selectedVisitor}
            className="max-h-[560px] lg:max-h-[calc(100vh-7.5rem)]"
          />
        </div>
      </div>
    </div>
  );
}
