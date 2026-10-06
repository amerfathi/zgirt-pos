import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import SaleScreen from './components/SaleScreen';
import InvoicesHistory from './components/InvoicesHistory';
import PurchasesView from './components/PurchasesView';
import CustomersView from './components/CustomersView';
import ProductsManagement from './components/ProductsManagement';
import DamagedItemsView from './components/DamagedItemsView';
import WorkersPayrollView from './components/WorkersPayrollView';
import ExpensesView from './components/ExpensesView';
import ReportsCenterView from './components/ReportsCenterView';
import StoreAuditView from './components/StoreAuditView';
import PartnersEquityView from './components/PartnersEquityView';
import MobileHomeHub from './components/MobileHomeHub';
import BottomNav from './components/BottomNav';
import InvoiceReceiptModal from './components/InvoiceReceiptModal';
import A4InvoiceModal from './components/A4InvoiceModal';
import { App as CapApp } from '@capacitor/app';
import LoginView from './components/LoginView';
import DesktopLoginView from './components/DesktopLoginView';
import SplashScreen from './components/SplashScreen';
import MarketingLandingPage from './components/MarketingLandingPage';
import ChangePasswordModal from './components/ChangePasswordModal';
import SuperAdminPortal from './components/SuperAdminPortal';
import BranchesManagementModal from './components/BranchesManagementModal';
import UpdateNotificationModal from './components/UpdateNotificationModal';
import { BRRAKA_LOGO } from './assets/branding';
import DesktopUpdateModal from './components/DesktopUpdateModal';
import { checkLatestRelease } from './services/releaseService';
import { getClientPlatform } from './config/appVersion';
import DesktopSidebar, { TAB_PERMISSION_MAP } from './components/DesktopSidebar';
import SettingsView from './components/SettingsView';
import ErrorBoundary from './components/ErrorBoundary';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { 
  Settings, ShieldCheck, Smartphone, Printer, FileText, 
  ShoppingCart, Truck, Users, Package, AlertOctagon, UserCheck, PieChart,
  TrendingDown, ArrowRight, Scale, Coins, LayoutGrid, Minus, Square, X, Sparkles,
  LogOut, KeyRound, Lock, Building2, Store, ChevronDown, Check,
  PanelRightClose, PanelRightOpen, ArrowUpCircle, Bell
} from 'lucide-react';

const NAV_GROUPS = [
  {
    id: 'sales',
    label: 'المبيعات والعملاء',
    shortLabel: 'المبيعات والعملاء',
    icon: ShoppingCart,
    defaultTab: 'sale',
    tabs: [
      { id: 'sale', label: 'نقطة البيع والميزان', shortLabel: 'نقطة البيع والميزان', icon: ShoppingCart },
      { id: 'invoices', label: 'سجل الفواتير', shortLabel: 'سجل الفواتير', icon: FileText },
      { id: 'customers', label: 'العملاء والديون', shortLabel: 'العملاء والديون', icon: Users },
    ]
  },
  {
    id: 'inventory',
    label: 'التوريد والمخزون',
    shortLabel: 'التوريد والمخزون',
    icon: Truck,
    defaultTab: 'purchases',
    tabs: [
      { id: 'purchases', label: 'المشتريات والموردين', shortLabel: 'المشتريات والموردين', icon: Truck },
      { id: 'products', label: 'الأصناف والأسعار', shortLabel: 'الأصناف والأسعار', icon: Package },
      { id: 'damaged', label: 'التوالف والهالك', shortLabel: 'التوالف والهالك', icon: AlertOctagon },
    ]
  },
  {
    id: 'operations',
    label: 'المصروفات والتشغيل',
    shortLabel: 'المصروفات والتشغيل',
    icon: TrendingDown,
    defaultTab: 'expenses',
    tabs: [
      { id: 'expenses', label: 'المصروفات اليومية', shortLabel: 'المصروفات', icon: TrendingDown },
      { id: 'workers', label: 'الموظفون والرواتب', shortLabel: 'الموظفون والرواتب', icon: UserCheck },
    ]
  },
  {
    id: 'finance',
    label: 'المالية والجرد والأرباح',
    shortLabel: 'المالية والجرد والأرباح',
    icon: Scale,
    defaultTab: 'audit',
    tabs: [
      { id: 'audit', label: 'الجرد والسيولة ومطابقة الدرج', shortLabel: 'الجرد والسيولة', icon: Scale },
      { id: 'partners', label: 'الشركاء والمسحوبات والأرباح', shortLabel: 'الشركاء والأرباح', icon: Coins },
      { id: 'reports', label: 'التقارير', shortLabel: 'التقارير', icon: PieChart },
    ]
  },
  {
    id: 'settings_group',
    label: 'الضبط والتخصيص',
    shortLabel: 'الضبط والتخصيص',
    icon: Settings,
    defaultTab: 'settings',
    tabs: [
      { id: 'settings', label: 'إعدادات وضبط النظام', shortLabel: 'ضبط النظام', icon: Settings },
    ]
  }
];

