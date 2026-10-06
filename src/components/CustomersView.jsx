import React, { useRef, useState } from 'react';
import { 
  Users, UserPlus, Phone, MapPin, DollarSign, ArrowDownLeft, 
  Search, Plus, Edit2, Trash2, CheckCircle2, History, FileText,
  X, Check, Banknote, Landmark, LayoutList, LayoutGrid, MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency } from '../utils/formatters';
import { Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, EmptyState, Modal, Input, Select, StatCard } from './ui';

export default function CustomersView({ store, onSelectCustomerForInvoice, onOpenCustomerStatement }) {
  const { customers, invoices, settings, addCustomer, updateCustomer, recordCustomerPayment } = store;
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isSavingPayment, setIsSavingPayment] = useState(false);
  const savingPaymentRef = useRef(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNote, setPaymentNote] = useState('سداد دفعة نقدية');
  const [paymentMethod, setPaymentMethod] = useState('cash');

  // New customer modal state
  const [isNewCustomerModalOpen, setIsNewCustomerModalOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    initialBalance: 0
  });
  const [isSavingCustomer, setIsSavingCustomer] = useState(false);

  // Edit customer modal state
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: '',
    notes: '',
    balance: 0
  });

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.phone && c.phone.includes(searchTerm))
  );

  const totalMarketDebt = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);
  const totalDebtorsCount = customers.filter(c => c.balance > 0).length;

  const handleOpenPayment = (customer) => {
    setSelectedCustomer(customer);
    setPaymentAmount('');
    setPaymentNote('سداد دفعة نقدية');
    setPaymentMethod('cash');
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (savingPaymentRef.current) return;
    if (!selectedCustomer || !paymentAmount || Number(paymentAmount) <= 0) {
      alert('يرجى كتابة مبلغ سداد صحيح');
      return;
    }

    savingPaymentRef.current = true;
    setIsSavingPayment(true);
    try {
      await recordCustomerPayment(selectedCustomer.id, paymentAmount, paymentNote, paymentMethod);
      setIsPaymentModalOpen(false);
      setSelectedCustomer(null);
    } catch (error) {
      alert('تعذر حفظ سداد العميل: ' + error.message);
    } finally {
      savingPaymentRef.current = false;
      setIsSavingPayment(false);
    }
  };

  const handleCreateCustomer = async () => {
    if (isSavingCustomer) return;
    if (!customerForm.name.trim()) {
      alert('يرجى كتابة اسم العميل');
      return;
    }

    setIsSavingCustomer(true);
    try {
      await addCustomer(customerForm);
      setCustomerForm({ name: '', phone: '', address: '', initialBalance: 0, notes: '' });
      setIsNewCustomerModalOpen(false);
    } catch (error) { alert('تعذر حفظ العميل: ' + error.message); }
    finally { setIsSavingCustomer(false); }
  };

  // Open Edit Customer Modal
  const handleOpenEdit = (customer) => {
    setEditingCustomer(customer);
    setEditForm({
      name: customer.name || '',
      phone: customer.phone || '',
      address: customer.address || '',
      notes: customer.notes || '',
      balance: customer.balance || 0
    });
  };

  // Save Customer Edits
  const handleSaveEdit = async () => {
    if (isSavingCustomer) return;
    if (!editForm.name.trim()) {
      alert('يرجى كتابة اسم العميل');
      return;
    }

    setIsSavingCustomer(true);
    try { await updateCustomer(editingCustomer.id, {
      name: editForm.name.trim(),
      phone: editForm.phone.trim(),
      address: editForm.address.trim(),
      notes: editForm.notes.trim(),
      balance: Number(editForm.balance) || 0
    });
      setEditingCustomer(null);
    } catch (error) { alert('تعذر تحديث العميل: ' + error.message); }
    finally { setIsSavingCustomer(false); }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Header & Debt Summary */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-navy-850 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Users size={18} />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-navy-850 leading-tight">حسابات العملاء والديون</h1>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">متابعة الأرصدة، كشوف الحسابات الرسمية، وتعديل بيانات العملاء</p>
            </div>
          </div>

          <Button
            variant="primary"
            size="md"
            onClick={() => setIsNewCustomerModalOpen(true)}
            icon={UserPlus}
          >
            إضافة عميل جديد
          </Button>
        </div>

        {/* 3 Debt & Ledger Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
          <StatCard
            title="إجمالي ديون السوق (المتبقي لك عند العملاء)"
            value={formatCurrency(totalMarketDebt, settings.currency)}
            valueColor="text-amber-900"
            icon={FileText}
            iconBg="bg-amber-50 text-amber-800"
            subtitle="ذمم مدينة مستحقة التحصيل"
          />

          <StatCard
            title="العملاء الذين عليهم ديون"
            value={totalDebtorsCount}
            currency="عميل مدين"
            valueColor="text-navy-850"
            icon={Users}
            iconBg="bg-slate-100 text-slate-700"
            subtitle={`من إجمالي ${customers.length} عميل`}
          />

          <StatCard
            title="إجمالي العملاء المسجلين"
            value={customers.length}
            currency="عميل"
            valueColor="text-navy-850"
            icon={Users}
            iconBg="bg-primary-50 text-primary-700"
            subtitle="دليل العملاء والشركاء التجاريين"
          />
        </div>
      </div>

      {/* Search & View Switcher Bar */}
      <div className="flex flex-col sm:flex-row gap-2 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="ابحث عن عميل بالاسم أو رقم الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-white border border-slate-300/90 rounded-xl text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 shadow-2xs"
          />
        </div>

        <div className="hidden md:flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-lg border border-slate-200 shrink-0">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`p-1.5 rounded-md transition-all cursor-pointer ${
              viewMode === 'table' ? 'bg-white text-navy-850 shadow-2xs font-bold' : 'text-slate-500 hover:text-navy-850'
            }`}
            title="عرض كجدول محاسبي"
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

      {filteredCustomers.length === 0 ? (
        <EmptyState
          icon={Users}
          title="لا يوجد عملاء مطابقين للبحث"
          description="اضغط على زر إضافة عميل جديد لبدء تسجيل أول عميل في المتجر."
          actionLabel="إضافة عميل جديد"
          onAction={() => setIsNewCustomerModalOpen(true)}
          actionIcon={UserPlus}
        />
      ) : (
        <>
          {/* 1. Desktop Data Table View */}
          {viewMode === 'table' && (
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead align="right">اسم العميل</TableHead>
                    <TableHead align="right">رقم الهاتف</TableHead>
                    <TableHead align="right">العنوان</TableHead>
                    <TableHead align="center">الفواتير السابقة</TableHead>
                    <TableHead align="left">رصيد الحساب</TableHead>
                    <TableHead align="center">إجراءات</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filteredCustomers.map(customer => {
                    const customerInvoices = invoices.filter(inv => inv.customerId === customer.id);
                    const hasDebt = customer.balance > 0;
                    const hasCredit = customer.balance < 0;

                    return (
                      <TableRow key={customer.id}>
                        <TableCell align="right">
                          <span className="font-bold text-slate-900 block truncate max-w-[160px]">
                            {customer.name}
                          </span>
                          {customer.notes && (
                            <span className="text-[10px] text-slate-400 block truncate max-w-[160px]">
                              {customer.notes}
                            </span>
                          )}
                        </TableCell>
                        <TableCell isNumeric align="right" className="text-slate-600">
                          {customer.phone || '—'}
                        </TableCell>
                        <TableCell align="right" className="text-slate-500 text-[11px]">
                          {customer.address || '—'}
                        </TableCell>
                        <TableCell align="center">
                          <Badge variant="neutral" size="sm">
                            {customerInvoices.length} فواتير
                          </Badge>
                        </TableCell>
                        <TableCell isNumeric align="left">
                          {hasDebt ? (
                            <Badge variant="warning" size="md">
                              مدين: {formatCurrency(customer.balance, settings.currency)}
                            </Badge>
                          ) : hasCredit ? (
                            <Badge variant="info" size="md">
                              دائن: {formatCurrency(Math.abs(customer.balance), settings.currency)}
                            </Badge>
                          ) : (
                            <Badge variant="success" size="md">
                              خالص الحساب
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell align="center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="accent"
                              size="sm"
                              onClick={() => handleOpenPayment(customer)}
                              icon={ArrowDownLeft}
                            >
                              سداد دفعة
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => onOpenCustomerStatement && onOpenCustomerStatement(customer.id)}
                              icon={FileText}
                              title="كشف حساب A4"
                            >
                              كشف A4
                            </Button>
                            {customer.phone && (
                              <a
                                href={`tel:${customer.phone}`}
                                className="p-1.5 bg-white hover:bg-slate-50 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold flex items-center transition-colors"
                                title="اتصال بالعميل"
                              >
                                <Phone size={13} />
                              </a>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenEdit(customer)}
                              icon={Edit2}
                              title="تعديل بيانات العميل"
                            />
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
          <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 ${viewMode === 'table' ? 'md:hidden' : ''}`}>
            {filteredCustomers.map(customer => {
            const customerInvoices = invoices.filter(inv => inv.customerId === customer.id);
            const hasDebt = customer.balance > 0;
            const hasCredit = customer.balance < 0;

            return (
              <div 
                key={customer.id}
                className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  {/* Top: Name, Phone & Debt Tag */}
                  <div className="flex items-start justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                      <h3 className="font-black text-sm text-slate-900 leading-tight">
                        {customer.name}
                      </h3>
                      <div className="flex items-center gap-2 mt-1 text-slate-500 text-xs">
                        {customer.phone && (
                          <span className="flex items-center gap-1 font-mono">
                            <Phone size={11} className="text-slate-400" />
                            {customer.phone}
                          </span>
                        )}
                        {customer.address && (
                          <span className="flex items-center gap-1 text-[11px]">
                            <MapPin size={11} className="text-slate-400" />
                            {customer.address}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Balance Status Badge */}
                    <div>
                      {hasDebt ? (
                        <div className="bg-amber-50 text-amber-900 border border-amber-200 px-3 py-1 rounded-xl text-left">
                          <span className="text-[10px] block font-bold text-amber-700">عليه دين:</span>
                          <span className="font-black text-sm text-amber-900 font-mono">
                            {formatCurrency(customer.balance, settings.currency)}
                          </span>
                        </div>
                      ) : hasCredit ? (
                        <div className="bg-blue-50 text-blue-900 border border-blue-200 px-3 py-1 rounded-xl text-left">
                          <span className="text-[10px] block font-bold text-blue-700">دائن (له رصيد):</span>
                          <span className="font-black text-sm text-blue-900 font-mono">
                            {formatCurrency(Math.abs(customer.balance), settings.currency)}
                          </span>
                        </div>
                      ) : (
                        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 rounded-xl text-left">
                          <span className="text-[11px] font-black flex items-center gap-1">
                            <CheckCircle2 size={13} className="text-emerald-600" />
                            خالص الحساب
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Meta details & Invoices count */}
                  <div className="py-2.5 flex items-center justify-between text-xs text-slate-600">
                    <span className="text-[11px]">
                      سجل الفواتير: <strong className="text-slate-900 font-mono">{customerInvoices.length}</strong> فاتورة سابقة
                    </span>
                    {customer.notes && (
                      <span className="text-[11px] text-slate-400 italic truncate max-w-[180px]">
                        {customer.notes}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions: Payments, Statement, Edit Button */}
                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenPayment(customer)}
                      className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                    >
                      <ArrowDownLeft size={14} />
                      <span>سداد دفعة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onOpenCustomerStatement && onOpenCustomerStatement(customer.id)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                      title="عرض وطباعة كشف حساب العميل A4"
                    >
                      <FileText size={13} className="text-primary-600" />
                      <span>كشف A4</span>
                    </button>

                    {customer.phone && (
                      <a
                        href={`tel:${customer.phone}`}
                        className="p-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center transition-colors"
                        title="اتصال بالعميل"
                      >
                        <Phone size={13} />
                      </a>
                    )}
                  </div>

                  {/* Edit Customer Button */}
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(customer)}
                    className="px-2.5 py-1.5 bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-slate-900 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                    title="تعديل بيانات العميل"
                  >
                    <Edit2 size={13} className="text-slate-500" />
                    <span>تعديل</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      </>
    )}

      {/* Edit Customer Modal */}
      <Modal
        isOpen={!!editingCustomer}
        onClose={() => setEditingCustomer(null)}
        title="تعديل بيانات العميل"
        subtitle="تحديث معلومات الاتصال والرصيد الدفتري"
        maxWidth="max-w-md"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => setEditingCustomer(null)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleSaveEdit}
              icon={Check}
            >
              حفظ التعديلات
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="اسم العميل / المحل"
            required
            value={editForm.name}
            onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
            placeholder="مثال: الحاج فرج (محل البركة)"
          />

          <Input
            label="رقم الهاتف"
            type="tel"
            value={editForm.phone}
            onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
            placeholder="09xxxxxxxx"
            prefixIcon={Phone}
          />

          <Input
            label="العنوان أو المنطقة"
            value={editForm.address}
            onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
            placeholder="مثلاً: سوق الجمعة"
            prefixIcon={MapPin}
          />

          <Input
            label={`رصيد الدين الحالي (${settings.currency})`}
            type="number"
            step="0.5"
            value={editForm.balance}
            onChange={(e) => setEditForm(prev => ({ ...prev, balance: Number(e.target.value) }))}
            helperText="يمكن تعديل الرصيد يدوياً في حال وجود تسوية سابقة أو خصم."
          />

          <Input
            label="ملاحظات إضافية"
            value={editForm.notes}
            onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="أية تفاصيل إضافية..."
          />
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen && !!selectedCustomer}
        onClose={() => { if (!savingPaymentRef.current) setIsPaymentModalOpen(false); }}
        title="سداد دفعة من الحساب"
        subtitle={selectedCustomer ? `العميل: ${selectedCustomer.name}` : ''}
        maxWidth="max-w-md"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => { if (!savingPaymentRef.current) setIsPaymentModalOpen(false); }}
              disabled={isSavingPayment}
            >
              إلغاء
            </Button>
            <Button
              variant="accent"
              size="md"
              className="flex-1"
              onClick={handleConfirmPayment}
              disabled={isSavingPayment}
              icon={CheckCircle2}
            >
              {isSavingPayment ? 'جارٍ حفظ السداد...' : 'تأكيد السداد وتخفيض الدين'}
            </Button>
          </div>
        }
      >
        {selectedCustomer && (
          <div className="space-y-4">
            {/* Current Balance Banner */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200/90 text-xs">
              <span className="font-medium text-slate-600">الرصيد القائم حالياً:</span>
              <span className="font-mono font-bold text-amber-900 text-sm">
                {formatCurrency(selectedCustomer.balance, settings.currency)}
              </span>
            </div>

            <Input
              label={`المبلغ المسدد نقداً (${settings.currency})`}
              required
              type="number"
              step="1"
              autoFocus
              placeholder="0.00"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              prefixIcon={DollarSign}
            />

            <div className="space-y-1.5 text-right">
              <label className="block text-[11px] font-semibold text-slate-700">
                طريقة السداد واستلام المبلغ
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'cash'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Banknote size={14} />
                  <span>نقداً (في الدرج)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('bank')}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    paymentMethod === 'bank'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Landmark size={14} />
                  <span>تحويل بنكي</span>
                </button>
              </div>
            </div>

            <Input
              label="البيان / ملاحظة السداد"
              value={paymentNote}
              onChange={(e) => setPaymentNote(e.target.value)}
              placeholder="سداد دفعة نقدية"
            />

            {Number(paymentAmount) > 0 && (
              <div className="p-3 bg-emerald-50 border border-emerald-200/90 rounded-xl flex items-center justify-between text-xs">
                <span className="text-emerald-800 font-medium">الرصيد المتبقي بعد السداد:</span>
                <span className="font-mono font-bold text-emerald-950 text-sm">
                  {formatCurrency(selectedCustomer.balance - Number(paymentAmount), settings.currency)}
                </span>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* New Customer Modal */}
      <Modal
        isOpen={isNewCustomerModalOpen}
        onClose={() => setIsNewCustomerModalOpen(false)}
        title="إضافة عميل جديد"
        subtitle="تسجيل عميل في دفتر الذمم والحسابات"
        maxWidth="max-w-md"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="outline"
              size="md"
              className="flex-1"
              onClick={() => setIsNewCustomerModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              variant="primary"
              size="md"
              className="flex-1"
              onClick={handleCreateCustomer}
              icon={UserPlus}
            >
              حفظ العميل
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <Input
            label="اسم العميل / المحل"
            required
            autoFocus
            placeholder="مثال: الحاج فرج (محل البركة)"
            value={customerForm.name}
            onChange={(e) => setCustomerForm(prev => ({ ...prev, name: e.target.value }))}
          />

          <Input
            label="رقم الهاتف"
            type="tel"
            placeholder="09xxxxxxxx"
            value={customerForm.phone}
            onChange={(e) => setCustomerForm(prev => ({ ...prev, phone: e.target.value }))}
            prefixIcon={Phone}
          />

          <Input
            label="العنوان أو المنطقة"
            placeholder="مثلاً: سوق الجمعة"
            value={customerForm.address}
            onChange={(e) => setCustomerForm(prev => ({ ...prev, address: e.target.value }))}
            prefixIcon={MapPin}
          />

          <Input
            label={`رصيد سابق أو دين افتتاحي (${settings.currency})`}
            type="number"
            step="1"
            placeholder="0.00"
            value={customerForm.initialBalance || ''}
            onChange={(e) => setCustomerForm(prev => ({ ...prev, initialBalance: Number(e.target.value) }))}
            helperText="اتركه فارغاً إذا كان الحساب يبدأ من الصفر بدون ديون سابقة."
          />
        </div>
      </Modal>

    </div>
  );
}
