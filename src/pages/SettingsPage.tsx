import React, { useEffect, useState } from 'react';
import {
  Check,
  Code2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Globe,
  KeyRound,
  PauseCircle,
  PlayCircle,
  Plus,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Unplug,
  UserPlus,
  Users,
} from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext';
import { api } from '../api/client';
import type { TeamMember } from '../types/analytics';
import { ErrorState, LoadingSkeleton } from '../components/StateFeedback';

export function SettingsPage() {
  const {
    sites,
    selectedSite,
    selectedSiteId,
    setSelectedSiteId,
    loading,
    error,
    refreshSites,
    refreshAll,
  } = useWorkspace();

  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  const [newDomainInput, setNewDomainInput] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteDomain, setNewSiteDomain] = useState('');

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [memberName, setMemberName] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState('Analyst');

  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setRevealedKey(null);
    if (!selectedSiteId) return;
    api
      .listTeam(selectedSiteId)
      .then((res) => setTeam(res.members))
      .catch(() => {});
  }, [selectedSiteId]);

  if (error) return <ErrorState message={error} onRetry={refreshAll} />;
  if (loading && !selectedSite) return <LoadingSkeleton rows={6} label="Loading site settings..." />;
  if (!selectedSite) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const snippetKey = revealedKey || selectedSite.maskedIntegrationKey;
  const sdkSnippet = `<script\n  src="${origin}/sdk/ufa.js"\n  data-site-id="${selectedSite.id}"\n  data-key="${snippetKey}"\n  defer\n></script>`;

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const handleToggleReveal = async () => {
    if (revealedKey) {
      setRevealedKey(null);
      return;
    }
    const res = await api.revealKey(selectedSite.id);
    setRevealedKey(res.integrationKey);
  };

  const handleRotateKey = async () => {
    setBusy(true);
    try {
      const res = await api.rotateKey(selectedSite.id);
      setRevealedKey(res.integrationKey);
      await refreshSites();
      showNotice('Integration key rotated. Update your site snippet with the new key.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddAllowedDomain = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newDomainInput.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (!clean) return;
    const next = Array.from(new Set([...selectedSite.allowedDomains, clean]));
    await api.updateSiteSettings(selectedSite.id, { allowedDomains: next });
    setNewDomainInput('');
    await refreshSites();
    showNotice(`Added "${clean}" to allowed domains.`);
  };

  const handleRemoveAllowedDomain = async (domain: string) => {
    const next = selectedSite.allowedDomains.filter((d) => d !== domain);
    await api.updateSiteSettings(selectedSite.id, { allowedDomains: next });
    await refreshSites();
    showNotice(`Removed "${domain}" from allowed domains.`);
  };

  const handleUpdateSetting = async (
    patch: Parameters<typeof api.updateSiteSettings>[1],
    msg: string
  ) => {
    setBusy(true);
    try {
      await api.updateSiteSettings(selectedSite.id, patch);
      await refreshSites();
      await refreshAll();
      showNotice(msg);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSiteDomain.trim()) return;
    setBusy(true);
    try {
      const res = await api.createSite({
        name: newSiteName.trim() || newSiteDomain.trim(),
        domain: newSiteDomain.trim(),
      });
      setNewSiteName('');
      setNewSiteDomain('');
      await refreshSites();
      setSelectedSiteId(res.site.id);
      showNotice(`Created isolated website workspace "${res.site.domain}".`);
    } finally {
      setBusy(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memberName.trim() || !memberEmail.trim()) return;
    const res = await api.addTeamMember(selectedSite.id, {
      name: memberName.trim(),
      email: memberEmail.trim(),
      role: memberRole,
    });
    setTeam(res.members);
    setMemberName('');
    setMemberEmail('');
    showNotice('Added team member.');
  };

  const handleRemoveMember = async (id: number) => {
    const res = await api.removeTeamMember(selectedSite.id, id);
    setTeam(res.members);
  };

  const handleSendTestEvent = async () => {
    setBusy(true);
    try {
      const res = await api.sendTestEvent(selectedSite.id, {
        path: '/dashboard?source=settings_test#verify',
      });
      await refreshSites();
      await refreshAll();
      showNotice(`Live SDK test event recorded for "${res.event.sourcePath}" (${res.event.anonSessionId}).`);
    } catch (err) {
      showNotice(err instanceof Error ? err.message : 'Test event failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-extrabold text-[#0F294D]">Workspace &amp; Integration Settings</h1>
          <p className="text-xs text-[#4A6587]">
            Configure website connection, allowed domains, integration keys, privacy retention, and
            team access for <strong className="text-[#0F294D]">{selectedSite.domain}</strong>.
          </p>
        </div>
        {notice && (
          <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-1.5 text-xs font-semibold text-[#047857]">
            {notice}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Left Column: Connection Instructions + Keys + Allowed Domains */}
        <div className="space-y-4 lg:col-span-7">
          {/* SDK Connection Instructions */}
          <section className="ufa-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-[#1D6FE8]" />
                <h2 className="text-sm font-bold text-[#0F294D]">
                  Connect Your Website (SDK &amp; Dynamic Discovery)
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSendTestEvent}
                  disabled={busy || selectedSite.status === 'disconnected'}
                  className="rounded-lg border border-[#93C5FD] bg-[#EFF6FF] px-2.5 py-1 text-xs font-bold text-[#1D4ED8] hover:bg-[#DBEAFE] disabled:opacity-50"
                >
                  Send Live Test Event
                </button>
                <a
                  href={`/demo-site?siteId=${encodeURIComponent(selectedSite.id)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#0F294D] px-2.5 py-1 text-xs font-bold text-white hover:bg-[#1E3A63]"
                >
                  Open Live SDK Sandbox
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>

            <p className="mt-2 text-xs text-[#4A6587]">
              Paste this script inside your site&apos;s <code>&lt;head&gt;</code>. It automatically
              tracks initial page loads and single-page-app route changes (<code>pushState</code>,{' '}
              <code>replaceState</code>, <code>popstate</code>), strips query strings and hash
              fragments, and connects visits using an anonymous first-party session ID.
            </p>

            <div className="relative mt-3 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] p-3">
              <pre className="overflow-x-auto font-mono text-[11px] leading-relaxed text-[#0F294D]">
                {sdkSnippet}
              </pre>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard?.writeText(sdkSnippet).catch(() => {});
                  setCopiedSnippet(true);
                  setTimeout(() => setCopiedSnippet(false), 1600);
                }}
                className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-md border border-[#CBD9EC] bg-white px-2 py-1 text-[11px] font-semibold text-[#0F294D] hover:bg-[#EFF6FF]"
              >
                {copiedSnippet ? <Check className="h-3 w-3 text-[#10B981]" /> : <Copy className="h-3 w-3" />}
                {copiedSnippet ? 'Copied' : 'Copy'}
              </button>
            </div>
          </section>

          {/* Masked Integration Key */}
          <section className="ufa-card p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#1D6FE8]" />
              <h2 className="text-sm font-bold text-[#0F294D]">Integration Key</h2>
            </div>
            <p className="mt-1 text-xs text-[#4A6587]">
              Validated on every <code>POST /api/v1/collect</code> request using constant-time
              verification. Strictly scoped to <code>{selectedSite.id}</code>.
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <code className="flex-1 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-3 py-2 font-mono text-xs font-semibold text-[#0F294D]">
                {revealedKey || selectedSite.maskedIntegrationKey}
              </code>
              <button
                type="button"
                onClick={handleToggleReveal}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D] hover:bg-[#EFF6FF]"
              >
                {revealedKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {revealedKey ? 'Mask' : 'Reveal'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  const keyToCopy = revealedKey || (await api.revealKey(selectedSite.id)).integrationKey;
                  navigator.clipboard?.writeText(keyToCopy).catch(() => {});
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 1600);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#CBD9EC] bg-white px-3 text-xs font-semibold text-[#0F294D] hover:bg-[#EFF6FF]"
              >
                {copiedKey ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
                Copy
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleRotateKey}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#0F294D] px-3 text-xs font-bold text-white hover:bg-[#1E3A63]"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Rotate Key
              </button>
            </div>
          </section>

          {/* Allowed Domains */}
          <section className="ufa-card p-4">
            <div className="flex items-center gap-2">
              <Globe className="h-4 w-4 text-[#1D6FE8]" />
              <h2 className="text-sm font-bold text-[#0F294D]">Allowed Domains</h2>
            </div>
            <p className="mt-1 text-xs text-[#4A6587]">
              Requests whose <code>Origin</code> or <code>Referer</code> hostname does not match
              this allowlist are blocked and logged in Security Events. Wildcards like{' '}
              <code>*.example.com</code> are supported.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              {selectedSite.allowedDomains.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#BFD3EC] bg-[#EFF6FF] px-3 py-1 font-mono text-xs font-semibold text-[#0F294D]"
                >
                  {d}
                  <button
                    type="button"
                    onClick={() => handleRemoveAllowedDomain(d)}
                    aria-label={`Remove allowed domain ${d}`}
                    className="rounded-full p-0.5 text-[#4A6587] hover:bg-white hover:text-[#BE123C]"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>

            <form onSubmit={handleAddAllowedDomain} className="mt-3 flex gap-2">
              <input
                type="text"
                value={newDomainInput}
                onChange={(e) => setNewDomainInput(e.target.value)}
                placeholder="app.example-site.com or *.example-site.com"
                className="h-9 flex-1 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-3 font-mono text-xs text-[#0F294D] focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-[#1D6FE8] px-3.5 text-xs font-bold text-white hover:bg-[#1D4ED8]"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Domain
              </button>
            </form>
          </section>

          {/* Connected Websites (Multi-Site Isolation) */}
          <section className="ufa-card p-4">
            <h2 className="text-sm font-bold text-[#0F294D]">Connected Websites (Strict Isolation)</h2>
            <p className="mt-1 text-xs text-[#4A6587]">
              Each connected website has its own integration key, discovered routes, visitor
              sessions, security events, and team roster.
            </p>

            <div className="mt-3 space-y-2">
              {sites.map((s) => (
                <div
                  key={s.id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-xs ${
                    s.id === selectedSite.id
                      ? 'border-[#93C5FD] bg-[#EFF6FF]'
                      : 'border-[#DCE6F4] bg-white'
                  }`}
                >
                  <div>
                    <div className="font-bold text-[#0F294D]">
                      {s.domain}{' '}
                      <span className="font-normal text-[#4A6587]">({s.name})</span>
                    </div>
                    <div className="text-[11px] text-[#4A6587]">
                      {s.pageCount} routes · {s.liveEventCount} live events · {s.demoEventCount}{' '}
                      demo events
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedSiteId(s.id)}
                    className={`rounded-md px-2.5 py-1 text-xs font-bold ${
                      s.id === selectedSite.id
                        ? 'bg-[#1D6FE8] text-white'
                        : 'border border-[#CBD9EC] bg-white text-[#0F294D] hover:bg-[#EFF6FF]'
                    }`}
                  >
                    {s.id === selectedSite.id ? 'Active' : 'Switch'}
                  </button>
                </div>
              ))}
            </div>

            <form onSubmit={handleCreateSite} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="Site name (e.g. Marketing)"
                className="h-9 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-3 text-xs focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                value={newSiteDomain}
                onChange={(e) => setNewSiteDomain(e.target.value)}
                placeholder="Domain (e.g. docs.mysite.io)"
                className="h-9 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-3 font-mono text-xs focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy}
                className="inline-flex h-9 items-center justify-center gap-1 rounded-lg bg-[#0F294D] px-3 text-xs font-bold text-white hover:bg-[#1E3A63]"
              >
                <Plus className="h-3.5 w-3.5" />
                Connect New Site
              </button>
            </form>
          </section>
        </div>

        {/* Right Column: Privacy & Retention, Collection Controls, Team Access */}
        <div className="space-y-4 lg:col-span-5">
          {/* Privacy & Retention */}
          <section className="ufa-card p-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#10B981]" />
              <h2 className="text-sm font-bold text-[#0F294D]">Privacy &amp; Data Retention</h2>
            </div>

            <div className="mt-3 space-y-3 text-xs">
              <div className="rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] p-3 text-[11px] text-[#065F46]">
                <strong>Zero-PII Guarantee:</strong> The SDK and ingestion server strictly whitelist
                safe route metadata. Passwords, form values, payment data, message contents, and
                keystrokes are never collected or stored.
              </div>

              <label className="flex items-center justify-between rounded-lg border border-[#DCE6F4] bg-[#FAFDFE] px-3 py-2.5">
                <div>
                  <div className="font-bold text-[#0F294D]">Mask Visitor IP Addresses</div>
                  <div className="text-[11px] text-[#4A6587]">
                    Store masked octets (<code>***.***.113.**</code>) and coarse region only
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={selectedSite.ipMaskingEnabled}
                  onChange={(e) =>
                    handleUpdateSetting(
                      { ipMaskingEnabled: e.target.checked },
                      'Updated IP masking preference.'
                    )
                  }
                  className="h-4 w-4 accent-[#10B981]"
                />
              </label>

              <div className="flex items-center justify-between rounded-lg border border-[#DCE6F4] bg-[#FAFDFE] px-3 py-2.5">
                <div>
                  <div className="font-bold text-[#0F294D]">Event Retention Window</div>
                  <div className="text-[11px] text-[#4A6587]">
                    Automatically purge metadata older than policy
                  </div>
                </div>
                <select
                  aria-label="Event retention window"
                  value={selectedSite.retentionDays}
                  onChange={(e) =>
                    handleUpdateSetting(
                      { retentionDays: Number(e.target.value) },
                      `Retention window set to ${e.target.value} days.`
                    )
                  }
                  className="h-8 rounded-lg border border-[#CBD9EC] bg-white px-2.5 text-xs font-bold text-[#0F294D]"
                >
                  <option value={7}>7 days</option>
                  <option value={14}>14 days</option>
                  <option value={30}>30 days</option>
                  <option value={90}>90 days</option>
                  <option value={180}>180 days</option>
                  <option value={365}>365 days</option>
                </select>
              </div>
            </div>
          </section>

          {/* Collection, Demo Mode & Disconnect Controls */}
          <section className="ufa-card p-4">
            <h2 className="text-sm font-bold text-[#0F294D]">Collection &amp; Connection Controls</h2>
            <div className="mt-3 space-y-2.5 text-xs">
              <div className="flex items-center justify-between rounded-lg border border-[#DCE6F4] bg-[#FAFDFE] px-3 py-2.5">
                <div>
                  <div className="font-bold text-[#0F294D]">Demo Traffic Stream</div>
                  <div className="text-[11px] text-[#4A6587]">
                    Clearly labeled synthetic Demo events for topology preview
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    handleUpdateSetting(
                      { demoMode: !selectedSite.demoMode },
                      selectedSite.demoMode
                        ? 'Demo traffic stream stopped.'
                        : 'Demo traffic stream started (all events tagged Demo).'
                    )
                  }
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                    selectedSite.demoMode
                      ? 'bg-[#DBEAFE] text-[#1D4ED8]'
                      : 'border border-[#CBD9EC] bg-white text-[#4A6587]'
                  }`}
                >
                  {selectedSite.demoMode ? 'Demo On' : 'Demo Off'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#DCE6F4] bg-[#FAFDFE] px-3 py-2.5">
                <div>
                  <div className="font-bold text-[#0F294D]">Pause Event Collection</div>
                  <div className="text-[11px] text-[#4A6587]">
                    Temporarily stop storing incoming SDK events without disconnecting
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    handleUpdateSetting(
                      { collectionPaused: !selectedSite.collectionPaused },
                      selectedSite.collectionPaused
                        ? 'Resumed event collection.'
                        : 'Paused event collection for this site.'
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#CBD9EC] bg-white px-3 py-1.5 text-xs font-bold text-[#0F294D] hover:bg-[#EFF6FF]"
                >
                  {selectedSite.collectionPaused ? (
                    <>
                      <PlayCircle className="h-3.5 w-3.5 text-[#10B981]" />
                      Resume
                    </>
                  ) : (
                    <>
                      <PauseCircle className="h-3.5 w-3.5 text-[#1D6FE8]" />
                      Pause
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-[#FECDD3] bg-[#FFF1F2] px-3 py-2.5">
                <div>
                  <div className="font-bold text-[#881337]">
                    {selectedSite.status === 'disconnected'
                      ? 'Site Disconnected'
                      : 'Disconnect Website'}
                  </div>
                  <div className="text-[11px] text-[#9F1239]">
                    {selectedSite.status === 'disconnected'
                      ? 'Reconnect to allow SDK ingestion again.'
                      : 'Immediately reject all incoming telemetry for this website.'}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    handleUpdateSetting(
                      {
                        status: selectedSite.status === 'disconnected' ? 'connected' : 'disconnected',
                      },
                      selectedSite.status === 'disconnected'
                        ? 'Website reconnected.'
                        : 'Website disconnected.'
                    )
                  }
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold ${
                    selectedSite.status === 'disconnected'
                      ? 'bg-[#047857] text-white hover:bg-[#065F46]'
                      : 'bg-[#BE123C] text-white hover:bg-[#9F1239]'
                  }`}
                >
                  <Unplug className="h-3.5 w-3.5" />
                  {selectedSite.status === 'disconnected' ? 'Reconnect' : 'Disconnect'}
                </button>
              </div>
            </div>
          </section>

          {/* Team Access */}
          <section className="ufa-card p-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-[#1D6FE8]" />
              <h2 className="text-sm font-bold text-[#0F294D]">Team Access</h2>
            </div>

            <ul className="mt-3 divide-y divide-[#EEF4FC] text-xs">
              {team.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2">
                  <div>
                    <div className="font-bold text-[#0F294D]">{m.name}</div>
                    <div className="text-[11px] text-[#4A6587]">{m.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#BFD3EC] bg-[#EFF6FF] px-2.5 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
                      {m.role}
                    </span>
                    {m.role !== 'Owner' && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(m.id)}
                        aria-label={`Remove ${m.name}`}
                        className="rounded p-1 text-[#647D9E] hover:bg-[#FFF1F2] hover:text-[#BE123C]"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <form onSubmit={handleAddMember} className="mt-3 space-y-2 border-t border-[#E6EEF8] pt-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  value={memberName}
                  onChange={(e) => setMemberName(e.target.value)}
                  placeholder="Full name"
                  className="h-8 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-2.5 text-xs focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
                />
                <input
                  type="email"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                  placeholder="member@company.com"
                  className="h-8 rounded-lg border border-[#CBD9EC] bg-[#F8FBFF] px-2.5 text-xs focus:border-[#1D6FE8] focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex gap-2">
                <select
                  aria-label="Team member role"
                  value={memberRole}
                  onChange={(e) => setMemberRole(e.target.value)}
                  className="h-8 flex-1 rounded-lg border border-[#CBD9EC] bg-white px-2.5 text-xs font-semibold text-[#0F294D]"
                >
                  <option value="Admin">Admin</option>
                  <option value="Security Analyst">Security Analyst</option>
                  <option value="Analyst">Analyst</option>
                  <option value="Viewer">Viewer</option>
                </select>
                <button
                  type="submit"
                  className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1D6FE8] px-3 text-xs font-bold text-white hover:bg-[#1D4ED8]"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Member
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
