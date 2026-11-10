/**
 * Halaman Penanggung Jawab — CRUD data pemegang aset.
 */
import { getAdapter } from '../auth.js';
import { esc, $ } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';

export async function renderHolders(layout) {
  const adapter = getAdapter();
  layout.setActive('/penanggung-jawab');
  layout.setTitle('Penanggung Jawab');
  layout.setActions('');

  await reload();

  async function reload() {
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⏳</span>
        <div class="empty-state-title">Memuat data…</div>
      </div>`;

    let holders = [];
    try {
      holders = await adapter.list('holders');
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
    holders = holders.slice().sort((a, b) =>
      String(a.nama || '').localeCompare(String(b.nama || ''), 'id')
    );

    const header = `
      <div class="page-header">
        <h1>Penanggung Jawab</h1>
        ${canWrite ? '<button class="btn btn-primary btn-sm" id="btn-add-holder-top">+ Tambah</button>' : ''}
      </div>`;

    if (holders.length === 0) {
      layout.content.innerHTML = header + `
        <div class="empty-state">
          <span class="empty-state-icon">👤</span>
          <div class="empty-state-title">Belum ada penanggung jawab</div>
          <div class="empty-state-desc">Tambahkan nama orang/unit yang bertanggung jawab atas aset.</div>
          ${canWrite ? '<button class="btn btn-primary" id="btn-add-holder-empty">+ Tambah</button>' : ''}
        </div>`;
      $('#btn-add-holder-empty')?.addEventListener('click', () => openForm(null));
      return;
    }

    layout.content.innerHTML = header + `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama</th>
              <th>Jabatan</th>
              <th>Unit</th>
              <th>Kontak</th>
              ${canWrite ? '<th style="text-align:right">Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${holders.map(h => `
              <tr>
                <td><strong>${esc(h.nama || '-')}</strong></td>
                <td>${esc(h.jabatan || '—')}</td>
                <td>${esc(h.unit || '—')}</td>
                <td>${esc(h.kontak || '—')}</td>
                ${canWrite ? `<td style="text-align:right">
                  <div class="cell-actions" style="justify-content:flex-end">
                    <button class="btn btn-ghost btn-sm" data-action="edit" data-id="${esc(h.id)}">Edit</button>
                    <button class="btn btn-ghost btn-sm" data-action="delete" data-id="${esc(h.id)}"
                      style="color:var(--accent-danger)">Hapus</button>
                  </div>
                </td>` : ''}
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    $('#btn-add-holder-top')?.addEventListener('click', () => openForm(null));

    layout.content.querySelectorAll('[data-action]').forEach(el => {
      el.addEventListener('click', () => {
        const action = el.dataset.action;
        const id = el.dataset.id;
        if (action === 'edit') openForm(id);
        else if (action === 'delete') doDelete(id);
      });
    });

    async function doDelete(id) {
      const target = holders.find(h => h.id === id);
      if (!target) return;
      const ok = await confirmDialog({
        title: 'Hapus penanggung jawab',
        message: `Hapus "${target.nama}"? Aset miliknya tidak akan terhapus.`,
        okLabel: 'Hapus',
        danger: true
      });
      if (!ok) return;
      try {
        await adapter.remove('holders', id);
        notify.success('Penanggung jawab dihapus');
        await reload();
      } catch (e) {
        notify.error('Gagal menghapus: ' + e.message);
      }
    }

    async function openForm(id) {
      const editing = id ? holders.find(h => h.id === id) : null;

      openModal({
        title: editing ? 'Edit Penanggung Jawab' : 'Tambah Penanggung Jawab',
        size: 'modal-sm',
        body: `
          <div class="form-group">
            <label class="form-label">Nama <span style="color:var(--accent-danger)">*</span></label>
            <input class="form-input" id="holder-nama" maxlength="100"
              value="${esc(editing?.nama || '')}" placeholder="Contoh: Budi Santoso" />
          </div>
          <div class="form-group">
            <label class="form-label">Jabatan</label>
            <input class="form-input" id="holder-jabatan" maxlength="100"
              value="${esc(editing?.jabatan || '')}" placeholder="Contoh: Staf IT" />
          </div>
          <div class="form-group">
            <label class="form-label">Unit / Departemen</label>
            <input class="form-input" id="holder-unit" maxlength="100"
              value="${esc(editing?.unit || '')}" placeholder="Contoh: Divisi Teknologi" />
          </div>
          <div class="form-group">
            <label class="form-label">Kontak (email/telepon)</label>
            <input class="form-input" id="holder-kontak" maxlength="100"
              value="${esc(editing?.kontak || '')}" placeholder="Contoh: budi@contoh.id" />
          </div>`,
        actions: [
          { label: 'Batal', class: 'btn btn-ghost' },
          {
            label: 'Simpan',
            class: 'btn btn-primary',
            onClick: async () => {
              const nama = $('#holder-nama').value.trim();
              const jabatan = $('#holder-jabatan').value.trim();
              const unit = $('#holder-unit').value.trim();
              const kontak = $('#holder-kontak').value.trim();

              if (!nama) {
                notify.error('Nama wajib diisi');
                return false;
              }
              if (nama.length > 100) {
                notify.error('Nama maksimal 100 karakter');
                return false;
              }
              try {
                const data = { nama, jabatan, unit, kontak };
                if (editing) {
                  await adapter.update('holders', id, { ...data, version: editing.version });
                  notify.success('Penanggung jawab diperbarui');
                } else {
                  await adapter.create('holders', data);
                  notify.success('Penanggung jawab ditambahkan');
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