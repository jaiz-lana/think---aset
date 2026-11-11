import {
  StorageAdapter, TABLES, SCHEMAS, ID_KEY, buildAssetHistory
} from './adapter.js';
import { uuid } from '../utils/uuid.js';
import { config as GLOBAL_CONFIG, ssIdKey, folderIdKey } from '../config.js';

const API = {
  SHEETS:   'https://sheets.googleapis.com/v4/spreadsheets',
  DRIVE:    'https://www.googleapis.com/drive/v3',
  UPLOAD:   'https://www.googleapis.com/upload/drive/v3/files',
  USERINFO: 'https://www.googleapis.com/oauth2/v3/userinfo',
  CALENDAR: 'https://www.googleapis.com/calendar/v3'
};

const LOG_BATCH_SIZE = 20;
const LOG_BATCH_DELAY = 2000;
const LOG_QUEUE_MAX = 100;

export function extractSpreadsheetId(input) {
  if (!input) return null;
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed;
  return null;
}

export class GoogleAdapter extends StorageAdapter {
  constructor(config) {
    super(config);
    this.mode = 'google';
    this.token = null;
    this.tokenExpiry = 0;
    this.spreadsheetId = null;
    this.folderId = null;
    this._sheetIds = {};
    this._cache = {};       // tabel -> { headers[], rows[], needHeaderFix }
    this._logQueue = [];
    this._logTimer = null;
    this._isFlushing = false;
    this._roleDetected = false;
    this.calendarReady = false;
  }

  // =========================================================
  // INIT
  // =========================================================
  async init(opts = {}) {
    await this._loadScripts();
    await this._restoreOrSignIn(opts);
    await this._loadUserInfo();

    const mode = opts.mode || 'auto';

    if (opts.spreadsheetId) {
      this.spreadsheetId = opts.spreadsheetId;
      this.folderId = null;
      this._saveWorkspaceIds(null);
      await this._detectRole();
      await this._preloadSheetIds();
      await this._loadAllTables();
      if (this.canWrite()) await this._ensureHeaders();
    } else if (mode === 'join') {
      await this._joinWorkspace();
      await this._detectRole();
      await this._preloadSheetIds();
      await this._loadAllTables();
      if (this.canWrite()) await this._ensureHeaders();
    } else {
      await this._ensureWorkspace(mode);
      await this._detectRole();
      await this._preloadSheetIds();
      await this._loadAllTables();
      if (this.canWrite()) await this._ensureHeaders();
    }

    this._bindVisibilityFlush();
  }

  async _loadScripts() {
    if (!window.google?.accounts?.oauth2) {
      await loadScript('https://accounts.google.com/gsi/client');
    }
  }

  async _ensurePicker() {
    if (window.google?.picker) return;
    if (!window.gapi) {
      await loadScript('https://apis.google.com/js/api.js');
    }
    await new Promise((resolve, reject) => {
      gapi.load('picker', { callback: resolve, onerror: reject });
    });
  }

  async _restoreOrSignIn(opts) {
    if (opts.prompt === 'select_account') {
      await this._signIn('select_account');
      return;
    }
    const tok = sessionStorage.getItem(GLOBAL_CONFIG.SS.TOKEN);
    const exp = Number(sessionStorage.getItem(GLOBAL_CONFIG.SS.TOKEN_EXP) || 0);
    if (tok && Date.now() < exp - 30_000) {
      this.token = tok;
      this.tokenExpiry = exp;
      return;
    }
    await this._signIn(opts.prompt || 'select_account');
  }

  _signIn(prompt = 'consent', scope = this.config.SCOPES) {
    return new Promise((resolve, reject) => {
      if (!this.config.GOOGLE_CLIENT_ID) {
        return reject(new Error('Koneksi Google belum disiapkan oleh pengelola aplikasi.'));
      }
      const client = google.accounts.oauth2.initTokenClient({
        client_id: this.config.GOOGLE_CLIENT_ID,
        scope,
        prompt,
        error_callback: (err) => reject(new Error('Login Google dibatalkan atau diblokir browser: ' + (err?.type || 'tidak diketahui'))),
        callback: (resp) => {
          if (resp.error) return reject(new Error('Login Google: ' + resp.error));
          this.token = resp.access_token;
          this.tokenExpiry = Date.now() + (Number(resp.expires_in) || 3600) * 1000;
          try {
            sessionStorage.setItem(GLOBAL_CONFIG.SS.TOKEN, this.token);
            sessionStorage.setItem(GLOBAL_CONFIG.SS.TOKEN_EXP, String(this.tokenExpiry));
          } catch {}
          resolve();
        }
      });
      client.requestAccessToken();
    });
  }

