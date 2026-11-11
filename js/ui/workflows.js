import { getAdapter } from '../auth.js';
import { esc } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { confirmDialog, openModal } from './modal.js';
import { exportToCSV } from '../utils/excel.js';
import { formatRupiahFull, computeDepreciation } from '../utils/depreciation.js';
import { qrToken } from '../utils/uuid.js';

const WORKFLOWS = {
  history: {
    title: 'Riwayat Aset', table: 'asset_history',
    fields: [
      { key: 'asset_id', label: 'Aset', type: 'asset', required: true },
      { key: 'jenis', label: 'Jenis perubahan', type: 'select', required: true,
        options: [['perpindahan', 'Perpindahan'], ['kondisi', 'Kondisi'], ['perawatan', 'Perawatan'], ['lainnya', 'Lainnya']] },
      { key: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { key: 'dari', label: 'Dari' }, { key: 'ke', label: 'Ke' },
      { key: 'catatan', label: 'Catatan', type: 'textarea' }
    ],
    columns: [['asset_id', 'Aset'], ['jenis', 'Jenis'], ['tanggal', 'Tanggal'], ['dari', 'Dari'], ['ke', 'Ke'], ['catatan', 'Catatan']]
  },
  finance: {
    title: 'Keuangan Aset', table: 'asset_finance',
    fields: [
      { key: 'asset_id', label: 'Aset', type: 'asset', required: true },
      { key: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { key: 'jenis', label: 'Jenis', type: 'select', required: true, options: [['pengeluaran', 'Pengeluaran'], ['pemasukan', 'Pemasukan']] },
      { key: 'kategori', label: 'Kategori', required: true, placeholder: 'Perawatan, asuransi, penjualan…' },
      { key: 'nominal', label: 'Nominal (Rp)', type: 'number', required: true, min: 0 },
      { key: 'bukti_id', label: 'Bukti transaksi', type: 'file' },
      { key: 'catatan', label: 'Catatan', type: 'textarea' }
    ],
    columns: [['asset_id', 'Aset'], ['tanggal', 'Tanggal'], ['jenis', 'Jenis'], ['kategori', 'Kategori'], ['nominal', 'Nominal'], ['catatan', 'Catatan']]
  },
  agenda: {
    title: 'Agenda & Kalender', table: 'agendas',
    fields: [
      { key: 'judul', label: 'Agenda', required: true },
      { key: 'asset_id', label: 'Aset terkait', type: 'asset' },
      { key: 'tanggal', label: 'Tanggal & waktu', type: 'datetime-local', required: true },
      { key: 'berulang', label: 'Pengulangan', type: 'select', options: [['', 'Tidak berulang'], ['mingguan', 'Mingguan'], ['bulanan', 'Bulanan'], ['tahunan', 'Tahunan']] },
      { key: 'pengingat_hari', label: 'Ingatkan (hari sebelumnya)', type: 'number', min: 0 },
      { key: 'selesai', label: 'Status', type: 'select', options: [['false', 'Belum selesai'], ['true', 'Selesai']] }
    ],
    columns: [['judul', 'Agenda'], ['asset_id', 'Aset'], ['tanggal', 'Tanggal'], ['berulang', 'Pengulangan'], ['selesai', 'Status']]
  },
  journal: {
    title: 'Jurnal', table: 'journals',
    fields: [
      { key: 'tanggal', label: 'Tanggal', type: 'date', required: true },
      { key: 'judul', label: 'Judul', required: true },
      { key: 'asset_id', label: 'Aset terkait', type: 'asset' },
      { key: 'foto_id', label: 'Foto kegiatan', type: 'file', accept: 'image/*' },
      { key: 'isi', label: 'Catatan kegiatan', type: 'textarea', required: true }
    ],
    columns: [['tanggal', 'Tanggal'], ['judul', 'Judul'], ['asset_id', 'Aset'], ['isi', 'Catatan']]
  },
  loans: {
    title: 'Peminjaman Aset', table: 'loans',
    fields: [
      { key: 'asset_id', label: 'Aset', type: 'asset', required: true },
      { key: 'peminjam', label: 'Nama peminjam', required: true },
      { key: 'tgl_pinjam', label: 'Tanggal pinjam', type: 'date', required: true },
      { key: 'tgl_jatuh_tempo', label: 'Tanggal jatuh tempo', type: 'date', required: true },
      { key: 'tgl_kembali', label: 'Tanggal kembali', type: 'date' },
      { key: 'kondisi_kembali', label: 'Kondisi saat kembali', type: 'select',
        options: [['', 'Belum dikembalikan'], ['baik', 'Baik'], ['rusak_ringan', 'Rusak ringan'], ['rusak_berat', 'Rusak berat']] }
    ],
    columns: [['asset_id', 'Aset'], ['peminjam', 'Peminjam'], ['tgl_pinjam', 'Dipinjam'], ['tgl_jatuh_tempo', 'Jatuh tempo'], ['tgl_kembali', 'Dikembalikan'], ['status', 'Status']]
  }
};

export async function renderWorkflow(layout, featureId, { query } = {}) {
  if (WORKFLOWS[featureId]) return renderManager(layout, WORKFLOWS[featureId], query);
  if (featureId === 'audit') return renderAudit(layout, query);
  if (featureId === 'reports') return renderReports(layout);
  if (featureId === 'members') return renderMembers(layout);
  if (featureId === 'branding') return renderBranding(layout);
  if (featureId === 'reminders') return renderReminders(layout);
  if (featureId === 'calendar-sync') return renderCalendar(layout);
  if (featureId === 'qr-cards') return renderQrCards(layout, query);
  if (featureId === 'scan') return renderScanner(layout);
  throw new Error(`Halaman fitur tidak dikenal: ${featureId}`);
}

async function renderManager(layout, workflow, query) {
  const adapter = getAdapter();
  layout.setTitle(workflow.title);
  layout.setActive(workflow.table === 'asset_history' ? '/riwayat'
    : workflow.table === 'asset_finance' ? '/keuangan'
      : workflow.table === 'agendas' ? '/agenda'
        : workflow.table === 'journals' ? '/jurnal' : '/peminjaman');
  const [allRows, assets] = await Promise.all([adapter.list(workflow.table), adapter.list('assets')]);
  const rows = query?.get('asset')
    ? allRows.filter(row => row.asset_id === query.get('asset'))
    : allRows;
  const assetNames = new Map(assets.map(asset => [asset.id, asset.kode ? `${asset.kode} · ${asset.nama}` : asset.nama]));
  const canWrite = adapter.canWrite();
  const rowsSorted = rows.slice().sort((a, b) => String(b.tanggal || b.tgl_pinjam || '').localeCompare(String(a.tanggal || a.tgl_pinjam || '')));
  const renderValue = (row, key) => {
    let value = row[key] ?? '';
    if (key === 'asset_id') value = value ? assetNames.get(value) || 'Aset dihapus' : '—';
    if (key === 'nominal') value = formatRupiahFull(value);
    if (key === 'selesai') value = value === true || value === 'true' ? 'Selesai' : 'Belum selesai';
    if (key === 'status' && workflow.table === 'loans') value = row.tgl_kembali ? 'Dikembalikan' : 'Dipinjam';
    return esc(String(value));
  };
  layout.content.innerHTML = `
    <div class="page-header"><h1>${esc(workflow.title)}</h1>
      ${canWrite ? '<button class="btn btn-primary btn-sm" id="workflow-add">+ Tambah</button>' : ''}
      ${workflow.table === 'agendas' ? '<button class="btn btn-secondary btn-sm" id="workflow-ics">Unduh kalender (.ics)</button>' : ''}
    </div>
    ${canWrite ? `<form class="card hidden" id="workflow-form" style="margin-bottom:20px">
      <h2 id="workflow-form-title" style="margin-top:0;font-size:1.1rem">Tambah</h2>
      <div class="workflow-fields">${workflow.fields.map(field => renderField(field, assets)).join('')}</div>
      <div class="row mt-3"><button class="btn btn-primary" type="submit">Simpan</button><button class="btn btn-ghost" id="workflow-cancel" type="button">Batal</button></div>
    </form>` : ''}
    ${rowsSorted.length ? `<div class="table-wrap"><table class="data-table"><thead><tr>${workflow.columns.map(([, label]) => `<th>${esc(label)}</th>`).join('')}${canWrite ? '<th>Aksi</th>' : ''}</tr></thead>
      <tbody>${rowsSorted.map(row => `<tr>${workflow.columns.map(([key]) => `<td>${renderValue(row, key)}</td>`).join('')}
        ${canWrite ? `<td><div class="row" style="gap:4px">
          ${workflow.table === 'loans' && !row.tgl_kembali ? `<button class="btn btn-secondary btn-sm" data-return="${esc(row.id)}">Kembalikan</button>` : ''}
          <button class="btn btn-ghost btn-sm" data-edit="${esc(row.id)}">Edit</button><button class="btn btn-ghost btn-sm" data-delete="${esc(row.id)}">Hapus</button>
        </div></td>` : ''}</tr>`).join('')}</tbody></table></div>`
      : '<div class="empty-state"><span class="empty-state-icon">🗂️</span><div class="empty-state-title">Belum ada data</div><div class="empty-state-desc">Tambahkan catatan baru untuk memulai.</div></div>'}
  `;
  layout.content.querySelector('#workflow-ics')?.addEventListener('click', () => downloadCalendar(rows));
  if (!canWrite) return;
  const form = layout.content.querySelector('#workflow-form');
  let editing = null;
  const showForm = row => {
    editing = row || null;
    form.classList.remove('hidden');
    form.querySelector('#workflow-form-title').textContent = editing ? 'Ubah catatan' : 'Tambah catatan';
    for (const field of workflow.fields) {
      const input = form.elements.namedItem(field.key);
      if (!input) continue;
      if (field.type === 'file') continue;
      let value = editing?.[field.key] ?? '';
      if (!editing && field.key === 'asset_id' && query?.get('asset')) value = query.get('asset');
      if (field.type === 'datetime-local' && value) value = String(value).slice(0, 16);
      if (field.key === 'selesai') value = value === true || value === 'true' ? 'true' : 'false';
      input.value = value;
    }
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  layout.content.querySelector('#workflow-add').addEventListener('click', () => showForm(null));
  layout.content.querySelector('#workflow-cancel').addEventListener('click', () => { form.classList.add('hidden'); editing = null; });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const data = {};
    for (const field of workflow.fields) {
      const input = form.elements.namedItem(field.key);
      let value;
      if (field.type === 'file') {
        const file = input.files?.[0];
        if (file && file.size > 10_000_000) return notify.error(`${field.label} maksimal 10 MB`);
        if (file) {
          try { value = (await adapter.uploadFile(file)).id; }
          catch (error) { return notify.error(`Gagal mengunggah ${field.label.toLowerCase()}: ${error.message}`); }
        } else value = editing?.[field.key] || '';
      } else {
        value = input.value.trim();
      }
      if (field.required && !value) return notify.error(`${field.label} wajib diisi`);
      if (field.type === 'number') value = value === '' ? '' : Number(value);
      if (field.key === 'selesai') value = value === 'true';
      data[field.key] = value;
    }
    if (workflow.table === 'asset_history') data.user = adapter.user?.email || '';
    if (workflow.table === 'loans') data.status = data.tgl_kembali ? 'dikembalikan' : 'dipinjam';
    try {
      if (editing) await adapter.update(workflow.table, editing.id, { ...data, version: editing.version });
      else await adapter.create(workflow.table, data);
      notify.success(editing ? 'Catatan diperbarui' : 'Catatan ditambahkan');
      await renderManager(layout, workflow, query);
    } catch (error) { notify.error('Gagal menyimpan: ' + error.message); }
  });
  layout.content.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
    const row = rows.find(item => item.id === button.dataset.edit);
    if (row) showForm(row);
  }));
  layout.content.querySelectorAll('[data-delete]').forEach(button => button.addEventListener('click', async () => {
    const row = rows.find(item => item.id === button.dataset.delete);
    if (!row || !await confirmDialog({ title: 'Hapus catatan', message: 'Catatan ini akan dihapus permanen.', okLabel: 'Hapus', danger: true })) return;
    try { await adapter.remove(workflow.table, row.id); notify.success('Catatan dihapus'); await renderManager(layout, workflow, query); }
    catch (error) { notify.error('Gagal menghapus: ' + error.message); }
  }));
  layout.content.querySelectorAll('[data-return]').forEach(button => button.addEventListener('click', async () => {
    const row = rows.find(item => item.id === button.dataset.return);
    if (!row) return;
    const returned = new Date().toISOString().slice(0, 10);
    try {
      await adapter.update('loans', row.id, { tgl_kembali: returned, status: 'dikembalikan', kondisi_kembali: row.kondisi_kembali || 'baik', version: row.version });
      notify.success('Peminjaman ditandai selesai');
      await renderManager(layout, workflow, query);
    } catch (error) { notify.error('Gagal menyimpan pengembalian: ' + error.message); }
  }));
}

