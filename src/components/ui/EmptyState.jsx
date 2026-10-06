import React from 'react';
import Button from './Button';

/**
 * @param {{icon?: React.ElementType, title: React.ReactNode, description?: React.ReactNode,
 *   actionLabel?: string, onAction?: React.MouseEventHandler<HTMLButtonElement>,
 *   actionIcon?: React.ElementType, className?: string}} props
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon: ActionIcon,
  className = ''
}) {
  return (
    <div className={`text-center py-12 px-4 select-none flex flex-col items-center justify-center space-y-3 ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 border border-slate-200/80 flex items-center justify-center mb-1">
          <Icon size={22} className="stroke-[1.6]" />
        </div>
      )}

      <div className="space-y-1 max-w-sm">
        <h4 className="text-xs sm:text-sm font-bold text-slate-800">
          {title}
        </h4>
        {description && (
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {description}
          </p>
        )}
      </div>

      {actionLabel && onAction && (
        <div className="pt-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onAction}
            icon={ActionIcon}
          >
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
