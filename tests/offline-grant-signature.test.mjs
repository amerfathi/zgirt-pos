import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as signer from '../functions/_lib/offlineGrantSignature.js';
import { verifySignedOfflineGrant, assertVerifiedOfflineGrant } from '../src/services/verifiedOfflineGrant.js';

test('a server-issued grant verifies for its cashier but an altered grant does not',async()=>{
  assert.equal(typeof signer.issueSignedOfflineGrant,'function');
  const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const privateJwk=await crypto.subtle.exportKey('jwk',keys.privateKey);
  const publicJwk=await crypto.subtle.exportKey('jwk',keys.publicKey);
  const claims={tenantId:'tenant-a',cashierId:'cashier-a',deviceId:'device-a',branchIds:['branch-a'],onlineVerifiedAt:'2026-10-01T08:00:00Z'};
  const envelope=await signer.issueSignedOfflineGrant(privateJwk,claims);
  const handle=await verifySignedOfflineGrant(envelope,publicJwk);
  assert.equal(assertVerifiedOfflineGrant(handle,{tenantId:'tenant-a',cashierId:'cashier-a',deviceId:'device-a',branchId:'branch-a'},'2026-10-01T09:00:00Z'),true);
  await assert.rejects(verifySignedOfflineGrant({...envelope,claims:{...claims,cashierId:'other'}},publicJwk),/توقيع/);
});
