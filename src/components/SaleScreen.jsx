import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Plus, Trash2, Edit3, Scale, User, UserPlus, 
  Receipt, Printer, Check, ShoppingBag, 
  RotateCcw, Sparkles, ChevronDown, Phone, ArrowRight, ShieldCheck, CreditCard,
  Landmark, ArrowUpDown, AlertTriangle, Settings as SettingsIcon, Package,
  Banknote, Building2, FileText, Layers, CheckCircle2, Search, X
} from 'lucide-react';
import { formatCurrency, formatWeight, getCurrentDateFormatted, getCurrentTimeFormatted, padInvoiceNumber } from '../utils/formatters';
import WeightTallyModal from './WeightTallyModal';
import { Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Modal, Input } from './ui';

export default function SaleScreen({ 
  store, 
  onViewReceipt,
  onViewA4Invoice,
  onOpenNewCustomerModal,
  onOpenSettings,
  onNavigate
}) {
  const { products, customers, settings, saveInvoice } = store;

  // Out of stock alert state for modal guidance
  const [outOfStockAlert, setOutOfStockAlert] = useState(null);

  // Invoice form state
  const [saleType, setSaleType] = useState('cash'); // 'cash' | 'bank' | 'credit' | 'split'
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitBank, setSplitBank] = useState('');
  const [splitCredit, setSplitCredit] = useState('');
  const [weightMode, setWeightMode] = useState(settings.defaultWeightMode || 'net_after_tare'); // 'net_after_tare' | 'gross'
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  
  // Current items in cart
  const [cartItems, setCartItems] = useState([]);

  // Active item editor state (drawer / modal)
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [activeItem, setActiveItem] = useState({
    id: '',
    productId: '',
    name: '',
    unit: 'صندوق',
    packageCount: 1,
    tarePerUnit: 2.0,
    grossWeight: 0,
    pricePerKg: 0,
    costPerKg: 0,
    weighings: [],
  });

  // Scale multi-weighing modal state
  const [isTallyModalOpen, setIsTallyModalOpen] = useState(false);

  // Totals and payments
  const [discountAmount, setDiscountAmount] = useState(0);
  const [paidAmount, setPaidAmount] = useState('');
  const [notes, setNotes] = useState('');

  // Auto-fill customer details when customer is selected
  useEffect(() => {
    if (selectedCustomerId && selectedCustomerId !== 'walk_in') {
      const cust = customers.find(c => c.id === selectedCustomerId);
      if (cust) {
        setCustomerName(cust.name);
        setCustomerPhone(cust.phone || '');
      }
    } else if (selectedCustomerId === 'walk_in') {
      setCustomerName('زبون نقدي عام');
      setCustomerPhone('');
    }
  }, [selectedCustomerId, customers]);

  // Change weightMode and recalculate existing cart items
  const handleWeightModeChange = (newMode) => {
    setWeightMode(newMode);
    setCartItems(prev => prev.map(item => {
      const gross = Number(item.grossWeight) || 0;
      const tare = Number(item.totalTareWeight) || 0;
      const newNet = newMode === 'net_after_tare' ? Math.max(0, gross - tare) : gross;
      const roundedNet = Math.round(newNet * 100) / 100;
      const newTotal = Math.round(roundedNet * Number(item.pricePerKg) * 100) / 100;
      return {
        ...item,
        netWeight: roundedNet,
        total: newTotal
      };
    }));
  };

  // Quick select vegetable to start adding
  const handleSelectProduct = (prod) => {
    setActiveItem({
      id: '',
      productId: prod.id,
      name: prod.name,
      unit: prod.defaultUnit || 'صندوق',
      packageCount: 1,
      tarePerUnit: prod.defaultTareWeight || 2.0,
      grossWeight: 0,
      pricePerKg: prod.defaultPricePerKg || 0,
      costPerKg: Number(prod.costPerKg) || 0,
      weighings: [],
    });
    setEditingItemIndex(null);
    setIsItemEditorOpen(true);
  };

  // Open item editor for existing item
  const handleEditItem = (index) => {
    setEditingItemIndex(index);
    setActiveItem({ ...cartItems[index] });
    setIsItemEditorOpen(true);
  };

  // Remove item from cart
  const handleRemoveItem = (index) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Save / apply item into cart
  const handleSaveItem = () => {
    if (!activeItem.name || Number(activeItem.grossWeight) <= 0) {
      alert('يرجى التأكد من إدخال اسم الصنف والوزن القائم بشكل صحيح');
      return;
    }

    const packageCount = Number(activeItem.packageCount) || 1;
    const tarePerUnit = Math.round(Number(activeItem.tarePerUnit || 0) * 100) / 100;
    const totalTareWeight = Math.round(packageCount * tarePerUnit * 100) / 100;
    const grossWeight = Math.round(Number(activeItem.grossWeight || 0) * 100) / 100;

    // Net weight calculation
    const calculatedNet = weightMode === 'net_after_tare' 
      ? Math.max(0, grossWeight - totalTareWeight)
      : grossWeight;
    const netWeight = Math.round(calculatedNet * 100) / 100;

    const pricePerKg = Math.round(Number(activeItem.pricePerKg || 0) * 100) / 100;
    const total = Math.round(netWeight * pricePerKg * 100) / 100;

    // Check stock availability if allowNegativeStock is false
    const matchingProduct = products.find(p => 
      (activeItem.productId && p.id === activeItem.productId) || 
      (p.name.trim() === (activeItem.name || '').trim())
    );

    if (matchingProduct && !settings.allowNegativeStock) {
      const currentStock = Number(matchingProduct.currentStockKg) || 0;
      const alreadyInCart = cartItems
        .filter((_, idx) => idx !== editingItemIndex)
        .filter(it => (it.productId && it.productId === matchingProduct.id) || (it.name.trim() === matchingProduct.name.trim()))
        .reduce((sum, it) => sum + (Number(it.netWeight) || 0), 0);
      
      const totalNeeded = Math.round((alreadyInCart + netWeight) * 100) / 100;
      if (totalNeeded > currentStock) {
        setOutOfStockAlert({
          productName: activeItem.name,
          currentStock: currentStock,
          requestedWeight: totalNeeded,
          availableLeft: Math.max(0, Math.round((currentStock - alreadyInCart) * 100) / 100)
        });
        return;
      }
    }

    const finalizedItem = {
      ...activeItem,
      id: activeItem.id || `item-${Date.now()}`,
      productId: matchingProduct ? matchingProduct.id : (activeItem.productId || null),
      costPerKg: matchingProduct ? (Number(matchingProduct.costPerKg) || 0) : (Number(activeItem.costPerKg) || 0),
      packageCount,
      tarePerUnit,
      totalTareWeight,
      grossWeight,
      netWeight,
      pricePerKg,
      total,
      weighingCount: activeItem.weighings && activeItem.weighings.length > 0 ? activeItem.weighings.length : 1
    };

    if (editingItemIndex !== null) {
      setCartItems(prev => prev.map((it, idx) => idx === editingItemIndex ? finalizedItem : it));
    } else {
      setCartItems(prev => [...prev, finalizedItem]);
    }

    setIsItemEditorOpen(false);
    setEditingItemIndex(null);
  };

  // Calculations for current invoice with exact rounding
  const totalPackages = cartItems.reduce((sum, it) => sum + (Number(it.packageCount) || 0), 0);
  const totalGrossWeight = Math.round(cartItems.reduce((sum, it) => sum + (Number(it.grossWeight) || 0), 0) * 100) / 100;
  const totalTareWeight = Math.round(cartItems.reduce((sum, it) => sum + (Number(it.totalTareWeight) || 0), 0) * 100) / 100;
  const totalNetWeight = Math.round(cartItems.reduce((sum, it) => sum + (Number(it.netWeight) || 0), 0) * 100) / 100;
  const totalWeighingsCount = cartItems.reduce((sum, it) => sum + (Number(it.weighingCount) || 1), 0);

  const subtotal = Math.round(cartItems.reduce((sum, it) => sum + (Number(it.total) || 0), 0) * 100) / 100;
  const discount = Math.round(Number(discountAmount || 0) * 100) / 100;
  const finalTotal = Math.round(Math.max(0, subtotal - discount) * 100) / 100;

  // Multi-Payment calculations
  const effectiveBankName = bankName.trim() || 'تحويل بنكي';

  const splitCashNum = Math.round(Number(splitCash || 0) * 100) / 100;
  const splitBankNum = Math.round(Number(splitBank || 0) * 100) / 100;
  const splitCreditNum = Math.round(Number(splitCredit || 0) * 100) / 100;
  const splitTotalEntered = Math.round((splitCashNum + splitBankNum + splitCreditNum) * 100) / 100;
  const splitDifference = Math.round((finalTotal - splitTotalEntered) * 100) / 100;

  let calculatedPaidAmount = 0;
  let calculatedChangeAmount = 0;
  let calculatedRemainingDebt = 0;
  let calculatedCashAmount = 0;
  let calculatedBankAmount = 0;
  let calculatedCreditAmount = 0;

  if (saleType === 'cash') {
    const parsed = paidAmount === '' ? finalTotal : Math.round(Number(paidAmount) * 100) / 100;
    calculatedPaidAmount = parsed;
    calculatedChangeAmount = Math.round((parsed > finalTotal ? parsed - finalTotal : 0) * 100) / 100;
    calculatedRemainingDebt = Math.round((parsed < finalTotal ? finalTotal - parsed : 0) * 100) / 100;
    calculatedCashAmount = Math.min(parsed, finalTotal);
    calculatedCreditAmount = calculatedRemainingDebt;
  } else if (saleType === 'bank') {
    calculatedPaidAmount = finalTotal;
    calculatedChangeAmount = 0;
    calculatedRemainingDebt = 0;
    calculatedBankAmount = finalTotal;
  } else if (saleType === 'credit') {
    calculatedPaidAmount = 0;
    calculatedChangeAmount = 0;
    calculatedRemainingDebt = finalTotal;
    calculatedCreditAmount = finalTotal;
  } else if (saleType === 'split') {
    calculatedPaidAmount = Math.round((splitCashNum + splitBankNum) * 100) / 100;
    calculatedRemainingDebt = splitCreditNum;
    calculatedCashAmount = splitCashNum;
    calculatedBankAmount = splitBankNum;
    calculatedCreditAmount = splitCreditNum;
  }

  // Handle invoice submission
  const handleSaveInvoice = async (printImmediately = false) => {
    if (submittingRef.current) return;
    if (cartItems.length === 0) {
      alert('الفاتورة فارغة، يرجى إضافة أصناف أولاً');
      return;
    }

    // Accounting Protection: Check if any item in cart exceeds stock when allowNegativeStock is false
    if (!settings.allowNegativeStock) {
      for (const it of cartItems) {
        const prod = products.find(p => (it.productId && p.id === it.productId) || (p.name.trim() === (it.name || '').trim()));
        if (prod) {
          const curStock = Number(prod.currentStockKg) || 0;
          const reqWeight = Number(it.netWeight) || 0;
          if (reqWeight > curStock) {
            setOutOfStockAlert({
              productName: it.name,
              currentStock: curStock,
              requestedWeight: reqWeight,
              availableLeft: curStock
            });
            return;
          }
        }
      }
    }

    if (saleType === 'split' && splitDifference !== 0) {
      if (!window.confirm(`تنبيه: مجموع مبالغ الدفع المركب (${splitTotalEntered} ${settings.currency}) لا يتطابق مع إجمالي الفاتورة (${finalTotal} ${settings.currency}). الفارق هو ${splitDifference} ${settings.currency}. هل ترغب بالاستمرار وتسجيل الفارق كدين آجل؟`)) {
        return;
      }
    }

    // Accounting Protection: Cannot sell on credit without customer name
    const effectiveName = customerName.trim() || (selectedCustomerId && selectedCustomerId !== 'walk_in' ? 'عميل' : 'زبون نقدي عام');
    const hasCreditDebt = saleType === 'credit' || calculatedCreditAmount > 0 || calculatedRemainingDebt > 0;
    if (hasCreditDebt && (effectiveName === 'زبون نقدي عام' || !effectiveName)) {
      alert('تنبيه محاسبي مهم: هذه الفاتورة تحتوي على مبلغ آجل (دين). يرجى اختيار عميل مسجل أو كتابة اسم العميل لتثبيت الدين في حسابه.');
      return;
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const invoiceData = {
        date: getCurrentDateFormatted(),
        time: getCurrentTimeFormatted(),
        customerId: selectedCustomerId || (effectiveName !== 'زبون نقدي عام' ? `cust-walkin-${Date.now()}` : 'walk_in'),
        customerName: effectiveName,
        customerPhone: customerPhone || '',
        saleType,
        paymentMethod: saleType,
        bankName: (saleType === 'bank' || (saleType === 'split' && calculatedBankAmount > 0)) ? effectiveBankName : '',
        bankAccountNumber: (saleType === 'bank' || (saleType === 'split' && calculatedBankAmount > 0)) ? bankAccountNumber : '',
        cashAmount: calculatedCashAmount,
        bankAmount: calculatedBankAmount,
        creditAmount: calculatedCreditAmount,
        weightMode,
        items: cartItems,
        totalPackages,
        totalGrossWeight,
        totalTareWeight,
        totalNetWeight,
        totalWeighingsCount,
        subtotal,
        discountAmount: discount,
        finalTotal,
        paidAmount: calculatedPaidAmount,
        changeAmount: calculatedChangeAmount,
        remainingDebt: calculatedRemainingDebt,
        notes,
      };

      const saved = await saveInvoice(invoiceData);

      // Reset current form
      handleResetInvoice(true);

      if (printImmediately) {
        if (onViewA4Invoice) {
          onViewA4Invoice(saved);
        } else {
          onViewReceipt(saved);
        }
      }
    } catch (err) {
      console.error('Invoice save error:', err);
      alert('حدث خطأ أثناء حفظ الفاتورة: ' + (err.message || ''));
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleResetInvoice = (afterCommit = false) => {
    if (submittingRef.current && !afterCommit) return;
    setCartItems([]);
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setDiscountAmount(0);
    setPaidAmount('');
    setSplitCash('');
    setSplitBank('');
    setSplitCredit('');
    setBankAccountNumber('');
    setNotes('');
  };

  const filteredProducts = products.filter(p => {
    if (!productSearch || !productSearch.trim()) return true;
    const q = productSearch.trim().toLowerCase();
    return (p.name && p.name.toLowerCase().includes(q)) || 
           (p.category && p.category.toLowerCase().includes(q));
  });

  return (
    <div className="sale-screen w-full pb-48 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8">
      {/* 2-Column Responsive Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        
        {/* =========================================================================
            RIGHT COLUMN (Main Operations Area - 62% to 65% width on desktop)
            Fast Vegetable Catalog + Active Weighed Items Data Table
           ========================================================================= */}
        <div className="w-full lg:flex-1 space-y-4">
          
          {/* Top Operational Bar: Title, Search, Category Tabs & Custom Item Trigger */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center shadow-2xs">
                  <Package size={16} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-navy-850 leading-tight">
                    الأصناف السريعة والميزان
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    اختر الصنف لإدخال وزنه أو اضغط "وزن صنف مخصص"
                  </p>
                </div>
              </div>

              {/* Action Buttons: Live Search & Custom Item Button */}
              <div className="flex items-center gap-2 flex-wrap justify-end">
                <div className="relative w-40 sm:w-48">
                  <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    placeholder="بحث في الأصناف..."
                    className="w-full pr-8 pl-6 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:bg-white transition-all shadow-2xs"
                  />
                  {productSearch && (
                    <button 
                      type="button"
                      onClick={() => setProductSearch('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveItem({
                      id: '',
                      productId: '',
                      name: '',
                      unit: 'صندوق',
                      packageCount: 1,
                      tarePerUnit: 2.0,
                      grossWeight: 0,
                      pricePerKg: 0,
                      costPerKg: 0,
                      weighings: [],
                    });
                    setEditingItemIndex(null);
                    setIsItemEditorOpen(true);
                  }}
                  className="px-3 py-1.5 bg-primary-600 hover:bg-primary-700 active:scale-98 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
                >
                  <Plus size={15} />
                  <span>+ وزن صنف مخصص</span>
                </button>
              </div>
            </div>

            {/* Fast Vegetable Grid */}
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center border border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs font-bold text-slate-700">
                  {productSearch ? 'لا توجد أصناف مطابقة لبحثك' : 'لا توجد أصناف سريعة مسجلة حالياً في النظام'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                  {productSearch 
                    ? 'جرب البحث باسم صنف آخر أو اضغط زر مسح البحث.' 
                    : 'يمكنك استخدام زر "وزن صنف مخصص" أعلاه لإدخال الصنف وسعره ووزنه مباشرة، أو تسجيل أصنافك من تبويب "الأصناف".'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5">
                {filteredProducts.map(prod => (
                  <button
                    key={prod.id}
                    onClick={() => handleSelectProduct(prod)}
                    className="bg-white hover:border-primary-400 border border-slate-200/80 rounded-lg p-2.5 flex flex-col justify-between text-right transition-all hover:shadow-2xs active:scale-95 group cursor-pointer"
                  >
                    <div className="flex items-start justify-between w-full mb-2">
                      <span className="text-xl p-1 rounded-md bg-slate-50 group-hover:bg-primary-50 transition-colors">
                        {prod.emoji || '🥬'}
                      </span>
                      <span className="text-[10px] text-slate-500 font-medium bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {prod.defaultUnit || 'كجم'}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs font-bold text-navy-850 block truncate group-hover:text-primary-600">
                        {prod.name}
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-mono font-bold text-slate-800 block">
                          {Number(prod.defaultPricePerKg || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold ${
                          (Number(prod.currentStockKg) || 0) <= 0 
                            ? 'bg-rose-50 text-rose-700 border border-rose-200/60'
                            : (Number(prod.currentStockKg) || 0) <= 10
                            ? 'bg-amber-50 text-amber-700 border border-amber-200/60'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200/60'
                        }`}>
                          {(Number(prod.currentStockKg) || 0) <= 0 ? 'نفد (0)' : `${Number(prod.currentStockKg).toFixed(1)} كجم`}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Active Cart Items Table Station */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-slate-700" />
                <h3 className="text-xs font-black text-slate-900">
                  قائمة الأصناف الموزونة في الفاتورة ({cartItems.length})
                </h3>
              </div>

              {cartItems.length > 0 && (
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <span>إجمالي الصافي: <strong className="text-slate-900 font-mono">{formatWeight(totalNetWeight)}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>العبوات: <strong className="text-slate-900 font-mono">{totalPackages}</strong></span>
                </div>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Scale size={36} className="mx-auto mb-2.5 opacity-25 text-slate-600" />
                <p className="text-xs font-bold text-slate-600">الفاتورة فارغة حالياً</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  اختر صنفاً من الأصناف السريعة أعلاه أو اضغط "+ وزن صنف مخصص" لبدء الميزان
                </p>
              </div>
            ) : (
              <div>
                {/* Mobile Cards View (Visible on mobile screens) */}
                <div className="md:hidden divide-y divide-slate-100">
                  {cartItems.map((item, idx) => (
                    <div key={item.id || idx} className="p-3.5 space-y-2 hover:bg-slate-50/70 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-xs font-bold font-mono flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <div>
                            <span className="text-sm font-black text-slate-900 block">{item.name}</span>
                            <span className="text-[11px] text-slate-500 font-medium">{item.packageCount} {item.unit}</span>
                          </div>
                        </div>

                        <div className="text-left">
                          <span className="text-base font-black font-mono text-slate-900 block">
                            {Number(item.total).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {Number(item.pricePerKg).toFixed(2)} {settings.currency}/كجم
                          </span>
                        </div>
                      </div>

                      {/* Weight Breakdown Pill */}
                      <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2 rounded-xl text-center border border-slate-100">
                        <div>
                          <span className="text-[9px] text-slate-400 block font-medium">قائم</span>
                          <span className="text-xs font-mono font-bold text-slate-700">{formatWeight(item.grossWeight)}</span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block font-medium">خصم فارغ</span>
                          <span className="text-xs font-mono font-bold text-rose-600">-{formatWeight(item.totalTareWeight)}</span>
                        </div>
                        <div className="bg-emerald-100/60 rounded-lg py-0.5">
                          <span className="text-[9px] text-emerald-800 block font-bold">صافي</span>
                          <span className="text-xs font-mono font-black text-emerald-700">{formatWeight(item.netWeight)}</span>
                        </div>
                      </div>

                      {/* Mobile Actions */}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleEditItem(idx)}
                          className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Edit3 size={13} />
                          <span>تعديل</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(idx)}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold rounded-lg flex items-center gap-1 active:scale-95 transition-all"
                        >
                          <Trash2 size={13} />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop & Tablet Table View */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead align="center" className="w-10">#</TableHead>
                        <TableHead align="right">الصنف والعبوة</TableHead>
                        <TableHead align="right">الوزن القائم</TableHead>
                        <TableHead align="right">خصم الفارغ</TableHead>
                        <TableHead align="right">الوزن الصافي</TableHead>
                        <TableHead align="right">سعر الكيلو</TableHead>
                        <TableHead align="right">الإجمالي</TableHead>
                        <TableHead align="center" className="w-20">إجراءات</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {cartItems.map((item, idx) => (
                        <TableRow key={item.id || idx}>
                          <TableCell align="center" className="font-mono text-slate-400 font-semibold text-xs">
                            {idx + 1}
                          </TableCell>
                          <TableCell align="right">
                            <span className="font-bold text-slate-900 block">{item.name}</span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              {item.packageCount} {item.unit}
                            </span>
                          </TableCell>
                          <TableCell isNumeric align="right" className="font-mono font-bold text-slate-700">
                            {formatWeight(item.grossWeight)}
                          </TableCell>
                          <TableCell isNumeric align="right" className="font-mono text-slate-500">
                            {formatWeight(item.totalTareWeight)}
                            <span className="text-[10px] text-slate-400 block font-sans">({item.tarePerUnit} كجم/عبوة)</span>
                          </TableCell>
                          <TableCell isNumeric align="right" className="font-mono font-bold text-navy-850">
                            {formatWeight(item.netWeight)}
                          </TableCell>
                          <TableCell isNumeric align="right" className="font-mono font-medium text-slate-700">
                            {Number(item.pricePerKg).toFixed(2)} {settings.currency}
                          </TableCell>
                          <TableCell isNumeric align="right" className="font-mono font-bold text-navy-850 text-sm">
                            {Number(item.total).toFixed(2)} {settings.currency}
                          </TableCell>
                          <TableCell align="center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditItem(idx)}
                                icon={Edit3}
                                title="تعديل"
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemoveItem(idx)}
                                icon={Trash2}
                                className="text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                title="حذف"
                              />
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* =========================================================================
            LEFT COLUMN (Cashier & Checkout Sidebar - 35% to 38% width, sticky on desktop)
            Invoice Meta, Customer, Payment Selector, Financial Breakdown & Checkout
           ========================================================================= */}
        <div id="payment-section" className="w-full lg:w-[420px] xl:w-[460px] shrink-0 space-y-4 lg:sticky lg:top-16">
          
          {/* Card A: Invoice Meta, Customer & Payment Methods */}
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
            
            {/* Header: Invoice Number & Date */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-semibold text-slate-400 block">رقم الفاتورة الحالية:</span>
                <span className="font-mono font-bold text-base text-navy-850">
                  #{padInvoiceNumber(settings.nextInvoiceNumber || 1)} <span className="text-xs">تسلسل محلي؛ المرجع الفريد يظهر بعد الحفظ</span>
                </span>
              </div>

              <div className="text-left text-[11px] font-medium text-slate-500 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-100 font-mono">
                {getCurrentTimeFormatted()} • {getCurrentDateFormatted()}
              </div>
            </div>

            {/* Customer Selection */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-navy-850">
                  العميل {saleType === 'credit' ? <span className="text-rose-600 font-bold">* (مطلوب للآجل)</span> : ''}
                </label>
                {selectedCustomerId && selectedCustomerId !== 'walk_in' && (
                  <span className="text-[10px] font-semibold text-slate-500">
                    {(() => {
                      const c = customers.find(x => x.id === selectedCustomerId);
                      if (!c) return '';
                      if (c.balance > 0) return <span className="text-amber-700 font-mono">دين سابق: {c.balance} {settings.currency}</span>;
                      if (c.balance < 0) return <span className="text-primary-700 font-mono">رصيد: {Math.abs(c.balance)} {settings.currency}</span>;
                      return <span className="text-emerald-700 font-semibold inline-flex items-center gap-1"><Check size={12} /> خالص</span>;
                    })()}
                  </span>
                )}
              </div>

              <div className="flex gap-1.5">
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                >
                  <option value="">-- زبون نقدي عام / كتابة اسم --</option>
                  <option value="walk_in">زبون نقدي عام</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.balance > 0 ? `(عليه ${c.balance} ${settings.currency})` : ''}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={onOpenNewCustomerModal}
                  className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 border border-slate-200 cursor-pointer shadow-2xs"
                  title="إضافة عميل جديد"
                >
                  <UserPlus size={14} className="text-primary-500" />
                  <span className="hidden sm:inline">جديد</span>
                </button>
              </div>

              {/* Free write Customer name / phone */}
              {(!selectedCustomerId || selectedCustomerId === 'walk_in' || saleType === 'credit') && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <input
                    type="text"
                    placeholder="اسم العميل..."
                    value={customerName === 'زبون نقدي عام' && selectedCustomerId === 'walk_in' ? '' : customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                  />
                  <input
                    type="text"
                    placeholder="رقم الهاتف (اختياري)..."
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                  />
                </div>
              )}
            </div>

            {/* Weight Mode & Payment Method Selector */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <label className="block text-[11px] font-semibold text-navy-850">
                  طريقة السداد:
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500 font-medium">طريقة الوزن:</span>
                  <select
                    value={weightMode}
                    onChange={(e) => handleWeightModeChange(e.target.value)}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] font-semibold text-navy-850 shadow-2xs"
                  >
                    <option value="net_after_tare">صافي (خصم العبوة)</option>
                    <option value="gross">قائم (شامل العبوة)</option>
                  </select>
                </div>
              </div>

              {/* 2x2 Payment Method Grid - Wafeq Coordinated Segmented Style */}
              <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSaleType('cash')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    saleType === 'cash'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <Banknote size={14} className={saleType === 'cash' ? 'text-primary-600' : 'text-slate-400'} />
                  <span>نقدي (كاش)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleType('bank')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    saleType === 'bank'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <Building2 size={14} className={saleType === 'bank' ? 'text-primary-600' : 'text-slate-400'} />
                  <span>تحويل بنكي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleType('credit')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    saleType === 'credit'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <FileText size={14} className={saleType === 'credit' ? 'text-primary-600' : 'text-slate-400'} />
                  <span>آجل (دين)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleType('split')}
                  className={`py-2 px-2.5 rounded-lg border text-center transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                    saleType === 'split'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <Layers size={14} className={saleType === 'split' ? 'text-primary-600' : 'text-slate-400'} />
                  <span>دفع مركب</span>
                </button>
              </div>

              {/* Bank Inputs (Clean Neutral Design) */}
              {saleType === 'bank' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-2">
                  <span className="text-[11px] font-bold text-navy-850 block">بيانات التحويل البنكي:</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">اسم البنك</label>
                      <input
                        type="text"
                        placeholder="اكتب اسم البنك..."
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">رقم الحساب / الحوالة</label>
                      <input
                        type="text"
                        placeholder="رقم العملية أو الإيصال..."
                        value={bankAccountNumber}
                        onChange={(e) => setBankAccountNumber(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-semibold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Split Payment Distribution (Clean Neutral Design) */}
              {saleType === 'split' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-navy-850">توزيع السداد المركب:</span>
                    <span className="font-bold font-mono text-[11px] text-slate-600">
                      المتبقي: {splitDifference.toFixed(2)} {settings.currency}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">1. نقدي (كاش)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">2. تحويل بنكي</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={splitBank}
                        onChange={(e) => setSplitBank(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>

                    <div className="bg-white p-2 rounded-lg border border-slate-200">
                      <label className="block text-[10px] font-bold text-slate-600 mb-1">3. آجل (دين)</label>
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={splitCredit}
                        onChange={(e) => setSplitCredit(e.target.value)}
                        className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                      />
                    </div>
                  </div>

                  {Number(splitBank) > 0 && (
                    <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">اسم البنك:</label>
                        <input
                          type="text"
                          placeholder="اسم البنك..."
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-600 mb-0.5">رقم الحساب:</label>
                        <input
                          type="text"
                          placeholder="رقم الحساب..."
                          value={bankAccountNumber}
                          onChange={(e) => setBankAccountNumber(e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

          </div>

          {/* Card B: Financial Totals & Checkout Station */}
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
            
            {/* Financial summary rows */}
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>المبلغ الإجمالي (قبل الخصم):</span>
                <span className="font-bold text-navy-850 font-mono">{subtotal.toFixed(2)} {settings.currency}</span>
              </div>

              {/* Discount row */}
              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">قيمة الخصم ({settings.currency}):</span>
                <input
                  type="number"
                  step="0.5"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-left font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Net Total Box (Wafeq Financial Card) */}
              <div className="flex justify-between items-center py-3 px-4 bg-slate-50 border border-slate-200/90 rounded-xl">
                <div>
                  <span className="text-[11px] text-slate-500 block font-medium">المطلوب سداده:</span>
                  <span className="font-bold text-xs text-navy-850">صافي الفاتورة</span>
                </div>
                <div className="text-left">
                  <span className="font-bold text-2xl font-mono text-navy-850 tracking-tight">
                    {finalTotal.toFixed(2)}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 mr-1">{settings.currency}</span>
                </div>
              </div>

              {/* Cash Paid Amount / Change */}
              {saleType === 'cash' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      المدفوع نقداً ({settings.currency})
                    </label>
                    <input
                      type="number"
                      step="1"
                      inputMode="decimal"
                      placeholder={finalTotal.toFixed(2)}
                      value={paidAmount}
                      onChange={(e) => setPaidAmount(e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                    />
                  </div>

                  <div className="flex flex-col justify-end">
                    {calculatedChangeAmount > 0 ? (
                      <div className="p-1.5 bg-emerald-50 border border-emerald-200/80 rounded-lg">
                        <span className="text-[10px] text-emerald-800 block font-medium">الباقي للزبون:</span>
                        <span className="text-xs font-bold text-emerald-700 font-mono">
                          {calculatedChangeAmount.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    ) : calculatedRemainingDebt > 0 ? (
                      <div className="p-1.5 bg-amber-50 border border-amber-200/80 rounded-lg">
                        <span className="text-[10px] text-amber-800 block font-medium">دين في الحساب:</span>
                        <span className="text-xs font-bold text-amber-800 font-mono">
                          {calculatedRemainingDebt.toFixed(2)} {settings.currency}
                        </span>
                      </div>
                    ) : (
                      <div className="p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                        <span className="text-xs font-semibold text-slate-700 flex items-center justify-center gap-1">
                          <CheckCircle2 size={13} className="text-emerald-600" />
                          <span>مدفوع بالكامل</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <input
                  type="text"
                  placeholder="ملاحظات تظهر بالفاتورة قبل الطباعة (اختياري)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Action Buttons: Primary Save & Print A4, Secondary, Reset */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting || cartItems.length === 0}
                onClick={() => handleSaveInvoice(true)}
                className={`w-full py-2.5 px-4 bg-primary-600 hover:bg-primary-700 active:scale-[0.98] text-white font-semibold text-xs rounded-lg flex items-center justify-center gap-2 shadow-2xs transition-all ${
                  isSubmitting || cartItems.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                }`}
              >
                <Printer size={15} />
                <span>{isSubmitting ? 'جاري الحفظ والترحيل...' : 'حفظ وطباعة الفاتورة A4'}</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isSubmitting || cartItems.length === 0}
                  onClick={() => handleSaveInvoice(false)}
                  className={`py-2 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-all shadow-2xs ${
                    isSubmitting || cartItems.length === 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <Check size={14} className="text-primary-600" />
                  <span>{isSubmitting ? 'حفظ...' : 'حفظ بدون طباعة'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleResetInvoice()}
                  disabled={isSubmitting}
                  className="py-2 px-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 font-semibold text-xs rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>تفريغ الفاتورة</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Item Editor Modal / Drawer */}
      {isItemEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
          <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl p-5 max-h-[92vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                {editingItemIndex !== null ? 'تعديل الصنف' : 'إضافة صنف للميزان'}
              </h3>
              <button 
                onClick={() => setIsItemEditorOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                إغلاق ✕
              </button>
            </div>

            {/* Live Stock Indicator for the active item */}
            {(() => {
              const matchedProd = products.find(p => 
                (activeItem.productId && p.id === activeItem.productId) || 
                (p.name.trim() === (activeItem.name || '').trim())
              );
              if (!matchedProd) return null;
              const stock = Number(matchedProd.currentStockKg) || 0;
              const isOut = stock <= 0;
              const isLow = stock > 0 && stock <= 10;
              return (
                <div className={`p-2.5 rounded-xl text-xs flex items-center justify-between border ${
                  isOut 
                    ? 'bg-rose-50 text-rose-800 border-rose-200' 
                    : isLow 
                    ? 'bg-amber-50 text-amber-800 border-amber-200' 
                    : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                  <div className="flex items-center gap-2">
                    <Package size={16} className={isOut ? 'text-rose-600' : isLow ? 'text-amber-600' : 'text-emerald-600'} />
                    <span className="font-bold">رصيد المخزن المسجل حالياً:</span>
                    <strong className="font-mono text-sm">{stock.toFixed(2)} كجم</strong>
                  </div>
                  {isOut ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-rose-200/80 text-rose-900 rounded-full">
                      نفد المخزون
                    </span>
                  ) : isLow ? (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-amber-200/80 text-amber-900 rounded-full">
                      قارَب على النفاد
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200/80 text-emerald-900 rounded-full">
                      متوفر
                    </span>
                  )}
                </div>
              );
            })()}

            {/* Item Name & Unit */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف</label>
                <input
                  type="text"
                  value={activeItem.name}
                  onChange={(e) => setActiveItem(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="مثال: بطاطا"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">نوع العبوة</label>
                <select
                  value={activeItem.unit}
                  onChange={(e) => setActiveItem(prev => ({ ...prev, unit: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  <option value="صندوق">صندوق</option>
                  <option value="شوال">شوال</option>
                  <option value="كرتونة">كرتونة</option>
                  <option value="قفص">قفص</option>
                  <option value="شبكة">شبكة</option>
                  <option value="كيلو">كيلو مباشر</option>
                </select>
              </div>
            </div>

            {/* Package count & Tare per unit */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">عدد العبوات</label>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={activeItem.packageCount}
                  onChange={(e) => setActiveItem(prev => ({ ...prev, packageCount: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">وزن العبوة الفارغة (كجم)</label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={activeItem.tarePerUnit}
                  onChange={(e) => setActiveItem(prev => ({ ...prev, tarePerUnit: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">
                  إجمالي الخصم: {(activeItem.packageCount * activeItem.tarePerUnit).toFixed(2)} كجم
                </span>
              </div>
            </div>

            {/* Gross Weight & Tally Calculator Button */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">إجمالي الوزن القائم (كجم)</label>
                <button
                  type="button"
                  onClick={() => setIsTallyModalOpen(true)}
                  className="text-xs font-bold text-primary-600 hover:text-primary-700 bg-primary-50 hover:bg-primary-100/80 px-2.5 py-1 rounded-lg flex items-center gap-1 transition-colors border border-primary-100 cursor-pointer"
                >
                  <Scale size={14} />
                  <span>حاسبة قلّبات الميزان ({activeItem.weighings?.length || 0} وزنات)</span>
                </button>
              </div>

              <input
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="أدخل الوزن الإجمالي على الميزان"
                value={activeItem.grossWeight || ''}
                onChange={(e) => setActiveItem(prev => ({ ...prev, grossWeight: Number(e.target.value) }))}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            {/* Price per Kg & Live Total calculation preview */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  سعر الكيلو ({settings.currency})
                </label>
                <input
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  value={activeItem.pricePerKg || ''}
                  onChange={(e) => setActiveItem(prev => ({ ...prev, pricePerKg: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-xl flex flex-col justify-center">
                <span className="text-[10px] text-slate-500 font-semibold block">إجمالي الصنف التقديري:</span>
                <span className="text-base font-bold font-mono text-navy-850">
                  {(
                    (weightMode === 'net_after_tare'
                      ? Math.max(0, (Number(activeItem.grossWeight) || 0) - (Number(activeItem.packageCount) * Number(activeItem.tarePerUnit)))
                      : (Number(activeItem.grossWeight) || 0)
                    ) * (Number(activeItem.pricePerKg) || 0)
                  ).toFixed(2)} {settings.currency}
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsItemEditorOpen(false)}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveItem}
                className="flex-2 py-3 bg-primary-500 hover:bg-primary-600 text-white font-bold text-sm rounded-xl shadow-soft cursor-pointer"
              >
                اعتماد الصنف بالفاتورة
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Mobile Sticky Quick-Checkout Floating Bar (Docked above BottomNav) */}
      {(globalThis.document?.body ? createPortal : (content) => content)(
        <div className="lg:hidden fixed bottom-[calc(64px+env(safe-area-inset-bottom,0px))] inset-x-0 z-30 pointer-events-none">
          <div className="max-w-lg mx-auto bg-white text-navy-850 p-3 shadow-soft border-t border-slate-200 pointer-events-auto flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-slate-600 font-medium truncate">
                {cartItems.length} {cartItems.length === 1 ? 'صنف' : 'أصناف'} • {totalPackages} عبوة ({formatWeight(totalNetWeight)})
              </span>
              <div className="flex items-baseline gap-1">
                <span className="text-navy-850 font-bold font-mono text-2xl tracking-tight">
                  {finalTotal.toFixed(2)}
                </span>
                <span className="text-xs text-slate-600 font-medium">{settings.currency}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('payment-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="min-h-12 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl flex items-center gap-1 border border-slate-200 transition-colors cursor-pointer"
              >
                <span>الدفع</span>
                <ChevronDown size={14} />
              </button>

              <button
                type="button"
                disabled={isSubmitting || cartItems.length === 0}
                onClick={() => handleSaveInvoice(true)}
                className="min-h-12 px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Printer size={15} />
                <span>{isSubmitting ? 'جاري الحفظ...' : 'حفظ وطباعة'}</span>
              </button>
            </div>
            <button type="button" disabled={isSubmitting || cartItems.length === 0}
              onClick={() => handleSaveInvoice(false)}
              className="w-full min-h-11 text-sm font-semibold text-primary-700 bg-primary-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
              حفظ بدون طباعة
            </button>
          </div>
        </div>
      , globalThis.document?.body)}

      {/* Scale Multi-Tally Modal */}
      <WeightTallyModal
        isOpen={isTallyModalOpen}
        onClose={() => setIsTallyModalOpen(false)}
        itemName={activeItem.name}
        initialWeighings={activeItem.weighings || []}
        onApply={(totalGross, weighingsList) => {
          setActiveItem(prev => ({
            ...prev,
            grossWeight: totalGross,
            weighings: weighingsList
          }));
        }}
      />

      {/* Out of Stock Policy Modal / Cashier Guidance Dialog */}
      {outOfStockAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100 animate-in zoom-in-95">
            {/* Header with Warning Accent */}
            <div className="bg-amber-600 text-white p-5 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                <AlertTriangle size={28} className="text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold leading-tight">تنبيه: رصيد الصنف لا يكفي بالمخزن!</h3>
                <p className="text-xs text-amber-100 font-normal mt-0.5">وضع الضبط المحاسبي الصارم مفعل لمنع البيع الوهمي</p>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              {/* Product and Stock details card */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
                <div className="flex justify-between items-center pb-2 border-b border-slate-200/60">
                  <span className="text-slate-500 font-medium">اسم الصنف:</span>
                  <span className="text-sm font-bold text-navy-850">{outOfStockAlert.productName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">الرصيد المتوفر بالمخزن:</span>
                  <span className="font-bold font-mono text-rose-600 text-sm">
                    {outOfStockAlert.currentStock.toFixed(2)} كجم
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">الوزن المطلوب بيعه:</span>
                  <span className="font-bold font-mono text-navy-850 text-sm">
                    {outOfStockAlert.requestedWeight.toFixed(2)} كجم
                  </span>
                </div>
              </div>

              {/* Explanatory Guide */}
              <div className="bg-primary-50/70 border border-primary-100 rounded-2xl p-3.5 space-y-2 text-navy-850">
                <div className="flex items-center gap-1.5 text-primary-700 font-bold">
                  <span>💡</span>
                  <span>توجيه وإرشاد للبائع / الكاشير:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-slate-700 font-normal">
                  إذا كانت هناك <strong>شحنة بضاعة طازجة وصلت للمحل للتو</strong> وترغب في بيعها للزبون فوراً قبل إدخال فاتورة الشراء والتوريد من المورد دفترياً، يمكنك السماح بذلك من الإعدادات.
                </p>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  عند تفعيل خيار <strong>«السماح بالبيع عند نفاد المخزون»</strong>، سيتيح لك النظام البيع فوراً وسيتحول الرصيد بالسالب مؤقتاً لحين تسجيل فاتورة المورد لتسوية الحساب تلقائياً.
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setOutOfStockAlert(null);
                  if (onOpenSettings) onOpenSettings();
                }}
                className="w-full py-3 bg-navy-850 hover:bg-navy-900 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 shadow-2xs transition-all cursor-pointer"
              >
                <SettingsIcon size={16} className="text-primary-300" />
                <span>الانتقال للإعدادات وتفعيل السماح بالبيع فوراً</span>
              </button>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setOutOfStockAlert(null);
                    if (onNavigate) onNavigate('purchases');
                  }}
                  className="py-2.5 bg-primary-500 hover:bg-primary-600 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Package size={15} />
                  <span>تسجيل فاتورة توريد</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutOfStockAlert(null)}
                  className="py-2.5 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  إلغاء / حسناً
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
