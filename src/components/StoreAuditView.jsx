import React, { useState } from 'react';
import { 
  Scale, DollarSign, Landmark, Users, Truck, AlertTriangle, 
  CheckCircle2, Printer, Calendar, ArrowDownLeft, ArrowUpRight, 
  TrendingUp, TrendingDown, RefreshCw, HelpCircle, ShieldCheck,
  FileCheck2, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getCurrentDateFormatted, getDateFormattedOffset } from '../utils/formatters';

export default function StoreAuditView({ store, onOpenA4Report }) {
  const { 
    invoices, 
    customers, 
    suppliers, 
    expenses, 
    purchases, 
    workers, 
    workerTransactions, 
    customerPayments, 
    supplierPayments, 
    partnerDrawings, 
    profitDistributions,
    settings,
    getFinancialPosition,
    salesReturns = [],
    purchaseReturns = []
  } = store;

  // Audit Period Filter: 'today' | 'yesterday' | 'week' | 'month' | 'all' | 'custom'
  const [auditPeriod, setAuditPeriod] = useState('today');
  const [customStartDate, setCustomStartDate] = useState(getCurrentDateFormatted());
  const [customEndDate, setCustomEndDate] = useState(getCurrentDateFormatted());

  // Cash Drawer Physical Count Reconciliation State
  const [actualDrawerCount, setActualDrawerCount] = useState('');
  const [showReconciliationHelper, setShowReconciliationHelper] = useState(false);

  const todayStr = getCurrentDateFormatted();

  // Helper date filtering for period transactions
  const isDateInPeriod = (dateStr) => {
    if (!dateStr) return false;
    if (auditPeriod === 'all') return true;
    if (auditPeriod === 'today') return dateStr === todayStr;

    const now = new Date();
    if (auditPeriod === 'yesterday') return dateStr === getDateFormattedOffset(-1);
    if (auditPeriod === 'week') {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return new Date(dateStr) >= weekAgo;
    }
    if (auditPeriod === 'month') {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return new Date(dateStr) >= monthAgo;
    }
    if (auditPeriod === 'custom') {
      return dateStr >= customStartDate && dateStr <= customEndDate;
    }
    return true;
  };

  // Get All-Time Real-Time Financial Position ("أين الفلوس الآن؟")
  const finPos = getFinancialPosition();

  // --------------------------------------------------------------------------
  // Audit Breakdown For The SELECTED PERIOD
  // --------------------------------------------------------------------------
  const periodInvoices = invoices.filter(i => i.status !== 'voided' && isDateInPeriod(i.date));
  const periodCustomerPayments = customerPayments.filter(p => isDateInPeriod(p.date));
  const periodExpenses = expenses.filter(e => isDateInPeriod(e.date));
  const periodPurchases = (purchases || []).filter(p => isDateInPeriod(p.date));
  const periodSupplierPayments = (supplierPayments || []).filter(sp => isDateInPeriod(sp.date));
  const periodWorkerTxs = (workerTransactions || []).filter(t => isDateInPeriod(t.date));
  const periodDrawings = (partnerDrawings || []).filter(d => isDateInPeriod(d.date));
  const periodSalesReturns = (salesReturns || []).filter(r => isDateInPeriod(r.date));
  const periodPurchaseReturns = (purchaseReturns || []).filter(r => isDateInPeriod(r.date));

  // Period Inflows
  const periodSalesTotal = periodInvoices.reduce((sum, inv) => sum + (Number(inv.finalTotal) || 0), 0);
  const periodSalesCash = periodInvoices.reduce((sum, inv) => {
    if (inv.saleType === 'split') return sum + (Number(inv.cashAmount) || 0);
    if (inv.saleType === 'cash') return sum + (Number(inv.paidAmount) || 0);
    return sum;
  }, 0);
  const periodSalesBank = periodInvoices.reduce((sum, inv) => {
    if (inv.saleType === 'split') return sum + (Number(inv.bankAmount) || 0);
    if (inv.saleType === 'bank') return sum + (Number(inv.paidAmount) || 0);
    return sum;
  }, 0);
  const periodSalesCredit = periodInvoices.reduce((sum, inv) => sum + (Number(inv.remainingDebt) || 0), 0);

  const periodDebtCollectedCash = periodCustomerPayments
    .filter(p => !p.method || p.method === 'cash')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const periodDebtCollectedBank = periodCustomerPayments
    .filter(p => p.method === 'bank')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

  // Purchase returns refunds received
  const periodPurchaseReturnsCash = periodPurchaseReturns
    .filter(r => r.refundMethod === 'cash')
    .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
  const periodPurchaseReturnsBank = periodPurchaseReturns
    .filter(r => r.refundMethod === 'bank')
    .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

  // Period Outflows (Excluding supplier payments and worker payments from general expenses to prevent double counting)
  const periodExpensesCash = periodExpenses
    .filter(e => e.paymentMethod !== 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const periodExpensesBank = periodExpenses
    .filter(e => e.paymentMethod === 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  const periodPurchasesCash = periodPurchases.reduce((sum, p) => {
    if (p.paidCashAmount !== undefined) return sum + (Number(p.paidCashAmount) || 0);
    if (p.paymentMethod === 'cash') return sum + Math.max(0, (Number(p.totalCost) || 0) - (Number(p.creditAmount) || 0));
    if (p.paymentType === 'cash') return sum + (Number(p.paidAmount) || 0);
    return sum;
  }, 0);

  const periodPurchasesBank = periodPurchases.reduce((sum, p) => {
    if (p.paidBankAmount !== undefined) return sum + (Number(p.paidBankAmount) || 0);
    if (p.paymentMethod === 'bank') return sum + Math.max(0, (Number(p.totalCost) || 0) - (Number(p.creditAmount) || 0));
    if (p.paymentType === 'bank') return sum + (Number(p.paidAmount) || 0);
    return sum;
  }, 0);

  const periodPurchasesCredit = periodPurchases.reduce((sum, p) => sum + (Number(p.creditAmount) || 0), 0);

  const periodSupplierPaymentsCash = periodSupplierPayments
    .filter(sp => sp.paymentMethod !== 'bank')
    .reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);
  const periodSupplierPaymentsBank = periodSupplierPayments
    .filter(sp => sp.paymentMethod === 'bank')
    .reduce((sum, sp) => sum + (Number(sp.amount) || 0), 0);

  const periodWorkerAdvancesCash = periodWorkerTxs
    .filter(t => t.type === 'advance' && t.paymentMethod !== 'bank')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const periodWorkerAdvancesBank = periodWorkerTxs
    .filter(t => t.type === 'advance' && t.paymentMethod === 'bank')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const periodWorkerSalariesCash = periodWorkerTxs
    .filter(t => t.type === 'salary_payment' && t.paymentMethod !== 'bank')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const periodWorkerSalariesBank = periodWorkerTxs
    .filter(t => t.type === 'salary_payment' && t.paymentMethod === 'bank')
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const periodDrawingsCash = periodDrawings
    .filter(d => d.method !== 'bank')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const periodDrawingsBank = periodDrawings
    .filter(d => d.method === 'bank')
    .reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

  // Sales returns refunds paid out
  const periodSalesReturnsCash = periodSalesReturns
    .filter(r => r.refundMethod === 'cash')
    .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
  const periodSalesReturnsBank = periodSalesReturns
    .filter(r => r.refundMethod === 'bank')
    .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

  // Period Net Cash Flow (صافي حركة الكاش في الفترة)
  const totalPeriodCashIn = periodSalesCash + periodDebtCollectedCash + periodPurchaseReturnsCash;
  const totalPeriodCashOut = periodExpensesCash + periodPurchasesCash + periodSupplierPaymentsCash + periodWorkerAdvancesCash + periodWorkerSalariesCash + periodDrawingsCash + periodSalesReturnsCash;
  const netPeriodCashMovement = totalPeriodCashIn - totalPeriodCashOut;

  // Expected Cash in Drawer right now (based on All-Time or Period)
  const expectedDrawerCash = finPos.cashBalance;

  // Reconciliation Difference
  const countNumber = actualDrawerCount !== '' ? Number(actualDrawerCount) : null;
  const difference = countNumber !== null ? countNumber - expectedDrawerCash : null;

  const handlePrintAuditReport = () => {
    if (onOpenA4Report) {
      onOpenA4Report('audit');
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-5">
      
      {/* =========================================================================
          TOP BANNER: Header, Period Filter, and Official A4 Print Button
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-sm border border-slate-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-black shadow-md shadow-emerald-600/20">
              <Scale size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  الجرد الشامل والمركز المالي
                </h1>
                <span className="text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                  فحص السيولة الفوري
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">
                حصر دقيق لأماكن وجود الأموال (خزنة، بنك، آجل عملاء، آجل موردين) ومطابقة الصندوق
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handlePrintAuditReport}
            className="py-2 px-3.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-2xs active:scale-95 cursor-pointer"
          >
            <Printer size={15} />
            <span>طباعة محضر جرد رسمي A4</span>
          </button>
        </div>

        {/* Period Selector Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-1 bg-white p-1 rounded-lg border border-slate-200/80 shadow-2xs">
            {[
              { id: 'today', label: 'جرد اليوم' },
              { id: 'yesterday', label: 'جرد أمس' },
              { id: 'week', label: 'هذا الأسبوع' },
              { id: 'month', label: 'هذا الشهر' },
              { id: 'all', label: 'شامل حتى اللحظة' },
              { id: 'custom', label: 'تاريخ مخصص' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAuditPeriod(tab.id)}
                className={`py-1.5 px-3 rounded-md text-xs font-semibold transition-all cursor-pointer select-none ${
                  auditPeriod === tab.id
                    ? 'bg-primary-50 text-primary-700 border border-primary-200 font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Custom Date Pickers if 'custom' is selected */}
          {auditPeriod === 'custom' && (
            <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-lg border border-slate-200 text-xs">
              <span className="font-semibold text-slate-600">من:</span>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs"
              />
              <span className="font-semibold text-slate-600">إلى:</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 font-mono text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          SECTION 1: THE CORE QUESTION ANSWERED: "أين الفلوس موجودة الآن؟"
         ========================================================================= */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <h2 className="text-sm font-bold text-navy-850">
              أين الفلوس موجودة الآن؟ (المركز المالي للسيولة والذمم)
            </h2>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            حسابات تراكمية فورية حتى اللحظة
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* 1. الخزنة / الدرج */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200/80 flex items-center justify-center font-bold">
                    <DollarSign size={16} />
                  </div>
                  <span className="text-xs font-bold text-navy-850">نقدية الخزنة / الدرج</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                  كاش حالي
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold font-mono text-navy-850">
                  {finPos.cashBalance.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{settings.currency}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 leading-tight">
              صافي المبالغ النقدية الموجودة في درج المحل بعد خصم كافة المصروفات وسدادات الكاش
            </p>
          </div>

          {/* 2. الحساب البنكي / الشبكة */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
                    <Landmark size={16} />
                  </div>
                  <span className="text-xs font-bold text-navy-850">الحسابات البنكية والشبكة</span>
                </div>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200 font-semibold">
                  إلكتروني
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold font-mono text-navy-850">
                  {finPos.bankBalance.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{settings.currency}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 leading-tight">
              مبيعات البطاقات، أجهزة مدى/الشبكة، والتحويلات البنكية المستلمة بحساب المحل
            </p>
          </div>

          {/* 3. ديون لنا عند العملاء (آجل) */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center font-bold">
                    <Users size={16} />
                  </div>
                  <span className="text-xs font-bold text-navy-850">ديون لنا بالسوق (آجل العملاء)</span>
                </div>
                <span className="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded border border-amber-200 font-semibold">
                  دين لنا
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold font-mono text-amber-800">
                  {finPos.totalCustomersDebt.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{settings.currency}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 leading-tight">
              إجمالي المبالغ المؤجلة في ذمة الزبائن والعملاء والمطاعم بانتظار تحصيلها
            </p>
          </div>

          {/* 4. ديون علينا للموردين (آجل التوريد) */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-700 border border-rose-200/80 flex items-center justify-center font-bold">
                    <Truck size={16} />
                  </div>
                  <span className="text-xs font-bold text-navy-850">ديون علينا للتوريد (آجل الموردين)</span>
                </div>
                <span className="text-[10px] bg-rose-50 text-rose-800 px-2 py-0.5 rounded border border-rose-200 font-semibold">
                  دين علينا
                </span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-bold font-mono text-rose-700">
                  {finPos.totalSuppliersDebt.toFixed(2)}
                </span>
                <span className="text-xs text-slate-500 font-medium">{settings.currency}</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-2.5 pt-2.5 border-t border-slate-100 leading-tight">
              إجمالي الالتزامات المستحقة للموردين عن شحنات البضاعة الواردة
            </p>
          </div>

        </div>

        {/* Financial Summary Strip */}
        <div className="mt-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">إجمالي السيولة الحاضرة:</span>
            <span className="text-sm sm:text-base font-bold text-emerald-700 font-mono">
              {formatCurrency(finPos.totalLiquidCash, settings.currency)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">صافي مركز السوق (لنا - علينا):</span>
            <span className={`text-sm sm:text-base font-bold font-mono ${finPos.netMarketPosition >= 0 ? 'text-primary-700' : 'text-rose-700'}`}>
              {formatCurrency(finPos.netMarketPosition, settings.currency)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">دفعات مقدمة لموردين:</span>
            <span className="text-sm sm:text-base font-bold text-slate-700 font-mono">
              {formatCurrency(finPos.totalSupplierAdvances, settings.currency)}
            </span>
          </div>
          <div>
            <span className="text-[11px] text-slate-500 font-semibold block">صافي رأس المال العامل:</span>
            <span className="text-sm sm:text-base font-bold text-navy-850 font-mono">
              {formatCurrency(finPos.totalWorkingCapital, settings.currency)}
            </span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          SECTION 2: CASH DRAWER RECONCILIATION TOOL (أداة مطابقة الصندوق)
         ========================================================================= */}
      <div className="bg-white rounded-xl p-5 shadow-2xs border border-slate-200/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center font-bold">
              <Scale size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-navy-850">
                أداة مطابقة نقدية الدرج الفعلي (فحص العجز والزيادة في الصندوق)
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                عدّ النقدية الموجودة في درج الكاشير واكتبها هنا ليقارنها النظام بالرصيد الدفتري فوراً
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowReconciliationHelper(!showReconciliationHelper)}
            className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle size={14} />
            <span>{showReconciliationHelper ? 'إخفاء الشرح' : 'كيف تعمل المطابقة؟'}</span>
          </button>
        </div>

        {showReconciliationHelper && (
          <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 text-xs text-slate-600 leading-relaxed">
            💡 <strong>طريقة المطابقة البسيطة:</strong> النظام يقوم بحساب: (كل الكاش المقبوض من المبيعات والديون) ناقص (كل الكاش المنصرف للمشتريات والمصاريف والسلفيات والمسحوبات). 
            المبلغ الناتج هو ما يجب أن تجده في الدرج. عند كتابة ما وجدته فعلياً، سيخبرك النظام فوراً إن كان الحساب مطابقاً بنسبة 100% أو إذا كان هناك عجز أو زيادة.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center pt-1">
          
          {/* Expected in Drawer */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-center">
            <span className="text-xs text-slate-500 font-bold block mb-1">
              الرصيد الدفتري المتوقع في الدرج:
            </span>
            <div className="flex items-baseline justify-center gap-1">
              <span className="text-2xl font-black font-mono text-slate-900">
                {expectedDrawerCash.toFixed(2)}
              </span>
              <span className="text-xs text-slate-500 font-bold">{settings.currency}</span>
            </div>
            <span className="text-[10px] text-slate-400 block mt-1">المحسوب آلياً حسب العمليات</span>
          </div>

          {/* User Input: Actual Count */}
          <div className="bg-emerald-50/60 p-4 rounded-2xl border border-emerald-200/80 text-center">
            <label className="text-xs text-emerald-900 font-black block mb-1.5">
              اكتب المبلغ المعدود في الدرج فعلياً:
            </label>
            <div className="relative max-w-[200px] mx-auto">
              <input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={actualDrawerCount}
                onChange={(e) => setActualDrawerCount(e.target.value)}
                className="w-full text-center text-xl font-black font-mono py-2 px-3 bg-white border-2 border-emerald-500 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                {settings.currency}
              </span>
            </div>
            <span className="text-[10px] text-emerald-700 block mt-1">ادخل الكاش الموجود باليد</span>
          </div>

          {/* Comparison Result */}
          <div className="p-4 rounded-2xl border flex flex-col items-center justify-center text-center">
            {difference === null ? (
              <div className="text-slate-400 space-y-1">
                <Scale size={28} className="mx-auto text-slate-300" />
                <span className="text-xs font-bold block">في انتظار كتابة المبلغ المعدود</span>
              </div>
            ) : Math.abs(difference) < 0.01 ? (
              <div className="text-emerald-700 space-y-1 bg-emerald-50 w-full h-full p-2 rounded-xl flex flex-col items-center justify-center">
                <CheckCircle2 size={32} className="text-emerald-600" />
                <span className="text-sm font-black block">الصندوق مطابق 100%!</span>
                <span className="text-[11px] text-emerald-800 font-bold">لا يوجد أي عجز أو زيادة بالدرج</span>
              </div>
            ) : difference < 0 ? (
              <div className="text-rose-700 space-y-1 bg-rose-50 w-full h-full p-2 rounded-xl flex flex-col items-center justify-center">
                <AlertTriangle size={32} className="text-rose-600" />
                <span className="text-sm font-black block">يوجد عجز في الدرج:</span>
                <span className="text-lg font-black font-mono text-rose-700">
                  {Math.abs(difference).toFixed(2)} {settings.currency}
                </span>
                <span className="text-[10px] text-rose-600 font-bold">الكاش الفعلي أقل من المفروض</span>
              </div>
            ) : (
              <div className="text-blue-700 space-y-1 bg-blue-50 w-full h-full p-2 rounded-xl flex flex-col items-center justify-center">
                <CheckCircle2 size={32} className="text-blue-600" />
                <span className="text-sm font-black block">يوجد فائض في الدرج:</span>
                <span className="text-lg font-black font-mono text-blue-700">
                  +{difference.toFixed(2)} {settings.currency}
                </span>
                <span className="text-[10px] text-blue-600 font-bold">الكاش الفعلي أكبر من الدفتري</span>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* =========================================================================
          SECTION 3: PERIOD FINANCIAL MOVEMENT BREAKDOWN (تفاصيل حركة الفترة المختارة)
         ========================================================================= */}
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-200/90 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-black text-slate-900">
              حركة الأموال والعمليات خلال الفترة المختارة ({auditPeriod === 'today' ? 'اليوم' : auditPeriod === 'yesterday' ? 'أمس' : auditPeriod === 'week' ? 'هذا الأسبوع' : auditPeriod === 'month' ? 'هذا الشهر' : 'الفترة'})
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              تفصيل المقبوضات والمدفوعات وصافي التدفق النقدي
            </p>
          </div>
          <span className="text-xs font-bold text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg">
            {periodInvoices.length} فاتورة مسجلة
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* المقبوضات (Inflows) */}
          <div className="bg-emerald-50/40 rounded-2xl p-4 border border-emerald-200/70 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-200/60">
              <span className="text-xs font-black text-emerald-900 flex items-center gap-1.5">
                <ArrowDownLeft size={16} className="text-emerald-600" />
                <span>إجمالي المقبوضات الداخلة:</span>
              </span>
              <span className="text-base font-black font-mono text-emerald-700">
                {formatCurrency(totalPeriodCashIn + periodSalesBank + periodDebtCollectedBank + periodPurchaseReturnsBank, settings.currency)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>• مبيعات نقدية (كاش الصندوق):</span>
                <span className="font-mono font-bold">{formatCurrency(periodSalesCash, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• مبيعات إلكترونية (شبكة وبنك):</span>
                <span className="font-mono font-bold text-blue-700">{formatCurrency(periodSalesBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• مبيعات آجلة (دين على العملاء):</span>
                <span className="font-mono font-bold text-amber-700">{formatCurrency(periodSalesCredit, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1 border-t border-emerald-200/40">
                <span>• تحصيل ديون سابقة من العملاء (كاش):</span>
                <span className="font-mono font-bold text-emerald-700">+{formatCurrency(periodDebtCollectedCash, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• تحصيل ديون سابقة من العملاء (بنك):</span>
                <span className="font-mono font-bold text-blue-700">+{formatCurrency(periodDebtCollectedBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1 border-t border-emerald-200/40">
                <span>• مردودات مشتريات مستردة (كاش للصندوق):</span>
                <span className="font-mono font-bold text-emerald-700">+{formatCurrency(periodPurchaseReturnsCash, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• مردودات مشتريات مستردة (بنك):</span>
                <span className="font-mono font-bold text-blue-700">+{formatCurrency(periodPurchaseReturnsBank, settings.currency)}</span>
              </div>
            </div>
          </div>

          {/* المدفوعات (Outflows) */}
          <div className="bg-rose-50/40 rounded-2xl p-4 border border-rose-200/70 space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-rose-200/60">
              <span className="text-xs font-black text-rose-900 flex items-center gap-1.5">
                <ArrowUpRight size={16} className="text-rose-600" />
                <span>إجمالي المدفوعات الخارجة:</span>
              </span>
              <span className="text-base font-black font-mono text-rose-700">
                {formatCurrency(totalPeriodCashOut + periodExpensesBank + periodPurchasesBank + periodSupplierPaymentsBank + periodWorkerAdvancesBank + periodDrawingsBank + periodSalesReturnsBank, settings.currency)}
              </span>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-slate-700">
                <span>• المصروفات اليومية والنثريات:</span>
                <span className="font-mono font-bold">{formatCurrency(periodExpensesCash + periodExpensesBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• مشتريات تبغ مدفوعة فوراً (كاش/بنك):</span>
                <span className="font-mono font-bold">{formatCurrency(periodPurchasesCash + periodPurchasesBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• سداد دفعات لموردي التبغ:</span>
                <span className="font-mono font-bold text-rose-700">{formatCurrency(periodSupplierPaymentsCash + periodSupplierPaymentsBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700">
                <span>• سلفيات ورواتب العمال المنصرفة:</span>
                <span className="font-mono font-bold">{formatCurrency(periodWorkerAdvancesCash + periodWorkerAdvancesBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1 border-t border-rose-200/40 font-bold text-purple-900">
                <span>• مسحوبات الشركاء خلال الفترة:</span>
                <span className="font-mono text-purple-700">{formatCurrency(periodDrawingsCash + periodDrawingsBank, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700 pt-1 border-t border-rose-200/40 font-bold text-rose-800">
                <span>• مردودات مبيعات مرتجعة للزبائن (كاش الصندوق):</span>
                <span className="font-mono text-rose-700">-{formatCurrency(periodSalesReturnsCash, settings.currency)}</span>
              </div>
              <div className="flex justify-between text-slate-700 font-bold text-rose-800">
                <span>• مردودات مبيعات مرتجعة للزبائن (بنك):</span>
                <span className="font-mono text-blue-700">-{formatCurrency(periodSalesReturnsBank, settings.currency)}</span>
              </div>
            </div>
          </div>

        </div>

        {/* Net Flow Bar */}
        <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <span className="text-xs text-navy-850 block font-bold">صافي التدفق النقدي الفعلي في الدرج خلال الفترة:</span>
            <span className="text-[11px] text-slate-500 font-medium">
              (الكاش الداخل للدرج) - (الكاش المنصرف من الدرج)
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={`text-xl sm:text-2xl font-bold font-mono ${netPeriodCashMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {netPeriodCashMovement >= 0 ? `+${netPeriodCashMovement.toFixed(2)}` : netPeriodCashMovement.toFixed(2)}
            </span>
            <span className="text-xs text-slate-500 font-semibold">{settings.currency}</span>
          </div>
        </div>
      </div>

    </div>
  );
}
