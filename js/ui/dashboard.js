import { getAdapter } from '../auth.js';
import { esc, $ } from '../utils/dom.js';
import { escapeFeatureText } from '../features.js';
import { notify } from '../utils/toast.js';
import { ensureChartJs } from '../utils/external-libs.js';
import {
  computeDepreciation, parseLocalDate, summarizeAssets,
  formatRupiah, formatRupiahFull
} from '../utils/depreciation.js';

let charts = { donut: null, bar: null, line: null };

export async function renderDashboard(layout) {
  const adapter = getAdapter();
  const myHash = window.location.hash;
  layout.setActive('/dashboard');
  layout.setTitle('Dashboard');
  layout.setActions(`
    ${adapter.canWrite() ? '<button class="btn btn-primary btn-sm" id="dash-tambah-aset">+ Tambah Aset</button>' : ''}
    <button class="btn btn-ghost btn-sm" id="dash-scan">📷 Scan</button>
  `);

  layout.content.innerHTML = `
    <div class="empty-state">
      <span class="empty-state-icon">⏳</span>
      <div class="empty-state-title">Memuat dashboard…</div>
    </div>`;

  // Musnahkan chart lama agar tidak bocor memori
  destroyCharts();

  // Wire tombol topbar
  $('#dash-tambah-aset')?.addEventListener('click', () => {
    window.location.hash = '/aset?aksi=tambah';
  });
  $('#dash-scan')?.addEventListener('click', () => {
    notify.info('Fitur pemindaian belum tersedia.');
  });

  try {
    const [assets, categories, locations, agendas, activity, holders] = await Promise.all([
      adapter.list('assets'),
      adapter.list('categories'),
      adapter.list('locations'),
      adapter.list('agendas'),
      adapter.listRecent('activity_log', 8),
      adapter.list('holders')
    ]);

    let chartError = '';
    if (assets.some(a => a.status !== 'nonaktif')) {
      try {
        await ensureChartJs();
      } catch (e) {
        chartError = e.message;
      }
    }

    if (window.location.hash !== myHash) return;
    renderDashboardHTML({
      assets, categories, locations, agendas, activity, holders, chartError,
      canWrite: adapter.canWrite(),
      unavailableFeatures: layout.getUnavailableFeatures()
    });
  } catch (e) {
    console.error(e);
    if (window.location.hash !== myHash) return;
    layout.content.innerHTML = `
      <div class="empty-state">
        <span class="empty-state-icon">⚠️</span>
        <div class="empty-state-title">Gagal memuat dashboard</div>
        <div class="empty-state-desc">${esc(e.message || 'Terjadi kesalahan')}</div>
        <button class="btn btn-primary" id="dash-retry">Coba lagi</button>
      </div>`;
    $('#dash-retry')?.addEventListener('click', () => renderDashboard(layout));
  }
}

