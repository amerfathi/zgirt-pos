import React, { useState } from 'react';
import { 
  FileText, Printer, MessageCircle, Calendar, Filter, 
  TrendingUp, TrendingDown, Users, AlertOctagon, DollarSign, PieChart, 
  Package, ArrowDownLeft, ArrowUpRight, Scale, Check, ChevronDown,
  Building2, Truck, Clock, ShieldCheck, Award, Layers, ShoppingBag,
  RotateCcw, Sparkles, CheckCircle2, ChevronUp, Share2, Copy, AlertTriangle,
  FileSpreadsheet, Receipt, Wallet, Coins, Landmark, BarChart3, HelpCircle
} from 'lucide-react';
import { formatCurrency, formatWeight, getCurrentDateFormatted } from '../utils/formatters';
import { buildReportSnapshot, buildReceivableAging } from '../services/reportRegistry';
import { displayInvoiceNumber } from '../services/invoiceIdentity';
import { APP_VERSION } from '../config/appVersion';
import { BRRAKA_LOGO } from '../assets/branding';
import { getStoreDisplayAddress } from '../utils/storeDisplay';

export default function ReportsCenterView({ store, initialReportType = 'executive', initialPartnerId = '' }) {
  const { 
    invoices, customers, expenses, damagedItems, 
    workers, workerTransactions, settings, products, 
    purchases, partners = [], partnerDrawings = [], 
    profitDistributions = [], suppliers = [], getFinancialPosition,
    salesReturns = [], purchaseReturns = [], customerPayments = [], supplierPayments = []
  } = store;

  const finPos = getFinancialPosition ? getFinancialPosition() : null;

  // Selected report type
  const [reportType, setReportType] = useState(initialReportType);
  // Date range filter: 'today' | 'yesterday' | 'week' | 'month' | 'all'
  const [dateFilter, setDateFilter] = useState('today');
  // Customer selection for customer statement
  const [selectedCustomerId, setSelectedCustomerId] = useState(customers[0]?.id || '');
  // Supplier selection for supplier statement
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '');
  // Partner selection for partner statement
  const [selectedPartnerId, setSelectedPartnerId] = useState(initialPartnerId || partners[0]?.id || '');
  // Cashier actual count for shift reconciliation
  const [cashierActualCash, setCashierActualCash] = useState('');
  // Toggle grid cards visibility
  const [isGridExpanded, setIsGridExpanded] = useState(true);
  // Feedback when WhatsApp text is copied
  const [copiedWhatsapp, setCopiedWhatsapp] = useState(false);

  const todayStr = getCurrentDateFormatted();
  const reportStartDate = (() => {
    if (dateFilter === 'all') return null;
    const date = new Date(`${todayStr}T12:00:00`);
    if (dateFilter === 'yesterday') date.setDate(date.getDate() - 1);
    if (dateFilter === 'week') date.setDate(date.getDate() - 6);
    if (dateFilter === 'month') date.setDate(1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  })();

  // Helper date filtering
  const filterByDate = (dateStr) => {
    if (!dateStr) return true;
    if (dateFilter === 'all') return true;
    const day = String(dateStr).slice(0, 10);
    if (dateFilter === 'yesterday') return day === reportStartDate;
    return day >= reportStartDate && day <= todayStr;
  };

  // Filtered collections
  const filteredInvoices = invoices.filter(inv => inv.status !== 'voided' && filterByDate(inv.date));
  const filteredExpenses = expenses.filter(exp => filterByDate(exp.date));
  const filteredDamaged = damagedItems.filter(dmg => filterByDate(dmg.date));
  const filteredWorkerTxs = workerTransactions.filter(tx => filterByDate(tx.date));
  const filteredPurchases = (purchases || []).filter(pur => filterByDate(pur.date));
  const filteredSalesReturns = (salesReturns || []).filter(ret => filterByDate(ret.date));
  const filteredPurchaseReturns = (purchaseReturns || []).filter(ret => filterByDate(ret.date));
  const salesReturnLines = filteredSalesReturns.flatMap(ret =>
    (ret.items || ret.returnedItems || [ret]).map((item, index) => ({ ret, item, index })));
  const filteredCustPayments = (customerPayments || []).filter(p => filterByDate(p.date));
  const filteredSupPayments = (supplierPayments || []).filter(p => filterByDate(p.date));
  const reportSnapshot = buildReportSnapshot(store, { dateFilter, asOfDate: todayStr });

  // 1. Sales Totals
  const totalGrossSales = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.finalTotal) || 0), 0);
  const totalSalesReturnsAmount = filteredSalesReturns.reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
  const totalNetSales = reportSnapshot.netSales;
  const totalSalesRevenue = totalNetSales;

  const totalImmediatePaid = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  const totalCashCollected = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.cashAmount ?? (inv.paymentMethod === 'cash' ? inv.paidAmount : 0)) || 0), 0);
  const totalDebtRepaid = filteredCustPayments.filter(p => p.method !== 'bank').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalBankDebtRepaid = filteredCustPayments.filter(p => p.method === 'bank').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const totalCashFromCustomers = totalCashCollected + totalDebtRepaid;
  const totalCreditSales = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.remainingDebt) || 0), 0)
    - filteredSalesReturns.filter(ret => ret.refundMethod === 'credit_deduction').reduce((sum, ret) => sum + (Number(ret.totalRefundAmount) || 0), 0);
  const totalGrossNetKgSold = filteredInvoices.reduce((sum, inv) => sum + (inv.items || []).reduce((itemSum, item) => itemSum + (Number(item.netWeight) || 0), 0), 0);
  const totalSalesReturnsKg = filteredSalesReturns.reduce((sum, ret) => sum + (ret.items || ret.returnedItems || []).reduce((itemSum, item) => itemSum + (Number(item.returnedWeight) || 0), 0), 0);
  const totalNetKgSold = totalGrossNetKgSold - totalSalesReturnsKg;
  const totalPackagesSold = filteredInvoices.reduce((sum, inv) => sum + (Number(inv.totalPackages) || (inv.items || []).reduce((itemSum, item) => itemSum + (Number(item.packageCount) || 0), 0)), 0);

  // 2. Purchases Totals (المشتريات والتوريد من الموردين)
  const totalGrossPurchasesCost = filteredPurchases.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const totalPurchaseReturnsAmount = filteredPurchaseReturns.reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
  const totalNetPurchasesCost = reportSnapshot.netPurchases;
  const totalPurchasesCost = totalNetPurchasesCost;

  const totalGrossPurchasesKg = filteredPurchases.reduce((sum, p) => sum + (Number(p.quantityKg) || 0), 0);
  const totalPurchaseReturnsKg = filteredPurchaseReturns.reduce((sum, r) => sum + (Number(r.returnedKg) || 0), 0);
  const totalNetPurchasesKg = totalGrossPurchasesKg - totalPurchaseReturnsKg;
  const totalPurchasesKg = totalNetPurchasesKg;
  const totalPurchasesPackages = filteredPurchases.reduce((sum, p) => sum + (Number(p.packagesCount) || 0), 0);

  // 3. Expenses & Loss Totals (Strictly exclude supplier payments and worker payments to avoid double counting)
  const generalExpensesAmount = filteredExpenses.filter(e => !e.isSupplierPayment && !e.isWorkerPayment).reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  const totalExpensesAmount = generalExpensesAmount;
  const totalDamagedLoss = filteredDamaged.reduce((sum, dmg) => sum + (Number(dmg.totalLoss) || 0), 0);
  const totalDamagedKg = filteredDamaged.reduce((sum, dmg) => sum + (Number(dmg.quantityKg) || 0), 0);
  const totalSalariesPaid = filteredWorkerTxs.filter(t => t.type === 'salary_payment').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const totalAdvancesGiven = filteredWorkerTxs.filter(t => t.type === 'advance').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  // 4. P&L Net Profit
  const grossTradeProfit = reportSnapshot.grossProfit;
  const netEstimatedProfit = reportSnapshot.netProfit;

  // 5. Drawer Cash Reconciliation for shift
  const shiftInvoices = invoices.filter(inv => inv.status !== 'voided');
  const shiftOpeningCash = Number(settings.openingCashDrawerFloat) || 0;
  const shiftCashCollected = shiftInvoices.reduce((sum, inv) => sum + (Number(inv.cashAmount ?? (inv.paymentMethod === 'cash' ? inv.paidAmount : 0)) || 0), 0);
  const shiftCustomerCashPayments = (customerPayments || []).filter(p => p.method !== 'bank').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const shiftPurchaseCashRefunds = (purchaseReturns || []).filter(ret => ret.refundMethod === 'cash').reduce((sum, ret) => sum + (Number(ret.totalRefundAmount) || 0), 0);
  const shiftCashInflow = shiftCashCollected + shiftCustomerCashPayments + shiftPurchaseCashRefunds;
  const shiftCashExpenses = expenses.filter(e => !e.isSupplierPayment && !e.isWorkerPayment && e.paymentMethod !== 'bank').reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const shiftCashPurchases = (purchases || []).reduce((sum, p) => sum + (Number(p.paidCashAmount ?? p.cashAmount ?? (p.paymentMethod === 'cash' ? Number(p.totalCost) - Number(p.creditAmount || 0) : 0)) || 0), 0);
  const shiftSupplierCashPayments = (supplierPayments || []).filter(p => p.paymentMethod !== 'bank').reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const shiftPartnerCashDrawings = partnerDrawings.filter(d => d.method !== 'bank' && d.source !== 'bank').reduce((sum, d) => sum + (Number(d.amount) || 0), 0);
  const shiftWorkerCashSalaries = workerTransactions.filter(t => t.type === 'salary_payment' && t.paymentMethod !== 'bank').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const shiftWorkerCashAdvances = workerTransactions.filter(t => t.type === 'advance' && t.paymentMethod !== 'bank').reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  const shiftSalesCashRefunds = (salesReturns || []).filter(ret => ret.refundMethod === 'cash').reduce((sum, ret) => sum + (Number(ret.totalRefundAmount) || 0), 0);
  const shiftPartnerCashDistributions = profitDistributions.reduce((sum, row) => sum + (row.shares || []).filter(share => share.method !== 'bank').reduce((shareSum, share) => shareSum + (Number(share.netPayout) || 0), 0), 0);

  const shiftCashOutflow = shiftCashExpenses + shiftCashPurchases + shiftSupplierCashPayments + shiftPartnerCashDrawings + shiftWorkerCashSalaries + shiftWorkerCashAdvances + shiftSalesCashRefunds + shiftPartnerCashDistributions;
  const expectedDrawerCash = buildReportSnapshot(store, { dateFilter: 'all' }).cash;
  const actualCounted = cashierActualCash === '' ? expectedDrawerCash : Number(cashierActualCash);
  const cashDiff = actualCounted - expectedDrawerCash;

  // 6. Product Sales & Margins Breakdown
  const productMargins = products.map(prod => {
    let soldKg = 0;
    let packagesCount = 0;
    let totalRevenue = 0;

    let totalCOGS = 0;
    filteredInvoices.forEach(inv => {
      (inv.items || []).forEach(item => {
        if (item.productId === prod.id) {
          soldKg += Number(item.netWeight) || 0;
          packagesCount += Number(item.packageCount) || 0;
          totalRevenue += Number(item.total) || 0;
          totalCOGS += (Number(item.netWeight) || 0) * (Number(item.costPerKg) || 0);
        }
      });
    });
    filteredSalesReturns.forEach(ret => {
      const original = invoices.find(inv => inv.id === ret.invoiceId);
      (ret.items || ret.returnedItems || []).forEach(item => {
        if (item.productId !== prod.id) return;
        const weight = Number(item.returnedWeight || item.quantityKg) || 0;
        const sourceLine = Number.isInteger(item.sourceLineIndex) ? original?.items?.[item.sourceLineIndex]
          : original?.items?.find(line => line.productId === item.productId);
        soldKg -= weight;
        totalRevenue -= Number(item.subtotal) || weight * (Number(item.originalPricePerKg) || 0);
        totalCOGS -= weight * (Number(sourceLine?.costPerKg) || 0);
      });
    });
    const avgCostPerKg = soldKg > 0 ? totalCOGS / soldKg : 0;
    const grossProfit = totalRevenue - totalCOGS;
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const avgSellingPricePerKg = soldKg > 0 ? (totalRevenue / soldKg) : prod.defaultPricePerKg;

    return {
      id: prod.id,
      name: prod.name,
      emoji: prod.emoji,
      unit: prod.defaultUnit,
      soldKg,
      packagesCount,
      totalRevenue,
      avgCostPerKg,
      avgSellingPricePerKg,
      totalCOGS,
      grossProfit,
      marginPercent: Math.round(marginPercent * 10) / 10
    };
  }).filter(p => p.soldKg > 0 || dateFilter === 'all').sort((a, b) => b.grossProfit - a.grossProfit);

  // 7. Customer Debt Aging
  const customerDebtAging = buildReceivableAging(store, { asOfDate: todayStr });

  const totalDebtAgingSum = customerDebtAging.reduce((sum, c) => sum + c.balance, 0);
  const debtBucket7 = customerDebtAging.filter(c => c.bucket === '1-7').reduce((sum, c) => sum + c.balance, 0);
  const debtBucket15 = customerDebtAging.filter(c => c.bucket === '8-15').reduce((sum, c) => sum + c.balance, 0);
  const debtBucket30 = customerDebtAging.filter(c => c.bucket === '16-30').reduce((sum, c) => sum + c.balance, 0);
  const debtBucketOver30 = customerDebtAging.filter(c => c.bucket === '>30').reduce((sum, c) => sum + c.balance, 0);
  const debtBucketUnknown = customerDebtAging.filter(c => c.bucket === 'unknown').reduce((sum, c) => sum + c.balance, 0);

  // 8. Supplier Statement Data (الموردين)
  const targetSupplier = suppliers.find(s => s.id === selectedSupplierId) || suppliers[0];
  const supplierPurchasesList = (purchases || []).filter(p => targetSupplier && (p.supplierId === targetSupplier.id || p.supplierName === targetSupplier.name));
  const targetSupplierPayments = (store.supplierPayments || []).filter(p => targetSupplier && p.supplierId === targetSupplier.id);
  const targetPurchaseReturns = (purchaseReturns || []).filter(ret => targetSupplier &&
    (ret.supplierId === targetSupplier.id || purchases.find(p => p.id === ret.purchaseId)?.supplierId === targetSupplier.id));

  const supplierLedger = [
    ...supplierPurchasesList.map(p => {
      const tot = Number(p.totalCost) || 0;
      const cred = p.paymentMethod === 'credit' ? tot : (Number(p.creditAmount) || 0);
      const cashP = Math.max(0, tot - cred);
      return {
        id: p.id,
        date: p.date,
        time: p.time || '',
        type: 'purchase',
        docName: `فاتورة توريد #${p.id}`,
        description: `توريد ${p.productName || 'بضاعة'} (${p.quantityKg || 0} كجم)`,
        totalCost: tot,
        paidImmediate: cashP,
        creditAdded: cred,
        paymentMade: 0,
        netEffect: cred
      };
    }),
    ...targetPurchaseReturns.map(ret => ({
      id: ret.id,
      date: ret.date,
      time: ret.time || '',
      type: 'return',
      docName: `مردود توريد #${ret.purchaseId}`,
      description: `مردود ${ret.productName || 'بضاعة'} (${ret.returnedKg || 0} كجم)`,
      totalCost: 0,
      paidImmediate: 0,
      creditAdded: 0,
      paymentMade: ret.refundMethod === 'supplier_debt_deduction' ? Number(ret.totalRefundAmount) || 0 : 0,
      netEffect: ret.refundMethod === 'supplier_debt_deduction' ? -(Number(ret.totalRefundAmount) || 0) : 0
    })),
    ...targetSupplierPayments.map(pay => ({
      id: pay.id,
      date: pay.date,
      time: pay.time || '',
      type: 'payment',
      docName: `سند صرف دفعة نقدية`,
      description: pay.notes || 'سداد دفعة نقدية على الحساب',
      totalCost: 0,
      paidImmediate: 0,
      creditAdded: 0,
      paymentMade: Number(pay.amount) || 0,
      netEffect: -(Number(pay.amount) || 0)
    }))
  ].sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));

  const supplierBaseBalance = Number.isFinite(Number(targetSupplier?.initialBalance))
    ? Number(targetSupplier.initialBalance)
    : (Number(targetSupplier?.balance) || 0) - supplierLedger.reduce((sum, item) => sum + item.netEffect, 0);
  const supplierOpeningBalance = supplierBaseBalance + supplierLedger
    .filter(item => reportStartDate && item.date && item.date < reportStartDate)
    .reduce((sum, item) => sum + item.netEffect, 0);
  const visibleSupplierLedger = supplierLedger.filter(item => filterByDate(item.date));
  let supRunningBal = supplierOpeningBalance;
  const supplierLedgerWithBalance = visibleSupplierLedger.map(item => {
    supRunningBal += item.netEffect;
    return {
      ...item,
      runningBalance: Math.round(supRunningBal * 100) / 100
    };
  });

  // 9. Customer Statement Data
  const targetCustomer = customers.find(c => c.id === selectedCustomerId) || customers[0];
  const customerInvoices = invoices.filter(i => i.customerId === targetCustomer?.id && i.status !== 'voided');
  const targetCustomerPayments = (store.customerPayments || []).filter(p => p.customerId === targetCustomer?.id);
  const targetSalesReturns = (salesReturns || []).filter(ret => targetCustomer &&
    (ret.customerId === targetCustomer.id || invoices.find(inv => inv.id === ret.invoiceId)?.customerId === targetCustomer.id));

  const customerLedger = [
    ...customerInvoices.map(inv => ({
      id: inv.id,
      date: inv.date,
      time: inv.time,
      type: 'invoice',
      docName: `فاتورة بيع #${displayInvoiceNumber(inv)}`,
      description: inv.items.map(i => `${i.name} (${i.netWeight}كجم)`).join('، '),
      netWeight: inv.totalNetWeight,
      debit: inv.finalTotal,
      paidImmediate: inv.paidAmount,
      debtAdded: inv.remainingDebt,
      creditPaid: 0,
      netEffect: inv.remainingDebt
    })),
    ...targetSalesReturns.map(ret => ({
      id: ret.id,
      date: ret.date,
      time: ret.time,
      type: 'return',
      docName: `مردود بيع #${ret.invoiceId}`,
      description: `مردود من فاتورة #${ret.invoiceId}`,
      netWeight: ret.returnedNetWeight,
      debit: 0,
      paidImmediate: 0,
      debtAdded: 0,
      creditPaid: ret.refundMethod === 'credit_deduction' ? Number(ret.totalRefundAmount) || 0 : 0,
      netEffect: ret.refundMethod === 'credit_deduction' ? -(Number(ret.totalRefundAmount) || 0) : 0
    })),
    ...targetCustomerPayments.map(pay => ({
      id: pay.id,
      date: pay.date,
      time: pay.time,
      type: 'payment',
      docName: `سند قبض دفعة نقدية`,
      description: pay.notes || 'سداد دفعة نقدية على الحساب',
      netWeight: null,
      debit: 0,
      paidImmediate: 0,
      debtAdded: 0,
      creditPaid: pay.amount,
      netEffect: -pay.amount
    }))
  ].sort((a, b) => `${a.date || ''} ${a.time || ''}`.localeCompare(`${b.date || ''} ${b.time || ''}`));

  const customerBaseBalance = Number.isFinite(Number(targetCustomer?.initialBalance))
    ? Number(targetCustomer.initialBalance)
    : (Number(targetCustomer?.balance) || 0) - customerLedger.reduce((sum, item) => sum + item.netEffect, 0);
  const customerOpeningBalance = customerBaseBalance + customerLedger
    .filter(item => reportStartDate && item.date && item.date < reportStartDate)
    .reduce((sum, item) => sum + item.netEffect, 0);
  const visibleCustomerLedger = customerLedger.filter(item => filterByDate(item.date));
  let runningBal = customerOpeningBalance;
  const ledgerWithBalance = visibleCustomerLedger.map(item => {
    runningBal += item.netEffect;
    return {
      ...item,
      runningBalance: Math.round(runningBal * 100) / 100
    };
  });

  // 10. Weight Shrinkage & Loss Rate
  const productShrinkage = products.map(prod => {
    const purchasedKg = filteredPurchases
      .filter(p => p.productId === prod.id)
      .reduce((sum, p) => sum + (Number(p.quantityKg) || 0), 0);
    const purchaseReturnedKg = filteredPurchaseReturns
      .filter(ret => ret.productId === prod.id)
      .reduce((sum, ret) => sum + (Number(ret.returnedKg) || 0), 0);
    const purKg = purchasedKg - purchaseReturnedKg;

    const grossSoldKg = filteredInvoices.reduce((sum, inv) => sum + (inv.items || [])
      .filter(item => item.productId === prod.id)
      .reduce((itemSum, item) => itemSum + (Number(item.netWeight) || 0), 0), 0);
    const salesReturnedKg = filteredSalesReturns.reduce((sum, ret) => sum + (ret.items || ret.returnedItems || [])
      .filter(item => item.productId === prod.id)
      .reduce((itemSum, item) => itemSum + (Number(item.returnedWeight) || 0), 0), 0);
    const soldKg = grossSoldKg - salesReturnedKg;

    const damagedKg = filteredDamaged
      .filter(d => d.productId === prod.id)
      .reduce((sum, d) => sum + (Number(d.quantityKg) || 0), 0);
    
    const damagedLoss = filteredDamaged
      .filter(d => d.productId === prod.id)
      .reduce((sum, d) => sum + (Number(d.totalLoss) || Number(d.quantityKg) * Number(d.costPerKg) || 0), 0);

    return {
      id: prod.id,
      name: prod.name,
      purKg,
      soldKg,
      damagedKg,
      damagedLoss: Math.round(damagedLoss * 100) / 100
    };
  }).filter(p => p.purKg !== 0 || p.soldKg !== 0 || p.damagedKg !== 0);

  const totalPurKgAll = productShrinkage.reduce((s, p) => s + p.purKg, 0);
  const totalRecordedDamageLoss = productShrinkage.reduce((s, p) => s + p.damagedLoss, 0);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyWhatsapp = () => {
    const text = `📊 *التقرير التنفيذي اليومي — منظومة براكه*
📅 التاريخ: ${todayStr}
🏪 المتجر: ${settings.shopName}

💵 *المبيعات والإيرادات:*
• إجمالي المبيعات: ${totalNetSales.toFixed(2)} ${settings.currency}
• المقبوض نقداً من الفواتير: ${totalCashCollected.toFixed(2)} ${settings.currency}
• تحصيلات ديون سابقة نقداً: ${totalDebtRepaid.toFixed(2)} ${settings.currency}
• تحصيلات ديون سابقة بنكيًا: ${totalBankDebtRepaid.toFixed(2)} ${settings.currency}
• صافي الائتمان الجديد بعد المرتجعات: ${totalCreditSales.toFixed(2)} ${settings.currency}
• الوزن الإجمالي المباع: ${formatWeight(totalNetKgSold)} (${totalPackagesSold} عبوة)

📦 *المشتريات والتوريد:*
• إجمالي المشتريات: ${totalNetPurchasesCost.toFixed(2)} ${settings.currency} (${formatWeight(totalNetPurchasesKg)})

⚙️ *المصروفات والتوالف:*
• مصاريف ونثريات: ${generalExpensesAmount.toFixed(2)} ${settings.currency}
• رواتب وسلف مسددة: ${totalSalariesPaid.toFixed(2)} ${settings.currency}
• خسائر التوالف: ${totalDamagedLoss.toFixed(2)} ${settings.currency}

💼 *المركز المالي لليوم:*
• صافي نقدية الصندوق (الدرج): ${expectedDrawerCash.toFixed(2)} ${settings.currency}
• صافي الربح اليومي التقديري: ${netEstimatedProfit.toFixed(2)} ${settings.currency}

_تم الاستخراج آلياً من منظومة براكه v${APP_VERSION}_`;

    navigator.clipboard.writeText(text);
    setCopiedWhatsapp(true);
    setTimeout(() => setCopiedWhatsapp(false), 3000);
  };

  // Structured Department Grid of Reports (Executive, Monochromatic Icons)
  const reportCategories = [
    {
      title: 'الإدارة المالية والاستراتيجية',
      description: 'التقارير التنفيذية الكبرى، حساب الأرباح الشاملة، ومسحوبات الشركاء',
      reports: [
        {
          id: 'executive',
          name: 'التقرير التنفيذي اليومي للمالك',
          desc: 'ملخص مالي فائق الأهمية مع زر مشاركة واتساب فوري',
          icon: Award,
          badge: 'ملخص شامل'
        },
        {
          id: 'pnl',
          name: 'قائمة الدخل والأرباح والخسائر',
          desc: 'حساب الأرباح الصافية بعد خصم البضاعة والمصاريف والهدر',
          icon: TrendingUp,
          badge: 'صافي الربح'
        },
        {
          id: 'audit',
          name: 'جرد الخزينة ومطابقة السيولة',
          desc: 'مراجعة أماكن تواجد الأموال (الدرج، البنك، السوق، المخزون)',
          icon: Landmark,
          badge: 'المركز المالي'
        },
        {
          id: 'partners',
          name: 'الشركاء والمسحوبات والأرباح',
          desc: 'كشف حصص الشركاء، المسحوبات الدورية، وجلسات التوزيع',
          icon: Users,
          badge: 'رأس المال'
        }
      ]
    },
    {
      title: 'المبيعات وحسابات العملاء',
      description: 'حركة البيع اليومي، هوامش الأرباح، ديون السوق والعملاء',
      reports: [
        {
          id: 'sales',
          name: 'المبيعات والإيرادات اليومية',
          desc: 'سجل فواتير البيع، النقدي والآجل، ومردودات الزبائن',
          icon: Receipt,
          badge: 'فواتير البيع'
        },
        {
          id: 'margins',
          name: 'أرباح وهوامش الأصناف',
          desc: 'صافي ربح كل صنف ونسبة الهامش وترتيب الأصناف الرابحة',
          icon: BarChart3,
          badge: 'ربحية الصنف'
        },
        {
          id: 'aging',
          name: 'أعمار ديون العملاء',
          desc: 'تصنيف ديون السوق زمنياً (1-7، 8-15، 16-30، +30 يوم)',
          icon: Clock,
          badge: 'متابعة الديون'
        },
        {
          id: 'customer',
          name: 'كشف حساب تفصيلي لعميل',
          desc: 'حركة الفواتير والمسدد والرصيد التراكمي للزبون',
          icon: Users,
          badge: 'كشف حساب'
        },
        {
          id: 'products',
          name: 'حركة وأوزان الأصناف',
          desc: 'إجمالي الكميات والعبوات المباعة وأوزان الميزان الصافية',
          icon: Package,
          badge: 'أوزان المبيعات'
        }
      ]
    },
    {
      title: 'المشتريات والتوريد والمخزون',
      description: 'توريد البضاعة من الموردين، حسابات الموردين، ونواقص الوزن',
      reports: [
        {
          id: 'purchases',
          name: 'المشتريات وتوريد البضاعة',
          desc: 'فواتير التوريد الواردة من الموردين وتكاليف الشراء',
          icon: Truck,
          badge: 'فواتير التوريد'
        },
        {
          id: 'suppliers_ledger',
          name: 'كشف حساب الموردين',
          desc: 'مطابقة شحنات التوريد مع السدادات النقدية للمورد',
          icon: Building2,
          badge: 'حسابات الموردين'
        },
        {
          id: 'returns',
          name: 'مردودات البيع والشراء',
          desc: 'سجل المرتجعات بالسعر الأصلي التاريخي بدقة محاسبية',
          icon: RotateCcw,
          badge: 'المرتجعات'
        },
        {
          id: 'damaged',
          name: 'التوالف وإعدامات البضاعة',
          desc: 'حصر البضاعة التالفة والهالكة وقيمتها الخاسرة',
          icon: AlertOctagon,
          badge: 'التوالف'
        },
        {
          id: 'shrinkage',
          name: 'معدل الهدر وعجز الميزان',
          desc: 'نسبة الفقد الطبيعي وبخر الرطوبة بين الشراء والبيع',
          icon: Scale,
          badge: 'عجز الميزان'
        }
      ]
    },
    {
      title: 'التشغيل والمصروفات وصندوق الكاشير',
      description: 'مطابقة نقدية الدرج، المصاريف التشغيلية، ومستحقات العمالة',
      reports: [
        {
          id: 'shift',
          name: 'إغلاق الوردية والدرج',
          desc: 'مطابقة النقدية الفعلية مع مبيعات النظام ورصد العجز أو الزيادة',
          icon: Wallet,
          badge: 'مطابقة الدرج'
        },
        {
          id: 'expenses',
          name: 'المصروفات والتشغيل',
          desc: 'تقرير النثريات والمصاريف الإدارية والتشغيلية',
          icon: DollarSign,
          badge: 'النثريات'
        },
        {
          id: 'payroll',
          name: 'رواتب وسلفيات العمال',
          desc: 'مسيرات أجور فريق العمل والسلف والمسدد',
          icon: Coins,
          badge: 'الأجور والسلف'
        }
      ]
    }
  ];

  const reportTitles = {
    executive: 'التقرير التنفيذي اليومي الشامل للمالك',
    pnl: 'قائمة الدخل وصافي الأرباح والخسائر الشاملة',
    audit: 'تقرير جرد الخزينة والمركز المالي وتحديد أماكن السيولة',
    partners: 'كشف حساب الشركاء والمسحوبات وتوزيع الأرباح',
    sales: 'تقرير المبيعات الشامل واليومي',
    margins: 'تقرير أرباح وهوامش الأصناف وقائمة الأصناف الرابحة',
    aging: 'تقرير أعمار ديون العملاء في السوق والديون الراكدة',
    customer: 'كشف حساب تفصيلي للعميل',
    products: 'تقرير حركة مبيعات وأوزان الأصناف',
    purchases: 'تقرير المشتريات وتوريد البضاعة من الموردين',
    suppliers_ledger: 'كشف حساب رسمي ومطابقة دفعات المورد',
    returns: 'سجل مردودات المبيعات والمشتريات (بالسعر التاريخي الأصلي)',
    damaged: 'تقرير التوالف وإعدامات البضاعة الهالكة',
    shrinkage: 'تقرير معدل الهدر الطبيعي وعجز الميزان',
    shift: 'تقرير إغلاق الوردية ومطابقة صندوق الكاشير (عجز / زيادة)',
    expenses: 'تقرير المصروفات والتشغيل',
    payroll: 'كشف رواتب وسلفيات العمال',
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* ========================================================================= */}
      {/* 1. EXECUTIVE HEADER & ACTIONS */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-bold text-slate-900">التقارير والتدقيق المالي</h1>
                <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold border border-slate-200">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-normal">المبيعات والمصروفات والمخزون والحسابات في مكان واحد</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {reportType === 'executive' && (
              <button
                type="button"
                onClick={handleCopyWhatsapp}
                className="flex-1 sm:flex-initial px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                {copiedWhatsapp ? <Check size={14} /> : <Share2 size={14} />}
                <span>{copiedWhatsapp ? 'تم نسخ التقرير!' : 'نسخ لواتساب المالك'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            >
              <Printer size={14} />
              <span>طباعة A4</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGridExpanded(!isGridExpanded)}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-200/80 cursor-pointer"
            >
              {isGridExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              <span>{isGridExpanded ? 'طي شبكة التقارير' : 'عرض شبكة التقارير'}</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. EXECUTIVE GRID OF CARDS (ORGANIZED SQUARES WITH OFFICIAL ICONS) */}
        {/* ========================================================================= */}
        {isGridExpanded && (
          <div className="space-y-4 pt-2 border-t border-slate-100">
            {reportCategories.map((cat, catIdx) => (
              <div key={catIdx} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800 tracking-wide flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                    {cat.title}
                  </span>
                  <span className="text-[10px] text-slate-400 hidden sm:inline">{cat.description}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
                  {cat.reports.map(r => {
                    const IconComp = r.icon;
                    const isSelected = reportType === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setReportType(r.id)}
                        className={`p-3 rounded-xl border text-right transition-all flex flex-col justify-between gap-2.5 cursor-pointer relative group ${
                          isSelected
                            ? 'bg-slate-900 text-white border-slate-900 shadow-sm ring-1 ring-slate-900'
                            : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200/90 shadow-2xs hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                            isSelected 
                              ? 'bg-slate-800 text-emerald-400' 
                              : 'bg-slate-100 text-slate-700 group-hover:bg-slate-200'
                          }`}>
                            <IconComp size={16} />
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${
                            isSelected 
                              ? 'bg-slate-800 text-slate-300' 
                              : 'bg-slate-100 text-slate-500 border border-slate-200/60'
                          }`}>
                            {r.badge}
                          </span>
                        </div>

                        <div>
                          <h3 className={`text-xs font-bold leading-snug line-clamp-1 ${
                            isSelected ? 'text-white' : 'text-slate-900'
                          }`}>
                            {r.name}
                          </h3>
                          <p className={`text-[10px] leading-tight line-clamp-1 mt-0.5 ${
                            isSelected ? 'text-slate-300' : 'text-slate-400'
                          }`}>
                            {r.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. TIME PERIOD & CONTEXT FILTERS BAR */}
        {/* ========================================================================= */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
          {/* Active Report Indicator Breadcrumb */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400">التقرير المعروض:</span>
            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-900 font-bold text-xs border border-slate-200 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              {reportTitles[reportType] || 'تقرير رسمي'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date Filters */}
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200/80">
              {[
                { id: 'today', label: 'اليوم' },
                { id: 'yesterday', label: 'أمس' },
                { id: 'week', label: 'آخر 7 أيام' },
                { id: 'month', label: 'هذا الشهر' },
                { id: 'all', label: 'كامل السجلات' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDateFilter(f.id)}
                  className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    dateFilter === f.id
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Customer Picker for Customer Statement */}
            {reportType === 'customer' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px] font-bold">العميل:</span>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                >
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Supplier Picker for Supplier Statement (الموردين) */}
            {reportType === 'suppliers_ledger' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px] font-bold">المورد:</span>
                <select
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone || 'بدون هاتف'})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Partner Picker for Partner Statement */}
            {reportType === 'partners' && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 text-[11px] font-bold">الشريك:</span>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-900"
                >
                  <option value="all">جميع الشركاء (كشف عام)</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.sharePercentage}%)</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. PRINTABLE A4 OFFICIAL DOCUMENT CONTAINER */}
      {/* ========================================================================= */}
      <div className="overflow-x-auto w-full pb-6">
        <div 
          id="printable-a4-document"
          className="w-full max-w-[210mm] mx-auto bg-white p-4 sm:p-8 rounded-2xl shadow-md border border-slate-200/90 text-slate-900 font-sans text-xs print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:rounded-none min-w-0 overflow-hidden"
        >
          {/* Official Store Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b-2 border-slate-900">
            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2">
                <img src={BRRAKA_LOGO} alt="شعار براكه" className="w-9 h-9 object-contain shrink-0" />
                <h2 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight truncate">
                  {settings.shopName}
                </h2>
              </div>
              <p className="text-xs text-slate-600 font-semibold truncate">{settings.subTitle}</p>
              {(getStoreDisplayAddress(settings.address) || settings.phone) && <p className="text-[11px] text-slate-500 truncate">
                {getStoreDisplayAddress(settings.address) && `📍 ${getStoreDisplayAddress(settings.address)}`}
                {getStoreDisplayAddress(settings.address) && settings.phone && ' • '}
                {settings.phone && `📞 ${settings.phone}`}
              </p>}
            </div>

            <div className="text-right sm:text-left space-y-1 shrink-0">
              <div className="inline-block bg-slate-900 text-white px-3 py-1 rounded-lg text-xs font-black">
                {reportTitles[reportType] || 'تقرير رسمي A4'}
              </div>
              <div className="text-[11px] text-slate-600 font-medium mt-1">
                تاريخ الاستخراج: <strong>{todayStr}</strong>
              </div>
              <div className="text-[10px] text-slate-500">
                الفترة: {['audit', 'partners', 'aging', 'shift'].includes(reportType) ? 'المركز الحالي من كامل السجلات' : dateFilter === 'all' ? 'كامل السجلات' : dateFilter === 'today' ? 'اليوم فقط' : dateFilter === 'yesterday' ? 'يوم أمس' : dateFilter === 'week' ? 'آخر 7 أيام' : 'هذا الشهر'}
              </div>
              <div className="text-[10px] text-slate-500">
                النطاق: {store.activeBranchId === 'all'
                  ? 'جميع الفروع المخوّل بها — إجمالي مستقل، وليس رصيد فرع'
                  : store.activeBranch?.name || 'الفرع المحدد'}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* NEW REPORT 1: EXECUTIVE ONE-PAGER (التقرير التنفيذي اليومي للمالك) */}
          {/* ========================================================================= */}
          {reportType === 'executive' && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-black">الملخص المالي والتشغيلي اليومي</h2>
                  <p className="text-[10px] text-slate-300">قراءة تنفيذية فورية لأداء المتجر وحركة السيولة وصافي الأرباح</p>
                </div>
                <div className="text-left">
                  <span className="text-[10px] text-emerald-400 block font-bold">صافي الربح التقديري</span>
                  <span className="text-base font-black font-mono">{formatCurrency(netEstimatedProfit, settings.currency)}</span>
                </div>
              </div>

              {/* Grid of Key Performance Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">إجمالي المبيعات (صافي)</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-0.5">{formatCurrency(totalNetSales, settings.currency)}</span>
                  <span className="text-[9px] text-slate-400 block mt-1">وزن: {formatWeight(totalNetKgSold)}</span>
                </div>

                <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block">النقدية المحصلة فعلياً</span>
                  <span className="text-sm font-black font-mono text-emerald-700 block mt-0.5">{formatCurrency(totalCashFromCustomers, settings.currency)}</span>
                  <span className="text-[9px] text-emerald-600 block mt-1">كاش فواتير + تحصيل ديون</span>
                </div>

                <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold block">صافي الائتمان الجديد بعد المرتجعات</span>
                  <span className="text-sm font-black font-mono text-amber-900 block mt-0.5">{formatCurrency(totalCreditSales, settings.currency)}</span>
                  <span className="text-[9px] text-amber-700 block mt-1">متبقي بذمة العملاء</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">إجمالي مشتريات التوريد</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-0.5">{formatCurrency(totalNetPurchasesCost, settings.currency)}</span>
                  <span className="text-[9px] text-slate-400 block mt-1">من الموردين</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">المصروفات والنثريات</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-0.5">{formatCurrency(generalExpensesAmount, settings.currency)}</span>
                  <span className="text-[9px] text-slate-400 block mt-1">مصاريف تشغيل</span>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">الأجور والسلف المسددة</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-0.5">{formatCurrency(totalSalariesPaid, settings.currency)}</span>
                  <span className="text-[9px] text-slate-400 block mt-1">مسدد للعمالة</span>
                </div>

                <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">خسائر التوالف والإعدام</span>
                  <span className="text-sm font-black font-mono text-rose-700 block mt-0.5">{formatCurrency(totalDamagedLoss, settings.currency)}</span>
                  <span className="text-[9px] text-rose-600 block mt-1">{formatWeight(totalDamagedKg)} تالف</span>
                </div>

                <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-200">
                  <span className="text-[10px] text-blue-800 font-bold block">صافي نقدية الدرج المفترضة</span>
                  <span className="text-sm font-black font-mono text-blue-900 block mt-0.5">{formatCurrency(expectedDrawerCash, settings.currency)}</span>
                  <span className="text-[9px] text-blue-600 block mt-1">نقدية الكاش بالصندوق</span>
                </div>
              </div>

              {/* Quick Summary Table for Invoices & Top Products */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-2 font-bold text-xs text-slate-800 border-b border-slate-200">
                    أعلى الأصناف تحقيقاً للأرباح اليوم
                  </div>
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2">الصنف</th>
                        <th className="p-2 text-center">الوزن</th>
                        <th className="p-2 text-center">المبيعات</th>
                        <th className="p-2 text-center">صافي الربح</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {productMargins.slice(0, 5).map((p, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-bold">{p.name}</td>
                          <td className="p-2 text-center font-mono">{formatWeight(p.soldKg)}</td>
                          <td className="p-2 text-center font-mono">{p.totalRevenue.toFixed(1)}</td>
                          <td className="p-2 text-center font-mono font-bold text-emerald-700">+{p.grossProfit.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <div className="bg-slate-100 p-2 font-bold text-xs text-slate-800 border-b border-slate-200">
                    أحدث فواتير البيع المسجلة
                  </div>
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="p-2">الفاتورة</th>
                        <th className="p-2">العميل</th>
                        <th className="p-2 text-center">النوع</th>
                        <th className="p-2 text-center">الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredInvoices.slice(-5).reverse().map((inv, idx) => (
                        <tr key={idx}>
                          <td className="p-2 font-mono font-bold">#{displayInvoiceNumber(inv)}</td>
                          <td className="p-2 truncate max-w-[120px]">{inv.customerName}</td>
                          <td className="p-2 text-center">
                            <span className={`px-1 rounded text-[9px] font-bold ${inv.saleType === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                              {inv.saleType === 'cash' ? 'كاش' : 'آجل'}
                            </span>
                          </td>
                          <td className="p-2 text-center font-mono font-bold">{inv.finalTotal.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* NEW REPORT 2: MARGINS & PRODUCT PROFITABILITY (ربحية وهوامش الأصناف) */}
          {/* ========================================================================= */}
          {reportType === 'margins' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي إيرادات المبيعات</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatCurrency(totalNetSales, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">تكلفة البضاعة المباعة (COGS)</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">
                    {formatCurrency(reportSnapshot.cogs, settings.currency)}
                  </span>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block">إجمالي الربح التجاري</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block">
                    {formatCurrency(reportSnapshot.grossProfit, settings.currency)}
                  </span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">متوسط هامش الربح %</span>
                  <span className="text-xs sm:text-sm font-black text-blue-700 font-mono block">
                    {totalNetSales > 0 ? ((reportSnapshot.grossProfit / totalNetSales) * 100).toFixed(1) : '0.0'}%
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[700px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800">اسم الصنف</th>
                      <th className="p-2 border border-slate-800 text-center">الكمية المباعة (كغم)</th>
                      <th className="p-2 border border-slate-800 text-center">متوسط سعر البيع</th>
                      <th className="p-2 border border-slate-800 text-center">متوسط تكلفة الشراء</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي المبيعات</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي التكلفة</th>
                      <th className="p-2 border border-slate-800 text-center">صافي الربح</th>
                      <th className="p-2 border border-slate-800 text-center">هامش الربح %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {productMargins.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">
                          {p.emoji || '🥬'} {p.name}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{formatWeight(p.soldKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{Number(p.avgSellingPricePerKg).toFixed(2)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{Number(p.avgCostPerKg).toFixed(2)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold">{p.totalRevenue.toFixed(2)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">{p.totalCOGS.toFixed(2)}</td>
                        <td className={`p-2 border border-slate-200 text-center font-mono font-black ${
                          p.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}>
                          {p.grossProfit.toFixed(2)}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            p.marginPercent >= 20 ? 'bg-emerald-100 text-emerald-800' : p.marginPercent > 0 ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                          }`}>
                            {p.marginPercent}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={2} className="p-2 border border-slate-300">الإجمالي:</td>
                      <td className="p-2 border border-slate-300 text-center">{formatWeight(productMargins.reduce((s, p) => s + p.soldKg, 0))}</td>
                      <td colSpan={2} className="p-2 border border-slate-300"></td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{totalNetSales.toFixed(2)}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{reportSnapshot.cogs.toFixed(2)}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-emerald-800 font-black">
                        {reportSnapshot.grossProfit.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* NEW REPORT 3: DEBT AGING (تقرير أعمار ديون العملاء) */}
          {/* ========================================================================= */}
          {reportType === 'aging' && (
            <div className="py-4 space-y-4">
              <p className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                أعمار الفواتير تقديرية بافتراض تسوية الدفعات على الأقدم أولًا؛ الرصيد الافتتاحي أو غير القابل للتأريخ يظهر منفصلًا ولا يُصنَّف دينًا حديثًا.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي ديون السوق</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatCurrency(totalDebtAgingSum, settings.currency)}</span>
                </div>
                <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-bold block">1 - 7 أيام (حديث)</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block">{formatCurrency(debtBucket7, settings.currency)}</span>
                </div>
                <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                  <span className="text-[10px] text-blue-800 font-bold block">8 - 15 يوماً (متوسط)</span>
                  <span className="text-xs sm:text-sm font-black text-blue-800 font-mono block">{formatCurrency(debtBucket15, settings.currency)}</span>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold block">16 - 30 يوماً (متأخر)</span>
                  <span className="text-xs sm:text-sm font-black text-amber-900 font-mono block">{formatCurrency(debtBucket30, settings.currency)}</span>
                </div>
                <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">+30 يوماً (راكد / حرج)</span>
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block">{formatCurrency(debtBucketOver30, settings.currency)}</span>
                </div>
                <div className="bg-slate-100 p-2 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-700 font-bold block">غير مؤرخ / افتتاحي</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatCurrency(debtBucketUnknown, settings.currency)}</span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[650px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800">اسم العميل</th>
                      <th className="p-2 border border-slate-800">رقم الهاتف</th>
                      <th className="p-2 border border-slate-800 text-center">تاريخ أصل الدين</th>
                      <th className="p-2 border border-slate-800 text-center">عمر الدين (أيام)</th>
                      <th className="p-2 border border-slate-800 text-center">تصنيف الدين</th>
                      <th className="p-2 border border-slate-800 text-center">المبلغ المستحق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {customerDebtAging.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">{c.name}</td>
                        <td className="p-2 border border-slate-200 font-mono text-slate-600">{c.phone}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">{c.date || 'غير معروف'}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold">{c.diffDays === null ? '—' : `${c.diffDays} يوم`}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.severity === 'low' ? 'bg-emerald-100 text-emerald-800' :
                            c.severity === 'medium' ? 'bg-blue-100 text-blue-800' :
                            c.severity === 'high' ? 'bg-amber-100 text-amber-800' :
                            c.severity === 'unknown' ? 'bg-slate-200 text-slate-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {c.bucketLabel}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-rose-700">
                          {formatCurrency(c.balance, settings.currency)}
                        </td>
                      </tr>
                    ))}
                    {customerDebtAging.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">
                          🎉 لا توجد ديون مستحقة على العملاء حالياً! كافة الحسابات مسددة بالكامل.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={6} className="p-2 border border-slate-300">إجمالي المديونيات المستحقة على العملاء:</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-rose-700 font-black text-sm">
                        {formatCurrency(totalDebtAgingSum, settings.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* NEW REPORT 4: SUPPLIERS LEDGER (كشف حساب الموردين ومطابقة الفواتير) */}
          {/* ========================================================================= */}
          {reportType === 'suppliers_ledger' && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-black text-slate-900">
                    كشف حساب المورد: {targetSupplier?.name || 'مورد غير محدد'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    هاتف: {targetSupplier?.phone || '—'} • رصيد افتتاحي: {formatCurrency(supplierOpeningBalance, settings.currency)}
                  </p>
                </div>
                <div className="text-right sm:text-left">
                  <span className="text-[10px] text-slate-500 block font-bold">الرصيد المتبقي للمورد في ذمتنا</span>
                  <span className="text-sm font-black font-mono text-rose-700">
                    {formatCurrency(supRunningBal, settings.currency)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[700px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800 text-center">التاريخ</th>
                      <th className="p-2 border border-slate-800">نوع الحركة / المستند</th>
                      <th className="p-2 border border-slate-800">البيان والتفاصيل</th>
                      <th className="p-2 border border-slate-800 text-center">قيمة التوريد (لنا)</th>
                      <th className="p-2 border border-slate-800 text-center">المسدد نقداً (منه)</th>
                      <th className="p-2 border border-slate-800 text-center">الآجل المضاف للمورد</th>
                      <th className="p-2 border border-slate-800 text-center">الرصيد التراكمي للمورد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {supplierLedgerWithBalance.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">{item.date}</td>
                        <td className="p-2 border border-slate-200 font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            item.type === 'purchase' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.docName}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-slate-700">{item.description}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold">
                          {item.totalCost > 0 ? item.totalCost.toFixed(2) : '-'}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-emerald-700 font-bold">
                          {item.paidImmediate > 0 ? item.paidImmediate.toFixed(2) : item.paymentMade > 0 ? item.paymentMade.toFixed(2) : '-'}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-rose-700 font-bold">
                          {item.creditAdded > 0 ? `+${item.creditAdded.toFixed(2)}` : '-'}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-slate-900 bg-slate-50">
                          {item.runningBalance.toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    ))}
                    {supplierLedgerWithBalance.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 font-medium">
                          لا توجد حركات مسجلة لهذا المورد خلال الفترة المحددة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={7} className="p-2 border border-slate-300">الرصيد الختامي المستحق للمورد:</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-rose-700 font-black text-sm bg-slate-200">
                        {supRunningBal.toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* NEW REPORT 5: CASHIER SHIFT RECONCILIATION (إغلاق الوردية والدرج) */}
          {/* ========================================================================= */}
          {reportType === 'shift' && (
            <div className="py-4 space-y-4">
              <p className="text-xs font-bold text-amber-900 bg-amber-50 border border-amber-200 rounded-lg p-2">
                مطابقة الرصيد الحالي من كامل السجلات منذ رصيد فتح الصندوق؛ فلتر التاريخ لا يغير هذا الرصيد. لا يمكن عزل وردية سابقة دون رصيد فتح مستقل لها.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-black text-slate-900">مقبوضات الوردية النقدية (داخل الدرج)</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">رصيد فتح الصندوق:</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(shiftOpeningCash, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">المقبوض كاش من فواتير البيع:</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(shiftCashCollected, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">المقبوض نقداً من سداد ديون العملاء:</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(shiftCustomerCashPayments, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">استرداد نقدي من مردود مشتريات:</span>
                      <span className="font-mono font-bold text-slate-900">{formatCurrency(shiftPurchaseCashRefunds, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 font-black text-emerald-700">
                      <span>إجمالي النقدية الداخلة:</span>
                      <span className="font-mono">+{formatCurrency(shiftCashInflow, settings.currency)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h3 className="text-xs font-black text-slate-900">المدفوعات النقدية الخارجة من الدرج</h3>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-600">مصروفات ونثريات نقدية:</span>
                      <span className="font-mono font-bold text-rose-700">-{formatCurrency(shiftCashExpenses, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">مشتريات بضاعة كاش:</span>
                      <span className="font-mono font-bold text-rose-700">-{formatCurrency(shiftCashPurchases, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">دفعات مسددة للموردين نقداً:</span>
                      <span className="font-mono font-bold text-rose-700">-{formatCurrency(shiftSupplierCashPayments, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">مسحوبات الشركاء النقدية:</span>
                      <span className="font-mono font-bold text-rose-700">-{formatCurrency(shiftPartnerCashDrawings, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">رواتب وسلف نقدية:</span>
                      <span className="font-mono font-bold text-rose-700">-{formatCurrency(shiftWorkerCashSalaries + shiftWorkerCashAdvances, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">مردود مبيعات نقدي وتوزيع شركاء:</span>
                      <span className="font-mono font-bold text-rose-700">-{formatCurrency(shiftSalesCashRefunds + shiftPartnerCashDistributions, settings.currency)}</span>
                    </div>
                    <div className="flex justify-between pt-1.5 border-t border-slate-200 font-black text-rose-700">
                      <span>إجمالي النقدية الخارجة:</span>
                      <span className="font-mono">-{formatCurrency(shiftCashOutflow, settings.currency)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Drawer Counting Box */}
              <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black">مطابقة رصيد الدرج الفعلي (الجرد النقدي)</h3>
                    <p className="text-[11px] text-slate-300">قارن الرصيد المحسوب بالنظام مع المبلغ الفعلي الموجود بالصندوق</p>
                  </div>
                  <div className="text-right sm:text-left">
                    <span className="text-[10px] text-slate-400 block font-bold">الرصيد الدفتري المتوقع</span>
                    <span className="text-lg font-black font-mono text-emerald-400">
                      {formatCurrency(expectedDrawerCash, settings.currency)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-slate-800 print:hidden">
                  <label className="text-xs font-bold text-slate-300">أدخل المبلغ الفعلي المعدود بالدرج:</label>
                  <input
                    type="number"
                    step="0.01"
                    placeholder={expectedDrawerCash.toFixed(2)}
                    value={cashierActualCash}
                    onChange={(e) => setCashierActualCash(e.target.value)}
                    className="w-full sm:w-48 px-3 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white font-mono font-bold text-center focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                  <div className={`px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 ${
                    cashDiff === 0 ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    cashDiff > 0 ? 'bg-blue-950 text-blue-300 border border-blue-800' :
                    'bg-rose-950 text-rose-300 border border-rose-800'
                  }`}>
                    {cashDiff === 0 ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                    <span>
                      {cashDiff === 0 ? 'مطابقة تامة 100% (لا يوجد عجز)' :
                       cashDiff > 0 ? `يوجد زيادة بالدرج: +${cashDiff.toFixed(2)} ${settings.currency}` :
                       `يوجد عجز بالدرج: ${cashDiff.toFixed(2)} ${settings.currency}`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* NEW REPORT 6: WEIGHT SHRINKAGE (معدل الهدر وعجز الميزان) */}
          {/* ========================================================================= */}
          {reportType === 'shrinkage' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">صافي الوزن الوارد (بعد المردود)</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatWeight(totalPurKgAll)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">صافي الوزن المباع + التالف المسجل</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">
                    {formatWeight(productShrinkage.reduce((s, p) => s + p.soldKg + p.damagedKg, 0))}
                  </span>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold block">العجز غير المسجل</span>
                  <span className="text-xs sm:text-sm font-black text-amber-900 block">يتطلب جرداً فعلياً</span>
                </div>
                <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">قيمة الهالك المسجل فقط</span>
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block">{formatCurrency(totalRecordedDamageLoss, settings.currency)}</span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[700px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800">اسم الصنف</th>
                      <th className="p-2 border border-slate-800 text-center">الوارد الصافي (كغم)</th>
                      <th className="p-2 border border-slate-800 text-center">المباع الصافي (كغم)</th>
                      <th className="p-2 border border-slate-800 text-center">التالف المسجل (كغم)</th>
                      <th className="p-2 border border-slate-800 text-center">العجز غير المسجل</th>
                      <th className="p-2 border border-slate-800 text-center">حالة التحقق</th>
                      <th className="p-2 border border-slate-800 text-center">خسارة الهالك المسجل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {productShrinkage.map((p, idx) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">{p.name}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{formatWeight(p.purKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-emerald-700">{formatWeight(p.soldKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-rose-600">{formatWeight(p.damagedKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-bold text-amber-800">—</td>
                        <td className="p-2 border border-slate-200 text-center text-amber-800">بانتظار جرد فعلي</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-rose-700">
                          {formatCurrency(p.damagedLoss, settings.currency)}
                        </td>
                      </tr>
                    ))}
                    {productShrinkage.length === 0 && (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400 font-medium">
                          لا توجد بيانات مقارنة للأوزان والمشتريات خلال الفترة المحددة.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={2} className="p-2 border border-slate-300">الإجمالي العام:</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{formatWeight(totalPurKgAll)}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{formatWeight(productShrinkage.reduce((s, p) => s + p.soldKg, 0))}</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{formatWeight(productShrinkage.reduce((s, p) => s + p.damagedKg, 0))}</td>
                      <td className="p-2 border border-slate-300 text-center text-amber-900 font-black">—</td>
                      <td className="p-2 border border-slate-300 text-center">بانتظار جرد فعلي</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-rose-700 font-black text-sm">
                        {formatCurrency(totalRecordedDamageLoss, settings.currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* EXISTING REPORTS: 1. SALES REPORT TABLE */}
          {/* ========================================================================= */}
          {reportType === 'sales' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-slate-500 block truncate">إجمالي المبيعات</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block truncate">{formatCurrency(totalGrossSales, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-rose-600 font-bold block truncate">مردودات مبيعات (-)</span>
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block truncate">-{formatCurrency(totalSalesReturnsAmount, settings.currency)}</span>
                </div>
                <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-200 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-emerald-800 font-black block truncate">صافي المبيعات (=)</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block truncate">{formatCurrency(totalNetSales, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 min-w-0 overflow-hidden">
                      <span className="text-[10px] text-slate-500 block truncate">المحصل نقداً من الفواتير</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block truncate">{formatCurrency(totalCashCollected, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-slate-500 block truncate">صافي الائتمان بعد المرتجعات</span>
                  <span className="text-xs sm:text-sm font-black text-amber-800 font-mono block truncate">{formatCurrency(totalCreditSales, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100 min-w-0 overflow-hidden">
                  <span className="text-[10px] text-slate-500 block truncate">الوزن الصافي المباع</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block truncate">{formatWeight(totalNetKgSold)}</span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[700px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800 text-center">رقم الفاتورة</th>
                      <th className="p-2 border border-slate-800">التاريخ والوقت</th>
                      <th className="p-2 border border-slate-800">اسم العميل</th>
                      <th className="p-2 border border-slate-800 text-center">طريقة الدفع</th>
                      <th className="p-2 border border-slate-800 text-center">العبوات</th>
                      <th className="p-2 border border-slate-800 text-center">الوزن الصافي</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي الفاتورة</th>
                      <th className="p-2 border border-slate-800 text-center">المدفوع</th>
                      <th className="p-2 border border-slate-800 text-center">المتبقي دين</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {filteredInvoices.map((inv, idx) => (
                      <tr key={inv.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-600">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black">#{displayInvoiceNumber(inv)}</td>
                        <td className="p-2 border border-slate-200 text-slate-600">{inv.date} {inv.time}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">{inv.customerName}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            inv.saleType === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {inv.saleType === 'cash' ? 'نقدي' : 'آجل'}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-center">{inv.totalPackages}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{formatWeight((inv.items || []).reduce((sum, item) => sum + (Number(item.netWeight) || 0), 0))}</td>
                        <td className="p-2 border border-slate-200 text-center font-black font-mono">
                          {inv.finalTotal.toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-2 border border-slate-200 text-center text-emerald-700 font-mono">
                          {inv.paidAmount.toFixed(2)}
                        </td>
                        <td className="p-2 border border-slate-200 text-center text-amber-800 font-bold font-mono">
                          {inv.remainingDebt > 0 ? `${inv.remainingDebt.toFixed(2)}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={5} className="p-2 border border-slate-300">الصافي بعد مردودات المبيعات (المدفوع فورًا قبل المردود):</td>
                      <td className="p-2 border border-slate-300 text-center">{totalPackagesSold} عبوة</td>
                      <td className="p-2 border border-slate-300 text-center">{formatWeight(totalNetKgSold)}</td>
                      <td className="p-2 border border-slate-300 text-center text-sm font-black bg-slate-200">
                        {totalSalesRevenue.toFixed(2)} {settings.currency}
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-emerald-800">
                        {totalImmediatePaid.toFixed(2)}
                      </td>
                      <td className="p-2 border border-slate-300 text-center text-amber-900">
                        {totalCreditSales.toFixed(2)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 1.5. PURCHASES REPORT (المشتريات وتوريد البضاعة من الموردين) */}
          {/* ========================================================================= */}
          {reportType === 'purchases' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي تكلفة المشتريات</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatCurrency(totalGrossPurchasesCost, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-rose-600 font-bold block">مردودات مشتريات (-)</span>
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block">-{formatCurrency(totalPurchaseReturnsAmount, settings.currency)}</span>
                </div>
                <div className="bg-emerald-50/60 p-2 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-800 font-black block">صافي تكلفة المشتريات (=)</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block">{formatCurrency(totalPurchasesCost, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">الوزن الإجمالي الوارد</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatWeight(totalPurchasesKg)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">عدد العبوات / الصناديق</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{totalPurchasesPackages} عبوة</span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[700px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800 text-center">رقم الفاتورة</th>
                      <th className="p-2 border border-slate-800">التاريخ</th>
                      <th className="p-2 border border-slate-800">اسم المورد</th>
                      <th className="p-2 border border-slate-800">الصنف</th>
                      <th className="p-2 border border-slate-800 text-center">طريقة الدفع</th>
                      <th className="p-2 border border-slate-800 text-center">العبوات</th>
                      <th className="p-2 border border-slate-800 text-center">الوزن (كغم)</th>
                      <th className="p-2 border border-slate-800 text-center">سعر الكيلو</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي التكلفة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {filteredPurchases.map((pur, idx) => (
                      <tr key={pur.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-600">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black">#{pur.id}</td>
                        <td className="p-2 border border-slate-200 text-slate-600">{pur.date}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">{pur.supplierName || 'مورد عام'}</td>
                        <td className="p-2 border border-slate-200 font-semibold">{pur.productName}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            pur.paymentMethod === 'cash' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                          }`}>
                            {pur.paymentMethod === 'cash' ? 'نقدي' : 'آجل'}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{pur.packagesCount || '-'}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{formatWeight(pur.quantityKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold">{Number(pur.costPerKg).toFixed(2)}</td>
                        <td className="p-2 border border-slate-200 text-center font-black font-mono text-slate-900">
                          {Number(pur.totalCost).toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    ))}
                    {filteredPurchases.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-6 text-center text-slate-400">لا توجد فواتير مشتريات وتوريد في الفترة المحددة.</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={6} className="p-2 border border-slate-300">الصافي بعد مردودات المشتريات:</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{totalPurchasesPackages} عبوة</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{formatWeight(totalPurchasesKg)}</td>
                      <td className="p-2 border border-slate-300"></td>
                      <td className="p-2 border border-slate-300 text-center text-sm font-black bg-slate-200 font-mono">
                        {totalPurchasesCost.toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 1.8. RETURNS AUDIT REPORT (مردودات البيع والشراء بالسعر الأصلي) */}
          {/* ========================================================================= */}
          {reportType === 'returns' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي مبالغ مرتجعات المبيعات</span>
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block">-{formatCurrency(totalSalesReturnsAmount, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي مبالغ مستردات المشتريات</span>
                  <span className="text-xs sm:text-sm font-black text-emerald-700 font-mono block">+{formatCurrency(totalPurchaseReturnsAmount, settings.currency)}</span>
                </div>
                <div className="bg-slate-900 text-white p-2 rounded-lg">
                  <span className="text-[10px] text-slate-300 block">إجمالي أوزان المردودات</span>
                  <span className="text-xs sm:text-sm font-black font-mono block">{formatWeight(totalSalesReturnsKg + totalPurchaseReturnsKg)}</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black text-slate-800 mb-2">سجل مردودات المبيعات للعملاء</h3>
                <div className="overflow-x-auto w-full rounded-xl border border-slate-300 text-[11px]">
                  <table className="w-full min-w-[650px] text-right border-collapse">
                    <thead className="bg-slate-900 text-white text-[10px]">
                      <tr>
                        <th className="p-2 border border-slate-800">رقم الإرجاع</th>
                        <th className="p-2 border border-slate-800">التاريخ</th>
                        <th className="p-2 border border-slate-800">الفاتورة الأصلية</th>
                        <th className="p-2 border border-slate-800">العميل</th>
                        <th className="p-2 border border-slate-800">الصنف</th>
                        <th className="p-2 border border-slate-800 text-center">الوزن المرتجع</th>
                        <th className="p-2 border border-slate-800 text-center">سعر البيع الأصلي</th>
                        <th className="p-2 border border-slate-800 text-center">المبلغ المسترد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {salesReturnLines.map(({ ret, item, index }) => (
                        <tr key={`${ret.id}:${index}`} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold">#{ret.id}</td>
                          <td className="p-2 text-slate-600 font-mono">{ret.date}</td>
                          <td className="p-2 font-mono">#{ret.invoiceId || ret.originalInvoiceId}</td>
                          <td className="p-2 font-bold">{ret.customerName}</td>
                          <td className="p-2">{item.name || item.productName || ret.productName}</td>
                          <td className="p-2 text-center font-mono font-bold">{formatWeight(item.returnedWeight ?? ret.returnedNetWeight)}</td>
                          <td className="p-2 text-center font-mono">{Number(item.originalPricePerKg ?? ret.originalUnitPrice ?? 0).toFixed(2)}</td>
                          <td className="p-2 text-center font-mono font-black text-rose-700">{formatCurrency(item.subtotal ?? ret.totalRefundAmount, settings.currency)}</td>
                        </tr>
                      ))}
                      {filteredSalesReturns.length === 0 && (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-400">لا توجد مردودات مبيعات في الفترة المحددة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h3 className="text-xs font-black text-slate-800 mb-2">سجل مردودات المشتريات للموردين</h3>
                <div className="overflow-x-auto w-full rounded-xl border border-slate-300 text-[11px]">
                  <table className="w-full min-w-[650px] text-right border-collapse">
                    <thead className="bg-slate-900 text-white text-[10px]">
                      <tr>
                        <th className="p-2 border border-slate-800">رقم الإرجاع</th>
                        <th className="p-2 border border-slate-800">التاريخ</th>
                        <th className="p-2 border border-slate-800">فاتورة الشراء الأصلية</th>
                        <th className="p-2 border border-slate-800">المورد</th>
                        <th className="p-2 border border-slate-800">الصنف</th>
                        <th className="p-2 border border-slate-800 text-center">الوزن المرتجع</th>
                        <th className="p-2 border border-slate-800 text-center">التكلفة الأصلية للكيلو</th>
                        <th className="p-2 border border-slate-800 text-center">المبلغ المسترد</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredPurchaseReturns.map(ret => (
                        <tr key={ret.id} className="hover:bg-slate-50">
                          <td className="p-2 font-mono font-bold">#{ret.id}</td>
                          <td className="p-2 text-slate-600 font-mono">{ret.date}</td>
                          <td className="p-2 font-mono">#{ret.purchaseId}</td>
                          <td className="p-2 font-bold">{ret.supplierName}</td>
                          <td className="p-2">{ret.productName}</td>
                          <td className="p-2 text-center font-mono font-bold">{formatWeight(ret.returnedKg)}</td>
                          <td className="p-2 text-center font-mono">{Number(ret.originalCostPerKg || 0).toFixed(2)}</td>
                          <td className="p-2 text-center font-mono font-black text-emerald-700">{formatCurrency(ret.totalRefundAmount, settings.currency)}</td>
                        </tr>
                      ))}
                      {filteredPurchaseReturns.length === 0 && (
                        <tr><td colSpan={8} className="p-4 text-center text-slate-400">لا توجد مردودات مشتريات في الفترة المحددة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 2. CUSTOMER STATEMENT REPORT */}
          {/* ========================================================================= */}
          {reportType === 'customer' && (
            <div className="py-4 space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{targetCustomer?.name || 'عميل نقدي عام'}</h3>
                  <p className="text-xs text-slate-500">📞 {targetCustomer?.phone || 'بدون هاتف'} • 📍 {targetCustomer?.address || 'غير محدد'} • رصيد افتتاحي: {formatCurrency(customerOpeningBalance, settings.currency)}</p>
                </div>
                <div className="text-right sm:text-left">
                  <span className="text-[10px] text-slate-500 block font-bold">الرصيد النهائي المستحق عليه</span>
                  <span className="text-base font-black font-mono text-amber-900">
                    {formatCurrency(runningBal, settings.currency)}
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[700px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800 text-center">التاريخ</th>
                      <th className="p-2 border border-slate-800">نوع الحركة / المستند</th>
                      <th className="p-2 border border-slate-800">البيان والتفاصيل</th>
                      <th className="p-2 border border-slate-800 text-center">قيمة البضاعة (عليه)</th>
                      <th className="p-2 border border-slate-800 text-center">المسدد نقداً (له)</th>
                      <th className="p-2 border border-slate-800 text-center">الرصيد التراكمي المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {ledgerWithBalance.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">{item.date} {item.time || ''}</td>
                        <td className="p-2 border border-slate-200 font-bold">
                          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                            item.type === 'invoice' ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {item.docName}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-slate-700">{item.description}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold text-amber-900">
                          {item.debit > 0 ? item.debit.toFixed(2) : '-'}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold text-emerald-700">
                          {item.creditPaid > 0 ? item.creditPaid.toFixed(2) : item.paidImmediate > 0 ? `${item.paidImmediate.toFixed(2)} (فوري)` : '-'}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-slate-900 bg-slate-50">
                          {item.runningBalance.toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    ))}
                    {ledgerWithBalance.length === 0 && (
                      <tr>
                        <td colSpan={7} className="p-6 text-center text-slate-400 font-medium">
                          لا توجد حركات مسجلة لهذا العميل.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={6} className="p-2 border border-slate-300">الرصيد النهائي المستحق في ذمة العميل:</td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-amber-900 font-black text-sm bg-slate-200">
                        {runningBal.toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 3. PRODUCTS PERFORMANCE REPORT */}
          {/* ========================================================================= */}
          {reportType === 'products' && (
            <div className="py-4 space-y-4">
              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[600px] text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800">اسم الصنف</th>
                      <th className="p-2 border border-slate-800 text-center">الوحدة</th>
                      <th className="p-2 border border-slate-800 text-center">عدد العبوات</th>
                      <th className="p-2 border border-slate-800 text-center">الوزن الصافي المباع</th>
                      <th className="p-2 border border-slate-800 text-center">متوسط سعر الكيلو</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي الإيراد</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {productMargins.map((prod, idx) => (
                      <tr key={prod.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">
                          {prod.emoji || '🥬'} {prod.name}
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-semibold text-slate-600">{prod.unit || 'كجم'}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{prod.packagesCount}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-900">{formatWeight(prod.soldKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-700">{Number(prod.avgSellingPricePerKg).toFixed(2)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-emerald-800">
                          {prod.totalRevenue.toFixed(2)} {settings.currency}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 font-black text-slate-900 text-xs">
                      <td colSpan={4} className="p-2 border border-slate-300">الإجمالي العام:</td>
                      <td className="p-2 border border-slate-300 text-center font-mono">{formatWeight(productMargins.reduce((sum, p) => sum + p.soldKg, 0))}</td>
                      <td className="p-2 border border-slate-300"></td>
                      <td className="p-2 border border-slate-300 text-center font-mono text-emerald-900 font-black text-sm bg-slate-200">
                        {totalNetSales.toFixed(2)} {settings.currency}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4. EXPENSES & WASTAGE REPORT */}
          {/* ========================================================================= */}
          {reportType === 'expenses' && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="text-xs font-bold text-slate-700">إجمالي المصروفات والنثريات خلال الفترة</span>
                <span className="text-base font-black font-mono text-rose-700">{formatCurrency(generalExpensesAmount, settings.currency)}</span>
              </div>
              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[600px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800 text-center">التاريخ</th>
                      <th className="p-2 border border-slate-800">بند المصروف</th>
                      <th className="p-2 border border-slate-800 text-center">التصنيف</th>
                      <th className="p-2 border border-slate-800 text-center">المبلغ</th>
                      <th className="p-2 border border-slate-800">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {filteredExpenses.filter(e => !e.isSupplierPayment && !e.isWorkerPayment).map((exp, idx) => (
                      <tr key={exp.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">{exp.date}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">{exp.title}</td>
                        <td className="p-2 border border-slate-200 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {exp.category || 'نثريات'}
                          </span>
                        </td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-rose-700">
                          {Number(exp.amount).toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-2 border border-slate-200 text-slate-600">{exp.notes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 4.5. DAMAGED GOODS REPORT (تقرير التوالف) */}
          {/* ========================================================================= */}
          {reportType === 'damaged' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي وزن البضاعة التالفة</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatWeight(totalDamagedKg)}</span>
                </div>
                <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">إجمالي الخسائر المالية للتوالف</span>
                  <span className="text-xs sm:text-sm font-black text-rose-700 font-mono block">{formatCurrency(totalDamagedLoss, settings.currency)}</span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[600px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800 text-center">التاريخ</th>
                      <th className="p-2 border border-slate-800">الصنف التالف</th>
                      <th className="p-2 border border-slate-800 text-center">الوزن التالف</th>
                      <th className="p-2 border border-slate-800 text-center">تكلفة الكيلو</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي الخسارة</th>
                      <th className="p-2 border border-slate-800">السبب / الملاحظة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {filteredDamaged.map((dmg, idx) => (
                      <tr key={dmg.id} className="hover:bg-slate-50">
                        <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono text-slate-600">{dmg.date}</td>
                        <td className="p-2 border border-slate-200 font-bold text-slate-900">{dmg.productName}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-bold text-slate-800">{formatWeight(dmg.quantityKg)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono">{Number(dmg.costPerKg).toFixed(2)}</td>
                        <td className="p-2 border border-slate-200 text-center font-mono font-black text-rose-700">
                          {Number(dmg.totalLoss).toFixed(2)} {settings.currency}
                        </td>
                        <td className="p-2 border border-slate-200 text-slate-600">{dmg.reason || 'تلف طبيعي / فرز'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 5. PAYROLL REPORT */}
          {/* ========================================================================= */}
          {reportType === 'payroll' && (
            <div className="py-4 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي الرواتب المسددة</span>
                  <span className="text-xs sm:text-sm font-black text-slate-900 font-mono block">{formatCurrency(totalSalariesPaid, settings.currency)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-slate-100">
                  <span className="text-[10px] text-slate-500 block">إجمالي السلفيات الممنوحة</span>
                  <span className="text-xs sm:text-sm font-black text-amber-800 font-mono block">{formatCurrency(totalAdvancesGiven, settings.currency)}</span>
                </div>
              </div>

              <div className="overflow-x-auto w-full rounded-xl border border-slate-300">
                <table className="w-full min-w-[600px] text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[10px]">
                      <th className="p-2 border border-slate-800 text-center w-8">م</th>
                      <th className="p-2 border border-slate-800">اسم العامل</th>
                      <th className="p-2 border border-slate-800 text-center">الوظيفة</th>
                      <th className="p-2 border border-slate-800 text-center">الراتب الأساسي</th>
                      <th className="p-2 border border-slate-800 text-center">إجمالي السلف</th>
                      <th className="p-2 border border-slate-800 text-center">الرواتب المستلمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-[11px]">
                    {workers.map((w, idx) => {
                      const workerTxs = filteredWorkerTxs.filter(t => t.workerId === w.id);
                      const salaries = workerTxs.filter(t => t.type === 'salary_payment').reduce((s, t) => s + Number(t.amount || 0), 0);
                      const advances = workerTxs.filter(t => t.type === 'advance').reduce((s, t) => s + Number(t.amount || 0), 0);
                      return (
                        <tr key={w.id} className="hover:bg-slate-50">
                          <td className="p-2 border border-slate-200 text-center font-bold text-slate-500">{idx + 1}</td>
                          <td className="p-2 border border-slate-200 font-bold text-slate-900">{w.name}</td>
                          <td className="p-2 border border-slate-200 text-center text-slate-600">{w.role || 'عامل'}</td>
                          <td className="p-2 border border-slate-200 text-center font-mono">{Number(w.monthlySalary || 0).toFixed(2)}</td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-amber-800">{advances.toFixed(2)}</td>
                          <td className="p-2 border border-slate-200 text-center font-mono font-bold text-emerald-700">{salaries.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 6. P&L COMPREHENSIVE INCOME STATEMENT */}
          {/* ========================================================================= */}
          {reportType === 'pnl' && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">قائمة الدخل وصافي الأرباح والخسائر الشاملة</h3>
                  <p className="text-[10px] text-slate-300">محاسبة أرباح النشاط بعد استقطاع تكلفة البضاعة والمصاريف والأجور وتوالف الميزان</p>
                </div>
                <div className="text-right sm:text-left">
                  <span className="text-[10px] text-slate-400 block font-bold">صافي الربح النهائي للنشاط</span>
                  <span className={`text-base font-black font-mono ${netEstimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(netEstimatedProfit, settings.currency)}
                  </span>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-black text-slate-900 border-b border-slate-200 pb-1.5">1. الإيرادات والمبيعات التشغيلية</h4>
                  <div className="flex justify-between text-slate-700">
                    <span>إجمالي مبيعات البضاعة:</span>
                    <span className="font-mono font-bold">{formatCurrency(totalGrossSales, settings.currency)}</span>
                  </div>
                  <div className="flex justify-between text-rose-700">
                    <span>يخصم: مردودات المبيعات للزبائن:</span>
                    <span className="font-mono font-bold">-{formatCurrency(totalSalesReturnsAmount, settings.currency)}</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>صافي إيراد المبيعات (=):</span>
                    <span className="font-mono">{formatCurrency(totalNetSales, settings.currency)}</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-black text-slate-900 border-b border-slate-200 pb-1.5">2. تكلفة البضاعة المباعة حسب تكلفة الفواتير الأصلية</h4>
                  <div className="flex justify-between text-slate-700">
                    <span>تكلفة الأصناف المباعة:</span>
                    <span className="font-mono font-bold">-{formatCurrency(reportSnapshot.cogs, settings.currency)}</span>
                  </div>
                  <div className="flex justify-between font-black text-slate-900 pt-1 border-t border-slate-200">
                    <span>صافي تكلفة البضاعة (=):</span>
                    <span className="font-mono text-rose-700">-{formatCurrency(reportSnapshot.cogs, settings.currency)}</span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between font-black text-emerald-900">
                  <span>مجمل الربح التجاري (Gross Profit):</span>
                  <span className="font-mono text-sm">{formatCurrency(grossTradeProfit, settings.currency)}</span>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <h4 className="font-black text-slate-900 border-b border-slate-200 pb-1.5">3. المصروفات التشغيلية والهدر</h4>
                  <div className="flex justify-between text-slate-700">
                    <span>المصروفات الإدارية والنثريات:</span>
                    <span className="font-mono font-bold text-rose-700">-{formatCurrency(generalExpensesAmount, settings.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>رواتب وأجور العمالة المسددة:</span>
                    <span className="font-mono font-bold text-rose-700">-{formatCurrency(totalSalariesPaid, settings.currency)}</span>
                  </div>
                  <div className="flex justify-between text-slate-700">
                    <span>خسائر التوالف وإعدام البضاعة:</span>
                    <span className="font-mono font-bold text-rose-700">-{formatCurrency(totalDamagedLoss, settings.currency)}</span>
                  </div>
                </div>

                <div className="p-4 bg-slate-900 text-white rounded-xl flex justify-between items-center font-black">
                  <span className="text-sm">صافي الأرباح التشغيلية النهائية (Net Profit):</span>
                  <span className={`text-base font-mono ${netEstimatedProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {formatCurrency(netEstimatedProfit, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 7. AUDIT & FINANCIAL POSITION (الجرد ومطابقة السيولة) */}
          {/* ========================================================================= */}
          {reportType === 'audit' && (
            <div className="py-4 space-y-4">
              <div className="p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black">تقرير جرد الخزينة والمركز المالي الشامل</h3>
                  <p className="text-[10px] text-slate-300">تحديد أماكن تواجد السيولة والأصول والالتزامات</p>
                </div>
                <div className="text-right sm:text-left">
                  <span className="text-[10px] text-slate-400 block font-bold">صافي السيولة والذمم</span>
                  <span className="text-base font-black font-mono text-emerald-400">
                    {formatCurrency(finPos?.totalWorkingCapital || 0, settings.currency)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">نقدية الصندوق (الدرج)</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-1">
                    {formatCurrency(finPos?.cashBalance || 0, settings.currency)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] text-slate-500 block">الأرصدة البنكية</span>
                  <span className="text-sm font-black font-mono text-slate-900 block mt-1">
                    {formatCurrency(finPos?.bankBalance || 0, settings.currency)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <span className="text-[10px] text-amber-800 font-bold block">ديون السوق (لنا عند العملاء)</span>
                  <span className="text-sm font-black font-mono text-amber-900 block mt-1">
                    {formatCurrency(finPos?.totalCustomersDebt || 0, settings.currency)}
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-[10px] text-rose-800 font-bold block">مستحقات الموردين (علينا للموردين)</span>
                  <span className="text-sm font-black font-mono text-rose-700 block mt-1">
                    {formatCurrency(finPos?.totalSuppliersDebt || 0, settings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* 8. PARTNERS & DRAWINGS REPORT */}
          {/* ========================================================================= */}
          {reportType === 'partners' && (
            <div className="py-4 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-900 mb-2">جدول حصص الشركاء والأرباح</h3>
                <div className="overflow-x-auto w-full rounded-xl border border-slate-300 text-xs">
                  <table className="w-full min-w-[550px] text-right border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold">
                      <tr>
                        <th className="p-2.5 border-b border-slate-300">اسم الشريك</th>
                        <th className="p-2.5 border-b border-slate-300 text-center">النسبة %</th>
                        <th className="p-2.5 border-b border-slate-300 text-center">إجمالي المسحوبات</th>
                        <th className="p-2.5 border-b border-slate-300 text-center">الأرباح الموزعة</th>
                        <th className="p-2.5 border-b border-slate-300 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {partners.map(p => {
                        const partnerDrawingsSum = partnerDrawings.filter(d => d.partnerId === p.id).reduce((sum, d) => sum + Number(d.amount || 0), 0);
                        const partnerProfitSum = profitDistributions.reduce((sum, dist) => {
                          const share = (dist.shares || []).find(s => s.partnerId === p.id);
                          return sum + Number(share?.netPayout ?? share?.amount ?? 0);
                        }, 0);
                        return (
                          <tr key={p.id}>
                            <td className="p-2 text-slate-900 font-bold">{p.name} {p.phone ? `(${p.phone})` : ''}</td>
                            <td className="p-2 text-center font-mono font-bold">{p.sharePercentage}%</td>
                            <td className="p-2 text-center font-mono font-bold text-amber-700">{formatCurrency(partnerDrawingsSum, settings.currency)}</td>
                            <td className="p-2 text-center font-mono font-bold text-emerald-700">{formatCurrency(partnerProfitSum, settings.currency)}</td>
                            <td className="p-2 text-center font-bold text-slate-700">شريك نشط</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Individual Partner Drawings */}
              <div>
                <h3 className="text-xs font-black text-slate-900 mb-2">
                  سجل المسحوبات النقدية والبنكية {selectedPartnerId !== 'all' ? `لـ (${partners.find(p => p.id === selectedPartnerId)?.name || ''})` : 'لكافة الشركاء'}
                </h3>
                <div className="overflow-x-auto w-full rounded-xl border border-slate-300 text-xs">
                  <table className="w-full min-w-[550px] text-right border-collapse">
                    <thead className="bg-slate-100 text-slate-800 font-bold">
                      <tr>
                        <th className="p-2.5 border-b border-slate-300">التاريخ والوقت</th>
                        <th className="p-2.5 border-b border-slate-300">الشريك</th>
                        <th className="p-2.5 border-b border-slate-300 text-center">المصدر</th>
                        <th className="p-2.5 border-b border-slate-300">البيان / الملاحظة</th>
                        <th className="p-2.5 border-b border-slate-300 text-center">المبلغ المسحوب</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {partnerDrawings
                        .filter(d => selectedPartnerId === 'all' || d.partnerId === selectedPartnerId)
                        .map(d => {
                          const partnerName = partners.find(p => p.id === d.partnerId)?.name || 'شريك';
                          return (
                            <tr key={d.id}>
                              <td className="p-2 text-slate-600 font-mono text-[11px]">{d.date} {d.time || ''}</td>
                              <td className="p-2 text-slate-900 font-bold">{partnerName}</td>
                              <td className="p-2 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  d.source === 'bank' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                                }`}>
                                  {d.source === 'bank' ? 'حساب بنكي' : 'نقدية من الدرج'}
                                </span>
                              </td>
                              <td className="p-2 text-slate-700">{d.notes || 'سحب نقدي تحت حساب الأرباح'}</td>
                              <td className="p-2 text-center font-mono font-bold text-amber-800">{formatCurrency(d.amount, settings.currency)}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* OFFICIAL SIGNATURES FOOTER */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-2 gap-8 pt-8 mt-6 border-t border-slate-300 text-center">
            <div className="space-y-6">
              <span className="text-xs font-bold text-slate-700 block">إعداد وتدقيق المحاسب</span>
              <div className="w-44 mx-auto border-b border-dashed border-slate-400"></div>
              <span className="text-[10px] text-slate-400 block">التوقيع والتاريخ</span>
            </div>

            <div className="space-y-6">
              <span className="text-xs font-bold text-slate-700 block">اعتماد الإدارة / صاحب المحل</span>
              <div className="w-44 mx-auto border-b border-dashed border-slate-400"></div>
              <span className="text-[10px] text-slate-400 block">الختم والاعتماد</span>
            </div>
          </div>

          <div className="pt-8 text-center text-[10px] text-slate-400 border-t border-slate-100 mt-6">
            تقرير صادر عن براكه (إصدار v{APP_VERSION}) • تم الاستخراج بتاريخ {todayStr}
          </div>

        </div>
      </div>

    </div>
  );
}
