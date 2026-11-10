import { esc } from './dom.js';

function ensureContainer() {
  let c = document.getElementById('ta-toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'ta-toast-container';
    document.body.appendChild(c);
  }
  return c;
}

export function toast(pesan, jenis = 'info', durasi = 3500) {
  const c = ensureContainer();
  const el = document.createElement('div');
  el.className = 'ta-toast ' + (jenis === 'error' ? 'error' : jenis === 'warning' ? 'warning' : jenis === 'success' ? 'success' : '');
  el.setAttribute('role', 'status');
  el.innerHTML = `<div style="flex:1">${esc(pesan)}</div>`;
  c.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity 240ms, transform 240ms';
    el.style.opacity = '0';
    el.style.transform = 'translateX(120%)';
    setTimeout(() => el.remove(), 260);
  }, durasi);
}

export const notify = {
  success: (m) => toast(m, 'success'),
  error:   (m) => toast(m, 'error'),
  warning: (m) => toast(m, 'warning'),
  info:    (m) => toast(m, 'info')
};