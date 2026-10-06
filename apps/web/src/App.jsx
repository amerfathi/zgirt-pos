import React, { useState } from 'react';
import {
  ShoppingCart,
  Package,
  Users,
  Wallet,
  BarChart3,
  Settings,
  Plus,
  Minus,
  Trash2,
  Search,
  CheckCircle,
  Truck
} from 'lucide-react';
import { formatCurrency, fromCents, UNIT_TYPES } from '@zgirt/core';

// Tobacco seeded catalog (Verified authentic brands & standard market packs)
const INITIAL_PRODUCTS = [
  {
    id: 'p1',
    name_ar: 'مارلبورو أحمر',
    name_en: 'Marlboro Red',
    brand: 'Philip Morris',
    packs_per_carton: 10,
    units_per_pack: 20,
    barcode_pack: '7622100901',
    barcode_carton: '7622100902',
    cost_pack_cents: 2200,
    retail_price_pack_cents: 2800,
    retail_price_carton_cents: 27500,
    wholesale_price_carton_cents: 26200,
    stock_packs: 340
  },
  {
    id: 'p2',
    name_ar: 'مارلبورو جولد (أبيض)',
    name_en: 'Marlboro Gold',
    brand: 'Philip Morris',
    packs_per_carton: 10,
    units_per_pack: 20,
    barcode_pack: '7622100911',
    barcode_carton: '7622100912',
    cost_pack_cents: 2200,
    retail_price_pack_cents: 2800,
    retail_price_carton_cents: 27500,
    wholesale_price_carton_cents: 26200,
    stock_packs: 215
  },
  {
    id: 'p3',
    name_ar: 'وينستون أزرق',
    name_en: 'Winston Blue',
    brand: 'JTI',
    packs_per_carton: 10,
    units_per_pack: 20,
    barcode_pack: '4032900101',
    barcode_carton: '4032900102',
    cost_pack_cents: 1800,
    retail_price_pack_cents: 2200,
    retail_price_carton_cents: 21500,
    wholesale_price_carton_cents: 20500,
    stock_packs: 450
  },
  {
    id: 'p4',
    name_ar: 'إل آند إم أحمر',
    name_en: 'L&M Red',
    brand: 'Philip Morris',
    packs_per_carton: 10,
    units_per_pack: 20,
    barcode_pack: '7622100801',
    barcode_carton: '7622100802',
    cost_pack_cents: 1600,
    retail_price_pack_cents: 2000,
    retail_price_carton_cents: 19600,
    wholesale_price_carton_cents: 18800,
    stock_packs: 180
  },
  {
    id: 'p5',
    name_ar: 'دافيدوف كلاسيك',
    name_en: 'Davidoff Classic',
    brand: 'Imperial Brands',
    packs_per_carton: 10,
    units_per_pack: 20,
    barcode_pack: '4005900201',
    barcode_carton: '4005900202',
    cost_pack_cents: 2400,
    retail_price_pack_cents: 3000,
    retail_price_carton_cents: 29500,
    wholesale_price_carton_cents: 28200,
    stock_packs: 95
  }
];

