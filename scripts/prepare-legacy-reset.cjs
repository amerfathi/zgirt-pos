const crypto = require('node:crypto');
const fs = require('node:fs');

function prepareLegacyReset({tenantId,principalType,principalId}) {
  const validId=value=>typeof value==='string' && /^[A-Za-z0-9:_-]{1,128}$/.test(value);
  if(!validId(tenantId)||!validId(principalId)||!['tenant','user'].includes(principalType))
    throw new Error('Valid tenant, principal type and principal ID are required');
  if(principalType==='tenant'&&principalId!==tenantId) throw new Error('Tenant principal must match tenant ID');
  const token=crypto.randomBytes(32).toString('hex');
  const hash=crypto.createHash('sha256').update(token).digest('hex');
  const source=principalType==='tenant'
    ? `FROM tenants WHERE id='${tenantId}'`
    : `FROM users WHERE id='${principalId}' AND tenant_id='${tenantId}'`;
  const sql=`INSERT INTO password_reset_tokens (token_hash,tenant_id,principal_id,principal_type,expires_at,created_by)\n`+
    `SELECT '${hash}','${tenantId}','${principalId}','${principalType}',datetime('now','+15 minutes'),'trusted_d1_operator' ${source};\n`;
  return { token, sql };
}

if(require.main===module) {
  const [tenantId,principalType,principalId,sqlOutput]=process.argv.slice(2);
  if(!sqlOutput||!process.stdout.isTTY) {
    console.error('Run in a private interactive terminal: node scripts/prepare-legacy-reset.cjs <tenantId> <tenant|user> <principalId> <sqlOutput>');
    process.exitCode=2;
  } else {
    try {
      const {token,sql}=prepareLegacyReset({tenantId,principalType,principalId});
      fs.writeFileSync(sqlOutput,sql,{flag:'wx',mode:0o600});
      console.log('Execute the SQL file against the trusted D1 database, verify one row inserted, then deliver this one-use 15-minute token directly to the verified account owner:');
      console.log(token);
      console.log('Never paste the token, old password, or database export into chat or CI logs.');
    } catch(error) { console.error(error.message);process.exitCode=1; }
  }
}

module.exports={prepareLegacyReset};
