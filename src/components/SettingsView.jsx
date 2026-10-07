import React, { useState, useEffect, useRef } from 'react';
import { 
  Building2, Receipt, Scale, PackageCheck, Cloud, ShieldCheck, 
  Save, Check, Download, Upload, RefreshCw, AlertCircle, Store, 
  Phone, MapPin, DollarSign, Printer, QrCode, FileText, Lock, 
  KeyRound, HelpCircle, Layers, CheckCircle2, ChevronLeft, ArrowRight,
  Database, Wifi, WifiOff, HardDrive, ShieldAlert, Users, Plus, 
  Trash2, Edit3, UserCheck, Key, Shield, UserX, ShieldBan, X,
  User, CheckSquare, Square as SquareIcon, Eye, EyeOff,
  ArrowUpCircle, Sparkles, Laptop, Type, Sliders, ZoomIn, ZoomOut, Copy
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ROLE_PERMISSIONS_PRESETS, DEFAULT_PERMISSIONS } from '../data/initialData';
import { APP_VERSION, APP_RELEASE_DATE, getClientPlatform } from '../config/appVersion';
import { checkLatestRelease } from '../services/releaseService';
import DesktopUpdateModal from './DesktopUpdateModal';
import ConflictReviewPanel from './ConflictReviewPanel';
import { resolveUserPermissions } from '../store/useAppStore';
import { getStoreDisplayAddress } from '../utils/storeDisplay';

