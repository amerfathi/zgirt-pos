import React, { useState, useEffect } from 'react';
import { Printer, MessageCircle, X, Check, FileText, ArrowRight, ShieldCheck, Edit3, Save } from 'lucide-react';
import { formatCurrency, formatWeight } from '../utils/formatters';
import { openWhatsAppInvoice } from '../utils/whatsapp';
import { displayInvoiceNumber } from '../services/invoiceIdentity';
import { BRRAKA_LOGO } from '../assets/branding';
import { getStoreDisplayAddress } from '../utils/storeDisplay';

export default function A4InvoiceModal({ 
  isOpen, 
  onClose, 
  invoice, 
  settings, 
  onSwitchToThermal,
  onUpdateInvoiceNotes 
}) {
  if (!isOpen || !invoice) return null;

  const [notes, setNotes] = useState(invoice.notes || '');
  const [isSavedNote, setIsSavedNote] = useState(false);

  useEffect(() => {
    setNotes(invoice.notes || '');
    setIsSavedNote(false);
  }, [invoice]);

  const handleSaveNotes = () => {
    invoice.notes = notes;
    if (onUpdateInvoiceNotes) {
      onUpdateInvoiceNotes(invoice.id, notes);
    }
    setIsSavedNote(true);
    setTimeout(() => setIsSavedNote(false), 2500);
  };

  const handlePrint = () => {
    // ensure latest notes are set
    invoice.notes = notes;
    if (onUpdateInvoiceNotes) {
      onUpdateInvoiceNotes(invoice.id, notes);
    }
    window.print();
  };

  const handleWhatsApp = () => {
    invoice.notes = notes;
    openWhatsAppInvoice(invoice, settings);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-4 transition-all">
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Top Control Header (Hidden in print) */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600/30 flex items-center justify-center text-brand-400">
              <FileText size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm">معاينة فاتورة رسمية بحجم A4</h3>
              <p className="text-[11px] text-slate-300">فاتورة رقم #{displayInvoiceNumber(invoice)} - {invoice.customerName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToThermal && (
              <button
                type="button"
                onClick={onSwitchToThermal}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors"
              >
                عرض كإيصال حراري
              </button>
            )}

            <button 
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Action Buttons & Pre-Print Notes Bar (Hidden in print) */}
        <div className="p-3 bg-slate-50 border-b border-slate-200/80 space-y-2 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-600 font-medium">
              ورقة A4 معدة بدقة متناهية للطباعة العادية وطابعات الليزر والتصدير كـ PDF
            </div>

            <div className="flex items-center gap-2">
              <button 
                type="button"
                onClick={handlePrint}
                className="py-2 px-4 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Printer size={15} />
                <span>طباعة A4 الآن</span>
              </button>

              <button 
                type="button"
                onClick={handleWhatsApp}
                className="py-2 px-3 bg-white hover:bg-slate-50 text-emerald-700 border border-emerald-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <MessageCircle size={15} />
                <span>مشاركة واتساب</span>
              </button>
            </div>
          </div>

          {/* Pre-print Editable Notes Field */}
          <div className="flex items-center gap-2 bg-amber-50/80 p-2 rounded-xl border border-amber-200/80">
            <div className="flex items-center gap-1 text-[11px] font-bold text-amber-900 whitespace-nowrap">
              <Edit3 size={14} />
              <span>ملاحظات قبل الطباعة:</span>
            </div>
            <input
              type="text"
              placeholder="اكتب أو عدل أي ملاحظة خاصة بهذه الفاتورة قبل طباعتها..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="flex-1 px-2.5 py-1 text-xs bg-white border border-amber-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 font-medium"
            />
            <button
              type="button"
              onClick={handleSaveNotes}
              className="px-3 py-1 bg-amber-700 hover:bg-amber-800 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors"
            >
              <Save size={13} />
              <span>{isSavedNote ? 'تم الحفظ ✔' : 'حفظ'}</span>
            </button>
          </div>
        </div>

        {/* Printable A4 Paper Container */}
        <div className="overflow-y-auto p-4 sm:p-8 bg-slate-100/70 flex justify-center print:p-0 print:bg-white">
          <div 
            id="printable-a4-document"
            className="w-full max-w-[210mm] bg-white p-4 sm:p-10 rounded-xl shadow-md border border-slate-200/90 text-slate-900 font-sans text-xs print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none min-w-0 overflow-hidden"
          >
            {/* 1. Official Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-5 border-b-2 border-slate-900 gap-4">
              {/* Store Details */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <img src={BRRAKA_LOGO} alt="شعار براكه" className="w-9 h-9 object-contain shrink-0" />
                  <h1 className="text-xl font-black text-slate-900 tracking-tight">
                    {settings.shopName || 'براكه'}
                  </h1>
                </div>
                <p className="text-xs text-slate-600 font-semibold">{settings.subTitle}</p>
                {getStoreDisplayAddress(settings.address) && <p className="text-[11px] text-slate-500">📍 {getStoreDisplayAddress(settings.address)}</p>}
                {(settings.phone || settings.secondaryPhone) && <p className="text-[11px] font-mono text-slate-700">📞 {settings.phone} {settings.secondaryPhone ? `• ${settings.secondaryPhone}` : ''}</p>}
              </div>

              {/* Invoice Title & Number */}
              <div className="text-right sm:text-left space-y-1 w-full sm:w-auto">
                <div className="inline-block bg-slate-900 text-white px-4 py-1.5 rounded-lg text-sm font-black tracking-wider">
                  فاتورة بيع رسمية
                </div>
                <div dir="ltr" className="max-w-full break-all font-mono text-base font-black text-slate-900 mt-1">
                  NO: #{displayInvoiceNumber(invoice)}
                </div>
                <div className="text-[11px] text-slate-600 font-medium">
                  التاريخ: <strong>{invoice.date}</strong> | الوقت: <strong>{invoice.time}</strong>
                </div>
              </div>
            </div>

            {/* 2. Customer and Transaction Meta Card */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 my-4 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <span>اسم العميل / الجهة:</span>
                </div>
                <div className="text-sm font-black text-slate-900">{invoice.customerName}</div>
                {invoice.customerPhone && (
                  <div className="text-[11px] text-slate-600 font-mono">الهاتف: {invoice.customerPhone}</div>
                )}
              </div>

              <div className="space-y-1 text-right sm:text-left">
                <div className="flex justify-between sm:justify-end gap-3 text-[11px]">
                  <span className="text-slate-500">طريقة السداد:</span>
                  <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                    invoice.paymentMethod === 'bank' || invoice.saleType === 'bank'
                      ? 'bg-blue-100 text-blue-900 border border-blue-200'
                      : invoice.paymentMethod === 'credit' || invoice.saleType === 'credit'
                      ? 'bg-amber-100 text-amber-900 border border-amber-200'
                      : invoice.paymentMethod === 'split' || invoice.saleType === 'split'
                      ? 'bg-purple-100 text-purple-900 border border-purple-200'
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                  }`}>
                    {invoice.paymentMethod === 'bank' || invoice.saleType === 'bank' ? (
                      <span>تحويل بنكي ({invoice.bankName || 'بنك'}{invoice.bankAccountNumber ? ` - #${invoice.bankAccountNumber}` : ''})</span>
                    ) : invoice.paymentMethod === 'credit' || invoice.saleType === 'credit' ? (
                      <span>آجل (على الحساب)</span>
                    ) : invoice.paymentMethod === 'split' || invoice.saleType === 'split' ? (
                      <span>دفع مركب (نقدي + بنكي)</span>
                    ) : (
                      <span>نقدي (كاش)</span>
                    )}
                  </span>
                </div>
                <div className="flex justify-between sm:justify-end gap-3 text-[11px]">
                  <span className="text-slate-500">احتساب الوزن:</span>
                  <span className="font-bold text-slate-800">
                    {invoice.weightMode === 'net_after_tare' ? 'صافي بعد خصم العبوات' : 'قائم شامل العبوة'}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Items Table */}
            <div className="my-4 overflow-x-auto w-full rounded-xl border border-slate-300">
              <table className="w-full min-w-[650px] text-right border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[11px]">
                    <th className="p-2 border border-slate-800 text-center w-8">م</th>
                    <th className="p-2 border border-slate-800">الصنف</th>
                    <th className="p-2 border border-slate-800 text-center">العبوة</th>
                    <th className="p-2 border border-slate-800 text-center">عدد العبوات</th>
                    <th className="p-2 border border-slate-800 text-center">إجمالي القائم</th>
                    <th className="p-2 border border-slate-800 text-center">خصم العبوات</th>
                    <th className="p-2 border border-slate-800 text-center bg-slate-800">الوزن الصافي</th>
                    <th className="p-2 border border-slate-800 text-center">سعر الكيلو</th>
                    <th className="p-2 border border-slate-800 text-center w-28 bg-slate-800">الإجمالي</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/80">
                      <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-600">{idx + 1}</td>
                      <td className="p-2.5 border border-slate-200 font-black text-slate-900">
                        {item.name}
                        {item.weighingCount > 1 && (
                          <span className="block text-[10px] font-normal text-emerald-700">
                            (تجميع {item.weighingCount} وزنات ميزان)
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-center text-slate-700">{item.unit}</td>
                      <td className="p-2.5 border border-slate-200 text-center font-bold text-slate-800">{item.packageCount}</td>
                      <td className="p-2.5 border border-slate-200 text-center font-mono">{formatWeight(item.grossWeight)}</td>
                      <td className="p-2.5 border border-slate-200 text-center text-slate-600 text-[11px]">
                        {item.totalTareWeight > 0 ? `-${item.totalTareWeight.toFixed(2)} كجم` : '-'}
                        {item.totalTareWeight > 0 && (
                          <span className="block text-[9px] text-slate-400">({item.packageCount}×{item.tarePerUnit})</span>
                        )}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-center font-black text-slate-900 bg-slate-50 font-mono">
                        {formatWeight(item.netWeight)}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-center font-mono">
                        {item.pricePerKg.toFixed(2)} {settings.currency}
                      </td>
                      <td className="p-2.5 border border-slate-200 text-center font-black text-slate-900 bg-slate-50 font-mono">
                        {item.total.toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                    <td colSpan={3} className="p-2.5 border border-slate-300 text-right">الإجماليات الكلية:</td>
                    <td className="p-2.5 border border-slate-300 text-center">{invoice.totalPackages} عبوة</td>
                    <td className="p-2.5 border border-slate-300 text-center">{formatWeight(invoice.totalGrossWeight)}</td>
                    <td className="p-2.5 border border-slate-300 text-center">-{invoice.totalTareWeight?.toFixed(2) || '0.00'} كجم</td>
                    <td className="p-2.5 border border-slate-300 text-center font-black text-emerald-800 bg-emerald-50">
                      {formatWeight(invoice.totalNetWeight)}
                    </td>
                    <td className="p-2.5 border border-slate-300 text-center">-</td>
                    <td className="p-2.5 border border-slate-300 text-center font-black text-sm bg-slate-200">
                      {invoice.subtotal.toFixed(2)} {settings.currency}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* 4. Financial Calculation Summary & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 my-4">
              {/* Notes and Terms */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <span className="text-[11px] font-bold text-slate-800 block">شروط وملاحظات الفاتورة:</span>
                <p className="text-[11px] text-slate-700 leading-relaxed font-medium bg-white p-2.5 rounded-lg border border-slate-200/70 min-h-[48px]">
                  {notes || invoice.notes || settings.invoiceNote || 'البضاعة المباعة تخضع للفحص والوزن بالمحل، شكراً لتعاملكم معنا.'}
                </p>
              </div>

              {/* Totals Breakdown Box */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>المبلغ الإجمالي قبل الخصم:</span>
                  <span className="font-bold">{invoice.subtotal.toFixed(2)} {settings.currency}</span>
                </div>

                {invoice.discountAmount > 0 && (
                  <div className="flex justify-between text-amber-700 font-bold">
                    <span>قيمة الخصم الممنوح:</span>
                    <span>-{invoice.discountAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}

                <div className="flex justify-between items-center py-2 px-3 bg-slate-900 text-white rounded-lg font-black text-sm my-1">
                  <span>صافي الفاتورة المطلوب:</span>
                  <span className="text-base text-brand-400 font-mono">
                    {invoice.finalTotal.toFixed(2)} {settings.currency}
                  </span>
                </div>

                {/* Detailed payment breakdown */}
                {(invoice.paymentMethod === 'split' || invoice.saleType === 'split') ? (
                  <div className="bg-purple-50/60 p-2 rounded-lg border border-purple-200/80 space-y-1 my-1 text-[11px]">
                    <span className="font-bold text-purple-950 block">تفصيل السداد المركب:</span>
                    {Number(invoice.cashAmount) > 0 && (
                      <div className="flex justify-between text-slate-800">
                        <span>• مسدد نقداً (كاش):</span>
                        <span className="font-bold">{Number(invoice.cashAmount).toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    {Number(invoice.bankAmount) > 0 && (
                      <div className="flex justify-between text-blue-900">
                        <span>• مسدد تحويل بنكي ({invoice.bankName || 'بنك'}{invoice.bankAccountNumber ? ` #${invoice.bankAccountNumber}` : ''}):</span>
                        <span className="font-bold">{Number(invoice.bankAmount).toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                    {Number(invoice.creditAmount) > 0 && (
                      <div className="flex justify-between text-amber-900 font-bold">
                        <span>• متبقي آجل في حساب العميل:</span>
                        <span>{Number(invoice.creditAmount).toFixed(2)} {settings.currency}</span>
                      </div>
                    )}
                  </div>
                ) : (invoice.paymentMethod === 'bank' || invoice.saleType === 'bank') ? (
                  <div className="bg-blue-50/60 p-2 rounded-lg border border-blue-200/80 text-[11px] space-y-0.5">
                    <div className="flex justify-between text-blue-950 font-bold">
                      <span>المسدد تحويل بنكي:</span>
                      <span>{invoice.finalTotal.toFixed(2)} {settings.currency}</span>
                    </div>
                    <div className="text-[10px] text-blue-800">
                      <span>البنك: {invoice.bankName || 'حساب بنكي'} {invoice.bankAccountNumber ? `• رقم: ${invoice.bankAccountNumber}` : ''}</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between text-slate-700 pt-1">
                    <span>المبلغ المسدد (المدفوع كاش):</span>
                    <span className="font-bold">{invoice.paidAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}

                {invoice.changeAmount > 0 && (
                  <div className="flex justify-between text-emerald-800 font-bold bg-emerald-50 p-1.5 rounded">
                    <span>الباقي للعميل:</span>
                    <span>{invoice.changeAmount.toFixed(2)} {settings.currency}</span>
                  </div>
                )}

                {invoice.remainingDebt > 0 && invoice.saleType !== 'split' && (
                  <div className="flex justify-between text-amber-900 font-black bg-amber-50 p-1.5 rounded border border-amber-200">
                    <span>المتبقي في الحساب (دين آجل):</span>
                    <span>{invoice.remainingDebt.toFixed(2)} {settings.currency}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 5. Official Signatures Section */}
            <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-center">
              <div className="space-y-6">
                <span className="text-xs font-bold text-slate-700 block">المحاسب / البائع المسؤول</span>
                <div className="w-44 mx-auto border-b border-dashed border-slate-400"></div>
                <span className="text-[10px] text-slate-400 block">التوقيع والختم</span>
              </div>

              <div className="space-y-6">
                <span className="text-xs font-bold text-slate-700 block">توقيع واستلام العميل</span>
                <div className="w-44 mx-auto border-b border-dashed border-slate-400"></div>
                <span className="text-[10px] text-slate-400 block">استلمت الأصناف والأوزان مطابقة</span>
              </div>
            </div>

            {/* Footer Notice */}
            <div className="pt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 mt-6">
              تم إصدار هذا المستند عبر منظومة براكه للمبيعات والمحاسبة • {settings.shopName}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
