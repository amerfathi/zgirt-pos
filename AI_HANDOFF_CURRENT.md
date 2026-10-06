# براكه — نقطة التسليم الحالية

## الأحدث الملزم — 2026-10-05، QA حي من المصدر2b1c563

يتقدم هذا القسم على اللقطات التاريخية أدناه. Current Git HEAD:2b1c56318a9a3c129c19866c8c6d9e541dde68d0؛ branch:main؛ المصدر مدفوعorigin/main. آخر full suite للشيفرة النهائية305=5security+280integration+17review+3native، بلاfailed/skipped، scratch/five-items-oct05-final-candidate.log؛17formula منفصلة ليستE2E. lint/full/core typecheck/build/production compatibility/docs نجحت. Hosted Quality gates37335989044 succeeded لنفسSHA. Production release37337156635 succeeded فيverify/windows/android، publish skipped؛ artifacts فقط، لا استبدال immutable v2.6.14.

بعد تفويضOAuth من المالك: snapshot D1 خاصة438770bytes خارجGit في scratch/artifacts/d1-before-review-checkpoint-20261005.sql؛ لا تنقل محتواها أو رابطها المؤقت. طُبقت0030_review_checkpoint_jobs.sql فقط عن بعد، تحققت الجداول/index/triggers الخمسة، وسُجل اسمها فيd1_migrations بعد التحقق. cash0027/28/29 لم تُطبق وgate معطلة.

Fresh مستقل scratch/production-clean-2b1c563 منGitHub بنفسSHA، npmci/build و151-file production manifest نجحت، وكانgitstatusفارغًا. QA deployment08667048-c607-4822-b7ec-569010e4f691 على https://qa-2614.khodar-pos.pages.dev من نفسbundle. لا production promotion: الإنتاج يبقى4b8463464368a8cfbb36d105b102f145c229c515/deployment5889a64c، والثنائيات العامة/المثبتة2.6.14 لم تتغير.

اختبار حي داخلBrowser الحقيقي/الخادم المشترك، شركتان معزولتان: زُرع2104مصدر فيCA، منها4مالية و2100settingsفارغة. actual owner UI اعتمد السعر12 بعد10ردود202 ثم200؛ checkpoint/recoverystock17/debt10، proof واحدة، رفض شركةCB403، pageErrors[]. Small-owner live UI/source preservation/receipt recovery نجحت أيضًا. صورة خاصة scratch/artifacts/live-large-review/owner-reviewed-live.png. هذا تحقق لسيناريو كبير محدد، لا كل أحجام الشركة أو مصفوفة الأجهزة.

مانع تشغيل ما زال مفتوحًا: أول seed توقف بعد1504مصادر بردnonJSON مجهولالمسار؛ status أكد حفظ1504، ثمlogin عاد503HTML/1102. الاستكمال لم يعاود المصادر القديمة، وصل2104، وقرارالمالك نجح. trace لاحق للدخول outcome=ok وCPU14/4/5ms/200؛ هذا لا ينفي الخطأ المتقطع أو يثبت ضمان Free/1000مستخدم. المقارنة الحية فيCB أضافت110settingsفارغة فقط: دفعة10نجحتCPU12ms، دفعة100نجحتCPU58ms؛ lookup11/5ms. التفاصيل المفلترة محفوظة scratch/artifacts/live-large-review/auth-resource-metadata.json عندهذهاللقطة؛ لا أجسام/اعتمادات. بعدالتعديلالتالي تحفظالمقارنة push-comparison-metadata.json لمنعطمسقياسالدخول. tailReady=false لا ينفيالسجلاتالملتَقطة؛ CLI json لميرسلبannerالجاهزية. هذا دليلارتفاعCPU، لاtraceلفشل1102نفسه؛ لا تنسبالفشلإلىCPUحصراً دونoutcome لأن1102يمكنأنيشيرأيضاًإلىmemory. Cloudflareيوثق10msFree ومرونةلتجاوزاتعرضية، مايفسّرإمكاننجاح58msوليسسلامةاعتمادها: https://developers.cloudflare.com/workers/platform/limits/ . الإصلاحالمجانيالتالي: profiling و تقليل/تفويضالعملالمكلفإلىDOخاص معالحفاظعلىحدودالشركةوatomiccommit؛ لاخفضbcrypt أوإلغاءrate-limit. لذلكالنشرالجديدمؤجل.

إصلاح409 عند استكمالfixture كان فيscript فقط: إعادة بناء مصادرمالية موجودة كانت تحركheads المحلية قبل إرسالremainingsettings. صُحح عدم إعادة بنائها وقراءة conflictHeads منآخرpullpage. تقليلseedbatch إلى10 ليس إصلاحًا معتمدًا للنظام ولا اختبار حمل.

الخمسة لم تكتمل: staged signed invoicevoid/notes والحفظ/replay نجحت ماليًا100-12+6-6=88، لكن App drawer provisioning/UI/offline remount/full backup/restore/lost-device وباقيreversals ومصفوفة الأجهزة OPEN. Windows انفتح والتنقل للتحديث نجح، لكنه يعرضcurrent/latest2.6.14؛ لاupgradeأعلى ولاin-app installation جديدة. يحتاجcandidateأعلى موثوق وتأكيدتثبيت عندالفعل. لا تفعيلcash أو ادعاءنشرالبنودجميعًا.

آخرقراءةquota56%5h/94%weekly؛ لاreset/شراء. شرطحذفالتسليماتالقديمةقرب5h لم يتحقق، فحُفظتكلالأدلة. لا أسرار أو كلماتمرور أو رموز أو مفاتيحخاصة فيالوثيقة؛ privatefixtures/SQL/exports ignored فقط.

آخرمهمة: تحقق ونشرمرشحالتسويةالكبيرة، توقفترقيةالإنتاجعند1102، معاكتمالQAالمالي. أولخطوةللنموذجالتالي: اقرأهذاالقسم وgitstatus، راجع auth-resource-metadata الخاصة/مقارنةالدفعات وسجل CPU لـlookup/push لتحديد سبب1102 قبلpromotion؛ لا تعاود--seedولا--prepareعلىfixturesالموجودة، ولاmigrationsapplyللجميع.

git status قبلcommitالتالي: modified tests/live-large-review-smoke.mjs وAI_HANDOFF_CURRENT.md وdocs/current/FIVE_ITEM_REMEDIATION.md وRELEASE_BLOCKERS.md؛ new intended tests/live-review-resource-probe.mjs. untrackedتاريخيةمحفوظةوخارجcommit: docs/multi-company-live-ui-audit-2026-10-03.md وtests/live-account-plan-probe.mjs وtests/live-android-auth-probe.mjs وtests/live-auth-resource-probe.mjs وtests/live-auth-validation.mjs وtests/live-test-provision.mjs. لاstagedملفاتعندهذهاللقطة. بعدcommit استخدمgitrev-parseHEAD؛ الشيفرة المنشورةQA تبقى2b1c563حتىلوتغيرHEADالتوثيق.

## الأحدث الملزم — 2026-10-05، استئناف بعد Escape بالخطأ

يتقدم هذا القسم على الأقسام أدناه. أحدث استخدام41%5h/91%weekly، لاreset/شراء. لا حذف للأدلة أو التسليمات: شرط قرب5h لم يتحقق. اختبار API/D1 يحفظ transfer3 عند حد200 (أول تقدم199)، ويمنع SQL claim بعد مصدرlegacy يغيرcursor دونheads. actual sync+AtomicStore v2 يبقيoutbox عندquota ويرفض الرد بعد تبديلtoken. Chrome --review-checkpoint نجح بعد قتل العملية: archive/fence/checkpoint محفوظة، القديم لا يتكرر والجديد مرة واحدة. idb probe/engine/migrate نجحت. legacy>2100 يعاد بناؤهstock17، ومرجع فرع آخر يلغيproof؛ رفض403 Entity belongs to another branch هو العقد الفعلي (توقع400 فيfixture صُحح، لا تغييرpolicy).

إصلاح مالي staged: hook voidInvoice يسجل عكس النقد الموقّع في المجموعة نفسها، وjournal يستخرجه من أصل الفاتورة الملتزم لا مبلغrequest. invoice notes فقط مقبولة دون حركة. اختبارhook فشل على الحظر السابق ثم نجحsale27/void-27،stock يعود15،paired failure rollback وتكرارvoid لا يعيدالنقد. actual hook→sync→API/D1 نجحopening100/expense12/sale6/void-6/closing88 معreverse-source600/-600،lostACK لا يكرر. لا تفعيلcash؛ UI/provisioning/full drawer backup/restore/lost-device وباقيreversals مفتوحة.

آخرfull npm test305=5security+280integration+17review+3native بلاfailed/skipped؛ بعده وُسعت fixture hook API ونجحت منفردة. scratch/five-items-oct05-void-final.log. lint/typecheck/core/build/compatibility/docs ناجحة،chunkwarning قائم. tests/live-large-review-smoke.mjs جديد لاختبار2104 مصدر علىQA؛ أُعدتprivatefixture فقط، لم تُزرع بعد. لاhostedCI/newdeploy لهذهالشيفرة بعد. tsconfig path للbrowser replay صريح، لا تعطيلcheckJs.

Windows2.6.14 فُتحت وتمالتنقل الحقيقي للتحديث؛ تعرض آخر2.6.14 فلاcandidateأعلى للتثبيت. click بدونscreenshot أعادgeometryunavailable، screenshot/reobserve ثمالتنقل نجحا. لاinstall/businesswrite جديد. يلزمdownload→install الأعلى الموثوق وaction-timeconfirmation.

Cloudflare7403/10000 حُلت بإعادةOAuth منالمستخدم؛ schema/registry قرئت. snapshotخاصة scratch/artifacts/d1-before-review-checkpoint-20261005.sql محفوظة438770bytes خارجGit؛ لا تعيدURLالتصدير أومحتواه. remote registry حتى0026،0030 غيرمطبقة وكذلكcash0027/28/29. التالي: scopedcommit/push وCI exactSHA ثم0030 فقط معregistry،freshGitQA/live-large-review ثمproduction؛ لاmigrationsapplyللجميع ولاgate ولااستبدالimmutable2.6.14 assets.

## الأحدث الملزم — 2026-10-05، متابعة محلية غير منشورة بعد bb6a336

هذا القسم يتقدم على جميع اللقطات أدناه. طلب المالك إكمال البنود الخمسة والنشر مع تسليم محدث قبل نفاد الاستخدام. نافذة5h تجددت؛ آخر قراءة19% primary/88% weekly. ليست قريبة من نفاد5h، ولم تُحذف ملفات التسليم أو أدلة التدقيق. قائمة الملفات لم تُظهر تسليمًا منفصلًا قديمًا غير AI_HANDOFF_CURRENT.md.

المتابعة المحلية الآن، غير committed وغير منشورة:

- تسوية التاريخ الكبير: functions/_lib/reviewCheckpoint.js يعيد تشغيل200 مصدر كحد أقصى لكل طلب، دون تقسيم group، ويحفظ projection/cursor/count على D1 بأسماء الشركة والمستخدم وrevision وهوية طلب ثابتة ونسخة سياسة1. لا إعادة بدء عند تجاوز ساعة. لا checkpoint جزئية تُرسل أو تُركب. HTTP202 يعني validating فقط، لا posted/ready. تغير البيانات يستدعي مراجعة جديدة؛ القرار النهائي يحفظ receipt مع checkpointJobId في نفس batch، وtrigger يفحص جاهزية العمل وثبات cursor.
- migration0030_review_checkpoint_jobs.sql تضيف cache وآلية monotonic/claim وindex هوية المصدر، بلا اعتماد على cash schema. schema.sql متطابقة في الاختبار. **لم تطبق عن بعد**؛0027/28/29 ما زالت غير مطبقة وcash disabled. لا تستخدم migrations apply على الجميع لتثبيت0030.
- بروتوكول owner-reviewed-checkpoint-v2 يسترد ledger كاملة التحقق وproofs البدائل المطلوبة فقط، مع completeHistory=false وvalidatedThroughCursor. العميل يثبت cursor fence حتى لا يعيد مصادر قديمة مغطاة، ويؤرشف الأصل ثم يمسح الطابور فقط بعد commit الدائم. واجهة المالك والمزامنة تتابعان202 على دفعات حتى40 طلبًا وتأخير250ms، ويتوقف السياق عند تبدل الحساب/المستخدم؛ حد40 يعيد pending لا نجاحًا. checkpointProtocol=2 صريحة تمنع إرسال202 إلى الواجهة القديمة التي كانت تعتبرها قرارًا منتهيًا.
- إثبات فرع الصنف القديم: functions/_lib/legacyProductReference.js يستخدم قراءات الهوية وSQL existence checks لكل المراجع في prefix الشركة المثبتة، بدل LIMIT2001. dependencies وpush الأصلي/production override وreplay الكبير تستخدمه. لا تعديل للمصدر القديم ولا تخمين للفرع؛ الالتباس يمنع الترحيل. input refs IDs محدودة128. source pin الجديد af96b6759a2ecb63c867784d0f05597874e13c0b218b21f5566769d9f4ab8419 بعد رفض drift ومراجعة override؛ ليس تجاوزًا لحارس الإنتاج.

الأدلة الحالية:

- الاختبار API لتاريخ2201 رفض409 قبل الإصلاح، وبعده القرار/الاسترداد قابلان للاستكمال دون projection جزئية أو كتابة الأصل. اختبار LARGEFIN بعد إصلاح fixture قراءة heads (السحب الأول مجزأ، ليست المشكلة المالية) نجح: رفض stale decision، قبول استكمال متزامن، مخزون17 من20 وبيع3، دين10 من15 وتحصيل5، سعر الاختيار9، proof بديل واحدة وreceipt واحدة. لا رحلة أجهزة حية أو اختبار ضغط شامل.
- UI حقيقية React كانت تنهي الطلب بعد أول202 (1≠3) ثم نجحت في انتظار3 طلبات. actual AtomicStore v2 يحفظ الأرشيف ويتجاهل المصدر القديم المغطى. اختبار replay continuation فشل لغياب dependency ثم نجح مع تطابق stock/debt وعدم تعديل seed.
- npm test قبل آخر إصلاحات legacy نجح302=5security+277integration+17review+3native بلا فشل/تجاوز؛17formula منفصلة. السجل scratch/five-items-bounded-checkpoint-full.log. **هذا ليس full run للشيفرة الأخيرة**. الاختبار LARGELG>2100 نجح بعد فشل dependency409 ثم فشل push400 وإصلاحه؛ المصدر القديم branch=null بقي كما هو. تشغيل name-pattern شمل اختبار REVIEW التاريخي دون إنشاء fixture ففشل login401؛ سبب إعداد الاختبار وليس عيب دخول جديد. آخر lint/typecheck/production-bundle/Web build ناجحة، chunk warning قائم. لم يشغل hosted CI أو Chrome جديد لهذه الشيفرة المحلية.
- computer-use عادت للعمل: نافذة Windows2.6.14 تنشط وتعرض حساب المستخدم/الفرع الثاني وسجل فواتير فارغ في ذلك الفرع. لم تُغيّر بيانات أو جلسة أو تثبت نسخة. في القراءة التالية قال helper إن المستخدم ضغط Escape وأوقف Computer Use؛ لا مزيد من أدوات/إدخال Windows في هذه الجولة. احتُفظت الشيفرة والوثائق عند هذا الانقطاع.

قبل commit أو نشر هذا الجزء: أضف اختبار atomic group على حد200، lost-response/race أثناء final claim، والـ202 recovery على actual sync hook بعد تغير الحساب/فشل التخزين. أعد full npm test للشيفرة الأخيرة، ثم Chrome/typecheck:core/CI. اختبر v2 على QA ومراجعة التاريخ المالي والفرع القديم؛ تطبيق0030 فقط يحتاج snapshot D1 خاصة أولًا. لا تنشر v2 دون التفاوض الصريح ولا تسجّل كل الشركات/كل التعارضات VERIFIED من fixtures. تحديث Windows كامل من داخل التطبيق، App provisioning/UI/offline remount، full drawer backup/restore/lost-device، signed client cash reversals ورحلات Web/Windows/Android كلها باقية. لا تغيير public binaries/version2.6.14 ولا gate.

## الأحدث الملزم — 2026-10-05، المصدر 4b8463464368a8cfbb36d105b102f145c229c515

هذه متابعة للبنود الخمسة، وليست إغلاقًا لها أو تفعيلًا للدرج. طلب المالك التوقف بهامش أمان قبل نفاد نافذة الاستخدام ذات الخمس ساعات. القراءة الأخيرة عند هذا التوثيق85% primary و84% weekly؛ لا reset أو شراء رصيد.

إصلاحات هذه المتابعة، مع اختبارات فشلت على الخلل قبل الإصلاح:

- توحيد عقد إلغاء الفاتورة: status=voided صريحة، دون تعديل المال/الأصناف. التعديل العادي للملاحظات النصية فقط؛ لا تغيير إجمالي/مدفوع/دين/عميل أو تحويل الإلغاء إلى update. نفس validator في push الأصلي وproduction override وإعادة التشغيل المالي للمراجعة. اختبارات workerd/D1 الفعلية للمسارين تثبت رفض الطلب دون حفظ مصادر أو تحريك heads، وتكرار الملاحظة idempotent.
- عند رجوع الإنترنت لا تُعامل هوية الكاشير المحلية الموقعة كأنها cloud bearer؛ 401 بلا token لا يلغي تصريحًا صالحًا. انتهاء24h يغلق الكاتب ويعيد الدخول مرة واحدة مع بقاء السجل. الرفع يتطلب جلسة سحابية حقيقية؛ لا تمديد token أو تفويض مفتوح. اختبارات React hook الحقيقي وcrypto حقيقية، لا رحلة UI/native كاملة.
- هوية الجهاز تُنشأ مرة واحدة بـIndexedDB readwrite transaction لا read ثم overwrite.16 محاولة من نافذتين في Chrome تشترك في الهوية والإثبات بعد قتل العملية وإعادة الفتح. الهوية الموجودة التالفة لا تُستبدل بصمت؛ تبقى للاسترداد. لا شهادة power-loss.
- migration0029 تعيد التحقق من درج نشط ومطابقة فرعه لمصدر الحركة عند كتابة proof داخل D1batch. اختبار trigger معزول يغير الحالة/الفرع بين القراءة والكتابة ويثبت403 وrollback الوردية/المصدر/proof/heads والتغيير المدخل. schema bootstrap/migrations متطابقة. migration0029، وكذلك0027/0028، لم تُطبّق عن بعد.

