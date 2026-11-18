/**
 * Halaman Error Interaktif bertema hijau Think Aset (netral untuk semua instansi).
 * Mendukung mode 404, 403, 500, dan 503 lengkap dengan ilustrasi vektor & pintasan F1–F4 / 1–4.
 */
import { esc } from '../utils/dom.js';
import { iconSvg } from './icons.js';

const ILLUSTRATIONS = {
  '404': `
    <svg viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="110" cy="95" r="76" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="2"/>
      <circle cx="110" cy="95" r="62" stroke="#16A34A" stroke-width="1.5" stroke-dasharray="6 5" opacity="0.45"/>
      <rect x="64" y="60" width="84" height="68" rx="12" fill="#FFFFFF" stroke="#166534" stroke-width="2.4" stroke-dasharray="6 4"/>
      <path d="M64 80h84" stroke="#DCFCE7" stroke-width="2"/>
      <rect x="78" y="92" width="38" height="8" rx="4" fill="#DCFCE7"/>
      <rect x="78" y="106" width="26" height="8" rx="4" fill="#E5E7EB"/>
      <g transform="translate(118, 84)">
        <circle cx="24" cy="24" r="22" fill="#FFFFFF" stroke="#16A34A" stroke-width="3.2"/>
        <circle cx="24" cy="24" r="15" fill="#F0FDF4"/>
        <text x="24" y="31" text-anchor="middle" fill="#166534" font-family="JetBrains Mono, monospace" font-size="20" font-weight="800">?</text>
        <path d="M40 40l14 14" stroke="#166534" stroke-width="5" stroke-linecap="round"/>
      </g>
    </svg>`,
  '403': `
    <svg viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="110" cy="95" r="76" fill="#FEF3C7" opacity="0.45"/>
      <circle cx="110" cy="95" r="64" fill="#FFFFFF" stroke="#FDE68A" stroke-width="2"/>
      <path d="M110 38L158 56V96C158 128 137 150 110 160C83 150 62 128 62 96V56L110 38Z" fill="#F0FDF4" stroke="#166534" stroke-width="2.6"/>
      <path d="M94 86V76a16 16 0 0 1 32 0v10" stroke="#166534" stroke-width="3.4" stroke-linecap="round"/>
      <rect x="84" y="86" width="52" height="40" rx="9" fill="#16A34A" stroke="#166534" stroke-width="2.2"/>
      <circle cx="110" cy="103" r="5" fill="#FFFFFF"/>
      <path d="M110 107v9" stroke="#FFFFFF" stroke-width="3.2" stroke-linecap="round"/>
    </svg>`,
  '500': `
    <svg viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="110" cy="95" r="76" fill="#FEE2E2" opacity="0.45"/>
      <circle cx="110" cy="95" r="64" fill="#FFFFFF" stroke="#FECACA" stroke-width="2"/>
      <rect x="58" y="48" width="104" height="32" rx="8" fill="#F9FAFB" stroke="#374151" stroke-width="2.2"/>
      <circle cx="74" cy="64" r="4" fill="#16A34A"/>
      <rect x="86" y="61" width="58" height="6" rx="3" fill="#D1D5DB"/>
      <rect x="58" y="88" width="104" height="32" rx="8" fill="#FEF2F2" stroke="#DC2626" stroke-width="2.2"/>
      <circle cx="74" cy="104" r="4" fill="#DC2626"/>
      <rect x="86" y="101" width="44" height="6" rx="3" fill="#FCA5A5"/>
      <circle cx="146" cy="104" r="16" fill="#DC2626"/>
      <path d="M146 96v9" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"/>
      <circle cx="146" cy="111" r="2" fill="#FFFFFF"/>
      <path d="M76 136h68" stroke="#D1D5DB" stroke-width="3" stroke-linecap="round" stroke-dasharray="5 5"/>
    </svg>`,
  '503': `
    <svg viewBox="0 0 220 190" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="110" cy="95" r="76" fill="#F0FDF4" stroke="#BBF7D0" stroke-width="2"/>
      <g transform="translate(60, 52)">
        <circle cx="38" cy="38" r="22" fill="#DCFCE7" stroke="#16A34A" stroke-width="3"/>
        <circle cx="38" cy="38" r="8" fill="#FFFFFF" stroke="#166534" stroke-width="2.5"/>
        <path d="M38 10v8M38 58v8M10 38h8M58 38h8M18 18l6 6M52 52l6 6M58 18l-6 6M24 52l-6 6" stroke="#166534" stroke-width="3.2" stroke-linecap="round"/>
      </g>
      <g transform="translate(114, 88)">
        <circle cx="24" cy="24" r="15" fill="#FFFFFF" stroke="#0D9488" stroke-width="2.8"/>
        <circle cx="24" cy="24" r="5" fill="#0D9488"/>
        <path d="M24 4v6M24 38v6M4 24h6M38 24h6" stroke="#0D9488" stroke-width="2.8" stroke-linecap="round"/>
      </g>
    </svg>`
};

