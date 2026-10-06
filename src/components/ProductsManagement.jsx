import React, { useState } from 'react';
import { Package, Plus, Edit2, Trash2, Check, Sparkles, Scale, DollarSign, Tag, Smile } from 'lucide-react';
import { formatCurrency, formatWeight } from '../utils/formatters';
import EmojiPickerModal from './EmojiPickerModal';
import { Button, Input, Select, Modal, EmptyState } from './ui';

export default function ProductsManagement({ store }) {
  const { products, settings, addProduct, updateProduct, updateProductPrice, deleteProduct } = store;

  const [activeTab, setActiveTab] = useState('daily_prices'); // 'daily_prices' | 'all_products'
  const [isNewProductModalOpen, setIsNewProductModalOpen] = useState(false);
  const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Form for new or edited product
  const [formData, setFormData] = useState({
    name: '',
    category: 'خضروات',
    emoji: '🥬',
    defaultUnit: 'صندوق',
    defaultTareWeight: 2.0,
    defaultPricePerKg: 3.0,
    currentStockKg: 0,
    costPerKg: 0
  });

  // Fast daily price updates state
  const [tempPrices, setTempPrices] = useState({});
  const [savedSuccessKey, setSavedSuccessKey] = useState(null);
  const [isSavingProduct, setIsSavingProduct] = useState(false);

  const handlePriceChange = (id, val) => {
    setTempPrices(prev => ({ ...prev, [id]: val }));
  };

  const handleSaveSinglePrice = async (id) => {
    if (isSavingProduct) return;
    const newPrice = tempPrices[id];
    if (newPrice !== undefined && newPrice !== '') {
      setIsSavingProduct(true);
      try {
        await updateProductPrice(id, newPrice);
        setSavedSuccessKey(id);
        setTimeout(() => setSavedSuccessKey(null), 1500);
      } catch (error) { alert('تعذر حفظ سعر الصنف: ' + error.message); }
      finally { setIsSavingProduct(false); }
    }
  };

  const handleOpenAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'خضروات',
      emoji: '🥬',
      defaultUnit: 'صندوق',
      defaultTareWeight: 2.0,
      defaultPricePerKg: 3.0,
      currentStockKg: 0,
      costPerKg: 0
    });
    setIsNewProductModalOpen(true);
  };

  const handleOpenEditModal = (prod) => {
    setEditingProduct(prod);
    setFormData({
      name: prod.name,
      category: prod.category || 'خضروات',
      emoji: prod.emoji || '🥬',
      defaultUnit: prod.defaultUnit || 'صندوق',
      defaultTareWeight: prod.defaultTareWeight || 2.0,
      defaultPricePerKg: prod.defaultPricePerKg || 0,
      currentStockKg: prod.currentStockKg !== undefined ? prod.currentStockKg : 0,
      costPerKg: prod.costPerKg || 0
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
      if (editingProduct) await updateProduct(editingProduct.id, formData);
      else await addProduct(formData);
      setIsNewProductModalOpen(false);
      setEditingProduct(null);
    } catch (error) { alert('تعذر حفظ الصنف: ' + error.message); }
    finally { setIsSavingProduct(false); }
  };

  const handleDelete = async (id, name) => {
    if (window.confirm(`هل أنت متأكد من حذف صنف (${name})؟`)) {
      try { await deleteProduct(id); }
      catch (error) { alert('تعذر حذف الصنف: ' + error.message); }
    }
  };

  return (
    <div className="w-full pb-28 lg:pb-12 pt-3 px-3 sm:px-6 lg:px-8 space-y-4">
      
      {/* Top Header Card */}
      <div className="bg-white rounded-xl p-4 shadow-2xs border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 border border-primary-100 flex items-center justify-center font-bold">
              <Package size={18} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-navy-850">الأصناف وأسعار السوق</h1>
              <p className="text-[11px] text-slate-500 font-medium">إدارة الخضروات، وحدات التعبئة، وتعديل أسعار الكيلو</p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
          >
            <Plus size={15} />
            <span>صنف جديد</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('daily_prices')}
            className={`py-2 rounded-md transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'daily_prices'
                ? 'bg-white text-primary-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <DollarSign size={14} />
            <span>تحديث أسعار اليوم السريع</span>
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
            <Scale size={14} />
            <span>إعدادات العبوات والأصناف</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Daily Price Quick Sheet */}
      {activeTab === 'daily_prices' && (
        <div className="bg-white rounded-xl shadow-2xs border border-slate-200/90 overflow-hidden">
          <div className="p-3 bg-emerald-50/70 border-b border-emerald-100 flex items-center justify-between text-xs">
            <span className="text-emerald-900 font-bold flex items-center gap-1.5">
              <Sparkles size={14} className="text-emerald-600" />
              <span>بورصة الصباح: عدّل سعر كيلو أي صنف واضغط حفظ</span>
            </span>
            <span className="text-[11px] text-slate-500 font-medium">العملة: {settings.currency}</span>
          </div>

          {products.length === 0 ? (
            <EmptyState
              icon={Package}
              title="لا توجد أصناف مسجلة حالياً"
              description="سجل أول صنف لبدء تحديث الأسعار اليومية السريعة والوزن التلقائي"
              actionLabel="إضافة صنف جديد"
              onAction={handleOpenAddModal}
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {products.map(prod => {
                const currentVal = tempPrices[prod.id] !== undefined ? tempPrices[prod.id] : prod.defaultPricePerKg;
                const isSaved = savedSuccessKey === prod.id;

                return (
                  <div key={prod.id} className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="text-2xl">{prod.emoji || '🥬'}</span>
                      <div>
                        <h3 className="font-bold text-sm text-slate-900">{prod.name}</h3>
                        <p className="text-[11px] text-slate-500">
                          {prod.defaultUnit} (وزن الفارغ: {prod.defaultTareWeight} كجم)
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <input
                          type="number"
                          step="0.25"
                          value={currentVal}
                          onChange={(e) => handlePriceChange(prod.id, e.target.value)}
                          className="w-24 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-bold font-mono text-slate-900 text-center focus:outline-none focus:ring-2 focus:ring-primary-600 focus:bg-white"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleSaveSinglePrice(prod.id)}
                        className={`p-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSaved 
                            ? 'bg-emerald-600 text-white' 
                            : 'bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700'
                        }`}
                        title="حفظ السعر الجديد"
                      >
                        <Check size={15} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Full Product / Packaging Settings */}
      {activeTab === 'all_products' && (
        products.length === 0 ? (
          <div className="bg-white rounded-xl p-6 border border-slate-200/90 shadow-2xs">
            <EmptyState
              icon={Package}
              title="لا توجد أصناف في الدليل"
              description="أضف أصناف الخضار والفواكه وحدد أوزان الفوارغ وأسعار الكيلو الافتراضية"
              actionLabel="إضافة صنف جديد"
              onAction={handleOpenAddModal}
            />
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {products.map(prod => (
            <div 
              key={prod.id}
              className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-card hover:shadow-md transition-all flex flex-col justify-between space-y-3"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-3xl">{prod.emoji || '🥬'}</span>
                  <div>
                    <h3 className="font-black text-sm text-slate-900">{prod.name}</h3>
                    <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {prod.category}
                    </span>
                  </div>
                </div>

                <div className="text-left">
                  <span className="text-base font-black text-emerald-700 block">
                    {prod.defaultPricePerKg.toFixed(2)} {settings.currency}
                  </span>
                  <span className="text-[10px] text-slate-400">للكيلو</span>
                </div>
              </div>

              {/* Package, Tare, Stock & Cost details */}
              <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] block">وحدة التعبئة:</span>
                  <strong className="text-slate-800">{prod.defaultUnit}</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">وزن الفارغ:</span>
                  <strong className="text-slate-800">{prod.defaultTareWeight} كجم</strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">المخزون الحالي:</span>
                  <span className={`font-bold font-mono px-1.5 py-0.5 rounded text-[11px] inline-block ${
                    (Number(prod.currentStockKg) || 0) <= 0 
                      ? 'bg-rose-100 text-rose-800' 
                      : (Number(prod.currentStockKg) || 0) <= 10 
                      ? 'bg-amber-100 text-amber-800' 
                      : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {Number(prod.currentStockKg || 0).toFixed(1)} كجم
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] block">سعر التكلفة:</span>
                  <strong className="text-slate-700 font-mono">
                    {Number(prod.costPerKg || 0).toFixed(2)} {settings.currency}
                  </strong>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleOpenEditModal(prod)}
                  className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Edit2 size={13} />
                  <span>تعديل</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(prod.id, prod.name)}
                  className="px-2.5 py-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors"
                >
                  <Trash2 size={13} />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          ))}
        </div>
        )
      )}

      {/* Add / Edit Product Modal */}
      <Modal
        isOpen={isNewProductModalOpen}
        onClose={() => setIsNewProductModalOpen(false)}
        title={editingProduct ? 'تعديل بيانات الصنف' : 'إضافة صنف خضار / فاكهة جديد'}
      >
        <div className="space-y-3.5">

            {/* Emoji & Name */}
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">الرمز</label>
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen(true)}
                  className="w-full h-[40px] bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 hover:border-brand-500 rounded-xl flex flex-col items-center justify-center transition-all group relative"
                  title="اضغط لاختيار الرمز"
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform">{formData.emoji || '🥬'}</span>
                  <span className="text-[8px] font-bold text-brand-700 absolute -bottom-1 bg-white px-1 rounded shadow-xs border border-brand-200">تغيير</span>
                </button>
              </div>

              <div className="col-span-3">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم الصنف *</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="مثال: فلفل رومي"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            {/* Quick popular vegetable emojis bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-500 font-bold">رموز شائعة (انقر للاختيار):</span>
                <button
                  type="button"
                  onClick={() => setIsEmojiPickerOpen(true)}
                  className="text-brand-700 hover:underline font-bold flex items-center gap-0.5"
                >
                  <Sparkles size={11} />
                  <span>عرض كافة الرموز (50+)</span>
                </button>
              </div>
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {[
                  { e: '🥔', n: 'بطاطا' },
                  { e: '🧅', n: 'بصل' },
                  { e: '🧄', n: 'ثوم' },
                  { e: '🍅', n: 'طماطم' },
                  { e: '🥒', n: 'خيار' },
                  { e: '🫑', n: 'فلفل' },
                  { e: '🍆', n: 'باذنجان' },
                  { e: '🥕', n: 'جزر' },
                  { e: '🍉', n: 'بطيخ' },
                  { e: '🍋', n: 'ليمون' },
                  { e: '🥬', n: 'خس' },
                  { e: '🌿', n: 'بقدونس' },
                  { e: '🍎', n: 'تفاح' },
                  { e: '🍇', n: 'عنب' },
                  { e: '🍌', n: 'موز' },
                ].map(item => (
                  <button
                    key={item.e}
                    type="button"
                    onClick={() => {
                      setFormData(prev => ({
                        ...prev,
                        emoji: item.e,
                        name: prev.name ? prev.name : item.n
                      }));
                    }}
                    className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-lg border transition-all active:scale-90 ${
                      formData.emoji === item.e
                        ? 'bg-brand-50 border-brand-500 shadow-xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-white hover:border-slate-300'
                    }`}
                    title={item.n}
                  >
                    {item.e}
                  </button>
                ))}
              </div>
            </div>

            {/* Category & Unit */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">التصنيف</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  <option value="خضروات">خضروات</option>
                  <option value="فواكه">فواكه</option>
                  <option value="ورقيات">ورقيات</option>
                  <option value="حمضيات">حمضيات</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">العبوة الافتراضية</label>
                <select
                  value={formData.defaultUnit}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultUnit: e.target.value }))}
                  className="w-full px-2.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600"
                >
                  <option value="صندوق">صندوق</option>
                  <option value="شوال">شوال</option>
                  <option value="كرتونة">كرتونة</option>
                  <option value="قفص">قفص</option>
                  <option value="كيلو">كيلو</option>
                </select>
              </div>
            </div>

            {/* Tare & Price per kg */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">وزن الفارغ (كجم)</label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.defaultTareWeight}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultTareWeight: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  سعر بيع الكيلو ({settings.currency})
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={formData.defaultPricePerKg}
                  onChange={(e) => setFormData(prev => ({ ...prev, defaultPricePerKg: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            </div>

            {/* Current Stock & Cost Price */}
            <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">رصيد المخزن الحالي (كجم)</label>
                <input
                  type="number"
                  step="0.5"
                  placeholder="0.0"
                  value={formData.currentStockKg !== undefined ? formData.currentStockKg : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, currentStockKg: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  سعر التكلفة / الشراء ({settings.currency})
                </label>
                <input
                  type="number"
                  step="0.25"
                  placeholder="0.00"
                  value={formData.costPerKg !== undefined ? formData.costPerKg : ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, costPerKg: Number(e.target.value) }))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-brand-600"
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
                حفظ الصنف
              </Button>
            </div>
          </div>
      </Modal>

      {/* Emoji Picker Modal */}
      <EmojiPickerModal
        isOpen={isEmojiPickerOpen}
        onClose={() => setIsEmojiPickerOpen(false)}
        currentEmoji={formData.emoji}
        onSelectEmoji={(emoji, suggestedName) => {
          setFormData(prev => ({
            ...prev,
            emoji,
            name: prev.name ? prev.name : suggestedName
          }));
        }}
      />

    </div>
  );
}