التحقق النهائي: npm test exit0:297=5security+275integration+14review+3native، صفر فشل/تجاوز؛17formula منفصلة ليست E2E. السجل scratch/five-item-oct05-policy-final.log. lint/full typecheck/core typecheck/Web build/production compatibility guard ناجحة. browser-idb-probe/engine/migrate ناجحة. warning حجم chunk قائم. أول full run فشل3 بسبب مشاركة اختبارات السياسة الجديدة tenantA مع fixtures ترحيل قديمة؛ عُزلت الاختبارات في شركات مستقلة، دون تخفيف تحقق البيانات، ثم نجح التشغيل الكامل. pin إنتاجي مراجع بعد رصد drift، وليس تجاوزًا للفاحص.

البنود: الدرج OPEN (App provisioning/UI/remount، full backup/restore/lost-device، الأجهزة)، large-company settlement OPEN (GET2201 نجح سابقًا؛ PATCH/recovery ما زالا2000 ولا يوجد job)، complex financial conflicts OPEN رغم إصلاح عقد الفاتورة؛ client signed reversals ما زالت غير مدعومة. server from clean Git VERIFIED للمصدر4b84634 والنشر5889a64c ضمن النطاق المتوافق أدناه. Windows FIXED_NOT_VERIFIED: manual2.6.12→local2.6.14 سابقًا ليس in-app upgrade.

Windows الحالي مثبت2.6.14. مهارة computer-use فشلت في تنشيط النافذة المصغرة: failed to activate captured window بعد إعادة اختيارها وإعادة المحاولة. توقف إدخال UI وطُلب من المالك فتح النافذة، دون تجاوز الحماية أو تثبيت جديد. لا توجد رحلة Windows مالية أو Android جديدة لهذه المتابعة. public binaries/version2.6.14 لم تتغير.

Hosted Quality gates37292310620 للمصدر4b84634 انتهى completed/success؛ تحقق gh run view من headSha المطابق. نتيجة37288225611 ناجحة لرأس التوثيق السابق4f602fc. المراجع التاريخية أدناه لا تتقدم على هذه الفقرة وأي ملحق تحقق أحدث.

النشر الحالي المتحقق: استنساخ GitHub مستقل scratch/production-clean-4b84634 عند HEAD4b8463464368a8cfbb36d105b102f145c229c515 وgit status --porcelain فارغ قبل/بعد البناء؛ npm ci، Web build، production-bundle guard ناجحة. الحزمة scratch/production-clean-4b84634/scratch/production-bundle-Q3PLTI ذات148 ملفًا وmanifest مطابق، وWrangler compiled Worker successfully. المعاينة967a49b2 (qa-2614) نجحت في actual owner UI approval مع sourcePreserved، canonicalPrice12، receiptRecovery ودون pageErrors، ثم نفس الحزمة نشرت إلى production5889a64c. الرحلة نفسها نجحت على https://khodar-pos.pages.dev، وبقيت الكتابات في شركة QA المحددة وأعيد السعر إلى10 في cleanup. فحوص الإنتاج: Web200، health200، unauthenticatedPull401، authenticated owner cash/shifts503 (gate disabled). لا schema migrations أو إصدار Windows/Android أو تغيير رقم2.6.14. هذا يغلق بند إعادة نشر الخادم من Git جديد ضمن نطاقه فقط، لا البنود الخمسة كلها.

## الحالة المرجعية — 2026-10-05، هوية محلية24h وحماية مصادر الدرج

هذا القسم يتقدم على الأرقام والحالات التاريخية أدناه. المرجع المنشور ما زال2.6.14؛ لا إصدار أو تفعيل درج أو migrations إنتاج في هذه المرحلة. طلب المستخدم هو إكمال البنود الخمسة حتى النشر؛ لم تُغلق كلها بعد، ولا يجوز اعتبار حفظ هذه الشيفرة نشرًا للميزة.

المُنجز المحلي:

- تُشتق هوية الدخول المحلي وصلاحياتها وفروعها من تصريح الخادم الموقّع بعد فتح مخزن المفتاح بكلمة المرور؛ تعمل ضمن24h حتى بعد انتهاء جلسة الخادم8h، دون إنشاء bearer مزيف أو ترقية بيانات مستخدم قابلة للتحرير. الهوية ذاكرة فقط؛ إعادة التشغيل تتطلب فتحًا جديدًا. فرع owner المحلي محصور بالفروع الموقّعة. openOfflineSession هو مسار خدمة، وليس شاشة دخول مكتملة في App.
- أُغلقت POST القديمة لفتح/إقفال الوردية، ومصادر cash_shift غير الموقّعة. الفرع المسجل به writer يرفض create نقديًا بلا وردية، ويرفض تعديل السجلات المالية مباشرةً باستثناء ملاحظات الفاتورة. اختبار حقيقي API/D1 أثبت قبول تحويل مصروف بنكي إلى نقدي قبل الإصلاح ورفضه بعده دون كتابة المصدر. لا يُدّعى إغلاق جميع races: فحص أول تعيين writer ما زال قراءة تطبيقية، وتستلزم الاستعادة وتسوية العكس بروتوكولًا مدققًا.
- إقرار سجل المحاسب السابق حين يكون طابور المحاسب الحالي فارغًا يستخدم durable.commit لسجل واحد، لا commitBatch الذي يتطلب سجلين. إقرار مصادر صاحب الطابور يظل paired commit. المصادر الأصلية محفوظة.
- قائمة تعارضات المالك لا تعيد تشغيل تاريخ الشركة؛ تقرأ الرؤوس والمنافسين المطلوبين في D1batch. شركة اختبار2201 حركة كانت تعيد503 ونجحت بعد الإصلاح مع عزل الشركة. تنفيذ القرار والاسترداد المالي الكامل لا يزالان محدودين2000؛ هذه ليست تسوية مالية للشركات الكبيرة.

الأدلة: Chrome مع profile مؤقت وIndexedDB فعلية نجح في اختبار journal-only ACK وبقاء السجل بعد إنهاء العملية، واختبار engine failure/restart، واختبار adoption مع حفظ المصدر السابق. ليست شهادة power-loss أو Android/Windows مالية. public offline session wiring، الصلاحيات الموقّعة، كلمة المرور الخاطئة والفرع الأجنبي مرّت. فشل إعداد أول browser harness لغياب modules أصلح بقائمة صريحة فقط؛ لا وصول لملفات المستخدم. فشل typecheck أولًا لتعريف route وStorage fixture وأصلح دون تعطيل checkJs.

التحقق النهائي بعد آخر guard: npm test خرج0 ومرّ287 اختبارًا (5security+266integration+13review+3native)، صفر فشل/تجاوز،17formula منفصلة ليست E2E. السجل scratch/five-item-oct05-signed-edits-final.log. lint/full typecheck/core typecheck/Web build والتوثيق نجحت؛ chunk warning قائم. حارس production override رفض drift قبل تحديث pin المراجع ونجح بعده؛ overrides ما زالت cash-disabled. حزمة147 ملفًا scratch/production-bundle-qbQb3L بُنيت وWrangler compiled Worker successfully بلاdeploy؛ هذه من worktree، ليست clean-clone release.

أولوية الاستكمال: App provisioning/UI وهوية الحساب المحلي/remount الآمن، backup/restore/lost-device مع حماية المصادر، checkpoint/job مدقق لتسوية التاريخ الكبير، العكس المالي المدعوم ومطابقة مستقلة، ثم رحلات Web/Windows/Android والتحديث الداخلي الكامل. لا تفعّل cash أو تطبق schema عن بعد بناءً على primitive/اختبار محلي. Hosted Quality gates37287096697 انتهتsuccess للمصدرedd3ee63a78a0fe5d9d9c139b87a8d80569aec61؛ نتيجة فُحصت وليست افتراضًا.

حُفظت21 ملفات الشيفرة/الفحوص ورفعت إلى main في edd3ee63a78a0fe5d9d9c139b87a8d80569aec61. الاستخدام عند آخر قراءة44% نافذة5h و78% أسبوعي، بلا شراء أو إعادة ضبط. يُحفظ هذا checkpoint لتجنب إعادة العمل واستهلاك الرصيد.

استنسخ المصدر من GitHub في scratch/production-clean-edd3ee6، طابق HEAD والحالة النظيفة، ثم npm ci وWeb build وحارس الإنتاج وmanifest147 ملفًا وWrangler compilation نجحت. المعاينة qa-2614 رفعت إلى deployment d83e181f، ونجح actual owner UI choice/receipt recovery دون page errors. بعدها نُشرت الحزمة نفسها إلى main: deployment8cb1bae2، ورحلتا المالك على المعاينة والإنتاج نجحتا مع حفظ الأصل وcanonicalPrice12 واستردادreceipt، ثم أعاد الاختبار سعر fixture إلى10. جميع الكتابات في شركة QA المحددة فقط؛ لا حساب المستخدم الحقيقي. Web وhealth200 وpull غير الموثق401، وcash/shifts لحساب owner موثّق503 يؤكد gate disabled. هذا نشر Web/server متوافق لإصلاح قائمة التعارضات، دون schema أو binary release؛ ليس نشر/إكمال إقفال الدرج أو البنود الخمسة.

npm audit كامل أعاد8 advisories (7high+1moderate) في سلسلة أدوات التطوير والبناء؛ npm audit --omit=dev أعاد0. لا تحديثforce أو تجاهل: braces بلاpatched version معلنة وقت الفحص، وإزالة السلسلة المقترحة تتطلب Tailwind major migration مدققًا. مراجع الفحص: GHSA-vfj7-8cjw-p6xm وGHSA-ch52-4w7c-c8xp وGHSA-w293-vg96-wgc3. تبقى أدوات التطوير قيد المعالجة ولا يجوز وصف audit0 التشغيلي شهادة أمان كامل.

## أحدث نقطة — 2026-10-05، ربط الوردية بالتطبيق والخادم المحلي

هذا القسم يتقدم على الحالات التاريخية أدناه. HEAD قبل حفظ هذه المرحلة: 81dbbb3338cee49e8d313136a39b18b92c772238، الفرع main مطابق origin/main. Hosted Quality gates37232198477 نجحت لذلك HEAD، وليس للـcommit التالي الذي لم يُنشأ بعد.

تم ربط useAppStore بخدمة النقل الموقّع عند توفير cashGrantStore: تبدأ المزامنة بحالة محجوبة قبل أي تحديث فوري، ثم تُفعّل فقط لوردية المستخدم وفرعه وجهازه بعد التحقق من الهوية الدائمة. فشل الفتح أو تبديل الفرع لا يسمح بالرجوع إلى الإرسال غير الموقّع. App.jsx لا يفعّل الميزة في الإنتاج.

اختبار جديد يمر عبر React hook الفعلي وCloudflareSyncService والخادم المحلي/D1 وتصريح صادر من الخادم: فتح100، مصروف12، إقفال88. فشل حفظ تأكيد المزامنة يترك الطابور محفوظًا؛ إعادة المحاولة تقرّ المصدر مرة واحدة وتُبقي حركة واحدة بالخادم. خلل أولي في محول HTTP للاختبار أسقط query string وأنتج403 عند قراءة الفروع؛ إصلاح المحول حفظ المعاملات دون تغيير صلاحيات الإنتاج.

التحقق المحلي: npm test خرج0، 281 اختبارًا (5security+260integration+13review+3native)، صفر فشل/تجاوز. 17formula منفصلة وليست E2E. lint وtypecheck وWeb build نجحت؛ تحذير حجم الحزمة قائم. اختبار API محلي وليس شهادة تشغيل مالي على الأجهزة أو الخادم الحي.

آخر مهمة: ربط الوردية الموقّعة بالتطبيق واختبار فقد التأكيد حتى API. أول خطوة تالية: استكمال provisioning/UI وتصريح الدخول المحلي24h بعد انتهاء جلسة8h، ثم backup/restore/lost-device ومنع جميع مسارات cash غير الموقّعة قبل تفعيل الميزة. تاريخ التعارضات>2000 والتعارضات المالية المعقدة ومسار تحديثWindows الداخلي الكامل ما زالت مفتوحة. لا نشر إصدار جديد ولا تغيير schema عن بعد؛ المنشور2.6.14 وإقفال الدرج غير مفعّل.

git status عند كتابة القسم: modified مقصودة src/services/cloudflareSync.js،src/store/useAppStore.js،tests/api-integration.test.mjs،tests/cash-shift-hooks.test.mjs،وملفا التوثيق الحاليان. untracked القديمة محفوظة وخارج الحفظ: docs/multi-company-live-ui-audit-2026-10-03.md وtests/live-account-plan-probe.mjs وtests/live-android-auth-probe.mjs وtests/live-auth-resource-probe.mjs وtests/live-auth-validation.mjs وtests/live-test-provision.mjs. بعد الحفظ استخدم git rev-parse HEAD لمعرفة commit هذه النقطة. لا تُضمّن ملفات scratch الخاصة أو قيم اعتماد في Git.

## ربط النقل الموقّع بخدمة المزامنة — 2026-10-04، محلي غير منشور

النتيجة النهائية لهذه المتابعة تتقدم علىpending أدناه: npm test خرج0 (5security+259integration+13review+3native=280،0failed/0skipped)،17formula منفصلة،production-bundleguard1مرّمنفصلًا،lint/typecheck/docs/Webbuild وFunctions compilation نجحت؛ تحذيرchunkكبيرقائم. ستُحفظالملفاتالسبعةالمذكورةمعtests/api-integration.test.mjs فيGit،ولاrelease/deploy. لا تنسب hosted CI للمصدرالتالي قبلقراءةنتيجته. أولخطوةالتاليةAPI-to-real-hookintegration ثمprovisioning/UI/recovery كمافُصل،لاإعادةتنفيذtransport. لا أسرار بهذاالقسم.

متابعة الفحص: Wrangler compiled Worker successfully لحزمة147 ملفًا scratch/production-bundle-4IktAD بلاdeploy. npm test الأول258/259 أخفق فيassert drawer grant عند tests/api-integration.test.mjs:600 لأن default Node now سبق onlineVerifiedAt؛ تشخيص stack أثبت شرط الوقت نفسه. تم تمرير onlineVerifiedAt الموقّع لاختبارتفويضالدرج بدل وقتfixture مستقل، دون تعديل سياسةالإنتاج؛ full rerun قيدالإنهاء. tests/api-integration.test.mjs modified مقصود إضافي. lint/typecheck/production-bundle نجحت بعده. الاستخدام91% نافذة5h و71% أسبوعي؛ احفظالنتيجة ونقطةالمتابعة قبلنفادالرصيد. لا قيم اعتماد.

HEAD عند بدء المتابعة a340fef0cd45b22eb4fd7312d03e9bdf5fc8667b،branch main. CI37225873239 انتهى failure، لا success: test:production-bundle رفض تغير sync/push مقابل pin القديم. روجع diff099986b→d8165c0: opaque replay actor/proof SQL تخص staged cash فقط، default principal يبقى authenticated؛ production override يرفض جميع cash sources ولا يتغير. حُدث compatibility-inputs.json بالـhash المراجع وتعليل/commit المراجعة، دون إزالة حارس drift. الاختبار الأحمر تكرر قبل الإصلاح ونجح بعده. حزمة147 ملفًا تولدت بلاmigrations، build نجح مع تحذيرchunk كبير؛ compilation وnpm test الكامل جاريان عند كتابة هذا القسم.

CloudflareSyncService يدعم drawerReplay opt-in:null افتراضيًا. flushQueue يستخدم cash/replay بدل unsigned push مع token/deviceProof والمصادر الأصلية، ويقرن journal/own aggregate عبر primitive السابقة. يُرفض تأكيد شبكة قديمة عند تغيرtoken/account/generation/repository/config/branch، مع إعادة التحقق بعد قراءة durable وتحت lock وقبلcommit. stopAutoSync يمسح config ولا يسمحfinally قديمة بتغيير busy لحساب جديد. pending shared sources تُرسل في batches كاملة متتابعة؛ retry يعمل حتى لوطابور المستخدم فارغ، وactivity لا يتجاوز سجلًا مشتركًا بسببempty own queue. المصادر غير المرتبطة لا تُرفع unsigned ولا يُعلن اكتمالها. لا provisioning فيApp/hook بعد.

اختبارservice الفعلي + AtomicStore وmemoryCAS وHTTPfixture (لاlive server) أثبت فشل المسار القديم قبل الربط، ثم رفض اكتمال بعدتغيرaccount/branch وتركjournal/outbox دونack، وبعد العودة نجحsigned upload/pairedack. 30 اختبارًا مركزًا و5security وlint/typecheck مرت؛ ثم أضيف تحققbranch ونُفذ الاختبارالمحدد مجددًا بنجاح. full npm test قيد التشغيل، لا تنسب عدده السابق للمصدرالحالي حتىينتهي.

آخر مهمة: staged sync transport/async scope safety + compatibility guard repair. أول خطوة تالية: API-to-real-hook integration signed sources، ثم provisioning/UI وoffline login24h وbackup/restore/lost-device وunsigned cash bypass قبل التفعيل. gate غير مفعلة،لاschemaremote أوrelease. التاريخ>2000 والتعارضات المعقدة وتحديثWindowsالداخلي مازالتOPEN. ملفاتmodified المقصودة: هذاالملف،docs/current/FIVE_ITEM_REMEDIATION.md،deployment/production/compatibility-inputs.json،src/services/cashDrawerJournal.js،src/services/cloudflareSync.js،tests/cash-drawer-journal.test.mjs. live-probe القديمةuntracked خارجالمهمة ومحفوظة. لا أسرار بهذاالقسم.