function getErrorStates(path, message) {
  const safePath = path || window.location.hash || window.location.pathname || '/';
  return {
    '404': {
      code: '404',
      badge: 'HTTP_STATUS: 404_NOT_FOUND',
      dotClass: '',
      title: 'Halaman Tidak Ditemukan',
      desc: message || 'Rute atau data aset yang Anda cari tidak tersedia atau sudah dipindahkan.',
      cmd: `GET ${safePath} — 404 Not Found`
    },
    '403': {
      code: '403',
      badge: 'HTTP_STATUS: 403_FORBIDDEN',
      dotClass: 'warning',
      title: 'Akses Dibatasi',
      desc: 'Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi pemilik workspace untuk akses.',
      cmd: `GET ${safePath} — 403 Forbidden`
    },
    '500': {
      code: '500',
      badge: 'HTTP_STATUS: 500_INTERNAL_ERROR',
      dotClass: 'danger',
      title: 'Terjadi Kendala Sistem',
      desc: message || 'Halaman gagal memproses data. Periksa koneksi internet atau muat ulang aplikasi.',
      cmd: `ERR ${safePath} — ${message || '500 Internal Error'}`
    },
    '503': {
      code: '503',
      badge: 'HTTP_STATUS: 503_MAINTENANCE',
      dotClass: 'warning',
      title: 'Layanan Sedang Sibuk',
      desc: 'Layanan sinkronisasi sedang sibuk atau dalam pemeliharaan sementara. Silakan coba sesaat lagi.',
      cmd: `SVC ${safePath} — 503 Service Unavailable`
    }
  };
}

let activeKeyListener = null;

