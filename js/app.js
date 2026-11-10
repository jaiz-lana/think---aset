import { initTheme } from './theme.js';
import { config } from './config.js';
import { FEATURES } from './features.js';
import {
  tryAutoLogin, getAdapter, signInGoogle, signInLocal, isSignedIn, signOut
} from './auth.js';
import { runOnboarding } from './onboarding.js';
import { enableGlobalRipple, $, esc } from './utils/dom.js';
import { notify } from './utils/toast.js';
import { Router } from './router.js';
import { syncThemeFromSettings } from './theme.js';
import { renderLayout } from './ui/layout.js';
import { renderDashboard } from './ui/dashboard.js';
import { renderAssets } from './ui/assets.js';
import { renderAssetDetail } from './ui/asset-detail.js';
import { renderCategories } from './ui/categories.js';
import { renderLocations } from './ui/locations.js';
import { renderHolders } from './ui/holders.js';
import { renderSettings } from './ui/settings.js';
import { renderWorkflow } from './ui/workflows.js';

initTheme();
enableGlobalRipple();

const root = $('#app-root');
const loading = $('#app-loading');

let layout = null;
const router = new Router();

// ---------- Routes ----------
const routeHandlers = {
  dashboard: () => withLayout(() => renderDashboard(layout)),
  assets: ({ query }) => withLayout(() => renderAssets(layout, { query })),
  categories: () => withLayout(() => renderCategories(layout)),
  locations: () => withLayout(() => renderLocations(layout)),
  holders: () => withLayout(() => renderHolders(layout)),
  settings: () => withLayout(() => renderSettings(layout.content)),
  'qr-cards': ({ query }) => withLayout(() => renderWorkflow(layout, 'qr-cards', { query })),
  scan: ({ query }) => withLayout(() => renderWorkflow(layout, 'scan', { query })),
  history: ({ query }) => withLayout(() => renderWorkflow(layout, 'history', { query })),
  finance: ({ query }) => withLayout(() => renderWorkflow(layout, 'finance', { query })),
  agenda: ({ query }) => withLayout(() => renderWorkflow(layout, 'agenda', { query })),
  'calendar-sync': ({ query }) => withLayout(() => renderWorkflow(layout, 'calendar-sync', { query })),
  journal: ({ query }) => withLayout(() => renderWorkflow(layout, 'journal', { query })),
  audit: ({ query }) => withLayout(() => renderWorkflow(layout, 'audit', { query })),
  loans: ({ query }) => withLayout(() => renderWorkflow(layout, 'loans', { query })),
  reports: ({ query }) => withLayout(() => renderWorkflow(layout, 'reports', { query })),
  members: ({ query }) => withLayout(() => renderWorkflow(layout, 'members', { query })),
  branding: ({ query }) => withLayout(() => renderWorkflow(layout, 'branding', { query })),
  reminders: ({ query }) => withLayout(() => renderWorkflow(layout, 'reminders', { query }))
};
FEATURES.filter(feature => feature.availability === 'ready' && feature.path).forEach(feature => {
  const handler = routeHandlers[feature.id];
  if (!handler) throw new Error(`Handler route belum tersedia untuk fitur: ${feature.id}`);
  router.add(feature.path, handler);
});
router.add('/aset/:key', ({ params, query }) =>
  withLayout(() => renderAssetDetail(layout, { params, query }))
);
router.add('/', () => {
  if (!isSignedIn()) return showAuthScreen();
  router.navigate('/dashboard');
});
router.setNotFound(() => {
  if (!isSignedIn()) return showAuthScreen();
  layout.content.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon">🔍</span>
      <div class="empty-state-title">Halaman tidak ditemukan</div>
      <div class="empty-state-desc">Rute yang Anda tuju tidak tersedia.</div>
      <a href="#/dashboard" class="btn btn-primary">Kembali ke Dashboard</a>
    </div>`;
});

function withLayout(fn) {
  if (!isSignedIn()) return showAuthScreen();
  if (!layout) {
    layout = renderLayout(root, router);
  }
  const renderError = (e) => {
    console.error(e);
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <div class="empty-state-title">Terjadi kesalahan</div>
        <div class="empty-state-desc">${esc(e?.message || String(e))}</div>
        <a href="#/dashboard" class="btn btn-primary">Kembali ke Dashboard</a>
      </div>`;
  };
  try {
    const a = getAdapter();
    // Mode Google: muat ulang data bila sudah >30 dtk (agar perubahan pengguna lain terlihat)
    return Promise.resolve(a.refresh?.())
      .catch(e => console.warn('Muat ulang data gagal:', e))
      .then(() => fn())
      .catch(renderError);
  } catch (e) {
    renderError(e);
  }
}

// ---------- Boot ----------
(async function boot() {
  try {
    const ok = await tryAutoLogin();
    loading.classList.add('hidden');
    if (ok) {
      await startApp();
    } else {
      showAuthScreen();
    }
  } catch (e) {
    console.error(e);
    loading.classList.add('hidden');
    notify.error('Gagal memuat: ' + e.message);
    showAuthScreen();
  }
})();