## نقطة الحفظ البعيدة الأخيرة — 2026-10-04

Current Git HEAD عند التقاط هذه النقطة (آخر commit شيفرة): d8165c0e8c8667633d7fa0a1f2a46f407e3cec88. Current branch: main، مطابق origin/main،19 ملفًا مقصودًا محفوظة ومرفوعة. commit هذا التوثيق اللاحق لا يغير الشيفرة. Hosted Quality gates37225873239 ما زال in_progress عند الفحص، لا تعتبره ناجحًا حتى تقرأ conclusion. نتائج279 اختبارًا والبناء/lint/typecheck/docs محلية ناجحة لهذا المصدر؛17formula منفصلة، تحذير bundle كبير قائم.

git status قبل هذا التحديث: لا ملفات tracked غير ملتزمة؛ untracked المحفوظة وخارج المهمة هي docs/multi-company-live-ui-audit-2026-10-03.md وtests/live-account-plan-probe.mjs وtests/live-android-auth-probe.mjs وtests/live-auth-resource-probe.mjs وtests/live-auth-validation.mjs وtests/live-test-provision.mjs. بعد تعديل هذا القسم أصبح AI_HANDOFF_CURRENT.md وحده modified حتى commit التوثيق. لا أسرار في هذا الملف بحسب فحصdocs؛ ملفات private fixtures/exports خارجGit.

آخر مهمة: signed source server replay + device writer authorization + paired journal/current-user outbox acknowledgements. أول خطوة تالية: تحقق hosted CI المذكور ثم اربط replayDrawerJournal بالـCloudflareSyncService فعليًا بمصادر الحسابات الأصلية، مع رفض اكتمال شبكة قديمة بعد تغيير الحساب/الفرع، واختبار API-to-real-hook، لا إعادة primitive المنجزة. بعدها offline login24h رغم انتهاء جلسة8h، owner drawer UI، backup/restore/lost-device، ومنع unsigned legacy cash bypass. إقفال الدرج يبقى IN_PROGRESS وغير مفعّل؛ تاريخ>2000 والتعارضات المعقدة واختبار التحديث الداخلي الكامل OPEN. نشر الخادم منcleanGitd5b31bc سبق التحقق ضمن نطاقه الضيق. لا schema remote أو إصدار عملاء جديد في هذه المتابعة؛ النسخة العامة2.6.14 لم تتغير. قراءة الاستخدام82%/69% حفزت حفظ هذه النقطة قبل استنزاف الرصيد، لا شهادة اكتمال الخمسة.

## تفويض جهاز الدرج وإعادة المصادر الموقّعة — 2026-10-04، محلي غير منشور

التحقق النهائي يتقدم على «جارية» أدناه: npm test خرج0 بعد إصلاح fixture clock؛ 5security+258integration+13review+3native=279 اختبارات ناجحة،0failed/0skipped، و17 formula checks الموروثة منفصلة وليستE2E. lint/full typecheck/docs نجحت؛ docs scanner لم يجد credential patterns. src/services/atomicStore.js ملف معدّل مقصود إضافي (durable acknowledgement wrapper)، لا تتركه خارجcommit. لا تفعيل cash أو schema remote أو release جديد. نقطة التوقف لحماية الاستخدام لا تعني اكتمال البنود الخمسة. تعليمات المتابعة المحددة أعلاه دون إعادة الفحص من الصفر.

هذا القسم يتقدم على الحالات التاريخية أدناه. HEAD الحالي099986b73f5d419f2471d29fe2bf94feb1cb1038، branch main. أضيفت migrations0027/0028 وbootstrap المتطابق محليًا فقط: جهاز كتابة واحد للدرج، وتخزين immutable لإثبات المصدر في نفس D1 batch مع الحركة. owner PATCH يخصص جهازًا مسجلًا نشطًا؛ staff/شركة أخرى مرفوضان، وتكرار نفس التخصيص idempotent. لا إعادة تخصيص عمياء لجهاز قد يحمل نقودًا غير مرفوعة؛ مسار الاسترداد ما زال مطلوبًا.

الحفظ المحلي للتأكيد بات paired مع aggregate المستخدم الحالي: acknowledgeDurable يقبل durable wrapper؛ replayDrawerJournal لا يمس طابور المحاسب الآخر، ويزيل فقط مصادر المستخدم الحالي المطابقة حرفيًا لإثباتاتها بعد قبول الخادم. عند عودة المحاسب الأول يفرغ مصادره المقبولة سابقًا دون إعادة الطلب. اختبار rollback وisolated queues وفشل commit والبيع المضاف أثناء الشبكة وعدم شطر المجموعة نجح؛ 28 اختبار hook/journal/sync مركزًا نجحت، lint/typecheck نجحا، web build نجح بتحذير chunk كبير. لا transport wiring أو تفعيل UI بعد.

تشغيل npm test اللاحق257/258 أخفق في سيناريو signed replay المتقطع: Node fixture clock سبق onlineVerifiedAt من Workerd أحيانًا. التشخيص allowlisted reason أثبت رفض الوقت، وليس signature bypass. fixture الآن يحدد source time بعد كلا التصريحين؛ الإنتاج لم يُخفف شرط الوقت. إعادة npm test النهائية جارية. حدود الاستخدام وقت الفحص:82% خمس ساعات،69% أسبوعي، لا reset credits؛ احفظ checkpoint قبل استنزاف المتبقي. هذه النسبة قراءة وقتها لا قيمة ثابتة.

التصريح الموقّع يستمد drawerIds ونوع الهوية وcredentialVersion من الخادم. cash/replay يتحقق التوقيع والجهاز الحالي وهوية وصلاحيات المحاسب الأصلي، ثم يستخدم handle داخليًا لا body override لإعادة المصادر عبر sync/push. اختبارات actual Miniflare/D1 أثبتت openA→expense12→closeA88→openB، original actors، retry دون تكرار، رفض التلاعب/شركة أخرى/جهاز ملغى/اعتماد محاسب تغير، ومنع UPDATE/DELETE لأدلة المصدر. أول تشغيل أخفق لأن نوع الهوية الحقيقي user لا staff؛ أصلح إلى عقد sessions الفعلي دون تخفيف التحقق.

replayDrawerJournal يحافظ على المصادر الأصلية وتأكيداتها، لا ينقلها إلى aggregate المستخدم الثاني. عند رد ناقص أو lost response أو فشل commit يحتفظ بها، لا يشطر commit group عند100، ويعيد القراءة تحت lock قبل CAS للحفاظ على البيع المضاف أثناء الشبكة. 13 اختبار hook/journal مرت في الاختبار المركز قبل إضافة حالة concurrent/group، وlint/typecheck نجحا. npm test الأول255/256: التقط الاختبار الأحمر قبل اكتمال primitive؛ ليس نجاحًا كاملًا. إعادة المجموعة الكاملة والبناء جاريان؛ حدّث النتيجة بعد اكتمالهما.

آخر مهمة: server writer/proof replay + durable acknowledgement primitive. أول خطوة تالية: ربط transport الموقّع بالـsync الفعلي مع own-outbox acknowledgement وحالات الحساب/الفرع أثناء الشبكة، ثم offline login بعد انتهاء جلسة8h وowner assignment UI وbackup/restore. server direct cash endpoints/unsigned push ما زالت staged legacy ولا تُعتبر منع bypass كاملًا. لا تفعّل gate ولا تطبق migrations في الإنتاج الآن. التاريخ>2000 والتعارضات المعقدة واختبار Windows الداخلي الكامل ما زالت OPEN، وليس كل المطلوب مكتملًا.

git status: تعديلات AI_HANDOFF_CURRENT.md،docs/current/FIVE_ITEM_REMEDIATION.md،d1/schema.sql،functions/api/cash/drawers.js،functions/api/cash/grants.js،functions/api/sync/push.js،src/services/cashDrawerJournal.js،src/services/offlineGrantEnrollment.js،src/services/offlineShiftGrantPolicy.js،src/store/useAppStore.js،tests/api-integration.test.mjs،tests/cash-drawer-journal.test.mjs،tests/cash-shift-hooks.test.mjs،tests/runtime-worker.js. ملفات جديدة مقصودة: d1/migrations/0027_cash_drawer_writers.sql و0028_cash_source_proofs.sql،functions/_lib/cashReplay.js،functions/api/cash/replay.js. live-probe السابقة خارج المهمة محفوظة. لا كلمات مرور أو مفاتيح أو رموز بهذا القسم، ولا نشر إنتاجي جديد.

## ربط تسجيل الدخول وفتح التصريح — 2026-10-04، محلي غير منشور

رُبط login الفعلي بإصدار وتخزين التصريح المشفر عند provision صريح لـoptions.cashGrantStore فقط. لا يتغير المسار الافتراضي App.jsx/useAppStore() الإنتاجي. نجاح تسجيل الدخول مع تعذر خدمة التصريح يعود success مع offlineGrantStatus=unavailable، لا false-success لتصريح ولا تعطيل للدخول العادي؛ عرض هذا التنبيه في UI لم يُنفذ بعد. اختبار hook فشل قبل الربط ثم نجح: authenticated device/grant requests، تخزين vault، وعدم وجود كلمة المرور أو session token فيه.

أضيف unlockCashDrawer(password,shiftId) في hook الفعلي، يستخرج deviceId من OfflineGrantStore، ويتحقق كلمة المرور والتوقيع والفرع و24h ويستبقي مقبض التوقيع في الذاكرة فقط. فشل فتح التصريح يمسح السياق المفتوح ولا يبقي صلاحية قديمة؛ logout يلغيه، وgeneration+session/branch checks تمنع اكتمال async unlock لحساب/فرع تغير أثناءه. الاختبار السابق للفتح والبيع والإقفال والتسليم بات يفتح التصريح عبر هذه الدالة بدل حقن handle خارجي، ويثبت رفض كلمة مرور خاطئة وجهاز آخر وتصريح موقّع منتهي وعدم تسجيل المصروف أثناء القفل. ليست هذه ميزة دخول كامل دون جلسة: getSessionUser ما زال يتطلب session token غير منتهٍ؛ تجاوز انتهاء الجلسة أو أول دخول offline غير منفذ ولا مسموح ضمنيًا.

27 اختبارًا مركزًا وlint/full typecheck نجحت، بلا فشل أو تخطي. Hosted CI37223609647 نجح للمصدر السابق099986b73f5d419f2471d29fe2bf94feb1cb1038، لا لهذه التعديلات المحلية. Current Git HEAD099986b73f5d419f2471d29fe2bf94feb1cb1038، branch main. git status: تعديلات غير ملتزمة في src/store/useAppStore.js وsrc/services/offlineGrantEnrollment.js وtests/cash-shift-hooks.test.mjs وهذا الملف وdocs/current/FIVE_ITEM_REMEDIATION.md؛ untracked السابقة خارج المهمة. آخر مهمة: login enrollment/runtime unlock. أول خطوة تالية: تفويض drawer writer من الخادم/replay الأصلي، ثم UI/durable backup/restore ودخول offline كامل بتصريح مُعتمد قبل التفعيل والنشر. لا migrations أو تغيير gate أو إصدار عام في هذه المتابعة. لا قيم اعتماد سرية بهذا القسم.

## فتح وإقفال الوردية الفعليان — 2026-10-04، محلي غير منشور

npm test الكامل اكتمل exit0 في هذه المتابعة؛ أُعيدت الاختبارات المركزة بعد آخر تعديل تحقق التصريح فنجحت10/10. lint/full typecheck/docs/diff-check نجحت. حفظ الشيفرة في Git لا يعني نشر الميزة؛ cash gate معطلة.

رُبط openShift/closeShift في useAppStore بالسجل المشترك الموقّع عند cashDrawerContext، مع تحقق الحساب والفرع النشط والجهاز ومعرف الوردية. أُستخدمت مقارنة مرجع الدالة لا اسمها النصي حتى لا يغير bundler مسار الحفظ. الاختبار الفعلي يبدأ بلا وردية، ويثبت rollback الفتح والإقفال عند paired failure، ثم فتح→مصروف12→بيع27 ومخزون15→12→إقفال115 بفارق0→فتح محاسب ثانٍ على الجهاز نفسه، مع عزل aggregate لكل حساب والاحتفاظ بمصادر المحاسب الأول وتوقيعاتها. فشل اختبار الفتح قبل الربط ثم نجح بعده.

أُغلقت فجوة تحقق في primitive: التصريح الموقّع يجب أن يطابق المحاسب عند cash/close أيضًا، لا عند open فقط. اختبار تصريح صحيح لمحاسب آخر فشل قبل الإصلاح ثم نجح وترك السجل دون تغيير. 10 اختبارات hook/journal مركزة وlint/full typecheck نجحت. هذه fixtures React مع repository ذاكرة CAS؛ ليست تجربة أجهزة أو خادم حي أو شهادة تخزين عند انقطاع الكهرباء.

HEAD عند هذه المتابعة d836010a3f16c36e0c64765d90d81c31e1277b72، branch main. ملفات العمل الستة قبل commit: AI_HANDOFF_CURRENT.md وdocs/current/FIVE_ITEM_REMEDIATION.md وsrc/services/cashDrawerJournal.js وsrc/store/useAppStore.js وtests/cash-shift-hooks.test.mjs وtests/cash-drawer-journal.test.mjs. untracked السابقة خارج المهمة. لا تفعيل أو نشر إنتاجي: cashDrawerContext ما زال opt-in دون ربط login/UI، ويلزم تفويض writer من الخادم وإعادة تشغيل المصادر الأصلية عند تسليم الحسابات وbackup/restore. أول خطوة تالية هذه المسارات، لا إعادة تنفيذ الفتح والإقفال المنجزين محليًا. حالة التاريخ>2000 والتعارضات المعقدة والتحديث الداخلي الكلي لم تُغلق. لا قيم اعتماد بهذا القسم.

## ربط الحفظ المالي الفعلي — محلي غير منشور، 2026-10-04

التحقق النهائي لهذه المتابعة: npm test كامل خرج0، وlint وfull typecheck وفحص التوثيق نجحت. الاختبارات المحاسبية الموروثة17 تبقى فحوص صيغ منفصلة وليست E2E. يوجد log فشل cache متعمد ضمن اختبار server-created user، وهو سيناريو اختبار نجح لا فشل تشغيل إنتاجي. لا build/release/نشر جديد في هذه المتابعة.

أضيف commitDrawerFinancialAction وربط opt-in عبر useAppStore(options.cashDrawerContext). المسار يشغل saveInvoice/addExpense الفعليين داخل AtomicStore، ويطابق المصدر النقدي مع projection الوردية بدل إضافة الحركة مرتين، ثم يوقّع مصادر المجموعة ويحفظ aggregate وسجل الدرج عبر commitBatch واحد. يرفض تصريحًا غير موثوق وجهازًا مختلفًا ووردية غير مطابقة وتعدد مصادر نقدية أو عكس حركة غير مدعوم؛ لا حذف صامت للمصادر. اختبار hook فعلي فشل قبل الربط لأن paired failure لم يوقف حفظ المصروف، ونجح بعد الربط. تغطية إضافية أثبتت rollback المصروف والبيع والمخزون عند فشل التخزين، وتوقيع مصادر المصروف والفاتورة، وعدم تحريك النقد بالدفع البنكي. هذه اختبارات React hook مع repository ذاكرة يطبق عقد CAS/paired commit؛ ليست محاكي Android أو NSIS أو شهادة power-loss/IndexedDB.

لا يوجد caller إنتاجي يزوّد cashDrawerContext بعد: ربط login/unlock/UI وهوية الجهاز الموثوقة وتفويض writer/replay من الخادم وbackup/restore لم يكتمل. openShift/closeShift الفعليان لم يُربطا بعد بالسجل المشترك. البوابة معطلة؛ لا تفعّلها بناءً على نجاح هذا الاختبار. Current Git HEAD d836010a3f16c36e0c64765d90d81c31e1277b72، branch main. git status: خمسة ملفات غير ملتزمة هي AI_HANDOFF_CURRENT.md وdocs/current/FIVE_ITEM_REMEDIATION.md وsrc/services/cashDrawerJournal.js وsrc/store/useAppStore.js وtests/cash-shift-hooks.test.mjs؛ untracked السابقة خارج المهمة. آخر مهمة: ربط الحفظ الفعلي الموقّع. أول خطوة تالية: ربط open/close بالسجل نفسه ثم تسجيل الدخول والتفويض وإعادة التشغيل والنسخ والاستعادة قبل التفعيل والنشر. لا أسرار بهذا القسم.

## أحدث متابعة — 2026-10-04، تتقدم على حالات الانتظار أدناه

أكد المستخدم ظهور بياناته السابقة بعد التثبيت اليدوي المحلي Windows2.6.14. هذا تأكيد المستخدم لظهور البيانات، لا تدقيق مستقل للأرصدة أو اختبار لمسار التحديث الكامل من داخل التطبيق. Quality gates37221574777 للمصدرd836010 نجحت؛ عبارات انتظار CI ودخول المستخدم أدناه تاريخية.

أُصلح اختيار وردية المصروف النقدي في useAppStore: لا يُختار أول درج في الفرع عشوائيًا؛ تُطابق الشركة والفرع وصاحب الحساب. وجود ورديتين مفتوحتين للمحاسب نفسه يرفض الحركة دون حفظها بدل التخمين. اختبار hook فعلي أثبت فشل السيناريوهين قبل الإصلاح ثم نجاحهما، مع الحفاظ على وردية المحاسب الآخر دون حركة. هذه خطوة محلية محددة، وليست اكتمال الحفظ المشترك الموقّع أو تفعيل إقفال الدرج. البوابة الإنتاجية معطلة ولم تُنشر هذه التغييرات.