const getCategoryForTab = (tabId) => {
  for (const group of NAV_GROUPS) {
    if (group.tabs.some(t => t.id === tabId)) {
      return group.id;
    }
  }
  return 'sales';
};

const TAB_TITLES = {
  home: 'الرئيسية',
  sale: 'نقطة البيع والميزان',
  invoices: 'سجل الفواتير',
  purchases: 'المشتريات والموردين والديون',
  customers: 'العملاء والديون',
  audit: 'جرد المحل والسيولة ومطابقة الدرج',
  partners: 'حسابات الشركاء والمسحوبات والأرباح',
  expenses: 'المصروفات واليوميات',
  workers: 'الموظفون والرواتب',
  damaged: 'التوالف والهالك',
  products: 'الأصناف والأسعار',
  reports: 'التقارير',
  settings: 'إعدادات وضبط النظام الشاملة',
};

// Natural mobile transition animations (iOS / Android style)
/** @type {import('framer-motion').Variants} */
const pageVariants = {
  initial: (direction) => ({
    opacity: 0,
    x: direction > 0 ? 30 : -30,
    scale: 0.99
  }),
  animate: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      duration: 0.18,
      ease: [0.25, 1, 0.5, 1]
    }
  },
  exit: (direction) => ({
    opacity: 0,
    x: direction > 0 ? -30 : 30,
    scale: 0.99,
    transition: {
      duration: 0.1,
      ease: [0.25, 1, 0.5, 1]
    }
  })
};

