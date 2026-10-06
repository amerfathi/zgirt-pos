import React, { useRef, useState } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, Wallet, 
  Plus, Trash2, Calendar, PieChart, ArrowUpRight, ArrowDownRight, FileSpreadsheet, ShieldAlert
} from 'lucide-react';
import { formatCurrency, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';

export default function ExpensesAndReports({ store }) {
  const { invoices, expenses, settings, addExpense, deleteExpense, customers, customerPayments } = store;

  const [isAddExpenseModalOpen, setIsAddExpenseModalOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const savingExpenseRef = useRef(false);
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'عمالة',
    amount: '',
    notes: '',
  });

  const todayStr = getCurrentDateFormatted();

  // Filter today's invoices
  const todayInvoices = invoices.filter(inv => inv.date === todayStr && inv.status !== 'voided');
  
  // Total today's sales
  const todaySalesTotal = todayInvoices.reduce((sum, inv) => sum + (Number(inv.finalTotal) || 0), 0);
  // Total cash received today from invoices
  const todayCashFromInvoices = todayInvoices.reduce((sum, inv) => sum + (Number(inv.paidAmount) || 0), 0);
  // Total cash received today from customer debt settlements
  const todayCustomerPayments = (customerPayments || []).filter(p => p.date === todayStr);
  const todayCashFromRepayments = todayCustomerPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  // Total actual cash inflow
  const todayTotalCashCollected = todayCashFromInvoices + todayCashFromRepayments;

  // Total credit given today
  const todayCreditGiven = todayInvoices.reduce((sum, inv) => sum + (Number(inv.remainingDebt) || 0), 0);

  // Filter today's expenses
  const todayExpensesList = expenses.filter(exp => exp.date === todayStr);
  const todayExpensesTotal = todayExpensesList.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

  // Filter today's purchases paid in cash from the register
  const todayPurchasesCash = (store.purchases || []).filter(p => p.date === todayStr && p.paymentMethod === 'cash');
  const todayPurchasesCashTotal = todayPurchasesCash.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

  // Net Drawer Cash (النقد الفعلي بالدرج = المقبوض كاش مبيعات + تحصيلات - المصاريف - مشتريات الكاش)
  const netDrawerCash = todayTotalCashCollected - todayExpensesTotal - todayPurchasesCashTotal;

  // All time totals
  const allTimeSales = invoices.filter(i => i.status !== 'voided').reduce((sum, i) => sum + (Number(i.finalTotal) || 0), 0);
  const allTimeExpenses = expenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  const totalMarketDebt = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  const handleCreateExpense = async () => {
    if (savingExpenseRef.current) return;
    if (!expenseForm.title || !expenseForm.amount || Number(expenseForm.amount) <= 0) {
      alert('يرجى كتابة بيان المصروف والمبلغ بشكل صحيح');
      return;
    }

    savingExpenseRef.current = true;
    setIsSavingExpense(true);
    try { await addExpense({
      ...expenseForm,
      date: todayStr,
      time: getCurrentTimeFormatted(),
    }); } catch (error) {
      alert('تعذر حفظ المصروف: ' + error.message);
      return;
    } finally {
      savingExpenseRef.current = false;
      setIsSavingExpense(false);
    }

    setExpenseForm({ title: '', category: 'عمالة', amount: '', notes: '' });
    setIsAddExpenseModalOpen(false);
  };

  const handleDeleteExpense = async (id) => {
    if (window.confirm('هل أنت متأكد من حذف هذا المصروف؟')) {
      try { await deleteExpense(id); }
      catch (error) { alert('تعذر حذف المصروف: ' + error.message); }
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Header */}
      <div className="bg-white rounded-2xl p-4 shadow-card border border-slate-200/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-slate-900 text-brand-400 flex items-center justify-center">
            <PieChart size={18} />
          </div>
          <div>
            <h1 className="text-sm font-black text-slate-900">التقارير اليومية والمصروفات</h1>
            <p className="text-[11px] text-slate-500 font-medium">ملخص الدخل اليومي، النقدية، والمصاريف</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsAddExpenseModalOpen(true)}
          className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
        >
          <Plus size={15} />
          <span>تسجيل مصروف</span>
        </button>
      </div>

      {/* Main Drawer Cash Highlight (صافي الكاش في الصندوق) */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
        
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Wallet className="text-brand-400" size={20} />
            <span className="text-xs font-bold text-slate-300">صافي الكاش الفعلي المتوفر بالدرج اليوم:</span>
          </div>
          <span className="text-xs font-mono bg-slate-800 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
            {todayStr}
          </span>
        </div>

        <div className="py-4">
          <div className="text-3xl sm:text-4xl font-black text-brand-400 tracking-tight">
            {formatCurrency(netDrawerCash, settings.currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            = المحصل نقداً ({formatCurrency(todayTotalCashCollected, settings.currency)}) - المصروفات ({formatCurrency(todayExpensesTotal, settings.currency)})
          </p>
        </div>

        {/* 3 Today Sub-Metrics */}
        <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-center">
          <div>
            <span className="text-[10px] text-slate-400 block">إجمالي مبيعات اليوم</span>
            <span className="text-sm font-bold text-white mt-0.5 block">{formatCurrency(todaySalesTotal, settings.currency)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">آجل ديون اليوم</span>
            <span className="text-sm font-bold text-amber-400 mt-0.5 block">{formatCurrency(todayCreditGiven, settings.currency)}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block">مصروفات اليوم</span>
            <span className="text-sm font-bold text-red-400 mt-0.5 block">{formatCurrency(todayExpensesTotal, settings.currency)}</span>
          </div>
        </div>
      </div>

      {/* Market All-Time Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-card">
          <span className="text-[10px] text-slate-500 font-bold block">إجمالي مبيعات السوق (التراكمي)</span>
          <span className="text-base font-black text-slate-900 mt-1 block">
            {formatCurrency(allTimeSales, settings.currency)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-card">
          <span className="text-[10px] text-slate-500 font-bold block">إجمالي ديون السوق الحالية</span>
          <span className="text-base font-black text-amber-700 mt-1 block">
            {formatCurrency(totalMarketDebt, settings.currency)}
          </span>
        </div>

        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-card col-span-2 sm:col-span-1">
          <span className="text-[10px] text-slate-500 font-bold block">إجمالي المصروفات (التراكمي)</span>
          <span className="text-base font-black text-red-700 mt-1 block">
            {formatCurrency(allTimeExpenses, settings.currency)}
          </span>
        </div>
      </div>

      {/* Expenses Management Section */}
      <div className="bg-white rounded-2xl shadow-card border border-slate-200/80 overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <TrendingDown size={16} className="text-red-600" />
            <h2 className="text-xs font-black text-slate-800">
              سجل المصروفات اليومية ({expenses.length})
            </h2>
          </div>

          <span className="text-xs font-bold text-slate-500">
            اليوم: <strong className="text-red-700">{formatCurrency(todayExpensesTotal, settings.currency)}</strong>
          </span>
        </div>

        {expenses.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            <TrendingDown size={30} className="mx-auto mb-2 opacity-30" />
            <p className="text-xs font-bold text-slate-600">لا توجد أي مصروفات مسجلة بعد</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {expenses.map(exp => (
              <div key={exp.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{exp.title}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {exp.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-1">
                    <span>{exp.date} • {exp.time}</span>
                    {exp.notes && <span>({exp.notes})</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-sm font-black text-red-700">
                    -{formatCurrency(exp.amount, settings.currency)}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDeleteExpense(exp.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                    title="حذف المصروف"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Expense Modal */}
      {isAddExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-3.5 animate-in zoom-in-95">
            <h3 className="font-black text-sm text-slate-900 border-b border-slate-100 pb-2">
              تسجيل مصروف جديد
            </h3>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">بيان المصروف *</label>
              <input
                type="text"
                autoFocus
                placeholder="مثال: أجرة عمال تنزيل أو نقل بضاعة"
                value={expenseForm.title}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  <option value="عمالة">عمالة وتنزيل</option>
                  <option value="نقل وشحن">نقل وشحن</option>
                  <option value="مشتريات بضاعة">شراء بضاعة</option>
                  <option value="مصاريف تشغيل">شاي ومصاريف محل</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  المبلغ ({settings.currency}) *
                </label>
                <input
                  type="number"
                  step="1"
                  placeholder="0.00"
                  value={expenseForm.amount}
                  onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات إضافية</label>
              <input
                type="text"
                placeholder="اختياري..."
                value={expenseForm.notes}
                onChange={(e) => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => { if (!savingExpenseRef.current) setIsAddExpenseModalOpen(false); }}
                disabled={isSavingExpense}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleCreateExpense}
                disabled={isSavingExpense}
                className="flex-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl shadow-md shadow-red-600/20"
              >
                {isSavingExpense ? 'جارٍ حفظ المصروف...' : 'تسجيل المصروف'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
