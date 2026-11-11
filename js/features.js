import { deploymentConfig } from './deployment-config.js';

export const FEATURES = [
  // --- MENU UTAMA ---
  { id: 'dashboard', title: 'Dashboard & grafik ringkasan', shortTitle: 'Dashboard', group: 'Menu Utama', icon: '📊', path: '/dashboard', nav: true, stage: 3, availability: 'ready' },
  { id: 'assets', title: 'Data aset', shortTitle: 'Daftar Aset', group: 'Menu Utama', icon: '📋', path: '/aset', nav: true, stage: 3, availability: 'ready' },
  { id: 'qr-cards', title: 'QR & kartu aset', shortTitle: 'Cetak QR & Label', group: 'Menu Utama', icon: '🔲', path: '/qr', nav: true, stage: 4, availability: 'ready' },
  { id: 'scan', title: 'Pemindaian QR', shortTitle: 'Pindai QR', group: 'Menu Utama', icon: '📷', path: '/scan', nav: true, stage: 4, availability: 'ready' },

  // --- DATA MASTER ---
  { id: 'categories', title: 'Kategori', shortTitle: 'Kategori', group: 'Data Master', icon: '🗂️', path: '/kategori', nav: true, stage: 3, availability: 'ready' },
  { id: 'locations', title: 'Lokasi', shortTitle: 'Lokasi', group: 'Data Master', icon: '📍', path: '/lokasi', nav: true, stage: 3, availability: 'ready' },
  { id: 'holders', title: 'Penanggung jawab', shortTitle: 'Penanggung Jawab', group: 'Data Master', icon: '👤', path: '/penanggung-jawab', nav: true, stage: 3, availability: 'ready' },

  // --- OPERASIONAL ---
  { id: 'history', title: 'Riwayat aset', shortTitle: 'Riwayat Aset', group: 'Operasional', icon: '⏱️', path: '/riwayat', nav: true, stage: 4, availability: 'ready' },
  { id: 'loans', title: 'Peminjaman aset', shortTitle: 'Peminjaman', group: 'Operasional', icon: '📤', path: '/peminjaman', nav: true, stage: 5, availability: 'ready' },
  { id: 'audit', title: 'Audit stok opname', shortTitle: 'Audit Stok', group: 'Operasional', icon: '🔎', path: '/audit', nav: true, stage: 5, availability: 'ready' },
  { id: 'journal', title: 'Jurnal', shortTitle: 'Jurnal Perawatan', group: 'Operasional', icon: '📖', path: '/jurnal', nav: true, stage: 5, availability: 'ready' },
  { id: 'agenda', title: 'Agenda & kalender', shortTitle: 'Agenda & Kalender', group: 'Operasional', icon: '📅', path: '/agenda', nav: true, stage: 5, availability: 'ready' },
  { id: 'calendar-sync', title: 'Sinkronisasi Google Calendar', shortTitle: 'Sinkron Kalender', group: 'Operasional', icon: '🗓️', path: '/kalender-google', nav: true, stage: 5, availability: 'ready' },

  // --- LAPORAN & KEUANGAN ---
  { id: 'finance', title: 'Keuangan aset', shortTitle: 'Keuangan Aset', group: 'Laporan & Keuangan', icon: '💵', path: '/keuangan', nav: true, stage: 4, availability: 'ready' },
  { id: 'reports', title: 'Laporan lanjutan', shortTitle: 'Laporan Lengkap', group: 'Laporan & Keuangan', icon: '📈', path: '/laporan', nav: true, stage: 5, availability: 'ready' },

  // --- PENGATURAN & SISTEM ---
  { id: 'members', title: 'Anggota & berbagi', shortTitle: 'Anggota & Berbagi', group: 'Pengaturan & Sistem', icon: '👥', path: '/anggota', nav: true, stage: 6, availability: 'ready' },
  { id: 'branding', title: 'Logo & branding organisasi', shortTitle: 'Branding Workspace', group: 'Pengaturan & Sistem', icon: '🎨', path: '/branding', nav: true, stage: 6, availability: 'ready' },
  { id: 'reminders', title: 'Pengingat otomatis', shortTitle: 'Pengingat Otomatis', group: 'Pengaturan & Sistem', icon: '🔔', path: '/pengingat', nav: true, stage: 6, availability: 'ready' },
  { id: 'settings', title: 'Pengaturan', shortTitle: 'Pengaturan', group: 'Pengaturan & Sistem', icon: '⚙️', path: '/pengaturan', nav: true, stage: 1, availability: 'ready' },

  // --- NON NAVIGASI ---
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