  async requestCalendarAccess() {
    if (this.calendarReady) return;
    const alreadyGranted = sessionStorage.getItem(GLOBAL_CONFIG.SS.CALENDAR_SCOPE) === '1';
    await this._signIn(
      alreadyGranted ? '' : 'consent',
      `${this.config.SCOPES} ${this.config.CALENDAR_SCOPE}`
    );
    this.calendarReady = true;
    try { sessionStorage.setItem(GLOBAL_CONFIG.SS.CALENDAR_SCOPE, '1'); } catch {}
  }

  async syncAgendaToCalendar(agenda) {
    if (!this.canWrite()) throw new Error('Peran workspace Anda hanya dapat melihat data.');
    await this.requestCalendarAccess();
    const start = new Date(agenda.tanggal);
    if (Number.isNaN(start.getTime())) throw new Error('Tanggal agenda tidak valid.');
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const recurrence = { mingguan: 'WEEKLY', bulanan: 'MONTHLY', tahunan: 'YEARLY' }[agenda.berulang];
    const event = {
      summary: agenda.judul,
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      ...(recurrence ? { recurrence: [`RRULE:FREQ=${recurrence}`] } : {})
    };
    const url = `${API.CALENDAR}/calendars/primary/events${agenda.google_event_id ? `/${encodeURIComponent(agenda.google_event_id)}` : ''}`;
    const result = await this._fetch(url, {
      method: agenda.google_event_id ? 'PATCH' : 'POST',
      body: JSON.stringify(event)
    });
    if (!result.id) throw new Error('Google Calendar tidak mengembalikan ID acara.');
    if (result.id !== agenda.google_event_id) {
      try {
        await this.update('agendas', agenda.id, { google_event_id: result.id, version: agenda.version });
      } catch (error) {
        throw new Error(`Agenda terkirim ke Google Calendar, tetapi ID acara gagal disimpan: ${error.message}`);
      }
    }
    return result;
  }

  async _loadUserInfo() {
    try {
      const info = await this._fetch(API.USERINFO);
      this.user = {
        email: info.email,
        name: info.name || info.email,
        picture: info.picture || ''
      };
      try { sessionStorage.setItem(GLOBAL_CONFIG.SS.EMAIL, info.email); } catch {}
    } catch (e) {
      // Fallback offline: pakai email dari sessionStorage bila ada
      const cached = sessionStorage.getItem(GLOBAL_CONFIG.SS.EMAIL);
      if (cached) {
        this.user = { email: cached, name: cached, picture: '' };
      } else {
        throw new Error('Gagal memuat profil Google: ' + e.message);
      }
    }
  }

  // =========================================================
  // WORKSPACE
  // =========================================================
  async _ensureWorkspace(mode) {
    const email = this.user?.email;
    if (!email) throw new Error('Email pengguna tidak tersedia');

    const savedSs = localStorage.getItem(ssIdKey(email));
    const savedFolder = localStorage.getItem(folderIdKey(email));

    if (mode === 'resume') {
      if (!savedSs) {
        throw new Error('Belum ada workspace tersimpan untuk akun ini. Silakan masuk ulang.');
      }
      this.spreadsheetId = savedSs;
      this.folderId = savedFolder || null;
      return;
    }

    // mode === 'auto' — pakai yang ada, buat baru bila tidak ada
    if (savedSs) {
      this.spreadsheetId = savedSs;
      this.folderId = savedFolder || null;
      return;
    }
    await this._createWorkspace();
  }

