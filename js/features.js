import { deploymentConfig } from './deployment-config.js';

export const FEATURES = [
  { id: 'dashboard', title: 'Dashboard & grafik ringkasan', description: 'Ringkasan aset dan grafik kategori, lokasi, serta nilai.', icon: '📊', path: '/dashboard', nav: true, stage: 3, availability: 'ready' },
  { id: 'assets', title: 'Data aset', description: 'Tambah, ubah, cari, filter, impor, dan ekspor data aset.', icon: '📋', path: '/aset', nav: true, stage: 3, availability: 'ready' },
  { id: 'categories', title: 'Kategori', description: 'Kelola kategori dan subkategori aset.', icon: '🗂️', path: '/kategori', nav: true, stage: 3, availability: 'ready' },
  { id: 'locations', title: 'Lokasi', description: 'Kelola lokasi penyimpanan aset.', icon: '📍', path: '/lokasi', nav: true, stage: 3, availability: 'ready' },
  { id: 'holders', title: 'Penanggung jawab', description: 'Kelola penanggung jawab aset.', icon: '👤', path: '/penanggung-jawab', nav: true, stage: 3, availability: 'ready' },
  { id: 'settings', title: 'Pengaturan', description: 'Atur tema, profil organisasi, dan backup lokal.', icon: '⚙️', path: '/pengaturan', nav: true, stage: 1, availability: 'ready' },
  { id: 'qr-cards', title: 'QR & kartu aset', description: 'Pembuatan QR dan kartu aset belum tersedia.', icon: '🔲', path: '/qr', nav: false, stage: 4, availability: 'planned' },
  { id: 'scan', title: 'Pemindaian QR', description: 'Pemindaian aset menggunakan kamera belum tersedia.', icon: '📷', path: '/scan', nav: false, stage: 4, availability: 'planned' },
  { id: 'history', title: 'Riwayat aset', description: 'Timeline perpindahan dan perubahan tiap aset belum tersedia.', icon: '⏱️', path: '/riwayat', nav: true, stage: 4, availability: 'planned' },
  { id: 'finance', title: 'Keuangan aset', description: 'Pencatatan pemasukan dan pengeluaran per aset belum tersedia.', icon: '💵', path: '/keuangan', nav: true, stage: 4, availability: 'planned' },
  { id: 'agenda', title: 'Agenda & kalender', description: 'Pengelolaan agenda dan kalender belum tersedia.', icon: '📅', path: '/agenda', nav: true, stage: 5, availability: 'planned' },
  { id: 'calendar-sync', title: 'Sinkronisasi Google Calendar', description: 'Koneksi dan sinkronisasi Google Calendar belum tersedia.', icon: '🗓️', path: '/kalender-google', nav: false, stage: 5, availability: 'planned' },
  { id: 'journal', title: 'Jurnal', description: 'Pencatatan jurnal kegiatan belum tersedia.', icon: '📖', path: '/jurnal', nav: true, stage: 5, availability: 'planned' },
  { id: 'audit', title: 'Audit stok opname', description: 'Sesi stock opname dan laporan audit belum tersedia.', icon: '🔎', path: '/audit', nav: true, stage: 5, availability: 'planned' },
  { id: 'loans', title: 'Peminjaman aset', description: 'Alur peminjaman dan pengembalian aset belum tersedia.', icon: '📤', path: '/peminjaman', nav: true, stage: 5, availability: 'planned' },
  { id: 'reports', title: 'Laporan lanjutan', description: 'Laporan aset lanjutan belum tersedia.', icon: '📈', path: '/laporan', nav: true, stage: 5, availability: 'planned' },
  { id: 'members', title: 'Anggota & berbagi', description: 'Pengelolaan anggota dan berbagi workspace dari aplikasi belum tersedia.', icon: '👥', path: '/anggota', nav: true, stage: 6, availability: 'planned' },
  { id: 'branding', title: 'Logo & branding organisasi', description: 'Pengaturan logo dan white-label belum tersedia.', icon: '🎨', path: '/branding', nav: false, stage: 6, availability: 'planned' },
  { id: 'reminders', title: 'Pengingat otomatis', description: 'Pengingat terjadwal melalui Apps Script belum tersedia.', icon: '🔔', path: '/pengingat', nav: false, stage: 6, availability: 'planned' },
  { id: 'google-storage', title: 'Penyimpanan Google Drive/Sheets', description: 'Koneksi Google memerlukan Client ID dari pengelola deployment.', icon: 'G', path: null, nav: false, stage: null, availability: 'google' },
  { id: 'shared-workspace', title: 'Membuka workspace yang dibagikan', description: 'Google Picker opsional dan belum diaktifkan pada deployment ini.', icon: '🔗', path: null, nav: false, stage: null, availability: 'picker' }
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
