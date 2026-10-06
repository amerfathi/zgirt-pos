import React, { useState } from 'react';
import { 
  X, RotateCcw, AlertCircle, ShieldCheck, Check, 
  Truck, DollarSign, ArrowDownLeft, Scale, Building2
} from 'lucide-react';
import { formatCurrency, formatWeight } from '../utils/formatters';

export default function PurchaseReturnModal({ purchase, store, onClose, onSuccess }) {
  const { recordPurchaseReturn, settings, suppliers } = store;
  const [isSaving, setIsSaving] = useState(false);

  // Supplier info
  const supplier = (suppliers || []).find(s => s.id === purchase.supplierId);
  const supplierBalance = supplier ? Number(supplier.balance || 0) : 0;
  const hasSupplierDebt = purchase.paymentMethod === 'credit' || supplierBalance > 0;

  const originalPurchasedKg = Number(purchase.quantityKg || 0);
  const alreadyReturnedKg = Number(purchase.returnedKg || 0);
  const maxAvailableKg = Math.max(0, Math.round((originalPurchasedKg - alreadyReturnedKg) * 100) / 100);

  // CRITICAL: Strictly lock to historical cost per kg from the purchase bill!
  const historicalCostPerKg = Number(purchase.costPerKg || 0);

  const [returnedKg, setReturnedKg] = useState('');
  const [refundMethod, setRefundMethod] = useState(() => {
    if (purchase.paymentMethod === 'credit' || hasSupplierDebt) return 'supplier_debt_deduction';
    if (purchase.paymentMethod === 'bank') return 'bank';
    return 'cash';
  });
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');

  const numReturnedKg = parseFloat(returnedKg) || 0;
  const calculatedRefund = Math.round(numReturnedKg * historicalCostPerKg * 100) / 100;

  const handleReturnAll = () => {
    setReturnedKg(String(maxAvailableKg));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (numReturnedKg <= 0) {
      alert('يرجى إدخال الوزن المراد إرجاعه للمورد بالكيلو');
      return;
    }
    if (numReturnedKg > maxAvailableKg) {
      alert(`الوزن المدخل (${numReturnedKg} كجم) يتجاوز الحد الأقصى المتاح للإرجاع (${maxAvailableKg} كجم)`);
      return;
    }

    setIsSaving(true);
    try {
      const newReturn = await recordPurchaseReturn({
        purchaseId: purchase.id,
        returnedKg: numReturnedKg,
        refundMethod,
        reason: reason || 'مردود بضاعة للمورد',
        notes
      });

      alert(`تم تسجيل سند مردود المشتريات بنجاح!\nالقيمة المستردة: ${formatCurrency(calculatedRefund, settings.currency)} بتكلفة الشراء الأصلية.`);
      if (onSuccess) onSuccess(newReturn);
      onClose();
    } catch (err) {
      alert(`حدث خطأ أثناء حفظ مردود المشتريات: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200/80 w-full max-w-xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-200/80 text-navy-850 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 flex items-center justify-center font-bold">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-navy-850 flex items-center gap-2">
                <span>تسجيل مردود مشتريات للمورد</span>
                <span className="text-xs bg-slate-100 text-slate-700 font-mono px-2 py-0.5 rounded-md border border-slate-200">
                  شحنة #{purchase.id?.replace('pur-', '')}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                المورد: {purchase.supplierName || 'سوق الجملة'} • التاريخ: {purchase.date}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800">
          
          {/* Important Accounting Protection Banner */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck size={18} className="text-primary-600 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="block text-navy-850 font-bold mb-0.5">تثبيت تكلفة الشراء الفعلية:</strong>
              يتم احتساب قيمة المردود للمورد حصراً على أساس <strong>تكلفة الشراء المسجلة بهذه الشحنة وقت الاستلام</strong>، وأي تعديل لاحق على أسعار السوق لن يغير القيمة المستردة.
            </div>
          </div>

          {/* Shipment Item Summary Card */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{purchase.icon || '📦'}</span>
                <div>
                  <span className="font-bold text-sm text-slate-900 block">{purchase.productName}</span>
                  <span className="text-[11px] text-slate-500">
                    المورد: {purchase.supplierName}
                  </span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2.5 py-1 rounded-lg border border-emerald-200 block">
                  تكلفة الشراء الأصلية: {historicalCostPerKg} {settings.currency}/كجم
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-200 text-center text-xs">
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px]">الكمية الموردة</span>
                <strong className="text-slate-800">{formatWeight(originalPurchasedKg)}</strong>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-100">
                <span className="text-slate-400 block text-[10px]">المرتجع سابقاً</span>
                <strong className="text-slate-800">{formatWeight(alreadyReturnedKg)}</strong>
              </div>
              <div className="bg-emerald-50/70 p-2 rounded-lg border border-emerald-100">
                <span className="text-emerald-700 block text-[10px] font-bold">المتاح للإرجاع</span>
                <strong className="text-emerald-800">{formatWeight(maxAvailableKg)}</strong>
              </div>
            </div>
          </div>

          {/* Return Quantity Input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                الوزن المراد إرجاعه للمورد:
              </label>
              <button
                type="button"
                onClick={handleReturnAll}
                className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 underline cursor-pointer"
              >
                إرجاع كامل المتبقي ({maxAvailableKg} كجم)
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={maxAvailableKg}
                value={returnedKg}
                onChange={(e) => setReturnedKg(e.target.value)}
                placeholder="أدخل الوزن بالكيلو..."
                className="w-full px-3 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
              />
              <span className="absolute left-3 text-xs font-bold text-slate-400">
                كيلوغرام
              </span>
            </div>
          </div>

          {/* Settlement / Refund Method */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 block">
              طريقة تسوية مردود المشتريات:
            </label>
            <select
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
            >
              {hasSupplierDebt && (
                <option value="supplier_debt_deduction">
                  خصم من حساب ومستحقات المورد (تخفيض الدين الآجل)
                </option>
              )}
              <option value="cash">استلام المبلغ نقداً وإيداعه بالخزينة / الدرج</option>
              <option value="bank">تحويل بنكي مسترد من المورد إلى الحساب</option>
            </select>
            <p className="text-[10px] text-slate-500">
              {refundMethod === 'supplier_debt_deduction' && 'سيتم تخفيض مستحقات المورد تلقائياً بمقدار قيمة المردود.'}
              {refundMethod === 'cash' && 'سيتم تسجيل المبلغ كإيراد نقدي مسترد وإضافته إلى سيولة درج الخزينة.'}
              {refundMethod === 'bank' && 'سيتم تسجيل المبلغ كإيداع بنكي مسترد في رصيد البنك.'}
            </p>
          </div>

          {/* Reason & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                سبب الإرجاع للمورد:
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-600"
              >
                <option value="">اختر السبب...</option>
                <option value="فرز هالك وتالف في الشحنة">فرز هالك وتالف في الشحنة</option>
                <option value="بضاعة غير مطابقة للمواصفات المتفق عليها">بضاعة غير مطابقة للمواصفات</option>
                <option value="زيادة في الكمية الموردة">زيادة في الكمية الموردة</option>
                <option value="تلف أثناء النقل والتعتيق">تلف أثناء النقل والتعتيق</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                ملاحظات إضافية:
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="رقم الإشعار أو السند..."
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:outline-hidden focus:border-emerald-600"
              />
            </div>
          </div>

          {/* Live Refund Summary Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-navy-850 block">إجمالي قيمة المردود المستردة من المورد:</span>
              <span className="text-[11px] text-slate-500 font-mono">
                {numReturnedKg} كجم × {historicalCostPerKg} {settings.currency}/كجم
              </span>
            </div>
            <div className="text-lg sm:text-xl font-bold text-navy-850 font-mono">
              {formatCurrency(calculatedRefund, settings.currency)}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSaving || calculatedRefund <= 0}
              className={`px-4 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs ${
                calculatedRefund > 0 
                  ? 'bg-primary-600 hover:bg-primary-700 text-white cursor-pointer active:scale-95' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Check size={16} />
              <span>تأكيد مردود المشتريات</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