  async _createWorkspace() {
    // 1) Spreadsheet baru dengan semua tab
    const ss = await this._fetch(API.SHEETS, {
      method: 'POST',
      body: JSON.stringify({
        properties: { title: this.config.SHEET_TITLE },
        sheets: TABLES.map(t => ({ properties: { title: t } }))
      })
    });
    this.spreadsheetId = ss.spreadsheetId;
    this._saveWorkspaceIds(null);

    // 2) Tulis header setiap tab
    const data = TABLES.map(t => ({
      range: `${t}!A1`,
      values: [SCHEMAS[t]]
    }));
    await this._fetch(`${API.SHEETS}/${this.spreadsheetId}/values:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data })
    });

    // 3) Folder lampiran di root Drive
    let folderId = null;
    try {
      const folder = await this._fetch(`${API.DRIVE}/files`, {
        method: 'POST',
        body: JSON.stringify({
          name: this.config.FOLDER_TITLE,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      folderId = folder.id;
    } catch (e) {
      // Folder gagal dibuat (kuota/quota). Lanjutkan tanpa folder; upload nonaktif.
      console.warn('Gagal membuat folder lampiran:', e);
    }
    this.folderId = folderId;

    // 4) Simpan ID per akun (perbaikan wajib d)
    this._saveWorkspaceIds(folderId);
  }

  _saveWorkspaceIds(folderId) {
    const email = this.user?.email;
    if (!email || !this.spreadsheetId) {
      throw new Error('Workspace Google tidak dapat disimpan: identitas atau Spreadsheet ID tidak tersedia.');
    }
    try {
      localStorage.setItem(ssIdKey(email), this.spreadsheetId);
      if (folderId) localStorage.setItem(folderIdKey(email), folderId);
      else localStorage.removeItem(folderIdKey(email));
      localStorage.setItem(GLOBAL_CONFIG.LS.MODE, 'google');
    } catch (e) {
      throw new Error(`Workspace dibuat, tetapi gagal disimpan di browser: ${e.message}`);
    }
  }

  async _joinWorkspace() {
    await this._ensurePicker();
    if (!this.config.GOOGLE_API_KEY) {
      throw new Error('Google Picker belum diaktifkan oleh pengelola aplikasi.');
    }
    if (!this.config.GOOGLE_APP_ID) {
      throw new Error('Google Picker belum diaktifkan oleh pengelola aplikasi.');
    }

    // 1) Pilih Spreadsheet
    const ss = await this._pickSpreadsheet();
    if (!ss) throw new Error('Pemilihan file dibatalkan oleh pengguna');
    this.spreadsheetId = ss.id || ss[google.picker.Document.ID];
    if (!this.spreadsheetId) throw new Error('ID Spreadsheet tidak ditemukan dari file yang dipilih');

    // 2) Simpan per akun dan lanjut
    this._saveWorkspaceIds(null);
  }

  _pickSpreadsheet() {
    return new Promise((resolve, reject) => {
      const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
        .setMimeTypes('application/vnd.google-apps.spreadsheet');
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(this.token)
        .setDeveloperKey(this.config.GOOGLE_API_KEY)
        .setAppId(this.config.GOOGLE_APP_ID)
        .setCallback((data) => {
          console.log('Picker callback data:', data);
          const action = data[google.picker.Response.ACTION] || data.action;
          if (action === google.picker.Action.PICKED) {
            const docs = data[google.picker.Response.DOCUMENTS] || data.docs;
            const pickedDoc = docs && docs[0];
            console.log('File dipilih:', pickedDoc);
            resolve(pickedDoc);
          } else if (action === google.picker.Action.CANCEL) {
            resolve(null);
          } else if (action === google.picker.Action.ERROR) {
            reject(new Error('Google Picker gagal memuat spreadsheet: ' + JSON.stringify(data)));
          }
        })
        .build();
      picker.setVisible(true);
    });
  }

  _pickFolder() {
    return new Promise((resolve, reject) => {
      const view = new google.picker.DocsView(google.picker.ViewId.FOLDERS)
        .setSelectFolderEnabled(true)
        .setIncludeFolders(true);
      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(this.token)
        .setDeveloperKey(this.config.GOOGLE_API_KEY)
        .setAppId(this.config.GOOGLE_APP_ID)
        .setCallback((data) => {
          if (data.action === google.picker.Action.PICKED) resolve(data.docs[0]);
          else if (data.action === google.picker.Action.CANCEL) resolve(null);
          else if (data.action === google.picker.Action.ERROR) reject(new Error('Google Picker gagal memuat folder.'));
        })
        .build();
      picker.setVisible(true);
    });
  }

  async pickFolder() {
    if (!this.canWrite()) throw new Error('Anda tidak memiliki izin memilih folder.');
    if (!this.config.GOOGLE_API_KEY || !this.config.GOOGLE_APP_ID) {
      throw new Error('Google API Key dan App ID diperlukan untuk memilih folder.');
    }
    await this._ensurePicker();
    const folder = await this._pickFolder();
    if (folder?.id) {
      this.folderId = folder.id;
      this._saveWorkspaceIds(folder.id);
    }
    return folder;
  }

  /**
   * Deteksi peran dari capabilities Drive (perbaikan wajib c).
   * Tidak pernah ditimpa jadi 'owner' secara default.
   */
  async _detectRole() {
    if (!this.spreadsheetId) {
      this.role = 'viewer';
      return;
    }
    try {
      const meta = await this._fetch(
        `${API.DRIVE}/files/${this.spreadsheetId}?fields=owners(emailAddress),capabilities(canEdit)`
      );
      const email = this.user?.email;
      if (Array.isArray(meta.owners) && meta.owners.some(o => o.emailAddress === email)) {
        this.role = 'owner';
      } else if (meta.capabilities?.canEdit) {
        this.role = 'editor';
      } else {
        this.role = 'viewer';
      }
      try { localStorage.setItem('ta_role_' + email, this.role); } catch {}
      this._roleDetected = true;
    } catch (e) {
      console.warn('Deteksi peran gagal, akses dibatasi sebagai "viewer":', e.message);
      this.role = 'viewer';
    }
  }

  // =========================================================
  // FETCH dengan retry & refresh token
  // =========================================================
  async _fetch(url, opts = {}, retryCount = 0) {
    if (!this.token || Date.now() >= this.tokenExpiry - 30_000) {
      try {
        await this._signIn('', this.calendarReady
          ? `${this.config.SCOPES} ${this.config.CALENDAR_SCOPE}`
          : this.config.SCOPES);
      } catch (e) {
        throw new Error('Sesi Google berakhir. Silakan login ulang.');
      }
    }

    const headers = {
      ...(opts.headers || {}),
      'Authorization': 'Bearer ' + this.token
    };
    if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

    let res;
    try {
      res = await fetch(url, { ...opts, headers });
    } catch (e) {
      if (retryCount < 2) {
        await new Promise(r => setTimeout(r, 500 * Math.pow(2, retryCount)));
        return this._fetch(url, opts, retryCount + 1);
      }
      throw new Error('Koneksi gagal: ' + e.message);
    }

    // 401 — refresh dan ulang sekali
    if (res.status === 401) {
      try {
        await this._signIn('', this.calendarReady
          ? `${this.config.SCOPES} ${this.config.CALENDAR_SCOPE}`
          : this.config.SCOPES);
      }
      catch { throw new Error('Sesi Google berakhir. Silakan login ulang.'); }
      headers['Authorization'] = 'Bearer ' + this.token;
      res = await fetch(url, { ...opts, headers });
      if (res.status === 401) {
        throw new Error('Sesi Google berakhir. Silakan login ulang.');
      }
    }

    // 403/429 — rate limit, retry bertahap (perbaikan wajib i)
    if ((res.status === 403 || res.status === 429) && retryCount < 3) {
      const body = await res.clone().json().catch(() => ({}));
      const reason = body?.error?.errors?.[0]?.reason || body?.error?.status || '';
      const isRateLimit = res.status === 429 || /rateLimit|quotaExceeded/i.test(reason);
      if (isRateLimit) {
        const wait = Math.min(8000, 1000 * Math.pow(2, retryCount) + Math.random() * 400);
        await new Promise(r => setTimeout(r, wait));
        return this._fetch(url, opts, retryCount + 1);
      }
    }

    if (!res.ok) {
      let msg = '';
      try {
        const body = await res.json();
        msg = body?.error?.message || body?.error?.errors?.[0]?.message || '';
      } catch {}
      throw new Error(`Google API ${res.status}: ${msg || res.statusText || 'gagal'}`);
    }

    if (res.status === 204) return {};
    return res.json();
  }

  // =========================================================
  // MUAT DATA
  // =========================================================
  async _preloadSheetIds() {
    const meta = await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}?fields=sheets.properties`
    );
    this._sheetIds = {};
    for (const s of meta.sheets || []) {
      this._sheetIds[s.properties.title] = s.properties.sheetId;
    }
  }

