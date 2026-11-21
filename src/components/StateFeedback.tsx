import React from 'react';
import { AlertCircle, Inbox, RefreshCw, WifiOff } from 'lucide-react';

export function LoadingSkeleton({ rows = 4, label = 'Loading analytics telemetry...' }: { rows?: number; label?: string }) {
  return (
    <div className="ufa-card p-5" role="status" aria-live="polite">
      <div className="mb-4 flex items-center gap-2 text-xs font-semibold text-[#4A6587]">
        <span className="inline-block h-2 w-2 rounded-full bg-[#1D6FE8] animate-pulse" />
        {label}
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, idx) => (
          <div
            key={idx}
            className="h-9 rounded-lg bg-[#EFF5FC] animate-pulse"
            style={{ width: `${96 - (idx % 3) * 12}%` }}
          />
        ))}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#BFD3EC] bg-[#F8FBFF] px-6 py-10 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#E6F0FD] text-[#1D6FE8]">
        <Inbox className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-bold text-[#0F294D]">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-[#4A6587]">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center justify-center rounded-xl border border-[#FECDD3] bg-[#FFF1F2] px-6 py-8 text-center"
    >
      <div className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFE4E6] text-[#BE123C]">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-bold text-[#881337]">Unable to load analytics data</h3>
      <p className="mt-1 max-w-md text-xs text-[#9F1239]">{message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#0F294D] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#1E3A63]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Request
        </button>
      ) : null}
    </div>
  );
}

export function DisconnectedBanner({
  reason,
  onReconnect,
}: {
  reason: string;
  onReconnect?: () => void;
}) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-4 py-2.5 text-xs text-[#1E3A8A]"
    >
      <div className="flex items-center gap-2 font-medium">
        <WifiOff className="h-4 w-4 text-[#4338CA]" />
        <span>{reason}</span>
      </div>
      {onReconnect ? (
        <button
          type="button"
          onClick={onReconnect}
          className="inline-flex items-center gap-1.5 rounded-md border border-[#A5B4FC] bg-white px-2.5 py-1 text-xs font-semibold text-[#1E3A8A] hover:bg-[#E0E7FF]"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Reconnect
        </button>
      ) : null}
    </div>
  );
}
