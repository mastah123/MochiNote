/* db.js — IndexedDB wrapper (notes + folders). Falls back to in-memory storage if IndexedDB is
   unavailable (e.g. some private modes) and reports that honestly via NotesDB.isPersistent(). */
const NotesDB = (function () {
  'use strict';
  const DB_NAME = 'little-notes', VERSION = 1, STORES = ['notes', 'folders'];
  let db = null, memory = false;
  const mem = { notes: new Map(), folders: new Map() };

  function open() {
    return new Promise(resolve => {
      const fail = () => { memory = true; db = null; resolve(false); };
      if (typeof indexedDB === 'undefined') return fail();
      let req;
      try { req = indexedDB.open(DB_NAME, VERSION); } catch (e) { return fail(); }
      req.onupgradeneeded = () => {
        const d = req.result;
        STORES.forEach(s => { if (!d.objectStoreNames.contains(s)) d.createObjectStore(s, { keyPath: 'id' }); });
      };
      req.onsuccess = () => { db = req.result; db.onversionchange = () => db.close(); resolve(true); };
      req.onerror = req.onblocked = fail;
    });
  }

  // Run fn(stores) in one transaction; resolves when the transaction has committed.
  function tx(names, mode, fn) {
    return new Promise((resolve, reject) => {
      let t;
      try { t = db.transaction(names, 'readwrite' === mode ? 'readwrite' : 'readonly'); } catch (e) { return reject(e); }
      let result;
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Transaction aborted'));
      const stores = {};
      names.forEach(n => { stores[n] = t.objectStore(n); });
      try { result = fn(stores, t); } catch (e) { try { t.abort(); } catch (_) {} reject(e); }
    });
  }
  const reqValue = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  async function getAll(store) {
    if (memory) return Array.from(mem[store].values()).map(v => JSON.parse(JSON.stringify(v)));
    const out = [];
    await tx([store], 'readonly', s => {
      s[store].openCursor().onsuccess = e => { const c = e.target.result; if (c) { out.push(c.value); c.continue(); } };
    });
    return out;
  }
  async function put(store, obj) {
    if (memory) { mem[store].set(obj.id, JSON.parse(JSON.stringify(obj))); return; }
    await tx([store], 'readwrite', s => { s[store].put(obj); });
  }
  async function putMany(store, arr) {
    if (!arr.length) return;
    if (memory) { arr.forEach(o => mem[store].set(o.id, JSON.parse(JSON.stringify(o)))); return; }
    await tx([store], 'readwrite', s => { arr.forEach(o => s[store].put(o)); });
  }
  async function remove(store, id) {
    if (memory) { mem[store].delete(id); return; }
    await tx([store], 'readwrite', s => { s[store].delete(id); });
  }
  async function removeMany(store, ids) {
    if (memory) { ids.forEach(id => mem[store].delete(id)); return; }
    await tx([store], 'readwrite', s => { ids.forEach(id => s[store].delete(id)); });
  }
  // Atomically replace everything (used by "Restore backup").
  async function replaceAll(data) {
    if (memory) {
      mem.notes = new Map(data.notes.map(o => [o.id, o]));
      mem.folders = new Map(data.folders.map(o => [o.id, o]));
      return;
    }
    await tx(STORES, 'readwrite', s => {
      s.notes.clear(); s.folders.clear();
      data.notes.forEach(o => s.notes.put(o));
      data.folders.forEach(o => s.folders.put(o));
    });
  }

  async function estimate() {
    try { if (navigator.storage && navigator.storage.estimate) return await navigator.storage.estimate(); } catch (_) {}
    return null;
  }
  async function requestPersist() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (navigator.storage.persisted && await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (_) {}
    return false;
  }

  return { open, getAll, put, putMany, remove, removeMany, replaceAll, estimate, requestPersist, isPersistent: () => !memory };
})();
