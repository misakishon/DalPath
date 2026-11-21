import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Database,
  FileText,
  Filter,
  Hand,
  Maximize2,
  MousePointer2,
  Network,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { DiscoveredPage, FlowEvent, VisitorSession } from '../types/analytics';

interface TopologyCanvasProps {
  pages: DiscoveredPage[];
  visitors: VisitorSession[];
  selectedVisitorId: string | null;
  onSelectVisitor: (sessionId: string) => void;
  selectedPagePath: string | null;
  onSelectPage: (path: string | null) => void;
  lastAnimatedEvent: FlowEvent | null;
  isDemoMode: boolean;
  hasLiveEvents: boolean;
}

interface NodePos {
  x: number;
  y: number;
  page: DiscoveredPage;
}

const VIEW_W = 920;
const VIEW_H = 470;
const DB_POS = { x: 460, y: 368 };

function computeNodePositions(visiblePages: DiscoveredPage[]): Map<string, NodePos> {
  const map = new Map<string, NodePos>();
  if (visiblePages.length === 0) return map;

  // Classic reference-faithful arc layout for up to 6 pages; graceful arch/ring for any count
  const preset6: Array<{ x: number; y: number }> = [
    { x: 185, y: 205 }, // Home (left)
    { x: 350, y: 98 },  // About (top-left)
    { x: 475, y: 170 }, // Login (center-mid)
    { x: 695, y: 200 }, // Dashboard (right)
    { x: 190, y: 342 }, // Products (bottom-left)
    { x: 700, y: 342 }, // Support (bottom-right)
  ];

  // Prioritize familiar semantic ordering if standard paths exist, while staying 100% dynamic
  const ordered = [...visiblePages].sort((a, b) => {
    const rank = (p: string) => {
      if (p === '/') return 0;
      if (p.includes('about') || p.includes('catalog')) return 1;
      if (p.includes('login') || p.includes('pricing')) return 2;
      if (p.includes('dashboard') || p.includes('checkout')) return 3;
      if (p.includes('product') || p.includes('doc')) return 4;
      if (p.includes('support') || p.includes('account')) return 5;
      return 10;
    };
    const rDiff = rank(a.path) - rank(b.path);
    if (rDiff !== 0) return rDiff;
    return b.views - a.views;
  });

  if (ordered.length <= 6) {
    ordered.forEach((page, i) => {
      const slot = preset6[i] || { x: 460, y: 150 };
      map.set(page.path, { x: slot.x, y: slot.y, page });
    });
    return map;
  }

  // Dynamic upper-arch distribution for 7+ discovered pages so Database stays centered cleanly
  ordered.forEach((page, i) => {
    const t = ordered.length === 1 ? 0.5 : i / (ordered.length - 1);
    const angle = Math.PI * (0.95 - t * 0.9);
    const rx = 340;
    const ry = 215;
    const x = 460 + Math.cos(angle) * rx;
    const y = 305 - Math.sin(angle) * ry;
    map.set(page.path, { x, y, page });
  });
  return map;
}