function renderDashboardHTML({ assets, categories, locations, agendas, activity, holders, chartError, canWrite, unavailableFeatures }) {
  const content = document.getElementById('app-content');

  const activeAssets = assets.filter(a => a.status !== 'nonaktif');
  const inactiveCount = assets.length - activeAssets.length;
  const summary = summarizeAssets(activeAssets);

  const orgName = (() => {
    try { return localStorage.getItem('ta_org_name') || ''; } catch { return ''; }
  })();

  content.innerHTML = `
    <div class="dash-header">
      <div>
        <h1>Dashboard</h1>
        <p class="text-muted">${orgName ? esc(orgName) + ' · ' : ''}Ringkasan aset Anda saat ini.</p>
      </div>
    </div>

    ${renderFeatureAnnouncement(unavailableFeatures)}

    <div class="dash-grid">
      <div class="dash-card">
        <div class="dash-card-label">Total Aset</div>
        <div class="dash-card-value">${assets.length.toLocaleString('id-ID')}</div>
        <div class="dash-card-sub">${activeAssets.length} aktif · ${inactiveCount} nonaktif</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-label">Total Nilai Perolehan</div>
        <div class="dash-card-value">${esc(formatRupiah(summary.total_harga))}</div>
        <div class="dash-card-sub">${esc(formatRupiahFull(summary.total_harga))}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-label">Nilai Kini</div>
        <div class="dash-card-value">${esc(formatRupiah(summary.total_nilai_kini))}</div>
        <div class="dash-card-sub">${esc(formatRupiahFull(summary.total_nilai_kini))}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-label">Total Penyusutan</div>
        <div class="dash-card-value">${esc(formatRupiah(summary.total_penyusutan))}</div>
        <div class="dash-card-sub">${esc(formatRupiahFull(summary.total_penyusutan))}</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-label">Kategori</div>
        <div class="dash-card-value">${categories.length.toLocaleString('id-ID')}</div>
        <div class="dash-card-sub">${categories.filter(c => c.parent_id).length} subkategori</div>
      </div>
      <div class="dash-card">
        <div class="dash-card-label">Penanggung Jawab</div>
        <div class="dash-card-value">${holders.length.toLocaleString('id-ID')}</div>
        <div class="dash-card-sub">${locations.length} lokasi terdaftar</div>
      </div>
    </div>

    <div class="dash-charts">
      <div class="chart-box">
        <h3>Aset per Kategori</h3>
        <div class="chart-canvas-wrap" id="chart-donut-wrap">
          ${activeAssets.length === 0 ? '<div class="chart-empty">Belum ada data aset.</div>' : '<canvas id="chart-donut"></canvas>'}
        </div>
      </div>
      <div class="chart-box">
        <h3>Aset per Lokasi</h3>
        <div class="chart-canvas-wrap" id="chart-bar-wrap">
          ${activeAssets.length === 0 ? '<div class="chart-empty">Belum ada data aset.</div>' : '<canvas id="chart-bar"></canvas>'}
        </div>
      </div>
    </div>

    <div class="chart-box" style="margin-bottom:24px">
      <h3>Nilai Aset (12 Bulan Terakhir)</h3>
      <div class="chart-canvas-wrap" style="height:260px" id="chart-line-wrap">
        ${activeAssets.length === 0 ? '<div class="chart-empty">Belum ada data aset.</div>' : '<canvas id="chart-line"></canvas>'}
      </div>
    </div>

    <div class="dash-split">
      <div class="dash-panel">
        <h3>Agenda 7 Hari ke Depan</h3>
        ${renderUpcomingAgenda(agendas)}
      </div>
      <div class="dash-panel">
        <h3>Aktivitas Terakhir</h3>
        ${renderRecentActivity(activity)}
      </div>
    </div>

    <div class="card" style="margin-top:24px">
      <div class="row-between">
        <strong>Aksi cepat</strong>
      </div>
      <div class="row" style="margin-top:12px;flex-wrap:wrap">
        ${canWrite ? '<a href="#/aset?aksi=tambah" class="btn btn-primary btn-sm">+ Tambah Aset</a>' : ''}
        <a href="#/aset" class="btn btn-ghost btn-sm">📋 Buka Data Aset</a>
        <a href="#/kategori" class="btn btn-ghost btn-sm">🗂️ Kelola Kategori</a>
        <a href="#/pengaturan" class="btn btn-ghost btn-sm">⚙️ Pengaturan</a>
      </div>
    </div>
  `;

  // Render grafik setelah DOM siap
  if (activeAssets.length > 0) {
    if (window.Chart) {
      try {
        renderDonutChart(activeAssets, categories);
        renderBarChart(activeAssets, locations);
        renderLineChart(activeAssets);
      } catch (e) {
        console.warn('Render chart gagal:', e);
      }
    }
    if (!window.Chart) {
      document.querySelectorAll('.chart-canvas-wrap').forEach(el => {
        el.innerHTML = `<div class="chart-empty">${esc(chartError || 'Grafik tidak tersedia.')}</div>`;
      });
    }
  }
}

function renderFeatureAnnouncement(features) {
  if (!features.length) return '';
  return `<section class="notice feature-announcement" aria-labelledby="feature-announcement-title">
    <strong id="feature-announcement-title">Fitur yang belum tersedia</strong>
    <ul class="feature-status-list">${features.map(item =>
      `<li>${escapeFeatureText(item.title)}${item.availability === 'planned' ? '' : ' · Perlu konfigurasi deployment'}</li>`
    ).join('')}</ul>
    <a href="index.html#fitur">Lihat status semua fitur</a>
  </section>`;
}

function destroyCharts() {
  Object.keys(charts).forEach(k => {
    if (charts[k] && typeof charts[k].destroy === 'function') {
      charts[k].destroy();
    }
    charts[k] = null;
  });
}

// ---------- Tema grafik (ikut tema terang/gelap) ----------
function chartTheme() {
  const css = getComputedStyle(document.documentElement);
  const v = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  Chart.defaults.color = v('--text-muted', '#6B7280');
  Chart.defaults.borderColor = v('--border', '#E5E7EB');
  return { surface: v('--surface', '#ffffff') };
}

// ---------- Grafik Donat (per kategori) ----------
function renderDonutChart(assets, categories) {
  const canvas = document.getElementById('chart-donut');
  if (!canvas) return;
  const { surface } = chartTheme();

  const catMap = new Map();
  categories.forEach(c => catMap.set(c.id, c));
  const counts = new Map();

  for (const a of assets) {
    const cat = catMap.get(a.category_id);
    const label = cat ? cat.nama : 'Tanpa kategori';
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const labels = Array.from(counts.keys());
  const data = Array.from(counts.values());
  const palette = [
    '#16A34A', '#0D9488', '#84CC16', '#F59E0B', '#DC2626',
    '#0891B2', '#65A30D', '#EA580C', '#7C3AED', '#DB2777'
  ];

  charts.donut = new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderColor: surface
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
      }
    }
  });
}