function renderField(field, assets) {
  const id = `wf-${field.key}`;
  let control;
  if (field.type === 'select') {
    control = `<select class="form-select" id="${id}" name="${esc(field.key)}">${field.options.map(([value, label]) => `<option value="${esc(value)}">${esc(label)}</option>`).join('')}</select>`;
  } else if (field.type === 'asset') {
    control = `<select class="form-select" id="${id}" name="${esc(field.key)}" ${field.required ? 'required' : ''}>
      <option value="">${field.required ? 'Pilih aset' : 'Tidak terkait aset'}</option>${assets.map(asset => `<option value="${esc(asset.id)}">${esc(asset.kode ? `${asset.kode} · ${asset.nama}` : asset.nama)}</option>`).join('')}
    </select>`;
  } else if (field.type === 'file') {
    control = `<input class="form-input" id="${id}" name="${esc(field.key)}" type="file" ${field.accept ? `accept="${esc(field.accept)}"` : ''} />`;
  } else if (field.type === 'textarea') {
    control = `<textarea class="form-input" id="${id}" name="${esc(field.key)}" rows="3" ${field.required ? 'required' : ''}></textarea>`;
  } else {
    control = `<input class="form-input" id="${id}" name="${esc(field.key)}" type="${esc(field.type || 'text')}" ${field.required ? 'required' : ''} ${field.min != null ? `min="${field.min}"` : ''} ${field.placeholder ? `placeholder="${esc(field.placeholder)}"` : ''} />`;
  }
  return `<div class="form-group"><label class="form-label" for="${id}">${esc(field.label)}${field.required ? ' *' : ''}</label>${control}</div>`;
}

