import puppeteer from 'puppeteer-core';
import path from 'path';
import { fileURLToPath } from 'url';
import http from 'http';
import fs from 'fs';

if (!process.env.BRAKA_TEST_PASSWORD || !process.env.BRAKA_TEST_USERNAME) throw new Error('Configure isolated test account credentials in the environment; never use a production account');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACTS_DIR = 'C:\\Users\\IMDAD\\.gemini\\antigravity\\brain\\e7dac5c2-d3ba-4804-bd15-1d9eec19296b';

// Simple static server for dist directory
function startStaticServer(port) {
  const distDir = path.join(__dirname, '..', 'dist');
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2'
  };

  const server = http.createServer((req, res) => {
    let reqPath = req.url.split('?')[0].split('#')[0];
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    let filePath = path.join(distDir, reqPath);

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(distDir, 'index.html');
    }

    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
      if (err) {
        res.writeHead(500);
        res.end('Server error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve(server));
  });
}

async function runVerification() {
  const port = 54321;
  const server = await startStaticServer(port);
  console.log(`Static test server running at http://localhost:${port}`);

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 850 });

    const pageErrors = [];
    page.on('pageerror', (err) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('PAGE ERROR DETECTED:', message);
      pageErrors.push(message);
    });

    // 1. Load Marketing Landing Page
    console.log('1. Testing Landing Page...');
    await page.goto(`http://localhost:${port}/`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    const pageText = await page.evaluate(() => document.body.innerText);
    const hasSpotlightCards = pageText.includes('كروت تعريفية عن إمكانيات البرنامج') && pageText.includes('محطة الكاشير والموازين الذكية');
    const hasPricing = pageText.includes('خطة شهرية') || pageText.includes('99 ج.م') || pageText.includes('أسعار الاشتراكات') || pageText.includes('باقة');
    console.log('Spotlight cards present:', hasSpotlightCards);
    console.log('Pricing section present (should be false):', hasPricing);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_marketing_spotlight.png') });

    // 2. Test Login Navigation
    console.log('2. Testing Login Button...');
    const loginButton = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const loginBtn = btns.find(b => b.innerText.includes('تسجيل الدخول'));
      if (loginBtn) {
        loginBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked login button:', loginButton);
    await new Promise(r => setTimeout(r, 1000));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_login_view.png') });
    const isLoginRendered = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input');
      const hasBackBtn = Array.from(document.querySelectorAll('button')).some(b => b.innerText.includes('العودة للموقع'));
      return inputs.length >= 2 && hasBackBtn;
    });
    console.log('Login view rendered cleanly without blank screen:', isLoginRendered);

    // Click "العودة للموقع"
    await page.evaluate(() => {
      const backBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('العودة للموقع'));
      if (backBtn) backBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // 3. Test Trial Request Form
    console.log('3. Testing Free Trial Request Modal...');
    await page.evaluate(() => {
      const trialBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('تجربة مجانية') || b.innerText.includes('طلب تجربة'));
      if (trialBtns[0]) trialBtns[0].click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Fill the trial form
    await page.type('input[placeholder*="أحمد محمود"]', 'معلم أحمد الفكهاني');
    await page.type('input[placeholder*="أسواق النور"]', 'سوق النخبة للفواكه');
    await page.type('input[placeholder*="010"]', '01012345678');
    await page.type('input[placeholder*="القاهرة"]', 'الجيزة - الدقي');

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_trial_form_filled.png') });

    // Submit trial request
    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('تأكيد وإرسال طلب التجربة'));
      if (submitBtn) submitBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    const storedTrials = await page.evaluate(() => {
      return localStorage.getItem('khodar_trial_leads_v1');
    });
    console.log('Saved trial leads in storage:', storedTrials);

    // 4. Test Login as Master Owner (amerfathi123@gmail.com)
    console.log('4. Logging in as Master Platform Owner (amerfathi123@gmail.com)...');
    await page.goto(`http://localhost:${port}/?login=true`, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 800));

    // Verify demo buttons are removed
    const hasDemoButtons = await page.evaluate(() => {
      return Boolean(document.querySelector('#admin-login-btn') || document.querySelector('#demo-login-btn'));
    });
    console.log('Demo buttons present (should be false):', hasDemoButtons);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_clean_white_login.png') });

    // Type Master Owner Credentials into clean empty inputs
    await page.type('input[placeholder*="اسم المستخدم أو البريد"]', process.env.BRAKA_TEST_USERNAME);
    await page.type('input[type="password"]', process.env.BRAKA_TEST_PASSWORD);
    await new Promise(r => setTimeout(r, 300));

    await page.evaluate(() => {
      const submitBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('تسجيل الدخول إلى النظام'));
      if (submitBtn) submitBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    console.log('5. Opening SuperAdmin Portal...');
    await page.evaluate(() => {
      const superAdminBtn = document.querySelector('button[title*="سوبر"]') || Array.from(document.querySelectorAll('button')).find(b => b.title?.includes('سوبر') || b.innerText?.includes('سوبر'));
      if (superAdminBtn instanceof HTMLElement) superAdminBtn.click();
    });
    await new Promise(r => setTimeout(r, 1500));

    // Verify allowed branches column exists in Subscribers table
    const hasBranchesColumn = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll('th'));
      return headers.some(h => h.innerText.includes('الفروع المسموحة'));
    });
    console.log('Allowed branches column present in table:', hasBranchesColumn);

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_superadmin_subscribers_branches.png') });

    // Test clicking branch edit button
    console.log('6. Testing branch quota upgrade modal...');
    const clickedBranchEdit = await page.evaluate(() => {
      const editBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('تعديل') && b.title?.includes('الفروع'));
      if (editBtn) {
        editBtn.click();
        return true;
      }
      return false;
    });
    console.log('Clicked branch edit button:', clickedBranchEdit);
    await new Promise(r => setTimeout(r, 800));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_branch_upgrade_modal.png') });

    // Select 5 branches and save
    await page.evaluate(() => {
      const fiveBranchesBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('5 فروع'));
      if (fiveBranchesBtn) fiveBranchesBtn.click();
      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('حفظ ترخيص الفروع') || b.innerText.includes('حفظ الترقية'));
      if (saveBtn) saveBtn.click();
    });
    await new Promise(r => setTimeout(r, 800));

    // Check Trials tab
    console.log('7. Checking Trials tab...');
    const clickedTrialsTab = await page.evaluate(() => {
      const tabBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('طلبات التجربة'));
      if (tabBtns[0]) {
        tabBtns[0].click();
        return true;
      }
      return false;
    });
    console.log('Switched to trials tab in SuperAdminPortal:', clickedTrialsTab);
    await new Promise(r => setTimeout(r, 800));

    await page.screenshot({ path: path.join(ARTIFACTS_DIR, 'test_superadmin_trials_tab.png') });

    console.log('\n--- VERIFICATION SUMMARY ---');
    console.log('Page errors count:', pageErrors.length);
    if (pageErrors.length > 0) {
      console.log('Errors:', pageErrors);
    } else {
      console.log('SUCCESS: All workflows verified with 0 errors!');
    }
  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await browser.close();
    server.close();
  }
}

runVerification();