export function App() {
  const [activeTab, setActiveTab] = useState('pos');
  const [saleType, setSaleType] = useState('retail'); // 'retail' | 'wholesale'
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  const [notification, setNotification] = useState(null);

  // Filter products by search
  const filteredProducts = INITIAL_PRODUCTS.filter(p =>
    p.name_ar.includes(searchQuery) ||
    p.name_en.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.barcode_pack?.includes(searchQuery) ||
    p.barcode_carton?.includes(searchQuery)
  );

  // Cart operations
  const addToCart = (product, unitType = UNIT_TYPES.PACK) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id && i.unitType === unitType);
      if (existing) {
        return prev.map(i =>
          i.product.id === product.id && i.unitType === unitType
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, unitType, quantity: 1 }];
    });
  };

  const updateQuantity = (index, delta) => {
    setCart(prev => {
      const item = prev[index];
      const newQty = item.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== index);
      const updated = [...prev];
      updated[index] = { ...item, quantity: newQty };
      return updated;
    });
  };

  const removeFromCart = index => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Pricing calculations
  const getItemPriceCents = item => {
    const { product, unitType } = item;
    if (saleType === 'wholesale') {
      return unitType === UNIT_TYPES.CARTON
        ? product.wholesale_price_carton_cents
        : product.retail_price_pack_cents;
    }
    // Retail
    return unitType === UNIT_TYPES.CARTON
      ? product.retail_price_carton_cents
      : product.retail_price_pack_cents;
  };

  const totalCents = cart.reduce((sum, item) => sum + getItemPriceCents(item) * item.quantity, 0);

  const completeSale = paymentMethod => {
    if (cart.length === 0) return;
    setNotification(`تم تسجيل الفاتورة بنجاح بقيمة ${formatCurrency(totalCents)} (${paymentMethod === 'cash' ? 'نقداً' : 'شبكة/ذمم'})`);
    setCart([]);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-l border-slate-800 bg-slate-900/60 flex flex-col justify-between p-4">
        <div>
          {/* Logo / Brand Header */}
          <div className="flex items-center gap-3 px-2 py-4 border-b border-slate-800/80 mb-6">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold text-xl">
              ز
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white">زقيرت</h1>
              <p className="text-xs text-amber-400/80 font-mono">ZGIRT TOBACCO POS</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveTab('pos')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'pos'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span>نقطة البيع (POS)</span>
            </button>

            <button
              onClick={() => setActiveTab('inventory')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'inventory'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Package className="w-5 h-5" />
              <span>المخزون والتبغ</span>
            </button>

            <button
              onClick={() => setActiveTab('wholesale')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'wholesale'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Truck className="w-5 h-5" />
              <span>حسابات الجملة والوكلاء</span>
            </button>

            <button
              onClick={() => setActiveTab('treasury')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'treasury'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <Wallet className="w-5 h-5" />
              <span>الخزينة والوردية</span>
            </button>

            <button
              onClick={() => setActiveTab('reports')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'reports'
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              <BarChart3 className="w-5 h-5" />
              <span>التقارير المالية</span>
            </button>
          </nav>
        </div>

        {/* Footer / Cashier Shift Indicator */}
        <div className="border-t border-slate-800/80 pt-4 px-2">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span>الوردية النشطة: #104</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              متصل
            </span>
          </div>
          <div className="text-xs text-slate-500 font-mono">الكاشير: عامر فتحي</div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex overflow-hidden">
        {activeTab === 'pos' && (
          <>
            {/* Catalog & Search Section */}
            <div className="flex-1 flex flex-col border-l border-slate-800 overflow-hidden">
              {/* Header Controls */}
              <div className="p-4 border-b border-slate-800 flex items-center justify-between gap-4 bg-slate-900/40">
                <div className="relative flex-1">
                  <Search className="w-5 h-5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ابحث بالاسم، الماركة، أو امسح الباركود..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-4 pr-10 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-sm focus:outline-none focus:border-amber-500 transition-colors"
                  />
                </div>

                {/* Retail / Wholesale Mode Toggle */}
                <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700">
                  <button
                    onClick={() => setSaleType('retail')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      saleType === 'retail'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    تجزئة (قطاعي)
                  </button>
                  <button
                    onClick={() => setSaleType('wholesale')}
                    className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
                      saleType === 'wholesale'
                        ? 'bg-amber-500 text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    جملة (كرتون)
                  </button>
                </div>
              </div>

              {/* Products Grid */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 md:grid-cols-3 gap-3">
                {filteredProducts.map(product => (
                  <div
                    key={product.id}
                    className="bg-slate-900/80 border border-slate-800 hover:border-amber-500/50 rounded-xl p-4 flex flex-col justify-between transition-all"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-amber-400 font-medium">{product.brand}</span>
                        <span className="text-xs font-mono text-slate-400">{product.stock_packs} علبة</span>
                      </div>
                      <h3 className="font-bold text-white text-base leading-snug">{product.name_ar}</h3>
                      <p className="text-xs text-slate-500 mb-3">{product.name_en}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2">
                      <button
                        onClick={() => addToCart(product, UNIT_TYPES.PACK)}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-1.5 px-2 rounded-lg text-xs font-medium flex flex-col items-center"
                      >
                        <span className="text-amber-300 font-bold font-mono">
                          {formatCurrency(product.retail_price_pack_cents)}
                        </span>
                        <span className="text-[10px] text-slate-400">علبة</span>
                      </button>

                      <button
                        onClick={() => addToCart(product, UNIT_TYPES.CARTON)}
                        className="flex-1 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 py-1.5 px-2 rounded-lg text-xs font-medium flex flex-col items-center"
                      >
                        <span className="font-bold font-mono">
                          {formatCurrency(
                            saleType === 'wholesale'
                              ? product.wholesale_price_carton_cents
                              : product.retail_price_carton_cents
                          )}
                        </span>
                        <span className="text-[10px] text-amber-500/80">كرتونة (10)</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart & Checkout Panel */}
            <div className="w-96 flex flex-col bg-slate-900/90 overflow-hidden">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-amber-400" />
                  سلة الفاتورة الحالية
                </h2>
                <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-1 rounded-full font-mono">
                  {cart.length} أصناف
                </span>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {cart.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-slate-500 text-center">
                    <Package className="w-12 h-12 mb-3 stroke-1 text-slate-600" />
                    <p className="text-sm">السلة فارغة</p>
                    <p className="text-xs text-slate-600 mt-1">اختر الأصناف أو امسح الباركود للبدء</p>
                  </div>
                ) : (
                  cart.map((item, idx) => (
                    <div
                      key={`${item.product.id}-${item.unitType}`}
                      className="bg-slate-800/60 border border-slate-700/50 rounded-lg p-3 flex items-center justify-between gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-white text-sm truncate">{item.product.name_ar}</div>
                        <div className="text-xs text-amber-400 font-mono mt-0.5">
                          {item.unitType === UNIT_TYPES.CARTON ? 'كرتونة' : 'علبة'} × {formatCurrency(getItemPriceCents(item))}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => updateQuantity(idx, -1)}
                          className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono font-bold text-sm w-6 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(idx, 1)}
                          className="w-7 h-7 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-200"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => removeFromCart(idx)}
                          className="w-7 h-7 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center mr-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Checkout Controls */}
              <div className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm text-slate-400">الإجمالي النهائي:</span>
                  <span className="text-2xl font-black text-amber-400 font-mono">
                    {formatCurrency(totalCents)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    disabled={cart.length === 0}
                    onClick={() => completeSale('cash')}
                    className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:pointer-events-none text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>كاش (نقداً)</span>
                  </button>
                  <button
                    disabled={cart.length === 0}
                    onClick={() => completeSale('credit')}
                    className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-40 disabled:pointer-events-none text-white py-3 rounded-lg font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                  >
                    <span>آجل / ذمة</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Inventory View */}
        {activeTab === 'inventory' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">إدارة مخزون منتجات التبغ والسجائر</h2>
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-4">اسم الصنف</th>
                    <th className="p-4">الماركة</th>
                    <th className="p-4">باركود العلبة</th>
                    <th className="p-4">سعر التكلفة</th>
                    <th className="p-4">سعر التجزئة</th>
                    <th className="p-4">سعر الكرتون</th>
                    <th className="p-4">المخزون المتوفر</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {INITIAL_PRODUCTS.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/40">
                      <td className="p-4 font-bold text-white">{p.name_ar}</td>
                      <td className="p-4 text-slate-400">{p.brand}</td>
                      <td className="p-4 font-mono text-slate-400">{p.barcode_pack}</td>
                      <td className="p-4 font-mono">{formatCurrency(p.cost_pack_cents)}</td>
                      <td className="p-4 font-mono text-amber-400 font-bold">{formatCurrency(p.retail_price_pack_cents)}</td>
                      <td className="p-4 font-mono text-amber-400">{formatCurrency(p.retail_price_carton_cents)}</td>
                      <td className="p-4 font-mono font-bold text-emerald-400">{p.stock_packs} علبة</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Wholesale & Customer Accounts View */}
        {activeTab === 'wholesale' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">حسابات تجار الجملة وتوزيع الكراتين</h2>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="text-xs text-slate-400 mb-1">إجمالي ذمم تجار الجملة</div>
                <div className="text-2xl font-bold font-mono text-amber-400">{formatCurrency(1450000)}</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="text-xs text-slate-400 mb-1">الكراتين المباعة اليوم</div>
                <div className="text-2xl font-bold font-mono text-emerald-400">84 كرتونة</div>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <div className="text-xs text-slate-400 mb-1">عدد عملاء الجملة النشطين</div>
                <div className="text-2xl font-bold font-mono text-white">18 تاجر</div>
              </div>
            </div>
          </div>
        )}

        {/* Treasury View */}
        {activeTab === 'treasury' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">الخزينة ومطابقة الأدراج النقدية</h2>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-xl max-w-xl">
              <h3 className="font-bold text-lg mb-4 text-amber-400">الوردية الحالية: #104 (الكاشير: عامر)</h3>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">رصيد فتح الدرج:</span>
                  <span className="font-bold">{formatCurrency(50000)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">مبيعات نقدية (كاش):</span>
                  <span className="text-emerald-400 font-bold">+{formatCurrency(345000)}</span>
                </div>
                <div className="flex justify-between border-b border-slate-800 pb-2">
                  <span className="text-slate-400">مصروفات الدرج:</span>
                  <span className="text-red-400 font-bold">-{formatCurrency(4500)}</span>
                </div>
                <div className="flex justify-between pt-2 text-base">
                  <span className="text-white font-bold">الرصيد الدفتري المتوقع:</span>
                  <span className="text-amber-400 font-black">{formatCurrency(390500)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Reports View */}
        {activeTab === 'reports' && (
          <div className="flex-1 p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">التقارير المالية وحركة المبيعات</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
                <h3 className="font-bold mb-2">أعلى السجائر مبيعاً (بالكرتونة)</h3>
                <ul className="text-sm space-y-2">
                  <li className="flex justify-between text-slate-300">
                    <span>1. مارلبورو أحمر</span>
                    <span className="font-mono font-bold text-amber-400">42 كرتونة</span>
                  </li>
                  <li className="flex justify-between text-slate-300">
                    <span>2. وينستون أزرق</span>
                    <span className="font-mono font-bold text-amber-400">28 كرتونة</span>
                  </li>
                  <li className="flex justify-between text-slate-300">
                    <span>3. مارلبورو جولد</span>
                    <span className="font-mono font-bold text-amber-400">19 كرتونة</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Floating Notification */}
      {notification && (
        <div className="fixed bottom-6 left-6 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-xl flex items-center gap-3 border border-emerald-400/30 animate-bounce">
          <CheckCircle className="w-5 h-5" />
          <span className="text-sm font-bold">{notification}</span>
        </div>
      )}
    </div>
  );
}
