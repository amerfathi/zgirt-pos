import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LayoutGrid, ShoppingCart, FileText, Users, Truck, Package, 
  AlertOctagon, TrendingDown, UserCheck, Scale, Coins, PieChart,
  ChevronDown, Store, Building2, Check, ShieldCheck, KeyRound, 
  LogOut, Settings, PanelRightClose, PanelRightOpen, Crown, User
} from 'lucide-react';
import { BRRAKA_LOGO } from '../assets/branding';

export const NAV_GROUPS = [
  {
    id: 'sales',
    label: 'المبيعات والعملاء',
    shortLabel: 'المبيعات',
    icon: ShoppingCart,
    defaultTab: 'sale',
    tabs: [
      { id: 'sale', label: 'نقطة البيع والميزان', icon: ShoppingCart },
      { id: 'invoices', label: 'سجل الفواتير', icon: FileText },
      { id: 'customers', label: 'العملاء والديون', icon: Users },
    ]
  },
  {
    id: 'inventory',
    label: 'التوريد والمخزون',
    shortLabel: 'المخزون',
    icon: Truck,
    defaultTab: 'purchases',
    tabs: [
      { id: 'purchases', label: 'المشتريات والموردين', icon: Truck },
      { id: 'products', label: 'الأصناف والأسعار', icon: Package },
      { id: 'damaged', label: 'التوالف والهالك', icon: AlertOctagon },
    ]
  },
  {
    id: 'operations',
    label: 'المصروفات والتشغيل',
    shortLabel: 'المصروفات',
    icon: TrendingDown,
    defaultTab: 'expenses',
    tabs: [
      { id: 'expenses', label: 'المصروفات اليومية', icon: TrendingDown },
      { id: 'workers', label: 'الموظفون والرواتب', icon: UserCheck },
    ]
  },
  {
    id: 'finance',
    label: 'المالية والجرد والأرباح',
    shortLabel: 'المالية والجرد',
    icon: Scale,
    defaultTab: 'audit',
    tabs: [
      { id: 'audit', label: 'الجرد ومطابقة الدرج', icon: Scale },
      { id: 'partners', label: 'الشركاء والمسحوبات', icon: Coins },
      { id: 'reports', label: 'التقارير', icon: PieChart },
    ]
  },
  {
    id: 'settings_group',
    label: 'الضبط والتخصيص',
    shortLabel: 'الضبط',
    icon: Settings,
    defaultTab: 'settings',
    tabs: [
      { id: 'settings', label: 'إعدادات وضبط النظام', icon: Settings },
    ]
  }
];

export const TAB_PERMISSION_MAP = {
  sale: 'canSell',
  invoices: 'canViewInvoices',
  customers: 'canManageCustomers',
  purchases: 'canManagePurchases',
  products: 'canManageInventory',
  damaged: 'canManageInventory',
  expenses: 'canManageExpenses',
  workers: 'canManagePayroll',
  audit: 'canViewFinance',
  partners: 'canViewFinance',
  reports: 'canViewFinance',
  settings: 'canAccessSettings'
};

export const getCategoryForTab = (tabId) => {
  for (const group of NAV_GROUPS) {
    if (group.tabs.some(t => t.id === tabId)) {
      return group.id;
    }
  }
  return 'sales';
};

