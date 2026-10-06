import React from 'react';

export default function Skeleton({ className = '', rounded = 'rounded-xl', ...props }) {
  return (
    <div
      className={`animate-pulse bg-slate-200/80 ${rounded} ${className}`}
      {...props}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="w-full space-y-2 p-3">
      <div className="h-8 bg-slate-100 rounded-lg animate-pulse" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-50 border border-slate-100 rounded-lg animate-pulse flex items-center gap-3 px-3">
          {Array.from({ length: cols }).map((_, j) => (
            <div key={j} className="h-3 bg-slate-200/70 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
