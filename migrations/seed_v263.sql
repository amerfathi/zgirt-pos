-- Insert v2.6.3 release records for all platforms
-- Run: npx wrangler d1 execute khodar_pos_production --file=migrations/seed_v263.sql --remote

INSERT OR REPLACE INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, published_at) VALUES (
  'rel-win-2-6-3',
  'windows',
  '2.6.3',
  '2.2.0',
  'published',
  'recommended',
  '["Fix crash in InvoicesHistory and ReportsCenterView","Fix two-way sync Desktop to Web in 4 seconds","Fix sync cursor bug for cross-device updates"]',
  'https://github.com/amerfathi/khodar-pos/releases/download/v2.6.3/KhodarPOS-Setup.exe',
  133955791,
  '2026-09-21T00:00:00Z'
);

INSERT OR REPLACE INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, published_at) VALUES (
  'rel-and-2-6-3',
  'android',
  '2.6.3',
  '2.2.0',
  'published',
  'recommended',
  '["Fix crash in InvoicesHistory and ReportsCenterView","App updates automatically from cloud on every open","Full two-way sync fix"]',
  'https://github.com/amerfathi/khodar-pos/releases/download/v2.6.3/KhodarPOS.apk',
  5577618,
  '2026-09-21T00:00:00Z'
);

INSERT OR REPLACE INTO app_releases (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, published_at) VALUES (
  'rel-web-2-6-3',
  'web',
  '2.6.3',
  '2.2.0',
  'published',
  'recommended',
  '["Fix crash in InvoicesHistory and ReportsCenterView","Fix two-way sync Desktop to Web","Performance and stability improvements"]',
  'https://khodar-pos.pages.dev',
  980000,
  '2026-09-21T00:00:00Z'
);
