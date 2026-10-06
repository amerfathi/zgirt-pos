import { apiFetch as fetch } from '../services/authSession.js';
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { OFFICIAL_RELEASES } from '../services/releaseService';
import { APP_VERSION, getApiBaseUrl } from '../config/appVersion';
import { 
  Building2, Users, Monitor, Smartphone, Globe, Download, Tag, Plus, ShieldCheck, Calendar, Clock, Phone, 
  Check, X, Copy, Trash2, Power, RefreshCw, Key, MessageCircle, 
  ExternalLink, Search, Sparkles, ArrowRight, Edit3
} from 'lucide-react';

export default function SuperAdminPortal({ isOpen, onClose, store, onSwitchToStore }) {
  const { 
    tenants = [], 
    syncCloudTenants,
    currentUser, 
    createTenantAccount, 
    updateTenantAccount, 
    deleteTenantAccount,
    adminResetTenantPassword,
    trialRequests = [],
    updateTrialRequest,
    deleteTrialRequest
  } = store;

  // Navigation & Modal State
  const [activeTab, setActiveTab] = useState('tenants'); // 'tenants' | 'security' | 'releases' | 'trials'
  const [isSyncingTenants, setIsSyncingTenants] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedTenantId, setCopiedTenantId] = useState(null);
  const [activatingTrialId, setActivatingTrialId] = useState(null);
  const [editingBranchTenant, setEditingBranchTenant] = useState(null);
  const [editBranchesCount, setEditBranchesCount] = useState('1');
  const [resettingTenant, setResettingTenant] = useState(null);
  const [newTenantPass, setNewTenantPass] = useState('');
  const [resetSuccessMsg, setResetSuccessMsg] = useState('');
  const [ownerSecurity, setOwnerSecurity] = useState({ email: '', events: [] });
  const [ownerSecurityForm, setOwnerSecurityForm] = useState({ currentPassword: '', newEmail: '', newPassword: '', confirmPassword: '' });
  const [ownerSecurityError, setOwnerSecurityError] = useState('');
  const [ownerSecurityLoading, setOwnerSecurityLoading] = useState(false);

  // Comprehensive Edit Tenant State (تعديل شامل لكافة بيانات المشترك)
  const [editingTenant, setEditingTenant] = useState(null);
  const [editForm, setEditForm] = useState(/** @type {{companyName: string, storeCode: string, username: string, password: string, status: string, expiresAt: string, allowedBranches: string | number, phone: string, notes: string}} */ ({
    companyName: '',
    storeCode: '',
    username: '',
    password: '',
    status: 'active',
    expiresAt: '',
    allowedBranches: 1,
    phone: '',
    notes: ''
  }));
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  // Live Cloud Trial Requests Synchronization (مزامنة طلبات التجربة مع سحابة Cloudflare D1)
  const [cloudTrialRequests, setCloudTrialRequests] = useState([]);
  const [isLoadingTrials, setIsLoadingTrials] = useState(false);

  // New Tenant Form State
  const [companyName, setCompanyName] = useState('');
  const [storeCode, setStoreCode] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [durationMonths, setDurationMonths] = useState('12');
  const [allowedBranches, setAllowedBranches] = useState('1');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [createdWelcomeMsg, setCreatedWelcomeMsg] = useState(null);
  const [releasesList, setReleasesList] = useState(OFFICIAL_RELEASES);
  const [isReleaseModalOpen, setIsReleaseModalOpen] = useState(false);
  const [releaseForm, setReleaseForm] = useState({
    platform: 'windows',
    version: '2.4.1',
    minimum_version: '2.2.0',
    update_type: 'recommended',
    release_notes: '',
    download_url: ''
  });

  const generateStoreCode = () => {
    const num = Math.floor(100 + Math.random() * 900);
    setStoreCode(`BRK-${num}`);
  };

  const fetchCloudTrials = useCallback(async () => {
    setIsLoadingTrials(true);
    try {
      const baseUrl = getApiBaseUrl();
      const res = await fetch(`${baseUrl}/api/trial-requests`);
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setCloudTrialRequests(data.requests);
      }
    } catch (e) {
      console.warn('Failed to fetch cloud trials:', e);
    } finally {
      setIsLoadingTrials(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCloudTrials();
    }
  }, [isOpen, activeTab, fetchCloudTrials]);

  const fetchOwnerSecurity = useCallback(async () => {
    setOwnerSecurityLoading(true);
    setOwnerSecurityError('');
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/platform-owner`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر تحميل إعدادات مالك المنصة');
      setOwnerSecurity({ email: result.owner.email, events: result.events || [] });
      setOwnerSecurityForm(form => ({ ...form, newEmail: result.owner.email }));
    } catch (error) { setOwnerSecurityError(error.message); }
    finally { setOwnerSecurityLoading(false); }
  }, []);

  useEffect(() => {
    if (isOpen && activeTab === 'security') void fetchOwnerSecurity();
  }, [isOpen, activeTab, fetchOwnerSecurity]);

  const handleOwnerCredentialChange = async (event) => {
    event.preventDefault();
    setOwnerSecurityError('');
    if (ownerSecurityForm.newPassword !== ownerSecurityForm.confirmPassword) {
      setOwnerSecurityError('كلمة المرور الجديدة وتأكيدها غير متطابقين');
      return;
    }
    setOwnerSecurityLoading(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/auth/platform-owner`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ownerSecurityForm)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'تعذر تحديث بيانات المالك');
      alert('تم تحديث بيانات مالك المنصة وإبطال جميع الجلسات. سجّل الدخول بالبيانات الجديدة.');
      store.logout();
    } catch (error) { setOwnerSecurityError(error.message); setOwnerSecurityLoading(false); }
  };

  // Merge store local trial requests and cloud D1 requests seamlessly
  const combinedTrialRequests = useMemo(() => {
    const map = new Map();
    cloudTrialRequests.forEach(r => map.set(r.id, r));
    trialRequests.forEach(r => {
      if (!map.has(r.id)) {
        map.set(r.id, r);
      } else {
        const existing = map.get(r.id);
        if (r.status === 'activated' || existing.status === 'activated') {
          map.set(r.id, { ...existing, ...r, status: 'activated' });
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [cloudTrialRequests, trialRequests]);

  
  const handlePublishRelease = async (e) => {
    e.preventDefault();
    const notesArray = releaseForm.release_notes
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean);

    const newRel = {
      id: 'rel-' + releaseForm.platform + '-' + releaseForm.version.replace(/\./g, '-'),
      platform: releaseForm.platform,
      version: releaseForm.version,
      minimum_version: releaseForm.minimum_version,
      update_type: releaseForm.update_type,
      status: 'published',
      release_notes: notesArray,
      download_url: releaseForm.download_url || (releaseForm.platform === 'windows' ? 'https://zgirt-pos-web-app.pages.dev/downloads/KhodarPOS-Setup.exe' : 'https://zgirt-pos-web-app.pages.dev'),
      published_at: new Date().toISOString()
    };

    try {
      await fetch('/api/releases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRel)
      });
    } catch (err) {
      // offline fallback
    }

    setReleasesList(prev => [newRel, ...prev.filter(r => !(r.platform === newRel.platform && r.version === newRel.version))]);
    setIsReleaseModalOpen(false);
    alert('تم نشر الإصدار بنجاح!');
  };

  if (!isOpen) return null;

  // Generate strong random password
  const generatePassword = () => {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
    let pass = '';
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(pass);
  };

  const handleActivateTrial = (req) => {
    setCompanyName(req.shopName || req.name);
    setPhone(req.phone || '');
    setDurationMonths('1'); // 1 month free trial
    setAllowedBranches('1');
    setNotes(`طلب تجربة مجانية شهر من الموقع: ${req.name} (${req.city || 'المدينة غير محددة'}) - ${req.notes || ''}`);
    
    generateStoreCode();
    // Auto-generate clean unique username
    const baseUser = (req.shopName || 'shop').toLowerCase().replace(/[^a-z0-9]/g, '') || `user${Math.floor(1000 + Math.random() * 9000)}`;
    const randomSuffix = Math.floor(10 + Math.random() * 90);
    setUsername(`${baseUser.slice(0, 10)}${randomSuffix}`);
    generatePassword();
    setFormError('');
    setActivatingTrialId(req.id);
    setIsAddModalOpen(true);
  };

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    setFormError('');

    try {
      const newTenant = await createTenantAccount({
        companyName,
        storeCode: storeCode.trim().toUpperCase(),
        username,
        password,
        phone,
        durationMonths,
        allowedBranches,
        notes
      });

      // Mark trial request as activated if this was initiated from a trial request
      if (activatingTrialId) {
        try {
          const baseUrl = getApiBaseUrl();
          const response = await fetch(`${baseUrl}/api/trial-requests`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: activatingTrialId, status: 'activated', tenantUsername: newTenant.username })
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          if (updateTrialRequest) await updateTrialRequest(activatingTrialId, { status: 'activated', tenantUsername: newTenant.username });
          setActivatingTrialId(null);
        } catch (error) {
          alert('تم إنشاء الحساب، لكن تعذر تحديث طلب التجربة: ' + error.message);
        }
      }

      // Prepare welcome WhatsApp message
      const welcomeText = `مرحباً بكم في منظومة براكه لإدارة نقاط البيع والمحاسبة! 🥬✨\n\nتم تفعيل اشتراككم بنجاح:\n🏬 المنشأة: ${newTenant.companyName}\n🏷️ كود المتجر للربط السريع: ${newTenant.storeCode}\n👤 اسم المستخدم المالك: ${newTenant.username}\n🔑 كلمة المرور المبدئية: تم تعيينها عند إنشاء الحساب\n📅 تاريخ انتهاء الصلاحية: ${newTenant.expiresAt}\n🌐 رابط الدخول المباشر: https://zgirt-pos-web-app.pages.dev/?login=true\n\n💡 ملاحظة هامة:\nيمكن لجميع موظفي المحل تسجيل الدخول من أي جهاز (كمبيوتر / جوال / متصفح) بإدخال كود المتجر (${newTenant.storeCode}) ثم اسم المستخدم الخاص بهم.`;
      
      setCreatedWelcomeMsg({
        text: welcomeText,
        phone: newTenant.phone,
        tenant: newTenant
      });

      // Reset form
      setCompanyName('');
      setStoreCode('');
      setUsername('');
      setPassword('');
      setPhone('');
      setNotes('');
      setIsAddModalOpen(false);
    } catch (err) {
      setFormError(err.message || 'حدث خطأ أثناء إنشاء الحساب');
    }
  };

  const handleOpenEditTenant = (t) => {
    setEditingTenant(t);
    setEditForm({
      companyName: t.companyName || '',
      storeCode: t.storeCode || '',
      username: t.username || '',
      password: t.password || '',
      status: t.status || 'active',
      expiresAt: t.expiresAt || '',
      allowedBranches: t.allowedBranches || 1,
      phone: t.phone || '',
      notes: t.notes || ''
    });
    setEditError('');
    setEditSuccess('');
  };

  const handleSaveEditTenant = async (e) => {
    e.preventDefault();
    setEditError('');
    setEditSuccess('');

    try {
      await updateTenantAccount(editingTenant.id, editForm);
      setEditSuccess('تم حفظ كافة تعديلات المشترك بنجاح!');
      setTimeout(() => {
        setEditingTenant(null);
      }, 800);
    } catch (err) {
      setEditError(err.message || 'حدث خطأ أثناء حفظ التعديلات');
    }
  };

  const handleDeleteTrial = async (reqId, reqName) => {
    if (window.confirm(`هل أنت متأكد من حذف طلب التجربة للتاجر "${reqName || ''}"؟`)) {
      const baseUrl = getApiBaseUrl();
      try {
        const response = await fetch(`${baseUrl}/api/trial-requests?id=${reqId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (deleteTrialRequest) await deleteTrialRequest(reqId);
        setCloudTrialRequests(prev => prev.filter(r => r.id !== reqId));
      } catch (e) {
        alert('تعذر إكمال حذف طلب التجربة: ' + e.message);
      }
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedTenantId(id);
    setTimeout(() => setCopiedTenantId(null), 2000);
  };

  const handleToggleStatus = (tenant) => {
    const newStatus = tenant.status === 'active' ? 'suspended' : 'active';
    void updateTenantAccount(tenant.id, { status: newStatus }).catch(err => alert(err.message));
  };

  const handleExtendSubscription = async (tenant, months) => {
    const currentExp = new Date(tenant.expiresAt || new Date());
    const base = currentExp < new Date() ? new Date() : currentExp;
    base.setMonth(base.getMonth() + months);
    const newDate = base.toISOString().split('T')[0];
    try { await updateTenantAccount(tenant.id, { expiresAt: newDate, status: 'active' }); }
    catch (err) { alert(err.message); return; }
    alert(`تم تمديد اشتراك (${tenant.companyName}) حتى ${newDate}`);
  };

  const filteredTenants = tenants.filter(t => 
    t.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.storeCode && t.storeCode.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (t.phone && t.phone.includes(searchQuery))
  );

  const activeCount = tenants.filter(t => t.status === 'active').length;
  const expiredCount = tenants.filter(t => {
    const today = new Date().toISOString().split('T')[0];
    return t.expiresAt && t.expiresAt < today;
  }).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-6 overflow-y-auto" dir="rtl">
      <div className="w-full max-w-5xl bg-white rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden border border-slate-100 animate-in zoom-in-95">
        
        {/* Top Executive Header */}
        <div className="px-6 py-5 bg-slate-950 text-white flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <ShieldCheck size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-white">بوابة المالك وإدارة المنظومة</h2>
                <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold rounded-full">
                  Super Admin
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                إدارة المشتركين، والتحديثات المركزية لكافة المنصات (Web, Windows, Mobile)
              </p>
            </div>
          </div>

          {/* Center: Tabs Switcher */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('tenants')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'tenants' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              المشتركون والمؤسسات ({tenants.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('trials')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'trials' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>طلبات التجربة (شهر مجاني)</span>
              {combinedTrialRequests.length > 0 && (
                <span className="px-1.5 py-0.2 bg-amber-400 text-slate-950 font-black rounded-full text-[10px]">
                  {combinedTrialRequests.length}
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('security')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'security' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Key size={13} />
              أمان حساب المالك
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('releases')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                activeTab === 'releases' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'
              }`}
            >
              إدارة الإصدارات ({releasesList.length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToStore && (
              <button
                type="button"
                onClick={() => { onClose(); onSwitchToStore(); }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors"
              >
                <span>العودة للمتجر</span>
                <ArrowRight size={14} />
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Dashboard Content */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs">
          
          {/* Tab 1: Tenants SaaS Management */}
          {activeTab === 'tenants' && (
            <>
              {/* Quick Stats Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block">إجمالي المشتركين</span>
                <strong className="text-2xl font-black text-slate-900 font-mono">{tenants.length}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700">
                <Building2 size={20} />
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-emerald-800 block">الاشتراكات السارية والنشطة</span>
                <strong className="text-2xl font-black text-emerald-700 font-mono">{activeCount}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-200/60 flex items-center justify-center text-emerald-800">
                <Check size={20} />
              </div>
            </div>

            <div className="p-4 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-800 block">اشتراكات منتهية تحتاج تجديد</span>
                <strong className="text-2xl font-black text-amber-700 font-mono">{expiredCount}</strong>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-200/60 flex items-center justify-center text-amber-800">
                <Clock size={20} />
              </div>
            </div>
          </div>

          {/* Success Generated Client Message Card */}
          {createdWelcomeMsg && (
            <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-emerald-600" />
                  <h4 className="font-black text-emerald-950 text-sm">
                    تم إنشاء وتفعيل حساب ({createdWelcomeMsg.tenant.companyName}) بنجاح!
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedWelcomeMsg(null)}
                  className="text-xs text-emerald-800 hover:text-emerald-950 font-bold"
                >
                  إغلاق ✕
                </button>
              </div>

              <div className="bg-white p-3 rounded-xl border border-emerald-200 font-mono text-[11px] text-slate-800 whitespace-pre-line leading-relaxed select-all">
                {createdWelcomeMsg.text}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyToClipboard(createdWelcomeMsg.text, 'created-welcome')}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer shadow-sm"
                >
                  {copiedTenantId === 'created-welcome' ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedTenantId === 'created-welcome' ? 'تم نسخ الرسالة!' : 'نسخ الرسالة لإرسالها للعميل'}</span>
                </button>

                {createdWelcomeMsg.phone && (
                  <a
                    href={`https://wa.me/${createdWelcomeMsg.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(createdWelcomeMsg.text)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center gap-1.5 transition-colors"
                  >
                    <MessageCircle size={14} className="text-emerald-400" />
                    <span>إرسال مباشر عبر واتساب العميل</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Action Bar: Search & New Client Button */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                placeholder="البحث باسم المتجر أو اسم المستخدم أو الهاتف..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsSyncingTenants(true);
                if (syncCloudTenants) await syncCloudTenants();
                setIsSyncingTenants(false);
              }}
              disabled={isSyncingTenants}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs"
              title="مزامنة وتحديث قائمة المشتركين من السحابة المركزية"
            >
              <RefreshCw size={14} className={isSyncingTenants ? 'animate-spin' : ''} />
              <span>{isSyncingTenants ? 'جاري التحديث...' : 'تحديث من السحابة'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                generateStoreCode();
                generatePassword();
                setIsAddModalOpen(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
            >
              <Plus size={16} />
              <span>إنشاء اشتراك عميل جديد</span>
            </button>
          </div>

          {/* Tenants Table */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200/80 text-[11px] font-bold text-slate-600">
                    <th className="p-3.5">المتجر / الشركة</th>
                    <th className="p-3.5">كود المتجر (Store Code)</th>
                    <th className="p-3.5">اسم المستخدم (الثابت)</th>
                    <th className="p-3.5">كلمة المرور</th>
                    <th className="p-3.5">حالة الاشتراك</th>
                    <th className="p-3.5 text-center">الفروع المسموحة</th>
                    <th className="p-3.5">تاريخ الانتهاء</th>
                    <th className="p-3.5">الهاتف</th>
                    <th className="p-3.5 text-center">إجراءات المالك السريعة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredTenants.map(tenant => {
                    const isSuper = tenant.role === 'super_admin';
                    const isExpired = tenant.expiresAt && tenant.expiresAt < new Date().toISOString().split('T')[0];
                    const welcomeMsg = `بيانات الدخول لحسابكم في نظام نقاط البيع:\n🏬 المتجر: ${tenant.companyName}\n🏷️ كود المتجر: ${tenant.storeCode || '—'}\n👤 اسم المستخدم: ${tenant.username}\n🔑 كلمة المرور: غير قابلة للاسترجاع\n📅 تاريخ الصلاحية: ${tenant.expiresAt}`;

                    return (
                      <tr key={tenant.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="p-3.5 font-bold text-slate-900">
                          <div className="flex items-center gap-2">
                            <span>{tenant.companyName}</span>
                            {isSuper && (
                              <span className="px-1.5 py-0.5 bg-slate-900 text-white text-[9px] rounded font-mono">المالك</span>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="inline-flex items-center gap-1.5 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200/80 font-mono font-black text-emerald-800 text-xs shadow-2xs" dir="ltr">
                            <span>{tenant.storeCode || '—'}</span>
                            {tenant.storeCode && (
                              <button
                                type="button"
                                onClick={() => copyToClipboard(tenant.storeCode, `code-${tenant.id}`)}
                                className="text-emerald-600 hover:text-emerald-900 transition-colors p-0.5 cursor-pointer"
                                title="نسخ كود المتجر"
                              >
                                {copiedTenantId === `code-${tenant.id}` ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="p-3.5">
                          <div className="inline-flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200/60 font-mono font-bold text-slate-800" dir="ltr">
                            <span>{tenant.username}</span>
                          </div>
                        </td>

                        <td className="p-3.5 font-mono text-slate-700">
                          <span className="bg-slate-50 px-2 py-0.5 rounded border border-slate-200 text-[11px]">
                            {'غير مخزنة في الجهاز'}
                          </span>
                        </td>

                        <td className="p-3.5">
                          {tenant.status === 'suspended' ? (
                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded-full font-bold text-[10px]">
                              معلّق / موقوف
                            </span>
                          ) : isExpired ? (
                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full font-bold text-[10px]">
                              منتهي الصلاحية
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full font-bold text-[10px]">
                              ساري ونشط
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-center">
                          {isSuper ? (
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full font-bold text-[10px]">
                              غير محدود
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingBranchTenant(tenant);
                                setEditBranchesCount(String(tenant.allowedBranches || 1));
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs group"
                              title="اضغط لتعديل وترقية عدد الفروع المسموحة لهذا المتجر"
                            >
                              <Building2 size={12} className="text-blue-600" />
                              <span className="font-mono">{tenant.allowedBranches || 1}</span>
                              <span className="text-[10px]">{Number(tenant.allowedBranches || 1) > 1 ? 'فروع' : 'فرع'}</span>
                              <span className="text-[9px] bg-white px-1 rounded text-blue-600 border border-blue-200 group-hover:bg-blue-600 group-hover:text-white transition-colors">تعديل</span>
                            </button>
                          )}
                        </td>

                        <td className="p-3.5 font-mono font-bold text-slate-700">
                          {isSuper ? 'دائم (غير محدد)' : tenant.expiresAt}
                        </td>

                        <td className="p-3.5 font-mono text-slate-500">
                          {tenant.phone || '—'}
                        </td>

                        <td className="p-3.5">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Full Edit Subscriber button */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditTenant(tenant)}
                              title="تعديل شامل لكافة بيانات واشتراك المشترك (الباسوورد، الكود، الفروع، الصلاحية)"
                              className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-bold shadow-2xs"
                            >
                              <Edit3 size={13} />
                              <span>تعديل شامل</span>
                            </button>

                            {/* Copy Credentials button */}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(welcomeMsg, tenant.id)}
                              title="نسخ بيانات الدخول"
                              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
                            >
                              {copiedTenantId === tenant.id ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                            </button>

                            {/* Reset Password button */}
                            <button
                              type="button"
                              onClick={() => {
                                setResettingTenant(tenant);
                                setNewTenantPass(Math.floor(100000 + Math.random() * 900000).toString());
                                setResetSuccessMsg('');
                              }}
                              title="إعادة تعيين كلمة مرور المشترك"
                              className="p-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                            >
                              <Key size={13} />
                            </button>

                            {/* Extend 3 months button */}
                            {!isSuper && (
                              <button
                                type="button"
                                onClick={() => handleExtendSubscription(tenant, 3)}
                                title="تمديد الاشتراك +3 أشهر"
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                +3 أشهر
                              </button>
                            )}

                            {/* Extend 1 year button */}
                            {!isSuper && (
                              <button
                                type="button"
                                onClick={() => handleExtendSubscription(tenant, 12)}
                                title="تمديد الاشتراك +سنة"
                                className="px-2 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-bold transition-colors"
                              >
                                +سنة
                              </button>
                            )}

                            {/* Toggle suspend button */}
                            {!isSuper && (
                              <button
                                type="button"
                                onClick={() => handleToggleStatus(tenant)}
                                title={tenant.status === 'active' ? 'إيقاف الحساب مؤقتاً' : 'تفعيل الحساب'}
                                className={`p-1.5 rounded-lg transition-colors ${
                                  tenant.status === 'active' 
                                    ? 'bg-amber-50 hover:bg-amber-100 text-amber-700' 
                                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700'
                                }`}
                              >
                                <Power size={13} />
                              </button>
                            )}

                            {/* Delete tenant button */}
                            {!isSuper && (
                              <button
                                type="button"
                                onClick={async () => {
                                  if (window.confirm(`هل أنت متأكد من حذف حساب المشترك (${tenant.companyName}) نهائياً؟`)) {
                                    try { await deleteTenantAccount(tenant.id); }
                                    catch (error) { alert(error.message); }
                                  }
                                }}
                                title="حذف الحساب"
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
            </>
          )}

          {activeTab === 'security' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <form onSubmit={handleOwnerCredentialChange} className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-black text-slate-900">بيانات دخول مالك المنصة</h3>
                  <p className="text-[11px] text-slate-500 mt-1">يتم حفظ البريد وكلمة المرور في D1 فقط. أي تغيير يبطل جميع الجلسات.</p>
                </div>
                {ownerSecurityError && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold">{ownerSecurityError}</div>}
                <label className="block font-bold text-slate-700">البريد الإلكتروني
                  <input type="email" autoComplete="username" required value={ownerSecurityForm.newEmail}
                    onChange={e => setOwnerSecurityForm(form => ({ ...form, newEmail: e.target.value }))}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl" dir="ltr" />
                </label>
                <label className="block font-bold text-slate-700">كلمة المرور الحالية للتأكيد
                  <input type="password" autoComplete="current-password" required value={ownerSecurityForm.currentPassword}
                    onChange={e => setOwnerSecurityForm(form => ({ ...form, currentPassword: e.target.value }))}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl" dir="ltr" />
                </label>
                <label className="block font-bold text-slate-700">كلمة المرور الجديدة (اتركها فارغة لتغيير البريد فقط)
                  <input type="password" autoComplete="new-password" minLength={12} value={ownerSecurityForm.newPassword}
                    onChange={e => setOwnerSecurityForm(form => ({ ...form, newPassword: e.target.value }))}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl" dir="ltr" />
                </label>
                <label className="block font-bold text-slate-700">تأكيد كلمة المرور الجديدة
                  <input type="password" autoComplete="new-password" value={ownerSecurityForm.confirmPassword}
                    onChange={e => setOwnerSecurityForm(form => ({ ...form, confirmPassword: e.target.value }))}
                    className="mt-1 w-full px-3 py-2.5 border border-slate-200 rounded-xl" dir="ltr" />
                </label>
                <button type="submit" disabled={ownerSecurityLoading}
                  className="w-full py-2.5 bg-emerald-600 disabled:opacity-50 text-white rounded-xl font-black flex items-center justify-center gap-2">
                  <ShieldCheck size={16} />{ownerSecurityLoading ? 'جارٍ التحقق والحفظ...' : 'حفظ آمن وإبطال الجلسات'}
                </button>
              </form>
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
                <h3 className="text-sm font-black text-slate-900 mb-3">سجل أمان بيانات الدخول</h3>
                <p className="text-[11px] text-slate-500 mb-4">لا يحتوي هذا السجل كلمات مرور أو رموزاً أو مفاتيح سرية.</p>
                <div className="space-y-2">
                  {ownerSecurity.events.length === 0 && <div className="text-slate-400 py-6 text-center">لا توجد تغييرات مسجلة بعد</div>}
                  {ownerSecurity.events.map(item => (
                    <div key={item.id} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-bold text-slate-800">{item.type === 'platform_owner_password_initialized' ? 'إعداد كلمة المرور الأولى' : 'تحديث بيانات دخول المالك'}</div>
                        <div className="text-[10px] text-slate-500">الحقول: {(item.metadata?.fields || ['password']).join('، ')}</div>
                      </div>
                      <time className="font-mono text-[10px] text-slate-400" dir="ltr">{item.createdAt}</time>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Multi-Platform Release Management */}
          {activeTab === 'releases' && (
            <div className="space-y-6">
              {/* Platform Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Windows Card */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Monitor size={20} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      مستقر (Production)
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">برنامج سطح المكتب (Windows)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Electron 40 + SQLite / Cloud D1</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">الإصدار الحالي:</span>
                      <span className="font-mono font-black text-blue-600">v{APP_VERSION}</span>
                    </div>
                  </div>
                </div>

                {/* Android Card */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                      <Smartphone size={20} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      جاهز للتثبيت (APK)
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">تطبيق الجوال (Android)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Capacitor 7 + Touch UX</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">الإصدار الحالي:</span>
                      <span className="font-mono font-black text-emerald-600">v{APP_VERSION}</span>
                    </div>
                  </div>
                </div>

                {/* Web Card */}
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col justify-between">
                  <div className="flex items-center justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Globe size={20} />
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      سحابي نشط (Edge CDN)
                    </span>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-800 text-sm">منصة الويب (Web App)</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">Cloudflare Pages + Edge APIs</p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">الإصدار الحالي:</span>
                      <span className="font-mono font-black text-indigo-600">v{APP_VERSION}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Releases Table & Action Bar */}
              <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">سجل الإصدارات المعتمدة وقواعد التحديث عبر المنصات</h3>
                    <p className="text-[11px] text-slate-500">
                      يتم فحص هذا السجل بواسطة جميع التطبيقات (سطح المكتب، الجوال، الويب) لإخطار المستخدمين بالتحديثات وفرض التحديثات الإجبارية.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsReleaseModalOpen(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors shadow-sm"
                  >
                    <Plus size={15} />
                    <span>إضافة إصدار جديد</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500 font-semibold text-[11px]">
                        <th className="py-2.5 px-3">المنصة</th>
                        <th className="py-2.5 px-3">رقم الإصدار</th>
                        <th className="py-2.5 px-3">الحد الأدنى المدعوم</th>
                        <th className="py-2.5 px-3">مستوى الإلزامية</th>
                        <th className="py-2.5 px-3">أبرز التحسينات والميزات</th>
                        <th className="py-2.5 px-3">تاريخ النشر</th>
                        <th className="py-2.5 px-3 text-center">الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {releasesList.map((rel) => {
                        const isMandatory = rel.update_type === 'required';
                        const isRecommended = rel.update_type === 'recommended';
                        return (
                          <tr key={rel.id} className="hover:bg-slate-100/60 transition-colors">
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-2 font-bold text-slate-800">
                                {rel.platform === 'windows' && <Monitor size={15} className="text-blue-600" />}
                                {rel.platform === 'android' && <Smartphone size={15} className="text-emerald-600" />}
                                {rel.platform === 'ios' && <Smartphone size={15} className="text-purple-600" />}
                                {rel.platform === 'web' && <Globe size={15} className="text-indigo-600" />}
                                <span className="capitalize">{rel.platform}</span>
                              </div>
                            </td>
                            <td className="py-3 px-3">
                              <span className="font-mono font-bold bg-slate-200/70 text-slate-800 px-2 py-0.5 rounded-md">
                                v{rel.version}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-600">
                              v{rel.minimum_version}
                            </td>
                            <td className="py-3 px-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                isMandatory 
                                  ? 'bg-rose-100 text-rose-800' 
                                  : isRecommended 
                                    ? 'bg-amber-100 text-amber-800' 
                                    : 'bg-emerald-100 text-emerald-800'
                              }`}>
                                {isMandatory ? 'إجباري (Required)' : isRecommended ? 'موصى به (Recommended)' : 'اختياري (Optional)'}
                              </span>
                            </td>
                            <td className="py-3 px-3 max-w-xs">
                              <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-0.5">
                                {(Array.isArray(rel.release_notes) ? rel.release_notes : [rel.release_notes]).slice(0, 2).map((n, i) => (
                                  <li key={i} className="truncate" title={n}>{n}</li>
                                ))}
                              </ul>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-500 text-[11px]">
                              {rel.published_at ? rel.published_at.substring(0, 10) : '2026-03-18'}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {rel.download_url && (
                                <a
                                  href={rel.download_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-[11px] font-bold transition-colors"
                                >
                                  <Download size={12} />
                                  <span>تنزيل</span>
                                </a>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Free 1-Month Trial Requests (Leads) */}
          {activeTab === 'trials' && (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block">إجمالي طلبات التجربة</span>
                    <span className="text-2xl font-black text-slate-900 mt-1 block">{combinedTrialRequests.length}</span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                    <Sparkles size={22} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block">طلبات بانتظار التفعيل</span>
                    <span className="text-2xl font-black text-amber-600 mt-1 block">
                      {combinedTrialRequests.filter(r => r.status !== 'activated').length}
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold">
                    <Clock size={22} />
                  </div>
                </div>

                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-xs text-slate-500 font-bold block">تم تفعيل اشتراكهم المجاني</span>
                    <span className="text-2xl font-black text-emerald-600 mt-1 block">
                      {combinedTrialRequests.filter(r => r.status === 'activated').length}
                    </span>
                  </div>
                  <div className="w-11 h-11 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                    <ShieldCheck size={22} />
                  </div>
                </div>
              </div>

              {/* Trials Table Card */}
              <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-xs">
                <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-amber-500" />
                    <h3 className="font-bold text-slate-800 text-sm">طلبات تجربة المنظومة (شهر مجاني) الواردة من الموقع والسحابة</h3>
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                      {combinedTrialRequests.length} طلب
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={fetchCloudTrials}
                      disabled={isLoadingTrials}
                      className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                      title="فحص السحابة لجلب أي طلبات تجربة جديدة فوراً"
                    >
                      <RefreshCw size={13} className={isLoadingTrials ? 'animate-spin' : ''} />
                      <span>تحديث من السحابة</span>
                    </button>
                    <p className="text-xs text-slate-500 font-medium hidden sm:block">
                      تفعيل الحساب يملأ كود المتجر وبيانات الدخول ومراسلتهم واتساب
                    </p>
                  </div>
                </div>

                {combinedTrialRequests.length === 0 ? (
                  <div className="py-16 px-4 text-center">
                    <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                      <Sparkles size={28} />
                    </div>
                    <h4 className="font-bold text-slate-800 text-sm">لا توجد طلبات تجربة واردة حالياً</h4>
                    <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                      عند قيام أي تاجر أو عميل بالضغط على زر "طلب تجربة مجانية لمدة شهر" في الموقع وتعبئة بياناته، ستصل رسالته إلى منصة المالك هنا فوراً لمراجعتها وتفعيل حسابه.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold">
                        <tr>
                          <th className="py-3 px-4">تاريخ الطلب</th>
                          <th className="py-3 px-4">التاجر / اسم المتجر</th>
                          <th className="py-3 px-4">رقم الهاتف / واتساب</th>
                          <th className="py-3 px-4">المدينة</th>
                          <th className="py-3 px-4">ملاحظات العميل</th>
                          <th className="py-3 px-4 text-center">الحالة</th>
                          <th className="py-3 px-4 text-center">الإجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {combinedTrialRequests.map((req) => {
                          const isActivated = req.status === 'activated';
                          const cleanPhone = (req.phone || '').replace(/[^0-9]/g, '');
                          const waUrl = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('0') ? '20' + cleanPhone.slice(1) : cleanPhone}` : null;
                          const formattedDate = req.createdAt 
                            ? new Date(req.createdAt).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                            : 'حديثاً';

                          return (
                            <tr key={req.id} className={`hover:bg-slate-50/80 transition-colors ${isActivated ? 'bg-slate-50/40' : 'bg-amber-50/20'}`}>
                              <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">
                                {formattedDate}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 text-sm">{req.name}</div>
                                <div className="text-slate-500 text-[11px] font-medium flex items-center gap-1 mt-0.5">
                                  <Building2 size={11} className="text-slate-400" />
                                  <span>{req.shopName || 'متجر جديد'}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 font-mono font-bold text-slate-800">
                                <div className="flex items-center gap-2">
                                  <span>{req.phone || '—'}</span>
                                  {waUrl && (
                                    <a
                                      href={waUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-sans text-[11px] font-bold transition-colors"
                                      title="فتح محادثة واتساب مع التاجر"
                                    >
                                      <MessageCircle size={12} />
                                      <span>واتساب</span>
                                    </a>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600 font-medium">
                                {req.city || 'غير محدد'}
                              </td>
                              <td className="py-3 px-4 text-slate-500 max-w-[200px] truncate" title={req.notes}>
                                {req.notes || '—'}
                              </td>
                              <td className="py-3 px-4 text-center">
                                {isActivated ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                    <ShieldCheck size={12} />
                                    <span>تم التفعيل (شهر مجاني)</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 animate-pulse">
                                    <Clock size={12} />
                                    <span>بانتظار التفعيل</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-center">
                                <div className="flex items-center justify-center gap-1.5">
                                  {!isActivated ? (
                                    <button
                                      type="button"
                                      onClick={() => handleActivateTrial(req)}
                                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                                    >
                                      <Plus size={13} />
                                      <span>تفعيل شهر مجاني</span>
                                    </button>
                                  ) : (
                                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
                                      الحساب: {req.tenantUsername || 'نشط'}
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTrial(req.id, req.name)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                    title="حذف الطلب"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Add Client Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 text-right">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-emerald-600" />
                <h3 className="font-black text-sm text-slate-900">إنشاء اشتراك متجر / شركة جديد</h3>
              </div>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateTenant} className="space-y-3.5 text-xs">
              
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المتجر أو الشركة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مؤسسة ثمار البركة للتجارة"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>كود المتجر السحابي (Store Code) *</span>
                    <button
                      type="button"
                      onClick={generateStoreCode}
                      className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                    >
                      توليد كود
                    </button>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: BRK-101"
                    value={storeCode}
                    onChange={(e) => setStoreCode(e.target.value.toUpperCase())}
                    className="w-full px-3 py-2.5 bg-emerald-50/40 border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-900 focus:ring-2 focus:ring-emerald-500 uppercase tracking-wider"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">كود ربط المحطة الذي يدخله الكاشير والموظفون</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    اسم المستخدم الثابت (Unique Username) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: albaraka"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">حساب المالك الرئيسي للمتجر (حروف وأرقام)</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>كلمة المرور المبدئية *</span>
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="text-[10px] text-emerald-700 hover:underline font-bold cursor-pointer"
                  >
                    توليد كلمة سر
                  </button>
                </label>
                <input
                  type="text"
                  required
                  placeholder="مثال: Pass@123"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  dir="ltr"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    الفروع المسموحة *
                  </label>
                  <select
                    value={allowedBranches}
                    onChange={(e) => setAllowedBranches(e.target.value)}
                    className="w-full px-2.5 py-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-bold text-blue-900 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="1">1 فرع (فردي)</option>
                    <option value="2">2 فرعان</option>
                    <option value="3">3 فروع</option>
                    <option value="5">5 فروع</option>
                    <option value="10">10 فروع</option>
                    <option value="20">20 فرعاً</option>
                    <option value="999">غير محدود</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">مدة الاشتراك</label>
                  <select
                    value={durationMonths}
                    onChange={(e) => setDurationMonths(e.target.value)}
                    className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="1">شهر (تجريبي)</option>
                    <option value="3">3 أشهر</option>
                    <option value="6">6 أشهر</option>
                    <option value="12">سنة كاملة</option>
                    <option value="24">سنتان</option>
                    <option value="0">دائم</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">هاتف العميل</label>
                  <input
                    type="text"
                    placeholder="0501234567"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500"
                    dir="ltr"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات داخلية للمالك</label>
                <input
                  type="text"
                  placeholder="مثال: تم السداد بحوالة الراجحي 1200 ريال"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                >
                  <Plus size={16} />
                  <span>تفعيل وحفظ الاشتراك</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Comprehensive Edit Tenant Modal (تعديل شامل لكافة بيانات واشتراك المشترك) */}
      {editingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-3 sm:p-4 text-right overflow-y-auto">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-5 sm:p-6 space-y-4 animate-in zoom-in-95 max-h-[92vh] flex flex-col">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center font-bold">
                  <Edit3 size={18} />
                </div>
                <div>
                  <h3 className="font-black text-sm text-slate-900">تعديل شامل لبيانات المشترك والاشتراك</h3>
                  <span className="text-[10px] text-slate-400">تحكم كامل في كلمة المرور، كود المتجر، الصلاحية، والفروع</span>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setEditingTenant(null)}
                className="text-slate-400 hover:text-slate-600 font-bold p-1 rounded-lg cursor-pointer"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl font-bold text-xs shrink-0">
                {editError}
              </div>
            )}

            {editSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl font-bold text-xs shrink-0">
                {editSuccess}
              </div>
            )}

            <form onSubmit={handleSaveEditTenant} className="space-y-3.5 text-xs overflow-y-auto pr-1">
              
              {/* Row 1: Company Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">اسم المتجر أو المؤسسة *</label>
                <input
                  type="text"
                  required
                  value={editForm.companyName}
                  onChange={(e) => setEditForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Row 2: Store Code + Username */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span>كود المتجر (Store Code) *</span>
                    <button
                      type="button"
                      onClick={() => {
                        const num = Math.floor(100 + Math.random() * 900);
                        setEditForm(prev => ({ ...prev, storeCode: `BRK-${num}` }));
                      }}
                      className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                    >
                      توليد كود
                    </button>
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.storeCode}
                    onChange={(e) => setEditForm(prev => ({ ...prev, storeCode: e.target.value.toUpperCase() }))}
                    className="w-full px-3 py-2.5 bg-emerald-50/50 border border-emerald-300 rounded-xl text-xs font-mono font-black text-emerald-900 uppercase tracking-wider focus:ring-2 focus:ring-emerald-500"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">كود ربط المحطة للكاشير</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    اسم المستخدم (Username) *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.username}
                    onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') }))}
                    className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500"
                    dir="ltr"
                  />
                  <span className="text-[10px] text-slate-400 mt-0.5 block">حساب تسجيل الدخول</span>
                </div>
              </div>

              {/* Row 3: Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>كلمة المرور *</span>
                  <button
                    type="button"
                    onClick={() => {
                      const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
                      let p = '';
                      for (let i = 0; i < 6; i++) p += chars.charAt(Math.floor(Math.random() * chars.length));
                      setEditForm(prev => ({ ...prev, password: p }));
                    }}
                    className="text-[10px] text-blue-600 hover:underline font-bold cursor-pointer"
                  >
                    توليد كلمة سر
                  </button>
                </label>
                <input
                  type="text"
                  required
                  value={editForm.password}
                  onChange={(e) => setEditForm(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-amber-500"
                  dir="ltr"
                />
              </div>

              {/* Row 4: Status & Allowed Branches */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">حالة الاشتراك</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full px-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="active">ساري ونشط (Active)</option>
                    <option value="suspended">معلّق / موقوف (Suspended)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">الفروع المسموحة</label>
                  <select
                    value={editForm.allowedBranches}
                    onChange={(e) => setEditForm(prev => ({ ...prev, allowedBranches: e.target.value }))}
                    className="w-full px-2.5 py-2.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-bold text-blue-900"
                  >
                    <option value="1">1 فرع (فردي)</option>
                    <option value="2">2 فرعان</option>
                    <option value="3">3 فروع</option>
                    <option value="5">5 فروع</option>
                    <option value="10">10 فروع</option>
                    <option value="20">20 فرعاً</option>
                    <option value="999">غير محدود</option>
                  </select>
                </div>
              </div>

              {/* Row 5: Expiration Date + Quick Extensions */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span>تاريخ انتهاء الاشتراك</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        const base = new Date(editForm.expiresAt || new Date());
                        base.setMonth(base.getMonth() + 1);
                        setEditForm(prev => ({ ...prev, expiresAt: base.toISOString().split('T')[0] }));
                      }}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      + شهر
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = new Date(editForm.expiresAt || new Date());
                        base.setMonth(base.getMonth() + 3);
                        setEditForm(prev => ({ ...prev, expiresAt: base.toISOString().split('T')[0] }));
                      }}
                      className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-[10px] font-bold hover:bg-emerald-100 transition-colors cursor-pointer"
                    >
                      + 3 أشهر
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const base = new Date(editForm.expiresAt || new Date());
                        base.setFullYear(base.getFullYear() + 1);
                        setEditForm(prev => ({ ...prev, expiresAt: base.toISOString().split('T')[0] }));
                      }}
                      className="px-2 py-0.5 bg-emerald-100 text-emerald-900 border border-emerald-300 rounded-lg text-[10px] font-bold hover:bg-emerald-200 transition-colors cursor-pointer"
                    >
                      + سنة
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditForm(prev => ({ ...prev, expiresAt: '2099-12-31' }))}
                      className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded-lg text-[10px] font-bold hover:bg-slate-200 transition-colors cursor-pointer"
                    >
                      دائم
                    </button>
                  </div>
                </label>
                <input
                  type="date"
                  value={editForm.expiresAt || ''}
                  onChange={(e) => setEditForm(prev => ({ ...prev, expiresAt: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  dir="ltr"
                />
              </div>

              {/* Row 6: Phone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">هاتف المشترك / واتساب</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  dir="ltr"
                  placeholder="05XXXXXXXX"
                />
              </div>

              {/* Row 7: Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">ملاحظات وسجل العميل</label>
                <input
                  type="text"
                  value={editForm.notes}
                  onChange={(e) => setEditForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
                  placeholder="ملاحظات دفع أو شروط خاصة..."
                />
              </div>

              {/* Bottom Actions */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingTenant(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                  >
                    إلغاء
                  </button>

                  {editingTenant.role !== 'super_admin' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (window.confirm(`هل أنت متأكد من حذف حساب المشترك (${editingTenant.companyName}) نهائياً؟`)) {
                          try {
                            await deleteTenantAccount(editingTenant.id);
                            setEditingTenant(null);
                          } catch (error) { alert(error.message); }
                        }
                      }}
                      className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Trash2 size={14} />
                      <span>حذف الحساب</span>
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Check size={16} />
                  <span>حفظ كافة التعديلات</span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Edit Branches Limit Modal (تعديل كوتة الفروع للمشترك) */}
      {editingBranchTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 text-right">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 size={20} className="text-blue-600" />
                <h3 className="font-black text-sm text-slate-900">ترقية وتعديل كوتة الفروع المسموحة</h3>
              </div>
              <button 
                onClick={() => setEditingBranchTenant(null)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="p-3.5 bg-blue-50/70 border border-blue-200/80 rounded-2xl text-xs space-y-1">
              <div className="font-bold text-blue-950">المتجر: {editingBranchTenant.companyName}</div>
              <div className="text-slate-500 font-mono text-[11px]" dir="ltr">@{editingBranchTenant.username}</div>
              <div className="text-blue-700 text-[11px] pt-1 leading-relaxed">
                هذه الميزة تمكنك كمالك للمنصة من زيادة عدد الفروع المسموحة للعميل عند ترقية اشتراكه أو دفع رسوم إضافية عن كل فرع جديد.
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-2">
                اختر الباقة المطلوبة للفروع:
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {[
                  { count: '1', label: '1 فرع (أساسي)' },
                  { count: '2', label: '2 فرعان' },
                  { count: '3', label: '3 فروع' },
                  { count: '5', label: '5 فروع' },
                  { count: '10', label: '10 فروع' },
                  { count: '999', label: 'غير محدود' }
                ].map(item => (
                  <button
                    key={item.count}
                    type="button"
                    onClick={() => setEditBranchesCount(item.count)}
                    className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                      editBranchesCount === item.count
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <label className="block text-xs font-bold text-slate-700 mb-1">
                أو اكتب عدداً مخصصاً للفروع يدوياً:
              </label>
              <input
                type="number"
                min="1"
                max="999"
                value={editBranchesCount}
                onChange={e => setEditBranchesCount(e.target.value)}
                className="w-full h-10 px-3 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 font-mono"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingBranchTenant(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={async () => {
                  const count = Math.max(1, parseInt(editBranchesCount, 10) || 1);
                  try {
                    await updateTenantAccount(editingBranchTenant.id, { allowedBranches: count });
                    setEditingBranchTenant(null);
                  } catch (error) { alert(error.message); }
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs"
              >
                حفظ الترقية وتحديث الفروع
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add New Release Modal */}
      {isReleaseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 text-right">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag size={20} className="text-blue-600" />
                <h3 className="font-black text-sm text-slate-900">نشر إصدار وتحديث جديد للمنظومة</h3>
              </div>
              <button 
                onClick={() => setIsReleaseModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handlePublishRelease} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">المنصة المستهدفة *</label>
                  <select
                    value={releaseForm.platform}
                    onChange={(e) => setReleaseForm({ ...releaseForm, platform: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="windows">برنامج سطح المكتب (Windows)</option>
                    <option value="android">تطبيق الجوال (Android)</option>
                    <option value="web">منصة الويب السحابية (Web)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">مستوى إلزامية التحديث *</label>
                  <select
                    value={releaseForm.update_type}
                    onChange={(e) => setReleaseForm({ ...releaseForm, update_type: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900"
                  >
                    <option value="optional">اختياري (Optional) - تحسينات بسيطة</option>
                    <option value="recommended">موصى به (Recommended) - مزايا جديدة</option>
                    <option value="required">إجباري (Required) - أمان وتغييرات هيكلية</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">رقم الإصدار الجديد (SemVer) *</label>
                  <input
                    type="text"
                    required
                    placeholder="2.4.1"
                    value={releaseForm.version}
                    onChange={(e) => setReleaseForm({ ...releaseForm, version: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">أدنى إصدار مسموح بتشغيله *</label>
                  <input
                    type="text"
                    required
                    placeholder="2.2.0"
                    value={releaseForm.minimum_version}
                    onChange={(e) => setReleaseForm({ ...releaseForm, minimum_version: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-900"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">رابط التنزيل المباشر (اختياري)</label>
                <input
                  type="url"
                  placeholder="https://zgirt-pos-web-app.pages.dev/downloads/KhodarPOS-Setup.exe"
                  value={releaseForm.download_url}
                  onChange={(e) => setReleaseForm({ ...releaseForm, download_url: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-800 text-left dir-ltr"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">سجل التغييرات والميزات (سطر لكل نقطة) *</label>
                <textarea
                  rows={4}
                  required
                  placeholder="إضافة دعم طباعة الفواتير على طابعات البلوتوث&#10;تحسين أداء مزامنة السحابة مع Cloudflare D1&#10;إصلاح مشكلة احتساب الخصم المئوي"
                  value={releaseForm.release_notes}
                  onChange={(e) => setReleaseForm({ ...releaseForm, release_notes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 leading-relaxed resize-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setIsReleaseModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء
                </button>

                <button
                  type="submit"
                  className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md shadow-blue-600/20 transition-all cursor-pointer"
                >
                  <Tag size={16} />
                  <span>اعتماد ونشر التحديث فوراً</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Tenant Password Modal */}
      {resettingTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                  <Key size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">إعادة تعيين كلمة مرور المشترك</h3>
                  <p className="text-xs text-slate-500">{resettingTenant.companyName || resettingTenant.name}</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setResettingTenant(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {resetSuccessMsg ? (
              <div className="py-4 space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <Check size={24} />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-slate-900 text-sm">تم تغيير كلمة المرور بنجاح!</h4>
                  <p className="text-xs text-slate-500">كلمة المرور الجديدة هي:</p>
                  <p className="font-mono font-bold text-base text-emerald-700 bg-emerald-50 py-2 rounded-xl border border-emerald-200">
                    {newTenantPass}
                  </p>
                </div>

                <div className="flex flex-col gap-2 pt-2">
                  {resettingTenant.phone && (
                    <a
                      href={`https://wa.me/${resettingTenant.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`مرحباً ${resettingTenant.companyName}، تم إعادة تعيين كلمة المرور الخاصة بحسابكم على منظومة براكه بنجاح.\nاسم المستخدم: ${resettingTenant.username}\nكلمة المرور الجديدة: ${newTenantPass}\nرابط الدخول: https://zgirt-pos-web-app.pages.dev`)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
                    >
                      <MessageCircle size={15} />
                      <span>إرسال البيانات للمشترك عبر واتساب</span>
                    </a>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(`اسم المستخدم: ${resettingTenant.username}\nكلمة المرور الجديدة: ${newTenantPass}`);
                      alert('تم نسخ البيانات للحافظة');
                    }}
                    className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                  >
                    <Copy size={15} />
                    <span>نسخ بيانات الدخول</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setResettingTenant(null)}
                    className="w-full py-2 text-slate-400 hover:text-slate-600 text-xs font-medium"
                  >
                    إغلاق
                  </button>
                </div>
              </div>
            ) : (
              <form 
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!newTenantPass || newTenantPass.length < 4) {
                    alert('كلمة المرور يجب أن لا تقل عن 4 خانات');
                    return;
                  }
                  if (adminResetTenantPassword) {
                    adminResetTenantPassword(resettingTenant.id, newTenantPass);
                  }
                  setResetSuccessMsg('تم تعيين كلمة المرور بنجاح');
                }}
                className="space-y-4"
              >
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">اسم المستخدم:</span>
                    <span className="font-mono font-bold text-slate-800">{resettingTenant.username}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">البريد الإلكتروني:</span>
                    <span className="font-mono text-slate-700">{resettingTenant.email || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">رقم الهاتف:</span>
                    <span className="font-mono text-slate-700">{resettingTenant.phone || '—'}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold text-slate-700">كلمة المرور الجديدة</label>
                    <button
                      type="button"
                      onClick={() => setNewTenantPass(Math.floor(100000 + Math.random() * 900000).toString())}
                      className="text-[11px] text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw size={11} />
                      <span>توليد كلمة سر عشوائية</span>
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={newTenantPass}
                    onChange={(e) => setNewTenantPass(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-800 text-center tracking-wider focus:outline-none focus:ring-2 focus:ring-amber-500 focus:bg-white"
                  />
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setResettingTenant(null)}
                    className="w-1/3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="w-2/3 py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-md shadow-amber-600/20 flex items-center justify-center gap-2"
                  >
                    <Key size={14} />
                    <span>تأكيد وتغيير كلمة المرور</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

