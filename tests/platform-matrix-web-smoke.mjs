import assert from 'node:assert/strict';
import puppeteer from 'puppeteer-core';

const browser = await puppeteer.launch({
  executablePath: process.env.BRAKA_CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--no-first-run', '--no-default-browser-check'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  const apiCalls = [];
  const apiResponses = [];
  const pushes = [];
  page.on('pageerror', error => errors.push(error instanceof Error ? error.message : String(error)));
  page.on('request', request => {
    if (request.url().includes('/api/')) apiCalls.push(request.url());
    if (request.url().endsWith('/api/sync/push')) {
      try {
        const body = JSON.parse(request.postData() || '{}');
        pushes.push({ keys: Object.keys(body), events: (body.events || []).map(event => ({
          id: event.id, entityType: event.entityType, action: event.action, groupId: event.groupId,
        })) });
      } catch { pushes.push({ invalidJson: true }); }
    }
  });
  page.on('response', async response => {
    if (response.url().includes('/api/')) apiResponses.push({ url: response.url(), status: response.status(),
      errorBody: response.status() >= 400 ? (await response.text()).slice(0, 1000) : undefined });
  });
  await page.goto('http://127.0.0.1:8788/', { waitUntil: 'networkidle2' });
  await page.waitForFunction(() => [...document.querySelectorAll('button')]
    .some(button => button.innerText.trim() === 'تسجيل الدخول'), { timeout: 20000 });
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.innerText.trim() === 'تسجيل الدخول')?.click());
  await page.locator('button[title="تغيير كود المتجر"]').click();
  await page.waitForSelector('input[placeholder="مثال: BRK-101"]', { timeout: 20000 });
  await page.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
  await page.locator('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]').fill('owner');
  await page.locator('input[type="password"]').fill('MatrixOnly!2026');
  await page.locator('form button[type="submit"]').click();
  try {
    await page.waitForFunction(() => document.body.innerText.includes('المبيعات') ||
      document.body.innerText.includes('لوحة التحكم'), { timeout: 30000 });
  } catch (error) {
    console.log(JSON.stringify({ failedState: (await page.evaluate(() => document.body.innerText)).slice(0, 1000),
      url: page.url(), apiCalls, errors }));
    throw error;
  }
  assert.equal(errors.length, 0, `Browser errors: ${errors.join('; ')}`);
  assert.ok(apiCalls.some(url => url.includes('/api/tenants/lookup')), 'Actual login API not called');
  assert.ok(apiCalls.every(url => url.startsWith('http://127.0.0.1:8788/')), 'Request escaped local fixture');
  const bodyText = await page.evaluate(() => document.body.innerText);
  assert.ok(bodyText.includes('المبيعات') || bodyText.includes('لوحة التحكم'), `Financial app not visible: ${bodyText.slice(0, 500)}`);
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'المصروفات والتشغيل')?.click());
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'المصروفات اليومية')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('تسجيل مصروف جديد'), { timeout: 10000 });
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'تسجيل مصروف جديد')?.click());
  await page.select('select:has(option[value="نثريات وصيانة"])', 'نثريات وصيانة');
  await page.type('input[placeholder="مثال: تنزيل حمولة بصل، أكياس تعبئة..."]', 'Matrix transport expense');
  await page.type('input[type="number"][placeholder="0.00"]', '12');
  await page.evaluate(() => [...document.querySelectorAll('button')]
    .find(button => button.textContent?.trim() === 'حفظ وقيد المصروف')?.click());
  await page.waitForFunction(() => document.body.innerText.includes('Matrix transport expense'), { timeout: 20000 });
  await new Promise(resolve => setTimeout(resolve, 3000));
  assert.ok(apiResponses.filter(item => item.url.endsWith('/api/sync/push')).every(item => item.status === 200),
    `Source sync failed: ${JSON.stringify(apiResponses)}`);
  const expenseEvent = pushes.flatMap(item => item.events || []).find(event => event.entityType === 'expense');
  assert.ok(expenseEvent?.id, `Expense event absent from pushes: ${JSON.stringify(pushes)}`);
  const replicaContext = await browser.createBrowserContext();
  try {
    const replica = await replicaContext.newPage();
    const replicaResponses = [];
    const replicaPulledEvents = [];
    replica.on('response', async response => {
      if (response.url().includes('/api/')) replicaResponses.push({ url: response.url(), status: response.status(),
        errorBody: response.status() >= 400 ? (await response.text()).slice(0, 500) : undefined });
      if (response.url().includes('/api/sync/pull') && response.ok()) {
        const body = await response.json();
        replicaPulledEvents.push(...(body.events || []));
      }
    });
    await replica.goto('http://127.0.0.1:8788/', { waitUntil: 'networkidle2' });
    await replica.waitForFunction(() => [...document.querySelectorAll('button')]
      .some(button => button.innerText.trim() === 'تسجيل الدخول'), { timeout: 20000 });
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.innerText.trim() === 'تسجيل الدخول')?.click());
    await replica.locator('button[title="تغيير كود المتجر"]').click();
    await replica.locator('input[placeholder="مثال: BRK-101"]').fill('MATRIX');
    await replica.locator('input[placeholder="أدخل اسم المستخدم أو البريد المسجل"]').fill('owner');
    await replica.locator('input[type="password"]').fill('MatrixOnly!2026');
    await replica.locator('form button[type="submit"]').click();
    try {
      await replica.waitForFunction(() => document.body.innerText.includes('المصروفات والتشغيل'), { timeout: 30000 });
    } catch (error) {
      console.log(JSON.stringify({ replicaLoginFailedState: (await replica.evaluate(() => document.body.innerText)).slice(0, 1000),
        replicaResponses }));
      throw error;
    }
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'المصروفات والتشغيل')?.click());
    await replica.evaluate(() => [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'المصروفات اليومية')?.click());
    try {
      await replica.waitForFunction(() => document.body.innerText.includes('Matrix transport expense'), { timeout: 20000 });
    } catch (error) {
      console.log(JSON.stringify({ replicaFailedState: (await replica.evaluate(() => document.body.innerText)).slice(-900),
        replicaResponses }));
      throw error;
    }
    const replicaText = await replica.evaluate(() => document.body.innerText);
    assert.ok(replicaText.includes('12.00'), 'Replica amount absent');
    assert.ok(replicaText.includes('-12.00'), 'Replica cash impact absent');
    assert.ok(replicaPulledEvents.some(event => event.id === expenseEvent.id && event.entityType === 'expense' &&
      event.payload?.title === 'Matrix transport expense' && Number(event.payload?.amount) === 12),
    `Replica did not pull identical expense event ${expenseEvent.id}`);
    console.log(JSON.stringify({ result: 'web-to-independent-browser-replica-pass', transactionId: expenseEvent.id,
      amount: 12, cashImpact: -12, sourcePushStatuses: apiResponses.filter(item => item.url.endsWith('/api/sync/push')).map(item => item.status),
      replicaPullStatuses: replicaResponses.filter(item => item.url.includes('/api/sync/pull')).map(item => item.status) }));
  } finally {
    await replicaContext.close();
  }
} finally {
  await browser.close();
}