async function startApp() {
  const adapter = getAdapter();
  await syncThemeFromSettings(adapter);
  await runOnboarding(root, { onComplete: startRouter });
}

function startRouter() {
  if (!layout) {
    layout = renderLayout(root, router);
  }
  if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#/') {
    window.location.hash = '/dashboard';
  }
  router.start();
}

// ============================================================
// LAYAR LOGIN (sama seperti Tahap 1)
// ============================================================
function showAuthScreen() {
  loading.classList.add('hidden');
  if (window.location.hash && window.location.hash !== '#') {
    try { history.replaceState(null, '', window.location.pathname + window.location.search); }
    catch {}
  }

  root.innerHTML = `
    <div class="onboarding-wrap">
      <div class="onboarding-card">
        <div class="onboarding-logo">
          <img src="icons/logo.svg" alt="Think Aset" />
        </div>
        <h2 class="onboarding-title">Mulai menggunakan Think Aset</h2>
        <p class="onboarding-subtitle">Pilih tempat penyimpanan data Anda.</p>

        <div class="mode-option" data-mode="google" id="opt-google">
          <div class="mode-option-icon">G</div>
          <div>
            <div class="mode-option-title">Lanjutkan dengan Google</div>
            <div class="mode-option-desc">Pilih akun dan izinkan akses Drive yang diperlukan. Tidak perlu API Key.</div>
          </div>
        </div>
        <div class="mode-option" data-mode="local" id="opt-local">
          <div class="mode-option-icon">L</div>
          <div>
            <div class="mode-option-title">Lanjutkan secara Lokal</div>
            <div class="mode-option-desc">Data di IndexedDB, tanpa akun. Tidak tersinkron antar perangkat.</div>
          </div>
        </div>

        <div id="google-config" class="mt-3 hidden">
          <p class="text-xs text-muted">Think Aset akan meminta izin Google saat Anda menghubungkan akun. Izin dibatasi pada file yang dibuat atau dibuka melalui aplikasi.</p>
          ${config.GOOGLE_API_KEY && config.GOOGLE_APP_ID
            ? '<button class="btn btn-secondary btn-sm" id="btn-join-existing">Buka workspace yang dibagikan</button>'
            : '<p class="text-xs text-muted mt-2">Mengakses workspace baru tidak memerlukan API Key. Membuka workspace yang sudah dibagikan memakai Google Picker, yang pengelola aplikasi dapat aktifkan secara opsional.</p>'}
        </div>

        <button class="btn btn-primary btn-block mt-4" id="btn-masuk" disabled>Masuk</button>
        ${config.GOOGLE_CLIENT_ID
          ? ''
          : '<p class="notice mt-3">Koneksi Google belum disiapkan oleh pengelola aplikasi. Silakan gunakan mode lokal atau hubungi pengelola.</p>'}
        <p class="text-xs text-muted mt-4 text-center">Think Aset tidak membuat akun terpisah. Data disimpan di Google Drive Anda atau browser ini.</p>
      </div>
    </div>`;

  let mode = null;
  const googleReady = Boolean(config.GOOGLE_CLIENT_ID);

  const setMode = (m) => {
    mode = m;
    root.querySelectorAll('.mode-option').forEach(x =>
      x.classList.toggle('selected', x.dataset.mode === m)
    );
    $('#google-config').classList.toggle('hidden', m !== 'google');
    const btn = $('#btn-masuk');
    btn.disabled = m === 'google' && !googleReady;
    btn.textContent = m === 'google'
      ? (googleReady ? 'Lanjutkan dengan Google' : 'Google belum disiapkan')
      : 'Gunakan Penyimpanan Lokal';
  };

  $('#opt-google').addEventListener('click', () => setMode('google'));
  $('#opt-local').addEventListener('click', () => setMode('local'));

  const setBusy = (busy, msg) => {
    const btn = $('#btn-masuk');
    btn.disabled = busy || (mode === 'google' && !googleReady);
    if (busy) btn.textContent = msg || 'Menghubungkan…';
    else btn.textContent = mode === 'google'
      ? (googleReady ? 'Lanjutkan dengan Google' : 'Google belum disiapkan')
      : 'Gunakan Penyimpanan Lokal';
  };

  $('#btn-masuk').addEventListener('click', async () => {
    if (!mode) return;
    try {
      setBusy(true);
      if (mode === 'local') {
        await signInLocal();
      } else {
        await signInGoogle({ mode: 'auto' });
      }
      await startApp();
    } catch (e) {
      console.error(e);
      notify.error('Gagal masuk: ' + e.message);
      setBusy(false);
    }
  });

  $('#btn-join-existing')?.addEventListener('click', async () => {
    try {
      setBusy(true, 'Membuka Picker…');
      await signInGoogle({ mode: 'join' });
      await startApp();
    } catch (e) {
      console.error(e);
      notify.error('Gagal membuka workspace: ' + e.message);
      setBusy(false);
    }
  });
}
