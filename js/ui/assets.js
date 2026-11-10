/**
 * Halaman Data Aset — daftar, filter, sort, pagination, aksi massal,
 * impor/ekspor Excel, dan form tambah/edit (dipakai juga oleh detail).
 */
import { getAdapter } from '../auth.js';
import { esc, $, $$ } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { compressImage } from '../utils/image.js';
import { computeDepreciation, formatRupiahFull } from '../utils/depreciation.js';
import { exportToXLSX, readSpreadsheet } from '../utils/excel.js';

const PAGE_SIZE = 20;
const KONDISI_LIST = ['baik', 'rusak_ringan', 'rusak_berat'];
const STATUS_LIST = ['aktif', 'nonaktif'];

let state = {
  assets: [],
  categories: [],
  locations: [],
  holders: [],
  search: '',
  filterKategori: '',
  filterLokasi: '',
  filterKondisi: '',
  filterStatus: '',
  filterDari: '',
  filterSampai: '',
  sortKey: 'kode',
  sortDir: 'asc',
  page: 1,
  selected: new Set()
};

// Cache URL foto untuk menghindari fetch berulang
const photoUrlCache = new Map();

export async function renderAssets(layout, { query } = {}) {
  const adapter = getAdapter();
  layout.setActive('/aset');
  layout.setTitle('Data Aset');
  layout.setActions('');

  await loadAll();

  if (query?.get('aksi') === 'tambah' && adapter.canWrite()) {
    openAssetForm({ onSaved: reloadAndRender });
  }

  renderList();

  async function loadAll() {
    const [assets, categories, locations, holders] = await Promise.all([
      adapter.list('assets'),
      adapter.list('categories'),
      adapter.list('locations'),
      adapter.list('holders')
    ]);
    state.assets = assets;
    state.categories = categories;
    state.locations = locations;
    state.holders = holders;
  }

  async function reloadAndRender() {
    await loadAll();
    state.page = 1;
    state.selected.clear();
    renderList();
  }

  function renderList() {
    const filtered = applyFilters(state.assets);
    const sorted = applySort(filtered);
    const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
    if (state.page > totalPages) state.page = totalPages;
    const start = (state.page - 1) * PAGE_SIZE;
    const pageRows = sorted.slice(start, start + PAGE_SIZE);

    const canWrite = adapter.canWrite();

    layout.content.innerHTML = `
      <div class="page-header">
        <h1>Data Aset <span class="text-sm text-muted">(${state.assets.length} total)</span></h1>
        <div class="row" style="gap:6px;flex-wrap:wrap">
          ${canWrite ? `<button class="btn btn-ghost btn-sm" id="btn-import">📥 Impor Excel</button>` : ''}
          <button class="btn btn-ghost btn-sm" id="btn-export">📤 Ekspor Excel</button>
          ${canWrite ? `<button class="btn btn-primary btn-sm" id="btn-add">+ Tambah Aset</button>` : ''}
        </div>
      </div>

      <div class="filter-bar">
        <input class="form-input" id="f-search" type="search" placeholder="Cari kode, nama, serial, vendor…" value="${esc(state.search)}" />
        <select class="form-select" id="f-kategori">
          <option value="">Semua Kategori</option>
          ${renderKategoriOptions()}
        </select>
        <select class="form-select" id="f-lokasi">
          <option value="">Semua Lokasi</option>
          ${state.locations.map(l => `<option value="${esc(l.id)}" ${state.filterLokasi === l.id ? 'selected' : ''}>${esc(l.nama)}</option>`).join('')}
        </select>
        <select class="form-select" id="f-kondisi">
          <option value="">Semua Kondisi</option>
          ${KONDISI_LIST.map(k => `<option value="${k}" ${state.filterKondisi === k ? 'selected' : ''}>${labelKondisi(k)}</option>`).join('')}
        </select>
        <select class="form-select" id="f-status">
          <option value="">Semua Status</option>
          ${STATUS_LIST.map(s => `<option value="${s}" ${state.filterStatus === s ? 'selected' : ''}>${labelStatus(s)}</option>`).join('')}
        </select>
        <input class="form-input" id="f-dari" type="date" value="${esc(state.filterDari)}" title="Dari tanggal beli" />
        <input class="form-input" id="f-sampai" type="date" value="${esc(state.filterSampai)}" title="Sampai tanggal beli" />
        <button class="btn btn-ghost btn-sm" id="f-reset">Reset</button>
      </div>

      ${state.selected.size > 0 && canWrite ? renderBulkBar() : ''}

      ${sorted.length === 0
        ? renderEmpty(canWrite)
        : renderTable(pageRows, canWrite)}

      ${sorted.length > PAGE_SIZE ? renderPagination(state.page, totalPages, sorted.length) : ''}
    `;

    // Wire filter
    $('#f-search').addEventListener('input', debounce(() => {
      state.search = $('#f-search').value;
      state.page = 1;
      renderList();
    }, 300));
    $('#f-kategori').addEventListener('change', () => {
      state.filterKategori = $('#f-kategori').value;
      state.page = 1; renderList();
    });
    $('#f-lokasi').addEventListener('change', () => {
      state.filterLokasi = $('#f-lokasi').value;
      state.page = 1; renderList();
    });
    $('#f-kondisi').addEventListener('change', () => {
      state.filterKondisi = $('#f-kondisi').value;
      state.page = 1; renderList();
    });
    $('#f-status').addEventListener('change', () => {
      state.filterStatus = $('#f-status').value;
      state.page = 1; renderList();
    });
    $('#f-dari').addEventListener('change', () => {
      state.filterDari = $('#f-dari').value;
      state.page = 1; renderList();
    });
    $('#f-sampai').addEventListener('change', () => {
      state.filterSampai = $('#f-sampai').value;
      state.page = 1; renderList();
    });
    $('#f-reset').addEventListener('click', () => {
      state = {
        ...state,
        search: '', filterKategori: '', filterLokasi: '', filterKondisi: '',
        filterStatus: '', filterDari: '', filterSampai: '', page: 1,
        selected: new Set()
      };
      renderList();
    });

    // Tombol header
    $('#btn-add')?.addEventListener('click', () => openAssetForm({ onSaved: reloadAndRender }));
    $('#btn-export')?.addEventListener('click', () => doExport(sorted));
    $('#btn-import')?.addEventListener('click', () => doImport());

    // Bulk actions
    $$('.bulk-btn').forEach(btn => {
      btn.addEventListener('click', () => doBulk(btn.dataset.bulk, filtered));
    });

    // Row actions
    $$('[data-row-action]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        const action = el.dataset.rowAction;
        const id = el.dataset.id;
        if (action === 'view') window.location.hash = '/aset/' + encodeURIComponent(id);
        else if (action === 'edit') {
          const asset = state.assets.find(a => a.id === id);
          if (asset) openAssetForm({ asset, onSaved: reloadAndRender });
        } else if (action === 'delete') doDelete(id);
      });
    });

    // Sortable headers
    $$('[data-sort]').forEach(th => {
      th.addEventListener('click', () => {
        const key = th.dataset.sort;
        if (state.sortKey === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
        else { state.sortKey = key; state.sortDir = 'asc'; }
        renderList();
      });
    });

    // Checkboxes untuk aksi massal
    $('#chk-all')?.addEventListener('change', (e) => {
      if (e.target.checked) pageRows.forEach(a => state.selected.add(a.id));
      else pageRows.forEach(a => state.selected.delete(a.id));
      renderList();
    });
    $$('[data-chk-row]').forEach(el => {
      el.addEventListener('change', () => {
        const id = el.dataset.chkRow;
        if (el.checked) state.selected.add(id);
        else state.selected.delete(id);
        renderList();
      });
    });

    // Pagination
    $$('[data-page]').forEach(el => {
      el.addEventListener('click', () => {
        state.page = Number(el.dataset.page);
        renderList();
      });
    });

    // Muat thumbnail foto
    loadThumbs(pageRows);
  }

  function renderKategoriOptions() {
    const tops = state.categories.filter(c => !c.parent_id);
    let html = '';
    for (const top of tops) {
      html += `<option value="${esc(top.id)}" ${state.filterKategori === top.id ? 'selected' : ''}>${esc(top.nama)}</option>`;
      for (const child of state.categories.filter(c => c.parent_id === top.id)) {
        html += `<option value="${esc(child.id)}" ${state.filterKategori === child.id ? 'selected' : ''}>  └ ${esc(child.nama)}</option>`;
      }
    }
    return html;
  }

  function renderBulkBar() {
    return `
      <div class="card" style="padding:12px;margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
        <strong>${state.selected.size} aset terpilih</strong>
        <button class="btn btn-ghost btn-sm bulk-btn" data-bulk="qr">🔲 Cetak QR</button>
        <button class="btn btn-ghost btn-sm bulk-btn" data-bulk="export">📤 Ekspor terpilih</button>
        <button class="btn btn-ghost btn-sm bulk-btn" data-bulk="nonaktif">🚫 Nonaktifkan</button>
        <button class="btn btn-ghost btn-sm bulk-btn" data-bulk="hapus" style="color:var(--accent-danger)">🗑️ Hapus</button>
        <button class="btn btn-ghost btn-sm" id="bulk-clear">Batalkan pilihan</button>
      </div>`;
  }

  function renderEmpty(canWrite) {
    return `
      <div class="empty-state">
        <span class="empty-state-icon">📋</span>
        <div class="empty-state-title">Belum ada aset</div>
        <div class="empty-state-desc">Tambahkan aset pertama Anda, atau impor dari Excel.</div>
        ${canWrite ? `
          <div class="row" style="justify-content:center">
            <button class="btn btn-primary" id="empty-add">+ Tambah Aset</button>
            <button class="btn btn-secondary" id="empty-import">📥 Impor Excel</button>
          </div>
        ` : ''}
      </div>`;
  }

  function renderTable(pageRows, canWrite) {
    const catMap = new Map(state.categories.map(c => [c.id, c]));
    const locMap = new Map(state.locations.map(l => [l.id, l]));
    const holdMap = new Map(state.holders.map(h => [h.id, h]));

    return `
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              ${canWrite ? `<th style="width:32px"><input type="checkbox" id="chk-all" /></th>` : ''}
              <th style="width:52px">Foto</th>
              <th data-sort="kode" style="cursor:pointer">Kode ${sortIcon('kode')}</th>
              <th data-sort="nama" style="cursor:pointer">Nama ${sortIcon('nama')}</th>
              <th>Kategori</th>
              <th>Lokasi</th>
              <th>Penanggung Jawab</th>
              <th>Kondisi</th>
              <th>Status</th>
              <th data-sort="harga" style="cursor:pointer">Nilai Kini ${sortIcon('harga')}</th>
              <th style="text-align:right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            ${pageRows.map(a => {
              const cat = catMap.get(a.category_id);
              const loc = locMap.get(a.location_id);
              const hold = holdMap.get(a.holder_id);
              const d = computeDepreciation(a);
              const thumbId = getFirstPhotoId(a);
              return `<tr>
                ${canWrite ? `<td><input type="checkbox" data-chk-row="${esc(a.id)}" ${state.selected.has(a.id) ? 'checked' : ''} /></td>` : ''}
                <td><div class="cell-thumb" data-thumb="${esc(thumbId || '')}">${thumbId ? '…' : '📦'}</div></td>
                <td><strong>${esc(a.kode || '—')}</strong></td>
                <td><a href="#/aset/${esc(a.id)}" style="color:var(--text);font-weight:600">${esc(a.nama || '—')}</a></td>
                <td>${esc(cat?.nama || '—')}</td>
                <td>${esc(loc?.nama || '—')}</td>
                <td>${esc(hold?.nama || '—')}</td>
                <td><span class="badge badge-${kondisiBadge(a.kondisi)}">${labelKondisi(a.kondisi)}</span></td>
                <td><span class="badge badge-${a.status === 'nonaktif' ? 'danger' : 'success'}">${labelStatus(a.status)}</span></td>
                <td>${esc(formatRupiahFull(d.nilai_buku))}</td>
                <td style="text-align:right">
                  <div class="cell-actions" style="justify-content:flex-end">
                    <button class="btn btn-ghost btn-sm" data-row-action="view" data-id="${esc(a.id)}">Lihat</button>
                    ${canWrite ? `
                      <button class="btn btn-ghost btn-sm" data-row-action="edit" data-id="${esc(a.id)}">Edit</button>
                      <button class="btn btn-ghost btn-sm" data-row-action="delete" data-id="${esc(a.id)}" style="color:var(--accent-danger)">Hapus</button>
                    ` : ''}
                  </div>
                </td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;
  }

  function renderPagination(current, total, totalRows) {
    const buttons = [];
    buttons.push(`<button data-page="1" ${current === 1 ? 'disabled' : ''}>«</button>`);
    buttons.push(`<button data-page="${Math.max(1, current - 1)}" ${current === 1 ? 'disabled' : ''}>‹</button>`);
    const start = Math.max(1, current - 2);
    const end = Math.min(total, current + 2);
    for (let i = start; i <= end; i++) {
      buttons.push(`<button data-page="${i}" class="${i === current ? 'active' : ''}">${i}</button>`);
    }
    buttons.push(`<button data-page="${Math.min(total, current + 1)}" ${current === total ? 'disabled' : ''}>›</button>`);
    buttons.push(`<button data-page="${total}" ${current === total ? 'disabled' : ''}>»</button>`);
    return `<div class="pagination">
      ${buttons.join('')}
      <span class="pagination-info">Halaman ${current} dari ${total} · ${totalRows} hasil</span>
    </div>`;
  }

  async function loadThumbs(rows) {
    const adapter = getAdapter();
    for (const a of rows) {
      const id = getFirstPhotoId(a);
      if (!id) continue;
      const cell = document.querySelector(`[data-thumb="${cssEscape(id)}"]`);
      if (!cell) continue;
      if (photoUrlCache.has(id)) {
        cell.innerHTML = `<img src="${esc(photoUrlCache.get(id))}" alt="" />`;
        continue;
      }
      try {
        const url = await adapter.getFileUrl(id);
        if (url) {
          photoUrlCache.set(id, url);
          cell.innerHTML = `<img src="${esc(url)}" alt="" />`;
        } else {
          cell.textContent = '📦';
        }
      } catch { cell.textContent = '📦'; }
    }
  }

  async function doExport(rows) {
    if (rows.length === 0) return notify.error('Tidak ada data untuk diekspor');
    const catMap = new Map(state.categories.map(c => [c.id, c]));
    const locMap = new Map(state.locations.map(l => [l.id, l]));
    const holdMap = new Map(state.holders.map(h => [h.id, h]));

    const columns = [
      { key: 'kode', label: 'Kode' },
      { key: 'nama', label: 'Nama' },
      { key: 'category_id', label: 'Kategori', format: (v) => catMap.get(v)?.nama || '' },
      { key: 'location_id', label: 'Lokasi', format: (v) => locMap.get(v)?.nama || '' },
      { key: 'holder_id', label: 'Penanggung Jawab', format: (v) => holdMap.get(v)?.nama || '' },
      { key: 'tgl_beli', label: 'Tanggal Beli' },
      { key: 'harga', label: 'Harga', format: (v) => Number(v) || 0 },
      { key: 'vendor', label: 'Vendor' },
      { key: 'merk', label: 'Merk' },
      { key: 'tipe', label: 'Tipe' },
      { key: 'serial', label: 'Serial' },
      { key: 'jumlah', label: 'Jumlah', format: (v) => Number(v) || 1 },
      { key: 'kondisi', label: 'Kondisi', format: (v) => labelKondisi(v) },
      { key: 'status', label: 'Status', format: (v) => labelStatus(v) },
      { key: 'umur_ekonomis', label: 'Umur Ekonomis (bln)' },
      { key: 'nilai_residu', label: 'Nilai Residu' },
      { key: 'metode_susut', label: 'Metode Susut' },
      { key: 'keterangan', label: 'Keterangan' },
      { key: 'nilai_kini', label: 'Nilai Kini', format: (_, row) => computeDepreciation(row).nilai_buku }
    ];

    try {
      await exportToXLSX(rows, columns, `aset-${Date.now()}.xlsx`, 'Data Aset');
      notify.success('Ekspor berhasil');
    } catch (e) {
      notify.error('Ekspor gagal: ' + e.message);
    }
  }

  function doImport() {
    openModal({
      title: 'Impor Aset dari Excel / CSV',
      size: 'modal-lg',
      body: `
        <p class="text-sm text-muted">Unduh template, isi, lalu unggah kembali. Baris dengan kolom "Kode" atau "Nama" kosong akan dilewati.</p>
        <div class="row" style="margin-bottom:16px">
          <button class="btn btn-secondary btn-sm" id="btn-template">⬇ Unduh Template</button>
        </div>
        <div class="form-group">
          <label class="form-label">Berkas Excel/CSV</label>
          <input type="file" class="form-input" id="import-file" accept=".xlsx,.xls,.csv" />
        </div>
        <div id="import-preview" class="text-sm text-muted"></div>
      `,
      actions: [
        { label: 'Batal', class: 'btn btn-ghost' },
        {
          label: 'Impor',
          class: 'btn btn-primary',
          onClick: async () => {
            const input = $('#import-file');
            const file = input?.files?.[0];
            if (!file) { notify.error('Pilih berkas terlebih dahulu'); return false; }
            try {
              const rows = await readSpreadsheet(file);
              await doImportRows(rows);
              closeModal();
              await reloadAndRender();
            } catch (e) {
              notify.error('Impor gagal: ' + e.message);
              return false;
            }
          }
        }
      ]
    });

    $('#btn-template').addEventListener('click', async () => {
      const sample = [{
        kode: 'INV-0001', nama: 'Laptop Dell', kategori: 'Elektronik',
        lokasi: 'Kantor Pusat', penanggung_jawab: 'Budi', tgl_beli: '2024-01-15',
        harga: 12000000, vendor: 'Dell', merk: 'Dell', tipe: 'XPS 13',
        serial: 'SN-001', jumlah: 1, kondisi: 'baik', status: 'aktif',
        umur_ekonomis: 48, nilai_residu: 0, metode_susut: 'garis_lurus',
        keterangan: ''
      }];
      const columns = Object.keys(sample[0]).map(k => ({ key: k, label: k }));
      try {
        await exportToXLSX(sample, columns, `template-impor-aset.xlsx`, 'Template');
      } catch (e) { notify.error('Gagal unduh template: ' + e.message); }
    });
  }

  async function doImportRows(rows) {
    if (!Array.isArray(rows) || rows.length === 0) {
      throw new Error('Berkas kosong');
    }
    if (!rows[0] || typeof rows[0] !== 'object' || Array.isArray(rows[0])) {
      throw new Error('Format tabel tidak valid');
    }
    const headerNames = new Set(Object.keys(rows[0]).map(normalizeImportKey));
    if (!headerNames.has('kode') || !headerNames.has('nama')) {
      throw new Error('Template harus memiliki kolom "kode" dan "nama"');
    }

    // Bangun map nama → id untuk kategori/lokasi/holder
    const catByName = new Map(state.categories.map(c => [String(c.nama).toLowerCase(), c]));
    const locByName = new Map(state.locations.map(l => [String(l.nama).toLowerCase(), l]));
    const holdByName = new Map(state.holders.map(h => [String(h.nama).toLowerCase(), h]));
    const usedCodes = new Set(state.assets.map(a => String(a.kode || '').trim().toLowerCase()).filter(Boolean));

    let created = 0, failed = 0, skipped = 0;
    for (const [index, row] of rows.entries()) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) {
        failed++;
        continue;
      }

      try {
        const get = (...keys) => getImportValue(row, keys);
        const nama = String(get('nama') || '').trim();
        const kode = String(get('kode') || '').trim();
        if (!nama || !kode) {
          skipped++;
          continue;
        }
        if (nama.length > 150 || kode.length > 60) {
          throw new Error('Nama (maks 150) atau kode (maks 60) terlalu panjang');
        }
        const normalizedCode = kode.toLowerCase();
        if (usedCodes.has(normalizedCode)) throw new Error(`Kode aset "${kode}" sudah digunakan`);

        const number = (label, value, fallback = 0) => {
          if (value == null || String(value).trim() === '') return fallback;
          const parsed = Number(value);
          if (!Number.isFinite(parsed)) throw new Error(`${label} bukan angka yang valid`);
          return parsed;
        };
        const harga = number('Harga', get('harga'));
        const jumlah = number('Jumlah', get('jumlah'), 1);
        const umurEkonomis = number('Umur ekonomis', get('umurekonomis', 'umurekonomisbln'));
        const nilaiResidu = number('Nilai residu', get('nilairesidu', 'nilairesidurp'));
        if (harga < 0 || jumlah < 1 || !Number.isInteger(jumlah) ||
            umurEkonomis < 0 || !Number.isInteger(umurEkonomis) ||
            nilaiResidu < 0 || nilaiResidu > harga) {
          throw new Error('Harga, jumlah, umur ekonomis, atau nilai residu tidak valid');
        }

        const catName = String(get('kategori') || '').trim().toLowerCase();
        const locName = String(get('lokasi') || '').trim().toLowerCase();
        const holdName = String(get('penanggungjawab') || '').trim().toLowerCase();
        const metode = String(get('metodesusut') || 'garis_lurus').trim().toLowerCase();
        const kondisiInput = String(get('kondisi') || '').trim().toLowerCase();
        const statusInput = String(get('status') || 'aktif').trim().toLowerCase();
        if (!['garis_lurus', 'saldo_menurun'].includes(metode)) {
          throw new Error('Metode susut harus garis_lurus atau saldo_menurun');
        }
        if (kondisiInput && !['baik', 'rusak ringan', 'rusak_ringan', 'rusak berat', 'rusak_berat'].includes(kondisiInput)) {
          throw new Error('Kondisi harus baik, rusak ringan, atau rusak berat');
        }
        if (!['aktif', 'nonaktif'].includes(statusInput)) {
          throw new Error('Status harus aktif atau nonaktif');
        }
        const tglBeli = String(get('tglbeli', 'tanggalbeli') || '').trim();
        if (tglBeli && !isValidDateOnly(tglBeli)) {
          throw new Error('Tanggal beli harus menggunakan format YYYY-MM-DD');
        }

        const data = {
          kode,
          nama,
          category_id: catName ? (catByName.get(catName)?.id || '') : '',
          location_id: locName ? (locByName.get(locName)?.id || '') : '',
          holder_id: holdName ? (holdByName.get(holdName)?.id || '') : '',
          tgl_beli: tglBeli,
          harga,
          vendor: String(get('vendor') || '').trim(),
          merk: String(get('merk') || '').trim(),
          tipe: String(get('tipe') || '').trim(),
          serial: String(get('serial') || '').trim(),
          jumlah,
          kondisi: normalisasiKondisi(get('kondisi')),
          status: statusInput,
          umur_ekonomis: umurEkonomis,
          nilai_residu: nilaiResidu,
          metode_susut: metode,
          keterangan: String(get('keterangan') || '').trim(),
          foto_ids: '[]',
          custom_fields: '{}',
          qr_token: generateQrToken()
        };
        await adapter.create('assets', data);
        usedCodes.add(normalizedCode);
        created++;
      } catch (e) {
        failed++;
        console.warn(`Baris ${index + 2} gagal diimpor:`, e);
      }
    }
    if (created > 0) notify.success(`${created} aset berhasil diimpor`);
    if (failed > 0) notify.warning(`${failed} baris gagal diimpor`);
    if (skipped > 0) notify.info(`${skipped} baris dilewati karena kode atau nama kosong`);
    if (created === 0 && failed === 0 && skipped === 0) {
      throw new Error('Tidak ada data aset yang bisa diimpor');
    }
  }

  async function doBulk(action, filtered) {
    const ids = Array.from(state.selected);
    if (ids.length === 0) return;

    if (action === 'qr') {
      notify.info('Cetak QR massal belum tersedia.');
      return;
    }
    if (action === 'export') {
      const rows = filtered.filter(a => state.selected.has(a.id));
      return doExport(rows);
    }
    if (action === 'nonaktif') {
      const ok = await confirmDialog({
        title: 'Nonaktifkan aset',
        message: `Nonaktifkan ${ids.length} aset terpilih? Aset tetap tersimpan, hanya berstatus nonaktif.`,
        okLabel: 'Nonaktifkan'
      });
      if (!ok) return;
      let done = 0;
      for (const id of ids) {
        const a = state.assets.find(x => x.id === id);
        if (!a) continue;
        try {
          await adapter.update('assets', id, { status: 'nonaktif', version: a.version });
          done++;
        } catch (e) {
          console.warn('Nonaktif gagal:', id, e);
        }
      }
      notify.success(`${done} aset dinonaktifkan`);
      state.selected.clear();
      await reloadAndRender();
      return;
    }
    if (action === 'hapus') {
      const ok = await confirmDialog({
        title: 'Hapus aset',
        message: `Hapus ${ids.length} aset terpilih secara permanen? Tindakan ini tidak bisa dibatalkan.`,
        okLabel: 'Hapus',
        danger: true
      });
      if (!ok) return;
      let done = 0;
      for (const id of ids) {
        try { await adapter.remove('assets', id); done++; }
        catch (e) { console.warn('Hapus gagal:', id, e); }
      }
      notify.success(`${done} aset dihapus`);
      state.selected.clear();
      await reloadAndRender();
    }
  }

  async function doDelete(id) {
    const target = state.assets.find(a => a.id === id);
    if (!target) return;
    const ok = await confirmDialog({
      title: 'Hapus aset',
      message: `Hapus "${target.nama}" (${target.kode}) secara permanen?`,
      okLabel: 'Hapus',
      danger: true
    });
    if (!ok) return;
    try {
      await adapter.remove('assets', id);
      notify.success('Aset dihapus');
      await reloadAndRender();
    } catch (e) {
      notify.error('Gagal menghapus: ' + e.message);
    }
  }

  function sortIcon(key) {
    if (state.sortKey !== key) return '';
    return state.sortDir === 'asc' ? '▲' : '▼';
  }
}

