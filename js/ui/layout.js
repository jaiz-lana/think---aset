/**
 * Layout shell aplikasi: sidebar + topbar + content area.
 * Dirender sekali, dipakai ulang oleh semua halaman.
 * Halaman TIDAK di-render di sini — halaman memakai `.content`.
 */
import { getAdapter } from '../auth.js';
import { esc } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { FEATURES, isFeatureAvailable } from '../features.js';

/**
 * Bangun shell sekali.
 * @returns {{ content: HTMLElement, setTitle: Function, setActions: Function, setActive: Function }}
 */
export function renderLayout(root, router) {
  const adapter = getAdapter();

  root.innerHTML = `
    <div class="app-shell">
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <img src="icons/logo.svg" alt="Think Aset" />
            <span class="text-xs text-muted">${esc(adapter.user?.email || '')}</span>
          </div>
        </div>
        <nav class="sidebar-menu" id="sidebar-menu" aria-label="Menu utama">
          ${FEATURES.filter(item => item.nav).map(item => renderMenuItem(item, router)).join('')}
        </nav>
        <div class="sidebar-footer">
          <span class="badge badge-muted">${esc(adapter.mode)} · ${esc(adapter.role)}</span>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <div class="app-main">
        <header class="app-topbar">
          <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Buka menu navigasi">☰</button>
          <div class="topbar-title" id="topbar-title">Dashboard</div>
          <div class="topbar-actions" id="topbar-actions"></div>
        </header>
        <main class="app-content" id="app-content"></main>
      </div>
    </div>`;

  const sidebar = document.getElementById('app-sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const toggle = document.getElementById('sidebar-toggle');

  const closeMobile = () => {
    sidebar.classList.remove('open');
    overlay.classList.remove('open');
  };

  toggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay.classList.toggle('open');
  });
  overlay.addEventListener('click', closeMobile);

  // Tangani klik item menu yang belum siap
  document.querySelectorAll('[data-feature-unavailable]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      notify.info('Fitur ini belum tersedia.');
      closeMobile();
    });
  });

  const content = document.getElementById('app-content');

  return {
    content,
    closeMobile,
    setTitle(text) {
      const el = document.getElementById('topbar-title');
      if (el) el.textContent = text || '';
    },
    setActions(html) {
      const el = document.getElementById('topbar-actions');
      if (!el) return null;
      el.innerHTML = html || '';
      return el;
    },
    setActive(path) {
      document.querySelectorAll('.sidebar-item').forEach(a => {
        a.classList.toggle('active', a.dataset.path === path);
      });
      closeMobile();
    },
    getUnavailableFeatures() {
      return FEATURES.filter(item => !isFeatureAvailable(item, router));
    }
  };
}

function renderMenuItem(item, router) {
  const ready = isFeatureAvailable(item, router);
  const icon = `<span class="sidebar-icon" aria-hidden="true">${item.icon}</span>`;
  const label = `<span class="sidebar-label">${esc(item.title)}</span>`;

  if (ready) {
    return `<a href="#${item.path}" class="sidebar-item" data-path="${esc(item.path)}">
      ${icon}${label}
    </a>`;
  }
  const status = item.availability === 'planned' ? 'Belum tersedia' : 'Belum dikonfigurasi';
  return `<button type="button" class="sidebar-item disabled" data-feature-unavailable title="${status}">
    ${icon}${label}
    <span class="sidebar-badge">•</span>
  </button>`;
}