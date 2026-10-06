import React from 'react';

const VARIANTS = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200/80',
  primary: 'bg-navy-50 text-navy-850 border-navy-200/80',
  accent: 'bg-primary-50 text-primary-700 border-primary-200/80',
  success: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
  warning: 'bg-amber-50 text-amber-900 border-amber-200/80',
  danger: 'bg-rose-50 text-rose-800 border-rose-200/80',
  info: 'bg-sky-50 text-sky-800 border-sky-200/80',
};

const DOT_COLORS = {
  neutral: 'bg-slate-400',
  primary: 'bg-navy-700',
  accent: 'bg-primary-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  danger: 'bg-rose-500',
  info: 'bg-sky-500',
};

/** @param {{children?: React.ReactNode, variant?: string, size?: string, dot?: boolean, className?: string, icon?: React.ElementType}} props */
export default function Badge({
  children,
  variant = 'neutral',
  size = 'md',
  dot = false,
  className = '',
  icon: Icon
}) {
  const variantStyle = VARIANTS[variant] || VARIANTS.neutral;
  const dotColor = DOT_COLORS[variant] || DOT_COLORS.neutral;
  const sizeStyle = size === 'sm' ? 'text-[10px] px-1.5 py-0.5 rounded-md' : 'text-[11px] px-2 py-0.5 rounded-lg';

  return (
    <span className={`inline-flex items-center gap-1 font-semibold border select-none whitespace-nowrap ${sizeStyle} ${variantStyle} ${className}`}>
      {dot && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />}
      {Icon && <Icon size={size === 'sm' ? 10 : 12} className="shrink-0" />}
      <span>{children}</span>
    </span>
  );
}
