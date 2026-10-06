import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../src/services/offlineShiftGrantPolicy.js';

const verifiedAt = '2026-10-01T08:00:00.000Z';
const claims = { tenantId:'tenant-a', cashierId:'cashier-b', deviceId:'device-1',
  branchIds:['branch-1'], onlineVerifiedAt:verifiedAt };
const context = { tenantId:'tenant-a', cashierId:'cashier-b', deviceId:'device-1', branchId:'branch-1' };

test('offline shift grant lasts less than 24 hours from online verification', () => {
  assert.equal(typeof policy.assertOfflineShiftGrant,'function');
  assert.doesNotThrow(() => policy.assertOfflineShiftGrant(claims, context, '2026-10-02T07:59:59.999Z'));
  assert.throws(() => policy.assertOfflineShiftGrant(claims, context, '2026-10-02T08:00:00.000Z'),/انتهت/);
});

test('offline shift grant cannot cross cashier, device, tenant, or branch', () => {
  assert.equal(typeof policy.assertOfflineShiftGrant,'function');
  for (const [field,value] of [['cashierId','other'],['deviceId','other'],['tenantId','other'],['branchId','other']])
    assert.throws(() => policy.assertOfflineShiftGrant(claims,{...context,[field]:value},'2026-10-01T09:00:00.000Z'),/تصريح/);
  assert.throws(() => policy.assertOfflineShiftGrant(null,context,'2026-10-01T09:00:00.000Z'),/تحقق.*الإنترنت/);
});
