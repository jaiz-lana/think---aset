/**
 * Onboarding setelah login:
 *  1) Pilih tema (Terang / Gelap) — disimpan ke settings + localStorage.
 *  2) Nama organisasi.
 *  Jika settings sudah punya keduanya, langsung panggil onComplete.
 */
import { getAdapter } from './auth.js';
import { applyTheme, getTheme, saveTheme } from './theme.js';
import { notify } from './utils/toast.js';
import { $, esc } from './utils/dom.js';

export async function runOnboarding(root, { onComplete } = {}) {
  const adapter = getAdapter();

  const settings = await adapter.list('settings');

  const themeVal = settings.find(s => s.key === 'theme')?.value;
  const orgVal   = settings.find(s => s.key === 'org_name')?.value;
  const orgSkipped = (() => {
    try { return localStorage.getItem('ta_onboarding_org_skipped') === 'true'; }
    catch { return false; }
  })();
  const hasTheme = themeVal === 'dark' || themeVal === 'light';
  const needsOrg = adapter.canWrite() && !orgVal && !orgSkipped;

  if (hasTheme) {
    applyTheme(themeVal);
  }

  const finishOrg = async (val) => {
    if (val) {
      await saveOrgName(adapter, val);
      try { localStorage.setItem('ta_org_name', val); } catch {}
      try { localStorage.removeItem('ta_onboarding_org_skipped'); } catch {}
    } else {
      try { localStorage.setItem('ta_onboarding_org_skipped', 'true'); } catch {}
    }
    onComplete?.();
  };

  if (!hasTheme) {
    renderThemeStep(root, {
      initial: getTheme(),
      onPick: async (picked) => {
        await saveTheme(adapter, picked);
        if (needsOrg) {
          renderOrgStep(root, { initial: '', onDone: finishOrg });
        } else {
          onComplete?.();
        }
      }
    });
  } else if (needsOrg) {
    renderOrgStep(root, { initial: orgVal || '', onDone: finishOrg });
  } else {
    onComplete?.();
  }
}

async function saveOrgName(adapter, val) {
  const existing = await adapter.get('settings', 'org_name');
  if (existing) await adapter.update('settings', 'org_name', { value: val });
  else await adapter.create('settings', { key: 'org_name', value: val });
}

function renderThemeStep(root, { initial, onPick }) {
  let chosen = initial === 'dark' ? 'dark' : 'light';
  root.innerHTML = `
    <div class="onboarding-wrap">
      <div class="onboarding-card">
        <div class="onboarding-logo">
          <img src="icons/logo.svg" alt="Think Aset" />
        </div>
        <h2 class="onboarding-title">Pilih tema tampilan</h2>
        <p class="onboarding-subtitle">Pilihan tersimpan di perangkat ini dan di workspace Anda.</p>
        <div class="theme-picker" id="tp">
          <button type="button" class="theme-card" data-theme="light">
            <div class="theme-preview light">☀</div>
            <strong>Terang</strong>
            <div class="text-xs text-muted">Untuk ruang terang</div>
          </button>
          <button type="button" class="theme-card" data-theme="dark">
            <div class="theme-preview dark">☾</div>
            <strong>Gelap</strong>
            <div class="text-xs text-muted">Nyaman untuk malam</div>
          </button>
        </div>
        <button class="btn btn-primary btn-block" id="btn-lanjut">Lanjut</button>
      </div>
    </div>`;

  const cards = root.querySelectorAll('.theme-card');
  const updateSel = () => cards.forEach(c => c.classList.toggle('selected', c.dataset.theme === chosen));
  updateSel();

  cards.forEach(c => {
    c.addEventListener('click', () => {
      chosen = c.dataset.theme;
      applyTheme(chosen); // preview langsung
      updateSel();
    });
  });

  $('#btn-lanjut').addEventListener('click', async () => {
    try { await onPick(chosen); }
    catch (e) { notify.error('Gagal menyimpan pilihan: ' + e.message); }
  });
}

function renderOrgStep(root, { initial, onDone }) {
  root.innerHTML = `
    <div class="onboarding-wrap">
      <div class="onboarding-card">
        <div class="onboarding-logo">
          <img src="icons/logo.svg" alt="Think Aset" />
        </div>
        <h2 class="onboarding-title">Nama organisasi</h2>
        <p class="onboarding-subtitle">Akan ditampilkan di aplikasi, kartu aset, dan laporan.</p>
        <div class="form-group">
          <label class="form-label" for="org-name">Nama organisasi</label>
          <input id="org-name" class="form-input" placeholder="Contoh: PT Maju Bersama" value="${esc(initial)}" autofocus />
        </div>
        <button class="btn btn-primary btn-block" id="btn-finish">Selesai</button>
        <button class="btn btn-ghost btn-block mt-3" id="btn-skip">Lewati</button>
      </div>
    </div>`;

  $('#btn-finish').addEventListener('click', async () => {
    const val = $('#org-name').value.trim();
    if (val.length > 100) return notify.error('Nama terlalu panjang (maks 100 karakter)');
    try { await onDone(val); }
    catch (e) { notify.error('Gagal menyimpan nama organisasi: ' + e.message); }
  });
  $('#btn-skip').addEventListener('click', () => onDone(''));
}