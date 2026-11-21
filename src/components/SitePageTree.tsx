import React, { useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  Folder,
  Globe,
  Info,
  Search,
  Sparkles,
  Check,
  X,
} from 'lucide-react';
import type { DiscoveredPage, SiteDto } from '../types/analytics';
import { api } from '../api/client';

interface SitePageTreeProps {
  site: SiteDto | null;
  pages: DiscoveredPage[];
  selectedPath: string | null;
  onSelectPath: (path: string | null) => void;
  onPagesChanged: () => Promise<void>;
}

export function SitePageTree({
  site,
  pages,
  selectedPath,
  onSelectPath,
  onPagesChanged,
}: SitePageTreeProps) {
  const [search, setSearch] = useState('');
  const [showHidden, setShowHidden] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingPageId, setEditingPageId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [saving, setSaving] = useState(false);
  const [showDiscoveryInfo, setShowDiscoveryInfo] = useState(false);

  const visiblePages = useMemo(() => {
    const q = search.trim().toLowerCase();
    return pages.filter((p) => {
      if (!showHidden && p.isHidden) return false;
      if (!q) return true;
      return (
        p.label.toLowerCase().includes(q) ||
        p.path.toLowerCase().includes(q) ||
        p.group.toLowerCase().includes(q)
      );
    });
  }, [pages, search, showHidden]);

  const grouped = useMemo(() => {
    const map = new Map<string, DiscoveredPage[]>();
    for (const p of visiblePages) {
      const grp = p.group || 'Pages';
      const arr = map.get(grp) || [];
      arr.push(p);
      map.set(grp, arr);
    }
    return Array.from(map.entries());
  }, [visiblePages]);

  const activeDiscoveredCount = pages.filter((p) => !p.isHidden).length;
  const hiddenCount = pages.filter((p) => p.isHidden).length;

  const startEdit = (page: DiscoveredPage) => {
    setEditingPageId(page.id);
    setEditLabel(page.label);
    setEditGroup(page.group);
  };

  const saveEdit = async (page: DiscoveredPage) => {
    if (!site) return;
    setSaving(true);
    try {
      await api.updatePage(site.id, page.id, {
        label: editLabel.trim() || page.label,
        group: editGroup.trim() || 'Pages',
      });
      setEditingPageId(null);
      await onPagesChanged();
    } finally {
      setSaving(false);
    }
  };

  const toggleHide = async (page: DiscoveredPage) => {
    if (!site) return;
    await api.updatePage(site.id, page.id, { isHidden: !page.isHidden });
    await onPagesChanged();
  };

  return (
    <aside
      aria-label="Connected site discovered pages"
      className="ufa-card flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="border-b border-[#E6EEF8] px-3.5 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0F294D]">
            SITE PAGES
          </h2>
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowHidden((v) => !v)}
              className="text-[11px] font-semibold text-[#1D6FE8] hover:underline"
            >
              {showHidden ? 'Hide muted' : `Show hidden (${hiddenCount})`}
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-[#4A6587]">Connected site &amp; discovered routes</p>

        {/* Search input */}
        <div className="relative mt-2.5">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#647D9E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search pages or routes..."
            aria-label="Search discovered pages or routes"
            className="w-full rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] py-1.5 pl-8 pr-3 text-xs text-[#0F294D] placeholder:text-[#647D9E] focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
          />
        </div>
      </div>

      {/* Connected Website Card */}
      <div className="border-b border-[#E6EEF8] bg-[#FAFDFE] px-3.5 py-2.5">
        <div className="flex items-start gap-2.5">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[#BFD3EC] bg-white text-[#1D6FE8]">
            <Globe className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-1">
              <span className="truncate text-xs font-bold text-[#0F294D]">
                {site?.domain || 'Loading...'}
              </span>
              {site?.status === 'disconnected' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] font-bold text-[#3730A3]">
                  Offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-1.5 py-0.5 text-[10px] font-bold text-[#047857]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                  {site?.liveEventCount ? 'Live' : 'Demo'}
                </span>
              )}
            </div>
            <div className="mt-0.5 text-[11px] text-[#4A6587]">
              {activeDiscoveredCount} pages • Pages discovered dynamically
            </div>
          </div>
        </div>
      </div>

      {/* Page Tree */}
      <div className="flex-1 overflow-y-auto px-2.5 py-2.5">
        {selectedPath && (
          <button
            type="button"
            onClick={() => onSelectPath(null)}
            className="mb-2 flex w-full items-center justify-between rounded-md border border-[#BFD3EC] bg-[#EFF6FF] px-2.5 py-1 text-[11px] font-semibold text-[#1D4ED8] hover:bg-[#DBEAFE]"
          >
            <span>Filter: {selectedPath}</span>
            <X className="h-3 w-3" />
          </button>
        )}

        {grouped.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[#CBD9EC] p-4 text-center text-xs text-[#4A6587]">
            No routes discovered yet. Connect the SDK or clear your search filter.
          </div>
        ) : (
          <div className="space-y-2">
            {grouped.map(([groupName, groupPages]) => {
              const collapsed = Boolean(collapsedGroups[groupName]);
              return (
                <div key={groupName}>
                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }))
                    }
                    className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs font-bold text-[#0F294D] hover:bg-[#F1F6FD]"
                  >
                    {collapsed ? (
                      <ChevronRight className="h-3.5 w-3.5 text-[#4A6587]" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5 text-[#4A6587]" />
                    )}
                    <Folder className="h-3.5 w-3.5 text-[#1D6FE8]" />
                    <span>
                      {groupName} ({groupPages.length})
                    </span>
                  </button>

                  {!collapsed && (
                    <ul className="mt-1 space-y-0.5 pl-3">
                      {groupPages.map((page) => {
                        const isSelected = selectedPath === page.path;
                        const isEditing = editingPageId === page.id;

                        if (isEditing) {
                          return (
                            <li
                              key={page.id}
                              className="rounded-lg border border-[#93C5FD] bg-[#F8FBFF] p-2"
                            >
                              <div className="space-y-1.5">
                                <input
                                  type="text"
                                  value={editLabel}
                                  onChange={(e) => setEditLabel(e.target.value)}
                                  placeholder="Page label"
                                  className="w-full rounded border border-[#CBD9EC] bg-white px-2 py-1 text-xs text-[#0F294D] focus:border-[#1D6FE8] focus:outline-none"
                                />
                                <input
                                  type="text"
                                  value={editGroup}
                                  onChange={(e) => setEditGroup(e.target.value)}
                                  placeholder="Group (e.g. Pages, Auth)"
                                  className="w-full rounded border border-[#CBD9EC] bg-white px-2 py-1 text-[11px] text-[#3A547A] focus:border-[#1D6FE8] focus:outline-none"
                                />
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => setEditingPageId(null)}
                                    className="rounded border border-[#CBD9EC] bg-white px-2 py-0.5 text-[11px] font-semibold text-[#4A6587] hover:bg-[#F1F6FD]"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => saveEdit(page)}
                                    className="inline-flex items-center gap-1 rounded bg-[#1D6FE8] px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
                                  >
                                    <Check className="h-3 w-3" />
                                    Save
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        }

                        return (
                          <li key={page.id} className="group relative">
                            <div
                              onClick={() => onSelectPath(isSelected ? null : page.path)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  onSelectPath(isSelected ? null : page.path);
                                }
                              }}
                              className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors ${
                                isSelected
                                  ? 'border-[#93C5FD] bg-[#DBEAFE] font-semibold text-[#0F294D]'
                                  : page.isHidden
                                    ? 'border-transparent bg-[#F8FAFC] text-[#647D9E] opacity-70 hover:bg-[#F1F6FD]'
                                    : 'border-transparent text-[#1E3A63] hover:bg-[#EFF6FF]'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${
                                      page.activeVisitors > 0 ? 'bg-[#10B981]' : 'bg-[#93B4DF]'
                                    }`}
                                  />
                                  <span className="truncate font-semibold">{page.label}</span>
                                </div>
                                <div className="truncate pl-3 font-mono text-[10px] text-[#647D9E]">
                                  {page.path}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                <span className="text-[11px] font-medium text-[#4A6587] tabular-nums group-hover:hidden">
                                  {page.views.toLocaleString()} views
                                </span>
                                <div
                                  className="hidden items-center gap-0.5 group-hover:flex"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    title="Rename or group page"
                                    onClick={() => startEdit(page)}
                                    className="rounded p-1 text-[#4A6587] hover:bg-white hover:text-[#1D6FE8]"
                                  >
                                    <Edit3 className="h-3 w-3" />
                                  </button>
                                  <button
                                    type="button"
                                    title={page.isHidden ? 'Unhide page' : 'Hide page'}
                                    onClick={() => toggleHide(page)}
                                    className="rounded p-1 text-[#4A6587] hover:bg-white hover:text-[#0F294D]"
                                  >
                                    {page.isHidden ? (
                                      <Eye className="h-3 w-3" />
                                    ) : (
                                      <EyeOff className="h-3 w-3" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Dynamic Discovery Footer */}
      <div className="border-t border-[#E6EEF8] bg-[#F8FBFF] p-2.5">
        <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-2">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold text-[#047857]">
            <span className="inline-flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-[#10B981]" />
              Pages discovered dynamically.
            </span>
            <button
              type="button"
              onClick={() => setShowDiscoveryInfo((v) => !v)}
              aria-label="How dynamic page discovery works"
              className="rounded-full p-0.5 text-[#047857] hover:bg-[#D1FAE5]"
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </div>
          {showDiscoveryInfo && (
            <p className="mt-1.5 text-[10px] leading-relaxed text-[#065F46]">
              Routes are discovered automatically from observed SDK page loads and SPA navigation.
              Query parameters (<code>?utm=...</code>) and URL fragments (<code>#section</code>) are
              stripped to keep paths canonical. Hover any route to rename, group, or hide it.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
