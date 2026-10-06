import { withoutCredentials } from './tenantStorage.js';

const DB_NAME = 'braka_durable_aggregates_v1';
const STORE_NAME = 'aggregates';
const MIGRATION_SOURCE_SUFFIX = ':pre-durable-v1';
const migrationSourceKey = key => `${key}${MIGRATION_SOURCE_SUFFIX}`;

// The caller must wait for commit() before reporting a saved business action.
// One record contains business state, outbox, applied IDs and sync cursor.
export class DurableAggregate {
  constructor(indexedDb = globalThis.indexedDB, name = DB_NAME) {
    if (!indexedDb) throw new Error('المتصفح لا يدعم قاعدة الحفظ الدائم المطلوبة');
    this.indexedDb = indexedDb;
    this.name = name;
  }

  async open() {
    if (this.db) return this.db;
    const db = await new Promise((resolve, reject) => {
      const request = this.indexedDb.open(this.name, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('قاعدة الحفظ مفتوحة بإصدار آخر'));
    });
    db.onversionchange = () => { db.close(); if (this.db === db) this.db = null; };
    this.db = db;
    return db;
  }

  async read(key) {
    if (!key) throw new Error('هوية الحفظ غير صالحة');
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const request = tx.objectStore(STORE_NAME).get(key);
      let value = null;
      request.onsuccess = () => { value = request.result ?? null; };
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error || new Error('تعذر قراءة السجل الدائم'));
      tx.onabort = () => reject(tx.error || new Error('أُلغيت قراءة السجل الدائم'));
    });
  }

  // Preserve the exact compatibility record before allowing an administrator
  // to continue with the already committed IndexedDB aggregate.
  async archiveCache(key, raw, expectedRevision) {
    if (!key || typeof raw !== 'string' || !Number.isSafeInteger(expectedRevision))
      throw new Error('طلب أرشفة النسخة المحلية غير صالح');
    const archiveKey = `${key}:recovery-cache:${crypto.randomUUID()}`;
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let conflict = null;
      const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
      if (tx.durability !== 'strict') {
        tx.abort();
        reject(new Error('المتصفح لم يؤكد الحفظ الصارم لنسخة الاسترداد'));
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result?.revision !== expectedRevision) {
          conflict = new Error('تغير السجل الدائم أثناء الاسترداد؛ أعد المحاولة');
          tx.abort();
          return;
        }
        store.add({ kind: 'compatibility-cache-recovery', sourceKey: key, raw, createdAt: Date.now() }, archiveKey);
      };
      tx.oncomplete = () => resolve(archiveKey);
      tx.onerror = () => reject(conflict || tx.error || new Error('تعذر أرشفة النسخة المحلية'));
      tx.onabort = () => reject(conflict || tx.error || new Error('أُلغيت أرشفة النسخة المحلية'));
    });
  }

  // For forensic recovery, preserve the exact sanitized starting aggregate
  // independently of the compatibility cache and later durable revisions.
  readMigrationSource(key) { return this.read(migrationSourceKey(key)); }

  async commit(key, snapshot, expectedRevision) {
    if (!key || key.endsWith(MIGRATION_SOURCE_SUFFIX) || !snapshot || !Number.isSafeInteger(snapshot.revision) ||
        snapshot.revision !== (expectedRevision ?? -1) + 1)
      throw new Error('مراجعة السجل الدائم غير صالحة');
    const next = withoutCredentials(structuredClone(snapshot));
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let conflict = null;
      const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
      if (tx.durability !== 'strict') {
        tx.abort();
        reject(new Error('المتصفح لم يؤكد نمط الحفظ الصارم'));
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        const found = request.result?.revision ?? null;
        if (found !== expectedRevision) {
          conflict = new Error('تغير السجل الدائم من عملية أخرى؛ أعد فتح التطبيق');
          tx.abort();
          return;
        }
        store.put(next, key);
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(conflict || tx.error || new Error('تعذر الحفظ الدائم'));
      tx.onabort = () => reject(conflict || tx.error || new Error('أُلغي الحفظ الدائم'));
    });
  }

  // One strict IndexedDB transaction for a user's financial aggregate and a
  // device/drawer journal. No caller may report either record committed alone.
  async commitBatch(entries) {
    if (!Array.isArray(entries) || entries.length < 2 ||
        new Set(entries.map(entry => entry?.key)).size !== entries.length ||
        entries.some(entry => !entry || typeof entry.key !== 'string' || !entry.key ||
          entry.key.endsWith(MIGRATION_SOURCE_SUFFIX) || !entry.snapshot ||
          !(entry.expectedRevision === null ||
            (Number.isSafeInteger(entry.expectedRevision) && entry.expectedRevision >= 0)) ||
          !Number.isSafeInteger(entry.snapshot.revision) ||
          entry.snapshot.revision !== (entry.expectedRevision ?? -1) + 1))
      throw new Error('مراجعات السجلات الدائمة المشتركة غير صالحة');
    const next = entries.map(entry => ({ ...entry, snapshot: withoutCredentials(structuredClone(entry.snapshot)) }));
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let conflict = null;
      const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
      if (tx.durability !== 'strict') {
        tx.abort();
        reject(new Error('المتصفح لم يؤكد نمط الحفظ الصارم'));
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      let checked = 0;
      for (const entry of next) {
        const request = store.get(entry.key);
        request.onsuccess = () => {
          if ((request.result?.revision ?? null) !== entry.expectedRevision) {
            conflict = new Error('تغير السجل الدائم من عملية أخرى؛ أعد فتح التطبيق');
            tx.abort();
            return;
          }
          if (++checked === next.length)
            for (const item of next) store.put(item.snapshot, item.key);
        };
      }
      tx.oncomplete = () => resolve(next.map(entry => entry.snapshot));
      tx.onerror = () => reject(conflict || tx.error || new Error('تعذر الحفظ الدائم المشترك'));
      tx.onabort = () => reject(conflict || tx.error || new Error('أُلغي الحفظ الدائم المشترك'));
    });
  }

  // One-time import of an already validated aggregate. Never overwrite a
  // durable record, and preserve its original revision and pending outbox.
  async adoptIfEmpty(key, snapshot) {
    if (!key || key.endsWith(MIGRATION_SOURCE_SUFFIX) || !snapshot || !Number.isSafeInteger(snapshot.revision) || snapshot.revision < 0)
      throw new Error('السجل المراد ترحيله غير صالح');
    const next = withoutCredentials(structuredClone(snapshot));
    const db = await this.open();
    return new Promise((resolve, reject) => {
      let conflict = null;
      const tx = db.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
      if (tx.durability !== 'strict') {
        tx.abort();
        reject(new Error('المتصفح لم يؤكد نمط الحفظ الصارم'));
        return;
      }
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => {
        if (request.result !== undefined) {
          conflict = new Error('سجل دائم موجود؛ لا يمكن استبداله ببيانات قديمة');
          tx.abort();
          return;
        }
        store.put(next, key);
        store.add(next, migrationSourceKey(key));
      };
      tx.oncomplete = () => resolve(next);
      tx.onerror = () => reject(conflict || tx.error || new Error('تعذر ترحيل السجل الدائم'));
      tx.onabort = () => reject(conflict || tx.error || new Error('أُلغي ترحيل السجل الدائم'));
    });
  }

  close() { this.db?.close(); this.db = null; }
}
