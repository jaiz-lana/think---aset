import { getAdapter } from '../auth.js';
import { esc } from '../utils/dom.js';
import { notify } from '../utils/toast.js';
import { confirmDialog } from './modal.js';
import {
  openAssetForm, labelKondisi, labelStatus, kondisiBadge,
  getFirstPhotoId
} from './assets.js';
import { computeDepreciation, formatRupiahFull } from '../utils/depreciation.js';
import { renderAssetTab } from './workflows.js';

export async function renderAssetDetail(layout, { params, query }) {
  const adapter = getAdapter();
  const myHash = window.location.hash;
  layout.setActive('/aset');
  layout.setTitle('Detail Aset');

  const key = params.key;

  layout.content.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon">⏳</span>
      <div class="empty-state-title">Memuat aset…</div>
    </div>`;

  let assets = [];
  try {
    assets = await adapter.list('assets');
  } catch (e) {
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <div class="empty-state-title">Gagal memuat</div>
        <div class="empty-state-desc">${esc(e.message)}</div>
        <a href="#/aset" class="btn btn-primary">Kembali ke Data Aset</a>
      </div>`;
    return;
  }

  if (window.location.hash !== myHash) return;

  // Cari berdasarkan id ATAU qr_token
  const asset = assets.find(a => a.id === key) || assets.find(a => a.qr_token === key);

  if (!asset) {
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">🔍</span>
        <div class="empty-state-title">Aset tidak ditemukan</div>
        <div class="empty-state-desc">Kode aset "${esc(key)}" tidak cocok dengan data mana pun.</div>
        <a href="#/aset" class="btn btn-primary">Kembali ke Data Aset</a>
      </div>`;
    return;
  }

  // Muat data pendukung
  const [categories, locations, holders] = await Promise.all([
    adapter.list('categories'),
    adapter.list('locations'),
    adapter.list('holders')
  ]);

  if (window.location.hash !== myHash) return;

  const cat = categories.find(c => c.id === asset.category_id);
  const loc = locations.find(l => l.id === asset.location_id);
  const hold = holders.find(h => h.id === asset.holder_id);
  const dep = computeDepreciation(asset);
  const canWrite = adapter.canWrite();

  const activeTab = query?.get('tab') || 'info';

  layout.content.innerHTML = `
    <div style="margin-bottom:16px">
      <a href="#/aset" class="text-sm" style="color:var(--text-muted)">← Kembali ke Data Aset</a>
    </div>

    <div class="card" style="margin-bottom:16px">
      <div class="row" style="align-items:flex-start;gap:20px;flex-wrap:wrap">
        <div id="detail-photo" style="width:120px;height:120px;border-radius:12px;background:var(--surface-2);display:grid;place-items:center;font-size:36px;color:var(--text-muted);overflow:hidden;flex-shrink:0">📦</div>
        <div style="flex:1;min-width:260px">
          <div class="row" style="gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <span class="badge badge-${asset.status === 'nonaktif' ? 'danger' : 'success'}">${labelStatus(asset.status)}</span>
            <span class="badge badge-${kondisiBadge(asset.kondisi)}">${labelKondisi(asset.kondisi)}</span>
            <span class="badge badge-muted">${esc(asset.kode || '—')}</span>
          </div>
          <h1 style="margin:0 0 4px;font-size:1.5rem">${esc(asset.nama || '—')}</h1>
          <p class="text-muted text-sm" style="margin:0">
            ${esc(cat?.nama || 'Tanpa kategori')}${loc ? ' · ' + esc(loc.nama) : ''}${hold ? ' · PJ: ' + esc(hold.nama) : ''}
          </p>
        </div>
        <div class="row" style="gap:6px;flex-wrap:wrap;align-items:flex-start">
          <button class="btn btn-ghost btn-sm" id="btn-qr">🔲 QR</button>
          <button class="btn btn-ghost btn-sm" id="btn-kartu">📄 Kartu Aset</button>
          ${canWrite ? `
            <button class="btn btn-secondary btn-sm" id="btn-edit">✏️ Edit</button>
            ${asset.status !== 'nonaktif'
              ? `<button class="btn btn-ghost btn-sm" id="btn-nonaktif" style="color:var(--accent-danger)">Nonaktifkan</button>`
              : `<button class="btn btn-ghost btn-sm" id="btn-aktifkan">Aktifkan</button>`}
          ` : ''}
        </div>
      </div>
    </div>

    <div style="display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:16px;overflow-x:auto">
      ${renderTabBtn('info', 'Info', activeTab)}
      ${renderTabBtn('riwayat', 'Riwayat', activeTab)}
      ${renderTabBtn('keuangan', 'Keuangan', activeTab)}
      ${renderTabBtn('agenda', 'Agenda', activeTab)}
      ${renderTabBtn('jurnal', 'Jurnal', activeTab)}
      ${renderTabBtn('lampiran', 'Lampiran', activeTab)}
    </div>

    <div id="detail-tab-body"></div>
  `;

  // Muat foto utama
  const firstPhotoId = getFirstPhotoId(asset);
  if (firstPhotoId) {
    try {
      const url = await adapter.getFileUrl(firstPhotoId);
      if (url) {
        const el = document.getElementById('detail-photo');
        if (el) el.innerHTML = `<img src="${esc(url)}" alt="" style="width:100%;height:100%;object-fit:cover" />`;
      }
    } catch {}
  }

  // Wire tab
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      window.location.hash = `/aset/${encodeURIComponent(asset.id)}?tab=${tab}`;
    });
  });

  // Wire tombol header
  document.getElementById('btn-edit')?.addEventListener('click', () => {
    openAssetForm({
      asset,
      onSaved: () => {
        // Reload halaman detail
        window.location.hash = `/aset/${encodeURIComponent(asset.id)}?tab=${activeTab}`;
        renderAssetDetail(layout, { params: { key: asset.id }, query: new URLSearchParams({ tab: activeTab }) });
      }
    });
  });

  document.getElementById('btn-qr')?.addEventListener('click', () => {
    window.location.hash = `/qr?asset=${encodeURIComponent(asset.id)}`;
  });

  document.getElementById('btn-kartu')?.addEventListener('click', () => {
    window.location.hash = `/qr?asset=${encodeURIComponent(asset.id)}&print=1`;
  });

  document.getElementById('btn-nonaktif')?.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Nonaktifkan aset',
      message: `Nonaktifkan "${asset.nama}"? Anda masih bisa mengaktifkannya kembali.`,
      okLabel: 'Nonaktifkan',
      danger: true
    });
    if (!ok) return;
    try {
      await adapter.update('assets', asset.id, { status: 'nonaktif', version: asset.version });
      notify.success('Aset dinonaktifkan');
      renderAssetDetail(layout, { params: { key: asset.id }, query: new URLSearchParams({ tab: activeTab }) });
    } catch (e) {
      notify.error('Gagal: ' + e.message);
    }
  });

  document.getElementById('btn-aktifkan')?.addEventListener('click', async () => {
    try {
      await adapter.update('assets', asset.id, { status: 'aktif', version: asset.version });
      notify.success('Aset diaktifkan kembali');
      renderAssetDetail(layout, { params: { key: asset.id }, query: new URLSearchParams({ tab: activeTab }) });
    } catch (e) {
      notify.error('Gagal: ' + e.message);
    }
  });

  // Render tab body
  const body = document.getElementById('detail-tab-body');
  switch (activeTab) {
    case 'info': renderInfoTab(body, { asset, cat, loc, hold, dep }); break;
    case 'riwayat':
    case 'keuangan':
    case 'agenda':
    case 'jurnal':
    case 'lampiran':
      await renderAssetTab(body, activeTab, asset);
      break;
    default: renderInfoTab(body, { asset, cat, loc, hold, dep });
  }
}

function renderTabBtn(tab, label, active) {
  const isActive = active === tab;
  return `<button data-tab="${tab}" style="
    padding:10px 16px;border:none;background:transparent;cursor:pointer;
    font-family:inherit;font-size:14px;font-weight:${isActive ? 700 : 500};
    color:${isActive ? 'var(--primary-dark)' : 'var(--text-muted)'};
    border-bottom:2px solid ${isActive ? 'var(--primary)' : 'transparent'};
    margin-bottom:-1px;white-space:nowrap
  ">${esc(label)}</button>`;
}