async function renderAudit(layout, query) {
  const adapter = getAdapter();
  layout.setActive('/audit');
  layout.setTitle('Audit Stok Opname');
  const [audits, assets, locations, allItems] = await Promise.all([
    adapter.list('audits'), adapter.list('assets'), adapter.list('locations'), adapter.list('audit_items')
  ]);
  const auditId = query?.get('id') || '';
  const audit = audits.find(item => item.id === auditId);
  const canWrite = adapter.canWrite();
  layout.content.innerHTML = `
    <div class="page-header"><h1>Audit Stok Opname</h1>${canWrite ? '<button class="btn btn-primary btn-sm" id="audit-new">+ Sesi audit baru</button>' : ''}</div>
    ${audit ? `
      <div class="card" style="margin-bottom:16px"><div class="row-between"><div><h2 style="margin:0">${esc(audit.nama)}</h2><p class="text-sm text-muted">${esc(audit.periode)} · ${esc(locations.find(l => l.id === audit.lokasi_id)?.nama || 'Semua lokasi')} · ${esc(audit.status)}</p></div>
      ${canWrite && audit.status !== 'selesai' ? '<button class="btn btn-secondary btn-sm" id="audit-complete">Selesaikan audit</button>' : ''}</div></div>
      <div class="table-wrap"><table class="data-table"><thead><tr><th>Aset</th><th>Kondisi sistem</th><th>Hasil pemeriksaan</th><th>Catatan</th><th></th></tr></thead><tbody>
      ${assets.filter(a => !audit.lokasi_id || a.location_id === audit.lokasi_id).map(asset => {
        const row = allItems.find(item => item.audit_id === audit.id && item.asset_id === asset.id);
        return `<tr><td>${esc(asset.kode || '')} · ${esc(asset.nama)}</td><td>${esc(asset.kondisi || '—')}</td><td>
          ${canWrite && audit.status !== 'selesai' ? `<select class="form-select" data-audit-result="${esc(asset.id)}">
            <option value="">Belum diperiksa</option><option value="sesuai" ${row?.hasil === 'sesuai' ? 'selected' : ''}>Sesuai</option><option value="rusak" ${row?.hasil === 'rusak' ? 'selected' : ''}>Rusak</option><option value="hilang" ${row?.hasil === 'hilang' ? 'selected' : ''}>Hilang</option><option value="lebih" ${row?.hasil === 'lebih' ? 'selected' : ''}>Tidak terdaftar</option></select>`
            : esc(row?.hasil || 'Belum diperiksa')}</td>
          <td>${canWrite && audit.status !== 'selesai' ? `<input class="form-input" data-audit-note="${esc(asset.id)}" value="${esc(row?.catatan || '')}" />` : esc(row?.catatan || '')}</td>
          <td>${canWrite && audit.status !== 'selesai' ? `<button class="btn btn-primary btn-sm" data-audit-save="${esc(asset.id)}">Simpan</button>` : ''}</td></tr>`;
      }).join('')}
      </tbody></table></div>
    ` : `<div class="table-wrap"><table class="data-table"><thead><tr><th>Nama sesi</th><th>Periode</th><th>Lokasi</th><th>Status</th><th></th></tr></thead><tbody>
      ${audits.map(item => `<tr><td>${esc(item.nama)}</td><td>${esc(item.periode)}</td><td>${esc(locations.find(l => l.id === item.lokasi_id)?.nama || 'Semua lokasi')}</td><td>${esc(item.status)}</td><td><a class="btn btn-ghost btn-sm" href="#/audit?id=${encodeURIComponent(item.id)}">Buka</a></td></tr>`).join('') || '<tr><td colspan="5">Belum ada sesi audit.</td></tr>'}
      </tbody></table></div>`}
  `;
  if (!canWrite) return;
  layout.content.querySelector('#audit-new')?.addEventListener('click', async () => {
    openModal({
      title: 'Sesi audit baru',
      size: 'modal-sm',
      body: `<div class="form-group"><label class="form-label" for="audit-name">Nama sesi</label><input id="audit-name" class="form-input" maxlength="100" required /></div>
        <div class="form-group"><label class="form-label" for="audit-date">Periode</label><input id="audit-date" class="form-input" type="date" value="${new Date().toISOString().slice(0, 10)}" required /></div>
        <div class="form-group"><label class="form-label" for="audit-location">Lokasi</label><select id="audit-location" class="form-select"><option value="">Semua lokasi</option>${locations.map(loc => `<option value="${esc(loc.id)}">${esc(loc.nama)}</option>`).join('')}</select></div>`,
      actions: [
        { label: 'Batal', class: 'btn btn-ghost' },
        {
          label: 'Mulai audit',
          class: 'btn btn-primary',
          onClick: async () => {
            const nama = document.getElementById('audit-name').value.trim();
            const periode = document.getElementById('audit-date').value;
            if (!nama || !periode) { notify.error('Nama sesi dan periode wajib diisi'); return false; }
            try {
              const created = await adapter.create('audits', {
                nama, periode, lokasi_id: document.getElementById('audit-location').value, status: 'berjalan'
              });
              window.location.hash = `/audit?id=${encodeURIComponent(created.id)}`;
            } catch (error) { notify.error('Gagal membuat sesi: ' + error.message); return false; }
          }
        }
      ]
    });
  });
  layout.content.querySelectorAll('[data-audit-save]').forEach(button => button.addEventListener('click', async () => {
    const assetId = button.dataset.auditSave;
    const result = layout.content.querySelector(`[data-audit-result="${CSS.escape(assetId)}"]`).value;
    if (!result) return notify.error('Pilih hasil pemeriksaan');
    const note = layout.content.querySelector(`[data-audit-note="${CSS.escape(assetId)}"]`).value.trim();
    const existing = allItems.find(item => item.audit_id === audit.id && item.asset_id === assetId);
    try {
      if (existing) await adapter.update('audit_items', existing.id, { hasil: result, catatan: note, version: existing.version });
      else await adapter.create('audit_items', { audit_id: audit.id, asset_id: assetId, hasil: result, catatan: note });
      notify.success('Hasil pemeriksaan disimpan');
    } catch (error) { notify.error('Gagal menyimpan: ' + error.message); }
  }));
  layout.content.querySelector('#audit-complete')?.addEventListener('click', async () => {
    if (!await confirmDialog({ title: 'Selesaikan audit', message: 'Sesi audit akan dikunci dan tidak dapat diubah.', okLabel: 'Selesaikan' })) return;
    try {
      await adapter.update('audits', audit.id, { status: 'selesai', version: audit.version });
      notify.success('Audit selesai');
      window.location.hash = '/audit';
    } catch (error) { notify.error('Gagal menyelesaikan audit: ' + error.message); }
  });
}

