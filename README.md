# Think Aset

Aplikasi manajemen aset & inventaris kantor yang **open source (MIT)**, PWA statis tanpa backend dan tanpa database di server pengembang. Seluruh data disimpan di penyimpanan milik pengguna sendiri (Google Drive/Sheets atau IndexedDB lokal).

## Status Fitur

Fitur aktif mencakup penyimpanan lokal, PWA, dashboard, aset, kategori/lokasi/penanggung jawab,
impor/ekspor, QR dan kartu cetak, riwayat, keuangan, agenda, jurnal, audit stok opname,
peminjaman, laporan, branding, serta pengingat notifikasi browser saat aplikasi terbuka. Google
Drive dan undangan anggota memerlukan OAuth Client ID deployment. Status dashboard, menu, dan
halaman utama dibangkitkan dari satu katalog di `js/features.js`; setiap route tersedia memiliki
handler aplikasi.

- **Tahap 1** — Fondasi: tema, autentikasi, storage adapter (Google & lokal), onboarding, PWA, konfigurasi Google per deployment, Backup/Restore (lokal).
- **Tahap 2** — Halaman profil publik: Home, Manfaat, Fitur, Panduan, Kontak, Privasi, FAQ.
- **Tahap 3** — Dashboard + grafik, Kategori/Lokasi/Penanggung Jawab, Data Aset (CRUD, filter, import/export), Detail Aset.
- **Tahap 4** — QR & kartu aset, pemindaian kamera (browser yang mendukungnya), riwayat, keuangan.
- **Tahap 5** — Agenda, ekspor iCalendar, sinkronisasi Google Calendar satu arah, jurnal, audit, peminjaman, laporan.
- **Tahap 6** — Anggota & berbagi (mode Google), branding workspace, pengingat browser saat aplikasi terbuka.

Sinkronisasi agenda Google Calendar berjalan satu arah dari Think Aset dan meminta izin Calendar
saat pengguna memilihnya. Sinkronisasi balik dan pengingat saat aplikasi tertutup belum tersedia.
Pemindaian kamera memerlukan HTTPS (atau localhost) dan dukungan `BarcodeDetector`; masukkan kode
secara manual bila browser tidak mendukung kamera.

## Cara Self-Host

### GitHub Pages
1. Fork repo ini.
2. **Settings → Pages** → Source: `main` / root → **Save**.
3. Buka `https://<username>.github.io/think-aset/`.

### Cloudflare Pages
1. Login ke Cloudflare Pages → **Create project** → **Direct Upload**.
2. Unggah seluruh isi repo (folder root).
3. Cloudflare akan memberi URL HTTPS.

### PC Sendiri
```bash
git clone https://github.com/username/think-aset.git
cd think-aset
python3 -m http.server 8080
# Buka http://localhost:8080
```

> PWA membutuhkan HTTPS (kecuali `localhost`).
> Service Worker mulai menyimpan aset aplikasi setelah kunjungan pertama. Grafik, QR, dan impor/ekspor Excel dimuat dari CDN saat dibutuhkan; fitur-fitur tersebut memerlukan koneksi internet.

## Menyiapkan koneksi Google (sekali per deployment)

Pengguna cukup memilih akun Google dan menyetujui izin yang diminta aplikasi. Mereka tidak perlu
membuat API Key. Pengelola aplikasi perlu menyiapkan OAuth Client ID satu kali:

1. Buka [Google Cloud Console](https://console.cloud.google.com/).
2. Buat project baru (mis. `Think Aset`).
3. **APIs & Services → Library** — aktifkan:
   - Google Sheets API
   - Google Drive API
   - Google Calendar API (opsional, untuk sinkronisasi agenda)
   - Google Picker API (opsional, untuk membuka workspace yang dibagikan)
4. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Isi nama aplikasi, email dukungan, domain (mis. `username.github.io`)
   - Scope: tambahkan `drive.file`, `userinfo.email`, `userinfo.profile`; `calendar.events` diminta saat pengguna memilih sinkronisasi kalender.
   - Tambahkan diri Anda sebagai Test User (jika mode testing)
5. **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - Authorized JavaScript origins: `http://localhost:8080`, `https://<username>.github.io`, `https://<app>.pages.dev` (domain Anda)
   - Authorized redirect URIs: *tidak diperlukan* untuk token model
6. Salin **Client ID** dan isi `GOOGLE_CLIENT_ID` di `js/deployment-config.js`, lalu deploy ulang.

### Opsional: Google Picker
Tanpa langkah ini, pengguna tetap dapat menghubungkan Google dan memakai workspace Drive/Sheets
sendiri. Untuk mengizinkan pengguna membuka workspace yang sudah dibagikan melalui Picker:

1. Buat API Key dan gunakan Project Number sebagai App ID di Google Cloud Console.
2. Batasi API Key ke HTTP referrers deployment Anda dan Google Picker API saja.
3. Isi `GOOGLE_API_KEY` dan `GOOGLE_APP_ID` pada `js/deployment-config.js`, lalu deploy ulang.

Mode Google membutuhkan koneksi internet dan OAuth yang disiapkan pengelola deployment. Scope
`drive.file` membatasi akses ke file yang dibuat atau dibuka melalui aplikasi. Scope
`calendar.events` hanya diminta atas tindakan pengguna pada halaman kalender; sinkronisasi berjalan
satu arah dari aplikasi. Tanpa konfigurasi Google pada deployment, gunakan mode Penyimpanan Lokal
dan ekspor agenda sebagai `.ics`.

## Mode Penyimpanan

| Mode | Data disimpan di | Sinkron antar perangkat | Backup |
|---|---|---|---|
| **Google Drive/Sheets** | Spreadsheet + folder lampiran di Drive Anda | ✅ Setelah workspace yang sama dibuka di perangkat lain | Unduh sheet dari Google |
| **Penyimpanan Lokal** | IndexedDB browser | ❌ | Tombol Backup JSON di Pengaturan |

Backup JSON lokal menyertakan data tabel dan isi berkas (foto/lampiran/logo). Restore mengganti data tabel dan memulihkan berkas yang ada di backup.

## Struktur Data

Skema lengkap ada di `js/storage/adapter.js` (`TABLES`, `SCHEMAS`).
Tabel biasa menyimpan `version`, `created_at`, `updated_at`, dan `updated_by`. Penyimpanan lokal
memeriksa versi saat update. Google Sheets tidak menyediakan pembaruan per baris yang atomik,
jadi hindari mengedit catatan yang sama secara bersamaan dari beberapa perangkat.

## Menambah Storage Adapter Baru

Buat adapter di `js/storage/my-adapter.js` yang meng-`extends StorageAdapter` dan mengimplementasikan:

```js
init(), list(tabel, filter), get(tabel, id), create(tabel, data),
update(tabel, id, data), remove(tabel, id),
uploadFile(file), getFileUrl(id), shareWith(email, peran), listMembers()
```

Lalu daftarkan di `js/auth.js` dan tambahkan opsi di layar login `js/app.js`.

**Aturan penting:**
- Jangan pernah memanggil API pihak ketiga di luar adapter.
- Wajib lempar `Error` dengan `code = 'CONFLICT'` saat `version` mismatch.
- Token hanya di `sessionStorage`/memori — jangan di localStorage.
- Selalu batch tulis log bila ada network cost.

## Lisensi

MIT — lihat [LICENSE.txt](LICENSE.txt).

## Kontribusi

Lihat [CONTRIBUTING.md](CONTRIBUTING.md).