  async _loadAllTables() {
    try {
      const ranges = TABLES.map(rangeOf);
      const qs = ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
      const res = await this._fetch(`${API.SHEETS}/${this.spreadsheetId}/values:batchGet?${qs}`);
      res.valueRanges.forEach((vr, idx) => {
        const tabel = TABLES[idx];
        const values = vr.values || [];
        const hasHeader = Array.isArray(values[0]) && values[0].length > 0;
        const headers = hasHeader ? values[0].slice() : SCHEMAS[tabel].slice();
        this._cache[tabel] = {
          headers,
          rows: hasHeader ? values.slice(1) : [],
          needHeaderFix: !hasHeader
        };
      });
    } catch (e) {
      console.warn('Batch load gagal, fallback ke per-tabel:', e.message);
      await Promise.all(TABLES.map(t => this._loadTable(t)));
    }
    this._lastLoad = Date.now();
  }

  async _loadTable(tabel) {
    const range = rangeOf(tabel);
    const res = await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(range)}`
    );
    const values = res.values || [];
    const hasHeader = Array.isArray(values[0]) && values[0].length > 0;
    const headers = hasHeader ? values[0].slice() : SCHEMAS[tabel].slice();
    this._cache[tabel] = {
      headers,
      rows: hasHeader ? values.slice(1) : [],
      needHeaderFix: !hasHeader
    };
  }

  async _ensureHeaders() {
    if (!this.canWrite()) return;
    for (const tabel of TABLES) {
      const c = this._cache[tabel];
      if (!c) continue;
      const mismatch = c.headers.join('\u0000') !== SCHEMAS[tabel].join('\u0000');
      const isPrefix = c.headers.every((h, i) => h === SCHEMAS[tabel][i]);
      if (!c.needHeaderFix && mismatch && !isPrefix) {
        console.warn(`Header tabel "${tabel}" tidak cocok dengan skema; tidak ditimpa.`);
        continue;
      }
      if (c.needHeaderFix || mismatch) {
        await this._fetch(
          `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(tabel + '!A1')}?valueInputOption=RAW`,
          { method: 'PUT', body: JSON.stringify({ values: [SCHEMAS[tabel]] }) }
        );
        c.headers = SCHEMAS[tabel].slice();
        c.needHeaderFix = false;
      }
    }
  }

  // =========================================================
  // KONVERSI rows<->object
  // =========================================================
  _toObj(tabel, arr) {
    const { headers } = this._cache[tabel];
    const obj = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]] = arr[i] ?? '';
    }
    return obj;
  }

  _toArr(tabel, obj) {
    const { headers } = this._cache[tabel];
    return headers.map(h => obj[h] ?? '');
  }

  // =========================================================
  // CRUD
  // =========================================================
  async list(tabel, filter = null) {
    if (!this._cache[tabel]) await this._loadTable(tabel);
    const objs = this._cache[tabel].rows.map(r => this._toObj(tabel, r));
    if (!filter) return objs;
    return objs.filter(o =>
      Object.entries(filter).every(([k, v]) => String(o[k]) === String(v))
    );
  }

  async get(tabel, id) {
    const key = ID_KEY[tabel] || 'id';
    const all = await this.list(tabel);
    return all.find(o => o[key] === id) || null;
  }

  async create(tabel, data) {
    // ---------- settings: upsert by key ----------
    if (tabel === 'settings') {
      return this._upsertSetting(data.key, data.value);
    }

    // ---------- activity_log: append tanpa version ----------
    if (tabel === 'activity_log') {
      const row = {
        id: data.id || uuid(),
        user: data.user || this.user?.email || '',
        aksi: data.aksi || '',
        objek: data.objek || '',
        waktu: data.waktu || new Date().toISOString()
      };
      await this._appendRow(tabel, row);
      return row;
    }

    // ---------- tabel biasa (versioned) ----------
    if (!this.canWrite()) throw new Error('Anda tidak memiliki izin menulis');
    const key = ID_KEY[tabel] || 'id';
    const now = new Date().toISOString();
    const row = {
      ...data,
      [key]: data[key] || uuid(),
      version: 1,
      created_at: data.created_at || now,
      updated_at: now,
      updated_by: this.user?.email || ''
    };
    await this._appendRow(tabel, row);
    await this._logActivity('create', `${tabel}:${row[key]}`);
    if (tabel === 'assets') {
      try { await this.createMany('asset_history', buildAssetHistory(null, row, this.user?.email || '')); }
      catch (error) { throw new Error(`Aset tersimpan, tetapi riwayat awal gagal disimpan: ${error.message}`); }
    }
    return row;
  }

  /** Tambah banyak baris sekaligus (1 request per 200 baris). */
  async createMany(tabel, list) {
    if (!this.canWrite()) throw new Error('Anda tidak memiliki izin menulis');
    if (!this._cache[tabel]) await this._loadTable(tabel);
    const now = new Date().toISOString();
    const key = ID_KEY[tabel] || 'id';
    const rows = list.map(d => ({
      ...d,
      [key]: d[key] || uuid(),
      version: 1,
      created_at: now,
      updated_at: now,
      updated_by: this.user?.email || ''
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const arrs = rows.slice(i, i + 200).map(r => this._toArr(tabel, r));
      await this._fetch(
        `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(tabel + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: arrs }) }
      );
      this._cache[tabel].rows.push(...arrs);
    }
    this._logActivity('import', `${tabel}:${rows.length} baris`);
    if (tabel === 'assets') {
      try {
        await this.createMany('asset_history', rows.flatMap(row =>
          buildAssetHistory(null, row, this.user?.email || '')
        ));
      } catch (error) {
        throw new Error(`Aset tersimpan, tetapi riwayat awal impor gagal disimpan: ${error.message}`);
      }
    }
    return rows;
  }

  /** Cari nomor baris (indeks data, mulai 0) berdasarkan id langsung dari server. */
  async _locateRow(tabel, id) {
    const res = await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(tabel + '!A2:A100000')}`
    );
    const idx = (res.values || []).map(r => r[0]).indexOf(id);
    if (idx === -1) throw new Error('Data tidak ditemukan (mungkin sudah dihapus pengguna lain)');
    return idx;
  }

  /** Baca satu baris terbaru dari server. */
  async _readRow(tabel, idx) {
    const n = idx + 2;
    const last = colLetter(this._cache[tabel].headers.length);
    const res = await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(`${tabel}!A${n}:${last}${n}`)}`
    );
    return res.values?.[0] || [];
  }

  _cacheUpsert(tabel, id, arr) {
    const rows = this._cache[tabel].rows;
    const i = rows.findIndex(r => r[0] === id);
    if (i === -1) rows.push(arr); else rows[i] = arr;
  }

  /** Muat ulang seluruh tabel dari server (dibatasi minimal minAgeMs sejak muat terakhir). */
  async refresh(minAgeMs = 30000) {
    if (!this.spreadsheetId) return;
    if (Date.now() - (this._lastLoad || 0) < minAgeMs) return;
    await this._loadAllTables();
  }

  /** Ambil n baris terakhir tanpa memuat seluruh tabel (untuk activity_log). */
  async listRecent(tabel, n = 8) {
    const col = await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(tabel + '!A:A')}`
    );
    const last = (col.values || []).length;
    if (last < 2) return [];
    if (!this._cache[tabel]) await this._loadTable(tabel);
    const from = Math.max(2, last - n + 1);
    const endCol = colLetter(this._cache[tabel].headers.length);
    const res = await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(`${tabel}!A${from}:${endCol}${last}`)}`
    );
    return (res.values || []).map(r => this._toObj(tabel, r));
  }

  async _appendRow(tabel, row) {
    const values = [this._toArr(tabel, row)];
    await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(tabel + '!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values }) }
    );
    this._cache[tabel].rows.push(this._toArr(tabel, row));
  }

  async _upsertSetting(key, value) {
    if (!key) throw new Error('settings butuh key');
    if (!this.canWrite()) throw new Error('Anda tidak memiliki izin menulis');
    if (!this._cache.settings) await this._loadTable('settings');
    const strVal = String(value ?? '');
    let idx = -1;
    try { idx = await this._locateRow('settings', key); } catch { idx = -1; }
    if (idx >= 0) {
      const rowNumber = idx + 2;
      const range = `settings!A${rowNumber}:B${rowNumber}`;
      await this._fetch(
        `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(range)}?valueInputOption=RAW`,
        { method: 'PUT', body: JSON.stringify({ values: [[key, strVal]] }) }
      );
      this._cacheUpsert('settings', key, [key, strVal]);
    } else {
      await this._fetch(
        `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI('settings!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values: [[key, strVal]] }) }
      );
      this._cacheUpsert('settings', key, [key, strVal]);
    }
    return { key, value: strVal };
  }

  async update(tabel, id, data) {
    // settings
    if (tabel === 'settings') {
      return this._upsertSetting(id, data.value);
    }
    // activity_log — tidak boleh di-update; anggap append.
    if (tabel === 'activity_log') {
      throw new Error('activity_log bersifat append-only');
    }
    if (!this.canWrite()) throw new Error('Anda tidak memiliki izin menulis');
    if (!this._cache[tabel]) await this._loadTable(tabel);

    const key = ID_KEY[tabel] || 'id';
    const idx = await this._locateRow(tabel, id);
    const existing = this._toObj(tabel, await this._readRow(tabel, idx));

    // Cek konflik versi
    if (data.version != null && Number(data.version) !== Number(existing.version || 1)) {
      const err = new Error('CONFLICT');
      err.code = 'CONFLICT';
      err.serverRow = existing;
      err.clientRow = data;
      throw err;
    }

    const now = new Date().toISOString();
    const merged = {
      ...existing,
      ...data,
      [key]: id,
      version: Number(existing.version || 1) + 1,
      created_at: existing.created_at,
      updated_at: now,
      updated_by: this.user?.email || ''
    };
    const arr = this._toArr(tabel, merged);
    const rowNumber = idx + 2;
    const range = `${tabel}!A${rowNumber}:${colLetter(arr.length)}${rowNumber}`;
    await this._fetch(
      `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI(range)}?valueInputOption=RAW`,
      { method: 'PUT', body: JSON.stringify({ values: [arr] }) }
    );
    this._cacheUpsert(tabel, id, arr);
    if (tabel === 'assets') {
      const history = buildAssetHistory(existing, merged, this.user?.email || '');
      if (history.length) {
        try { await this.createMany('asset_history', history); }
        catch (error) { throw new Error(`Aset tersimpan, tetapi riwayat perubahan gagal disimpan: ${error.message}`); }
      }
    }
    await this._logActivity('update', `${tabel}:${id}`);
    return merged;
  }

  async remove(tabel, id) {
    if (tabel === 'settings') {
      if (!this.canWrite()) throw new Error('Anda tidak memiliki izin menulis');
      if (!this._cache.settings) await this._loadTable('settings');
      let idx;
      try { idx = await this._locateRow('settings', id); } catch { return; }
      await this._deleteRowByIndex('settings', idx, id);
      return;
    }
    if (tabel === 'activity_log') {
      throw new Error('activity_log bersifat append-only');
    }
    if (!this.canWrite()) throw new Error('Anda tidak memiliki izin menulis');
    if (!this._cache[tabel]) await this._loadTable(tabel);

    let idx;
    try { idx = await this._locateRow(tabel, id); } catch { return; }

    await this._deleteRowByIndex(tabel, idx, id);
    await this._logActivity('delete', `${tabel}:${id}`);
  }

  async _deleteRowByIndex(tabel, idx, id) {
    const sheetId = this._sheetIds[tabel];
    if (sheetId == null) throw new Error('Sheet ID tidak ditemukan untuk ' + tabel);
    await this._fetch(`${API.SHEETS}/${this.spreadsheetId}:batchUpdate`, {
      method: 'POST',
      body: JSON.stringify({
        requests: [{
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: idx + 1,
              endIndex: idx + 2
            }
          }
        }]
      })
    });
    this._cache[tabel].rows = this._cache[tabel].rows.filter(r => r[0] !== id);
  }

  // =========================================================
  // FILES
  // =========================================================
  async uploadFile(file) {
    if (!this.folderId && this.role === 'owner') {
      const folder = await this._fetch(`${API.DRIVE}/files`, {
        method: 'POST',
        body: JSON.stringify({
          name: this.config.FOLDER_TITLE,
          mimeType: 'application/vnd.google-apps.folder'
        })
      });
      this.folderId = folder.id;
      this._saveWorkspaceIds(folder.id);
    }
    if (!this.folderId) {
      throw new Error('Folder lampiran belum dipilih. Buka Pengaturan > Koneksi untuk memilih folder.');
    }
    const meta = {
      name: file.name || ('lampiran-' + Date.now()),
      parents: [this.folderId]
    };
    const boundary = '----thinkaset' + Date.now();
    const head =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      JSON.stringify(meta) +
      `\r\n--${boundary}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`;
    const blob = new Blob([head, file, `\r\n--${boundary}--`]);
    const res = await this._fetch(
      `${API.UPLOAD}?uploadType=multipart&fields=id,name,webViewLink,webContentLink`,
      {
        method: 'POST',
        body: blob,
        headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }
      }
    );
    this._blobUrls ||= new Map();
    const localUrl = URL.createObjectURL(file);
    this._blobUrls.set(res.id, localUrl);
    return { id: res.id, url: localUrl };
  }

  /** URL gambar/berkas yang bisa dipakai <img>: unduh isi berkas dengan token, lalu buat blob URL. */
  async getFileUrl(id) {
    this._blobUrls ||= new Map();
    if (this._blobUrls.has(id)) return this._blobUrls.get(id);
    if (!this.token || Date.now() >= this.tokenExpiry - 30_000) await this._signIn('');
    const res = await fetch(`${API.DRIVE}/files/${id}?alt=media`, {
      headers: { Authorization: 'Bearer ' + this.token }
    });
    if (!res.ok) throw new Error('Gagal memuat berkas (' + res.status + ')');
    const url = URL.createObjectURL(await res.blob());
    this._blobUrls.set(id, url);
    return url;
  }

  // =========================================================
  // ANGGOTA (Drive Permissions)
  // =========================================================
  async shareWith(email, peran) {
    if (!this.spreadsheetId) throw new Error('Workspace belum siap');
    const role = peran === 'viewer' ? 'reader' : 'writer';

    await this._fetch(
      `${API.DRIVE}/files/${this.spreadsheetId}/permissions?sendNotificationEmail=true`,
      {
        method: 'POST',
        body: JSON.stringify({ type: 'user', role, emailAddress: email })
      }
    );
    if (this.folderId) {
      try {
        await this._fetch(
          `${API.DRIVE}/files/${this.folderId}/permissions?sendNotificationEmail=false`,
          {
            method: 'POST',
            body: JSON.stringify({ type: 'user', role, emailAddress: email })
          }
        );
      } catch (e) {
        console.warn('Gagal berbagi folder (mungkin bukan pemilik folder):', e.message);
      }
    } else {
      console.warn('Folder lampiran belum dipilih; lampiran tidak akan bisa diakses anggota baru.');
    }
    await this._logActivity('share', `${email}:${peran}`);
  }

  async listMembers() {
    if (!this.spreadsheetId) return [];
    const res = await this._fetch(
      `${API.DRIVE}/files/${this.spreadsheetId}/permissions?fields=permissions(id,emailAddress,role,displayName,type)`
    );
    return (res.permissions || [])
      .filter(p => p.type === 'user')
      .map(p => ({
        email: p.emailAddress || '',
        name: p.displayName || p.emailAddress || '',
        role: p.role === 'reader' || p.role === 'commenter' ? 'viewer' :
              p.role === 'owner' ? 'owner' : 'editor',
        permissionId: p.id
      }));
  }

  // =========================================================
  // ACTIVITY LOG — batch (perbaikan wajib i)
  // =========================================================
  _logActivity(aksi, objek) {
    const row = {
      id: uuid(),
      user: this.user?.email || '',
      aksi,
      objek,
      waktu: new Date().toISOString()
    };
    this._logQueue.push(row);
    if (this._logQueue.length > LOG_QUEUE_MAX) {
      this._logQueue = this._logQueue.slice(-LOG_QUEUE_MAX);
    }
    if (this._logQueue.length >= LOG_BATCH_SIZE) {
      this._flushLogs();
    } else if (!this._logTimer) {
      this._logTimer = setTimeout(() => this._flushLogs(), LOG_BATCH_DELAY);
    }
  }

  async _flushLogs() {
    if (this._logTimer) {
      clearTimeout(this._logTimer);
      this._logTimer = null;
    }
    if (this._isFlushing || this._logQueue.length === 0) return;
    if (!this.spreadsheetId || !this._cache.activity_log) return;

    this._isFlushing = true;
    const batch = this._logQueue.splice(0, this._logQueue.length);
    try {
      const values = batch.map(row => this._toArr('activity_log', row));
      await this._fetch(
        `${API.SHEETS}/${this.spreadsheetId}/values/${encodeURI('activity_log!A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
        { method: 'POST', body: JSON.stringify({ values }) }
      );
      for (const row of batch) {
        this._cache.activity_log.rows.push(this._toArr('activity_log', row));
      }
    } catch (e) {
      console.warn('Flush activity_log gagal, requeue:', e.message);
      this._logQueue = [...batch, ...this._logQueue].slice(-LOG_QUEUE_MAX);
      if (!this._logTimer) {
        this._logTimer = setTimeout(() => this._flushLogs(), 8000);
      }
    } finally {
      this._isFlushing = false;
      if (this._logQueue.length > 0 && !this._logTimer) {
        this._logTimer = setTimeout(() => this._flushLogs(), LOG_BATCH_DELAY);
      }
    }
  }

  _bindVisibilityFlush() {
    if (this._visibilityBound) return;
    this._visibilityBound = true;
    this._visibilityHandler = () => {
      if (document.hidden) this._flushLogs();
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
  }

  // =========================================================
  // LOGOUT
  // =========================================================
  async signOut() {
    try { await this._flushLogs(); } catch {}
    // Clear log timer to prevent memory leak
    if (this._logTimer) {
      clearTimeout(this._logTimer);
      this._logTimer = null;
    }
    if (this._visibilityHandler) {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
      this._visibilityBound = false;
    }
    try {
      if (this.token && window.google?.accounts?.oauth2) {
        google.accounts.oauth2.revoke(this.token);
      }
    } catch {}
    this.token = null;
    this._blobUrls?.forEach(u => { try { URL.revokeObjectURL(u); } catch {} });
    this._blobUrls = null;
    try {
      sessionStorage.removeItem(GLOBAL_CONFIG.SS.TOKEN);
      sessionStorage.removeItem(GLOBAL_CONFIG.SS.TOKEN_EXP);
      sessionStorage.removeItem(GLOBAL_CONFIG.SS.EMAIL);
    } catch {}
  }
}

// --- Utilitas ---
function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Gagal memuat ' + src));
    document.head.appendChild(s);
  });
}

/** activity_log hanya dimuat headernya (isinya bisa sangat besar). */
function rangeOf(tabel) {
  return tabel === 'activity_log' ? 'activity_log!A1:E1' : `${tabel}!A1:ZZ100000`;
}

function colLetter(n) {
  let s = '';
  let x = n;
  while (x > 0) {
    const m = (x - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}
