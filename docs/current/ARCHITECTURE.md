# البنية التقنية الحالية

مرجع 2.6.14 بتاريخ 2026-10-04. [الفهرس الرئيسي](../../README.md).

## المنصات والاعتماديات

| الطبقة | التنفيذ الحالي | المصدر |
|---|---|---|
| الواجهة المشتركة | React18 ، Vite6 ، Tailwind3 ، Framer Motion ، Lucide | `package.json`، `src/components` |
| Windows | Electron44 ، حزمة NSIS ، appId `com.brraka.pos` | `electron/main.cjs`، إعداد build في`package.json` |
| Android | Capacitor8 ، applicationId `com.khodar.pos`، versionCode26140 | `capacitor.config.json`، `android/app/build.gradle` |
| APIs | Cloudflare Pages Functions | `functions/api`، `functions/_lib` |
| الخادم الدائم | Cloudflare D1 | `d1/schema.sql`، `d1/migrations` |
| التحقق من كلمات المرور | Worker خاص مع SQLite Durable Object و bcrypt12 | `workers/password-crypto`، `functions/_lib/passwords.js` |
| حفظ المتصفح/الواجهات المدمجة | IndexedDB ، سجل aggregate ذري | `src/services/durableAggregate.js`، `atomicStore.js` |

المصدر الدقيق لإصدارات الحزم هو`package-lock.json`؛ القيَم أعلاه عائلات الإصدارات وليس تعهدًا بإصدار patch بعينه. وجود ملفات iOS أو أسماء قديمة في الإعداد لا يعني نشر أو اختبار تطبيق iOS. كذلك SQLite الخاصة بـ D1/DO ليست قاعدة SQLite محلية مثبتة لبرنامج Windows ؛ الادعاءات القديمة بذلك ليست وصفًا للتخزين المالي الحالي.

## مسار العملية

واجهة العملية ← `useAppStore` ← قواعد الآثار المالية ← `AtomicStore` ← التزام IndexedDB للحالة والطابور والمؤشر والمعرفات المقبولة ← واجهة تأكيد الحفظ. بعد ذلك يدفع`CloudflareSync` المصادر إلى API مع هوية الشركة وصلاحيات الفرع وشروط رؤوس التعارض؛ الخادم يتحقق ثم يحفظ المجموعة داخل D1batch. نتيجة القبول لا تمحو الطابور محليًا قبل اكتمال الحفظ الدائم.

الملفات الأساسية:

- `src/store/useAppStore.js`: ربط العمليات والمكونات بالحالة والمزامنة.
- `src/services/businessEffects.js` و`invoiceInventory.js`: آثار العمليات على المخزون والأرصدة.
- `src/services/durableAggregate.js`: قاعدة`braka_durable_aggregates_v1` ومخزن`aggregates`.
- `src/services/tenantStorage.js`: نطاق الشركة/المستخدم وتنقية الاعتمادات من بيانات العمل.
- `src/services/cloudflareSync.js` و`syncConflictPolicy.js`: النقل، رؤوس التعارض، حالات المزامنة.
- `src/services/reviewLedgerReplay.js`: إعادة تشغيل المصادر للتحقق من التسوية.
- `src/services/legacyProductProof.js` و`missingDependency.js`: الاسترداد الموثوق والعلاقات المفقودة.
- `src/services/backupValidation.js` و`backupScheduler.js`: snapshot نسخة 4 والتحقق وجدولة الإقرار.

## نموذج البيانات

الشركة هي tenant. المستخدم principal قد يكون مالك tenant أو موظف user. الفرع يحمل هوية مستقلة؛ السجلات المالية مرتبطة بفرع وصلاحياتها لا تؤخذ من واجهة الاختيار وحدها. نطاق aggregate المحلي يشمل الشركة والمستخدم ونطاق الوصول؛ لا يُعامل جهازان كدفتر مشترك داخل ذاكرة واحدة.

| مجموعة | كيانات ومخازن رئيسية |
|---|---|
| الهوية والتنظيم | `tenants`، `users`، `branches`، `sessions`، `password_reset_tokens` |
| التشغيل المالي | أصناف، عملاء، موردون، فواتير، مشتريات، مصروفات، دفعات، مرتجعات، تالف، عمال، شركاء، تحويلات |
| سجل المزامنة | `sync_events_v2`، `sync_commit_groups`، `sync_conflict_heads` |
| تعارضات المالك | `sync_conflict_reviews`، `sync_review_decisions`، `sync_review_resolutions`، `sync_review_originals` |
| النسخ والإصدارات | `tenant_backups`، `app_releases` |
| أساس غير مفعّل | جداول/خدمات cash_drawers و cash_shifts و cash_devices والتصاريح |

وجود جدول تقليدي invoice/product في schema لا يعني أن كل حدث مزامنة يُكتب مباشرة فيه. اقرأ مسار handler الفعلي؛ سجل المصادر وإعادة التشغيل أساسيان في التسوية. ملف schema يصف المصدر الحالي، وليس صورة تلقائية للمخطط المطبّق على الإنتاج.

## واجهات API

| المسار | طرق موجودة في المصدر | الغرض |
|---|---|---|
| `/api/tenants/lookup` | POST | دخول الشركة/الموظف |
| `/api/auth/me`، `logout` | GET ، POST على الترتيب | الجلسة الحالية والخروج |
| `/api/auth/password`، `reset`، `recovery-token` | POST | تغيير كلمة المرور والاسترداد المخوّل |
| `/api/auth/platform-owner` | GET/PATCH | إدارة هوية مالك المنصة |
| `/api/tenants`، `/api/users` | GET/POST/PATCH/DELETE ؛ users يدعم PUT أيضًا | إدارة الشركات/المستخدمين حسب الدور |
| `/api/branches` | GET | فروع الشركة المصرّح بها |
| `/api/sync/push`، `pull` | POST ، GET | إرسال/استقبال المصادر |
| `/api/sync/rebase` | POST | إعادة مواءمة مبيعات مستقلة مدققة |
| `/api/sync/dependencies` | POST | دليل علاقات/أصناف تاريخية مصرح بها |
| `/api/sync/conflicts` | GET/POST/PATCH | حفظ الأدلة وعرضها وتنفيذ قرار المالك |
| `/api/sync/resolutions` | POST | استرداد checkpoint مصفّى للمصادر التي سُوّيت |
| `/api/backup` | GET/POST | snapshot الشركة المصرّح بها |
| `/api/releases/latest`، `/api/releases` | GET ؛ إدارة releases تدعم POST | معلومات الإصدار/النشر المخوّل |
| `/api/trial-requests` | GET/POST/PATCH/DELETE | طلبات التجربة وإدارتها |
| `/api/cash/*` | أساس محلي | ليست ميزة إنتاج معتمدة |

هذه قائمة مسارات وليست وعدًا بأن كل طلب أو cashroute متاح في حزمة الإنتاج. لكل endpoint تحقق مستقل من الهوية والحقول والحجم والصلاحية؛ لا تمرّر token أو password داخل payload مالي.

## الفرق بين main والإنتاج

حزم الواجهة 2.6.14 من commit الإصدار؛ APIs المنشورة من stage متوافق مبني على baseline`c10f4e5` مع إصلاحات المصادقة والمبيعات والاسترداد والتسوية. لم تُطبَّق 0017–0022 على D1 الإنتاج. أُضيفت 0023–0026 بعد export خاص. لا تنفّذ`schema.sql` أو`migrations apply` على الإنتاج باعتبار أن الفرع main يعكس المخطط الحي بالكامل.
