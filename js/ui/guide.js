import { openModal, closeModal } from './modal.js';

const GUIDE_STEPS = [
  {
    num: 1,
    title: 'Siapkan Data Master (Wajib sebelum menambah aset)',
    desc: 'Lengkapi data referensi terlebih dahulu agar pilihan di formulir aset sudah tersedia:',
    items: [
      { label: 'Kategori', href: '#/kategori', detail: 'Kelompokkan jenis aset & atur umur ekonomis penyusutan.' },
      { label: 'Lokasi', href: '#/lokasi', detail: 'Catat ruangan, gedung, atau cabang tempat aset berada.' },
      { label: 'Penanggung Jawab', href: '#/penanggung-jawab', detail: 'Daftarkan nama PIC atau pemegang aset.' }
    ]
  },
  {
    num: 2,
    title: 'Tambahkan Data Aset',
    desc: 'Setelah Data Master siap, mulai masukkan inventaris secara satuan atau massal lewat Impor Excel.',
    items: [
      { label: 'Buka Data Aset', href: '#/aset', detail: 'Klik "+ Tambah Aset" atau gunakan tombol "Impor Excel".' }
    ]
  },
  {
    num: 3,
    title: 'Cetak Label QR & Uji Pindai',
    desc: 'Buat kode QR untuk ditempel pada fisik aset agar pelacakan dan pemeriksaan lebih cepat.',
    items: [
      { label: 'Cetak QR & Label', href: '#/qr', detail: 'Pilih aset lalu cetak kartu/stiker QR.' },
      { label: 'Pindai QR', href: '#/scan', detail: 'Uji pemindaian lewat kamera atau masukkan kode aset.' }
    ]
  },
  {
    num: 4,
    title: 'Kelola Operasional & Laporan',
    desc: 'Gunakan menu operasional sesuai kebutuhan harian organisasi Anda.',
    items: [
      { label: 'Peminjaman', href: '#/peminjaman', detail: 'Catat peminjaman dan pengembalian aset.' },
      { label: 'Jurnal Perawatan', href: '#/jurnal', detail: 'Rekam riwayat servis, perbaikan, dan pemeliharaan.' },
      { label: 'Audit Stok', href: '#/audit', detail: 'Lakukan stok opname berkala untuk mencocokkan fisik aset.' },
      { label: 'Laporan Lengkap', href: '#/laporan', detail: 'Pantau ringkasan nilai, keuangan, dan status aset.' }
    ]
  },
  {
    num: 5,
    title: 'Pengaturan & Keamanan Data',
    desc: 'Sesuaikan identitas workspace dan pastikan data Anda selalu aman.',
    items: [
      { label: 'Branding Workspace', href: '#/branding', detail: 'Atur nama dan logo organisasi pada aplikasi & cetak.' },
      { label: 'Pengaturan & Backup', href: '#/pengaturan', detail: 'Ekspor backup JSON secara rutin (terutama di Mode Lokal).' }
    ]
  }
];

export function openGuideModal() {
  const stepsHtml = GUIDE_STEPS.map(step => `
    <div class="guide-step">
      <div class="guide-step-num" aria-hidden="true">${step.num}</div>
      <div class="guide-step-body">
        <h3 class="guide-step-title">${step.title}</h3>
        <p class="guide-step-desc">${step.desc}</p>
        <ul class="guide-step-list">
          ${step.items.map(item => `
            <li>
              <a href="${item.href}" class="guide-link" data-guide-nav>${item.label}</a>
              <span class="text-muted"> — ${item.detail}</span>
            </li>
          `).join('')}
        </ul>
      </div>
    </div>
  `).join('');

  const body = document.createElement('div');
  body.className = 'guide-modal-content';
  body.innerHTML = `
    <div class="notice" style="margin-bottom:16px">
      <strong>Tips Pengguna Baru:</strong> Ikuti urutan langkah di bawah dari nomor 1 agar pengisian data aset berjalan lancar tanpa bolak-balik.
    </div>
    <div class="guide-steps">
      ${stepsHtml}
    </div>
    <div class="guide-footer-note">
      Butuh dokumentasi lebih lengkap (seperti setup Google Drive atau self-host)?
      <a href="pages/panduan.html" target="_blank" rel="noopener">Buka Halaman Panduan Lengkap ↗</a>
    </div>
  `;

  body.querySelectorAll('[data-guide-nav]').forEach(link => {
    link.addEventListener('click', () => {
      closeModal();
    });
  });

  openModal({
    title: 'Panduan Penggunaan Aplikasi',
    body,
    size: 'modal-lg',
    actions: [
      { label: 'Mengerti', class: 'btn btn-primary' }
    ]
  });
}
