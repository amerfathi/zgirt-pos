import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ASSETS_DIR = path.join(__dirname, '..', 'guide-assets');
const OUTPUT_PDF = path.join(__dirname, '..', 'Mobile-POS-User-Guide.pdf');

// Helper to get base64 image
function getBase64Image(filename) {
  const filePath = path.join(ASSETS_DIR, filename);
  if (fs.existsSync(filePath)) {
    const data = fs.readFileSync(filePath);
    return `data:image/png;base64,${data.toString('base64')}`;
  }
  return '';
}

const imgHome = getBase64Image('01_home.png');
const imgSale = getBase64Image('02_sale.png');
const imgInvoices = getBase64Image('03_invoices.png');
const imgSalesReturns = getBase64Image('03_b_sales_returns.png');
const imgPurchases = getBase64Image('04_purchases.png');
const imgProducts = getBase64Image('05_products.png');
const imgCustomers = getBase64Image('06_customers.png');
const imgDamaged = getBase64Image('07_damaged.png');
const imgExpenses = getBase64Image('08_expenses.png');
const imgWorkers = getBase64Image('09_workers.png');
const imgAudit = getBase64Image('10_audit.png');
const imgPartners = getBase64Image('11_partners.png');
const imgReports = getBase64Image('12_reports.png');

