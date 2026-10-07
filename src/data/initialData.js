export const INITIAL_PRODUCTS = [];

export const INITIAL_CUSTOMERS = [];

export const INITIAL_SETTINGS = {
  shopName: 'زقيرت',
  subTitle: 'منظومة كاشير ومحاسبة التبغ والسجائر والجملة',
  phone: '',
  secondaryPhone: '',
  currency: 'ريال',
  timeZone: 'Asia/Riyadh', // توقيت الشركة: يحدده المالك مرة واحدة ويُطبَّق على كل الفروع
  address: '',
  taxNumber: '', // الرقم الضريبي للمنشأة (15 رقماً)
  commercialRegister: '', // رقم السجل التجاري
  enableTax: false, // تفعيل ضريبة القيمة المضافة
  taxPercentage: 15, // نسبة الضريبة الافتراضية
  pricesIncludeTax: true, // الأسعار شاملة الضريبة
  invoiceNote: 'شكراً لتعاملكم معنا ونسعد بخدمتكم دائماً',
  returnPolicy: 'البضائع والتبغ يستبدل بموجب الفاتورة الأصلية بحالتها السليمة',
  printerType: 'thermal_80', // thermal_80 (80mm), thermal_58 (58mm), a4 (A4)
  autoPrintInvoice: false, // طباعة تلقائية عند إتمام الفاتورة
  printQrCode: true, // طباعة رمز الاستجابة السريعة (QR)
  printCashierName: true, // طباعة اسم الكاشير
  printBranchName: true, // طباعة اسم الفرع
  defaultWeightMode: 'net_after_tare',
  defaultTareKg: 0, // وزن الفارغ
  defaultSaleMode: 'retail', // retail (قطاعي) | wholesale (جملة)
  defaultUnitType: 'pack', // pack (علبة) | sleeve (استيكة) | carton (كرتونة)
  weightPrecision: 2, // عدد الخانات العشرية
  nextInvoiceNumber: 1,
  openingCashDrawerFloat: 0, // العهدة النقدية الافتتاحية للدرج
  allowNegativeStock: false, // false: منع البيع عند نفاد الرصيد | true: السماح بالبيع على ذمة التوريد
  defaultLowStockAlert: 20, // حد التنبيه الافتراضي لانخفاض المخزون (علبة)
  allowCashierDiscounts: true, // السماح للكاشير بإجراء خصومات يدوية
  maxDiscountPercent: 15, // الحد الأقصى المسموح للخصم (%)
  fontSizeScale: 100 // نسبة تكبير/تصغير خطوط البرنامج (80% إلى 130%)
};

export const INITIAL_INVOICES = [];

export const INITIAL_EXPENSES = [];

export const INITIAL_DAMAGED_ITEMS = [];

export const INITIAL_WORKERS = [];

export const INITIAL_CUSTOMER_PAYMENTS = [];

export const INITIAL_EXPENSE_CATEGORIES = [
  'رواتب وعمالة',
  'إيجار ومستودع',
  'شحن وتوصيل كراتين',
  'فواتير ومحل وكهرباء',
  'ضيافة ونثريات',
  'صيانة وتجهيزات',
  'أخرى'
];

export const INITIAL_PURCHASES = [];

export const INITIAL_WORKER_TRANSACTIONS = [];

export const INITIAL_SUPPLIERS = [];

export const INITIAL_SUPPLIER_PAYMENTS = [];

export const INITIAL_PARTNERS = [
  {
    id: 'partner-1',
    name: 'الشريك الأول (المؤسس)',
    phone: '',
    sharePercentage: 50,
    initialCapital: 0,
    notes: 'الشريك المؤسس',
    createdAt: new Date().toISOString().split('T')[0]
  },
  {
    id: 'partner-2',
    name: 'الشريك الثاني',
    phone: '',
    sharePercentage: 50,
    initialCapital: 0,
    notes: 'شريك تضامن',
    createdAt: new Date().toISOString().split('T')[0]
  }
];