export default function App() {
  const prefersReducedMotion = useReducedMotion();
  const store = useAppStore();
  const { 
    settings, 
    currentUser, 
    logout,
    branches,
    activeBranchId,
    activeBranch,
    changeActiveBranch
  } = store;

  // On initial load: if URL param ?tab= is present, use it; otherwise if mobile screen width (< 768px), default to 'home', otherwise 'sale'
  const [currentTab, setCurrentTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam && TAB_TITLES[tabParam]) {
        return tabParam;
      }
      if (window.innerWidth < 768) {
        return 'home';
      }
    }
    return 'sale';
  });

  // 5-Second Brand Splash Screen on App Launch
  const [showSplash, setShowSplash] = useState(true);
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState(null);
  const handleArchiveConflictingCache = async () => {
    if (!window.confirm('سيحفظ براكه النسخة المحلية المختلفة كاملة في أرشيف استرداد داخل هذا الجهاز، ثم يفتح السجل الدائم. إذا كانت بها حركات لم تصل إلى الخادم فستحتاج إلى مراجعة الأرشيف لاحقًا. هل تريد المتابعة؟')) return;
    setRecoveryBusy(true);
    setRecoveryError(null);
    try { await store.archiveConflictingCache(); }
    catch (error) { setRecoveryError(error.message); setRecoveryBusy(false); }
  };

  // Navigation history stack for mobile back button + direction tracking
  const [navHistory, setNavHistory] = useState(['home']);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  
  // Modals for invoices, SaaS and Branches
  const [a4Invoice, setA4Invoice] = useState(null);
  const [receiptInvoice, setReceiptInvoice] = useState(null);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(false);
  const [isBranchesOpen, setIsBranchesOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [initialReportType, setInitialReportType] = useState('sales');
  const [initialPartnerReportId, setInitialPartnerReportId] = useState('');

  // Multi-Platform Release & Update Center State
  const [isWebLoginModalOpen, setIsWebLoginModalOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('login') === 'true' || window.location.hash === '#login' || window.location.pathname.includes('/login');
    }
    return false;
  });
  const [updateInfo, setUpdateInfo] = useState(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [isDesktopDownloadModalOpen, setIsDesktopDownloadModalOpen] = useState(false);

  // Cloudflare sync status; an online device may still have a stale inbound view.
  const [syncStatus, setSyncStatus] = useState({ status: 'idle', error: '', isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true, queueLength: 0, lastSyncTime: 0 });
  useEffect(() => {
    if (store.syncService?.subscribe) {
      const unsub = store.syncService.subscribe(update => setSyncStatus(previous => ({ ...previous, ...update })));
      return unsub;
    }
  }, [store.syncService]);

  // Native Android Hardware & Gesture Back Button Handler
  useEffect(() => {
    let backListener = null;
    const bindAndroidBack = async () => {
      try {
        backListener = await CapApp.addListener('backButton', () => {
          const overlayBack = new Event('braka:ui-back', { cancelable: true });
          if (!window.dispatchEvent(overlayBack)) return;
          if (a4Invoice) { setA4Invoice(null); return; }
          if (receiptInvoice) { setReceiptInvoice(null); return; }
          if (isChangePasswordOpen) { setIsChangePasswordOpen(false); return; }
          if (isBranchesOpen) { setIsBranchesOpen(false); return; }
          if (isSuperAdminOpen) { setIsSuperAdminOpen(false); return; }
          if (isUpdateModalOpen) { setIsUpdateModalOpen(false); return; }
          if (isBranchDropdownOpen) { setIsBranchDropdownOpen(false); return; }

          if (currentTab !== 'home') {
            handleGoBack();
            return;
          }

          CapApp.exitApp();
        });
      } catch (e) {
        // Fallback or non-capacitor context
      }
    };
    bindAndroidBack();
    return () => {
      if (backListener?.remove) backListener.remove();
    };
  }, [
    a4Invoice, receiptInvoice, isChangePasswordOpen, isBranchesOpen, 
    isSuperAdminOpen, isUpdateModalOpen, isBranchDropdownOpen, currentTab, navHistory
  ]);

  useEffect(() => {
    // Only check and notify updates on native platforms (Desktop Electron and Mobile Capacitor)
    // The Web platform is updated continuously and immediately via Edge CDN / Service Worker
    const checkForUpdates = async () => {
      try {
        const platform = getClientPlatform();
        if (platform === 'web') return;

        const res = await checkLatestRelease();
        if (res && res.isUpdateAvailable) {
          setUpdateInfo(res);
          // Required updates immediately lock and show modal
          if (res.updateType === 'required') {
            setIsUpdateModalOpen(true);
          } else {
            // Check session storage so recommended/optional update isn't constantly re-prompting every reload
            const dismissed = sessionStorage.getItem('dismissed_update_' + res.latestVersion);
            if (!dismissed) {
              setIsUpdateModalOpen(true);
            }
          }
        }
      } catch (err) {
        console.warn('Native release check error:', err);
      }
    };

    checkForUpdates();
  }, []);

  // Dynamic Global Font Scaling (ضبط حجم خطوط وشاشات البرنامج ديناميكياً عبر السلايدر)
  useEffect(() => {
    const scale = Number(settings?.fontSizeScale) || 100;
    const rootFontSize = `${(scale / 100) * 16}px`;
    document.documentElement.style.fontSize = rootFontSize;
  }, [settings?.fontSizeScale]);

  // PWA Install prompt handling
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setCanInstall(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert('لتثبيت التطبيق على هاتفك:\nفي متصفح كروم اضغط على القائمة (⋮) ثم "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).\nفي متصفح سفاري (آيفون) اضغط زر المشاركة ثم "إضافة إلى الصفحة الرئيسية".');
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setCanInstall(false);
    }
    setDeferredPrompt(null);
  };

  const handleNavigate = (tabId) => {
    if (tabId !== 'home') {
      const permKey = TAB_PERMISSION_MAP?.[tabId];
      if (permKey && store.hasPermission && !store.hasPermission(permKey)) {
        alert('عذراً، ليس لديك صلاحية الوصول إلى هذا القسم. يرجى مراجعة إدارة المحل.');
        return;
      }
    }
    if (tabId !== currentTab) {
      setDirection(1);
      setNavHistory(prev => [...prev, tabId]);
      setCurrentTab(tabId);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  };

  // Refresh the tenant cursor when a financial surface or branch becomes active.
  // The service coalesces rapid navigation and never throttles outbound events.
  useEffect(() => {
    if (!currentUser || !store?.syncService || currentTab === 'home' || currentTab === 'settings') return;
    void store.syncService.refreshForActivity();
  }, [currentUser?.tenantId, currentTab, store.activeBranchId]);

  // Guard active tab against unauthorized roles
  useEffect(() => {
    if (currentUser && currentTab !== 'home') {
      const permKey = TAB_PERMISSION_MAP?.[currentTab];
      if (permKey && store.hasPermission && !store.hasPermission(permKey)) {
        if (store.hasPermission('canSell')) {
          setCurrentTab('sale');
        } else if (store.hasPermission('canViewInvoices')) {
          setCurrentTab('invoices');
        } else {
          setCurrentTab('home');
        }
      }
    }
  }, [currentTab, currentUser]);

  const handleGoBack = () => {
    setDirection(-1);
    if (navHistory.length > 1) {
      const newHistory = [...navHistory];
      newHistory.pop();
      const previousTab = newHistory[newHistory.length - 1] || 'home';
      setNavHistory(newHistory);
      setCurrentTab(previousTab);
    } else {
      setCurrentTab('home');
      setNavHistory(['home']);
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const [isElectron, setIsElectron] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && (window.electronAPI?.isElectron || window.navigator.userAgent.includes('Electron'))) {
      setIsElectron(true);
      if (window.electronAPI?.isMaximized) {
        window.electronAPI.isMaximized().then(setIsMaximized).catch(() => {});
      }
    }
  }, []);

  const handleWindowMinimize = () => {
    if (window.electronAPI?.minimize) {
      window.electronAPI.minimize();
    }
  };

  const handleWindowMaximize = async () => {
    if (window.electronAPI?.maximize) {
      window.electronAPI.maximize();
      const max = await window.electronAPI.isMaximized().catch(() => false);
      setIsMaximized(max);
    }
  };

  const handleWindowClose = () => {
    if (window.electronAPI?.close) {
      window.electronAPI.close();
    }
  };

  const handleOpenA4Report = (type) => {
    setInitialReportType(type);
    handleNavigate('reports');
  };

  // Brief visual transition while the application mounts.
  if (showSplash) {
    return (
      <AnimatePresence>
        <SplashScreen onFinish={() => setShowSplash(false)} duration={1200} />
      </AnimatePresence>
    );
  }

  // If not authenticated, route based on product platform surface
  if (!currentUser) {
    const platform = getClientPlatform();
    
    // 1. Desktop App (Electron / Windows): Dedicated Native Desktop Login
    if (platform === 'windows') {
      return <DesktopLoginView store={store} />;
    }

    // 2. Mobile App (Capacitor / Android / iOS) or Mobile Viewport: Fast Native Mobile Login
    const isMobileDevice = platform === 'android' || platform === 'ios' || (typeof window !== 'undefined' && (window.innerWidth < 768 || /android|iphone|ipad|mobile/i.test(navigator.userAgent)));
    if (isMobileDevice) {
      return <LoginView store={store} />;
    }

    // 3. Web Platform: Enterprise SaaS Marketing Landing Page with Login Trigger
    if (isWebLoginModalOpen) {
      return (
        <LoginView 
          store={store} 
          onClose={() => {
            setIsWebLoginModalOpen(false);
            if (window.history.pushState) {
              window.history.pushState({}, '', window.location.pathname);
            }
          }} 
        />
      );
    }

    return (
      <MarketingLandingPage 
        store={store} 
        onOpenLogin={() => {
          setIsWebLoginModalOpen(true);
          if (window.history.pushState) {
            window.history.pushState({}, '', '?login=true');
          }
        }} 
      />
    );
  }

  if (!store.persistence.ready || store.persistence.error) {
    return <main dir="rtl" className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 bg-slate-50">
      <h1 className="text-xl font-bold">حماية بيانات براكه</h1>
      <p role="alert">{store.persistence.error || 'جارٍ فتح التخزين الآمن…'}</p>
      <p>لا تحذف بيانات المتصفح. عند فشل الحفظ لم تُعتمد تغييرات جزئية للحركة.</p>
      {store.persistence.error?.includes('نسخة محلية أحدث أو مختلفة') &&
        ['company_owner', 'admin', 'super_admin'].includes(currentUser.role) &&
        <button disabled={recoveryBusy} className="px-4 py-2 bg-blue-700 text-white rounded disabled:opacity-50"
          onClick={handleArchiveConflictingCache}>
          {recoveryBusy ? 'جارٍ حفظ نسخة الاسترداد…' : 'حفظ النسخة المحلية المختلفة والمتابعة بالسجل الدائم'}
        </button>}
      {recoveryError && <p role="alert">{recoveryError}</p>}
      <button className="px-4 py-2 bg-emerald-700 text-white rounded" onClick={() => window.location.reload()}>إعادة الفتح والمحاولة</button>
      <button onClick={store.logout}>تسجيل الخروج</button>
    </main>;
  }

  const isSubPageOnMobile = currentTab !== 'home';

  return (
    <div className="braka-workspace min-h-screen bg-[#f8fafc] text-slate-800 flex flex-row selection:bg-primary-500 selection:text-white relative overflow-x-hidden font-sans">
      {store.inboundReview?.length > 0 && <aside role="alert" className="fixed bottom-3 left-3 right-3 z-[100] rounded-xl border border-primary-200 bg-white p-4 text-sm text-navy-850 shadow-lg" dir="rtl">
        <p>وصلت البيانات الجديدة، لكن توجد {store.inboundReview.length} مجموعة سجلات تحتاج مراجعة. حُفظت كاملة دون تطبيق جزئي؛ الأرصدة والتقارير غير مكتملة ولا تُعتمد حتى معالجة السبب.</p>
        <details><summary>تفاصيل السجلات المتعثرة</summary>
          {store.inboundReview.map(group => <p key={group.key}>{group.events.map(event => `${event.entityType}: ${event.entityId}`).join('، ')} — {group.error}</p>)}
        </details>
        <button className="mt-2 underline" onClick={store.exportInboundRecoveryJSON}>حفظ ملف الاسترداد الكامل على الجهاز</button>
      </aside>}
      
      {/* 1. Desktop Vertical Sidebar (RTL: right side) */}
      <DesktopSidebar 
        currentTab={currentTab}
        onNavigate={handleNavigate}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        currentUser={currentUser}
        activeBranch={activeBranch}
        branches={branches}
        onChangeBranch={changeActiveBranch}
        canViewAllBranches={store.canViewAllBranches}
        onOpenBranchesModal={() => setIsBranchesOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        onOpenSettings={() => handleNavigate('settings')}
        onLogout={logout}
        settings={settings}
        hasPermission={store.hasPermission}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-x-hidden">
        
        {/* Top Header (Mobile View + Slim Desktop Bar) */}
        <header 
          style={{ WebkitAppRegion: 'drag' }}
          className="sticky top-0 z-20 bg-white/95 backdrop-blur-md text-slate-800 shadow-xs border-b border-slate-200/80 print:hidden w-full select-none"
        >
          {/* A. Mobile Top Bar (< md) */}
          <div className="md:hidden w-full px-3 py-2 pt-safe flex items-center justify-between gap-1.5 touch-action-manipulation">
            <div 
              style={{ WebkitAppRegion: 'no-drag' }}
              className="flex items-center gap-1.5 shrink-0 min-w-0"
            >
              {isSubPageOnMobile ? (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  type="button"
                  onClick={handleGoBack}
                  className="flex items-center gap-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer select-none"
                  title="الرجوع للرئيسية"
                >
                  <ArrowRight size={15} className="text-slate-700" />
                  <span>رجوع</span>
                </motion.button>
              ) : (
                <img 
                  src={BRRAKA_LOGO} 
                  alt="براكه" 
                  className="w-8 h-8 rounded-xl object-contain shadow-xs shrink-0" 
                />
              )}

              {/* Shop Name & Subtitle */}
              <div className="truncate max-w-[110px] sm:max-w-[140px]">
                <span className="font-bold text-xs text-navy-850 truncate block">
                  {settings.shopName || 'براكه'}
                </span>
                <span className="text-[10px] text-slate-400 truncate block">
                  {settings.subTitle || 'نقطة بيع سحابية'}
                </span>
              </div>

              {/* Mobile Branch Switcher Chip */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                  className="flex items-center gap-1 px-2 py-1 bg-slate-50 hover:bg-slate-100 text-navy-850 border border-slate-200/90 rounded-lg text-[11px] font-semibold transition-all shadow-2xs cursor-pointer"
                  title="الفرع النشط"
                >
                  <Store size={12} className="text-primary-500 shrink-0" />
                  <span className="truncate max-w-[65px]">
                    {activeBranch?.name || 'الرئيسي'}
                  </span>
                  <ChevronDown size={11} className="text-slate-400 shrink-0" />
                </button>

                {/* Branch Dropdown Popover */}
                {isBranchDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsBranchDropdownOpen(false)} 
                    />
                    <div className="absolute top-full right-0 mt-1.5 w-60 bg-white rounded-2xl shadow-xl border border-slate-200/90 p-2 z-50 animate-in fade-in zoom-in-95 duration-150">
                      <div className="px-2.5 py-1.5 border-b border-slate-100 flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-navy-850">الفرع الحالي:</span>
                        <span className="text-[10px] text-slate-400 font-mono">{branches.length} فروع</span>
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-1">
                        {store.canViewAllBranches && <button type="button"
                          onClick={async () => { try { await changeActiveBranch('all'); setIsBranchDropdownOpen(false); }
                            catch (error) { alert('تعذر عرض الفروع: ' + error.message); } }}
                          className="w-full text-right px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary-700 hover:bg-primary-50">
                          كل الفروع — عرض مجمع فقط
                        </button>}
                        {branches.map(b => {
                          const isSel = b.id === activeBranchId;
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={async () => {
                                try {
                                  await changeActiveBranch(b.id);
                                  setIsBranchDropdownOpen(false);
                                } catch (error) { alert('تعذر تغيير الفرع النشط: ' + error.message); }
                              }}
                              className={`w-full text-right px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center justify-between transition-colors cursor-pointer ${
                                isSel 
                                  ? 'bg-primary-50 text-primary-700 font-semibold' 
                                  : 'text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              <div className="truncate pl-2">
                                <span className="block truncate">{b.name}</span>
                              </div>
                              {isSel && <Check size={14} className="text-primary-600 shrink-0" />}
                            </button>
                          );
                        })}
                      </div>

                      <div className="pt-2 mt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIsBranchDropdownOpen(false);
                            setIsBranchesOpen(true);
                          }}
                          className="w-full py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-200/70"
                        >
                          <Building2 size={13} className="text-primary-500" />
                          <span>إدارة الفروع</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Middle: Cloud Sync Indicator Pill */}
            <div 
              role={syncStatus.status === 'error' ? 'alert' : 'status'}
              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border shrink-0"
              style={{
                backgroundColor: !syncStatus.isOnline || syncStatus.status === 'error' ? '#fef2f2' : (syncStatus.queueLength > 0 ? '#fefce8' : '#f0fdf4'),
                borderColor: !syncStatus.isOnline || syncStatus.status === 'error' ? '#fecaca' : (syncStatus.queueLength > 0 ? '#fef08a' : '#bbf7d0'),
                color: !syncStatus.isOnline || syncStatus.status === 'error' ? '#991b1b' : (syncStatus.queueLength > 0 ? '#854d0e' : '#166534')
              }}
              title={syncStatus.status === 'error' ? syncStatus.error : !syncStatus.isOnline ? 'وضع عدم الاتصال (أوفلاين)' : (syncStatus.queueLength > 0 ? `توجد ${syncStatus.queueLength} حركة محلية لم تُرفع؛ راجع حالة المزامنة` : syncStatus.lastSyncTime ? `لا توجد عمليات معلقة. آخر تحقق من السحابة: ${new Date(syncStatus.lastSyncTime).toLocaleString('ar-SA')}` : 'الاتصال متاح؛ لم يكتمل التحقق من أحدث البيانات بعد')}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${!syncStatus.isOnline || syncStatus.status === 'error' ? 'bg-rose-500' : (syncStatus.queueLength > 0 ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500')}`} />
              <span className="hidden sm:inline">
                {syncStatus.status === 'error' ? (syncStatus.error?.includes('تعارض') ? 'تعارض مزامنة' : 'خطأ مزامنة') : !syncStatus.isOnline ? 'أوفلاين' : (syncStatus.queueLength > 0 ? `${syncStatus.queueLength} معلق` : 'متصل')}
              </span>
            </div>

            {/* Left: Settings & Logout Actions */}
            <div 
              style={{ WebkitAppRegion: 'no-drag' }}
              className="flex items-center gap-1 shrink-0"
            >
              {(!store.hasPermission || store.hasPermission('canAccessSettings')) && (
                <button
                  type="button"
                  onClick={() => handleNavigate('settings')}
                  className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                    currentTab === 'settings'
                      ? 'text-primary-700 bg-primary-50 border border-primary-200 shadow-2xs font-bold'
                      : 'text-slate-500 hover:text-navy-850 hover:bg-slate-100'
                  }`}
                  title="إعدادات وضبط النظام"
                >
                  <Settings size={18} />
                </button>
              )}
              {currentUser && (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('هل أنت متأكد من تسجيل الخروج؟')) {
                      logout();
                    }
                  }}
                  className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                  title="تسجيل الخروج"
                >
                  <LogOut size={18} />
                </button>
              )}
            </div>
          </div>

          {/* B. Desktop Slim Top Bar (>= md) */}
          <div className="hidden md:flex w-full px-4 sm:px-6 py-2 items-center justify-between gap-4">
            
            {/* Right: Toggle Sidebar + Breadcrumbs */}
            <div 
              style={{ WebkitAppRegion: 'no-drag' }}
              className="flex items-center gap-3"
            >
              <button
                type="button"
                onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                className="p-1.5 text-slate-500 hover:text-navy-850 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer border border-slate-200/80 shadow-2xs"
                title={isSidebarCollapsed ? "توسيع القائمة الجانبية" : "طي القائمة الجانبية"}
              >
                {isSidebarCollapsed ? <PanelRightOpen size={16} /> : <PanelRightClose size={16} />}
              </button>

              <div className="flex items-center gap-2 text-xs font-semibold">
                {currentTab === 'home' ? (
                  <span className="text-navy-850 font-bold flex items-center gap-1.5">
                    <LayoutGrid size={15} className="text-primary-500" />
                    <span>لوحة التحكم الرئيسية</span>
                  </span>
                ) : (
                  <div className="flex items-center gap-1.5 text-slate-500">
                    <span className="font-medium text-slate-500">
                      {NAV_GROUPS.find(g => g.id === getCategoryForTab(currentTab))?.label}
                    </span>
                    <span className="text-slate-300">/</span>
                    <span className="text-navy-850 font-bold bg-slate-100/90 px-2 py-0.5 rounded-lg border border-slate-200/70">
                      {TAB_TITLES[currentTab]}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Left: Window Controls & Optional PWA Install */}
            <div 
              style={{ WebkitAppRegion: 'no-drag' }}
              className="flex items-center gap-2 shrink-0"
            >
              {canInstall && (
                <button
                  type="button"
                  onClick={handleInstallApp}
                  className="px-2.5 sm:px-3 py-1.5 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-medium rounded-xl flex items-center gap-1.5 border border-slate-200/90 transition-all cursor-pointer shadow-2xs"
                  title="تثبيت كتطبيق"
                >
                  <Smartphone size={14} className="text-slate-500" />
                  <span>تثبيت التطبيق</span>
                </button>
              )}

              {/* Frameless Integrated Window Control Buttons (Electron) */}
              {isElectron && (
                <div className="flex items-center gap-0.5 mr-1 pr-2 border-r border-slate-200">
                  <button
                    type="button"
                    onClick={handleWindowMinimize}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title="تصغير"
                  >
                    <Minus size={15} />
                  </button>
                  <button
                    type="button"
                    onClick={handleWindowMaximize}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                    title={isMaximized ? "استعادة" : "تكبير"}
                  >
                    <Square size={13} />
                  </button>
                  <button
                    type="button"
                    onClick={handleWindowClose}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:text-white hover:bg-rose-600 transition-colors"
                    title="إغلاق"
                  >
                    <X size={15} />
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

      {/* Main View Area with Smooth Animated Screen Transitions */}
      <main className="flex-1 w-full max-w-[1650px] mx-auto overflow-hidden relative z-10">
        <ErrorBoundary key={currentTab} onReset={() => setCurrentTab('sale')}>
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentTab}
              custom={direction}
              variants={prefersReducedMotion ? {
                initial: { opacity: 1, x: 0, scale: 1 },
                animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0 } },
                exit: { opacity: 1, x: 0, scale: 1, transition: { duration: 0 } }
              } : pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className="w-full"
            >
              {/* Direct Route / Tab Authorization Guard */}
              {(() => {
                const requiredPerm = TAB_PERMISSION_MAP?.[currentTab];
                const isAuthorized = currentTab === 'home' || !requiredPerm || (store.hasPermission ? store.hasPermission(requiredPerm) : true);

                if (!isAuthorized) {
                  return (
                    <div className="flex flex-col items-center justify-center min-h-[50vh] p-8 text-center bg-white rounded-3xl border border-rose-100 shadow-sm mx-auto max-w-lg mt-8">
                      <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4 shadow-sm border border-rose-200">
                        <Lock className="w-8 h-8" />
                      </div>
                      <h2 className="text-xl font-black text-slate-800 mb-2">عذراً، هذا القسم غير مصرح لك بدخوله</h2>
                      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                        حسابك الحالي لا يمتلك الصلاحيات الكافية للوصول إلى هذا القسم ({TAB_TITLES[currentTab] || currentTab}). يرجى مراجعة إدارة المحل.
                      </p>
                      <button
                        onClick={() => handleNavigate(store.hasPermission?.('canSell') ? 'sale' : 'home')}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2"
                      >
                        <ShoppingCart className="w-4 h-4" />
                        العودة للقسم المتاح
                      </button>
                    </div>
                  );
                }

                if (store.inboundReview?.length && ['reports','audit'].includes(currentTab)) {
                  return <section role="alert" dir="rtl" className="rounded-xl border border-primary-200 bg-white p-6">
                    لا يمكن اعتماد التقارير المالية قبل معالجة السجلات المتعثرة. السجلات محفوظة؛ يمكنك متابعة عرض الأصناف وحفظ ملف الاسترداد.
                  </section>;
                }

                return (
                  <>
                    {/* Mobile Home Hub: 3-column Grid of All Major Sections */}
                    {currentTab === 'home' && (
                      <MobileHomeHub 
                        store={store}
                        onNavigate={handleNavigate}
                        onOpenSettings={() => handleNavigate('settings')}
                      />
                    )}

                    {/* Point of Sale Screen */}
                    {currentTab === 'sale' && (
                      <SaleScreen 
                        store={store} 
                        onViewReceipt={(inv) => setReceiptInvoice(inv)}
                        onViewA4Invoice={(inv) => setA4Invoice(inv)}
                        onOpenNewCustomerModal={() => handleNavigate('customers')}
                        onOpenSettings={() => handleNavigate('settings')}
                        onNavigate={handleNavigate}
                      />
                    )}

                    {currentTab === 'invoices' && (
                      <InvoicesHistory 
                        store={store} 
                        onViewReceipt={(inv) => setReceiptInvoice(inv)}
                        onViewA4Invoice={(inv) => setA4Invoice(inv)}
                      />
                    )}

                    {currentTab === 'purchases' && (
                      <PurchasesView 
                        store={store} 
                        onOpenA4Report={handleOpenA4Report}
                      />
                    )}

                    {currentTab === 'customers' && (
                      <CustomersView 
                        store={store} 
                        onSelectCustomerForInvoice={() => {
                          handleNavigate('sale');
                        }}
                        onOpenCustomerStatement={(customerId) => {
                          setInitialReportType('customer');
                          handleNavigate('reports');
                        }}
                      />
                    )}

                    {currentTab === 'audit' && (
                      <StoreAuditView 
                        store={store} 
                        onOpenA4Report={handleOpenA4Report}
                      />
                    )}

                    {currentTab === 'partners' && (
                      <PartnersEquityView 
                        store={store} 
                        onOpenPartnerStatement={(partnerId) => {
                          setInitialPartnerReportId(partnerId);
                          handleOpenA4Report('partners');
                        }}
                      />
                    )}

                    {currentTab === 'expenses' && (
                      <ExpensesView store={store} />
                    )}

                    {currentTab === 'damaged' && (
                      <DamagedItemsView 
                        store={store} 
                        onOpenA4Report={handleOpenA4Report}
                      />
                    )}

                    {currentTab === 'workers' && (
                      <WorkersPayrollView 
                        store={store} 
                        onOpenA4Report={handleOpenA4Report}
                      />
                    )}

                    {currentTab === 'products' && (
                      <ProductsManagement store={store} />
                    )}

                    {currentTab === 'reports' && (
                      <ReportsCenterView 
                        store={store} 
                        initialReportType={initialReportType}
                        initialPartnerId={initialPartnerReportId}
                      />
                    )}

                    {currentTab === 'settings' && (
                      <SettingsView 
                        store={store} 
                        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
                        onOpenBranchesModal={() => setIsBranchesOpen(true)}
                      />
                    )}
                  </>
                );
              })()}
            </motion.div>
          </AnimatePresence>
        </ErrorBoundary>
      </main>

      {/* Bottom Navigation Bar (5 Core Quick Actions & Native Android Drawer) */}
      <BottomNav 
        currentTab={currentTab} 
        onChangeTab={handleNavigate} 
        cartCount={store?.cart?.length || 0}
        hasPermission={store.hasPermission}
        onLogout={logout}
        currentUser={currentUser}
        activeBranch={activeBranch}
      />
      </div>

      {/* 1. Official A4 Invoice Modal */}
      <A4InvoiceModal
        isOpen={!!a4Invoice}
        onClose={() => setA4Invoice(null)}
        invoice={a4Invoice}
        settings={settings}
        onUpdateInvoiceNotes={store.updateInvoiceNotes}
        onSwitchToThermal={() => {
          const inv = a4Invoice;
          setA4Invoice(null);
          setReceiptInvoice(inv);
        }}
      />

      {/* 2. Thermal Receipt Modal */}
      <InvoiceReceiptModal 
        isOpen={!!receiptInvoice}
        onClose={() => setReceiptInvoice(null)}
        invoice={receiptInvoice}
        settings={settings}
        onUpdateInvoiceNotes={store.updateInvoiceNotes}
      />

      {/* 4. Client Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        store={store}
      />

      {/* 5. SaaS Super Admin Portal */}
      <SuperAdminPortal
        isOpen={isSuperAdminOpen}
        onClose={() => setIsSuperAdminOpen(false)}
        store={store}
        onSwitchToStore={() => setIsSuperAdminOpen(false)}
      />

      {/* 6. Multi-Branch & Stock Transfer Management Modal */}
      <BranchesManagementModal
        isOpen={isBranchesOpen}
        onClose={() => setIsBranchesOpen(false)}
        store={store}
      />

      {/* 7. Multi-Platform Update Notification Modal */}
      <UpdateNotificationModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        updateInfo={updateInfo}
        onApplyUpdate={() => {
          if (getClientPlatform() === 'windows') {
            setIsUpdateModalOpen(false);
            setIsDesktopDownloadModalOpen(true);
          } else if (updateInfo?.downloadUrl) {
            window.open(updateInfo.downloadUrl, '_blank');
          }
        }}
      />

      {/* 8. Desktop In-App Silent Download & Install Engine */}
      <DesktopUpdateModal
        isOpen={isDesktopDownloadModalOpen}
        onClose={() => setIsDesktopDownloadModalOpen(false)}
        releaseInfo={updateInfo}
        cartItemsCount={store?.cart?.length || 0}
      />

    </div>
  );
}
