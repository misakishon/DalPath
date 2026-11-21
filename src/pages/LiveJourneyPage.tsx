import React from 'react';
import { Eye, Layers, ShieldCheck, Users, Zap } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { KpiCard } from '../components/KpiCard';
import { SitePageTree } from '../components/SitePageTree';
import { TopologyCanvas } from '../components/TopologyCanvas';
import { VisitorDetailsPanel } from '../components/VisitorDetailsPanel';
import { LiveEventTable } from '../components/LiveEventTable';
import { ErrorState, LoadingSkeleton } from '../components/StateFeedback';

export function LiveJourneyPage() {
  const {
    selectedSite,
    pages,
    visitors,
    events,
    bufferedEvents,
    analytics,
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
    loading,
    error,
    refreshAll,
    lastAnimatedEvent,
  } = useWorkspace();

  if (error) {
    return <ErrorState message={error} onRetry={refreshAll} />;
  }

  if (loading && !analytics) {
    return <LoadingSkeleton rows={7} label="Connecting to real-time visitor topology..." />;
  }

  const selectedVisitor =
    visitors.find((v) => v.anonSessionId === selectedVisitorId) || visitors[0] || null;

  const kpis = analytics?.kpis;
  const hasLiveEvents = (selectedSite?.liveEventCount || 0) > 0;

  return (
    <div className="space-y-3">
      {/* Main 3-Column Topology Workspace matching visual reference */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {/* Left: Site-Page Tree */}
        <div className="min-w-0 lg:col-span-3 xl:col-span-2 min-h-[420px]">
          <SitePageTree
            site={selectedSite}
            pages={pages}
            selectedPath={selectedPagePath}
            onSelectPath={setSelectedPagePath}
            onPagesChanged={refreshAll}
          />
        </div>

        {/* Center: 5 KPI Cards + Interactive Topology Canvas */}
        <div className="flex min-w-0 flex-col gap-3 lg:col-span-6 xl:col-span-7">
          <div className="ufa-kpi-row-wrap">
            <div className="ufa-kpi-row">
              <KpiCard
                icon={<Users className="h-4 w-4" />}
                label="Active Visitors"
                value={kpis?.activeVisitors ?? 0}
                delta={kpis?.deltas.activeVisitors}
                accent="blue"
              />
              <KpiCard
                icon={<Layers className="h-4 w-4" />}
                label="Sessions"
                value={(kpis?.sessions ?? 0).toLocaleString()}
                delta={kpis?.deltas.sessions}
                accent="blue"
              />
              <KpiCard
                icon={<Eye className="h-4 w-4" />}
                label="Page Views"
                value={(kpis?.pageViewsInRange ?? 0).toLocaleString()}
                delta={kpis?.deltas.pageViews}
                accent="blue"
              />
              <KpiCard
                icon={<Zap className="h-4 w-4" />}
                label="Avg. Latency"
                value={`${kpis?.avgLatencyMs ?? 78} ms`}
                sparkline={analytics?.latencySeries}
                accent="teal"
              />
              <KpiCard
                icon={<ShieldCheck className="h-4 w-4" />}
                label="Event Success"
                value={`${kpis?.eventSuccessRate ?? 99.9}%`}
                sparkline={analytics?.successSeries}
                accent="teal"
              />
            </div>
          </div>

          <TopologyCanvas
            pages={pages}
            visitors={visitors}
            selectedVisitorId={selectedVisitor?.anonSessionId || null}
            onSelectVisitor={setSelectedVisitorId}
            selectedPagePath={selectedPagePath}
            onSelectPage={setSelectedPagePath}
            lastAnimatedEvent={lastAnimatedEvent}
            isDemoMode={Boolean(selectedSite?.demoMode)}
            hasLiveEvents={hasLiveEvents}
          />
        </div>

        {/* Right: Selected Visitor Details */}
        <div className="min-w-0 lg:col-span-3 xl:col-span-3 min-h-[420px]">
          <VisitorDetailsPanel visitor={selectedVisitor} />
        </div>
      </div>

      {/* Bottom: Searchable, Filterable Live Event Flow */}
      <LiveEventTable
        events={events}
        bufferedCount={bufferedEvents.length}
        pages={pages}
        selectedVisitorId={selectedVisitor?.anonSessionId || null}
        onSelectVisitor={setSelectedVisitorId}
        isPaused={isPaused}
        onTogglePause={() => setIsPaused(!isPaused)}
        onStep={stepNextBufferedEvent}
        onReset={resetEventStream}
        playbackSpeed={playbackSpeed}
        onChangeSpeed={setPlaybackSpeed}
        demoMode={Boolean(selectedSite?.demoMode)}
      />
    </div>
  );
}
