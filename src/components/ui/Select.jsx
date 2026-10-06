import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

/** @typedef {React.SelectHTMLAttributes<HTMLSelectElement> & {label?: string, error?: string, helperText?: string}} SelectProps */
/** @param {SelectProps} props @param {React.ForwardedRef<HTMLSelectElement>} ref */
function SelectField({
  label,
  required = false,
  error,
  helperText,
  children,
  className = '',
  id,
  disabled = false,
  ...props
}, ref) {
  const selectId = id || (label ? `select-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="w-full space-y-1 text-right">
      {label && (
        <label htmlFor={selectId} className="block text-[11px] font-semibold text-slate-700 select-none">
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          className={`w-full h-9 px-3 text-xs bg-white border rounded-xl text-slate-800 transition-all duration-150 appearance-none cursor-pointer focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed pl-8 ${
            error
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900'
              : 'border-slate-300/90 hover:border-slate-400 focus:border-primary-600 focus:ring-primary-500/20'
          } ${className}`}
          {...props}
        >
          {children}
        </select>

        <div className="absolute left-2.5 text-slate-400 pointer-events-none flex items-center justify-center">
          <ChevronDown size={14} />
        </div>
      </div>

      {error && (
        <p className="text-[10px] text-rose-600 font-medium select-none flex items-center gap-1 mt-0.5">
          <span>{error}</span>
        </p>
      )}

      {helperText && !error && (
        <p className="text-[10px] text-slate-500 select-none mt-0.5">
          {helperText}
        </p>
      )}
    </div>
  );
}

const Select = forwardRef(SelectField);

export default Select;
