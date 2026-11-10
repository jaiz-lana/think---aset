/**
 * Orkestrator autentikasi & pemilihan adapter.
 * Modul lain WAJIB memakai `getAdapter()`, tidak memanggil adapter secara langsung.
 */
import { GoogleAdapter } from './storage/google.js';
import { LocalAdapter } from './storage/local.js';
import { config } from './config.js';

let adapter = null;

export async function signInGoogle(opts = {}) {
  const a = new GoogleAdapter(config);
  await a.init(opts);
  adapter = a;
  return a;
}

export async function signInLocal() {
  const a = new LocalAdapter(config);
  await a.init();
  adapter = a;
  return a;
}

export function getAdapter() {
  if (!adapter) throw new Error('Belum login. Panggil signIn* terlebih dahulu.');
  return adapter;
}

export function isSignedIn() {
  return adapter !== null;
}

/**
 * Logout: revoke token (Google) dan bersihkan penanda mode di localStorage.
 * Data pengguna TIDAK dihapus (tetap di Drive/IndexedDB).
 */
export async function signOut() {
  if (adapter) {
    try { await adapter.signOut(); }
    catch (e) { console.warn('signOut adapter:', e); }
    adapter = null;
  }
  try {
    localStorage.removeItem(config.LS.MODE);
    sessionStorage.removeItem(config.SS.TOKEN);
    sessionStorage.removeItem(config.SS.TOKEN_EXP);
    sessionStorage.removeItem(config.SS.EMAIL);
  } catch {}
}

/**
 * Coba auto-login berdasarkan mode tersimpan.
 * - Mode lokal: langsung init (IndexedDB tersedia).
 * - Mode Google: hanya jika token sessionStorage masih valid.
 * Mengembalikan true bila adapter siap.
 */
export async function tryAutoLogin() {
  let mode = null;
  try { mode = localStorage.getItem(config.LS.MODE); } catch {}

  if (mode === 'local') {
    try {
      await signInLocal();
      return true;
    } catch (e) {
      console.warn('Auto-login lokal gagal:', e.message);
      return false;
    }
  }

  if (mode === 'google') {
    let tok = null, exp = 0;
    try {
      tok = sessionStorage.getItem(config.SS.TOKEN);
      exp = Number(sessionStorage.getItem(config.SS.TOKEN_EXP) || 0);
    } catch {}
    if (tok && Date.now() < exp - 30_000) {
      try {
        await signInGoogle({ mode: 'auto' });
        return true;
      } catch (e) {
        console.warn('Auto-login Google gagal:', e.message);
        return false;
      }
    }
  }
  return false;
}