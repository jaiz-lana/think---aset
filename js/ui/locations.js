/**
 * Halaman Lokasi — CRUD dengan dukungan induk (bertingkat).
 * Hapus lokasi yang masih punya anak akan ditolak.
 */
import { getAdapter } from '../auth.js';
import { esc, $ } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

export async function renderLocations(layout) {
  const adapter = getAdapter();
  layout.setActive('/lokasi');
  layout.setTitle('Lokasi');
  layout.setActions('');

  await reload();

  async function reload() {
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⏳</span>
        <div class="empty-state-title">Memuat lokasi…</div>
      </div>`;

    let locs = [];
    try {
      locs = await adapter.list('locations');
    } catch (e) {
      layout.content.innerHTML = `
        <div class="empty-state">
          <span class="empty-state-icon">⚠️</span>
          <div class="empty-state-title">Gagal memuat</div>
          <div class="empty-state-desc">${esc(e.message)}</div>
        </div>`;
      return;
    }

    const canWrite = adapter.canWrite();

    const header = `
      <div class="page-header">
        <h1>Lokasi</h1>
        ${canWrite ? '<button class="btn btn-primary btn-sm" id="btn-add-loc-top">+ Tambah Lokasi</button>' : ''}
      </div>`;

    if (locs.length === 0) {
      layout.content.innerHTML = header + `
        <div class="empty-state">
          <span class="empty-state-icon">📍</span>
          <div class="empty-state-title">Belum ada lokasi</div>
          <div class="empty-state-desc">Lokasi membantu Anda melacak posisi fisik aset (mis. Gudang, Ruang Rapat, Lab A).</div>
          ${canWrite ? '<button class="btn btn-primary" id="btn-add-loc-empty">+ Tambah Lokasi</button>' : ''}
        </div>`;
      $('#btn-add-loc-empty')?.addEventListener('click', () => openForm(null));
      return;
    }

    const tops = locs.filter(l => !l.parent_id);
    const knownIds = new Set(locs.map(l => l.id));
    const orphans = locs.filter(l => l.parent_id && !knownIds.has(l.parent_id));
    const roots = [...tops, ...orphans];

    let rows = '';
    for (const top of roots) {
      rows += renderRow(top, 0, locs, canWrite);
      for (const child of locs.filter(l => l.parent_id === top.id)) {
        rows += renderRow(child, 1, locs, canWrite);
      }
    }

    layout.content.innerHTML = header + `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Induk</th>
              ${canWrite ? '<th style="text-align:right">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    $('#btn-add-loc-top')?.addEventListener('click', () => openForm(null));

    layout.content.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'edit') openForm(id);
        else if (action === 'delete') doDelete(id);
      });
    });

    async function doDelete(id) {
      const target = locs.find(l => l.id === id);
      if (!target) return;
      if (locs.some(l => l.parent_id === id)) {
        notify.error('Lokasi masih memiliki sub-lokasi. Hapus sub-lokasi terlebih dahulu.');
        return;
      }
      const ok = await confirmDialog({
        title: 'Hapus lokasi',
        message: `Hapus lokasi "${target.nama}"? Aset yang memakai lokasi ini tidak akan terhapus.`,
        okLabel: 'Hapus',
        danger: true
      });
      if (!ok) return;
      try {
        await adapter.remove('locations', id);
        notify.success('Lokasi dihapus');
        await reload();
      } catch (e) {
        notify.error('Gagal menghapus: ' + e.message);
      }
    }

    async function openForm(id) {
      const editing = id ? locs.find(l => l.id === id) : null;
      const parents = locs.filter(l => !l.parent_id && l.id !== id);

      openModal({
        title: editing ? 'Edit Lokasi' : 'Tambah Lokasi',
        size: 'modal-sm',
        body: `
          <div class="form-group">
            <label class="form-label">Nama <span style="color:var(--accent-danger)">*</span></label>
            <input class="form-input" id="loc-nama" maxlength="100"
              value="${esc(editing?.nama || '')}" placeholder="Contoh: Gudang Utama" />
          </div>
          <div class="form-group">
            <label class="form-label">Induk Lokasi</label>
            <select class="form-select" id="loc-parent">
              <option value="">— Tidak ada (lokasi utama) —</option>
              ${parents.map(p => `
                <option value="${esc(p.id)}" ${editing?.parent_id === p.id ? 'selected' : ''}>
                  ${esc(p.nama)}
                </option>`).join('')}
            </select>
            <div class="form-hint">Pilih induk jika lokasi ini bagian dari lokasi lain.</div>
          </div>`,
        actions: [
          { label: 'Batal', class: 'btn btn-ghost' },
          {
            label: 'Simpan',
            class: 'btn btn-primary',
            onClick: async () => {
              const nama = $('#loc-nama').value.trim();
              const parent_id = $('#loc-parent').value;

              if (!nama) {
                notify.error('Nama lokasi wajib diisi');
                return false;
              }
              if (nama.length > 100) {
                notify.error('Nama maksimal 100 karakter');
                return false;
              }
              try {
                if (editing) {
                  await adapter.update('locations', id, { nama, parent_id, version: editing.version });
                  notify.success('Lokasi diperbarui');
                } else {
                  await adapter.create('locations', { nama, parent_id });
                  notify.success('Lokasi ditambahkan');
                }
                closeModal();
                await reload();
              } catch (e) {
                if (e.code === 'CONFLICT') {
                  notify.error('Data telah diubah orang lain. Muat ulang halaman lalu coba lagi.');
                } else {
                  notify.error('Gagal menyimpan: ' + e.message);
                }
                return false;
              }
            }
          }
        ]
      });
    }
  }
}

function renderRow(loc, indent, allLocs, canWrite) {
  const parent = loc.parent_id ? allLocs.find(l => l.id === loc.parent_id) : null;
  const indentStyle = indent === 1 ? 'padding-left:28px;' : '';
  const prefix = indent === 1 ? '<span style="color:var(--text-muted);margin-right:6px">└</span>' : '';

  return `
    <tr>
      <td style="${indentStyle}">${prefix}<strong>${esc(loc.nama)}</strong></td>
      <td class="text-muted">${parent ? esc(parent.nama) : '—'}</td>
      ${canWrite ? `<td style="text-align:right">
        <div class="cell-actions" style="justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(loc.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${esc(loc.id)}"
            style="color:var(--accent-danger)">Hapus</button>
        </div>
      </td>` : ''}
    </tr>`;
}