Current Git HEAD: d836010a3f16c36e0c64765d90d81c31e1277b72. Current branch: main. git status عند المتابعة: src/store/useAppStore.js وtests/cash-shift-hooks.test.mjs وهذا الملف وdocs/current/FIVE_ITEM_REMEDIATION.md تعديلات غير ملتزمة؛ ملفات live-probe السابقة غير المتتبعة محفوظة وخارج المهمة. آخر مهمة: منع الإسناد إلى وردية محاسب آخر أو درج ملتبس. أول خطوة تالية: ربط المعاملة المالية الفعلية بسجل الدرج المشترك والتوقيع، مع هوية الجهاز الفعلية وتفويض writer من الخادم، ثم replay/backup/restore قبل التفعيل. التاريخ الأكبر من2000 والتعارضات المالية غير المدعومة ومسار التحديث الكامل ما زالت مفتوحة. لا قيم اعتماد سرية في هذا القسم.

## آخر فحص CI — 2026-10-04

CI37221158729 للمصدرb89c2b1 فشل246/247 بسبب429 عند آخر login لاختبار صلاحيات الفروع. CI37219767996 السابق فشل npm test أيضًا. لا تنسب لهما نجاحًا؛ المصدرd5b31bc المنشور وحده له quality run ناجح في القسم السابق. السبب المثبت: helper الاختبارات المستقلة شارك IP محليًا واحدًا واستنفد15 login في دقيقة على CI الأسرع. عُزل default IP لكل fixture login دون تعديل rateLimit في الإنتاج. أعيدت247 اختبارات التكامل محليًا فنجحت؛ أُضيف اختبار API منفصل يثبت أن16 محاولة من IP واحد ما زالت تعيد429 وRetry-After60، مع مراعاة حد الدقيقة. الاختبار الجديد منفردًا نجح؛ CI للإصلاح التالي لم يُتحقق بعد.

فحص ملفات IndexedDB قبل/بعد المثبّت:7 قبل و7 بعد، ولم يفقد أي ملف من السبعة. هذا دليل ملفات فقط، لا يثبت صحة صفوف البيانات المالية أو الدخول. انتظار رد المستخدم للتحقق من حسابBRK-000 ما زال مطلوبًا. الملفات غير الملتزمة الآن: tests/api-integration.test.mjs، AI_HANDOFF_CURRENT.md، docs/current/FIVE_ITEM_REMEDIATION.md؛ HEADb89c2b1298c40627c2566fb9de171ad1c51a8cab، branch main. الملفات غير المتتبعة السابقة خارج المهمة محفوظة.

## نتيجة التثبيت الفعلي — تتقدم على حالة الانتظار أدناه

المستخدم أكد زر تنصيب عبر الأداة، واكتمل مرشد NSIS فعليًا فوق2.6.12، ثم فتح التطبيق2.6.14 وأظهر قاعدة البيانات المحلية جاهزة. الملف المثبت ProductVersion2.6.14.0، وresources/Braka.UpdateHelper.exe موجود ببصمة8fed2ec679508e9ba227a35a0527d0e37b2a6e885d1665f46f0d82757fa2bc0e. لم تظهر رسالة أعد المحاولة في التثبيت اليدوي. هذه ليست شهادة لمسار download→install من داخل البرنامج؛ كانت bootstrap يدوية لإصلاح updater القديم. لا شهادات Authenticode أو تجاوز تحذير أمني، ولا إصدار عام جديد.

شاشة الدخول بعد التشغيل عرضت BRK-101 بدل BRK-000 واسم دخول فارغ. لا تعتبر هذا وحده فقد بيانات، ولا تزعم تحقق البيانات المالية. طُلب من المستخدم تسجيل الدخول بنفسه بكودBRK-000 والتأكد من الأصناف والفواتير؛ لا تؤتمت إدخال كلمة مروره. نسخة احتياطية خاصة كاملة موجودة بالمجلد المذكور أدناه، لا تحذفها. إقفال الدرج الكامل وحجم التاريخ والتعارضات المالية ما زالت مفتوحة.

تعديلات الحماية والحفظ الموقّع أصبحت commit b89c2b1298c40627c2566fb9de171ad1c51a8cab، main مرفوع إلىorigin/main. هذا تحديث توثيق لاحق غير ملتزم في لحظة كتابته. أول خطوة تالية: نتيجة دخول المستخدم والتحقق من البيانات، ثم ربط cash proof بـlogin/actual sale/server writer authorization/replay والنسخ والاستعادة؛ لا تفعّلcash مبكرًا.

## متابعة إقفال الدرج — 2026-10-04، محلي فقط

HEAD عند بدء المتابعة: 138b1327f8719f86f6f6d1276f6ccdccafb69c19، branch main. أضيف ربط public key للحركات بالتصريح الموقّع من الخادم. المفتاح الخاص يُحفظ داخل vault AES-GCM بمفتاح مشتق من كلمة المرور عبر PBKDF2، لا plaintext أو bearer token. فكّ القفل يعيد CryptoKey غير قابل للتصدير داخل WeakMap، ولا يتيح التوقيع بمقبض زائف. إثبات مصدر الحركة يحمل المصدر الكامل بما فيه ID/time/preconditions مع التوقيع والتصريح؛ تحقق الخادم المشترك يثبت المحاسب الأصلي والجهاز والفرع وصلاحية التصريح وقت إنشاء المصدر، لا وقت رفعه المتأخر. هذا إثبات إنشاء وليس قبولًا محاسبيًا أو تحققًا من إلغاء صلاحية الجهاز بالخادم.

commitDrawerShiftDurable يدعم financialAction متزامنة داخل المعاملة، ويشترط مصدرًا ماليًا واحدًا يطابق قيمة الحركة ومعرّفها ووردية الدرج. توقيع كل أحداث المجموعة يتم قبل commitBatch الذي يحفظ aggregate المستخدم وسجل الدرج المشترك معًا. فشل التوقيع أو عدم تطابق المبلغ أو فشل التخزين يبقي السجل السابق؛ open/close يدعمان signSources، والمصادر السابقة لا تُسقط عند الإقفال. اختبار المصروف يستخدم مفتاح expenses_v3 الحقيقي وحماية provenance، لا مخزنًا بديلًا. لم يُربط هذا بعد بالمسار الفعلي useAppStore/login/UI/push؛ لا تفعّل cash gate، ولا تزعم اكتمال الفواتير أو تسليم درج بين حسابين في الإنتاج.

الفحوص: 21 اختبارًا مركزًا و6 API محلية حقيقية نجحت، lint/full typecheck ناجحان. npm test كامل: 5 أمن +247 تكامل +13 مراجعة +3 مساعد Windows، بلا فشل أو تخطي؛ 17 فحص صيغة موروث منفصل. الاختبارات الجديدة فشلت قبل الإصلاح للتشفير والتسجيل الإلكتروني وحفظ المصروف مع journal. فحوص API public-key أضيفت بعد التنفيذ كتغطية تكامل، لا ادعاء TDD لها.

Windows: النسخة المثبتة فعلًا2.6.12، فُتحت عبر أداة Windows الأصلية؛ المستخدم دخل بنفسه. أُغلقت طبيعيًا بعد التأكد من فاتورة فارغة، وحُفظ installation+user-data في scratch/artifacts/windows-native-upgrade-e1de02cab89841e4afa54964d4b7b27b (خاص ignored، لا تنشره). الحزمة المحلية2.6.14 SHA256 02701ffdbbc5a6d44d27562070fab87b2f7547288bde0cacebc0859ee542f67a، مبنية من d5b31bc وليست نفس ثنائي الإصدار العام؛ لا تستبدل public immutable assets. فُتح المثبّت ووصل إلى زر تنصيب في المجلد نفسه. التأكيد النهائي عبر الأداة مطلوب قبل النقر؛ لا تتجاوز التحذيرات الأمنية. ما زالت الترقية غير مثبتة في هذه اللحظة.

ملفات هذه المتابعة غير الملتزمة: functions/api/cash/grants.js، src/services/cashDrawerJournal.js، src/services/offlineGrantEnrollment.js، src/services/offlineUnlock.js، src/services/verifiedOfflineGrant.js، tests/api-integration.test.mjs، tests/cash-drawer-journal.test.mjs، tests/offline-grant-enrollment.test.mjs، tests/offline-unlock.test.mjs، AI_HANDOFF_CURRENT.md، docs/current/FIVE_ITEM_REMEDIATION.md. untracked live-probe السابقة خارج المهمة. أول خطوة تالية: إتمام اختبار المثبّت بعد التأكيد، ثم ربط الحفظ الموقّع ببيع فعلي وlogin/server replay مع تفويض drawer writer وbackup/restore قبل تفعيل الدرج. حجم التاريخ والتعارضات المعقدة لم يكتملَا. آخر قراءة استخدام28% لخمس ساعات،61% أسبوعيًا؛ لا يمكن إعادة ضبطها برمجيًا. هذا القسم خالٍ من قيم الأسرار.

## نشر متوافق من Git — آخر نتيجة 2026-10-04

Source HEAD: d5b31bcdf325b5832b81d1e3cd1783bd3f8c3396؛ branch main، مرفوع إلى origin/main، Quality gates 37219367640 ناجحة. أُنشئ clone محلي مستقل --no-hardlinks لهذا الـcommit، npm ci/build نجحا وgit status --porcelain فارغ. أنتجت الوصفة 146 ملفًا، وتجميع Wrangler 4.147.0 نجح، ونُشرت الحزمة إلى https://5b8efbd8.khodar-pos.pages.dev وإنتاج khodar-pos.pages.dev دون migrations أو تفعيل cash.

الفحوص الحية: الصفحة وhealth وmetadata Windows تعيد200؛ pull بلا اعتماد يعيد401. فحص مالك شركة تجريبية: تسجيل الدخول ومراجعة التعارض واعتماد المصدر واسترداد receipt وسعر12 نجحت، ثم أعاد الاختبار السعر10. المحاولة الأولى انتهت بمهلة انتظار تنقل؛ أُضيف تصوير عند فشل التنقل ونجحت الإعادة بلا pageErrors. لا تزعم أن المهلة شُخصت نهائيًا أو أن هذا اختبار شامل لكل المنصات.

بُني أحدث مثبّت Windows محليًا وتأكد وجود resources/Braka.UpdateHelper.exe. لم يُثبّت فوق نسخة المستخدم ولم يُنشر كإصدار جديد؛ خدمات التحديث والثنائيات العامة تبقى2.6.14. المتبقي: اختبار ترقية NSIS حقيقية، التكامل الكامل لإقفال الدرج، checkpoints لتاريخ أكبر من2000، وباقي التعارضات المالية غير المدعومة. أول خطوة تالية: هذه البنود، لا إعادة تنفيذ نشر الخادم المنجز. هذا تحديث توثيق إضافي؛ git status قبل حفظه: هذا الملف وRELEASE_BLOCKERS.md وdocs/current/FIVE_ITEM_REMEDIATION.md وtests/live-review-smoke.mjs معدلة، وملفات live-probe السابقة غير متتبعة خارج المهمة. HEAD المسجل هنا هو مصدر النشر، وليس commit التوثيق اللاحق الذي يحتوي هذا القسم. لا توجد قيم اعتماد سرية.

## تحديث المتابعة الفعلي — 2026-10-04، غير منشور

هذا القسم يصحح حالة النموذج المزال في القسم التالي. أضيف مساعد Windows أصلي قابل للبناء من electron/native/UpdateHelper.cs، مع جاهزية ذرية قبل إغلاق التطبيق، تحقق checksum وهوية العملية، ونسخة مؤقتة خارج مجلد التثبيت لمنع قفل ملفات NSIS. اختبارات العملية الأصلية نجحت؛ لم تُجرَ ترقية NSIS على نسخة المستخدم، ولم يُنشر إصدار جديد. لا تعطيل للحماية أو تجاوز تحذيراتها.

أُصلح رفض إعادة تشغيل تحويل مخزون بين فرعين: يجب إثبات زوج حركات المخزون في المجموعة نفسها وبالكمية نفسها، دون احتساب الأثر مرتين. أُضيف منع محاسب آخر من تحريك أو إقفال وردية ليست له. هذه إصلاحات محددة، وليست اكتمال ميزة إقفال الدرج؛ البوابة ما زالت معطلة، والتاريخ الأكبر من 2000 حدث والتعارضات المالية غير المدعومة ما زالت مفتوحة.

آخر npm test: 5 فحوص أمن، 244 اختبار تكامل، 13 اختبار مراجعة، 3 اختبارات مساعد أصلي، كلها ناجحة بلا تخطي؛ 17 فحص صيغة موروث منفصل وليست E2E. اختبار حزمة الإنتاج المنفصل نجح. lint وtypecheck نجحا في المتابعة السابقة. يلزم إعادة بناء الحزمة بعد آخر تعديلات ثم اختبار الترقية الفعلية. وصفة deployment/production مقيدة ببصمات المدخلات؛ لم تُختبر بعد من commit جديد ولم تُنشر.

Current Git HEAD: 84022ebb008b06c4802998485f165ae7a14e0261. Current branch: main. git status: تعديلات المهمة غير ملتزمة مع ملفات فحوص حية سابقة غير متتبعة يجب استبعادها. ملفات المهمة: .github/workflows/production-release.yml، .github/workflows/quality-gates.yml، AI_HANDOFF_CURRENT.md، RELEASE_BLOCKERS.md، docs/INDEX.md، docs/current/FIVE_ITEM_REMEDIATION.md، electron/main.cjs، electron/update-installer.cjs، electron/native/UpdateHelper.cs، package.json، scripts/verify-docs.cjs، scripts/build-production-server.cjs، scripts/build-update-helper.cjs، deployment/production، src/services/cashShiftEngine.js، src/services/reviewLedgerReplay.js، tests/cash-shift-engine.test.mjs، tests/review-ledger-replay.test.mjs، tests/update-installer.test.cjs، tests/native-update-helper.test.cjs، tests/production-bundle.test.cjs، tests/fixtures/update-installer-fixture.cs.

آخر مهمة: فحص الإصلاحات الخمسة مع مساعد تثبيت أصلي ووصفة خادم قابلة لإعادة البناء. أول خطوة تالية: فحص التوثيق وtypecheck النهائي، commit مقيد بهذه الملفات، ثم checkout نظيف وبناء وصفة الخادم والتحقق منها قبل النشر؛ لا تطبق migrations 0017–0022 تلقائيًا. تابع التكامل الكامل للدرج وحجم التاريخ؛ لا تعتبر اجتياز الاختبارات إغلاقًا لهذه البنود. الاستخدام المقروء في المتابعة: 10% لخمس ساعات و58% أسبوعيًا؛ لا يمكن تصفير الحدود برمجيًا. لا يحتوي هذا القسم قيم اعتماد سرية.

## أحدث عمل — معالجة البنود الخمسة، 2026-10-04 (غير منشور)

المستخدم طلب إقفال الدرج، تسوية تعارضات الشركات الكبيرة، التعارضات المالية المعقدة، إعادة نشر الخادم من Git، وإصلاح اختفاء المثبت. مرجع التقدم: docs/current/FIVE_ITEM_REMEDIATION.md. لا تعتبر تقرير التوثيق أدناه آخر مهمة فعلية بعد هذا القسم.

اكتُشف سلوك Windows فعلي: detached PowerShell خرج 0 دون تنفيذ الأمر؛ تشغيله العادي نفذ الأمر. نموذج bootstrap مع ملف جاهزية نجح مرة، لكن إعادة الاختبار أعطت 243 نجاحًا و2 فشل من245، مع spawn EPERM. سجل Defender event1116 اكتشاف Trojan:Win32/Commando.A!ml ومسارًا يذكر PowerShell وEncodedCommand في نفس الأوقات؛ لا تجزم بإصابة ولا تعتبره false positive مثبتًا. لم تُعطّل الحماية أو تُستثنَ ملفات. أزيل النموذج التجريبي وfixture الجديد وأعيد electron/update-installer.cjs وtests/update-installer.test.cjs إلى HEAD، ولذلك لا يوجد إصلاح مثبّت مكتمل في الشيفرة الحالية. لا توجد ترقية NSIS فعلية ولا تثبيت فوق نسخة المستخدم. نتيجة245 اختبار تخص النموذج الذي أزيل وليست شهادة النسخة الحالية.

أضيفت ثلاثة overrides متوافقة مع الإنتاج في deployment/production/overrides/functions وscripts/build-production-server.cjs؛ الحزمة 146 ملفًا وWrangler compile نجح. لم يُنشر الخادم؛ اختبار fresh committed checkout لم ينتهِ. لم تتغير cash gate أو مخطط الإنتاج. إقفال الدرج وحجم تاريخ التعارضات والحالات المالية المعقدة ما زالت OPEN.

HEAD الحالي: 84022ebb008b06c4802998485f165ae7a14e0261. الفرع: main. لا commit لهذه المعالجة حتى الآن. الاستخدام المقروء مؤخرًا: 81% لخمس ساعات، 56% أسبوعيًا؛ لا يمكن تصفيره برمجيًا.

ملفات المهمة المعدلة/الجديدة غير الملتزمة: scripts/build-production-server.cjs، scripts/verify-docs.cjs، deployment/production/README.md، deployment/production/overrides/functions/_lib/syncPolicy.js، deployment/production/overrides/functions/api/tenants/lookup.js، deployment/production/overrides/functions/api/sync/push.js، docs/current/FIVE_ITEM_REMEDIATION.md، docs/INDEX.md، RELEASE_BLOCKERS.md، وهذا الملف. بقية untracked live-probe والتقرير السابق خارج المهمة؛ لا تضُمها تلقائيًا. هذا القسم لا يحتوي قيم أسرار أو حسابات تجريبية خاصة.

أول خطوة تالية: صمّم handoff آمنًا لا يعتمد على نموذج PowerShell المشفّر المرفوض، ثم اختبره والحماية مفعّلة، بما في ذلك ترقية NSIS معزولة. تحقّق من حزمة الخادم من Git نظيف قبل النشر. تابع المتبقي دون افتراض أن الأجزاء الموجودة تعني ميزة الدرج مفعلة. لا تطبق migrations 0017–0022 تلقائيًا.

