/**
 * Tema aplikasi.
 * Sumber kebenaran utama: tabel `settings` di adapter (key="theme").
 * localStorage menjadi cache untuk mencegah flash sebelum JS dimuat.
 */
import { config } from './config.js';

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem(config.LS.THEME, t); } catch {}
}

export function getTheme() {
  try { return localStorage.getItem(config.LS.THEME) === 'dark' ? 'dark' : 'light'; }
  catch { return 'light'; }
}

export function initTheme() {
  applyTheme(getTheme());
}

export function toggleTheme() {
  const next = getTheme() === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

/**
 * Sinkronkan tema dari settings adapter → localStorage + DOM.
 * Dipanggil setelah login agar perangkat baru mengikuti pilihan pengguna.
 * Return theme yang diterapkan, atau null jika settings kosong.
 */
export async function syncThemeFromSettings(adapter) {
  const setting = await adapter.get('settings', 'theme');
  if (setting?.value === 'dark' || setting?.value === 'light') {
    applyTheme(setting.value);
    return setting.value;
  }
  return null;
}

/**
 * Simpan tema ke settings adapter (dan localStorage).
 */
export async function saveTheme(adapter, theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  applyTheme(t);
  if (!adapter.canWrite()) return t;
  const existing = await adapter.get('settings', 'theme');
  if (existing) await adapter.update('settings', 'theme', { value: t });
  else await adapter.create('settings', { key: 'theme', value: t });
  return t;
}