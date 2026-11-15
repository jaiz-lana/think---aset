/**
 * Layout shell aplikasi: sidebar + topbar + content area.
 * Dirender sekali, dipakai ulang oleh semua halaman.
 * Halaman TIDAK di-render di sini — halaman memakai `.content`.
 */
import { getAdapter, signOut } from '../auth.js';
import { esc } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { toggleTheme, getTheme } from '../theme.js';
import { FEATURES, isFeatureAvailable } from '../features.js';
import { openGuideModal } from './guide.js';
import { iconSvg } from './icons.js';
import { getParentMenuPath } from './menu-hub.js';

/**
 * Bangun shell sekali.
 * @returns {{ content: HTMLElement, setTitle: Function, setActions: Function, setActive: Function }}
 */
export function renderLayout(root, router) {
  const adapter = getAdapter();
  const userEmail = adapter.user?.email || 'Pengguna Lokal';
  const userInitial = (userEmail[0] || 'U').toUpperCase();
  const userPicture = adapter.user?.picture || '';
  const currentTheme = getTheme();

  const SIDEBAR_ITEMS = [
    { title: 'Dashboard', path: '/dashboard', icon: 'dashboard' },
    { title: 'Daftar Aset', path: '/aset', icon: 'assets' },
    { title: 'Data Master', path: '/menu/master', icon: 'master' },
    { title: 'Operasional', path: '/menu/operasional', icon: 'operasional' },
    { title: 'Laporan', path: '/menu/laporan', icon: 'laporan' },
    { title: 'Pengaturan', path: '/menu/pengaturan', icon: 'pengaturan' }
  ];

  const menuHtml = `
    <div class="sidebar-group">
      <div class="sidebar-group-items">
        ${SIDEBAR_ITEMS.map(item => `
          <a href="#${esc(item.path)}" class="sidebar-item" data-path="${esc(item.path)}" title="${esc(item.title)}">
            <span class="sidebar-icon">${iconSvg(item.icon, 18)}</span>
            <span class="sidebar-label">${esc(item.title)}</span>
          </a>
        `).join('')}
      </div>
    </div>`;

  root.innerHTML = `
    <div class="app-shell">
      <aside class="app-sidebar" id="app-sidebar">
        <div class="sidebar-header">
          <div class="sidebar-brand">
            <img src="icons/logo.svg" alt="Think Aset" />
          </div>
          
          <div class="sidebar-user-card">
            ${userPicture 
              ? `<img src="${esc(userPicture)}" class="user-avatar" alt="Avatar" />` 
              : `<div class="user-avatar text-avatar">${esc(userInitial)}</div>`}
            <div class="user-info">
              <span class="user-email" title="${esc(userEmail)}">${esc(userEmail)}</span>
              <span class="user-role badge ${adapter.role === 'owner' ? 'badge-primary' : 'badge-muted'}">
                ${adapter.mode === 'google' ? `${esc(adapter.role)}` : 'Mode Lokal'}
              </span>
            </div>
          </div>
        </div>

        <nav class="sidebar-menu" id="sidebar-menu" aria-label="Menu utama">
          ${menuHtml}
        </nav>

        <div class="sidebar-footer">
          <button class="footer-btn" id="btn-toggle-theme" title="Ubah tema terang/gelap">
            <span class="theme-icon">${iconSvg(currentTheme === 'dark' ? 'sun' : 'moon', 15)}</span>
            <span class="btn-text">${currentTheme === 'dark' ? 'Terang' : 'Gelap'}</span>
          </button>
          <button class="footer-btn btn-logout" id="btn-sidebar-logout" title="Keluar dari akun">
            <span class="logout-icon">${iconSvg('logout', 15)}</span>
            <span class="btn-text">Keluar</span>
          </button>
        </div>
      </aside>
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <div class="app-main">
        <header class="app-topbar">
          <button class="sidebar-toggle" id="sidebar-toggle" aria-label="Buka menu navigasi">☰</button>
          <button type="button" class="btn btn-ghost btn-sm topbar-back hidden" id="btn-topbar-back" aria-label="Kembali" title="Kembali">← Kembali</button>
          <div class="topbar-title" id="topbar-title">Dashboard</div>
          <div class="topbar-actions" id="topbar-actions"></div>
        </header>
        <main class="app-content" id="app-content"></main>
      </div>
      <button type="button" class="help-fab" id="btn-help-fab" aria-label="Panduan penggunaan" title="Panduan penggunaan">
        <span class="help-fab-icon" aria-hidden="true">?</span>
      </button>
    </div>`;

  applyWorkspaceBranding(adapter).catch(error => console.warn('Branding workspace gagal dimuat:', error));
  document.getElementById('btn-help-fab')?.addEventListener('click', () => openGuideModal());

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

  // Toggle tema dari sidebar
  document.getElementById('btn-toggle-theme')?.addEventListener('click', () => {
    const next = toggleTheme();
    const btn = document.getElementById('btn-toggle-theme');
    if (btn) {
      btn.querySelector('.theme-icon').innerHTML = iconSvg(next === 'dark' ? 'sun' : 'moon', 15);
      btn.querySelector('.btn-text').textContent = next === 'dark' ? 'Terang' : 'Gelap';
    }
  });

  // Logout dari sidebar
  document.getElementById('btn-sidebar-logout')?.addEventListener('click', async () => {
    if (confirm('Apakah Anda yakin ingin keluar dari Think Aset?')) {
      await signOut();
      window.location.reload();
    }
  });

  // Tangani klik item menu yang belum siap
  document.querySelectorAll('[data-feature-unavailable]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      notify.info('Fitur ini belum tersedia.');
      closeMobile();
    });
  });

  document.getElementById('btn-topbar-back')?.addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      router.navigate('/dashboard');
    }
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
      const activePath = getParentMenuPath(path);
      document.querySelectorAll('.sidebar-item').forEach(a => {
        a.classList.toggle('active', a.dataset.path === activePath);
      });
      const backBtn = document.getElementById('btn-topbar-back');
      if (backBtn) {
        backBtn.classList.toggle('hidden', !path || path === '/' || path === '/dashboard');
      }
      closeMobile();
    },
    getUnavailableFeatures() {
      return FEATURES.filter(item => !isFeatureAvailable(item, router));
    }
  };
}

