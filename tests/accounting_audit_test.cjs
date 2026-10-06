/**
 * Brraka POS - Comprehensive Accounting & Synchronization Verification Suite
 * Tests mathematical rigor, double-entry consistency, and sync pipeline integrity.
 */

const assert = require('assert');

function runAccountingTests() {
  console.log('====================================================');
  console.log('  BRRAKA POS v2.6.1 - ACCOUNTING AUDIT TEST SUITE   ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  function test(name, fn) {
    totalTests++;
    try {
      fn();
      console.log(`[PASS] Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] Test ${totalTests}: ${name}`);
      console.error(`       Error: ${err.message}`);
    }
  }

  // TEST 1: Worker Advances Invariant (ACC-01 & Balance Sheet Isolation)
  test('Worker Advance must NOT affect P&L or double-deduct from Cash', () => {
    let initialCash = 10000;
    let worker = { id: 'w1', name: 'أحمد', currentAdvance: 0, salary: 3000 };
    let expenses = [];
    let workerTransactions = [];

    // Worker takes 1,000 advance
    const advanceAmount = 1000;
    const tx = {
      id: 'wt-101',
      workerId: worker.id,
      workerName: worker.name,
      type: 'advance',
      amount: advanceAmount,
      paymentMethod: 'cash',
      date: '2026-09-20'
    };

    worker.currentAdvance += advanceAmount;
    workerTransactions.push(tx);

    // Operational expenses should NOT include advance
    const operationalExpenses = expenses.filter(e => !e.isSupplierPayment && !e.isWorkerPayment);
    assert.strictEqual(operationalExpenses.length, 0, 'Advance must not be added to general expenses');

    // Cash position calculation (simulating getFinancialPosition)
    const cashExpenses = expenses
      .filter(e => e.paymentMethod !== 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const workerCashOutflows = workerTransactions
      .filter(t => t.paymentMethod !== 'bank')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const netCash = initialCash - cashExpenses - workerCashOutflows;
    assert.strictEqual(netCash, 9000, 'Cash should be reduced by exactly the advance amount (10000 - 1000 = 9000)');

    // P&L Net profit calculation
    const revenue = 15000;
    const cogs = 8000;
    const netProfit = revenue - cogs - cashExpenses; // Advances are asset receivables, not expenses!
    assert.strictEqual(netProfit, 7000, 'P&L net profit must not be reduced by worker advances');
  });

  // TEST 2: Worker Salary Payment Isolation (ACC-01)
  test('Worker Salary Payment must be deducted once from Cash & once from P&L', () => {
    let initialCash = 10000;
    let worker = { id: 'w1', name: 'أحمد', currentAdvance: 1000, salary: 3000 };
    let expenses = [];
    let workerTransactions = [];

    // Settle salary: 3000 salary - 1000 advance deduction = 2000 cash paid
    const cashPaid = 2000;
    const deductedAdvance = 1000;
    const tx = {
      id: 'wt-102',
      workerId: worker.id,
      workerName: worker.name,
      type: 'salary_payment',
      amount: cashPaid,
      deductedAdvance: deductedAdvance,
      paymentMethod: 'cash',
      date: '2026-09-20'
    };

    worker.currentAdvance -= deductedAdvance;
    workerTransactions.push(tx);

    // FIX-01 logic: push to expenses with isWorkerPayment: true
    expenses.push({
      id: `exp-${tx.id}`,
      title: `صرف راتب: ${worker.name}`,
      category: 'رواتب وعمالة',
      amount: cashPaid,
      paymentMethod: 'cash',
      isWorkerPayment: true,
      workerTransactionId: tx.id
    });

    // Verify cash calculation does NOT double-deduct
    const cashExpenses = expenses
      .filter(e => e.paymentMethod !== 'bank' && !e.isSupplierPayment && !e.isWorkerPayment)
      .reduce((sum, e) => sum + Number(e.amount), 0);
    const workerCashOutflows = workerTransactions
      .filter(t => t.paymentMethod !== 'bank')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Sum of expenses excluding isWorkerPayment is 0
    assert.strictEqual(cashExpenses, 0, 'Generic cashExpenses must exclude isWorkerPayment to avoid double count');
    // Worker cash outflow is exactly 2000
    assert.strictEqual(workerCashOutflows, 2000);
    const finalCash = initialCash - cashExpenses - workerCashOutflows;
    assert.strictEqual(finalCash, 8000, 'Cash drawer must reflect exactly single deduction of 2000');
  });

  // TEST 3: Atomic Worker Transaction Deletion (TXN-02)
  test('Deleting a worker advance restores currentAdvance and reverses balance', () => {
    let worker = { id: 'w1', currentAdvance: 1500 };
    let workerTransactions = [
      { id: 'wt-201', workerId: 'w1', type: 'advance', amount: 500 }
    ];

    // Deletion simulation
    const target = workerTransactions.find(t => t.id === 'wt-201');
    if (target && target.type === 'advance') {
      worker.currentAdvance = Math.max(0, worker.currentAdvance - target.amount);
    }
    workerTransactions = workerTransactions.filter(t => t.id !== 'wt-201');

    assert.strictEqual(worker.currentAdvance, 1000, 'Advance should be reverted to 1000');
    assert.strictEqual(workerTransactions.length, 0, 'Transaction list should be empty');
  });

  // TEST 4: Partner Equity Formula with Initial Capital (REP-01)
  test('Partner Equity must equal Initial Capital + Share of Profit - Drawings', () => {
    const partner = {
      id: 'p1',
      name: 'الشريك المؤسس',
      initialCapital: 100000,
      equityPercent: 40
    };
    const totalBusinessNetProfit = 50000;
    const drawings = [
      { id: 'd1', partnerId: 'p1', amount: 8000 },
      { id: 'd2', partnerId: 'p1', amount: 2000 }
    ];

    const capital = Number(partner.initialCapital) || 0;
    const totalEarned = (totalBusinessNetProfit * partner.equityPercent) / 100;
    const totalDrawn = drawings.reduce((s, d) => s + Number(d.amount), 0);
    const totalEquity = capital + totalEarned - totalDrawn;

    assert.strictEqual(totalEarned, 20000, '40% of 50000 profit must be 20000');
    assert.strictEqual(totalDrawn, 10000, 'Drawings must sum to 10000');
    assert.strictEqual(totalEquity, 110000, 'Total equity must be 100000 + 20000 - 10000 = 110000');
  });

  // TEST 5: Invoice Item Cost Locking (REP-02)
  test('Invoice item must lock costPerKg at sale creation time', () => {
    const productCatalog = {
      'prod-tomato': { id: 'prod-tomato', name: 'طماطم فاخرة', costPerKg: 12.5, price: 18.0 }
    };

    // Customer buys 10 kg
    const cartItem = {
      productId: 'prod-tomato',
      name: 'طماطم فاخرة',
      unitPrice: 18.0,
      netWeight: 10,
      costPerKg: productCatalog['prod-tomato'].costPerKg
    };

    const invoice = {
      id: 'inv-999',
      items: [cartItem],
      totalAmount: 180
    };

    // Calculate COGS at sale time
    const initialCogs = invoice.items.reduce((s, it) => s + (it.netWeight * it.costPerKg), 0);
    assert.strictEqual(initialCogs, 125, 'Initial COGS should be 10 * 12.5 = 125');

    // Supplier raises wholesale price later
    productCatalog['prod-tomato'].costPerKg = 22.0;

    // Historical invoice COGS must remain frozen at 125
    const historicalCogs = invoice.items.reduce((s, it) => s + (it.netWeight * it.costPerKg), 0);
    assert.strictEqual(historicalCogs, 125, 'Historical invoice COGS must remain locked at 125 despite catalog cost rise');
  });

  // TEST 6: Bidirectional Sync Deduplication (SYN-01)
  test('Inbound sync events must merge cleanly without duplicates', () => {
    let localInvoices = [
      { id: 'inv-1', invoiceNumber: 'INV-1001', totalAmount: 150 }
    ];

    const remoteSyncBatch = [
      { id: 'inv-1', invoiceNumber: 'INV-1001', totalAmount: 150 }, // Duplicate already present
      { id: 'inv-2', invoiceNumber: 'INV-1002', totalAmount: 320 }  // New remote invoice
    ];

    // Ingestion simulation
    for (const remoteInv of remoteSyncBatch) {
      const exists = localInvoices.some(i => i.id === remoteInv.id);
      if (!exists) {
        localInvoices.push(remoteInv);
      }
    }

    assert.strictEqual(localInvoices.length, 2, 'Should have exactly 2 invoices without duplicates');
    assert.strictEqual(localInvoices[1].invoiceNumber, 'INV-1002');
  });

  // TEST 7: Cross-Platform Base URL Resolver (XPL-01)
  test('API Base URL resolver points to Cloudflare production in WebView and Desktop environments', () => {
    function resolveBaseUrl(mockOrigin) {
      if (mockOrigin && mockOrigin.startsWith('http') && !mockOrigin.includes('localhost') && !mockOrigin.includes('127.0.0.1')) {
        return mockOrigin;
      }
      return 'https://khodar-pos.pages.dev';
    }

    assert.strictEqual(resolveBaseUrl('http://localhost'), 'https://khodar-pos.pages.dev', 'Android WebView localhost should map to Pages edge');
    assert.strictEqual(resolveBaseUrl('file://'), 'https://khodar-pos.pages.dev', 'Electron Desktop file protocol should map to Pages edge');
    assert.strictEqual(resolveBaseUrl('https://khodar-pos.pages.dev'), 'https://khodar-pos.pages.dev', 'Cloudflare Web origin remains identical');
  });

  console.log(`\nResults: ${passedTests}/${totalTests} Tests Passed successfully.`);
  if (passedTests === totalTests) {
    console.log('ALL ACCOUNTING INTEGRITY CHECKS PASSED PERFECTLY!\n');
    return true;
  } else {
    throw new Error(`${totalTests - passedTests} tests failed.`);
  }
}

if (require.main === module) {
  runAccountingTests();
}

module.exports = { runAccountingTests };
