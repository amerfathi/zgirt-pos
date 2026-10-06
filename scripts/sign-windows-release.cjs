const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { validateDownloadUrl } = require('../electron/update-security.cjs');

async function signWindowsRelease({ version, installer, privateKeyPath, publicKeyPath,
  privateKeyPassphrase = process.env.BRRAKA_RELEASE_PRIVATE_KEY_PASSPHRASE }) {
  if (!/^\d+\.\d+\.\d+$/.test(version || '')) throw new Error('Invalid release version');
  if (!installer || !privateKeyPath || !publicKeyPath) throw new Error('Installer and signing key paths are required');
  const url = `https://github.com/amerfathi/khodar-pos/releases/download/v${version}/KhodarPOS-Setup.exe`;
  validateDownloadUrl(url);
  const stat = await fs.promises.stat(installer);
  if (!stat.isFile() || stat.size < 1 || stat.size > 512 * 1024 * 1024) throw new Error('Invalid installer size');
  const privateKey = crypto.createPrivateKey({
    key: await fs.promises.readFile(privateKeyPath),
    passphrase: privateKeyPassphrase || undefined
  });
  const publicKey = crypto.createPublicKey(await fs.promises.readFile(publicKeyPath));
  if (privateKey.asymmetricKeyType !== 'ed25519' || publicKey.asymmetricKeyType !== 'ed25519')
    throw new Error('Ed25519 signing keys are required');
  const derived = crypto.createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
  const pinned = publicKey.export({ type: 'spki', format: 'der' });
  if (!crypto.timingSafeEqual(derived, pinned)) throw new Error('Private key does not match pinned public key');
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(installer)) hash.update(chunk);
  const manifest = { version, url, sha256: hash.digest('hex'), size: stat.size };
  return { ...manifest, signature: crypto.sign(null, Buffer.from(JSON.stringify(manifest)), privateKey).toString('base64') };
}

if (require.main === module) {
  const [version, installer, output] = process.argv.slice(2);
  const privateKeyPath = process.env.BRRAKA_RELEASE_PRIVATE_KEY_FILE;
  const publicKeyPath = path.join(__dirname, '..', 'electron', 'release-public-key.pem');
  if (!output) { console.error('Usage: npm run release:sign-windows -- <version> <installer> <manifest.json>'); process.exitCode = 2; }
  else signWindowsRelease({ version, installer, privateKeyPath, publicKeyPath })
    .then(manifest => fs.promises.writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, { flag: 'wx', mode: 0o600 }))
    .catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { signWindowsRelease };
