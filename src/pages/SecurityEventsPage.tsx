import React, { useMemo, useState } from 'react';
import { CheckCircle2, Search, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, formatRelativeTime, formatTimeHms } from '../api/client';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateFeedback';

export function SecurityEventsPage() {
  const { selectedSiteId, securitySummary, securityEvents, loading, error, refreshAll } =
    useWorkspace();

  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return securityEvents.filter((e) => {
      if (severityFilter !== 'all' && e.severity !== severityFilter) return false;
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (!q) return true;
      return (
        e.eventType.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.sourcePath.toLowerCase().includes(q) ||
        e.maskedIp.toLowerCase().includes(q) ||
        (e.anonSessionId || '').toLowerCase().includes(q)
      );
    });
  }, [securityEvents, severityFilter, statusFilter, search]);

  const handleStatusUpdate = async (id: number, status: 'Open' | 'Acknowledged' | 'Resolved') => {
    if (!selectedSiteId) return;
    setUpdatingId(id);
    try {
      await api.updateSecurityEventStatus(selectedSiteId, id, status);
      await refreshAll();
    } finally {
      setUpdatingId(null);
    }
  };

  if (error) return <ErrorState message={error} onRetry={refreshAll} />;
  if (loading && securityEvents.length === 0) {
    return <LoadingSkeleton rows={6} label="Loading security telemetry..." />;
  }

  // Strictly NO orange colors! Using rose-crimson, deep indigo, royal blue, and teal.
  const severityCards = [
    {
      level: 'Critical',
      count: securitySummary.Critical,
      badge: 'bg-[#FFE4E6] text-[#9F1239] border-[#FECDD3]',
      desc: 'Repeated failed logins & credential stuffing bursts',
    },
    {
      level: 'High',
      count: securitySummary.High,
      badge: 'bg-[#E0E7FF] text-[#3730A3] border-[#C7D2FE]',
      desc: 'Unusual request rates & invalid key attempts',
    },
    {
      level: 'Medium',
      count: securitySummary.Medium,
      badge: 'bg-[#DBEAFE] text-[#1D4ED8] border-[#BFDBFE]',
      desc: 'Disallowed origin domain blocks',
    },
    {
      level: 'Low',
      count: securitySummary.Low,
      badge: 'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
      desc: 'Informational validation & policy notices',
    },
  ] as const;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0F294D]">Security Events</h1>
          <p className="text-xs text-[#4A6587]">
            Automated anomaly detection for repeated failed logins, request-rate spikes, invalid
            integration keys, and unauthorized origin domains.
          </p>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">
          <ShieldCheck className="h-4 w-4 text-[#10B981]" />
          Credentials &amp; form payloads are never stored
        </div>
      </div>

      {/* Severity Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {severityCards.map((c) => {
          const active = severityFilter === c.level;
          return (
            <button
              key={c.level}
              type="button"
              onClick={() => setSeverityFilter(active ? 'all' : c.level)}
              className={`ufa-card p-4 text-left transition-all ${
                active ? 'ring-2 ring-[#1D6FE8]' : 'hover:border-[#93B4DF]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${c.badge}`}>
                  {c.level}
                </span>
                <span className="text-2xl font-extrabold text-[#0F294D] tabular-nums">{c.count}</span>
              </div>
              <p className="mt-2 text-[11px] text-[#4A6587]">{c.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Filter Toolbar */}
      <div className="ufa-card flex flex-wrap items-center gap-2.5 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#647D9E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search event type, route, masked IP, or summary..."
            className="h-9 w-full rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] pl-8 pr-3 text-xs text-[#0F294D] focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
          />
        </div>

        <select
          aria-label="Filter by severity"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D]"
        >
          <option value="all">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="High">High</option>
          <option value="Medium">Medium</option>
          <option value="Low">Low</option>
        </select>

        <select
          aria-label="Filter by workflow status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D]"
        >
          <option value="all">All Statuses</option>
          <option value="Open">Open</option>
          <option value="Acknowledged">Acknowledged</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* Security Event Table */}
      <div className="ufa-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No security events match your filter"
              description="Clear filters to view all recorded alerts, or simulate failed logins in the Connected Site Sandbox from Settings."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="bg-[#F4F8FE] text-[10px] font-bold uppercase tracking-wider text-[#4A6587]">
                <tr className="border-b border-[#DCE6F4]">
                  <th className="px-4 py-2.5">Severity</th>
                  <th className="px-3 py-2.5">Time</th>
                  <th className="px-3 py-2.5">Event Type &amp; Summary</th>
                  <th className="px-3 py-2.5">Route / Actor</th>
                  <th className="px-3 py-2.5">Origin</th>
                  <th className="px-4 py-2.5 text-right">Workflow Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF4FC]">
                {filtered.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#F8FBFF]">
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          ev.severity === 'Critical'
                            ? 'bg-[#FFE4E6] text-[#9F1239]'
                            : ev.severity === 'High'
                              ? 'bg-[#E0E7FF] text-[#3730A3]'
                              : ev.severity === 'Medium'
                                ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                                : 'bg-[#ECFDF5] text-[#047857]'
                        }`}
                      >
                        <ShieldAlert className="h-3 w-3" />
                        {ev.severity}
                      </span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="font-mono font-semibold text-[#0F294D]">
                        {formatTimeHms(ev.createdAt)}
                      </div>
                      <div className="text-[10px] text-[#647D9E]">
                        {formatRelativeTime(ev.createdAt)}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-md">
                      <div className="font-bold text-[#0F294D]">{ev.eventType}</div>
                      <div className="mt-0.5 text-[11px] text-[#4A6587]">{ev.summary}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-mono text-[11px] font-semibold text-[#1D4ED8]">
                        {ev.sourcePath}
                      </div>
                      <div className="font-mono text-[10px] text-[#4A6587]">
                        {ev.anonSessionId ? `${ev.anonSessionId} · ` : ''}
                        {ev.maskedIp}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      {ev.isDemo ? (
                        <span className="rounded border border-[#BFD3EC] bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                          Demo
                        </span>
                      ) : (
                        <span className="rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]">
                          Live
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {ev.status === 'Resolved' ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#047857]">
                            <CheckCircle2 className="h-3.5 w-3.5 text-[#10B981]" />
                            Resolved
                          </span>
                        ) : (
                          <>
                            {ev.status === 'Open' && (
                              <button
                                type="button"
                                disabled={updatingId === ev.id}
                                onClick={() => handleStatusUpdate(ev.id, 'Acknowledged')}
                                className="rounded-md border border-[#CBD9EC] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#0F294D] hover:bg-[#EFF6FF]"
                              >
                                Acknowledge
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={updatingId === ev.id}
                              onClick={() => handleStatusUpdate(ev.id, 'Resolved')}
                              className="rounded-md bg-[#0F294D] px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-[#1E3A63]"
                            >
                              Resolve
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