export function renderErrorPage(container, { code = '404', path = '', message = '' } = {}) {
  if (!container) return;
  const states = getErrorStates(path, message);
  const initialCode = states[code] ? code : '404';

  container.innerHTML = `
    <div class="error-page-wrap ta-fade-in">
      <div class="error-mode-bar" role="tablist" aria-label="Mode status error">
        <button type="button" class="error-mode-btn" data-err-mode="404"><span class="error-mode-kbd">F1</span> 404</button>
        <button type="button" class="error-mode-btn" data-err-mode="403"><span class="error-mode-kbd">F2</span> 403</button>
        <button type="button" class="error-mode-btn" data-err-mode="500"><span class="error-mode-kbd">F3</span> 500</button>
        <button type="button" class="error-mode-btn" data-err-mode="503"><span class="error-mode-kbd">F4</span> 503</button>
      </div>

      <section class="error-page-card">
        <div class="error-page-top">
          <div class="error-status-pill">
            <span class="error-status-dot" id="ep-dot"></span>
            <span id="ep-badge">HTTP_STATUS: 404_NOT_FOUND</span>
          </div>
          <div class="error-page-brand">
            <img src="icons/icon.svg" alt="Think Aset" />
            <span>Think Aset</span>
          </div>
        </div>

        <div class="error-illustration" id="ep-illustration"></div>
        <h1 class="error-code-num" id="ep-code">404</h1>
        <h2 class="error-page-title" id="ep-title">Halaman Tidak Ditemukan</h2>
        <p class="error-page-desc" id="ep-desc"></p>

        <div class="error-diag-bar">
          <span class="error-diag-cmd" id="ep-cmd"></span>
          <button type="button" class="btn btn-ghost btn-sm" id="ep-copy" title="Salin log diagnostik">
            ${iconSvg('copy', 14)} <span id="ep-copy-label">Salin</span>
          </button>
        </div>

        <div class="error-page-actions">
          <a href="#/dashboard" class="btn btn-primary">${iconSvg('dashboard', 16)} Kembali ke Dashboard</a>
          <button type="button" class="btn btn-secondary" id="ep-back">← Kembali</button>
          <a href="https://github.com/jaiz-lana/think---aset" target="_blank" rel="noopener noreferrer" class="btn btn-ghost">
            GitHub ${iconSvg('externalLink', 14)}
          </a>
        </div>
      </section>
    </div>
  `;

  const applyState = (modeKey) => {
    const s = states[modeKey] || states['404'];
    const dotEl = container.querySelector('#ep-dot');
    const badgeEl = container.querySelector('#ep-badge');
    const illEl = container.querySelector('#ep-illustration');
    const codeEl = container.querySelector('#ep-code');
    const titleEl = container.querySelector('#ep-title');
    const descEl = container.querySelector('#ep-desc');
    const cmdEl = container.querySelector('#ep-cmd');
    if (!dotEl || !badgeEl) return;

    dotEl.className = `error-status-dot${s.dotClass ? ' ' + s.dotClass : ''}`;
    badgeEl.textContent = s.badge;
    if (illEl) illEl.innerHTML = ILLUSTRATIONS[s.code] || ILLUSTRATIONS['404'];
    if (codeEl) codeEl.textContent = s.code;
    if (titleEl) titleEl.textContent = s.title;
    if (descEl) descEl.textContent = s.desc;
    if (cmdEl) cmdEl.textContent = s.cmd;

    container.querySelectorAll('[data-err-mode]').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.errMode === s.code);
    });
  };

  applyState(initialCode);

  container.querySelectorAll('[data-err-mode]').forEach(btn => {
    btn.addEventListener('click', () => applyState(btn.dataset.errMode));
  });

  container.querySelector('#ep-back')?.addEventListener('click', () => {
    if (window.history.length > 1) window.history.back();
    else window.location.hash = '#/dashboard';
  });

  container.querySelector('#ep-copy')?.addEventListener('click', async () => {
    const text = container.querySelector('#ep-cmd')?.textContent || '';
    try {
      await navigator.clipboard?.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    const label = container.querySelector('#ep-copy-label');
    if (label) {
      label.textContent = 'Tersalin!';
      setTimeout(() => { label.textContent = 'Salin'; }, 1800);
    }
  });

  if (activeKeyListener) {
    document.removeEventListener('keydown', activeKeyListener);
  }
  activeKeyListener = (e) => {
    if (!container.querySelector('.error-page-wrap')) {
      document.removeEventListener('keydown', activeKeyListener);
      activeKeyListener = null;
      return;
    }
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === '1' || e.key === 'F1') { if (e.key === 'F1') e.preventDefault(); applyState('404'); }
    else if (e.key === '2' || e.key === 'F2') { if (e.key === 'F2') e.preventDefault(); applyState('403'); }
    else if (e.key === '3' || e.key === 'F3') { if (e.key === 'F3') e.preventDefault(); applyState('500'); }
    else if (e.key === '4' || e.key === 'F4') { if (e.key === 'F4') e.preventDefault(); applyState('503'); }
  };
  document.addEventListener('keydown', activeKeyListener);
}
