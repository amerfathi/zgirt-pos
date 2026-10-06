import React, { useState, useEffect } from 'react';
import { 
  ArrowUpCircle, Download, CheckCircle2, AlertTriangle, X, 
  RefreshCw, ShieldCheck, Sparkles, HardDrive, FileCheck, Ban
} from 'lucide-react';
import { Button, Badge } from './ui';
import { APP_VERSION } from '../config/appVersion';

export default function DesktopUpdateModal({ 
  isOpen, 
  onClose, 
  releaseInfo,
  cartItemsCount = 0
}) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'downloading' | 'ready' | 'installer-opened' | 'error'
  const [progress, setProgress] = useState({
    percent: 0,
    receivedBytes: 0,
    totalBytes: 0,
    speedBytesPerSec: 0
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [downloadedFilePath, setDownloadedFilePath] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setStatus('idle');
      setProgress({ percent: 0, receivedBytes: 0, totalBytes: 0, speedBytesPerSec: 0 });
      setErrorMessage('');
      return;
    }

    // Listen to download progress from Electron IPC
    if (typeof window !== 'undefined' && window.electronAPI?.onDownloadProgress) {
      const cleanup = window.electronAPI.onDownloadProgress((data) => {
        setProgress(previous => ({ ...previous, ...data }));
      });
      return cleanup;
    }
  }, [isOpen]);

  if (!isOpen || !releaseInfo) return null;

  const handleStartDownload = async () => {
    setStatus('downloading');
    setErrorMessage('');

    const targetUrl = releaseInfo.downloadUrl || 
      `https://github.com/amerfathi/khodar-pos/releases/download/v${releaseInfo.latestVersion}/KhodarPOS-Setup.exe`;

    try {
      if (window.electronAPI?.downloadUpdate) {
        const res = await window.electronAPI.downloadUpdate(targetUrl);
        if (res.success) {
          setDownloadedFilePath(res.filePath);
          setStatus('ready');
        } else {
          setErrorMessage(res.error || 'تعذر استكمال تحميل ملف التحديث');
          setStatus('error');
        }
      } else {
        // In browser fallback
        window.open(targetUrl, '_blank');
        setStatus('idle');
      }
    } catch (err) {
      setErrorMessage(err.message || 'حدث خطأ أثناء تحميل التحديث');
      setStatus('error');
    }
  };

  const handleCancelDownload = () => {
    if (window.electronAPI?.cancelDownloadUpdate) {
      window.electronAPI.cancelDownloadUpdate();
    }
    setStatus('idle');
  };

  const handleInstallAndRestart = async () => {
    if (cartItemsCount > 0) {
      const confirmProceed = window.confirm(
        'تنبيه: توجد أصناف في سلة الكاشير حالياً! هل تريد المتابعة وإعادة التشغيل الآن؟'
      );
      if (!confirmProceed) return;
    }

    try {
      if (window.electronAPI?.installUpdate) {
        const result = await window.electronAPI.installUpdate();
        if (!result.success) throw new Error(result.error || 'تعذر تشغيل مثبت التحديث');
        setStatus('installer-opened');
        window.electronAPI.close();
      }
    } catch (err) {
      setErrorMessage(err.message || 'تعذر تشغيل مثبت التحديث');
      setStatus('error');
    }
  };

  const formatMB = (bytes) => {
    if (!bytes) return '0 MB';
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatSpeed = (bytesPerSec) => {
    if (!bytesPerSec) return '0 KB/s';
    if (bytesPerSec >= 1024 * 1024) {
      return `${(bytesPerSec / (1024 * 1024)).toFixed(2)} MB/s`;
    }
    return `${Math.round(bytesPerSec / 1024)} KB/s`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none" dir="rtl">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
        onClick={status === 'downloading' ? undefined : onClose}
      />

      {/* Modal Dialog */}
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <ArrowUpCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-900">تحديث البرنامج الداخلي</h3>
                <Badge variant="success" size="sm">إصدار {releaseInfo.latestVersion}</Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                الإصدار الحالي: {APP_VERSION} &bull; تحديث مباشر داخل التطبيق
              </p>
            </div>
          </div>

          {status !== 'downloading' && (
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Content Body */}
        <div className="space-y-4">
          
          {/* Unsaved Cart Warning */}
          {cartItemsCount > 0 && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600 shrink-0" />
              <span>تنبيه: يوجد ({cartItemsCount}) صنف في سلة الكاشير. يُفضل حفظ الفاتورة قبل التثبيت.</span>
            </div>
          )}

          {/* Release Notes */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
            <span className="text-xs font-bold text-slate-700 block mb-2">
              {releaseInfo.isUpdateAvailable 
                ? `أبرز التحسينات في الإصدار الجديد v${releaseInfo.latestVersion}:`
                : `مميزات الإصدار الحالي v${releaseInfo.currentVersion || APP_VERSION}:`
              }
            </span>
            <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
              {(releaseInfo.releaseNotes && releaseInfo.releaseNotes.length > 0) ? (
                releaseInfo.releaseNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))
              ) : (
                <>
                  <li>تحديثات مهمة لرفع كفاءة واستقرار المنظومة.</li>
                  <li>إصلاحات أمنية وبرمجية عامة وشاملة.</li>
                  <li>إضافة ميزات وترقيات برمجية جديدة.</li>
                  <li>تحسينات عامة على واجهة وتجربة المستخدم.</li>
                </>
              )}
            </ul>
          </div>

          {/* State: Idle & Update Available */}
          {status === 'idle' && releaseInfo.isUpdateAvailable && (
            <div className="pt-2">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2.5">
                <ShieldCheck size={18} className="text-emerald-600 shrink-0" />
                <span>التحديث آمن تماماً، ولا يمس قاعدة البيانات المحلية أو إعدادات فروعك وفواتيرك.</span>
              </div>

              <div className="mt-5 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  تذكيري لاحقاً
                </button>
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Download size={15} />
                  <span>تحميل التحديث وتثبيته الآن</span>
                </button>
              </div>
            </div>
          )}

          {/* State: Idle & Already Up-To-Date */}
          {status === 'idle' && !releaseInfo.isUpdateAvailable && (
            <div className="pt-2">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-950 flex items-center gap-3">
                <CheckCircle2 size={22} className="text-emerald-600 shrink-0" />
                <div>
                  <strong className="block text-emerald-900 font-bold mb-0.5">النظام يعمل بأحدث إصدار رسمي مستقر!</strong>
                  <span>أنت تستخدم أحدث نسخة معتمدة v{releaseInfo.currentVersion || APP_VERSION}. لا توجد تحديثات جديدة مطلوبة حالياً.</span>
                </div>
              </div>

              <div className="mt-5 flex items-center justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold transition-all shadow-sm cursor-pointer"
                >
                  إغلاق
                </button>
              </div>
            </div>
          )}

          {/* State: Downloading */}
          {status === 'downloading' && (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                <span className="flex items-center gap-2">
                  <RefreshCw size={14} className="text-emerald-600 animate-spin" />
                  <span>جارٍ تنزيل ملف التحديث...</span>
                </span>
                <span className="font-mono text-emerald-700">{progress.percent}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-emerald-600 rounded-full transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                <span>
                  الحجم: {formatMB(progress.receivedBytes)} / {formatMB(progress.totalBytes)}
                </span>
                <span>
                  السرعة: {formatSpeed(progress.speedBytesPerSec)}
                </span>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleCancelDownload}
                  className="py-1.5 px-3 rounded-lg border border-slate-300 text-slate-600 text-xs font-medium hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
                >
                  <Ban size={13} />
                  <span>إلغاء التحميل</span>
                </button>
              </div>
            </div>
          )}

          {/* State: Ready To Install */}
          {status === 'ready' && (
            <div className="space-y-4 pt-1">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs text-emerald-800">
                  <CheckCircle2 size={18} className="text-emerald-600" />
                  <span>اكتمل تنزيل التحديث والتحقق من سلامته</span>
                </div>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  سيُغلق براكه إغلاقًا طبيعيًا بعد الضغط، ثم يفتح المثبّت تلقائيًا. لن تُحذف بياناتك المحلية.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  تثبيت لاحقًا
                </button>
                <button
                  type="button"
                  onClick={handleInstallAndRestart}
                  className="py-2.5 px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <FileCheck size={16} />
                  <span>تثبيت التحديث وإغلاق براكه</span>
                </button>
              </div>
            </div>
          )}

          {status === 'installer-opened' && (
            <div className="space-y-4 pt-1">
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 space-y-2">
                <strong className="block">تم تشغيل مُثبّت التحديث</strong>
                <p>تأكد من ظهور نافذة التثبيت على سطح المكتب. بعد ظهورها، أغلق براكه واستكمل خطوات المثبّت. قد يطلب Windows موافقتك على تشغيل ملف من ناشر غير معروف.</p>
                <p>إذا لم تظهر النافذة، لا تُغلق براكه. ملف التحديث المحقَّق منه محفوظ في: <span className="break-all select-text">{downloadedFilePath}</span></p>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={onClose} className="py-2.5 px-4 rounded-xl border border-slate-300 text-xs font-semibold">البقاء في براكه</button>
                <button type="button" onClick={() => window.electronAPI?.close()} className="py-2.5 px-5 rounded-xl bg-emerald-600 text-white text-xs font-bold">إغلاق براكه ومتابعة التثبيت</button>
              </div>
            </div>
          )}

          {/* State: Error */}
          {status === 'error' && (
            <div className="space-y-3 pt-1">
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2">
                <AlertTriangle size={16} className="text-rose-600 shrink-0" />
                <span>{errorMessage || 'حدث خطأ غير متوقع أثناء التحميل'}</span>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-4 rounded-xl border border-slate-300 text-xs font-semibold cursor-pointer"
                >
                  إغلاق
                </button>
                <button
                  type="button"
                  onClick={handleStartDownload}
                  className="py-2 px-5 rounded-xl bg-slate-900 text-white text-xs font-bold cursor-pointer"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
