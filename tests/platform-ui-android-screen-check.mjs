// Local-only Android WebView navigation smoke on the isolated Braka_UI_Test emulator.
import assert from 'node:assert/strict';

const target = (await fetch('http://127.0.0.1:9334/json').then(response => response.json()))
  .find(item => item.type === 'page' && item.url.startsWith('https://localhost'));
assert.ok(target?.webSocketDebuggerUrl, 'Android WebView target unavailable');
const socket = new WebSocket(target.webSocketDebuggerUrl);
const pending = new Map();
let nextId = 1;
const errors = [];
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});
socket.addEventListener('message', message => {
  const data = JSON.parse(message.data);
  if (data.id) {
    const item = pending.get(data.id);
    if (!item) return;
    pending.delete(data.id);
    data.error ? item.reject(new Error(data.error.message)) : item.resolve(data.result);
  } else if (data.method === 'Runtime.exceptionThrown') {
    errors.push(data.params?.exceptionDetails?.text || 'Android runtime exception');
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async expression => {
  const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'Android evaluation failed');
  return result.result.value;
};
const waitFor = async expression => {
  for (let i = 0; i < 100; i++) {
    if (await evaluate(`Boolean(${expression})`)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`Android screen did not render: ${expression}`);
};
const clickHome = async () => {
  assert.ok(await evaluate(`(()=>{const nav=document.querySelector('nav[aria-label="شريط التنقل السفلي"]');
    const button=[...nav.querySelectorAll('button')].find(item=>item.textContent?.trim()==='الرئيسية');
    button?.click();return Boolean(button)})()`));
  await waitFor(`document.body.innerText.includes('حركة المبيعات والكاشير')`);
};
const clickCard = async label => {
  assert.ok(await evaluate(`(()=>{const label=${JSON.stringify(label)};
    const button=[...document.querySelectorAll('button')].find(item=>[...item.querySelectorAll('span')]
      .some(span=>span.textContent?.trim()===label) && item.textContent.length>label.length+3);
    button?.click();return Boolean(button)})()`), `Android card unavailable: ${label}`);
  await new Promise(resolve => setTimeout(resolve, 120));
};
const clickText = async label => {
  assert.ok(await evaluate(`(()=>{const label=${JSON.stringify(label)};
    const button=[...document.querySelectorAll('button')].find(item=>item.textContent?.includes(label));
    button?.click();return Boolean(button)})()`), `Android button unavailable: ${label}`);
  await new Promise(resolve => setTimeout(resolve, 80));
};

await send('Runtime.enable');
try {
  await clickHome();
  const cards = ['نقطة البيع', 'سجل الفواتير', 'العملاء والديون', 'المشتريات والموردين',
    'الأصناف والأسعار', 'التوالف والهالك', 'المصروفات اليومية', 'الموظفون والرواتب',
    'الجرد والسيولة', 'الشركاء والمسحوبات', 'التقارير', 'إعدادات وضبط النظام'];
  for (const card of cards) {
    await clickCard(card);
    assert.ok(!await evaluate(`document.body.innerText.includes('تعذر عرض الصفحة')`), `${card} error boundary`);
    await clickHome();
  }
  await clickCard('إعدادات وضبط النظام');
  for (const tab of ['المنشأة والضرائب', 'المظهر وحجم الخط', 'الفواتير والطباعة',
    'الميزان وسياسات البيع', 'المخزون والخزينة', 'المستخدمون والصلاحيات',
    'السحابة والنسخ الاحتياطي', 'الحساب والأمان', 'التحديثات وإصدار النظام']) await clickText(tab);
  await clickHome();
  await clickCard('التقارير');
  const reports = ['التقرير التنفيذي اليومي للمالك', 'قائمة الدخل والأرباح والخسائر',
    'جرد الخزينة ومطابقة السيولة', 'الشركاء والمسحوبات والأرباح', 'المبيعات والإيرادات اليومية',
    'أرباح وهوامش الأصناف', 'أعمار ديون العملاء', 'كشف حساب تفصيلي لعميل', 'حركة وأوزان الأصناف',
    'المشتريات وتوريد البضاعة', 'كشف حساب الموردين', 'مردودات البيع والشراء',
    'التوالف وإعدامات البضاعة', 'معدل الهدر وعجز الميزان', 'إغلاق الوردية والدرج',
    'المصروفات والتشغيل', 'رواتب وسلفيات العمال'];
  for (const report of reports) {
    assert.ok(await evaluate(`(()=>{const name=${JSON.stringify(report)};
      const heading=[...document.querySelectorAll('button h3')].find(item=>item.textContent?.trim()===name);
      heading?.closest('button')?.click();return Boolean(heading)})()`), `Android report unavailable: ${report}`);
    await waitFor(`document.querySelector('#printable-a4-document')`);
  }
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ androidScreensChecked: 1 + cards.length + 9 + reports.length, runtimeErrors: 0 }));
} finally {
  socket.close();
}
