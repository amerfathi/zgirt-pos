import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * @param {{isOpen: boolean, onClose?: () => void, title?: React.ReactNode,
 *   subtitle?: React.ReactNode, children?: React.ReactNode, footer?: React.ReactNode,
 *   maxWidth?: string, className?: string, showClose?: boolean}} props
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'max-w-lg',
  className = '',
  showClose = true
}) {
  // ESC key to close
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll
  useEffect(() => {
    if (typeof document === 'undefined' || !document.body) return;
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      if (document.body) document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-navy-950/60 backdrop-blur-[2px] transition-opacity"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
          role="dialog"
          aria-modal="true"
          className={`relative w-full ${maxWidth} bg-white rounded-2xl shadow-xl border border-slate-200/90 overflow-hidden z-10 flex flex-col max-h-[92vh] ${className}`}
        >
          {/* Header */}
          {(title || showClose) && (
            <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
              <div className="text-right">
                {title && (
                  <h3 className="text-sm font-bold text-navy-850 tracking-tight">
                    {title}
                  </h3>
                )}
                {subtitle && (
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    {subtitle}
                  </p>
                )}
              </div>

              {showClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-11 h-11 rounded-lg text-slate-600 hover:text-slate-700 hover:bg-slate-200/60 flex items-center justify-center transition-colors cursor-pointer"
                  aria-label="إغلاق"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-5 overflow-y-auto flex-1 scrollbar-thin scrollbar-thumb-slate-200">
            {children}
          </div>

          {/* Footer */}
          {footer && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/70 flex items-center justify-end gap-2 shrink-0">
              {footer}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
