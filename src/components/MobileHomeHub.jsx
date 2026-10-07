import React from 'react';
import { 
  ShoppingCart, FileText, Truck, Users, 
  AlertOctagon, UserCheck, Package, PieChart, 
  Settings, ArrowLeft, TrendingDown, Scale, Coins, Store, LogOut
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency, getCurrentDateFormatted } from '../utils/formatters';
import { TAB_PERMISSION_MAP } from './DesktopSidebar';
import { BRRAKA_LOGO } from '../assets/branding';

export default function MobileHomeHub({ 
  store, 
  onNavigate, 
  onOpenSettings 
}) {
  const { invoices = [], customers = [], products = [], settings, suppliers = [], partners = [], getFinancialPosition } = store;

  // Quick Daily Stats & Financial Position
  const today = getCurrentDateFormatted();
  const todayInvoices = invoices.filter(i => i.date === today);
  const todaySales = todayInvoices.reduce((sum, inv) => sum + (Number(inv.finalTotal) || 0), 0);
  const totalDebts = customers.reduce((sum, c) => sum + Math.max(0, Number(c.balance) || 0), 0);
  const totalSupplierDebts = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.balance) || 0), 0);

  const finPos = getFinancialPosition ? getFinancialPosition() : null;

  // 4 Core Business Workflow Sections
  const sections = [
    {
      id: 'sales',
      title: 'حركة المبيعات والكاشير',
      icon: ShoppingCart,
      badge: 'العمليات اليومية',
      color: 'text-navy-850 bg-slate-100 border-slate-200',
      items: [
        {
          id: 'sale',
          title: 'نقطة البيع',
          desc: 'الميزان والكاشير',
          icon: ShoppingCart,
          color: 'bg-primary-500 text-white',
          badge: 'رئيسي',
          highlight: true
        },
        {
          id: 'invoices',
          title: 'سجل الفواتير',
          desc: 'المبيعات اليومية',
          icon: FileText,
          color: 'bg-navy-850 text-white',
          badge: invoices.length > 0 ? `${invoices.length} فاتورة` : null
        },
        {
          id: 'customers',
          title: 'العملاء والديون',
          desc: 'كشوف الحسابات',
          icon: Users,
          color: 'bg-slate-700 text-white',
          badge: totalDebts > 0 ? 'ديون مستحقة' : null
        },
      ]
    },
    {
      id: 'inventory',
      title: 'التوريد والمخزون',
      icon: Truck,
      badge: 'البضائع والموردين',
      color: 'text-navy-850 bg-slate-100 border-slate-200',
      items: [
        {
          id: 'purchases',
          title: 'المشتريات والموردين',
          desc: 'فواتير التوريد والآجل',
          icon: Truck,
          color: 'bg-navy-850 text-white',
          badge: totalSupplierDebts > 0 ? 'آجل موردين' : (suppliers.length > 0 ? `${suppliers.length} موردين` : null)
        },
        {
          id: 'products',
          title: 'الأصناف والأسعار',
          desc: 'قائمة التبغ والتسعير',
          icon: Package,
          color: 'bg-slate-700 text-white',
          badge: products.length > 0 ? `${products.length} صنف` : null
        },
        {
          id: 'damaged',
          title: 'التوالف والهالك',
          desc: 'إعدام التبغ التالف',
          icon: AlertOctagon,
          color: 'bg-slate-600 text-white',
          badge: null
        },
      ]
    },
    {
      id: 'operations',
      title: 'المصروفات والتشغيل',
      icon: TrendingDown,
      badge: 'النثريات والعمالة',
      color: 'text-navy-850 bg-slate-100 border-slate-200',
      items: [
        {
          id: 'expenses',
          title: 'المصروفات اليومية',
          desc: 'النثريات والمشتريات',
          icon: TrendingDown,
          color: 'bg-navy-850 text-white',
          badge: null
        },
        {
          id: 'workers',
          title: 'الموظفون والرواتب',
          desc: 'الرواتب والغياب والسلف',
          icon: UserCheck,
          color: 'bg-slate-700 text-white',
          badge: null
        },
      ]
    },
    {
      id: 'finance',
      title: 'الرقابة المالية والشركاء والأرباح',
      icon: Scale,
      badge: 'الجرد والتقارير',
      color: 'text-navy-850 bg-slate-100 border-slate-200',
      items: [
        {
          id: 'audit',
          title: 'الجرد والسيولة',
          desc: 'الخزنة ومطابقة الدرج',
          icon: Scale,
          color: 'bg-navy-850 text-white',
          badge: null
        },
        {
          id: 'partners',
          title: 'الشركاء والمسحوبات',
          desc: 'الأرباح والحصص',
          icon: Coins,
          color: 'bg-slate-700 text-white',
          badge: partners.length > 0 ? `${partners.length} شركاء` : null
        },
        {
          id: 'reports',
          title: 'التقارير',
          desc: 'الطباعة والكشوفات',
          icon: PieChart,
          color: 'bg-primary-600 text-white',
          badge: null
        },
      ]
    },
    {
      id: 'settings_section',
      title: 'إدارة وضبط النظام',
      icon: Settings,
      badge: 'التخصيص والسحابة',
      color: 'text-navy-850 bg-slate-100 border-slate-200',
      items: [
        {
          id: 'settings',
          title: 'إعدادات وضبط النظام',
          desc: 'الضريبة، الطابعات، الميزان والسحابة',
          icon: Settings,
          color: 'bg-navy-850 text-white',
          badge: null
        }
      ]
    }
  ];

  const visibleSections = sections.map(sec => {
    const visibleItems = sec.items.filter(item => {
      const permKey = TAB_PERMISSION_MAP?.[item.id];
      return !permKey || (store.hasPermission ? store.hasPermission(permKey) : true);
    });
    return {
      ...sec,
      items: visibleItems
    };
  }).filter(sec => sec.items.length > 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04
      }
    }
  };

  /** @type {import('framer-motion').Variants} */
  const itemVariants = {
    hidden: { opacity: 0, y: 8, scale: 0.97 },
    show: { 
      opacity: 1, 
      y: 0, 
      scale: 1, 
      transition: { 
        type: 'spring', 
        stiffness: 400, 
        damping: 26 
      } 
    }
  };

  return (
    <div className="w-full max-w-xl md:max-w-3xl lg:max-w-4xl mx-auto pb-32 pt-2 sm:pt-4 px-3 sm:px-6 space-y-4">
      
      {/* Top Enterprise Header & Financial Glance */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5 truncate">
            <img 
              src={BRRAKA_LOGO} 
              alt="براكه" 
              className="w-12 h-12 rounded-2xl object-contain shrink-0 shadow-xs" 
            />
            <div className="truncate text-right">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold text-navy-850 truncate tracking-tight">
                  {settings.shopName || 'براكه'}
                </h1>
                <span className="text-[10px] bg-slate-100 text-slate-700 font-semibold px-2 py-0.5 rounded-md border border-slate-200">
                  {store.activeBranch?.name || 'الفرع الرئيسي'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {settings.subTitle || 'منظومة كاشير ومحاسبة سحابية'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onOpenSettings}
              className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 flex items-center justify-center transition-colors cursor-pointer"
              title="إعدادات وضبط النظام"
            >
              <Settings size={17} />
            </button>
            {store.currentUser && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                    store.logout();
                  }
                }}
                className="w-9 h-9 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/70 flex items-center justify-center transition-colors cursor-pointer"
                title="تسجيل الخروج من النظام"
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>

        {/* 4 Core Financial Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 block truncate">مبيعات اليوم:</span>
            <div className="flex items-baseline gap-1 overflow-hidden">
              <span className="text-base font-bold font-mono tabular-nums text-navy-850 truncate">
                {todaySales.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-400 font-medium shrink-0">{settings.currency}</span>
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] font-semibold text-slate-700 block truncate">الخزينة (الدرج):</span>
            <div className="flex items-baseline gap-1 overflow-hidden">
              <span className="text-base font-bold font-mono tabular-nums text-navy-850 truncate">
                {finPos ? (Number(finPos.cashBalance) || 0).toFixed(1) : '0'}
              </span>
              <span className="text-[9px] text-slate-600 font-medium shrink-0">{settings.currency}</span>
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] font-semibold text-slate-500 block truncate">البنك والشبكة:</span>
            <div className="flex items-baseline gap-1 overflow-hidden">
              <span className="text-base font-bold font-mono tabular-nums text-slate-800 truncate">
                {finPos ? (Number(finPos.bankBalance) || 0).toFixed(1) : '0'}
              </span>
              <span className="text-[9px] text-slate-400 font-medium shrink-0">{settings.currency}</span>
            </div>
          </div>

          <div className="bg-slate-50/70 border border-slate-200/80 rounded-xl p-2.5 space-y-1">
            <span className="text-[10px] font-semibold text-slate-700 block truncate">ديون العملاء:</span>
            <div className="flex items-baseline gap-1 overflow-hidden">
              <span className="text-base font-bold font-mono tabular-nums text-navy-850 truncate">
                {totalDebts.toFixed(1)}
              </span>
              <span className="text-[9px] text-slate-600 font-medium shrink-0">{settings.currency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Categorized Functional Workflow Sections */}
      <div className="space-y-4">
        {visibleSections.map((sec, secIdx) => {
          const SecIcon = sec.icon;
          return (
            <div key={sec.id} className="space-y-2">
              {/* Section Header with Category Pill */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border text-xs ${sec.color}`}>
                    <SecIcon size={14} />
                  </div>
                  <h2 className="text-xs sm:text-sm font-bold text-navy-850">
                    {sec.title}
                  </h2>
                </div>
                <span className="text-[10px] font-medium text-slate-400">
                  {sec.badge}
                </span>
              </div>

              {/* Grid for this Section */}
              <motion.div 
                variants={containerVariants}
                initial="hidden"
                animate="show"
                className={`grid gap-2 sm:gap-2.5 ${
                  sec.items.length === 2 
                    ? 'grid-cols-2' 
                    : 'grid-cols-3'
                }`}
              >
                {sec.items.map((m) => {
                  const Icon = m.icon;
                  return (
                    <motion.button
                      key={m.id}
                      variants={itemVariants}
                      whileTap={{ scale: 0.94, transition: { duration: 0.1 } }}
                      type="button"
                      onClick={() => onNavigate(m.id)}
                      className={`flex flex-col items-center justify-center p-2.5 sm:p-3 rounded-2xl border transition-all text-center relative select-none cursor-pointer min-w-0 overflow-hidden ${
                        m.highlight
                          ? 'bg-white border-primary-500 shadow-soft ring-1 ring-primary-500/20'
                          : 'bg-white hover:bg-slate-50 border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      {/* Badge if present */}
                      {m.badge && (
                        <span className="absolute top-1 left-1 max-w-[80%] truncate text-[8px] sm:text-[8.5px] font-semibold font-mono px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                          {m.badge}
                        </span>
                      )}

                      {/* Touch-Friendly Icon Box */}
                      <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-xs mb-1.5 ${m.color}`}>
                        <Icon size={20} strokeWidth={2.2} />
                      </div>

                      {/* Title */}
                      <span className="text-[11px] sm:text-[12px] font-bold text-navy-850 leading-tight block text-center w-full px-0.5 truncate">
                        {m.title}
                      </span>

                      {/* Brief Subtitle */}
                      <span className="text-[9px] sm:text-[10px] font-normal text-slate-500 block text-center w-full mt-0.5 truncate">
                        {m.desc}
                      </span>
                    </motion.button>
                  );
                })}
              </motion.div>
            </div>
          );
        })}
      </div>

      {/* Fast Action Card: Direct Sale Trigger */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.3 }}
        className="pt-1"
      >
        <motion.button
          whileTap={{ scale: 0.97 }}
          type="button"
          onClick={() => onNavigate('sale')}
          className="w-full py-3.5 px-5 bg-navy-850 hover:bg-navy-900 text-white rounded-2xl font-bold text-sm shadow-premium flex items-center justify-between cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-500 flex items-center justify-center text-white">
              <ShoppingCart size={20} className="text-white" />
            </div>
            <div className="text-right">
              <span className="block text-sm font-bold text-white">فتح شاشة الميزان والبيع فوراً</span>
              <span className="block text-[11px] text-slate-300 font-normal">تسجيل وزن جديد وطباعة الفاتورة</span>
            </div>
          </div>
          <ArrowLeft size={20} className="text-slate-300 shrink-0" />
        </motion.button>
      </motion.div>

      {/* Mobile User Profile & Logout Tile */}
      {store.currentUser && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="bg-white border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs"
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-200">
              {store.currentUser.name?.[0] || store.currentUser.username?.[0] || 'U'}
            </div>
            <div className="truncate text-right">
              <span className="block text-xs font-bold text-slate-800 truncate">
                {store.currentUser.name || store.currentUser.username}
              </span>
              <span className="block text-[10px] text-slate-400">
                {store.currentUser.role === 'admin' ? 'مالك / مدير المنظومة' : 'كاشير / نقطة بيع'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                store.logout();
              }
            }}
            className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <LogOut size={13} />
            <span>تسجيل الخروج</span>
          </button>
        </motion.div>
      )}

    </div>
  );
}
