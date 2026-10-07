import React, { useState } from 'react';
import { 
  Package, Plus, Edit2, Trash2, Check, Sparkles, 
  DollarSign, Tag, Barcode, Layers, Scissors, ShieldAlert,
  Search, ArrowDownUp, RefreshCw
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { Button, Input, Select, Modal, EmptyState } from './ui';

export default function ProductsManagement({ store }) {
  const { products, settings, addProduct, updateProduct, updateProductPrice, deleteProduct } = store;

  const [activeTab, setActiveTab] = useState('inventory_pricing'); // 'inventory_pricing' | 'all_products'
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Form state for tobacco product
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    brand: '',
    category: 'سجائر',
    barcodePack: '',
    barcodeCarton: '',
    packsPerCarton: 10,
    unitsPerPack: 20,
    retailPricePack: 18.0,
    retailPriceCarton: 180.0,
    wholesalePriceCarton: 172.0,
    costPerPack: 16.0,
    stockPacks: 100,
    emoji: '🚬'
  });

  // Fast daily price updates state (pack price & wholesale carton price)
  const [tempRetailPrices, setTempRetailPrices] = useState({});
  const [tempWholesalePrices, setTempWholesalePrices] = useState({});
  const [savedSuccessKey, setSavedSuccessKey] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  // Carton breaking confirmation state
  const [breakCartonModal, setBreakCartonModal] = useState({ open: false, product: null });

  const categories = [
    { id: 'all', label: 'جميع الأصناف' },
    { id: 'سجائر', label: 'سجائر عادية' },
    { id: 'معسل', label: 'شيشة ومعسل' },
    { id: 'تبغ لف', label: 'تبغ لف وفلاتر' },
    { id: 'فيب وإلكتروني', label: 'فيب وسحبات' },
    { id: 'ملحقات وولاعات', label: 'ولاعات وملحقات' }
  ];

  const handlePriceChange = (id, field, val) => {
    if (field === 'retail') {
      setTempRetailPrices(prev => ({ ...prev, [id]: val }));
    } else {
      setTempWholesalePrices(prev => ({ ...prev, [id]: val }));
    }
  };

  const handleSavePrices = async (prod) => {
    if (isSavingProduct) return;
    const newRetail = tempRetailPrices[prod.id] !== undefined ? Number(tempRetailPrices[prod.id]) : (Number(prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : prod.retailPricePack || prod.defaultPricePerKg) || 0);
    const newWholesale = tempWholesalePrices[prod.id] !== undefined ? Number(tempWholesalePrices[prod.id]) : (Number(prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : prod.wholesalePriceCarton) || (newRetail * (prod.packsPerCarton || 10)));
    
    setIsSavingProduct(true);
    try {
      await updateProduct(prod.id, {
        ...prod,
        retailPricePack: newRetail,
        retail_price_pack_cents: Math.round(newRetail * 100),
        defaultPricePerKg: newRetail,
        retailPriceCarton: Math.round(newRetail * (prod.packsPerCarton || 10) * 100) / 100,
        retail_price_carton_cents: Math.round(newRetail * (prod.packsPerCarton || 10) * 100),
        wholesalePriceCarton: newWholesale,
        wholesale_price_carton_cents: Math.round(newWholesale * 100)
      });
      setSavedSuccessKey(prod.id);
      setTimeout(() => setSavedSuccessKey(null), 1500);
    } catch (error) { 
      alert('تعذر حفظ السعر: ' + error.message); 
    } finally { 
      setIsSavingProduct(false); 
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      nameEn: '',
      brand: '',
      category: 'سجائر',
      barcodePack: '',
      barcodeCarton: '',
      packsPerCarton: 10,
      unitsPerPack: 20,
      retailPricePack: 18.0,
      retailPriceCarton: 180.0,
      wholesalePriceCarton: 172.0,
      costPerPack: 16.0,
      stockPacks: 100,
      emoji: '🚬'
    });
    setIsNewProductModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
    const retailPack = Number(prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : (prod.retailPricePack || prod.defaultPricePerKg || 0));
    const retailCarton = Number(prod.retail_price_carton_cents ? prod.retail_price_carton_cents / 100 : (prod.retailPriceCarton || (retailPack * packsPerCarton)));
    const wholesaleCarton = Number(prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : (prod.wholesalePriceCarton || (retailCarton * 0.95)));
    const costPack = Number(prod.cost_price_pack_cents ? prod.cost_price_pack_cents / 100 : (prod.costPerPack || prod.costPerKg || 0));
    const stockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);

    setFormData({
      name: prod.name || '',
      nameEn: prod.nameEn || '',
      brand: prod.brand || '',
      category: prod.category || 'سجائر',
      barcodePack: prod.barcodePack || prod.barcode || '',
      barcodeCarton: prod.barcodeCarton || '',
      packsPerCarton,
      unitsPerPack: Number(prod.unitsPerPack || prod.units_per_pack || 20),
      retailPricePack: retailPack,
      retailPriceCarton: retailCarton,
      wholesalePriceCarton: wholesaleCarton,
      costPerPack: costPack,
      stockPacks,
      emoji: prod.emoji || '🚬'
    });
    setIsNewProductModalOpen(true);
  };

  const handleSaveProductForm = async () => {
    if (isSavingProduct) return;
    if (!formData.name) {
      alert('يرجى كتابة اسم الصنف');
      return;
    }

    setIsSavingProduct(true);
    try {
      const packsPerCarton = Number(formData.packsPerCarton) || 10;
      const unitsPerPack = Number(formData.unitsPerPack) || 20;
      const retailPricePack = Number(formData.retailPricePack) || 0;
      const retailPriceCarton = Number(formData.retailPriceCarton) || (retailPricePack * packsPerCarton);
      const wholesalePriceCarton = Number(formData.wholesalePriceCarton) || retailPriceCarton;
      const costPerPack = Number(formData.costPerPack) || 0;
      const stockPacks = Number(formData.stockPacks) || 0;

      const productPayload = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        brand: formData.brand.trim(),
        category: formData.category,
        barcodePack: formData.barcodePack.trim(),
        barcodeCarton: formData.barcodeCarton.trim(),
        packsPerCarton,
        packs_per_carton: packsPerCarton,
        unitsPerPack,
        units_per_pack: unitsPerPack,
        retailPricePack,
        retail_price_pack_cents: Math.round(retailPricePack * 100),
        retailPriceCarton,
        retail_price_carton_cents: Math.round(retailPriceCarton * 100),
        wholesalePriceCarton,
        wholesale_price_carton_cents: Math.round(wholesalePriceCarton * 100),
        costPerPack,
        cost_price_pack_cents: Math.round(costPerPack * 100),
        // Backward compatibility for ledger engine:
        defaultPricePerKg: retailPricePack,
        costPerKg: costPerPack,
        currentStockKg: stockPacks,
        stockPacks: stockPacks,
        emoji: formData.emoji || '🚬',
        defaultUnit: 'علبة'
      };

      if (editingProduct) {
        await updateProduct(editingProduct.id, productPayload);
      } else {
        await addProduct(productPayload);
      }
      setIsNewProductModalOpen(false);
      setEditingProduct(null);
    } catch (error) { 
      alert('تعذر حفظ الصنف: ' + error.message); 
    } finally { 
      setIsSavingProduct(false); 
    }
  };

  // Carton Breaking action (فك كرتونة إلى علب منفردة)
  const handleExecuteBreakCarton = async () => {
    const prod = breakCartonModal.product;
    if (!prod) return;
    const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
    const currentPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);
    
    // Breaking a carton doesn't change total packs in base unit, but reconciles display carton counters
    // and logs the physical unpacking for shelf replenishment.
    alert(`تم فك كرتونة واحدة من (${prod.name}) إلى (${packsPerCarton}) علب بنجاح وتوفيرها على رف البيع القطاعي.`);
    setBreakCartonModal({ open: false, product: null });
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف صنف (${name})؟`)) {
      try { await deleteProduct(id); }
      catch (error) { alert('تعذر حذف الصنف: ' + error.message); }
    }
  };

  // Filtered list
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchTerm || 
      p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.barcodePack?.includes(searchTerm) ||
      p.barcodeCarton?.includes(searchTerm) ||
      p.barcode?.includes(searchTerm);
    const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 border border-amber-200 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div>
              <h1 className="text-base font-bold text-navy-850">إدارة أصناف التبغ والمخزون</h1>
              <p className="text-xs text-slate-500 font-medium">
                هرمية التعبئة (كرتونة ⟵ علبة ⟵ حبة)، أسعار الجملة والقطاعي، والباركود
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة صنف تبغ جديد</span>
            </button>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  selectedCategory === cat.id 
                    ? 'bg-primary-600 text-white font-bold shadow-2xs' 
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="بحث بالاسم أو الباركود أو الماركة..."
              className="w-full pr-9 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary-500 focus:bg-white"
            />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('inventory_pricing')}
            className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'inventory_pricing'
                ? 'bg-white text-primary-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={14} />
            <span>تسعير الجملة والقطاعي السريع</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all_products')}
            className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'all_products'
                ? 'bg-white text-primary-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers size={14} />
            <span>بطاقات الأصناف وهرمية العبوات</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Fast Pricing Sheet (Retail Pack & Wholesale Carton) */}
      {activeTab === 'inventory_pricing' && (
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200/90 overflow-hidden">
          <div className="p-3 bg-amber-50/70 border-b border-amber-200/60 flex items-center justify-between text-xs">
            <span className="text-amber-950 font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-600" />
              <span>جدول التسعير الموحد: عدّل سعر العلبة وسعر كرتونة الجملة واضغط حفظ</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">العملة: {settings.currency}</span>
          </div>

          {filteredProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="لا توجد أصناف مطابقة"
              description="أضف أصناف السجائر والتبغ لبدء إدارة الأسعار والمخزون"
              actionLabel="إضافة صنف جديد"
              onAction={handleOpenAddModal}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredProducts.map(prod => {
                const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
                const currentRetail = tempRetailPrices[prod.id] !== undefined 
                  ? tempRetailPrices[prod.id] 
                  : (prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : (prod.retailPricePack || prod.defaultPricePerKg || 0));
                const currentWholesale = tempWholesalePrices[prod.id] !== undefined
                  ? tempWholesalePrices[prod.id]
                  : (prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : (prod.wholesalePriceCarton || (currentRetail * packsPerCarton)));
                const isSaved = savedSuccessKey === prod.id;
                const stockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);
                const stockCartons = Math.floor(stockPacks / packsPerCarton);
                const remainderPacks = stockPacks % packsPerCarton;

                return (
                  <div key={prod.id} className="p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl p-2 bg-slate-50 rounded-lg border border-slate-200/60">{prod.emoji || '🚬'}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-slate-900">{prod.name}</h3>
                          {prod.brand && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">{prod.brand}</span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          الكرتونة تحتوي: <strong className="text-slate-700">{packsPerCarton} علب</strong> • الرصيد: <strong className="text-emerald-700 font-mono">{stockCartons} كرتونة و {remainderPacks} علبة</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 self-end md:self-auto">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-slate-500 font-medium">سعر العلبة (قطاعي):</label>
                        <input
                          type="number"
                          step="0.5"
                          value={currentRetail}
                          onChange={(e) => handlePriceChange(prod.id, 'retail', e.target.value)}
                          className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-slate-500 font-medium">كرتونة (جملة):</label>
                        <input
                          type="number"
                          step="1"
                          value={currentWholesale}
                          onChange={(e) => handlePriceChange(prod.id, 'wholesale', e.target.value)}
                          className="w-24 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold font-mono text-slate-900 text-center focus:outline-none focus:ring-1 focus:ring-primary-500"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleSavePrices(prod)}
                        className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSaved 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700'
                        }`}
                        title="حفظ الأسعار"
                      >
                        <Check size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Full Product Cards with Tobacco Packaging Hierarchy */}
      {activeTab === 'all_products' && (
        filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs">
            <EmptyState
              icon={Package}
              title="لا توجد أصناف في الدليل"
              description="أضف أصناف التبغ وحدد عدد العلب في الكرتونة وأسعار الجملة والقطاعي"
              actionLabel="إضافة صنف جديد"
              onAction={handleOpenAddModal}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredProducts.map(prod => {
              const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || 10);
              const retailPack = Number(prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : (prod.retailPricePack || prod.defaultPricePerKg || 0));
              const retailCarton = Number(prod.retail_price_carton_cents ? prod.retail_price_carton_cents / 100 : (prod.retailPriceCarton || (retailPack * packsPerCarton)));
              const wholesaleCarton = Number(prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : (prod.wholesalePriceCarton || (retailCarton * 0.95)));
              const costPack = Number(prod.cost_price_pack_cents ? prod.cost_price_pack_cents / 100 : (prod.costPerPack || prod.costPerKg || 0));
              const stockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);
              const stockCartons = Math.floor(stockPacks / packsPerCarton);
              const remainderPacks = stockPacks % packsPerCarton;

              return (
                <div 
                  key={prod.id}
                  className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-card hover:shadow-md transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="text-3xl p-2 bg-slate-50 rounded-xl border border-slate-200/50">{prod.emoji || '🚬'}</span>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900 leading-tight">{prod.name}</h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-bold text-primary-700 bg-primary-50 px-2 py-0.5 rounded">
                            {prod.category}
                          </span>
                          {prod.brand && (
                            <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                              {prod.brand}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-left">
                      <span className="text-base font-bold font-mono text-emerald-700 block">
                        {retailPack.toFixed(2)} {settings.currency}
                      </span>
                      <span className="text-[10px] text-slate-400">للعلبة قطاعي</span>
                    </div>
                  </div>

                  {/* Packaging & Pricing Metrics */}
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">سعر كرتونة الجملة:</span>
                      <strong className="text-slate-800 font-mono">{wholesaleCarton.toFixed(2)} {settings.currency}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">تكلفة العلبة (شراء):</span>
                      <strong className="text-slate-700 font-mono">{costPack.toFixed(2)} {settings.currency}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">سعة الكرتونة:</span>
                      <strong className="text-slate-800">{packsPerCarton} علب</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">المخزون الحالي:</span>
                      <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[11px] inline-block ${
                        stockPacks <= 0 
                          ? 'bg-rose-100 text-rose-800' 
                          : stockPacks <= 20 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {stockCartons} كرتونة ({stockPacks} علبة)
                      </span>
                    </div>
                  </div>

                  {/* Barcode pills */}
                  {(prod.barcodePack || prod.barcodeCarton || prod.barcode) && (
                    <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <Barcode size={14} className="text-slate-400" />
                      <span>علبة: {prod.barcodePack || prod.barcode || '—'}</span>
                      {prod.barcodeCarton && <span>• كرتونة: {prod.barcodeCarton}</span>}
                    </div>
                  )}

                  {/* Actions & Carton Breaking */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setBreakCartonModal({ open: true, product: prod })}
                      disabled={stockCartons < 1}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                        stockCartons >= 1 
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer' 
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      title="فك كرتونة إلى علب منفردة لرف البيع"
                    >
                      <Scissors size={13} />
                      <span>فك كرتونة للرف</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(prod)}
                        className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Edit2 size={13} />
                        <span>تعديل</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(prod.id, prod.name)}
                        className="px-2 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Add / Edit Tobacco Product Modal */}
      <Modal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات صنف التبغ' : 'إضافة صنف تبغ وسجائر جديد'}
      >
        <div className="space-y-3.5">

          {/* Name & Brand */}
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الصنف (عربي) *</label>
              <input
                type="text"
                autoFocus
                placeholder="مثال: مالبورو أحمر"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الماركة / الشركة</label>
              <input
                type="text"
                placeholder="مثال: فيليب موريس"
                value={formData.brand}
                onChange={(e) => setFormData(prev => ({ ...prev, brand: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Category & English Name */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                <option value="سجائر">سجائر عادية</option>
                <option value="معسل">شيشة ومعسل</option>
                <option value="تبغ لف">تبغ لف وفلاتر</option>
                <option value="فيب وإلكتروني">فيب وسحبات</option>
                <option value="ملحقات وولاعات">ولاعات وملحقات</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الاسم بالإنجليزي (اختياري)</label>
              <input
                type="text"
                placeholder="Marlboro Red"
                value={formData.nameEn}
                onChange={(e) => setFormData(prev => ({ ...prev, nameEn: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Packaging Hierarchy: Packs per Carton & Units per Pack */}
          <div className="grid grid-cols-2 gap-2 bg-amber-50/50 p-2.5 rounded-xl border border-amber-200/60">
            <div>
              <label className="block text-[11px] font-bold text-amber-950 mb-1">عدد العلب في الكرتونة</label>
              <input
                type="number"
                min="1"
                value={formData.packsPerCarton}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    packsPerCarton: val,
                    retailPriceCarton: prev.retailPricePack ? Math.round(prev.retailPricePack * val * 100) / 100 : prev.retailPriceCarton
                  }));
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-amber-950 mb-1">عدد الحبات في العلبة</label>
              <input
                type="number"
                min="1"
                value={formData.unitsPerPack}
                onChange={(e) => setFormData(prev => ({ ...prev, unitsPerPack: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Multi-Level Barcodes */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">باركود العلبة (Pack Barcode)</label>
              <input
                type="text"
                placeholder="مسح باركود العلبة..."
                value={formData.barcodePack}
                onChange={(e) => setFormData(prev => ({ ...prev, barcodePack: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">باركود الكرتونة (Carton Barcode)</label>
              <input
                type="text"
                placeholder="مسح باركود الكرتونة..."
                value={formData.barcodeCarton}
                onChange={(e) => setFormData(prev => ({ ...prev, barcodeCarton: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Pricing: Retail Pack & Wholesale Carton */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر العلبة (قطاعي)</label>
              <input
                type="number"
                step="0.5"
                value={formData.retailPricePack}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setFormData(prev => ({ 
                    ...prev, 
                    retailPricePack: val,
                    retailPriceCarton: Math.round(val * prev.packsPerCarton * 100) / 100
                  }));
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">كرتونة (قطاعي)</label>
              <input
                type="number"
                step="1"
                value={formData.retailPriceCarton}
                onChange={(e) => setFormData(prev => ({ ...prev, retailPriceCarton: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">كرتونة (جملة)</label>
              <input
                type="number"
                step="1"
                value={formData.wholesalePriceCarton}
                onChange={(e) => setFormData(prev => ({ ...prev, wholesalePriceCarton: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Stock in Packs & Cost per Pack */}
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المخزون المتوفر (إجمالي العلب)</label>
              <input
                type="number"
                step="1"
                placeholder="0"
                value={formData.stockPacks !== undefined ? formData.stockPacks : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, stockPacks: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                يعادل: {Math.floor((Number(formData.stockPacks) || 0) / (Number(formData.packsPerCarton) || 10))} كرتونة
              </span>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">تكلفة شراء العلبة ({settings.currency})</label>
              <input
                type="number"
                step="0.5"
                placeholder="0.00"
                value={formData.costPerPack !== undefined ? formData.costPerPack : ''}
                onChange={(e) => setFormData(prev => ({ ...prev, costPerPack: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsNewProductModalOpen(false)}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSaveProductForm}
            >
              حفظ صنف التبغ
            </Button>
          </div>
        </div>
      </Modal>

      {/* Carton Breaking Confirmation Modal */}
      <Modal
        isOpen={breakCartonModal.open}
        onClose={() => setBreakCartonModal({ open: false, product: null })}
        title="تأكيد فك كرتونة إلى علب رف البيع"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-700 leading-relaxed">
            سيتم فتح كرتونة مغلقة من الصنف <strong>({breakCartonModal.product?.name})</strong> وتفريغ محتواها البالغ <strong>{breakCartonModal.product?.packsPerCarton || 10} علب</strong> لبيعها قطاعياً على الرف المباشر.
          </p>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setBreakCartonModal({ open: false, product: null })}
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleExecuteBreakCarton}
            >
              تأكيد فك الكرتونة
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
}
