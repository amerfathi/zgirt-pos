import React, { useState } from 'react';
import { 
  Store, ShieldCheck, CheckCircle2, ArrowLeft, Download, 
  ShoppingCart, Truck, Users, Scale, FileText, Smartphone, Monitor,
  Globe, MessageCircle, Phone, Sparkles, ChevronRight, X, Clock,
  DollarSign, Check, Award, BarChart3, Lock, HelpCircle, ArrowDownToLine,
  Layers, Package, AlertOctagon, Receipt, Sparkle, ExternalLink
} from 'lucide-react';
import { Button, Badge } from './ui';
import { APP_VERSION, getApiBaseUrl } from '../config/appVersion';
import { BRRAKA_LOGO } from '../assets/branding';

export default function MarketingLandingPage({ onOpenLogin, store }) {
  const [isTrialModalOpen, setIsTrialModalOpen] = useState(false);
  const [trialForm, setTrialForm] = useState({
    name: '',
    shopName: '',
    phone: '',
    city: '',
    notes: ''
  });
  const [trialError, setTrialError] = useState('');
  const [trialSending, setTrialSending] = useState(false);
  const [trialSubmitted, setTrialSubmitted] = useState(false);

  const handleTrialSubmit = async (e) => {
    e.preventDefault();
    if (trialSending) return;
    setTrialError('');
    if (!trialForm.name || !trialForm.phone || !trialForm.shopName) return;

    const payload = {
      id: `trial-${Date.now()}`,
      name: trialForm.name.trim(),
      shopName: trialForm.shopName.trim(),
      phone: trialForm.phone.trim(),
      city: (trialForm.city || '').trim(),
      notes: (trialForm.notes || '').trim(),
      status: 'pending',
      createdAt: new Date().toISOString().split('T')[0],
      timestamp: Date.now()
    };

    setTrialSending(true);
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/trial-requests`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'لم يؤكد الخادم حفظ الطلب');
    } catch (error) {
      setTrialError(error.message || 'تعذر حفظ الطلب. لم يتم تأكيد إرساله.');
      return;
    } finally { setTrialSending(false); }

    // 4. Build WhatsApp notification
    const message = encodeURIComponent(
      `مرحباً، أود طلب تجربة مجانية لمدة شهر لمنظومة براكه للكاشير والمحاسبة:\n` +
      `- الاسم: ${trialForm.name}\n` +
      `- المنشأة: ${trialForm.shopName}\n` +
      `- رقم الهاتف: ${trialForm.phone}\n` +
      `- المدينة: ${trialForm.city || 'غير محدد'}\n` +
      `- ملاحظات: ${trialForm.notes || 'لا يوجد'}`
    );

    setTrialSubmitted(true);

    // Open WhatsApp in new tab
    setTimeout(() => {
      window.open(`https://wa.me/966564982852?text=${message}`, '_blank');
    }, 600);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-primary-500 selection:text-white" dir="rtl">
      
      {/* 1. SaaS Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <img 
              src={BRRAKA_LOGO} 
              alt="براكه" 
              className="w-12 h-12 rounded-2xl object-contain shadow-xs" 
            />
            <div>
              <span className="font-bold text-base text-slate-900 block tracking-tight">براكه | Brraka</span>
              <span className="text-[11px] text-slate-500 block font-medium">المبيعات والحسابات في مكان واحد</span>
            </div>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-6 text-xs font-semibold text-slate-600">
            <a href="#about" className="hover:text-primary-600 transition-colors">عن المنظومة</a>
            <a href="#steps" className="hover:text-primary-600 transition-colors">تجربة مجانية شهر</a>
            <a href="#features" className="hover:text-primary-600 transition-colors">المميزات المحاسبية</a>
            <a href="#platforms" className="hover:text-primary-600 transition-colors">التحميل والتشغيل</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onOpenLogin}
              className="py-2 px-4 rounded-xl border border-slate-300 hover:border-slate-400 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => { setTrialSubmitted(false); setIsTrialModalOpen(true); }}
              className="py-2 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-sm shadow-primary-600/20 cursor-pointer flex items-center gap-1.5"
            >
              <MessageCircle size={14} className="text-primary-200" />
              <span>اطلب تجربة مجانية شهر</span>
            </button>
          </div>

        </div>
      </header>

      {/* 2. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-28 bg-gradient-to-b from-slate-50 via-white to-slate-50/50 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 relative z-10">
          
          <div className="text-center max-w-3xl mx-auto">
            {/* Top Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-50 border border-primary-200/80 text-primary-800 text-xs font-semibold mb-6 shadow-2xs">
              <span className="flex h-2 w-2 rounded-full bg-primary-500" />
              <span>براكه {APP_VERSION} للويب وسطح المكتب وأندرويد</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-5xl font-black text-slate-950 tracking-normal leading-normal sm:leading-[1.3] mb-6">
              إدارة البيع والمخزون والحسابات <span className="text-primary-600">لمتجرك وفروعك</span>
            </h1>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed mb-8 max-w-2xl mx-auto">
              سجّل المبيعات والمشتريات، تابع المخزون وأرصدة العملاء والموردين، واطبع فواتيرك وتقاريرك من مكان واحد.
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3.5 mb-10">
              <button
                type="button"
                onClick={() => { setTrialSubmitted(false); setIsTrialModalOpen(true); }}
                className="w-full sm:w-auto py-3 px-8 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-bold shadow-lg shadow-primary-600/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>اطلب تجربة مجانية لمدة شهر</span>
                <ArrowLeft size={16} />
              </button>
              <button
                type="button"
                onClick={onOpenLogin}
                className="w-full sm:w-auto py-3 px-6 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-sm font-bold transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Lock size={15} className="text-slate-500" />
                <span>تسجيل الدخول للنظام</span>
              </button>
            </div>

            {/* Guarantees Badges */}
            <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-medium pt-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-primary-600" />
                <span>اطلب تجربة لمدة شهر</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-primary-600" />
                <span>أضف أصناف متجرك وأسعاره</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-primary-600" />
                <span>دعم سطح المكتب وأندرويد والويب</span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 3. Product Intro & Spotlight Cards (كروت تعريفية عن المنظومة) */}
      <section id="about" className="py-16 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-2 block">
              نظرة عامة على المنظومة
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ما الذي يمكنك إدارته في براكه؟
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              أدوات للبيع والمشتريات والمخزون والحسابات اليومية في واجهة واحدة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Card 1 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
                    <Scale size={24} />
                  </div>
                  <Badge variant="accent" size="sm">البيع والوزن</Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">البيع والكاشير</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  أصدر فواتير البيع، وسجّل الأوزان والأسعار، وتابع طرق الدفع من شاشة الكاشير.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>تصفير الوزن التلقائي والوزن الفارغ (Tare)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>طباعة الفواتير ومشاركة بياناتها</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>دعم البيع النقدي والشبكة والآجل</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 2 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
                    <Truck size={24} />
                  </div>
                  <Badge variant="accent" size="sm">إدارة التوريد</Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">التوريد وحسابات الموردين والأمانات</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  تسجيل حركات التوريد اليومية بالكيلو والقفص والشوال، مع متابعة دقيقة لحسابات الموردين والدفعات المسددة والمتبقية، وكشف حساب تفصيلي لكل مورد وسائق توريد.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>متابعة تكلفة الأصناف والشراء</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>سندات صرف دفعات نقدية وبنكية للموردين</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>توثيق أمانات ومرتجع المشتريات المباشر</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 3 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
                    <Users size={24} />
                  </div>
                  <Badge variant="accent" size="sm">الديون والتحصيل</Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">العملاء الآجلين وسجل الديون</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  تابع مبيعات الآجل وأرصدة العملاء، وسجّل الدفعات وراجع كشف حساب كل عميل.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>كشوفات حساب تفصيلية جاهزة للطباعة والإرسال</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>تسجيل دفعات جزئية أو كاملة وتحديث الرصيد فوراً</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>متابعة المبالغ المستحقة لكل عميل</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 4 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
                    <DollarSign size={24} />
                  </div>
                  <Badge variant="accent" size="sm">الرقابة المالية</Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">مطابقة الدرج وجرد الخزينة</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  قارن النقدية الموجودة في الدرج بالرصيد المتوقع وسجّل نتيجة الجرد.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>إغلاق الوردية وجرد النقدية وتوثيق عهدة الصندوق</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>رصد المصروفات التشغيلية والنثريات وسندات الصرف</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>حسابات الشركاء وتوزيع الأرباح والمسحوبات الشخصية</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 5 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
                    <AlertOctagon size={24} />
                  </div>
                  <Badge variant="accent" size="sm">حصر الهالك</Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">إدارة التوالف وحصر الهالك</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  تتميز تجارة الخضار والفواكه بحساسية الهالك اليومي؛ يوفر النظام شاشة خاصة لتسجيل التوالف بالوزن والتكلفة واحتساب أثرها المالي المباشر على أرباح المحل.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>توثيق أسباب الهالك (فرز، تلف طبيعي، كسر)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>خصم الكميات التالفة من المخزون تلقائياً لمنع العجز</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>تقارير شهرية بنسبة الهالك لتعديل سياسات الشراء</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Card 6 */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-slate-50 to-white border border-slate-200/90 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-primary-50 text-primary-600 flex items-center justify-center border border-primary-100">
                    <FileText size={24} />
                  </div>
                  <Badge variant="neutral" size="sm">تقارير قابلة للطباعة</Badge>
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">التقارير المالية</h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-4">
                  اطلع على المبيعات والمشتريات والمصروفات والربح، واطبع التقارير المتاحة بحجم A4.
                </p>
                <ul className="space-y-2 text-xs text-slate-500 border-t border-slate-100 pt-3">
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>عرض الإيرادات والمصروفات وصافي الربح</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>مراجعة حركة المبيعات والمشتريات</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check size={14} className="text-primary-600" />
                    <span>طباعة التقارير وحفظها حسب جهازك</span>
                  </li>
                </ul>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 4. 4-Step Process: "جرّب النظام لمدة شهر" */}
      <section id="steps" className="py-16 sm:py-20 bg-slate-50/60 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-2 block">
              كيف تبدأ
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              كيف تبدأ تجربة النظام مجاناً لمدة شهر؟
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              أرسل طلبك، وسنتواصل معك لترتيب تجربة النظام.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            
            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs relative">
              <div className="w-8 h-8 rounded-lg bg-primary-600 text-white font-black text-sm flex items-center justify-center mb-4">
                1
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">تقديم طلب التجربة</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                املأ استمارة طلب التجربة وسجل بيانات نشاطك التجاري ونوع أجهزة الكاشير والموازين المتوفرة لديك.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs relative">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center mb-4">
                2
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">التواصل والتهيئة</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                نتواصل معك لمعرفة احتياجات متجرك وإعداد الحساب والصلاحيات المناسبة.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs relative">
              <div className="w-8 h-8 rounded-lg bg-slate-900 text-white font-black text-sm flex items-center justify-center mb-4">
                3
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">التدريب والتسليم</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                نوضح لك طريقة استخدام البيع والمخزون والتقارير قبل بدء التجربة.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-2xs relative">
              <div className="w-8 h-8 rounded-lg bg-primary-600 text-white font-black text-sm flex items-center justify-center mb-4">
                4
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">الاستخدام والدعم المباشر</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                استخدم النظام خلال فترة التجربة، وتواصل معنا إذا احتجت إلى المساعدة.
              </p>
            </div>

          </div>

          <div className="mt-10 text-center">
            <button
              type="button"
              onClick={() => { setTrialSubmitted(false); setIsTrialModalOpen(true); }}
              className="py-3 px-8 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all shadow-md shadow-primary-700/20 cursor-pointer"
            >
              ابدأ الآن بطلب نسختك التجريبية المجانية
            </button>
          </div>

        </div>
      </section>

      {/* 5. Core Capabilities Grid */}
      <section id="features" className="py-16 sm:py-20 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-2 block">
              وظائف النظام
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              ما تحتاجه في العمل اليومي
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              من البيع وحتى التقارير، يمكنك متابعة حركة المتجر من حسابك.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            
            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <ShoppingCart size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">شاشة البيع</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                إتمام الفاتورة بأقل عدد من النقرات، اختصارات سريعة للوحة المفاتيح (F1-F12)، ودعم شاشات اللمس والموازين.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <Truck size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">المخزون والتوريد</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                تحديث الكميات المتبقية تلقائياً فور إصدار أي فاتورة بيع أو تسجيل توريد، مع تنبيهات بنواقص الأصناف.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <Users size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">الديون وسندات القبض</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                تنظيم كامل لمديونيات العملاء والمطاعم مع إيصالات سداد مرقمة تمنع أي التباس بين الكاشير والمشتري.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <Scale size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">جرد ومطابقة الدرج</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                معرفة النقدية المتوقعة في الدرج بنهاية الوردية ومطابقتها مع النقدية الفعلية لتفادي أي فروقات أو عجز مالي.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <FileText size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">فواتير وتقارير قابلة للطباعة</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                راجع المبيعات والمصروفات وحسابات الشركاء من التقارير المتاحة.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50/70 border border-slate-200/90">
              <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <ShieldCheck size={20} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 mb-2">صلاحيات المستخدمين والفروع</h3>
              <p className="text-xs text-slate-600 leading-relaxed">
                توزيع الصلاحيات بين الكاشير والمحاسب والمدير، منع إلغاء الفواتير إلا بإذن، ودعم ربط فروع متعددة مركزياً.
              </p>
            </div>

          </div>

        </div>
      </section>

      {/* 6. Supported Platforms & Active Downloads Section */}
      <section id="platforms" className="py-16 sm:py-20 bg-slate-50/70 border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-wider text-primary-600 mb-2 block">
              طرق التشغيل
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              احصل على نسختك الآن لكافة الأجهزة
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-2">
              استخدم براكه عبر المتصفح أو حمّل نسخة Windows أو Android المتاحة.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Platform 1: Windows Desktop */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between text-center relative">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-slate-900 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Monitor size={28} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900">برنامج سطح المكتب (Windows)</h3>
                </div>
                <span className="text-[11px] font-bold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md inline-block mb-3">
                  الإصدار v{APP_VERSION}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  نسخة سطح المكتب لمحطات البيع، مع خيارات الطباعة واستخدام البيانات المحلية.
                </p>
              </div>

              <div>
                <a
                  href={`https://github.com/amerfathi/khodar-pos/releases/download/v${APP_VERSION}/KhodarPOS-Setup.exe`}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowDownToLine size={16} />
                  <span>تحميل مثبت الويندوز (Setup.exe)</span>
                </a>
                <span className="text-[10px] text-slate-400 block mt-2">
                  حجم الملف: 120 ميجابايت &bull; لنظام ويندوز 10/11
                </span>
              </div>
            </div>

            {/* Platform 2: Android Mobile */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between text-center relative">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Smartphone size={28} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900">تطبيق الهاتف (Android)</h3>
                </div>
                <span className="text-[11px] font-bold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md inline-block mb-3">
                  تطبيق المالك v{APP_VERSION}
                </span>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  تابع المبيعات والتقارير من هاتف Android حسب صلاحيات حسابك.
                </p>
              </div>

              <div>
                <a
                  href={`https://github.com/amerfathi/khodar-pos/releases/download/v${APP_VERSION}/Brraka-Android.apk`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowDownToLine size={16} />
                  <span>تحميل ملف التطبيق (Android APK)</span>
                </a>
                <span className="text-[10px] text-slate-400 block mt-2">
                  حجم الملف: 3.4 ميجابايت &bull; تثبيت مباشر لهواتف أندرويد
                </span>
              </div>
            </div>

            {/* Platform 3: Web Cloud */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm flex flex-col justify-between text-center relative">
              <div>
                <div className="w-14 h-14 rounded-2xl bg-primary-600 text-white flex items-center justify-center mx-auto mb-4 shadow-sm">
                  <Globe size={28} />
                </div>
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900">بوابة الويب السحابية (Web)</h3>
                </div>
                <span className="text-[11px] font-bold text-primary-600 bg-primary-50 border border-primary-200 px-2 py-0.5 rounded-md inline-block mb-3">
                  الدخول عبر المتصفح
                </span>
                <p className="text-xs text-slate-600 leading-relaxed mb-6">
                  إمكانية الدخول وإدارة كافة الحسابات والفواتير والتقارير المالية مباشرة عبر المتصفح دون الحاجة إلى تثبيت برامج.
                </p>
              </div>

              <div>
                <button
                  type="button"
                  onClick={onOpenLogin}
                  className="w-full py-3 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ExternalLink size={16} />
                  <span>فتح بوابة الويب السحابية</span>
                </button>
                <span className="text-[10px] text-slate-400 block mt-2">
                  تحتاج إلى اتصال بالإنترنت للمزامنة
                </span>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* 7. Footer */}
      <footer className="bg-slate-900 text-white py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 pb-8 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <img 
                src={BRRAKA_LOGO} 
                alt="براكه" 
                className="w-12 h-12 rounded-2xl object-contain shadow-xs" 
              />
              <div>
                <span className="font-bold text-sm text-white block">منظومة براكه المحاسبية | Brraka</span>
                <span className="text-[11px] text-slate-400 block">إدارة البيع والحسابات &bull; v{APP_VERSION}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://wa.me/966564982852"
                target="_blank"
                rel="noreferrer"
                className="py-2 px-4 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold transition-all flex items-center gap-1.5"
              >
                <MessageCircle size={15} />
                <span>تواصل عبر الواتساب</span>
              </a>
              <button
                type="button"
                onClick={onOpenLogin}
                className="py-2 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-all border border-slate-700"
              >
                تسجيل الدخول للنظام
              </button>
            </div>
          </div>

          <div className="pt-8 text-center text-xs text-slate-500">
            جميع الحقوق محفوظة &copy; 2026 براكه.
          </div>
        </div>
      </footer>

      {/* 8. Trial Request Modal */}
      {isTrialModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity" 
            onClick={() => setIsTrialModalOpen(false)}
          />

          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 z-10 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b pb-3 mb-4">
              <div>
                <h3 className="font-bold text-base text-slate-900">طلب تجربة مجانية لمدة شهر</h3>
                <p className="text-xs text-slate-500 mt-0.5">نستلم طلبك ونتواصل معك بشأن التجربة</p>
              </div>
              <button
                type="button"
                onClick={() => setIsTrialModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {trialSubmitted ? (
              <div className="text-center py-8 space-y-3">
                <div className="w-14 h-14 bg-primary-50 text-primary-600 rounded-full flex items-center justify-center mx-auto border border-primary-200">
                  <CheckCircle2 size={32} />
                </div>
                <h4 className="font-bold text-base text-slate-900">تم استلام طلب التجربة بنجاح!</h4>
                <p className="text-xs text-slate-600 max-w-sm mx-auto leading-relaxed">
                  تم تسجيل طلبك. سنتواصل معك على الرقم الذي أدخلته لمناقشة الخطوة التالية.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTrialModalOpen(false)}
                  className="mt-4 py-2 px-6 bg-slate-900 text-white text-xs font-bold rounded-xl"
                >
                  إغلاق
                </button>
              </div>
            ) : (
              <form onSubmit={handleTrialSubmit} className="space-y-3.5">
                {trialError && <p role="alert" className="text-red-700">{trialError}</p>}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    الاسم الكامل <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trialForm.name}
                    onChange={(e) => setTrialForm({ ...trialForm, name: e.target.value })}
                    placeholder="مثال: أحمد محمود"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-primary-600 select-text"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    اسم المنشأة أو المتجر <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={trialForm.shopName}
                    onChange={(e) => setTrialForm({ ...trialForm, shopName: e.target.value })}
                    placeholder="مثال: أسواق النور للخضار"
                    className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-primary-600 select-text"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      رقم الهاتف / واتساب <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={trialForm.phone}
                      onChange={(e) => setTrialForm({ ...trialForm, phone: e.target.value })}
                      placeholder="+9665XXXXXXXX"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-primary-600 select-text"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      المدينة أو المحافظة
                    </label>
                    <input
                      type="text"
                      value={trialForm.city}
                      onChange={(e) => setTrialForm({ ...trialForm, city: e.target.value })}
                      placeholder="مثال: الرياض"
                      className="w-full h-9 px-3 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-primary-600 select-text"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    ملاحظات أو متطلبات خاصة (اختياري)
                  </label>
                  <textarea
                    rows={2}
                    value={trialForm.notes}
                    onChange={(e) => setTrialForm({ ...trialForm, notes: e.target.value })}
                    placeholder="مثال: عدد محطات الكاشير، نوع الميزان المتوفر..."
                    className="w-full p-2.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:border-primary-600 select-text resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsTrialModalOpen(false)}
                    className="py-2 px-4 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={trialSending}
                    className="py-2 px-6 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-sm cursor-pointer"
                  >
                    تأكيد وإرسال طلب التجربة
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
