import { deploymentConfig } from './deployment-config.js';

export const FEATURES = [
  { id: 'dashboard', title: 'Dashboard & grafik ringkasan', description: 'Ringkasan aset dan grafik kategori, lokasi, serta nilai.', icon: '📊', path: '/dashboard', nav: true, stage: 3, availability: 'ready' },
  { id: 'assets', title: 'Data aset', description: 'Tambah, ubah, cari, filter, impor, dan ekspor data aset.', icon: '📋', path: '/aset', nav: true, stage: 3, availability: 'ready' },
  { id: 'categories', title: 'Kategori', description: 'Kelola kategori dan subkategori aset.', icon: '🗂️', path: '/kategori', nav: true, stage: 3, availability: 'ready' },
  { id: 'locations', title: 'Lokasi', description: 'Kelola lokasi penyimpanan aset.', icon: '📍', path: '/lokasi', nav: true, stage: 3, availability: 'ready' },
  { id: 'holders', title: 'Penanggung jawab', description: 'Kelola penanggung jawab aset.', icon: '👤', path: '/penanggung-jawab', nav: true, stage: 3, availability: 'ready' },
  { id: 'settings', title: 'Pengaturan', description: 'Atur tema, profil organisasi, dan backup lokal.', icon: '⚙️', path: '/pengaturan', nav: true, stage: 1, availability: 'ready' },
  { id: 'qr-cards', title: 'QR & kartu aset', description: 'Buat QR bertoken acak untuk aset dan cetak kartu aset.', icon: '🔲', path: '/qr', nav: true, stage: 4, availability: 'ready' },
  { id: 'scan', title: 'Pemindaian QR', description: 'Cari aset dengan kamera yang mendukung BarcodeDetector atau masukkan kodenya.', icon: '📷', path: '/scan', nav: true, stage: 4, availability: 'ready' },
  { id: 'history', title: 'Riwayat aset', description: 'Catat perpindahan, perubahan kondisi, dan perawatan aset.', icon: '⏱️', path: '/riwayat', nav: true, stage: 4, availability: 'ready' },
  { id: 'finance', title: 'Keuangan aset', description: 'Catat pemasukan dan pengeluaran per aset.', icon: '💵', path: '/keuangan', nav: true, stage: 4, availability: 'ready' },
  { id: 'agenda', title: 'Agenda & kalender', description: 'Kelola agenda, tenggat, dan kegiatan terkait aset.', icon: '📅', path: '/agenda', nav: true, stage: 5, availability: 'ready' },
  { id: 'calendar-sync', title: 'Sinkronisasi Google Calendar', description: 'Sinkronkan agenda satu arah ke Google Calendar atau ekspor iCalendar.', icon: '🗓️', path: '/kalender-google', nav: true, stage: 5, availability: 'ready' },
  { id: 'journal', title: 'Jurnal', description: 'Catat kegiatan dan pemeliharaan aset.', icon: '📖', path: '/jurnal', nav: true, stage: 5, availability: 'ready' },
  { id: 'audit', title: 'Audit stok opname', description: 'Buat sesi audit dan catat hasil pemeriksaan aset.', icon: '🔎', path: '/audit', nav: true, stage: 5, availability: 'ready' },
  { id: 'loans', title: 'Peminjaman aset', description: 'Kelola peminjaman, tanggal jatuh tempo, dan pengembalian aset.', icon: '📤', path: '/peminjaman', nav: true, stage: 5, availability: 'ready' },
  { id: 'reports', title: 'Laporan lanjutan', description: 'Ringkasan kategori, lokasi, nilai aset, keuangan, audit, dan peminjaman.', icon: '📈', path: '/laporan', nav: true, stage: 5, availability: 'ready' },
  { id: 'members', title: 'Anggota & berbagi', description: 'Kelola undangan dan izin akses workspace Google Drive.', icon: '👥', path: '/anggota', nav: true, stage: 6, availability: 'ready' },
  { id: 'branding', title: 'Logo & branding organisasi', description: 'Atur nama workspace dan logo organisasi.', icon: '🎨', path: '/branding', nav: true, stage: 6, availability: 'ready' },
  { id: 'reminders', title: 'Pengingat otomatis', description: 'Kirim notifikasi browser untuk agenda saat aplikasi terbuka.', icon: '🔔', path: '/pengingat', nav: true, stage: 6, availability: 'ready' },
  { id: 'google-storage', title: 'Penyimpanan Google Drive/Sheets', description: 'Koneksi Google memerlukan Client ID dari pengelola deployment.', icon: 'G', path: null, nav: false, stage: null, availability: 'google' },
  { id: 'shared-workspace', title: 'Membuka workspace yang dibagikan', description: 'Google Picker memerlukan API Key dan App ID dari pengelola deployment.', icon: '🔗', path: null, nav: false, stage: null, availability: 'picker' }
];

export function isFeatureAvailable(feature, router) {
  if (feature.availability === 'planned') return false;
  if (feature.availability === 'google') return Boolean(deploymentConfig.GOOGLE_CLIENT_ID);
  if (feature.availability === 'picker') {
    return Boolean(deploymentConfig.GOOGLE_API_KEY && deploymentConfig.GOOGLE_APP_ID);
  }
  if (feature.path && router) return router.hasRoute(feature.path);
  return true;
}

export function getUnavailableFeatures(router) {
  return FEATURES.filter(feature => !isFeatureAvailable(feature, router));
}

export function escapeFeatureText(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}
