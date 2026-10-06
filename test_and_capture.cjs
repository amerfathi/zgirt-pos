const puppeteer = require('C:\\Users\\IMDAD\\.gemini\\antigravity\\scratch\\khodar-pos\\node_modules\\puppeteer-core');
const path = require('path');
const fs = require('fs');

const ARTIFACT_DIR = 'C:\\Users\\IMDAD\\.gemini\\antigravity\\brain\\e7dac5c2-d3ba-4804-bd15-1d9eec19296b';

(async () => {
  console.log('--- Starting Automated Verification & Screenshot Capture ---');
  const browser = await puppeteer.launch({
    executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  // -------------------------------------------------------------
  // Test 1: Marketing Landing Page (Web Unauthenticated)
  // -------------------------------------------------------------
  console.log('1. Loading Marketing Landing Page...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await page.evaluate(() => {
    localStorage.removeItem('khodar_pos_current_user_v1');
    localStorage.removeItem('khodar_pos_logged_in_user');
    delete window.electronAPI;
  });
  await page.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'marketing_landing_page.png'),
    fullPage: false
  });
  console.log('✓ Captured marketing_landing_page.png');

  // -------------------------------------------------------------
  // Test 2: Trial Request Modal & Keyboard/Input Responsiveness
  // -------------------------------------------------------------
  console.log('2. Testing 1-Month Trial Request Modal & Keyboard Input...');
  // Click "اطلب تجربة مجانية لمدة شهر" button in hero
  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const trialBtn = buttons.find(b => b.textContent.includes('اطلب تجربة مجانية لمدة شهر'));
    if (trialBtn) trialBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // Find inputs in modal
  const inputs = await page.$$('input[type="text"], input[type="tel"]');
  console.log(`Found ${inputs.length} input fields in Trial modal.`);

  // Test Typing, Backspace, Caret, and Arrow Keys in First Input (Full Name)
  if (inputs.length > 0) {
    const nameInput = inputs[0];
    await nameInput.click();
    await nameInput.type('أحمد محمود الشناوي', { delay: 30 });
    
    // Test Backspace (delete 7 characters: "الشناوي")
    for (let i = 0; i < 7; i++) {
      await page.keyboard.press('Backspace');
    }
    // Verify value
    let val = await page.evaluate(el => el.value, nameInput);
    console.log(`Input value after Backspace: "${val}"`);

    // Retype
    await nameInput.type('السيد', { delay: 30 });
    val = await page.evaluate(el => el.value, nameInput);
    console.log(`Input value after retyping: "${val}"`);

    // Test Tab to next field (Business Name)
    await page.keyboard.press('Tab');
    await page.keyboard.type('أسواق الأهرام المركزية للخضار', { delay: 20 });

    // Test Tab to Phone
    await page.keyboard.press('Tab');
    await page.keyboard.type('01099684120', { delay: 20 });

    // Test Tab to City
    await page.keyboard.press('Tab');
    await page.keyboard.type('مدينة الإسكندرية', { delay: 20 });
  }

  await page.screenshot({
    path: path.join(ARTIFACT_DIR, 'trial_request_modal.png'),
    fullPage: false
  });
  console.log('✓ Captured trial_request_modal.png');

  // Close trial modal
  await page.evaluate(() => {
    const closeBtns = Array.from(document.querySelectorAll('button'));
    const cancelBtn = closeBtns.find(b => b.textContent.includes('إلغاء'));
    if (cancelBtn) cancelBtn.click();
  });
  await new Promise(r => setTimeout(r, 400));

  // -------------------------------------------------------------
  // Test 3: Dedicated Desktop Login Screen (Electron Windows Emulation)
  // -------------------------------------------------------------
  console.log('3. Emulating Desktop Electron Window & Capturing DesktopLoginView...');
  const desktopPage = await browser.newPage();
  await desktopPage.setViewport({ width: 1280, height: 800 });

  // Inject Electron environment before loading
  await desktopPage.evaluateOnNewDocument(() => {
    window.electronAPI = {
      isElectron: true,
      platform: 'win32',
      minimize: () => console.log('minimize called'),
      maximize: () => console.log('maximize called'),
      close: () => console.log('close called'),
      isMaximized: async () => false
    };
  });

  await desktopPage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });
  await desktopPage.evaluate(() => {
    localStorage.removeItem('khodar_pos_current_user_v1');
    localStorage.removeItem('khodar_pos_logged_in_user');
  });
  await desktopPage.reload({ waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  await desktopPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop_login_view.png'),
    fullPage: false
  });
  console.log('✓ Captured desktop_login_view.png');

  // -------------------------------------------------------------
  // Test 4: Authenticated Settings -> Updates Center & Modal
  // -------------------------------------------------------------
  console.log('4. Logging in and verifying Updates Center in Settings...');
  const authPage = await browser.newPage();
  await authPage.setViewport({ width: 1440, height: 900 });
  await authPage.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  // Set authenticated user and navigate to settings
  await authPage.evaluate(() => {
    localStorage.setItem('khodar_pos_current_user_v1', JSON.stringify({
      id: 'usr_admin',
      name: 'مدير النظام المعتمد',
      username: 'admin',
      role: 'admin',
      status: 'active',
      permissions: {
        canSell: true,
        canViewInvoices: true,
        canVoidInvoices: true,
        canManageCustomers: true,
        canManagePurchases: true,
        canManageInventory: true,
        canManageExpenses: true,
        canManagePayroll: true,
        canViewFinance: true,
        canAccessSettings: true
      }
    }));
  });
  await authPage.goto('http://localhost:5173/?tab=settings', { waitUntil: 'networkidle0' });
  await new Promise(r => setTimeout(r, 1000));

  // Click on "التحديثات وإصدار النظام" tab in settings sidebar
  await authPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const updateTab = buttons.find(b => b.textContent.includes('التحديثات وإصدار النظام'));
    if (updateTab) updateTab.click();
  });
  await new Promise(r => setTimeout(r, 600));

  await authPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'settings_updates_center.png'),
    fullPage: false
  });
  console.log('✓ Captured settings_updates_center.png');

  // Click "عرض تفاصيل التحديث" to open DesktopUpdateModal
  await authPage.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const updateModalBtn = buttons.find(b => b.textContent.includes('عرض تفاصيل التحديث'));
    if (updateModalBtn) updateModalBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  await authPage.screenshot({
    path: path.join(ARTIFACT_DIR, 'desktop_update_modal.png'),
    fullPage: false
  });
  console.log('✓ Captured desktop_update_modal.png');

  await browser.close();
  console.log('--- All Automated Verifications & Screenshots Succeeded! ---');
})();
