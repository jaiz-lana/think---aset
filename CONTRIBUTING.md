# Kontribusi

Terima kasih ingin berkontribusi di Think Aset!

## Aturan Keras

- **Tanpa build tool.** HTML + CSS + JS murni (ES Modules).
- **Tanpa framework.**
- **Tanpa backend.** Data hanya di penyimpanan pengguna.
- **Versi CDN dipin.** Jangan pakai `@latest`.
- **Bahasa:** kode & komentar dalam bahasa Indonesia.
- **XSS:** semua string dari input pengguna wajib di-`esc()` sebelum masuk `innerHTML`.
- **Aksesibilitas:** tap target ≥ 44px, kontras WCAG AA, `aria-label`, navigasi keyboard.
- **Konflik edit:** setiap adapter wajib melempar `Error` dengan `code = 'CONFLICT'` saat `version` mismatch.

## Alur

1. Fork & buat branch `feat/nama-fitur` atau `fix/nama-bug`.
2. Commit dengan pesan jelas (bahasa Indonesia).
3. Uji manual di Chrome + Firefox (desktop & mobile).
4. Ajukan Pull Request.

## Melaporkan Bug

Sertakan: browser, OS, langkah reproduksi, dan screenshot jika ada.