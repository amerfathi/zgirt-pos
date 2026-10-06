import React from 'react';
import { AlertTriangle, RefreshCw, Trash2 } from 'lucide-react';
import { BRRAKA_LOGO } from '../assets/branding';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, isReloading: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled Application Error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ isReloading: true });
    setTimeout(() => {
      window.location.reload();
    }, 200);
  };

  handleClearCacheAndReload = () => {
    this.setState({ isReloading: true });
    try {
      sessionStorage.clear();
      localStorage.removeItem('khodar_active_tab');
      localStorage.removeItem('khodar_temp_draft');
    } catch (e) {
      console.warn('Cache clear error:', e);
    }
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div 
          className="min-h-screen w-screen bg-[#f8fafc] text-slate-800 flex flex-col items-center justify-center p-6 select-none font-sans" 
          dir="rtl"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl p-6 sm:p-8 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center border border-amber-200/70 shadow-xs">
              <AlertTriangle size={32} />
            </div>

            <img 
              src={BRRAKA_LOGO} 
              alt="براكه" 
              className="w-16 h-16 mx-auto mb-3 object-contain drop-shadow-xs" 
            />

            <h1 className="text-lg font-black text-slate-900 mb-1">
              عذراً، حدث خطأ غير متوقع
            </h1>
            <p className="text-xs text-slate-500 mb-6 font-medium leading-relaxed">
              واجه التطبيق مشكلة قد تمنع فتح بيانات هذا الحساب. لا تحذف بيانات المتصفح أو التطبيق؛ قد توجد حركات لم تكتمل مزامنتها. أعد الفتح، وإذا استمر الخطأ احتفظ بالبيانات لعملية الاسترداد.
            </p>

            {this.state.error && (
              <div className="mb-6 p-3 bg-slate-50 border border-slate-200 rounded-xl text-left font-mono text-[10px] text-slate-600 max-h-24 overflow-y-auto select-text">
                {this.state.error.toString()}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                disabled={this.state.isReloading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
              >
                <RefreshCw size={15} className={this.state.isReloading ? 'animate-spin' : ''} />
                <span>{this.state.isReloading ? 'جاري إعادة التشغيل...' : 'إعادة تشغيل التطبيق فوراً'}</span>
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                disabled={this.state.isReloading}
                className="w-full h-10 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Trash2 size={14} />
                <span>{this.state.isReloading ? 'جاري إنهاء الجلسة...' : 'إنهاء الجلسة وإعادة التحميل'}</span>
              </button>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] text-slate-400 font-medium">
              منظومة براكه المحاسبية
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
