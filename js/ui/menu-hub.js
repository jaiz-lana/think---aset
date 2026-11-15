import { esc } from '../utils/dom.js';
import { iconSvg } from './icons.js';

export const MENU_HUBS = {
  master: {
    path: '/menu/master',
    title: 'Data Master',
    subtitle: 'Data referensi dasar yang sebaiknya diisi terlebih dahulu sebelum menambahkan aset.',
    notice: 'Urutan disarankan untuk pemula: isi <strong>Kategori</strong>, <strong>Lokasi</strong>, dan <strong>Penanggung Jawab</strong> sebelum input aset.',
    items: [
      {
        title: 'Kategori',
        desc: 'Kelompokkan jenis aset beserta umur ekonomis untuk perhitungan penyusutan.',
        path: '/kategori',
        icon: 'categories'
      },
      {
        title: 'Lokasi',
        desc: 'Daftar ruangan, gedung, gudang, atau cabang tempat aset ditempatkan.',
        path: '/lokasi',
        icon: 'locations'
      },
      {
        title: 'Penanggung Jawab',
        desc: 'Daftar staf atau PIC yang memegang dan bertanggung jawab atas aset.',
        path: '/penanggung-jawab',
        icon: 'holders'
      }
    ]
  },
  operasional: {
    path: '/menu/operasional',
    title: 'Operasional',
    subtitle: 'Aktivitas harian pengelolaan aset: label QR, peminjaman, perawatan, audit, dan agenda.',
    items: [
      {
        title: 'Cetak QR & Label',
        desc: 'Buat dan cetak kartu atau stiker QR untuk ditempel pada fisik aset.',
        path: '/qr',
        icon: 'qr'
      },
      {
        title: 'Pindai QR',
        desc: 'Scan QR aset lewat kamera atau input kode untuk cek detail dengan cepat.',
        path: '/scan',
        icon: 'scan'
      },
      {
        title: 'Peminjaman',
        desc: 'Catat peminjaman, tanggal jatuh tempo, dan pengembalian aset.',
        path: '/peminjaman',
        icon: 'loans'
      },
      {
        title: 'Riwayat Aset',
        desc: 'Pantau jejak perpindahan lokasi, perubahan kondisi, dan pemegang aset.',
        path: '/riwayat',
        icon: 'history'
      },
      {
        title: 'Jurnal Perawatan',
        desc: 'Rekam catatan servis, perbaikan, dan pemeliharaan berkala aset.',
        path: '/jurnal',
        icon: 'journal'
      },
      {
        title: 'Audit Stok',
        desc: 'Lakukan sesi stok opname untuk mencocokkan data dengan kondisi fisik.',
        path: '/audit',
        icon: 'audit'
      },
      {
        title: 'Agenda & Kalender',
        desc: 'Kelola jadwal perawatan, jatuh tempo, dan kegiatan terkait aset.',
        path: '/agenda',
        icon: 'agenda'
      },
      {
        title: 'Sinkron Kalender',
        desc: 'Hubungkan agenda aset dengan Google Calendar Anda.',
        path: '/kalender-google',
        icon: 'calendar-sync'
      }
    ]
  },
  laporan: {
    path: '/menu/laporan',
    title: 'Laporan',
    subtitle: 'Analisis keuangan, nilai penyusutan, audit, dan ringkasan aset secara menyeluruh.',
    items: [
      {
        title: 'Keuangan Aset',
        desc: 'Catat pemasukan dan pengeluaran operasional per aset.',
        path: '/keuangan',
        icon: 'finance'
      },
      {
        title: 'Laporan Lengkap',
        desc: 'Lihat ringkasan nilai aset, penyusutan, audit, dan peminjaman siap ekspor.',
        path: '/laporan',
        icon: 'reports'
      }
    ]
  },
  pengaturan: {
    path: '/menu/pengaturan',
    title: 'Pengaturan',
    subtitle: 'Konfigurasi workspace, tampilan logo organisasi, kolaborasi tim, dan backup data.',
    items: [
      {
        title: 'Pengaturan & Backup',
        desc: 'Tema tampilan, ekspor/impor backup JSON, dan reset data lokal.',
        path: '/pengaturan',
        icon: 'settings'
      },
      {
        title: 'Branding Workspace',
        desc: 'Ubah nama dan logo organisasi yang tampil di aplikasi & cetak.',
        path: '/branding',
        icon: 'branding'
      },
      {
        title: 'Anggota & Berbagi',
        desc: 'Undang rekan tim untuk berkolaborasi di workspace Google Drive.',
        path: '/anggota',
        icon: 'members'
      },
      {
        title: 'Pengingat Otomatis',
        desc: 'Atur notifikasi browser untuk agenda dan jadwal yang mendekati tenggat.',
        path: '/pengingat',
        icon: 'reminders'
      }
    ]
  }
};

export function getParentMenuPath(path) {
  if (!path || path === '/' || path === '/dashboard') return '/dashboard';
  if (path === '/aset' || path.startsWith('/aset/')) return '/aset';

  for (const hub of Object.values(MENU_HUBS)) {
    if (path === hub.path || hub.items.some(item => item.path === path)) {
      return hub.path;
    }
  }
  return path;
}

export function renderMenuHub(layout, hubId) {
  const hub = MENU_HUBS[hubId];
  if (!hub) {
    layout.content.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-title">Menu tidak ditemukan</div>
        <a href="#/dashboard" class="btn btn-primary">Kembali ke Dashboard</a>
      </div>`;
    return;
  }

  layout.setActive(hub.path);
  layout.setTitle(hub.title);
  layout.setActions('');

  layout.content.innerHTML = `
    <div class="page-header">
      <div>
        <h1>${esc(hub.title)}</h1>
        <p class="text-muted" style="margin:4px 0 0">${esc(hub.subtitle)}</p>
      </div>
    </div>

    ${hub.notice ? `<div class="notice">${hub.notice}</div>` : ''}

    <div class="hub-grid">
      ${hub.items.map(item => `
        <a href="#${esc(item.path)}" class="hub-card">
          <div class="hub-card-icon">${iconSvg(item.icon, 22)}</div>
          <div class="hub-card-body">
            <div class="hub-card-title">${esc(item.title)}</div>
            <div class="hub-card-desc">${esc(item.desc)}</div>
          </div>
          <div class="hub-card-arrow" aria-hidden="true">${iconSvg('chevronRight', 18)}</div>
        </a>
      `).join('')}
    </div>
  `;
}
