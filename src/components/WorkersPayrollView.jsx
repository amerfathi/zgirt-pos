import React, { useState } from 'react';
import { 
  Users, UserPlus, DollarSign, ArrowDownLeft, ArrowUpRight, Phone, 
  FileText, Printer, Trash2, CheckCircle2, AlertCircle, Calendar,
  UserCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';

export default function WorkersPayrollView({ store, onOpenA4Report }) {
  const { workers, workerTransactions, settings, addWorker, updateWorker, deleteWorker, addWorkerTransaction, recordWorkerTransactionWithUpdate, deleteWorkerTransaction } = store;

  const [activeTab, setActiveTab] = useState('workers'); // 'workers' | 'transactions'
  
  // Modals
  const [isAddWorkerModalOpen, setIsAddWorkerModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isAbsenceModalOpen, setIsAbsenceModalOpen] = useState(false);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [isSavingTransaction, setIsSavingTransaction] = useState(false);

  // Forms
  const [workerForm, setWorkerForm] = useState(/** @type {{name: string, phone: string, role: string, salaryType: string, monthlySalary: string, workDaysPerMonth: string | number, notes: string}} */ ({
    name: '',
    phone: '',
    role: 'موظف مبيعات وميزان',
    salaryType: 'monthly',
    monthlySalary: '',
    workDaysPerMonth: 30,
    notes: '',
  }));

  const [advanceForm, setAdvanceForm] = useState({
    amount: '',
    notes: 'سلفة نقدية على الراتب',
  });

  const [absenceForm, setAbsenceForm] = useState(/** @type {{absenceType: string, daysCount: string | number, notes: string}} */ ({
    absenceType: 'unexcused', // 'unexcused' | 'medical'
    daysCount: 1,
    notes: 'غياب بدون إذن',
  }));

  const [salaryForm, setSalaryForm] = useState(/** @type {{baseSalary: number, medicalAbsenceDays: number, unexcusedAbsenceDays: number, deductAdvances: string | number, bonusAmount: string | number, notes: string}} */ ({
    baseSalary: 0,
    medicalAbsenceDays: 0,
    unexcusedAbsenceDays: 0,
    deductAdvances: 0,
    bonusAmount: 0,
    notes: 'تسوية وصرف راتب شهري',
  }));

  // Calculations
  const totalAdvancesOpen = workers.reduce((sum, w) => sum + (Number(w.currentAdvance) || 0), 0);
  const totalBaseSalaries = workers.reduce((sum, w) => sum + (Number(w.monthlySalary ?? w.baseSalary) || 0), 0);

  const handleCreateWorker = async () => {
    const salary = Number(workerForm.monthlySalary) || 0;
    if (!workerForm.name.trim() || salary <= 0) {
      alert('يرجى كتابة اسم الموظف وتحديد راتبه الشهري');
      return;
    }

    try {
      await addWorker({
      name: workerForm.name.trim(),
      phone: workerForm.phone.trim(),
      role: workerForm.role,
      salaryType: workerForm.salaryType,
      monthlySalary: salary,
      baseSalary: salary,
      workDaysPerMonth: Number(workerForm.workDaysPerMonth) || 30,
      medicalAbsenceDays: 0,
      unexcusedAbsenceDays: 0,
      notes: workerForm.notes.trim()
      });

    setWorkerForm({
      name: '',
      phone: '',
      role: 'موظف مبيعات وميزان',
      salaryType: 'monthly',
      monthlySalary: '',
      workDaysPerMonth: 30,
      notes: '',
    });
    setIsAddWorkerModalOpen(false);
    } catch (error) { alert('تعذر حفظ العامل: ' + error.message); }
  };

  const handleOpenAdvance = (worker) => {
    setSelectedWorker(worker);
    setAdvanceForm({ amount: '', notes: 'سلفة نقدية على الراتب' });
    setIsAdvanceModalOpen(true);
  };

  const handleConfirmAdvance = async () => {
    if (isSavingTransaction) return;
    const amount = Number(advanceForm.amount);
    if (!selectedWorker || amount <= 0) {
      alert('يرجى إدخال مبلغ سلفة صحيح');
      return;
    }

    setIsSavingTransaction(true);
    try { await addWorkerTransaction({
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      type: 'advance',
      amount,
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      notes: advanceForm.notes,
    });
      setIsAdvanceModalOpen(false);
      setSelectedWorker(null);
    } catch (error) { alert('تعذر حفظ السلفة: ' + error.message); }
    finally { setIsSavingTransaction(false); }
  };

  const handleOpenAbsence = (worker) => {
    setSelectedWorker(worker);
    setAbsenceForm({
      absenceType: 'unexcused',
      daysCount: 1,
      notes: 'غياب بدون إذن',
    });
    setIsAbsenceModalOpen(true);
  };

  const handleConfirmAbsence = async () => {
    if (isSavingTransaction) return;
    const days = Number(absenceForm.daysCount) || 1;
    if (!selectedWorker || days <= 0) {
      alert('يرجى تحديد عدد أيام الغياب');
      return;
    }

    const isMedical = absenceForm.absenceType === 'medical';
    const updatedMedical = (Number(selectedWorker.medicalAbsenceDays) || 0) + (isMedical ? days : 0);
    const updatedUnexcused = (Number(selectedWorker.unexcusedAbsenceDays) || 0) + (!isMedical ? days : 0);

    setIsSavingTransaction(true);
    try { await recordWorkerTransactionWithUpdate(selectedWorker.id, {
      medicalAbsenceDays: updatedMedical,
      unexcusedAbsenceDays: updatedUnexcused,
    }, {
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      type: 'absence_record',
      amount: 0,
      absenceType: absenceForm.absenceType,
      daysCount: days,
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      notes: (isMedical ? 'غياب بعذر مرضي: ' : 'غياب بدون إذن: ') + days + ' يوم (' + absenceForm.notes + ')',
    }, true);
      setIsAbsenceModalOpen(false);
      setSelectedWorker(null);
    } catch (error) { alert('تعذر حفظ الغياب: ' + error.message); }
    finally { setIsSavingTransaction(false); }
  };

  const handleOpenSalary = (worker) => {
    setSelectedWorker(worker);
    const monthly = Number(worker.monthlySalary ?? worker.baseSalary) || 0;
    const unexcusedDays = Number(worker.unexcusedAbsenceDays) || 0;
    const medicalDays = Number(worker.medicalAbsenceDays) || 0;

    setSalaryForm({
      baseSalary: monthly,
      medicalAbsenceDays: medicalDays,
      unexcusedAbsenceDays: unexcusedDays,
      deductAdvances: worker.currentAdvance || 0,
      bonusAmount: 0,
      notes: 'صرف مستحقات راتب شهر ' + getCurrentDateFormatted(),
    });
    setIsSalaryModalOpen(true);
  };

  const handleConfirmSalary = async () => {
    if (!selectedWorker || isSavingTransaction) return;

    const monthly = Number(salaryForm.baseSalary) || 0;
    const workDays = Number(selectedWorker.workDaysPerMonth) || 30;
    const dayRate = monthly / workDays;

    const unexcusedDeduction = (Number(salaryForm.unexcusedAbsenceDays) || 0) * dayRate;
    const advancesDeducted = Math.min(Number(salaryForm.deductAdvances) || 0, selectedWorker.currentAdvance || 0);
    const bonus = Number(salaryForm.bonusAmount) || 0;

    const netSalaryPaid = Math.max(0, monthly - unexcusedDeduction - advancesDeducted + bonus);

    setIsSavingTransaction(true);
    try { await recordWorkerTransactionWithUpdate(selectedWorker.id, {
      medicalAbsenceDays: 0,
      unexcusedAbsenceDays: 0,
    }, {
      workerId: selectedWorker.id,
      workerName: selectedWorker.name,
      type: 'salary_payment',
      amount: Math.round(netSalaryPaid * 100) / 100,
      grossSalary: monthly,
      deductedAdvance: advancesDeducted,
      deductedAbsence: Math.round(unexcusedDeduction * 100) / 100,
      bonusAmount: bonus,
      date: getCurrentDateFormatted(),
      time: getCurrentTimeFormatted(),
      notes: salaryForm.notes + ' (صافي الراتب بعد خصم الغياب والسلف)',
    });
      setIsSalaryModalOpen(false);
      setSelectedWorker(null);
    } catch (error) { alert('تعذر حفظ الراتب: ' + error.message); }
    finally { setIsSavingTransaction(false); }
  };

  const handleDeleteWorker = async (id, name) => {
    if (window.confirm('هل أنت متأكد من حذف الموظف (' + name + ') وجميع سجلاته؟')) {
      try { await deleteWorker(id); }
      catch (error) { alert('تعذر حذف العامل: ' + error.message); }
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Header & Stats */}
      <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 border border-primary-200 flex items-center justify-center font-bold">
              <UserCheck size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-navy-850 leading-tight">الموظفون والرواتب الشهرية</h1>
              <p className="text-xs text-slate-500 font-normal">
                سجل الموظفين، الرواتب الشهرية، متابعة الغياب المرضي والاعتيادي، وتصفية السلفيات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenA4Report && onOpenA4Report('payroll')}
              className="px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
              title="طباعة مسير رواتب A4"
            >
              <Printer size={14} className="text-slate-500" />
              <span className="hidden sm:inline">مسير رواتب A4</span>
            </button>

            <button
              type="button"
              onClick={() => setIsAddWorkerModalOpen(true)}
              className="px-3 py-2 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            >
              <UserPlus size={14} />
              <span>+ إضافة موظف جديد</span>
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-xs text-slate-500 font-normal block">إجمالي مسير الرواتب الشهرية</span>
            <span className="text-lg font-bold text-navy-850 font-mono mt-0.5 block">
              {formatCurrency(totalBaseSalaries, settings.currency)}
            </span>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-xs text-slate-500 font-normal block">إجمالي السلفيات القائمة</span>
            <span className="text-lg font-bold text-amber-700 font-mono mt-0.5 block">
              {formatCurrency(totalAdvancesOpen, settings.currency)}
            </span>
          </div>

          <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/80">
            <span className="text-xs text-slate-500 font-normal block">إجمالي عدد الموظفين</span>
            <span className="text-lg font-bold text-slate-800 font-mono mt-0.5 block">
              {workers.length} <span className="text-xs font-normal text-slate-500">موظف نشط</span>
            </span>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex gap-1.5 p-1 bg-slate-100/70 rounded-xl text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('workers')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === 'workers' 
                ? 'bg-primary-50 text-primary-700 border border-primary-200 font-bold shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            سجل الموظفين وحساب الرواتب ({workers.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transactions')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all cursor-pointer ${
              activeTab === 'transactions' 
                ? 'bg-primary-50 text-primary-700 border border-primary-200 font-bold shadow-2xs' 
                : 'text-slate-600 hover:text-slate-900 border border-transparent'
            }`}
          >
            سجل السلفيات وحركات الصرف والغياب ({workerTransactions.length})
          </button>
        </div>
      </div>

      {/* Tab 1: Workers Directory */}
      {activeTab === 'workers' && (
        <div className="space-y-3">
          {workers.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 text-center border border-slate-200/80 shadow-sm">
              <UserCheck size={36} className="mx-auto mb-2 text-slate-400 opacity-30" />
              <p className="text-xs font-bold text-slate-700">لم يتم إضافة موظفين بعد</p>
              <p className="text-[11px] text-slate-400 mt-1">اضغط على زر "+ إضافة موظف جديد" لتسجيل الموظفين ورواتبهم الشهرية</p>
            </div>
          ) : (
            workers.map(worker => {
              const monthlySalary = Number(worker.monthlySalary ?? worker.baseSalary) || 0;
              const workDays = Number(worker.workDaysPerMonth) || 30;
              const dayRate = monthlySalary / workDays;
              const hasAdvance = worker.currentAdvance > 0;
              const medicalAbsence = Number(worker.medicalAbsenceDays) || 0;
              const unexcusedAbsence = Number(worker.unexcusedAbsenceDays) || 0;

              return (
                <div 
                  key={worker.id}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between pb-2.5 border-b border-slate-100">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-sm text-slate-900">{worker.name}</h3>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {worker.role}
                        </span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 mt-1">
                        {worker.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={12} className="text-slate-400" />
                            {worker.phone}
                          </span>
                        )}
                        <span>
                          أجر اليوم المحتسب: <strong className="text-slate-900 font-mono">{dayRate.toFixed(2)} {settings.currency}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="text-left bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/60">
                      <span className="text-[10px] text-slate-500 block font-medium">الراتب الشهري الأساسي:</span>
                      <span className="text-base font-black text-slate-900 font-mono">
                        {formatCurrency(monthlySalary, settings.currency)}
                      </span>
                    </div>
                  </div>

                  {/* Attendance & Advances Status Badges */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      hasAdvance 
                        ? 'bg-amber-50 text-amber-900 border-amber-200' 
                        : 'bg-slate-50 text-slate-600 border-slate-200/60'
                    }`}>
                      <span className="font-medium">سلفيات مسحوبة:</span>
                      <span className="font-black font-mono">
                        {formatCurrency(worker.currentAdvance || 0, settings.currency)}
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      unexcusedAbsence > 0 
                        ? 'bg-rose-50 text-rose-900 border-rose-200' 
                        : 'bg-slate-50 text-slate-600 border-slate-200/60'
                    }`}>
                      <span className="font-medium">غياب بدون إذن (يُخصم):</span>
                      <span className="font-black font-mono">
                        {unexcusedAbsence} يوم ({(unexcusedAbsence * dayRate).toFixed(2)} {settings.currency})
                      </span>
                    </div>

                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${
                      medicalAbsence > 0 
                        ? 'bg-blue-50 text-blue-900 border-blue-200' 
                        : 'bg-slate-50 text-slate-600 border-slate-200/60'
                    }`}>
                      <span className="font-medium">غياب مرضي بعذر:</span>
                      <span className="font-black font-mono">
                        {medicalAbsence} يوم
                      </span>
                    </div>
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenSalary(worker)}
                        className="px-3.5 py-1.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer"
                      >
                        <DollarSign size={13} />
                        <span>احتساب وتصفية الراتب</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenAdvance(worker)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-amber-700 border border-amber-200/80 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                      >
                        <ArrowDownLeft size={13} />
                        <span>صرف سلفة</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleOpenAbsence(worker)}
                        className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200/80 rounded-lg text-xs font-semibold flex items-center gap-1 transition-all shadow-2xs cursor-pointer"
                      >
                        <Calendar size={13} className="text-slate-500" />
                        <span>تسجيل غياب</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteWorker(worker.id, worker.name)}
                      className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                      title="حذف الموظف"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>

                </div>
              );
            })
          )}
        </div>
      )}

      {/* Tab 2: Transactions History */}
      {activeTab === 'transactions' && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-3.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
            <h2 className="text-xs font-black text-slate-900">سجل حركات السلف والرواتب والغياب</h2>
            <span className="text-[11px] text-slate-500">حركات مالية موثقة</span>
          </div>

          {workerTransactions.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <FileText size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-xs font-bold text-slate-600">لا توجد حركات مسجلة بعد</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {workerTransactions.map(tx => (
                <div key={tx.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50/70 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-sm text-slate-900">{tx.workerName}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        tx.type === 'advance' 
                          ? 'bg-amber-100 text-amber-800' 
                          : tx.type === 'salary_payment'
                            ? 'bg-teal-100 text-teal-800'
                            : 'bg-rose-100 text-rose-800'
                      }`}>
                        {tx.type === 'advance' ? 'سلفة نقدية 💵' : tx.type === 'salary_payment' ? 'صرف راتب شهر ✔' : 'تسجيل غياب ⚠️'}
                      </span>
                    </div>

                    <div className="text-xs text-slate-500">
                      <span>{tx.date} • {tx.time}</span>
                      {tx.notes && <span className="mr-2">({tx.notes})</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-base font-black font-mono ${
                      tx.type === 'advance' ? 'text-amber-800' : tx.type === 'salary_payment' ? 'text-teal-700' : 'text-rose-700'
                    }`}>
                      {tx.type === 'absence_record' 
                        ? `${tx.daysCount} أيام غياب` 
                        : `-${formatCurrency(tx.amount, settings.currency)}`}
                    </span>

                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm('هل أنت متأكد من حذف هذه الحركة؟')) {
                          try { await deleteWorkerTransaction(tx.id); }
                          catch (error) { alert('تعذر حذف حركة العامل: ' + error.message); }
                        }
                      }}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer"
                      title="حذف الحركة"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Worker Modal */}
      <AnimatePresence>
        {isAddWorkerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <h3 className="font-black text-sm text-slate-900">إضافة موظف جديد</h3>
                <button onClick={() => setIsAddWorkerModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الموظف / العامل *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="مثال: أحمد عبد الله"
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المسمى الوظيفي</label>
                  <input
                    type="text"
                    value={workerForm.role}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, role: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف</label>
                  <input
                    type="text"
                    placeholder="09xxxxxxxx"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الراتب الشهري ({settings.currency}) *</label>
                  <input
                    type="number"
                    step="50"
                    placeholder="0.00"
                    value={workerForm.monthlySalary}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, monthlySalary: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black font-mono text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">أيام العمل بالشهر</label>
                  <input
                    type="number"
                    value={workerForm.workDaysPerMonth}
                    onChange={(e) => setWorkerForm(prev => ({ ...prev, workDaysPerMonth: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات</label>
                <input
                  type="text"
                  placeholder="تاريخ التعيين، شروط إضافية..."
                  value={workerForm.notes}
                  onChange={(e) => setWorkerForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddWorkerModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleCreateWorker}
                  className="flex-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  حفظ الموظف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Advance Modal */}
      <AnimatePresence>
        {isAdvanceModalOpen && selectedWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-sm text-slate-900">صرف سلفة نقدية لموظف</h3>
                  <p className="text-xs text-slate-500">الموظف: {selectedWorker.name}</p>
                </div>
                <button onClick={() => setIsAdvanceModalOpen(false)} className="text-slate-400">✕</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مبلغ السلفة المنصرف نقداً ({settings.currency}) *
                </label>
                <input
                  type="number"
                  autoFocus
                  placeholder="0.00"
                  value={advanceForm.amount}
                  onChange={(e) => setAdvanceForm(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black font-mono text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  السلفة الحالية المسحوبة سابقاً: {formatCurrency(selectedWorker.currentAdvance || 0, settings.currency)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">البيان أو الملاحظة</label>
                <input
                  type="text"
                  value={advanceForm.notes}
                  onChange={(e) => setAdvanceForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdvanceModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAdvance}
                  className="flex-2 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  تأكيد صرف السلفة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Absence Recording Modal */}
      <AnimatePresence>
        {isAbsenceModalOpen && selectedWorker && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
            >
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-sm text-slate-900">تسجيل أيام غياب للموظف</h3>
                  <p className="text-xs text-slate-500">الموظف: {selectedWorker.name}</p>
                </div>
                <button onClick={() => setIsAbsenceModalOpen(false)} className="text-slate-400">✕</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع الغياب *</label>
                <select
                  value={absenceForm.absenceType}
                  onChange={(e) => setAbsenceForm(prev => ({ ...prev, absenceType: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                >
                  <option value="unexcused">غياب بدون إذن (يُخصم من الراتب)</option>
                  <option value="medical">غياب مرضي بعذر (يُسجل في السجل الطبي)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد أيام الغياب</label>
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  value={absenceForm.daysCount}
                  onChange={(e) => setAbsenceForm(prev => ({ ...prev, daysCount: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">السبب أو الملاحظة</label>
                <input
                  type="text"
                  value={absenceForm.notes}
                  onChange={(e) => setAbsenceForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAbsenceModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAbsence}
                  className="flex-2 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                >
                  تسجيل الغياب بالملف
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Salary Settlement Modal */}
      <AnimatePresence>
        {isSalaryModalOpen && selectedWorker && (() => {
          const monthly = Number(salaryForm.baseSalary) || 0;
          const workDays = Number(selectedWorker.workDaysPerMonth) || 30;
          const dayRate = monthly / workDays;
          const unexcusedDeduction = (Number(salaryForm.unexcusedAbsenceDays) || 0) * dayRate;
          const advancesDeducted = Math.min(Number(salaryForm.deductAdvances) || 0, selectedWorker.currentAdvance || 0);
          const bonus = Number(salaryForm.bonusAmount) || 0;
          const netSalary = Math.max(0, monthly - unexcusedDeduction - advancesDeducted + bonus);

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
              <motion.div 
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-5 space-y-3.5"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="font-black text-sm text-slate-900">احتساب وتصفية الراتب الشهري</h3>
                    <p className="text-xs text-slate-500">الموظف: {selectedWorker.name} ({selectedWorker.role})</p>
                  </div>
                  <button onClick={() => setIsSalaryModalOpen(false)} className="text-slate-400">✕</button>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-600">الراتب الأساسي للشهر:</span>
                    <span className="font-bold font-mono text-slate-900">{monthly.toFixed(2)} {settings.currency}</span>
                  </div>

                  <div className="flex justify-between py-1 border-b border-slate-100 text-rose-600">
                    <span>خصم غياب بدون إذن ({salaryForm.unexcusedAbsenceDays} يوم × {dayRate.toFixed(1)}):</span>
                    <span className="font-bold font-mono">-{unexcusedDeduction.toFixed(2)} {settings.currency}</span>
                  </div>

                  {salaryForm.medicalAbsenceDays > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-100 text-blue-600">
                      <span>أيام الغياب المرضي (مسجلة بعذر):</span>
                      <span className="font-bold font-mono">{salaryForm.medicalAbsenceDays} يوم (معفي)</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-amber-700">خصم من السلف المسحوبة ({selectedWorker.currentAdvance || 0}):</span>
                    <input
                      type="number"
                      value={salaryForm.deductAdvances}
                      onChange={(e) => setSalaryForm(prev => ({ ...prev, deductAdvances: e.target.value }))}
                      className="w-24 px-2 py-1 bg-amber-50 border border-amber-200 rounded text-xs font-mono font-bold text-amber-900 text-left"
                    />
                  </div>

                  <div className="flex items-center justify-between py-1 border-b border-slate-100">
                    <span className="text-teal-700">+ مكافأة / إضافي:</span>
                    <input
                      type="number"
                      value={salaryForm.bonusAmount}
                      onChange={(e) => setSalaryForm(prev => ({ ...prev, bonusAmount: e.target.value }))}
                      className="w-24 px-2 py-1 bg-teal-50 border border-teal-200 rounded text-xs font-mono font-bold text-teal-900 text-left"
                    />
                  </div>
                </div>

                <div className="bg-slate-950 text-white p-4 rounded-xl flex items-center justify-between shadow-inner">
                  <div>
                    <span className="text-[11px] text-slate-400 block font-medium">الصافي النقدي المستحق للموظف:</span>
                    <span className="text-xs font-bold text-teal-400">يسلم نقداً ويقيد كمصروف</span>
                  </div>
                  <div className="text-left font-mono">
                    <span className="text-2xl font-black text-emerald-400">
                      {netSalary.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 mr-1">{settings.currency}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">البيان وملاحظة السند</label>
                  <input
                    type="text"
                    value={salaryForm.notes}
                    onChange={(e) => setSalaryForm(prev => ({ ...prev, notes: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                  />
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSalaryModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmSalary}
                    className="flex-2 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-md cursor-pointer"
                  >
                    اعتماد وصرف الراتب
                  </button>
                </div>
              </motion.div>
            </div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
