const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repository = 'amerfathi/khodar-pos';
const alias = 'brraka-upload';
const [outputDirectory, confirmation] = process.argv.slice(2);

function fail(message) { throw new Error(message); }
function run(program, args, options = {}) {
  const result = spawnSync(program, args, { encoding: 'utf8', windowsHide: true, ...options });
  if (result.status !== 0) fail(`${path.basename(program)} failed without publishing secret values`);
  return result.stdout || '';
}
function secret(name, value) {
  run('gh', ['secret', 'set', name, '--repo', repository], { input: value, stdio: ['pipe', 'pipe', 'pipe'] });
}
function fingerprintPublicKey(publicKey) {
  return crypto.createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
}

try {
  if (!outputDirectory || confirmation !== '--confirm-production')
    fail('Usage: node scripts/provision-release-identities.cjs <private-output-directory> --confirm-production');
  const root = path.resolve(__dirname, '..');
  const privateRoot = path.resolve(outputDirectory);
  if (privateRoot === root || privateRoot.startsWith(`${root}${path.sep}`)) fail('Private recovery directory must be outside the repository');
  fs.mkdirSync(privateRoot, { recursive: true });
  const keystore = path.join(privateRoot, 'brraka-android-upload.p12');
  const privatePem = path.join(privateRoot, 'brraka-windows-updater-private.pem');
  const recoveryBlob = path.join(privateRoot, 'release-credentials.dpapi.txt');
  const publicPem = path.join(root, 'electron', 'release-public-key.pem');
  // A failed run before the DPAPI recovery blob and secret uploads leaves
  // unusable random material. It is safe to replace only that exact incomplete set.
  if (!fs.existsSync(recoveryBlob) && [keystore, privatePem, publicPem].some(file => fs.existsSync(file))) {
    for (const file of [keystore, privatePem, publicPem]) fs.rmSync(file, { force: true });
  }
  for (const file of [keystore, privatePem, recoveryBlob, publicPem]) if (fs.existsSync(file)) fail(`Refusing to overwrite ${file}`);

  const keytoolCandidates = [
    process.env.BRRAKA_KEYTOOL,
    'C:\\Program Files\\Android\\Android Studio\\jbr\\bin\\keytool.exe',
  ].filter(Boolean);
  const keytool = keytoolCandidates.find(candidate => fs.existsSync(candidate));
  if (!keytool) fail('Android keytool was not found');

  const storePassword = crypto.randomBytes(32).toString('base64url');
  const keyPassword = storePassword; // PKCS12 requires the key and store password to match on modern keytool.
  const updaterPassphrase = crypto.randomBytes(32).toString('base64url');
  run(keytool, ['-genkeypair', '-keystore', keystore, '-storetype', 'PKCS12', '-storepass', storePassword,
    '-keypass', keyPassword, '-alias', alias, '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000',
    '-dname', 'CN=BRAKA, OU=Release, O=BRAKA, L=Riyadh, ST=Riyadh, C=SA']);

  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  fs.writeFileSync(privatePem, privateKey.export({ type: 'pkcs8', format: 'pem', cipher: 'aes-256-cbc', passphrase: updaterPassphrase }), { flag: 'wx', mode: 0o600 });
  fs.writeFileSync(publicPem, publicKey.export({ type: 'spki', format: 'pem' }), { flag: 'wx' });

  const recovery = JSON.stringify({ android: { alias, storePassword, keyPassword }, windows: { updaterPassphrase } });
  const protectedValue = run('pwsh', ['-NoProfile', '-NonInteractive', '-Command',
    '$plain=[Console]::In.ReadToEnd();$secure=ConvertTo-SecureString -String $plain -AsPlainText -Force;ConvertFrom-SecureString -SecureString $secure'],
    { input: recovery, stdio: ['pipe', 'pipe', 'pipe'] }).trim();
  fs.writeFileSync(recoveryBlob, protectedValue, { flag: 'wx', mode: 0o600 });

  secret('ANDROID_KEYSTORE_BASE64', fs.readFileSync(keystore).toString('base64'));
  secret('ANDROID_KEYSTORE_PASSWORD', storePassword);
  secret('ANDROID_KEY_ALIAS', alias);
  secret('ANDROID_KEY_PASSWORD', keyPassword);
  secret('BRRAKA_RELEASE_PRIVATE_KEY_PEM', fs.readFileSync(privatePem, 'utf8'));
  secret('BRRAKA_RELEASE_PRIVATE_KEY_PASSPHRASE', updaterPassphrase);

  const androidCertificate = run(keytool, ['-exportcert', '-rfc', '-keystore', keystore, '-storepass', storePassword, '-alias', alias]);
  const androidFingerprint = crypto.createHash('sha256').update(crypto.X509Certificate
    ? new crypto.X509Certificate(androidCertificate).raw
    : Buffer.from(androidCertificate.replace(/-----(BEGIN|END) CERTIFICATE-----|\s/g, ''), 'base64')).digest('hex');
  console.log(`Android signing certificate SHA-256: ${androidFingerprint}`);
  console.log(`Windows updater public key SHA-256: ${fingerprintPublicKey(publicKey)}`);
  console.log(`Encrypted recovery material stored outside the repository: ${privateRoot}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