async function renderReports(layout) {
  const adapter = getAdapter();
  layout.setActive('/laporan'); layout.setTitle('Laporan Lanjutan');
  const [assets, categories, locations, finance, loans, audits, items] = await Promise.all([
    adapter.list('assets'), adapter.list('categories'), adapter.list('locations'),
    adapter.list('asset_finance'), adapter.list('loans'), adapter.list('audits'), adapter.list('audit_items')
  ]);
  const groups = (key, records) => [...new Set(records.map(row => row[key]).filter(Boolean))].map(id => ({
    id, count: records.filter(row => row[key] === id).length,
    title: key === 'category_id' ? categories.find(row => row.id === id)?.nama || 'Tanpa kategori' : locations.find(row => row.id === id)?.nama || 'Tanpa lokasi'
  }));
  const totalBookValue = assets.reduce((sum, asset) => sum + computeDepreciation(asset).nilai_buku, 0);
  layout.content.innerHTML = `
    <div class="page-header"><h1>Laporan Lanjutan</h1><button class="btn btn-primary btn-sm" id="report-export">Ekspor CSV</button></div>
    <div class="dash-grid">
      ${reportCard('Jumlah aset', assets.length)}
      ${reportCard('Nilai buku saat ini', formatRupiahFull(totalBookValue))}
      ${reportCard('Transaksi keuangan', finance.length)}
      ${reportCard('Peminjaman aktif', loans.filter(row => !row.tgl_kembali).length)}
      ${reportCard('Sesi audit', audits.length)}
      ${reportCard('Aset diaudit', items.length)}
    </div>
    ${renderGroupReport('Aset per kategori', groups('category_id', assets))}
    ${renderGroupReport('Aset per lokasi', groups('location_id', assets))}
    <div class="card"><h2 style="margin-top:0">Ringkasan keuangan</h2>
      <p>Pemasukan: <strong>${esc(formatRupiahFull(finance.filter(row => row.jenis === 'pemasukan').reduce((n, row) => n + Number(row.nominal || 0), 0)))}</strong></p>
      <p>Pengeluaran: <strong>${esc(formatRupiahFull(finance.filter(row => row.jenis !== 'pemasukan').reduce((n, row) => n + Number(row.nominal || 0), 0)))}</strong></p>
    </div>`;
  layout.content.querySelector('#report-export').addEventListener('click', () => {
    const columns = [
      { key: 'kode', label: 'Kode' }, { key: 'nama', label: 'Nama' },
      { key: 'category_id', label: 'Kategori', format: id => categories.find(c => c.id === id)?.nama || '' },
      { key: 'location_id', label: 'Lokasi', format: id => locations.find(l => l.id === id)?.nama || '' },
      { key: 'kondisi', label: 'Kondisi' }, { key: 'status', label: 'Status' },
      { key: 'harga', label: 'Harga perolehan' },
      { key: 'nilai_kini', label: 'Nilai buku', format: (_, row) => computeDepreciation(row).nilai_buku }
    ];
    exportToCSV(assets, columns, 'laporan-aset.csv');
    notify.success('Laporan CSV diunduh');
  });
}

