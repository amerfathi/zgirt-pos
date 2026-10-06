import React, { useRef, useState, useEffect } from 'react';
import { Printer, MessageCircle, Copy, X, Check, FileText, ArrowRight, Edit3 } from 'lucide-react';
import { formatCurrency, formatWeight } from '../utils/formatters';
import { openWhatsAppInvoice, generateWhatsAppInvoiceMessage } from '../utils/whatsapp';
import { displayInvoiceNumber } from '../services/invoiceIdentity';
import { BRRAKA_LOGO } from '../assets/branding';
import { getStoreDisplayAddress } from '../utils/storeDisplay';

export default function InvoiceReceiptModal({ isOpen, onClose, invoice, settings, onUpdateInvoiceNotes }) {
  const receiptRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [notes, setNotes] = useState(invoice ? (invoice.notes || '') : '');

  useEffect(() => {
    if (invoice) setNotes(invoice.notes || '');
  }, [invoice]);

  if (!isOpen || !invoice) return null;

  const handlePrint = () => {
    invoice.notes = notes;
    if (onUpdateInvoiceNotes) onUpdateInvoiceNotes(invoice.id, notes);
    window.print();
  };

  const handleWhatsApp = () => {
    invoice.notes = notes;
    if (onUpdateInvoiceNotes) onUpdateInvoiceNotes(invoice.id, notes);
    openWhatsAppInvoice(invoice, settings);
  };

  const handleCopy = () => {
    invoice.notes = notes;
    const text = generateWhatsAppInvoiceMessage(invoice, settings);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-3 sm:p-4 transition-all">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Control Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white print:hidden">
          <div className="flex items-center gap-2">
            <FileText size={18} className="text-brand-400" />
            <h3 className="font-bold text-sm">فاتورة رقم #{displayInvoiceNumber(invoice)}</h3>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Pre-print Notes Field (Hidden in print) */}
        <div className="px-4 py-2 bg-amber-50/90 border-b border-amber-200/90 flex items-center gap-2 print:hidden">
          <Edit3 size={14} className="text-amber-800 shrink-0" />
          <input
            type="text"
            placeholder="ملاحظات قبل الطباعة أو المشاركة..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="flex-1 px-2.5 py-1 text-xs bg-white border border-amber-200 rounded-lg text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500"
          />
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="overflow-y-auto p-4 sm:p-6 bg-slate-100 flex justify-center">
          <div 
            ref={receiptRef}
            id="thermal-receipt"
            className="w-full max-w-[340px] bg-white p-5 rounded-xl shadow-sm border border-slate-200 text-slate-900 font-sans text-xs print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none"
          >
            {/* Store Header */}
            <div className="text-center pb-3 border-b-2 border-dashed border-slate-300">
              <img src={BRRAKA_LOGO} alt="شعار براكه" className="w-12 h-12 object-contain mx-auto mb-1.5" />
              <div className="font-black text-sm text-slate-900">{settings.shopName || 'براكه'}</div>
              <p className="text-[11px] text-slate-600 font-medium">{settings.subTitle}</p>
              {getStoreDisplayAddress(settings.address) && <p className="text-[10px] text-slate-500 mt-0.5">{getStoreDisplayAddress(settings.address)}</p>}
              {settings.phone && <p className="text-[11px] font-semibold text-slate-700 mt-0.5 dir-ltr text-center">📞 {settings.phone}</p>}
            </div>

            {/* Invoice Meta */}
            <div className="py-2.5 border-b border-dashed border-slate-300 space-y-1 text-[11px]">
              <div className="flex flex-wrap justify-between gap-1 font-bold text-slate-800">
                <span>فاتورة بيع رقم:</span>
                <span dir="ltr" className="max-w-full break-all font-mono text-xs">#{displayInvoiceNumber(invoice)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>التاريخ والوقت:</span>
                <span>{invoice.date} - {invoice.time}</span>
              </div>
              <div className="flex justify-between text-slate-800 font-medium">
                <span>العميل:</span>
                <span>{invoice.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>طريقة الدفع:</span>
                <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                  invoice.paymentMethod === 'bank' || invoice.saleType === 'bank'
                    ? 'bg-blue-100 text-blue-900'
                    : invoice.paymentMethod === 'credit' || invoice.saleType === 'credit'
                    ? 'bg-amber-100 text-amber-900'
                    : invoice.paymentMethod === 'split' || invoice.saleType === 'split'
                    ? 'bg-purple-100 text-purple-900'
                    : 'bg-emerald-100 text-emerald-900'
                }`}>
                  {invoice.paymentMethod === 'bank' || invoice.saleType === 'bank' ? (
                    <span>تحويل بنكي</span>
                  ) : invoice.paymentMethod === 'credit' || invoice.saleType === 'credit' ? (
                    <span>آجل (على الحساب)</span>
                  ) : invoice.paymentMethod === 'split' || invoice.saleType === 'split' ? (
                    <span>دفع مركب</span>
                  ) : (
                    <span>نقدي (كاش)</span>
                  )}
                </span>
              </div>
              {(invoice.paymentMethod === 'bank' || invoice.saleType === 'bank') && (
                <div className="text-[10px] text-blue-800 bg-blue-50/70 p-1 rounded font-medium">
                  البنك: {invoice.bankName || 'حساب بنكي'} {invoice.bankAccountNumber ? `• #${invoice.bankAccountNumber}` : ''}
                </div>
              )}
            </div>

            {/* Items Table */}
            <div className="py-2.5 border-b-2 border-dashed border-slate-300">
              <div className="text-[11px] font-bold text-slate-700 mb-2 flex justify-between">
                <span>الصنف / العبوات</span>
                <span>الصافي × السعر</span>
                <span>الإجمالي</span>
              </div>

              <div className="space-y-2.5">
                {invoice.items.map((item, idx) => (
                  <div key={idx} className="border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                    <div className="flex justify-between font-bold text-slate-900 text-xs">
                      <span>{item.name}</span>
                      <span>{item.total.toFixed(2)} {settings.currency}</span>
                    </div>

                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>{item.packageCount} {item.unit} (قائم: {item.grossWeight}كجم)</span>
                      <span>
                        {item.netWeight.toFixed(2)} كجم × {item.pricePerKg.toFixed(2)}
                      </span>
                    </div>

                    {item.totalTareWeight > 0 && (
                      <div className="text-[9px] text-slate-400">
                        خصم عبوات: -{item.totalTareWeight.toFixed(2)} كجم ({item.packageCount} × {item.tarePerUnit}كجم)
                      </div>
                    )}

                    {item.weighingCount > 1 && (
                      <div className="text-[9px] text-emerald-700">
                        عدد وزنات الميزان: {item.weighingCount} مرات
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Calculations Summary */}
            <div className="py-2.5 space-y-1 text-xs border-b border-dashed border-slate-300">
              <div className="flex justify-between text-slate-600">
                <span>إجمالي عدد العبوات:</span>
                <span className="font-bold text-slate-800">{invoice.totalPackages} عبوة</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>إجمالي الوزن القائم:</span>
                <span className="font-medium text-slate-800">{formatWeight(invoice.totalGrossWeight)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>إجمالي الوزن الصافي:</span>
                <span className="font-bold text-slate-900">{formatWeight(invoice.totalNetWeight)}</span>
              </div>

              <div className="flex justify-between text-slate-600 pt-1">
                <span>المبلغ الإجمالي:</span>
                <span>{invoice.subtotal.toFixed(2)} {settings.currency}</span>
              </div>

              {invoice.discountAmount > 0 && (
                <div className="flex justify-between text-amber-700 font-medium">
                  <span>الخصم الممنوح:</span>
                  <span>-{invoice.discountAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}

              <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                <span>صافي الفاتورة:</span>
                <span className="text-emerald-700">{invoice.finalTotal.toFixed(2)} {settings.currency}</span>
              </div>

              {/* Split Breakdown if split payment */}
              {(invoice.paymentMethod === 'split' || invoice.saleType === 'split') && (
                <div className="py-1 px-1.5 bg-purple-50 rounded border border-purple-200 text-[10px] space-y-0.5 my-1">
                  <div className="font-bold text-purple-950">تفاصيل السداد المركب:</div>
                  {Number(invoice.cashAmount) > 0 && (
                    <div className="flex justify-between">
                      <span>• مسدد نقداً:</span>
                      <span className="font-bold">{Number(invoice.cashAmount).toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  {Number(invoice.bankAmount) > 0 && (
                    <div className="flex justify-between text-blue-900">
                      <span>• مسدد بنك ({invoice.bankName || ''}):</span>
                      <span className="font-bold">{Number(invoice.bankAmount).toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                  {Number(invoice.creditAmount) > 0 && (
                    <div className="flex justify-between text-amber-900">
                      <span>• متبقي آجل دين:</span>
                      <span className="font-bold">{Number(invoice.creditAmount).toFixed(2)} {settings.currency}</span>
                    </div>
                  )}
                </div>
              )}

              <div className="flex justify-between text-slate-700 pt-1">
                <span>المبلغ المدفوع (المسدد):</span>
                <span className="font-bold">{invoice.paidAmount.toFixed(2)} {settings.currency}</span>
              </div>

              {invoice.changeAmount > 0 && (
                <div className="flex justify-between text-slate-800 font-bold bg-slate-50 p-1 rounded">
                  <span>الباقي للعميل:</span>
                  <span>{invoice.changeAmount.toFixed(2)} {settings.currency}</span>
                </div>
              )}

              {invoice.remainingDebt > 0 && invoice.saleType !== 'split' && (
                <div className="flex justify-between text-amber-900 font-bold bg-amber-50 p-1 rounded">
                  <span>المتبقي في الحساب (دين):</span>
                  <span>{invoice.remainingDebt.toFixed(2)} {settings.currency}</span>
                </div>
              )}
            </div>

            {/* Notes & Footer */}
            {(notes || invoice.notes) && (
              <div className="py-2 text-[10px] text-slate-700 border-b border-dashed border-slate-200">
                <span className="font-bold text-slate-900">ملاحظات: </span>{notes || invoice.notes}
              </div>
            )}

            <div className="pt-3 text-center text-[10px] text-slate-400 space-y-1">
              <p>{settings.invoiceNote || 'شكراً لزيارتكم'}</p>
              <div className="w-32 h-6 mx-auto bg-slate-100 flex items-center justify-center font-mono text-[9px] text-slate-400 border border-slate-200 rounded">
                ||| |||| || ||||| ||||
              </div>
              <p className="text-[8px] text-slate-400">منظومة براكه للمبيعات والمحاسبة</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Bar */}
        <div className="p-3 bg-white border-t border-slate-100 grid grid-cols-3 gap-2">
          <button 
            type="button"
            onClick={handlePrint}
            className="py-2.5 px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <Printer size={15} />
            <span>طباعة</span>
          </button>

          <button 
            type="button"
            onClick={handleWhatsApp}
            className="py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
          >
            <MessageCircle size={15} />
            <span>واتساب</span>
          </button>

          <button 
            type="button"
            onClick={handleCopy}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
          >
            {copied ? <Check size={15} className="text-emerald-600" /> : <Copy size={15} />}
            <span>{copied ? 'تم النسخ!' : 'نسخ النص'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
