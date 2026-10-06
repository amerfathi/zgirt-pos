import React, { useRef, useState } from 'react';
import { 
  Users, UserPlus, Phone, MapPin, DollarSign, ArrowDownLeft, 
  Search, Plus, Edit2, Trash2, CheckCircle2, History, FileText,
  X, Check, Printer, ArrowUpRight, TrendingDown, Building2, Truck, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, formatWeight, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';

export default function SuppliersLedgerView({ store, onOpenNewPurchaseForSupplier }) {
  const { 
    suppliers = [], 
    supplierPayments = [], 
    purchases = [], 
    settings, 
    addSupplier, 
    updateSupplier, 
    deleteSupplier, 
    recordSupplierPayment 
  } = store;

  const [searchTerm, setSearchTerm] = useState('');
  const [filterBalance, setFilterBalance] = useState('all'); // 'all' | 'due' (له) | 'advance' (عليه) | 'zero' (خالص)

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const savingPaymentRef = useRef(false);
  const [selectedSupplierForPayment, setSelectedSupplierForPayment] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank'
  const [paymentNote, setPaymentNote] = useState('سداد دفعة نقدية للمورد');

  // New supplier modal state
  const [isNewSupplierModalOpen, setIsNewSupplierModalOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({
    name: '',
    phone: '',
    marketOrFarm: '',
    initialBalanceType: 'due_to_supplier', // 'due_to_supplier' | 'advance_paid' | 'zero'
    initialBalance: '',
    notes: ''
  });
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // Edit supplier modal state
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [editForm, setEditForm] = useState(/** @type {{name: string, phone: string, marketOrFarm: string, balance: string | number, notes: string}} */ ({
    name: '',
    phone: '',
    marketOrFarm: '',
    balance: 0,
    notes: ''
  }));

  // Supplier Statement Modal State
  const [statementSupplier, setStatementSupplier] = useState(null);

  // Filtered Suppliers
  const filteredSuppliers = suppliers.filter(sup => {
    const matchSearch = sup.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (sup.phone && sup.phone.includes(searchTerm)) ||
      (sup.marketOrFarm && sup.marketOrFarm.toLowerCase().includes(searchTerm.toLowerCase()));

    if (!matchSearch) return false;

    if (filterBalance === 'due') return (sup.balance || 0) > 0;
    if (filterBalance === 'advance') return (sup.balance || 0) < 0;
    if (filterBalance === 'zero') return (sup.balance || 0) === 0;
    return true;
  });

  // Financial Metrics
  const totalDueToSuppliers = suppliers.reduce((sum, s) => sum + ((s.balance || 0) > 0 ? s.balance : 0), 0);
  const totalAdvancesPaid = suppliers.reduce((sum, s) => sum + ((s.balance || 0) < 0 ? Math.abs(s.balance) : 0), 0);
  const totalSuppliersCount = suppliers.length;

  // Handlers
  const handleOpenPayment = (supplier) => {
    setSelectedSupplierForPayment(supplier);
    setPaymentAmount('');
    setPaymentMethod('cash');
    setPaymentNote('سداد دفعة نقدية للمورد');
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (savingPaymentRef.current) return;
    if (!selectedSupplierForPayment || !paymentAmount || Number(paymentAmount) <= 0) {
      alert('يرجى إدخال مبلغ سداد صحيح');
      return;
    }

    savingPaymentRef.current = true;
    setIsSavingPayment(true);
    try {
      await recordSupplierPayment({
      supplierId: selectedSupplierForPayment.id,
      amount: Number(paymentAmount),
      paymentMethod,
      notes: paymentNote.trim(),
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted()
      });
      setIsPaymentModalOpen(false);
      setSelectedSupplierForPayment(null);
    } catch (error) {
      alert('تعذر حفظ سداد المورد: ' + error.message);
    } finally {
      savingPaymentRef.current = false;
      setIsSavingPayment(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (isSavingSupplier) return;
    if (!supplierForm.name.trim()) {
      alert('يرجى كتابة اسم المورد أو المزرعة');
      return;
    }

    const initAmt = Number(supplierForm.initialBalance) || 0;
    let computedBalance = 0;
    if (supplierForm.initialBalanceType === 'due_to_supplier') {
      computedBalance = Math.abs(initAmt);
    } else if (supplierForm.initialBalanceType === 'advance_paid') {
      computedBalance = -Math.abs(initAmt);
    }

    setIsSavingSupplier(true);
    try { await addSupplier({
      name: supplierForm.name.trim(),
      phone: supplierForm.phone.trim(),
      marketOrFarm: supplierForm.marketOrFarm.trim(),
      balance: computedBalance,
      notes: supplierForm.notes.trim()
    });

    setSupplierForm({
      name: '',
      phone: '',
      marketOrFarm: '',
      initialBalanceType: 'due_to_supplier',
      initialBalance: '',
      notes: ''
    });
    setIsNewSupplierModalOpen(false);
    } catch (error) { alert('تعذر حفظ المورد: ' + error.message); }
    finally { setIsSavingSupplier(false); }
  };

  const handleOpenEdit = (sup) => {
    setEditingSupplier(sup);
    setEditForm({
      name: sup.name || '',
      phone: sup.phone || '',
      marketOrFarm: sup.marketOrFarm || '',
      balance: sup.balance || 0,
      notes: sup.notes || ''
    });
  };

  const handleSaveEdit = async () => {
    if (isSavingSupplier) return;
    if (!editForm.name.trim()) {
      alert('يرجى كتابة اسم المورد');
      return;
    }

    setIsSavingSupplier(true);
    try { await updateSupplier(editingSupplier.id, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      marketOrFarm: editForm.marketOrFarm.trim(),
      balance: Number(editForm.balance) || 0,
      notes: editForm.notes.trim()
    });
      setEditingSupplier(null);
    } catch (error) { alert('تعذر تحديث المورد: ' + error.message); }
    finally { setIsSavingSupplier(false); }
  };

  const handleDeleteSupplier = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف المورد: "${name}"؟\nلن يتم حذف فواتير التوريد السابقة.`)) {
      try { await deleteSupplier(id); }
      catch (error) { alert('تعذر حذف المورد: ' + error.message); }
    }
  };

  // Build supplier ledger history
  const getSupplierLedger = (supplier) => {
    if (!supplier) return [];

    const supplierPurchases = (purchases || []).filter(p => 
      (p.supplierId && p.supplierId === supplier.id) ||
      (p.supplierName && p.supplierName.trim() === supplier.name.trim())
    );

    const supplierPaymentsList = (supplierPayments || []).filter(p => 
      p.supplierId === supplier.id ||
      (p.supplierName && p.supplierName.trim() === supplier.name.trim())
    );

    const items = [
      ...supplierPurchases.map(p => ({
        id: p.id,
        date: p.date,
        time: p.time,
        type: 'purchase',
        title: `فاتورة توريد: ${p.productName} (${p.quantityKg} كجم)`,
        method: p.paymentMethod,
        creditCost: p.paymentMethod === 'credit' ? Number(p.totalCost) : (Number(p.creditAmount) || 0),
        totalCost: Number(p.totalCost) || 0,
        effect: p.paymentMethod === 'credit' ? Number(p.totalCost) : (Number(p.creditAmount) || 0),
        notes: p.notes
      })),
      ...supplierPaymentsList.map(pay => ({
        id: pay.id,
        date: pay.date,
        time: pay.time,
        type: 'payment',
        title: `سند صرف / سداد دفعة (${pay.paymentMethod === 'cash' ? 'نقداً من الدرج' : 'تحويل بنكي'})`,
        method: pay.paymentMethod,
        creditCost: 0,
        totalCost: Number(pay.amount) || 0,
        effect: -Number(pay.amount),
        notes: pay.notes
      }))
    ].sort((a, b) => a.date.localeCompare(b.date));

    let running = 0;
    return items.map(item => {
      running += item.effect;
      return {
        ...item,
        runningBalance: Math.round(running * 100) / 100
      };
    });
  };

  return (
    <div className="space-y-4">
      
      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Total Due to Suppliers (له فلوس علينا) */}
        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-900">مستحقات الموردين (لهم فلوس)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center font-bold">
              <ArrowDownLeft size={16} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-amber-900 mt-1.5">
            {formatCurrency(totalDueToSuppliers, settings.currency)}
          </div>
          <span className="text-[10px] text-amber-700 block mt-1">
            إجمالي التزامات التوريد الآجل الواجب سدادها
          </span>
        </div>

        {/* Total Advances Paid to Suppliers (عليهم فلوس لنا / دفعات مقدمة) */}
        <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-900">دفعات مقدمة للموردين (عليهم فلوس)</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <ArrowUpRight size={16} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-emerald-900 mt-1.5">
            {formatCurrency(totalAdvancesPaid, settings.currency)}
          </div>
          <span className="text-[10px] text-emerald-700 block mt-1">
            دفعات سددناها للموردين بانتظار توريد بضاعة بها
          </span>
        </div>

        {/* Registered Suppliers Count */}
        <div className="bg-slate-50 border border-slate-200/80 p-4 rounded-2xl">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700">الموردون والجهات المسجلة</span>
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-white flex items-center justify-center font-bold">
              <Building2 size={16} />
            </div>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900 mt-1.5">
            {totalSuppliersCount} <span className="text-xs font-medium text-slate-500">مورد معتمد</span>
          </div>
          <span className="text-[10px] text-slate-500 block mt-1">
            الموردون المعتمدون والموزعون المباشرون
          </span>
        </div>
      </div>

      {/* Action Bar & Filters */}
      <div className="bg-white rounded-2xl p-3.5 shadow-sm border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم المورد، المزرعة، أو رقم الهاتف..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                if (suppliers.length === 0) {
                  alert('يرجى إضافة مورد أولاً قبل تسجيل سداد الدفعة');
                  return;
                }
                setSelectedSupplierForPayment(suppliers[0]);
                setPaymentAmount('');
                setPaymentMethod('cash');
                setIsPaymentModalOpen(true);
              }}
              className="py-2 px-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <DollarSign size={15} />
              <span>سداد دفعة لمورد</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewSupplierModalOpen(true)}
              className="py-2 px-3.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-black rounded-xl flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <UserPlus size={15} />
              <span>+ مورد جديد</span>
            </button>
          </div>
        </div>

        {/* Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1 border-t border-slate-100">
          {[
            { id: 'all', label: 'جميع الموردين', count: suppliers.length },
            { id: 'due', label: 'لهم مستحقات (دين علينا)', count: suppliers.filter(s => (s.balance || 0) > 0).length },
            { id: 'advance', label: 'عليهم دفعات مقدمة (لنا عندهم)', count: suppliers.filter(s => (s.balance || 0) < 0).length },
            { id: 'zero', label: 'حسابات خالصة', count: suppliers.filter(s => (s.balance || 0) === 0).length },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterBalance(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                filterBalance === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Suppliers Grid / Cards */}
      {filteredSuppliers.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
          <Truck size={40} className="mx-auto mb-2 text-slate-300" />
          <h3 className="text-sm font-black text-slate-800 mb-1">لا يوجد موردون مسجلون في هذا القسم</h3>
          <p className="text-xs text-slate-500 mb-4 max-w-sm mx-auto">
            سجل بيانات الموردين لمتابعة أرصدتهم وحسابات الآجل والدفعات النقدية بدقة متناهية.
          </p>
          <button
            type="button"
            onClick={() => setIsNewSupplierModalOpen(true)}
            className="py-2 px-4 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
          >
            <Plus size={15} />
            <span>إضافة أول مورد الآن</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSuppliers.map((sup) => {
            const balance = Number(sup.balance) || 0;
            const isDue = balance > 0;
            const isAdvance = balance < 0;

            return (
              <div 
                key={sup.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 hover:border-slate-300 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                <div>
                  {/* Card Header: Name, Farm & Balance Badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <h3 className="text-sm font-black text-slate-900 leading-snug">{sup.name}</h3>
                      {sup.marketOrFarm && (
                        <div className="flex items-center gap-1 text-[11px] text-slate-500 font-medium">
                          <MapPin size={12} className="text-slate-400" />
                          <span>{sup.marketOrFarm}</span>
                        </div>
                      )}
                    </div>

                    {/* Balance Status Badge */}
                    <div className="text-left shrink-0">
                      {isDue ? (
                        <div className="px-2.5 py-1 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 text-left">
                          <span className="text-[10px] font-bold block">له مستحق علينا:</span>
                          <span className="text-sm font-black font-mono">
                            {formatCurrency(balance, settings.currency)}
                          </span>
                        </div>
                      ) : isAdvance ? (
                        <div className="px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 text-left">
                          <span className="text-[10px] font-bold block">عليه دفعة لنا:</span>
                          <span className="text-sm font-black font-mono">
                            {formatCurrency(Math.abs(balance), settings.currency)}
                          </span>
                        </div>
                      ) : (
                        <div className="px-2.5 py-1 rounded-xl bg-slate-100 border border-slate-200 text-slate-600 text-center">
                          <span className="text-[11px] font-black block">خالص (رصيد صفر)</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Phone & Notes */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {sup.phone ? (
                      <a 
                        href={`tel:${sup.phone}`} 
                        className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 hover:text-emerald-600 transition-colors"
                      >
                        <Phone size={12} className="text-emerald-600" />
                        <span>{sup.phone}</span>
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400">بدون هاتف</span>
                    )}

                    {sup.notes && (
                      <span className="text-[11px] text-slate-500 italic max-w-[180px] truncate" title={sup.notes}>
                        {sup.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Buttons */}
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 flex-1">
                    <button
                      type="button"
                      onClick={() => handleOpenPayment(sup)}
                      className="flex-1 py-1.5 px-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer shadow-xs"
                      title="سداد دفعة للمورد"
                    >
                      <DollarSign size={13} />
                      <span>سداد دفعة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (onOpenNewPurchaseForSupplier) {
                          onOpenNewPurchaseForSupplier(sup);
                        }
                      }}
                      className="py-1.5 px-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
                      title="تسجيل توريد جديد من هذا المورد"
                    >
                      <Truck size={13} />
                      <span>توريد</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatementSupplier(sup)}
                      className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer"
                      title="عرض كشف حساب المورد"
                    >
                      <FileText size={13} />
                      <span>كشف حساب</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(sup)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="تعديل بيانات المورد"
                    >
                      <Edit2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="حذف المورد"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal 1: Add New Supplier */}
      <AnimatePresence>
        {isNewSupplierModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <UserPlus size={16} />
                  </div>
                  <h3 className="font-black text-sm text-slate-900">إضافة مورد أو مزرعة جديدة</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المورد *</label>
                  <input
                    type="text"
                    placeholder="مثال: شركة التوريد - أبو راشد"
                    value={supplierForm.name}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">رقم الهاتف / واتساب</label>
                    <input
                      type="text"
                      placeholder="05XXXXXXXX"
                      value={supplierForm.phone}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الموقع / الحلبة / المدينة</label>
                    <input
                      type="text"
                      placeholder="مثال: حلقة الجملة مسار 3"
                      value={supplierForm.marketOrFarm}
                      onChange={(e) => setSupplierForm(prev => ({ ...prev, marketOrFarm: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                    />
                  </div>
                </div>

                {/* Initial Balance Logic (له / عليه) */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <label className="block font-bold text-slate-800">حالة الرصيد الافتتاحي السابق (إن وجد):</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSupplierForm(prev => ({ ...prev, initialBalanceType: 'due_to_supplier' }))}
                      className={`p-2 rounded-lg font-bold text-center border transition-all ${
                        supplierForm.initialBalanceType === 'due_to_supplier'
                          ? 'bg-amber-100 border-amber-400 text-amber-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      له فلوس علينا
                    </button>

                    <button
                      type="button"
                      onClick={() => setSupplierForm(prev => ({ ...prev, initialBalanceType: 'advance_paid' }))}
                      className={`p-2 rounded-lg font-bold text-center border transition-all ${
                        supplierForm.initialBalanceType === 'advance_paid'
                          ? 'bg-emerald-100 border-emerald-400 text-emerald-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      عليه فلوس لنا
                    </button>

                    <button
                      type="button"
                      onClick={() => setSupplierForm(prev => ({ ...prev, initialBalanceType: 'zero', initialBalance: '0' }))}
                      className={`p-2 rounded-lg font-bold text-center border transition-all ${
                        supplierForm.initialBalanceType === 'zero'
                          ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      رصيد صفر (خالص)
                    </button>
                  </div>

                  {supplierForm.initialBalanceType !== 'zero' && (
                    <div className="pt-1">
                      <label className="block font-bold text-slate-700 mb-1">
                        قيمة المبلغ ({settings.currency})
                      </label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={supplierForm.initialBalance}
                        onChange={(e) => setSupplierForm(prev => ({ ...prev, initialBalance: e.target.value }))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-slate-900"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
                  <input
                    type="text"
                    placeholder="ملاحظات حول طريقة التوريد أو التعامل..."
                    value={supplierForm.notes}
                    onChange={(e) => setSupplierForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsNewSupplierModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleCreateSupplier}
                  className="flex-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  حفظ بيانات المورد
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 2: Record Payment to Supplier */}
      <AnimatePresence>
        {isPaymentModalOpen && selectedSupplierForPayment && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center">
                    <DollarSign size={16} />
                  </div>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">سداد دفعة لمورد / صرف مبلغ</h3>
                    <p className="text-[11px] text-slate-500 font-medium">المورد: {selectedSupplierForPayment.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { if (!savingPaymentRef.current) setIsPaymentModalOpen(false); }}
                  disabled={isSavingPayment}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {/* Current balance card */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-500 block">الرصيد الحالي في ذمة المورد:</span>
                  <span className="text-[10px] text-slate-400">
                    {selectedSupplierForPayment.balance > 0 ? 'مستحق له (دين علينا)' : selectedSupplierForPayment.balance < 0 ? 'مدين لنا (دفعة مقدمة)' : 'خالص'}
                  </span>
                </div>
                <div className={`text-base font-black font-mono ${selectedSupplierForPayment.balance > 0 ? 'text-amber-800' : selectedSupplierForPayment.balance < 0 ? 'text-emerald-700' : 'text-slate-600'}`}>
                  {formatCurrency(Math.abs(selectedSupplierForPayment.balance || 0), settings.currency)}
                </div>
              </div>

              {/* Supplier Switcher if opened directly from top button */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المورد المستلم للدفعة *</label>
                <select
                  value={selectedSupplierForPayment.id}
                  onChange={(e) => {
                    const found = suppliers.find(s => s.id === e.target.value);
                    if (found) setSelectedSupplierForPayment(found);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.balance > 0 ? `له ${s.balance}` : s.balance < 0 ? `عليه ${Math.abs(s.balance)}` : 'خالص'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Amount */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">مبلغ الدفعة ({settings.currency}) *</label>
                <input
                  type="number"
                  step="0.5"
                  autoFocus
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-amber-50/50 border border-amber-300 rounded-xl text-sm font-black font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Payment Source */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة الصرف:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === 'cash'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    نقداً من الدرج (كاش) 💵
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                      paymentMethod === 'bank'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    تحويل بنكي 🏛️
                  </button>
                </div>
                {paymentMethod === 'cash' && (
                  <span className="text-[10px] text-slate-500 block mt-1">
                    💡 سيتم تسجيل هذا المبلغ تلقائياً في سندات الصرف وخصمه من نقدية الدرج اليوم.
                  </span>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان / ملاحظات</label>
                <input
                  type="text"
                  placeholder="مثال: دفعة تحت الحساب، تسوية حمولة طماطم..."
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { if (!savingPaymentRef.current) setIsPaymentModalOpen(false); }}
                  disabled={isSavingPayment}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmPayment}
                  disabled={isSavingPayment}
                  className="flex-2 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  {isSavingPayment ? 'جارٍ حفظ السداد...' : 'تأكيد سداد الدفعة'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 3: Edit Supplier */}
      <AnimatePresence>
        {editingSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    <Edit2 size={16} />
                  </div>
                  <h3 className="font-black text-sm text-slate-900">تعديل بيانات المورد</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المورد *</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الهاتف</label>
                    <input
                      type="text"
                      value={editForm.phone}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">الموقع / الحلبة</label>
                    <input
                      type="text"
                      value={editForm.marketOrFarm}
                      onChange={(e) => setEditForm(prev => ({ ...prev, marketOrFarm: e.target.value }))}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    الرصيد الدفتري الحالي ({settings.currency})
                    <span className="text-[10px] text-slate-400 block font-normal">
                      موجب = له مستحق عندنا، سالب = عليه دفعة لنا
                    </span>
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={editForm.balance}
                    onChange={(e) => setEditForm(prev => ({ ...prev, balance: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">ملاحظات</label>
                  <input
                    type="text"
                    value={editForm.notes}
                    onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingSupplier(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  className="flex-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-sm cursor-pointer"
                >
                  حفظ التعديلات
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal 4: Detailed Supplier Statement (كشف حساب المورد والتوريدات) */}
      <AnimatePresence>
        {statementSupplier && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-2 sm:p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden"
            >
              {/* Header (Hidden in Print) */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
                <div className="flex items-center gap-2">
                  <FileText size={18} className="text-amber-400" />
                  <div>
                    <h3 className="font-black text-sm">كشف حساب تفصيلي للمورد: {statementSupplier.name}</h3>
                    <p className="text-[11px] text-slate-300">سجل الشحنات الموردة والدفعات المسددة والرصيد المتراكم</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="py-1.5 px-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Printer size={15} />
                    <span>طباعة A4</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatementSupplier(null)}
                    className="text-slate-400 hover:text-white text-sm font-bold p-1 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Printable Body */}
              <div className="p-6 overflow-y-auto space-y-4 print:p-0">
                {/* Official Statement Header */}
                <div className="border-b-2 border-slate-900 pb-4 flex items-center justify-between">
                  <div>
                    <h1 className="text-xl font-black text-slate-900">{settings.shopName || 'سوق ومحل الخضار'}</h1>
                    <p className="text-xs text-slate-600">{settings.subTitle} • {settings.phone}</p>
                    <p className="text-xs text-slate-500 mt-1">{settings.address}</p>
                  </div>
                  <div className="text-left">
                    <span className="inline-block px-3 py-1 bg-slate-100 rounded-lg text-xs font-black text-slate-800 mb-1">
                      كشف حساب مورد رسمي
                    </span>
                    <p className="text-xs text-slate-600 font-mono">تاريخ الاستخراج: {getCurrentDateFormatted()}</p>
                  </div>
                </div>

                {/* Supplier Info Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs">
                  <div>
                    <span className="text-slate-500 block">اسم المورد / الجهة:</span>
                    <strong className="text-slate-900 text-sm">{statementSupplier.name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">رقم الهاتف:</span>
                    <strong className="font-mono text-slate-800">{statementSupplier.phone || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">الموقع / الحلبة:</span>
                    <strong className="text-slate-800">{statementSupplier.marketOrFarm || '—'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">الرصيد الصافي الإجمالي:</span>
                    <strong className={`text-base font-black font-mono ${statementSupplier.balance > 0 ? 'text-amber-800' : statementSupplier.balance < 0 ? 'text-emerald-700' : 'text-slate-800'}`}>
                      {statementSupplier.balance > 0 
                        ? `له مستحق: ${formatCurrency(statementSupplier.balance, settings.currency)}`
                        : statementSupplier.balance < 0 
                        ? `عليه لنا: ${formatCurrency(Math.abs(statementSupplier.balance), settings.currency)}`
                        : 'خالص (0)'}
                    </strong>
                  </div>
                </div>

                {/* Statement Ledger Table */}
                {(() => {
                  const ledger = getSupplierLedger(statementSupplier);
                  if (ledger.length === 0) {
                    return (
                      <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl">
                        لا توجد حركات توريد أو دفعات مسجلة لهذا المورد حتى الآن
                      </div>
                    );
                  }

                  return (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-right text-xs">
                        <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                          <tr>
                            <th className="p-2.5">التاريخ والوقت</th>
                            <th className="p-2.5">البيان والحركة</th>
                            <th className="p-2.5">طريقة الدفع</th>
                            <th className="p-2.5">توريد بضاعة (دائن / له)</th>
                            <th className="p-2.5">سداد دفعة (مدين / خصم)</th>
                            <th className="p-2.5">الرصيد التراكمي</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {ledger.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/80">
                              <td className="p-2.5 font-mono text-[11px] text-slate-600">{row.date} {row.time}</td>
                              <td className="p-2.5 font-bold text-slate-900">{row.title}</td>
                              <td className="p-2.5">
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                  {row.method === 'credit' ? 'آجل' : row.method === 'cash' ? 'نقدي' : 'بنكي'}
                                </span>
                              </td>
                              <td className="p-2.5 font-mono font-bold text-amber-800">
                                {row.type === 'purchase' ? formatCurrency(row.totalCost, settings.currency) : '—'}
                              </td>
                              <td className="p-2.5 font-mono font-bold text-emerald-700">
                                {row.type === 'payment' ? formatCurrency(row.totalCost, settings.currency) : '—'}
                              </td>
                              <td className="p-2.5 font-mono font-black text-slate-900">
                                {formatCurrency(row.runningBalance, settings.currency)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}

                {/* Signatures & Stamp Area for Print */}
                <div className="pt-8 grid grid-cols-2 text-center text-xs font-bold text-slate-700 border-t border-slate-200">
                  <div>
                    <span>توقيع وختم المحل / الإدارة</span>
                    <div className="h-16"></div>
                    <span className="border-t border-slate-300 px-6 pt-1">........................................</span>
                  </div>
                  <div>
                    <span>توقيع المورد المستلم</span>
                    <div className="h-16"></div>
                    <span className="border-t border-slate-300 px-6 pt-1">........................................</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
