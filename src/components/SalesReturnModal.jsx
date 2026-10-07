import React, { useState } from 'react';
import { 
  X, RotateCcw, AlertCircle, ShieldCheck, Check, 
  Package, DollarSign, ArrowDownLeft, Info, Layers
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { displayInvoiceNumber } from '../services/invoiceIdentity';

export default function SalesReturnModal({ invoice, store, onClose, onSuccess }) {
  const { recordSalesReturn, settings, customers } = store;
  const [isSaving, setIsSaving] = useState(false);

  // Find customer for this invoice if any
  const customer = (customers || []).find(c => c.id === invoice.customerId);
  const customerDebt = customer ? Number(customer.balance || 0) : 0;
  const invoiceHasDebt = Number(invoice.remainingDebt || 0) > 0 || customerDebt > 0;

  // Local state for each line item's tobacco unit return quantity
  const [returnItemsState, setReturnItemsState] = useState(() => {
    return (invoice.items || []).map(it => {
      // Base ledger unit is packs (in netWeight or packsCount or quantity)
      const soldPacks = Number(it.packsCount ?? it.netWeight ?? it.grossWeight ?? it.quantity ?? 0);
      const alreadyReturnedPacks = Number(it.returnedWeight || 0);
      const maxAvailablePacks = Math.max(0, Math.round((soldPacks - alreadyReturnedPacks) * 100) / 100);
      
      const unitType = it.unitType || (it.unit === 'كرتونة' ? 'carton' : it.unit === 'سيجارة' || it.unit === 'حبة' ? 'piece' : 'pack');
      const unitName = it.unitName || it.unit || (unitType === 'carton' ? 'كرتونة' : unitType === 'piece' ? 'سيجارة' : 'علبة');
      const packsPerCarton = Number(it.packsPerCarton || 10);
      const unitsPerPack = Number(it.unitsPerPack || 20);

      // Historical unit price locked on invoice
      // Notice: pricePerKg in invoice line item is locked price per pack!
      const historicalPricePerPack = Number(it.pricePerKg ?? (it.unitPrice && unitType === 'pack' ? it.unitPrice : 0));
      const lockedUnitPrice = Number(it.unitPrice ?? historicalPricePerPack);

      // Sold quantity in original sold unit
      const soldQuantity = Number(it.quantity ?? soldPacks);
      // Already returned in original sold unit:
      let alreadyReturnedUnits = alreadyReturnedPacks;
      let maxAvailableUnits = maxAvailablePacks;
      if (unitType === 'carton' && packsPerCarton > 0) {
        alreadyReturnedUnits = Math.round((alreadyReturnedPacks / packsPerCarton) * 100) / 100;
        maxAvailableUnits = Math.round((maxAvailablePacks / packsPerCarton) * 100) / 100;
      } else if (unitType === 'piece' && unitsPerPack > 0) {
        alreadyReturnedUnits = Math.round(alreadyReturnedPacks * unitsPerPack);
        maxAvailableUnits = Math.round(maxAvailablePacks * unitsPerPack);
      }

      return {
        productId: it.productId,
        name: it.name,
        unitType,
        unitName,
        packsPerCarton,
        unitsPerPack,
        soldQuantity,
        soldPacks,
        alreadyReturnedPacks,
        maxAvailablePacks,
        maxAvailableUnits,
        originalPricePerPack: historicalPricePerPack,
        lockedUnitPrice,
        returnedUnits: '',
        reason: ''
      };
    });
  });

  const [refundMethod, setRefundMethod] = useState(() => {
    if (invoice.paymentMethod === 'credit' || invoiceHasDebt) return 'credit_deduction';
    if (invoice.paymentMethod === 'bank') return 'bank';
    return 'cash';
  });

  const [inventoryAction, setInventoryAction] = useState('restock'); // 'restock' | 'damaged'
  const [generalNotes, setGeneralNotes] = useState('');

  // Handle return quantity change in original sold units
  const handleItemReturnChange = (index, value) => {
    setReturnItemsState(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      const numVal = parseFloat(value);
      if (isNaN(numVal) || numVal < 0) {
        return { ...item, returnedUnits: '' };
      }
      const clamped = Math.min(numVal, item.maxAvailableUnits);
      return { ...item, returnedUnits: clamped };
    }));
  };

  const handleReturnAllItem = (index) => {
    setReturnItemsState(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      return { ...item, returnedUnits: item.maxAvailableUnits };
    }));
  };

  // Convert entered returned units to packs for ledger accounting
  const itemsWithPacks = returnItemsState.map(it => {
    const enteredUnits = Number(it.returnedUnits || 0);
    let packs = enteredUnits;
    if (it.unitType === 'carton') {
      packs = Math.round(enteredUnits * it.packsPerCarton * 100) / 100;
    } else if (it.unitType === 'piece' && it.unitsPerPack > 0) {
      packs = Math.round((enteredUnits / it.unitsPerPack) * 100) / 100;
    }
    const refund = Math.round(packs * it.originalPricePerPack * 100) / 100;
    return { ...it, enteredUnits, returnedPacks: packs, refund };
  });

  const itemsToReturn = itemsWithPacks.filter(it => it.enteredUnits > 0);
  const totalReturnPacks = itemsToReturn.reduce((sum, it) => sum + it.returnedPacks, 0);
  const totalRefundAmount = itemsToReturn.reduce((sum, it) => sum + it.refund, 0);
  const roundedTotalRefund = Math.round(totalRefundAmount * 100) / 100;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (itemsToReturn.length === 0 || roundedTotalRefund <= 0) {
      alert('يرجى تحديد كمية الصنف المراد إرجاعه أولاً');
      return;
    }

    setIsSaving(true);
    try {
      // Map packs to returnedWeight alias to strictly satisfy businessEffects & atomicStore validation
      const newReturn = await recordSalesReturn({
        invoiceId: invoice.id,
        returnedItems: itemsToReturn.map(it => ({
          productId: it.productId,
          name: it.name,
          unit: it.unitName,
          originalPricePerKg: it.originalPricePerPack,
          returnedWeight: it.returnedPacks, // Ledger authoritative pack count
          reason: it.reason || generalNotes
        })),
        refundMethod,
        inventoryAction,
        notes: generalNotes
      });

      alert(`تم تسجيل سند مردود المبيعات بنجاح!\nالقيمة المستردة: ${formatCurrency(roundedTotalRefund, settings.currency)} بالسعر التاريخي الأصلي.`);
      if (onSuccess) onSuccess(newReturn);
      onClose();
    } catch (err) {
      alert(`حدث خطأ أثناء حفظ المردود: ${err.message}`);
    } finally { setIsSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
              <RotateCcw size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>تسجيل مردود مبيعات سجائر وتبغ</span>
                <span className="text-xs bg-slate-800 text-amber-300 font-mono px-2 py-0.5 rounded-md border border-slate-700">
                  فاتورة #{displayInvoiceNumber(invoice)}
                </span>
              </h3>
              <p className="text-[11px] text-slate-300">
                العميل: {invoice.customerName || 'زبون عام'} • التاريخ: {invoice.date}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 overflow-y-auto space-y-4 text-slate-800">
          
          {/* Important Accounting Protection Banner */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-start gap-2.5">
            <ShieldCheck size={20} className="text-emerald-700 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-950 leading-relaxed">
              <strong className="block text-emerald-800 font-bold mb-0.5">ضمان تثبيت السعر التاريخي الفعلي:</strong>
              يتم احتساب قيمة المردود حصراً على أساس <strong>سعر البيع المسجل في هذه الفاتورة وقت إتمامها</strong>، وأي تعديل طرأ لاحقاً على أسعار الكتالوج لن يغير سعر المردود إطلاقاً.
            </div>
          </div>

          {/* Items Return Table */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              حدد الأصناف والكميات المراد إرجاعها:
            </label>

            <div className="space-y-2.5">
              {itemsWithPacks.map((item, idx) => {
                const isFullyReturned = item.maxAvailableUnits <= 0;

                return (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-xl border transition-all ${
                      item.enteredUnits > 0 
                        ? 'bg-amber-50/40 border-amber-300 shadow-xs' 
                        : 'bg-slate-50/80 border-slate-200'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-slate-900">{item.name}</span>
                          <span className="text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-200">
                            سعر البيع بالفاتورة: {item.lockedUnitPrice} {settings.currency}/{item.unitName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          المباع: {item.soldQuantity} {item.unitName} ({item.soldPacks} علبة) • المرتجع سابقاً: {item.alreadyReturnedPacks} علبة • المتاح: <strong className="text-slate-700">{item.maxAvailableUnits} {item.unitName}</strong>
                        </div>
                      </div>

                      {/* Return input and quick button */}
                      {!isFullyReturned ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              step={item.unitType === 'piece' ? '1' : '1'}
                              min="0"
                              max={item.maxAvailableUnits}
                              value={item.returnedUnits}
                              onChange={(e) => handleItemReturnChange(idx, e.target.value)}
                              placeholder="0"
                              className="w-24 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 text-center focus:outline-hidden focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                            />
                            <span className="text-xs font-bold text-slate-500">{item.unitName}</span>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleReturnAllItem(idx)}
                            className="px-2 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                            title="إرجاع كامل المتبقي"
                          >
                            كامل المتبقي
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                          تم استرجاع كامل الكمية
                        </span>
                      )}
                    </div>

                    {/* Calculated refund row if quantity entered */}
                    {item.enteredUnits > 0 && (
                      <div className="mt-2 pt-2 border-t border-amber-200/80 flex items-center justify-between text-xs font-bold">
                        <span className="text-amber-800">
                          القيمة المستردة للصنف ({item.enteredUnits} {item.unitName} = {item.returnedPacks} علبة):
                        </span>
                        <span className="text-emerald-700 font-mono text-sm">
                          {formatCurrency(item.refund, settings.currency)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Refund Method & Inventory Action Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            
            {/* Refund Method */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                طريقة رد المبلغ المالي:
              </label>
              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
              >
                {invoiceHasDebt && (
                  <option value="credit_deduction">
                    خصم من دين وحساب العميل (تخفيض المديونية)
                  </option>
                )}
                <option value="cash">رد نقدي (كاش من الخزينة / الدرج)</option>
                <option value="bank">تحويل بنكي مسترد للعميل</option>
              </select>
              <p className="text-[10px] text-slate-500">
                {refundMethod === 'credit_deduction' && 'سيتم تخفيض رصيد مديونية العميل تلقائياً بمقدار قيمة المردود.'}
                {refundMethod === 'cash' && 'سيتم خصم هذا المبلغ من سيولة درج الكاشير بالخزينة.'}
                {refundMethod === 'bank' && 'سيتم تسجيل العملية كتحويل بنكي صادر من رصيد البنك.'}
              </p>
            </div>

            {/* Inventory Action */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-700 block">
                مصير البضاعة المرتجعة:
              </label>
              <select
                value={inventoryAction}
                onChange={(e) => setInventoryAction(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-hidden focus:border-emerald-600"
              >
                <option value="restock">إعادة للمخزن / الرف (صالح للبيع ثانية)</option>
                <option value="damaged">تحويل إلى هالك وتوالف (تالف/مكسور)</option>
              </select>
              <p className="text-[10px] text-slate-500">
                {inventoryAction === 'restock' && 'سيتم إضافة علب التبغ المرتجعة تلقائياً إلى رصيد المخزن.'}
                {inventoryAction === 'damaged' && 'سيتم إدراج الكمية تلقائياً في سجل التوالف والهالك دون زيادة المخزن.'}
              </p>
            </div>

          </div>

          {/* Notes & Reason */}
          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              سبب الإرجاع أو ملاحظات:
            </label>
            <input
              type="text"
              value={generalNotes}
              onChange={(e) => setGeneralNotes(e.target.value)}
              placeholder="مثال: رغبة العميل في استبدال الصنف، شراء بالخطأ، علبة معطوبة..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-medium text-slate-800 focus:bg-white focus:outline-hidden focus:border-emerald-600"
            />
          </div>

          {/* Summary Box */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-amber-900 block">إجمالي قيمة المردود المستحق:</span>
              <span className="text-[11px] text-amber-700">
                إجمالي العلب المرتجعة للمخزن: {totalReturnPacks} علبة
              </span>
            </div>
            <div className="text-lg sm:text-xl font-black text-emerald-700 font-mono">
              {formatCurrency(roundedTotalRefund, settings.currency)}
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              إلغاء
            </button>

            <button
              type="submit"
              disabled={isSaving || roundedTotalRefund <= 0}
              className={`px-5 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-xs ${
                roundedTotalRefund > 0 
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95' 
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Check size={16} />
              <span>تأكيد تسجيل المردود</span>
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
