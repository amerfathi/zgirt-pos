import React, { forwardRef } from 'react';

/** @typedef {React.InputHTMLAttributes<HTMLInputElement> & {label?: string, error?: string, helperText?: string, prefixIcon?: React.ElementType, suffixIcon?: React.ElementType}} InputProps */
/** @param {InputProps} props @param {React.ForwardedRef<HTMLInputElement>} ref */
function InputField({
  label,
  required = false,
  error,
  helperText,
  prefixIcon: PrefixIcon,
  suffixIcon: SuffixIcon,
  className = '',
  id,
  type = 'text',
  disabled = false,
  ...props
}, ref) {
  const inputId = id || (label ? `input-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined);

  return (
    <div className="w-full space-y-1 text-right">
      {label && (
        <label htmlFor={inputId} className="block text-[11px] font-semibold text-slate-700 select-none">
          {label} {required && <span className="text-rose-500 font-bold">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {PrefixIcon && (
          <div className="absolute right-3 text-slate-400 pointer-events-none flex items-center justify-center">
            <PrefixIcon size={14} />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          className={`w-full h-9 text-xs bg-white border rounded-xl text-slate-800 placeholder:text-slate-400 select-text transition-all duration-150 focus:outline-none focus:ring-2 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed ${
            PrefixIcon ? 'pr-8 pl-3' : 'px-3'
          } ${
            SuffixIcon ? 'pl-8' : ''
          } ${
            error
              ? 'border-rose-300 focus:border-rose-500 focus:ring-rose-500/20 text-rose-900'
              : 'border-slate-300/90 hover:border-slate-400 focus:border-primary-600 focus:ring-primary-500/20'
          } ${className}`}
          {...props}
        />

        {SuffixIcon && (
          <div className="absolute left-3 text-slate-400 pointer-events-none flex items-center justify-center">
            <SuffixIcon size={14} />
          </div>
        )}
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

const Input = forwardRef(InputField);

export default Input;
