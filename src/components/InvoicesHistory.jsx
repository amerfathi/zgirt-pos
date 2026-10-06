import React, { useState } from 'react';
import { 
  Search, Calendar, FileText, Printer, MessageCircle, 
  Trash2, Receipt, RotateCcw, ArrowDownLeft, ShieldCheck,
  CheckCircle2, AlertCircle, Sparkles, Store, LayoutList, LayoutGrid
} from 'lucide-react';
import { formatCurrency, formatWeight } from '../utils/formatters';
import { openWhatsAppInvoice } from '../utils/whatsapp';
import { displayInvoiceNumber } from '../services/invoiceIdentity';
import SalesReturnModal from './SalesReturnModal';
import { Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, EmptyState } from './ui';

export default function InvoicesHistory({ store, onViewReceipt, onViewA4Invoice }) {
  const { invoices, settings, voidInvoice, deleteInvoice, salesReturns = [], deleteSalesReturn, branches = [] } = store;
  const isBranchScoped = Array.isArray(store.currentUser?.branchIds);
  
  const [activeView, setActiveView] = useState('invoices'); // 'invoices' | 'returns'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('all'); // 'all' | 'cash' | 'credit' | 'voided'
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');
  const [selectedInvoiceForReturn, setSelectedInvoiceForReturn] = useState(null);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  const filteredInvoices = invoices.filter(inv => {
    // Branch Filter
    if (selectedBranchFilter !== 'all') {
      const bId = inv.branchId || 'branch-main';
      if (bId !== selectedBranchFilter) return false;
    }

    const matchSearch = 
      inv.id?.includes(searchTerm) || displayInvoiceNumber(inv).includes(searchTerm) ||
      (inv.customerName && inv.customerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (inv.customerPhone && inv.customerPhone.includes(searchTerm));

    if (!matchSearch) return false;

    if (filterType === 'cash') return inv.saleType === 'cash' && inv.status !== 'voided';
    if (filterType === 'credit') return inv.saleType === 'credit' && inv.status !== 'voided';
    if (filterType === 'voided') return inv.status === 'voided';

    return true;
  });

  const filteredReturns = (salesReturns || []).filter(ret => {
    return (
      ret.invoiceId?.includes(searchTerm) ||
      ret.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ret.id?.includes(searchTerm)
    );
  });

  const totalSalesAmount = invoices
    .filter(i => i.status !== 'voided')
    .reduce((sum, i) => sum + (Number(i.finalTotal) || 0), 0);

  const totalSalesReturnsAmount = (salesReturns || [])
    .reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);

  const netSalesAmount = Math.max(0, totalSalesAmount - totalSalesReturnsAmount);

  const totalCollectedCash = invoices
    .filter(i => i.status !== 'voided')
    .reduce((sum, i) => sum + (Number(i.paidAmount) || 0), 0);

  const totalCreditDebt = invoices
    .filter(i => i.status !== 'voided')
    .reduce((sum, i) => sum + (Number(i.remainingDebt) || 0), 0);

  const handleVoid = async (id) => {
    if (window.confirm(`هل أنت متأكد من إلغاء الفاتورة رقم #${id}؟ سيتم إلغاء تأثيرها المالي والديون المرتبطة بها.`)) {
      try { await voidInvoice(id); }
      catch (error) { alert('تعذر إلغاء الفاتورة: ' + error.message); }
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm(`هل أنت متأكد من حذف الفاتورة نهائياً #${id}؟`)) {
      try { await deleteInvoice(id); }
      catch (error) { alert('تعذر حذف الفاتورة: ' + error.message); }
    }
  };

  const handleDeleteReturn = async (returnId) => {
    if (window.confirm('هل أنت متأكد من حذف سند المردود هذا؟ سيتم التراجع عن إعادة البضاعة واسترداد المبالغ المالية.')) {
      try { await deleteSalesReturn(returnId); }
      catch (error) { alert('تعذر حذف سند المردود: ' + error.message); }
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Header & Quick stats */}
      <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-navy-50 text-navy-850 border border-navy-100 flex items-center justify-center font-bold text-lg shadow-2xs">
              📄
            </div>
            <div>
              <h1 className="text-base font-bold text-navy-850 leading-tight">سجل فواتير ومردودات المبيعات</h1>
              <p className="text-[11px] text-slate-500 font-medium">
                إجمالي الفواتير: {invoices.length} • سندات المردودات: {salesReturns.length}
              </p>
            </div>
          </div>

          {/* Tab Switcher: Invoices vs Sales Returns */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveView('invoices')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'invoices'
                  ? 'bg-white text-navy-850 shadow-2xs border border-slate-200/90'
                  : 'text-slate-600 hover:text-navy-850'
              }`}
            >
              <FileText size={14} />
              <span>فواتير المبيعات ({invoices.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveView('returns')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeView === 'returns'
                  ? 'bg-white text-amber-900 shadow-2xs border border-amber-200/80 font-bold'
                  : 'text-slate-600 hover:text-navy-850'
              }`}
            >
              <RotateCcw size={14} className={activeView === 'returns' ? 'text-amber-600' : 'text-slate-400'} />
              <span>سجل مردودات المبيعات ({salesReturns.length})</span>
            </button>
          </div>
        </div>

        {/* Financial Stat Pills with Net Sales */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-3 border-t border-slate-100 text-center">
          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">إجمالي المبيعات</span>
            <span className="text-xs sm:text-sm font-bold text-navy-850 font-mono mt-0.5 block">{formatCurrency(totalSalesAmount, settings.currency)}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">مردودات المبيعات</span>
            <span className="text-xs sm:text-sm font-bold text-amber-700 font-mono mt-0.5 block">-{formatCurrency(totalSalesReturnsAmount, settings.currency)}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">صافي المبيعات الفعلي</span>
            <span className="text-xs sm:text-sm font-bold text-navy-850 font-mono mt-0.5 block">{formatCurrency(netSalesAmount, settings.currency)}</span>
          </div>

          <div className="bg-white p-3 rounded-lg border border-slate-200/80 shadow-2xs">
            <span className="text-[11px] text-slate-500 block font-medium">الآجل (ديون العملاء)</span>
            <span className="text-xs sm:text-sm font-bold text-slate-800 font-mono mt-0.5 block">{formatCurrency(totalCreditDebt, settings.currency)}</span>
          </div>
        </div>
      </div>

      {/* Active View: Invoices List */}
      {activeView === 'invoices' && (
        <>
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute right-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="بحث برقم الفاتورة أو اسم العميل أو الهاتف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pr-10 pl-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-primary-500 shadow-2xs"
              />
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-1 items-center">
              {isBranchScoped && <span className="px-2.5 py-1.5 rounded-lg bg-primary-50 text-primary-700 text-xs font-bold">
                {store.activeBranch?.name || 'الفرع المحدد'}
              </span>}
              {!isBranchScoped && branches.length > 1 && (
                <select
                  value={selectedBranchFilter}
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 shadow-2xs cursor-pointer focus:outline-none focus:border-primary-500 shrink-0"
                >
                  <option value="all">جميع الفروع ({invoices.length})</option>
                  {branches.map(b => {
                    const count = invoices.filter(i => (i.branchId || 'branch-main') === b.id).length;
                    return (
                      <option key={b.id} value={b.id}>
                        {b.name} ({count})
                      </option>
                    );
                  })}
                </select>
              )}

              {[
                { id: 'all', label: 'الكل' },
                { id: 'cash', label: 'نقدي' },
                { id: 'credit', label: 'آجل' },
                { id: 'voided', label: 'الملغاة' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    filterType === tab.id
                      ? 'bg-navy-850 text-white shadow-2xs font-bold'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 font-medium'
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* View Switcher (Table vs Cards on Desktop) */}
              <div className="hidden md:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 mr-auto">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === 'table' ? 'bg-white text-navy-850 shadow-2xs font-bold' : 'text-slate-500 hover:text-navy-850'
                  }`}
                  title="عرض كجدول محاسبي مفصل"
                >
                  <LayoutList size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('cards')}
                  className={`p-1.5 rounded-md transition-all cursor-pointer ${
                    viewMode === 'cards' ? 'bg-white text-navy-850 shadow-2xs font-bold' : 'text-slate-500 hover:text-navy-850'
                  }`}
                  title="عرض كبطاقات"
                >
                  <LayoutGrid size={14} />
                </button>
              </div>
            </div>
          </div>

          {filteredInvoices.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="لا توجد فواتير تطابق البحث"
              description="جرب البحث بكلمة أخرى أو قم بتغيير الفلاتر المختارة لاستعراض الفواتير."
            />
          ) : (
            <>
              {/* 1. Desktop Data Table View (when viewMode === 'table') */}
              {viewMode === 'table' && (
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead align="right">رقم الفاتورة</TableHead>
                        <TableHead align="right">التاريخ والوقت</TableHead>
                        <TableHead align="right">العميل</TableHead>
                        <TableHead align="right">الفرع</TableHead>
                        <TableHead align="center">طريقة البيع</TableHead>
                        <TableHead align="left">الإجمالي</TableHead>
                        <TableHead align="left">المدفوع</TableHead>
                        <TableHead align="left">المتبقي</TableHead>
                        <TableHead align="center">الحالة</TableHead>
                        <TableHead align="center">إجراءات</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => {
                        const isVoided = invoice.status === 'voided';
                        const hasReturns = invoice.hasReturns || (invoice.totalReturnedAmount && Number(invoice.totalReturnedAmount) > 0);
                        const saleBadgeVariant = invoice.saleType === 'cash' ? 'success' : invoice.saleType === 'credit' ? 'warning' : 'neutral';
                        const saleTypeLabel = invoice.saleType === 'cash' ? 'نقدي' : invoice.saleType === 'credit' ? 'آجل' : invoice.saleType === 'bank' ? 'بنك' : 'مقسم';

                        return (
                          <TableRow key={invoice.id} className={isVoided ? 'opacity-60 bg-rose-50/20' : ''}>
                            <TableCell isNumeric align="right" className="font-bold text-navy-850">
                              #{displayInvoiceNumber(invoice)}
                            </TableCell>
                            <TableCell align="right" className="text-slate-500 text-[11px]">
                              {invoice.date} {invoice.time && <span className="font-mono text-slate-400">• {invoice.time}</span>}
                            </TableCell>
                            <TableCell align="right">
                              <span className="font-semibold text-slate-800 block truncate max-w-[140px]">
                                {invoice.customerName || 'زبون عام'}
                              </span>
                              {invoice.customerPhone && (
                                <span className="text-[10px] text-slate-400 font-mono block">
                                  {invoice.customerPhone}
                                </span>
                              )}
                            </TableCell>
                            <TableCell align="right" className="text-slate-500 text-[11px]">
                              {invoice.branchName || 'الفرع الرئيسي'}
                            </TableCell>
                            <TableCell align="center">
                              <Badge variant={saleBadgeVariant} size="sm">
                                {saleTypeLabel}
                              </Badge>
                            </TableCell>
                            <TableCell isNumeric align="left" className="font-bold text-navy-850">
                              {formatCurrency(invoice.finalTotal, settings.currency)}
                            </TableCell>
                            <TableCell isNumeric align="left" className="text-emerald-700 font-medium">
                              {formatCurrency(invoice.paidAmount, settings.currency)}
                            </TableCell>
                            <TableCell isNumeric align="left" className={Number(invoice.remainingDebt) > 0 ? 'text-amber-800 font-bold' : 'text-slate-400'}>
                              {Number(invoice.remainingDebt) > 0 ? formatCurrency(invoice.remainingDebt, settings.currency) : '—'}
                            </TableCell>
                            <TableCell align="center">
                              {isVoided ? (
                                <Badge variant="danger" size="sm">ملغاة</Badge>
                              ) : hasReturns ? (
                                <Badge variant="warning" size="sm">مردود</Badge>
                              ) : (
                                <Badge variant="success" size="sm">معتمدة</Badge>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => onViewA4Invoice(invoice)}
                                  icon={Printer}
                                  title="عرض كتقرير رسمي A4"
                                >
                                  A4
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => onViewReceipt(invoice)}
                                  icon={Receipt}
                                  title="إيصال حراري"
                                />
                                {!isVoided && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setSelectedInvoiceForReturn(invoice)}
                                    icon={RotateCcw}
                                    title="مردود مبيعات"
                                  />
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openWhatsAppInvoice(invoice, settings)}
                                  icon={MessageCircle}
                                  title="إرسال واتساب"
                                  className="text-emerald-600 hover:text-emerald-700"
                                />
                                {!isVoided ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleVoid(invoice.id)}
                                    className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-[11px]"
                                    title="إلغاء الفاتورة"
                                  >
                                    إلغاء
                                  </Button>
                                ) : (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDelete(invoice.id)}
                                    icon={Trash2}
                                    className="text-slate-400 hover:text-rose-600"
                                    title="حذف نهائي"
                                  />
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* 2. Mobile Cards View (and desktop fallback when cards mode active) */}
              <div className={`space-y-3 ${viewMode === 'table' ? 'md:hidden' : ''}`}>
                {filteredInvoices.map((invoice) => {
                  const isVoided = invoice.status === 'voided';
                const hasReturns = invoice.hasReturns || (invoice.totalReturnedAmount && Number(invoice.totalReturnedAmount) > 0);

                return (
                  <div
                    key={invoice.id}
                    className={`bg-white rounded-2xl p-4 border transition-all space-y-3 shadow-2xs ${
                      isVoided
                        ? 'border-rose-200 bg-rose-50/20 opacity-70'
                        : hasReturns
                        ? 'border-amber-200/90'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Invoice Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-sm text-navy-850 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                          #{displayInvoiceNumber(invoice)}
                        </span>

                        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          invoice.saleType === 'cash' 
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200/70' 
                            : invoice.saleType === 'credit'
                            ? 'bg-amber-50 text-amber-800 border-amber-200/70'
                            : invoice.saleType === 'bank'
                            ? 'bg-slate-100 text-slate-700 border-slate-200'
                            : 'bg-primary-50 text-primary-700 border-primary-100'
                        }`}>
                          {invoice.saleType === 'cash' ? 'نقدي' : invoice.saleType === 'credit' ? 'آجل' : invoice.saleType === 'bank' ? 'بنك' : 'مقسم'}
                        </span>

                        {invoice.branchName && (
                          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] bg-slate-50 text-slate-600 font-medium px-2 py-0.5 rounded-md border border-slate-200">
                            <Store size={11} className="text-slate-400" />
                            <span>{invoice.branchName}</span>
                          </span>
                        )}

                        {hasReturns && (
                          <span className="text-[10px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-md border border-amber-200 flex items-center gap-1">
                            <RotateCcw size={10} />
                            <span>مردود: {formatCurrency(invoice.totalReturnedAmount, settings.currency)}</span>
                          </span>
                        )}

                        {isVoided && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                            ملغاة
                          </span>
                        )}
                      </div>

                      <div className="text-right">
                        <span className="text-base sm:text-lg font-bold text-navy-850 block font-mono">
                          {formatCurrency(invoice.finalTotal, settings.currency)}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {invoice.date} {invoice.time && `• ${invoice.time}`}
                        </span>
                      </div>
                    </div>

                    {/* Customer Info & Debt Breakdown */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900">{invoice.customerName || 'زبون عام'}</span>
                        {invoice.customerPhone && (
                          <span className="text-slate-400 font-mono text-[11px]">({invoice.customerPhone})</span>
                        )}
                      </div>

                      <div className="text-right">
                        {Number(invoice.remainingDebt) > 0 && (
                          <span className="text-[10px] font-bold text-amber-700 block">
                            متبقي دين: {formatCurrency(invoice.remainingDebt, settings.currency)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Items Chips Preview with exact historical price */}
                    <div className="flex flex-wrap gap-1.5 pb-1">
                      {(invoice.items || []).map((it, idx) => (
                        <span key={idx} className="text-[10px] font-semibold bg-slate-50 text-slate-700 px-2 py-0.5 rounded-md border border-slate-200">
                          {it.name} ({it.netWeight} كجم × {it.pricePerKg} {settings.currency})
                          {Number(it.returnedWeight || 0) > 0 && (
                            <span className="text-amber-700 font-bold ml-1">(ارتجع: {it.returnedWeight} كجم)</span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Card Actions */}
                    <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {/* A4 Invoice Print */}
                        <button
                          type="button"
                          onClick={() => onViewA4Invoice(invoice)}
                          className="px-2.5 py-1.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          <Printer size={13} />
                          <span>فاتورة A4</span>
                        </button>

                        {/* Thermal receipt */}
                        <button
                          type="button"
                          onClick={() => onViewReceipt(invoice)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors border border-slate-200 cursor-pointer shadow-2xs"
                          title="عرض كإيصال حراري صغير"
                        >
                          <Receipt size={13} className="text-slate-500" />
                          <span className="hidden sm:inline">إيصال حراري</span>
                        </button>

                        {/* Sales Return Button */}
                        {!isVoided && (
                          <button
                            type="button"
                            onClick={() => setSelectedInvoiceForReturn(invoice)}
                            className="px-2.5 py-1.5 bg-white hover:bg-amber-50 text-amber-800 border border-amber-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                            title="تسجيل إرجاع صنف / مردود مبيعات بالسعر التاريخي الأصلي"
                          >
                            <RotateCcw size={13} className="text-amber-600" />
                            <span>مردود مبيعات</span>
                          </button>
                        )}

                        {/* WhatsApp */}
                        <button
                          type="button"
                          onClick={() => openWhatsAppInvoice(invoice, settings)}
                          className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                        >
                          <MessageCircle size={13} className="text-emerald-600" />
                          <span>واتساب</span>
                        </button>
                      </div>

                      {!isVoided ? (
                        <button
                          type="button"
                          onClick={() => handleVoid(invoice.id)}
                          className="text-xs text-rose-600 hover:text-rose-700 font-semibold p-1 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                          title="إلغاء الفاتورة"
                        >
                          إلغاء الفاتورة
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDelete(invoice.id)}
                          className="text-xs text-slate-400 hover:text-rose-600 font-semibold p-1 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1 cursor-pointer"
                          title="حذف نهائي"
                        >
                          <Trash2 size={13} />
                          <span>حذف</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              </div>
            </>
          )}
        </>
      )}

      {/* Active View: Sales Returns Registry */}
      {activeView === 'returns' && (
        <div className="space-y-3">
          <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
            <ShieldCheck size={20} className="text-amber-800 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 leading-relaxed">
              <strong>سجل مردودات المبيعات المعتمد:</strong> يوثق جميع الأصناف والكميات المعادة من العملاء، حيث تم احتساب كل صنف على أساس <strong>سعر البيع التاريخي الأصلي بالفاتورة حصراً</strong> دون التأثر بأي تعديلات في أسعار المحل الحالية.
            </div>
          </div>

          {filteredReturns.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-2">
              <RotateCcw size={36} className="mx-auto text-slate-300" />
              <p className="text-sm font-bold text-slate-600">لا توجد مردودات مبيعات مسجلة حتى الآن</p>
              <p className="text-xs text-slate-400">لتسجيل مردود، اختر الفاتورة المطلوبة واضغط على زر "مردود مبيعات"</p>
            </div>
          ) : (
            filteredReturns.map((ret) => (
              <div 
                key={ret.id} 
                className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 shadow-xs"
              >
                <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                      سند #{ret.id?.replace('ret-sale-', '')}
                    </span>
                    <span className="text-xs font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded-md">
                      فاتورة أصلية #{ret.invoiceId}
                    </span>
                    <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      طريقة الرد: {
                        ret.refundMethod === 'credit_deduction' 
                          ? 'خصم من دين العميل' 
                          : ret.refundMethod === 'cash' 
                          ? 'نقدي (خزينة)' 
                          : 'تحويل بنكي'
                      }
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-base font-black text-amber-800 font-mono">
                      -{formatCurrency(ret.totalRefundAmount, settings.currency)}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium block">
                      {ret.date} {ret.time && `• ${ret.time}`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-600">
                  <div>
                    العميل: <strong className="text-slate-800">{ret.customerName || 'زبون عام'}</strong>
                  </div>
                  <div>
                    حالة البضاعة: <strong className={ret.inventoryAction === 'restock' ? 'text-emerald-700' : 'text-rose-700'}>
                      {ret.inventoryAction === 'restock' ? 'أعيدت للمخزن (صالحة)' : 'حولت لهالك وتوالف'}
                    </strong>
                  </div>
                </div>

                {/* Returned Items details */}
                <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 space-y-1">
                  <span className="text-[11px] font-bold text-slate-500 block">الأصناف المرتجعة بالسعر التاريخي:</span>
                  <div className="space-y-1">
                    {(ret.items || []).map((it, i) => (
                      <div key={i} className="flex items-center justify-between text-xs font-medium text-slate-700">
                        <span>• {it.name} ({formatWeight(it.returnedWeight)})</span>
                        <span className="font-mono text-slate-600">
                          {it.originalPricePerKg} {settings.currency}/كجم = <strong className="text-slate-900">{formatCurrency(it.subtotal, settings.currency)}</strong>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {ret.notes && (
                  <div className="text-[11px] text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md">
                    ملاحظات: {ret.notes}
                  </div>
                )}

                <div className="pt-1.5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteReturn(ret.id)}
                    className="text-xs text-slate-400 hover:text-red-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    title="حذف سند المردود والتراجع عنه"
                  >
                    <Trash2 size={13} />
                    <span>حذف سند المردود</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Sales Return Modal */}
      {selectedInvoiceForReturn && (
        <SalesReturnModal
          invoice={selectedInvoiceForReturn}
          store={store}
          onClose={() => setSelectedInvoiceForReturn(null)}
          onSuccess={() => {
            setSelectedInvoiceForReturn(null);
          }}
        />
      )}

    </div>
  );
}