function curvePath(x1: number, y1: number, x2: number, y2: number, lift = -32): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2 + lift;
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`;
}

function quadPoint(x1: number, y1: number, cx: number, cy: number, x2: number, y2: number, t: number) {
  const mt = 1 - t;
  return {
    x: mt * mt * x1 + 2 * mt * t * cx + t * t * x2,
    y: mt * mt * y1 + 2 * mt * t * cy + t * t * y2,
  };
}

function PageCardIcon({ path }: { path: string }) {
  if (path === '/') {
    return (
      <path
        d="M-8 2 L0 -6 L8 2 M-5 0 V7 H5 V0"
        fill="none"
        stroke="#0F294D"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }
  if (path.includes('login') || path.includes('auth') || path.includes('account')) {
    return (
      <g stroke="#0F294D" strokeWidth="1.8" fill="none">
        <rect x="-6" y="-1" width="12" height="8" rx="1.8" />
        <path d="M-3 -1 V-4 A3 3 0 0 1 3 -4 V-1" />
      </g>
    );
  }
  if (path.includes('dashboard') || path.includes('analytics')) {
    return (
      <g fill="#1D6FE8">
        <rect x="-7" y="-6" width="6" height="5" rx="1" />
        <rect x="1" y="-6" width="6" height="5" rx="1" fill="#0F294D" />
        <rect x="-7" y="1" width="6" height="5" rx="1" fill="#0F294D" />
        <rect x="1" y="1" width="6" height="5" rx="1" />
      </g>
    );
  }
  if (path.includes('product') || path.includes('catalog') || path.includes('checkout')) {
    return (
      <g stroke="#0F294D" strokeWidth="1.7" fill="none">
        <path d="M0 -7 L7 -3.5 V3.5 L0 7 L-7 3.5 V-3.5 Z" />
        <path d="M-7 -3.5 L0 0 L7 -3.5 M0 0 V7" />
      </g>
    );
  }
  if (path.includes('support') || path.includes('help')) {
    return (
      <text
        x="0"
        y="5"
        textAnchor="middle"
        fontSize="14"
        fontWeight="800"
        fill="#0F294D"
      >
        ?
      </text>
    );
  }
  return (
    <text x="0" y="5" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0F294D">
      i
    </text>
  );
}

export function TopologyCanvas({
  pages,
  visitors,
  selectedVisitorId,
  onSelectVisitor,
  selectedPagePath,
  onSelectPage,
  lastAnimatedEvent,
  isDemoMode,
  hasLiveEvents,
}: TopologyCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [toolMode, setToolMode] = useState<'select' | 'pan'>('select');
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  // Filter controls
  const [visitorFilter, setVisitorFilter] = useState<'all' | 'active' | 'selected' | 'live'>('active');
  const [showDbLines, setShowDbLines] = useState(true);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Smooth animation clock (0..1 looping for packets & visitor travel)
  const [tick, setTick] = useState(0);
  const [recentTransitions, setRecentTransitions] = useState<
    Array<{ id: number; sessionId: string; from: string; to: string; startedAt: number }>
  >([]);

  useEffect(() => {
    let frameId = 0;
    let start: number | null = null;
    const loop = (now: number) => {
      if (start === null) start = now;
      const elapsedSec = Math.max(0, (now - start) / 1000);
      setTick(elapsedSec % 1000);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!lastAnimatedEvent) return;
    if (lastAnimatedEvent.previousPath && lastAnimatedEvent.previousPath !== lastAnimatedEvent.sourcePath) {
      const entry = {
        id: lastAnimatedEvent.id,
        sessionId: lastAnimatedEvent.anonSessionId,
        from: lastAnimatedEvent.previousPath,
        to: lastAnimatedEvent.sourcePath,
        startedAt: performance.now(),
      };
      setRecentTransitions((prev) => [entry, ...prev.slice(0, 8)]);
    }
  }, [lastAnimatedEvent]);

  const visiblePages = useMemo(() => pages.filter((p) => !p.isHidden), [pages]);
  const nodePositions = useMemo(() => computeNodePositions(visiblePages), [visiblePages]);

  const displayedVisitors = useMemo(() => {
    let list = visitors;
    if (visitorFilter === 'active') list = list.filter((v) => v.isActive);
    if (visitorFilter === 'live') list = list.filter((v) => !v.isDemo);
    if (visitorFilter === 'selected' && selectedVisitorId) {
      list = list.filter((v) => v.anonSessionId === selectedVisitorId);
    }
    if (selectedPagePath) {
      list = list.filter(
        (v) => v.currentPath === selectedPagePath || v.routePaths.includes(selectedPagePath)
      );
    }
    return list.slice(0, 14);
  }, [visitors, visitorFilter, selectedVisitorId, selectedPagePath]);

  const selectedVisitor = useMemo(
    () => visitors.find((v) => v.anonSessionId === selectedVisitorId) || null,
    [visitors, selectedVisitorId]
  );

  // Build unique non-selected visitor route edges
  const otherEdges = useMemo(() => {
    const edgeSet = new Map<string, { from: string; to: string; count: number }>();
    for (const v of displayedVisitors) {
      if (v.anonSessionId === selectedVisitorId) continue;
      for (let i = 0; i < v.routePaths.length - 1; i++) {
        const a = v.routePaths[i];
        const b = v.routePaths[i + 1];
        if (!nodePositions.has(a) || !nodePositions.has(b) || a === b) continue;
        const key = `${a}->${b}`;
        const prev = edgeSet.get(key);
        edgeSet.set(key, { from: a, to: b, count: (prev?.count || 0) + 1 });
      }
    }
    return Array.from(edgeSet.values());
  }, [displayedVisitors, selectedVisitorId, nodePositions]);

  // Selected visitor sequential edges
  const selectedEdges = useMemo(() => {
    if (!selectedVisitor) return [];
    const segs: Array<{ from: string; to: string }> = [];
    for (let i = 0; i < selectedVisitor.routePaths.length - 1; i++) {
      const a = selectedVisitor.routePaths[i];
      const b = selectedVisitor.routePaths[i + 1];
      if (nodePositions.has(a) && nodePositions.has(b) && a !== b) {
        segs.push({ from: a, to: b });
      }
    }
    return segs;
  }, [selectedVisitor, nodePositions]);

  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (toolMode !== 'pan' && e.button !== 1) return;
    setDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragging) return;
    const dx = (e.clientX - dragStartRef.current.x) / zoom;
    const dy = (e.clientY - dragStartRef.current.y) / zoom;
    setPan({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setZoom((z) => Math.max(0.6, Math.min(1.85, Number((z + delta).toFixed(2)))));
  };

  // Compute animated visitor marker positions (either gliding along a route or orbiting gently beside current page)
  const nowPerf = performance.now();
  const markerPositions = useMemo(() => {
    const perPageCounter = new Map<string, number>();

    return displayedVisitors.map((v, idx) => {
      const isSelected = v.anonSessionId === selectedVisitorId;

      // Check if visitor has an active recent transition (2.6s smooth glide)
      const activeTrans = recentTransitions.find(
        (tr) => tr.sessionId === v.anonSessionId && nowPerf - tr.startedAt < 2600
      );
      if (activeTrans && nodePositions.has(activeTrans.from) && nodePositions.has(activeTrans.to)) {
        const a = nodePositions.get(activeTrans.from)!;
        const b = nodePositions.get(activeTrans.to)!;
        const p = Math.min(1, (nowPerf - activeTrans.startedAt) / 2600);
        const eased = 1 - Math.pow(1 - p, 3);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2 - 36;
        const pos = quadPoint(a.x, a.y, cx, cy, b.x, b.y, eased);
        return { visitor: v, x: pos.x, y: pos.y, isSelected, moving: true };
      }

      // If selected visitor has a multi-step route, smoothly animate their indicator along their route!
      if (isSelected && selectedEdges.length > 0) {
        const totalSegs = selectedEdges.length;
        const safeTick = Math.max(0, Number.isFinite(tick) ? tick : 0);
        const cycle = ((safeTick * 0.24) % totalSegs + totalSegs) % totalSegs;
        const segIdx = Math.max(0, Math.min(totalSegs - 1, Math.floor(cycle)));
        const segT = Math.max(0, Math.min(1, cycle - segIdx));
        const seg = selectedEdges[segIdx];
        const a = seg ? nodePositions.get(seg.from) : undefined;
        const b = seg ? nodePositions.get(seg.to) : undefined;
        if (a && b) {
          const cx = (a.x + b.x) / 2;
          const cy = (a.y + b.y) / 2 - 34;
          const pos = quadPoint(a.x, a.y, cx, cy, b.x, b.y, segT);
          return { visitor: v, x: pos.x, y: pos.y, isSelected, moving: true };
        }
      }

      // Otherwise position neatly on the outer flank of their current page (matching reference left/right visitor clusters)
      const node = nodePositions.get(v.currentPath) || Array.from(nodePositions.values())[0];
      if (!node) return { visitor: v, x: 120, y: 120, isSelected, moving: false };

      const slotIndex = perPageCounter.get(v.currentPath) || 0;
      perPageCounter.set(v.currentPath, slotIndex + 1);

      const isLeftHalf = node.x < VIEW_W / 2;
      const sideSign = isLeftHalf ? -1 : 1;
      const rowOffset = (slotIndex - 1) * 28;
      const colOffset = (slotIndex % 2) * 26;
      const gentleBob = Math.sin(tick * 1.4 + idx) * 2.5;

      return {
        visitor: v,
        x: node.x + sideSign * (76 + colOffset),
        y: node.y + rowOffset + gentleBob,
        isSelected,
        moving: false,
      };
    });
  }, [displayedVisitors, selectedVisitorId, recentTransitions, nowPerf, nodePositions, selectedEdges, tick]);

  const selectedMarker = markerPositions.find((m) => m.isSelected);

  return (
    <section
      aria-label="Website activity topology canvas"
      className="ufa-card flex flex-col overflow-hidden"
    >
      {/* Canvas Header + Interactive Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E6EEF8] px-4 py-2.5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Network className="h-4 w-4 text-[#1D6FE8]" />
            <h2 className="text-sm font-bold text-[#0F294D]">
              Website Activity Topology ({hasLiveEvents ? 'Live' : isDemoMode ? 'Demo' : 'Live'})
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10B981] animate-live-dot" />
              {hasLiveEvents ? 'Live' : 'Demo Stream'}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-[#4A6587]">
            Real-time visitor sessions across discovered site pages, with page-view/session metadata
            recorded to the database.
          </p>
        </div>

        {/* Zoom / Pan / Reset / Filter Controls */}
        <div className="relative flex items-center gap-1">
          <div className="inline-flex items-center rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] p-0.5">
            <button
              type="button"
              onClick={() => setToolMode('select')}
              title="Select visitor or page mode"
              aria-label="Select mode"
              className={`rounded-md p-1.5 ${
                toolMode === 'select'
                  ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                  : 'text-[#4A6587] hover:bg-white hover:text-[#0F294D]'
              }`}
            >
              <MousePointer2 className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setToolMode('pan')}
              title="Pan canvas (drag)"
              aria-label="Pan mode"
              className={`rounded-md p-1.5 ${
                toolMode === 'pan'
                  ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                  : 'text-[#4A6587] hover:bg-white hover:text-[#0F294D]'
              }`}
            >
              <Hand className="h-3.5 w-3.5" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-[#DCE6F4]" />
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(1.85, Number((z + 0.15).toFixed(2))))}
              title="Zoom in"
              aria-label="Zoom in"
              className="rounded-md p-1.5 text-[#4A6587] hover:bg-white hover:text-[#0F294D]"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
              title="Zoom out"
              aria-label="Zoom out"
              className="rounded-md p-1.5 text-[#4A6587] hover:bg-white hover:text-[#0F294D]"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={resetView}
              title="Reset zoom and pan"
              aria-label="Reset view"
              className="rounded-md p-1.5 text-[#4A6587] hover:bg-white hover:text-[#0F294D]"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setShowFilterMenu((v) => !v)}
            className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${
              showFilterMenu || visitorFilter !== 'active' || !showDbLines
                ? 'border-[#93C5FD] bg-[#DBEAFE] text-[#0F294D]'
                : 'border-[#CBD9EC] bg-white text-[#3A547A] hover:bg-[#F8FBFF]'
            }`}
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>

          {showFilterMenu && (
            <div className="absolute right-0 top-10 z-20 w-56 rounded-xl border border-[#CBD9EC] bg-white p-3 shadow-lg">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-[#647D9E]">
                Visitor Display
              </div>
              <div className="space-y-1 text-xs">
                {(
                  [
                    ['active', 'Active Sessions'],
                    ['all', 'All Recent Sessions'],
                    ['selected', 'Selected Visitor Only'],
                    ['live', 'Live SDK Only (Hide Demo)'],
                  ] as const
                ).map(([val, label]) => (
                  <label key={val} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 hover:bg-[#F4F8FE]">
                    <input
                      type="radio"
                      name="topo-visitor-filter"
                      checked={visitorFilter === val}
                      onChange={() => setVisitorFilter(val)}
                      className="accent-[#1D6FE8]"
                    />
                    <span className="text-[#0F294D]">{label}</span>
                  </label>
                ))}
              </div>
              <div className="mt-2.5 border-t border-[#E6EEF8] pt-2">
                <label className="flex cursor-pointer items-center gap-2 text-xs text-[#0F294D]">
                  <input
                    type="checkbox"
                    checked={showDbLines}
                    onChange={(e) => setShowDbLines(e.target.checked)}
                    className="accent-[#10B981]"
                  />
                  <span>Show DB metadata lines</span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive SVG Topology Stage */}
      <div className="relative flex-1 bg-gradient-to-b from-[#FAFDFE] via-[#F5FAFF] to-[#EEF5FE]">
        {visiblePages.length === 0 ? (
          <div className="flex h-[390px] flex-col items-center justify-center p-6 text-center">
            <Network className="mb-2 h-8 w-8 text-[#93B4DF]" />
            <p className="text-sm font-bold text-[#0F294D]">No Discovered Site Pages Yet</p>
            <p className="mt-1 max-w-sm text-xs text-[#4A6587]">
              Install the lightweight tracking script from Settings or trigger a test page view to
              discover routes and visualize real-time visitor journeys.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            className={`h-[395px] w-full select-none sm:h-[430px] ${
              toolMode === 'pan' ? (dragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
            }`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            role="img"
            aria-label="Interactive topology of discovered website pages, anonymous visitor routes, and metadata flow to database"
          >
            <defs>
              {/* Subtle blueprint grid */}
              <pattern id="ufaGrid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path
                  d="M 32 0 L 0 0 0 32"
                  fill="none"
                  stroke="#DCE8F8"
                  strokeWidth="0.6"
                  strokeOpacity="0.65"
                />
              </pattern>

              {/* Soft radial glow around central topology */}
              <radialGradient id="centerGlow" cx="50%" cy="46%" r="50%">
                <stop offset="0%" stopColor="#DBEAFE" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#F5FAFF" stopOpacity="0" />
              </radialGradient>

              {/* Arrowheads */}
              <marker
                id="arrowBlueStrong"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 8.5 5 L 0 8.5 z" fill="#1D6FE8" />
              </marker>
              <marker
                id="arrowSlate"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#89A7CE" />
              </marker>
              <marker
                id="arrowTeal"
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5.5"
                markerHeight="5.5"
                orient="auto-start-reverse"
              >
                <path d="M 0 2 L 8 5 L 0 8 z" fill="#10B981" />
              </marker>

              <filter id="cardShadow" x="-15%" y="-15%" width="130%" height="140%">
                <feDropShadow dx="0" dy="6" stdDeviation="5" floodColor="#1E3A8A" floodOpacity="0.11" />
              </filter>
            </defs>

            <rect width={VIEW_W} height={VIEW_H} fill="url(#ufaGrid)" />
            <rect width={VIEW_W} height={VIEW_H} fill="url(#centerGlow)" />

            <g
              transform={`translate(${VIEW_W / 2 + pan.x * zoom}, ${VIEW_H / 2 + pan.y * zoom}) scale(${zoom}) translate(${-VIEW_W / 2}, ${-VIEW_H / 2})`}
            >
              {/* 1. Separate Dashed Teal-Green Metadata Lines from Discovered Pages to Central Database */}
              {showDbLines &&
                Array.from(nodePositions.values()).map((node, idx) => {
                  const startX = node.x;
                  const startY = node.y + 34;
                  const endX = DB_POS.x + (node.x < DB_POS.x ? -22 : node.x > DB_POS.x ? 22 : 0);
                  const endY = DB_POS.y - 24;
                  const cx = (startX + endX) / 2;
                  const cy = Math.max(startY, endY) - 18;
                  const d = `M ${startX} ${startY} Q ${cx} ${cy} ${endX} ${endY}`;

                  // Animated event-record document packet (NOT a visitor marker!)
                  const packetT = (tick * 0.28 + idx * 0.19) % 1;
                  const packetPos = quadPoint(startX, startY, cx, cy, endX, endY, packetT);

                  return (
                    <g key={`db-${node.page.path}`}>
                      <path
                        d={d}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="1.75"
                        strokeDasharray="5 5"
                        strokeOpacity="0.82"
                        markerEnd="url(#arrowTeal)"
                        className="animate-dash-teal"
                      />
                      {/* Tiny recorded-event document icon gliding to Database */}
                      <g transform={`translate(${packetPos.x}, ${packetPos.y})`}>
                        <rect
                          x="-6"
                          y="-7"
                          width="12"
                          height="14"
                          rx="2"
                          fill="#ECFDF5"
                          stroke="#059669"
                          strokeWidth="1.2"
                        />
                        <line x1="-3" y1="-2" x2="3" y2="-2" stroke="#059669" strokeWidth="1" />
                        <line x1="-3" y1="1.5" x2="2" y2="1.5" stroke="#059669" strokeWidth="1" />
                      </g>
                    </g>
                  );
                })}

              {/* 2. Other Visitors' Directional Route Curves (thin blue-gray) */}
              {otherEdges.map((edge) => {
                const a = nodePositions.get(edge.from);
                const b = nodePositions.get(edge.to);
                if (!a || !b) return null;
                const d = curvePath(a.x, a.y, b.x, b.y, -28);
                return (
                  <path
                    key={`other-${edge.from}-${edge.to}`}
                    d={d}
                    fill="none"
                    stroke="#9AB5D8"
                    strokeWidth={Math.min(2.6, 1.3 + edge.count * 0.35)}
                    strokeOpacity="0.72"
                    markerEnd="url(#arrowSlate)"
                  />
                );
              })}

              {/* 3. Selected Visitor Highlighted Directional Route (thick vibrant blue) */}
              {selectedEdges.map((edge, idx) => {
                const a = nodePositions.get(edge.from);
                const b = nodePositions.get(edge.to);
                if (!a || !b) return null;
                const d = curvePath(a.x, a.y, b.x, b.y, -34);
                return (
                  <g key={`sel-${edge.from}-${edge.to}-${idx}`}>
                    <path
                      d={d}
                      fill="none"
                      stroke="#60A5FA"
                      strokeWidth="7"
                      strokeOpacity="0.28"
                      strokeLinecap="round"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="#1D6FE8"
                      strokeWidth="3.2"
                      strokeLinecap="round"
                      markerEnd="url(#arrowBlueStrong)"
                    />
                    <path
                      d={d}
                      fill="none"
                      stroke="#BFDBFE"
                      strokeWidth="1.6"
                      strokeDasharray="6 14"
                      className="animate-dash-blue"
                    />
                  </g>
                );
              })}

              {/* 4. Connector lines from stationary visitor markers into their active page */}
              {markerPositions
                .filter((m) => !m.moving)
                .map((m) => {
                  const target = nodePositions.get(m.visitor.currentPath);
                  if (!target) return null;
                  return (
                    <path
                      key={`conn-${m.visitor.anonSessionId}`}
                      d={curvePath(m.x, m.y, target.x, target.y, -8)}
                      fill="none"
                      stroke={m.isSelected ? '#1D6FE8' : '#A9C2E2'}
                      strokeWidth={m.isSelected ? '2' : '1.15'}
                      strokeOpacity={m.isSelected ? '0.9' : '0.65'}
                    />
                  );
                })}

              {/* 5. Discovered Website Page Nodes (Isometric Elevated Browser Cards) */}
              {Array.from(nodePositions.values()).map(({ x, y, page }) => {
                const isSelectedPage = selectedPagePath === page.path;
                const isOnSelectedRoute = selectedVisitor?.routePaths.includes(page.path);
                return (
                  <g
                    key={page.path}
                    transform={`translate(${x}, ${y})`}
                    onClick={() => onSelectPage(isSelectedPage ? null : page.path)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`${page.label} page (${page.path}), ${page.views} views`}
                  >
                    {/* Isometric base plate */}
                    <polygon
                      points="0,-24 58,0 0,28 -58,0"
                      fill={isSelectedPage ? '#DBEAFE' : '#EFF6FF'}
                      stroke={isSelectedPage || isOnSelectedRoute ? '#1D6FE8' : '#7BA6DF'}
                      strokeWidth={isSelectedPage ? '2.2' : '1.5'}
                      filter="url(#cardShadow)"
                    />
                    {/* 3D thickness lip */}
                    <polygon
                      points="-58,0 0,28 58,0 58,7 0,35 -58,7"
                      fill="#BFD8F8"
                      fillOpacity="0.85"
                    />

                    {/* Elevated miniature browser tile */}
                    <g transform="translate(-24, -44)">
                      <rect
                        width="48"
                        height="36"
                        rx="6"
                        fill="#FFFFFF"
                        stroke={isSelectedPage || isOnSelectedRoute ? '#1D6FE8' : '#4C7EC2'}
                        strokeWidth="1.8"
                      />
                      <path
                        d="M0 9 H48"
                        stroke="#CBD9EC"
                        strokeWidth="1.2"
                      />
                      <circle cx="7" cy="4.5" r="1.5" fill="#1D6FE8" />
                      <circle cx="12" cy="4.5" r="1.5" fill="#10B981" />
                      <circle cx="17" cy="4.5" r="1.5" fill="#93B4DF" />
                      <g transform="translate(24, 22)">
                        <PageCardIcon path={page.path} />
                      </g>
                    </g>

                    {/* Page Label & Views */}
                    <text
                      x="0"
                      y="52"
                      textAnchor="middle"
                      fontSize="13"
                      fontWeight="700"
                      fill="#0F294D"
                    >
                      {page.label}
                    </text>
                    <text
                      x="0"
                      y="67"
                      textAnchor="middle"
                      fontSize="11"
                      fontWeight="500"
                      fill="#4A6587"
                    >
                      {page.views.toLocaleString()} views
                    </text>

                    {/* Active visitors pill */}
                    {page.activeVisitors > 0 && (
                      <g transform="translate(36, -42)">
                        <rect
                          x="-13"
                          y="-9"
                          width="26"
                          height="16"
                          rx="8"
                          fill="#ECFDF5"
                          stroke="#10B981"
                          strokeWidth="1.1"
                        />
                        <text
                          x="0"
                          y="3"
                          textAnchor="middle"
                          fontSize="9.5"
                          fontWeight="700"
                          fill="#047857"
                        >
                          {page.activeVisitors}
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}

              {/* 6. Central Metadata Callout Pill above Database */}
              {showDbLines && (
                <g transform="translate(460, 270)">
                  <rect
                    x="-118"
                    y="-22"
                    width="236"
                    height="40"
                    rx="9"
                    fill="#F0FDF9"
                    stroke="#6EE7B7"
                    strokeWidth="1.3"
                  />
                  <rect
                    x="-106"
                    y="-10"
                    width="16"
                    height="18"
                    rx="2.5"
                    fill="#FFFFFF"
                    stroke="#059669"
                    strokeWidth="1.4"
                  />
                  <line x1="-102" y1="-4" x2="-94" y2="-4" stroke="#059669" strokeWidth="1.3" />
                  <line x1="-102" y1="0" x2="-94" y2="0" stroke="#059669" strokeWidth="1.3" />
                  <line x1="-102" y1="4" x2="-97" y2="4" stroke="#059669" strokeWidth="1.3" />
                  <text x="-80" y="-4" fontSize="10.5" fontWeight="700" fill="#0F294D">
                    Page-view/session events recorded
                  </text>
                  <text x="-80" y="10" fontSize="10" fontWeight="500" fill="#047857">
                    (metadata only, safe)
                  </text>
                </g>
              )}

              {/* 7. Central Database Cylinder Node */}
              <g transform={`translate(${DB_POS.x}, ${DB_POS.y})`}>
                {/* Soft base shadow */}
                <ellipse cx="0" cy="40" rx="54" ry="16" fill="#1D6FE8" fillOpacity="0.12" />
                {/* Cylinder body */}
                <path
                  d="M-36 -16 V24 C-36 33 36 33 36 24 V-16 Z"
                  fill="#1D6FE8"
                  stroke="#0F294D"
                  strokeWidth="1.6"
                />
                {/* Cylinder bands */}
                <path
                  d="M-36 -3 C-36 6 36 6 36 -3"
                  fill="none"
                  stroke="#93C5FD"
                  strokeWidth="1.5"
                />
                <path
                  d="M-36 10 C-36 19 36 19 36 10"
                  fill="none"
                  stroke="#93C5FD"
                  strokeWidth="1.5"
                />
                {/* Top cap */}
                <ellipse
                  cx="0"
                  cy="-16"
                  rx="36"
                  ry="11"
                  fill="#60A5FA"
                  stroke="#0F294D"
                  strokeWidth="1.6"
                />
                <text
                  x="0"
                  y="24"
                  textAnchor="middle"
                  fontSize="11.5"
                  fontWeight="800"
                  fill="#FFFFFF"
                >
                  Database
                </text>

                {/* Safe Event Data Teal Shield Pill */}
                <g transform="translate(0, 48)">
                  <rect
                    x="-62"
                    y="-11"
                    width="124"
                    height="22"
                    rx="11"
                    fill="#047857"
                  />
                  <text
                    x="0"
                    y="3.5"
                    textAnchor="middle"
                    fontSize="10.5"
                    fontWeight="700"
                    fill="#FFFFFF"
                  >
                    ✓ Event Data (Safe)
                  </text>
                </g>
              </g>

              {/* 8. Anonymous Visitor Markers (Small Person / Device Icons, 1 Marker = 1 Session) */}
              {markerPositions.map(({ visitor, x, y, isSelected }) => (
                <g
                  key={visitor.anonSessionId}
                  transform={`translate(${x}, ${y})`}
                  onClick={() => onSelectVisitor(visitor.anonSessionId)}
                  className="cursor-pointer"
                  role="button"
                  tabIndex={0}
                  aria-label={`Visitor session ${visitor.anonSessionId} on ${visitor.currentLabel}`}
                >
                  {isSelected && (
                    <circle
                      r="17"
                      fill="#1D6FE8"
                      fillOpacity="0.18"
                      stroke="#1D6FE8"
                      strokeWidth="2"
                    />
                  )}
                  <circle
                    r={isSelected ? 11.5 : 9.5}
                    fill={isSelected ? '#1D6FE8' : '#FFFFFF'}
                    stroke={isSelected ? '#FFFFFF' : '#2B7FF2'}
                    strokeWidth="1.8"
                  />
                  {visitor.deviceType === 'desktop' && !isSelected ? (
                    /* Device / laptop silhouette */
                    <g fill={isSelected ? '#FFFFFF' : '#1D6FE8'}>
                      <rect x="-4.5" y="-4" width="9" height="6" rx="1" />
                      <rect x="-6" y="2.8" width="12" height="1.5" rx="0.7" />
                    </g>
                  ) : (
                    /* Person silhouette */
                    <g fill={isSelected ? '#FFFFFF' : '#1D6FE8'}>
                      <circle cx="0" cy="-2.8" r="2.7" />
                      <path d="M-4.6 4.8 C-4.6 1.5 4.6 1.5 4.6 4.8 Z" />
                    </g>
                  )}
                </g>
              ))}

              {/* 9. Selected Visitor Floating Blue Callout Tooltip */}
              {selectedMarker && (
                <g
                  transform={`translate(${Math.max(85, Math.min(VIEW_W - 85, selectedMarker.x - 10))}, ${Math.max(40, selectedMarker.y - 46)})`}
                >
                  <rect
                    x="-64"
                    y="-22"
                    width="128"
                    height="36"
                    rx="8"
                    fill="#1D6FE8"
                    filter="url(#cardShadow)"
                  />
                  <polygon points="-5,14 5,14 0,21" fill="#1D6FE8" />
                  <circle cx="-48" cy="-4" r="6.5" fill="#FFFFFF" fillOpacity="0.22" />
                  <circle cx="-48" cy="-6" r="2.2" fill="#FFFFFF" />
                  <path d="M-51.5 -0.5 C-51.5 -3 -44.5 -3 -44.5 -0.5 Z" fill="#FFFFFF" />
                  <text x="-36" y="-7" fontSize="9.5" fontWeight="600" fill="#DBEAFE">
                    Selected Visitor
                  </text>
                  <text
                    x="-36"
                    y="6"
                    fontSize="11.5"
                    fontWeight="800"
                    fill="#FFFFFF"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {selectedMarker.visitor.anonSessionId}
                  </text>
                </g>
              )}
            </g>
          </svg>
        )}

        {/* Zoom Readout Pill */}
        <div className="pointer-events-none absolute bottom-2.5 right-3 rounded-md border border-[#CBD9EC] bg-white/90 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#4A6587]">
          {Math.round(zoom * 100)}%
        </div>
      </div>

      {/* Legend Footer matching reference */}
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-[#E6EEF8] bg-white px-4 py-2 text-[11px] text-[#3A547A]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          <span className="font-bold text-[#0F294D]">Visitor &amp; Route Legend:</span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#1D6FE8] text-[9px] text-white">
              ●
            </span>
            visitor session (anonymous)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-1 w-5 rounded bg-[#1D6FE8]" />
            selected visitor route
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-5 bg-[#9AB5D8]" />
            other visitor routes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-5 border-t-2 border-dashed border-[#10B981]" />
            event to database (metadata)
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="font-bold text-[#0F294D]">Event Flow Legend:</span>
          <span className="inline-flex items-center gap-1">
            <Database className="h-3.5 w-3.5 text-[#1D6FE8]" />
            database (safe metadata)
          </span>
          <span className="inline-flex items-center gap-1">
            <FileText className="h-3.5 w-3.5 text-[#059669]" />
            recorded event (page view, session)
          </span>
        </div>
      </div>
    </section>
  );
}
