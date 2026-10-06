import assert from 'node:assert/strict';
import test from 'node:test';
import { displayInvoiceNumber } from '../src/services/invoiceIdentity.js';

test('offline invoice references preserve the complete UUID and differ at the same local sequence', () => {
  const invoice = { id: '000001-386c2d5a-3d67-4029-85a7-2856210b3b51', invoiceNumber: 1 };
  const reference=displayInvoiceNumber(invoice);
  const suffix=reference.split('-')[1];
  assert.ok(suffix, 'same local number must have a unique stable suffix');
  const decoded=[...suffix].reduce((value,char)=>value*36n+BigInt(parseInt(char,36)),0n).toString(16).padStart(32,'0');
  assert.equal(decoded,invoice.id.slice(7).replaceAll('-',''));
  assert.notEqual(reference,displayInvoiceNumber({...invoice,id:'000001-386c2d5a-3d67-4029-85a7-2856210b3b52'}));
  assert.equal(displayInvoiceNumber(JSON.parse(JSON.stringify(invoice))),reference);
  assert.equal(invoice.id, '000001-386c2d5a-3d67-4029-85a7-2856210b3b51');
});

test('legacy invoices without a display number retain their original id', () => {
  assert.equal(displayInvoiceNumber({ id: 'OLD-42' }), 'OLD-42');
  assert.equal(displayInvoiceNumber({ id: 'OLD-42', invoiceNumber: 0 }), 'OLD-42');
});
