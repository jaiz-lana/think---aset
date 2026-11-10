/**
 * Halaman Kategori — CRUD 2 tingkat (induk & subkategori).
 * Hapus kategori yang masih punya subkategori akan ditolak.
 */
import { getAdapter } from '../auth.js';
import { esc, $ } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

export async function renderCategories(layout) {
  const adapter = getAdapter();
  layout.setActive('/kategori');
  layout.setTitle('Kategori');
  layout.setActions('');

  await reload();

  $('#btn-add-cat-top')?.addEventListener('click', () => openForm(null));

  async function reload() {
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⏳</span>
        <div class="empty-state-title">Memuat kategori…</div>
      </div>`;

    let cats = [];
    try {
      cats = await adapter.list('categories');
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
        <h1>Kategori</h1>
        ${canWrite ? '<button class="btn btn-primary btn-sm" id="btn-add-cat-top">+ Tambah Kategori</button>' : ''}
      </div>`;

    if (cats.length === 0) {
      layout.content.innerHTML = header + `
        <div class="empty-state">
          <span class="empty-state-icon">🗂️</span>
          <div class="empty-state-title">Belum ada kategori</div>
          <div class="empty-state-desc">Kategori membantu Anda mengelompokkan aset (mis. Elektronik, Mebel, Kendaraan).</div>
          ${canWrite ? '<button class="btn btn-primary" id="btn-add-cat-empty">+ Tambah Kategori</button>' : ''}
        </div>`;
      $('#btn-add-cat-empty')?.addEventListener('click', () => openForm(null));
      return;
    }

    // Susun: induk dulu, lalu anak di bawahnya
    const tops = cats.filter(c => !c.parent_id);
    const knownIds = new Set(cats.map(c => c.id));
    const orphans = cats.filter(c => c.parent_id && !knownIds.has(c.parent_id));
    const roots = [...tops, ...orphans];

    let rows = '';
    for (const top of roots) {
      rows += renderRow(top, 0, cats, canWrite);
      for (const child of cats.filter(c => c.parent_id === top.id)) {
        rows += renderRow(child, 1, cats, canWrite);
      }
    }

    layout.content.innerHTML = header + `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Induk</th>
              <th>Umur Ekonomis</th>
              <th>Metode Susut</th>
              ${canWrite ? '<th style="text-align:right">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;

    $('#btn-add-cat-top')?.addEventListener('click', () => openForm(null));

    layout.content.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'edit') openForm(id);
        else if (action === 'delete') doDelete(id);
      });
    });

    async function doDelete(id) {
      const target = cats.find(c => c.id === id);
      if (!target) return;
      if (cats.some(c => c.parent_id === id)) {
        notify.error('Kategori masih memiliki subkategori. Hapus subkategori terlebih dahulu.');
        return;
      }
      const ok = await confirmDialog({
        title: 'Hapus kategori',
        message: `Hapus kategori "${target.nama}"? Aset yang memakai kategori ini tidak akan terhapus, tapi kategorinya menjadi kosong.`,
        okLabel: 'Hapus',
        danger: true
      });
      if (!ok) return;
      try {
        await adapter.remove('categories', id);
        notify.success('Kategori dihapus');
        await reload();
      } catch (e) {
        notify.error('Gagal menghapus: ' + e.message);
      }
    }

    async function openForm(id) {
      const editing = id ? cats.find(c => c.id === id) : null;
      const parents = cats.filter(c => !c.parent_id && c.id !== id);

      openModal({
        title: editing ? 'Edit Kategori' : 'Tambah Kategori',
        size: 'modal-sm',
        body: `
          <div class="form-group">
            <label class="form-label">Nama <span style="color:var(--accent-danger)">*</span></label>
            <input class="form-input" id="cat-nama" maxlength="80"
              value="${esc(editing?.nama || '')}" placeholder="Contoh: Elektronik" />
          </div>
          <div class="form-group">
            <label class="form-label">Induk Kategori</label>
            <select class="form-select" id="cat-parent">
              <option value="">— Tidak ada (kategori utama) —</option>
              ${parents.map(p => `
                <option value="${esc(p.id)}" ${editing?.parent_id === p.id ? 'selected' : ''}>
                  ${esc(p.nama)}
                </option>`).join('')}
            </select>
            <div class="form-hint">Pilih induk jika kategori ini adalah subkategori.</div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Umur Ekonomis (bulan)</label>
              <input class="form-input" id="cat-umur" type="number" min="0" step="1"
                value="${esc(editing?.umur_ekonomis || '')}" placeholder="48" />
            </div>
            <div class="form-group">
              <label class="form-label">Metode Susut</label>
              <select class="form-select" id="cat-metode">
                <option value="garis_lurus" ${(!editing || editing.metode_susut === 'garis_lurus') ? 'selected' : ''}>Garis Lurus</option>
                <option value="saldo_menurun" ${editing?.metode_susut === 'saldo_menurun' ? 'selected' : ''}>Saldo Menurun</option>
              </select>
            </div>
          </div>`,
        actions: [
          { label: 'Batal', class: 'btn btn-ghost' },
          {
            label: 'Simpan',
            class: 'btn btn-primary',
            onClick: async () => {
              const nama = $('#cat-nama').value.trim();
              const parent_id = $('#cat-parent').value;
              const umur_ekonomis = Number($('#cat-umur').value) || 0;
              const metode_susut = $('#cat-metode').value;

              if (!nama) {
                notify.error('Nama kategori wajib diisi');
                return false;
              }
              if (nama.length > 80) {
                notify.error('Nama maksimal 80 karakter');
                return false;
              }
              try {
                const data = { nama, parent_id, umur_ekonomis, metode_susut };
                if (editing) {
                  await adapter.update('categories', id, { ...data, version: editing.version });
                  notify.success('Kategori diperbarui');
                } else {
                  await adapter.create('categories', data);
                  notify.success('Kategori ditambahkan');
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

function renderRow(cat, indent, allCats, canWrite) {
  const parent = cat.parent_id ? allCats.find(c => c.id === cat.parent_id) : null;
  const indentStyle = indent === 1 ? 'padding-left:28px;' : '';
  const prefix = indent === 1 ? '<span style="color:var(--text-muted);margin-right:6px">└</span>' : '';
  const metodeText = cat.metode_susut === 'saldo_menurun' ? 'Saldo menurun'
                    : cat.metode_susut === 'garis_lurus' ? 'Garis lurus' : '—';
  const umurText = cat.umur_ekonomis ? `${esc(cat.umur_ekonomis)} bulan` : '—';

  return `
    <tr>
      <td style="${indentStyle}">${prefix}<strong>${esc(cat.nama)}</strong></td>
      <td class="text-muted">${parent ? esc(parent.nama) : '—'}</td>
      <td>${umurText}</td>
      <td>${esc(metodeText)}</td>
      ${canWrite ? `<td style="text-align:right">
        <div class="cell-actions" style="justify-content:flex-end">
          <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(cat.id)}">Edit</button>
          <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${esc(cat.id)}"
            style="color:var(--accent-danger)">Hapus</button>
        </div>
      </td>` : ''}
    </tr>`;
}