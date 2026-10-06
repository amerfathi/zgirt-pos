# فهرس توثيق براكه

لقطة 2026-10-04 ؛ المنشور 2.6.14. [المدخل الرئيسي](../README.md).

## المراجع الحالية

| الوثيقة | المحتوى |
|---|---|
| [ARCHITECTURE](current/ARCHITECTURE.md) | البنية والتخزين ونموذج البيانات و API |
| [USER_GUIDE](current/USER_GUIDE.md) | التشغيل اليومي والشاشات والعملات والتحديثات |
| [ACCOUNTING](current/ACCOUNTING.md) | الآثار المحاسبية والتقارير والدرج/الوردية |
| [SYNC_AND_RECOVERY](current/SYNC_AND_RECOVERY.md) | الحفظ والمزامنة والتعارضات والاسترداد |
| [SECURITY](current/SECURITY.md) | الهوية والصلاحيات والتوقيع والأسرار |
| [OPERATIONS](current/OPERATIONS.md) | التطوير والاختبارات والبناء والنشر والتراجع |
| [CHANGE_HISTORY](current/CHANGE_HISTORY.md) | القرارات والإنجاز والمحدوديات عبر المراحل |
| [البنود الخمسة](current/FIVE_ITEM_REMEDIATION.md) | تقدم العمل الجديد والاختبارات والمتبقي دون ادعاء نشر |
| [حزمة الخادم](../deployment/production/README.md) | إعداد حزمة متوافقة دون الاعتماد على staging المهمل |
| [تقرير 2.6.14](release-2.6.14-verification.md) | أدلة المصدر والحزم والنشر والاختبارات وحدودها |
| [ملاحظات الإصدار](releases/2.6.14.md) | التغييرات المنشورة |
| [سجل الموانع](../RELEASE_BLOCKERS.md) | حالة كل مانع وأحدث نطاق تحقق |
| [التسليم](../AI_HANDOFF_CURRENT.md) | آخر مهمة و HEAD/branch/status وخطوة تالية |

## قواعد قراءة الأدلة

الوثائق التالية باقية دون حذف نتائجها القديمة. التنبيه المضاف يميّزها عن المرجع الحالي؛ اقرأ التاريخ والنطاق، ولا تساوِ نجاح صيغة باختبار واجهة، أو وجود المصدر بنشره، أو توقيع البيان بـ Authenticode ، أو إزالة اعتماد بإلغائه خارجيًا. عند تعارض حالات تاريخية، القسم الأحدث في سجل الموانع وتقرير الإصدار يتقدم؛ ثم افحص الشيفرة/المخطط المنشورين.

بعض الملفات توثق تصاميم غير مفعّلة، خصوصًا cash shifts والتصاريح. لا تنفّذ أوامر ترحيل/تنظيف من تقرير قديم على الإنتاج. المصادر الآلية للاختبارات توجد في tests والبوابات في.github/workflows ؛ النتائج التاريخية لا تتحول إلى نتيجة اختبار جديد بالتوثيق.

## أرشيف الوثائق المتتبعة في Git

