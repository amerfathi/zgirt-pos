INSERT OR REPLACE INTO app_releases (
  id, platform, version, minimum_version, status, update_type, 
  release_notes, download_url, file_size_bytes, sha256, published_at
) VALUES (
  'rel-win-2-6-1',
  'windows',
  '2.6.1',
  '2.2.0',
  'published',
  'recommended',
  '["مركز تقارير استراتيجي بتصميم بطاقات تنفيذية موحدة", "إضافة تقارير الأرباح والهوامش وأعمار الديون والوردية وحساب الموردين", "تحسينات عامة على واجهة وتجربة المستخدم"]',
  'https://github.com/amerfathi/khodar-pos/releases/download/v2.6.1/KhodarPOS-Setup.exe',
  133938953,
  'AEE9CE3F21E3E0725E2FD8AD8B26CBFF1B223CC8C18C7334DD866278BFC3B4DB',
  datetime('now')
);

INSERT OR REPLACE INTO app_releases (
  id, platform, version, minimum_version, status, update_type, 
  release_notes, download_url, file_size_bytes, sha256, published_at
) VALUES (
  'rel-and-2-6-1',
  'android',
  '2.6.1',
  '2.2.0',
  'published',
  'recommended',
  '["مركز تقارير استراتيجي بتصميم بطاقات تنفيذية موحدة", "شاشة ترحيبية انسيابية (Splash Screen) وخطوط آبل الرسمية", "إضافة تقارير الأرباح والهوامش وأعمار الديون والوردية وحساب الموردين"]',
  'https://khodar-pos.pages.dev/downloads/KhodarPOS.apk',
  5577618,
  '748ED0A8BB7AD451A44473B72BFAD0A7B8ED9DA6FD20BE63ED6C3CFA477BF316',
  datetime('now')
);

INSERT OR REPLACE INTO app_releases (
  id, platform, version, minimum_version, status, update_type, 
  release_notes, download_url, file_size_bytes, sha256, published_at
) VALUES (
  'rel-web-2-6-1',
  'web',
  '2.6.1',
  '2.2.0',
  'published',
  'recommended',
  '["مركز تقارير استراتيجي بتصميم بطاقات تنفيذية موحدة", "إضافة تقارير الأرباح والهوامش وأعمار الديون والوردية وحساب الموردين", "تحسينات عامة على واجهة وتجربة المستخدم"]',
  'https://khodar-pos.pages.dev',
  980000,
  NULL,
  datetime('now')
);
