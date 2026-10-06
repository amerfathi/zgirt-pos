# Authorization matrix — 2026-09-22

> سجل تاريخي محفوظ للأدلة؛ ليس المرجع الحالي أو شهادة إكمال. راجع [توثيق2.6.14 الحالي](README.md) و[فهرس الوثائق](docs/INDEX.md) قبل اعتماد حالة أو أمر تشغيل هنا. تاريخ توحيد المراجع:2026-10-04.
The executable policy is functions/_lib/syncPolicy.js plus role presets and endpoint guards. Server-derived role/tenant is authoritative; browser UI permissions cannot authorize API access.
| Operation | cashier / accountant / inventory_manager / custom | admin / company_owner | super_admin |
|---|---|---|---|
| User management | denied (staff can request own record) | own tenant | own tenant |
| Tenant CRUD / trial admin / release publication | denied | denied | allowed |
| Backup read/write | denied | own tenant | own tenant |
| Sync create/read/update/delete | entity permission + branch + tenant | own tenant | own tenant |
| Invoice create | canSell | allowed | allowed |
| Invoice read | canViewInvoices | allowed | allowed |
| Invoice void/delete/reverse/update | canVoidInvoices | allowed | allowed |
| Product read | sell OR inventory OR purchases | allowed | allowed |
| Other entity mutations | explicit entity permission | allowed | allowed |
| Staff recovery token issuance | denied | own tenant | own tenant |

This is the current coarse policy, NOT a completed action-by-action certification. Approve/post/export/report/financial-field access do not yet all have dedicated proven permissions. canViewFinance currently controls some partner mutations: review and split read/write privileges. Browser/Desktop/Android role matrices still need runtime tests.
