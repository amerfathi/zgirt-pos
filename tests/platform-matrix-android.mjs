import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const origin = 'http://127.0.0.1:8788';
const credentials = { storeCode: 'MATRIX', username: 'owner', password: 'MatrixOnly!2026' };
const auth = await fetch(`${origin}/api/tenants/lookup`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(credentials) }).then(response => response.json());
assert.equal(auth.success, true, JSON.stringify(auth));
const initial = await fetch(`${origin}/api/sync/pull?tenantId=matrix-tenant&cursor=0`, {
  headers: { Authorization: `Bearer ${auth.session.token}` }
}).then(response => response.json());
const webExpense = initial.events.find(event => event.entityType === 'expense' && event.payload?.title === 'Matrix transport expense');
const purchaseMode = process.argv.includes('--verify-purchase');
const reopenPurchaseMode = process.argv.includes('--reopen-purchase');
const lostAckCreateMode = process.argv.includes('--lost-ack-create');
const lostAckRecoverMode = process.argv.includes('--lost-ack-recover');
if (!purchaseMode && !reopenPurchaseMode && !lostAckCreateMode && !lostAckRecoverMode)
  assert.ok(webExpense?.id, 'Web-created expense is absent from the server fixture');

const targets = await fetch('http://127.0.0.1:9334/json').then(response => response.json());
const target = targets.find(item => item.type === 'page' && item.url.startsWith('https://localhost'));
assert.ok(target?.webSocketDebuggerUrl, 'Android WebView debugging target is unavailable');
class PageCdp {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
  }
  async open() {
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', message => {
      const data = JSON.parse(message.data);
      if (data.id) {
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        if (data.error) pending.reject(new Error(data.error.message)); else pending.resolve(data.result);
      } else for (const listener of this.listeners.get(data.method) || []) listener(data.params);
    });
    await this.send('Runtime.enable');
    await this.send('Network.enable');
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  on(method, listener) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(listener);
  }
  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Android evaluation failed');
    return result.result.value;
  }
  async waitFor(expression, timeout = 30000) {
    const until = Date.now() + timeout;
    while (Date.now() < until) {
      try { if (await this.evaluate(`Boolean(${expression})`)) return; }
      catch { /* Navigation temporarily destroys the prior execution context. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Android wait timed out: ${expression}`);
  }
  close() { this.socket.close(); }
}
const android = new PageCdp(target.webSocketDebuggerUrl);
await android.open();
if (lostAckCreateMode || lostAckRecoverMode) {
  const fill = (selector, value) => android.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const clickText = text => android.evaluate(`(()=>{const element=[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()===${JSON.stringify(text)});
    if(!element)throw Error('Missing button');element.click();})()`);
  const loginIfNeeded = async () => {
    await android.waitFor(`document.body.innerText.includes('المصروفات والتشغيل')||document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]')`, 30000);
    if (await android.evaluate(`Boolean(document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]'))`)) {
      await android.evaluate(`document.querySelector('button[title="تغيير كود المتجر"]').click()`);
      await fill('input[placeholder="مثال: BRK-101"]', 'MATRIX');
      await fill('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', 'owner');
      await fill('input[type="password"]', 'MatrixOnly!2026');
      await android.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    }
    await android.waitFor(`document.body.innerText.includes('المصروفات والتشغيل')`, 30000);
  };
  const durableState = () => android.evaluate(`(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('braka_durable_aggregates_v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('aggregates','readonly');const request=tx.objectStore('aggregates').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
    const row=rows.find(item=>item?.identity?.tenantId==='matrix-tenant');const matches=row?.state?.khodar_pos_expenses_v3?.filter(item=>item.title==='Android lost ack expense')||[];
    return {outbox:row?.outbox?.filter(event=>event.tenantId==='matrix-tenant')||[],matches};})()`);
  try {
    if (lostAckRecoverMode)
      assert.equal((await fetch(`${origin}/__matrix/restore-push-acks`, { method: 'POST' })).status, 204);
    await loginIfNeeded();
    if (lostAckCreateMode) {
      await android.waitFor(`(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('braka_durable_aggregates_v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});const rows=await new Promise(resolve=>{const tx=db.transaction('aggregates','readonly');const request=tx.objectStore('aggregates').getAll();request.onsuccess=()=>resolve(request.result)});return rows.find(item=>item?.identity?.tenantId==='matrix-tenant')?.outbox?.length===0})()`, 20000);
      assert.equal((await fetch(`${origin}/__matrix/drop-next-push`, { method: 'POST' })).status, 204);
      await clickText('المصروفات والتشغيل');
      await clickText('المصروفات اليومية');
      await android.waitFor(`document.body.innerText.includes('تسجيل مصروف جديد')`, 10000);
      await clickText('تسجيل مصروف جديد');
      await fill('input[placeholder="مثال: تنزيل حمولة بصل، أكياس تعبئة..."]', 'Android lost ack expense');
      await fill('input[type="number"][placeholder="0.00"]', '17');
      await clickText('حفظ وقيد المصروف');
      await android.waitFor(`document.body.innerText.includes('Android lost ack expense')`, 15000);
      await new Promise(resolve => setTimeout(resolve, 5000));
      const durable = await durableState();
      const event = durable.outbox.find(item => item.entityType === 'expense' && item.payload?.title === 'Android lost ack expense');
      assert.ok(event?.id, 'Lost-ack event was removed from Android outbox');
      assert.equal(durable.matches.length, 1);
      const server = await fetch(`${origin}/api/sync/pull?tenantId=matrix-tenant&cursor=0`, {
        headers: { Authorization: `Bearer ${auth.session.token}` }
      }).then(response => response.json());
      assert.equal(server.events.filter(item => item.id === event.id).length, 1, 'Server did not commit exactly once before acknowledgement loss');
      console.log(JSON.stringify({ result: 'android-lost-ack-created', eventId: event.id, localRecords: 1,
        pendingOutbox: 1, serverEvents: 1, amount: 17 }));
    } else {
      await android.waitFor(`(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('braka_durable_aggregates_v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});const rows=await new Promise(resolve=>{const tx=db.transaction('aggregates','readonly');const request=tx.objectStore('aggregates').getAll();request.onsuccess=()=>resolve(request.result)});return rows.find(item=>item?.identity?.tenantId==='matrix-tenant')?.outbox?.length===0})()`, 25000);
      await clickText('المصروفات والتشغيل');
      await clickText('المصروفات اليومية');
      await android.waitFor(`document.body.innerText.includes('Android lost ack expense')`, 15000);
      const durable = await durableState();
      assert.equal(durable.matches.length, 1);
      assert.equal(durable.outbox.length, 0, 'Idempotent retry was not acknowledged after reopen');
      const server = await fetch(`${origin}/api/sync/pull?tenantId=matrix-tenant&cursor=0`, {
        headers: { Authorization: `Bearer ${auth.session.token}` }
      }).then(response => response.json());
      const events = server.events.filter(item => item.entityType === 'expense' && item.payload?.title === 'Android lost ack expense');
      assert.equal(events.length, 1, 'Lost-ack retry duplicated the server event');
      console.log(JSON.stringify({ result: 'android-lost-ack-recover-pass', eventId: events[0].id,
        localRecords: 1, pendingOutbox: 0, serverEvents: 1, amount: 17 }));
    }
  } finally { android.close(); }
  process.exit(0);
}
if (reopenPurchaseMode) {
  const purchase = initial.events.find(event => event.entityType === 'purchase' && event.payload?.productName === 'Matrix tomatoes');
  const product = initial.events.find(event => event.entityType === 'product' && event.payload?.name === 'Matrix tomatoes');
  const supplier = initial.events.find(event => event.entityType === 'supplier' && event.payload?.name === 'Matrix supplier');
  assert.ok(purchase?.id && product?.id && supplier?.id, 'Canonical purchase group is absent from D1');
  try {
    await android.waitFor(`document.body.innerText.includes('التوريد والمخزون')||document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]')`, 30000);
    if (await android.evaluate(`Boolean(document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]'))`)) {
      const fill = (selector, value) => android.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
        setter.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await android.evaluate(`document.querySelector('button[title="تغيير كود المتجر"]').click()`);
      await fill('input[placeholder="مثال: BRK-101"]', 'MATRIX');
      await fill('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', 'owner');
      await fill('input[type="password"]', 'MatrixOnly!2026');
      await android.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    }
    await android.waitFor(`document.body.innerText.includes('التوريد والمخزون')`, 30000);
    await android.evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='التوريد والمخزون').click()`);
    await android.evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='المشتريات والموردين').click()`);
    await android.waitFor(`document.body.innerText.includes('Matrix tomatoes')&&document.body.innerText.includes('Matrix supplier')`, 15000);
    const durable = await android.evaluate(`(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('braka_durable_aggregates_v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('aggregates','readonly');const request=tx.objectStore('aggregates').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      const row=rows.find(item=>item?.identity?.tenantId==='matrix-tenant');const item=row?.state?.khodar_pos_products_v3?.find(entry=>entry.name==='Matrix tomatoes');
      const vendor=row?.state?.khodar_pos_suppliers_v3?.find(entry=>entry.name==='Matrix supplier');return {applied:${JSON.stringify([purchase.id, product.id, supplier.id])}.every(id=>Boolean(row?.applied?.[id])),stock:item?.currentStockKg,cost:item?.costPerKg,supplierDebt:vendor?.balance,outbox:row?.outbox?.length};})()`);
    assert.deepEqual(durable, { applied: true, stock: 10, cost: 4, supplierDebt: 40, outbox: 0 });
    console.log(JSON.stringify({ result: 'android-native-kill-reopen-pass', ids: [product.id, supplier.id, purchase.id],
      stock: 10, weightedCost: 4, supplierDebt: 40, pendingOutbox: 0 }));
  } finally { android.close(); }
  process.exit(0);
}
if (purchaseMode) {
  const purchase = initial.events.find(event => event.entityType === 'purchase' && event.payload?.productName === 'Matrix tomatoes');
  const product = initial.events.find(event => event.entityType === 'product' && event.payload?.name === 'Matrix tomatoes');
  const supplier = initial.events.find(event => event.entityType === 'supplier' && event.payload?.name === 'Matrix supplier');
  assert.ok(purchase?.id && product?.id && supplier?.id, 'Canonical purchase group is absent from D1');
  const pulls = [];
  const responses = new Map();
  android.on('Network.responseReceived', event => responses.set(event.requestId, event.response));
  android.on('Network.loadingFinished', async event => {
    const response = responses.get(event.requestId);
    if (response?.url.includes('/api/sync/pull') && response.status === 200) {
      try { pulls.push(...(JSON.parse((await android.send('Network.getResponseBody', { requestId: event.requestId })).body).events || [])); }
      catch { /* Navigation can evict an old response. */ }
    }
  });
  const fill = (selector, value) => android.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});
    const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(element,${JSON.stringify(value)});
    element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const clickText = text => android.evaluate(`(()=>{const element=[...document.querySelectorAll('button')]
    .find(button=>button.textContent?.trim()===${JSON.stringify(text)});if(!element)throw Error('Missing button');element.click();})()`);
  try {
    await android.waitFor(`document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]')`, 25000);
    await android.evaluate(`document.querySelector('button[title="تغيير كود المتجر"]').click()`);
    await fill('input[placeholder="مثال: BRK-101"]', 'MATRIX');
    await fill('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', 'owner');
    await fill('input[type="password"]', 'MatrixOnly!2026');
    await android.evaluate(`document.querySelector('form button[type="submit"]').click()`);
    await android.waitFor(`document.body.innerText.includes('التوريد والمخزون')`, 30000);
    await clickText('التوريد والمخزون');
    await clickText('المشتريات والموردين');
    await android.waitFor(`document.body.innerText.includes('Matrix tomatoes')&&document.body.innerText.includes('Matrix supplier')`, 20000);
    assert.ok([purchase.id, product.id, supplier.id].every(id => pulls.some(event => event.id === id)), 'Android pull lacks purchase group IDs');
    const durable = await android.evaluate(`(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('braka_durable_aggregates_v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('aggregates','readonly');const request=tx.objectStore('aggregates').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      const row=rows.find(item=>item?.identity?.tenantId==='matrix-tenant');const item=row?.state?.khodar_pos_products_v3?.find(entry=>entry.name==='Matrix tomatoes');
      const vendor=row?.state?.khodar_pos_suppliers_v3?.find(entry=>entry.name==='Matrix supplier');return {applied:${JSON.stringify([purchase.id, product.id, supplier.id])}.every(id=>Boolean(row?.applied?.[id])),stock:item?.currentStockKg,cost:item?.costPerKg,supplierDebt:vendor?.balance};})()`);
    assert.deepEqual(durable, { applied: true, stock: 10, cost: 4, supplierDebt: 40 });
    await clickText('تقرير A4');
    await android.waitFor(`document.body.innerText.includes('Matrix tomatoes')&&document.body.innerText.includes('Matrix supplier')&&document.body.innerText.includes('40.00')`, 15000);
    console.log(JSON.stringify({ result: 'web-purchase-to-android-pass', ids: [product.id, supplier.id, purchase.id],
      stock: 10, weightedCost: 4, supplierDebt: 40, purchaseReport: 40 }));
  } finally { android.close(); }
  process.exit(0);
}
if (process.argv.includes('--verify-desktop')) {
  const desktopExpense = initial.events.find(event => event.entityType === 'expense' && event.payload?.title === 'Desktop matrix expense');
  assert.ok(desktopExpense?.id, 'Desktop-created expense is absent from the server fixture');
  try {
    await android.evaluate('location.reload()');
    await android.waitFor(`document.body.innerText.includes('المصروفات والتشغيل')`, 30000);
    await android.evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='المصروفات والتشغيل').click()`);
    await android.evaluate(`[...document.querySelectorAll('button')].find(button=>button.textContent?.trim()==='المصروفات اليومية').click()`);
    await android.waitFor(`document.body.innerText.includes('Desktop matrix expense')`, 20000);
    const text = await android.evaluate('document.body.innerText');
    assert.ok(text.includes('39.00'), 'Android does not show the combined cross-platform cash impact');
    const durableMatch = await android.evaluate(`(async()=>{const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('braka_durable_aggregates_v1');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('aggregates','readonly');const request=tx.objectStore('aggregates').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
      return rows.some(row=>row?.identity?.tenantId==='matrix-tenant'&&row.applied?.[${JSON.stringify(desktopExpense.id)}]&&row.state?.khodar_pos_expenses_v3?.some(item=>item.title==='Desktop matrix expense'&&Number(item.amount)===13));})()`);
    assert.equal(durableMatch, true, 'Android durable aggregate lacks the identical Desktop event ID/amount');
    console.log(JSON.stringify({ result: 'desktop-to-android-pass', desktopToAndroidId: desktopExpense.id,
      amount: 13, combinedCashImpact: -39 }));
  } finally { android.close(); }
  process.exit(0);
}
try {
  const pulls = [];
  const pushes = [];
  const failures = [];
  const responses = new Map();
  android.on('Runtime.exceptionThrown', event => failures.push(event.exceptionDetails?.text || 'Android page error'));
  android.on('Network.requestWillBeSent', event => {
    if (event.request.url.endsWith('/api/sync/push')) {
      try { pushes.push(...(JSON.parse(event.request.postData || '{}').events || [])); } catch { /* asserted below */ }
    }
  });
  android.on('Network.responseReceived', event => responses.set(event.requestId, event.response));
  android.on('Network.loadingFinished', async event => {
    const response = responses.get(event.requestId);
    if (response?.url.includes('/api/sync/pull') && response.status === 200) {
      try {
        const body = await android.send('Network.getResponseBody', { requestId: event.requestId });
        pulls.push(...(JSON.parse(body.body).events || []));
      } catch { /* A navigation may evict an earlier response body. */ }
    }
  });
  const fill = (selector, value) => android.evaluate(`(()=>{const element=document.querySelector(${JSON.stringify(selector)});
    if(!element)throw Error('Missing input: '+${JSON.stringify(selector)});const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    setter.call(element,${JSON.stringify(value)});element.dispatchEvent(new Event('input',{bubbles:true}));element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const clickText = text => android.evaluate(`(()=>{const element=[...document.querySelectorAll('button')]
    .find(button=>button.textContent?.trim()===${JSON.stringify(text)});if(!element)throw Error('Missing button: '+${JSON.stringify(text)});element.click();})()`);
  await android.waitFor(`document.querySelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]')`, 25000);
  await android.evaluate(`document.querySelector('button[title="تغيير كود المتجر"]').click()`);
  await fill('input[placeholder="مثال: BRK-101"]', 'MATRIX');
  await fill('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', 'owner');
  await fill('input[type="password"]', 'MatrixOnly!2026');
  await android.evaluate(`document.querySelector('form button[type="submit"]').click()`);
  await android.waitFor(`document.body.innerText.includes('المصروفات والتشغيل')`);
  await clickText('المصروفات والتشغيل');
  await clickText('المصروفات اليومية');
  await android.waitFor(`document.body.innerText.includes('Matrix transport expense')`, 20000);
  assert.ok(pulls.some(event => event.id === webExpense.id), 'Android did not pull the identical Web transaction ID');
  assert.ok((await android.evaluate('document.body.innerText')).includes('-12.00'), 'Android cash impact is missing');

  await clickText('تسجيل مصروف جديد');
  await android.evaluate(`(()=>{const element=[...document.querySelectorAll('select')].find(select=>[...select.options].some(option=>option.value==='نثريات وصيانة'));
    const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(element,'نثريات وصيانة');element.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await fill('input[placeholder="مثال: تنزيل حمولة بصل، أكياس تعبئة..."]', 'Android matrix expense');
  await fill('input[type="number"][placeholder="0.00"]', '14');
  await clickText('حفظ وقيد المصروف');
  await android.waitFor(`document.body.innerText.includes('Android matrix expense')`, 15000);
  await new Promise(resolve => setTimeout(resolve, 5000));
  const androidExpense = pushes.find(event => event.entityType === 'expense' && event.payload?.title === 'Android matrix expense');
  assert.ok(androidExpense?.id, 'Android-created expense did not enter the sync push');

  const chrome = await puppeteer.launch({ executablePath: process.env.BRAKA_CHROME_PATH ||
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: true });
  try {
    const replica = await chrome.newPage();
    const webPulls = [];
    replica.on('response', async response => {
      if (response.url().includes('/api/sync/pull') && response.ok()) {
        const body = await response.json(); webPulls.push(...(body.events || []));
      }
    });
    await replica.goto(`${origin}/?login=true`, { waitUntil: 'networkidle2' });
    await replica.waitForSelector('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]', { timeout: 20000 });
    await replica.locator('button[title="تغيير كود المتجر"]').click();
    await replica.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
    await replica.locator('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]').fill('owner');
    await replica.locator('input[type="password"]').fill('MatrixOnly!2026');
    await replica.locator('form button[type="submit"]').click();
    await replica.waitForFunction(() => document.body.innerText.includes('المصروفات والتشغيل'), { timeout: 30000 });
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'المصروفات والتشغيل')?.click());
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'المصروفات اليومية')?.click());
    await replica.waitForFunction(() => document.body.innerText.includes('Android matrix expense'), { timeout: 20000 });
    const webText = await replica.evaluate(() => document.body.innerText);
    assert.ok(webText.includes('26.00'), 'Web does not show combined Web/Android expense impact');
    assert.ok(webPulls.some(event => event.id === androidExpense.id && Number(event.payload?.amount) === 14),
      'Web did not pull the identical Android transaction ID and amount');
  } finally { await chrome.close(); }
  assert.deepEqual(failures, []);
  console.log(JSON.stringify({ result: 'web-android-two-directions-pass', webToAndroidId: webExpense.id,
    androidToWebId: androidExpense.id, amounts: [12, 14], combinedCashImpact: -26 }));
} finally {
  android.close();
}
