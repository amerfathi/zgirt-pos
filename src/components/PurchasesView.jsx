import React, { useRef, useState } from 'react';
import { 
  Plus, Trash2, Truck, Search, Calendar, Landmark, 
  CreditCard, Package, Sparkles, X, Check, FileText, 
  Printer, ArrowDownRight, TrendingDown, Layers, Building2, UserPlus,
  RotateCcw, ShieldCheck, LayoutList, LayoutGrid
} from 'lucide-react';
import { formatCurrency, formatWeight, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';
import EmojiPickerModal from './EmojiPickerModal';
import SuppliersLedgerView from './SuppliersLedgerView';
import PurchaseReturnModal from './PurchaseReturnModal';
import { Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, EmptyState, Modal, Input, Select, StatCard } from './ui';

export default function PurchasesView({ store, onOpenA4Report }) {
  const { 
    purchases = [], 
    products = [], 
    settings, 
    addPurchase, 
    deletePurchase, 
    suppliers = [],
    purchaseReturns = [],
    deletePurchaseReturn
  } = store;

  const [activeTab, setActiveTab] = useState('shipments'); // 'shipments' | 'suppliers' | 'returns'
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'cards'
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPayment, setFilterPayment] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const savingPurchaseRef = useRef(false);
  const [deletingPurchaseId, setDeletingPurchaseId] = useState(null);
  const [selectedPurchaseForReturn, setSelectedPurchaseForReturn] = useState(null);

  // Form State
  const [itemSourceType, setItemSourceType] = useState('existing'); // 'existing' | 'new'
  const [selectedProductId, setSelectedProductId] = useState('');
  
  // New product fields
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('خضروات');
  const [newProductIcon, setNewProductIcon] = useState('📦');
  const [newProductSellingPrice, setNewProductSellingPrice] = useState('');
  const [newProductTare, setNewProductTare] = useState('1.2');
  const [isEmojiModalOpen, setIsEmojiModalOpen] = useState(false);

  // Shipment fields
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(getCurrentDateFormatted());
  const [packagesCount, setPackagesCount] = useState('');
  const [packageType, setPackageType] = useState('صندوق بلاستيك');
  const [quantityKg, setQuantityKg] = useState('');
  const [costPerKg, setCostPerKg] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank' | 'credit'
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Handle auto calculation of cost
  const handleKgChange = (val) => {
    setQuantityKg(val);
    const kgNum = Number(val) || 0;
    const costNum = Number(costPerKg) || 0;
    if (kgNum > 0 && costNum > 0) {
      setTotalCost((kgNum * costNum).toFixed(2));
    }
  };

  const handleCostPerKgChange = (val) => {
    setCostPerKg(val);
    const costNum = Number(val) || 0;
    const kgNum = Number(quantityKg) || 0;
    if (kgNum > 0 && costNum > 0) {
      setTotalCost((kgNum * costNum).toFixed(2));
    }
  };

  const handleTotalCostChange = (val) => {
    setTotalCost(val);
    const totalNum = Number(val) || 0;
    const kgNum = Number(quantityKg) || 0;
    if (kgNum > 0 && totalNum > 0) {
      setCostPerKg((totalNum / kgNum).toFixed(2));
    }
  };

  const handleSelectExistingProduct = (prodId) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      if (prod.defaultPackageType) setPackageType(prod.defaultPackageType);
    }
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (savingPurchaseRef.current) return;

    const kgNum = Number(quantityKg) || 0;
    const costNum = Number(totalCost) || (kgNum * (Number(costPerKg) || 0));

    if (kgNum <= 0 || costNum <= 0) {
      alert('يرجى إدخال الوزن الصافي بالكيلو والتكلفة الإجمالية بشكل صحيح');
      return;
    }

    let effectiveProductName = '';
    let effectiveIcon = '📦';
    let isNewProd = false;

    if (itemSourceType === 'existing') {
      const prod = products.find(p => p.id === selectedProductId);
      if (!prod) {
        alert('يرجى اختيار صنف من القائمة');
        return;
      }
      effectiveProductName = prod.name;
      effectiveIcon = prod.icon || '🥬';
    } else {
      if (!newProductName.trim()) {
        alert('يرجى كتابة اسم الصنف الجديد');
        return;
      }
      effectiveProductName = newProductName.trim();
      effectiveIcon = newProductIcon;
      isNewProd = true;
    }

    const effectiveBank = bankName.trim() || 'تحويل بنكي';
    const targetSup = suppliers.find(s => s.id === selectedSupplierId);
    const effectiveSupplierName = targetSup ? targetSup.name : (supplierName.trim() || 'سوق الجملة المركزي');

    const purchaseData = {
      date,
      time: getCurrentTimeFormatted(),
      productId: itemSourceType === 'existing' ? selectedProductId : null,
      productName: effectiveProductName,
      icon: effectiveIcon,
      isNewProduct: isNewProd,
      category: newProductCategory,
      sellingPricePerKg: newProductSellingPrice,
      tareWeightPerPackage: newProductTare,
      supplierId: targetSup ? targetSup.id : null,
      supplierName: effectiveSupplierName,
      packagesCount: Number(packagesCount) || 1,
      packageType,
      quantityKg: kgNum,
      costPerKg: Number(costPerKg) || (costNum / kgNum),
      totalCost: Math.round(costNum * 100) / 100,
      paymentMethod,
      bankName: paymentMethod === 'bank' ? effectiveBank : '',
      bankAccountNumber: paymentMethod === 'bank' ? bankAccountNumber : '',
      notes: notes.trim()
    };

    savingPurchaseRef.current = true;
    setIsSavingPurchase(true);
    try {
      await addPurchase(purchaseData);
    } catch (error) {
      alert('تعذر حفظ فاتورة التوريد: ' + (error.message || 'خطأ غير معروف'));
      return;
    } finally {
      savingPurchaseRef.current = false;
      setIsSavingPurchase(false);
    }

    // Reset & close
    setIsAddModalOpen(false);
    setSelectedProductId('');
    setSelectedSupplierId('');
    setNewProductName('');
    setNewProductSellingPrice('');
    setPackagesCount('');
    setQuantityKg('');
    setCostPerKg('');
    setTotalCost('');
    setSupplierName('');
    setBankAccountNumber('');
    setNotes('');
  };

  const handleDeletePurchase = async purchase => {
    if (deletingPurchaseId || !window.confirm(`هل أنت متأكد من حذف فاتورة توريد ${purchase.productName} بمبلغ ${purchase.totalCost} ${settings.currency}؟`)) return;
    setDeletingPurchaseId(purchase.id);
    try { await deletePurchase(purchase.id); }
    catch (error) { alert('تعذر حذف فاتورة التوريد: ' + error.message); }
    finally { setDeletingPurchaseId(null); }
  };

  // Filtered List
  const filteredPurchases = (purchases || []).filter(pur => {
    const matchSearch = searchQuery === '' || 
      pur.productName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pur.supplierName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pur.notes?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchPayment = filterPayment === 'all' || pur.paymentMethod === filterPayment;

    return matchSearch && matchPayment;
  });

  // Metrics
  const totalPurchasesCost = (purchases || []).reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);
  const totalPurchaseReturnsCost = (purchaseReturns || []).reduce((sum, r) => sum + (Number(r.totalRefundAmount) || 0), 0);
  const netPurchasesCost = Math.max(0, totalPurchasesCost - totalPurchaseReturnsCost);
  const totalKgSupplied = (purchases || []).reduce((sum, p) => sum + (Number(p.quantityKg) || 0), 0);
  const todayPurchases = (purchases || []).filter(p => p.date === getCurrentDateFormatted());
  const todayPurchasesCost = todayPurchases.reduce((sum, p) => sum + (Number(p.totalCost) || 0), 0);

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Top View Mode Selector: Shipments vs Returns vs Suppliers */}
      <div className="bg-slate-100/80 p-1 rounded-xl border border-slate-200/80 text-xs font-semibold flex gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('shipments')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'shipments'
              ? 'bg-white text-navy-850 shadow-2xs border border-slate-200/90 font-bold'
              : 'text-slate-600 hover:text-navy-850'
          }`}
        >
          <Truck size={14} className={activeTab === 'shipments' ? 'text-primary-600' : 'text-slate-400'} />
          <span>سجل فواتير التوريد ({purchases.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('returns')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'returns'
              ? 'bg-white text-navy-850 shadow-2xs border border-slate-200/90 font-bold'
              : 'text-slate-600 hover:text-navy-850'
          }`}
        >
          <RotateCcw size={14} className={activeTab === 'returns' ? 'text-amber-600' : 'text-slate-400'} />
          <span>مردودات الموردين ({purchaseReturns.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('suppliers')}
          className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
            activeTab === 'suppliers'
              ? 'bg-white text-navy-850 shadow-2xs border border-slate-200/90 font-bold'
              : 'text-slate-600 hover:text-navy-850'
          }`}
        >
          <Building2 size={14} className={activeTab === 'suppliers' ? 'text-primary-600' : 'text-slate-400'} />
          <span>الموردون وحسابات الديون ({suppliers.length})</span>
        </button>
      </div>

      {activeTab === 'suppliers' ? (
        <SuppliersLedgerView 
          store={store} 
          onOpenNewPurchaseForSupplier={(sup) => {
            setActiveTab('shipments');
            setSelectedSupplierId(sup.id);
            setSupplierName(sup.name);
            setDate(getCurrentDateFormatted());
            setIsAddModalOpen(true);
          }}
        />
      ) : (
        <>
          {/* Top Header Card */}
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-2xs border border-slate-200/90 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-navy-850 text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Truck size={18} />
                </div>
                <div>
                  <h1 className="text-sm sm:text-base font-bold text-navy-850 leading-tight">
                    المشتريات وتوريد البضاعة
                  </h1>
                  <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                    إدارة فواتير التوريد، تكاليف شحنات الخضار، وسندات المردودات
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {onOpenA4Report && (
                  <Button
                    variant="outline"
                    size="md"
                    onClick={() => onOpenA4Report('purchases')}
                    icon={Printer}
                  >
                    تقرير A4
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="md"
                  onClick={() => {
                    setDate(getCurrentDateFormatted());
                    setIsAddModalOpen(true);
                  }}
                  icon={Plus}
                >
                  توريد جديد
                </Button>
              </div>
            </div>

            {/* 4 Financial Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              <StatCard
                title="إجمالي المشتريات"
                value={formatCurrency(totalPurchasesCost, settings.currency)}
                icon={Truck}
                iconBg="bg-primary-50 text-primary-700"
                subtitle="قبل خصم المردودات"
              />

              <StatCard
                title="مردودات الموردين"
                value={formatCurrency(totalPurchaseReturnsCost, settings.currency)}
                valueColor="text-amber-900"
                icon={RotateCcw}
                iconBg="bg-amber-50 text-amber-800"
                subtitle="بضاعة معادة بالتكلفة الفعلية"
              />

              <StatCard
                title="صافي المشتريات الفعلي"
                value={formatCurrency(netPurchasesCost, settings.currency)}
                icon={FileText}
                iconBg="bg-emerald-50 text-emerald-800"
                subtitle="التكلفة الصافية للبضاعة المستلمة"
              />

              <StatCard
                title="إجمالي الكمية الموردة"
                value={formatWeight(totalKgSupplied, 1)}
                icon={Package}
                iconBg="bg-slate-100 text-slate-700"
                subtitle="الوزن الإجمالي الصافي"
              />
            </div>
          </div>

          {/* Search, Filter and View Mode Switcher */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
            <div className="flex items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف أو المورد أو المزرعة..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full h-9 pr-9 pl-3 text-xs bg-slate-50 border border-slate-200/90 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-600 transition-all"
                />
              </div>

              {/* Payment Method Pills */}
              <div className="hidden md:flex items-center bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setFilterPayment('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    filterPayment === 'all'
                      ? 'bg-white text-navy-850 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy-850'
                  }`}
                >
                  الكل
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPayment('cash')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    filterPayment === 'cash'
                      ? 'bg-white text-navy-850 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy-850'
                  }`}
                >
                  نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPayment('bank')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    filterPayment === 'bank'
                      ? 'bg-white text-navy-850 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy-850'
                  }`}
                >
                  تحويل بنكي
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPayment('credit')}
                  className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                    filterPayment === 'credit'
                      ? 'bg-white text-navy-850 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy-850'
                  }`}
                >
                  آجل
                </button>
              </div>
            </div>

            {/* View Mode Toggle: Table vs Cards */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl self-end sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'table'
                    ? 'bg-white text-navy-850 shadow-2xs'
                    : 'text-slate-400 hover:text-navy-850'
                }`}
                title="عرض كجدول بيانات"
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'cards'
                    ? 'bg-white text-navy-850 shadow-2xs'
                    : 'text-slate-400 hover:text-navy-850'
                }`}
                title="عرض كبطاقات"
              >
                <LayoutGrid size={14} />
              </button>
            </div>
          </div>

          {/* Purchases Feed */}
          {filteredPurchases.length === 0 ? (
            <EmptyState
              icon={Truck}
              title="لا توجد فواتير توريد مطابقة"
              description="سجل فواتير شراء الخضار والفواكه الواردة من الموردين لمتابعة الأرباح وحسابات التكلفة بدقة."
              actionLabel="تسجيل أول توريد"
              onAction={() => {
                setDate(getCurrentDateFormatted());
                setIsAddModalOpen(true);
              }}
              actionIcon={Plus}
            />
          ) : (
            <>
              {/* 1. Desktop Data Table View */}
              {viewMode === 'table' && (
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead align="right">الصنف</TableHead>
                        <TableHead align="right">المورد / المزرعة</TableHead>
                        <TableHead align="center">العبوات</TableHead>
                        <TableHead align="right">الكمية الصافية</TableHead>
                        <TableHead align="right">تكلفة الكيلو</TableHead>
                        <TableHead align="right">إجمالي الفاتورة</TableHead>
                        <TableHead align="center">طريقة السداد</TableHead>
                        <TableHead align="center">التاريخ والوقت</TableHead>
                        <TableHead align="center">إجراءات</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchases.map((pur) => (
                        <TableRow key={pur.id}>
                          <TableCell align="right">
                            <div className="flex items-center gap-2">
                              <span className="text-base select-none shrink-0">{pur.icon || '📦'}</span>
                              <span className="font-bold text-slate-900 block truncate max-w-[140px]">
                                {pur.productName}
                              </span>
                            </div>
                            {pur.notes && (
                              <span className="text-[10px] text-slate-400 block truncate max-w-[140px] mt-0.5">
                                {pur.notes}
                              </span>
                            )}
                          </TableCell>

                          <TableCell align="right">
                            <span className="font-medium text-slate-700 block truncate max-w-[130px]">
                              {pur.supplierName}
                            </span>
                          </TableCell>

                          <TableCell align="center">
                            <Badge variant="neutral" size="sm">
                              {pur.packagesCount} {pur.packageType || 'عبوة'}
                            </Badge>
                          </TableCell>

                          <TableCell isNumeric align="right" className="font-mono text-slate-800 font-semibold">
                            {formatWeight(pur.quantityKg)}
                          </TableCell>

                          <TableCell isNumeric align="right" className="font-mono text-slate-700">
                            {Number(pur.costPerKg).toFixed(2)} {settings.currency}
                          </TableCell>

                          <TableCell isNumeric align="right">
                            <span className="font-mono font-bold text-navy-850 block">
                              {Number(pur.totalCost).toFixed(2)} {settings.currency}
                            </span>
                            {pur.hasReturns && (
                              <span className="text-[10px] text-amber-800 font-mono block">
                                مردود: {pur.returnedKg} كجم
                              </span>
                            )}
                          </TableCell>

                          <TableCell align="center">
                            {pur.paymentMethod === 'bank' ? (
                              <Badge variant="info" size="sm">
                                تحويل ({pur.bankName || 'بنك'})
                              </Badge>
                            ) : pur.paymentMethod === 'credit' ? (
                              <Badge variant="warning" size="sm">
                                آجل للمورد
                              </Badge>
                            ) : (
                              <Badge variant="success" size="sm">
                                نقداً (كاش)
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell align="center" className="text-slate-400 text-[11px] font-mono whitespace-nowrap">
                            <div>{pur.date}</div>
                            {pur.time && <div className="text-[10px] text-slate-300">{pur.time}</div>}
                          </TableCell>

                          <TableCell align="center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="accent"
                                size="sm"
                                onClick={() => setSelectedPurchaseForReturn(pur)}
                                icon={RotateCcw}
                                title="تسجيل مردود للمورد بالتكلفة الفعلية"
                              >
                                مردود
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeletePurchase(pur)}
                                disabled={deletingPurchaseId === pur.id}
                                icon={Trash2}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="حذف فاتورة التوريد"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* 2. Mobile Cards View (and fallback when cards mode active) */}
              <div className={`space-y-2.5 ${viewMode === 'table' ? 'md:hidden' : ''}`}>
                {filteredPurchases.map((pur) => (
                  <div
                    key={pur.id}
                    className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/90 hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center justify-center text-lg shrink-0">
                        {pur.icon || '📦'}
                      </div>

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-navy-850">{pur.productName}</span>
                          <Badge variant="neutral" size="sm">
                            {pur.packagesCount} {pur.packageType || 'عبوة'}
                          </Badge>
                          {pur.paymentMethod === 'bank' ? (
                            <Badge variant="info" size="sm">
                              تحويل ({pur.bankName || 'بنك'})
                            </Badge>
                          ) : pur.paymentMethod === 'credit' ? (
                            <Badge variant="warning" size="sm">
                              آجل للمورد
                            </Badge>
                          ) : (
                            <Badge variant="success" size="sm">
                              نقدي (كاش)
                            </Badge>
                          )}

                          {pur.hasReturns && (
                            <Badge variant="warning" size="sm">
                              مردود: {pur.returnedKg} كجم ({formatCurrency(pur.totalReturnedAmount, settings.currency)})
                            </Badge>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span>المورد: <strong className="text-slate-700 font-semibold">{pur.supplierName}</strong></span>
                          <span>•</span>
                          <span>الكمية: <strong className="text-slate-800 font-mono font-semibold">{formatWeight(pur.quantityKg)}</strong></span>
                          <span>•</span>
                          <span>تكلفة الكيلو: <strong className="text-slate-800 font-mono">{Number(pur.costPerKg).toFixed(2)} {settings.currency}</strong></span>
                        </div>

                        {pur.bankAccountNumber && pur.paymentMethod === 'bank' && (
                          <div className="text-[10px] text-blue-700 font-mono">
                            حساب/حوالة: #{pur.bankAccountNumber}
                          </div>
                        )}

                        {pur.notes && (
                          <div className="text-[11px] text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-100">
                            ملاحظات: {pur.notes}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-right sm:text-left">
                        <div className="text-sm sm:text-base font-bold text-navy-850 font-mono">
                          {Number(pur.totalCost).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {pur.date} {pur.time && `• ${pur.time}`}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => setSelectedPurchaseForReturn(pur)}
                          icon={RotateCcw}
                          title="تسجيل مردود للمورد بالتكلفة التاريخية الفعلية"
                        >
                          <span className="hidden sm:inline">مردود للمورد</span>
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePurchase(pur)}
                          disabled={deletingPurchaseId === pur.id}
                          icon={Trash2}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="حذف فاتورة التوريد"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

    {/* Purchase Returns Registry Tab */}
    {activeTab === 'returns' && (
      <div className="space-y-3">
        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 flex items-start gap-2.5">
          <ShieldCheck size={20} className="text-amber-800 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-950 leading-relaxed">
            <strong>سجل مردودات المشتريات للموردين:</strong> يوثق جميع الشحنات والبضائع المعادة للموردين، حيث تم احتساب كل مردود على أساس <strong>تكلفة الشراء الأصلية المسجلة بالشحنة وقت الاستلام حصراً</strong> دون أي تأثر بتغيرات أسعار السوق الحالية.
          </div>
        </div>

        {(purchaseReturns || []).length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 space-y-2">
            <RotateCcw size={36} className="mx-auto text-slate-300" />
            <p className="text-sm font-bold text-slate-600">لا توجد مردودات مشتريات مسجلة حتى الآن</p>
            <p className="text-xs text-slate-400">لتسجيل مردود، اختر شحنة التوريد المطلوبة واضغط على "مردود للمورد"</p>
          </div>
        ) : (
          (purchaseReturns || []).map((ret) => (
            <div 
              key={ret.id} 
              className="bg-white rounded-2xl p-4 border border-slate-200 space-y-2.5 shadow-xs"
            >
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-200">
                    سند #{ret.id?.replace('ret-pur-', '')}
                  </span>
                  <span className="font-bold text-sm text-slate-900">{ret.productName}</span>
                  <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md">
                    المورد: {ret.supplierName}
                  </span>
                  <span className="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                    طريقة التسوية: {
                      ret.refundMethod === 'supplier_debt_deduction'
                        ? 'خصم من دين ومستحقات المورد'
                        : ret.refundMethod === 'cash'
                        ? 'نقدي (أودع بالخزينة)'
                        : 'تحويل بنكي'
                    }
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-base font-black text-emerald-800 font-mono">
                    +{formatCurrency(ret.totalRefundAmount, settings.currency)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium block">
                    {ret.date} {ret.time && `• ${ret.time}`}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                <div>
                  الوزن المرتجع: <strong className="text-slate-900 font-mono">{formatWeight(ret.returnedKg)}</strong>
                </div>
                <div>
                  تكلفة الشراء التاريخية: <strong className="text-slate-900 font-mono">{ret.originalCostPerKg} {settings.currency}/كجم</strong>
                </div>
                <div>
                  السبب: <strong className="text-amber-800">{ret.reason || 'مردود بضاعة'}</strong>
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
                  onClick={async () => {
                    if (window.confirm('هل أنت متأكد من حذف سند مردود المشتريات هذا؟ سيتم التراجع عن خصم الكمية وإعادة ضبط حساب المورد.')) {
                      try { await deletePurchaseReturn(ret.id); }
                      catch (error) { alert('تعذر حذف سند مردود المشتريات: ' + error.message); }
                    }
                  }}
                  className="text-xs text-slate-400 hover:text-red-600 font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  title="حذف سند مردود المشتريات"
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

      {/* Add New Purchase Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { if (!savingPurchaseRef.current) setIsAddModalOpen(false); }}
        title="تسجيل فاتورة توريد جديدة"
        subtitle="شراء وتوريد خضروات وفواكه وتوثيق حسابات المورد"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
              
              {/* Product Source Toggle: Existing vs New */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
                  نوع الصنف المورد:
                </label>
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setItemSourceType('existing')}
                    className={`py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                      itemSourceType === 'existing'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Package size={14} />
                    <span>صنف مسجل حالي في المحل</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setItemSourceType('new')}
                    className={`py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 ${
                      itemSourceType === 'new'
                        ? 'bg-white text-emerald-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Sparkles size={14} className="text-amber-800" />
                    <span>صنف جديد تم شراؤه لأول مرة</span>
                  </button>
                </div>
              </div>

              {/* 1. If Existing: Product Selector */}
              {itemSourceType === 'existing' ? (
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700">
                    اختر الصنف من قائمة المحل *
                  </label>
                  <select
                    required
                    value={selectedProductId}
                    onChange={(e) => handleSelectExistingProduct(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  >
                    <option value="">-- اختر الصنف --</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.icon || '🥬'} {p.name} (سعر البيع الحالي: {p.defaultPricePerKg} {settings.currency})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                /* 2. If New: Complete New Product Details */
                <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-900">
                    <Sparkles size={14} />
                    <span>بيانات الصنف الجديد (سيضاف تلقائياً إلى قائمة أصناف المحل):</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم الصنف الجديد *</label>
                      <input
                        type="text"
                        required
                        placeholder="مثال: كوسة بلدية، فلفل رومي..."
                        value={newProductName}
                        onChange={(e) => setNewProductName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">فئة الصنف</label>
                      <select
                        value={newProductCategory}
                        onChange={(e) => setNewProductCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-800"
                      >
                        <option value="خضروات">خضروات</option>
                        <option value="فواكه">فواكه</option>
                        <option value="ورقيات">ورقيات</option>
                        <option value="حمضيات">حمضيات</option>
                        <option value="طرود">طرود</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">الرمز التعبيري</label>
                      <button
                        type="button"
                        onClick={() => setIsEmojiModalOpen(true)}
                        className="w-full px-2 py-1.5 bg-white border border-emerald-200 rounded-lg text-sm flex items-center justify-center gap-1 font-bold text-slate-800 hover:bg-emerald-50"
                      >
                        <span className="text-base">{newProductIcon}</span>
                        <span className="text-[10px] text-slate-500">تغيير</span>
                      </button>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">سعر البيع المقترح للكيلو</label>
                      <input
                        type="number"
                        step="0.25"
                        placeholder="0.00"
                        value={newProductSellingPrice}
                        onChange={(e) => setNewProductSellingPrice(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">خصم وزن العبوة الفارغة (كجم)</label>
                      <input
                        type="number"
                        step="0.1"
                        placeholder="1.2"
                        value={newProductTare}
                        onChange={(e) => setNewProductTare(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-bold text-slate-900"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Supplier & Date */}
              {/* Supplier & Date */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-slate-700">
                      المورد / المزرعة / الجهة *
                    </label>
                    {suppliers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          if (selectedSupplierId) {
                            setSelectedSupplierId('');
                            setSupplierName('');
                          } else {
                            setSelectedSupplierId(suppliers[0].id);
                            setSupplierName(suppliers[0].name);
                          }
                        }}
                        className="text-[10px] text-amber-700 font-bold hover:underline cursor-pointer"
                      >
                        {selectedSupplierId ? 'كتابة اسم يدوي' : 'اختيار مورد مسجل'}
                      </button>
                    )}
                  </div>

                  {suppliers.length > 0 && selectedSupplierId !== '__manual__' ? (
                    <div className="space-y-1">
                      <select
                        value={selectedSupplierId}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '__manual__') {
                            setSelectedSupplierId('');
                            setSupplierName('');
                          } else {
                            setSelectedSupplierId(val);
                            const sup = suppliers.find(s => s.id === val);
                            if (sup) setSupplierName(sup.name);
                          }
                        }}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                      >
                        <option value="">-- اختر مورد مسجل أو مزرعة --</option>
                        {suppliers.map(s => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.balance > 0 ? `له ${s.balance}` : s.balance < 0 ? `عليه ${Math.abs(s.balance)}` : 'خالص'})
                          </option>
                        ))}
                        <option value="__manual__">+ كتابة اسم مورد يدوي أو جديد...</option>
                      </select>

                      {/* Display Selected Supplier Balance Badge */}
                      {(() => {
                        const sup = suppliers.find(s => s.id === selectedSupplierId);
                        if (!sup) return null;
                        return (
                          <div className={`p-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between ${
                            sup.balance > 0 
                              ? 'bg-amber-50 text-amber-900 border border-amber-200' 
                              : sup.balance < 0 
                              ? 'bg-emerald-50 text-emerald-900 border border-emerald-200' 
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            <span>الرصيد الدفتري الحالي للمورد:</span>
                            <span className="font-mono">
                              {sup.balance > 0 ? `له ${sup.balance} ${settings.currency}` : sup.balance < 0 ? `عليه ${Math.abs(sup.balance)} ${settings.currency}` : 'خالص'}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <input
                        type="text"
                        placeholder="مثال: شركة التوريد، المورد أبو أحمد..."
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                      />
                      {suppliers.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSupplierId(suppliers[0]?.id || '');
                            setSupplierName(suppliers[0]?.name || '');
                          }}
                          className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                        >
                          ← اختيار من قائمة الموردين المسجلين
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    تاريخ التوريد
                  </label>
                  <input
                    type="text"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>
              </div>

              {/* Packages & Type */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    عدد الطرود / الصناديق
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="مثال: 50"
                    value={packagesCount}
                    onChange={(e) => setPackagesCount(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    نوع العبوة
                  </label>
                  <select
                    value={packageType}
                    onChange={(e) => setPackageType(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                  >
                    <option value="صندوق بلاستيك">صندوق بلاستيك</option>
                    <option value="كرتون">كرتون</option>
                    <option value="كيس خيش">كيس خيش</option>
                    <option value="صندوق فلين">صندوق فلين</option>
                    <option value="شوال شبك">شوال شبك</option>
                    <option value="فرط / بدون عبوة">فرط / بدون عبوة</option>
                  </select>
                </div>
              </div>

              {/* Weight & Cost Calculator */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-slate-700 font-bold text-[11px]">
                  <span>حسابات الكمية والتكلفة الموردة:</span>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      الوزن الصافي (كجم) *
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="0.0"
                      value={quantityKg}
                      onChange={(e) => handleKgChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      تكلفة الكيلو ({settings.currency})
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="0.00"
                      value={costPerKg}
                      onChange={(e) => handleCostPerKgChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                      إجمالي الفاتورة ({settings.currency}) *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      required
                      placeholder="0.00"
                      value={totalCost}
                      onChange={(e) => handleTotalCostChange(e.target.value)}
                      className="w-full px-2.5 py-1.5 bg-white border border-brand-500 rounded-lg text-xs font-black text-brand-700"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  طريقة سداد المشتريات:
                </label>
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`py-2 rounded-md transition-all text-center ${
                      paymentMethod === 'cash' ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    نقدي (من الصندوق)
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('bank')}
                    className={`py-2 rounded-md transition-all text-center ${
                      paymentMethod === 'bank' ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    تحويل بنكي
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('credit')}
                    className={`py-2 rounded-md transition-all text-center ${
                      paymentMethod === 'credit' ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    آجل (على الحساب)
                  </button>
                </div>

                {/* Credit Notification Badge */}
                {paymentMethod === 'credit' && (
                  <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 font-medium">
                    💡 <strong>توريد آجل للمورد:</strong> سيتم تسجيل قيمة الفاتورة ({totalCost || '0.00'} {settings.currency}) ديناً على المحل لصالح 
                    <strong> {supplierName || 'المورد'}</strong>، وتضاف مباشرة إلى رصيده الدفتري ليصبح له فلوس مستحقة.
                  </div>
                )}

                {/* Bank Fields if bank is selected */}
                {paymentMethod === 'bank' && (
                  <div className="mt-2 p-2.5 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم البنك المحول منه</label>
                      <input
                        type="text"
                        placeholder="اكتب اسم البنك (مثلاً: الراجحي، الأهلي...)"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-600"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 mb-0.5">رقم الحساب أو التحويل</label>
                      <input
                        type="text"
                        placeholder="رقم الحساب أو العملية..."
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-600"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  ملاحظات إضافية
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات حول جودة الصنف أو حمولة السيارة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-600"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="flex-1"
                  onClick={() => { if (!savingPurchaseRef.current) setIsAddModalOpen(false); }}
                  disabled={isSavingPurchase}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingPurchase}
                  variant="primary"
                  size="md"
                  className="flex-2"
                  icon={Check}
                >
                  {isSavingPurchase ? 'جارٍ حفظ فاتورة التوريد...' : 'حفظ فاتورة التوريد'}
                </Button>
              </div>

            </form>
      </Modal>

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={isEmojiModalOpen}
        onClose={() => setIsEmojiModalOpen(false)}
        onSelectEmoji={(emoji) => {
          setNewProductIcon(emoji);
          setIsEmojiModalOpen(false);
        }}
        currentEmoji={newProductIcon}
      />

      {/* Purchase Return Modal */}
      {selectedPurchaseForReturn && (
        <PurchaseReturnModal
          purchase={selectedPurchaseForReturn}
          store={store}
          onClose={() => setSelectedPurchaseForReturn(null)}
          onSuccess={() => setSelectedPurchaseForReturn(null)}
        />
      )}

    </div>
  );
}
