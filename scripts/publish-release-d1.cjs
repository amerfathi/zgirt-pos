const https = require('node:https');
const fs = require('node:fs');

const MINIMUM_SUPPORTED_VERSION = '2.2.0';

function requestJson(url, token, body) {
  return new Promise((resolve, reject) => {
    const request = https.request(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }, response => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { raw += chunk; });
      response.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          if (response.statusCode < 200 || response.statusCode >= 300 || parsed.success === false)
            return reject(new Error('Cloudflare D1 release publication failed'));
          resolve(parsed);
        } catch { reject(new Error('Cloudflare returned an invalid release publication response')); }
      });
    });
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
}

async function publishRelease({ platform, version, asset, manifestPath }) {
  if (!['windows', 'android'].includes(platform) || !/^\d+\.\d+\.\d+$/.test(version || ''))
    throw new Error('Invalid platform or version');
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const databaseId = process.env.CLOUDFLARE_D1_DATABASE_ID;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !databaseId || !token) throw new Error('Cloudflare release publication secrets are missing');
  const stat = await fs.promises.stat(asset);
  const fileName = platform === 'windows' ? 'KhodarPOS-Setup.exe' : 'Brraka-Android.apk';
  const downloadUrl = `https://github.com/amerfathi/khodar-pos/releases/download/v${version}/${fileName}`;
  let signedManifest = null;
  if (platform === 'windows') {
    signedManifest = JSON.parse(await fs.promises.readFile(manifestPath, 'utf8'));
    if (signedManifest.version !== version || signedManifest.url !== downloadUrl || signedManifest.size !== stat.size)
      throw new Error('Signed Windows manifest does not match the release asset');
  }
  const sql = `INSERT INTO app_releases
    (id, platform, version, minimum_version, status, update_type, release_notes, download_url, file_size_bytes, signed_manifest, published_at)
    VALUES (?, ?, ?, ?, 'published', 'recommended', ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET version=excluded.version, minimum_version=excluded.minimum_version,
      status='published', update_type=excluded.update_type, release_notes=excluded.release_notes,
      download_url=excluded.download_url, file_size_bytes=excluded.file_size_bytes,
      signed_manifest=excluded.signed_manifest, published_at=datetime('now')`;
  await requestJson(`https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`, token, {
    sql,
    params: [`rel-${platform}-${version.replaceAll('.', '-')}`, platform, version, MINIMUM_SUPPORTED_VERSION,
      JSON.stringify([`BRAKA ${version}`]), downloadUrl, stat.size,
      signedManifest ? JSON.stringify(signedManifest) : null],
  });
}

if (require.main === module) {
  const [platform, version, asset, manifestPath] = process.argv.slice(2);
  publishRelease({ platform, version, asset, manifestPath })
    .then(() => console.log(`Published ${platform} ${version} metadata to D1.`))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { publishRelease };
