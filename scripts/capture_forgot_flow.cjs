const puppeteer = require('puppeteer-core');
const path = require('path');
const ARTIFACT_DIR = 'C:\\Users\\IMDAD\\.gemini\\antigravity\\brain\\e7dac5c2-d3ba-4804-bd15-1d9eec19296b';

(async () => {
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: true,
    args: ['--no-sandbox', '--disable-web-security', '--allow-file-access-from-files']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto('file:///C:/Users/IMDAD/.gemini/antigravity/scratch/khodar-pos/dist/index.html');
  await new Promise(r => setTimeout(r, 1000));

  // Click 'تسجيل الدخول'
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const loginBtn = btns.find(b => b.textContent.trim() === 'تسجيل الدخول');
    if (loginBtn) loginBtn.click();
  });
  await new Promise(r => setTimeout(r, 800));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_clean_login_with_forgot_password.png') });
  console.log('✓ Captured test_clean_login_with_forgot_password.png');

  // Click 'نسيت كلمة المرور؟'
  const clickedForgot = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const forgotBtn = btns.find(b => b.textContent.includes('نسيت كلمة المرور؟'));
    if (forgotBtn) {
      forgotBtn.click();
      return true;
    }
    return false;
  });
  console.log('Clicked forgot password:', clickedForgot);
  await new Promise(r => setTimeout(r, 600));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_forgot_password_modal_step1.png') });
  console.log('✓ Captured test_forgot_password_modal_step1.png');

  // Fill recovery input
  const inputs = await page.$$('input[type="text"]');
  for (const inp of inputs) {
    const ph = await page.evaluate(el => el.placeholder, inp);
    if (ph && ph.includes('user@example.com')) {
      await inp.type('amerfathi123@gmail.com', { delay: 10 });
      break;
    }
  }

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const sub = btns.find(b => b.textContent.includes('متابعة والتحقق من الحساب'));
    if (sub) sub.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'test_forgot_password_modal_step2.png') });
  console.log('✓ Captured test_forgot_password_modal_step2.png');

  await browser.close();
})();
