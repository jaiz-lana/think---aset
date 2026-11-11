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

  // Kelompokkan menu navigasi
  const navItems = FEATURES.filter(item => item.nav);
  const groups = [];
  const groupMap = new Map();

  navItems.forEach(item => {
    const gName = item.group || 'Menu';
    if (!groupMap.has(gName)) {
      const gObj = { name: gName, items: [] };
      groupMap.set(gName, gObj);
      groups.push(gObj);
    }
    groupMap.get(gName).items.push(item);
  });

  const menuHtml = groups.map(g => `
    <div class="sidebar-group">
      <div class="sidebar-heading">${esc(g.name)}</div>
      <div class="sidebar-group-items">
        ${g.items.map(item => renderMenuItem(item, router)).join('')}
      </div>
    </div>
  `).join('');

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
            <span class="theme-icon">${currentTheme === 'dark' ? '☀️' : '🌙'}</span>
            <span class="btn-text">${currentTheme === 'dark' ? 'Mode Terang' : 'Mode Gelap'}</span>
          </button>
          <button class="footer-btn btn-logout" id="btn-sidebar-logout" title="Keluar dari akun">
            <span>🚪</span>
            <span class="btn-text">Keluar</span>
          </button>
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

  applyWorkspaceBranding(adapter).catch(error => console.warn('Branding workspace gagal dimuat:', error));

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
      btn.querySelector('.theme-icon').textContent = next === 'dark' ? '☀️' : '🌙';
      btn.querySelector('.btn-text').textContent = next === 'dark' ? 'Mode Terang' : 'Mode Gelap';
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
