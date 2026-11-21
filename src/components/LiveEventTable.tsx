import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ListFilter,
  Pause,
  Play,
  RotateCcw,
  Search,
  ShieldAlert,
  SkipForward,
} from 'lucide-react';
import type { DiscoveredPage, FlowEvent } from '../types/analytics';
import { formatTimeHms } from '../api/client';

interface LiveEventTableProps {
  events: FlowEvent[];
  bufferedCount: number;
  pages: DiscoveredPage[];
  selectedVisitorId: string | null;
  onSelectVisitor: (sessionId: string) => void;
  isPaused: boolean;
  onTogglePause: () => void;
  onStep: () => void;
  onReset: () => void;
  playbackSpeed: number;
  onChangeSpeed: (speed: number) => void;
  demoMode: boolean;
}

const EVENT_TYPES = [
  'all',
  'Page View',
  'SPA Navigation',
  'Session Start',
  'Auth Metadata',
  'Session End',
];

export function LiveEventTable({
  events,
  bufferedCount,
  pages,
  selectedVisitorId,
  onSelectVisitor,
  isPaused,
  onTogglePause,
  onStep,
  onReset,
  playbackSpeed,
  onChangeSpeed,
  demoMode,
}: LiveEventTableProps) {
  const [eventTypeFilter, setEventTypeFilter] = useState('all');
  const [pageFilter, setPageFilter] = useState('all');
  const [originFilter, setOriginFilter] = useState<'all' | 'live' | 'demo'>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (eventTypeFilter !== 'all' && e.eventType !== eventTypeFilter) return false;
      if (pageFilter !== 'all' && e.sourcePath !== pageFilter) return false;
      if (originFilter === 'live' && e.isDemo) return false;
      if (originFilter === 'demo' && !e.isDemo) return false;
      if (!q) return true;
      return (
        e.sourceLabel.toLowerCase().includes(q) ||
        e.sourcePath.toLowerCase().includes(q) ||
        e.anonSessionId.toLowerCase().includes(q) ||
        e.eventType.toLowerCase().includes(q) ||
        e.status.toLowerCase().includes(q)
      );
    });
  }, [events, eventTypeFilter, pageFilter, originFilter, search]);

  const liveCount = events.filter((e) => !e.isDemo).length;
  const demoCount = events.filter((e) => e.isDemo).length;

  return (
    <section aria-label="Live event flow table" className="ufa-card overflow-hidden">
      {/* Header & Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[#E6EEF8] bg-[#FAFDFE] px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <ListFilter className="h-4 w-4 text-[#1D6FE8]" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0F294D]">
            LIVE EVENT FLOW
          </h2>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
              isPaused
                ? 'bg-[#EEF2FF] text-[#3730A3]'
                : 'bg-[#ECFDF5] text-[#047857]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                isPaused ? 'bg-[#6366F1]' : 'bg-[#10B981] animate-live-dot'
              }`}
            />
            {isPaused ? `Paused (${bufferedCount} queued)` : 'Live'}
          </span>

          {demoCount > 0 && (
            <span className="rounded-full border border-[#BFD3EC] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
              {liveCount > 0 ? `${liveCount} Live · ${demoCount} Demo` : 'Seeded Demo Data'}
            </span>
          )}
          {!demoMode && liveCount === 0 && demoCount === 0 && (
            <span className="text-[11px] text-[#4A6587]">Awaiting live SDK events</span>
          )}
        </div>

        {/* Filters & Playback Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Filter by event type"
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            className="h-8 rounded-lg border border-[#CBD9EC] bg-white px-2.5 text-xs font-medium text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none"
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t === 'all' ? 'All Events' : t}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by page"
            value={pageFilter}
            onChange={(e) => setPageFilter(e.target.value)}
            className="h-8 rounded-lg border border-[#CBD9EC] bg-white px-2.5 text-xs font-medium text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none"
          >
            <option value="all">All Pages</option>
            {pages.map((p) => (
              <option key={p.id} value={p.path}>
                {p.label} ({p.path})
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by data source"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as 'all' | 'live' | 'demo')}
            className="h-8 rounded-lg border border-[#CBD9EC] bg-white px-2 text-xs font-medium text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none"
          >
            <option value="all">All Sources</option>
            <option value="live">Live SDK Only</option>
            <option value="demo">Demo Only</option>
          </select>

          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#647D9E]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search events (page, session, ...)"
              aria-label="Search live events"
              className="h-8 w-44 rounded-lg border border-[#CBD9EC] bg-white pl-8 pr-2.5 text-xs text-[#0F294D] placeholder:text-[#647D9E] focus:border-[#1D6FE8] focus:outline-none sm:w-52"
            />
          </div>

          <button
            type="button"
            onClick={onTogglePause}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#0F294D] px-3 text-xs font-bold text-white hover:bg-[#1E3A63]"
          >
            {isPaused ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
            {isPaused ? 'RESUME' : 'PAUSE'}
          </button>

          <button
            type="button"
            onClick={onStep}
            title="Step through next event for inspection"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD9EC] bg-white px-2.5 text-xs font-bold text-[#0F294D] hover:bg-[#EFF6FF]"
          >
            <SkipForward className="h-3.5 w-3.5 text-[#1D6FE8]" />
            STEP
          </button>

          <button
            type="button"
            onClick={() => {
              setEventTypeFilter('all');
              setPageFilter('all');
              setOriginFilter('all');
              setSearch('');
              onReset();
            }}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#CBD9EC] bg-white px-2.5 text-xs font-bold text-[#0F294D] hover:bg-[#EFF6FF]"
          >
            <RotateCcw className="h-3.5 w-3.5 text-[#4A6587]" />
            RESET
          </button>

          <select
            aria-label="Event review speed"
            value={playbackSpeed}
            onChange={(e) => onChangeSpeed(Number(e.target.value))}
            className="h-8 rounded-lg border border-[#CBD9EC] bg-white px-2 text-xs font-bold text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none"
          >
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="max-h-[260px] overflow-auto">
        <table className="w-full min-w-[780px] border-collapse text-left text-xs">
          <thead className="sticky top-0 z-10 bg-[#F4F8FE] text-[10px] font-bold uppercase tracking-wider text-[#4A6587]">
            <tr className="border-b border-[#DCE6F4]">
              <th className="px-3.5 py-2 w-12">#</th>
              <th className="px-3 py-2 w-24">TIME</th>
              <th className="px-3 py-2">SOURCE / PAGE</th>
              <th className="px-3 py-2">DESTINATION / DATABASE</th>
              <th className="px-3 py-2">EVENT TYPE</th>
              <th className="px-3 py-2">VISITOR / SESSION ID</th>
              <th className="px-3 py-2">SOURCE TAG</th>
              <th className="px-3.5 py-2 text-right">STATUS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#EEF4FC]">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-xs text-[#4A6587]">
                  No events match the current filters. Try clearing filters or sending a test page
                  view in Settings.
                </td>
              </tr>
            ) : (
              filtered.slice(0, 40).map((ev, index) => {
                const isSelected = ev.anonSessionId === selectedVisitorId;
                return (
                  <tr
                    key={ev.id}
                    onClick={() => onSelectVisitor(ev.anonSessionId)}
                    className={`cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#EFF6FF]' : 'hover:bg-[#F8FBFF]'
                    }`}
                  >
                    <td className="px-3.5 py-2 font-mono text-[11px] text-[#4A6587]">
                      <span className="inline-flex items-center gap-2">
                        <span
                          className={`h-2 w-2 rounded-full ${
                            ev.status === 'Alert' ? 'bg-[#E11D48]' : 'bg-[#10B981]'
                          }`}
                        />
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-3 py-2 font-mono font-medium text-[#1E3A63] tabular-nums">
                      {formatTimeHms(ev.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-semibold text-[#0F294D]">{ev.sourceLabel}</span>{' '}
                      <code className="text-[10px] text-[#647D9E]">{ev.sourcePath}</code>
                    </td>
                    <td className="px-3 py-2 text-[#3A547A]">{ev.destination}</td>
                    <td className="px-3 py-2 font-medium text-[#0F294D]">{ev.eventType}</td>
                    <td className="px-3 py-2 font-mono font-semibold text-[#1D4ED8]">
                      {ev.anonSessionId}
                    </td>
                    <td className="px-3 py-2">
                      {ev.isDemo ? (
                        <span className="inline-flex items-center rounded border border-[#BFD3EC] bg-[#EFF6FF] px-1.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                          Demo
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded border border-[#A7F3D0] bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]">
                          Live SDK
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-2 text-right">
                      {ev.status === 'Alert' ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#FECDD3] bg-[#FFF1F2] px-2.5 py-0.5 text-[11px] font-semibold text-[#BE123C]">
                          <ShieldAlert className="h-3 w-3" />
                          Alert
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-semibold text-[#047857]">
                          <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                          {ev.status}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
