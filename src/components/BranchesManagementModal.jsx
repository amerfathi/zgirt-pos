import React, { useState } from 'react';
import { 
  Building2, Plus, ArrowLeftRight, CheckCircle2, AlertTriangle, 
  MapPin, Phone, User, Shield, Store, Check, X, Edit3, Trash2,
  ExternalLink, Sparkles, PackageCheck
} from 'lucide-react';

export default function BranchesManagementModal({ isOpen, onClose, store }) {
  const { 
    branches, 
    activeBranchId, 
    activeBranch,
    changeActiveBranch, 
    addBranch, 
    updateBranch, 
    deleteBranch, 
    setMainBranch,
    transferStockBetweenBranches,
    stockTransfers,
    products,
    invoices,
    purchases,
    currentUser
  } = store;

  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'transfer' | 'add'
  const [editingBranch, setEditingBranch] = useState(null);

  // Add Branch Form State
  const [newBranchData, setNewBranchData] = useState({
    name: '',
    code: '',
    phone: '',
    address: '',
    managerName: ''
  });

  // Transfer Stock Form State
  const [transferData, setTransferData] = useState({
    fromBranchId: activeBranchId || (branches[0]?.id || ''),
    toBranchId: branches.find(b => b.id !== activeBranchId)?.id || '',
    productId: products[0]?.id || '',
    quantityKg: '',
    notes: ''
  });

  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const parentTenant = (store.tenants || []).find(t => t.id === currentUser?.tenantId || t.id === currentUser?.id);
  const allowedLimit = currentUser?.role === 'super_admin' ? 999 : Number(parentTenant?.allowedBranches || currentUser?.allowedBranches || 1);
  const isLimitReached = branches.length >= allowedLimit && currentUser?.role !== 'super_admin';

  // Handle Add Branch
  const handleCreateBranch = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      if (!newBranchData.name.trim()) {
        setErrorMsg('يرجى إدخال اسم الفرع');
        return;
      }

      setIsSaving(true);
      await addBranch(newBranchData);
      setSuccessMsg(`تمت إضافة فرع "${newBranchData.name}" بنجاح!`);
      setNewBranchData({ name: '', code: '', phone: '', address: '', managerName: '' });
      setActiveTab('list');
    } catch (err) {
      setErrorMsg(err.message || 'حدث خطأ أثناء إضافة الفرع');
    } finally { setIsSaving(false); }
  };

  // Handle Edit Branch
  const handleUpdateBranch = async (e) => {
    e.preventDefault();
    if (!editingBranch || isSaving) return;
    setIsSaving(true);
    try {
      await updateBranch(editingBranch.id, editingBranch);
      setEditingBranch(null);
      setSuccessMsg('تم تحديث بيانات الفرع بنجاح');
    } catch (err) {
      setErrorMsg(err.message || 'فشل تحديث الفرع');
    } finally { setIsSaving(false); }
  };

  // Handle Stock Transfer
  const handleExecuteTransfer = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const selectedProd = products.find(p => p.id === transferData.productId);
      if (!selectedProd) {
        setErrorMsg('يرجى اختيار الصنف');
        return;
      }

      setIsSaving(true);
      await transferStockBetweenBranches({
        fromBranchId: transferData.fromBranchId,
        toBranchId: transferData.toBranchId,
        productId: selectedProd.id,
        productName: selectedProd.name,
        quantityKg: transferData.quantityKg,
        notes: transferData.notes
      });

      setSuccessMsg(`تمت مناقلة ${transferData.quantityKg} كجم من "${selectedProd.name}" بنجاح!`);
      setTransferData(prev => ({
        ...prev,
        quantityKg: '',
        notes: ''
      }));
    } catch (err) {
      setErrorMsg(err.message || 'فشلت عملية مناقلة المخزون');
    } finally { setIsSaving(false); }
  };

  // WhatsApp Upgrade Link
  const waPhone = '966564982852';
  const waUpgradeText = encodeURIComponent(
    `السلام عليكم، أنا المشترك (${currentUser?.companyName || currentUser?.username})، أرغب في ترقية باقتي لإضافة فروع إضافية لنظام الخضار والفواكه.`
  );
  const waUpgradeUrl = `https://wa.me/${waPhone}?text=${waUpgradeText}`;

  // Helper stats for a branch
  const getBranchStats = (bId) => {
    const branchInvoices = invoices.filter(i => i.branchId === bId);
    const totalRev = branchInvoices.reduce((sum, i) => sum + (Number(i.finalTotal) || 0), 0);
    const branchPurchases = purchases.filter(p => p.branchId === bId);
    return {
      invoicesCount: branchInvoices.length,
      revenue: Math.round(totalRev * 100) / 100,
      purchasesCount: branchPurchases.length
    };
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]"
        dir="rtl"
      >
        {/* Header */}
        <div className="bg-navy-850 text-white px-5 py-4 flex items-center justify-between border-b border-navy-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-xs border border-white/10">
              <Building2 className="text-primary-300" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold tracking-tight">إدارة الفروع والمستودعات</h2>
                <span className="text-[10px] font-semibold bg-white/10 text-slate-200 px-2 py-0.5 rounded-full border border-white/10">
                  {branches.length} من {allowedLimit} فروع مفعلة
                </span>
              </div>
              <p className="text-xs text-slate-300 font-normal">
                متابعة مبيعات الفروع ومناقلات المخزون والتحكم في الفرع النشط
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 pt-3 pb-2 bg-slate-50/70">
          <button
            type="button"
            onClick={() => { setActiveTab('list'); setEditingBranch(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'list'
                ? 'bg-navy-850 text-white shadow-2xs'
                : 'text-slate-600 hover:text-navy-850 hover:bg-slate-200/60'
            }`}
          >
            <Store size={15} />
            <span>فروع المحل ({branches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('transfer'); setEditingBranch(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'transfer'
                ? 'bg-navy-850 text-white shadow-2xs'
                : 'text-slate-600 hover:text-navy-850 hover:bg-slate-200/60'
            }`}
          >
            <ArrowLeftRight size={15} />
            <span>مناقلات المخزون ({stockTransfers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('add'); setEditingBranch(null); }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'add'
                ? 'bg-navy-850 text-white shadow-2xs'
                : 'text-slate-600 hover:text-navy-850 hover:bg-slate-200/60'
            }`}
          >
            <Plus size={15} />
            <span>إضافة فرع جديد</span>
          </button>
        </div>

        {/* Messages Alerts */}
        {errorMsg && (
          <div className="mx-5 mt-3 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center gap-2 font-semibold animate-in fade-in">
            <AlertTriangle size={16} className="text-rose-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="mx-5 mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2 font-semibold animate-in fade-in">
            <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* TAB 1: BRANCH LIST */}
          {activeTab === 'list' && !editingBranch && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {branches.map(branch => {
                  const isCurrent = branch.id === activeBranchId;
                  const stats = getBranchStats(branch.id);

                  return (
                    <div 
                      key={branch.id}
                      className={`p-4 rounded-2xl border transition-all ${
                        isCurrent 
                          ? 'border-primary-500 bg-primary-50/20 shadow-soft ring-1 ring-primary-500/20' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs ${
                            isCurrent ? 'bg-primary-500 text-white' : 'bg-slate-100 text-slate-700'
                          }`}>
                            <Store size={17} />
                          </div>
                          <div>
                            <h4 className="font-bold text-navy-850 text-sm flex items-center gap-1.5">
                              <span>{branch.name}</span>
                              {branch.isMain && (
                                <span className="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.2 rounded-md font-semibold">
                                  الرئيسي 👑
                                </span>
                              )}
                              {isCurrent && (
                                <span className="text-[10px] bg-primary-50 text-primary-700 border border-primary-100 px-1.5 py-0.2 rounded-md font-semibold flex items-center gap-0.5">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-pulse"></span>
                                  الفرع النشط حالياً
                                </span>
                              )}
                            </h4>
                            <span className="text-[10px] text-slate-400 font-mono" dir="ltr">
                              كود: {branch.code || 'BR'}
                            </span>
                          </div>
                        </div>

                        {/* Actions menu */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingBranch(branch)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                            title="تعديل بيانات الفرع"
                          >
                            <Edit3 size={15} />
                          </button>
                          {!branch.isMain && (
                            <button
                              type="button"
                              onClick={async () => {
                                try { await deleteBranch(branch.id); }
                                catch (error) { setErrorMsg(error.message || 'تعذر تعطيل الفرع'); }
                              }}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="حذف الفرع"
                            >
                              <Trash2 size={15} />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Details */}
                      <div className="space-y-1 text-xs text-slate-600 mb-3 pt-2 border-t border-slate-100">
                        {branch.address && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <MapPin size={12} className="text-slate-400 shrink-0" />
                            <span className="truncate">{branch.address}</span>
                          </div>
                        )}
                        {branch.phone && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <Phone size={12} className="text-slate-400 shrink-0" />
                            <span dir="ltr">{branch.phone}</span>
                          </div>
                        )}
                        {branch.managerName && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                            <User size={12} className="text-slate-400 shrink-0" />
                            <span>المسؤول: {branch.managerName}</span>
                          </div>
                        )}
                      </div>

                      {/* Branch KPI Stats */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-xl mb-3 border border-slate-200/70 text-center">
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">مبيعات هذا الفرع</span>
                          <span className="text-xs font-black text-slate-800">{stats.revenue.toLocaleString()} ر.س</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block font-medium">عدد الفواتير</span>
                          <span className="text-xs font-black text-slate-800">{stats.invoicesCount} فاتورة</span>
                        </div>
                      </div>

                      {/* Switch and Main button */}
                      <div className="flex items-center gap-2">
                        {!isCurrent ? (
                          <button
                            type="button"
                            onClick={async () => {
                              try {
                                await changeActiveBranch(branch.id);
                                setSuccessMsg(`تم تعيين "${branch.name}" كفرع نشط حالياً للعمليات`);
                              } catch (error) { setErrorMsg(error.message || 'تعذر تغيير الفرع النشط'); }
                            }}
                            className="flex-1 py-1.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Check size={14} />
                            <span>التحويل لهذا الفرع الآن</span>
                          </button>
                        ) : (
                          <div className="flex-1 py-1.5 bg-primary-50 text-primary-700 rounded-xl text-xs font-semibold text-center border border-primary-100">
                            ✓ أنت تعمل على هذا الفرع الآن
                          </div>
                        )}

                        {!branch.isMain && (
                          <button
                            type="button"
                            onClick={async () => {
                              try { await setMainBranch(branch.id); }
                              catch (error) { setErrorMsg(error.message || 'تعذر تعيين الفرع الرئيسي'); }
                            }}
                            className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-[11px] font-semibold transition-colors cursor-pointer border border-slate-200/80"
                            title="جعله الفرع الرئيسي للمؤسسة"
                          >
                            تعيين كرئيسي
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* EDIT BRANCH FORM */}
          {editingBranch && (
            <form onSubmit={handleUpdateBranch} className="max-w-lg mx-auto bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3">
              <h3 className="text-sm font-bold text-navy-850 flex items-center gap-2 mb-2">
                <Edit3 size={16} className="text-primary-500" />
                <span>تعديل بيانات: {editingBranch.name}</span>
              </h3>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الفرع *</label>
                <input
                  type="text"
                  value={editingBranch.name}
                  onChange={e => setEditingBranch({ ...editingBranch, name: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">كود الفرع</label>
                  <input
                    type="text"
                    value={editingBranch.code || ''}
                    onChange={e => setEditingBranch({ ...editingBranch, code: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">هاتف الفرع</label>
                  <input
                    type="tel"
                    value={editingBranch.phone || ''}
                    onChange={e => setEditingBranch({ ...editingBranch, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">العنوان / الموقع</label>
                <input
                  type="text"
                  value={editingBranch.address || ''}
                  onChange={e => setEditingBranch({ ...editingBranch, address: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم مدير الفرع</label>
                <input
                  type="text"
                  value={editingBranch.managerName || ''}
                  onChange={e => setEditingBranch({ ...editingBranch, managerName: e.target.value })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold cursor-pointer transition-colors shadow-2xs"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setEditingBranch(null)}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: STOCK TRANSFERS */}
          {activeTab === 'transfer' && (
            <div className="space-y-5">
              {/* Transfer Form */}
              <form onSubmit={handleExecuteTransfer} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h3 className="text-xs font-bold text-navy-850 flex items-center gap-1.5">
                  <PackageCheck size={16} className="text-primary-500" />
                  <span>مناقلة وتحويل كمية من المخزون بين فرعين</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">من الفرع (المصدر) *</label>
                    <select
                      value={transferData.fromBranchId}
                      onChange={e => setTransferData({ ...transferData, fromBranchId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">إلى الفرع (المستلم) *</label>
                    <select
                      value={transferData.toBranchId}
                      onChange={e => setTransferData({ ...transferData, toBranchId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    >
                      {branches.map(b => (
                        <option key={b.id} value={b.id} disabled={b.id === transferData.fromBranchId}>
                          {b.name} {b.id === transferData.fromBranchId ? '(نفس الفرع)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الصنف المطلوب نقله *</label>
                    <select
                      value={transferData.productId}
                      onChange={e => setTransferData({ ...transferData, productId: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                    >
                      {products.map(p => {
                        const bStock = p.branchStock?.[transferData.fromBranchId] ?? p.currentStockKg ?? 0;
                        return (
                          <option key={p.id} value={p.id}>
                            {p.icon || '📦'} {p.name} (رصيد المصدر: {bStock} كجم)
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">الكمية / الوزن المراد نقله (كجم) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      placeholder="مثال: 25.5"
                      value={transferData.quantityKg}
                      onChange={e => setTransferData({ ...transferData, quantityKg: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات المناقلة / اسم الناقل</label>
                  <input
                    type="text"
                    placeholder="مثال: تم الإرسال مع سيارة التوزيع رقم 3 - السائق محمد"
                    value={transferData.notes}
                    onChange={e => setTransferData({ ...transferData, notes: e.target.value })}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-soft transition-colors"
                >
                  <ArrowLeftRight size={16} />
                  <span>تنفيذ مناقلة المخزون الآن</span>
                </button>
              </form>

              {/* Transfer Logs */}
              <div>
                <h4 className="text-xs font-bold text-slate-700 mb-2">سجل المناقلات والتحويلات السابقة ({stockTransfers.length})</h4>
                {stockTransfers.length === 0 ? (
                  <div className="text-center py-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-xs text-slate-400">
                    لم يتم تسجيل أي مناقلات بين الفروع بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {stockTransfers.map(tr => (
                      <div key={tr.id} className="p-3 bg-white border border-slate-200 rounded-xl text-xs flex items-center justify-between gap-3">
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span className="text-navy-850 font-bold">{tr.productName}</span>
                            <span className="bg-primary-50 text-primary-700 border border-primary-100 px-1.5 py-0.2 rounded-md font-mono font-bold">
                              {tr.quantityKg} كجم
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                            <span>{tr.fromBranchName}</span>
                            <span className="text-slate-400">←</span>
                            <span className="font-bold text-slate-700">{tr.toBranchName}</span>
                            {tr.notes && <span className="text-slate-400 font-normal">({tr.notes})</span>}
                          </div>
                        </div>
                        <div className="text-right text-[10px] text-slate-400 shrink-0">
                          <div>{tr.date}</div>
                          <div>{tr.time}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: ADD NEW BRANCH */}
          {activeTab === 'add' && (
            <div className="max-w-lg mx-auto">
              {isLimitReached ? (
                <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl text-center space-y-3">
                  <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center mx-auto">
                    <Shield size={24} />
                  </div>
                  <h3 className="text-sm font-black text-amber-900">
                    تم استهلاك رصيد الفروع المتاحة ({branches.length} من {allowedLimit})
                  </h3>
                  <p className="text-xs text-amber-700 leading-relaxed">
                    باقتك الحالية تدعم حتى <strong>{allowedLimit} فروع</strong>. لترقية اشتراكك وتفعيل فروع إضافية لمؤسستك تواصل مع إدارة المنصة فوراً.
                  </p>
                  <a
                    href={waUpgradeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold shadow-soft transition-colors"
                  >
                    <span>طلب ترقية الفروع عبر الواتساب</span>
                    <ExternalLink size={14} />
                  </a>
                </div>
              ) : (
                <form onSubmit={handleCreateBranch} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-3.5">
                  <h3 className="text-sm font-bold text-navy-850 flex items-center gap-2">
                    <Plus size={16} className="text-primary-500" />
                    <span>إضافة فرع جديد للمؤسسة</span>
                  </h3>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم الفرع *</label>
                    <input
                      type="text"
                      placeholder="مثال: فرع حي الياسمين - طريق الثمامة"
                      value={newBranchData.name}
                      onChange={e => setNewBranchData({ ...newBranchData, name: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">كود الفرع (اختياري)</label>
                      <input
                        type="text"
                        placeholder="مثال: BR-03"
                        value={newBranchData.code}
                        onChange={e => setNewBranchData({ ...newBranchData, code: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">هاتف الفرع</label>
                      <input
                        type="tel"
                        placeholder="05XXXXXXXX"
                        value={newBranchData.phone}
                        onChange={e => setNewBranchData({ ...newBranchData, phone: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">العنوان / الحي</label>
                    <input
                      type="text"
                      placeholder="مثال: حي الياسمين - بجوار مسجد النور"
                      value={newBranchData.address}
                      onChange={e => setNewBranchData({ ...newBranchData, address: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">اسم مدير الفرع</label>
                    <input
                      type="text"
                      placeholder="مثال: أبو خالد"
                      value={newBranchData.managerName}
                      onChange={e => setNewBranchData({ ...newBranchData, managerName: e.target.value })}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs text-slate-800"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-soft transition-colors"
                  >
                    <Plus size={16} />
                    <span>تأكيد وحفظ الفرع الجديد</span>
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
