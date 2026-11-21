import React, { useState } from 'react';
import {
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Globe,
  Hourglass,
  Lock,
  MapPin,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tablet,
  User,
} from 'lucide-react';
import type { VisitorSession } from '../types/analytics';
import { formatDuration, formatShortDuration, formatTimeHms } from '../api/client';

interface VisitorDetailsPanelProps {
  visitor: VisitorSession | null;
}

export function VisitorDetailsPanel({ visitor }: VisitorDetailsPanelProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (!visitor) return;
    navigator.clipboard?.writeText(visitor.anonSessionId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  if (!visitor) {
    return (
      <aside className="ufa-card flex h-full flex-col items-center justify-center p-6 text-center">
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#EFF6FF] text-[#1D6FE8]">
          <User className="h-5 w-5" />
        </div>
        <h2 className="text-sm font-bold text-[#0F294D]">No Visitor Selected</h2>
        <p className="mt-1 text-xs text-[#4A6587]">
          Click any visitor marker on the topology canvas or any row in Live Event Flow to inspect
          their anonymous session timeline.
        </p>
      </aside>
    );
  }

  const DeviceIcon =
    visitor.deviceType === 'mobile'
      ? Smartphone
      : visitor.deviceType === 'tablet'
        ? Tablet
        : Monitor;

  const hasAuthRedaction = visitor.timeline.some(
    (t) => t.eventType === 'Auth Metadata' || Boolean(t.metadataNote)
  );

  return (
    <aside
      aria-label="Selected visitor details"
      className="ufa-card flex h-full flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E6EEF8] px-4 py-3">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-[#1D6FE8]" />
          <h2 className="text-xs font-extrabold uppercase tracking-wider text-[#0F294D]">
            SELECTED VISITOR
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          {visitor.isDemo && (
            <span className="rounded-full border border-[#BFD3EC] bg-[#EFF6FF] px-2 py-0.5 text-[10px] font-bold text-[#1D4ED8]">
              Demo
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
              visitor.isActive
                ? 'bg-[#ECFDF5] text-[#047857]'
                : 'bg-[#F1F5F9] text-[#475569]'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                visitor.isActive ? 'bg-[#10B981]' : 'bg-[#94A3B8]'
              }`}
            />
            {visitor.isActive ? 'Live' : 'Ended'}
          </span>
        </div>
      </div>

      {/* Key Session Metadata */}
      <div className="space-y-2.5 border-b border-[#E6EEF8] px-4 py-3 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#4A6587]">
            <DeviceIcon className="h-3.5 w-3.5 text-[#3A547A]" />
            Anonymous Session ID
          </span>
          <div className="flex items-center gap-1">
            <code className="font-mono font-bold text-[#0F294D]">{visitor.anonSessionId}</code>
            <button
              type="button"
              onClick={handleCopy}
              title="Copy anonymous session ID"
              className="rounded p-1 text-[#4A6587] hover:bg-[#EFF6FF] hover:text-[#1D6FE8]"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-[#10B981]" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#4A6587]">
            <MapPin className="h-3.5 w-3.5 text-[#3A547A]" />
            IP (Masked)
          </span>
          <code className="font-mono font-semibold text-[#0F294D]">{visitor.maskedIp}</code>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#4A6587]">
            <Globe className="h-3.5 w-3.5 text-[#3A547A]" />
            Approx. Region
          </span>
          <span className="font-semibold text-[#0F294D]">{visitor.region}</span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#4A6587]">
            <Monitor className="h-3.5 w-3.5 text-[#3A547A]" />
            Current Page
          </span>
          <span className="rounded-md border border-[#93C5FD] bg-[#EFF6FF] px-2 py-0.5 font-semibold text-[#0F294D]">
            {visitor.currentLabel}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 text-[#4A6587]">
            <RefreshCw className="h-3.5 w-3.5 text-[#3A547A]" />
            Previous Page
          </span>
          <span className="rounded-md border border-[#CBD9EC] bg-[#F8FBFF] px-2 py-0.5 font-medium text-[#3A547A]">
            {visitor.previousLabel || 'Entry'}
          </span>
        </div>

        {/* Route summary bar */}
        <div className="rounded-lg border border-[#DCE6F4] bg-[#F8FBFF] px-2.5 py-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-[#647D9E]">
            Observed Journey Path
          </div>
          <div className="mt-0.5 truncate text-[11px] font-semibold text-[#1D4ED8]">
            {visitor.routeLabels.join(' → ')}
          </div>
        </div>

        {/* Privacy Redaction Guarantee Callout */}
        <div className="flex items-center gap-2 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-2.5 py-2 text-[11px] font-semibold text-[#047857]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[#10B981]" />
          <span>
            {hasAuthRedaction
              ? 'Login event recorded — credentials redacted.'
              : 'Safe metadata only — form inputs & passwords are never collected.'}
          </span>
        </div>
      </div>

      {/* Chronological Page-View Timeline */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="mb-2.5 flex items-center gap-1.5 text-xs font-bold text-[#0F294D]">
          <Clock className="h-3.5 w-3.5 text-[#1D6FE8]" />
          <span>Page-View Timeline</span>
        </div>

        <div className="relative space-y-2.5 pl-4">
          <div className="absolute bottom-2 left-[7px] top-2 w-0.5 bg-[#A7F3D0]" />
          {visitor.timeline.map((step) => (
            <div key={step.id} className="relative">
              <CheckCircle2 className="absolute -left-4 top-0.5 h-3.5 w-3.5 rounded-full bg-white text-[#10B981]" />
              <div className="flex items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-medium text-[#4A6587] tabular-nums">
                    {formatTimeHms(step.createdAt)}
                  </span>
                  <span className="truncate rounded border border-[#BFD3EC] bg-[#F1F6FD] px-2 py-0.5 text-[11px] font-semibold text-[#0F294D]">
                    {step.label}
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-[#4A6587] tabular-nums">
                  {formatShortDuration(step.dwellSec)}
                </span>
              </div>
              {step.metadataNote && (
                <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-[#D1FAE5] bg-[#F0FDF9] px-2 py-1 text-[10px] font-medium text-[#047857]">
                  <Lock className="h-3 w-3 shrink-0 text-[#059669]" />
                  <span>{step.metadataNote}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer: Session Duration */}
      <div className="flex items-center justify-between border-t border-[#E6EEF8] bg-[#FAFDFE] px-4 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-[#3A547A]">
          <Hourglass className="h-3.5 w-3.5 text-[#1D6FE8]" />
          Session Duration
        </span>
        <span className="font-mono text-sm font-bold text-[#0F294D] tabular-nums">
          {formatDuration(visitor.durationSec)}
        </span>
      </div>
    </aside>
  );
}
