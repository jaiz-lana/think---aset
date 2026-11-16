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
import { openModal } from './modal.js';
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

        <div class="sidebar-footer" style="grid-template-columns:1fr">
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
          <div class="row" style="gap:6px;align-items:center">
            <button type="button" class="btn btn-ghost btn-sm" id="btn-topbar-notif" aria-label="Notifikasi" title="Pusat Notifikasi" style="position:relative">
              🔔 <span id="notif-badge" class="badge badge-danger hidden" style="font-size:10px;padding:1px 5px;margin-left:2px">0</span>
            </button>
            <div class="topbar-actions" id="topbar-actions"></div>
          </div>
        </header>
        <main class="app-content" id="app-content"></main>
      </div>
      <button type="button" class="help-fab" id="btn-help-fab" aria-label="Panduan penggunaan" title="Panduan penggunaan">
        <span class="help-fab-icon" aria-hidden="true">?</span>
      </button>
    </div>`;

  applyWorkspaceBranding(adapter).catch(error => console.warn('Branding workspace gagal dimuat:', error));
  initNotificationCenter(adapter).catch(error => console.warn('Notifikasi gagal dimuat:', error));
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
    if (url) {
      let fav = document.querySelector('link[rel="icon"]');
      if (!fav) {
        fav = document.createElement('link');
        fav.rel = 'icon';
        document.head.appendChild(fav);
      }
      fav.href = url;
    }
  }
}

async function initNotificationCenter(adapter) {
  const btn = document.getElementById('btn-topbar-notif');
  const badge = document.getElementById('notif-badge');
  if (!btn || !badge) return;

  const collectNotifications = async () => {
    const [loans, agendas, journals, assets] = await Promise.all([
      adapter.list('loans').catch(() => []),
      adapter.list('agendas').catch(() => []),
      adapter.list('journals').catch(() => []),
      adapter.list('assets').catch(() => [])
    ]);
    const assetMap = new Map(assets.map(a => [a.id, a.nama || a.kode || 'Aset']));
    const today = new Date().toISOString().slice(0, 10);
    const items = [];

    for (const ln of loans) {
      if (ln.status === 'dikembalikan') continue;
      const aset = assetMap.get(ln.asset_id) || 'Aset';
      if (ln.tgl_jatuh_tempo && ln.tgl_jatuh_tempo < today) {
        items.push({ level: 'danger', title: `Terlambat Kembali: ${aset}`, desc: `Peminjam: ${ln.peminjam || '—'} · Jatuh tempo ${ln.tgl_jatuh_tempo}`, path: '#/peminjaman' });
      } else if (ln.tgl_pinjam && ln.tgl_pinjam > today) {
        items.push({ level: 'info', title: `Akan Dipinjam: ${aset}`, desc: `Mulai ${ln.tgl_pinjam} oleh ${ln.peminjam || '—'}`, path: '#/peminjaman' });
      } else {
        items.push({ level: 'warning', title: `Sedang Dipinjam: ${aset}`, desc: `Peminjam: ${ln.peminjam || '—'}${ln.tgl_jatuh_tempo ? ` · Batas ${ln.tgl_jatuh_tempo}` : ''}`, path: '#/peminjaman' });
      }
    }

    for (const ag of agendas) {
      if (ag.selesai === true || String(ag.selesai).toLowerCase() === 'true') continue;
      const aset = ag.asset_id ? assetMap.get(ag.asset_id) : '';
      items.push({
        level: ag.tanggal && ag.tanggal <= today ? 'warning' : 'info',
        title: `Agenda: ${ag.judul || 'Perawatan'}`,
        desc: `${aset ? aset + ' · ' : ''}Tanggal ${ag.tanggal || '—'}`,
        path: '#/agenda'
      });
    }

    const recentJournals = journals
      .slice()
      .sort((a, b) => String(b.tanggal || b.created_at || '').localeCompare(String(a.tanggal || a.created_at || '')))
      .slice(0, 3);
    for (const j of recentJournals) {
      const aset = j.asset_id ? assetMap.get(j.asset_id) : '';
      items.push({
        level: 'muted',
        title: `Jurnal Perbaikan: ${j.judul || 'Catatan'}`,
        desc: `${aset ? aset + ' · ' : ''}${j.tanggal || ''}`,
        path: '#/jurnal'
      });
    }
    return items;
  };

  const refreshBadge = async () => {
    const items = await collectNotifications();
    const urgentCount = items.filter(i => i.level !== 'muted').length;
    if (urgentCount > 0) {
      badge.textContent = urgentCount > 99 ? '99+' : String(urgentCount);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    return items;
  };

  await refreshBadge();

  btn.addEventListener('click', async () => {
    const items = await refreshBadge();
    openModal({
      title: 'Pusat Notifikasi',
      size: 'modal-sm',
      body: items.length
        ? `<div style="display:flex;flex-direction:column;gap:8px">
            ${items.map(it => {
              const cls = it.level === 'danger' ? 'badge-danger' : it.level === 'warning' ? 'badge-warning' : it.level === 'info' ? 'badge-success' : 'badge-muted';
              return `<a href="${esc(it.path)}" class="card" style="padding:10px 12px;text-decoration:none;color:inherit;display:block;border:1px solid var(--border)" onclick="document.querySelector('.modal-close')?.click()">
                <div class="row-between" style="gap:8px;align-items:flex-start">
                  <strong class="text-sm">${esc(it.title)}</strong>
                  <span class="badge ${cls}" style="font-size:10px">${it.level === 'danger' ? 'Terlambat' : it.level === 'warning' ? 'Aktif' : it.level === 'info' ? 'Jadwal' : 'Info'}</span>
                </div>
                <div class="text-xs text-muted" style="margin-top:4px">${esc(it.desc)}</div>
              </a>`;
            }).join('')}
          </div>`
        : '<p class="text-sm text-muted" style="margin:0">Tidak ada notifikasi saat ini.</p>',
      actions: [{ label: 'Tutup', class: 'btn btn-ghost' }]
    });
  });
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