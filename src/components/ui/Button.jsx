import React from 'react';
import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-navy-850 hover:bg-navy-900 text-white shadow-xs border border-navy-800/80 focus-visible:ring-primary-500/30',
  accent: 'bg-primary-600 hover:bg-primary-700 text-white shadow-xs border border-primary-500/80 focus-visible:ring-primary-500/40',
  secondary: 'bg-slate-100 hover:bg-slate-200/90 text-slate-800 border border-slate-200 focus-visible:ring-slate-400/30',
  outline: 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-300/90 shadow-2xs focus-visible:ring-slate-400/30',
  ghost: 'bg-transparent hover:bg-slate-100/90 text-slate-600 hover:text-slate-900 border border-transparent',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs border border-rose-500/80 focus-visible:ring-rose-500/30',
  dangerLight: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 focus-visible:ring-rose-500/30',
  success: 'bg-primary-600 hover:bg-primary-700 text-white shadow-xs border border-primary-500/80 focus-visible:ring-primary-500/30',
  successLight: 'bg-primary-50 hover:bg-primary-100 text-primary-800 border border-primary-200 focus-visible:ring-primary-500/30',
};

const SIZES = {
  sm: 'h-8 px-2.5 text-[11px] gap-1.5 rounded-lg',
  md: 'h-9 px-3.5 text-xs font-semibold gap-2 rounded-xl',
  lg: 'h-11 px-5 text-sm font-semibold gap-2.5 rounded-xl',
  icon: 'h-9 w-9 p-0 flex items-center justify-center rounded-xl shrink-0',
  'icon-sm': 'h-7 w-7 p-0 flex items-center justify-center rounded-lg shrink-0',
  'icon-xs': 'h-6 w-6 p-0 flex items-center justify-center rounded-md shrink-0',
};

/**
 * @param {React.ButtonHTMLAttributes<HTMLButtonElement> & {
 *   variant?: string, size?: string, isLoading?: boolean, loadingText?: string,
 *   icon?: React.ElementType, iconPosition?: 'start' | 'end'
 * }} props
 */
export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  isLoading = false,
  loadingText,
  disabled = false,
  type = 'button',
  icon: Icon,
  iconPosition = 'start',
  onClick,
  ...props
}) {
  const variantClass = VARIANTS[variant] || VARIANTS.primary;
  const sizeClass = SIZES[size] || SIZES.md;
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      className={`inline-flex items-center justify-center font-medium select-none transition-all duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 size={size === 'sm' || size === 'icon-sm' ? 12 : 14} className="animate-spin shrink-0 text-current" />
          {loadingText ? <span>{loadingText}</span> : children}
        </>
      ) : (
        <>
          {Icon && iconPosition === 'start' && <Icon size={size === 'sm' || size === 'icon-sm' ? 13 : 15} className="shrink-0" />}
          {children}
          {Icon && iconPosition === 'end' && <Icon size={size === 'sm' || size === 'icon-sm' ? 13 : 15} className="shrink-0" />}
        </>
      )}
    </button>
  );
}
