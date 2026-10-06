import React, { useRef, useState } from 'react';
import { 
  DollarSign, TrendingDown, Wallet, Plus, Trash2, Calendar, 
  ArrowDownLeft, Filter, Tag, FileText, CheckCircle2, Clock, User
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';
import { Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, EmptyState, Modal, Input, Select, StatCard } from './ui';

export default function ExpensesView({ store }) {
  const { 
    invoices = [], 
    expenses = [], 
    settings, 
    addExpense, 
    deleteExpense, 
    customerPayments = [], 
    purchases = [],
    expenseCategories = [],
    addExpenseCategory,
    deleteExpenseCategory
  } = store;

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const savingRef = useRef(false);
  const [filterCategory, setFilterCategory] = useState('all');
  const [isCustomCategoryMode, setIsCustomCategoryMode] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  const defaultCategories = ['عمالة يومية', 'نقل ومشال', 'كراتين وفارغ', 'فواتير ومحل', 'نثريات وصيانة', 'أخرى'];
  const allCategories = Array.from(new Set([
    ...defaultCategories,
    ...expenseCategories,
    ...expenses.map(e => e.category).filter(Boolean)
  ]));

  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'عمالة يومية',
    amount: '',
    recipientType: 'daily_worker', // 'daily_worker' | 'transport' | 'packaging' | 'rent_utility' | 'general'
    recipientName: '',
    hourlyRate: '',
    hoursWorked: '',
    notes: '',
  });

  const todayStr = getCurrentDateFormatted();

  // Financial Drawer Calculations for Today
  const todayInvoices = invoices.filter(inv => inv.date === todayStr && inv.status !== 'voided');
  const todayCashFromInvoices = todayInvoices.reduce((sum, inv) => sum + (Number(inv.cashAmount ?? inv.paidAmount) || 0), 0);
  
  const todayCustomerPayments = customerPayments.filter(p => p.date === todayStr);
  const todayCashFromCustomerDebts = todayCustomerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  
  const todayTotalCashIn = todayCashFromInvoices + todayCashFromCustomerDebts;

  const todayExpensesList = expenses.filter(exp => exp.date === todayStr);
  const todayExpensesTotal = todayExpensesList.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  const todayCashPurchases = purchases.filter(p => p.date === todayStr && p.paymentMethod === 'cash');
  const todayPurchasesTotal = todayCashPurchases.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

  const netDrawerCash = todayTotalCashIn - todayExpensesTotal - todayPurchasesTotal;

  // Filtered Expenses
  const filteredExpenses = expenses.filter(e => {
    if (filterCategory === 'all') return true;
    return e.category === filterCategory;
  });

  const handleAddExpense = async () => {
    if (savingRef.current) return;
    let finalAmount = Number(expenseForm.amount) || 0;

    // Determine category
    let finalCategory = expenseForm.category;
    if (isCustomCategoryMode && newCategoryInput.trim()) {
      finalCategory = newCategoryInput.trim();
    }

    // If calculated by hourly rate
    if (finalCategory === 'عمالة يومية' && expenseForm.hourlyRate && expenseForm.hoursWorked) {
      finalAmount = Number(expenseForm.hourlyRate) * Number(expenseForm.hoursWorked);
    }

    if (!expenseForm.title.trim() || finalAmount <= 0) {
      alert('يرجى إدخال بيان المصروف والمبلغ بشكل صحيح');
      return;
    }

    const titleWithDetails = expenseForm.recipientName 
      ? `${expenseForm.title} (${expenseForm.recipientName})`
      : expenseForm.title;

    savingRef.current = true;
    setIsSaving(true);
    try {
      await addExpense({
        title: titleWithDetails,
        category: finalCategory,
        amount: finalAmount,
        recipientName: expenseForm.recipientName || '',
        date: todayStr,
        time: getCurrentTimeFormatted(),
        notes: expenseForm.notes || (expenseForm.hoursWorked ? `${expenseForm.hoursWorked} ساعة × ${expenseForm.hourlyRate} ${settings.currency}` : '')
      });
      setExpenseForm({
        title: '', category: finalCategory, amount: '', recipientType: 'daily_worker',
        recipientName: '', hourlyRate: '', hoursWorked: '', notes: ''
      });
      setIsCustomCategoryMode(false);
      setNewCategoryInput('');
      setIsAddModalOpen(false);
    } catch (error) {
      alert('تعذر حفظ المصروف: ' + error.message);
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleDeleteExpense = async (id, title) => {
    if (window.confirm(`هل أنت متأكد من حذف المصروف: "${title}"؟`)) {
      try { await deleteExpense(id); }
      catch (error) { alert('تعذر حذف المصروف: ' + error.message); }
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Header & New Expense Button */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-850 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <TrendingDown size={18} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-navy-850 leading-tight">المصروفات ومصروفات اليومية</h1>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">سجل المصروفات النثرية، يوميات العمال العرضية، وأجور التحميل</p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsAddModalOpen(true)}
            icon={Plus}
          >
            تسجيل مصروف جديد
          </Button>
        </div>

        {/* Cash Drawer Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <StatCard
            title="صافي نقدية الدرج اليوم"
            value={formatCurrency(netDrawerCash, settings.currency)}
            icon={Wallet}
            iconBg="bg-primary-50 text-primary-700"
            subtitle={`المقبوض نقداً (${todayTotalCashIn.toFixed(2)}) - المصاريف`}
          />

          <StatCard
            title="إجمالي مصروفات اليوم"
            value={formatCurrency(todayExpensesTotal, settings.currency)}
            valueColor="text-rose-600"
            icon={TrendingDown}
            iconBg="bg-rose-50 text-rose-700"
            subtitle={`${todayExpensesList.length} سند صرف اليوم`}
          />

          <StatCard
            title="إجمالي المصروفات (التراكمي)"
            value={formatCurrency(expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0), settings.currency)}
            icon={FileText}
            iconBg="bg-slate-100 text-slate-700"
            subtitle={`${expenses.length} حركة مسجلة بالكامل`}
          />
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pt-1">
          <button
            type="button"
            onClick={() => setFilterCategory('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              filterCategory === 'all'
                ? 'bg-navy-850 text-white font-bold shadow-2xs'
                : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/90'
            }`}
          >
            جميع المصروفات ({expenses.length})
          </button>
          {allCategories.map(cat => {
            const count = expenses.filter(e => e.category === cat).length;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setFilterCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  filterCategory === cat
                    ? 'bg-navy-850 text-white font-bold shadow-2xs'
                    : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200/90'
                }`}
              >
                {cat} {count > 0 && <span className="opacity-70 text-[10px]">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expenses Feed Table / Cards */}
      {filteredExpenses.length === 0 ? (
        <EmptyState
          icon={TrendingDown}
          title="لا توجد مصروفات مسجلة في هذا القسم"
          description="اضغط على زر تسجيل مصروف جديد لإضافة أول بند صرف وخصمه تلقائياً من الدرج."
          actionLabel="تسجيل أول مصروف"
          onAction={() => setIsAddModalOpen(true)}
          actionIcon={Plus}
        />
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <tr>
                  <TableHead align="right">بيان المصروف</TableHead>
                  <TableHead align="center">التصنيف</TableHead>
                  <TableHead align="right">المستلم / التفاصيل</TableHead>
                  <TableHead align="center">التاريخ والوقت</TableHead>
                  <TableHead align="right">المبلغ المنصرف</TableHead>
                  <TableHead align="center" className="w-16">إجراءات</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {filteredExpenses.map(exp => (
                  <TableRow key={exp.id}>
                    <TableCell align="right">
                      <span className="font-bold text-slate-900 block truncate max-w-[200px]">
                        {exp.title}
                      </span>
                    </TableCell>

                    <TableCell align="center">
                      <Badge variant="neutral" size="sm">
                        {exp.category}
                      </Badge>
                    </TableCell>

                    <TableCell align="right">
                      <span className="text-slate-600 text-xs block truncate max-w-[160px]">
                        {exp.recipientName || '—'}
                      </span>
                      {exp.notes && (
                        <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                          {exp.notes}
                        </span>
                      )}
                    </TableCell>

                    <TableCell align="center" className="font-mono text-slate-400 text-[11px] whitespace-nowrap">
                      <div>{exp.date}</div>
                      {exp.time && <div className="text-[10px] text-slate-300">{exp.time}</div>}
                    </TableCell>

                    <TableCell isNumeric align="right">
                      <span className="font-mono font-bold text-rose-600 text-sm">
                        -{formatCurrency(exp.amount, settings.currency)}
                      </span>
                    </TableCell>

                    <TableCell align="center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteExpense(exp.id, exp.title)}
                        icon={Trash2}
                        className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="حذف المصروف"
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-2.5">
            {filteredExpenses.map(exp => (
              <div 
                key={exp.id} 
                className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-2xs flex items-center justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{exp.title}</span>
                    <Badge variant="neutral" size="sm">
                      {exp.category}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-mono text-[10px]">{exp.date} • {exp.time}</span>
                    {exp.recipientName && (
                      <span className="text-slate-600 font-medium">• المستلم: {exp.recipientName}</span>
                    )}
                    {exp.notes && (
                      <span className="text-slate-400 italic">({exp.notes})</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-sm font-bold font-mono text-rose-600">
                    -{formatCurrency(exp.amount, settings.currency)}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteExpense(exp.id, exp.title)}
                    icon={Trash2}
                    className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                    title="حذف المصروف"
                  />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Expense Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { if (!savingRef.current) setIsAddModalOpen(false); }}
        title="تسجيل مصروف جديد / يومية عمالة"
        subtitle="قيد وتوثيق المصروفات النثرية مع خصمها من نقدية الخزينة"
        maxWidth="max-w-md"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              disabled={isSaving}
              onClick={() => { if (!savingRef.current) setIsAddModalOpen(false); }}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              disabled={isSaving}
              onClick={handleAddExpense}
              icon={CheckCircle2}
            >
              حفظ وقيد المصروف
            </Button>
          </div>
        }
      >
        <div className="space-y-3.5">
          {/* Category selector */}
          <div className="space-y-1 text-right">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-semibold text-slate-700">نوع وبند المصروف <span className="text-rose-500 font-bold">*</span></label>
              <button
                type="button"
                onClick={() => {
                  setIsCustomCategoryMode(!isCustomCategoryMode);
                  if (!isCustomCategoryMode) setNewCategoryInput('');
                }}
                className="text-[11px] font-medium text-primary-600 hover:underline cursor-pointer"
              >
                {isCustomCategoryMode ? '← اختيار من التصنيفات السابقة' : '+ إضافة بند مخصص'}
              </button>
            </div>

            {!isCustomCategoryMode ? (
              <select
                value={expenseForm.category}
                onChange={(e) => {
                  if (e.target.value === '__custom__') {
                    setIsCustomCategoryMode(true);
                  } else {
                    setExpenseForm(prev => ({ 
                      ...prev, 
                      category: e.target.value,
                      title: e.target.value === 'عمالة يومية' ? 'أجرة عامل يومية / بالساعة' : prev.title
                    }));
                  }
                }}
                className="w-full h-9 px-3 text-xs bg-white border border-slate-300/90 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
              >
                {allCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__custom__">+ بند / تصنيف مخصص جديد...</option>
              </select>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    autoFocus
                    placeholder="اكتب اسم البند الجديد..."
                    value={newCategoryInput}
                    onChange={(e) => setNewCategoryInput(e.target.value)}
                    className="flex-1 h-9 px-3 text-xs bg-white border border-slate-300/90 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (newCategoryInput.trim()) {
                        const trimmed = newCategoryInput.trim();
                        try {
                          await addExpenseCategory(trimmed);
                          setExpenseForm(prev => ({ ...prev, category: trimmed }));
                          setIsCustomCategoryMode(false);
                        } catch (error) { alert('تعذر حفظ بند المصروف: ' + error.message); }
                      }
                    }}
                  >
                    حفظ البند
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Input
            label="بيان المصروف"
            required
            placeholder="مثال: تنزيل حمولة بصل، أكياس تعبئة..."
            value={expenseForm.title}
            onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
          />

          <Input
            label="المستلم / اسم العامل (اختياري)"
            placeholder="مثال: أبو أحمد"
            value={expenseForm.recipientName}
            onChange={(e) => setExpenseForm(prev => ({ ...prev, recipientName: e.target.value }))}
            prefixIcon={User}
          />

          {/* If Daily / Hourly Worker Calculator */}
          {expenseForm.category === 'عمالة يومية' && (
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <span className="text-[11px] font-bold text-slate-700 block">حاسبة الأجرة باليومية أو الساعة:</span>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label={`سعر الساعة / اليومية (${settings.currency})`}
                  type="number"
                  placeholder="0.00"
                  value={expenseForm.hourlyRate}
                  onChange={(e) => {
                    const rate = e.target.value;
                    const hrs = expenseForm.hoursWorked || 1;
                    setExpenseForm(prev => ({ 
                      ...prev, 
                      hourlyRate: rate,
                      amount: rate ? (Number(rate) * Number(hrs)).toString() : prev.amount 
                    }));
                  }}
                />

                <Input
                  label="عدد الساعات / الأيام"
                  type="number"
                  placeholder="1"
                  value={expenseForm.hoursWorked}
                  onChange={(e) => {
                    const hrs = e.target.value;
                    const rate = expenseForm.hourlyRate || 0;
                    setExpenseForm(prev => ({ 
                      ...prev, 
                      hoursWorked: hrs,
                      amount: rate ? (Number(rate) * Number(hrs)).toString() : prev.amount 
                    }));
                  }}
                />
              </div>
            </div>
          )}

          <Input
            label={`المبلغ المنصرف نقداً (${settings.currency})`}
            required
            type="number"
            step="0.5"
            placeholder="0.00"
            value={expenseForm.amount}
            onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
            prefixIcon={DollarSign}
          />

          <Input
            label="ملاحظات إضافية (اختياري)"
            placeholder="تفاصيل إضافية..."
            value={expenseForm.notes}
            onChange={(e) => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>
      </Modal>

    </div>
  );
}
