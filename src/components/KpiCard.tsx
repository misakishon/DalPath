import React from 'react';
import { ArrowUpRight } from 'lucide-react';

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delta?: string;
  sparkline?: number[];
  accent?: 'blue' | 'teal';
}

export function KpiCard({ icon, label, value, delta, sparkline, accent = 'blue' }: KpiCardProps) {
  const sparkPath = React.useMemo(() => {
    if (!sparkline || sparkline.length < 2) return '';
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const span = Math.max(0.01, max - min);
    const width = 62;
    const height = 22;
    return sparkline
      .map((val, idx) => {
        const x = (idx / (sparkline.length - 1)) * width;
        const y = height - ((val - min) / span) * (height - 4) - 2;
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }, [sparkline]);

  return (
    <div className="ufa-card ufa-kpi-card transition-colors hover:border-[#93B4DF]">
      <div className="ufa-kpi-card-inner">
        <div
          className={`ufa-kpi-icon flex items-center justify-center rounded-lg ${
            accent === 'teal'
              ? 'bg-[#ECFDF5] text-[#059669]'
              : 'bg-[#EFF6FF] text-[#1D6FE8]'
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="ufa-kpi-label truncate font-medium text-[#4A6587]" title={label}>
            {label}
          </div>
          <div className="ufa-kpi-metrics mt-0.5">
            <span className="ufa-kpi-value font-extrabold tracking-tight text-[#0F294D] tabular-nums">
              {value}
            </span>
            {delta ? (
              <span className="ufa-kpi-delta inline-flex items-center gap-0.5 rounded-full bg-[#ECFDF5] font-bold text-[#047857]">
                <ArrowUpRight className="h-2.5 w-2.5 shrink-0" />
                {delta}
              </span>
            ) : null}
            {sparkPath ? (
              <svg
                viewBox="0 0 62 22"
                preserveAspectRatio="xMidYMid meet"
                className="ufa-kpi-sparkline"
                aria-hidden="true"
              >
                <path
                  d={sparkPath}
                  fill="none"
                  stroke="#10B981"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