async function applyWorkspaceBranding(adapter) {
  const settings = await adapter.list('settings');
  const get = key => settings.find(row => row.key === key)?.value || '';
  const name = get('branding_name');
  const logoId = get('branding_logo_id');
  const brand = document.querySelector('.sidebar-brand');
  if (!brand) return;
  if (name) {
    const heading = document.createElement('strong');
    heading.textContent = name;
    brand.prepend(heading);
    document.title = `${name} — Aplikasi`;
  }
  if (logoId) {
    const url = await adapter.getFileUrl(logoId);
    const logo = brand.querySelector('img');
    if (url && logo) {
      logo.src = url;
      logo.alt = name || 'Logo organisasi';
    }
  }
}

function renderMenuItem(item, router) {
  const ready = isFeatureAvailable(item, router);
  const icon = `<span class="sidebar-icon" aria-hidden="true">${item.icon}</span>`;
  const displayTitle = item.shortTitle || item.title;
  const label = `<span class="sidebar-label">${esc(displayTitle)}</span>`;

  if (ready) {
    return `<a href="#${item.path}" class="sidebar-item" data-path="${esc(item.path)}" title="${esc(item.title)}">
      ${icon}${label}
    </a>`;
  }
  const status = item.availability === 'planned' ? 'Belum tersedia' : 'Belum dikonfigurasi';
  return `<button type="button" class="sidebar-item disabled" data-feature-unavailable title="${status}">
    ${icon}${label}
    <span class="sidebar-badge">•</span>
  </button>`;
}