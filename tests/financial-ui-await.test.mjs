import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { build } from 'esbuild';
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

test('trial request UI does not confirm submission until server acknowledges persistence', async () => {
  const bundle = await build({ entryPoints: ['src/components/MarketingLandingPage.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', define: { 'import.meta.env': '{}' },
    loader: { '.png': 'dataurl' }, external: ['react', 'react-dom', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const oldFetch = globalThis.fetch, oldWindow = globalThis.window;
  const opened = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { open: url => { opened.push(url); } } });
  let root, settle;
  const text = node => typeof node === 'string' ? node : Array.isArray(node) ? node.map(text).join(' ') : node?.children ? text(node.children) : '';
  globalThis.fetch = () => new Promise(resolve => { settle = resolve; });
  try {
    await act(async () => { root = TestRenderer.create(React.createElement(loaded.exports.default, { onOpenLogin() {}, store: {} })); });
    const button = label => root.root.findAllByType('button').find(node => text(node).includes(label));
    await act(async () => { button('اطلب تجربة مجانية شهر').props.onClick(); });
    for(const [placeholder,value] of [['مثال: أحمد محمود','Test User'],['مثال: أسواق النور للخضار','Test Shop'],['+9665XXXXXXXX','+966500000000']])
      await act(async () => { root.root.findAllByType('input').find(node => node.props.placeholder === placeholder).props.onChange({ target: { value } }); });
    let pending;
    await act(async () => { pending = root.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(button('تأكيد وإرسال طلب التجربة').props.disabled,true);
    assert.equal(root.root.findAllByProps({ role: 'alert' }).length,0);
    await act(async () => { settle({ ok: false, json: async () => ({ success: false, error: 'Injected save failure' }) }); await pending; });
    assert.match(text(root.toJSON()),/Injected save failure/);
    assert.equal(text(root.toJSON()).includes('تم استلام طلب التجربة بنجاح'),false);
    assert.equal(opened.length,0);
    await act(async () => { pending = root.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    await act(async () => { settle({ ok: true, json: async () => ({ success: true }) }); await pending; });
    assert.equal(root.root.findAllByProps({ role: 'alert' }).length,0);
    assert.match(text(root.toJSON()),/تم استلام طلب التجربة بنجاح/);
    await new Promise(resolve => setTimeout(resolve,650));
    assert.equal(opened.length,1);
  } finally {
    await act(async () => { root?.unmount(); });
    globalThis.fetch = oldFetch; globalThis.window = oldWindow;
  }
});

test('purchase return UI waits for persistence before success and retains form on failure', async () => {
  const bundle = await build({ entryPoints: ['src/components/PurchaseReturnModal.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const PurchaseReturnModal = loaded.exports.default;
  const purchase = { id: 'purchase', quantityKg: 5, costPerKg: 2, paymentMethod: 'credit' };
  const alerts = [], oldAlert = globalThis.alert;
  globalThis.alert = message => alerts.push(message);
  let root, closed = 0, succeeded = 0, resolveCommit;
  const mount = async action => {
    await act(async () => { root = TestRenderer.create(React.createElement(PurchaseReturnModal, {
      purchase, store: { recordPurchaseReturn: action, settings: { currency: 'SAR' }, suppliers: [] },
      onClose: () => { closed++; }, onSuccess: () => { succeeded++; }
    })); });
    await act(async () => {
      root.root.findAllByType('input').find(input => input.props.type === 'number').props.onChange({ target: { value: '2' } });
    });
  };
  try {
    await mount(() => new Promise(resolve => { resolveCommit = resolve; }));
    let pending;
    await act(async () => { pending = root.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(closed, 0);
    assert.equal(succeeded, 0);
    assert.deepEqual(alerts, []);
    assert.equal(root.root.findByProps({ type: 'submit' }).props.disabled, true);
    await act(async () => { resolveCommit({ id: 'return' }); await pending; });
    assert.equal(closed, 1);
    assert.equal(succeeded, 1);
    assert.match(alerts[0], /بنجاح/);

    await act(async () => { root.unmount(); });
    alerts.length = 0; closed = 0; succeeded = 0;
    await mount(async () => { throw Error('Injected database failure'); });
    await act(async () => { await root.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    assert.equal(closed, 0);
    assert.equal(succeeded, 0);
    assert.match(alerts[0], /Injected database failure/);
    assert.equal(root.root.findAllByType('input').find(input => input.props.type === 'number').props.value, '2');
  } finally {
    await act(async () => { root?.unmount(); });
    globalThis.alert = oldAlert;
  }
});

test('expense UI prevents duplicate posting and closing before durable acknowledgement', async () => {
  const bundle = await build({ entryPoints: ['src/components/ExpensesView.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const ExpensesView = loaded.exports.default;
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldAlert = globalThis.alert;
  const alerts = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { body: { style: {} } } });
  globalThis.alert = message => alerts.push(message);
  let root, settle, calls = 0;
  const store = { settings: { currency: 'SAR' }, addExpense: () => {
    calls++;
    return new Promise((resolve, reject) => { settle = { resolve, reject }; });
  } };
  const button = label => root.root.findAllByType('button').find(node =>
    node.children.filter(child => typeof child === 'string').join('').includes(label));
  const dialogs = () => root.root.findAll(node => node.type === 'div' && node.props.role === 'dialog');
  try {
    await act(async () => { root = TestRenderer.create(React.createElement(ExpensesView, { store })); });
    await act(async () => { button('تسجيل مصروف جديد').props.onClick(); });
    await act(async () => {
      root.root.findAllByType('input').find(node => node.props.placeholder?.includes('تنزيل حمولة')).props.onChange({ target: { value: 'Transport' } });
      root.root.findAllByType('input').find(node => node.props.step === '0.5').props.onChange({ target: { value: '12' } });
    });
    let pending;
    const submit = button('حفظ وقيد المصروف').props.onClick;
    await act(async () => { pending = submit(); await submit(); });
    assert.equal(calls, 1);
    assert.equal(button('حفظ وقيد المصروف').props.disabled, true);
    assert.equal(dialogs().length, 1);
    await act(async () => { root.root.findAllByType('button').find(node => node.props['aria-label'] === 'إغلاق').props.onClick(); });
    assert.equal(dialogs().length, 1);
    await act(async () => { settle.reject(Error('Injected database failure')); await pending; });
    assert.match(alerts[0], /Injected database failure/);
    assert.equal(dialogs().length, 1);
    assert.equal(root.root.findAllByType('input').find(node => node.props.step === '0.5').props.value, '12');
    await act(async () => { pending = button('حفظ وقيد المصروف').props.onClick(); });
    assert.equal(calls, 2);
    await act(async () => { settle.resolve({ id: 'expense' }); await pending; });
    assert.equal(dialogs().length, 0);
  } finally {
    await act(async () => { root?.unmount(); });
    globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.alert = oldAlert;
  }
});

for (const flow of [
  { name: 'customer receipt', path: 'CustomersView.jsx', partyKey: 'customers', action: 'recordCustomerPayment', open: 'سداد دفعة', confirm: 'تأكيد السداد وتخفيض الدين', step: '1' },
  { name: 'supplier payment', path: 'SuppliersLedgerView.jsx', partyKey: 'suppliers', action: 'recordSupplierPayment', open: 'سداد دفعة', confirm: 'تأكيد سداد الدفعة', step: '0.5' }
]) {
  test(`${flow.name} UI prevents duplicate submission and premature closing`, async () => {
    const bundle = await build({ entryPoints: [`src/components/${flow.path}`], bundle: true,
      write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'] });
    const loaded = { exports: {} };
    new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
    const View = loaded.exports.default;
    const oldWindow = globalThis.window, oldDocument = globalThis.document, oldAlert = globalThis.alert;
    const alerts = [];
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { addEventListener() {}, removeEventListener() {} } });
    Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { body: { style: {} } } });
    globalThis.alert = message => alerts.push(message);
    let root, settle, calls = 0;
    const store = {
      [flow.partyKey]: [{ id: 'party-1', name: 'Party', balance: 50 }],
      invoices: [], purchases: [], supplierPayments: [], settings: { currency: 'SAR' },
      [flow.action]: () => { calls++; return new Promise((resolve, reject) => { settle = { resolve, reject }; }); }
    };
    const textContent = node => typeof node === 'string' ? node : node.children.map(textContent).join('');
    const button = label => root.root.findAllByType('button').find(node => textContent(node).includes(label));
    try {
      await act(async () => { root = TestRenderer.create(React.createElement(View, { store })); });
      await act(async () => { button(flow.open).props.onClick(); });
      await act(async () => {
        root.root.findAllByType('input').find(node => node.props.step === flow.step).props.onChange({ target: { value: '12' } });
      });
      let pending;
      const submit = button(flow.confirm).props.onClick;
      await act(async () => { pending = submit(); await submit(); });
      assert.equal(calls, 1);
      assert.equal(button('جارٍ حفظ السداد').props.disabled, true);
      assert.equal(button('إلغاء').props.disabled, true);
      if (button('إلغاء').props.onClick) {
        await act(async () => { button('إلغاء').props.onClick(); });
      }
      assert.equal(button('جارٍ حفظ السداد').props.disabled, true);
      await act(async () => { settle.reject(Error('Injected database failure')); await pending; });
      assert.match(alerts[0], /Injected database failure/);
      assert.equal(root.root.findAllByType('input').find(node => node.props.step === flow.step).props.value, '12');
      await act(async () => { pending = button(flow.confirm).props.onClick(); });
      assert.equal(calls, 2);
      await act(async () => { settle.resolve({ id: 'payment-1' }); await pending; });
      assert.equal(button(flow.confirm), undefined);
    } finally {
      await act(async () => { root?.unmount(); });
      globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.alert = oldAlert;
    }
  });
}

test('reports expense form blocks duplicate commit and close until persistence settles', async () => {
  const bundle = await build({ entryPoints: ['src/components/ExpensesAndReports.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const View = loaded.exports.default;
  const oldAlert = globalThis.alert;
  const alerts = [];
  globalThis.alert = message => alerts.push(message);
  let root, settle, calls = 0;
  const store = { invoices: [], expenses: [], customers: [], customerPayments: [], purchases: [],
    settings: { currency: 'SAR' }, addExpense: () => {
      calls++;
      return new Promise((resolve, reject) => { settle = { resolve, reject }; });
    } };
  const textContent = node => typeof node === 'string' ? node : node.children.map(textContent).join('');
  const button = label => root.root.findAllByType('button').find(node => textContent(node).includes(label));
  try {
    await act(async () => { root = TestRenderer.create(React.createElement(View, { store })); });
    await act(async () => { button('تسجيل مصروف').props.onClick(); });
    await act(async () => {
      root.root.findAllByType('input').find(node => node.props.placeholder?.includes('أجرة عمال')).props.onChange({ target: { value: 'Transport' } });
      root.root.findAllByType('input').find(node => node.props.step === '1').props.onChange({ target: { value: '12' } });
    });
    let pending;
    const submit = button('تسجيل المصروف').props.onClick;
    await act(async () => { pending = submit(); await submit(); });
    assert.equal(calls, 1);
    assert.equal(button('جارٍ حفظ المصروف').props.disabled, true);
    assert.equal(button('إلغاء').props.disabled, true);
    await act(async () => { button('إلغاء').props.onClick(); });
    assert.equal(button('جارٍ حفظ المصروف').props.disabled, true);
    await act(async () => { settle.reject(Error('Injected database failure')); await pending; });
    assert.match(alerts[0], /Injected database failure/);
    assert.equal(root.root.findAllByType('input').find(node => node.props.step === '1').props.value, '12');
    await act(async () => { pending = button('تسجيل المصروف').props.onClick(); });
    await act(async () => { settle.resolve({ id: 'expense-1' }); await pending; });
    assert.equal(button('جارٍ حفظ المصروف'), undefined);
  } finally {
    await act(async () => { root?.unmount(); });
    globalThis.alert = oldAlert;
  }
});

test('purchase form blocks rapid duplicate commit and preserves inputs on failure', async () => {
  const bundle = await build({ entryPoints: ['src/components/PurchasesView.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const View = loaded.exports.default;
  const oldWindow = globalThis.window, oldDocument = globalThis.document, oldAlert = globalThis.alert;
  const alerts = [];
  Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: { addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, 'document', { configurable: true, writable: true, value: { body: { style: {} } } });
  globalThis.alert = message => alerts.push(message);
  let root, settle, calls = 0;
  const store = { purchases: [], products: [{ id: 'product-1', name: 'Tomato', defaultPricePerKg: 5 }],
    suppliers: [], purchaseReturns: [], settings: { currency: 'SAR' }, addPurchase: () => {
      calls++;
      return new Promise((resolve, reject) => { settle = { resolve, reject }; });
    } };
  const textContent = node => typeof node === 'string' ? node : node.children.map(textContent).join('');
  const button = label => root.root.findAllByType('button').find(node => textContent(node).includes(label));
  const modal = () => root.root.findAll(node => node.type === 'div' && node.props.role === 'dialog');
  try {
    await act(async () => { root = TestRenderer.create(React.createElement(View, { store })); });
    await act(async () => { button('توريد جديد').props.onClick(); });
    await act(async () => {
      root.root.findAllByType('select').find(node => node.props.value === '').props.onChange({ target: { value: 'product-1' } });
      root.root.findAllByType('input').find(node => node.props.placeholder === '0.0').props.onChange({ target: { value: '5' } });
      root.root.findAllByType('input').find(node => node.props.step === '0.5').props.onChange({ target: { value: '10' } });
    });
    let pending;
    const submit = root.root.findByType('form').props.onSubmit;
    await act(async () => { pending = submit({ preventDefault() {} }); await submit({ preventDefault() {} }); });
    assert.equal(calls, 1);
    assert.equal(button('جارٍ حفظ فاتورة التوريد').props.disabled, true);
    assert.equal(button('إلغاء').props.disabled, true);
    assert.equal(modal().length, 1);
    await act(async () => { settle.reject(Error('Injected database failure')); await pending; });
    assert.match(alerts[0], /Injected database failure/);
    assert.equal(modal().length, 1);
    assert.equal(root.root.findAllByType('input').find(node => node.props.placeholder === '0.0').props.value, '5');
    await act(async () => { pending = root.root.findByType('form').props.onSubmit({ preventDefault() {} }); });
    await act(async () => { settle.resolve({ id: 'purchase-1' }); await pending; });
    assert.equal(modal().length, 0);
  } finally {
    await act(async () => { root?.unmount(); });
    globalThis.window = oldWindow; globalThis.document = oldDocument; globalThis.alert = oldAlert;
  }
});

test('sale form blocks rapid duplicate posting and cart reset until persistence settles', async () => {
  const bundle = await build({ entryPoints: ['src/components/SaleScreen.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'] });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const View = loaded.exports.default;
  const oldAlert = globalThis.alert;
  const alerts = [];
  globalThis.alert = message => alerts.push(message);
  let root, settle, calls = 0;
  const store = { products: [{ id: 'product-1', name: 'Tomato', defaultPricePerKg: 5, currentStockKg: 20 }],
    customers: [], settings: { currency: 'SAR', allowNegativeStock: false }, saveInvoice: () => {
      calls++;
      return new Promise((resolve, reject) => { settle = { resolve, reject }; });
    } };
  const textContent = node => typeof node === 'string' ? node : node.children.map(textContent).join('');
  const button = label => root.root.findAllByType('button').find(node => textContent(node).includes(label));
  try {
    await act(async () => { root = TestRenderer.create(React.createElement(View, { store })); });
    await act(async () => { button('Tomato').props.onClick(); });
    await act(async () => {
      root.root.findAllByType('input').find(node => node.props.placeholder === 'أدخل الوزن الإجمالي على الميزان')
        .props.onChange({ target: { value: '4' } });
    });
    await act(async () => { button('اعتماد الصنف بالفاتورة').props.onClick(); });
    let pending;
    const submit = button('حفظ بدون طباعة').props.onClick;
    await act(async () => { pending = submit(); await submit(); });
    assert.equal(calls, 1);
    assert.equal(button('تفريغ الفاتورة').props.disabled, true);
    assert.equal(button('حفظ...').props.disabled, true);
    await act(async () => { button('تفريغ الفاتورة').props.onClick(); });
    assert.equal(button('حفظ...').props.disabled, true);
    await act(async () => { settle.reject(Error('Injected database failure')); await pending; });
    assert.match(alerts[0], /Injected database failure/);
    assert.equal(button('حفظ بدون طباعة').props.disabled, false);
    await act(async () => { pending = button('حفظ بدون طباعة').props.onClick(); });
    await act(async () => { settle.resolve({ id: 'sale-1' }); await pending; });
    assert.equal(button('حفظ بدون طباعة').props.disabled, true);
  } finally {
    await act(async () => { root?.unmount(); });
    globalThis.alert = oldAlert;
  }
});

test('fatal storage error UI preserves recovery guidance without claiming unproven durability', async () => {
  const bundle = await build({ entryPoints: ['src/components/ErrorBoundary.jsx'], bundle: true,
    write: false, format: 'cjs', platform: 'node', external: ['react', 'react-dom', 'react-test-renderer'],
    loader: { '.png': 'dataurl' } });
  const loaded = { exports: {} };
  new Function('require', 'module', 'exports', bundle.outputFiles[0].text)(createRequire(import.meta.url), loaded, loaded.exports);
  const ErrorBoundary = loaded.exports.default;
  const originalError = console.error;
  let root;
  /** @returns {never} */
  function BrokenStorage() { throw Error('orphan legacy cursor'); }
  try {
    console.error = () => {};
    await act(async () => { root = TestRenderer.create(React.createElement(ErrorBoundary, null, React.createElement(BrokenStorage))); });
    const labels = root.root.findAllByType('p').map(node => node.children.join(' ')).join(' ');
    assert.match(labels, /لا تحذف بيانات المتصفح/);
    assert.doesNotMatch(labels, /محفوظة بأمان تام/);
    const buttonLabels = root.root.findAllByType('button')
      .flatMap(node => node.findAllByType('span'))
      .map(node => node.children.filter(child => typeof child === 'string').join(' ')).join(' ');
    assert.match(buttonLabels, /إنهاء الجلسة/);
  } finally {
    console.error = originalError;
    await act(async () => { root?.unmount(); });
  }
});
