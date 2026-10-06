import React from 'react';

/**
 * @param {{title: React.ReactNode, value: React.ReactNode, currency?: string,
 *   subtitle?: React.ReactNode, icon?: React.ElementType, iconBg?: string,
 *   valueColor?: string, badge?: React.ReactNode, badgeVariant?: string,
 *   className?: string, onClick?: React.MouseEventHandler<HTMLDivElement>}} props
 */
export default function StatCard({
  title,
  value,
  currency,
  subtitle,
  icon: Icon,
  iconBg = 'bg-slate-100 text-slate-700',
  valueColor = 'text-navy-850',
  badge,
  badgeVariant = 'neutral',
  className = '',
  onClick
}) {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      className={`bg-white border border-slate-200/90 rounded-2xl p-3 sm:p-4 shadow-2xs transition-all duration-150 relative overflow-hidden select-none ${
        isClickable ? 'hover:border-slate-300 hover:shadow-xs cursor-pointer' : ''
      } ${className}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="text-xs font-semibold text-slate-600 block truncate">
            {title}
          </span>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className={`text-base sm:text-lg font-bold font-mono tracking-tight tabular-nums ${valueColor}`}>
              {value}
            </span>
            {currency && (
              <span className="text-xs font-medium text-slate-600">
                {currency}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border border-black/5 ${iconBg}`}>
            <Icon size={16} />
          </div>
        )}
      </div>

      {(subtitle || badge) && (
        <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between gap-1 text-[10px] text-slate-400">
          {subtitle && <span className="truncate">{subtitle}</span>}
          {badge && <span className="shrink-0 font-medium">{badge}</span>}
        </div>
      )}
    </div>
  );
}
