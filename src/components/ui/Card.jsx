import React from 'react';

/** @param {React.HTMLAttributes<HTMLDivElement>} props */
export default function Card({ children, className = '', ...props }) {
  return (
    <div
      className={`bg-white border border-slate-200/90 rounded-2xl shadow-2xs overflow-hidden transition-all duration-150 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '', ...props }) {
  return (
    <div
      className={`px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between gap-3 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className = '', ...props }) {
  return (
    <h3
      className={`text-xs sm:text-sm font-bold text-navy-850 tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ children, className = '', ...props }) {
  return (
    <p
      className={`text-[11px] text-slate-500 font-normal mt-0.5 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ children, className = '', ...props }) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ children, className = '', ...props }) {
  return (
    <div
      className={`px-4 py-3 sm:px-5 sm:py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-2 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
