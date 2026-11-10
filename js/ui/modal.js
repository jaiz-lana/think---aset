/**
 * Helper modal generik — dipakai semua form & dialog konfirmasi.
 * Satu modal aktif dalam satu waktu. Tutup via ESC, klik overlay, atau tombol.
 */
import { esc } from '../utils/dom.js';

let current = null;

// Tutup modal via Escape — listener global, dipasang sekali.
document.addEventListener('keydown', (e) => {
  if (!current) return;
  if (e.key === 'Escape') {
    closeModal();
    return;
  }
  if (e.key !== 'Tab') return;

  const focusable = Array.from(current.overlay.querySelectorAll(
    'a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.getClientRects().length > 0);
  if (focusable.length === 0) {
    e.preventDefault();
    current.overlay.querySelector('[role="dialog"]')?.focus();
    return;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (e.shiftKey && (document.activeElement === first || !current.overlay.contains(document.activeElement))) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && (document.activeElement === last || !current.overlay.contains(document.activeElement))) {
    e.preventDefault();
    first.focus();
  }
});

/**
 * Buka modal.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string|Node} opts.body        HTML string atau Node
 * @param {Array<{label,class?,onClick?,closeOnClick?}>} opts.actions
 * @param {string} [opts.size]           '' | 'modal-sm' | 'modal-lg'
 * @param {Function} [opts.onClose]
 * @returns {HTMLElement} overlay element
 */
export function openModal({ title, body, actions = [], size = '', onClose }) {
  closeModal();
  const previousFocus = document.activeElement;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal ${esc(size)}" role="dialog" aria-modal="true" aria-labelledby="modal-title" tabindex="-1">
      <h2 class="modal-title" id="modal-title">${esc(title || '')}</h2>
      <div class="modal-body"></div>
      <div class="modal-actions"></div>
    </div>`;

  const bodyEl = overlay.querySelector('.modal-body');
  if (typeof body === 'string') bodyEl.innerHTML = body;
  else if (body instanceof Node) bodyEl.appendChild(body);

  const actionsEl = overlay.querySelector('.modal-actions');
  if (actions.length === 0) {
    actionsEl.remove();
  } else {
    for (const act of actions) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = act.class || 'btn btn-ghost';
      btn.textContent = act.label || 'OK';
      btn.addEventListener('click', async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        try {
          const result = act.onClick ? await act.onClick() : undefined;
          if (result !== false && act.closeOnClick !== false) closeModal();
        } catch (e) {
          console.error(e);
        } finally {
          if (document.body.contains(btn)) btn.disabled = false;
        }
      });
      actionsEl.appendChild(btn);
    }
  }

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
  });

  document.body.appendChild(overlay);
  current = { overlay, onClose, previousFocus };

  // Fokuskan elemen pertama
  setTimeout(() => {
    const first = overlay.querySelector('input, select, textarea, button');
    if (first) first.focus();
  }, 50);

  return overlay;
}

export function closeModal() {
  if (!current) return;
  const { overlay, onClose, previousFocus } = current;
  current = null;
  overlay.remove();
  if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
    previousFocus.focus();
  }
  if (typeof onClose === 'function') {
    try { onClose(); } catch (e) { console.error(e); }
  }
}

/** Konfirmasi cepat. Resolve true jika OK, false jika batal. */
export function confirmDialog({ title = 'Konfirmasi', message = 'Lanjutkan?', okLabel = 'Ya', danger = false } = {}) {
  return new Promise((resolve) => {
    let answered = false;
    openModal({
      title,
      size: 'modal-sm',
      body: `<p style="margin:0">${esc(message)}</p>`,
      onClose: () => {
        if (!answered) resolve(false);
      },
      actions: [
        { label: 'Batal', class: 'btn btn-ghost', onClick: () => { answered = true; resolve(false); } },
        {
          label: okLabel,
          class: danger ? 'btn btn-danger' : 'btn btn-primary',
          onClick: () => { answered = true; resolve(true); }
        }
      ]
    });
  });
}