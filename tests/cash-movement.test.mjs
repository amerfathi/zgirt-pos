import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cashMovementFromRecord } from '../src/services/cashMovement.js';

test('cash movement matches each current financial record type without counting bank or debt', () => {
  const fixtures=[
    ['invoice',{saleType:'cash',paidAmount:30},30],
    ['invoice',{saleType:'split',cashAmount:12,bankAmount:8,creditAmount:10},12],
    ['invoice',{saleType:'bank',paidAmount:30},0],
    ['customer_payment',{amount:7,method:'cash'},7],
    ['customer_payment',{amount:7,method:'bank'},0],
    ['expense',{amount:5,paymentMethod:'cash'},-5],
    ['expense',{amount:5,paymentMethod:'bank'},0],
    ['expense',{amount:5,paymentMethod:'cash',isSupplierPayment:true},0],
    ['purchase',{paidCashAmount:9,paidBankAmount:3,totalCost:15,creditAmount:3},-9],
    ['supplier_payment',{amount:4,paymentMethod:'cash'},-4],
    ['worker_transaction',{type:'advance',amount:2,paymentMethod:'cash'},-2],
    ['worker_transaction',{type:'salary_payment',amount:11,paymentMethod:'cash'},-11],
    ['partner_drawing',{amount:3,method:'cash'},-3],
    ['profit_distribution',{shares:[{method:'cash',netPayout:4},{method:'bank',netPayout:6}]},-4],
    ['sales_return',{refundMethod:'cash',totalRefundAmount:8},-8],
    ['purchase_return',{refundMethod:'cash',totalRefundAmount:6},6]
  ];
  for(const [type,record,expected] of fixtures)
    assert.equal(cashMovementFromRecord(type,record),expected,`${type}: ${JSON.stringify(record)}`);
});

test('invalid money never becomes a zero cash movement', () => {
  assert.throws(()=>cashMovementFromRecord('invoice',{saleType:'cash',paidAmount:'bad'}),/مبلغ/);
  assert.throws(()=>cashMovementFromRecord('expense',{amount:-10,paymentMethod:'cash'}),/مبلغ/);
  assert.throws(()=>cashMovementFromRecord('purchase',{paidCashAmount:1.234}),/مبلغ/);
});
