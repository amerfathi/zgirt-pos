import React, { useState } from 'react';
import { Settings, Save, Download, Upload, RefreshCw, Check, X, Store, Phone, MapPin, DollarSign, FileText, Package, AlertCircle, Lock, KeyRound, Type, Sliders, LogOut } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose, store, onOpenChangePassword }) {
  const { settings, currentUser, updateSettings, exportBackupJSON, importBackupJSON, resetToSampleData } = store;

  const [form, setForm] = useState({ ...settings });
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Synchronize form if settings changes or modal reopens
  React.useEffect(() => {
    if (isOpen) {
      setForm({ ...settings });
    }
  }, [isOpen, settings]);

  if (!isOpen) return null;

  const handleSave = async () => {
    try {
      await updateSettings(form);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 800);
    } catch (error) { alert('تعذر حفظ الإعدادات: ' + error.message); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const res = await importBackupJSON(content);
          if (res.success) { alert('تم استيراد البيانات بنجاح!'); onClose(); }
          else alert('خطأ في قراءة ملف النسخة الاحتياطية: ' + res.error);
        } catch (error) { alert('تعذر استيراد النسخة: ' + error.message); }
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Settings size={18} className="text-brand-400" />
            <h3 className="font-bold text-sm">إعدادات المحل والنظام</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          
          {/* Tenant Account & Security Card */}
          {currentUser && (
            <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                    {currentUser.role === 'super_admin' ? '👑' : '🏢'}
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-white leading-tight">
                      {currentUser.companyName || 'حساب المتجر'}
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      {currentUser.role === 'super_admin' ? 'حساب إدارة المنصة' : 'حساب سحابي معتمد'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5 bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 px-2 py-1 rounded-lg">
                    <Store size={12} />
                    <span className="font-mono font-bold text-xs" dir="ltr">
                      {currentUser.storeCode || (typeof localStorage !== 'undefined' && localStorage.getItem('khodar_remembered_store_code')) || 'BRK-101'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700/80">
                    <Lock size={12} className="text-emerald-400" />
                    <span className="font-mono font-bold text-slate-200 text-xs" dir="ltr">
                      {currentUser.username}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-[11px] gap-2 flex-wrap">
                <span className="text-slate-400">
                  صلاحية الاشتراك: <strong className="text-emerald-400 font-mono">{currentUser.role === 'super_admin' ? 'دائم' : currentUser.expiresAt}</strong>
                </span>

                <div className="flex items-center gap-2">
                  {onOpenChangePassword && (
                    <button
                      type="button"
                      onClick={() => { onClose(); onOpenChangePassword(); }}
                      className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                    >
                      <KeyRound size={13} />
                      <span>تغيير كلمة المرور</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                        onClose();
                        store.logout();
                      }
                    }}
                    className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer text-xs"
                  >
                    <LogOut size={13} />
                    <span>تسجيل الخروج</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Font Size Scaling Slider */}
          <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                <Type size={15} className="text-emerald-600" />
                <span>ضبط حجم خطوط وشاشات البرنامج</span>
              </h4>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg text-xs font-mono font-bold">
                {form.fontSizeScale || 100}%
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              اسحب المؤشر لتكبير أو تصغير حجم النصوص والأزرار في شاشات النظام:
            </p>

            <input
              type="range"
              min="80"
              max="130"
              step="5"
              value={form.fontSizeScale || 100}
              onChange={(e) => {
                const val = Number(e.target.value);
                setForm(prev => ({ ...prev, fontSizeScale: val }));
                document.documentElement.style.fontSize = `${(val / 100) * 16}px`;
              }}
              className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>80% (صغير)</span>
              <span className="text-emerald-700 font-bold">100% (افتراضي)</span>
              <span>130% (كبير)</span>
            </div>

            <div className="flex items-center gap-1.5 pt-1">
              {[85, 100, 115, 130].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => {
                    setForm(prev => ({ ...prev, fontSizeScale: val }));
                    document.documentElement.style.fontSize = `${(val / 100) * 16}px`;
                  }}
                  className={`flex-1 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                    Number(form.fontSizeScale || 100) === val
                      ? 'bg-emerald-600 text-white border-emerald-700'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {val === 100 ? 'افتراضي' : `${val}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Store Info */}
          <div className="space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Store size={14} className="text-brand-600" />
              <span>بيانات المحل التجاري</span>
            </h4>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">اسم المحل أو التاجر</label>
              <input
                type="text"
                value={form.shopName}
                onChange={(e) => setForm(prev => ({ ...prev, shopName: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">الوصف أو النشاط</label>
              <input
                type="text"
                value={form.subTitle}
                onChange={(e) => setForm(prev => ({ ...prev, subTitle: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">رقم الهاتف الأساسي</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">العملة الحالية</label>
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-slate-900 focus:ring-2 focus:ring-brand-600"
                  />
                  {['د.ل', 'ر.س', 'ج.م', 'د.إ', '$'].map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setForm(prev => ({ ...prev, currency: c }))}
                      className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded-lg text-[10px] font-bold"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">العنوان أو مكان السوق</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">ملاحظة أسفل الفاتورة</label>
              <input
                type="text"
                value={form.invoiceNote}
                onChange={(e) => setForm(prev => ({ ...prev, invoiceNote: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">
                العهدة النقدية الافتتاحية للدرج (فكة بداية الصندوق)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="1"
                  placeholder="0.00"
                  value={form.openingCashDrawerFloat !== undefined ? form.openingCashDrawerFloat : ''}
                  onChange={(e) => setForm(prev => ({ ...prev, openingCashDrawerFloat: Number(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-800 focus:ring-2 focus:ring-brand-600"
                />
                <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-medium">
                  {form.currency || 'ر.س'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                المبلغ النقدي الذي يوضع في الدرج صباحاً كفكة للزبائن ليتم احتسابه تلقائياً في مطابقة الصندوق والجرد اليومي.
              </p>
            </div>
          </div>

          {/* Inventory and Stock Policy */}
          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
              <Package size={14} className="text-emerald-600" />
              <span>سياسة إدارة المخزون والمبيعات</span>
            </h4>

            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-bold text-slate-900 block text-xs">
                    السماح بالبيع عند نفاد المخزون (البيع على ذمة التوريد)
                  </span>
                  <span className="text-[11px] text-slate-500 block mt-0.5">
                    مفيد عند وصول بضاعة طازجة فجراً ورغبة البائع بالبيع فوراً قبل إدخال فاتورة الشراء
                  </span>
                </div>
                
                {/* Toggle Switch */}
                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, allowNegativeStock: !prev.allowNegativeStock }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    form.allowNegativeStock ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                      form.allowNegativeStock ? '-translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              <div className={`p-2.5 rounded-xl text-[11px] leading-relaxed transition-all ${
                form.allowNegativeStock 
                  ? 'bg-amber-50/90 text-amber-900 border border-amber-200/70' 
                  : 'bg-emerald-50/80 text-emerald-900 border border-emerald-200/70'
              }`}>
                {form.allowNegativeStock ? (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      <strong>وضع البيع المرن:</strong> يستطيع البائع إصدار فواتير بيع حتى لو كان رصيد الصنف صفراً، وسيظهر رصيد المخزن بالسالب مؤقتاً لحين تسجيل فاتورة الشراء من المورد لتسوية الحساب تلقائياً.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-start gap-1.5">
                    <AlertCircle size={15} className="text-emerald-700 shrink-0 mt-0.5" />
                    <span>
                      <strong>وضع الضبط الصارم (موصى به):</strong> يمنع النظام إتمام أي فاتورة بيع لأي صنف رصيده صفر أو غير كافٍ بالمخزن لمنع البيع الوهمي، مع إظهار رسالة توجيهية للكاشير.
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Backup and Data Management */}
          <div className="pt-3 border-t border-slate-100 space-y-2.5">
            <h4 className="font-bold text-slate-800 text-xs">حفظ البيانات والنسخ الاحتياطي</h4>
            <p className="text-[11px] text-slate-500">
              جميع العمليات والحسابات تُحفظ تلقائياً في ذاكرة المتصفح والهاتف وتعمل بدون إنترنت.
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={exportBackupJSON}
                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors"
              >
                <Download size={14} />
                <span>تصدير نسخة احتياطية</span>
              </button>

              <label className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer text-center">
                <Upload size={14} />
                <span>استيراد ملف نسخة</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('هل أنت متأكد من استعادة البيانات النموذجية الأولية؟')) {
                    try { await resetToSampleData(); onClose(); }
                    catch (error) { alert(error.message); }
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-slate-600 underline"
              >
                استعادة البيانات التجريبية الأولية
              </button>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl"
          >
            إلغاء
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-md shadow-brand-600/20 transition-all"
          >
            {saveSuccess ? <Check size={16} /> : <Save size={16} />}
            <span>{saveSuccess ? 'تم الحفظ!' : 'حفظ الإعدادات'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
