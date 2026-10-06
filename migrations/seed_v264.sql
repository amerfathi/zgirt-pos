-- Insert v2.6.4 release records - fix auto-update installer issues
INSERT OR REPLACE INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, published_at) VALUES (
  'rel-win-2-6-4',
  'windows',
  '2.6.4',
  '2.2.0',
  'published',
  'recommended',
  '["Fix: No CMD window during update installation","Fix: Cannot close app error - app now exits before installer starts","Fix: Crash in InvoicesHistory and ReportsCenterView"]',
  'https://github.com/amerfathi/khodar-pos/releases/download/v2.6.4/KhodarPOS-Setup.exe',
  133955791,
  '2026-09-21T16:00:00Z'
);

INSERT OR REPLACE INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, published_at) VALUES (
  'rel-and-2-6-4',
  'android',
  '2.6.4',
  '2.2.0',
  'published',
  'recommended',
  '["Fix: Crash in InvoicesHistory and ReportsCenterView","Full two-way sync Desktop to Web","App auto-updates from cloud"]',
  'https://github.com/amerfathi/khodar-pos/releases/download/v2.6.4/KhodarPOS.apk',
  5577618,
  '2026-09-21T16:00:00Z'
);

INSERT OR REPLACE INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, published_at) VALUES (
  'rel-web-2-6-4',
  'web',
  '2.6.4',
  '2.2.0',
  'published',
  'recommended',
  '["Fix: Crash in InvoicesHistory and ReportsCenterView","Fix: Desktop to Web sync now works both ways","Performance improvements"]',
  'https://khodar-pos.pages.dev',
  980000,
  '2026-09-21T16:00:00Z'
);
