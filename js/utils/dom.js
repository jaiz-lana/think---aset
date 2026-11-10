/**
 * Helper DOM minimal.
 * CATATAN: helper `html()` yang tidak konsisten sudah DIHAPUS.
 * Semua string dinamis WAJIB lewat `esc()` sebelum dimasukkan ke innerHTML.
 */

export const $  = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

/** Escape HTML untuk mencegah XSS. */
export function esc(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Aktifkan efek ripple global sekali saja pada semua `.btn`.
 * Tidak ada versi `attachRipple` terpisah (yang lama sudah dihapus).
 */
export function enableGlobalRipple() {
  if (window.__taRippleBound) return;
  window.__taRippleBound = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.btn');
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const d = Math.max(r.width, r.height);
    if (d <= 0) return;
    const s = document.createElement('span');
    s.className = 'ripple';
    s.style.width = s.style.height = d + 'px';
    s.style.left = (e.clientX - r.left - d / 2) + 'px';
    s.style.top  = (e.clientY - r.top  - d / 2) + 'px';
    btn.appendChild(s);
    setTimeout(() => s.remove(), 650);
  });
}