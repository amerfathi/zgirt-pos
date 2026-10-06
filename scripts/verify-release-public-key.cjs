const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function verifyReleasePublicKey(file) {
  const key = crypto.createPublicKey(fs.readFileSync(file));
  if (key.asymmetricKeyType !== 'ed25519') throw new Error('Pinned release key must be Ed25519');
  return crypto.createHash('sha256').update(key.export({ type: 'spki', format: 'der' })).digest('hex');
}

if (require.main === module) {
  try {
    const fingerprint = verifyReleasePublicKey(path.join(__dirname, '..', 'electron', 'release-public-key.pem'));
    console.log(`Pinned release public key fingerprint: ${fingerprint}`);
  } catch (error) {
    console.error(`Windows release build blocked: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyReleasePublicKey };
