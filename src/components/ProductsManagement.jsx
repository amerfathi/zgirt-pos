import React, { useState } from 'react';
import { 
  Package, Plus, Edit2, Trash2, Check, Sparkles, 
  DollarSign, Tag, Barcode, Layers, Scissors, ShieldAlert,
  Search, ArrowDownUp, RefreshCw, Box
} from 'lucide-react';
import { formatCurrency } from '../utils/formatters';
import { Button, Input, Select, Modal, EmptyState } from './ui';
import { decomposePackStock } from '../../packages/core/src/packaging.js';

export default function ProductsManagement({ store }) {
  const { products, settings, addProduct, updateProduct, updateProductPrice, deleteProduct } = store;

  const [activeTab, setActiveTab] = useState('inventory_pricing'); // 'inventory_pricing' | 'all_products'
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Form state for tobacco product with configurable packaging
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    brand: '',
    category: 'سجائر',
    barcodePack: '',
    barcodeSleeve: '',
    barcodeCarton: '',
    packsPerSleeve: 10,
    sleevesPerCarton: 20,
    costPerPack: 16.0,
    costPerSleeve: 160.0,
    costPerCarton: 3200.0,
    retailPricePack: 18.0,
    retailPriceSleeve: 180.0,
    retailPriceCarton: 3600.0,
    wholesalePriceSleeve: 175.0,
    wholesalePriceCarton: 3450.0,
    minStock: 20,
    stockPacks: 200,
    active: true,
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
    const pPerS = Number(prod.packsPerSleeve || prod.packs_per_sleeve || 10);
    const sPerC = Number(prod.sleevesPerCarton || prod.sleeves_per_carton || 20);
    const pPerC = Number(prod.packsPerCarton || prod.packs_per_carton || (pPerS * sPerC));

    const newRetail = tempRetailPrices[prod.id] !== undefined ? Number(tempRetailPrices[prod.id]) : (Number(prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : prod.retailPricePack || prod.defaultPricePerKg) || 0);
    const newWholesale = tempWholesalePrices[prod.id] !== undefined ? Number(tempWholesalePrices[prod.id]) : (Number(prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : prod.wholesalePriceCarton) || (newRetail * pPerC * 0.95));
    
    setIsSavingProduct(true);
    try {
      await updateProduct(prod.id, {
        ...prod,
        retailPricePack: newRetail,
        retail_price_pack_cents: Math.round(newRetail * 100),
        defaultPricePerKg: newRetail,
        retailPriceSleeve: Math.round(newRetail * pPerS * 100) / 100,
        retailPriceCarton: Math.round(newRetail * pPerC * 100) / 100,
        retail_price_carton_cents: Math.round(newRetail * pPerC * 100),
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
      barcodeSleeve: '',
      barcodeCarton: '',
      packsPerSleeve: 10,
      sleevesPerCarton: 20,
      costPerPack: 16.0,
      costPerSleeve: 160.0,
      costPerCarton: 3200.0,
      retailPricePack: 18.0,
      retailPriceSleeve: 180.0,
      retailPriceCarton: 3600.0,
      wholesalePriceSleeve: 175.0,
      wholesalePriceCarton: 3450.0,
      minStock: 20,
      stockPacks: 200,
      active: true,
      emoji: '🚬'
    });
    setIsNewProductModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    const packsPerSleeve = Number(prod.packsPerSleeve || prod.packs_per_sleeve || 10);
    const sleevesPerCarton = Number(prod.sleevesPerCarton || prod.sleeves_per_carton || (prod.packsPerCarton ? Math.max(1, Math.round(prod.packsPerCarton / packsPerSleeve)) : 20));
    const packsPerCarton = Number(prod.packsPerCarton || prod.packs_per_carton || (packsPerSleeve * sleevesPerCarton));

    const retailPack = Number(prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : (prod.retailPricePack || prod.defaultPricePerKg || 0));
    const retailSleeve = Number(prod.retailPriceSleeve || (retailPack * packsPerSleeve));
    const retailCarton = Number(prod.retail_price_carton_cents ? prod.retail_price_carton_cents / 100 : (prod.retailPriceCarton || (retailPack * packsPerCarton)));

    const wholesaleSleeve = Number(prod.wholesalePriceSleeve || (retailSleeve * 0.95));
    const wholesaleCarton = Number(prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : (prod.wholesalePriceCarton || (retailCarton * 0.95)));

    const costPack = Number(prod.cost_price_pack_cents ? prod.cost_price_pack_cents / 100 : (prod.costPerPack || prod.costPerKg || 0));
    const costSleeve = Number(prod.costPerSleeve || (costPack * packsPerSleeve));
    const costCarton = Number(prod.costPerCarton || (costPack * packsPerCarton));

    const stockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);

    setFormData({
      name: prod.name || '',
      nameEn: prod.nameEn || '',
      brand: prod.brand || '',
      category: prod.category || 'سجائر',
      barcodePack: prod.barcodePack || prod.barcode || '',
      barcodeSleeve: prod.barcodeSleeve || '',
      barcodeCarton: prod.barcodeCarton || '',
      packsPerSleeve,
      sleevesPerCarton,
      costPerPack: costPack,
      costPerSleeve: costSleeve,
      costPerCarton: costCarton,
      retailPricePack: retailPack,
      retailPriceSleeve: retailSleeve,
      retailPriceCarton: retailCarton,
      wholesalePriceSleeve: wholesaleSleeve,
      wholesalePriceCarton: wholesaleCarton,
      minStock: Number(prod.minStock || 20),
      stockPacks,
      active: prod.active !== false,
      emoji: prod.emoji || '🚬'
    });
    setIsNewProductModalOpen(true);
  };

  const handleSaveProductForm = async () => {
    if (isSavingProduct) return;
    if (!formData.name) {
      alert('يرجى كتابة اسم صنف التبغ');
      return;
    }

    setIsSavingProduct(true);
    try {
      const packsPerSleeve = Math.max(1, Math.floor(Number(formData.packsPerSleeve) || 10));
      const sleevesPerCarton = Math.max(1, Math.floor(Number(formData.sleevesPerCarton) || 20));
      const packsPerCarton = packsPerSleeve * sleevesPerCarton;

      const retailPricePack = Number(formData.retailPricePack) || 0;
      const retailPriceSleeve = Number(formData.retailPriceSleeve) || (retailPricePack * packsPerSleeve);
      const retailPriceCarton = Number(formData.retailPriceCarton) || (retailPricePack * packsPerCarton);

      const wholesalePriceSleeve = Number(formData.wholesalePriceSleeve) || (retailPriceSleeve * 0.95);
      const wholesalePriceCarton = Number(formData.wholesalePriceCarton) || (retailPriceCarton * 0.95);

      const costPerPack = Number(formData.costPerPack) || 0;
      const costPerSleeve = Number(formData.costPerSleeve) || (costPerPack * packsPerSleeve);
      const costPerCarton = Number(formData.costPerCarton) || (costPerPack * packsPerCarton);

      const stockPacks = Math.max(0, Math.floor(Number(formData.stockPacks) || 0));

      const productPayload = {
        name: formData.name.trim(),
        nameEn: formData.nameEn.trim(),
        brand: formData.brand.trim(),
        category: formData.category,
        barcodePack: formData.barcodePack.trim(),
        barcodeSleeve: formData.barcodeSleeve.trim(),
        barcodeCarton: formData.barcodeCarton.trim(),
        packsPerSleeve,
        packs_per_sleeve: packsPerSleeve,
        sleevesPerCarton,
        sleeves_per_carton: sleevesPerCarton,
        packsPerCarton,
        packs_per_carton: packsPerCarton,
        costPerPack,
        cost_price_pack_cents: Math.round(costPerPack * 100),
        costPerSleeve,
        costPerCarton,
        retailPricePack,
        retail_price_pack_cents: Math.round(retailPricePack * 100),
        retailPriceSleeve,
        retailPriceCarton,
        retail_price_carton_cents: Math.round(retailPriceCarton * 100),
        wholesalePriceSleeve,
        wholesalePriceCarton,
        wholesale_price_carton_cents: Math.round(wholesalePriceCarton * 100),
        minStock: Number(formData.minStock) || 20,
        active: formData.active !== false,
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

  // Carton Breaking action (فك كرتونة إلى استيكات وعلب)
  const handleExecuteBreakCarton = async () => {
    const prod = breakCartonModal.product;
    if (!prod) return;
    const pPerS = Number(prod.packsPerSleeve || prod.packs_per_sleeve || 10);
    const sPerC = Number(prod.sleevesPerCarton || prod.sleeves_per_carton || 20);
    const packsPerCarton = pPerS * sPerC;
    
    alert(`تم فك كرتونة واحدة من (${prod.name}) تعادل (${sPerC} استيكة / ${packsPerCarton} علبة) بنجاح وتوفيرها على رفوف البيع.`);
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
      p.barcodeSleeve?.includes(searchTerm) ||
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
                تعبئة مرنة لكل صنف (كرتونة ⟵ استيكة ⟵ علبة)، تسعير الجملة والتجزئة، والباركودات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenAddModal}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              <span>إضافة صنف جديد</span>
            </button>
          </div>
        </div>

        {/* View mode tabs & Category Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            <button
              type="button"
              onClick={() => setActiveTab('inventory_pricing')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'inventory_pricing' 
                  ? 'bg-white text-navy-850 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الجدول السريع والتسعير
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('all_products')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'all_products' 
                  ? 'bg-white text-navy-850 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              بطاقات الأصناف وهيكل التعبئة
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search size={15} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="بحث باسم الصنف، الماركة، أو الباركود..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pr-8.5 pl-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        </div>
      </div>

      {/* Tab 1: Fast Table for Tobacco Pricing & Inventory */}
      {activeTab === 'inventory_pricing' && (
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200/80 overflow-hidden">
          {filteredProducts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Package}
                title="لا توجد أصناف مطابقة"
                description="لم يتم العثور على أي صنف تبغ مطابق لمعايير البحث الحالية."
                actionLabel="إضافة صنف تبغ"
                onAction={handleOpenAddModal}
              />
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-slate-50 text-[11px] font-bold text-slate-500">
                <span className="col-span-4">صنف التبغ / الماركة</span>
                <span className="col-span-3 text-center">المخزون (كرتونة / استيكة / علبة)</span>
                <span className="col-span-5 text-left">الأسعار السريعة (علبة / كرتونة)</span>
              </div>

              {filteredProducts.map(prod => {
                const pPerS = Number(prod.packsPerSleeve || prod.packs_per_sleeve || 10);
                const sPerC = Number(prod.sleevesPerCarton || prod.sleeves_per_carton || 20);
                const pPerC = Number(prod.packsPerCarton || prod.packs_per_carton || (pPerS * sPerC));

                const stockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);
                const stockDecomp = decomposePackStock(stockPacks, prod);

                const currentRetail = tempRetailPrices[prod.id] !== undefined 
                  ? tempRetailPrices[prod.id] 
                  : (prod.retailPricePack || (prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : prod.defaultPricePerKg) || '');

                const currentWholesale = tempWholesalePrices[prod.id] !== undefined 
                  ? tempWholesalePrices[prod.id] 
                  : (prod.wholesalePriceCarton || (prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : Math.round(Number(currentRetail) * pPerC * 0.95)) || '');

                const isSaved = savedSuccessKey === prod.id;

                return (
                  <div key={prod.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50/60 transition-colors text-xs">
                    
                    {/* Col 1: Product Name & Category */}
                    <div className="col-span-4 flex items-center gap-2">
                      <span className="text-xl">{prod.emoji || '🚬'}</span>
                      <div>
                        <strong className="text-slate-900 block font-bold">{prod.name}</strong>
                        <span className="text-[10px] text-slate-400">
                          {prod.brand ? `${prod.brand} • ` : ''}{pPerS} علبة/استيكة • {sPerC} استيكة/كرتونة ({pPerC} علبة)
                        </span>
                      </div>
                    </div>

                    {/* Col 2: Stock decomposition */}
                    <div className="col-span-3 text-center">
                      <span className={`font-bold font-mono px-2 py-0.5 rounded text-xs inline-block ${
                        stockPacks <= 0 
                          ? 'bg-rose-100 text-rose-800' 
                          : stockPacks <= (prod.minStock || 20) 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {stockDecomp.formatted}
                      </span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">
                        إجمالي: {stockPacks} علبة
                      </span>
                    </div>

                    {/* Col 3: Fast Price Edit & Save */}
                    <div className="col-span-5 flex items-center justify-end gap-2">
                      <div className="flex items-center gap-1.5">
                        <label className="text-[11px] text-slate-500 font-medium">علبة:</label>
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

      {/* Tab 2: Full Product Cards with Flexible Packaging Hierarchy */}
      {activeTab === 'all_products' && (
        filteredProducts.length === 0 ? (
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs">
            <EmptyState
              icon={Package}
              title="لا توجد أصناف في الدليل"
              description="أضف أصناف التبغ وحدد عدد العلب في الاستيكة والكرتونة وأسعار الجملة والقطاعي"
              actionLabel="إضافة صنف جديد"
              onAction={handleOpenAddModal}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {filteredProducts.map(prod => {
              const pPerS = Number(prod.packsPerSleeve || prod.packs_per_sleeve || 10);
              const sPerC = Number(prod.sleevesPerCarton || prod.sleeves_per_carton || 20);
              const pPerC = Number(prod.packsPerCarton || prod.packs_per_carton || (pPerS * sPerC));

              const retailPack = Number(prod.retail_price_pack_cents ? prod.retail_price_pack_cents / 100 : (prod.retailPricePack || prod.defaultPricePerKg || 0));
              const retailSleeve = Number(prod.retailPriceSleeve || (retailPack * pPerS));
              const retailCarton = Number(prod.retail_price_carton_cents ? prod.retail_price_carton_cents / 100 : (prod.retailPriceCarton || (retailPack * pPerC)));
              const wholesaleCarton = Number(prod.wholesale_price_carton_cents ? prod.wholesale_price_carton_cents / 100 : (prod.wholesalePriceCarton || (retailCarton * 0.95)));
              const costPack = Number(prod.cost_price_pack_cents ? prod.cost_price_pack_cents / 100 : (prod.costPerPack || prod.costPerKg || 0));
              
              const stockPacks = Number(prod.stockPacks ?? prod.currentStockKg ?? 0);
              const stockDecomp = decomposePackStock(stockPacks, prod);

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
                      <span className="text-slate-500 text-[10px] block font-medium">سعر الاستيكة:</span>
                      <strong className="text-slate-800 font-mono">{retailSleeve.toFixed(2)} {settings.currency}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">سعر كرتونة الجملة:</span>
                      <strong className="text-slate-800 font-mono">{wholesaleCarton.toFixed(2)} {settings.currency}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">هيكل التعبئة:</span>
                      <strong className="text-slate-800">{pPerS} علبة/استيكة • {sPerC} استيكة/كرتونة ({pPerC} علبة)</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block font-medium">المخزون الحالي:</span>
                      <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[11px] inline-block ${
                        stockPacks <= 0 
                          ? 'bg-rose-100 text-rose-800' 
                          : stockPacks <= (prod.minStock || 20) 
                          ? 'bg-amber-100 text-amber-800' 
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {stockDecomp.formatted}
                      </span>
                    </div>
                  </div>

                  {/* Barcode pills */}
                  {(prod.barcodePack || prod.barcodeSleeve || prod.barcodeCarton || prod.barcode) && (
                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500 font-mono">
                      <Barcode size={14} className="text-slate-400" />
                      <span>علبة: {prod.barcodePack || prod.barcode || '—'}</span>
                      {prod.barcodeSleeve && <span>• استيكة: {prod.barcodeSleeve}</span>}
                      {prod.barcodeCarton && <span>• كرتونة: {prod.barcodeCarton}</span>}
                    </div>
                  )}

                  {/* Actions & Carton Breaking */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setBreakCartonModal({ open: true, product: prod })}
                      disabled={stockDecomp.cartons < 1}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors ${
                        stockDecomp.cartons >= 1 
                          ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 cursor-pointer' 
                          : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      }`}
                      title="فك كرتونة إلى استيكات وعلب"
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
                placeholder="مثال: مارلبورو أحمر"
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

          {/* Flexible Packaging Hierarchy */}
          <div className="bg-amber-50/60 p-3 rounded-xl border border-amber-200/70 space-y-2">
            <h4 className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
              <Box size={14} className="text-amber-700" />
              <span>هيكل التعبئة والتجزئة المخصص للصنف</span>
            </h4>
            
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">عدد العلب في الاستيكة *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.packsPerSleeve}
                  onChange={(e) => {
                    const val = Math.max(1, Math.floor(Number(e.target.value) || 1));
                    setFormData(prev => ({ ...prev, packsPerSleeve: val }));
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">عدد الاستيكات في الكرتونة *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={formData.sleevesPerCarton}
                  onChange={(e) => {
                    const val = Math.max(1, Math.floor(Number(e.target.value) || 1));
                    setFormData(prev => ({ ...prev, sleevesPerCarton: val }));
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-amber-950 mb-1">إجمالي العلب بالكرتونة</label>
                <div className="px-3 py-2 bg-amber-100/70 border border-amber-300 rounded-xl text-xs font-black text-amber-950 font-mono text-center">
                  {(Number(formData.packsPerSleeve) || 10) * (Number(formData.sleevesPerCarton) || 20)} علبة
                </div>
              </div>
            </div>
          </div>

          {/* Multi-Level Barcodes */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">باركود العلبة</label>
              <input
                type="text"
                placeholder="باركود العلبة..."
                value={formData.barcodePack}
                onChange={(e) => setFormData(prev => ({ ...prev, barcodePack: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">باركود الاستيكة</label>
              <input
                type="text"
                placeholder="باركود الاستيكة..."
                value={formData.barcodeSleeve}
                onChange={(e) => setFormData(prev => ({ ...prev, barcodeSleeve: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">باركود الكرتونة</label>
              <input
                type="text"
                placeholder="باركود الكرتونة..."
                value={formData.barcodeCarton}
                onChange={(e) => setFormData(prev => ({ ...prev, barcodeCarton: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Retail Pricing */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر العلبة (قطاعي)</label>
              <input
                type="number"
                step="0.5"
                value={formData.retailPricePack}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const pPerS = Number(formData.packsPerSleeve) || 10;
                  const sPerC = Number(formData.sleevesPerCarton) || 20;
                  setFormData(prev => ({ 
                    ...prev, 
                    retailPricePack: val,
                    retailPriceSleeve: Math.round(val * pPerS * 100) / 100,
                    retailPriceCarton: Math.round(val * pPerS * sPerC * 100) / 100
                  }));
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الاستيكة (قطاعي)</label>
              <input
                type="number"
                step="0.5"
                value={formData.retailPriceSleeve}
                onChange={(e) => setFormData(prev => ({ ...prev, retailPriceSleeve: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الكرتونة (قطاعي)</label>
              <input
                type="number"
                step="1"
                value={formData.retailPriceCarton}
                onChange={(e) => setFormData(prev => ({ ...prev, retailPriceCarton: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Wholesale Pricing */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الاستيكة (جملة)</label>
              <input
                type="number"
                step="0.5"
                value={formData.wholesalePriceSleeve}
                onChange={(e) => setFormData(prev => ({ ...prev, wholesalePriceSleeve: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">سعر الكرتونة (جملة)</label>
              <input
                type="number"
                step="1"
                value={formData.wholesalePriceCarton}
                onChange={(e) => setFormData(prev => ({ ...prev, wholesalePriceCarton: Number(e.target.value) }))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          {/* Purchasing Costs & Stock */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">تكلفة العلبة (شراء)</label>
              <input
                type="number"
                step="0.5"
                value={formData.costPerPack}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  const pPerS = Number(formData.packsPerSleeve) || 10;
                  const sPerC = Number(formData.sleevesPerCarton) || 20;
                  setFormData(prev => ({
                    ...prev,
                    costPerPack: val,
                    costPerSleeve: Math.round(val * pPerS * 100) / 100,
                    costPerCarton: Math.round(val * pPerS * sPerC * 100) / 100
                  }));
                }}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">المخزون (إجمالي العلب)</label>
              <input
                type="number"
                step="1"
                min="0"
                value={formData.stockPacks}
                onChange={(e) => setFormData(prev => ({ ...prev, stockPacks: Math.max(0, Math.floor(Number(e.target.value) || 0)) }))}
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">الحد الأدنى للتنبيه</label>
              <input
                type="number"
                step="1"
                min="1"
                value={formData.minStock}
                onChange={(e) => setFormData(prev => ({ ...prev, minStock: Number(e.target.value) }))}
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
        title="تأكيد فك كرتونة إلى استيكات وعلب"
      >
        <div className="space-y-3">
          <p className="text-xs text-slate-700 leading-relaxed">
            سيتم فتح كرتونة مغلقة من الصنف <strong>({breakCartonModal.product?.name})</strong> وتفريغ محتواها البالغ <strong>{breakCartonModal.product?.packsPerCarton || ((breakCartonModal.product?.packsPerSleeve || 10) * (breakCartonModal.product?.sleevesPerCarton || 20))} علبة</strong> لبيعها كاستيكات وعلب مفردة على الرف.
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