// ---------- Grafik Batang (per lokasi) ----------
function renderBarChart(assets, locations) {
  const canvas = document.getElementById('chart-bar');
  if (!canvas) return;
  chartTheme();

  const locMap = new Map();
  locations.forEach(l => locMap.set(l.id, l));
  const counts = new Map();
  for (const a of assets) {
    const loc = locMap.get(a.location_id);
    const label = loc ? loc.nama : 'Tanpa lokasi';
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  // Ambil 8 teratas
  const entries = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const labels = entries.map(e => e[0]);
  const data = entries.map(e => e[1]);

  charts.bar = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Jumlah Aset',
        data,
        backgroundColor: '#16A34A',
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0, font: { size: 11 } } },
        x: { ticks: { font: { size: 11 }, maxRotation: 40, minRotation: 0 } }
      }
    }
  });
}

// ---------- Grafik Garis (nilai aset 12 bulan terakhir) ----------
function renderLineChart(assets) {
  const canvas = document.getElementById('chart-line');
  if (!canvas) return;
  chartTheme();

  const now = new Date();
  const labels = [];
  const values = [];

  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 0, 23, 59, 59);
    labels.push(start.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' }));

    let total = 0;
    for (const a of assets) {
      if (!a.tgl_beli) continue;
      const tglBeli = parseLocalDate(a.tgl_beli);
      if (isNaN(tglBeli.getTime())) continue;
      if (tglBeli > end) continue;
      total += computeDepreciation(a, end).nilai_buku;
    }
    values.push(total);
  }

  charts.line = new Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Nilai Buku (Rp)',
        data: values,
        borderColor: '#16A34A',
        backgroundColor: 'rgba(22, 163, 74, 0.12)',
        fill: true,
        tension: 0.32,
        pointRadius: 3,
        pointBackgroundColor: '#16A34A'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => 'Rp ' + Number(ctx.raw || 0).toLocaleString('id-ID')
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            font: { size: 11 },
            callback: (v) => {
              const n = Number(v) || 0;
              if (n >= 1_000_000_000) return 'Rp ' + (n / 1_000_000_000).toFixed(1) + ' M';
              if (n >= 1_000_000) return 'Rp ' + (n / 1_000_000).toFixed(1) + ' jt';
              if (n >= 1_000) return 'Rp ' + (n / 1_000).toFixed(0) + ' rb';
              return 'Rp ' + n;
            }
          }
        },
        x: { ticks: { font: { size: 11 } } }
      }
    }
  });
}

// ---------- Agenda ----------
function renderUpcomingAgenda(agendas) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);
  const upcoming = (agendas || [])
    .filter(a => {
      if (!a.tanggal || a.selesai === 'true' || a.selesai === true) return false;
      const t = parseLocalDate(a.tanggal);
      if (isNaN(t.getTime())) return false;
      return t >= today && t <= in7;
    })
    .sort((a, b) => parseLocalDate(a.tanggal) - parseLocalDate(b.tanggal))
    .slice(0, 5);

  if (upcoming.length === 0) {
    return `<p class="text-sm text-muted" style="margin:0">Tidak ada agenda dalam 7 hari ke depan.</p>`;
  }

  return `<ul class="dash-list">
    ${upcoming.map(a => {
      const tgl = parseLocalDate(a.tanggal);
      const label = tgl.toLocaleDateString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric'
      });
      return `<li class="dash-list-item">
        <span class="dash-list-title">${esc(a.judul || '(tanpa judul)')}</span>
        <span class="dash-list-meta">${esc(label)}</span>
      </li>`;
    }).join('')}
  </ul>`;
}

// ---------- Aktivitas ----------
function renderRecentActivity(activity) {
  const recent = (activity || [])
    .slice()
    .sort((a, b) => new Date(b.waktu || 0) - new Date(a.waktu || 0))
    .slice(0, 8);

  if (recent.length === 0) {
    return `<p class="text-sm text-muted" style="margin:0">Belum ada aktivitas tercatat.</p>`;
  }

  return `<ul class="dash-list">
    ${recent.map(a => {
      const tgl = a.waktu
        ? new Date(a.waktu).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
          })
        : '—';
      return `<li class="dash-list-item">
        <span class="dash-list-title">${esc(a.aksi || '-')} · ${esc(a.objek || '-')}</span>
        <span class="dash-list-meta">${esc(a.user || '-')} · ${esc(tgl)}</span>
      </li>`;
    }).join('')}
  </ul>`;
}
