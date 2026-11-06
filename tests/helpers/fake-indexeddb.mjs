// Faux IndexedDB en memoire pour Node (aucune installation) : juste ce que storage.js utilise.
export function installFakeIndexedDB() {
  const stores = {};
  const db = {
    objectStoreNames: { contains: n => n in stores },
    createObjectStore(name, { keyPath }) { stores[name] = { keyPath, rows: new Map() }; return { createIndex() {} }; },
    transaction() {
      const tx = {
        objectStore(name) {
          const st = stores[name];
          const key = r => JSON.stringify(st.keyPath.map(k => r[k]));
          const req = fn => { const r = {}; setTimeout(() => { r.result = fn(); r.onsuccess && r.onsuccess(); }, 0); return r; };
          return {
            get: k => req(() => { const v = st.rows.get(JSON.stringify(k)); return v === undefined ? v : JSON.parse(JSON.stringify(v)); }),
            put: v => req(() => { st.rows.set(key(v), JSON.parse(JSON.stringify(v))); }),
            delete: k => req(() => { st.rows.delete(JSON.stringify(k)); }),
            index: () => ({ getAll: range => req(() => [...st.rows.values()].filter(r => r.profileId === range.v).map(r => JSON.parse(JSON.stringify(r)))) })
          };
        }
      };
      setTimeout(() => setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 0), 0);
      return tx;
    }
  };
  globalThis.IDBKeyRange = { only: v => ({ v }) };
  globalThis.indexedDB = {
    open() {
      const request = {};
      setTimeout(() => {
        request.result = db;
        request.onupgradeneeded && request.onupgradeneeded();
        request.onsuccess && request.onsuccess();
      }, 0);
      return request;
    }
  };
  return { stores };
}
