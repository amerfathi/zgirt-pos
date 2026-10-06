const MIGRATION_REQUIRED = 'السجل المحلي القديم يتطلب ترحيلًا متحققًا قبل استخدام الحفظ الدائم';

export async function acquireWithCheckedLegacyMigration({
  store, durable, createLegacyStore, fetchPage, fetchBranches, locks = globalThis.navigator?.locks
}) {
  try {
    return await store.acquire(locks, durable);
  } catch (error) {
    if (!durable || error?.message !== MIGRATION_REQUIRED) throw error;
    if (typeof createLegacyStore !== 'function' || typeof fetchPage !== 'function' || typeof fetchBranches !== 'function')
      throw new Error('خدمة الترحيل المتحقق غير مكتملة؛ لم تُفتح العمليات المالية');
    const legacy = createLegacyStore();
    try {
      const acquired = await legacy.acquire(locks);
      if (!acquired) throw new Error('هذا الحساب مفتوح في نافذة أخرى. أغلقها ثم أعد فتح هذه النافذة للحفظ.');
      await legacy.adoptCloudCheckedAggregate(durable, fetchPage, fetchBranches);
    } finally {
      await legacy.close();
    }
    return store.acquire(locks, durable);
  }
}
