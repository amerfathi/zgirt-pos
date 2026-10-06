# الهوية والأمان والصلاحيات

مرجع الإصدار 2.6.14 بتاريخ 2026-10-04. [الفهرس](../../README.md). ضوابط موجودة وحدود تحققها، وليس اختبار اختراق شاملًا جديدًا.

## هوية الخادم وكلمة المرور

الدخول مرتبط بكود الشركة و principal. الشركة والدور والصلاحيات تأتي من بيانات الخادم الموثوقة، لا حقول العميل. الجلسة Bearer عشوائية؛ يخزن D1 بصمتها المشتقة مع AUTH_SECRET. المدة المعرّفة 8 ساعات، مع تحقق الانتهاء والإلغاء و credentialVersion.

التشفير bcrypt12 ، وليس PBKDF2 أو ترقية تلقائية لأي plaintext قديم. الخدمة PASSWORD_CRYPTO خاصة؛ workers_dev و preview_urls معطلان وتستخدم binding داخليًا. تغيير كلمة المرور يرفع auth_version ويلغي الجلسات القديمة ويطلب الدخول مجددًا. الاعتماد ليس مصدرًا ماليًا داخل queue.

حدود helper الحالية:12 حرفًا على الأقل و 72 بايت UTF-8 بحد أقصى. لا تُخفض bcrypt أو تُلغى rate-limit لعلاج 503. فصل التحقق المكلف إلى DO حافظ على الضوابط؛ لا يجعل حصص Free غير محدودة.

## الأدوار والنطاق

| الهوية | النطاق |
|---|---|
| مالك المنصة | إدارة الشركات والاشتراكات والإصدارات والمسارات الإدارية المخوّلة |
| مالك الشركة | شركته وفروعها وموظفوها، لا شركة أخرى |
| admin مفوّض | إدارة داخل الشركة وفق guards ؛ ليس المالك الحقيقي لتسوية التعارض |
| موظف | دور وصلاحيات وفروع معينة |
| custom | أعلام صريحة بدل افتراض الدور القياسي |

عرض «كل الفروع» للموظف، إن مُنح، يجمع فروعه فقط. all لا يتجاوز tenant. تحقق الخادم وتصفية المحلي والواجهة مطلوبة معًا؛ إخفاء زر ليس حماية.

## مصفوفة أحداث المزامنة

المصدر: `functions/_lib/syncPolicy.js` و`auth.js` و`src/services/branchAccess.js` وقوالب ROLE_PERMISSIONS_PRESETS. ليست شهادة لكل export/report أو تركيب أدوار.

| الكيان/الإجراء | العلم أو القيد الأساسي للموظف |
|---|---|
| invoice قراءة | canViewInvoices |
| invoice إنشاء | canSell |
| invoice تعديل/عكس/حذف | canVoidInvoices |
| product قراءة | canSell أو canManageInventory أو canManagePurchases |
| product تعديل؛ damaged_item | canManageInventory |
| customer ؛ customer_payment | canManageCustomers |
| purchase ؛ supplier ؛ supplier_payment ؛ purchase_return | canManagePurchases |
| expense | canManageExpenses |
| worker ؛ worker_transaction | canManagePayroll |
| sales_return | canVoidInvoices |
| partner ؛ partner_drawing ؛ profit_distribution | canViewFinance حاليًا؛ بعضها كتابة، وهو حد يحتاج فصلًا أدق |
| settings قراءة | canAccessSettings أو canViewFinance |
| settings كتابة | canAccessSettings |
| branch ؛ stock_transfer | نطاق all ودور company_owner/admin/super_admin وفق السياسة |
| restore_snapshot | نطاق all ودور مسموح، read/create فقط |
| cash_shift | موجود في المصدر، لا يجيز تفعيل الميزة |

قوالب المالك/admin/super_admin تعطي مجموعة admin ، لكن guards الهوية الحقيقية تبقى لازمة عند إدارة المنصة أو اختيار التعارض. كل طلب يفحص tenant ؛ العلم وحده لا يكفي.

## الاسترداد

رمز الموظف يصدره مدير مخوّل من `/api/auth/recovery-token` بعد تحقق الشركة والمستخدم. يخزن Hash ، وصلاحيته 15 دقيقة ويستخدم مرة واحدة. لا يُتاح للموظف استرداد زميل دون سلطة.

requireAdmin في المصدر يسمح بالأدوار الإدارية التي يعرّفها؛ **لا يعني قصر إصدار الرمز على مالك الشركة حصرًا**. رغبة تضييق هذا المسار تحتاج تعديلًا واختبارًا مستقلًا، ولا تُوثق كسلوك منفّذ.

هوية مالك المنصة لها مسار تغيير مستقل. تغيير متصل يسري على دخول الخادم من بقية المنصات، لكن جهازًا دون اتصال لا يتلقى الإلغاء لحظيًا. التصريح المقترح 24 ساعة للورديات غير مفعّل.

## حماية المصادر

حقول password/password_hash/token/sessionToken ومفاتيح prototype محظورة في payload الأعمال. تحقق tenant متداخل بحد عمق. إعادة ID نفسه بمحتوى مختلف تُرفض. aggregates والنسخ لا تحمل اعتماد الدخول. reviewCommit صلاحية داخلية لا يمنحها جسم طلب HTTP.

## الأسرار

لا تضف إلى Git أو التوثيق أو الصور: كلمات المرور، Bearer/OAuth/API tokens ، المفاتيح الخاصة، keystore أو اعتماداته، exports القاعدة، config خاصة بالـ fixtures. أسماء المتغيرات والمفاتيح العامة وبصمات الشهادات والحزم ليست أسرارًا.

أسماء الإعداد المطلوبة فقط، دون قيم:

- Cloudflare: AUTH_SECRET و bindings PASSWORD_CRYPTO و DB ؛ اعتماد Wrangler/OAuth أو API token مخوّل.
- Android CI: ANDROID_KEYSTORE_BASE64 ، ANDROID_KEYSTORE_PASSWORD ، ANDROID_KEY_ALIAS ، ANDROID_KEY_PASSWORD.
- Windows CI: BRRAKA_RELEASE_PRIVATE_KEY_PEM ، BRRAKA_RELEASE_PRIVATE_KEY_PASSPHRASE.
- metadata من CI اختياريًا: CLOUDFLARE_API_TOKEN ومعرفا الحساب والقاعدة حسب الإعداد.

حذف اعتماد من المصدر لا يثبت إلغاءه لدى مزوّده. الإلغاء/الاستبدال يحتاج دليلًا خارجيًا لا يسجل قيمة الاعتماد. اقرأ [الموانع](../../RELEASE_BLOCKERS.md) و[إجراءات المالك التاريخية](../../OWNER_ACTIONS_REQUIRED.md).

## التوقيع والتحقق

Windows: مفتاح Ed25519 مثبّت و HTTPS وقائمة سماح URL وحجم و SHA256 وإصدار. هذا ليس Authenticode ولا يزيل SmartScreen. Android: هوية الحزمة وشهادة الإنتاج ثابتتان؛ استبدالهما عشوائيًا يكسر الترقية. التوزيع مباشر حاليًا؛ GooglePlay ليس منشورًا ولا ترقية التوقيع إليه تلقائية.

نجحت الضوابط والاختبارات في نطاق الإصدار. مهمة التوثيق لم تنفذ اختراقًا جديدًا أو حمل 1000 جلسة أو إلغاء اعتماد خارجي. لا تستنتج «آمن 100%» من الاختبارات؛ [الأدلة والحدود](../release-2.6.14-verification.md).
