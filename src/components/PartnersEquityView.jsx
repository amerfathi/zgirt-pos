import React, { useState } from 'react';
import { 
  Users, UserPlus, DollarSign, PieChart, Plus, Trash2, Edit2, 
  ArrowUpRight, Printer, CheckCircle2, History, AlertCircle, X, Check,
  Landmark, ArrowDownLeft, ShieldCheck, Scale, FileText, Coins
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';

export default function PartnersEquityView({ store, onOpenPartnerStatement }) {
  const { 
    partners, 
    partnerDrawings, 
    profitDistributions, 
    settings, 
    addPartner, 
    updatePartner, 
    deletePartner, 
    recordPartnerDrawing, 
    deletePartnerDrawing,
    recordProfitDistribution,
    deleteProfitDistribution,
    getFinancialPosition
  } = store;

  // Active Tab: 'partners' | 'drawings' | 'distributions'
  const [activeTab, setActiveTab] = useState('partners');

  // Modals state
  const [isAddPartnerOpen, setIsAddPartnerOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [partnerForm, setPartnerForm] = useState(/** @type {{name: string, phone: string, sharePercentage: string | number, initialCapital: string | number, notes: string}} */ ({
    name: '',
    phone: '',
    sharePercentage: 50,
    initialCapital: 0,
    notes: ''
  }));

  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [drawingForm, setDrawingForm] = useState({
    partnerId: '',
    amount: '',
    method: 'cash', // 'cash' | 'bank'
    notes: 'مسحوبات شخصية من الحساب'
  });

  const [isDistributeModalOpen, setIsDistributeModalOpen] = useState(false);
  const [distributeForm, setDistributeForm] = useState({
    totalAmount: '',
    periodLabel: `أرباح شهر ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`,
    deductDrawings: true,
    method: 'cash',
    notes: ''
  });

  const finPos = getFinancialPosition();

  // Summary Totals
  const totalSharesPercentage = partners.reduce((sum, p) => sum + (Number(p.sharePercentage) || 0), 0);
  const totalDrawingsAmount = partnerDrawings.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const totalDistributedAmount = profitDistributions.reduce((sum, dist) => sum + (Number(dist.totalDistributedAmount) || 0), 0);

  // Helper for partner specific calculations
  const getPartnerStats = (partnerId) => {
    const partner = partners.find(p => p.id === partnerId);
    const capital = Number(partner?.initialCapital) || 0;
    const drawings = partnerDrawings.filter(d => d.partnerId === partnerId);
    const totalDrawn = drawings.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

    let totalEarned = 0;
    profitDistributions.forEach(dist => {
      const share = (dist.shares || []).find(s => s.partnerId === partnerId);
      if (share) {
        totalEarned += (Number(share.calculatedShare) || 0);
      }
    });

    const netProfitBalance = totalEarned - totalDrawn;
    const totalEquity = capital + netProfitBalance;
    return { capital, totalDrawn, totalEarned, netProfitBalance, totalEquity, netBalance: totalEquity, drawingsCount: drawings.length };
  };

  // Handlers for Partner Create/Edit
  const handleSavePartner = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!partnerForm.name.trim()) {
      alert('يرجى كتابة اسم الشريك');
      return;
    }

    setIsSaving(true);
    try {
    if (editingPartner) {
      await updatePartner(editingPartner.id, {
        name: partnerForm.name.trim(),
        phone: partnerForm.phone.trim(),
        sharePercentage: Number(partnerForm.sharePercentage) || 0,
        initialCapital: Number(partnerForm.initialCapital) || 0,
        notes: partnerForm.notes.trim()
      });
      setEditingPartner(null);
    } else {
      await addPartner({
        name: partnerForm.name.trim(),
        phone: partnerForm.phone.trim(),
        sharePercentage: Number(partnerForm.sharePercentage) || 0,
        initialCapital: Number(partnerForm.initialCapital) || 0,
        notes: partnerForm.notes.trim()
      });
    }

    setPartnerForm({ name: '', phone: '', sharePercentage: 50, initialCapital: 0, notes: '' });
    setIsAddPartnerOpen(false);
    } catch (error) { alert('تعذر حفظ الشريك: ' + error.message); }
    finally { setIsSaving(false); }
  };

  const handleOpenEditPartner = (p) => {
    setEditingPartner(p);
    setPartnerForm({
      name: p.name,
      phone: p.phone || '',
      sharePercentage: p.sharePercentage,
      initialCapital: p.initialCapital || 0,
      notes: p.notes || ''
    });
    setIsAddPartnerOpen(true);
  };

  // Handler for Recording Drawing
  const handleSaveDrawing = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const partner = partners.find(p => p.id === drawingForm.partnerId);
    if (!partner) {
      alert('يرجى اختيار الشريك');
      return;
    }
    const amt = Number(drawingForm.amount);
    if (!amt || amt <= 0) {
      alert('يرجى إدخال مبلغ سحب صحيح');
      return;
    }

    setIsSaving(true);
    try { await recordPartnerDrawing({
      partnerId: partner.id,
      partnerName: partner.name,
      amount: amt,
      method: drawingForm.method,
      notes: drawingForm.notes.trim()
    });
      setDrawingForm({ partnerId: '', amount: '', method: 'cash', notes: 'مسحوبات شخصية من الحساب' });
      setIsDrawingModalOpen(false);
    } catch (error) { alert('تعذر حفظ مسحوبات الشريك: ' + error.message); }
    finally { setIsSaving(false); }
  };

  // Handler for Distributing Profits
  const handleConfirmDistribution = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    const totalDistAmt = Number(distributeForm.totalAmount);
    if (!totalDistAmt || totalDistAmt <= 0) {
      alert('يرجى إدخال مبلغ أرباح صحيح للتوزيع');
      return;
    }

    if (partners.length === 0) {
      alert('لا يوجد شركاء مسجلون في النظام');
      return;
    }

    // Build shares breakdown
    const shares = partners.map(p => {
      const sharePct = Number(p.sharePercentage) || 0;
      const calculatedShare = (totalDistAmt * sharePct) / 100;
      const stats = getPartnerStats(p.id);
      const prevDrawings = distributeForm.deductDrawings ? stats.totalDrawn : 0;
      const netPayout = Math.max(0, calculatedShare - prevDrawings);

      return {
        partnerId: p.id,
        partnerName: p.name,
        sharePercentage: sharePct,
        calculatedShare,
        previousDrawings: prevDrawings,
        netPayout,
        method: distributeForm.method
      };
    });

    setIsSaving(true);
    try { await recordProfitDistribution({
      totalDistributedAmount: totalDistAmt,
      periodLabel: distributeForm.periodLabel.trim(),
      shares,
      notes: distributeForm.notes.trim()
    });

    setDistributeForm({
      totalAmount: '',
      periodLabel: `أرباح شهر ${new Date().toLocaleDateString('ar-EG', { month: 'long', year: 'numeric' })}`,
      deductDrawings: true,
      method: 'cash',
      notes: ''
    });
    setIsDistributeModalOpen(false);
    } catch (error) { alert('تعذر حفظ توزيع الأرباح: ' + error.message); }
    finally { setIsSaving(false); }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-5">
      
      {/* =========================================================================
          TOP BANNER: Header, Summary Stats & Primary Action Buttons
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-black shadow-md shadow-teal-600/20 text-xl">
              🤝
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  الشركاء والمسحوبات وتوزيع الأرباح
                </h1>
                <span className="text-[10px] text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200 font-bold">
                  حقوق الملكية وجاري الشركاء
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                إدارة نسب الشراكة، قيد المسحوبات النقدية والبنكية، واعتماد توزيعات الأرباح العادلة
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (partners.length === 0) {
                  alert('يرجى إضافة شركاء أولاً');
                  return;
                }
                setDrawingForm({
                  partnerId: partners[0].id,
                  amount: '',
                  method: 'cash',
                  notes: 'مسحوبات شخصية من الحساب'
                });
                setIsDrawingModalOpen(true);
              }}
              className="py-2 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <ArrowUpRight size={14} className="text-slate-500" />
              <span>تسجيل مسحوبات</span>
            </button>

            <button
              type="button"
              onClick={() => setIsDistributeModalOpen(true)}
              className="py-2 px-3.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <PieChart size={14} className="text-slate-500" />
              <span>اعتماد توزيع أرباح</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setEditingPartner(null);
                setPartnerForm({ name: '', phone: '', sharePercentage: 50, initialCapital: 0, notes: '' });
                setIsAddPartnerOpen(true);
              }}
              className="py-2 px-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <UserPlus size={14} />
              <span>+ إضافة شريك</span>
            </button>
          </div>
        </div>

        {/* 4 Quick Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 min-w-0 overflow-hidden">
            <span className="text-[11px] text-slate-500 font-bold block truncate">عدد الشركاء:</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-lg sm:text-xl font-black font-mono text-slate-900">{partners.length}</span>
              <span className="text-xs text-slate-400">شركاء</span>
            </div>
            <span className={`text-[10px] font-bold block mt-0.5 truncate ${Math.round(totalSharesPercentage) === 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
              حصص: {totalSharesPercentage}% {Math.round(totalSharesPercentage) === 100 ? '✓' : '(غير مكتمل)'}
            </span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 min-w-0 overflow-hidden">
            <span className="text-[11px] text-slate-500 font-bold block truncate">إجمالي المسحوبات:</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-xl font-black font-mono text-purple-700 truncate">
                {formatCurrency(totalDrawingsAmount, settings.currency)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{partnerDrawings.length} حركة سحب</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 min-w-0 overflow-hidden">
            <span className="text-[11px] text-slate-500 font-bold block truncate">الأرباح الموزعة:</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-xl font-black font-mono text-emerald-700 truncate">
                {formatCurrency(totalDistributedAmount, settings.currency)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">{profitDistributions.length} جلسة توزيع</span>
          </div>

          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 min-w-0 overflow-hidden">
            <span className="text-[11px] text-slate-500 font-bold block truncate">نقدية الخزنة:</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-sm sm:text-xl font-black font-mono text-blue-700 truncate">
                {formatCurrency(finPos.cashBalance, settings.currency)}
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate">الرصيد الفعلي بالدرج</span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {[
            { id: 'partners', label: `قائمة الشركاء (${partners.length})` },
            { id: 'drawings', label: `سجل المسحوبات (${partnerDrawings.length})` },
            { id: 'distributions', label: `جلسات توزيع الأرباح (${profitDistributions.length})` }
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* =========================================================================
          TAB 1: PARTNERS LIST & CARDS
         ========================================================================= */}
      {activeTab === 'partners' && (
        <div className="space-y-4">
          {partners.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mx-auto text-2xl">
                🤝
              </div>
              <h3 className="text-base font-black text-slate-900">لم يتم تسجيل أي شركاء بعد</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                أضف الشركاء وحدد نسبة كل شريك في رأس المال والأرباح ليقوم النظام بتنظيم الحسابات وتوزيع الأرباح تلقائياً
              </p>
              <button
                type="button"
                onClick={() => setIsAddPartnerOpen(true)}
                className="py-2.5 px-4 bg-teal-600 hover:bg-teal-700 text-white text-xs font-black rounded-xl inline-flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                <UserPlus size={15} />
                <span>+ تسجيل أول شريك</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {partners.map(partner => {
                const stats = getPartnerStats(partner.id);
                return (
                  <div 
                    key={partner.id}
                    className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 hover:border-teal-500/50 transition-all flex flex-col justify-between space-y-4"
                  >
                    <div>
                      {/* Top Header of Partner Card */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200/60 text-teal-800 flex items-center justify-center font-black text-base">
                            👤
                          </div>
                          <div>
                            <h3 className="text-sm font-black text-slate-900 leading-tight">
                              {partner.name}
                            </h3>
                            {partner.phone && (
                              <span className="text-[11px] text-slate-400 font-mono block">
                                {partner.phone}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Share Badge */}
                        <span className="bg-teal-50 text-teal-800 border border-teal-200 text-xs font-black px-2.5 py-1 rounded-xl font-mono">
                          {partner.sharePercentage}%
                        </span>
                      </div>

                      {/* Financial Numbers for this Partner */}
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs">
                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] text-slate-400 font-bold block">رأس المال:</span>
                          <span className="text-xs font-black font-mono text-slate-800 block mt-0.5">
                            {formatCurrency(stats.capital, settings.currency)}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] text-slate-400 font-bold block">المسحوبات:</span>
                          <span className="text-xs font-black font-mono text-purple-700 block mt-0.5">
                            {formatCurrency(stats.totalDrawn, settings.currency)}
                          </span>
                        </div>

                        <div className="bg-slate-50 p-2 rounded-xl border border-slate-200/60">
                          <span className="text-[10px] text-slate-400 font-bold block">الأرباح المعتمدة:</span>
                          <span className="text-xs font-black font-mono text-emerald-700 block mt-0.5">
                            {formatCurrency(stats.totalEarned, settings.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Net Partner Total Equity */}
                      <div className="mt-2.5 p-2.5 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                        <div>
                          <span className="text-[11px] text-slate-300 font-bold block">صافي حقوق الملكية للشريك:</span>
                          <span className="text-[9px] text-slate-400 font-medium">رأس المال + الأرباح - المسحوبات</span>
                        </div>
                        <span className={`text-sm font-black font-mono ${stats.totalEquity >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {formatCurrency(stats.totalEquity, settings.currency)}
                        </span>
                      </div>

                      {partner.notes && (
                        <p className="text-[11px] text-slate-500 mt-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                          {partner.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions on this Partner */}
                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setDrawingForm({
                              partnerId: partner.id,
                              amount: '',
                              method: 'cash',
                              notes: `مسحوبات شخصية - ${partner.name}`
                            });
                            setIsDrawingModalOpen(true);
                          }}
                          className="py-1.5 px-2.5 bg-purple-50 hover:bg-purple-100 text-purple-800 text-[11px] font-black rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowUpRight size={13} />
                          <span>سحب</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenPartnerStatement) {
                              onOpenPartnerStatement(partner.id);
                            }
                          }}
                          className="py-1.5 px-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <FileText size={13} />
                          <span>كشف A4</span>
                        </button>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEditPartner(partner)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="تعديل الشريك"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف الشريك (${partner.name})؟ سيتم حذف مسحوباته أيضاً.`)) {
                              try { await deletePartner(partner.id); }
                              catch (error) { alert('تعذر حذف الشريك: ' + error.message); }
                            }
                          }}
                          className="p-1.5 text-rose-400 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="حذف الشريك"
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
        </div>
      )}

      {/* =========================================================================
          TAB 2: DRAWINGS LOG (سجل المسحوبات)
         ========================================================================= */}
      {activeTab === 'drawings' && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">سجل مسحوبات الشركاء المقيدة</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                جميع المبالغ المسحوبة شخصياً من الخزنة كاش أو عبر التحويل البنكي
              </p>
            </div>
            <span className="text-xs font-black font-mono bg-purple-50 text-purple-800 px-2.5 py-1 rounded-lg border border-purple-200">
              إجمالي: {formatCurrency(totalDrawingsAmount, settings.currency)}
            </span>
          </div>

          {partnerDrawings.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لا توجد مسحوبات مقيدة للشركاء حتى الآن.
            </div>
          ) : (
            <div className="overflow-x-auto w-full rounded-xl border border-slate-200">
              <table className="w-full min-w-[550px] text-right text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200/80">
                    <th className="py-2.5 px-3 font-black">التاريخ والوقت</th>
                    <th className="py-2.5 px-3 font-black">الشريك</th>
                    <th className="py-2.5 px-3 font-black">المبلغ</th>
                    <th className="py-2.5 px-3 font-black">طريقة السحب</th>
                    <th className="py-2.5 px-3 font-black">البيان والملاحظات</th>
                    <th className="py-2.5 px-3 font-black text-center">إلغاء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {partnerDrawings.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-slate-500">{d.date} {d.time}</td>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{d.partnerName}</td>
                      <td className="py-2.5 px-3 font-mono font-black text-purple-700">
                        {formatCurrency(d.amount, settings.currency)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          d.method === 'bank' 
                            ? 'bg-blue-50 text-blue-700 border-blue-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {d.method === 'bank' ? '🏦 تحويل بنكي' : '💵 كاش من الدرج'}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{d.notes || '—'}</td>
                      <td className="py-2.5 px-3 text-center">
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm(`هل أنت متأكد من حذف حركة سحب بمبلغ ${d.amount} للشريك ${d.partnerName}؟`)) {
                              try { await deletePartnerDrawing(d.id); }
                              catch (error) { alert('تعذر حذف مسحوبات الشريك: ' + error.message); }
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="حذف القيد"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: PROFIT DISTRIBUTIONS LOG (جلسات توزيع الأرباح)
         ========================================================================= */}
      {activeTab === 'distributions' && (
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-black text-slate-900">سجل جلسات توزيع الأرباح المعتمدة</h3>
              <p className="text-[11px] text-slate-500 font-medium">
                توزيعات الأرباح على الشركاء مع بيان حصة كل شريك ومسحوباته وصافي المسلم له
              </p>
            </div>
            <span className="text-xs font-black font-mono bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-200">
              إجمالي الأرباح الموزعة: {formatCurrency(totalDistributedAmount, settings.currency)}
            </span>
          </div>

          {profitDistributions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              لم يتم تسجيل أي جلسة توزيع أرباح حتى الآن. اضغط "اعتماد توزيع أرباح" في الأعلى لإجراء توزيع جديد.
            </div>
          ) : (
            <div className="space-y-4">
              {profitDistributions.map(dist => (
                <div key={dist.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                    <div>
                      <span className="text-xs font-black text-slate-900 block">{dist.periodLabel}</span>
                      <span className="text-[10px] text-slate-400 font-mono">تاريخ الاعتماد: {dist.date} {dist.time}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <span className="text-[10px] text-slate-400 font-bold block">إجمالي المبلغ الموزع:</span>
                        <span className="text-sm font-black font-mono text-emerald-700">
                          {formatCurrency(dist.totalDistributedAmount, settings.currency)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          if (confirm('هل أنت متأكد من حذف جلسة توزيع الأرباح هذه؟')) {
                            try { await deleteProfitDistribution(dist.id); }
                            catch (error) { alert('تعذر حذف توزيع الأرباح: ' + error.message); }
                          }
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg transition-colors cursor-pointer"
                        title="حذف جلسة التوزيع"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Shares Table */}
                  <div className="overflow-x-auto w-full rounded-xl border border-slate-200">
                    <table className="w-full min-w-[500px] text-right text-[11px]">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200 bg-slate-100/50">
                          <th className="py-1.5 px-2 font-black">الشريك</th>
                          <th className="py-1.5 px-2 font-black">النسبة</th>
                          <th className="py-1.5 px-2 font-black">النصيب المحسوب</th>
                          <th className="py-1.5 px-2 font-black">المسحوبات المخصومة</th>
                          <th className="py-1.5 px-2 font-black">الصافي المنصرف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200/60 font-mono">
                        {(dist.shares || []).map(s => (
                          <tr key={s.partnerId}>
                            <td className="py-1.5 px-2 font-sans font-bold text-slate-800">{s.partnerName}</td>
                            <td className="py-1.5 px-2">{s.sharePercentage}%</td>
                            <td className="py-1.5 px-2 font-black text-slate-900">{formatCurrency(s.calculatedShare, settings.currency)}</td>
                            <td className="py-1.5 px-2 text-purple-700">-{formatCurrency(s.previousDrawings, settings.currency)}</td>
                            <td className="py-1.5 px-2 font-black text-emerald-700">{formatCurrency(s.netPayout, settings.currency)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          MODAL 1: ADD / EDIT PARTNER MODAL
         ========================================================================= */}
      <AnimatePresence>
        {isAddPartnerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900">
                  {editingPartner ? 'تعديل بيانات الشريك' : 'إضافة شريك جديد في النظام'}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddPartnerOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSavePartner} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اسم الشريك: *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: عبد الله أحمد"
                    value={partnerForm.name}
                    onChange={(e) => setPartnerForm({ ...partnerForm, name: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">نسبة الشراكة / الأرباح (%): *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      min="0"
                      max="100"
                      placeholder="50"
                      value={partnerForm.sharePercentage}
                      onChange={(e) => setPartnerForm({ ...partnerForm, sharePercentage: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="font-bold text-slate-700 block mb-1">رقم الهاتف:</label>
                    <input
                      type="tel"
                      placeholder="05xxxxxxx"
                      value={partnerForm.phone}
                      onChange={(e) => setPartnerForm({ ...partnerForm, phone: e.target.value })}
                      className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">رأس المال المودع مبدئياً (اختياري):</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={partnerForm.initialCapital}
                    onChange={(e) => setPartnerForm({ ...partnerForm, initialCapital: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ملاحظات إضافية:</label>
                  <textarea
                    rows={2}
                    placeholder="ملاحظات حول الشريك أو عقد الاتفاق..."
                    value={partnerForm.notes}
                    onChange={(e) => setPartnerForm({ ...partnerForm, notes: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsAddPartnerOpen(false)}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="py-2 px-5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-black transition-colors shadow-md cursor-pointer"
                  >
                    {editingPartner ? 'حفظ التعديلات' : 'إضافة الشريك'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 2: RECORD PARTNER DRAWING (تسجيل مسحوبات شريك)
         ========================================================================= */}
      <AnimatePresence>
        {isDrawingModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-md w-full border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💸</span>
                  <h3 className="text-sm font-black text-slate-900">
                    تسجيل مسحوبات شريك (سحب شخصي)
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDrawingModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveDrawing} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">اختر الشريك: *</label>
                  <select
                    required
                    value={drawingForm.partnerId}
                    onChange={(e) => setDrawingForm({ ...drawingForm, partnerId: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {partners.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} (نسبة {p.sharePercentage}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">المبلغ المسحوب: *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="0.01"
                      placeholder="0.00"
                      value={drawingForm.amount}
                      onChange={(e) => setDrawingForm({ ...drawingForm, amount: e.target.value })}
                      className="w-full py-2.5 px-3 bg-white border-2 border-purple-400 rounded-xl font-mono text-base font-black text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">
                      {settings.currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">طريقة السحب والخصم: *</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDrawingForm({ ...drawingForm, method: 'cash' })}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        drawingForm.method === 'cash'
                          ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <Coins size={14} />
                      <span>نقداً من الدرج</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDrawingForm({ ...drawingForm, method: 'bank' })}
                      className={`py-2 px-3 rounded-lg border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                        drawingForm.method === 'bank'
                          ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200/80 hover:bg-slate-50'
                      }`}
                    >
                      <Landmark size={14} />
                      <span>تحويل من البنك</span>
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {drawingForm.method === 'cash'
                      ? 'سيتم خصم المبلغ تلقائياً من نقدية درج المحل وجرد الصندوق.'
                      : 'سيتم خصم المبلغ من رصيد الحساب البنكي.'}
                  </p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">بيان السحب والملاحظات:</label>
                  <input
                    type="text"
                    placeholder="مثال: سحب مصاريف شخصية، دفعة على الحساب..."
                    value={drawingForm.notes}
                    onChange={(e) => setDrawingForm({ ...drawingForm, notes: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDrawingModalOpen(false)}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-black transition-colors shadow-md cursor-pointer"
                  >
                    تأكيد السحب والخصم
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================================
          MODAL 3: DISTRIBUTE PROFITS (اعتماد جلسة توزيع أرباح)
         ========================================================================= */}
      <AnimatePresence>
        {isDistributeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-lg w-full border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <h3 className="text-sm font-black text-slate-900">
                    اعتماد جلسة توزيع أرباح على الشركاء
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDistributeModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 rounded-lg cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleConfirmDistribution} className="space-y-3.5 text-xs">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">المبلغ الإجمالي المراد توزيعه: *</label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      required
                      min="1"
                      placeholder="مثال: 10000"
                      value={distributeForm.totalAmount}
                      onChange={(e) => setDistributeForm({ ...distributeForm, totalAmount: e.target.value })}
                      className="w-full py-2.5 px-3 bg-white border-2 border-emerald-500 rounded-xl font-mono text-lg font-black text-center focus:outline-none focus:ring-2 focus:ring-emerald-400"
                    />
                    <span className="absolute left-3 top-3 text-xs text-slate-400 font-bold">
                      {settings.currency}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">بيان الفترة / المناسبة:</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: أرباح الربع الأول، أرباح شهر أغسطس..."
                    value={distributeForm.periodLabel}
                    onChange={(e) => setDistributeForm({ ...distributeForm, periodLabel: e.target.value })}
                    className="w-full py-2 px-3 bg-slate-50 border border-slate-300 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                </div>

                {/* Live Distribution Preview */}
                {Number(distributeForm.totalAmount) > 0 && partners.length > 0 && (
                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 space-y-2">
                    <span className="text-[11px] font-black text-slate-900 block">
                      معاينة التوزيع التلقائي حسب نسب الشركاء:
                    </span>
                    <div className="space-y-1.5 font-mono text-xs">
                      {partners.map(p => {
                        const amt = Number(distributeForm.totalAmount) || 0;
                        const share = (amt * (Number(p.sharePercentage) || 0)) / 100;
                        const stats = getPartnerStats(p.id);
                        const net = Math.max(0, share - stats.totalDrawn);

                        return (
                          <div key={p.id} className="bg-white p-2 rounded-xl border border-slate-200 flex items-center justify-between">
                            <span className="font-sans font-bold text-slate-800">{p.name} ({p.sharePercentage}%):</span>
                            <div className="text-left">
                              <span className="font-black text-emerald-700">{formatCurrency(share, settings.currency)}</span>
                              {stats.totalDrawn > 0 && (
                                <span className="text-[10px] text-purple-700 block">
                                  خصم مسحوبات سابقة: -{formatCurrency(stats.totalDrawn, settings.currency)} ➔ صافي: {formatCurrency(net, settings.currency)}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="pt-3 flex items-center justify-end gap-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsDistributeModalOpen(false)}
                    className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="py-2.5 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black transition-colors shadow-md cursor-pointer"
                  >
                    اعتماد التوزيع وترحيل الأرصدة
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
