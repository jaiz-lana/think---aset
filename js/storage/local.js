/**
 * Adapter Penyimpanan Lokal (tanpa akun).
 * Data di IndexedDB; file (termasuk logo) di object store 'files' sebagai Blob.
 *
 * Catatan batching (perbaikan wajib i):
 *  - IndexedDB adalah API lokal yang O(1) — 1 put per operasi log tidak menambah
 *    latensi jaringan, jadi log ditulis langsung tanpa antrean batch.
 *  - Untuk penghematan transaksi, log ditulis di transaksi tersendiri yang
 *    sangat murah. Tidak ada request jaringan sama sekali.
 */
import {
  StorageAdapter, TABLES, SCHEMAS, ID_KEY
} from './adapter.js';
import { uuid } from '../utils/uuid.js';
import { config as GLOBAL_CONFIG } from '../config.js';

const DB_NAME = 'thinkaset';
const DB_VERSION = 1;

export class LocalAdapter extends StorageAdapter {
  constructor(config) {
    super(config);
    this.mode = 'local';
    this.role = 'owner'; // di penyimpanan lokal, pengguna selalu pemilik data
    this.db = null;
    this.user = { email: 'lokal@pengguna', name: 'Pengguna Lokal', picture: '' };
  }

  async init() {
    this.db = await this._openDB();
    try { localStorage.setItem(GLOBAL_CONFIG.LS.MODE, 'local'); } catch {}
  }

  canWrite() { return true; }
  isOwner()  { return true; }