function reportCard(label, value) {
  return `<div class="dash-card"><div class="dash-card-label">${esc(label)}</div><div class="dash-card-value">${esc(String(value))}</div></div>`;
}

function renderGroupReport(title, groups) {
  return `<div class="card" style="margin:16px 0"><h2 style="margin-top:0">${esc(title)}</h2>
    ${groups.length ? groups.map(group => `<div class="kv-row"><span>${esc(group.title)}</span><strong>${group.count}</strong></div>`).join('') : '<p class="text-sm text-muted">Belum ada data.</p>'}
  </div>`;
}

async function renderMembers(layout) {
  const adapter = getAdapter();
  layout.setActive('/anggota'); layout.setTitle('Anggota & Berbagi');
  if (adapter.mode !== 'google') {
    layout.content.innerHTML = `<div class="page-header"><h1>Anggota & Berbagi</h1></div>
      <div class="notice">Berbagi workspace memerlukan penyimpanan Google Drive. Mode lokal hanya dapat dibagikan dengan mengekspor dan memulihkan backup JSON.</div>`;
    return;
  }
  let members;
  try { members = await adapter.listMembers(); }
  catch (error) { layout.content.innerHTML = `<div class="notice">Gagal memuat anggota: ${esc(error.message)}</div>`; return; }
  const sheetUrl = adapter.spreadsheetId ? `https://docs.google.com/spreadsheets/d/${adapter.spreadsheetId}/edit` : '';

  layout.content.innerHTML = `
    <div class="page-header"><h1>Anggota & Berbagi</h1></div>

    <div class="card" style="margin-bottom:16px;background:var(--bg-card);border:1px solid var(--border)">
      <h2 style="margin-top:0;font-size:1.1rem">Link & ID Workspace Anda</h2>
      <p class="text-xs text-muted" style="margin-bottom:10px">Bagikan link atau ID ini ke anggota tim Anda agar mereka bisa login dan membuka workspace yang sama.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input class="form-input text-xs" style="flex:1;min-width:240px" readonly value="${esc(sheetUrl)}" id="shared-sheet-url" />
        <button class="btn btn-secondary btn-sm" id="btn-copy-sheet-url">📋 Salin Link</button>
        <button class="btn btn-ghost btn-sm" id="btn-copy-sheet-id">Salin ID Saja</button>
        <a class="btn btn-ghost btn-sm" href="${esc(sheetUrl)}" target="_blank" rel="noopener">Buka di Google Sheets ↗</a>
      </div>
    </div>

    ${adapter.isOwner() ? `<form id="member-invite" class="card" style="margin-bottom:16px">
      <h2 style="margin-top:0;font-size:1.1rem">Undang anggota</h2>
      <div class="form-row"><div class="form-group"><label class="form-label" for="member-email">Email Google</label><input id="member-email" class="form-input" type="email" required /></div>
      <div class="form-group"><label class="form-label" for="member-role">Peran</label><select class="form-select" id="member-role"><option value="editor">Editor</option><option value="viewer">Viewer</option></select></div>
      <button class="btn btn-primary" type="submit">Bagikan</button></div>
    </form>` : '<p class="text-sm text-muted">Hanya pemilik workspace yang dapat mengundang anggota.</p>'}
    <div class="table-wrap"><table class="data-table"><thead><tr><th>Anggota</th><th>Email</th><th>Peran</th></tr></thead>
      <tbody>${members.map(member => `<tr><td>${esc(member.name)}</td><td>${esc(member.email)}</td><td>${esc(member.role)}</td></tr>`).join('') || '<tr><td colspan="3">Belum ada anggota.</td></tr>'}</tbody></table></div>`;
  layout.content.querySelector('#member-invite')?.addEventListener('submit', async event => {
    event.preventDefault();
    const email = layout.content.querySelector('#member-email').value.trim();
    const role = layout.content.querySelector('#member-role').value;
    try { await adapter.shareWith(email, role); notify.success(`Undangan dikirim ke ${email}`); await renderMembers(layout); }
    catch (error) { notify.error('Gagal berbagi workspace: ' + error.message); }
  });

  layout.content.querySelector('#btn-copy-sheet-url')?.addEventListener('click', () => {
    if (!sheetUrl) return;
    navigator.clipboard.writeText(sheetUrl);
    notify.success('Link Google Sheet berhasil disalin!');
  });

  layout.content.querySelector('#btn-copy-sheet-id')?.addEventListener('click', () => {
    if (!adapter.spreadsheetId) return;
    navigator.clipboard.writeText(adapter.spreadsheetId);
    notify.success('Spreadsheet ID berhasil disalin!');
  });
}