## أحدث مهمة — توحيد التوثيق، 2026-10-04

المرجع الشامل الحالي هوREADME.md وdocs/INDEX.md و7أدلة فيdocs/current:ARCHITECTURE،USER_GUIDE،ACCOUNTING،SYNC_AND_RECOVERY،SECURITY،OPERATIONS،CHANGE_HISTORY. أضيفت ملاحظاتdocs/releases/2.6.14.md، وأُشير إلى60وثيقة قديمة كسجل تاريخي دون تغيير أدلتها. تقرير2.6.14 المنشور وسجل الموانع يحتفظان بالفرق بين التحقق المحدد والتغطية غير المنجزة.

هذه المهمة توثيق فقط: لا تغيير في المحرك المالي أوالمزامنة أوالهوية أوالمخطط، ولا إعادة بناء أو استبدال ثنائيات2.6.14. أضيفscripts/verify-docs.cjs للفحص المحلي: الروابط والفهرس وتنبيهات التاريخية وأنماط الاعتماد والإصدار وتنسيقbackup4. نجح الفحص، واختبار رابط مفقود متعمد رُفض ثم أزيل. فحصdocsليس اختبارًا ماليًا جديدًا.

وثّقنا فجوة تشغيلية صراحة:stageالإنتاجscratch/sync-hotfix-20261003ignored وغير مستعاد باستنساخGitوحده؛ لا توجد وصفة آلية عامة معتمدة لإعادة تركيبه. لا تنشرmainhandlersأو0017–0022 لتعويض ذلك. معالجة reproducible deploymentمهمة تقنية منفصلة، وليست تغييرًا تم في هذه المهمة.

## المرجع الأحدث — نُشر2.6.14 بالفعل، 2026-10-04

هذا القسم يتقدم على جميع عبارات «قيد العمل/غير منشور/اختيار فقط/ترقيمOPEN» التاريخية أدناه. الإصدار2.6.14 منشور: https://github.com/amerfathi/khodar-pos/releases/tag/v2.6.14، والويب https://khodar-pos.pages.dev عبر deployment https://d6d5e52a.khodar-pos.pages.dev. خدمات latest للويب وWindows وAndroid تعرض2.6.14؛ روابطها200 وmanifestWindows صحيح بالمفتاح المثبّت. تقرير الدليل والحدود:docs/release-2.6.14-verification.md، والسجل المحدّثRELEASE_BLOCKERS.md.

نُفّذت تسوية المالك بسجل مصادر محفوظ وreceipt ذري غير قابل للاستبدال، واسترداد الجهاز منcheckpointمصَفّى بالصلاحيات مع أرشفة الأصل قبلclearqueue؛ لا حذف عند الفشل. تحقّق legacyproduct بتاريخ موثوقفرعي دون تغييرDBsource، وأرقام جديدةUUID كاملة مع مرجع ظاهرlossless موحد للطباعة/البحث.259اختبارًا آليًا نجحت و17فحصصيغة موروث ليستE2E؛ APIindexed45،lint/typecheck/build ناجحة. مصفوفة الإنتاج النهائية8سيناريوهاتWebوحزمةWindowsالمستخرجة نجحت؛ Androiddebug/Weboffline/reconnect نجح مستقلًا. signedAPK2.6.14/26140 بنفس شهادة الإنتاج ثُبّت وفُتح علىAVDمنفصل. لا تزعم رحلة مالية كاملة للـsignedAPK أو ترقيةWindowsالمثبت أو طابعة فعلية.

بناء الحزم الناجح37192819553 منsource f850a7679e7bdc1b57ebfb6ebc39268be1b0c778. الرفع المحلي الكبير تأخر فأُوقف وحده؛ uploaderGitHubلم يُعد بناء الحزمة، ونجح37193814889 بعد التحقق من منشأ البناء/الإصدار/المفتاح/hash. اختبار إصدار خاطئ37193798716 فشل ومنعupload. بصمات الأصول العامة3طابقتCI قبل إعلانrelease ونشرmetadata. لا تغيير فينسخةWindowsالمثبتة أو شهادةAndroid أو الاشتراكات المدفوعة.

قاعدةالإنتاج:exportخاصignored سبق إضافة0023–0026 فقط؛ لم تُطبّق0017–0022 أو تغيّر المصادر المالية المقبولة. النشرمنscratch/sync-hotfix-20261003 المتوافق، لا mainfunctionsكاملة. cashshiftsتبقىمعطلة. التسوية≤2000مصدر وتفشل مغلقًا عندhistory/relationsغير مدعومة؛ صلاحيات تحجب علاقة لازمة قد تمنعcheckpoint ولا تُوسَّع تلقائيًا. لاAuthentiCode ولا شهادةسعة1000مستخدم.

## الأحدث — تنفيذ التسوية وتجهيز نشر2.6.14، 2026-10-04

يتقدم هذا القسم على وصف «تسجيل اختيار فقط/تسوية غير منفذة» أدناه. نُفّذ قرار المالك المركزي فعليًا مع snapshot حديث، إعادة تشغيل مالية كاملة، سجل receipt غير قابل للاستبدال، وguard SQL في نفس D1batch مع المصادر البديلة وإقفال المراجعة. طلب الاختيار القديم دونexecute يبقى intent فقط للتوافق. الجهاز يستلم checkpoint مصفّى بصلاحياته بعد حساب أرصدته من التاريخ الكامل على الخادم، ويحفظ الأصل والأرشيف والحالة والطابور والمؤشر ذريًا؛ فشل الحفظ يحتفظ بالأصل كاملًا. جميع أحداث الطابور يجب أن تكون مغطاة بقرارات معتمدة؛ البقية تُرفع للمراجعة ولا تُسقط.

أُصلح استرداد مصدر الصنف القديم بدليل تاريخي لفروعه، مع endpoint معتمد، وترطيب محلي ذري وتحقق مصادر أي بيع لاحق دون تعديل سجلDB القديم. رقم الفاتورة الظاهر يشمل UUID كاملة بترميزlossless موحد في البحث/الطباعة؛ توليد المعرف الجديد UUID لكل الهويات، بما فيها القديمة. لفّ النص في الإيصال وA4 يحفظ المرجع كاملًا.

التحقق حتى هذه اللقطة:257 اختبارًا آليًا نجح قبل إضافة اختبارhook واستردادlegacyAPI الأخيرين، إضافة17فحصًا حسابيًا موروثًا وليستE2E. Lint/typecheck/build نجحت. شاشة المالك على معاينةqa-2614 نُفذت فعليًا:posted:true، استردادprice12، لاpageerrors، أُعيد سعرQA إلى10. اختباراتWeb/Windows المالية الحية الأولية نجحت7سيناريوهات، ومعاينةWeb+Androiddebug نجحتoffline/reconnect معaccepted1/pending0 وكميات متطابقة بعدreload. اختبارجهازيWindows فشلprepare مرة ثم نجح إعادة منفردة؛ لا تُخفِ فشل المحاولة. الحزمة الموقعة وتجربةAPKالإنتاجي ليست معتمدة بعد. الدورة النهائية والبناء والنشر قيد العمل؛ لا تُعلن نشر2.6.14 قبل دليل.

قاعدة الإنتاج:أُخذ exportمحلي خاصignored قبل إضافة0023–0025 فقط، وسُجلت أسماؤها فيd1_migrations. لم تتغير المصادر المالية، ولم تُطبّق0017–0022. بُني ونُشرpreviewعلىstageالمتوافقscratch/sync-hotfix-20261003، لا mainfunctionsكاملة. PreviewAUTH_SECRET عشوائي مستقل لا يغيّر جلسات الإنتاج. لا قيم اعتماد بهذا الملف.

حدود:replay≤2000مصدر، والأنواع/العلاقات غير القابلة للتسوية تفشل مغلقًا دون حذف. صلاحيات غير اعتيادية تحجب علاقة مطلوبة قد تمنع تثبيتcheckpoint حتى توفير توسعة مصفّاة مثبتة؛ لا توسع صلاحيات موظف لحل ذلك. CASH_SHIFTS_ENABLED ما زال مغلقًا في الإنتاج. لا Authenticodeولا ضمان سعة1000مستخدم أو خلو مطلق من الأخطاء. راجعdocs/conflict-owner-review-2026-10-04.md.

لقطةGit قبلcommitالمرشح:CurrentGitHEAD=`54ab99fc0b1077d1de266c6f4cd1aad1b24f6e12`، currentbranch=`main`، مساويةorigin/main. gitstatus=تعديلاتالمرشح غيرcommitted فيsrc/services/store/components،functions/sync،d1/schema+migrations0023–25،versionfiles،tests،هذاالملف والتقريرين. الملفات التاريخيةuntrackedبما فيهاlive-auth/provision diagnostics محفوظة دون ضمها. آخرمهمة:إكمال الإصلاح والاختبار والنشر بتفويض المستخدم دونتوقفات مرحلية. أولخطوة:استكمل نتائجالدورةالنهائية، احفظ المرشح وشغّلworkflowالبناءالموقّعpublish=false، اختبرالمخرجات، ثم نشرWebوالإصدار وmetadataوالتحقق الحي وتحديثهذهاللقطة.

## Latest LOCAL step — staged reviewed ledger projection, 2026-10-04

New src/services/reviewLedgerReplay.js and tests/review-ledger-replay.test.mjs. Pure staging, no storage/API/ledger writes. Reuses actual applyInvoiceInventory/adjustBalance/applyPurchaseInventory for products/customers/suppliers/invoices/purchases/expenses/payments/branches. Unsupported sources (settings, returns, waste, workers, partners, shifts, restore/transfers etc) fail closed. Invoice financial update unsupported; notes only. stageReviewedResolution binds complete queued originals to receipts, archives originals, verifies local-choice accepted replacements match type/entity/action/branch/payload, rejects incomplete commit groups or any unreviewed pending suffix. Receipts are NOT authenticated here; future API verification and current-head/revision guards remain mandatory. Tests watched fail before implementation;10 focused test:conflict-review pass, lint/typecheck pass before final additional adversarial assertions. Added test file to package.json script. No atomic installation or server application wired; do not mistake staged projection for completed settlement. Next: authenticated immutable resolution receipts, complete replay coverage and transactional archive/state/outbox installation with rollback tests, then actual hook/browser/native/live verification. Prior published2.6.13 untouched; HEAD54ab99fc0b1077d1de266c6f4cd1aad1b24f6e12/main, dirty. No commit/push/deploy.

## Current task — authorized completion and publication, 2026-10-04

Verification completed: npm test exited0 (security + integration + registered conflict-review + inherited accounting checks), lint/typecheck exited0, Web build exited0 with existing large-chunk warning. Intentional injected-failure console logs are from failure-path tests, not a clean-runtime certification. No live/native or resolved-ledger tests for this feature because resolution is still unimplemented. Do not label these results production certification. No publish performed.

User authorized finishing and publication, but not unsafe ledger overwrites. Added LOCAL automatic evidence POST for exact causal409 only after independent-sales recovery fails; idempotency/permission failures are not uploaded as owner choices. Complete batch preserved, no outbox removal/state mutation/cursor advance; session/generation checked around response. Receipt posted:false produces review_pending, never synced_batch. tests/sync-durable.test.mjs regression failed before change, all12 focused pass after; expanded cases ensure idempotency409 not submitted and evidence503 keeps original ledger without false receipt. Modified src/services/cloudflareSync.js and tests/sync-durable.test.mjs plus prior candidate. Full npm test running; record actual completion below.

Publication still UNSAFE: no canonical financial resolution/client rebuild exists, recorded owner intent not applied. Do not publish partial feature as solved, do not clear queue or merely rebase heads after owner choice. Also stale review snapshots need append-only refreshed evidence before new decision can be taken after heads change. Need transactional resolution receipt + replay/source archive + dependent pending batch reconciliation and actual web/native/live test before new version. Current HEAD54ab99fc0b1077d1de266c6f4cd1aad1b24f6e12/main, dirty status includes all earlier candidate files. No production migrations, release version change, commit or push in this step. No secrets here.

## Local owner conflict review foundation — 2026-10-04

Final verification for owner screen step: 43 actual workerd/D1 API tests pass, 5 static UI/legacy-proof tests pass via new npm test:conflict-review included in npm test. Lint/typecheck/build pass; Vite warns of existing large chunk. Schema bootstrap updated to match migrations0023/0024. Review fixture isolated to REVIEW tenant to avoid altering other accounting test baselines. Changed server heads reject new decision409; immutable same-choice retry remains evidence only. Current Git status dirty: prior candidate plus d1/schema.sql, package.json, src/components/SettingsView.jsx, tests/api-integration.test.mjs, tests/runtime-worker.js, this handoff; new owner-review files listed below. First next step remains client upload and canonical ledger resolution, then interactive browser/native/live verification, not publication of incomplete recovery.

Additional LOCAL step: SettingsView mounts ConflictReviewPanel for nonstaff company_owner/super_admin only. New component src/components/ConflictReviewPanel.jsx, characterization tests/conflict-review-ui.test.mjs, migration0024_sync_review_decisions.sql and PATCH intent handler (posted:false), atomic current-head guard, no posting. Real API regression expanded: staff/foreign denied, same-choice retry, opposite-choice409, no accepted event insertion; failed404 before PATCH then passed. UI visibly awaiting reconciliation, not conflict solved. Client conflict submission and canonical financial resolution remain missing. Lint/typecheck/build passed (existing large-chunk warning). No deploy/migration/commit. New tests not yet registered in npm integration script; run explicitly until added.

User approved central owner review; no last-write-wins. New uncommitted files: d1/migrations/0023_sync_conflict_reviews.sql, functions/api/sync/conflicts.js, docs/conflict-owner-review-2026-10-04.md. Modified: tests/runtime-worker.js, tests/api-integration.test.mjs and this handoff, in addition to existing dirty candidate files. Real workerd/D1 capture/list test failed before implementation and passed after; lint/typecheck passed. No client upload/decision UI or canonical recovery yet. No production migration/publish. Current HEAD54ab99fc0b1077d1de266c6f4cd1aad1b24f6e12, branch main. Next: adversarial capture tests then conditional owner resolution and safe ledger rebuild. Evidence upload is not acknowledgement; never clear outbox. Details and assumptions in design document. No credentials included.

## Latest local candidate — inbound dependencies, 2026-10-04

User authorized repairing the Edge cashier failure in BRK-000. Shared client receiver now retains whole missing-dependency groups atomically while allowing independent reference creates, with bounded retry and explicit incomplete-ledger warning/financial/report/backup guards. Full recovery export preserves the aggregate. Production sources and grants remain unchanged. See docs/inbound-dependency-recovery-2026-10-04.md. Candidate is LOCAL, not published; package remains2.6.13, do not overwrite immutable published2.6.13 artifacts. Source baseline HEAD54ab99fc0b1077d1de266c6f4cd1aad1b24f6e12, main. Modified uncommitted: src/App.jsx, src/services/atomicStore.js, src/services/businessEffects.js, src/services/invoiceInventory.js, src/store/useAppStore.js, tests/atomic-store.test.mjs, tests/store-business.test.mjs, tests/store-sync.test.mjs, this handoff. New candidate files: src/services/missingDependency.js and docs/inbound-dependency-recovery-2026-10-04.md. Historical untracked live diagnostics remain untouched. First next step: final full suite after last bounded retry/report gate, then candidate browser/package verification and a new versioned publication only when ready. Permanently unscoped legacy product still needs owner-reviewed migration; do not automatically widen branch access or claim cashier finance restored.

## الأحدث — تسوية فواتير مستقلة متعددة الأجهزة، 2026-10-03

نُفذ إصلاح سببية محدود لفواتير create مستقلة؛ التفاصيل والأدلة في docs/sales-reconciliation-2026-10-03.md. مسار rebase محمي يراجع تاريخ D1 وهوية السجلات ويعيد فقط فروع المستخدم. الحفظ المحلي ذري: استقبال مرة واحدة + cursor + outbox/preconditions؛ payload/IDs/group لا تتغير. التعارضات غير القابلة للجمع تظل محفوظة وموقوفة. أضيفت حماية سباق pull/checkout. المصادقة المجانية المنشورة مستمرة.

نجحت رحلات فعلية offline/reconnect على Web/Electron وAndroid debug2.6.13 مع الويب، محليًا وعلى السيرفر الحي، بما فيها نفس الحساب على جهازين وحسابان مختلفان؛ كل مصدر مرة واحدة وpending0. API المحدود منشور a8b3ebde؛ واجهة الإنتاج كانت2.6.11 في هذه اللقطة، والحزم النهائية قيد التجهيز. 232 integration قبل الحماية الأخيرة، و84 focused نهائية، و42 API، وlint/typecheck نجحت. ترقيم الفاتورة الظاهر ما زال يتكرر؛ لا تعلن اكتمال كافة التعارضات أو المنصات/المثبتات.

أول خطوة بعد هذه اللقطة: حفظ commit، إكمال فحوص GitHub وبناء/نشر2.6.13، ثم توثيق URLs وHEAD والحالة النهائية. لا تنشر candidate API/time_zone migrations على الإنتاج؛ حزمة API المحافظة في scratch/sync-hotfix-20261003 مبنية منc10f4e5 + auth hotfix + rebase فقط. لا بيانات اعتماد فعلية في هذا الملف.

## الأحدث — إصلاح الدخول المجاني منشور 2026-10-03

المستخدم رفض أي اشتراك إضافي. وُجد ونُفذ بديل مجاني داخل Cloudflare: bcrypt12 داخل SQLite Durable Object خاص، متاح على Free بوقت CPU30s. Pages يمرر المهمة عبر PASSWORD_CRYPTO؛ لا كلمات مرور مخزنة فيDO، لا endpoint عام ولا صلاحية DB للخدمة ولا تغيير كلمات مرور المستخدمين. جميع مسارات hash/verify تمررenv، وفقدbinding يفشل مغلقًا. يتقدم هذا على الاقتراح التاريخي بأن الخطة المدفوعة أوVPS هما الخياران الوحيدان.

