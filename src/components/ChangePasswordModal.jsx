import React, { useState } from 'react';
import { Lock, KeyRound, Check, X, ShieldCheck, AlertCircle, Eye, EyeOff } from 'lucide-react';

export default function ChangePasswordModal({ isOpen, onClose, store }) {
  const { currentUser, changePassword } = store;

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen || !currentUser) return null;

  const handleSave = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!newPassword.trim()) {
      setErrorMessage('يرجى إدخال كلمة المرور الجديدة');
      return;
    }

    if (newPassword.length < 12) {
      setErrorMessage('كلمة المرور يجب أن لا تقل عن 12 خانة');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('كلمة المرور وتأكيدها غير متطابقين');
      return;
    }

    let success;
    try { success = await changePassword(newPassword, currentPassword); }
    catch (error) { setErrorMessage(error.message); return; }
    setCurrentPassword('');
    if (success) {
      setSuccessMessage('تم تغيير كلمة المرور بنجاح!');
      setTimeout(() => {
        setSuccessMessage('');
        setNewPassword('');
        setConfirmPassword('');
        onClose();
      }, 1200);
    } else {
      setErrorMessage('حدث خطأ أثناء تغيير كلمة المرور');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in" dir="rtl">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-emerald-400" />
            <h3 className="font-bold text-sm">تغيير كلمة المرور الخاصة بحسابك</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
          
          {/* Immutable Username Notice Card */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500">اسم المستخدم (معرف الشركة الثابت):</span>
              <div className="flex items-center gap-1.5 bg-slate-200/80 px-2.5 py-1 rounded-lg">
                <Lock size={12} className="text-slate-500" />
                <span className="font-mono font-black text-slate-900 text-xs" dir="ltr">
                  {currentUser.username}
                </span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 leading-relaxed">
              🔒 اسم المستخدم ثابت ومحمي في النظام لضمان سلامة حسابات شركتك وفواتيرها ولا يمكن تغييره.
            </p>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          <label>كلمة المرور الحالية<input type="password" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full border rounded p-2" /></label>
          {/* New Password Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="أدخل كلمة المرور الجديدة..."
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 pl-10"
                dir="ltr"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {/* Confirm Password Input */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">تأكيد كلمة المرور الجديدة</label>
            <input
              type={showPassword ? 'text' : 'password'}
              required
              placeholder="أعد إدخال كلمة المرور للتأكيد..."
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              dir="ltr"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
            >
              إلغاء
            </button>

            <button
              type="submit"
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <ShieldCheck size={16} />
              <span>حفظ كلمة المرور الجديدة</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