  _openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        for (const t of TABLES) {
          if (!db.objectStoreNames.contains(t)) {
            const keyPath = ID_KEY[t] || 'id';
            db.createObjectStore(t, { keyPath });
          }
        }
        if (!db.objectStoreNames.contains('files')) {
          db.createObjectStore('files', { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('Basis data diblokir tab lain. Tutup tab Think Aset lain lalu coba lagi.'));
    });
  }

  _tx(tabel, mode = 'readonly') {
    const tx = this.db.transaction(tabel, mode);
    return { tx, store: tx.objectStore(tabel) };
  }

  // =========================================================
  // CRUD
  // =========================================================
  async list(tabel, filter = null) {
    const { store } = this._tx(tabel);
    const data = await reqToPromise(store.getAll());
    if (!filter) return data;
    return data.filter(o =>
      Object.entries(filter).every(([k, v]) => String(o[k]) === String(v))
    );
  }

  async get(tabel, id) {
    const { store } = this._tx(tabel);
    const row = await reqToPromise(store.get(id));
    return row || null;
  }

  async create(tabel, data) {
    // settings — upsert by key
    if (tabel === 'settings') {
      if (!data.key) throw new Error('settings butuh key');
      const row = { key: data.key, value: String(data.value ?? '') };
      const { store, tx } = this._tx('settings', 'readwrite');
      store.put(row);
      await txDone(tx);
      return row;
    }

    // activity_log — append only
    if (tabel === 'activity_log') {
      const row = {
        id: data.id || uuid(),
        user: data.user || this.user.email,
        aksi: data.aksi || '',
        objek: data.objek || '',
        waktu: data.waktu || new Date().toISOString()
      };
      const { store, tx } = this._tx('activity_log', 'readwrite');
      store.put(row);
      await txDone(tx);
      return row;
    }

    // tabel biasa
    const key = ID_KEY[tabel] || 'id';
    const now = new Date().toISOString();
    const row = {
      ...data,
      [key]: data[key] || uuid(),
      version: 1,
      created_at: data.created_at || now,
      updated_at: now,
      updated_by: this.user.email
    };
    const { store, tx } = this._tx(tabel, 'readwrite');
    store.put(row);
    await txDone(tx);
    await this._logActivity('create', `${tabel}:${row[key]}`);
    return row;
  }

  async update(tabel, id, data) {
    if (tabel === 'settings') {
      const row = { key: id, value: String(data.value ?? '') };
      const { store, tx } = this._tx('settings', 'readwrite');
      store.put(row);
      await txDone(tx);
      return row;
    }
    if (tabel === 'activity_log') {
      throw new Error('activity_log bersifat append-only');
    }

    const key = ID_KEY[tabel] || 'id';
    const { store, tx } = this._tx(tabel, 'readwrite');
    let merged;
    let failure = null;
    const updated = new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(merged);
      tx.onabort = () => reject(failure || tx.error || new Error('Pembaruan data dibatalkan'));
      const request = store.get(id);
      request.onsuccess = () => {
        const existing = request.result;
        if (!existing) {
          failure = new Error('Data tidak ditemukan');
          tx.abort();
          return;
        }
        if (data.version != null && Number(data.version) !== Number(existing.version || 1)) {
          failure = new Error('CONFLICT');
          failure.code = 'CONFLICT';
          failure.serverRow = existing;
          failure.clientRow = data;
          tx.abort();
          return;
        }

        const now = new Date().toISOString();
        merged = {
          ...existing,
          ...data,
          [key]: id,
          version: Number(existing.version || 1) + 1,
          created_at: existing.created_at,
          updated_at: now,
          updated_by: this.user.email
        };
        store.put(merged);
      };
      request.onerror = () => {
        failure = request.error || new Error('Gagal membaca data');
      };
    });
    await updated;
    await this._logActivity('update', `${tabel}:${id}`);
    return merged;
  }

  async remove(tabel, id) {
    if (tabel === 'activity_log') {
      throw new Error('activity_log bersifat append-only');
    }
    const { store, tx } = this._tx(tabel, 'readwrite');
    store.delete(id);
    await txDone(tx);
    if (tabel !== 'settings') {
      await this._logActivity('delete', `${tabel}:${id}`);
    }
  }

  // =========================================================
  // FILES
  // =========================================================
  async uploadFile(file) {
    const id = uuid();
    const { store, tx } = this._tx('files', 'readwrite');
    store.put({
      id,
      name: file.name,
      type: file.type,
      size: file.size,
      blob: file,
      created_at: Date.now()
    });
    await txDone(tx);
    return { id, url: await this.getFileUrl(id) };
  }

  async getFileUrl(id) {
    const { store } = this._tx('files');
    const rec = await reqToPromise(store.get(id));
    if (!rec) return '';
    return URL.createObjectURL(rec.blob);
  }

  // =========================================================
  // ANGGOTA
  // =========================================================
  async shareWith() {
    throw new Error('Mode lokal tidak mendukung berbagi online. Gunakan Backup/Restore file JSON.');
  }

  async listMembers() {
    return [{ email: this.user.email, name: this.user.name, role: 'owner' }];
  }

  // =========================================================
  // LOG
  // =========================================================
  async _logActivity(aksi, objek) {
    try {
      const row = {
        id: uuid(),
        user: this.user.email,
        aksi,
        objek,
        waktu: new Date().toISOString()
      };
      const { store, tx } = this._tx('activity_log', 'readwrite');
      store.put(row);
      await txDone(tx);
    } catch (e) {
      console.warn('Log aktivitas gagal:', e);
    }
  }

  // =========================================================
  // BACKUP / RESTORE
  // =========================================================
  async exportAll() {
    const dump = {
      app: 'think-aset',
      version: DB_VERSION,
      exported_at: new Date().toISOString(),
      tables: {}
    };
    for (const t of TABLES) dump.tables[t] = await this.list(t);
    // Sertakan daftar file (tanpa blob) agar terlihat isinya
    const filesStore = this._tx('files');
    const files = await reqToPromise(filesStore.store.getAll());
    dump.files_meta = files.map(f => ({ id: f.id, name: f.name, type: f.type, size: f.size }));
    return dump;
  }

  async importAll(dump) {
    if (!dump || dump.app !== 'think-aset' ||
        !dump.tables || typeof dump.tables !== 'object' || Array.isArray(dump.tables)) {
      throw new Error('Format backup tidak valid');
    }

    for (const t of TABLES) {
      const rows = dump.tables[t];
      if (!Array.isArray(rows)) {
        throw new Error(`Format backup tidak valid: tabel "${t}" tidak tersedia`);
      }
      const key = ID_KEY[t] || 'id';
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        if (!row || typeof row !== 'object' || Array.isArray(row) ||
            row[key] == null || String(row[key]).trim() === '') {
          throw new Error(`Format backup tidak valid: baris ${i + 1} pada "${t}" tidak memiliki ${key}`);
        }
      }
    }

    const tx = this.db.transaction(TABLES, 'readwrite');
    const done = txDone(tx);
    try {
      for (const t of TABLES) {
        const store = tx.objectStore(t);
        store.clear();
        for (const row of dump.tables[t]) store.put(row);
      }
    } catch (e) {
      tx.abort();
      await done.catch(() => {});
      throw e;
    }
    await done;
  }

  async downloadBackup() {
    const dump = await this.exportAll();
    const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `think-aset-backup-${Date.now()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async signOut() {
    // Mode lokal: tidak ada sesi untuk dihapus. Data tetap tersimpan.
    return;
  }
}

// --- Utilitas IndexedDB ---
function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}