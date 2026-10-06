import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignedBranchIds, canAccessBranch, visibleBranches, visibleBranchRecords } from '../src/services/branchAccess.js';

const branches = Object.freeze([
  { id: 'one', tenantId: 'A', name: 'One' },
  { id: 'two', tenantId: 'A', name: 'Two' },
  { id: 'three', tenantId: 'A', name: 'Three' }
]);
const invoices = Object.freeze([
  { id: 'i1', branchId: 'one', amount: 10 },
  { id: 'i2', branchId: 'two', amount: 20 },
  { id: 'i3', branchId: 'three', amount: 30 },
  { id: 'legacy', amount: 40 }
]);

test('single-branch staff sees only assigned branch and never sees unscoped legacy money', () => {
  const staff = { isStaff: true, branchIds: ['one'], permissions: {} };
  assert.deepEqual(assignedBranchIds(staff), ['one']);
  assert.deepEqual(visibleBranches(staff, branches).map(row => row.id), ['one']);
  assert.deepEqual(visibleBranchRecords(staff, 'one', invoices).map(row => row.id), ['i1']);
  assert.deepEqual(visibleBranchRecords(staff, 'two', invoices), []);
  assert.deepEqual(visibleBranchRecords(staff, 'all', invoices), []);
});

test('multi-branch staff aggregates only explicit grants and only with separate aggregate permission', () => {
  const staff = { isStaff: true, branchIds: ['one', 'two'], permissions: {} };
  assert.deepEqual(visibleBranches(staff, branches).map(row => row.id), ['one', 'two']);
  assert.deepEqual(visibleBranchRecords(staff, 'one', invoices).map(row => row.id), ['i1']);
  assert.equal(canAccessBranch(staff, 'all'), false);
  assert.deepEqual(visibleBranchRecords(staff, 'all', invoices), []);
  const permitted = { ...staff, permissions: { canViewAllBranches: true } };
  assert.equal(canAccessBranch(permitted, 'all'), true);
  assert.deepEqual(visibleBranchRecords(permitted, 'all', invoices).map(row => row.id), ['i1', 'i2']);
});

test('company owner can choose one branch or a clearly separate all-branch view', () => {
  const owner = { role: 'company_owner', isStaff: false, branchIds: ['all'] };
  assert.deepEqual(visibleBranchRecords(owner, 'two', invoices).map(row => row.id), ['i2']);
  assert.deepEqual(visibleBranchRecords(owner, 'all', invoices).map(row => row.id), ['i1', 'i2', 'i3']);
});
test('offline owner is restricted to signed active branch IDs, never implied global scope',()=>{
  const user={role:'company_owner',type:'tenant',tenantId:'A',isOfflineSession:true,branchIds:['b1']};
  assert.equal(canAccessBranch(user,'b1'),true);
  assert.equal(canAccessBranch(user,'b2'),false);
  assert.equal(canAccessBranch(user,'all'),false);
});