نُشر Worker braka-password-crypto version479415e2-95c8-49e0-bda7-c7b7fb5e1b52، وPages hotfix b7928fe4 (https://b7928fe4.khodar-pos.pages.dev). بقيت واجهة2.6.11 بأصولها المطابقة، والمثبتات كما هي. حزمة الطوارئ فيscratch/auth-hotfix-20261003 مبنية منc10f4e5 بإصلاح المصادقة فقط؛ لا تنشر مرشح2.6.13 أو ترحيلاته تلقائيًا. لم تتغير خطةFree أو تُضف رسوم.

اختبارات:41API محلي عبرworkerd+DO نجحت، واختبارا password-crypto نجحا، guards/lint/typecheck نجحت. حيًا: دخول ملاك/موظفين لشركتين200، تغيير كلمة مرورfixture200، الجلسة/الكلمة القديمة401، الجديدة200، وإعادة كلمةfixture الأصلية والتحقق200. Androiddebug WebView API200 (ليس اختبارAPK منشور كامل). Web/Windows شركتان مختلفتانonline وoffline/reconnect: كل فاتورة مرة واحدة وpending0. سجلCPU النهائيoutcome=ok لكل الطلبات؛ login6–21ms معظمها6–10، password change9/14ms، آخرprobe7ms/200؛ النجاح فوق10 قد يستفيد منburst، فلا تزعم ضمان انعدام1102 مستقبلًا أو سعة1000مستخدم. حصصFree يومية محدودة.

المزامنة المالية **لم تُصلح بعد**: اختبار حي لكاشيرين في الفرع نفسهoffline أعاد200 لفاتورة و409 للثانية وبقيتpending1 بعدreload؛ ترقيمinvoiceNumber ما زال يتكرر1. الأدلة محفوظةignored. الخطوة التالية: إصلاح تسوية مصادر مالية مستقلة مع الحفاظ علىpreconditions وidempotency، ثم ترقيم آمنoffline واختبارنفس/مختلف الحسابات والمنصات. لا تزيل409 أو تعدلpayload المقبول أوتُسقطoutbox.

Current Git HEAD:4dfc6d45864b6f761c8afe9f32a778dd976c20bd، branch main، مدفوعorigin/main. commitيشمل إصلاح المصادقة والخدمة والاختبارات وتقريرdocs/auth-cpu-hotfix-2026-10-03.md. غيرcommitted:هذا الملف،RELEASE_BLOCKERS.md،tests/platform-matrix-server.mjs؛ ملفات جديدة pending:docs/multi-company-live-ui-audit-2026-10-03.md وtests/platform-multi-company.mjs وtests/live-{test-provision,auth-resource-probe,account-plan-probe,android-auth-probe,auth-validation}.mjs. لا أسرار فعلية بهذا التسليم؛الاعتمادات التجريبية فيscratch ignored فقط.

## تحقق جديد من سبب503 — 2026-10-03

السجل الحي المفلتر لطلب QA إلى /api/tenants/lookup أعاد outcome=exceededCpu، cpuTime=18ms، wallTime=196ms، status503. محفوظ في scratch/artifacts/live-multi-company/auth-resource-probe.json دون أسرار. تحسّن قارئ tail لالتقاط JSON المتعدد وانتظار بدء العملية؛ tailReady=false لا ينفي السجل اللاحق الذي التُقط فعليًا. لوحة Cloudflare > Compute > Workers plans أكدت Free / Current plan و10ms CPU per request؛ الخطة أصبحت معلومة، وهذا يصحح عبارة plan unknown في القسم السابق. Paid معروض5USD/month + usage. لم نضغط Upgrade أو نشترِ شيئًا. bcrypt12 في النسخة المنشورة مطابق للشيفرة الحالية، وهو مشتبه الحساب المكلف؛ trace يثبت تجاوز CPU للطلب ولا يعطي stack profile للدالة. لا تخفّض تكلفة التشفير. الحل التشغيلي المباشر يحتاج خطة CPU مناسبة وموافقة التكلفة؛ البديل نقل التحقق إلى خادم يملكه المستخدم بعد تحديده وتأمين الاتصال. لا يوجد إصلاح منشور ولا اعتماد للمصفوفة الحية بعد.

## أولوية حالية — محاولة الاختبار على الإنتاج 2026-10-03

المستخدم أجاز الاختبار الحي لجميع المنصات. أنشئت fixtures معزولة LIVEQA-AD6B6784-CA/CB: شركتان، أربعة فروع وثمانية حسابات تنتهي بعد يومين. بيانات الاعتماد محفوظة فقط في artifact محلي ignored، وليست هنا. تسجيل مالكي fixtures ورفع صنفين لكل شركة عبر API الحي نجحا أولًا. محاولة رحلات Web/Windows لم تكتمل: POST /api/tenants/lookup أعاد HTTP503/HTML مع Cloudflare1102 (Worker exceeded resource limits)، مؤكّد من طلب مباشر ومن واجهة الويب. لا تدّع اكتمال السيناريوهات المالية الحية أو وجود حل للتعارضات.

اشتباه CPU bcrypt12: تحقق محلي نحو282ms CPU، لكنه ليس قياسًا على Cloudflare. tail لم يعط سجل CPU قابلًا للاعتماد. workers/account-settings وPages config يعيدان usage_model=standard؛ subscriptions403، لذلك الخطة المدفوعة/المجانية غير مؤكدة. ممنوع تخفيض تكلفة التشفير أو bypass أو شراء خطة دون اعتماد. أول خطوة: قياس CPU/outcome وحدود الحساب الفعلية في Cloudflare، ثم تحديد إصلاح آمن لمسار الدخول قبل إكمال مصفوفة الشركات.

الإنتاج Web2.6.11، GitHub release2.6.12، المرشح2.6.13 غير منشور. محاكي emulator-5554 يعمل لكنه يحوي debug2.6.9؛ تثبيت APK المنشور2.6.12 بـ-r رُفض لاختلاف توقيع النسخة التجريبية. لم يُحذف التطبيق ولم يُستبدل. backup tar1024 bytes غير صالح (permission denied)، فلا تعتمد عليه للاستعادة. Android WebView direct live-auth diagnostic أعاد Failed to fetch، وليس إثباتًا لسيناريو مالي أو خطأ1102 على Android. لا تعمم ذلك كاختبار إصدار Android المنشور. قاعدة الإنتاج لا تتضمن time_zone/migrations0017-0022؛ لا تنشر candidate API قبل مراجعة التوافق.

HEAD621eef45e5e9706f23da020e70a7ad631ca42fa9، branch main. لا commit/push/deploy لهذه المهمة. ملفات معدلة غير committed: AI_HANDOFF_CURRENT.md، RELEASE_BLOCKERS.md، tests/platform-matrix-server.mjs. ملفات جديدة غير committed: docs/multi-company-live-ui-audit-2026-10-03.md، tests/platform-multi-company.mjs، tests/live-test-provision.mjs، tests/live-auth-resource-probe.mjs، tests/live-account-plan-probe.mjs، tests/live-android-auth-probe.mjs. السكربتات لا تحتوي كلمات مرور أو رموز مضمنة؛ تقرأ fixture config محليًا ولا تطبعها. الأقسام التاريخية أدناه لا تتقدم على هذا القسم.

## أحدث مهمة — اختبار فعلي للشركات والكاشيرين (2026-10-03)

طلب المستخدم اختبار السيناريوهات فعليًا؛ أُضيف harness اختياري لشركتين/فرعين/cashiers، وشُغّلت واجهات Chrome وElectron مع قطع اتصال النوافذ وعودته وعمليتي Electron منفصلتين. النتائج تفصيليًا في docs/multi-company-live-ui-audit-2026-10-03.md. شركتان منفصلتان تزامنتا، والبيع المتتابع نجح؛ المتزامن بنفس الشركة/الحساب وحتى فرعين مستقلين ترك واحدة200 والأخرى409/pending1. pending بقي بعد reload في الحالة المختبرة. ترقيم الفواتير الظاهر تكرر1 مع IDs داخلية مختلفة. هذا **مانع اعتماد** جديد مؤكَّد؛ لا تصفه كمزامنة مكتملة لأن البيانات محفوظة محليًا فقط. السبب: domain heads عامة للشركة، لا تسوية أعمال تلقائية، وnextInvoiceNumber محلي لكل سجل مستخدم/جهاز. لم يُغيَّر منطق التطبيق أو بيانات الإنتاج ولم يُنشر. Android غير متصل ولم يُجرَّب.

Current code HEAD قبل هذه المهمة:621eef45e5e9706f23da020e70a7ad631ca42fa9، branch main. تعديلات غير committed: tests/platform-matrix-server.mjs، tests/platform-multi-company.mjs (جديد)، هذا الملف وتقرير الاختبار وregister إن حُدّث. artifacts محلية ignored. أول خطوة: اقرأ التقرير والأدلة، ثم اطلب اعتماد مسار إصلاح السببية/نطاق الفروع/ترقيم الفواتير، ولا تتجاوز409؛ شغّل Android قبل أي اعتماد منصات. أعد بناء dist للإنتاج دون localhost قبل التسليم.

## لقطة Git الأخيرة (وقت الفحص)

- Current Git HEAD (شيفرة المرشح): `28a35574d3cc4d1575b65dfdfa3618a3556971f7`.
- Current branch: `main`؛ الشيفرة مدفوعة إلى origin/main.
- `git status --porcelain=v1` بعد commit الشيفرة: فارغ. هذا التحديث التوثيقي وحده أُضيف بعد اللقطة؛ لا تعديلات شيفرة غير محفوظة.
- آخر مهمة: مراجعة مالية/أمنية ومزامنة، إصلاح clock/device/replay/version، اختبارات الويب وElectron وبناء Android، تجهيز مرشح 2.6.13 دون نشر الإنتاج.
- GitHub build: https://github.com/amerfathi/khodar-pos/actions/runs/37101108904 — publish=false وpublish_metadata=false؛ تشغيل البناء لا يعني نجاحه أو نشر إصدار.
- أول خطوة: افحص نتائج GitHub ثم شغّل المحاكي من Android Studio واختبر Android محليًا. راجع كذلك fallback إذا غاب indexedDB في جلسة حقيقية؛ لا تسمح بماليّات معتمدة على localStorage وحده. لا تُسقط فشل اختبار localStorage القديم.
- آخر workflow لإصدار2.6.12 فشل فقط في نشر metadata لأن رمز نشر Cloudflare غير موجود في GitHub؛ OAuth المحلي متاح. لا تدّع أن آلية نشر metadata الآلية تعمل.
- لا توجد كلمات مرور إنتاجية أو رموز أو مفاتيح خاصة مسجلة في هذا الملف. معرفات الخدمات وpin العام ليست أسرارًا.

## تحديث أولوية — فحص وتجهيز 2.6.13 بتاريخ 2026-10-03

تنبيه أخير: test:browser-crash (fixture القديم المعتمد على localStorage وحده) فشل بعد قتل Chrome فوريًا؛ لم يُخفَ أو يُغيَّر الاختبار. test:browser-idb-engine نجح بعد قتل العملية مع state/outbox/cursor؛ actual-app-durable نجح أيضًا. لذلك ممنوع الادعاء أن localStorage مصدر دائم، ويجب التحقق من عدم رجوع أي منصة إليه. لم يكتمل فحص Android ولا نشر الإنتاج. يُحفظ مرشح GitHub فقط لإكمال الفحوص.

هذا القسم يتقدم على الحالات التاريخية أدناه. جهزت 2.6.13 مع إصلاح عزل توقيت الشركات، رفض المنطقة الزمنية غير الصالحة، إزالة تغيير الساعة قبل commit، توحيد وقت الفاتورة مع توقيت الشركة، وتحديث توقيت tenant في batch المزامنة بعد التحقق من جلسة مالك الشركة. أُصلح سباق تسجيل الجهاز باستخدام INSERT DO NOTHING ثم التحقق من الفائز. إصدار Gradle الموروث 2.6.11 كان لا يطابق 2.6.12؛ الآن جميع الإصدارات 2.6.13/26130 مع اختبار يمنع تكرار الاختلاف.

المسار غير المكتمل للورديات محمي بالخادم: CASH_SHIFTS_ENABLED لا بد أن يكون true صراحة؛ الوضع الافتراضي مغلق. لا تفعّله في الإنتاج قبل تفويض handover وربط المصادر وinbound/restore. استُبقي عقد restore conflict keys القديم حتى لا تتعطل النسخ السابقة.

نتائج أحدث: 228 integration/focused نجحت، guards و17 formula/source منفصلة نجحت؛ ثلاثة اختبارات version/gate نجحت؛ lint/typecheck/Web build نجحت. Web↔Electron expenses 12+13 رصيد -25؛ شراء آجل 10 كجم ×4، دين المورد40 ونقد0، وتقرير مطابق بالويب وElectron. Chrome actual-hook crash/lost-ACK/reopen نجح. Android assembleDebug نجح، لكن لا جهاز adb والمحاكي لم يبدأ بسبب رفض التنفيذ؛ فحص Android الفعلي باقٍ. production npm audit صفر؛ build/dev: 14 high و1 moderate باقية، لا تُعلن المشروع خاليًا من الثغرات.

تفاصيل النطاق والفجوات: docs/releases/2.6.13.md. لا نشر إنتاجي ولا تغيير بيانات المستخدمين في هذا الفحص. يُمكن حفظ مرشح مع الميزة معطّلة وتجهيز حزم GitHub دون نشرها. أول خطوة تالية: تشغيل Braka_UI_Test، تثبيت APK المحلي المعزول، adb reverse للمنفذ8788 وتحقق تدفقات الاختبار دون الحساب الحقيقي؛ ثم إعادة بناء الإنتاج دون VITE_API_BASE_URL المحلي والتحقق من الحزم الموقعة قبل أي نشر. Git HEAD السابق والـstatus أدناه تاريخيان حتى توثيق commit الجديد.

تاريخ إعادة المطابقة: 2026-10-03 (Asia/Riyadh). المصدر: ملفات المستودع الحالية والفحوص المحلية؛ لا تُعامل ذاكرة المحادثة كدليل على حالة الشيفرة.

## حالة Git والنشر

- الفرع: `main`.
- HEAD: `5bf4412ad88776c1584f4f9b3c5d2074904f42a2`.
- لا توجد commits بعد HEAD السابق؛ بعد هذه المطابقة والإصلاحات: 19 modified و36 untracked، دون ملفات staged.
- أحدث commits: `5bf4412` handoff للمثبت؛ `82ddec9` توثيق 2.6.11؛ `c10f4e5` تجهيز 2.6.11؛ `6a1f638` حفظ تعديلات الإعدادات؛ `1993500` استرداد سياق الفرع؛ `db55b92` واجهة 2.6.10؛ `a212310` فحص الأنواع؛ `191e073` مزامنة 2.6.9.
- `package.json` و`docs/releases/2.6.12.md` يصفان 2.6.12. لم يُفحص النشر الحي في هذه المطابقة؛ ميزة الوردية لا تحتوي UI مفعلة ولا تدفق دخول فعلي موصول. لا يُدفع أو ينشر هذا العمل قبل إغلاق عوائقه.
- لا يوجد سجل يثبت مؤلف كل تغيير غير محفوظ؛ الإضافات مقارنةً بالتسليم السابق تُنسب إلى العمل اللاحق، ولا يمكن فصل مؤلفها من Git وحده.

## نتائج إعادة المطابقة قبل الإصلاح

- `npm run typecheck`: نجح.
- تشغيل API + shift hooks + enrollment + unlock + timezone: 56 اختبارًا، 55 ناجح وواحد فاشل. الفشل: `server reconciles replayed cash movements when closing a shift`، API يعيد 400 بدل 200 عند الفاتورة. السبب: fixture يحمل `accountingDate: 2026-10-02` رغم أن `openedAt` مأخوذ من وقت التشغيل بتاريخ 2026-10-03.
- الادعاء الموروث «224 ناجح، lint/build/Chrome ناجحة» محفوظ كدليل تاريخي في النسخة السابقة، وليس قياسًا حديثًا؛ لا يوجد artifact جديد يثبت تلك الفحوص على هذه الحالة.
- schema bootstrap ومجموع migrations نجحا ضمن اختبار API الحالي.
- تسجيل المفتاح الخاص في Cloudflare مذكور في OA-07؛ لم تُعرض أو تُقرأ قيمه ولم يُتحقق من حساب الخدمة بهذا الفحص. pin عام موجود لكنه untracked، خلاف عبارة «committed» السابقة. اختبار API يستخدم مفتاحًا تجريبيًا مستقلًا وليس pin الإنتاج.

## العائق الحالي والخطوة التالية الدقيقة

آخر عمل موروث: إضافة openShift/closeShift الفعليين إلى store (موجودان بالفعل؛ لا تُعد كتابتهما)، attribution لبعض cash hooks، replay لنفس actor، وتوقيت الشركة.

العائق الحالي: لا يثبت الكود handover بين محاسبين مختلفين. API يشترط actor=current session، وsource queue تخص المستخدم؛ actual cash hooks لا تستخدم `commitDrawerShiftDurable` أو `commitBatch` للسجل المشترك. inbound وbackup لا يتعاملان مع ledger الجديد. قبل UI يلزم إصلاح حدود replay وحفظ النقد ثم تفويض تسلسل المحاسبين.

آخر مهمة مكتملة في 2026-10-03: إعادة بناء التسليم، إصلاح حدود ملكية الدرج في replay، إصلاح تسلسل open→sale→close→next-open في commit group واحدة، وتصحيح fixture التاريخ. شاهَد اختبارا الخلل الفشل على الكود الموروث قبل الإصلاح ثم النجاح بعده. لم يُنفذ commit/push/deploy، ولم تُبدل بيانات المستخدمين.

أول خطوة للنموذج التالي: أضف اختبار D1 لمحاسب A يغلق ورديته ثم محاسب B يرفع السلسلة المعلقة من الجهاز المسجل؛ أثبت أن البروتوكول الحالي يرفض actor السابق، ثم أنجز تفويض replay يتحقق من التصاريح الموقعة والهوية والصلاحيات الحالية وملكية الجهاز وترتيب مصادر الفواتير. لا تُزل مقارنة actor لتجاوز الفشل. افحص كذلك عدم تغيير هوية وردية قائمة وproof/device lease قبل أي UI. بعدها اربط actual financial source بالسجل المشترك في commitBatch واختبر inbound/restore.

## نتائج الفحص بعد الإصلاح — 2026-10-03

- `npm test` نجح: security guards، 226 اختبار focused/integration، صفر failed/skipped، و17 فحص formula/source موروث منفصل. تتضمن integration الاختبار المستقل للسجلات الفعلية والأرصدة والمخزون والديون.
- `npm run typecheck` و`npm run lint` و`npm run build`: نجحت؛ تحذير حجم حزمة الويب الموجود باقٍ. `git diff --check`: لا أخطاء whitespace.
- اختبار foreign drawer: كان API يقبل 200، أصبح يرفض 400 دون إنشاء وردية أو sync event.
- اختبار ordered group: كان يرفض مصدر الفاتورة 400؛ الآن يفتح برصيد 100، يقبل نقد 27، يقفل بالمعدود والمتوقع 127، ثم يفتح الوردية التالية 127. توقع ناقص 100 يرفض الدفعة 409 دون أي مصدر/وردية/حركة، وإعادة إرسال الدفعة السليمة تترك أربعة أحداث وحركة نقد واحدة.
- لم تُجرَّب Chrome/Windows/Android أو production issuance في هذه المطابقة. لا يُغلق CASH-REPLAY أو أي blocker للميزة الكاملة بهذه النتائج.

## تصنيف جميع الملفات غير المحفوظة

COMPLETE يعني اكتمال الجزء المحدد في عمود الدليل، ولا يعني إغلاق الميزة كاملة. لا توجد تغييرات UNRELATED مثبتة؛ توقيت الشركة توسع موروث محفوظ لأنه يمس اليوم المحاسبي.

| الملف | التصنيف | السلوك/الدليل أو الفجوة |
|---|---|---|
| `OWNER_ACTIONS_REQUIRED.md` | PARTIAL | توثيق OA-07؛ اكتمال وضع المفتاح في Cloudflare مذكور بالملف ولم يُتحقق من الخدمة في هذا الفحص. |
| `d1/schema.sql` | PARTIAL | جداول الورديات والأجهزة وتوقيت الشركة؛ تطابق bootstrap/migrations نجح. |
| `functions/_lib/syncPolicy.js` | PARTIAL | السماح بنوع cash_shift؛ لا يثبت تفويض إعادة حركات محاسب آخر. |
| `functions/api/sync/push.js` | RISKY / UNVERIFIED | ملكية الدرج وتسلسل دفعة لنفس المستخدم صُححا؛ تفويض actor سابق وإثبات الجهاز وimmutability للوردية ما زالت عوائق. |
| `functions/api/tenants/lookup.js` | PARTIAL | إرجاع توقيت الشركة؛ ضبط الشركة محليًا لا يحدّث tenants.time_zone حاليًا. |
| `package.json` | COMPLETE | إدراج الاختبارات الجديدة في التشغيل؛ اكتمال قائمة التشغيل فقط. |
| `src/components/MobileHomeHub.jsx` | PARTIAL | تاريخ اليوم بتوقيت الشركة. |
| `src/components/SettingsView.jsx` | PARTIAL | اختيار التوقيت؛ التحقق والحفظ على الخادم بحاجة مراجعة. |
| `src/components/StoreAuditView.jsx` | PARTIAL | اليوم والأمس؛ الأسبوع والشهر لا يزالان يعتمدَان تاريخ الجهاز. |
| `src/data/initialData.js` | PARTIAL | توقيت افتراضي للشركة. |
| `src/services/atomicStore.js` | PARTIAL | إضافة ledger للورديات إلى حراسة الحالة والأحداث. |
| `src/services/durableAggregate.js` | COMPLETE | primitive commitBatch موروث مع rollback/reopen tests؛ ليس ربط checkout. |
| `src/services/syncConflictPolicy.js` | PARTIAL | مفاتيح وردية ودرج مع مجال tenant-wide؛ لم يُثبت تسلسل المحاسبين. |
| `src/store/useAppStore.js` | RISKY / UNVERIFIED | open/close موجودان بالفعل؛ attribution يختار أول وردية بالفرع ويفترض جهازها، يتجاهل خطأ اشتقاق النقد؛ سجل الدرج المشترك وإعادة inbound/النسخ الاحتياطي غير موصولين. |
| `src/utils/formatters.js` | PARTIAL | توقيت مخزن global localStorage؛ أثر تغيير الشركة وفشل حفظ الإعداد يحتاج اختبارًا. |
| `tests/api-integration.test.mjs` | PARTIAL | fixture التاريخ صُحح؛ regression ملكية الدرج وتسلسل الدفعة/رفض التسوية/إعادة ACK نجحت؛ لا يوجد سيناريو محاسبين مختلفين. |
| `tests/browser-atomic.test.mjs` | COMPLETE | اختبار primitive paired commit موروث؛ لم يُعد تشغيل Chrome في هذا الفحص. |
| `tests/runtime-worker.js` | COMPLETE | توصيل routes بالبيئة المعزولة. |
| `AI_HANDOFF_CURRENT.md` | COMPLETE | أعيد بناء الحالة من ملفات المستودع في 2026-10-03. |
| `RELEASE_BLOCKERS.md` | COMPLETE | إضافة سجل CASH الحالي دون إلغاء حالات P الموروثة؛ الميزة الجديدة قيد العمل. |
| `d1/migrations/0017_cash_drawer_shift_foundation.sql` | PARTIAL | schema parity نجح؛ نشر migrations غير موثّق لهذا العمل. |
| `d1/migrations/0018_cash_shift_movements.sql` | PARTIAL | schema parity نجح؛ نشر migrations غير موثّق لهذا العمل. |
| `d1/migrations/0019_cash_shift_reversals.sql` | PARTIAL | schema parity نجح؛ نشر migrations غير موثّق لهذا العمل. |
| `d1/migrations/0020_cash_shift_device_proof.sql` | PARTIAL | schema parity نجح؛ نشر migrations غير موثّق لهذا العمل. |
| `d1/migrations/0021_cash_devices.sql` | PARTIAL | schema parity نجح؛ نشر migrations غير موثّق لهذا العمل. |
| `d1/migrations/0022_tenant_time_zone.sql` | PARTIAL | schema parity نجح؛ نشر migrations غير موثّق لهذا العمل. |
| `docs/accounting-day-drawer-shift-design.md` | PARTIAL | التصميم المعتمد محفوظ؛ فقرات تاريخية تتعارض مع التقدم الحالي؛ هذا التسليم هو checkpoint الحالي. |
| `functions/_lib/cashDeviceProof.js` | COMPLETE | primitives واختبارات scope/signature؛ المفتاح المثبت عام فقط؛ اكتمال المكوّن لا يعني تدفق الدخول. |
| `functions/_lib/offlineGrantSignature.js` | COMPLETE | primitives واختبارات scope/signature؛ المفتاح المثبت عام فقط؛ اكتمال المكوّن لا يعني تدفق الدخول. |
| `functions/api/cash/devices.js` | RISKY / UNVERIFIED | registration يفحص ثم ينفذ upsert؛ سباق بين proofs قد يستبدل الهوية؛ لا توجد drawer-device lease. |
| `functions/api/cash/drawers.js` | PARTIAL | API أساسيات ومصادر النقد؛ لم يُوصل بالواجهة أو بالتفويض المشترك. |
| `functions/api/cash/grants.js` | PARTIAL | التوقيع مشتق من جلسة فعالة؛ لم يثبت إصدار production أو credential-version/revocation replay. |
| `functions/api/cash/shifts.js` | PARTIAL | API أساسيات ومصادر النقد؛ لم يُوصل بالواجهة أو بالتفويض المشترك. |
| `functions/api/cash/shifts/close.js` | PARTIAL | API أساسيات ومصادر النقد؛ لم يُوصل بالواجهة أو بالتفويض المشترك. |
| `src/config/offlineGrantPublicKey.js` | COMPLETE | primitives واختبارات scope/signature؛ المفتاح المثبت عام فقط؛ اكتمال المكوّن لا يعني تدفق الدخول. |
| `src/services/cashDrawerJournal.js` | PARTIAL | حفظ isolated shifts؛ لا فواتير فعلية أو source outbox مشتركة. |
| `src/services/cashMovement.js` | PARTIAL | مبالغ minor units ويوم الوردية؛ actual-hook coverage للعديد من المسارات ناقص. |
| `src/services/cashShiftEngine.js` | PARTIAL | مبالغ minor units ويوم الوردية؛ actual-hook coverage للعديد من المسارات ناقص. |
| `src/services/cashShiftLedger.js` | PARTIAL | حفظ isolated shifts؛ لا فواتير فعلية أو source outbox مشتركة. |
| `src/services/offlineDeviceIdentity.js` | RISKY / UNVERIFIED | read ثم write دون CAS/lock؛ إنشاء الهوية المتزامن غير مختبر. |
| `src/services/offlineGrantEnrollment.js` | PARTIAL | enrollment/unlock اختبارات نجحت؛ ليست موصولة بالدخول الفعلي؛ multi-branch owner وIndexedDB الحقيقي يحتاجان فحصًا. |
| `src/services/offlineGrantStore.js` | PARTIAL | enrollment/unlock اختبارات نجحت؛ ليست موصولة بالدخول الفعلي؛ multi-branch owner وIndexedDB الحقيقي يحتاجان فحصًا. |
| `src/services/offlineShiftGrantPolicy.js` | COMPLETE | primitives واختبارات scope/signature؛ المفتاح المثبت عام فقط؛ اكتمال المكوّن لا يعني تدفق الدخول. |
| `src/services/offlineUnlock.js` | PARTIAL | enrollment/unlock اختبارات نجحت؛ ليست موصولة بالدخول الفعلي؛ multi-branch owner وIndexedDB الحقيقي يحتاجان فحصًا. |
| `src/services/verifiedOfflineGrant.js` | COMPLETE | primitives واختبارات scope/signature؛ المفتاح المثبت عام فقط؛ اكتمال المكوّن لا يعني تدفق الدخول. |
| `tests/cash-drawer-journal.test.mjs` | COMPLETE | اختبارات primitives موروثة ومقروءة؛ لا تثبت checkout/device matrix. |
| `tests/cash-movement.test.mjs` | COMPLETE | اختبارات primitives موروثة ومقروءة؛ لا تثبت checkout/device matrix. |
| `tests/cash-shift-durable.test.mjs` | COMPLETE | اختبارات primitives موروثة ومقروءة؛ لا تثبت checkout/device matrix. |
| `tests/cash-shift-engine.test.mjs` | COMPLETE | اختبارات primitives موروثة ومقروءة؛ لا تثبت checkout/device matrix. |
| `tests/cash-shift-hooks.test.mjs` | PARTIAL | اختبار مصروف واحد داخل aggregate؛ لا paired drawer journal أو rollback source. |
| `tests/date-timezone.test.mjs` | PARTIAL | نجح اختباران؛ لا timezone isolation/rollback/DST أو persistence server. |
| `tests/offline-grant-enrollment.test.mjs` | COMPLETE | 14 اختبارًا محليًا نجحت؛ backend memory والتوقيع ephemeral؛ ليست native/production. |
| `tests/offline-grant-signature.test.mjs` | COMPLETE | اختبارات primitives موروثة ومقروءة؛ لا تثبت checkout/device matrix. |
| `tests/offline-shift-grant-policy.test.mjs` | COMPLETE | اختبارات primitives موروثة ومقروءة؛ لا تثبت checkout/device matrix. |
| `tests/offline-unlock.test.mjs` | COMPLETE | 14 اختبارًا محليًا نجحت؛ backend memory والتوقيع ephemeral؛ ليست native/production. |

## العوائق وحالة المالك

`RELEASE_BLOCKERS.md` الجدول الأساسي: P1–P11 وP13–P17 وP19 حالات VERIFIED موروثة بنطاقاتها، P12 هو BLOCKED_EXTERNAL بسبب Authenticode؛ لا تُلغ تلك الأدلة التاريخية بسبب ميزة جديدة. لمس atomic/sync/hooks/restore/branch/auth يتطلب regression متأثر قبل اعتماد العمل الحالي.

عوائق ميزة الورديات: التصريح وتخزينه IN_PROGRESS، الدخول الحقيقي OPEN، paired financial source+journal IN_PROGRESS، replay المتعدد والتفويض وترتيب الدفعة IN_PROGRESS، backup/lost-device OPEN، Web/Windows/Android feature matrix OPEN. لا يوجد VERIFIED للميزة الكاملة.

`OWNER_ACTIONS_REQUIRED.md`: OA-01/OA-02/OA-05/OA-06 مذكورة مكتملة؛ OA-04 NOT_APPLICABLE؛ OA-03 يتطلب شهادة Authenticode موثوقة وبيانات نشر CI محدودة (المالك اختار سابقًا توزيع Windows غير موقّع)؛ OA-07 مذكور مكتمل لوضع مفتاح التصاريح لكنه يحتاج تحقق issuance عند نشر الميزة. لا تطلب أي قيم اعتماد من المالك.

## ثوابت يجب الحفاظ عليها وأمور لا تُرجعها

احتفظ بكل العمل غير المحفوظ، schema/migrations 0017–0022، primitives التوقيع والحفظ، وميزة التوقيت؛ لا reset/checkout/clean/revert أو broad reformat. لا يُستبدل البروتوكول الحالي بـLWW. احتفظ بذرّية الحالة/outbox/cursor، commit groups، causal heads، ACK retry/idempotency، tenant/branch scope، restore barriers، عكس العمليات، balances/inventory ومبالغ minor units. لا تُغير قاعدة حسابية قبل عزل خلل وإعادة تسوية مستقلة.

هذه الوثيقة لا تحتوي كلمات مرور أو API keys أو tokens أو مفاتيح خاصة أو keystores أو قيم أسرار؛ أسماء إعدادات الخدمة والمفتاح العام فقط يمكن ذكرها.

## لقطة git status

```text
 M OWNER_ACTIONS_REQUIRED.md
 M RELEASE_BLOCKERS.md
 M d1/schema.sql
 M functions/_lib/syncPolicy.js
 M functions/api/sync/push.js
 M functions/api/tenants/lookup.js
 M package.json
 M src/components/MobileHomeHub.jsx
 M src/components/SettingsView.jsx
 M src/components/StoreAuditView.jsx
 M src/data/initialData.js
 M src/services/atomicStore.js
 M src/services/durableAggregate.js
 M src/services/syncConflictPolicy.js
 M src/store/useAppStore.js
 M src/utils/formatters.js
 M tests/api-integration.test.mjs
 M tests/browser-atomic.test.mjs
 M tests/runtime-worker.js
?? AI_HANDOFF_CURRENT.md
?? d1/migrations/0017_cash_drawer_shift_foundation.sql
?? d1/migrations/0018_cash_shift_movements.sql
?? d1/migrations/0019_cash_shift_reversals.sql
?? d1/migrations/0020_cash_shift_device_proof.sql
?? d1/migrations/0021_cash_devices.sql
?? d1/migrations/0022_tenant_time_zone.sql
?? docs/accounting-day-drawer-shift-design.md
?? functions/_lib/cashDeviceProof.js
?? functions/_lib/offlineGrantSignature.js
?? functions/api/cash/devices.js
?? functions/api/cash/drawers.js
?? functions/api/cash/grants.js
?? functions/api/cash/shifts.js
?? functions/api/cash/shifts/close.js
?? src/config/offlineGrantPublicKey.js
?? src/services/cashDrawerJournal.js
?? src/services/cashMovement.js
?? src/services/cashShiftEngine.js
?? src/services/cashShiftLedger.js
?? src/services/offlineDeviceIdentity.js
?? src/services/offlineGrantEnrollment.js
?? src/services/offlineGrantStore.js
?? src/services/offlineShiftGrantPolicy.js
?? src/services/offlineUnlock.js
?? src/services/verifiedOfflineGrant.js
?? tests/cash-drawer-journal.test.mjs
?? tests/cash-movement.test.mjs
?? tests/cash-shift-durable.test.mjs
?? tests/cash-shift-engine.test.mjs
?? tests/cash-shift-hooks.test.mjs
?? tests/date-timezone.test.mjs
?? tests/offline-grant-enrollment.test.mjs
?? tests/offline-grant-signature.test.mjs
?? tests/offline-shift-grant-policy.test.mjs
?? tests/offline-unlock.test.mjs
```
## Current authoritative publication — 2026-10-04

2.6.13 is published: Web deployment https://421b2337.khodar-pos.pages.dev and https://khodar-pos.pages.dev; immutable binaries https://github.com/amerfathi/khodar-pos/releases/tag/v2.6.13. Public Android/Windows latest-release endpoints advertise2.6.13. Quality workflow37153236218 passes233 integration tests plus the security gates; production workflow37153318752 succeeded.

Independent offline invoice creates now use authenticated audited rebase and atomic local reconciliation, without discarding the queue or weakening the original server CAS. Live QA tests pass for different cashiers, same account on two devices, different branches, and Android-debug/Web. The extracted published Windows binary and production Web also pass same-account offline/reconnect, each source accepted once,pending0; after renderer reload both match the server-derived stock. No installed owner app was replaced. An earlier generic automation timeout was not reproduced; reload now waits for DOM readiness plus explicit durable cursor/stock assertions rather than network-idle.

Windows updater manifest signature/file hash verified; installer still has no Authenticode. Android APK signature verified and certificate matches2.6.12; native UI journey used debug2.6.13, not the final signed APK. No physical printer or complete installation/device matrix certification. Printed invoice numbering can still duplicate across offline devices despite distinct immutable IDs: OPEN. Mixed edits/reversals/restores/shift movements and >1000 intervening events still retain explicit conflicts; do not claim complete business reconciliation.

Production functions remain compatibility-packaged fromc10f4e5 plus the deployed free authentication fix and new rebase route. Main's timezone/cash-shift migrations were NOT implicitly deployed; cash shifts remain disabled. Do not blindly deploy all main functions against the old production schema. No paid subscription was purchased.

Git snapshot before this evidence-only commit: HEAD bb27b7403dec2565ad7a4a1b12c7edab0a8c9b78; branch main. Modified: AI_HANDOFF_CURRENT.md, RELEASE_BLOCKERS.md, tests/platform-multi-company.mjs; additional intended evidence edits docs/sales-reconciliation-2026-10-03.md and docs/releases/2.6.13.md. Untracked historical diagnostics: docs/multi-company-live-ui-audit-2026-10-03.md, tests/live-account-plan-probe.mjs, tests/live-android-auth-probe.mjs, tests/live-auth-resource-probe.mjs, tests/live-auth-validation.mjs, tests/live-test-provision.mjs. These unrelated diagnostic files are left uncommitted. Last task: published and verified scoped independent-sale synchronization repair. First next step: design/test offline-safe printed invoice series before broadening mixed-operation reconciliation; inspect current git status first. No credentials belong in this handoff; private QA configuration stays ignored.

## لقطة Git الختامية ومهمة النموذج التالي — 2026-10-04

- Current Git HEAD عند فحص ما قبلcommitالتوثيق:57ec5543aa64cf4dccd79b4ec1fe6a9075ea27ac. مصدر حزم2.6.14:f850a7679e7bdc1b57ebfb6ebc39268be1b0c778. يمكن أن يتقدمHEADبـcommitالتقرير نفسه؛ افحصgitrev-parseHEADولا تعتبر هذا hashذاتيًا للوثيقة.
- Current branch:main؛ آخرpushللكود/مسارالرفع نجح.
- git status في هذه اللقطة:Modified AI_HANDOFF_CURRENT.md،RELEASE_BLOCKERS.md،tests/platform-multi-company.mjs؛ Untracked docs/release-2.6.14-verification.md مع الملفات التاريخية المذكورة أدناه. هذه الأربعة مقصودة لـcommitالتوثيق/تشخيص الاختبار بعد النشر، لا تغيّر ثنائيات الإصدار.
- الملفات التاريخيةuntrackedالمحفوظة دونcommit:docs/multi-company-live-ui-audit-2026-10-03.md؛tests/live-account-plan-probe.mjs؛tests/live-android-auth-probe.mjs؛tests/live-auth-resource-probe.mjs؛tests/live-auth-validation.mjs؛tests/live-test-provision.mjs. لا تضفها آليًا بـgitadd-A.
- آخر مهمة:إكمال إصلاح تسوية تعارضات المالك واسترداد المصادر القديمة وترقيم الفواتير، ثم اختبارات مالية حية ونشر2.6.14 والتحقق من معلومات التحديثات والأصول العامة.
- أول خطوة للنموذج التالي:اقرأ القسم الأحدث وهذا التقرير وافحصHEAD/branch/status؛ لا تعِد النشر ولا تشغّل ترحيلات0017–0022. أي توسعة لاحقة لتاريخ>2000أو cashshiftsأو رحلةsignedAPKالمالية تحتاج اختبارات مستقلة قبل إعلانها مكتملة.
- فحص أنماط الاعتماد الفعلية بالوثيقة لم يجدPassword/Secret/Token/PrivateKeyأوbcryptliteral؛ أسماء الحقول ومفاتيح التوقيع العامة/hashالأدلة ليست أسرارًا. الاعتمادات لا تُنقل منscratchإلىgitأوالمحادثة.

## لقطة تسليم التوثيق قبل commit — 2026-10-04

Current Git HEAD:bcf0f5baf5641d5a0a4a29b5bcce9cea21ee3c09؛ Current branch:main. هذا snapshotقبلcommitالتوثيق نفسه، وليس hashذاتياً للملف. اقرأHEADالفعلي بعدالنشر. مصدرحزم2.6.14لم يتغير.

آخر مهمة:توثيق كامل المشروع الحالي وقراراته وحدوده، والتحقق منالروابط/الفهرس/الأسرار ثمpushالتوثيق إلىGitHub. أولخطوةللنموذجالتالي:اقرأREADMEوdocs/INDEXوأحدثسجلالموانع ثمgitstatus؛ لا تُعد نشرالحزم بسببcommitتوثيق. إن طُلبنشر تقني لاحق، افحصDEPLOY-REPRODUCIBLEوتوافق المخطط أولًا.

حالةGitوأسماءالملفات المعدلة/غيرالمرفوعة في هذهاللقطة:

```text
M ACCOUNTING_AUDIT_PLAN.md
 M ACCOUNTING_FINAL_REPORT.md
 M ACCOUNTING_FINDINGS.md
 M ACCOUNTING_FIXES.md
 M ACCOUNTING_RECONCILIATION.md
 M ACCOUNTING_TEST_RESULTS.md
 M AI_HANDOFF_CURRENT.md
 M AUTHORIZATION_MATRIX.md
 M CROSS_PLATFORM_AUDIT.md
 M DATABASE_SCHEMA_AUDIT.md
 M DATA_INTEGRITY_AUDIT.md
 M FINAL_RELEASE_AUDIT.md
 M OWNER_ACTIONS_REQUIRED.md
 M QA_ACCOUNTING_RECONCILIATION.md
 M QA_CROSS_PLATFORM_MATRIX.md
 M QA_DEFECT_REGISTER.md
 M QA_EVIDENCE_INDEX.md
 M QA_FINAL_CERTIFICATION.md
 M QA_MASTER_PLAN.md
 M QA_PERFORMANCE_AUDIT.md
 M QA_REGRESSION_SUITE.md
 M QA_RELEASE_READINESS.md
 M QA_SECURITY_AUDIT.md
 M QA_SYNC_AUDIT.md
 M QA_SYSTEM_INVENTORY.md
 M QA_TEST_EXECUTION.md
 M QA_TEST_REGISTRY.md
 M REGRESSION_TEST_MATRIX.md
 M RELEASE_BLOCKERS.md
 M REMEDIATION_PLAN.md
 M SECRETS_AUDIT.md
 M SECURITY_REMEDIATION.md
 M SYNC_REMEDIATION.md
 M TENANT_ISOLATION_AUDIT.md
 M audit/ACCOUNTING_AUDIT.md
 M audit/AUDIT_BASELINE.md
 M audit/BUG_REGISTER.md
 M audit/FINAL_AUDIT_REPORT.md
 M audit/FINAL_PRODUCTION_GATE.md
 M audit/FINAL_VERIFICATION_REPORT.md
 M audit/FIX_REGISTER.md
 M audit/MOBILE_DUPLICATE_ROUTE_REPORT.md
 M audit/MOBILE_UX_FINAL_REPORT.md
 M audit/MOBILE_UX_INVENTORY.md
 M audit/RBAC_MATRIX_FINAL.md
 M audit/SECURITY_AUDIT.md
 M audit/SYSTEM_INVENTORY.md
 M audit/TEST_MATRIX.md
 M audit/TEST_PLAN.md
 M docs/MULTI_PLATFORM_ARCHITECTURE.md
 M docs/accounting-day-drawer-shift-design.md
 M docs/auth-cpu-hotfix-2026-10-03.md
 M docs/conflict-owner-review-2026-10-04.md
 M docs/inbound-dependency-recovery-2026-10-04.md
 M docs/landing-refresh-2026-10-01.md
 M docs/releases/2.6.10.md
 M docs/releases/2.6.11.md
 M docs/releases/2.6.12.md
 M docs/releases/2.6.13.md
 M docs/releases/2.6.9.md
 M docs/sales-reconciliation-2026-10-03.md
 M docs/sync-activity-design.md
?? README.md
?? docs/INDEX.md
?? docs/current/ACCOUNTING.md
?? docs/current/ARCHITECTURE.md
?? docs/current/CHANGE_HISTORY.md
?? docs/current/OPERATIONS.md
?? docs/current/SECURITY.md
?? docs/current/SYNC_AND_RECOVERY.md
?? docs/current/USER_GUIDE.md
?? docs/multi-company-live-ui-audit-2026-10-03.md
?? docs/releases/2.6.14.md
?? scripts/verify-docs.cjs
?? tests/live-account-plan-probe.mjs
?? tests/live-android-auth-probe.mjs
?? tests/live-auth-resource-probe.mjs
?? tests/live-auth-validation.mjs
?? tests/live-test-provision.mjs
```

ملفاتdocs/multi-company-live-ui-audit-2026-10-03.md وtests/live-*التاريخية السابقة خارجالمهمة ولن تُضم للـcommit. باقيالوثائق الجديدة/المؤشرة وفاحصdocsمقصودة للنشر. فحصالاعتمادات لا يسجلالقيم؛configوexportsومفاتيحخاصة تبقى خارجGit.

## آخر لقطة Git والمتابعة — 2026-10-05

- Current Git HEAD عند التقاط لقطة الشيفرة: edd3ee63a78a0fe5d9d9c139b87a8d80569aec61؛ commit التوثيق التالي لا يغير هذه الشيفرة. افحص git rev-parse HEAD لمعرفة رأس التوثيق بعد حفظه.
- Current branch: main، مطابق origin/main.
- git status: modified AI_HANDOFF_CURRENT.md وdocs/current/FIVE_ITEM_REMEDIATION.md فقط؛ لا شيفرة غير ملتزمة ولا staged files. untracked السابقة محفوظة: docs/multi-company-live-ui-audit-2026-10-03.md، tests/live-account-plan-probe.mjs، tests/live-android-auth-probe.mjs، tests/live-auth-resource-probe.mjs، tests/live-auth-validation.mjs، tests/live-test-provision.mjs. ليست ضمن commit هذه المهمة.
- آخر مهمة: حماية الدخول المحلي الموقّع ومصادر الدرج وإقرار journal على IndexedDB حقيقية، وإصلاح قائمة التعارضات وبناء حزمة متوافقة من Git نظيف.
- أول خطوة تالية: اقرأ نتيجة المعاينة/النشر النهائية أعلاه ثم استكمل App provisioning/UI/remount مع24h offline identity؛ لا تعِد تنفيذ primitives المغطاة. تليها recovery/restore/lost-device وcheckpoint/job والعكس المالي ورحلات المنصات قبل إصدار شامل وتفعيل cash.
- لا كلمات مرور أو قيم secrets/tokens/private keys في هذا التسليم. config الخاصة والتصديرات ومفاتيح التوقيع خارج Git؛ لا تنقلها إلى نموذج آخر أو تطبعها.

## لقطة المتابعة النهائية الملزمة — 2026-10-05، بعد نشر5889a64c

- Current Git HEAD عند التقاط الشيفرة والنشر: 4b8463464368a8cfbb36d105b102f145c229c515. Current branch: main مطابق origin/main. commit التوثيق اللاحق لا يغير الشيفرة المنشورة؛ git rev-parse HEAD يعرض رأس التوثيق النهائي بعد حفظه.
- git status عند هذه اللقطة: modified AI_HANDOFF_CURRENT.md وdocs/current/FIVE_ITEM_REMEDIATION.md فقط، لا شيفرة غير ملتزمة ولا ملفات staged. هذان الملفان مقصودان في commit التوثيق التالي. تبقى untracked السابقة دون مساس: docs/multi-company-live-ui-audit-2026-10-03.md؛ tests/live-account-plan-probe.mjs؛ tests/live-android-auth-probe.mjs؛ tests/live-auth-resource-probe.mjs؛ tests/live-auth-validation.mjs؛ tests/live-test-provision.mjs. لا تضمها تلقائيًا أو تفترض أنها هذه المتابعة.
- آخر مهمة: إصلاح عقود إلغاء/تعديل الفاتورة وهوية الجهاز وعودة الإنترنت/انتهاء تصريح الكاشير وحماية proof وقت commit، ثم297 اختبارًا وChrome/CI ونشر Web/server المتوافق من clean Git. المعاينة967a49b2 والإنتاج5889a64c نجحا؛ لا إصدار شامل للبنود الخمسة.
- أول خطوة للنموذج التالي: لا تعِد إنشاء primitives المغطاة. أكمل App provisioning/واجهة الدخول المحلي وفتح الدرج/remount مع grant24h، ثم backup/restore/lost-device للسجل المشترك قبل أي تفعيل. تسوية الشركات الكبيرة تتطلب checkpoint/job مدقق بدل رفع LIMIT2000، والعكس النقدي يحتاج مسار client موقّع وربط الأصل. رحلة Windows download→install تحتاج نافذة قابلة للتنشيط ومرشح إصدار أعلى موثوق؛ محاولة التنشيط فشلت مرتين وهذه ليست موافقة لتجاوز تحذير أمني. تبقى رحلات Web/Windows/Android المالية مطلوبة قبل التفعيل الشامل.
- حد الاستخدام: آخر قراءة قبل توثيق النشر87% primary/85% weekly؛ التوقف مقصود بهامش قبل نفاد5h، لا reset أو شراء. افحص الحد قبل بدء متابعة طويلة. لا Password/Secret/Token/Private Key values في هذا الملف؛ الملفات الخاصة ومفاتيح التوقيع وتصديرات D1 خارج Git ولا تُطبع أو تُنقل.

## آخر لقطة Git الفعلية — متابعة محلية أُوقفت فيها Computer Use، 2026-10-05

- Current Git HEAD: bb6a33651aa1d307e1c07d4fae603722879d4ba5؛ Current branch main. الشيفرة المنشورة الأحدث ما زالت4b84634/deployment5889a64c، وHEAD الحالي هو توثيقها. لا commit/push للشيفرة المحلية التالية حتى full validation.
- git status: modified AI_HANDOFF_CURRENT.md، docs/current/FIVE_ITEM_REMEDIATION.md (بعد تحديث التسليم)، d1/schema.sql، deployment/production/compatibility-inputs.json، deployment/production/overrides/functions/api/sync/push.js، functions/api/sync/conflicts.js، functions/api/sync/dependencies.js، functions/api/sync/push.js، functions/api/sync/resolutions.js، src/components/ConflictReviewPanel.jsx، src/services/atomicStore.js، src/services/cloudflareSync.js، src/services/reviewLedgerReplay.js، src/store/useAppStore.js، tests/api-integration.test.mjs، tests/conflict-review-ui.test.mjs، tests/review-ledger-replay.test.mjs، tests/review-resolution-atomic.test.mjs. new intended: d1/migrations/0030_review_checkpoint_jobs.sql، functions/_lib/legacyProductReference.js، functions/_lib/reviewCheckpoint.js، src/services/reviewProgress.js. لا staged files.
- untracked السابقة ليست هذه المهمة: docs/multi-company-live-ui-audit-2026-10-03.md وtests/live-account-plan-probe.mjs وtests/live-android-auth-probe.mjs وtests/live-auth-resource-probe.mjs وtests/live-auth-validation.mjs وtests/live-test-provision.mjs. لا تضفها تلقائيًا.
- آخر مهمة: تنفيذ واختبار bounded owner replay/recovery وواجهة تقدم صحيحة وbranch proof دون cutoff، ثم توثيق توقف التحكم بالكمبيوتر بواسطة Escape. أول خطوة تالية: اقرأ القسم الأول ثم اختبارات الحدود/races/recovery وfull regression للشيفرة الحالية قبل حفظ Git/QA والنشر؛ لا تعِد إنشاء primitives أو تظن أن302 شهادة للشيفرة الأخيرة. لا تستأنف Computer Use في الجولة الموقوفة.
- فحص الوثائق لا يطبع أسرارًا. لا Password أو Secret أو Token أو Private Key values في هذا التسليم؛ fixtures الخاصة وD1 exports/OAuth/signing secrets خارج Git. لم تُحذف بيانات أو ملفات؛ اللقطات التاريخية لا تتقدم على القسم الأول.

## آخر لقطة Git الفعلية — بعد QA الحي وحفظ الأدلة، 2026-10-05

- Current Git HEAD عندكتابةهذهاللقطة:e1fcd5d6efd006ef990056fc20d3ad92231e5887؛ Current branch:main؛ مدفوعorigin/main. هذاcommit للأدلة/harness، مصدرQAالمالي2b1c563 unchanged. commitالتوثيق التالي يغيرHEAD؛ استخدمgitrev-parseHEADلتحديده، لا تعتبرSHAداخلملفذاتيهويتهبعدالحفظ.
- git status عندالقراءة: لاtrackedmodified ولاstaged؛ untrackedالقديمةالمذكورةأعلاهفقط. بعدإضافةهذاالقسم AI_HANDOFF_CURRENT.md وحدهmodifiedإلىcommitالتوثيق. لاشيفرةمنتجغيرcommitted.
- آخرمهمة: OAuth/backup/0030-only/fresh-GitQA/real2104-sourceownerreview، ثم قياسCPU10/100وتوثيقمانع1102؛ لاproductionpromotionولاcashenableولاnativeinstall. أولخطوة: profilingللدخولوالرفع/التقاطoutcomeلفشل1102واختيارboundedأوprivateDOتنفيذيحافظعلىtenantauthorizationوatomiccommit؛ ثمQAونشرمنSHAمتَحقق. لا تعاودfixtureseedكاملًا أوتمسّمصادره.
- Hosted37339176463 للأدلةe1fcd5d كانin_progressعندالقراءة، لا تزعمsuccessبلاquery؛ hosted37335989044 للشيفرة2b1c563 وnativeartifact37337156635 succeeded. آخرquota59%5h/94%weekly، weeklyهامشصغيرفحُفظتالتسليموالأدلة؛ ليستقريبةمننفاد5hولمحذفملفات.
- فحصdocsنجحدونأنماطاعتماد؛ لاPassword/Secret/Token/PrivateKeyvalues. privatefixture/export/CPUmetadataخارجGit، ولمتُحذفبياناتمستخدمينأوتسليماتتاريخية.
