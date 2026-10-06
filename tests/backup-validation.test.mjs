import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BACKUP_ARRAY_FIELDS, validateBackup } from '../src/services/backupValidation.js';
const fixture = () => ({ version: 4, tenantId: 'A', syncCursor: 0, settings: {},
  ...Object.fromEntries(BACKUP_ARRAY_FIELDS.map(key => [key, []])),
  branches:[{id:'main',tenantId:'A'}],activeBranchId:'main' });
test('complete tenant snapshot is accepted without mutation', () => {
  const data = fixture(), before = structuredClone(data);
  assert.equal(validateBackup(data, 'A'), data); assert.deepEqual(data, before);
});
test('foreign, missing-identity, old and partial backups fail closed', () => {
  for (const change of [{ tenantId: 'B' }, { tenantId: undefined }, { version: 3 }, { syncCursor: undefined },
    { purchases: undefined },{branches:[]},{activeBranchId:'missing'}])
    assert.throws(() => validateBackup({ ...fixture(), ...change }, 'A'));
});
test('nested foreign ownership, credentials and duplicate identities are rejected', () => {
  for (const products of [[{ id: 'p', tenantId: 'B' }], [{ id: 'p', password: 'placeholder' }], [{ id: 'p' }, { id: 'p' }]])
    assert.throws(() => validateBackup({ ...fixture(), products }, 'A'));
});
test('orphan receipts cannot be restored without their customer', () => {
  const data = { ...fixture(), customerPayments: [{ id: 'receipt', customerId: 'missing' }] };
  assert.throws(() => validateBackup(data, 'A'));
  Reflect.set(data, 'customers', [{ id: 'missing' }]); assert.equal(validateBackup(data, 'A'), data);
});
test('business relationships, branches and monetary values fail closed', () => {
  const cases = [
    { products:[{id:'p'}], invoices:[{id:'i',items:[{productId:'missing'}]}] },
    { products:[{id:'p'}], suppliers:[{id:'s'}], purchases:[{id:'buy',productId:'missing',supplierId:'s'}] },
    { products:[{id:'p'}], branches:[{id:'main',tenantId:'A'}], stockTransfers:[{id:'move',productId:'p',fromBranchId:'main',toBranchId:'missing',quantityKg:1}] },
    { products:[{id:'p',costPerKg:'not-money'}] },
    { partners:[{id:'partner'}], profitDistributions:[{id:'distribution',shares:[{partnerId:'missing',netPayout:1}]}] }
  ];
  for (const change of cases) assert.throws(() => validateBackup({ ...fixture(), ...change }, 'A'));
});
test('backup accepts walk-in invoices but rejects relationships crossing branches', () => {
  const data = {...fixture(), products: [], customers: [], invoices: [], customerPayments: []};
  data.branches.push({id:'other',tenantId:'A'});
  data.products.push({id:'p-main',branchId:'main'}, {id:'p-other',branchId:'other'});
  data.customers.push({id:'c-other',branchId:'other'});
  data.invoices.push({id:'walk-in',branchId:'main',customerId:'walk_in',items:[{productId:'p-main'}]});
  assert.equal(validateBackup(data,'A'),data);
  data.invoices.push({id:'cross-item',branchId:'main',customerId:'walk_in',items:[{productId:'p-other'}]});
  assert.throws(() => validateBackup(data,'A'),/فرعين مختلفين/);
  data.invoices.pop();
  data.invoices.push({id:'cross-customer',branchId:'main',customerId:'c-other',items:[]});
  assert.throws(() => validateBackup(data,'A'),/فرعين مختلفين/);
  data.invoices.pop();
  data.customerPayments.push({id:'cross-receipt',branchId:'main',customerId:'c-other',amount:1});
  assert.throws(() => validateBackup(data,'A'),/فرعين مختلفين/);
});