async function renderBranding(layout) {
  const adapter = getAdapter();
  layout.setActive('/branding'); layout.setTitle('Logo & Branding Organisasi');
  const settings = await adapter.list('settings');
  const value = key => settings.find(row => row.key === key)?.value || '';
  const logoId = value('branding_logo_id');
  const logoUrl = logoId ? await adapter.getFileUrl(logoId) : '';
  layout.content.innerHTML = `
    <div class="page-header"><h1>Logo & Branding Organisasi</h1></div>
    <form class="card" id="branding-form">
      <div class="form-group"><label class="form-label" for="branding-name">Nama aplikasi/workspace</label><input class="form-input" id="branding-name" maxlength="80" value="${esc(value('branding_name'))}" ${adapter.canWrite() ? '' : 'readonly'} /></div>
      <div class="form-group"><label class="form-label" for="branding-logo">Logo organisasi</label><input class="form-input" id="branding-logo" type="file" accept="image/png,image/jpeg,image/webp" ${adapter.canWrite() ? '' : 'disabled'} />
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo saat ini" style="display:block;width:96px;height:96px;object-fit:contain;margin-top:12px" />` : '<p class="text-xs text-muted">Belum ada logo yang diunggah.</p>'}
      </div>
      ${adapter.canWrite() ? '<button class="btn btn-primary" type="submit">Simpan branding</button>' : '<p class="text-xs text-muted">Hanya pemilik/editor yang dapat mengubah branding.</p>'}
    </form>`;
  if (!adapter.canWrite()) return;
  layout.content.querySelector('#branding-form').addEventListener('submit', async event => {
    event.preventDefault();
    const input = layout.content.querySelector('#branding-logo');
    try {
      await adapter.create('settings', { key: 'branding_name', value: layout.content.querySelector('#branding-name').value.trim() });
      if (input.files?.[0]) {
        const file = input.files[0];
        if (file.size > 5_000_000) throw new Error('Logo harus berukuran maksimal 5 MB');
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) throw new Error('Format logo harus PNG, JPEG, atau WebP');
        const response = await adapter.uploadFile(file);
        await adapter.create('settings', { key: 'branding_logo_id', value: response.id });
      }
      notify.success('Branding disimpan. Memuat ulang aplikasi…');
      setTimeout(() => window.location.reload(), 500);
    } catch (error) { notify.error('Gagal menyimpan branding: ' + error.message); }
  });
}

async function renderReminders(layout) {
  const adapter = getAdapter();
  layout.setActive('/pengingat'); layout.setTitle('Pengingat Otomatis');
  const agendas = await adapter.list('agendas');
  const permitted = 'Notification' in window;
  const enabled = localStorage.getItem('ta_reminders_enabled') === 'true';
  layout.content.innerHTML = `
    <div class="page-header"><h1>Pengingat Otomatis</h1></div>
    <div class="card">
      <p>Pengingat agenda dikirim sebagai notifikasi browser saat Think Aset terbuka. Izinkan notifikasi dan biarkan aplikasi berjalan agar pemeriksaan pengingat aktif.</p>
      ${permitted ? `<button class="btn ${enabled ? 'btn-secondary' : 'btn-primary'}" id="reminder-toggle">${enabled ? 'Matikan pengingat' : 'Aktifkan pengingat browser'}</button>` : '<div class="notice">Browser ini tidak mendukung Notification API.</div>'}
      <p class="text-xs text-muted mt-3">Notifikasi yang berjalan saat aplikasi ditutup memerlukan push service/Apps Script deployment, yang tidak disiapkan pada aplikasi statis ini.</p>
      <h2 style="font-size:1rem">Agenda mendatang</h2>
      ${agendas.filter(row => !isComplete(row.selesai)).slice(0, 8).map(row => `<div class="kv-row"><span>${esc(row.judul)}</span><strong>${esc(row.tanggal)}</strong></div>`).join('') || '<p class="text-sm text-muted">Tidak ada agenda aktif.</p>'}
    </div>`;
  layout.content.querySelector('#reminder-toggle')?.addEventListener('click', async () => {
    if (localStorage.getItem('ta_reminders_enabled') === 'true') localStorage.removeItem('ta_reminders_enabled');
    else {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') return notify.error('Izin notifikasi tidak diberikan');
      localStorage.setItem('ta_reminders_enabled', 'true');
      checkReminders(agendas);
    }
    await renderReminders(layout);
  });
}

const notifiedReminders = new Set();
function checkReminders(agendas) {
  if (!('Notification' in window) || localStorage.getItem('ta_reminders_enabled') !== 'true' || Notification.permission !== 'granted') return;
  const now = Date.now();
  for (const agenda of agendas) {
    if (isComplete(agenda.selesai)) continue;
    const date = new Date(agenda.tanggal).getTime() - Number(agenda.pengingat_hari || 0) * 86400000;
    if (!Number.isFinite(date) || date > now || date < now - 86400000) continue;
    const key = `${agenda.id}:${new Date(agenda.tanggal).toISOString().slice(0, 10)}`;
    if (notifiedReminders.has(key) || localStorage.getItem(`ta_reminder_${key}`)) continue;
    notifiedReminders.add(key);
    localStorage.setItem(`ta_reminder_${key}`, '1');
    new Notification('Think Aset · Pengingat agenda', { body: agenda.judul, tag: key });
  }
}
setInterval(async () => {
  try { checkReminders(await getAdapter().list('agendas')); }
  catch (error) { console.warn('Pemeriksaan pengingat gagal:', error); }
}, 5 * 60 * 1000);

async function renderCalendar(layout) {
  const adapter = getAdapter();
  layout.setActive('/kalender-google'); layout.setTitle('Ekspor Kalender');
  const agendas = await adapter.list('agendas');
  layout.content.innerHTML = `<div class="page-header"><h1>Kalender</h1><div class="row">
      ${adapter.mode === 'google' && adapter.canWrite() ? '<button class="btn btn-primary btn-sm" id="calendar-sync">Sinkronkan ke Google Calendar</button>' : ''}
      <button class="btn btn-secondary btn-sm" id="calendar-download">Unduh .ics</button></div></div>
    <div class="notice">Sinkronisasi Google mengirim agenda dari Think Aset ke kalender utama (satu arah) dan memerlukan izin Calendar saat pertama kali digunakan. Berkas .ics dapat diimpor di aplikasi kalender lain.</div>
    ${agendas.length ? `<div class="table-wrap"><table class="data-table"><thead><tr><th>Agenda</th><th>Tanggal</th><th>Selesai</th></tr></thead><tbody>${agendas.map(row => `<tr><td>${esc(row.judul)}</td><td>${esc(row.tanggal)}</td><td>${isComplete(row.selesai) ? 'Ya' : 'Tidak'}</td></tr>`).join('')}</tbody></table></div>` : '<p class="text-sm text-muted">Belum ada agenda untuk diekspor.</p>'}`;
  layout.content.querySelector('#calendar-download').addEventListener('click', () => downloadCalendar(agendas));
  layout.content.querySelector('#calendar-sync')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    const pending = agendas.filter(agenda => !isComplete(agenda.selesai));
    if (!pending.length) return notify.info('Tidak ada agenda aktif untuk disinkronkan.');
    button.disabled = true;
    button.textContent = 'Menyinkronkan…';
    try {
      await adapter.requestCalendarAccess();
      let synced = 0;
      const failures = [];
      for (const agenda of pending) {
        try { await adapter.syncAgendaToCalendar(agenda); synced++; }
        catch (error) { failures.push(`${agenda.judul}: ${error.message}`); }
      }
      if (failures.length) notify.warning(`${synced} agenda disinkronkan; ${failures.length} gagal. ${failures.slice(0, 2).join(' · ')}`);
      else notify.success(`${synced} agenda disinkronkan ke Google Calendar.`);
      await renderCalendar(layout);
    } catch (error) {
      button.disabled = false;
      button.textContent = 'Sinkronkan ke Google Calendar';
      notify.error('Gagal menghubungkan Google Calendar: ' + error.message);
    }
  });
}

function downloadCalendar(agendas) {
  const events = agendas.filter(row => !isComplete(row.selesai)).map(row => {
    const date = new Date(row.tanggal);
    if (Number.isNaN(date.getTime())) return '';
    const start = date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const end = new Date(date.getTime() + 3600000).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
    const recurrence = { mingguan: 'WEEKLY', bulanan: 'MONTHLY', tahunan: 'YEARLY' }[row.berulang];
    return `BEGIN:VEVENT\r\nUID:${icsEscape(row.id)}@think-aset\r\nDTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')}\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${icsEscape(row.judul)}\r\n${recurrence ? `RRULE:FREQ=${recurrence}\r\n` : ''}END:VEVENT`;
  }).filter(Boolean);
  const blob = new Blob([`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Think Aset//ID\r\n${events.join('\r\n')}\r\nEND:VCALENDAR\r\n`], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'think-aset-agenda.ics';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  notify.success('Kalender berhasil diunduh');
}
function icsEscape(value) { return String(value || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }
function isComplete(value) { return value === true || String(value).toLowerCase() === 'true'; }

async function renderQrCards(layout, query) {
  const adapter = getAdapter();
  layout.setActive('/qr'); layout.setTitle('QR & Kartu Aset');
  const assets = await adapter.list('assets');
  layout.content.innerHTML = `
    <div class="page-header"><h1>QR & Kartu Aset</h1><button class="btn btn-primary btn-sm" id="qr-print">Cetak kartu</button></div>
    <div class="card"><div class="form-group"><label class="form-label" for="qr-asset">Pilih aset</label><select class="form-select" id="qr-asset"><option value="">Pilih aset</option>${assets.map(asset => `<option value="${esc(asset.id)}">${esc(asset.kode || '')} · ${esc(asset.nama)}</option>`).join('')}</select></div>
      <button class="btn btn-secondary" id="qr-generate">Buat QR</button>
      <div id="qr-result" style="margin-top:20px"></div>
    </div>`;
  let selected = [];
  const generate = async selectedIds => {
    selected = selectedIds?.length
      ? assets.filter(asset => selectedIds.includes(asset.id))
      : assets.filter(asset => asset.id === layout.content.querySelector('#qr-asset').value);
    if (!selected.length) return notify.error('Pilih aset terlebih dahulu');
    try {
      const qrcode = await loadQrLibrary();
      const labels = [];
      for (let asset of selected) {
        let token = asset.qr_token;
        if (!token) {
          token = qrToken();
          const updated = await adapter.update('assets', asset.id, { qr_token: token, version: asset.version });
          Object.assign(asset, updated);
        }
        const qr = qrcode(0, 'M');
        qr.addData(`TA:${token}`);
        qr.make();
        labels.push(`<div class="asset-label">${qr.createSvgTag(4, 0)}<div><strong>${esc(asset.nama)}</strong><p>${esc(asset.kode || '')}</p><small>${esc(asset.serial || '')}</small></div></div>`);
      }
      layout.content.querySelector('#qr-result').innerHTML = labels.join('');
      if (query?.get('print') === '1') window.print();
    } catch (error) { notify.error('QR gagal dibuat: ' + error.message); }
  };
  layout.content.querySelector('#qr-generate').addEventListener('click', () => generate());
  if (query?.get('assets')) {
    await generate(query.get('assets').split(',').filter(Boolean));
  } else if (query?.get('asset') && assets.some(asset => asset.id === query.get('asset'))) {
    layout.content.querySelector('#qr-asset').value = query.get('asset');
    await generate();
  }
  layout.content.querySelector('#qr-print').addEventListener('click', () => {
    if (!selected.length) return notify.error('Buat QR aset terlebih dahulu');
    window.print();
  });
}

let qrLibraryPromise;
function loadQrLibrary() {
  if (window.qrcode) return Promise.resolve(window.qrcode);
  if (qrLibraryPromise) return qrLibraryPromise;
  qrLibraryPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
    script.integrity = 'sha384-8FWZA6BGMXhsfO+BLtrJK0We6gg5o1JyO8xQm6peWDEUs17ACA5ziE/NIAkl9z2k';
    script.crossOrigin = 'anonymous';
    script.onload = () => window.qrcode ? resolve(window.qrcode) : reject(new Error('Library QR tidak menyediakan API yang diharapkan'));
    script.onerror = () => reject(new Error('Tidak dapat memuat library QR; periksa koneksi internet'));
    document.head.appendChild(script);
  }).catch(error => { qrLibraryPromise = null; throw error; });
  return qrLibraryPromise;
}