function renderInfoTab(container, { asset, cat, loc, hold, dep }) {
  let customFields = {};
  try { customFields = JSON.parse(asset.custom_fields || '{}'); } catch {}

  container.innerHTML = `
    <div class="row" style="align-items:flex-start;gap:16px;flex-wrap:wrap">
      <div class="card" style="flex:2;min-width:280px">
        <h3 style="margin-top:0">Detail</h3>
        <div class="kv-row"><span class="text-muted">Kode</span><strong>${esc(asset.kode || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Nama</span><strong>${esc(asset.nama || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Kategori</span><strong>${esc(cat?.nama || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Lokasi</span><strong>${esc(loc?.nama || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Penanggung Jawab</span><strong>${esc(hold?.nama || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Serial</span><strong>${esc(asset.serial || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Vendor</span><strong>${esc(asset.vendor || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Merk / Tipe</span><strong>${esc([asset.merk, asset.tipe].filter(Boolean).join(' / ') || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Jumlah</span><strong>${esc(asset.jumlah || 1)}</strong></div>
        <div class="kv-row"><span class="text-muted">Kondisi</span><strong>${labelKondisi(asset.kondisi)}</strong></div>
        <div class="kv-row"><span class="text-muted">Status</span><strong>${labelStatus(asset.status)}</strong></div>
        ${asset.keterangan ? `<div class="kv-row"><span class="text-muted">Keterangan</span><strong style="text-align:right;max-width:60%">${esc(asset.keterangan)}</strong></div>` : ''}
        ${Object.keys(customFields).length > 0 ? `
          ${Object.entries(customFields).map(([k, v]) =>
            `<div class="kv-row"><span class="text-muted">${esc(k)}</span><strong>${esc(String(v))}</strong></div>`
          ).join('')}
        ` : ''}
      </div>

      <div class="card" style="flex:1;min-width:240px">
        <h3 style="margin-top:0">Nilai &amp; Penyusutan</h3>
        <div class="kv-row"><span class="text-muted">Tanggal Beli</span><strong>${esc(asset.tgl_beli || '—')}</strong></div>
        <div class="kv-row"><span class="text-muted">Harga Perolehan</span><strong>${esc(formatRupiahFull(dep.harga))}</strong></div>
        <div class="kv-row"><span class="text-muted">Nilai Residu</span><strong>${esc(formatRupiahFull(dep.residu))}</strong></div>
        <div class="kv-row"><span class="text-muted">Metode</span><strong>${dep.metode === 'saldo_menurun' ? 'Saldo Menurun' : 'Garis Lurus'}</strong></div>
        <div class="kv-row"><span class="text-muted">Umur Ekonomis</span><strong>${esc(dep.umur_bulan)} bulan</strong></div>
        <div class="kv-row"><span class="text-muted">Bulan Berjalan</span><strong>${esc(dep.bulan_berjalan)}</strong></div>
        <div class="kv-row"><span class="text-muted">Beban per Bulan</span><strong>${esc(formatRupiahFull(dep.beban_per_bulan))}</strong></div>
        <div class="kv-row"><span class="text-muted">Akumulasi Penyusutan</span><strong>${esc(formatRupiahFull(dep.akumulasi))}</strong></div>
        <div class="kv-row" style="border-top:2px solid var(--border);padding-top:8px;margin-top:4px">
          <span class="text-muted">Nilai Kini</span>
          <strong style="color:var(--primary-dark);font-size:1.1em">${esc(formatRupiahFull(dep.nilai_buku))}</strong>
        </div>
        ${dep.selesai && dep.umur_bulan > 0
          ? `<p class="text-xs text-muted" style="margin-top:12px">✓ Aset sudah habis masa susutnya (mencapai nilai residu).</p>`
          : ''}
      </div>
    </div>
  `;
}
