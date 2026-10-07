import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Trash2, Edit3, User, UserPlus, 
  Receipt, Printer, Check, ShoppingBag, 
  RotateCcw, Sparkles, ChevronDown, Phone, ArrowRight, ShieldCheck, CreditCard,
  Landmark, ArrowUpDown, AlertTriangle, Settings as SettingsIcon, Package,
  Banknote, Building2, FileText, Layers, CheckCircle2, Search, X, Barcode,
  Scissors, Tag, Percent
} from 'lucide-react';
import { formatCurrency, getCurrentDateFormatted, getCurrentTimeFormatted, padInvoiceNumber } from '../utils/formatters';
import { Button, Badge, Table, TableHeader, TableHead, TableBody, TableRow, TableCell, Modal, Input } from './ui';
import { UNIT_TYPES, calculateLineItem, normalizeToPacks } from '../../packages/core/src/packaging.js';

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

  // Sale Mode: Retail (قطاعي) vs Wholesale (جملة)
  const [saleMode, setSaleMode] = useState(settings.defaultSaleMode || 'retail'); // 'retail' | 'wholesale'

  // Invoice form state
  const [saleType, setSaleType] = useState('cash'); // 'cash' | 'bank' | 'credit' | 'split'
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [splitCash, setSplitCash] = useState('');
  const [splitBank, setSplitBank] = useState('');
  const [splitCredit, setSplitCredit] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [barcodeScanInput, setBarcodeScanInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const barcodeInputRef = useRef(null);
  
  // Current items in cart
  const [cartItems, setCartItems] = useState([]);

  // Active item editor state (drawer / modal)
  const [isItemEditorOpen, setIsItemEditorOpen] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  /** @type {[{ id: string, productId: string, name: string, unitType: string, unitName: string, quantity: number, packsPerCarton: number, unitsPerPack: number, unitPrice: number, costPrice: number, discountAmount: number }, React.Dispatch<any>]} */
  const [activeItem, setActiveItem] = useState({
    id: '',
    productId: '',
    name: '',
    unitType: /** @type {string} */ (UNIT_TYPES.PACK), // 'carton' | 'pack' | 'piece'
    unitName: 'علبة',
    quantity: 1,
    packsPerCarton: 10,
    unitsPerPack: 20,
    unitPrice: 0,
    costPrice: 0,
    discountAmount: 0
  });

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
        // If customer is wholesale customer, automatically switch to wholesale pricing
        if (cust.customerType === 'wholesale' || cust.isWholesale) {
          setSaleMode('wholesale');
        }
      }
    } else if (selectedCustomerId === 'walk_in') {
      setCustomerName('زبون نقدي عام');
      setCustomerPhone('');
    }
  }, [selectedCustomerId, customers]);

  // Handle Barcode Scanned Event (Instant Cart Insertion)
  const handleBarcodeSubmit = (e) => {
    e.preventDefault();
    const barcode = barcodeScanInput.trim();
    if (!barcode) return;

    // Search by pack barcode, carton barcode, or general code
    const matchedProduct = products.find(p => 
      (p.barcodePack && p.barcodePack === barcode) ||
      (p.barcodeCarton && p.barcodeCarton === barcode) ||
      (p.barcode && p.barcode === barcode) ||
      (p.id === barcode)
    );

    if (matchedProduct) {
      const isCartonBarcode = matchedProduct.barcodeCarton === barcode;
      const unitType = isCartonBarcode ? UNIT_TYPES.CARTON : UNIT_TYPES.PACK;
      addItemToCartDirectly(matchedProduct, unitType, 1);
      setBarcodeScanInput('');
    } else {
      alert(`الباركود (${barcode}) غير مسجل في قائمة أصناف التبغ.`);
    }
  };

  // Helper to add item directly (from quick tap or barcode scan)
  /**
   * @param {any} prod
   * @param {string} [preferredUnit]
   * @param {number} [initialQty]
   */
  const addItemToCartDirectly = (prod, preferredUnit = UNIT_TYPES.PACK, initialQty = 1) => {
    const isWholesale = saleMode === 'wholesale';
    const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
    const unitsPerPack = Number(prod.unitsPerPack || prod.units_per_pack || 20);

    // Calculate pricing using core packaging rules
    const pricing = calculateLineItem({
      product: {
        ...prod,
        retail_price_pack_cents: prod.retail_price_pack_cents || Math.round((prod.retailPricePack || prod.defaultPricePerKg || 0) * 100),
        retail_price_carton_cents: prod.retail_price_carton_cents || Math.round((prod.retailPriceCarton || (prod.retailPricePack * packsPerCarton) || 0) * 100),
        wholesale_price_carton_cents: prod.wholesale_price_carton_cents || Math.round((prod.wholesalePriceCarton || (prod.retailPricePack * packsPerCarton * 0.95) || 0) * 100),
        wholesale_price_pack_cents: prod.wholesale_price_pack_cents || Math.round((prod.wholesalePriceCarton ? prod.wholesalePriceCarton / packsPerCarton : (prod.retailPricePack || 0)) * 100)
      },
      unitType: preferredUnit,
      quantity: initialQty,
      isWholesale
    });

    const unitPrice = pricing.unitPriceCents / 100;
    const costPack = Number(prod.cost_price_pack_cents ? prod.cost_price_pack_cents / 100 : (prod.costPerPack || prod.costPerKg || 0));
    const costPrice = preferredUnit === UNIT_TYPES.CARTON ? costPack * packsPerCarton : costPack;

    // Check if same item & same unit already in cart
    const existingIndex = cartItems.findIndex(it => it.productId === prod.id && it.unitType === preferredUnit);

    if (existingIndex >= 0) {
      // Increment quantity
      const existing = cartItems[existingIndex];
      const newQty = existing.quantity + initialQty;
      const updatedPricing = calculateLineItem({
        product: {
          ...prod,
          retail_price_pack_cents: prod.retail_price_pack_cents || Math.round((prod.retailPricePack || prod.defaultPricePerKg || 0) * 100),
          retail_price_carton_cents: prod.retail_price_carton_cents || Math.round((prod.retailPriceCarton || 0) * 100),
          wholesale_price_carton_cents: prod.wholesale_price_carton_cents || Math.round((prod.wholesalePriceCarton || 0) * 100)
        },
        unitType: preferredUnit,
        quantity: newQty,
        isWholesale
      });

      const updatedItem = {
        ...existing,
        quantity: newQty,
        packsCount: updatedPricing.packsCount,
        netWeight: updatedPricing.packsCount, // For backward compatibility with legacy sync engine
        total: updatedPricing.totalCents / 100
      };

      setCartItems(prev => prev.map((it, idx) => idx === existingIndex ? updatedItem : it));
    } else {
      // Add new cart row
      const newItem = {
        id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        productId: prod.id,
        name: prod.name,
        brand: prod.brand || '',
        unitType: preferredUnit,
        unitName: preferredUnit === UNIT_TYPES.CARTON ? 'كرتونة' : preferredUnit === UNIT_TYPES.PIECE ? 'حبة' : 'علبة',
        quantity: initialQty,
        packsPerCarton,
        unitsPerPack,
        packsCount: pricing.packsCount,
        netWeight: pricing.packsCount, // Backward compatibility for sync/store inventory subtraction
        unitPrice,
        pricePerKg: unitPrice, // For backward compatibility with legacy receipt/invoice schemas
        costPrice,
        costPerKg: costPrice,
        total: pricing.totalCents / 100,
        discountAmount: 0
      };

      setCartItems(prev => [newItem, ...prev]);
    }
  };

  // Quick select tobacco product from catalog button
  const handleSelectProduct = (prod) => {
    // Default add 1 Pack directly to cart for speed, open editor on double click / edit button
    addItemToCartDirectly(prod, UNIT_TYPES.PACK, 1);
  };

  // Open item editor for existing item or custom entry
  const handleEditItem = (index) => {
    const it = cartItems[index];
    setEditingItemIndex(index);
    setActiveItem({
      ...it,
      unitType: it.unitType || UNIT_TYPES.PACK,
      quantity: it.quantity || 1,
      unitPrice: it.unitPrice || it.pricePerKg || 0,
      costPrice: it.costPrice || it.costPerKg || 0
    });
    setIsItemEditorOpen(true);
  };

  // Remove item from cart
  const handleRemoveItem = (index) => {
    setCartItems(prev => prev.filter((_, idx) => idx !== index));
  };

  // Toggle unit on an existing cart line (Carton <-> Pack)
  const handleToggleCartLineUnit = (index) => {
    const item = cartItems[index];
    const nextUnit = item.unitType === UNIT_TYPES.PACK ? UNIT_TYPES.CARTON : UNIT_TYPES.PACK;
    const prod = products.find(p => p.id === item.productId);
    if (!prod) return;

    const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
    const isWholesale = saleMode === 'wholesale';
    const pricing = calculateLineItem({
      product: {
        ...prod,
        retail_price_pack_cents: prod.retail_price_pack_cents || Math.round((prod.retailPricePack || prod.defaultPricePerKg || 0) * 100),
        retail_price_carton_cents: prod.retail_price_carton_cents || Math.round((prod.retailPriceCarton || (prod.retailPricePack * packsPerCarton) || 0) * 100),
        wholesale_price_carton_cents: prod.wholesale_price_carton_cents || Math.round((prod.wholesalePriceCarton || 0) * 100)
      },
      unitType: nextUnit,
      quantity: item.quantity,
      isWholesale
    });

    const unitPrice = pricing.unitPriceCents / 100;
    const costPack = Number(prod.cost_price_pack_cents ? prod.cost_price_pack_cents / 100 : (prod.costPerPack || prod.costPerKg || 0));
    const costPrice = nextUnit === UNIT_TYPES.CARTON ? costPack * packsPerCarton : costPack;

    const updated = {
      ...item,
      unitType: nextUnit,
      unitName: nextUnit === UNIT_TYPES.CARTON ? 'كرتونة' : 'علبة',
      unitPrice,
      pricePerKg: unitPrice,
      costPrice,
      costPerKg: costPrice,
      packsCount: pricing.packsCount,
      netWeight: pricing.packsCount,
      total: pricing.totalCents / 100
    };

    setCartItems(prev => prev.map((it, idx) => idx === index ? updated : it));
  };

  // Update quantity on cart line
  const handleUpdateLineQty = (index, delta) => {
    const item = cartItems[index];
    const newQty = Math.max(1, item.quantity + delta);
    if (newQty === item.quantity) return;

    const prod = products.find(p => p.id === item.productId);
    const isWholesale = saleMode === 'wholesale';
    const pricing = calculateLineItem({
      product: prod ? {
        ...prod,
        retail_price_pack_cents: prod.retail_price_pack_cents || Math.round((prod.retailPricePack || prod.defaultPricePerKg || 0) * 100),
        retail_price_carton_cents: prod.retail_price_carton_cents || Math.round((prod.retailPriceCarton || 0) * 100),
        wholesale_price_carton_cents: prod.wholesale_price_carton_cents || Math.round((prod.wholesalePriceCarton || 0) * 100)
      } : {
        retail_price_pack_cents: Math.round(item.unitPrice * 100),
        packs_per_carton: item.packsPerCarton || 10
      },
      unitType: item.unitType,
      quantity: newQty,
      isWholesale
    });

    setCartItems(prev => prev.map((it, idx) => idx === index ? {
      ...it,
      quantity: newQty,
      packsCount: pricing.packsCount,
      netWeight: pricing.packsCount,
      total: pricing.totalCents / 100
    } : it));
  };

  // Save / apply item into cart from Modal
  const handleSaveItemModal = () => {
    if (!activeItem.name || Number(activeItem.quantity) <= 0) {
      alert('يرجى التأكد من إدخال اسم الصنف والكمية');
      return;
    }

    const qty = Number(activeItem.quantity) || 1;
    const unitPrice = Number(activeItem.unitPrice) || 0;
    const total = Math.round(qty * unitPrice * 100) / 100;
    const packsPerCarton = Number(activeItem.packsPerCarton) || 10;
    const unitsPerPack = Number(activeItem.unitsPerPack) || 20;

    let packsCount = qty;
    if (activeItem.unitType === UNIT_TYPES.CARTON) packsCount = qty * packsPerCarton;
    else if (activeItem.unitType === UNIT_TYPES.PIECE) packsCount = qty / unitsPerPack;

    const finalizedItem = {
      ...activeItem,
      id: activeItem.id || `line-${Date.now()}`,
      unitName: activeItem.unitType === UNIT_TYPES.CARTON ? 'كرتونة' : activeItem.unitType === UNIT_TYPES.PIECE ? 'حبة' : 'علبة',
      quantity: qty,
      unitPrice,
      pricePerKg: unitPrice,
      costPrice: Number(activeItem.costPrice) || 0,
      costPerKg: Number(activeItem.costPrice) || 0,
      packsCount,
      netWeight: packsCount,
      total
    };

    if (editingItemIndex !== null) {
      setCartItems(prev => prev.map((it, idx) => idx === editingItemIndex ? finalizedItem : it));
    } else {
      setCartItems(prev => [finalizedItem, ...prev]);
    }

    setIsItemEditorOpen(false);
    setEditingItemIndex(null);
  };

  // Switch between Retail and Wholesale mode (recalculate cart prices)
  const handleSaleModeToggle = (newMode) => {
    setSaleMode(newMode);
    const isWholesale = newMode === 'wholesale';
    setCartItems(prev => prev.map(item => {
      const prod = products.find(p => p.id === item.productId);
      if (!prod) return item;
      const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
      const pricing = calculateLineItem({
        product: {
          ...prod,
          retail_price_pack_cents: prod.retail_price_pack_cents || Math.round((prod.retailPricePack || prod.defaultPricePerKg || 0) * 100),
          retail_price_carton_cents: prod.retail_price_carton_cents || Math.round((prod.retailPriceCarton || (prod.retailPricePack * packsPerCarton) || 0) * 100),
          wholesale_price_carton_cents: prod.wholesale_price_carton_cents || Math.round((prod.wholesalePriceCarton || 0) * 100)
        },
        unitType: item.unitType,
        quantity: item.quantity,
        isWholesale
      });
      const unitPrice = pricing.unitPriceCents / 100;
      return {
        ...item,
        unitPrice,
        pricePerKg: unitPrice,
        total: pricing.totalCents / 100
      };
    }));
  };

  // Invoice calculations
  const totalItemsCount = cartItems.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0);
  const totalPacksSold = cartItems.reduce((sum, it) => sum + (Number(it.packsCount) || 0), 0);
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
      alert('الفاتورة فارغة، يرجى إضافة أصناف سجائر أولاً');
      return;
    }

    // Tobacco inventory stock validation
    if (!settings.allowNegativeStock) {
      for (const it of cartItems) {
        const prod = products.find(p => (it.productId && p.id === it.productId) || (p.name.trim() === (it.name || '').trim()));
        if (prod) {
          const curStockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);
          const reqPacks = Number(it.packsCount || it.quantity || 0);
          if (reqPacks > curStockPacks) {
            setOutOfStockAlert({
              productName: it.name,
              currentStock: curStockPacks,
              requestedWeight: reqPacks,
              availableLeft: curStockPacks
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

    const effectiveName = customerName.trim() || (selectedCustomerId && selectedCustomerId !== 'walk_in' ? 'عميل' : 'زبون نقدي عام');
    const hasCreditDebt = saleType === 'credit' || calculatedCreditAmount > 0 || calculatedRemainingDebt > 0;
    if (hasCreditDebt && (effectiveName === 'زبون نقدي عام' || !effectiveName)) {
      alert('تنبيه محاسبي: هذه الفاتورة تحتوي على مبلغ آجل (دين). يرجى اختيار عميل مسجل أو كتابة اسم العميل لتثبيت الدين في حسابه.');
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
        saleMode, // 'retail' | 'wholesale'
        saleType,
        paymentMethod: saleType,
        bankName: (saleType === 'bank' || (saleType === 'split' && calculatedBankAmount > 0)) ? effectiveBankName : '',
        bankAccountNumber: (saleType === 'bank' || (saleType === 'split' && calculatedBankAmount > 0)) ? bankAccountNumber : '',
        cashAmount: calculatedCashAmount,
        bankAmount: calculatedBankAmount,
        creditAmount: calculatedCreditAmount,
        items: cartItems,
        totalItemsCount,
        totalPacksSold,
        totalNetWeight: totalPacksSold, // Backward compatibility for reports
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
           (p.brand && p.brand.toLowerCase().includes(q)) ||
           (p.category && p.category.toLowerCase().includes(q)) ||
           (p.barcodePack && p.barcodePack.includes(q)) ||
           (p.barcodeCarton && p.barcodeCarton.includes(q));
  });

  return (
    <div className="sale-screen w-full pb-48 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8">
      {/* 2-Column Responsive Layout */}
      <div className="flex flex-col lg:flex-row items-start gap-6 w-full">
        
        {/* =========================================================================
            RIGHT COLUMN (Main Operations Area - 62% to 65% width on desktop)
            Tobacco Catalog + Active Cart Table
           ========================================================================= */}
        <div className="w-full lg:flex-1 space-y-4">
          
          {/* Top Operational Bar: Title, Barcode Scanner, Mode Toggle */}
          <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center shadow-2xs font-bold">
                  <Package size={18} />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-navy-850 leading-tight">
                    نقطة بيع التبغ والسجائر (POS)
                  </h2>
                  <p className="text-[11px] text-slate-500 font-medium">
                    البيع بالعلبة أو الكرتونة، مسح الباركود، وتطبيق تسعير الجملة والقطاعي
                  </p>
                </div>
              </div>

              {/* Mode Toggle: Retail vs Wholesale */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleSaleModeToggle('retail')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    saleMode === 'retail' 
                      ? 'bg-white text-primary-700 shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  بيع قطاعي (مفرق)
                </button>
                <button
                  type="button"
                  onClick={() => handleSaleModeToggle('wholesale')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    saleMode === 'wholesale' 
                      ? 'bg-amber-600 text-white shadow-2xs' 
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  بيع جملة كراتين
                </button>
              </div>
            </div>

            {/* Barcode Scanner Input & Live Search */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <form onSubmit={handleBarcodeSubmit} className="relative flex-1">
                <Barcode size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  ref={barcodeInputRef}
                  type="text"
                  value={barcodeScanInput}
                  onChange={(e) => setBarcodeScanInput(e.target.value)}
                  placeholder="امسح باركود العلبة أو الكرتونة هنا واضغط Enter..."
                  className="w-full pr-9 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white transition-all shadow-2xs"
                />
              </form>

              <div className="relative w-full sm:w-48">
                <Search size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="بحث بالاسم أو الماركة..."
                  className="w-full pr-8 pl-6 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:bg-white transition-all shadow-2xs"
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
                    unitType: UNIT_TYPES.PACK,
                    unitName: 'علبة',
                    quantity: 1,
                    packsPerCarton: 10,
                    unitsPerPack: 20,
                    unitPrice: 0,
                    costPrice: 0,
                    discountAmount: 0
                  });
                  setEditingItemIndex(null);
                  setIsItemEditorOpen(true);
                }}
                className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 active:scale-98 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus size={15} />
                <span>+ صنف مخصص</span>
              </button>
            </div>

            {/* Quick Tobacco Brands & Grid */}
            {filteredProducts.length === 0 ? (
              <div className="p-6 text-center border border-slate-200 rounded-xl bg-slate-50/50">
                <p className="text-xs font-bold text-slate-700">
                  {productSearch ? 'لا توجد أصناف مطابقة للبحث' : 'لا توجد أصناف سجائر مسجلة حالياً'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1 max-w-md mx-auto">
                  أضف أصناف التبغ من قائمة "الأصناف" أو استخدم زر "+ صنف مخصص" أعلاه.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 max-h-56 overflow-y-auto p-1 scrollbar-none">
                {filteredProducts.map(prod => {
                  const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
                  const isWholesale = saleMode === 'wholesale';
                  const displayPrice = isWholesale
                    ? (prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : (prod.wholesalePriceCarton || (prod.retailPricePack * packsPerCarton * 0.95)))
                    : (prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : (prod.retailPricePack || prod.defaultPricePerKg || 0));
                  const displayUnit = isWholesale ? 'كرتونة' : 'علبة';

                  return (
                    <button
                      key={prod.id}
                      onClick={() => handleSelectProduct(prod)}
                      className="bg-white hover:border-amber-400 border border-slate-200/80 rounded-xl p-2.5 flex flex-col justify-between text-right transition-all hover:shadow-2xs active:scale-95 group cursor-pointer"
                    >
                      <div className="flex items-start justify-between w-full mb-1.5">
                        <span className="text-xl p-1 rounded-lg bg-slate-50 group-hover:bg-amber-50 transition-colors">
                          {prod.emoji || '🚬'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60">
                          {displayUnit}
                        </span>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-navy-850 block truncate group-hover:text-primary-600">
                          {prod.name}
                        </span>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-xs font-mono font-bold text-emerald-700 block">
                            {Number(displayPrice || 0).toFixed(2)} <span className="text-[10px] text-slate-400 font-normal">{settings.currency}</span>
                          </span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active Cart Items Table */}
          <div className="bg-white rounded-xl shadow-2xs border border-slate-200/80 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-slate-700" />
                <h3 className="text-xs font-black text-slate-900">
                  قائمة أصناف الفاتورة ({cartItems.length})
                </h3>
              </div>

              {cartItems.length > 0 && (
                <div className="flex items-center gap-3 text-xs font-bold text-slate-600">
                  <span>إجمالي العلب المسحوبة: <strong className="text-slate-900 font-mono">{totalPacksSold}</strong></span>
                  <span className="text-slate-300">•</span>
                  <span>الأسطر: <strong className="text-slate-900 font-mono">{cartItems.length}</strong></span>
                </div>
              )}
            </div>

            {cartItems.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Package size={36} className="mx-auto mb-2.5 opacity-25 text-slate-600" />
                <p className="text-xs font-bold text-slate-600">سلة الفاتورة فارغة حالياً</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  اختر صنفاً من البطاقات السريعة أو امسح الباركود مباشرة
                </p>
              </div>
            ) : (
              <div>
                {/* Desktop & Tablet Table View */}
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead align="center" className="w-10">#</TableHead>
                      <TableHead align="right">الصنف</TableHead>
                      <TableHead align="center">الوحدة (كرتونة/علبة)</TableHead>
                      <TableHead align="center">الكمية</TableHead>
                      <TableHead align="right">سعر الوحدة</TableHead>
                      <TableHead align="right">الإجمالي</TableHead>
                      <TableHead align="center" className="w-16">إجراء</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {cartItems.map((item, idx) => (
                      <TableRow key={item.id || idx}>
                        <TableCell align="center" className="font-mono text-slate-400 text-xs">
                          {idx + 1}
                        </TableCell>
                        <TableCell align="right">
                          <span className="font-bold text-xs text-slate-900 block">{item.name}</span>
                          {item.brand && <span className="text-[10px] text-slate-400">{item.brand}</span>}
                        </TableCell>
                        <TableCell align="center">
                          <button
                            type="button"
                            onClick={() => handleToggleCartLineUnit(idx)}
                            className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                              item.unitType === UNIT_TYPES.CARTON
                                ? 'bg-amber-50 text-amber-900 border-amber-300'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                            title="اضغط للتحويل السريع بين كرتونة وعلبة"
                          >
                            {item.unitName || (item.unitType === UNIT_TYPES.CARTON ? 'كرتونة' : 'علبة')} ⟵
                          </button>
                        </TableCell>
                        <TableCell align="center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(idx, -1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-bold font-mono text-xs w-6 text-center">{item.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateLineQty(idx, 1)}
                              className="w-5 h-5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        </TableCell>
                        <TableCell align="right" className="font-mono text-xs">
                          {Number(item.unitPrice).toFixed(2)} {settings.currency}
                        </TableCell>
                        <TableCell align="right" className="font-mono font-bold text-xs text-navy-850">
                          {Number(item.total).toFixed(2)} {settings.currency}
                        </TableCell>
                        <TableCell align="center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(idx)}
                              className="p-1 text-slate-400 hover:text-slate-600 rounded cursor-pointer"
                              title="تعديل السعر أو الصنف"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveItem(idx)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                              title="حذف السطر"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

        </div>

        {/* =========================================================================
            LEFT COLUMN (Checkout Panel - 35% to 38% width on desktop)
            Customer Details, Payment Selector, Net Totals, Submit & Print
           ========================================================================= */}
        <div className="w-full lg:w-[380px] xl:w-[420px] flex-shrink-0 space-y-4">
          
          {/* Card A: Customer and Payment Mode */}
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
            
            {/* Customer Selection */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <User size={13} className="text-slate-500" />
                  <span>العميل / المشتري</span>
                </label>
                {onOpenNewCustomerModal && (
                  <button
                    type="button"
                    onClick={onOpenNewCustomerModal}
                    className="text-[10px] font-bold text-primary-600 hover:underline flex items-center gap-0.5 cursor-pointer"
                  >
                    <UserPlus size={11} />
                    <span>+ عميل جديد</span>
                  </button>
                )}
              </div>

              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="walk_in">زبون نقدي عام (مفرق)</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name} {c.phone ? `(${c.phone})` : ''} {c.balance ? `[رصيد: ${c.balance}]` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Selector */}
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1.5">طريقة السداد</label>
              <div className="grid grid-cols-4 gap-1.5 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setSaleType('cash')}
                  className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'cash'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <Banknote size={15} />
                  <span>نقدي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleType('bank')}
                  className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'bank'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <CreditCard size={15} />
                  <span>شبكة / بنك</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleType('credit')}
                  className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'credit'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <FileText size={15} />
                  <span>آجل (دين)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSaleType('split')}
                  className={`py-2 px-1 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1 ${
                    saleType === 'split'
                      ? 'bg-primary-50 text-primary-700 border-primary-300 font-bold shadow-2xs'
                      : 'bg-white hover:bg-slate-50 text-slate-600 border-slate-200 shadow-2xs'
                  }`}
                >
                  <Layers size={15} />
                  <span>مركب</span>
                </button>
              </div>

              {/* Split Breakdown */}
              {saleType === 'split' && (
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2 mt-2">
                  <div className="grid grid-cols-3 gap-1.5 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">نقدي</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={(e) => setSplitCash(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">بنكي</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={splitBank}
                        onChange={(e) => setSplitBank(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 mb-0.5">آجل</label>
                      <input
                        type="number"
                        placeholder="0.00"
                        value={splitCredit}
                        onChange={(e) => setSplitCredit(e.target.value)}
                        className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-bold font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Card B: Totals & Checkout Actions */}
          <div className="bg-white rounded-2xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
            
            <div className="space-y-2 text-xs">
              <div className="flex justify-between text-slate-600 font-medium">
                <span>المبلغ الإجمالي (قبل الخصم):</span>
                <span className="font-bold text-navy-850 font-mono">{subtotal.toFixed(2)} {settings.currency}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-600 font-medium">قيمة الخصم ({settings.currency}):</span>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0.00"
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Number(e.target.value))}
                  className="w-24 px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-left font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              {/* Net Total Box */}
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

              {/* Cash Paid Amount */}
              {saleType === 'cash' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      المدفوع نقداً ({settings.currency})
                    </label>
                    <input
                      type="number"
                      step="1"
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
                  placeholder="ملاحظات الفاتورة..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 shadow-2xs"
                />
              </div>
            </div>

            {/* Action Buttons: Save & Print, Save, Reset */}
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
                <span>{isSubmitting ? 'جاري الحفظ والترحيل...' : 'حفظ وطباعة الفاتورة A4 / إيصال'}</span>
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
                  <span>تفريغ السلة</span>
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>

      {/* Item Custom Editor Modal */}
      <Modal
        isOpen={isItemEditorOpen}
        onClose={() => setIsItemEditorOpen(false)}
        title={editingItemIndex !== null ? 'تعديل سطر الفاتورة' : 'إضافة صنف مخصص'}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">اسم الصنف</label>
            <input
              type="text"
              value={activeItem.name}
              onChange={(e) => setActiveItem(prev => ({ ...prev, name: e.target.value }))}
              placeholder="اسم الصنف..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الوحدة</label>
              <select
                value={activeItem.unitType}
                onChange={(e) => setActiveItem(prev => ({ 
                  ...prev, 
                  unitType: e.target.value,
                  unitName: e.target.value === UNIT_TYPES.CARTON ? 'كرتونة' : e.target.value === UNIT_TYPES.PIECE ? 'حبة' : 'علبة'
                }))}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value={UNIT_TYPES.PACK}>علبة (Pack)</option>
                <option value={UNIT_TYPES.CARTON}>كرتونة (Carton)</option>
                <option value={UNIT_TYPES.PIECE}>حبة سجارة (Piece)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">الكمية</label>
              <input
                type="number"
                min="1"
                value={activeItem.quantity}
                onChange={(e) => setActiveItem(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">سعر الوحدة ({settings.currency})</label>
            <input
              type="number"
              step="0.5"
              value={activeItem.unitPrice}
              onChange={(e) => setActiveItem(prev => ({ ...prev, unitPrice: Number(e.target.value) }))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsItemEditorOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveItemModal}
            >
              تثبيت في السلة
            </Button>
          </div>
        </div>
      </Modal>

      {/* Out of Stock Alert Modal */}
      {outOfStockAlert && (
        <Modal
          isOpen={Boolean(outOfStockAlert)}
          onClose={() => setOutOfStockAlert(null)}
          title="تنبيه نفاد المخزون"
        >
          <div className="space-y-3">
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs leading-relaxed">
              الكمية المطلوبة من الصنف <strong>({outOfStockAlert.productName})</strong> هي <strong>{outOfStockAlert.requestedWeight}</strong> علبة، بينما الرصيد الفعلي المتوفر بالمخزن هو <strong>{outOfStockAlert.currentStock}</strong> علبة فقط.
            </div>
            <div className="flex justify-end">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setOutOfStockAlert(null)}
              >
                حسناً، فهمت
              </Button>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
}
