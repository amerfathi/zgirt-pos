import React, { useState } from 'react';
import { Scale, Plus, Trash2, Check, X, Calculator, ArrowRight } from 'lucide-react';
import { formatWeight } from '../utils/formatters';

export default function WeightTallyModal({ isOpen, onClose, itemName, initialWeighings = [], onApply }) {
  const [weighings, setWeighings] = useState(initialWeighings || []);
  const [currentInput, setCurrentInput] = useState('');

  if (!isOpen) return null;

  const handleAddWeighing = () => {
    const val = parseFloat(currentInput);
    if (!isNaN(val) && val > 0) {
      setWeighings(prev => [...prev, val]);
      setCurrentInput('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddWeighing();
    }
  };

  const handleRemove = (index) => {
    setWeighings(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleQuickAdd = (amount) => {
    setWeighings(prev => [...prev, amount]);
  };

  const totalGross = weighings.reduce((sum, w) => sum + w, 0);
  const avgWeight = weighings.length > 0 ? (totalGross / weighings.length).toFixed(2) : 0;

  const handleConfirm = () => {
    onApply(totalGross, weighings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 transition-all">
      <div className="w-full max-w-lg bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[85vh] overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand-600/30 border border-brand-500/30 flex items-center justify-center text-brand-400">
              <Scale size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base">تجميع قلّبات الميزان (أوزان متعددة)</h3>
              <p className="text-xs text-slate-300">الصنف: <span className="text-brand-300 font-semibold">{itemName || 'الصنف'}</span></p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Total Summary Banner */}
        <div className="bg-emerald-50/80 border-b border-emerald-100 px-5 py-3 flex items-center justify-between">
          <div>
            <span className="text-xs text-emerald-800 block font-medium">إجمالي الوزن القائم</span>
            <span className="text-2xl font-black text-emerald-700 tracking-tight">
              {formatWeight(totalGross)}
            </span>
          </div>
          <div className="text-left">
            <span className="text-xs text-slate-500 block font-medium">عدد الوزنات</span>
            <span className="text-lg font-bold text-slate-800">
              {weighings.length} <span className="text-xs font-normal text-slate-500">مرة</span>
            </span>
            {weighings.length > 0 && (
              <span className="text-[11px] text-slate-500 block">
                معدل الوزنة: {avgWeight} كجم
              </span>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {/* Input Section */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              أدخل وزن القلّبة الحالية (كجم)
            </label>
            <div className="flex gap-2">
              <input 
                type="number"
                step="0.1"
                inputMode="decimal"
                placeholder="مثلاً: 32.5"
                value={currentInput}
                onChange={(e) => setCurrentInput(e.target.value)}
                onKeyDown={handleKeyDown}
                autoFocus
                className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-600 focus:bg-white text-center transition-all placeholder:text-slate-400"
              />
              <button 
                type="button"
                onClick={handleAddWeighing}
                disabled={!currentInput}
                className="px-5 py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <Plus size={20} />
                <span>إضافة</span>
              </button>
            </div>
          </div>

          {/* Quick preset chips */}
          <div>
            <span className="text-[11px] text-slate-500 block mb-1.5 font-medium">إضافة وزنة شائعة بنقرة:</span>
            <div className="flex flex-wrap gap-1.5">
              {[25, 30, 32, 35, 40, 50, 75, 80].map(val => (
                <button
                  key={val}
                  type="button"
                  onClick={() => handleQuickAdd(val)}
                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition-colors active:scale-95"
                >
                  +{val} كجم
                </button>
              ))}
            </div>
          </div>

          {/* Weighings List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">سجل الوزنات المدخلة:</span>
              {weighings.length > 0 && (
                <button 
                  type="button"
                  onClick={() => setWeighings([])}
                  className="text-xs text-red-600 hover:text-red-700 font-medium"
                >
                  مسح الكل
                </button>
              )}
            </div>

            {weighings.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400">
                <Scale size={28} className="mx-auto mb-1.5 opacity-40" />
                <p className="text-xs">لم تقم بإضافة أي وزنة بعد</p>
                <p className="text-[11px] text-slate-400 mt-0.5">اكتب الوزن في الخانة واضغط إضافة أو Enter</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto pr-1">
                {weighings.map((weight, idx) => (
                  <div 
                    key={idx}
                    className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-600 text-[10px] font-bold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-sm font-bold text-slate-800">
                        {weight.toFixed(2)} <span className="text-[10px] font-normal text-slate-500">كجم</span>
                      </span>
                    </div>
                    <button 
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                      title="حذف"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 flex items-center gap-3">
          <button 
            type="button"
            onClick={onClose}
            className="flex-1 py-3 px-4 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-sm rounded-xl transition-colors"
          >
            إلغاء
          </button>
          <button 
            type="button"
            onClick={handleConfirm}
            className="flex-2 py-3 px-5 bg-brand-600 hover:bg-brand-700 active:scale-95 text-white font-bold text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-brand-600/20"
          >
            <Check size={18} />
            <span>اعتماد الوزن ({formatWeight(totalGross)})</span>
          </button>
        </div>

      </div>
    </div>
  );
}
