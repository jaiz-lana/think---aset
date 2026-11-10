import { getAdapter, signOut } from '../auth.js';
import { config } from '../config.js';
import { notify } from '../utils/toast.js';
import { $, esc } from '../utils/dom.js';
import { getTheme, saveTheme } from '../theme.js';

export async function renderSettings(root) {
  const adapter = getAdapter();

  let settings = [];
  settings = await adapter.list('settings');

  const orgName = settings.find(s => s.key === 'org_name')?.value || '';
  const themeVal = settings.find(s => s.key === 'theme')?.value || getTheme();
  const hasFolder = adapter.mode === 'google' && (!!adapter.folderId || adapter.role === 'owner');

  root.innerHTML = `
    <div class="settings-page">

      <div class="settings-section">
        <h2>Koneksi Penyimpanan</h2>
        <div class="kv-row"><span>Mode</span><strong>${esc(adapter.mode)}</strong></div>
        <div class="kv-row"><span>Peran</span><strong>${esc(adapter.role)}</strong></div>
        <div class="kv-row"><span>Akun</span><strong>${esc(adapter.user?.email || '-')}</strong></div>
        ${adapter.mode === 'google' ? `
          <div class="kv-row"><span>Spreadsheet ID</span><strong>${esc(mask(adapter.spreadsheetId))}</strong></div>
          <div class="kv-row"><span>Folder Lampiran ID</span><strong>${esc(mask(adapter.folderId))}</strong></div>
        ` : `
          <p class="text-sm text-muted mt-3">Data tersimpan di IndexedDB browser ini. Tidak tersinkron antar perangkat.</p>
        `}
        ${adapter.mode === 'google' && adapter.canWrite() && !hasFolder ? `
          <div class="notice mt-3">Folder lampiran belum dipilih. Unggah lampiran tidak akan berfungsi hingga folder dipilih.</div>
          <button class="btn btn-secondary btn-sm" id="btn-pick-folder">Pilih folder lampiran</button>
        ` : ''}
      </div>

      <div class="settings-section">
        <h2>Koneksi Google</h2>
        <p class="text-sm text-muted">Pengguna cukup memilih akun Google dan menyetujui izin yang diminta. API Key tidak diperlukan untuk membuat workspace Drive/Sheets.</p>
        <p class="text-xs text-muted">Status OAuth: ${config.GOOGLE_CLIENT_ID ? 'siap' : 'belum disiapkan oleh pengelola aplikasi'}.</p>
        <p class="text-xs text-muted">Google Picker untuk membuka workspace yang dibagikan: ${config.GOOGLE_API_KEY && config.GOOGLE_APP_ID ? 'aktif' : 'opsional, belum diaktifkan'}.</p>
        <p class="text-xs text-muted">Untuk mengatur koneksi bagi seluruh pengguna, pengelola deployment mengisi <code>js/deployment-config.js</code>.</p>
      </div>

      <div class="settings-section">
        <h2>Tema</h2>
        <div class="row">
          <button class="btn ${themeVal === 'light' ? 'btn-primary' : 'btn-ghost'}" data-theme-set="light">☀ Terang</button>
          <button class="btn ${themeVal === 'dark' ? 'btn-primary' : 'btn-ghost'}" data-theme-set="dark">☾ Gelap</button>
        </div>
      </div>

      <div class="settings-section">
        <h2>Profil Organisasi</h2>
        <div class="form-group">
          <label class="form-label">Nama Organisasi</label>
          <input class="form-input" id="set-org-name" value="${esc(orgName)}" placeholder="PT Maju Bersama" ${adapter.canWrite() ? '' : 'readonly'} />
        </div>
        ${adapter.canWrite()
          ? '<button class="btn btn-primary" id="btn-save-org">Simpan</button>'
          : '<p class="text-xs text-muted">Hanya pemilik/editor workspace yang dapat mengubah profil organisasi.</p>'}
      </div>

      ${adapter.mode === 'local' ? `
        <div class="settings-section">
          <h2>Backup &amp; Restore</h2>
          <p class="text-sm text-muted">Data lokal tersimpan di browser ini. Backup rutin untuk berjaga-jaga.</p>
          <p class="text-xs text-muted">Backup menyertakan data tabel beserta isi foto/lampiran/logo. Restore mengganti data tabel dan memulihkan berkas dari backup.</p>
          <div class="row mt-3">
            <button class="btn btn-secondary" id="btn-backup">⬇ Unduh Backup (JSON)</button>
            <label class="btn btn-ghost" style="cursor:pointer">
              ⬆ Pulihkan Backup
              <input type="file" accept="application/json" id="input-restore" style="display:none" />
            </label>
          </div>
        </div>
      ` : ''}

      <div class="settings-section">
        <h2>Keluar</h2>
        <p class="text-sm text-muted">Data tetap tersimpan di ${adapter.mode === 'local' ? 'browser ini' : 'Google Drive Anda'}.</p>
        <button class="btn btn-danger" id="btn-logout">Keluar dari Think Aset</button>
      </div>
    </div>`;

  root.querySelectorAll('[data-theme-set]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = btn.dataset.themeSet;
      try {
        await saveTheme(adapter, t);
        notify.success('Tema: ' + t);
        root.querySelectorAll('[data-theme-set]').forEach(b => {
          b.classList.toggle('btn-primary', b.dataset.themeSet === t);
          b.classList.toggle('btn-ghost', b.dataset.themeSet !== t);
        });
      } catch (e) {
        notify.error('Gagal menyimpan tema: ' + e.message);
      }
    });
  });

  $('#btn-save-org')?.addEventListener('click', async () => {
    const val = $('#set-org-name').value.trim();
    if (val.length > 100) return notify.error('Nama terlalu panjang (maks 100 karakter)');
    try {
      const existing = await adapter.get('settings', 'org_name');
      if (existing) await adapter.update('settings', 'org_name', { value: val });
      else await adapter.create('settings', { key: 'org_name', value: val });
      try { localStorage.setItem(config.LS.ORG_NAME, val); } catch {}
      notify.success('Nama organisasi disimpan');
    } catch (e) { notify.error('Gagal menyimpan: ' + e.message); }
  });

  if (adapter.mode === 'google' && adapter.canWrite() && !hasFolder) {
    $('#btn-pick-folder')?.addEventListener('click', async () => {
      try {
        const folder = await adapter.pickFolder();
        if (folder) {
          notify.success('Folder lampiran: ' + folder.name);
          renderSettings(root);
        }
      } catch (e) {
        notify.error('Gagal memilih folder: ' + e.message);
      }
    });
  }

  if (adapter.mode === 'local') {
    $('#btn-backup').addEventListener('click', async () => {
      try {
        await adapter.downloadBackup();
        notify.success('Backup diunduh');
      } catch (e) { notify.error('Backup gagal: ' + e.message); }
    });

    $('#input-restore').addEventListener('change', async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;
      if (!confirm('Pulihkan backup? Data saat ini akan DITIMPA.')) {
        ev.target.value = '';
        return;
      }
      try {
        const text = await file.text();
        const dump = JSON.parse(text);
        await adapter.importAll(dump);
        notify.success('Backup dipulihkan. Memuat ulang…');
        setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        notify.error('Restore gagal: ' + e.message);
      } finally {
        ev.target.value = '';
      }
    });
  }

  $('#btn-logout').addEventListener('click', async () => {
    if (!confirm('Keluar dari Think Aset? Data Anda tetap tersimpan.')) return;
    await signOut();
    window.location.reload();
  });
}

function mask(id) {
  if (!id) return '—';
  return id.length > 12 ? id.slice(0, 6) + '…' + id.slice(-4) : id;
}
