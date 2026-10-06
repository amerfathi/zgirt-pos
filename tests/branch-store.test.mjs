import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { seedAggregate } from './aggregate-fixture.mjs';
import { validateBackup } from '../src/services/backupValidation.js';

const storage = () => ({ values: new Map(), getItem(key) { return this.values.get(key) ?? null; },
  setItem(key, value) { this.values.set(key, String(value)); }, removeItem(key) { this.values.delete(key); },
  clear() { this.values.clear(); },
  key(index) { return [...this.values.keys()][index] ?? null; }, get length() { return this.values.size; } });

test('actual store isolates branch ledgers, transfers stock and keeps aggregate read-only', async () => {
  const previousFetch = globalThis.fetch;
  const previousNavigator = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { onLine: false, locks: previousNavigator.locks } });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, location: { origin: 'https://test.invalid' } } });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { addEventListener() {}, removeEventListener() {}, visibilityState: 'hidden' } });
  const data = storage();
  seedAggregate(data, { id: 'owner', tenantId: 'A' }, {
    branches_v1: [{ id: 'one', tenantId: 'A', name: 'One', isMain: true },
      { id: 'two', tenantId: 'A', name: 'Two' }, { id: 'three', tenantId: 'A', name: 'Three' }],
    active_branch_id_v1: 'one',
    products_v3: [{ id: 'p1', branchId: 'one', name: 'Tomato', currentStockKg: 10, costPerKg: 2, branchStock: { one: 10 } },
      { id: 'p2', branchId: 'two', name: 'Tomato', currentStockKg: 20, costPerKg: 3, branchStock: { two: 20 } }],
    customers_v3: [{ id: 'c1', branchId: 'one', name: 'Buyer', balance: 7 },
      { id: 'c2', branchId: 'two', name: 'Buyer', balance: 11 }],
    suppliers_v3: [{ id: 's1', branchId: 'one', name: 'Supplier', balance: 13 },
      { id: 's2', branchId: 'two', name: 'Supplier', balance: 17 }],
    invoices_v3: [{ id: 'i1', branchId: 'one', finalTotal: 0, items: [] },
      { id: 'i2', branchId: 'two', finalTotal: 0, items: [] }],
    purchases_v3: [{ id: 'buy1', branchId: 'one', productId: 'p1', supplierId: 's1', totalCost: 0 },
      { id: 'buy2', branchId: 'two', productId: 'p2', supplierId: 's2', totalCost: 0 }],
    workers_v3: [{ id: 'w1', branchId: 'one', name: 'Worker', currentAdvance: 0 },
      { id: 'w2', branchId: 'two', name: 'Worker', currentAdvance: 0 }],
    expenses_v3: [{ id: 'e1', branchId: 'one', amount: 2, paymentMethod: 'cash' },
      { id: 'e2', branchId: 'two', amount: 5, paymentMethod: 'cash' }]
  });
  globalThis.localStorage = data;
  globalThis.sessionStorage = storage();
  const bundle = await build({ stdin: { contents: "export {useAppStore} from './src/store/useAppStore.js';export {setSessionToken,setSessionUser} from './src/services/authSession.js';export {cloudflareSync} from './src/services/cloudflareSync.js';", resolveDir: process.cwd() },
    bundle: true, write: false, define: { 'import.meta.env': '{}' }, format: 'cjs', platform: 'node', packages: 'external' });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const { useAppStore, setSessionToken, setSessionUser, cloudflareSync } = loaded.exports;
  const snapshot = JSON.parse(data.getItem('braka:A:owner:atomic_v1'));
  globalThis.fetch = async url => String(url).includes('/api/branches')
    ? Response.json({ success: true, tenantId: 'A', fullTenantVisibility: true, latestSequence: 0,
      conflictHeads: {}, branches: snapshot.state.khodar_pos_branches_v1 })
    : Response.json({ success: true, events: [], nextCursor: 0, hasMore: false, conflictHeads: {} });
  setSessionToken('test');
  setSessionUser({ id: 'owner', tenantId: 'A', role: 'company_owner', isStaff: false,
    branchId: 'all', branchIds: ['all'], sessionExpiresAt: new Date(Date.now() + 60000).toISOString() });
  let app, root;
  function Harness() { app = useAppStore(); return null; }
  try {
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); await Promise.resolve(); });
    assert.deepEqual(app.products.map(row => row.id), ['p1']);
    assert.deepEqual(app.customers.map(row => row.id), ['c1']);
    assert.deepEqual(app.suppliers.map(row => row.id), ['s1']);
    assert.deepEqual(app.invoices.map(row => row.id), ['i1']);
    assert.deepEqual(app.purchases.map(row => row.id), ['buy1']);
    assert.deepEqual(app.workers.map(row => row.id), ['w1']);
    assert.deepEqual(app.expenses.map(row => row.id), ['e1']);
    assert.equal(app.getFinancialPosition().cashBalance, -2);
    assert.deepEqual([app.getFinancialPosition().totalCustomersDebt, app.getFinancialPosition().totalSuppliersDebt], [7, 13]);
    assert.equal(app.persistence.ready, true, app.persistence.error);
    await act(async () => { app.updateSettings({ openingCashDrawerFloat: 100 }); });
    assert.equal(app.getFinancialPosition().cashBalance, 98);
    await act(async () => { app.updateSettings({ shopName: 'Branch test' }); });
    assert.equal(app.getFinancialPosition().cashBalance, 98, 'global settings edit must preserve branch float');
    await act(async () => { assert.throws(() => app.updateProduct('p2', { costPerKg: 99 }), /السجل لا ينتمي/); });
    await act(async () => { app.changeActiveBranch('two'); });
    assert.deepEqual(app.products.map(row => row.id), ['p2']);
    assert.deepEqual(app.customers.map(row => row.id), ['c2']);
    assert.deepEqual(app.suppliers.map(row => row.id), ['s2']);
    assert.deepEqual(app.invoices.map(row => row.id), ['i2']);
    assert.deepEqual(app.purchases.map(row => row.id), ['buy2']);
    assert.deepEqual(app.workers.map(row => row.id), ['w2']);
    assert.deepEqual(app.expenses.map(row => row.id), ['e2']);
    assert.equal(app.getFinancialPosition().cashBalance, -5);
    assert.deepEqual([app.getFinancialPosition().totalCustomersDebt, app.getFinancialPosition().totalSuppliersDebt], [11, 17]);
    await act(async () => { app.updateSettings({ openingCashDrawerFloat: 50 }); });
    assert.equal(app.getFinancialPosition().cashBalance, 45);
    await act(async () => {
      assert.throws(() => app.recordCustomerPayment('c1', 1), /السجل لا ينتمي/);
      assert.throws(() => app.recordSupplierPayment({ supplierId: 's1', amount: 1, paymentMethod: 'bank' }), /السجل لا ينتمي/);
      app.recordCustomerPayment('c2', 3, 'Branch two receipt');
      app.recordSupplierPayment({ supplierId: 's2', amount: 4, paymentMethod: 'bank' });
    });
    assert.deepEqual([app.customerPayments.length, app.supplierPayments.length], [1, 1]);
    assert.deepEqual([app.getFinancialPosition().cashBalance, app.getFinancialPosition().totalCustomersDebt,
      app.getFinancialPosition().totalSuppliersDebt], [48, 8, 13]);
    await act(async () => { app.changeActiveBranch('one'); });
    assert.deepEqual([app.customerPayments.length, app.supplierPayments.length], [0, 0]);
    await act(async () => {
      app.recordCustomerPayment('c1', 2, 'Branch one receipt');
      app.recordSupplierPayment({ supplierId: 's1', amount: 5, paymentMethod: 'bank' });
    });
    assert.deepEqual([app.getFinancialPosition().cashBalance, app.getFinancialPosition().totalCustomersDebt,
      app.getFinancialPosition().totalSuppliersDebt], [100, 5, 8]);
    await act(async () => { app.changeActiveBranch('all'); });
    assert.deepEqual(new Set(app.products.map(row => row.id)), new Set(['p1', 'p2']));
    assert.equal(app.getFinancialPosition().cashBalance, 148);
    assert.deepEqual([app.getFinancialPosition().totalCustomersDebt, app.getFinancialPosition().totalSuppliersDebt], [13, 21]);
    assert.throws(() => app.addExpense({ id: 'bad', amount: 1 }), /للقراءة فقط/);
    let transfer;
    await act(async () => { transfer = app.transferStockBetweenBranches({
      fromBranchId: 'one', toBranchId: 'two', productId: 'p1', quantityKg: 3 }); });
    assert.equal(transfer.scopedProducts, true);
    assert.deepEqual(app.products.map(row => [row.id, row.currentStockKg, row.branchId]).sort(),
      [['p1', 7, 'one'], ['p2', 23, 'two']]);
    assert.equal(app.products.find(row => row.id === 'p2').costPerKg, 2.87);
    await act(async () => { app.changeActiveBranch('two'); });
    assert.deepEqual(app.products.map(row => row.id), ['p2']);
    assert.equal(app.products[0].currentStockKg, 23);
    const transferEvents = structuredClone(cloudflareSync.repository.value.outbox
      .filter(event => event.groupId === cloudflareSync.repository.value.outbox
        .find(row => row.entityType === 'stock_transfer' && row.entityId === transfer.id)?.groupId));
    assert.deepEqual(transferEvents.map(event => event.entityType), ['product', 'product', 'stock_transfer']);
    const receiver = storage();
    receiver.setItem('braka:A:owner:atomic_v1', JSON.stringify(snapshot));
    await act(async () => { root.unmount(); });
    globalThis.localStorage = receiver;
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); await Promise.resolve(); });
    await act(async () => { cloudflareSync.updateHandler(transferEvents, transferEvents.length); });
    await act(async () => { app.changeActiveBranch('all'); });
    assert.deepEqual(app.products.map(row => [row.id, row.currentStockKg]).sort(), [['p1', 7], ['p2', 23]]);
    const firstReplay = JSON.stringify(cloudflareSync.repository.value);
    await act(async () => { cloudflareSync.updateHandler(transferEvents, transferEvents.length); });
    assert.equal(JSON.stringify(cloudflareSync.repository.value), firstReplay);
    let newBranchTransfer;
    await act(async () => { newBranchTransfer = app.transferStockBetweenBranches({
      fromBranchId: 'one', toBranchId: 'three', productId: 'p1', quantityKg: 2 }); });
    const created = app.products.find(row => row.id === newBranchTransfer.destinationProductId);
    assert.deepEqual([created?.branchId, created?.currentStockKg, created?.branchStock?.three], ['three', 2, 2]);
    assert.equal(app.products.find(row => row.id === 'p1').currentStockKg, 5);
    let invoiceOne, invoiceTwo;
    await act(async () => { app.changeActiveBranch('one');
      invoiceOne = app.saveInvoice({ customerId: 'walk_in', saleType: 'cash', paymentMethod: 'cash',
        finalTotal: 0, paidAmount: 0, items: [] }); });
    await act(async () => { app.changeActiveBranch('two');
      invoiceTwo = app.saveInvoice({ customerId: 'walk_in', saleType: 'cash', paymentMethod: 'cash',
        finalTotal: 0, paidAmount: 0, items: [] }); });
    assert.notEqual(invoiceOne.id, invoiceTwo.id);
    assert.match(invoiceOne.id, /^\d{6}-[0-9a-f-]{36}$/);
    assert.equal(invoiceOne.branchId, 'one');
    assert.equal(invoiceTwo.branchId, 'two');
    const ownerBackup = app.getBackupSnapshot();
    assert.equal(validateBackup(ownerBackup, 'A'), ownerBackup);
    await act(async () => {
      assert.equal(app.importBackupJSON(JSON.stringify(ownerBackup)).success, true);
    });
    assert.deepEqual(new Set(app.products.map(row => row.branchId)), new Set(['two']));
    await act(async () => { root.unmount(); });
    const staffData = storage();
    seedAggregate(staffData, { id: 'staff', tenantId: 'A' }, {
      branches_v1: snapshot.state.khodar_pos_branches_v1,
      active_branch_id_v1: 'one'
    });
    globalThis.localStorage = staffData;
    setSessionUser({ id: 'staff', tenantId: 'A', role: 'admin', isStaff: true,
      branchId: 'one', branchIds: ['one'], sessionExpiresAt: new Date(Date.now() + 60000).toISOString() });
    await act(async () => { root = TestRenderer.create(React.createElement(Harness)); await Promise.resolve(); });
    const deniedRestore = app.importBackupJSON(JSON.stringify(ownerBackup));
    assert.equal(deniedRestore.success, false,
      'branch-scoped administrator must not replace the full company ledger');
    assert.match(deniedRestore.error, /الشركة كاملة/);
  } finally {
    await act(async () => { root?.unmount(); });
    cloudflareSync.stopAutoSync();
    globalThis.fetch = previousFetch;
    Object.defineProperty(globalThis, 'navigator', { configurable: true, value: previousNavigator });
    delete globalThis.window;
    delete globalThis.document;
  }
});
