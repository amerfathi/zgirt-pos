import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getConflictKeysForEvent,
  buildConflictPreconditions,
  verifyCausalPreconditions
} from '../packages/core/src/index.js';

test('Causal Sync Engine: Concurrent Offline Modification & Conflict Detection', async (t) => {
  // Device A and Device B both start from initial server state (cursor heads empty)
  const initialServerHeads = {
    'domain:inventory': 'event-init-0',
    'customer:cust-001': 'event-init-0'
  };

  // Device A performs a sale to customer cust-001 while online
  const eventFromDeviceA = {
    id: 'evt-devA-101',
    entityType: 'sales_invoice',
    entityId: 'inv-101',
    payload: {
      customerId: 'cust-001',
      totalCents: 5000
    }
  };

  const packagedEventA = buildConflictPreconditions(eventFromDeviceA, initialServerHeads);
  
  // Verify Device A event against current server
  const serverVerifyA = verifyCausalPreconditions(packagedEventA, initialServerHeads);
  assert.equal(serverVerifyA.accepted, true, 'Device A event should be accepted');

  // Server commits Device A and advances its conflict heads
  const advancedServerHeads = {
    ...initialServerHeads,
    'domain:inventory': 'evt-devA-101',
    'domain:liquidity': 'evt-devA-101',
    'customer:cust-001': 'evt-devA-101'
  };

  // Device B was offline during Device A's sale and now attempts to submit a concurrent sale
  // Device B still holds initialServerHeads!
  const eventFromDeviceB = {
    id: 'evt-devB-202',
    entityType: 'sales_invoice',
    entityId: 'inv-202',
    payload: {
      customerId: 'cust-001',
      totalCents: 8000
    }
  };

  const packagedEventB = buildConflictPreconditions(eventFromDeviceB, initialServerHeads);

  // When Device B reconnects and submits against the server which now has advancedServerHeads
  const serverVerifyB = verifyCausalPreconditions(packagedEventB, advancedServerHeads);
  
  assert.equal(serverVerifyB.accepted, false, 'Stale concurrent event from Device B must NOT silently overwrite');
  assert.equal(serverVerifyB.reason, 'CAUSAL_CONFLICT_DETECTED');
  assert.equal(serverVerifyB.clientExpected, 'event-init-0');
  assert.equal(serverVerifyB.serverHead, 'evt-devA-101');
});
