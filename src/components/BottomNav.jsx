import React, { useState, useEffect } from 'react';
import { 
  LayoutGrid, ShoppingCart, FileText, Package, 
  Menu, X, Truck, Users, Scale, TrendingDown, 
  UserCheck, AlertOctagon, Coins, PieChart, 
  Settings, LogOut, ChevronLeft, Store
} from 'lucide-react';
import { motion, AnimatePresence, useDragControls, useReducedMotion } from 'framer-motion';

export default function BottomNav({ 
  currentTab, 
  onChangeTab, 
  cartCount = 0, 
  hasPermission,
  onLogout,
  currentUser,
  activeBranch
}) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const sheetDragControls = useDragControls();
  const reducedMotion = useReducedMotion();
  useEffect(() => {
    if (!isMoreOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event) => { if (event.key === 'Escape') setIsMoreOpen(false); };
    document.addEventListener('keydown', closeOnEscape);
    const closeOnBack = (event) => {
      event.preventDefault();
      setIsMoreOpen(false);
    };
    window.addEventListener('braka:ui-back', closeOnBack);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('braka:ui-back', closeOnBack);
    };
  }, [isMoreOpen]);

  // 1. Primary Bottom Bar Items (The 4 most critical daily flows + More Menu)
  const primaryTabs = [
    { 
      id: 'home', 
      label: 'الرئيسية', 
      icon: LayoutGrid, 
      badge: null 
    },
    { 
      id: 'sale', 
      label: 'نقطة البيع', 
      icon: ShoppingCart, 
      badge: cartCount > 0 ? cartCount : null,
      highlight: true,
      perm: 'canSell'
    },
    { 
      id: 'invoices', 
      label: 'الفواتير', 
      icon: FileText, 
      badge: null,
      perm: 'canViewInvoices'
    },
    { 
      id: 'products', 
      label: 'الأصناف', 
      icon: Package, 
      badge: null,
      perm: 'canManageInventory'
    }
  ];

  // 2. Secondary Sections inside "المزيد" Bottom Sheet
  const moreItems = [
    { id: 'customers', label: 'العملاء والديون', icon: Users, desc: 'كشوف الحسابات والتحصيل', perm: 'canManageCustomers' },
    { id: 'purchases', label: 'المشتريات والموردين', icon: Truck, desc: 'فواتير التوريد والآجل', perm: 'canManagePurchases' },
    { id: 'audit', label: 'الجرد والسيولة', icon: Scale, desc: 'الخزنة ومطابقة الدرج', perm: 'canViewFinance' },
    { id: 'expenses', label: 'المصروفات اليومية', icon: TrendingDown, desc: 'النثريات والتشغيل', perm: 'canManageExpenses' },
    { id: 'workers', label: 'الموظفون والرواتب', icon: UserCheck, desc: 'الرواتب واليوميات', perm: 'canManagePayroll' },
    { id: 'damaged', label: 'التوالف والهالك', icon: AlertOctagon, desc: 'إعدام التبغ التالف', perm: 'canManageInventory' },
    { id: 'partners', label: 'الشركاء والأرباح', icon: Coins, desc: 'الأرباح والمسحوبات', perm: 'canViewFinance' },
    { id: 'reports', label: 'التقارير', icon: PieChart, desc: 'الطباعة والمحاسبة', perm: 'canViewFinance' },
    { id: 'settings', label: 'إعدادات وضبط النظام', icon: Settings, desc: 'الضرائب، الطابعات، والسحابة', perm: 'canAccessSettings' },
  ];

  const visiblePrimaryTabs = primaryTabs.filter(t => !t.perm || (hasPermission ? hasPermission(t.perm) : true));
  const visibleMoreItems = moreItems.filter(t => !t.perm || (hasPermission ? hasPermission(t.perm) : true));

  // Check if active tab belongs to the "More" drawer
  const isSubTabActive = visibleMoreItems.some(item => item.id === currentTab);

  const handleSelectTab = (tabId) => {
    setIsMoreOpen(false);
    onChangeTab(tabId);
  };

  return (
    <>
      {/* =========================================================================
          NATIVE ANDROID BOTTOM NAVIGATION BAR
         ========================================================================= */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200/80 shadow-[0_-4px_25px_rgba(0,0,0,0.06)] px-2 pt-1 pb-safe w-full select-none print:hidden touch-action-manipulation"
        role="navigation"
        aria-label="شريط التنقل السفلي"
      >
        <div className="max-w-lg mx-auto grid gap-0.5 items-center"
          style={{ gridTemplateColumns: `repeat(${visiblePrimaryTabs.length + 1}, minmax(0, 1fr))` }}>
          
          {visiblePrimaryTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = currentTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                whileTap={{ scale: 0.92 }}
                type="button"
                onClick={() => handleSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-2xl relative select-none cursor-pointer transition-colors ${
                  isActive 
                    ? 'text-primary-600 font-bold' 
                    : 'text-slate-500 hover:text-slate-800 font-medium'
                }`}
              >
                <div className="relative p-1.5 rounded-xl">
                  {/* Active Indicator Background */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabPill"
                      className="absolute inset-0 bg-primary-50 rounded-xl border border-primary-100/90 shadow-2xs"
                      transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                    />
                  )}

                  <span className="relative z-10 block">
                    <Icon size={21} strokeWidth={isActive ? 2.5 : 2} />
                  </span>
                  
                  {tab.badge && (
                    <span className="absolute -top-1 -right-1 z-20 min-w-4 h-4 px-1 bg-primary-600 text-white text-[9px] font-bold rounded-full flex items-center justify-center shadow-xs">
                      {tab.badge}
                    </span>
                  )}
                </div>

                <span className={`text-[10px] sm:text-[11px] tracking-tight mt-0.5 whitespace-nowrap transition-colors duration-150 ${
                  isActive ? 'font-bold text-navy-850' : 'text-slate-500'
                }`}>
                  {tab.label}
                </span>
              </motion.button>
            );
          })}

          {/* 5th Button: "المزيد" (More Menu Drawer Trigger) */}
          <motion.button
            whileTap={{ scale: 0.92 }}
            type="button"
            onClick={() => setIsMoreOpen(true)}
            className={`flex flex-col items-center justify-center min-h-[48px] py-1 px-1 rounded-2xl relative select-none cursor-pointer transition-colors ${
              isSubTabActive || isMoreOpen
                ? 'text-primary-600 font-bold' 
                : 'text-slate-500 hover:text-slate-800 font-medium'
            }`}
          >
            <div className="relative p-1.5 rounded-xl">
              {(isSubTabActive || isMoreOpen) && (
                <motion.div
                  layoutId="activeTabPill"
                  className="absolute inset-0 bg-primary-50 rounded-xl border border-primary-100/90 shadow-2xs"
                  transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                />
              )}

              <span className="relative z-10 block">
                <Menu size={21} strokeWidth={(isSubTabActive || isMoreOpen) ? 2.5 : 2} />
              </span>

              {isSubTabActive && (
                <span className="absolute -top-1 -right-1 z-20 w-2 h-2 bg-primary-600 rounded-full shadow-xs" />
              )}
            </div>

            <span className={`text-[10px] sm:text-[11px] tracking-tight mt-0.5 whitespace-nowrap transition-colors duration-150 ${
              isSubTabActive || isMoreOpen ? 'font-bold text-navy-850' : 'text-slate-500'
            }`}>
              المزيد
            </span>
          </motion.button>

        </div>
      </nav>

      {/* =========================================================================
          NATIVE ANDROID BOTTOM SHEET (More Drawer)
         ========================================================================= */}
      <AnimatePresence>
        {isMoreOpen && (
          <div className="md:hidden fixed inset-0 z-50 flex flex-col justify-end">
            
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
              className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs transition-opacity"
            />

            {/* Bottom Sheet Window */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={reducedMotion ? { duration: 0 } : { type: 'spring', damping: 30, stiffness: 350 }}
              drag="y"
              dragListener={false}
              dragControls={sheetDragControls}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.25 }}
              onDragEnd={(_, info) => { if (info.offset.y > 80 || info.velocity.y > 500) setIsMoreOpen(false); }}
              className="relative bg-white rounded-t-3xl border-t border-slate-200/90 shadow-2xl z-10 max-h-[85vh] flex flex-col pb-safe overflow-hidden"
            >
              {/* Drag Handle Pill */}
              <div onPointerDown={(event) => sheetDragControls.start(event)}
                style={{ touchAction: 'none' }}
                className="pt-3 pb-1 min-h-11 flex justify-center items-center cursor-grab active:cursor-grabbing">
                <div className="w-12 h-1.5 bg-slate-300 rounded-full" />
              </div>

              {/* Sheet Header */}
              <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                    <Store size={16} />
                  </div>
                  <div className="text-right">
                    <h3 className="text-xs font-bold text-navy-850 leading-tight">
                      أقسام المتجر
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      {activeBranch?.name || 'الفرع الرئيسي'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsMoreOpen(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
                  aria-label="إغلاق القائمة"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Sheet Grid Items */}
              <div className="p-4 overflow-y-auto max-h-[60vh] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {visibleMoreItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;

                    return (
                      <motion.button
                        key={item.id}
                        whileTap={{ scale: 0.96 }}
                        type="button"
                        onClick={() => handleSelectTab(item.id)}
                        className={`p-3 rounded-2xl border text-right transition-all flex items-start gap-2.5 cursor-pointer ${
                          isActive
                            ? 'bg-primary-50 border-primary-200 text-primary-900 shadow-2xs'
                            : 'bg-slate-50/70 hover:bg-slate-100 border-slate-200/80 text-slate-800'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          isActive ? 'bg-primary-600 text-white' : 'bg-white text-slate-600 border border-slate-200/90 shadow-2xs'
                        }`}>
                          <Icon size={16} />
                        </div>
                        <div className="truncate flex-1">
                          <span className="block text-xs font-bold leading-tight truncate">
                            {item.label}
                          </span>
                          <span className="block text-[10px] text-slate-400 truncate mt-0.5">
                            {item.desc}
                          </span>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Logout Button inside Drawer */}
                {currentUser && onLogout && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreOpen(false);
                        if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                          onLogout();
                        }
                      }}
                      className="w-full py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <LogOut size={15} />
                      <span>تسجيل الخروج من الحساب ({currentUser.username})</span>
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
