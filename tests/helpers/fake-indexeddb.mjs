// Faux IndexedDB en memoire pour Node (aucune installation).
// Reproduit ce dont dependent les garanties d'atomicite de storage.js :
//  - les transactions « readwrite » qui touchent les memes stores sont SERIALISEES (comme entre deux onglets) ;
//  - une transaction se termine seule quand plus aucune requete n'est en attente ;
//  - abort() (ou une exception dans un gestionnaire) annule toutes les ecritures de la transaction.
export function installFakeIndexedDB() {
  const stores = {};
  const active = new Set();
  const waiting = [];
  const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
  const conflicts = (a, b) => (a.mode === 'readwrite' || b.mode === 'readwrite') && a.names.some(n => b.names.includes(n));

  function pump() {
    for (let i = 0; i < waiting.length;) {
      const tx = waiting[i];
      const blocked = [...active].some(o => conflicts(o, tx)) || waiting.slice(0, i).some(o => conflicts(o, tx));
      if (blocked) { i++; continue; }
      waiting.splice(i, 1);
      active.add(tx);
      tx.started = true;
      tx.queue.splice(0).forEach(job => job());
      maybeComplete(tx);
    }
  }
  function maybeComplete(tx) {
    if (tx.pending > 0 || tx.done) return;
    setTimeout(() => { if (tx.pending === 0 && !tx.done) finish(tx); }, 0);
  }
  function finish(tx) {
    tx.done = true;
    active.delete(tx);
    tx.oncomplete && tx.oncomplete();
    pump();
  }
  function abortTx(tx, error) {
    if (tx.done) return;
    tx.done = true;
    tx.error = error || null;
    tx.undo.reverse().forEach(undo => undo());
    active.delete(tx);
    setTimeout(() => { tx.onabort && tx.onabort(); }, 0);
    pump();
  }

  const db = {
    objectStoreNames: { contains: n => n in stores },
    createObjectStore(name, { keyPath }) { stores[name] = { keyPath, rows: new Map() }; return { createIndex() {} }; },
    transaction(names, mode = 'readonly') {
      const list = Array.isArray(names) ? names : [names];
      const tx = {
        names: list, mode, started: false, done: false, pending: 0, queue: [], undo: [], error: null,
        abort() {
          if (tx.done) throw new Error('InvalidStateError : transaction terminee.');
          abortTx(tx, null);
        },
        objectStore(name) {
          if (!list.includes(name)) throw new Error(`NotFoundError : ${name} hors transaction.`);
          const st = stores[name];
          const key = r => JSON.stringify(st.keyPath.map(k => r[k]));
          const req = fn => {
            const r = {};
            tx.pending++;
            const job = () => setTimeout(() => {
              if (tx.done) return;
              try { r.result = fn(); } catch (error) { abortTx(tx, error); return; }
              try { r.onsuccess && r.onsuccess(); } catch (error) { abortTx(tx, error); return; }
              tx.pending--;
              maybeComplete(tx);
            }, 0);
            if (tx.started) job(); else tx.queue.push(job);
            return r;
          };
          const write = (k, value) => {
            if (mode !== 'readwrite') throw new Error('ReadOnlyError');
            const had = st.rows.has(k);
            const old = st.rows.get(k);
            tx.undo.push(() => { if (had) st.rows.set(k, old); else st.rows.delete(k); });
            if (value === undefined) st.rows.delete(k); else st.rows.set(k, value);
          };
          return {
            get: k => req(() => clone(st.rows.get(JSON.stringify(k)))),
            put: v => req(() => { write(key(v), clone(v)); }),
            add: v => req(() => { if (st.rows.has(key(v))) throw new Error('ConstraintError'); write(key(v), clone(v)); }),
            delete: k => req(() => { write(JSON.stringify(k), undefined); }),
            index: () => ({
              getAll: range => req(() => [...st.rows.values()].filter(r => r.profileId === range.v).map(clone)),
              openCursor: range => {
                const keys = [...st.rows.entries()].filter(([, v]) => v.profileId === range.v).map(([k]) => k);
                let i = 0;
                const r = {};
                tx.pending++;
                const step = () => setTimeout(() => {
                  if (tx.done) return;
                  r.result = i < keys.length ? { delete() { write(keys[i], undefined); }, continue() { i++; step(); } } : null;
                  try { r.onsuccess && r.onsuccess(); } catch (error) { abortTx(tx, error); return; }
                  if (r.result === null) { tx.pending--; maybeComplete(tx); }
                }, 0);
                if (tx.started) step(); else tx.queue.push(step);
                return r;
              }
            })
          };
        }
      };
      waiting.push(tx);
      pump();
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