const htmlContent = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>الدليل التشغيلي والإرشادي الشامل لنظام نقاط البيع والمحاسبة</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');

    @page {
      size: A4;
      margin: 14mm 12mm 14mm 12mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
      background: #ffffff;
      color: #0f172a;
      line-height: 1.6;
      font-size: 11pt;
    }

    .page-break {
      page-break-before: always;
    }

    .avoid-break {
      page-break-inside: avoid;
    }

    /* Cover Page */
    .cover-page {
      height: 100vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 40px 20px;
      border: 8px solid #047857;
      border-radius: 20px;
      background: linear-gradient(145deg, #f0fdf4 0%, #ffffff 60%, #ecfdf5 100%);
      text-align: center;
      position: relative;
    }

    .cover-top {
      margin-top: 30px;
    }

    .cover-badge {
      display: inline-block;
      padding: 8px 24px;
      background: #065f46;
      color: #ffffff;
      font-size: 11pt;
      font-weight: 800;
      border-radius: 999px;
      letter-spacing: 0.5px;
      margin-bottom: 20px;
    }

    .cover-title {
      font-size: 26pt;
      font-weight: 900;
      color: #064e3b;
      line-height: 1.3;
      margin-bottom: 15px;
    }

    .cover-subtitle {
      font-size: 13pt;
      color: #334155;
      font-weight: 600;
      max-width: 650px;
      margin: 0 auto;
    }

    .cover-device-frame {
      margin: 25px auto;
      max-width: 240px;
      border-radius: 28px;
      border: 5px solid #0f172a;
      box-shadow: 0 20px 30px -10px rgba(0,0,0,0.25);
      overflow: hidden;
      background: #000;
    }

    .cover-device-frame img {
      width: 100%;
      display: block;
    }

    .cover-footer {
      border-top: 2px dashed #a7f3d0;
      padding-top: 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5pt;
      color: #475569;
      font-weight: 700;
    }

    /* Index & Headers */
    h1.section-header {
      font-size: 18pt;
      font-weight: 900;
      color: #065f46;
      border-bottom: 3px solid #10b981;
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    h2.sub-header {
      font-size: 13pt;
      font-weight: 800;
      color: #1e293b;
      margin-top: 14px;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }

    p {
      color: #334155;
      margin-bottom: 10px;
      font-size: 10pt;
      text-align: justify;
    }

    /* Step boxes */
    .steps-container {
      margin: 12px 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .step-card {
      background: #f8fafc;
      border-right: 4px solid #059669;
      border-top: 1px solid #e2e8f0;
      border-bottom: 1px solid #e2e8f0;
      border-left: 1px solid #e2e8f0;
      padding: 10px 14px;
      border-radius: 8px;
    }

    .step-number {
      font-size: 10pt;
      font-weight: 900;
      color: #065f46;
      margin-bottom: 3px;
    }

    .step-title {
      font-size: 10.5pt;
      font-weight: 800;
      color: #0f172a;
    }

    .step-desc {
      font-size: 9.5pt;
      color: #475569;
      margin-top: 2px;
      margin-bottom: 0;
    }

    /* Alerts and Callouts */
    .alert-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 10px;
      padding: 10px 14px;
      margin: 12px 0;
      font-size: 9.5pt;
      color: #14532d;
    }

    .alert-box.warning {
      background: #fffbeb;
      border-color: #fde68a;
      color: #78350f;
    }

    .alert-box.important {
      background: #eff6ff;
      border-color: #bfdbfe;
      color: #1e3a8a;
    }

    .alert-title {
      font-weight: 800;
      margin-bottom: 3px;
      display: flex;
      align-items: center;
      gap: 5px;
    }

    /* Layout with mobile screenshot side by side */
    .content-with-phone {
      display: flex;
      gap: 16px;
      align-items: flex-start;
      margin-top: 10px;
    }

    .text-column {
      flex: 1;
    }

    .phone-column {
      width: 200px;
      flex-shrink: 0;
      text-align: center;
    }

    .phone-mockup {
      width: 100%;
      border-radius: 20px;
      border: 4px solid #1e293b;
      box-shadow: 0 8px 16px rgba(0,0,0,0.12);
      overflow: hidden;
      background: #ffffff;
    }

    .phone-mockup img {
      width: 100%;
      display: block;
    }

    .phone-caption {
      font-size: 8pt;
      font-weight: 700;
      color: #64748b;
      margin-top: 5px;
    }

    /* Table styles */
    table.guide-table {
      width: 100%;
      border-collapse: collapse;
      margin: 10px 0;
      font-size: 9pt;
    }

    table.guide-table th {
      background: #0f172a;
      color: #ffffff;
      padding: 6px 10px;
      font-weight: 800;
      border: 1px solid #334155;
      text-align: right;
    }

    table.guide-table td {
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      color: #1e293b;
    }

    table.guide-table tr:nth-child(even) {
      background: #f8fafc;
    }

    .badge-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 999px;
      font-size: 8pt;
      font-weight: 800;
    }

    .badge-emerald { background: #d1fae5; color: #065f46; }
    .badge-blue { background: #dbeafe; color: #1e40af; }
    .badge-amber { background: #fef3c7; color: #92400e; }
    .badge-rose { background: #ffe4e6; color: #9f1239; }

    /* Footer per page */
    .page-footer {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #94a3b8;
      border-top: 1px solid #e2e8f0;
      padding-top: 4px;
    }
  </style>
</head>
<body>

  <!-- ========================================================================= -->
  <!-- COVER PAGE -->
  <!-- ========================================================================= -->
  <div class="cover-page">
    <div class="cover-top">
      <div class="cover-badge">📱 دليل التشغيل الرسمي للجوال • الإصدار المعتمد v1.1</div>
      <h1 class="cover-title">الدليل الإرشادي والتشغيلي الشامل<br>لنظام نقاط البيع والمحاسبة والمخزون</h1>
      <p class="cover-subtitle">
        دليل عملي تفصيلي خطوة بخطوة مدعم بالصور الحية لتدريب الكاشير، تنظيم المبيعات والميزان، ضبط المشتريات والمردودات، والرقابة المالية الدقيقة عبر الهاتف المحمول.
      </p>
    </div>

    <div class="cover-device-frame">
      <img src="${imgHome}" alt="واجهة التطبيق على الجوال">
    </div>

    <div class="cover-footer">
      <span>نسخة الهاتف الذكي والأجهزة اللوحية (Android / PWA)</span>
      <span>توثيق معتمد لخطوات العمل السليمة وتفادي الأخطاء</span>
      <span>تحديث 2026</span>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- INDEX / TABLE OF CONTENTS -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">📑 فهرس فصول الدليل التشغيلي</h1>
    <p>تم إعداد هذا الدليل ليكون مرجعاً يومياً مبسطاً لكافة العاملين بالمنشأة (الكاشير، المحاسب، المشرف، والإدارة) لممارسة عمليات البيع والجرد ومتابعة السيولة بدقة متناهية:</p>

    <table class="guide-table" style="margin-top: 15px;">
      <thead>
        <tr>
          <th style="width: 45px; text-align: center;">الفصل</th>
          <th>عنوان الفصل والموضوعات الأساسية</th>
          <th style="width: 140px; text-align: center;">القسم في التطبيق</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="text-align: center; font-weight: 800;">1</td>
          <td><strong>الشاشة الرئيسية والتنقل السريع:</strong> مؤشرات الخزينة، رصيد البنك، ديون السوق، والوصول الفوري للأقسام.</td>
          <td style="text-align: center;"><span class="badge-pill badge-emerald">الرئيسية 🏠</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">2</td>
          <td><strong>نقطة البيع والميزان والكاشير:</strong> احتساب الوزن الصافي، خصم الفارغ والطرود، طرق الدفع المتعددة، والطباعة.</td>
          <td style="text-align: center;"><span class="badge-pill badge-emerald">المبيعات 🛒</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">3</td>
          <td><strong>سجل الفواتير ونظام مردودات المبيعات:</strong> استعراض الفواتير، وحماية الأرباح برد البضاعة بالسعر التاريخي الأصلي.</td>
          <td style="text-align: center;"><span class="badge-pill badge-emerald">المبيعات 📄</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">4</td>
          <td><strong>المشتريات وتوريد البضاعة ومردودات الموردين:</strong> استلام الشحنات، تسجيل التكاليف، وإرجاع البضاعة للموردين.</td>
          <td style="text-align: center;"><span class="badge-pill badge-blue">التوريد 🚛</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">5</td>
          <td><strong>إدارة الأصناف والأسعار:</strong> إضافة أصناف جديدة، تعديل سعر البيع، وضبط أوزان العبوات الافتراضية.</td>
          <td style="text-align: center;"><span class="badge-pill badge-blue">التوريد 📦</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">6</td>
          <td><strong>حسابات العملاء والديون وسندات القبض:</strong> متابعة الآجل، كشوفات الحساب التفصيلية، وسندات القبض الفورية.</td>
          <td style="text-align: center;"><span class="badge-pill badge-amber">العملاء 👥</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">7</td>
          <td><strong>سجل التوالف والإعدامات (الهالك):</strong> تسجيل التالف أولاً بأول لمنع عجز المخزن وعكس الخسائر في الأرباح.</td>
          <td style="text-align: center;"><span class="badge-pill badge-rose">المخزون 🗑️</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">8</td>
          <td><strong>المصروفات التشغيلية والنثريات:</strong> توثيق مصاريف النقل، الإيجار، الصيانة، والكهرباء من الكاش أو البنك.</td>
          <td style="text-align: center;"><span class="badge-pill badge-rose">المصروفات 💸</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">9</td>
          <td><strong>الموظفون والرواتب وسجل السلفيات:</strong> رواتب العمال، ضبط السلف الممنوحة، والخصم التلقائي عند الرواتب.</td>
          <td style="text-align: center;"><span class="badge-pill badge-blue">العمالة 👷</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">10</td>
          <td><strong>جرد الخزينة ومطابقة نقدية الدرج الفعلي:</strong> أداة فحص العجز والزيادة، وتتبع مسار التدفقات النقدية.</td>
          <td style="text-align: center;"><span class="badge-pill badge-emerald">الرقابة ⚖️</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">11</td>
          <td><strong>الشركاء والمسحوبات وتوزيع الأرباح:</strong> نسب الملكية، توثيق المسحوبات النقدية، وتصفية الأرباح الدورية.</td>
          <td style="text-align: center;"><span class="badge-pill badge-amber">المالية 🤝</span></td>
        </tr>
        <tr>
          <td style="text-align: center; font-weight: 800;">12</td>
          <td><strong>مركز التقارير A4 وقائمة الأرباح والخسائر:</strong> تقارير المبيعات، المشتريات، وصافي الدخل الشامل (P&L).</td>
          <td style="text-align: center;"><span class="badge-pill badge-emerald">التقارير 📊</span></td>
        </tr>
      </tbody>
    </table>

    <div class="alert-box important" style="margin-top: 20px;">
      <div class="alert-title">💡 القاعدة الذهبية للعمل السليم على النظام:</div>
      كل معاملة مالية أو مخزنية تتم في المحل (بيع، شراء، سداد، مرتجع، مصروف، تالف) يجب تسجيلها في لحظتها على التطبيق؛ هذا يضمن لك تطابق رصيد الدرج الفعلي مع الرصيد المحاسبي بنسبة 100% في نهاية كل وردية عمل.
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 1: HOME & DASHBOARD -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">📱 الفصل 1: الشاشة الرئيسية والتنقل السريع</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          تم تصميم الشاشة الرئيسية لتكون <strong>لوحة قيادة مركزية فورية</strong> يستطيع المسؤول من خلالها معرفة الموقف المالي للمحل بمجرد النظر، مع إمكانية الوصول إلى أي عملية بضغطة واحدة.
        </p>

        <h2 class="sub-header">1. بطاقة السيولة النقدية والموقف المالي اللحظي:</h2>
        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">💵 نقدية الخزينة (الدرج)</div>
            <div class="step-desc">يعرض صافي النقدية الحاضرة المفترض وجودها في درج الكاشير في هذه اللحظة بالضبط.</div>
          </div>
          <div class="step-card">
            <div class="step-number">🏦 البنك والشبكة</div>
            <div class="step-desc">المبالغ المحصلة عبر أجهزة نقاط البيع الإلكترونية (مدى / فيزا) أو التحويلات البنكية المباشرة.</div>
          </div>
          <div class="step-card">
            <div class="step-number">📝 ديون العملاء (لنا)</div>
            <div class="step-desc">إجمالي المبالغ الآجلة في ذمة الزبائن والمطاعم بانتظار السداد.</div>
          </div>
          <div class="step-card">
            <div class="step-number">📈 مبيعات اليوم</div>
            <div class="step-desc">إجمالي قيمة الفواتير المباعة منذ بداية الوردية الصباحية حتى اللحظة.</div>
          </div>
        </div>

        <h2 class="sub-header">2. كيفية التنقل السلس بين الأقسام:</h2>
        <ul style="padding-right: 18px; font-size: 9.5pt; color: #334155; line-height: 1.7;">
          <li><strong>الأزرار السريعة بالألوان:</strong> مقسمة بوضوح إلى 4 مجموعات كبرى: (المبيعات، المخزون، المصروفات، والمالية).</li>
          <li><strong>الشريط السفلي الثابت (Bottom Nav):</strong> يتيح لك الانتقال الفوري بين الشاشات الرئيسية: (الرئيسية، نقطة البيع، سجل الفواتير، والجرد) من أي مكان داخل التطبيق.</li>
          <li><strong>زر الرجوع السريع:</strong> موجود أعلى كل شاشة فرعية للعودة بسلاسة للشاشة السابقة.</li>
        </ul>
      </div>

      <div class="phone-column">
        <div class="phone-mockup">
          <img src="${imgHome}" alt="الشاشة الرئيسية">
        </div>
        <div class="phone-caption">الشاشة الرئيسية ولوحة المتابعة</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 2: POS & SCALES -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">⚖️ الفصل 2: شاشة البيع والكاشير والميزان (POS)</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          نقطة البيع هي الشاشة الأكثر استخداماً في المحل؛ وقد تم تزويدها بآلية وزن صافي ذكية تخصم وزن الصناديق الفارغة آلياً لحماية التاجر والزبون من أخطاء الميزان.
        </p>

        <h2 class="sub-header">خطوات تسجيل فاتورة بيع صحيحة:</h2>
        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">الخطوة 1</div>
            <div class="step-title">اختيار الصنف المراد بيعه:</div>
            <div class="step-desc">اضغط على بطاقة الصنف من قائمة الأصناف السريعة، أو ابحث عن اسمه في شريط البحث العلوي.</div>
          </div>

          <div class="step-card">
            <div class="step-number">الخطوة 2</div>
            <div class="step-title">إدخال الوزن وعدد العبوات (خصم الفارغ التلقائي):</div>
            <div class="step-desc">
              - اكتب <strong>الوزن الإجمالي بالميزان</strong> (مثلاً: 25.5 كجم).<br>
              - حدد <strong>عدد العبوات / الصناديق</strong>، وسيقوم النظام بخصم وزن الفارغ آلياً (مثلاً: 1.2 كجم لكل عبوة) وحساب <strong>الوزن الصافي الحقيقي</strong>.
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">الخطوة 3</div>
            <div class="step-title">تحديد العميل ونوع الفاتورة:</div>
            <div class="step-desc">
              - <strong>زبون نقدي (افتراضي):</strong> للزبائن العاديين.<br>
              - <strong>عميل بالاسم / مطعم:</strong> اختر العميل من القائمة لتمكينه من الشراء الآجل وإضافة المبلغ لدينه.
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">الخطوة 4</div>
            <div class="step-title">اختيار طريقة الدفع وسداد الفاتورة:</div>
            <div class="step-desc">
              - <strong>💵 نقدي:</strong> كاش يدخل في درج المحل.<br>
              - <strong>🏛️ شبكة / بنك:</strong> تحويل أو مدى.<br>
              - <strong>📝 آجل:</strong> يسجل ديناً على العميل المختار.<br>
              - <strong>⚖️ دفع مجزأ:</strong> جزء كاش وجزء بنك وجزء آجل.
            </div>
          </div>
        </div>

        <div class="alert-box">
          <div class="alert-title">🖨️ الطباعة والمشاركة:</div>
          بمجرد الضغط على <strong>«حفظ وطباعة الفاتورة»</strong>، تظهر نافذة معاينة فورية تتيح: طباعة إيصال كاشير حراري، طباعة مستند رسمي A4، أو إرسال الفاتورة للزبون بضغطة زر عبر تطبيق <strong>واتساب (WhatsApp)</strong>.
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup">
          <img src="${imgSale}" alt="شاشة نقطة البيع">
        </div>
        <div class="phone-caption">شاشة البيع والميزان والكاشير</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 3: INVOICES & SALES RETURNS -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">🔄 الفصل 3: سجل الفواتير ومردودات المبيعات الذكية</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          يتيح سجل الفواتير مراجعة وتدقيق كافة عمليات البيع السابقة، مع نظام أمان متطور لإدارة <strong>مردودات المبيعات</strong> يحمي أرباح المحل ويمنع التلاعب بالأسعار.
        </p>

        <h2 class="sub-header">1. استعراض والبحث في الفواتير:</h2>
        <p style="font-size: 9.5pt;">
          يمكنك تصفية الفواتير بحسب التاريخ (اليوم، أمس، الأسبوع) أو البحث برقم الفاتورة أو اسم الزبون، مع معرفة ما إذا كانت الفاتورة مسددة كاش أو مؤجلة كدين.
        </p>

        <h2 class="sub-header">2. كيف يعمل نظام مردودات المبيعات المحمي؟</h2>
        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">المبدأ الأساسي</div>
            <div class="step-title">القفل الإلزامي على السعر التاريخي للفاتورة:</div>
            <div class="step-desc">
              عند إرجاع أي كمية، يقرأ النظام <strong>سعر الكيلو الأصلي المدون على الفاتورة ذاتها</strong> لحظة البيع. إذا بيعت الطماطم بـ 8 ريالات ثم ارتفع سعرها في المحل إلى 12 ريالاً، يقوم النظام برد المبلغ على أساس 8 ريالات فقط ولا يتأثر بالسعر الجديد مطلقاً.
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">طريقة العمل</div>
            <div class="step-title">خطوات تسجيل مردود مبيعات:</div>
            <div class="step-desc">
              1. افتح سجل الفواتير واضغط على زر <strong>«مردود مبيعات 🔄»</strong> أمام الفاتورة المطلوبة.<br>
              2. حدد الوزن المرتجع (كجم).<br>
              3. اختر طريقة رد المبلغ: (خصم من درج الكاشير / تحويل بنكي / خصم من دين الزبون الدفتري).<br>
              4. حدد حالة الصنف المرتجع: <strong>«إعادة للمخزن»</strong> إذا كان صالحاً، أو <strong>«إعدام وتالف»</strong> إذا كان معيباً.
            </div>
          </div>
        </div>

        <div class="alert-box warning">
          <div class="alert-title">🔒 ضمان حقوق المحل:</div>
          كل عملية مردود توثق في سجل المردودات المستقل مع كتابة سبب الإرجاع ورقم الفاتورة الأصلية لتدقيقها وقت الجرد.
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup" style="margin-bottom: 10px;">
          <img src="${imgInvoices}" alt="سجل الفواتير">
        </div>
        <div class="phone-caption">سجل الفواتير والمردودات</div>

        <div class="phone-mockup" style="margin-top: 10px;">
          <img src="${imgSalesReturns}" alt="سجل مردودات المبيعات">
        </div>
        <div class="phone-caption">سجل مردودات المبيعات المحمي</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 4: PURCHASES & SUPPLIER RETURNS -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">🚛 الفصل 4: المشتريات وتوريد البضاعة ومردودات الموردين</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          تسجيل المشتريات بدقة هو حجر الأساس لحساب أرباح المحل الحقيقية ومراقبة ديون تجار الجملة والمزارع دون أي لبس.
        </p>

        <h2 class="sub-header">1. خطوات تسجيل شحنة بضاعة واردة:</h2>
        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">1</div>
            <div class="step-title">اختيار الصنف والمورد:</div>
            <div class="step-desc">اختر صنف الخضار من القائمة أو أضف صنفاً جديداً، وحدد اسم المورد أو المزرعة الواردة منها الحمولة.</div>
          </div>

          <div class="step-card">
            <div class="step-number">2</div>
            <div class="step-title">الكميات والتكاليف:</div>
            <div class="step-desc">
              - اكتب <strong>إجمالي الوزن بالكيلوجرام</strong> و<strong>عدد الصناديق/الطرود</strong>.<br>
              - ادخل <strong>سعر تكلفة الكيلو</strong> أو إجمالي الفاتورة، وسيقوم النظام بزيادة رصيد الصنف في المخزن تلقائياً.
            </div>
          </div>

          <div class="step-card">
            <div class="step-number">3</div>
            <div class="step-title">تحديد طريقة سداد التوريد:</div>
            <div class="step-desc">
              - <strong>نقدي (من الصندوق):</strong> يخصم من كاش الدرج فوراً.<br>
              - <strong>تحويل بنكي:</strong> يخصم من رصيد البنك مع تسجيل اسم البنك ورقم التحويل.<br>
              - <strong>آجل (على الحساب):</strong> يسجل المبلغ ديناً على المحل في حساب المورد الدفتري.
            </div>
          </div>
        </div>

        <h2 class="sub-header">2. مردودات المشتريات للموردين:</h2>
        <p style="font-size: 9.5pt;">
          إذا وصلت بضاعة معيبة أو تم الاتفاق على إرجاع جزء منها للمورد، اضغط على زر <strong>«مردود للمورد ↩️»</strong>؛ سيتم احتساب قيمة المردود <strong>بتكلفة الشحنة الأصلية المحمية</strong>، مع خيارات: (خصم المبلغ من حساب المورد الدفتري لتخفيض دينه، أو استرداد كاش بالدرج، أو تحويل بنكي).
        </p>

        <div class="alert-box">
          <div class="alert-title">📦 حركة المخزون التلقائية:</div>
          عند حفظ المشتريات يزيد المخزون، وعند تسجيل مردود للمورد يخصم المخزون آلياً دون الحاجة لتعديلات يدوية.
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup">
          <img src="${imgPurchases}" alt="المشتريات والتوريد">
        </div>
        <div class="phone-caption">شاشة المشتريات ومردودات الموردين</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 5 & 6: PRODUCTS & CUSTOMERS -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">🥦 الفصل 5: قائمة الأصناف والتسعير اليومي</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          نظراً لأن أسعار الخضار والفواكه تتغير بشكل يومي بحسب أسعار سوق الجملة، توفر شاشة الأصناف سرعة فائقة في تعديل الأسعار.
        </p>

        <h2 class="sub-header">كيفية تعديل وإضافة الأصناف:</h2>
        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">تعديل الأسعار</div>
            <div class="step-title">تحديث سعر الكيلو اليومي:</div>
            <div class="step-desc">اضغط على الصنف وقم بتعديل سعر البيع؛ يتم تحديث شاشة الكاشير فوراً دون إعادة تشغيل التطبيق.</div>
          </div>
          <div class="step-card">
            <div class="step-number">وزن الفارغ الافتراضي</div>
            <div class="step-title">ضبط وزن الصندوق الافتراضي:</div>
            <div class="step-desc">يمكنك تحديد وزن الصندوق الفارغ لكل صنف (مثلاً: قفص الطماطم 1.2 كجم، كرتون الخيار 0.8 كجم) ليتم خصمه تلقائياً عند الوزن.</div>
          </div>
        </div>

        <h1 class="section-header" style="margin-top: 25px;">👥 الفصل 6: حسابات العملاء وسندات القبض</h1>
        <p>
          إدارة مبيعات الآجل للمطاعم والزبائن الدائمين، مع كشف حساب تفصيلي وسندات قبض فورية.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">سند قبض فوري</div>
            <div class="step-title">تسجيل دفعة مسددة من عميل:</div>
            <div class="step-desc">عندما يدفع العميل جزءاً من حسابه، اضغط على <strong>«سند قبض»</strong>، ادخل المبلغ المحصل (كاش أو بنك)، وسيتم تخفيض دينه فوراً وإضافة الكاش للخزينة.</div>
          </div>
          <div class="step-card">
            <div class="step-number">كشف الحساب</div>
            <div class="step-title">تصدير كشف حساب تفصيلي:</div>
            <div class="step-desc">يمكنك استعراض حركات العميل (فواتير، دفعات، مردودات) ومشاركتها معه كملف A4 أو عبر واتساب.</div>
          </div>
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup" style="margin-bottom: 10px;">
          <img src="${imgProducts}" alt="قائمة الأصناف">
        </div>
        <div class="phone-caption">قائمة الأصناف والتسعير</div>

        <div class="phone-mockup" style="margin-top: 10px;">
          <img src="${imgCustomers}" alt="حسابات العملاء">
        </div>
        <div class="phone-caption">حسابات العملاء والديون</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 7 & 8: DAMAGED ITEMS & EXPENSES -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">🗑️ الفصل 7: سجل التوالف والهالك (إعدام البضاعة)</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          تعد التوالف من أكبر أسباب عجز الميزانية في تجارة الخضار إذا لم تُوثق؛ لذا وفر التطبيق سجلاً خاصاً لتسجيل الخضار التالف يومياً.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">خطوات التسجيل</div>
            <div class="step-title">توثيق صنف تالف:</div>
            <div class="step-desc">
              1. اضغط على <strong>«تسجيل توالف جديدة»</strong>.<br>
              2. اختر الصنف وادخل الوزن التالف (كجم).<br>
              3. ادخل سعر التكلفة وسبب التلف (فرز، هالك نقل، ذبول).<br>
              4. يقوم النظام بخصم الكمية من المخزون وتحميل قيمتها كـ <strong>خسارة تشغيلية</strong> في قائمة الأرباح والخسائر.
            </div>
          </div>
        </div>

        <h1 class="section-header" style="margin-top: 25px;">💸 الفصل 8: المصروفات اليومية والتشغيلية</h1>
        <p>
          تسجيل كافة نثريات وتكاليف تشغيل المحل مع تحديد طريقة الدفع لضبط مطابقة الصندوق.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">تسجيل المصروف</div>
            <div class="step-title">بيانات سند الصرف:</div>
            <div class="step-desc">
              - حدد بند الصرف: (نقل ومشال، فواتير كهرباء ومياه، إيجار، أدوات تغليف ونظافة، ضيافة).<br>
              - ادخل المبلغ، وحدد مصدر الصرف: <strong>«نقدية من الدرج»</strong> فيخصم من رصيد الكاش، أو <strong>«تحويل بنكي»</strong> فيخصم من رصيد البنك.
            </div>
          </div>
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup" style="margin-bottom: 10px;">
          <img src="${imgDamaged}" alt="سجل التوالف">
        </div>
        <div class="phone-caption">سجل التوالف والهالك</div>

        <div class="phone-mockup" style="margin-top: 10px;">
          <img src="${imgExpenses}" alt="المصروفات اليومية">
        </div>
        <div class="phone-caption">شاشة المصروفات والتشغيل</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 9 & 10: WORKERS & AUDIT -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">👷 الفصل 9: شؤون الموظفين والرواتب وسجل السلفيات</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          نظام متكامل لتسجيل بيانات العمال، وصرف السلفيات اليومية، واحتساب الرواتب الشهرية مع الخصم الآلي للسلف.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">صرف سلفة</div>
            <div class="step-title">تسجيل سلفة لعامل:</div>
            <div class="step-desc">اكتب مبلغ السلفة، فتخصم من درج الكاشير فوراً وتضاف إلى رصيد سلف العامل التراكمي.</div>
          </div>
          <div class="step-card">
            <div class="step-number">صرف الراتب</div>
            <div class="step-title">تسليم الراتب الشهري:</div>
            <div class="step-desc">يقوم النظام بخصم إجمالي السلف من الراتب الأساسي تلقائياً، ويعرض صافي الراتب المستحق للصرف.</div>
          </div>
        </div>

        <h1 class="section-header" style="margin-top: 25px;">⚖️ الفصل 10: جرد الخزينة ومطابقة نقدية الدرج (الخزينة)</h1>
        <p>
          الأداة الأهم لكشف أي عجز أو زيادة في درج الكاشير في ثوانٍ معدودة.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">طريقة المطابقة</div>
            <div class="step-title">كيف تطابق الدرج في نهاية الوردية؟</div>
            <div class="step-desc">
              1. افتح شاشة <strong>«الجرد ومطابقة السيولة»</strong>.<br>
              2. قم بعدّ النقدية الموجودة في الدرج بيدك واكتبها في خانة <strong>«المبلغ المعدود فعلياً»</strong>.<br>
              3. يقارن النظام ما بيدك مع <strong>الرصيد الدفتري المفترض</strong>؛ ويظهر لك مباشرة:
              <br>• <span style="color: #059669; font-weight: bold;">مطابق 100%:</span> لا يوجد أي عجز أو زيادة.
              <br>• <span style="color: #dc2626; font-weight: bold;">يوجد عجز:</span> الكاش الفعلي أقل من المفروض.
              <br>• <span style="color: #2563eb; font-weight: bold;">يوجد فائض:</span> الكاش الفعلي أكبر من الدفتري.
            </div>
          </div>
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup" style="margin-bottom: 10px;">
          <img src="${imgWorkers}" alt="إدارة الموظفين والرواتب">
        </div>
        <div class="phone-caption">الموظفون والرواتب والسلف</div>

        <div class="phone-mockup" style="margin-top: 10px;">
          <img src="${imgAudit}" alt="جرد السيولة والدرج">
        </div>
        <div class="phone-caption">أداة مطابقة نقدية الدرج والجرد</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- CHAPTER 11 & 12: PARTNERS & REPORTS -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">🤝 الفصل 11: كشف الشركاء والمسحوبات وتوزيع الأرباح</h1>

    <div class="content-with-phone">
      <div class="text-column">
        <p>
          حفظ حقوق الشركاء بدقة متناهية عبر تسجيل نسب الحصص ومتابعة المسحوبات الدورية وجلسات توزيع الأرباح.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">مسحوبات الشركاء</div>
            <div class="step-title">سحب مبالغ تحت حساب الأرباح:</div>
            <div class="step-desc">تسجيل أي مبلغ يسحبه شريك (كاش من الدرج أو تحويل بنكي) وتوثيقه في كشف حسابه الشخصي.</div>
          </div>
          <div class="step-card">
            <div class="step-number">توزيع الأرباح</div>
            <div class="step-title">اعتماد جلسة توزيع الأرباح:</div>
            <div class="step-desc">توزيع الأرباح الصافية بنسب الملكية المعتمدة، مع خصم مسحوبات كل شريك السابقة تلقائياً.</div>
          </div>
        </div>

        <h1 class="section-header" style="margin-top: 25px;">📊 الفصل 12: مركز التقارير الشاملة A4 وقائمة الدخل</h1>
        <p>
          استخراج وطباعة تقارير رسمية تفصيلية متوافقة مع معايير المحاسبة والطباعة الورقية A4.
        </p>

        <div class="steps-container">
          <div class="step-card">
            <div class="step-number">تقارير A4 المتاحة</div>
            <div class="step-title">التقارير الرسمية الجاهزة للطباعة:</div>
            <div class="step-desc">
              1. <strong>تقرير المبيعات الشامل:</strong> (الإجمالي، المردودات، والصافي).<br>
              2. <strong>تقرير المشتريات والتوريد:</strong> (الشحنات وتكاليف التوريد).<br>
              3. <strong>سجل مردودات البيع والشراء:</strong> كشف المرتجعات بالسعر التاريخي.<br>
              4. <strong>قائمة الدخل والأرباح (P&L):</strong> احتساب صافي الربح الحقيقي الشامل:<br>
              <code style="background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-weight: bold; color: #0f172a;">
                صافي المبيعات - صافي المشتريات - التوالف - المصروفات
              </code>
            </div>
          </div>
        </div>
      </div>

      <div class="phone-column">
        <div class="phone-mockup" style="margin-bottom: 10px;">
          <img src="${imgPartners}" alt="حسابات الشركاء">
        </div>
        <div class="phone-caption">الشركاء والمسحوبات والأرباح</div>

        <div class="phone-mockup" style="margin-top: 10px;">
          <img src="${imgReports}" alt="مركز التقارير A4">
        </div>
        <div class="phone-caption">مركز تقارير A4 الرسمية</div>
      </div>
    </div>
  </div>

  <div class="page-break"></div>

  <!-- ========================================================================= -->
  <!-- APPENDIX: BEST PRACTICES -->
  <!-- ========================================================================= -->
  <div>
    <h1 class="section-header">💡 الملحق: الوصايا الذهبية لضمان سلامة العمل اليومي</h1>

    <p style="font-size: 10pt; margin-bottom: 15px;">
      لضمان أعلى درجات الانضباط المالي والمخزني في المحل، احرص وفريق عملك على تطبيق القواعد التشغيلية التالية:
    </p>

    <div class="steps-container">
      <div class="step-card" style="border-right-color: #059669;">
        <div class="step-title">1. الصفرية اليومية وتصفير الميزان:</div>
        <div class="step-desc">تأكد دائماً من ضبط وزن العبوة الفارغة (الطرود) قبل البدء بوزن الصنف للزبون لضمان احتساب الوزن الصافي الدقيق.</div>
      </div>

      <div class="step-card" style="border-right-color: #2563eb;">
        <div class="step-title">2. التوثيق اللحظي للمشتريات والمردودات:</div>
        <div class="step-desc">لا تؤجل تسجيل أي فاتورة توريد أو مردود بضاعة؛ تسجيلها في وقتها يحافظ على دقة متوسط تكلفة الصنف وأرباحك الحقيقية.</div>
      </div>

      <div class="step-card" style="border-right-color: #d97706;">
        <div class="step-title">3. مطابقة الصندوق في نهاية كل وردية عمل:</div>
        <div class="step-desc">استخدم أداة مطابقة نقدية الدرج يومياً قبل إغلاق المحل؛ هذا يمنع تراكم العجز ويكشف أي خطأ كاشير في نفس اليوم.</div>
      </div>

      <div class="step-card" style="border-right-color: #dc2626;">
        <div class="step-title">4. فرز وتوثيق التوالف صباح كل يوم:</div>
        <div class="step-desc">سجل الخضار التالف في شاشة التوالف فور إعدامه؛ هذا يحمي مخزونك من العجز غير المبرر ويثبت خسائر الهدر في الدفاتر.</div>
      </div>

      <div class="step-card" style="border-right-color: #7c3aed;">
        <div class="step-title">5. أخذ نسخة احتياطية دورية للبيانات:</div>
        <div class="step-desc">من شاشة الإعدادات، اضغط على «تصدير نسخة احتياطية كاملة (JSON)» واحفظ الملف في بريدك أو ذاكرة خارجية لحماية بياناتك من أي طارئ.</div>
      </div>
    </div>

    <div style="margin-top: 40px; padding: 20px; border: 2px solid #cbd5e1; border-radius: 12px; text-align: center; background: #f8fafc;">
      <h3 style="font-size: 13pt; font-weight: 800; color: #0f172a; margin-bottom: 6px;">تم إعداد واعتماد هذا الدليل التشغيلي لنقاط البيع</h3>
      <p style="font-size: 9.5pt; color: #64748b; margin-bottom: 0;">
        مرجع رسمي لتشغيل وتدريب فرق العمل على مبيعات ونقاط بيع ومخزون ومحاسبة الأجهزة الذكية المحمولة.
      </p>
    </div>
  </div>

</body>
</html>`;

async function generatePDF() {
  console.log('Generating PDF from HTML template...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setContent(htmlContent, { waitUntil: 'load' });

  console.log('Rendering PDF to:', OUTPUT_PDF);
  await page.pdf({
    path: OUTPUT_PDF,
    format: 'A4',
    printBackground: true,
    margin: {
      top: '14mm',
      right: '12mm',
      bottom: '14mm',
      left: '12mm'
    }
  });

  await browser.close();
  console.log('PDF generated successfully at:', OUTPUT_PDF);
}

generatePDF().catch(err => {
  console.error('Error generating PDF:', err);
  process.exit(1);
});
