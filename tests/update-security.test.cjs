const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyManifest, verifyFile, validateDownloadUrl } = require('../electron/update-security.cjs');
const { signWindowsRelease } = require('../scripts/sign-windows-release.cjs');
const { verifyReleasePublicKey } = require('../scripts/verify-release-public-key.cjs');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pem = publicKey.export({type:'spki',format:'pem'});
const data = {version:'3.0.0',url:'https://github.com/amerfathi/khodar-pos/releases/download/v3.0.0/KhodarPOS-Setup.exe',sha256:'a'.repeat(64),size:1024};
const signature = crypto.sign(null,Buffer.from(JSON.stringify(data)),privateKey).toString('base64');
test('valid signed release is accepted',()=>assert.equal(verifyManifest({...data,signature},pem,'2.6.4').version,'3.0.0'));
test('modified file hash breaks manifest signature',()=>assert.throws(()=>verifyManifest({...data,sha256:'b'.repeat(64),signature},pem,'2.6.4')));
test('rollback and same-version packages are rejected',()=>assert.throws(()=>verifyManifest({...data,signature},pem,'3.0.0')));
test('arbitrary hosts, credential URLs and insecure redirects are rejected',()=>{
  for(const url of ['http://github.com/a','https://evil.test/file.exe','https://u:p@github.com/a','file:///tmp/file.exe']) assert.throws(()=>validateDownloadUrl(url,true));
});

test('release signing binds the installer to the pinned key, and rejects wrong keys or altered bytes',async()=>{
  const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'braka-release-test-'));
  const installer=path.join(dir,'KhodarPOS-Setup.exe'),privatePath=path.join(dir,'private.pem'),publicPath=path.join(dir,'public.pem');
  try {
    await fs.promises.writeFile(installer,Buffer.from('test installer payload'));
    await fs.promises.writeFile(privatePath,privateKey.export({type:'pkcs8',format:'pem'}));
    await fs.promises.writeFile(publicPath,pem);
    assert.match(verifyReleasePublicKey(publicPath),/^[a-f0-9]{64}$/);
    const manifest=await signWindowsRelease({version:'3.0.0',installer,privateKeyPath:privatePath,publicKeyPath:publicPath});
    assert.equal(verifyManifest(manifest,pem,'2.6.4').version,'3.0.0');
    await verifyFile(installer,manifest);
    await fs.promises.writeFile(installer,Buffer.from('tampered installer payload'));
    await assert.rejects(verifyFile(installer,manifest));
    const different=crypto.generateKeyPairSync('ed25519').publicKey.export({type:'spki',format:'pem'});
    await fs.promises.writeFile(publicPath,different);
    await assert.rejects(signWindowsRelease({version:'3.0.0',installer,privateKeyPath:privatePath,publicKeyPath:publicPath}),/does not match/);
    await fs.promises.unlink(publicPath);
    assert.throws(()=>verifyReleasePublicKey(publicPath));
  } finally { await fs.promises.rm(dir,{recursive:true,force:true}); }
});

test('release signing accepts an encrypted production private key only with its passphrase',async()=>{
  const dir=await fs.promises.mkdtemp(path.join(os.tmpdir(),'braka-encrypted-release-test-'));
  const installer=path.join(dir,'KhodarPOS-Setup.exe'),privatePath=path.join(dir,'private.pem'),publicPath=path.join(dir,'public.pem');
  const passphrase=crypto.randomBytes(24).toString('base64url');
  try {
    await fs.promises.writeFile(installer,Buffer.from('encrypted signing payload'));
    await fs.promises.writeFile(privatePath,privateKey.export({type:'pkcs8',format:'pem',cipher:'aes-256-cbc',passphrase}));
    await fs.promises.writeFile(publicPath,pem);
    await assert.rejects(signWindowsRelease({version:'3.0.0',installer,privateKeyPath:privatePath,publicKeyPath:publicPath}));
    const manifest=await signWindowsRelease({version:'3.0.0',installer,privateKeyPath:privatePath,publicKeyPath:publicPath,privateKeyPassphrase:passphrase});
    assert.equal(verifyManifest(manifest,pem,'2.6.4').version,'3.0.0');
  } finally { await fs.promises.rm(dir,{recursive:true,force:true}); }
});