// ============================================================
// FORM (dipakai juga dari asset-detail.js)
// ============================================================
export async function openAssetForm({ asset = null, onSaved } = {}) {
  const adapter = getAdapter();
  if (!adapter.canWrite()) {
    notify.error('Anda tidak memiliki izin menulis');
    return;
  }

  let categories = [], locations = [], holders = [];
  try {
    [categories, locations, holders] = await Promise.all([
      adapter.list('categories'),
      adapter.list('locations'),
      adapter.list('holders')
    ]);
  } catch (e) {
    notify.error('Gagal memuat data pendukung: ' + e.message);
    return;
  }

  const editing = !!asset;
  // Parse foto_ids dari JSON
  let fotoIds = [];
  try {
    if (asset?.foto_ids) {
      const parsed = JSON.parse(asset.foto_ids);
      if (Array.isArray(parsed)) fotoIds = parsed.filter(x => typeof x === 'string');
    }
  } catch {}

  let customFieldsText = '';
  try {
    if (asset?.custom_fields) {
      const obj = JSON.parse(asset.custom_fields);
      customFieldsText = Object.entries(obj || {}).map(([k, v]) => `${k}=${v}`).join('\n');
    }
  } catch {}

  const defaultKode = editing ? (asset.kode || '') : await generateNextKode(adapter);

  const catOptions = renderKategoriSelect(categories, asset?.category_id || '');
  const locOptions = renderFlatSelect(locations, asset?.location_id || '', '— Pilih lokasi —');
  const holdOptions = renderFlatSelect(holders, asset?.holder_id || '', '— Pilih penanggung jawab —');

  openModal({
    title: editing ? 'Edit Aset' : 'Tambah Aset',
    size: 'modal-lg',
    body: `
      <form id="asset-form" onsubmit="return false">

        <div class="form-section-title">Identitas Aset</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kode <span style="color:var(--accent-danger)">*</span></label>
            <input class="form-input" id="a-kode" maxlength="60" value="${esc(defaultKode)}" placeholder="INV/2025/0001" />
            <div class="form-hint">Otomatis dibuat. Bisa diubah manual.</div>
          </div>
          <div class="form-group">
            <label class="form-label">Serial / Kode Produksi</label>
            <input class="form-input" id="a-serial" maxlength="100" value="${esc(asset?.serial || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Nama Aset <span style="color:var(--accent-danger)">*</span></label>
          <input class="form-input" id="a-nama" maxlength="150" value="${esc(asset?.nama || '')}" placeholder="Contoh: Laptop Dell XPS 13" />
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kategori</label>
            <select class="form-select" id="a-category">${catOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Jumlah</label>
            <input class="form-input" id="a-jumlah" type="number" min="1" step="1" value="${esc(asset?.jumlah || '1')}" />
            <div class="form-hint">Jumlah unit dalam satu catatan aset.</div>
          </div>
        </div>

        <div class="form-section-title">Perolehan</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Tanggal Beli</label>
            <input class="form-input" id="a-tgl" type="date" value="${esc(asset?.tgl_beli || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Harga Perolehan (Rp)</label>
            <input class="form-input" id="a-harga" type="number" min="0" step="1" value="${esc(asset?.harga || '0')}" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Vendor</label>
            <input class="form-input" id="a-vendor" maxlength="100" value="${esc(asset?.vendor || '')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Merk</label>
            <input class="form-input" id="a-merk" maxlength="100" value="${esc(asset?.merk || '')}" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Tipe / Model</label>
          <input class="form-input" id="a-tipe" maxlength="100" value="${esc(asset?.tipe || '')}" />
        </div>

        <div class="form-section-title">Lokasi &amp; Penanggung Jawab</div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Lokasi</label>
            <select class="form-select" id="a-location">${locOptions}</select>
          </div>
          <div class="form-group">
            <label class="form-label">Penanggung Jawab</label>
            <select class="form-select" id="a-holder">${holdOptions}</select>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Kondisi</label>
            <select class="form-select" id="a-kondisi">
              ${KONDISI_LIST.map(k => `<option value="${k}" ${(asset?.kondisi || 'baik') === k ? 'selected' : ''}>${labelKondisi(k)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Status</label>
            <select class="form-select" id="a-status">
              ${STATUS_LIST.map(s => `<option value="${s}" ${(asset?.status || 'aktif') === s ? 'selected' : ''}>${labelStatus(s)}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="form-section-title">Penyusutan</div>
        <div class="form-row-3">
          <div class="form-group">
            <label class="form-label">Metode Susut</label>
            <select class="form-select" id="a-metode">
              <option value="garis_lurus" ${(!asset || asset.metode_susut === 'garis_lurus') ? 'selected' : ''}>Garis Lurus</option>
              <option value="saldo_menurun" ${asset?.metode_susut === 'saldo_menurun' ? 'selected' : ''}>Saldo Menurun</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Umur Ekonomis (bulan)</label>
            <input class="form-input" id="a-umur" type="number" min="0" step="1" value="${esc(asset?.umur_ekonomis || '0')}" />
          </div>
          <div class="form-group">
            <label class="form-label">Nilai Residu (Rp)</label>
            <input class="form-input" id="a-residu" type="number" min="0" step="1" value="${esc(asset?.nilai_residu || '0')}" />
          </div>
        </div>

        <div class="form-section-title">Foto &amp; Lampiran</div>
        <div class="form-group">
          <label class="form-label">Foto Aset</label>
          <div class="row" style="align-items:flex-start;flex-wrap:wrap">
            <div id="foto-preview" style="display:flex;gap:8px;flex-wrap:wrap"></div>
            <label class="btn btn-ghost btn-sm" style="cursor:pointer">
              + Tambah Foto
              <input type="file" id="foto-input" accept="image/*" multiple style="display:none" />
            </label>
          </div>
          <div class="form-hint">Foto akan dikompres otomatis ke ~800 px.</div>
        </div>

        <div class="form-group">
          <label class="form-label">Keterangan</label>
          <textarea class="form-textarea" id="a-keterangan" maxlength="2000" rows="3">${esc(asset?.keterangan || '')}</textarea>
        </div>

        <div class="form-group">
          <label class="form-label">Kolom Custom (satu per baris, format: <code>kunci=nilai</code>)</label>
          <textarea class="form-textarea" id="a-custom" rows="3" placeholder="warna=hitam&#10;garansi=2027">${esc(customFieldsText)}</textarea>
        </div>

      </form>
    `,
    actions: [
      { label: 'Batal', class: 'btn btn-ghost' },
      {
        label: editing ? 'Simpan Perubahan' : 'Simpan Aset',
        class: 'btn btn-primary',
        onClick: async () => {
          const payload = {
            kode: $('#a-kode').value.trim(),
            nama: $('#a-nama').value.trim(),
            serial: $('#a-serial').value.trim(),
            category_id: $('#a-category').value,
            location_id: $('#a-location').value,
            holder_id: $('#a-holder').value,
            tgl_beli: $('#a-tgl').value,
            harga: Number($('#a-harga').value) || 0,
            vendor: $('#a-vendor').value.trim(),
            merk: $('#a-merk').value.trim(),
            tipe: $('#a-tipe').value.trim(),
            jumlah: Number($('#a-jumlah').value) || 1,
            kondisi: $('#a-kondisi').value,
            status: $('#a-status').value,
            umur_ekonomis: Number($('#a-umur').value) || 0,
            nilai_residu: Number($('#a-residu').value) || 0,
            metode_susut: $('#a-metode').value,
            keterangan: $('#a-keterangan').value.trim(),
            custom_fields: parseCustomFields($('#a-custom').value),
            foto_ids: JSON.stringify(fotoIds),
            qr_token: editing ? (asset.qr_token || generateQrToken()) : generateQrToken()
          };

          if (!payload.nama) { notify.error('Nama aset wajib diisi'); return false; }
          if (!payload.kode) { notify.error('Kode aset wajib diisi'); return false; }

          try {
            if (editing) {
              await adapter.update('assets', asset.id, { ...payload, version: asset.version });
              notify.success('Aset diperbarui');
            } else {
              await adapter.create('assets', payload);
              notify.success('Aset ditambahkan');
            }
            closeModal();
            onSaved?.();
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

  // Wire foto upload & preview
  renderFotoPreview(document.getElementById('foto-preview'), fotoIds);

  document.getElementById('foto-input').addEventListener('change', async (ev) => {
    const files = Array.from(ev.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        notify.warning('Hanya file gambar yang diterima: ' + file.name);
        continue;
      }
      try {
        notify.info('Mengunggah ' + file.name + '…');
        const blob = await compressImage(file, 800, 0.82);
        const upload = await adapter.uploadFile(new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' }));
        fotoIds.push(upload.id);
        photoUrlCache.set(upload.id, upload.url);
        renderFotoPreview(document.getElementById('foto-preview'), fotoIds);
      } catch (e) {
        notify.error('Gagal mengunggah ' + file.name + ': ' + e.message);
      }
    }
    ev.target.value = '';
  });
}

function renderFotoPreview(container, fotoIds) {
  const adapter = getAdapter();
  container.innerHTML = '';
  fotoIds.forEach((id, idx) => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:72px;height:72px;border-radius:8px;overflow:hidden;background:var(--surface-2);display:grid;place-items:center';
    wrap.innerHTML = `<span style="color:var(--text-muted);font-size:20px">…</span>`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.style.cssText = 'position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.7);color:#fff;border:none;cursor:pointer;font-size:14px;line-height:1';
    btn.addEventListener('click', () => {
      fotoIds.splice(idx, 1);
      renderFotoPreview(container, fotoIds);
    });
    wrap.appendChild(btn);
    container.appendChild(wrap);

    (async () => {
      try {
        const url = photoUrlCache.get(id) || await adapter.getFileUrl(id);
        if (url) {
          photoUrlCache.set(id, url);
          wrap.innerHTML = `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover" />`;
          wrap.appendChild(btn);
        }
      } catch {}
    })();
  });
}

// ============================================================
// Helper bersama
// ============================================================
export function labelKondisi(k) {
  return k === 'rusak_ringan' ? 'Rusak Ringan'
    : k === 'rusak_berat' ? 'Rusak Berat'
    : k === 'baik' ? 'Baik' : '—';
}

export function labelStatus(s) {
  return s === 'nonaktif' ? 'Nonaktif'
    : s === 'aktif' ? 'Aktif' : '—';
}

export function kondisiBadge(k) {
  return k === 'rusak_berat' ? 'danger'
    : k === 'rusak_ringan' ? 'warning'
    : 'success';
}

export function getFirstPhotoId(asset) {
  try {
    const ids = JSON.parse(asset?.foto_ids || '[]');
    return Array.isArray(ids) && ids.length ? ids[0] : '';
  } catch { return ''; }
}

export function generateQrToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

export function parseCustomFields(text) {
  const obj = {};
  String(text || '').split(/\r?\n/).forEach(line => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const eq = trimmed.indexOf('=');
    if (eq === -1) return;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim();
    if (k) obj[k] = v;
  });
  return JSON.stringify(obj);
}

function normalisasiKondisi(v) {
  const s = String(v || '').toLowerCase().trim();
  if (s === 'rusak ringan' || s === 'rusak_ringan') return 'rusak_ringan';
  if (s === 'rusak berat' || s === 'rusak_berat') return 'rusak_berat';
  return 'baik';
}

function normalizeImportKey(key) {
  const normalized = String(key).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'namaaset') return 'nama';
  if (normalized === 'tanggalbeli') return 'tglbeli';
  if (normalized === 'umurekonomisbln') return 'umurekonomis';
  if (normalized === 'nilairesidurp') return 'nilairesidu';
  return normalized;
}

function getImportValue(row, keys) {
  const wanted = new Set(keys.map(normalizeImportKey));
  const key = Object.keys(row).find(name => wanted.has(normalizeImportKey(name)));
  return key == null ? '' : row[key];
}

function isValidDateOnly(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day);
}

async function generateNextKode(adapter) {
  try {
    const assets = await adapter.list('assets');
    const year = new Date().getFullYear();
    const prefix = `INV/${year}/`;
    let max = 0;
    for (const a of assets) {
      const k = String(a.kode || '');
      if (k.startsWith(prefix)) {
        const n = parseInt(k.slice(prefix.length), 10);
        if (!isNaN(n) && n > max) max = n;
      }
    }
    return prefix + String(max + 1).padStart(4, '0');
  } catch {
    return 'INV/' + new Date().getFullYear() + '/0001';
  }
}

function renderKategoriSelect(categories, selected) {
  const tops = categories.filter(c => !c.parent_id);
  let html = '<option value="">— Tanpa kategori —</option>';
  for (const top of tops) {
    html += `<option value="${esc(top.id)}" ${selected === top.id ? 'selected' : ''}>${esc(top.nama)}</option>`;
    for (const child of categories.filter(c => c.parent_id === top.id)) {
      html += `<option value="${esc(child.id)}" ${selected === child.id ? 'selected' : ''}>  └ ${esc(child.nama)}</option>`;
    }
  }
  return html;
}

function renderFlatSelect(items, selected, emptyLabel) {
  let html = `<option value="">${esc(emptyLabel)}</option>`;
  for (const it of items.slice().sort((a, b) => String(a.nama).localeCompare(String(b.nama), 'id'))) {
    html += `<option value="${esc(it.id)}" ${selected === it.id ? 'selected' : ''}>${esc(it.nama)}</option>`;
  }
  return html;
}

// ============================================================
// Util internal
// ============================================================
function applyFilters(assets) {
  const s = state.search.toLowerCase().trim();
  return assets.filter(a => {
    if (s) {
      const hay = `${a.kode || ''} ${a.nama || ''} ${a.serial || ''} ${a.vendor || ''} ${a.merk || ''} ${a.tipe || ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (state.filterKategori) {
      // Cocokkan kategori atau anak dari kategori terpilih
      const isParent = state.categories.some(c => c.parent_id === state.filterKategori && c.id === a.category_id);
      const children = state.categories.filter(c => c.parent_id === state.filterKategori).map(c => c.id);
      if (a.category_id !== state.filterKategori && !isParent && !children.includes(a.category_id)) return false;
    }
    if (state.filterLokasi && a.location_id !== state.filterLokasi) return false;
    if (state.filterKondisi && a.kondisi !== state.filterKondisi) return false;
    if (state.filterStatus && (a.status || 'aktif') !== state.filterStatus) return false;
    if (state.filterDari && a.tgl_beli && a.tgl_beli < state.filterDari) return false;
    if (state.filterSampai && a.tgl_beli && a.tgl_beli > state.filterSampai) return false;
    return true;
  });
}

function applySort(assets) {
  const key = state.sortKey;
  const dir = state.sortDir === 'asc' ? 1 : -1;
  return assets.slice().sort((a, b) => {
    let av, bv;
    if (key === 'harga') {
      av = computeDepreciation(a).nilai_buku;
      bv = computeDepreciation(b).nilai_buku;
    } else {
      av = String(a[key] || '').toLowerCase();
      bv = String(b[key] || '').toLowerCase();
    }
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    return 0;
  });
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

function cssEscape(s) {
  return String(s).replace(/[^a-zA-Z0-9_-]/g, '_');
}