export const INITIAL_PARTNER_DRAWINGS = [];

export const INITIAL_PROFIT_DISTRIBUTIONS = [];

export const INITIAL_SALES_RETURNS = [];

export const INITIAL_PURCHASE_RETURNS = [];

export const INITIAL_TENANTS = [];

export const INITIAL_BRANCHES = [
  {
    id: 'branch-main',
    tenantId: 'tenant-demo',
    name: 'الفرع الرئيسي (السوق المركزي)',
    code: 'BR-01',
    phone: '0500000001',
    address: 'السوق المركزي - جناح أ - بوابة 3',
    managerName: 'مدير المحل الرئيسي',
    isMain: true,
    status: 'active',
    createdAt: '2026-01-01'
  },
  {
    id: 'branch-north',
    tenantId: 'tenant-demo',
    name: 'فرع الشمال (حي المروج)',
    code: 'BR-02',
    phone: '0500000002',
    address: 'حي المروج - طريق الملك عبدالعزيز',
    managerName: 'أبو فهد',
    isMain: false,
    status: 'active',
    createdAt: '2026-01-15'
  }
];

export const INITIAL_STOCK_TRANSFERS = [];

export const DEFAULT_PERMISSIONS = {
  canSell: true,
  canViewInvoices: true,
  canVoidInvoices: false,
  canManageCustomers: true,
  canManagePurchases: false,
  canManageInventory: false,
  canManageExpenses: false,
  canManagePayroll: false,
  canViewFinance: false,
  canAccessSettings: false,
  canViewAllBranches: false
};

export const ROLE_PERMISSIONS_PRESETS = {
  admin: {
    label: 'مدير عام / مالك المنشأة',
    desc: 'صلاحيات كاملة لكافة أقسام النظام وإدارة الفروع والإعدادات',
    permissions: {
      canSell: true,
      canViewInvoices: true,
      canVoidInvoices: true,
      canManageCustomers: true,
      canManagePurchases: true,
      canManageInventory: true,
      canManageExpenses: true,
      canManagePayroll: true,
      canViewFinance: true,
      canAccessSettings: true
    }
  },
  cashier: {
    label: 'بائع كاشير وميزان',
    desc: 'البيع وإصدار الفواتير فقط مع منع الدخول للحسابات أو الإعدادات أو حذف الفواتير',
    permissions: {
      canSell: true,
      canViewInvoices: true,
      canVoidInvoices: false,
      canManageCustomers: true,
      canManagePurchases: false,
      canManageInventory: false,
      canManageExpenses: false,
      canManagePayroll: false,
      canViewFinance: false,
      canAccessSettings: false
    }
  },
  accountant: {
    label: 'محاسب مالي',
    desc: 'متابعة حركة الصناديق والمصروفات والتقارير المالية وفواتير المبيعات والتوريد',
    permissions: {
      canSell: false,
      canViewInvoices: true,
      canVoidInvoices: false,
      canManageCustomers: true,
      canManagePurchases: true,
      canManageInventory: false,
      canManageExpenses: true,
      canManagePayroll: true,
      canViewFinance: true,
      canAccessSettings: false
    }
  },
  inventory_manager: {
    label: 'مسؤول مشتريات ومخزون',
    desc: 'إدخال فواتير المشتريات والتوريد وتسعير الأصناف ومناقلات الفروع والتوالف',
    permissions: {
      canSell: false,
      canViewInvoices: true,
      canVoidInvoices: false,
      canManageCustomers: false,
      canManagePurchases: true,
      canManageInventory: true,
      canManageExpenses: false,
      canManagePayroll: false,
      canViewFinance: false,
      canAccessSettings: false
    }
  },
  custom: {
    label: 'صلاحيات مخصصة',
    desc: 'تحديد الصلاحيات يدوياً بحسب رغبة الإدارة',
    permissions: { ...DEFAULT_PERMISSIONS }
  }
};

export const INITIAL_USERS = [];


