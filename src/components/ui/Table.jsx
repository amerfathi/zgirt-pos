import React from 'react';

export default function Table({ children, className = '', containerClassName = '' }) {
  return (
    <div className={`w-full overflow-x-auto border border-slate-200/90 rounded-2xl bg-white shadow-2xs scrollbar-thin ${containerClassName}`}>
      <table className={`w-full text-right text-xs text-slate-800 border-collapse ${className}`}>
        {children}
      </table>
    </div>
  );
}

export function TableHeader({ children, className = '' }) {
  return (
    <thead className={`bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-600 sticky top-0 z-10 ${className}`}>
      {children}
    </thead>
  );
}

export function TableHead({ children, className = '', align = 'right' }) {
  const alignClass = align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right';
  return (
    <th className={`py-2.5 px-3.5 whitespace-nowrap font-bold ${alignClass} ${className}`}>
      {children}
    </th>
  );
}

export function TableBody({ children, className = '' }) {
  return (
    <tbody className={`divide-y divide-slate-100/90 bg-white ${className}`}>
      {children}
    </tbody>
  );
}

/** @param {React.HTMLAttributes<HTMLTableRowElement>} props */
export function TableRow({ children, className = '', onClick }) {
  const isClickable = Boolean(onClick);
  return (
    <tr
      onClick={onClick}
      className={`transition-colors duration-100 ${
        isClickable ? 'hover:bg-slate-50/80 cursor-pointer' : 'hover:bg-slate-50/50'
      } ${className}`}
    >
      {children}
    </tr>
  );
}

export function TableCell({ children, className = '', align = 'right', isNumeric = false }) {
  const alignClass = align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right';
  const numClass = isNumeric ? 'font-mono tabular-nums' : '';
  return (
    <td className={`py-2.5 px-3.5 whitespace-nowrap text-xs text-slate-700 ${alignClass} ${numClass} ${className}`}>
      {children}
    </td>
  );
}