async function renderScanner(layout) {
  const adapter = getAdapter();
  layout.setActive('/scan'); layout.setTitle('Pemindaian QR');
  const assets = await adapter.list('assets');
  layout.content.innerHTML = `<div class="page-header"><h1>Pemindaian QR</h1></div>
    <div class="card">
      <video id="scan-video" playsinline muted style="display:none;width:min(100%,520px);border-radius:8px"></video>
      <div class="row mt-3"><button class="btn btn-primary" id="scan-start">Mulai kamera</button><button class="btn btn-ghost" id="scan-stop" disabled>Hentikan</button></div>
      <form id="scan-manual" class="form-group mt-3"><label class="form-label" for="scan-code">Atau masukkan kode aset / QR</label><div class="row"><input class="form-input" id="scan-code" autocomplete="off" /><button class="btn btn-secondary" type="submit">Cari aset</button></div></form>
      <p id="scan-status" class="text-sm text-muted mt-3" aria-live="polite">Akses kamera memerlukan HTTPS atau localhost dan izin kamera.</p>
    </div>`;
  let stream = null, detector = null, frame = 0;
  const video = layout.content.querySelector('#scan-video');
  const stop = () => {
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    video.style.display = 'none';
    const stopButton = layout.content.querySelector('#scan-stop');
    if (stopButton) stopButton.disabled = true;
  };
  layout.content.querySelector('#scan-start').addEventListener('click', async () => {
    try {
      if (!('BarcodeDetector' in window)) throw new Error('Pemindaian kamera tidak didukung browser ini. Gunakan kolom kode manual.');
      detector = new BarcodeDetector({ formats: ['qr_code'] });
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      video.srcObject = stream; video.style.display = 'block'; await video.play();
      layout.content.querySelector('#scan-stop').disabled = false;
      layout.content.querySelector('#scan-status').textContent = 'Arahkan kamera ke QR aset.';
      const scan = async () => {
        if (!stream) return;
        try {
          const codes = await detector.detect(video);
          if (codes.length) { stop(); resolveScannedCode(codes[0].rawValue); return; }
        } catch (error) { layout.content.querySelector('#scan-status').textContent = `Pemindaian gagal: ${error.message}`; stop(); return; }
        frame = requestAnimationFrame(scan);
      };
      scan();
    } catch (error) { layout.content.querySelector('#scan-status').textContent = error.message; }
  });
  layout.content.querySelector('#scan-stop').addEventListener('click', stop);
  layout.content.querySelector('#scan-manual').addEventListener('submit', event => { event.preventDefault(); resolveScannedCode(layout.content.querySelector('#scan-code').value); });
  const onHashChange = () => stop();
  window.addEventListener('hashchange', onHashChange, { once: true });
  function resolveScannedCode(value) {
    let code = value.trim();
    try {
      if (/^https?:/i.test(code)) {
        const url = new URL(code);
        const match = url.hash.match(/^#\/aset\/([^?]+)/);
        if (match) code = decodeURIComponent(match[1]);
      }
      const hashMatch = code.match(/^#\/aset\/([^?]+)/);
      if (hashMatch) code = decodeURIComponent(hashMatch[1]);
    } catch {}
    if (code.startsWith('TA:')) code = code.slice(3);
    const asset = assets.find(row => row.id === code || row.qr_token === code || row.kode?.toLowerCase() === code.toLowerCase());
    if (asset) window.location.hash = `/aset/${encodeURIComponent(asset.id)}`;
    else layout.content.querySelector('#scan-status').textContent = `Aset tidak ditemukan untuk kode “${code}”.`;
  }
}

export async function renderAssetTab(container, tab, asset) {
  const adapter = getAdapter();
  const tables = {
    riwayat: ['asset_history', 'Riwayat', [['tanggal', 'Tanggal'], ['jenis', 'Perubahan'], ['dari', 'Dari'], ['ke', 'Ke'], ['catatan', 'Catatan']], 'riwayat'],
    keuangan: ['asset_finance', 'Keuangan', [['tanggal', 'Tanggal'], ['jenis', 'Jenis'], ['kategori', 'Kategori'], ['nominal', 'Nominal'], ['catatan', 'Catatan']], 'keuangan'],
    agenda: ['agendas', 'Agenda', [['tanggal', 'Tanggal'], ['judul', 'Agenda'], ['selesai', 'Status']], 'agenda'],
    jurnal: ['journals', 'Jurnal', [['tanggal', 'Tanggal'], ['judul', 'Judul'], ['isi', 'Catatan']], 'jurnal'],
    lampiran: ['asset_files', 'Lampiran', [['nama', 'Nama'], ['jenis', 'Jenis'], ['created_at', 'Tanggal']], null]
  };
  const [table, title, columns, path] = tables[tab];
  const rows = (await adapter.list(table, { asset_id: asset.id }))
    .sort((a, b) => String(b.tanggal || b.created_at || '').localeCompare(String(a.tanggal || a.created_at || '')));
  container.innerHTML = `<div class="card">
    <div class="row-between"><h2 style="margin:0">${esc(title)} · ${esc(asset.nama)}</h2>
      ${path && adapter.canWrite() ? `<a class="btn btn-primary btn-sm" href="#/${path}?asset=${encodeURIComponent(asset.id)}">Tambah catatan</a>` : ''}
    </div>
    ${rows.length ? `<div class="table-wrap" style="margin-top:16px"><table class="data-table"><thead><tr>${columns.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>
      ${rows.map(row => `<tr>${columns.map(([key]) => `<td>${esc(key === 'nominal' ? formatRupiahFull(row[key]) : String(row[key] ?? ''))}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>` : `<p class="text-sm text-muted mt-3">Belum ada catatan ${title.toLowerCase()} untuk aset ini.</p>`}
  </div>`;
}
