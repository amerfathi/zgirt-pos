// Durable, device-scoped storage for the enrolled offline cashier grant and the
// device identity. The backend is injectable: the application uses IndexedDB,
// while unit tests use an in-memory map. Records are keyed by tenant, cashier,
// and device so one account on several devices cannot reuse another device's
// grant and logout/revocation can clear one tenant's records.

const DB_NAME = 'braka_offline_grants_v1';
const STORE_NAME = 'records';
const DEVICE_IDENTITY_KEY = 'braka:offline_device_identity_v1';

export function memoryBackend() {
  const items = new Map();
  return {
    async get(key) { return items.has(key) ? structuredClone(items.get(key)) : null; },
    async set(key, value) { items.set(key, structuredClone(value)); },
    async putIfAbsent(key,value) {
      if(!items.has(key))items.set(key,structuredClone(value));
      return structuredClone(items.get(key));
    },
    async delete(key) { items.delete(key); },
    async clear() { items.clear(); }
  };
}

export function indexedDbBackend(indexedDb = globalThis.indexedDB, name = DB_NAME) {
  if (!indexedDb) throw new Error('المتصفح لا يدعم قاعدة الحفظ الدائم المطلوبة');
  let dbPromise = null;
  const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
    const request = indexedDb.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE_NAME);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('قاعدة حفظ التصاريح مفتوحة بإصدار آخر'));
  }));
  const run = (mode, fn) => open().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const request = fn(tx.objectStore(STORE_NAME));
    let value;
    request.onsuccess = () => { value = request.result; };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error || new Error('تعذر الوصول لتخزين التصاريح'));
    tx.onabort = () => reject(tx.error || new Error('أُلغي الوصول لتخزين التصاريح'));
  }));
  return {
    get: key => run('readonly', store => store.get(key)),
    set: (key, value) => run('readwrite', store => store.put(value, key)),
    delete: key => run('readwrite', store => store.delete(key)),
    clear: () => run('readwrite', store => store.clear()),
    putIfAbsent: (key,candidate) => open().then(db => new Promise((resolve,reject) => {
      // Reading and creation share one readwrite transaction across windows.
      // Resolve only after commit; never enroll a device that was not saved.
      const tx=db.transaction(STORE_NAME,'readwrite',{durability:'strict'});
      const records=tx.objectStore(STORE_NAME),request=records.get(key);
      let value;
      request.onsuccess=()=>{
        value=request.result;
        if(value===undefined){value=candidate;records.add(candidate,key);}
      };
      tx.oncomplete=()=>resolve(value);
      tx.onerror=()=>reject(tx.error||new Error('تعذر تثبيت هوية الجهاز'));
      tx.onabort=()=>reject(tx.error||new Error('أُلغي تثبيت هوية الجهاز'));
    }))
  };
}

export function offlineGrantRecordKey({ tenantId, cashierId, deviceId }) {
  if (![tenantId, cashierId, deviceId].every(value => typeof value === 'string' && value))
    throw new Error('هوية التصريح غير صالحة');
  return `braka:offline_grant:${tenantId}:${cashierId}:${deviceId}`;
}

export class OfflineGrantStore {
  constructor(backend) {
    if (!backend || typeof backend.get !== 'function' || typeof backend.set !== 'function' ||
        typeof backend.delete !== 'function')
      throw new Error('تخزين التصاريح غير متاح');
    this.backend = backend;
  }

  async saveRecord(scope, record) { await this.backend.set(offlineGrantRecordKey(scope), structuredClone(record)); }
  async loadRecord(scope) { return this.backend.get(offlineGrantRecordKey(scope)); }
  async clearRecord(scope) { await this.backend.delete(offlineGrantRecordKey(scope)); }
  async saveDeviceIdentity(identity) { await this.backend.set(DEVICE_IDENTITY_KEY, structuredClone(identity)); }
  async loadDeviceIdentity() { return this.backend.get(DEVICE_IDENTITY_KEY); }
  async createDeviceIdentityIfAbsent(identity) {
    if(typeof this.backend.putIfAbsent!=='function')throw new Error('الحفظ الذري لهوية الجهاز غير متاح');
    return this.backend.putIfAbsent(DEVICE_IDENTITY_KEY,structuredClone(identity));
  }
}
