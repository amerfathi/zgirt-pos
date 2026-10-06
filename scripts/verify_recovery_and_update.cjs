const puppeteer = require('puppeteer-core');
const path = require('path');

const ARTIFACT_DIR = 'C:\\Users\\IMDAD\\.gemini\antigravity\\brain\\e7dac5c2-d3ba-4804-bd15-1d9eec19296b';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files', '--disable-web-security']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto('file:///C:/Users/IMDAD/.gemini/antigravity/scratch/khodar-pos/dist/index.html#login', { waitUntil: 'load' });
  await page.evaluate(() => {
    localStorage.removeItem('khodar_pos_current_user_v1');
    localStorage.removeItem('khodar_pos_logged_in_user');
  });
  await page.reload({ waitUntil: 'load' });
  await new Promise(r => setTimeout(r, 1500));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'test_login_forgot_password.png'),
    fullPage: false
  });
  console.log('✓ Captured test_login_forgot_password.png');

  // Find and click "نسيت كلمة المرور؟"
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const btn = btns.find(b => b.textContent.includes('نسيت كلمة المرور؟'));
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked forgot password:', clicked);
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'test_forgot_password_modal_step1.png'),
    fullPage: false
  });
  console.log('✓ Captured test_forgot_password_modal_step1.png');

  // Input demo in identifier
  const inputs = await page.$$('input[type="text"]');
  console.log('Found inputs in modal:', inputs.length);
  for (const inp of inputs) {
    const ph = await page.evaluate(el => el.placeholder, inp);
    if (ph.includes('user@example.com')) {
      await inp.type('demo', { delay: 30 });
      break;
    }
  }

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sub = btns.find(b => b.textContent.includes('متابعة والتحقق من الحساب'));
    if (sub) sub.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'test_forgot_password_modal_step2.png'),
    fullPage: false
  });
  console.log('✓ Captured test_forgot_password_modal_step2.png');

  await browser.close();
})();
