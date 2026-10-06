import React, { useState } from 'react';

export default function ForgotPasswordModal({ isOpen, onClose, store }) {
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!isOpen) return null;
  async function submit(event) {
    event.preventDefault();
    if (password !== confirm) { setMessage('كلمتا المرور غير متطابقتين'); return; }
    setBusy(true);
    try {
      await store.resetPassword(token.trim(), password);
      setToken(''); setPassword(''); setConfirm('');
      setMessage('تم تغيير كلمة المرور. يمكنك تسجيل الدخول الآن.');
    } catch (error) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4" dir="rtl">
    <form onSubmit={submit} className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
      <h2 className="font-bold text-lg">استرداد كلمة المرور</h2>
      <p>أدخل رمز الاسترداد الذي أصدره مدير متجرك بعد التحقق من هويتك. صلاحية الرمز 15 دقيقة ويُستخدم مرة واحدة. لحساب مالك المتجر، تواصل مع إدارة المنصة.</p>
      <label className="block">رمز الاسترداد<input required autoComplete="off" value={token} onChange={e=>setToken(e.target.value)} className="border p-2 w-full" /></label>
      <label className="block">كلمة المرور الجديدة<input required minLength={12} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} className="border p-2 w-full" /></label>
      <label className="block">تأكيد كلمة المرور<input required type="password" autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)} className="border p-2 w-full" /></label>
      <p role="status">{message}</p>
      <button disabled={busy} type="submit" className="bg-emerald-600 text-white p-2 rounded">تغيير كلمة المرور</button>
      <button type="button" onClick={()=>{setToken('');setPassword('');setConfirm('');onClose();}} className="p-2">إغلاق</button>
    </form>
  </div>;
}
