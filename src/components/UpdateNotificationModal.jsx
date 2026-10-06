import React from 'react';
import { 
  Sparkles, AlertTriangle, ArrowUpRight, Download, RefreshCw, 
  CheckCircle2, X, ShieldAlert, Monitor, Smartphone, Globe
} from 'lucide-react';
import { Button, Badge } from './ui';

export default function UpdateNotificationModal({ 
  isOpen, 
  updateInfo, 
  onClose, 
  onApplyUpdate 
}) {
  if (!isOpen || !updateInfo) return null;

  const {
    platform = 'web',
    currentVersion = '2.4.0',
    latestVersion = '2.4.0',
    isRequired = false,
    updateType = 'recommended',
    releaseNotes = [],
    downloadUrl
  } = updateInfo;

  const handleAction = () => {
    if (onApplyUpdate) {
      onApplyUpdate();
      return;
    }

    if (platform === 'web') {
      window.location.reload();
    } else if (downloadUrl) {
      window.open(downloadUrl, '_blank');
    }
  };

  const getPlatformIcon = () => {
    if (platform === 'windows') return <Monitor size={20} className="text-indigo-600" />;
    if (platform === 'android' || platform === 'ios') return <Smartphone size={20} className="text-emerald-600" />;
    return <Globe size={20} className="text-blue-600" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200/90 space-y-4">
        
        {/* Header */}
        <div className={`p-4 border-b flex items-start justify-between gap-3 ${
          isRequired 
            ? 'bg-rose-50/80 border-rose-100 text-rose-950' 
            : 'bg-slate-50 border-slate-100 text-slate-900'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
              isRequired ? 'bg-rose-100 border-rose-200 text-rose-700' : 'bg-white border-slate-200 text-primary-600'
            }`}>
              {isRequired ? <ShieldAlert size={22} /> : <Sparkles size={22} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">
                  {isRequired ? 'تحديث إجباري للنظام مطلوب' : 'يوجد إصدار جديد متاح الآن'}
                </h3>
                <Badge variant={isRequired ? 'danger' : 'success'} size="sm">
                  {isRequired ? 'إجباري' : (updateType === 'recommended' ? 'موصى به' : 'اختياري')}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isRequired 
                  ? 'هذا التحديث ضروري لمطابقة القواعد المحاسبية وسلامة البيانات' 
                  : 'يتضمن هذا التحديث ميزات جديدة وتحسينات هامة في الأداء'}
              </p>
            </div>
          </div>

          {!isRequired && (
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
            >
              <X size={16} />
            </button>
          )}
        </div>

        {/* Version Comparison Bar */}
        <div className="px-5">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              {getPlatformIcon()}
              <div>
                <span className="text-[10px] text-slate-400 block">إصدارك الحالي:</span>
                <span className="font-mono font-bold text-slate-700">v{currentVersion}</span>
              </div>
            </div>

            <div className="text-center font-bold text-slate-300">
              ➔
            </div>

            <div className="text-left">
              <span className="text-[10px] text-slate-400 block">الإصدار الأحدث:</span>
              <span className="font-mono font-bold text-emerald-700">v{latestVersion}</span>
            </div>
          </div>
        </div>

        {/* Release Notes */}
        <div className="px-5 space-y-2">
          <span className="text-xs font-bold text-slate-800 block">ما الجديد في هذا الإصدار:</span>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1 text-xs text-slate-600 bg-slate-50/50 p-3 rounded-xl border border-slate-100">
            {(releaseNotes.length > 0 ? releaseNotes : [
              'تحسينات عامة على سرعة أداء العمليات المحاسبية',
              'تحديث حزمة الأمان وتأمين مزامنة البيانات السحابية'
            ]).map((note, idx) => (
              <div key={idx} className="flex items-start gap-2 leading-relaxed">
                <CheckCircle2 size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <span>{note}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2.5">
          {!isRequired && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
            >
              لاحقاً
            </Button>
          )}

          <Button
            type="button"
            variant={isRequired ? 'danger' : 'primary'}
            size="sm"
            onClick={handleAction}
            className="gap-1.5"
          >
            {platform === 'web' ? <RefreshCw size={14} /> : <Download size={14} />}
            <span>{platform === 'web' ? 'تحديث المتصفح الآن' : 'تحميل وتثبيت التحديث'}</span>
          </Button>
        </div>

      </div>
    </div>
  );
}
