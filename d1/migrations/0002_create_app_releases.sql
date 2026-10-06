-- Migration 0002: App Releases & Multi-Platform Update Management
CREATE TABLE IF NOT EXISTS app_releases (
    id TEXT PRIMARY KEY,
    platform TEXT NOT NULL,          -- 'web', 'windows', 'android', 'ios'
    version TEXT NOT NULL,           -- '2.4.0'
    minimum_version TEXT NOT NULL,   -- '2.2.0'
    status TEXT NOT NULL DEFAULT 'published', -- 'published', 'draft', 'deprecated'
    update_type TEXT NOT NULL DEFAULT 'recommended', -- 'optional', 'recommended', 'required'
    release_notes TEXT NOT NULL,     -- JSON array of strings
    download_url TEXT,
    file_size_bytes INTEGER DEFAULT 0,
    sha256 TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    published_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_releases_platform ON app_releases(platform, published_at DESC);

-- Releases are intentionally not seeded. A production release must be created
-- only after its artifact and signed manifest have been verified.
