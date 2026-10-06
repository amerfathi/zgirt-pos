import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, realpath, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const chrome = process.env.BRAKA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const profile = await mkdtemp(join(tmpdir(), 'braka-app-durable-'));
const server = spawn(process.execPath, [fileURLToPath(new URL('./browser-app-durable-server.mjs', import.meta.url))],
  { stdio: ['ignore', 'pipe', 'pipe'] });
let url, output = '', browser;
server.stdout.on('data', chunk => {
  output += chunk.toString();
  const match = output.match(/Actual hook harness: (http:\/\/127\.0\.0\.1:\d+)/);
  if (match) url = `${match[1]}/`;
});
server.stderr.on('data', chunk => { output += chunk.toString(); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw Error(`Harness exited: ${server.exitCode}; ${output}`);
    try { if (url && (await fetch(url)).ok) { ready = true; break; } } catch { /* startup */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(ready, true, `actual-hook harness did not start: ${output}`);
  const launch = () => puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: profile,
    args: ['--no-first-run', '--no-default-browser-check'] });
  browser = await launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.waitForFunction(() => window.ready === true || window.startupError, { timeout: 20000 });
  assert.equal(await page.evaluate(() => window.startupError), null);
  const beforeStop = await page.evaluate(async () => {
    const customer = await window.app.addCustomer({ name: 'Crash customer', initialBalance: 30 });
    await window.app.recordCustomerPayment(customer.id, 7, 'Crash receipt', 'cash', 'crash-receipt');
    const purchase = await window.app.addPurchase({ id: 'crash-purchase', productName: 'Crash tomato',
      isNewProduct: true, quantityKg: 5, costPerKg: 4, totalCost: 20, paymentMethod: 'credit',
      supplierName: 'Crash supplier', branchId: 'browser-hook-main' });
    await window.app.recordSupplierPayment({ id: 'crash-supplier-payment',
      supplierId: purchase.supplierId, amount: 8, paymentMethod: 'bank' });
    await window.app.addExpense({ id: 'crash-expense', title: 'Fixture rent', amount: 12, paymentMethod: 'cash' });
    const repository = window.app.syncService.repository;
    return { aggregate: structuredClone(repository.value),
      supplierId: purchase.supplierId, customerId: customer.id };
  });
  assert.equal(beforeStop.aggregate.state.khodar_pos_expenses_v3.some(item => item.id === 'crash-expense'), true);
  assert.equal(beforeStop.aggregate.state.khodar_pos_purchases_v3.some(item => item.id === 'crash-purchase'), true);
  assert.equal(beforeStop.aggregate.state.khodar_pos_customer_payments_v3.some(item => item.id === 'crash-receipt'), true);
  assert.equal(beforeStop.aggregate.state.khodar_pos_supplier_payments_v3.some(item => item.id === 'crash-supplier-payment'), true);
  assert.equal(beforeStop.aggregate.state.khodar_pos_products_v3.find(item => item.name === 'Crash tomato').currentStockKg, 5);
  assert.equal(beforeStop.aggregate.state.khodar_pos_suppliers_v3.find(item => item.id === beforeStop.supplierId).balance, 12);
  assert.equal(beforeStop.aggregate.state.khodar_pos_customers_v3.find(item => item.id === beforeStop.customerId).balance, 23);
  assert.equal(beforeStop.aggregate.outbox.filter(item => ['crash-expense','crash-purchase','crash-receipt','crash-supplier-payment'].includes(item.entityId)).length, 4);
  assert.equal(beforeStop.aggregate.cursor, 0);
  const lostAck = await page.evaluate(async () => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init = {}) => {
      const requestUrl = String(input);
      if (requestUrl.includes('/api/sync/push')) {
        if (typeof init.body !== 'string') throw Error('Expected JSON request body');
        const body = JSON.parse(init.body);
        localStorage.setItem('accepted-after-lost-ack', JSON.stringify(body.events.map(event => event.id)));
        return { ok: true, json: async () => { throw new Error('Injected lost acknowledgement'); } };
      }
      if (requestUrl.includes('/api/sync/pull')) return { ok: true, json: async () => ({ success: true, events: [], nextCursor: 0 }) };
      return originalFetch(input, init);
    };
    window.app.syncService.isOnline = true;
    const result = await window.app.syncService.syncNow('browser-hook-tenant');
    return { result, aggregate: structuredClone(window.app.syncService.repository.value) };
  });
  assert.equal(lostAck.result.success, false);
  assert.match(lostAck.result.error, /Injected lost acknowledgement/);
  assert.deepEqual(lostAck.aggregate, beforeStop.aggregate);
  assert.deepEqual(errors, []);
  const process = browser.process();
  const stopped = new Promise(resolve => process.once('exit', resolve));
  process.kill('SIGKILL');
  await stopped;
  browser = null;

  browser = await launch();
  const reopened = await browser.newPage();
  reopened.on('pageerror', error => errors.push(error.message));
  await reopened.goto(url, { waitUntil: 'networkidle0' });
  await reopened.waitForFunction(() => window.ready === true || window.startupError, { timeout: 20000 });
  assert.equal(await reopened.evaluate(() => window.startupError), null);
  const afterStop = await reopened.evaluate(() => ({
    aggregate: structuredClone(window.app.syncService.repository.value),
    position: window.app.getFinancialPosition()
  }));
  assert.deepEqual(afterStop.aggregate, beforeStop.aggregate);
  assert.equal(afterStop.position.cashBalance, -5);
  assert.equal(afterStop.position.bankBalance, -8);
  const retried = await reopened.evaluate(async () => {
    const originalFetch = window.fetch.bind(window);
    let retriedIds = [];
    window.fetch = async (input, init = {}) => {
      const requestUrl = String(input);
      if (requestUrl.includes('/api/sync/push')) {
        if (typeof init.body !== 'string') throw Error('Expected JSON request body');
        const body = JSON.parse(init.body);
        retriedIds = body.events.map(event => event.id);
        return { ok: true, json: async () => ({ success: true, acceptedIds: retriedIds }) };
      }
      if (requestUrl.includes('/api/sync/pull')) return { ok: true, json: async () => ({ success: true, events: [], nextCursor: 0 }) };
      return originalFetch(input, init);
    };
    window.app.syncService.isOnline = true;
    const result = await window.app.syncService.syncNow('browser-hook-tenant');
    return { result, aggregate: structuredClone(window.app.syncService.repository.value),
      position: window.app.getFinancialPosition(), retriedIds };
  });
  assert.equal(retried.result.success, true, JSON.stringify(retried.result));
  assert.deepEqual([...retried.retriedIds].sort(), beforeStop.aggregate.outbox.map(event => event.id).sort());
  assert.equal(retried.aggregate.outbox.length, 0);
  assert.deepEqual(retried.aggregate.state, beforeStop.aggregate.state);
  assert.equal(retried.aggregate.cursor, 0);
  assert.equal(retried.position.cashBalance, -5);
  assert.equal(retried.position.bankBalance, -8);
  const inbound = await reopened.evaluate(async () => {
    const originalFetch = window.fetch.bind(window);
    const remoteExpense = { id: 'remote-expense-after-retry', tenantId: 'browser-hook-tenant', branchId: 'browser-hook-main',
      title: 'Remote rent', amount: 9, paymentMethod: 'cash' };
    const remoteSupplier = { id: 'remote-supplier-after-retry', tenantId: 'browser-hook-tenant', branchId: 'browser-hook-main',
      name: 'Remote supplier', balance: 0 };
    const remoteProduct = { id: 'remote-product-after-retry', name: 'Remote cucumber', branchId: 'browser-hook-main',
      currentStockKg: 0, costPerKg: 0, branchStock: { 'browser-hook-main': 0 } };
    const remotePurchase = { id: 'remote-purchase-after-retry', tenantId: 'browser-hook-tenant',
      productId: remoteProduct.id, productName: remoteProduct.name, supplierId: remoteSupplier.id,
      supplierName: remoteSupplier.name, quantityKg: 4, costPerKg: 3, totalCost: 12,
      paymentMethod: 'credit', creditAmount: 12, branchId: 'browser-hook-main' };
    const remotePurchaseReturn = { id: 'remote-purchase-return-after-retry', tenantId: 'browser-hook-tenant', branchId: 'browser-hook-main',
      purchaseId: remotePurchase.id, productId: remoteProduct.id, productName: remoteProduct.name,
      supplierId: remoteSupplier.id, returnedKg: 1, refundMethod: 'supplier_debt_deduction',
      totalRefundAmount: 3 };
    const remoteCustomer = { id: 'remote-customer-after-retry', tenantId: 'browser-hook-tenant', branchId: 'browser-hook-main',
      name: 'Remote customer', balance: 0 };
    const remoteSaleProduct = { id: 'remote-sale-product-after-retry', name: 'Remote pepper', branchId: 'browser-hook-main',
      currentStockKg: 5, costPerKg: 2, branchStock: { 'browser-hook-main': 5 } };
    const remoteInvoice = { id: 'remote-invoice-after-retry', tenantId: 'browser-hook-tenant',
      customerId: remoteCustomer.id, customerName: remoteCustomer.name, saleType: 'credit',
      paidAmount: 0, remainingDebt: 15, status: 'active', branchId: 'browser-hook-main',
      items: [{ productId: remoteSaleProduct.id, name: remoteSaleProduct.name, netWeight: 3,
        pricePerKg: 5, total: 15 }] };
    const remoteSalesReturn = { id: 'remote-sales-return-after-retry', tenantId: 'browser-hook-tenant', branchId: 'browser-hook-main',
      invoiceId: remoteInvoice.id, customerId: remoteCustomer.id, refundMethod: 'credit_deduction',
      inventoryAction: 'restock', totalRefundAmount: 5,
      items: [{ productId: remoteSaleProduct.id, name: remoteSaleProduct.name,
        returnedWeight: 1, sourceLineIndex: 0 }] };
    const remoteEvent = { id: 'remote-expense-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'expense', entityId: remoteExpense.id, action: 'create', payload: remoteExpense };
    const remoteSupplierEvent = { id: 'remote-supplier-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'supplier', entityId: remoteSupplier.id, action: 'create', payload: remoteSupplier };
    const remoteProductEvent = { id: 'remote-product-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'product', entityId: remoteProduct.id, action: 'create', payload: remoteProduct };
    const remotePurchaseEvent = { id: 'remote-purchase-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'purchase', entityId: remotePurchase.id, action: 'create', payload: remotePurchase };
    const remotePurchaseReturnEvent = { id: 'remote-purchase-return-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'purchase_return', entityId: remotePurchaseReturn.id, action: 'create',
      payload: remotePurchaseReturn };
    const remoteCustomerEvent = { id: 'remote-customer-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'customer', entityId: remoteCustomer.id, action: 'create', payload: remoteCustomer };
    const remoteSaleProductEvent = { id: 'remote-sale-product-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'product', entityId: remoteSaleProduct.id, action: 'create', payload: remoteSaleProduct };
    const remoteInvoiceEvent = { id: 'remote-invoice-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'invoice', entityId: remoteInvoice.id, action: 'create', payload: remoteInvoice };
    const remoteSalesReturnEvent = { id: 'remote-sales-return-event-after-retry', tenantId: 'browser-hook-tenant',
      entityType: 'sales_return', entityId: remoteSalesReturn.id, action: 'create',
      payload: remoteSalesReturn };
    const heads = { ...(window.app.syncService.repository.value.state.khodar_pos_sync_heads_v1 || {}) };
    const remoteEvents = [remoteEvent, remoteSupplierEvent, remoteProductEvent, remotePurchaseEvent,
      remotePurchaseReturnEvent, remoteCustomerEvent, remoteSaleProductEvent, remoteInvoiceEvent,
      remoteSalesReturnEvent].map(event => window.attachConflictPreconditions({
      ...event, branchId: 'browser-hook-main' }, heads));
    window.fetch = async (input, init = {}) => {
      const requestUrl = String(input);
      if (requestUrl.includes('/api/sync/push')) {
        if (typeof init.body !== 'string') throw Error('Expected JSON request body');
        const body = JSON.parse(init.body);
        return { ok: true, json: async () => ({ success: true, acceptedIds: body.events.map(event => event.id) }) };
      }
      if (requestUrl.includes('/api/sync/pull')) return { ok: true,
        json: async () => ({ success: true, events: remoteEvents, nextCursor: 17 }) };
      return originalFetch(input, init);
    };
    const result = await window.app.syncService.syncNow('browser-hook-tenant');
    return { result, aggregate: structuredClone(window.app.syncService.repository.value) };
  });
  assert.equal(inbound.result.success, true, JSON.stringify(inbound.result));
  assert.equal(inbound.aggregate.cursor, 17);
  assert.equal(inbound.aggregate.applied['remote-expense-event-after-retry'], true);
  assert.equal(inbound.aggregate.applied['remote-purchase-event-after-retry'], true);
  assert.equal(inbound.aggregate.applied['remote-purchase-return-event-after-retry'], true);
  assert.equal(inbound.aggregate.applied['remote-sales-return-event-after-retry'], true);
  assert.equal(inbound.aggregate.outbox.length, 0);
  assert.equal(inbound.aggregate.state.khodar_pos_expenses_v3.some(item => item.id === 'remote-expense-after-retry'), true);
  assert.equal(inbound.aggregate.state.khodar_pos_products_v3.find(item => item.id === 'remote-product-after-retry').currentStockKg, 3);
  assert.equal(inbound.aggregate.state.khodar_pos_products_v3.find(item => item.id === 'remote-product-after-retry').branchStock['browser-hook-main'], 3);
  assert.equal(inbound.aggregate.state.khodar_pos_suppliers_v3.find(item => item.id === 'remote-supplier-after-retry').balance, 9);
  assert.equal(inbound.aggregate.state.khodar_pos_products_v3.find(item => item.id === 'remote-sale-product-after-retry').currentStockKg, 3);
  assert.equal(inbound.aggregate.state.khodar_pos_products_v3.find(item => item.id === 'remote-sale-product-after-retry').branchStock['browser-hook-main'], 3);
  assert.equal(inbound.aggregate.state.khodar_pos_customers_v3.find(item => item.id === 'remote-customer-after-retry').balance, 10);
  assert.equal(inbound.aggregate.state.khodar_pos_invoices_v3.find(item => item.id === 'remote-invoice-after-retry').totalReturnedAmount, 5);
  const secondProcess = browser.process();
  const secondStopped = new Promise(resolve => secondProcess.once('exit', resolve));
  secondProcess.kill('SIGKILL');
  await secondStopped;
  browser = null;
  browser = await launch();
  const finalPage = await browser.newPage();
  finalPage.on('pageerror', error => errors.push(error.message));
  await finalPage.goto(url, { waitUntil: 'networkidle0' });
  await finalPage.waitForFunction(() => window.ready === true || window.startupError, { timeout: 20000 });
  assert.equal(await finalPage.evaluate(() => window.startupError), null);
  const finalState = await finalPage.evaluate(() => ({
    aggregate: structuredClone(window.app.syncService.repository.value),
    position: window.app.getFinancialPosition()
  }));
  assert.deepEqual(finalState.aggregate, inbound.aggregate);
  assert.equal(finalState.position.cashBalance, -14);
  assert.equal(finalState.position.bankBalance, -8);
  assert.deepEqual(errors, []);
  console.log('Actual application hook retained financial state after crash, retried a lost server acknowledgement, committed inbound cursor/event state, and reopened without duplicating business effects.');
} finally {
  await browser?.close();
  server.kill();
  const actualProfile = await realpath(profile);
  const actualTemp = await realpath(tmpdir());
  if (actualProfile.startsWith(actualTemp + sep) && actualProfile !== actualTemp)
    await rm(actualProfile, { recursive: true, force: true });
}
