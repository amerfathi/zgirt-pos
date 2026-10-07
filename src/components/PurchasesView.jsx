import React, { useRef, useState } from 'react';
import { 
  Plus, Trash2, Truck, Search, Calendar, Landmark, 
  CreditCard, Package, Sparkles, X, Check, FileText, 
  Printer, ArrowDownRight, TrendingDown, Layers, Building2, UserPlus,
  RotateCcw, ShieldCheck, LayoutList, LayoutGrid, Box, Archive
} from 'lucide-react';
import { formatCurrency, getCurrentDateFormatted, getCurrentTimeFormatted } from '../utils/formatters';
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
  
  // New tobacco product fields
  const [newProductName, setNewProductName] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('سجائر');
  const [newProductBrand, setNewProductBrand] = useState('');
  const [newProductPacksPerCarton, setNewProductPacksPerCarton] = useState('10');
  const [newProductSellingPricePack, setNewProductSellingPricePack] = useState('');
  const [newProductSellingPriceCarton, setNewProductSellingPriceCarton] = useState('');

  // Purchase Shipment fields
  const [purchaseUnit, setPurchaseUnit] = useState('carton'); // 'carton' | 'pack'
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [date, setDate] = useState(getCurrentDateFormatted());
  const [quantityInput, setQuantityInput] = useState(''); // Number of cartons or packs
  const [unitCost, setUnitCost] = useState(''); // Cost per carton or per pack
  const [totalCost, setTotalCost] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' | 'bank' | 'credit'
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-calculation of cost
  const handleQuantityChange = (val) => {
    setQuantityInput(val);
    const qNum = Number(val) || 0;
    const cNum = Number(unitCost) || 0;
    if (qNum > 0 && cNum > 0) {
      setTotalCost((qNum * cNum).toFixed(2));
    }
  };

  const handleUnitCostChange = (val) => {
    setUnitCost(val);
    const cNum = Number(val) || 0;
    const qNum = Number(quantityInput) || 0;
    if (qNum > 0 && cNum > 0) {
      setTotalCost((qNum * cNum).toFixed(2));
    }
  };

  const handleTotalCostChange = (val) => {
    setTotalCost(val);
    const tNum = Number(val) || 0;
    const qNum = Number(quantityInput) || 0;
    if (qNum > 0 && tNum > 0) {
      setUnitCost((tNum / qNum).toFixed(2));
    }
  };

  const handleSelectExistingProduct = (prodId) => {
    setSelectedProductId(prodId);
    const prod = products.find(p => p.id === prodId);
    if (prod) {
      const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
      const costPack = Number(prod.costPerPack || prod.costPerKg || 0);
      if (costPack > 0) {
        if (purchaseUnit === 'carton') {
          setUnitCost((costPack * packsPerCarton).toFixed(2));
        } else {
          setUnitCost(costPack.toFixed(2));
        }
      }
    }
  };

  const handleSavePurchase = async (e) => {
    e.preventDefault();
    if (savingPurchaseRef.current) return;

    const qty = Number(quantityInput) || 0;
    const tCost = Number(totalCost) || (qty * (Number(unitCost) || 0));

    if (qty <= 0 || tCost <= 0) {
      alert('يرجى إدخال الكمية المشتراة وتكلفة الشراء بشكل صحيح');
      return;
    }

    let effectiveProductName = '';
    let effectivePacksPerCarton = 10;
    let isNewProd = false;

    if (itemSourceType === 'existing') {
      const prod = products.find(p => p.id === selectedProductId);
      if (!prod) {
        alert('يرجى اختيار صنف تبغ من القائمة');
        return;
      }
      effectiveProductName = prod.name;
      effectivePacksPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
    } else {
      if (!newProductName.trim()) {
        alert('يرجى كتابة اسم صنف التبغ الجديد');
        return;
      }
      effectiveProductName = newProductName.trim();
      effectivePacksPerCarton = Number(newProductPacksPerCarton) || 10;
      isNewProd = true;
    }

    // Determine normalized packs and cost per pack for the authoritative ledger
    let totalPacks = qty;
    let costPerPack = Number(unitCost) || 0;
    let cartonsPurchased = 0;

    if (purchaseUnit === 'carton') {
      cartonsPurchased = qty;
      totalPacks = qty * effectivePacksPerCarton;
      costPerPack = Math.round((tCost / totalPacks) * 100) / 100;
    } else {
      cartonsPurchased = Math.floor(qty / effectivePacksPerCarton);
      costPerPack = Number(unitCost) || (tCost / qty);
    }

    const effectiveBank = bankName.trim() || 'تحويل بنكي';
    const targetSup = suppliers.find(s => s.id === selectedSupplierId);
    const effectiveSupplierName = targetSup ? targetSup.name : (supplierName.trim() || 'المورد الرئيسي للتبغ');

    const purchaseData = {
      date,
      time: getCurrentTimeFormatted(),
      productId: itemSourceType === 'existing' ? selectedProductId : null,
      productName: effectiveProductName,
      isNewProduct: isNewProd,
      category: newProductCategory,
      brand: newProductBrand,
      packsPerCarton: effectivePacksPerCarton,
      purchaseUnit, // 'carton' | 'pack'
      purchaseQuantity: qty,
      cartonsCount: cartonsPurchased,
      packsCount: totalPacks,
      // Ledger compatibility mappings:
      quantityKg: totalPacks, // Authoritative packs stored in ledger
      costPerKg: costPerPack,  // Authoritative cost per pack stored in ledger
      packagesCount: cartonsPurchased || 1,
      packageType: purchaseUnit === 'carton' ? 'كرتونة' : 'علبة',
      sellingPricePack: Number(newProductSellingPricePack) || 0,
      sellingPriceCarton: Number(newProductSellingPriceCarton) || 0,
      supplierId: targetSup ? targetSup.id : null,
      supplierName: effectiveSupplierName,
      totalCost: Math.round(tCost * 100) / 100,
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
    setNewProductBrand('');
    setNewProductSellingPricePack('');
    setNewProductSellingPriceCarton('');
    setQuantityInput('');
    setUnitCost('');
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
  const totalPacksSupplied = (purchases || []).reduce((sum, p) => sum + (Number(p.packsCount ?? p.quantityKg) || 0), 0);

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
          <span>سجل فواتير توريد التبغ ({purchases.length})</span>
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
          <span>مردودات كراتين الموردين ({purchaseReturns.length})</span>
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
            setSelectedSupplierId(sup.id);
            setSupplierName(sup.name);
            setActiveTab('shipments');
            setIsAddModalOpen(true);
          }}
        />
      ) : activeTab === 'shipments' ? (
        <div className="space-y-4">
          
          {/* Header Action Bar */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-navy-850">توريدات ومشتريات التبغ والسجائر</h2>
              <p className="text-[11px] text-slate-500 font-medium">
                تسجيل استلام كراتين وعلب السجائر وتحديث متوسط تكلفة المخزون وحسابات الموردين
              </p>
            </div>

            <div className="flex items-center gap-2">
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

          {/* Metrics Overview Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <StatCard
              title="إجمالي المشتريات"
              value={formatCurrency(netPurchasesCost, settings.currency)}
              subtitle={`صافي بعد خصم المردودات`}
              icon={Truck}
            />
            <StatCard
              title="إجمالي العلب الموردة"
              value={`${totalPacksSupplied} علبة`}
              subtitle={`تعادل ${(totalPacksSupplied / 10).toFixed(1)} كرتونة`}
              icon={Package}
            />
            <StatCard
              title="سندات المردودات"
              value={formatCurrency(totalPurchaseReturnsCost, settings.currency)}
              subtitle={`${purchaseReturns.length} سند مردود`}
              icon={RotateCcw}
            />
          </div>

          {/* Filter & View Controls */}
          <div className="bg-white rounded-xl p-3 shadow-2xs border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 flex-1">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="بحث في فواتير التوريد أو الموردين..."
                  className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setFilterPayment('all')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
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
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filterPayment === 'cash'
                      ? 'bg-white text-navy-850 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy-850'
                  }`}
                >
                  نقدي
                </button>
                <button
                  type="button"
                  onClick={() => setFilterPayment('credit')}
                  className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                    filterPayment === 'credit'
                      ? 'bg-white text-navy-850 shadow-2xs font-bold'
                      : 'text-slate-600 hover:text-navy-850'
                  }`}
                >
                  آجل (دين)
                </button>
              </div>
            </div>

            <div className="flex items-center bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-navy-850 shadow-2xs' : 'text-slate-400'}`}
              >
                <LayoutList size={14} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded-md transition-all ${viewMode === 'cards' ? 'bg-white text-navy-850 shadow-2xs' : 'text-slate-400'}`}
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
              description="سجل فواتير توريد السجائر والتبغ الواردة من الموردين لضبط المخزون وحسابات التكلفة."
              actionLabel="تسجيل أول توريد"
              onAction={() => {
                setDate(getCurrentDateFormatted());
                setIsAddModalOpen(true);
              }}
              actionIcon={Plus}
            />
          ) : (
            <div>
              {viewMode === 'table' ? (
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead align="right">الصنف</TableHead>
                        <TableHead align="right">المورد / الموزع</TableHead>
                        <TableHead align="center">الكمية الموردة</TableHead>
                        <TableHead align="right">تكلفة العلبة</TableHead>
                        <TableHead align="right">إجمالي الفاتورة</TableHead>
                        <TableHead align="center">طريقة السداد</TableHead>
                        <TableHead align="center">التاريخ</TableHead>
                        <TableHead align="center">إجراءات</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {filteredPurchases.map((pur) => {
                        const totalPacks = Number(pur.packsCount ?? pur.quantityKg ?? 0);
                        const costPack = Number(pur.costPerKg ?? 0);
                        const unitLabel = pur.purchaseUnit === 'carton' ? `${pur.purchaseQuantity || pur.cartonsCount || Math.floor(totalPacks / (pur.packsPerCarton || 10))} كرتونة` : `${totalPacks} علبة`;

                        return (
                          <TableRow key={pur.id}>
                            <TableCell align="right">
                              <span className="font-bold text-xs text-slate-900 block truncate max-w-[150px]">
                                {pur.productName}
                              </span>
                              {pur.brand && (
                                <span className="text-[10px] text-slate-400 block truncate">{pur.brand}</span>
                              )}
                            </TableCell>

                            <TableCell align="right">
                              <span className="font-medium text-slate-700 block truncate max-w-[140px]">
                                {pur.supplierName}
                              </span>
                            </TableCell>

                            <TableCell align="center">
                              <Badge variant="neutral" size="sm">
                                {unitLabel} ({totalPacks} علبة)
                              </Badge>
                            </TableCell>

                            <TableCell isNumeric align="right" className="font-mono text-slate-700">
                              {costPack.toFixed(2)} {settings.currency}
                            </TableCell>

                            <TableCell isNumeric align="right">
                              <span className="font-mono font-bold text-navy-850 block">
                                {Number(pur.totalCost).toFixed(2)} {settings.currency}
                              </span>
                              {pur.hasReturns && (
                                <span className="text-[10px] text-amber-800 font-mono block">
                                  مردود: {pur.returnedKg} علبة
                                </span>
                              )}
                            </TableCell>

                            <TableCell align="center">
                              {pur.paymentMethod === 'bank' ? (
                                <Badge variant="info" size="sm">تحويل بنكي</Badge>
                              ) : pur.paymentMethod === 'credit' ? (
                                <Badge variant="warning" size="sm">آجل (دين)</Badge>
                              ) : (
                                <Badge variant="success" size="sm">نقداً (كاش)</Badge>
                              )}
                            </TableCell>

                            <TableCell align="center" className="text-slate-400 text-[11px] font-mono whitespace-nowrap">
                              <div>{pur.date}</div>
                            </TableCell>

                            <TableCell align="center">
                              <div className="flex items-center justify-center gap-1">
                                <Button
                                  variant="accent"
                                  size="sm"
                                  onClick={() => setSelectedPurchaseForReturn(pur)}
                                  icon={RotateCcw}
                                  title="تسجيل مردود مشتريات للمورد"
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
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}

              {/* Mobile Cards View */}
              <div className={`space-y-2.5 ${viewMode === 'table' ? 'md:hidden' : ''}`}>
                {filteredPurchases.map((pur) => (
                  <div key={pur.id} className="bg-white rounded-xl p-3.5 shadow-2xs border border-slate-200/80 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">{pur.productName}</h3>
                        <p className="text-[11px] text-slate-500">{pur.supplierName} • {pur.date}</p>
                      </div>
                      <span className="font-bold font-mono text-sm text-navy-850">
                        {Number(pur.totalCost).toFixed(2)} {settings.currency}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100">
                      <span className="text-slate-600">
                        الكمية: <strong>{pur.packsCount ?? pur.quantityKg} علبة</strong>
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="accent"
                          size="sm"
                          onClick={() => setSelectedPurchaseForReturn(pur)}
                          icon={RotateCcw}
                        >
                          مردود
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePurchase(pur)}
                          icon={Trash2}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : (
        /* Purchase Returns Tab */
        <div className="space-y-3">
          {purchaseReturns.length === 0 ? (
            <EmptyState
              icon={RotateCcw}
              title="لا توجد مردودات مشتريات مسجلة"
              description="عند إرجاع كراتين أو علب معيبة للمورد بتكلفة الشراء الأصلية ستظهر السجلات هنا."
            />
          ) : (
            <div className="bg-white rounded-xl shadow-2xs border border-slate-200/80 overflow-hidden">
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead align="right">الصنف المردود</TableHead>
                    <TableHead align="right">المورد</TableHead>
                    <TableHead align="center">الكمية المردودة</TableHead>
                    <TableHead align="right">المبلغ المسترد</TableHead>
                    <TableHead align="center">طريقة التسوية</TableHead>
                    <TableHead align="center">التاريخ</TableHead>
                    <TableHead align="center">إجراءات</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {purchaseReturns.map(ret => (
                    <TableRow key={ret.id}>
                      <TableCell align="right" className="font-bold text-xs">{ret.productName}</TableCell>
                      <TableCell align="right" className="text-xs">{ret.supplierName}</TableCell>
                      <TableCell align="center" className="font-mono text-xs font-bold text-amber-800">
                        {ret.returnedKg} علبة
                      </TableCell>
                      <TableCell isNumeric align="right" className="font-mono font-bold text-xs">
                        {Number(ret.totalRefundAmount).toFixed(2)} {settings.currency}
                      </TableCell>
                      <TableCell align="center">
                        <Badge variant="neutral" size="sm">
                          {ret.refundMethod === 'supplier_debt_deduction' ? 'خصم من دين المورد' : 'نقداً'}
                        </Badge>
                      </TableCell>
                      <TableCell align="center" className="font-mono text-xs text-slate-400">{ret.date}</TableCell>
                      <TableCell align="center">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={Trash2}
                          onClick={async () => {
                            if (window.confirm('هل أنت متأكد من حذف سند المردود؟')) {
                              try { await deletePurchaseReturn(ret.id); }
                              catch (e) { alert('تعذر حذف السند: ' + e.message); }
                            }
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}

      {/* Add New Purchase Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => { if (!savingPurchaseRef.current) setIsAddModalOpen(false); }}
        title="تسجيل فاتورة توريد تبغ جديدة"
        subtitle="شراء وتوريد كراتين وعلب السجائر وتحديث متوسط التكلفة وحسابات المورد"
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSavePurchase} className="space-y-4 text-xs">
          
          {/* Source Toggle */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setItemSourceType('existing')}
              className={`py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                itemSourceType === 'existing' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
              }`}
            >
              <Package size={14} />
              <span>صنف مسجل حالياً في المحل</span>
            </button>

            <button
              type="button"
              onClick={() => setItemSourceType('new')}
              className={`py-2 rounded-lg transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                itemSourceType === 'new' ? 'bg-white text-primary-700 shadow-2xs' : 'text-slate-500'
              }`}
            >
              <Sparkles size={14} />
              <span>صنف تبغ جديد يورد لأول مرة</span>
            </button>
          </div>

          {/* Existing Product Selector */}
          {itemSourceType === 'existing' ? (
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اختر صنف التبغ *</label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => handleSelectExistingProduct(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="">-- اختر الصنف --</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.brand ? `[${p.brand}]` : ''} (الكرتونة: {p.packsPerCarton || 10} علب)
                  </option>
                ))}
              </select>
            </div>
          ) : (
            /* New Tobacco Product Inputs */
            <div className="p-3 bg-amber-50/50 border border-amber-200/60 rounded-xl space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">اسم الصنف الجديد *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: ونستون أزرق"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">الماركة / المصنع</label>
                  <input
                    type="text"
                    placeholder="مثال: JTI"
                    value={newProductBrand}
                    onChange={(e) => setNewProductBrand(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">عدد العلب بالكرتونة</label>
                  <input
                    type="number"
                    min="1"
                    value={newProductPacksPerCarton}
                    onChange={(e) => setNewProductPacksPerCarton(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">سعر بيع العلبة قطاعي</label>
                  <input
                    type="number"
                    step="0.5"
                    placeholder="0.00"
                    value={newProductSellingPricePack}
                    onChange={(e) => setNewProductSellingPricePack(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-700 mb-0.5">سعر كرتونة الجملة</label>
                  <input
                    type="number"
                    step="1"
                    placeholder="0.00"
                    value={newProductSellingPriceCarton}
                    onChange={(e) => setNewProductSellingPriceCarton(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Supplier Selection */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المورد / الموزع *</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedSupplierId(val);
                  const sup = suppliers.find(s => s.id === val);
                  if (sup) setSupplierName(sup.name);
                }}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
              >
                <option value="">-- اختر مورد مسجل --</option>
                {suppliers.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">تاريخ التوريد</label>
              <input
                type="text"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
              />
            </div>
          </div>

          {/* Tobacco Unit & Quantity Calculator */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-[11px]">حسابات الكمية والتكلفة:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setPurchaseUnit('carton');
                    if (quantityInput && unitCost) setTotalCost((Number(quantityInput) * Number(unitCost)).toFixed(2));
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    purchaseUnit === 'carton' ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  شراء بالكرتونة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setPurchaseUnit('pack');
                    if (quantityInput && unitCost) setTotalCost((Number(quantityInput) * Number(unitCost)).toFixed(2));
                  }}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    purchaseUnit === 'pack' ? 'bg-primary-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  شراء بالعلبة
                </button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                  الكمية ({purchaseUnit === 'carton' ? 'كرتونة' : 'علبة'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  placeholder="0.0"
                  value={quantityInput}
                  onChange={(e) => handleQuantityChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-black text-slate-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-700 mb-0.5">
                  تكلفة {purchaseUnit === 'carton' ? 'الكرتونة' : 'العلبة'} ({settings.currency})
                </label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0.00"
                  value={unitCost}
                  onChange={(e) => handleUnitCostChange(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 font-mono"
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
                  className="w-full px-2.5 py-1.5 bg-white border border-primary-500 rounded-lg text-xs font-black text-primary-700 font-mono"
                />
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">طريقة السداد:</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`py-2 rounded-md transition-all text-center cursor-pointer ${
                  paymentMethod === 'cash' ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                نقدي (كاش)
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('bank')}
                className={`py-2 rounded-md transition-all text-center cursor-pointer ${
                  paymentMethod === 'bank' ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                تحويل بنكي
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit')}
                className={`py-2 rounded-md transition-all text-center cursor-pointer ${
                  paymentMethod === 'credit' ? 'bg-white text-primary-700 shadow-2xs font-bold' : 'text-slate-600'
                }`}
              >
                آجل (دين للمورد)
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isSavingPurchase}
              onClick={() => setIsAddModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSavingPurchase}
            >
              {isSavingPurchase ? 'جارٍ حفظ فاتورة التوريد...' : 'حفظ فاتورة التوريد'}
            </Button>
          </div>
        </form>
      </Modal>

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
