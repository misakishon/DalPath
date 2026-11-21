import React, { useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  EyeOff,
  FileCode2,
  Globe,
  Plus,
  Search,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api, formatRelativeTime } from '../api/client';
import { EmptyState, ErrorState, LoadingSkeleton } from '../components/StateFeedback';

export function SitePagesPage() {
  const { selectedSite, pages, loading, error, refreshAll } = useWorkspace();

  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState('all');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [testPath, setTestPath] = useState('/pricing?utm_campaign=launch#plans');
  const [sendingTest, setSendingTest] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const groups = useMemo(() => {
    return Array.from(new Set(pages.map((p) => p.group || 'Pages'))).sort();
  }, [pages]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (groupFilter !== 'all' && p.group !== groupFilter) return false;
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [pages, search, groupFilter]);

  const saveEdit = async (pageId: number) => {
    if (!selectedSite) return;
    await api.updatePage(selectedSite.id, pageId, {
      label: editLabel.trim(),
      group: editGroup.trim() || 'Pages',
    });
    setEditingId(null);
    await refreshAll();
  };

  const toggleVisibility = async (pageId: number, currentHidden: boolean) => {
    if (!selectedSite) return;
    await api.updatePage(selectedSite.id, pageId, { isHidden: !currentHidden });
    await refreshAll();
  };

  const sendDiscoveryTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSite || !testPath.trim()) return;
    setSendingTest(true);
    setFeedback(null);
    try {
      const res = await api.sendTestEvent(selectedSite.id, { path: testPath.trim() });
      setFeedback(
        res.discoveredNewPage
          ? `Discovered new normalized route "${res.event.sourcePath}" (query & hash stripped)!`
          : `Recorded live page view on normalized route "${res.event.sourcePath}".`
      );
      await refreshAll();
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : 'Unable to send test page view.');
    } finally {
      setSendingTest(false);
    }
  };

  if (error) return <ErrorState message={error} onRetry={refreshAll} />;
  if (loading && pages.length === 0) {
    return <LoadingSkeleton rows={6} label="Loading discovered site routes..." />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0F294D]">Site Pages &amp; Route Discovery</h1>
          <p className="text-xs text-[#4A6587]">
            Routes are discovered automatically from observed page views and SPA transitions. Query
            strings and URL fragments are removed during normalization.
          </p>
        </div>
      </div>

      {/* Site Connection Status + Live Route Discovery Tester */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <div className="ufa-card flex flex-wrap items-center justify-between gap-3 p-4 lg:col-span-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#BFD3EC] bg-[#EFF6FF] text-[#1D6FE8]">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#0F294D]">{selectedSite?.domain}</span>
                {selectedSite?.status === 'disconnected' ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[10px] font-bold text-[#3730A3]">
                    <WifiOff className="h-3 w-3" />
                    Disconnected
                  </span>
                ) : selectedSite?.collectionPaused ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#F1F5F9] px-2 py-0.5 text-[10px] font-bold text-[#334155]">
                    Collection Paused
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2 py-0.5 text-[10px] font-bold text-[#047857]">
                    <CheckCircle2 className="h-3 w-3 text-[#10B981]" />
                    Connected ({pages.length} discovered)
                  </span>
                )}
              </div>
              <div className="mt-0.5 text-[11px] text-[#4A6587]">
                Last observed route visit: {formatRelativeTime(selectedSite?.lastEventAt || null)} •
                Allowed domains: {selectedSite?.allowedDomains.join(', ')}
              </div>
            </div>
          </div>
        </div>

        <form
          onSubmit={sendDiscoveryTest}
          className="ufa-card flex flex-col justify-center gap-2 p-4 lg:col-span-6"
        >
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#0F294D]">
            <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
            Test Dynamic Page Discovery &amp; Normalization (Live SDK Event)
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={testPath}
              onChange={(e) => setTestPath(e.target.value)}
              placeholder="/new-route?ref=campaign#top"
              className="h-8 flex-1 min-w-[200px] rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-3 font-mono text-xs text-[#0F294D] focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
            />
            <button
              type="submit"
              disabled={sendingTest || selectedSite?.status === 'disconnected'}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1D6FE8] px-3 text-xs font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" />
              {sendingTest ? 'Sending...' : 'Observe Route'}
            </button>
          </div>
          {feedback && <p className="text-[11px] font-medium text-[#047857]">{feedback}</p>}
        </form>
      </div>

      {/* Filters */}
      <div className="ufa-card flex flex-wrap items-center gap-2.5 p-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[#647D9E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search page title, normalized path, or group..."
            className="h-9 w-full rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] pl-8 pr-3 text-xs text-[#0F294D] focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
          />
        </div>
        <select
          aria-label="Filter by page group"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="h-9 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D]"
        >
          <option value="all">All Groups</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </select>
      </div>

      {/* Discovered Routes Table */}
      <div className="ufa-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No discovered routes found"
              description="Send a test page view above or install the SDK snippet from Settings to discover pages automatically."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-xs">
              <thead className="bg-[#F4F8FE] text-[10px] font-bold uppercase tracking-wider text-[#4A6587]">
                <tr className="border-b border-[#DCE6F4]">
                  <th className="px-4 py-2.5">Page Title</th>
                  <th className="px-3 py-2.5">Normalized Path</th>
                  <th className="px-3 py-2.5">Group</th>
                  <th className="px-3 py-2.5 text-right">Views</th>
                  <th className="px-3 py-2.5 text-right">Active Visitors</th>
                  <th className="px-3 py-2.5">Last Seen</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-4 py-2.5 text-right">Controls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF4FC]">
                {filtered.map((p) => {
                  const isEditing = editingId === p.id;
                  return (
                    <tr key={p.id} className={p.isHidden ? 'bg-[#F8FAFC] opacity-75' : 'hover:bg-[#F8FBFF]'}>
                      <td className="px-4 py-2.5 font-semibold text-[#0F294D]">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editLabel}
                            onChange={(e) => setEditLabel(e.target.value)}
                            className="rounded border border-[#93C5FD] bg-white px-2 py-1 text-xs focus:outline-none"
                          />
                        ) : (
                          <span className="inline-flex items-center gap-1.5">
                            <FileCode2 className="h-3.5 w-3.5 text-[#1D6FE8]" />
                            {p.label}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#3A547A]">{p.path}</td>
                      <td className="px-3 py-2.5">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editGroup}
                            onChange={(e) => setEditGroup(e.target.value)}
                            className="w-28 rounded border border-[#93C5FD] bg-white px-2 py-1 text-xs focus:outline-none"
                          />
                        ) : (
                          <span className="rounded-md border border-[#DCE6F4] bg-[#F8FBFF] px-2 py-0.5 text-[11px] font-medium text-[#3A547A]">
                            {p.group}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-[#0F294D] tabular-nums">
                        {p.views.toLocaleString()}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-[#047857] tabular-nums">
                        {p.activeVisitors}
                      </td>
                      <td className="px-3 py-2.5 text-[#4A6587]">{formatRelativeTime(p.lastSeenAt)}</td>
                      <td className="px-3 py-2.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            p.isHidden
                              ? 'bg-[#F1F5F9] text-[#475569]'
                              : 'bg-[#ECFDF5] text-[#047857]'
                          }`}
                        >
                          {p.discoveryStatus}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded border border-[#CBD9EC] bg-white px-2 py-1 text-[11px] font-semibold text-[#4A6587]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => saveEdit(p.id)}
                                className="inline-flex items-center gap-1 rounded bg-[#1D6FE8] px-2.5 py-1 text-[11px] font-semibold text-white"
                              >
                                <Check className="h-3 w-3" />
                                Save
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingId(p.id);
                                  setEditLabel(p.label);
                                  setEditGroup(p.group);
                                }}
                                className="inline-flex items-center gap-1 rounded border border-[#CBD9EC] bg-white px-2 py-1 text-[11px] font-semibold text-[#0F294D] hover:bg-[#EFF6FF]"
                              >
                                <Edit3 className="h-3 w-3" />
                                Rename / Group
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleVisibility(p.id, p.isHidden)}
                                className="inline-flex items-center gap-1 rounded border border-[#CBD9EC] bg-white px-2 py-1 text-[11px] font-semibold text-[#3A547A] hover:bg-[#EFF6FF]"
                              >
                                {p.isHidden ? (
                                  <>
                                    <Eye className="h-3 w-3" />
                                    Show
                                  </>
                                ) : (
                                  <>
                                    <EyeOff className="h-3 w-3" />
                                    Hide
                                  </>
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
