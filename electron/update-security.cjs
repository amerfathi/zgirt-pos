const crypto = require('node:crypto');
const fs = require('node:fs');

function validateDownloadUrl(value, redirect = false) {
  const url = new URL(value);
  const allowed = redirect ? ['github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com'] : ['github.com'];
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname) || url.username || url.password || url.port) throw new Error('Untrusted update URL');
  if (!redirect && !/^\/amerfathi\/khodar-pos\/releases\/download\/v\d+\.\d+\.\d+\/KhodarPOS-Setup\.exe$/.test(url.pathname)) throw new Error('Invalid release asset');
  return url;
}
function compare(a,b) {
  const x=a.split('.').map(Number), y=b.split('.').map(Number);
  for(let i=0;i<3;i++) if(x[i]!==y[i]) return x[i]>y[i]?1:-1;
  return 0;
}
function verifyManifest(manifest, publicKey, currentVersion) {
  if (!manifest || !/^\d+\.\d+\.\d+$/.test(manifest.version) || compare(manifest.version,currentVersion)<=0 ||
      !/^[a-f0-9]{64}$/.test(manifest.sha256) || !Number.isSafeInteger(manifest.size) || manifest.size<1 || manifest.size>512*1024*1024) throw new Error('Invalid update manifest');
  const url = validateDownloadUrl(manifest.url);
  if (!url.pathname.includes(`/v${manifest.version}/`)) throw new Error('Version mismatch');
  const key = crypto.createPublicKey(publicKey);
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Invalid signing key');
  const signed = Buffer.from(JSON.stringify({version:manifest.version,url:manifest.url,sha256:manifest.sha256,size:manifest.size}));
  if (!crypto.verify(null,signed,key,Buffer.from(manifest.signature || '', 'base64'))) throw new Error('Invalid release signature');
  return Object.freeze({ ...manifest });
}
async function verifyFile(file, manifest) {
  const stat = await fs.promises.stat(file);
  if (stat.size !== manifest.size) throw new Error('Update size mismatch');
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  if (hash.digest('hex') !== manifest.sha256) throw new Error('Update checksum mismatch');
}
module.exports = { validateDownloadUrl, verifyManifest, verifyFile };
