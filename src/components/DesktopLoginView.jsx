import React, { useState, useEffect, useRef } from 'react';
import { 
  Lock, User, KeyRound, ShieldCheck, Eye, EyeOff, 
  Store, Minus, Square, Copy, X, Database, CheckCircle2, AlertCircle
} from 'lucide-react';
import { APP_VERSION } from '../config/appVersion';
import { BRRAKA_LOGO } from '../assets/branding';
import ForgotPasswordModal from './ForgotPasswordModal';

export default function DesktopLoginView({ store }) {
  const { login, settings } = store;

  // Remember storeCode across sessions for store multi-tenancy
  const [storeCode, setStoreCode] = useState(() => {
    try {
      return localStorage.getItem('khodar_remembered_store_code') || 'BRK-101';
    } catch {
      return 'BRK-101';
    }
  });
  const [isEditingStoreCode, setIsEditingStoreCode] = useState(false);

  // Remember username across sessions and logouts for fast password-only entry
  const [username, setUsername] = useState(() => {
    try {
      return localStorage.getItem('khodar_remembered_username') || '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const usernameInputRef = useRef(null);
  const passwordInputRef = useRef(null);
  const storeCodeInputRef = useRef(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.isMaximized) {
      window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
    }
  }, []);

  // Smart focus: if username is remembered, focus password input directly for quick entry
  useEffect(() => {
    const timer = setTimeout(() => {
      if (username.trim()) {
        passwordInputRef.current?.focus();
      } else {
        usernameInputRef.current?.focus();
      }
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const handleMinimize = () => {
    if (window.electronAPI?.minimize) window.electronAPI.minimize();
  };

  const handleMaximize = async () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
      const max = await window.electronAPI.isMaximized().catch(() => false);
      setIsMaximized(max);
    }
  };

  const handleClose = () => {
    if (window.electronAPI?.close) window.electronAPI.close();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setErrorMessage('');

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setErrorMessage('يرجى إدخال اسم المستخدم وكلمة المرور');
      return;
    }

    if (!storeCode.trim()) {
      setErrorMessage('يرجى إدخال رمز المتجر');
      return;
    }

    setLoading(true);
    setTimeout(async () => {
      try {
        const res = await login(cleanUser, password, storeCode.trim());
        setLoading(false);
        if (res.success) {
          try {
            if (rememberMe) {
              localStorage.setItem('khodar_remembered_username', cleanUser);
              localStorage.setItem('khodar_remembered_store_code', storeCode.trim().toUpperCase());
            } else {
              localStorage.removeItem('khodar_remembered_username');
            }
          } catch (e) {
            console.warn('Failed to save remembered credentials', e);
          }
        } else {
          setErrorMessage(res.error || 'بيانات الدخول غير صحيحة');
        }
      } catch (err) {
        setLoading(false);
        setErrorMessage('حدث خطأ أثناء فحص بيانات الدخول');
      }
    }, 150);
  };

  return (
    <div className="braka-login h-screen w-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans select-none overflow-hidden" dir="rtl">
      
      {/* 1. Seamless Electron Native Window Titlebar (Clean Light Theme) */}
      <header 
        style={{ WebkitAppRegion: 'drag' }}
        className="h-10 bg-white border-b border-slate-200/90 flex items-center justify-between px-3 shrink-0 text-slate-700 select-none z-50 shadow-2xs"
      >
        <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' }}>
          <img 
            src={BRRAKA_LOGO} 
            alt="براكه" 
            className="w-7 h-7 rounded-lg object-contain shadow-2xs" 
          />
          <span className="text-xs font-bold text-slate-800">
            {settings?.shopName || 'براكه'} | محطة سطح المكتب
          </span>
          <span className="text-[10px] bg-slate-100 text-slate-600 font-mono font-bold px-1.5 py-0.5 rounded border border-slate-200">
            v{APP_VERSION}
          </span>
        </div>

        {/* Window Control Buttons */}
        <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' }}>
          <button
            type="button"
            onClick={handleMinimize}
            className="w-8 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title="تصغير"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            onClick={handleMaximize}
            className="w-8 h-7 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
            title={isMaximized ? "استعادة" : "تكبير"}
          >
            {isMaximized ? <Copy size={12} className="rotate-180" /> : <Square size={12} />}
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-7 flex items-center justify-center text-slate-500 hover:text-white hover:bg-rose-600 rounded transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X size={14} />
          </button>
        </div>
      </header>

      {/* 2. Main Login Area (Clean Crisp White & Off-White) */}
      <div className="flex-1 flex items-center justify-center p-4 relative bg-[#f8fafc]">
        
        <div className="w-full max-w-md relative z-10">
          
          {/* Card Container (Clean White Theme) */}
          <div className="bg-white border border-slate-200/90 rounded-3xl shadow-xl p-6 sm:p-8">
            
            {/* Header / Brand */}
            <div className="text-center mb-6">
              <img 
                src={BRRAKA_LOGO} 
                alt="براكه" 
                className="w-24 h-24 mx-auto mb-3 object-contain drop-shadow-sm" 
              />
              <h1 className="text-xl font-black text-slate-900 tracking-tight">
                {settings?.shopName || 'براكه | Brraka'}
              </h1>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                تسجيل الدخول لمحطة الكاشير والمحاسبة المعتمدة
              </p>
            </div>

            {/* Error Message */}
            {errorMessage && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span className="font-semibold">{errorMessage}</span>
              </div>
            )}

            {/* Store Code Active Badge / Selector */}
            {!isEditingStoreCode && storeCode ? (
              <div className="mb-4 p-2.5 bg-slate-50 border border-slate-200/90 rounded-2xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/60 flex items-center justify-center font-bold">
                    <Store size={15} />
                  </div>
                  <div className="text-right truncate">
                    <span className="text-[10px] text-slate-400 block font-medium">المنشأة المتصلة</span>
                    <span className="font-bold text-slate-800 text-xs truncate block">
                      {settings?.shopName || 'سوق ومحل الخضار والفواكه'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono font-black text-xs px-2.5 py-1 bg-white text-emerald-700 rounded-lg border border-slate-200 shadow-2xs tracking-wider" dir="ltr">
                    {storeCode}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingStoreCode(true);
                      setTimeout(() => storeCodeInputRef.current?.focus(), 100);
                    }}
                    className="text-[11px] text-slate-500 hover:text-emerald-700 font-bold px-1.5 py-1 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                    title="تغيير كود المتجر"
                  >
                    تغيير
                  </button>
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-emerald-50/50 border border-emerald-200 rounded-2xl animate-in fade-in">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-emerald-950">
                    رمز المتجر
                  </label>
                  {storeCode && (
                    <button
                      type="button"
                      onClick={() => setIsEditingStoreCode(false)}
                      className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                    >
                      إلغاء ✕
                    </button>
                  )}
                </div>
                <div className="relative">
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 pointer-events-none">
                    <Store size={15} />
                  </div>
                  <input
                    ref={storeCodeInputRef}
                    type="text"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    placeholder="مثال: BRK-101"
                    required
                    className="w-full h-10 pr-9 pl-16 bg-white border border-emerald-300 rounded-xl text-slate-900 text-xs font-mono font-black tracking-wider placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/20 transition-all uppercase"
                    dir="ltr"
                  />
                  {storeCode && (
                    <button
                      type="button"
                      onClick={() => setIsEditingStoreCode(false)}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer shadow-xs"
                    >
                      تثبيت
                    </button>
                  )}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  أدخل كود المتجر الممنوح لك لربط المحطة بالمنشأة وتنزيل حسابات الموظفين
                </p>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4 text-right">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  اسم المستخدم أو كود الكاشير
                </label>
                <div className="relative">
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <User size={15} />
                  </div>
                  <input
                    ref={usernameInputRef}
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="أدخل اسم المستخدم أو البريد"
                    required
                    className="w-full h-11 pr-10 pl-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-all select-text font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  كلمة المرور
                </label>
                <div className="relative">
                  <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <KeyRound size={15} />
                  </div>
                  <input
                    ref={passwordInputRef}
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full h-11 pr-10 pl-10 bg-white border border-slate-300 rounded-xl text-slate-900 text-xs placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-500/15 transition-all select-text font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30 cursor-pointer"
                  />
                  <span className="font-medium">تذكر بيانات الدخول</span>
                </label>

                <button
                  type="button"
                  onClick={() => setIsForgotPasswordOpen(true)}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline cursor-pointer"
                >
                  نسيت كلمة المرور؟
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99] disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <ShieldCheck size={16} />
                    <span>تسجيل الدخول ومتابعة العمل</span>
                  </>
                )}
              </button>
            </form>

            {/* System Status Indicators */}
            <div className="mt-6 flex items-center justify-between text-[11px] text-slate-500 pt-3.5 border-t border-slate-100 font-medium">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-slate-600">قاعدة البيانات المحلية: جاهزة</span>
              </div>
              <div className="flex items-center gap-1">
                <Database size={12} className="text-slate-400" />
                <span>محطة سطح المكتب رقم 1</span>
              </div>
            </div>

          </div>

          <div className="text-center mt-4 text-[11px] text-slate-400 font-medium">
            المنظومة المحاسبية المتكاملة &bull; جميع الحقوق محفوظة &copy; 2026
          </div>

        </div>

      </div>

      <ForgotPasswordModal 
        isOpen={isForgotPasswordOpen} 
        onClose={() => setIsForgotPasswordOpen(false)} 
        store={store} 
      />

    </div>
  );
}
