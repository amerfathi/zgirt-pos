import React, { useState } from 'react';
import { Trash2, Plus, AlertOctagon, Scale, DollarSign, Calendar, FileText, Printer, Check } from 'lucide-react';
import { formatCurrency, formatWeight, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';

export default function DamagedItemsView({ store, onOpenA4Report }) {
  const { damagedItems, products, settings, addDamagedItem, deleteDamagedItem } = store;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [form, setForm] = useState({
    productId: '',
    productName: '',
    quantityKg: '',
    packageCount: '',
    unit: 'صندوق',
    costPerKg: '',
    reason: 'فساد وتعفن طبيعي',
    notes: '',
  });

  // Calculate totals
  const totalDamagedKg = damagedItems.reduce((sum, d) => sum + (Number(d.quantityKg) || 0), 0);
  const totalFinancialLoss = damagedItems.reduce((sum, d) => sum + (Number(d.totalLoss) || 0), 0);

  const handleProductSelect = (e) => {
    const prodId = e.target.value;
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      setForm(prev => ({
        ...prev,
        productId: prod.id,
        productName: prod.name,
        unit: prod.defaultUnit || 'صندوق',
        costPerKg: prod.costPerKg ?? prod.costPricePerKg ?? '',
      }));
    } else {
      setForm(prev => ({ ...prev, productId: '', productName: '', costPerKg: '' }));
    }
  };

  const handleSave = async () => {
    if (!form.productName || !form.quantityKg || Number(form.quantityKg) <= 0) {
      alert('يرجى اختيار الصنف وتحديد كمية الوزن التالف بالكيلو');
      return;
    }

    try { await addDamagedItem({
      ...form,
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
    }); } catch (error) {
      alert('تعذر حفظ سجل الإتلاف: ' + error.message);
      return;
    }

    setForm({
      productId: '',
      productName: '',
      quantityKg: '',
      packageCount: '',
      unit: 'صندوق',
      costPerKg: '',
      reason: 'فساد وتعفن طبيعي',
      notes: '',
    });

    setIsAddModalOpen(false);
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف سجل إتلاف (${name})؟`)) {
      try { await deleteDamagedItem(id); }
      catch (error) { alert('تعذر حذف سجل الإتلاف: ' + error.message); }
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Header Card */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 text-red-600 flex items-center justify-center">
              <AlertOctagon size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black text-slate-900">سجل التوالف وإعدامات البضاعة</h1>
              <p className="text-[11px] text-slate-500 font-medium">متابعة الهدر اليومي في الخضار وحساب الخسائر المالية</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onOpenA4Report && onOpenA4Report('damaged')}
              className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
              title="طباعة تقرير التوالف A4"
            >
              <Printer size={14} />
              <span className="hidden sm:inline">تقرير A4</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus size={15} />
              <span>تسجيل إعدام تالف</span>
            </button>
          </div>
        </div>

        {/* Waste & Financial Loss Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
          <div className="bg-red-50 p-3 rounded-xl border border-red-100">
            <span className="text-[10px] text-red-800 font-bold block">إجمالي الخسارة المالية</span>
            <span className="text-base sm:text-lg font-black text-red-900">
              {formatCurrency(totalFinancialLoss, settings.currency)}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
            <span className="text-[10px] text-slate-600 font-medium block">إجمالي الأوزان المعدمة</span>
            <span className="text-base sm:text-lg font-black text-slate-900">
              {formatWeight(totalDamagedKg)}
            </span>
          </div>

          <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-600 font-medium block">عدد عمليات الإتلاف</span>
            <span className="text-base sm:text-lg font-black text-slate-800">
              {damagedItems.length} <span className="text-xs font-normal text-slate-500">عملية</span>
            </span>
          </div>
        </div>
      </div>

      {/* Damaged Items List */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <h2 className="text-xs font-black text-slate-800">سجل عمليات التلف والإعدام الأخيرة ({damagedItems.length})</h2>
          <span className="text-[11px] text-slate-400">تُخصم من الأرباح في تقرير الدخل</span>
        </div>

        {damagedItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <AlertOctagon size={32} className="mx-auto mb-2 opacity-30 text-emerald-600" />
            <p className="text-xs font-bold text-slate-600">لا توجد أي أصناف تالفة مسجلة</p>
            <p className="text-[11px] text-slate-400 mt-0.5">البضاعة ممتازة وبدون هدر حالياً ✔</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {damagedItems.map(item => (
              <div key={item.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-slate-900">{item.productName}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-800">
                      {item.reason}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="font-bold text-slate-800 font-mono">
                      الوزن: {formatWeight(item.quantityKg)}
                    </span>
                    {item.packageCount > 0 && (
                      <span>({item.packageCount} {item.unit})</span>
                    )}
                    <span>التكلفة/كجم: {Number(item.costPerKg).toFixed(2)} {settings.currency}</span>
                    <span className="text-slate-400">{item.date} • {item.time}</span>
                  </div>

                  {item.notes && (
                    <p className="text-[11px] text-slate-500 italic">ملاحظة: {item.notes}</p>
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-left">
                    <span className="text-xs text-slate-400 block font-medium">الخسارة:</span>
                    <span className="text-sm font-black text-red-700">
                      -{formatCurrency(item.totalLoss, settings.currency)}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDelete(item.id, item.productName)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="حذف السجل"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Damaged Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-3.5 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-sm text-slate-900">
                تسجيل صنف تالف / إعدام بضاعة
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold">
                ✕
              </button>
            </div>

            {/* Select Product */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">اختر الصنف التالف *</label>
              <select
                value={form.productId}
                onChange={handleProductSelect}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-600"
              >
                <option value="">-- اختر من قائمة الخضروات --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                ))}
              </select>
            </div>

            {/* Quantity Kg & Package count */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الوزن التالف (كجم) *</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="مثلاً: 25"
                  value={form.quantityKg}
                  onChange={(e) => setForm(prev => ({ ...prev, quantityKg: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد العبوات / الصناديق</label>
                <input
                  type="number"
                  placeholder="مثلاً: 2"
                  value={form.packageCount}
                  onChange={(e) => setForm(prev => ({ ...prev, packageCount: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            {/* Cost per Kg & Reason */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سعر التكلفة للكيلو ({settings.currency})</label>
                <input
                  type="number"
                  step="0.1"
                  placeholder="0.00"
                  value={form.costPerKg}
                  onChange={(e) => setForm(prev => ({ ...prev, costPerKg: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">سبب الإتلاف</label>
                <select
                  value={form.reason}
                  onChange={(e) => setForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-brand-600"
                >
                  <option value="فساد وتعفن طبيعي">فساد وتعفن طبيعي</option>
                  <option value="ذبول وتلف مبيت">ذبول وتلف مبيت</option>
                  <option value="كسر وتهشم نقل">كسر وتهشم نقل</option>
                  <option value="فرز رديء من المزرعة">فرز رديء من المزرعة</option>
                </select>
              </div>
            </div>

            {/* Total Loss preview */}
            <div className="bg-red-50 p-2.5 rounded-xl border border-red-100 flex items-center justify-between">
              <span className="text-xs font-bold text-red-800">إجمالي الخسارة المالية التقديرية:</span>
              <span className="text-sm font-black text-red-900 font-mono">
                {((Number(form.quantityKg) || 0) * (Number(form.costPerKg) || 0)).toFixed(2)} {settings.currency}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                placeholder="مثلاً: وردت هكذا من شحنة الخميس"
                value={form.notes}
                onChange={(e) => setForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md shadow-red-600/20"
              >
                اعتماد وتسجيل الإعدام
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