| الملف | النوع |
|---|---|
| [ACCOUNTING_AUDIT_PLAN.md](../ACCOUNTING_AUDIT_PLAN.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [ACCOUNTING_FINAL_REPORT.md](../ACCOUNTING_FINAL_REPORT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [ACCOUNTING_FINDINGS.md](../ACCOUNTING_FINDINGS.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [ACCOUNTING_FIXES.md](../ACCOUNTING_FIXES.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [ACCOUNTING_RECONCILIATION.md](../ACCOUNTING_RECONCILIATION.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [ACCOUNTING_TEST_RESULTS.md](../ACCOUNTING_TEST_RESULTS.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [AUTHORIZATION_MATRIX.md](../AUTHORIZATION_MATRIX.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [CROSS_PLATFORM_AUDIT.md](../CROSS_PLATFORM_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [DATABASE_SCHEMA_AUDIT.md](../DATABASE_SCHEMA_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [DATA_INTEGRITY_AUDIT.md](../DATA_INTEGRITY_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [FINAL_RELEASE_AUDIT.md](../FINAL_RELEASE_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [OWNER_ACTIONS_REQUIRED.md](../OWNER_ACTIONS_REQUIRED.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_ACCOUNTING_RECONCILIATION.md](../QA_ACCOUNTING_RECONCILIATION.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_CROSS_PLATFORM_MATRIX.md](../QA_CROSS_PLATFORM_MATRIX.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_DEFECT_REGISTER.md](../QA_DEFECT_REGISTER.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_EVIDENCE_INDEX.md](../QA_EVIDENCE_INDEX.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_FINAL_CERTIFICATION.md](../QA_FINAL_CERTIFICATION.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_MASTER_PLAN.md](../QA_MASTER_PLAN.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_PERFORMANCE_AUDIT.md](../QA_PERFORMANCE_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_REGRESSION_SUITE.md](../QA_REGRESSION_SUITE.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_RELEASE_READINESS.md](../QA_RELEASE_READINESS.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_SECURITY_AUDIT.md](../QA_SECURITY_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_SYNC_AUDIT.md](../QA_SYNC_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_SYSTEM_INVENTORY.md](../QA_SYSTEM_INVENTORY.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_TEST_EXECUTION.md](../QA_TEST_EXECUTION.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [QA_TEST_REGISTRY.md](../QA_TEST_REGISTRY.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [REGRESSION_TEST_MATRIX.md](../REGRESSION_TEST_MATRIX.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [REMEDIATION_PLAN.md](../REMEDIATION_PLAN.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [SECRETS_AUDIT.md](../SECRETS_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [SECURITY_REMEDIATION.md](../SECURITY_REMEDIATION.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [SYNC_REMEDIATION.md](../SYNC_REMEDIATION.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [TENANT_ISOLATION_AUDIT.md](../TENANT_ISOLATION_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/ACCOUNTING_AUDIT.md](../audit/ACCOUNTING_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/AUDIT_BASELINE.md](../audit/AUDIT_BASELINE.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/BUG_REGISTER.md](../audit/BUG_REGISTER.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/FINAL_AUDIT_REPORT.md](../audit/FINAL_AUDIT_REPORT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/FINAL_PRODUCTION_GATE.md](../audit/FINAL_PRODUCTION_GATE.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/FINAL_VERIFICATION_REPORT.md](../audit/FINAL_VERIFICATION_REPORT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/FIX_REGISTER.md](../audit/FIX_REGISTER.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/MOBILE_DUPLICATE_ROUTE_REPORT.md](../audit/MOBILE_DUPLICATE_ROUTE_REPORT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/MOBILE_UX_FINAL_REPORT.md](../audit/MOBILE_UX_FINAL_REPORT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/MOBILE_UX_INVENTORY.md](../audit/MOBILE_UX_INVENTORY.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/RBAC_MATRIX_FINAL.md](../audit/RBAC_MATRIX_FINAL.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/SECURITY_AUDIT.md](../audit/SECURITY_AUDIT.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/SYSTEM_INVENTORY.md](../audit/SYSTEM_INVENTORY.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/TEST_MATRIX.md](../audit/TEST_MATRIX.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [audit/TEST_PLAN.md](../audit/TEST_PLAN.md) | تدقيق/تقرير/مصفوفة تاريخية |
| [docs/MULTI_PLATFORM_ARCHITECTURE.md](../docs/MULTI_PLATFORM_ARCHITECTURE.md) | دليل/إثبات مرحلة مؤرخة |
| [docs/accounting-day-drawer-shift-design.md](../docs/accounting-day-drawer-shift-design.md) | تصميم/قرارات مؤرخة |
| [docs/auth-cpu-hotfix-2026-10-03.md](../docs/auth-cpu-hotfix-2026-10-03.md) | دليل/إثبات مرحلة مؤرخة |
| [docs/conflict-owner-review-2026-10-04.md](../docs/conflict-owner-review-2026-10-04.md) | دليل/إثبات مرحلة مؤرخة |
| [docs/inbound-dependency-recovery-2026-10-04.md](../docs/inbound-dependency-recovery-2026-10-04.md) | دليل/إثبات مرحلة مؤرخة |
| [docs/landing-refresh-2026-10-01.md](../docs/landing-refresh-2026-10-01.md) | دليل/إثبات مرحلة مؤرخة |
| [docs/releases/2.6.10.md](../docs/releases/2.6.10.md) | إصدار سابق |
| [docs/releases/2.6.11.md](../docs/releases/2.6.11.md) | إصدار سابق |
| [docs/releases/2.6.12.md](../docs/releases/2.6.12.md) | إصدار سابق |
| [docs/releases/2.6.13.md](../docs/releases/2.6.13.md) | إصدار سابق |
| [docs/releases/2.6.9.md](../docs/releases/2.6.9.md) | إصدار سابق |
| [docs/sales-reconciliation-2026-10-03.md](../docs/sales-reconciliation-2026-10-03.md) | دليل/إثبات مرحلة مؤرخة |
| [docs/sync-activity-design.md](../docs/sync-activity-design.md) | تصميم/قرارات مؤرخة |

## نطاق هذا التحديث

أضيف مدخل README و 7 أدلة حالية وملاحظات 2.6.14 ، وفُهرست كل وثائق Markdown المتتبعة قبل التحديث مع تأشير التاريخية. لم تُضم diagnostics غير المتتبعة أو scratch أو config الخاصة أو exports/أسرار. لا تغيير في runtime أوإعادة بناء/استبدال للأصول المنشورة. نشر التوثيق هو commit/push إلى GitHub ، وليس نشر API جديدة أو شراء خدمة.