export default function DesktopSidebar({
  currentTab,
  onNavigate,
  isCollapsed,
  onToggleCollapse,
  currentUser,
  canViewAllBranches = false,
  activeBranch,
  branches = [],
  onChangeBranch,
  onOpenBranchesModal,
  onOpenChangePassword,
  onOpenSuperAdmin,
  onOpenSettings,
  onLogout,
  settings = /** @type {{shopName?: string, subTitle?: string}} */ ({}),
  hasPermission
}) {
  const checkPermission = (permKey) => {
    if (typeof hasPermission === 'function') return hasPermission(permKey);
    if (!currentUser) return true;
    if (currentUser.role === 'super_admin' || currentUser.role === 'company_owner' || currentUser.role === 'admin') return true;
    return Boolean(currentUser?.permissions?.[permKey]);
  };

  const visibleGroups = NAV_GROUPS.map(group => {
    const visibleTabs = group.tabs.filter(tab => {
      const permKey = TAB_PERMISSION_MAP[tab.id];
      return !permKey || checkPermission(permKey);
    });
    return {
      ...group,
      tabs: visibleTabs,
      defaultTab: visibleTabs.some(t => t.id === group.defaultTab) ? group.defaultTab : visibleTabs[0]?.id
    };
  }).filter(group => group.tabs.length > 0);

  // Map of opened accordion groups
  const [openGroups, setOpenGroups] = useState(() => {
    const activeCat = getCategoryForTab(currentTab);
    return { [activeCat]: true };
  });

  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);

  // Automatically keep current category open when currentTab changes
  useEffect(() => {
    if (currentTab !== 'home') {
      const activeCat = getCategoryForTab(currentTab);
      setOpenGroups(prev => ({
        ...prev,
        [activeCat]: true
      }));
    }
  }, [currentTab]);

  const toggleGroup = (groupId) => {
    setOpenGroups(prev => ({
      ...prev,
      [groupId]: !prev[groupId]
    }));
  };

  return (
    <aside 
      className={`hidden md:flex flex-col bg-white border-l border-slate-200/80 shadow-2xs select-none transition-all duration-300 relative z-30 shrink-0 h-screen ${
        isCollapsed ? 'w-[72px]' : 'w-[260px]'
      }`}
    >
      {/* 1. Header / Brand Bar */}
      <div className="h-16 border-b border-slate-200/80 px-3 flex items-center justify-between shrink-0">
        <div className={`flex items-center gap-2.5 overflow-hidden ${isCollapsed ? 'justify-center w-full' : ''}`}>
          <img 
            src={BRRAKA_LOGO} 
            alt="براكه" 
            className="w-10 h-10 rounded-xl object-contain shadow-xs shrink-0" 
          />
          {!isCollapsed && (
            <div className="truncate text-right">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-xs text-navy-850 truncate tracking-tight">
                  {settings.shopName || 'براكه'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 truncate">
                {settings.subTitle || 'منظومة كاشير ومحاسبة'}
              </p>
            </div>
          )}
        </div>

        {/* Collapse toggle button on expanded state */}
        {!isCollapsed && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="p-1.5 text-slate-400 hover:text-navy-850 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer shrink-0"
            title="طي الشريط الجانبي"
          >
            <PanelRightClose size={16} />
          </button>
        )}
      </div>

      {/* 2. Active Branch Switcher */}
      <div className="px-2.5 py-2 border-b border-slate-100 relative shrink-0">
        {isCollapsed ? (
          <button
            type="button"
            onClick={onOpenBranchesModal}
            className="w-10 h-10 mx-auto flex items-center justify-center rounded-xl bg-slate-50 hover:bg-slate-100 text-primary-600 border border-slate-200/80 cursor-pointer transition-colors"
            title={`الفرع: ${activeBranch?.name || 'الفرع الرئيسي'}`}
          >
            <Store size={18} />
          </button>
        ) : (
          <div>
            <button
              type="button"
              onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl text-xs font-semibold text-navy-850 transition-all cursor-pointer shadow-2xs"
            >
              <div className="flex items-center gap-2 truncate">
                <div className="w-5 h-5 rounded-md bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                  <Store size={12} />
                </div>
                <div className="text-right truncate">
                  <span className="block truncate text-[11px] font-bold">
                    {activeBranch?.name || 'الفرع الرئيسي'}
                  </span>
                  <span className="block text-[9px] text-slate-400 font-mono flex items-center gap-1">
                    {activeBranch?.isMain ? (
                      <>
                        <Crown size={10} className="text-amber-500" />
                        <span>الفرع الرئيسي</span>
                      </>
                    ) : (
                      <span>{activeBranch?.code || 'فرع نشط'}</span>
                    )}
                  </span>
                </div>
              </div>
              <ChevronDown 
                size={14} 
                className={`text-slate-400 transition-transform duration-200 ${isBranchDropdownOpen ? 'rotate-180 text-primary-600' : ''}`} 
              />
            </button>

            {/* Branch Switcher Dropdown */}
            {isBranchDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setIsBranchDropdownOpen(false)} 
                />
                <div className="absolute top-full right-2 left-2 mt-1 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="px-2 py-1 border-b border-slate-100 flex items-center justify-between mb-1">
                    <span className="text-[10px] font-bold text-navy-850">التبديل إلى فرع:</span>
                    <span className="text-[9px] text-slate-400 font-mono">{branches.length} فروع</span>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {canViewAllBranches && <button type="button"
                      onClick={() => { onChangeBranch('all'); setIsBranchDropdownOpen(false); }}
                      className="w-full text-right px-2 py-1.5 rounded-lg text-xs font-bold text-primary-700 hover:bg-primary-50">
                      كل الفروع — عرض مجمع فقط
                    </button>}
                    {branches.map(b => {
                      const isSel = b.id === activeBranch?.id;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            onChangeBranch(b.id);
                            setIsBranchDropdownOpen(false);
                          }}
                          className={`w-full text-right px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                            isSel 
                              ? 'bg-primary-50 text-primary-700 font-semibold' 
                              : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <span className="truncate">{b.name}</span>
                          {isSel && <Check size={14} className="text-primary-600 shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {!currentUser?.isStaff && <div className="pt-1.5 mt-1 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setIsBranchDropdownOpen(false);
                        onOpenBranchesModal();
                      }}
                      className="w-full py-1 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1 transition-colors cursor-pointer border border-slate-200/70"
                    >
                      <Building2 size={13} className="text-primary-500" />
                      <span>إدارة ومناقلات الفروع</span>
                    </button>
                  </div>}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* 3. Navigation Links List */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
        {/* Main Dashboard Button */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
            currentTab === 'home'
              ? 'bg-navy-850 text-white shadow-2xs'
              : 'text-slate-600 hover:text-navy-850 hover:bg-slate-100/80'
          } ${isCollapsed ? 'justify-center px-0' : ''}`}
          title="الرئيسية"
        >
          <LayoutGrid size={18} className={currentTab === 'home' ? 'text-white' : 'text-slate-400'} />
          {!isCollapsed && <span>الرئيسية</span>}
        </button>

        <div className="py-1">
          <div className="h-[1px] bg-slate-100 w-full" />
        </div>

        {/* Accordion Categories */}
        {visibleGroups.map((group) => {
          const GroupIcon = group.icon;
          const isCurrentCategory = currentTab !== 'home' && getCategoryForTab(currentTab) === group.id;
          const isOpen = !!openGroups[group.id];

          if (isCollapsed) {
            // In Collapsed Mode: show icon button with active highlight
            return (
              <div key={group.id} className="relative group/mini">
                <button
                  type="button"
                  onClick={() => onNavigate(group.defaultTab)}
                  className={`w-10 h-10 mx-auto flex items-center justify-center rounded-xl transition-all cursor-pointer ${
                    isCurrentCategory
                      ? 'bg-primary-50 text-primary-600 border border-primary-200 font-bold'
                      : 'text-slate-500 hover:text-navy-850 hover:bg-slate-100'
                  }`}
                  title={group.label}
                >
                  <GroupIcon size={18} />
                </button>
              </div>
            );
          }

          return (
            <div key={group.id} className="space-y-0.5">
              {/* Category Accordion Header */}
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isCurrentCategory
                    ? 'text-navy-850 bg-slate-100/70 font-bold'
                    : 'text-slate-600 hover:text-navy-850 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`p-1 rounded-lg ${isCurrentCategory ? 'bg-primary-50 text-primary-600' : 'text-slate-400'}`}>
                    <GroupIcon size={16} />
                  </div>
                  <span className="text-xs">{group.label}</span>
                </div>

                <ChevronDown 
                  size={14} 
                  className={`text-slate-400 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 text-primary-500' : ''
                  }`} 
                />
              </button>

              {/* Sub-tabs Accordion Drawer */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: 'easeInOut' }}
                    className="overflow-hidden pr-4 pl-1 space-y-0.5"
                  >
                    <div className="border-r-2 border-slate-200/80 pr-2 space-y-1 my-1">
                      {group.tabs.map((subTab) => {
                        const SubIcon = subTab.icon;
                        const isSubActive = currentTab === subTab.id;

                        return (
                          <button
                            key={subTab.id}
                            type="button"
                            onClick={() => onNavigate(subTab.id)}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                              isSubActive
                                ? 'bg-primary-50 text-primary-700 font-bold shadow-2xs border border-primary-100'
                                : 'text-slate-600 hover:text-navy-850 hover:bg-slate-100/60 font-medium'
                            }`}
                          >
                            <SubIcon 
                              size={13} 
                              className={isSubActive ? 'text-primary-600 shrink-0' : 'text-slate-400 shrink-0'} 
                            />
                            <span className="truncate">{subTab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </nav>

      {/* 4. Bottom Footer: User, Settings & Actions */}
      <div className="p-2 border-t border-slate-200/80 bg-slate-50/50 shrink-0 space-y-1">
        {/* User Card */}
        {currentUser && (
          <div className={`flex items-center rounded-xl p-1.5 transition-colors ${isCollapsed ? 'justify-center' : 'justify-between bg-white border border-slate-200/80 shadow-2xs'}`}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 flex items-center justify-center shrink-0">
                {currentUser.role === 'super_admin' ? (
                  <Crown size={14} className="text-amber-500" />
                ) : (
                  <User size={14} className="text-slate-600" />
                )}
              </div>
              {!isCollapsed && (
                <div className="text-right truncate">
                  <span className="text-[11px] font-bold text-navy-850 block truncate">
                    {currentUser.companyName || currentUser.username}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block" dir="ltr">
                    @{currentUser.username}
                  </span>
                </div>
              )}
            </div>

            {!isCollapsed && (
              <div className="flex items-center gap-0.5">
                {currentUser.role === 'super_admin' && (
                  <button
                    type="button"
                    onClick={onOpenSuperAdmin}
                    className="p-1 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors cursor-pointer"
                    title="بوابة السوبر أدمن"
                  >
                    <ShieldCheck size={14} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onOpenChangePassword}
                  className="p-1 text-slate-400 hover:text-navy-850 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  title="تغيير كلمة المرور"
                >
                  <KeyRound size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                      onLogout();
                    }
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Quick Tools Row (Settings + Expand if collapsed) */}
        <div className={`flex items-center gap-1 ${isCollapsed ? 'flex-col' : 'justify-between'}`}>
          {checkPermission('canAccessSettings') && (
            <button
              type="button"
              onClick={() => onNavigate('settings')}
              className={`flex items-center gap-2 py-1.5 px-2 text-slate-600 hover:text-navy-850 hover:bg-white rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                currentTab === 'settings' ? 'bg-primary-50 text-primary-700 font-bold border border-primary-100' : ''
              } ${
                isCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full'
              }`}
              title="إعدادات وضبط النظام"
            >
              <Settings size={16} className={currentTab === 'settings' ? 'text-primary-600' : 'text-slate-500'} />
              {!isCollapsed && <span>ضبط النظام</span>}
            </button>
          )}

          {isCollapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-navy-850 hover:bg-white rounded-xl transition-colors cursor-pointer"
              title="توسيع الشريط الجانبي"
            >
              <PanelRightOpen size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
