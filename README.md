# Think Aset

<div align="center">

**Manajemen aset & inventaris kantor — open source, tanpa server, tanpa biaya.**

Data tersimpan di penyimpanan milik Anda sendiri: Google Drive atau perangkat lokal.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE.txt)
[![GitHub Pages](https://img.shields.io/badge/Demo-GitHub%20Pages-blue)](https://jaiz-lana.github.io/think---aset/)
[![PWA](https://img.shields.io/badge/PWA-ready-brightgreen)](https://jaiz-lana.github.io/think---aset/)

[🚀 Coba Langsung](https://jaiz-lana.github.io/think---aset/) · [📖 Panduan](https://jaiz-lana.github.io/think---aset/pages/panduan.html) · [🐛 Laporkan Bug](https://github.com/jaiz-lana/think---aset/issues)

</div>

---

## ✨ Fitur

| Fitur | Keterangan |
|-------|-----------|
| 📊 Dashboard & grafik | Ringkasan nilai, kategori, lokasi aset |
| 📋 Data aset | CRUD lengkap, impor/ekspor Excel & CSV, filter |
| 🗂️ Kategori, Lokasi, Penanggung Jawab | Referensi data terstruktur |
| 🔲 QR & kartu cetak | QR bertoken acak, kartu aset siap cetak |
| 📷 Pemindaian QR | Via kamera atau input manual |
| ⏱️ Riwayat aset | Perpindahan, kondisi, perawatan |
| 💵 Keuangan aset | Pemasukan & pengeluaran per aset |
| 📅 Agenda & kalender | Kelola kegiatan, tenggat, sinkronisasi Google Calendar |
| 📖 Jurnal | Catatan pemeliharaan aset |
| 🔎 Audit stok opname | Sesi audit dan hasil pemeriksaan |
| 📤 Peminjaman | Kelola peminjaman & pengembalian aset |
| 📈 Laporan lanjutan | Ringkasan nilai, keuangan, audit, peminjaman |
| 👥 Anggota & berbagi | Undang anggota ke workspace Google Drive |
| 🎨 Branding workspace | Logo & nama organisasi |
| 🔔 Pengingat otomatis | Notifikasi browser untuk agenda |

---

## 🗄️ Mode Penyimpanan

| Mode | Data disimpan di | Sinkron antar perangkat | Backup |
|------|-----------------|------------------------|--------|
| **Google Drive/Sheets** | Spreadsheet + folder lampiran di Drive Anda | ✅ Ya | Unduh sheet dari Google |
| **Penyimpanan Lokal** | IndexedDB browser | ❌ Tidak | Export JSON di Pengaturan |

> **Privasi:** Think Aset tidak memiliki backend. Pengembang tidak pernah melihat atau menyimpan data Anda.

---

## 🌐 Cara Pakai (Hosting Saya)

Ingin langsung pakai tanpa setup apapun?

👉 **[Buka Aplikasi](https://jaiz-lana.github.io/think---aset/app.html)**

Gunakan mode **Penyimpanan Lokal** gratis selamanya.
Untuk mode **Google Drive** di hosting saya, silakan hubungi untuk berlangganan:

📸 **Instagram: [@na.habibburahman](https://www.instagram.com/na.habibburahman/)**

---

## 🛠️ Self-Host (Deploy Sendiri)

Karena Think Aset adalah aplikasi statis murni (HTML + CSS + JS), Anda bisa deploy di mana saja.

### GitHub Pages

1. **Fork** repo ini
2. **Settings → Pages** → Source: `Deploy from a branch` → branch `main` → `/root`
3. Akses di `https://<username>.github.io/think---aset/`
4. **Wajib:** Setup Google Client ID (lihat bagian di bawah)

### Cloudflare Pages

1. Login ke [Cloudflare Pages](https://pages.cloudflare.com) → **Create project → Direct Upload**
2. Upload seluruh isi folder repo
3. **Wajib:** Setup Google Client ID

### Lokal / PC Sendiri

```bash
git clone https://github.com/jaiz-lana/think---aset.git
cd think---aset
python3 -m http.server 8080
# Buka http://localhost:8080
```

> ⚠️ Jangan buka via `file://` — Google OAuth tidak bekerja tanpa server HTTP.

---

## 🔑 Wajib: Setup Google Client ID (untuk Mode Google Drive)

Jika Anda self-host dan ingin mengaktifkan login Google, **satu-satunya file yang perlu diedit** adalah:

```
js/deployment-config.js
```

```js
export const deploymentConfig = {
  GOOGLE_CLIENT_ID: 'GANTI_DENGAN_CLIENT_ID_ANDA.apps.googleusercontent.com',
  GOOGLE_API_KEY: '',   // Opsional — untuk Google Picker
  GOOGLE_APP_ID: '',    // Opsional — untuk Google Picker
};
```

Tanpa perubahan ini, pengguna hanya bisa memakai mode **Penyimpanan Lokal**.

### Cara Mendapatkan Google Client ID

1. Buka [Google Cloud Console](https://console.cloud.google.com)
2. Buat project baru (mis. `Think Aset`)
3. **APIs & Services → Library** — aktifkan:
   - ✅ Google Sheets API
   - ✅ Google Drive API
   - ✅ Google People API
   - ☑️ Google Picker API *(opsional)*
   - ☑️ Google Calendar API *(opsional)*
4. **APIs & Services → OAuth consent screen**:
   - User type: **External**
   - Isi nama app, email support
   - Scopes: `drive.file`, `userinfo.email`, `userinfo.profile`
   - Tambahkan email Anda sebagai **Test User** (saat masih testing)
   - Untuk publik: klik **"Publish app"**
5. **Credentials → Create credentials → OAuth client ID**:
   - Application type: **Web application**
   - **Authorized JavaScript origins** — tambahkan domain Anda, mis:
     ```
     https://username.github.io
     https://app.pages.dev
     http://localhost:8080
     ```
6. Salin **Client ID** → tempel ke `js/deployment-config.js`

### Menyimpan Secrets (GitHub Actions — Opsional)

Jika tidak ingin Client ID terlihat di kode publik, simpan via GitHub Secrets:

**Settings → Secrets and variables → Actions → New repository secret:**

| Secret | Isi |
|--------|-----|
| `GOOGLE_CLIENT_ID` | Client ID dari Google Cloud |
| `GOOGLE_API_KEY` | API Key *(opsional)* |
| `GOOGLE_APP_ID` | App ID / Project Number *(opsional)* |

> **Catatan:** `GOOGLE_CLIENT_ID` sebenarnya **aman di-commit** ke repo publik — ini adalah identifier publik yang dirancang untuk tertanam di kode browser. Keamanannya dijaga oleh Google via pembatasan Authorized JavaScript Origins.

---

## 👥 Cara Mengundang Anggota Tim (Mode Google Drive)

1. **Pemilik workspace** (pendaftar pertama) login → workspace dibuat otomatis di Google Drive mereka
2. Pemilik share **Spreadsheet "Think Aset - Data"** di Google Drive ke email anggota
3. Anggota login ke Think Aset dengan akun Google mereka → pilih **"Buka workspace yang dibagikan"**
4. Peran terdeteksi otomatis: **Owner / Editor / Viewer** sesuai izin Drive

> Fitur "Buka workspace yang dibagikan" membutuhkan `GOOGLE_API_KEY` dan `GOOGLE_APP_ID` (Google Picker).

---

## 📁 Struktur Proyek

```
think-aset/
├── index.html              # Landing page publik
├── app.html                # Aplikasi utama
├── css/                    # Stylesheet (variables, base, components, app)
├── js/
│   ├── app.js              # Entry point aplikasi
│   ├── auth.js             # Orkestrator autentikasi
│   ├── config.js           # Konfigurasi global
│   ├── deployment-config.js  # ← EDIT INI untuk self-host
│   ├── features.js         # Katalog fitur
│   ├── router.js           # Hash-based router
│   ├── storage/
│   │   ├── adapter.js      # Base class & skema tabel
│   │   ├── google.js       # Google Sheets/Drive adapter
│   │   └── local.js        # IndexedDB adapter
│   └── ui/                 # Komponen tampilan per halaman
├── pages/                  # Halaman publik (Panduan, Fitur, dll.)
├── icons/                  # Ikon aplikasi
├── manifest.json           # PWA manifest
└── sw.js                   # Service Worker
```

---

## 🔧 Menambah Storage Adapter Baru

Buat adapter di `js/storage/my-adapter.js` yang meng-extends `StorageAdapter`:

```js
class MyAdapter extends StorageAdapter {
  async init() {}
  async list(tabel, filter) {}
  async get(tabel, id) {}
  async create(tabel, data) {}
  async update(tabel, id, data) {}
  async remove(tabel, id) {}
  async uploadFile(file) {}
  async getFileUrl(id) {}
  async shareWith(email, peran) {}
  async listMembers() {}
}
```

Daftarkan di `js/auth.js` dan tambahkan opsi di layar login `js/app.js`.

**Aturan:**
- Jangan panggil API pihak ketiga di luar adapter
- Lempar `Error` dengan `code = 'CONFLICT'` saat `version` mismatch
- Token hanya di `sessionStorage`/memori — jangan di `localStorage`
- Batch tulis log bila ada network cost

---

## 🤝 Kontribusi

Lihat [CONTRIBUTING.md](CONTRIBUTING.md) untuk panduan lengkap.

Singkatnya:
- Tanpa build tool, tanpa framework, tanpa backend
- HTML + CSS + ES Modules murni
- Kode & komentar dalam Bahasa Indonesia
- Fork → branch `feat/nama-fitur` → Pull Request

---

## 📜 Lisensi

[MIT](LICENSE.txt) — bebas digunakan, dimodifikasi, dan didistribusikan.

---

<div align="center">

Dibuat dengan ❤️ · Data selalu milik Anda

**Butuh bantuan setup atau ingin hosting tanpa ribet?**
Hubungi via Instagram: [@na.habibburahman](https://www.instagram.com/na.habibburahman/)

</div>