export default function SettingsView({ 
  store, 
  onOpenChangePassword, 
  onOpenBranchesModal 
}) {
  const { 
    settings = {}, 
    updateSettings, 
    currentUser, 
    branches = [], 
    activeBranchId, 
    exportBackupJSON, 
    importBackupJSON, 
    syncService,
    backupStatus = { status: 'idle', error: null },
    users = [],
    addUser,
    updateUser,
    deleteUser,
    syncCloudUsers
  } = store;

  const [activeSubTab, setActiveSubTab] = useState('profile');
  const initialSettings = () => ({ ...settings, address: getStoreDisplayAddress(settings.address) });
  const [form, setForm] = useState(initialSettings);
  const previousSettings = useRef(initialSettings());
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isCloudSyncing, setIsCloudSyncing] = useState(false);
  const [cloudSyncMessage, setCloudSyncMessage] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ status: 'loading', isOnline: false, queueLength: null });

  // Users & Permissions Management State
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    phone: '',
    role: 'cashier',
    branchIds: [],
    status: 'active',
    permissions: { ...(ROLE_PERMISSIONS_PRESETS.cashier?.permissions || DEFAULT_PERMISSIONS) }
  });
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRefreshingUsers, setIsRefreshingUsers] = useState(false);

  const handleRefreshCloudUsers = async () => {
    if (typeof syncCloudUsers === 'function') {
      setIsRefreshingUsers(true);
      try {
        await syncCloudUsers(currentUser?.tenantId);
      } finally {
        setTimeout(() => setIsRefreshingUsers(false), 600);
      }
    }
  };

  // In-App Desktop Updates State
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [updateCheckStatus, setUpdateCheckStatus] = useState('idle');

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateCheckStatus('checking');
    try {
      const info = await checkLatestRelease();
      setReleaseInfo(info);
      setUpdateCheckStatus('checked');
      setIsUpdateModalOpen(true);
    } catch (e) {
      setUpdateCheckStatus('error');
    } finally {
      setIsCheckingUpdate(false);
    }
  };

  useEffect(() => {
    // Initial release info check
    checkLatestRelease().then(setReleaseInfo).catch(() => {});
  }, []);

  // Refresh untouched fields without discarding an in-progress edit when sync
  // publishes a new settings object (or changes another field).
  useEffect(() => {
    const incoming = { ...settings, address: getStoreDisplayAddress(settings.address) };
    const previous = previousSettings.current;
    setForm(current => {
      const merged = { ...incoming };
      for (const [key, value] of Object.entries(current)) {
        if (JSON.stringify(value) !== JSON.stringify(previous[key])) merged[key] = value;
      }
      return merged;
    });
    previousSettings.current = incoming;
  }, [settings]);

  // Subscribe to cloud sync service if available
  useEffect(() => {
    if (!syncService?.subscribe || !syncService?.getQueueLength) {
      setSyncStatus({ status: 'error', isOnline: false, queueLength: null });
      return undefined;
    }
    const unsub = syncService.subscribe(status => setSyncStatus(status));
    try {
      setSyncStatus({ status: 'idle', isOnline: syncService.isOnline, queueLength: syncService.getQueueLength() });
    } catch {
      setSyncStatus({ status: 'error', isOnline: syncService.isOnline, queueLength: null });
    }
    return unsub;
  }, [syncService, currentUser?.tenantId]);

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    try {
      await updateSettings(form);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) { alert('تعذر حفظ الإعدادات: ' + error.message); }
  };

  const handleManualCloudSync = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMessage(null);
    try {
      const result = await store.syncNow();
      if (!result.success) throw new Error(result.error || 'لم تكتمل المزامنة');
      setCloudSyncMessage({ type: 'success', text: 'اكتملت المزامنة السحابية بنجاح' });
    } catch (err) {
      setCloudSyncMessage({ type: 'error', text: 'تعذرت المزامنة. أعد المحاولة، وإذا استمرت المشكلة فتواصل مع الدعم.' });
    } finally {
      setIsCloudSyncing(false);
      setTimeout(() => setCloudSyncMessage(null), 4000);
    }
  };

  const handleCloudBackup = async () => {
    setIsCloudSyncing(true);
    setCloudSyncMessage(null);
    try {
      if (syncService && exportBackupJSON) {
        const fullBackup = store.getBackupSnapshot();
        const ok = await syncService.uploadBackupSnapshot(currentUser?.tenantId || 'tenant-demo', fullBackup);
        if (ok) {
          setCloudSyncMessage({ type: 'success', text: 'تم حفظ النسخة الاحتياطية السحابية' });
        } else {
          setCloudSyncMessage({ type: 'error', text: 'فشل حفظ النسخة السحابية' });
        }
      }
    } catch (err) {
      setCloudSyncMessage({ type: 'error', text: 'تعذر حفظ النسخة الاحتياطية. أعد المحاولة لاحقًا.' });
    } finally {
      setIsCloudSyncing(false);
      setTimeout(() => setCloudSyncMessage(null), 4000);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        try {
          const res = await importBackupJSON(content);
          if (res.success) alert('تم استيراد البيانات والنسخة بنجاح!');
          else alert('خطأ في استيراد النسخة: ' + res.error);
        } catch (error) { alert('تعذر استيراد النسخة: ' + error.message); }
      }
    };
    reader.readAsText(file);
  };

  // User Management Actions
  const handleOpenNewUser = () => {
    setEditingUser(null);
    setUserError('');
    setUserSuccess('');
    setShowPassword(false);
    setUserForm({
      name: '',
      username: '',
      password: '',
      phone: '',
      role: 'cashier',
      branchIds: activeBranchId ? [activeBranchId] : [],
      status: 'active',
      permissions: { ...(ROLE_PERMISSIONS_PRESETS.cashier?.permissions || DEFAULT_PERMISSIONS) }
    });
    setIsUserModalOpen(true);
  };

  const handleOpenEditUser = (u) => {
    setEditingUser(u);
    setUserError('');
    setUserSuccess('');
    setShowPassword(false);
    setUserForm({
      name: u.name || '',
      username: u.username || '',
      password: u.password || '',
      phone: u.phone || '',
      role: u.role || 'cashier',
      branchIds: u.branchIds || (u.branchId && u.branchId !== 'all' ? [u.branchId] : []),
      status: u.status || 'active',
      permissions: resolveUserPermissions(u)
    });
    setIsUserModalOpen(true);
  };

  const handleRolePresetChange = (newRole) => {
    if (newRole === 'custom') {
      setUserForm(prev => ({
        ...prev,
        role: 'custom'
      }));
      return;
    }
    const preset = ROLE_PERMISSIONS_PRESETS[newRole]?.permissions || DEFAULT_PERMISSIONS;
    setUserForm(prev => ({
      ...prev,
      role: newRole,
      permissions: { ...preset }
    }));
  };

  const handleTogglePermission = (key) => {
    setUserForm(prev => ({
      ...prev,
      role: 'custom',
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');

    try {
      if (!userForm.name.trim()) throw new Error('يرجى كتابة الاسم الكامل للمستخدم');
      if (!userForm.username.trim()) throw new Error('يرجى كتابة اسم المستخدم للدخول');
      if (!editingUser && !userForm.password.trim()) throw new Error('يرجى تعيين كلمة المرور');
      if (!userForm.branchIds.length) throw new Error('اختر فرعًا واحدًا على الأقل للمستخدم');

      if (editingUser) {
        await updateUser(editingUser.id, userForm);
        setUserSuccess('تم تحديث بيانات المستخدم والصلاحيات بنجاح!');
      } else {
        await addUser(userForm);
        setUserSuccess('تم إضافة المستخدم وتفعيل صلاحياته بنجاح!');
      }

      setTimeout(() => {
        setIsUserModalOpen(false);
        setUserSuccess('');
      }, 1000);
    } catch (err) {
      setUserError(err.message);
    }
  };

  const handleDeleteUserClick = async (u) => {
    if (u.id === currentUser?.id) {
      alert('لا يمكنك حذف الحساب المسجل به دخولك حالياً!');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف المستخدم (${u.name}) نهائياً؟ لن يتمكن من تسجيل الدخول بعد الآن.`)) {
      try {
        await deleteUser(u.id);
      } catch (err) {
        alert(err.message);
      }
    }
  };

  const handleToggleUserStatus = (u) => {
    if (u.id === currentUser?.id) {
      alert('لا يمكنك تعطيل حسابك الحالي!');
      return;
    }
    const newStatus = u.status === 'active' ? 'inactive' : 'active';
    void updateUser(u.id, { status: newStatus }).catch(err => alert(err.message));
  };

  const subTabs = [
    { id: 'profile', label: 'المنشأة والضرائب', icon: Building2, desc: 'الاسم التجاري، السجل، الرقم الضريبي' },
    { id: 'appearance', label: 'المظهر وحجم الخط', icon: Type, desc: 'سلايدر تكبير وتصغير نصوص وشاشات النظام' },
    { id: 'invoices', label: 'الفواتير والطباعة', icon: Receipt, desc: 'الطابعة الحرارية، المقاس، الترويسة والـ QR' },
    { id: 'scales', label: 'الميزان وسياسات البيع', icon: Scale, desc: 'الوزن الفارغ، دقة الجرام، خصومات الكاشير' },
    { id: 'inventory', label: 'المخزون والخزينة', icon: PackageCheck, desc: 'البيع على ذمة التوريد، عهدة الصندوق' },
    { id: 'users', label: 'المستخدمون والصلاحيات', icon: Users, desc: 'إدارة الكاشير، المحاسبين، وتعيين الصلاحيات' },
    { id: 'cloud', label: 'السحابة والنسخ الاحتياطي', icon: Cloud, desc: 'المزامنة والنسخ والاسترداد' },
    { id: 'security', label: 'الحساب والأمان', icon: ShieldCheck, desc: 'بيانات الاشتراك، كلمة المرور، الفروع' },
    { id: 'updates', label: 'التحديثات وإصدار النظام', icon: ArrowUpCircle, desc: 'إصدار v2.5.0، الفحص والتحديث الداخلي' },
  ];

  const activeBranch = branches.find(b => b.id === activeBranchId) || branches[0];
  const tenantUsers = users.filter(u => !u.tenantId || u.tenantId === (currentUser?.tenantId || 'tenant-demo'));

  const permissionsList = [
    { key: 'canSell', title: 'البيع وإصدار الفواتير', desc: 'استخدام شاشة الكاشير وبيع التبغ والسجائر وإصدار الإيصالات', icon: Receipt },
    { key: 'canViewInvoices', title: 'استعراض سجل الفواتير', desc: 'عرض فواتير المبيعات السابقة وطباعة إيصالاتها', icon: FileText },
    { key: 'canVoidInvoices', title: 'إلغاء وحذف فواتير البيع (حساس)', desc: 'صلاحية إلغاء الفاتورة وإعادة الكميات للمخزن', icon: ShieldAlert, danger: true },
    { key: 'canManageCustomers', title: 'العملاء وتحصيل الديون', desc: 'إضافة العملاء وسداد ديون الذمم المدينة', icon: Users },
    { key: 'canManagePurchases', title: 'المشتريات وحسابات الموردين', desc: 'إدخال فواتير التوريد الآجل وسداد مستحقات الموردين', icon: Building2 },
    { key: 'canManageInventory', title: 'المخزون والأصناف والتوالف', desc: 'تعديل أسعار الأصناف، إعدام التوالف، ومناقلات الفروع', icon: PackageCheck },
    { key: 'canManageExpenses', title: 'المصروفات اليومية والنثريات', desc: 'تسجيل المصروفات التشغيلية وسندات الصرف', icon: DollarSign },
    { key: 'canManagePayroll', title: 'الموظفون ومسيرات الرواتب', desc: 'إدارة بيانات العمال وصرف الرواتب والسلف', icon: UserCheck },
    { key: 'canViewFinance', title: 'المالية والجرد وأرباح الشركاء', desc: 'الاطلاع على مطابقة الخزينة والسيولة والأرباح والتقارير A4', icon: Scale, danger: true },
    { key: 'canViewAllBranches', title: 'عرض مجمع للفروع المصرح بها', desc: 'عرض مجموع الفروع المحددة لهذا الموظف دون السماح بالتسجيل في وضع الجمع', icon: Layers, danger: true },
    { key: 'canAccessSettings', title: 'إعدادات وضبط النظام الشامل', desc: 'تعديل إعدادات المتجر والطباعة والمستخدمين والنسخ', icon: Lock, danger: true },
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] pb-16 bg-slate-50/70 p-3 sm:p-6 animate-in fade-in duration-200">
      
      {/* 1. Header Bar in Wafeq Style */}
      <div className="max-w-7xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-primary-600 bg-primary-50 px-2 py-0.5 rounded-md border border-primary-100">
              إدارة النظام
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-slate-500 font-medium">الضبط والتخصيص</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-navy-850 mt-1 tracking-tight">
            إعدادات وضبط النظام
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            تخصيص هوية المتجر، الفوترة والطباعة الحرارية، سياسات الميزان، المستخدمين والصلاحيات، والربط السحابي.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleSave}
            className={`px-5 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
              saveSuccess 
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                : 'bg-navy-850 hover:bg-navy-900 text-white'
            }`}
          >
            {saveSuccess ? <Check size={16} className="text-white" /> : <Save size={16} />}
            <span>{saveSuccess ? 'تم حفظ التعديلات بنجاح!' : 'حفظ كافة الإعدادات'}</span>
          </button>
        </div>
      </div>

      {/* 2. Main Layout: Subtabs Sidebar + Content Area */}
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Subtabs Menu: Horizontal scroll on mobile, vertical sidebar on desktop */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200/90 p-2 shadow-2xs lg:sticky lg:top-20">
            <div className="hidden lg:block px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              أقسام الضبط
            </div>
            <div className="flex lg:flex-col overflow-x-auto lg:overflow-visible gap-1.5 scrollbar-none pb-1 lg:pb-0 touch-action-manipulation">
              {subTabs.filter(tab => tab.id !== 'users' || !currentUser?.isStaff).map((tab) => {
                const Icon = tab.icon;
                const isActive = activeSubTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveSubTab(tab.id)}
                    className={`flex items-center gap-2 lg:gap-3 px-3 py-2 lg:py-2.5 rounded-xl text-right transition-all cursor-pointer shrink-0 lg:shrink lg:w-full whitespace-nowrap lg:whitespace-normal ${
                      isActive 
                        ? 'bg-primary-50 text-primary-700 font-bold border border-primary-200 shadow-2xs' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                    }`}
                  >
                    <div className={`w-7 h-7 lg:w-8 lg:h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      isActive ? 'bg-primary-600 text-white shadow-2xs' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <Icon size={15} />
                    </div>
                    <div className="truncate text-right">
                      <span className="block text-xs font-bold leading-tight">{tab.label}</span>
                      <span className={`hidden lg:block text-[10px] truncate mt-0.5 ${isActive ? 'text-primary-600' : 'text-slate-400'}`}>
                        {tab.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Branch Quick Card (Desktop only - mobile uses top bar chip) */}
            <div className="hidden lg:block mt-4 pt-3 border-t border-slate-100 px-3 pb-2">
              <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                <span>الفرع النشط حالياً:</span>
                <span className="font-bold text-navy-850 font-mono">{activeBranch?.code || 'BR-01'}</span>
              </div>
              <div className="font-bold text-xs text-navy-850 truncate">
                {activeBranch?.name || 'الفرع الرئيسي'}
              </div>
              {onOpenBranchesModal && (
                <button
                  type="button"
                  onClick={onOpenBranchesModal}
                  className="mt-2 w-full py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Layers size={13} />
                  <span>إدارة كافة الفروع</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Content Pane */}
        <div className="lg:col-span-3 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">

            {/* TAB 1: Company Profile & Taxes */}
            {activeSubTab === 'profile' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                        <Store size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">بيانات المتجر والنشاط التجاري</h3>
                        <p className="text-[11px] text-slate-400">تظهر هذه المعلومات في ترويسة الفواتير والتقارير المالية الرسمية</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">اسم المحل أو المؤسسة *</label>
                      <input
                        type="text"
                        value={form.shopName || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, shopName: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl font-bold text-navy-850 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="مثال: متجر زقيرت لبيع التبغ والدخان"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">وصف النشاط أو الشعار اللفظي</label>
                      <input
                        type="text"
                        value={form.subTitle || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, subTitle: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="مثال: مبيعات وتوريد بالجملة والتجزئة"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رقم الهاتف الأساسي</label>
                      <input
                        type="text"
                        value={form.phone || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl font-mono text-navy-850 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="05XXXXXXXX"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رقم هاتف إضافي / خدمة عملاء</label>
                      <input
                        type="text"
                        value={form.secondaryPhone || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, secondaryPhone: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl font-mono text-navy-850 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="هاتف اختياري"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">عنوان المتجر</label>
                      <input
                        type="text"
                        value={form.address || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, address: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="مثال: المدينة، الحي، الشارع"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">العملة الافتراضية</label>
                      <div className="flex flex-wrap gap-1.5">
                        <input
                          type="text"
                          value={form.currency || 'ريال'}
                          onChange={(e) => setForm(prev => ({ ...prev, currency: e.target.value }))}
                          className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-center text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                        />
                        {[
                          'ريال سعودي', 'درهم إماراتي', 'دينار بحريني', 'دينار كويتي',
                          'ريال عماني', 'ريال قطري', 'جنيه مصري', 'دينار ليبي',
                          'دينار أردني', 'دينار عراقي', 'دينار تونسي', 'دينار جزائري',
                          'درهم مغربي', 'جنيه سوداني', 'ليرة سورية', 'ليرة لبنانية',
                          'ريال يمني', 'شلن صومالي', 'فرنك جيبوتي', 'فرنك قمري',
                          'أوقية موريتانية', 'شيكل متداول في فلسطين', 'دولار أمريكي', 'يورو',
                        ].map(c => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setForm(prev => ({ ...prev, currency: c }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                              form.currency === c 
                                ? 'bg-primary-600 text-white border-primary-600' 
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {c}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="block text-xs font-bold text-slate-700 mb-1">المنطقة الزمنية للشركة</label>
                      <select
                        value={form.timeZone || 'Asia/Riyadh'}
                        onChange={(e) => setForm(prev => ({ ...prev, timeZone: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                      >
                        {[
                          ['Asia/Riyadh', 'السعودية (Asia/Riyadh)'],
                          ['Asia/Dubai', 'الإمارات (Asia/Dubai)'],
                          ['Asia/Bahrain', 'البحرين (Asia/Bahrain)'],
                          ['Asia/Kuwait', 'الكويت (Asia/Kuwait)'],
                          ['Asia/Muscat', 'عُمان (Asia/Muscat)'],
                          ['Asia/Qatar', 'قطر (Asia/Qatar)'],
                          ['Africa/Cairo', 'مصر (Africa/Cairo)'],
                          ['Africa/Tripoli', 'ليبيا (Africa/Tripoli)'],
                          ['Asia/Amman', 'الأردن (Asia/Amman)'],
                          ['Asia/Baghdad', 'العراق (Asia/Baghdad)'],
                          ['Africa/Tunis', 'تونس (Africa/Tunis)'],
                          ['Africa/Algiers', 'الجزائر (Africa/Algiers)'],
                          ['Africa/Casablanca', 'المغرب (Africa/Casablanca)'],
                          ['Africa/Khartoum', 'السودان (Africa/Khartoum)'],
                          ['Asia/Damascus', 'سوريا (Asia/Damascus)'],
                          ['Asia/Beirut', 'لبنان (Asia/Beirut)'],
                          ['Asia/Aden', 'اليمن (Asia/Aden)'],
                          ['Africa/Mogadishu', 'الصومال (Africa/Mogadishu)'],
                          ['Africa/Djibouti', 'جيبوتي (Africa/Djibouti)'],
                          ['Africa/Nouakchott', 'موريتانيا (Africa/Nouakchott)'],
                          ['Asia/Gaza', 'فلسطين (Asia/Gaza)'],
                          ['America/New_York', 'أمريكا الشرقية (America/New_York)'],
                          ['Europe/London', 'بريطانيا (Europe/London)'],
                          ['Europe/Paris', 'أوروبا الوسطى (Europe/Paris)'],
                          ['Asia/Istanbul', 'تركيا (Asia/Istanbul)']
                        ].map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 mt-1">يحدده المالك مرة واحدة ويُطبَّق على كل فروع الشركة في التقارير والتواريخ.</p>
                    </div>
                  </div>
                </div>

                {/* Tax and Commercial Details */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <DollarSign size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">الرقم الضريبي والسجل التجاري</h3>
                        <p className="text-[11px] text-slate-400">إعدادات الفاتورة الضريبية ونظام القيمة المضافة (VAT)</p>
                      </div>
                    </div>

                    {/* Tax toggle switch */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-700">تفعيل الضريبة:</span>
                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, enableTax: !prev.enableTax }))}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          form.enableTax ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                            form.enableTax ? '-translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الرقم الضريبي للمنشأة (15 رقماً)</label>
                      <input
                        type="text"
                        maxLength={15}
                        value={form.taxNumber || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, taxNumber: e.target.value.replace(/\D/g, '') }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl font-mono text-navy-850 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="300000000000003"
                        dir="ltr"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رقم السجل التجاري (CR)</label>
                      <input
                        type="text"
                        value={form.commercialRegister || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, commercialRegister: e.target.value }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50/70 border border-slate-200 rounded-xl font-mono text-navy-850 focus:bg-white focus:ring-2 focus:ring-primary-500 transition-all text-xs"
                        placeholder="1010XXXXXX"
                        dir="ltr"
                      />
                    </div>

                    {form.enableTax && (
                      <>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">نسبة الضريبة الافتراضية (%)</label>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={form.taxPercentage !== undefined ? form.taxPercentage : 15}
                            onChange={(e) => setForm(prev => ({ ...prev, taxPercentage: Number(e.target.value) || 0 }))}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                          />
                        </div>

                        <div className="flex items-center gap-3 pt-6">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={form.pricesIncludeTax ?? true}
                              onChange={(e) => setForm(prev => ({ ...prev, pricesIncludeTax: e.target.checked }))}
                              className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                            />
                            <span className="text-xs font-bold text-slate-700">أسعار الأصناف في شاشة البيع شاملة للضريبة</span>
                          </label>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Quick Display & Font Scale Section */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                        <Type size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">حجم الخط وشاشات العرض</h3>
                        <p className="text-[11px] text-slate-400">تخصيص مقاس النصوص وشاشات البيع للجوال والأجهزة اللوحية</p>
                      </div>
                    </div>
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-mono font-bold">
                      {form.fontSizeScale || 100}%
                    </span>
                  </div>
                  <div className="space-y-3 pt-1">
                    <input
                      type="range"
                      min="80"
                      max="130"
                      step="5"
                      value={form.fontSizeScale || 100}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setForm(prev => ({ ...prev, fontSizeScale: val }));
                        document.documentElement.style.fontSize = `${(val / 100) * 16}px`;
                      }}
                      className="w-full h-2.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                    />
                    <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                      <span>80% صغير</span>
                      <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">100% قياسي</span>
                      <span>130% كبير</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB: Appearance & Font Size Slider */}
            {activeSubTab === 'appearance' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-6">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold border border-emerald-200">
                        <Type size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">ضبط حجم خطوط وشاشات البرنامج</h3>
                        <p className="text-[11px] text-slate-400">
                          حرك المؤشر (Slider) يميناً أو يساراً لتكبير أو تصغير جميع نصوص وأزرار وفواتير النظام لتناسب نظرك بكل راحة
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-500">الحجم الحالي:</span>
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-mono font-bold">
                        {form.fontSizeScale || 100}%
                      </span>
                    </div>
                  </div>

                  {/* Range Slider Control */}
                  <div className="bg-slate-50/80 rounded-2xl p-6 border border-slate-200/80 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Sliders size={16} className="text-emerald-600" />
                        <span className="text-xs font-bold">مؤشر التحكم في مقاس الخط (لاين التكبير والتصغير)</span>
                      </div>
                      <span className="text-xs font-bold text-slate-600">
                        {Number(form.fontSizeScale || 100) < 95 ? 'خط صغير' : 
                         Number(form.fontSizeScale || 100) <= 105 ? 'حجم متوازن (افتراضي)' : 
                         Number(form.fontSizeScale || 100) <= 120 ? 'خط كبير وواضح' : 'خط كبير جداً'}
                      </span>
                    </div>

                    {/* The Interactive Slider Track */}
                    <div className="space-y-2 pt-2">
                      <input
                        type="range"
                        min="80"
                        max="130"
                        step="5"
                        value={form.fontSizeScale || 100}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setForm(prev => ({ ...prev, fontSizeScale: val }));
                          document.documentElement.style.fontSize = `${(val / 100) * 16}px`;
                        }}
                        className="w-full h-3 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600 hover:accent-emerald-700 transition-all"
                      />

                      {/* Scale ticks / labels */}
                      <div className="flex justify-between text-[11px] font-mono text-slate-500 pt-1 select-none">
                        <span className="text-slate-400">80% (أصغر)</span>
                        <span className="text-slate-500">90%</span>
                        <span className="font-bold text-emerald-700 bg-emerald-100/60 px-2 py-0.5 rounded-md border border-emerald-200">100% (الافتراضي)</span>
                        <span className="text-slate-500">115%</span>
                        <span className="text-slate-600 font-bold">130% (أكبر)</span>
                      </div>
                    </div>

                    {/* Quick Presets Buttons */}
                    <div className="pt-3 border-t border-slate-200/60 flex flex-wrap items-center gap-2">
                      <span className="text-xs text-slate-500 font-medium">مقاسات سريعة:</span>
                      {[
                        { label: 'صغير (85%)', value: 85 },
                        { label: 'الافتراضي (100%)', value: 100 },
                        { label: 'كبير (115%)', value: 115 },
                        { label: 'كبير جداً (130%)', value: 130 }
                      ].map((preset) => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => {
                            setForm(prev => ({ ...prev, fontSizeScale: preset.value }));
                            document.documentElement.style.fontSize = `${(preset.value / 100) * 16}px`;
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                            Number(form.fontSizeScale || 100) === preset.value
                              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                              : 'bg-white text-slate-700 hover:bg-slate-100 border-slate-200'
                          }`}
                        >
                          {preset.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Live Preview Card */}
                  <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-xs font-bold text-slate-700">معاينة حية للمظهر كما سيظهر في شاشات الكاشير والفواتير:</span>
                      <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md">يتغير الحجم لحظياً</span>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-black text-slate-900 text-base">طماطم بلدي فرز أول (صندوق)</h4>
                          <p className="text-xs text-slate-500">الوزن الصافي: 12.50 كجم &bull; السعر: 4.50 ريال/كجم</p>
                        </div>
                        <div className="text-left font-mono">
                          <span className="text-xs text-slate-400 block">الإجمالي</span>
                          <span className="text-lg font-black text-emerald-700">56.25 ريال</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t border-slate-200/60">
                        <button type="button" className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold">
                          إضافة للسلة وإصدار الفاتورة
                        </button>
                        <span className="text-xs text-slate-600 bg-white px-3 py-1.5 rounded-xl border border-slate-200">
                          رقم الفاتورة: #INV-00249
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Save Button for Appearance */}
                  <div className="pt-2 flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      سيتم تذكر وحفظ هذا الحجم تلقائياً لجميع شاشات وأقسام النظام.
                    </p>
                    <button
                      type="button"
                      onClick={handleSave}
                      className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Save size={15} />
                      <span>حفظ مقاس الخط المفضل</span>
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 2: Invoices and Thermal Printing */}
            {activeSubTab === 'invoices' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-navy-850 text-white flex items-center justify-center font-bold">
                      <Printer size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-navy-850">إعدادات الطباعة والفواتير الحرارية</h3>
                      <p className="text-[11px] text-slate-400">تخصيص مقاس ورق الطابعة وتفاصيل الإيصال المطبوع للزبون</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-2">نوع ومقاس الطابعة المعتمدة</label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { id: 'thermal_80', title: 'طابعة حرارية 80mm', desc: 'المقاس القياسي لكاشير المحلات وأسواق الجملة', badge: 'موصى به' },
                        { id: 'thermal_58', title: 'طابعة حرارية 58mm', desc: 'طابعة إيصالات صغيرة متنقلة بلوتوث أو USB' },
                        { id: 'a4', title: 'طابعة ورق A4 عادية', desc: 'فواتير ضريبية ورسمية كاملة مع جداول تفصيلية' }
                      ].map((prn) => {
                        const isSelected = (form.printerType || 'thermal_80') === prn.id;
                        return (
                          <div
                            key={prn.id}
                            onClick={() => setForm(prev => ({ ...prev, printerType: prn.id }))}
                            className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative ${
                              isSelected 
                                ? 'border-primary-600 bg-primary-50/50 shadow-2xs' 
                                : 'border-slate-200 hover:border-slate-300 bg-slate-50/50'
                            }`}
                          >
                            {prn.badge && (
                              <span className="absolute top-2 left-2 text-[9px] bg-primary-600 text-white font-bold px-1.5 py-0.5 rounded-md">
                                {prn.badge}
                              </span>
                            )}
                            <h4 className="font-bold text-xs text-navy-850">{prn.title}</h4>
                            <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">{prn.desc}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-3 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.autoPrintInvoice ?? false}
                        onChange={(e) => setForm(prev => ({ ...prev, autoPrintInvoice: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-navy-850 block">طباعة الإيصال تلقائياً فور تأكيد البيع</span>
                        <span className="text-[10px] text-slate-500 block">يرسل أمر الطباعة مباشرة دون الحاجة لضغط زر طباعة إضافي</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.printQrCode ?? true}
                        onChange={(e) => setForm(prev => ({ ...prev, printQrCode: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-navy-850 block">طباعة رمز الاستجابة السريعة (QR Code)</span>
                        <span className="text-[10px] text-slate-500 block">يتوافق مع متطلبات هيئة الزكاة والضريبة والجمارك والتحقق السريع</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.printCashierName ?? true}
                        onChange={(e) => setForm(prev => ({ ...prev, printCashierName: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-navy-850 block">إظهار اسم الكاشير في الفاتورة</span>
                      </div>
                    </label>

                    <label className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.printBranchName ?? true}
                        onChange={(e) => setForm(prev => ({ ...prev, printBranchName: e.target.checked }))}
                        className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                      />
                      <div>
                        <span className="text-xs font-bold text-navy-850 block">إظهار اسم الفرع في ترويسة الإيصال</span>
                      </div>
                    </label>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">الرقم التسلسلي للفاتورة التالية</label>
                      <input
                        type="number"
                        min="1"
                        value={form.nextInvoiceNumber || 1}
                        onChange={(e) => setForm(prev => ({ ...prev, nextInvoiceNumber: Number(e.target.value) || 1 }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="text-[10px] text-slate-400 mt-0.5 block">
                        يمكنك ضبط بداية ترقيم الفواتير بحسب تسلسل المحل
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">رسالة شكر أسفل الفاتورة</label>
                      <input
                        type="text"
                        value={form.invoiceNote || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, invoiceNote: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-primary-500"
                        placeholder="شكراً لتعاملكم معنا ونسعد بخدمتكم دائماً"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">سياسة الاسترجاع والاستبدال</label>
                      <input
                        type="text"
                        value={form.returnPolicy || ''}
                        onChange={(e) => setForm(prev => ({ ...prev, returnPolicy: e.target.value }))}
                        className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 text-xs focus:ring-2 focus:ring-primary-500"
                        placeholder="مثال: البضائع الطازجة تستبدل خلال 24 ساعة بموجب الفاتورة"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 3: Scales and POS Policies */}
            {activeSubTab === 'scales' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Scale size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-navy-850">سياسات الميزان والأوزان وخصومات الكاشير</h3>
                      <p className="text-[11px] text-slate-400">ضبط حسابات وزن الصافي، الفارغ (Tare)، وصلاحيات الخصم</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      الوزن الفارغ الافتراضي للكرتون / الصندوق (كجم)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        value={form.defaultTareKg !== undefined ? form.defaultTareKg : 0.5}
                        onChange={(e) => setForm(prev => ({ ...prev, defaultTareKg: Number(e.target.value) || 0 }))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                      />
                      <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">كجم</span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                      القيمة التي يملؤها النظام تلقائياً عند النقر على زر "كرتون/فارغ" لخصم وزن الصندوق وحساب الصافي.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      دقة الميزان وعدد الخانات العشرية
                    </label>
                    <select
                      value={form.weightPrecision || 2}
                      onChange={(e) => setForm(prev => ({ ...prev, weightPrecision: Number(e.target.value) }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="2">خانتين عشريتين (0.00 - الأنسب للأسعار والكسور)</option>
                      <option value="3">ثلاث خانات عشرية (0.000 - دقة عالية)</option>
                    </select>
                    <p className="text-[10px] text-slate-400 mt-1">
                      تحدد كيفية تقريب الأوزان وظهورها على شاشة البيع والإيصالات.
                    </p>
                  </div>

                  <div className="sm:col-span-2 pt-3 border-t border-slate-100">
                    <h4 className="font-bold text-xs text-navy-850 mb-3">صلاحيات الخصومات والعروض السعرية للكاشير</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.allowCashierDiscounts ?? true}
                          onChange={(e) => setForm(prev => ({ ...prev, allowCashierDiscounts: e.target.checked }))}
                          className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500 border-slate-300"
                        />
                        <div>
                          <span className="text-xs font-bold text-navy-850 block">السماح للكاشير بإجراء خصم يدوي للزبون</span>
                          <span className="text-[10px] text-slate-500 block">إتاحة حقل الخصم في شاشة البيع</span>
                        </div>
                      </label>

                      <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">الحد الأقصى للخصم المسموح به (%)</label>
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={form.maxDiscountPercent !== undefined ? form.maxDiscountPercent : 15}
                            onChange={(e) => setForm(prev => ({ ...prev, maxDiscountPercent: Number(e.target.value) || 0 }))}
                            className="w-full px-3.5 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                          />
                          <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 4: Inventory and Cash Management */}
            {activeSubTab === 'inventory' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5"
              >
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <PackageCheck size={18} />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-navy-850">سياسات المخزون ومطابقة الخزينة</h3>
                      <p className="text-[11px] text-slate-400">التحكم في البيع عند نفاد الرصيد والعهدة الافتتاحية للدرج</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <span className="font-bold text-xs text-navy-850 block">
                          السماح بالبيع عند نفاد المخزون (البيع على ذمة التوريد)
                        </span>
                        <span className="text-[11px] text-slate-500 block mt-0.5">
                          تتيح للكاشير وزن وإصدار فواتير بيع للبضاعة الطازجة التي وصلت فجراً قبل إدخال فاتورة الشراء من المورد.
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setForm(prev => ({ ...prev, allowNegativeStock: !prev.allowNegativeStock }))}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                          form.allowNegativeStock ? 'bg-emerald-600' : 'bg-slate-300'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition duration-200 ease-in-out ${
                            form.allowNegativeStock ? '-translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    <div className={`p-3 rounded-lg text-xs leading-relaxed ${
                      form.allowNegativeStock 
                        ? 'bg-amber-50 text-amber-900 border border-amber-200/80' 
                        : 'bg-emerald-50 text-emerald-900 border border-emerald-200/80'
                    }`}>
                      {form.allowNegativeStock ? (
                        <span className="flex items-center gap-2">
                          <AlertCircle size={15} className="text-amber-600 shrink-0" />
                          <span><strong>وضع مرن:</strong> يستمر البيع ويظهر الرصيد بالسالب لحين تسجيل فاتورة التوريد لتسوية الكميات آلياً.</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />
                          <span><strong>وضع منضبط:</strong> يمنع البيع للأصناف التي رصيدها صفر لمنع التجاوزات وضبط الأرصدة بدقة.</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        العهدة النقدية الافتتاحية للدرج (فكة الصندوق)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={form.openingCashDrawerFloat !== undefined ? form.openingCashDrawerFloat : 0}
                          onChange={(e) => setForm(prev => ({ ...prev, openingCashDrawerFloat: Number(e.target.value) || 0 }))}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">
                          {form.currency || 'ريال'}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        تُحسب تلقائياً في حسابات السيولة النقدية ومطابقة الصندوق في شاشة الجرد.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1">
                        حد التنبيه الافتراضي لانخفاض المخزون (كجم)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          value={form.defaultLowStockAlert !== undefined ? form.defaultLowStockAlert : 15}
                          onChange={(e) => setForm(prev => ({ ...prev, defaultLowStockAlert: Number(e.target.value) || 0 }))}
                          className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-navy-850 text-xs focus:ring-2 focus:ring-primary-500"
                        />
                        <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">كجم</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-1">
                        يظهر تنبيه باللون البرتقالي عندما يقل رصيد الصنف عن هذا الوزن لإعادة الطلب من المورد.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 5: Users and Granular Permissions Management (NEW!) */}
            {activeSubTab === 'users' && !currentUser?.isStaff && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Top Section with Stats and Add Button */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                        <Users size={20} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">إدارة مستخدمي وموظفي النظام</h3>
                        <p className="text-[11px] text-slate-400">إضافة وتعديل حسابات الكاشير، المحاسبين، وتعيين الصلاحيات والفروع بدقة</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleRefreshCloudUsers}
                        disabled={isRefreshingUsers}
                        className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer border border-slate-200 shrink-0 disabled:opacity-50"
                        title="تحديث قائمة المستخدمين والصلاحيات من السحابة المركزية"
                      >
                        <RefreshCw size={14} className={isRefreshingUsers ? 'animate-spin text-primary-600' : ''} />
                        <span>{isRefreshingUsers ? 'جاري التحديث...' : 'تحديث من السحابة'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleOpenNewUser}
                        className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-bold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-sm shrink-0"
                      >
                        <Plus size={16} />
                        <span>إضافة مستخدم جديد</span>
                      </button>
                    </div>
                  </div>

                  {/* Store Code Connection Callout Card for Staff Pairing */}
                  <div className="p-4 bg-emerald-50/80 border border-emerald-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0 shadow-xs">
                        <Store size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-black text-xs text-navy-850">رمز المتجر لتسجيل الدخول</h4>
                          <span className="text-[10px] bg-emerald-200/70 text-emerald-900 font-bold px-2 py-0.5 rounded-full">معتمد لجميع أجهزتكم</span>
                        </div>
                        <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                          أعطِ هذا الكود لموظفي الكاشير والمحاسبين ليدخلوه مرة واحدة في شاشة الدخول لربط أجهزتهم (الكمبيوتر والجوال) بمتجرك مباشرة.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 self-start sm:self-center">
                      <span className="font-mono font-black text-sm px-3.5 py-1.5 bg-white text-emerald-700 rounded-xl border border-emerald-300 shadow-2xs tracking-wider" dir="ltr">
                        {currentUser?.storeCode || (typeof localStorage !== 'undefined' && localStorage.getItem('khodar_remembered_store_code')) || 'BRK-101'}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const code = currentUser?.storeCode || (typeof localStorage !== 'undefined' && localStorage.getItem('khodar_remembered_store_code')) || 'BRK-101';
                          navigator.clipboard.writeText(code);
                          alert(`تم نسخ كود المتجر: ${code}`);
                        }}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Copy size={13} />
                        <span>نسخ الكود</span>
                      </button>
                    </div>
                  </div>

                  {/* Stats Counter Bar */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold block">إجمالي المستخدمين</span>
                      <span className="text-lg font-bold text-navy-850 font-mono mt-0.5 block">{tenantUsers.length}</span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold block">الكاشير والبائعين</span>
                      <span className="text-lg font-bold text-primary-600 font-mono mt-0.5 block">
                        {tenantUsers.filter(u => u.role === 'cashier').length}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold block">المحاسبين والمالية</span>
                      <span className="text-lg font-bold text-emerald-600 font-mono mt-0.5 block">
                        {tenantUsers.filter(u => u.role === 'accountant').length}
                      </span>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/70">
                      <span className="text-[10px] text-slate-400 font-bold block">المدراء والمشرفين</span>
                      <span className="text-lg font-bold text-purple-600 font-mono mt-0.5 block">
                        {tenantUsers.filter(u => u.role === 'admin' || u.role === 'company_owner').length}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Users List Cards */}
                <div className="space-y-3">
                  {tenantUsers.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center text-slate-400 text-xs">
                      لا يوجد مستخدمون إضافيون مسجلون حتى الآن. اضغط على "إضافة مستخدم جديد" لإنشاء أول حساب كاشير.
                    </div>
                  ) : (
                    tenantUsers.map((u) => {
                      const isMe = u.id === currentUser?.id || u.username === currentUser?.username;
                      const rolePreset = ROLE_PERMISSIONS_PRESETS[u.role] || ROLE_PERMISSIONS_PRESETS.custom;
                      const assignedBranchNames = (u.branchIds || (u.branchId && u.branchId !== 'all' ? [u.branchId] : []))
                        .map(id => branches.find(b => b.id === id)?.name || id);

                      return (
                        <div 
                          key={u.id}
                          className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:border-slate-300"
                        >
                          <div className="flex items-start gap-3.5">
                            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shrink-0 shadow-2xs ${
                              u.role === 'admin' 
                                ? 'bg-purple-100 text-purple-700' 
                                : u.role === 'cashier' 
                                  ? 'bg-primary-100 text-primary-700'
                                  : u.role === 'accountant'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-slate-100 text-slate-700'
                            }`}>
                              {u.role === 'admin' ? '👑' : u.role === 'cashier' ? '🛒' : u.role === 'accountant' ? '📊' : '👤'}
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-bold text-xs sm:text-sm text-navy-850">
                                  {u.name}
                                </h4>
                                {isMe && (
                                  <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">
                                    حسابك الحالي
                                  </span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  u.status === 'active' 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                                    : 'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                  {u.status === 'active' ? 'نشط' : 'معطل'}
                                </span>
                              </div>

                              <div className="flex items-center gap-3 text-[11px] text-slate-500 flex-wrap">
                                <span className="font-mono font-bold text-slate-700" dir="ltr">@{u.username}</span>
                                <span>•</span>
                                <span className="font-medium text-slate-600">{rolePreset.label}</span>
                                <span>•</span>
                                <span className="text-slate-500">
                                  الفروع: <strong>{assignedBranchNames.length ? assignedBranchNames.join('، ') : 'بلا فرع — يلزم التخصيص'}</strong>
                                </span>
                                {u.phone && (
                                  <>
                                    <span>•</span>
                                    <span className="font-mono">{u.phone}</span>
                                  </>
                                )}
                              </div>

                              {/* Permissions mini chips */}
                              <div className="flex items-center gap-1.5 pt-1.5 flex-wrap">
                                {u.permissions?.canSell && (
                                  <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">البيع والميزان</span>
                                )}
                                {u.permissions?.canViewInvoices && (
                                  <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">سجل الفواتير</span>
                                )}
                                {u.permissions?.canVoidInvoices && (
                                  <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded font-bold">إلغاء الفواتير</span>
                                )}
                                {u.permissions?.canManageCustomers && (
                                  <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">العملاء</span>
                                )}
                                {u.permissions?.canManagePurchases && (
                                  <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">المشتريات</span>
                                )}
                                {u.permissions?.canManageExpenses && (
                                  <span className="text-[9px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">المصروفات</span>
                                )}
                                {u.permissions?.canViewFinance && (
                                  <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded font-bold">المالية والجرد</span>
                                )}
                                {u.permissions?.canAccessSettings && (
                                  <span className="text-[9px] bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded font-bold">الضبط</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                            <button
                              type="button"
                              onClick={() => handleToggleUserStatus(u)}
                              disabled={isMe}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                                u.status === 'active'
                                  ? 'bg-slate-50 hover:bg-rose-50 text-slate-600 hover:text-rose-700 border-slate-200'
                                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200'
                              }`}
                              title={u.status === 'active' ? 'تعطيل الحساب' : 'تفعيل الحساب'}
                            >
                              {u.status === 'active' ? 'تعطيل' : 'تفعيل'}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenEditUser(u)}
                              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Edit3 size={13} />
                              <span>تعديل الصلاحيات</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDeleteUserClick(u)}
                              disabled={isMe}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                              title="حذف المستخدم"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* TAB 6: Cloudflare Cloud Sync & Backups */}
            {activeSubTab === 'cloud' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <ConflictReviewPanel key={`${currentUser?.tenantId}:${currentUser?.id}`} user={currentUser} branches={branches} />
                <div className="bg-navy-850 text-white rounded-2xl p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold">
                        <Cloud size={22} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-white">المزامنة والتخزين السحابي</h3>
                        <p className="text-[11px] text-slate-400">تابع حالة بياناتك واحتفظ بنسخة احتياطية</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700 text-xs">
                      {syncStatus.isOnline ? (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="font-bold text-emerald-400">الجهاز متصل بالإنترنت</span>
                        </>
                      ) : (
                        <>
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                          <span className="font-bold text-amber-400">لا يوجد اتصال بالإنترنت</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-3 border-t border-slate-800 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">تغييرات بانتظار المزامنة:</span>
                      <span className="font-mono text-slate-200 font-bold text-[11px]">
                        {Number.isInteger(syncStatus.queueLength) && syncStatus.queueLength >= 0
                          ? syncStatus.queueLength
                          : syncStatus.status === 'error' ? 'تعذر قراءة الحالة' : 'جارٍ التحقق…'}
                      </span>
                    </div>
                  </div>

                  {cloudSyncMessage && (
                    <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                      cloudSyncMessage.type === 'success' 
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    }`}>
                      <Check size={14} />
                      <span>{cloudSyncMessage.text}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={handleManualCloudSync}
                      disabled={isCloudSyncing}
                      className="px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <RefreshCw size={14} className={isCloudSyncing ? 'animate-spin' : ''} />
                      <span>مزامنة البيانات الآن</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleCloudBackup}
                      disabled={isCloudSyncing}
                      className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold text-xs flex items-center gap-2 cursor-pointer transition-colors"
                    >
                      <Database size={14} />
                      <span>حفظ نسخة احتياطية الآن</span>
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4">
                  <h3 className="font-bold text-sm text-navy-850">نسخة احتياطية على الجهاز</h3>
                  <p className="text-[11px] text-slate-500">
                    يمكنك تنزيل نسخة من بياناتك على جهازك واستيرادها عند الحاجة.
                  </p>

                  <div role="status" className={`p-3 rounded-xl text-xs border ${
                    backupStatus.status === 'saved' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                    backupStatus.status === 'retrying' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                    'bg-amber-50 text-amber-800 border-amber-200'
                  }`}>
                    <span className="font-bold">حالة النسخة السحابية التلقائية: </span>
                    {{
                      idle: 'البيانات محفوظة محليًا', pending: 'نسخة جديدة بانتظار الرفع',
                      uploading: 'جارٍ رفع النسخة', saved: 'تم حفظ النسخة السحابية بنجاح',
                      retrying: 'فشل الرفع وستتم إعادة المحاولة تلقائيًا'
                    }[backupStatus.status] || 'حالة النسخ غير معروفة'}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={exportBackupJSON}
                      className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Download size={16} />
                      <span>تنزيل نسخة احتياطية</span>
                    </button>

                    <label className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer text-center">
                      <Upload size={16} />
                      <span>استيراد ملف نسخة احتياطية</span>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>

                </div>
              </motion.div>
            )}

            {/* TAB 7: Security and Account */}
            {activeSubTab === 'security' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-5"
              >
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center font-bold">
                        <Lock size={18} />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-navy-850">بيانات حساب المشترك والأمان</h3>
                        <p className="text-[11px] text-slate-400">معلومات الترخيص، اسم الدخول، وكلمة المرور</p>
                      </div>
                    </div>

                    {onOpenChangePassword && (
                      <button
                        type="button"
                        onClick={onOpenChangePassword}
                        className="px-3.5 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <KeyRound size={14} />
                        <span>تغيير كلمة المرور</span>
                      </button>
                    )}
                  </div>

                  {currentUser ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px]">المؤسسة / الشركة:</span>
                        <span className="font-bold text-navy-850 text-sm mt-0.5 block">{currentUser.companyName || 'المتجر الرئيسي'}</span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px]">اسم المستخدم:</span>
                        <span className="font-mono font-bold text-navy-850 text-sm mt-0.5 block" dir="ltr">@{currentUser.username}</span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px]">نوع الاشتراك:</span>
                        <span className="font-bold text-emerald-600 text-xs mt-0.5 block">
                          {currentUser.role === 'super_admin' ? 'ترخيص إدارة المنصة الرئيسي (Super Admin)' : 'ترخيص تجاري سحابي معتمد'}
                        </span>
                      </div>

                      <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                        <span className="text-slate-400 block text-[11px]">صلاحية الاشتراك:</span>
                        <span className="font-mono font-bold text-navy-850 text-xs mt-0.5 block">
                          {currentUser.role === 'super_admin' ? 'دائم مدى الحياة' : (currentUser.expiresAt || '2028-12-31')}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-slate-500 text-xs">
                      يعمل النظام حالياً كنسخة متجر محلية.
                    </div>
                  )}

                  <div className="pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-bold text-xs text-navy-850">الفروع المسجلة للمتجر ({branches.length})</h4>
                      {onOpenBranchesModal && (
                        <button
                          type="button"
                          onClick={onOpenBranchesModal}
                          className="text-xs font-bold text-primary-600 hover:text-primary-700 underline cursor-pointer"
                        >
                          إضافة فرع جديد أو تعديل الفروع
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {branches.map(b => (
                        <div key={b.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-xs text-navy-850 block">{b.name}</span>
                            <span className="text-[10px] text-slate-400 font-mono block">{b.code || 'BR'} - {b.phone || 'بدون هاتف'}</span>
                          </div>
                          {b.isMain && (
                            <span className="text-[10px] font-bold bg-primary-50 text-primary-700 border border-primary-100 px-2 py-0.5 rounded-md">
                              الفرع الرئيسي
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* TAB 8: In-App Updates Center */}
            {activeSubTab === 'updates' && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Main Version Status Card */}
                <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs space-y-5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center font-bold border border-primary-100">
                        <ArrowUpCircle size={22} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-sm text-navy-850">مركز التحديثات وإصدار النظام</h3>
                          <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md">
                            الإصدار الحالي v{APP_VERSION}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          تاريخ بناء الإصدار: {APP_RELEASE_DATE} &bull; المنصة النشطة: {
                            getClientPlatform() === 'windows' ? 'برنامج سطح المكتب (Windows)' :
                            getClientPlatform() === 'android' ? 'تطبيق الهاتف (Android)' : 'سحابة الويب (Web)'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCheckUpdate}
                        disabled={isCheckingUpdate}
                        className="py-2 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw size={13} className={isCheckingUpdate ? 'animate-spin text-primary-600' : ''} />
                        <span>{isCheckingUpdate ? 'جارٍ الفحص...' : 'فحص التحديثات الآن'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      >
                        <Sparkles size={13} className="text-emerald-200" />
                        <span>عرض تفاصيل التحديث</span>
                      </button>
                    </div>
                  </div>

                  {/* Status Indicator Banner */}
                  {releaseInfo?.isUpdateAvailable ? (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <Sparkles size={20} className="text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-xs text-amber-900 block">
                            يوجد إصدار جديد متاح للترقية الآن: v{releaseInfo.latestVersion}
                          </span>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            يتضمن التحديث ميزة سلايدر ضبط حجم الخطوط لجميع الشاشات ونظام استرداد كلمة المرور المباشر.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsUpdateModalOpen(true)}
                        className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
                      >
                        تثبيت v{releaseInfo.latestVersion}
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-start gap-3">
                      <CheckCircle2 size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-xs text-emerald-900 block">
                          النظام يعمل بأحدث إصدار رسمي مستقر ومطابق للمعايير المحاسبية (v{APP_VERSION})
                        </span>
                        <p className="text-[11px] text-emerald-700 mt-0.5 leading-relaxed">
                          تتضمن هذه النسخة سلايدر التحكم بحجم الخطوط، وحل مشكلات استجابة لوحة المفاتيح، وشاشة تسجيل الدخول المخصصة لسطح المكتب، ونظام التحديث التلقائي السلس.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Key Features of current release */}
                  <div className="pt-2">
                    <span className="font-bold text-xs text-navy-850 block mb-3">
                      أبرز التحسينات والمميزات المعتمدة في v{APP_VERSION}:
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                        <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block">استجابة فورية للوحة المفاتيح</span>
                          <span className="text-[11px] text-slate-500">تمكين التحديد والكتابة والتنقل بالأزرار في كافة الشاشات والقوائم.</span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                        <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block">واجهة تسجيل دخول مستقلة للديسكتوب</span>
                          <span className="text-[11px] text-slate-500">شاشة خاصة بدون تشتيت أو روابط تسويقية لمحطات الكاشير والمحاسبين.</span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                        <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block">محرك تحديث داخلي ذكي</span>
                          <span className="text-[11px] text-slate-500">تنزيل التحديثات بنقرة واحدة وتثبيتها بهدوء دون فقدان أي إعدادات أو مبيعات.</span>
                        </div>
                      </div>

                      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start gap-2.5">
                        <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-slate-800 block">توافق تام مع الموازين والطابعات</span>
                          <span className="text-[11px] text-slate-500">دعم قراءة الوزن وطباعة فواتير A4 وفواتير الكاشير الحرارية.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Safety & Zero Data Loss Guarantee */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 flex items-center gap-2.5">
                    <ShieldCheck size={18} className="text-primary-600 shrink-0" />
                    <span>
                      <strong>ضمان سلامة البيانات:</strong> أي تحديث جديد يتم تطبيقه تلقائياً يحافظ 100% على قواعد البيانات المحلية، ولا يحذف أي فواتير أو مستحقات.
                    </span>
                  </div>

                </div>
              </motion.div>
            )}

            {/* Bottom Floating Save Button */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between">
              <div className="text-xs text-slate-500">
                يتم تطبيق التعديلات فور الحفظ في شاشة البيع وكافة التقارير.
              </div>

              <button
                type="submit"
                className={`px-6 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer ${
                  saveSuccess 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-navy-850 hover:bg-navy-900 text-white'
                }`}
              >
                {saveSuccess ? <Check size={16} className="text-white" /> : <Save size={16} />}
                <span>{saveSuccess ? 'تم حفظ التعديلات!' : 'حفظ الإعدادات'}</span>
              </button>
            </div>

          </form>
        </div>

      </div>

      {/* 3. Add / Edit User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col my-auto border border-slate-200 animate-in zoom-in-95 max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-navy-850 text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-primary-500/20 text-primary-400 flex items-center justify-center font-bold">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingUser ? 'تعديل بيانات وصلاحيات المستخدم' : 'إضافة مستخدم وموظف جديد'}
                  </h3>
                  <p className="text-[10px] text-slate-400">تحديد اسم الدخول، كلمة المرور، والصلاحيات الممنوحة</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsUserModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveUser} className="p-6 overflow-y-auto space-y-5 text-xs">
              
              {userError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl flex items-center gap-2">
                  <AlertCircle size={16} className="shrink-0 text-rose-600" />
                  <span>{userError}</span>
                </div>
              )}

              {userSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-2">
                  <Check size={16} className="shrink-0 text-emerald-600" />
                  <span>{userSuccess}</span>
                </div>
              )}

              {/* Basic User Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">الاسم الكامل للموظف *</label>
                  <input
                    type="text"
                    value={userForm.name}
                    onChange={(e) => setUserForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثال: أحمد فهد (كاشير 1)"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-navy-850 font-bold focus:bg-white focus:ring-2 focus:ring-primary-500"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">اسم المستخدم للدخول (Username) *</label>
                  <input
                    type="text"
                    value={userForm.username}
                    onChange={(e) => setUserForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/\s+/g, '') }))}
                    placeholder="مثال: cashier1"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-navy-850 font-mono font-bold focus:bg-white focus:ring-2 focus:ring-primary-500"
                    dir="ltr"
                    required
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">كلمة المرور *</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={userForm.password}
                      onChange={(e) => setUserForm(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-navy-850 font-mono focus:bg-white focus:ring-2 focus:ring-primary-500"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">الفرع المخصص</label>
                  <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {branches.map(b => (
                      <label key={b.id} className="flex items-center gap-2 text-sm text-navy-850">
                        <input type="checkbox" checked={userForm.branchIds.includes(b.id)}
                          onChange={e => setUserForm(prev => ({ ...prev,
                            branchIds: e.target.checked ? [...prev.branchIds, b.id] : prev.branchIds.filter(id => id !== b.id)
                          }))} />
                        {b.name} ({b.code || 'BR'})
                      </label>
                    ))}
                    <p className="text-xs text-slate-500">لا يمكن للموظف الوصول إلا إلى الفروع المحددة هنا.</p>
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">رقم الهاتف (اختياري)</label>
                  <input
                    type="text"
                    value={userForm.phone}
                    onChange={(e) => setUserForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="05XXXXXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-navy-850 font-mono focus:bg-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">حالة الحساب</label>
                  <select
                    value={userForm.status}
                    onChange={(e) => setUserForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-navy-850 font-bold focus:bg-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="active">نشط (مسموح له بالدخول)</option>
                    <option value="inactive">معطل مؤقتاً (محظور الدخول)</option>
                  </select>
                </div>
              </div>

              {/* Role Presets */}
              <div className="pt-3 border-t border-slate-100">
                <label className="block font-bold text-slate-800 mb-2">الدور الوظيفي (قوالب الصلاحيات الجاهزة):</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { id: 'cashier', label: 'كاشير وميزان', icon: '🛒' },
                    { id: 'accountant', label: 'محاسب مالي', icon: '📊' },
                    { id: 'inventory_manager', label: 'مشتريات ومخزون', icon: '📦' },
                    { id: 'admin', label: 'مدير عام / مالك', icon: '👑' },
                    { id: 'custom', label: 'صلاحيات مخصصة', icon: '⚙️' },
                  ].map(r => {
                    const isSelected = userForm.role === r.id;
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleRolePresetChange(r.id)}
                        className={`p-2.5 rounded-xl border text-center font-bold text-xs flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isSelected 
                            ? 'bg-primary-50 border-primary-600 text-primary-700 shadow-2xs ring-2 ring-primary-500/20' 
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <span className="text-base">{r.icon}</span>
                        <span>{r.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Detailed Permissions Matrix */}
              <div className="pt-3 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800 block">
                    تخصيص الصلاحيات الدقيقة ({Object.values(userForm.permissions || {}).filter(Boolean).length} مفعلة):
                  </label>
                  <span className="text-[10px] text-slate-400">
                    يمكنك تفعيل أو حجب أي صلاحية بمفردها
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {permissionsList.map(p => {
                    const isGranted = !!userForm.permissions?.[p.key];
                    const Icon = p.icon;
                    return (
                      <div
                        key={p.key}
                        onClick={() => handleTogglePermission(p.key)}
                        className={`p-3 rounded-xl border flex items-start gap-2.5 transition-all cursor-pointer select-none ${
                          isGranted 
                            ? 'bg-primary-50/40 border-primary-200 text-navy-850' 
                            : 'bg-slate-50/70 border-slate-200/80 text-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center shrink-0 ${
                          isGranted ? 'text-primary-600' : 'text-slate-300'
                        }`}>
                          {isGranted ? <CheckSquare size={16} /> : <SquareIcon size={16} />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold text-xs ${isGranted ? 'text-navy-850' : 'text-slate-600'}`}>
                              {p.title}
                            </span>
                            {p.danger && (
                              <span className="text-[8px] bg-rose-50 text-rose-600 px-1.5 py-0.2 rounded font-bold border border-rose-100">
                                حساس
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">
                            {p.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsUserModalOpen(false)}
                  className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all"
                >
                  <Check size={16} />
                  <span>{editingUser ? 'حفظ التعديلات' : 'إنشاء المستخدم'}</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* 4. Desktop In-App Auto-Update Modal */}
      <DesktopUpdateModal
        isOpen={isUpdateModalOpen}
        onClose={() => setIsUpdateModalOpen(false)}
        releaseInfo={releaseInfo}
        cartItemsCount={store.cart?.length || 0}
      />

    </div>
  );
}
