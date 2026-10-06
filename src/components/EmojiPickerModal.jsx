import React, { useState } from 'react';
import { X, Search, Sparkles } from 'lucide-react';
import { VEGETABLE_EMOJIS, VEGETABLE_EMOJI_CATEGORIES } from '../data/vegetableEmojis';

export default function EmojiPickerModal({ isOpen, onClose, onSelectEmoji, currentEmoji }) {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredEmojis = VEGETABLE_EMOJIS.filter(item => {
    const matchCategory = selectedCategory === 'all' || item.category === selectedCategory;
    const matchSearch = searchQuery === '' || 
      item.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in zoom-in-95">
        
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <span className="text-xl">🥬</span>
            <div>
              <h3 className="font-bold text-sm">اختر رمز الصنف (أيقونة الخضار والفواكه)</h3>
              <p className="text-[11px] text-slate-300">اختر الرمز المناسب للظهور في الفواتير والقوائم</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-3 border-b border-slate-100 bg-slate-50/50">
          <div className="relative">
            <Search size={16} className="absolute right-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="ابحث باسم الخضار أو الفاكهة (مثال: طماطم، نعناع، بطيخ)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-9 pl-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-600 shadow-sm"
              autoFocus
            />
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1 overflow-x-auto pt-2 scrollbar-none">
            {VEGETABLE_EMOJI_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Emojis Grid */}
        <div className="p-4 overflow-y-auto flex-1">
          {filteredEmojis.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              <p className="text-xs font-bold">لا يوجد صنف مطابق لـ "{searchQuery}"</p>
              <p className="text-[11px] text-slate-400 mt-1">جرب البحث بكلمة أخرى أو تصفح الأقسام</p>
            </div>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5">
              {filteredEmojis.map((item, idx) => {
                const isCurrent = currentEmoji === item.emoji;

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      onSelectEmoji(item.emoji, item.name);
                      onClose();
                    }}
                    className={`p-2.5 rounded-2xl flex flex-col items-center justify-center gap-1 transition-all active:scale-95 border ${
                      isCurrent
                        ? 'bg-brand-50 border-brand-500 ring-2 ring-brand-500/30'
                        : 'bg-slate-50/70 border-slate-200/80 hover:bg-white hover:border-slate-300 hover:shadow-sm'
                    }`}
                  >
                    <span className="text-3xl filter drop-shadow-sm">{item.emoji}</span>
                    <span className="text-[10px] font-bold text-slate-700 truncate w-full text-center">
                      {item.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs">
          <span className="text-slate-500 font-medium">عدد الرموز المتاحة: {VEGETABLE_EMOJIS.length} رمز</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl"
          >
            إغلاق
          </button>
        </div>

      </div>
    </div>
  );
}
