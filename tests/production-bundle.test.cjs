const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { validateCompatibilityInputs } = require('../scripts/build-production-server.cjs');
test('production compatibility refuses silently stale server overrides', () => {
  assert.equal(typeof validateCompatibilityInputs, 'function', 'compatibility drift validation is missing');
  const root = path.resolve(__dirname, '..');
  validateCompatibilityInputs(root);
  assert.throws(() => validateCompatibilityInputs(root, () => 'changed source'), /changed|drift|compatibility/i);
});
