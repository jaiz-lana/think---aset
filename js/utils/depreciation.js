/**
 * Perhitungan penyusutan aset (dipakai di dashboard & Tahap 4).
 * Metode:
 *  - garis_lurus  : (harga - residu) / umur_bulan, per bulan
 *  - saldo_menurun: nilai_buku * (2 / umur_tahun) / 12, per bulan
 *
 * Semua hasil dikembalikan sebagai objek dengan angka final.
 */

/** Jumlah bulan penuh antara dua tanggal (bisa 0). */
export function monthsBetween(fromDate, toDate) {
  if (!fromDate) return 0;
  const from = parseLocalDate(fromDate);
  const to = toDate ? parseLocalDate(toDate) : new Date();
  if (isNaN(from.getTime()) || isNaN(to.getTime())) return 0;
  let months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  if (to.getDate() < from.getDate()) months -= 1;
  return Math.max(0, months);
}

export function parseLocalDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    if (match) {
      const [, year, month, day] = match;
      const date = new Date(Number(year), Number(month) - 1, Number(day));
      if (date.getFullYear() !== Number(year) ||
          date.getMonth() !== Number(month) - 1 ||
          date.getDate() !== Number(day)) {
        return new Date(NaN);
      }
      return date;
    }
  }
  return new Date(value);
}

/**
 * Hitung penyusutan aset.
 * @param {Object} asset  baris dari tabel assets
 * @param {Date}   asOf   tanggal perhitungan (default hari ini)
 */
export function computeDepreciation(asset, asOf) {
  const harga = Number(asset.harga) || 0;
  const residu = Number(asset.nilai_residu) || 0;
  const umurBulan = Number(asset.umur_ekonomis) || 0;
  const metode = asset.metode_susut || 'garis_lurus';

  const base = {
    harga,
    residu,
    umur_bulan: umurBulan,
    metode,
    bulan_berjalan: 0,
    beban_per_bulan: 0,
    akumulasi: 0,
    nilai_buku: harga,
    selesai: true
  };

  if (!asset.tgl_beli || umurBulan <= 0 || harga <= residu) {
    return base;
  }

  const months = monthsBetween(asset.tgl_beli, asOf);
  const effectiveMonths = Math.min(months, umurBulan);

  if (metode === 'saldo_menurun') {
    const umurTahun = umurBulan / 12;
    if (umurTahun <= 0) return base;
    const ratePerBulan = (2 / umurTahun) / 12;
    if (ratePerBulan >= 1) {
      // Kasus ekstrem umur terlalu pendek; anggap habis dalam 1 bulan
      const nilaiBuku = Math.max(residu, harga * (1 - ratePerBulan));
      return {
        ...base,
        bulan_berjalan: effectiveMonths,
        beban_per_bulan: harga - nilaiBuku,
        akumulasi: harga - nilaiBuku,
        nilai_buku: nilaiBuku,
        selesai: effectiveMonths >= umurBulan
      };
    }
    let nilaiBuku = harga * Math.pow(1 - ratePerBulan, effectiveMonths);
    if (nilaiBuku < residu) nilaiBuku = residu;
    const akumulasi = harga - nilaiBuku;
    // Beban bulan berjalan (taksiran untuk bulan ke-effectiveMonths)
    let bebanPerBulan = 0;
    if (effectiveMonths > 0 && nilaiBuku > residu) {
      const prev = effectiveMonths >= 1
        ? Math.max(residu, harga * Math.pow(1 - ratePerBulan, effectiveMonths - 1))
        : harga;
      bebanPerBulan = prev - nilaiBuku;
    }
    return {
      ...base,
      bulan_berjalan: effectiveMonths,
      beban_per_bulan: bebanPerBulan,
      akumulasi,
      nilai_buku: nilaiBuku,
      selesai: effectiveMonths >= umurBulan
    };
  }

  // Default: garis lurus
  const bebanPerBulan = (harga - residu) / umurBulan;
  const akumulasi = Math.min(bebanPerBulan * effectiveMonths, harga - residu);
  const nilaiBuku = harga - akumulasi;
  return {
    ...base,
    bulan_berjalan: effectiveMonths,
    beban_per_bulan: bebanPerBulan,
    akumulasi,
    nilai_buku: nilaiBuku,
    selesai: effectiveMonths >= umurBulan
  };
}

/**
 * Ringkasan agregat dari daftar aset.
 * @returns {Object} { count, total_harga, total_penyusutan, total_nilai_kini }
 */
export function summarizeAssets(assets) {
  let totalHarga = 0;
  let totalPenyusutan = 0;
  let totalNilaiKini = 0;
  for (const a of assets) {
    const d = computeDepreciation(a);
    totalHarga += d.harga;
    totalPenyusutan += d.akumulasi;
    totalNilaiKini += d.nilai_buku;
  }
  return {
    count: assets.length,
    total_harga: totalHarga,
    total_penyusutan: totalPenyusutan,
    total_nilai_kini: totalNilaiKini
  };
}

/** Format angka ke Rupiah ringkas (untuk kartu dashboard). */
export function formatRupiah(n) {
  const num = Number(n) || 0;
  if (num >= 1_000_000_000) return 'Rp ' + (num / 1_000_000_000).toFixed(1) + ' M';
  if (num >= 1_000_000) return 'Rp ' + (num / 1_000_000).toFixed(1) + ' jt';
  if (num >= 1_000) return 'Rp ' + (num / 1_000).toFixed(0) + ' rb';
  return 'Rp ' + num.toFixed(0);
}

/** Format Rupiah lengkap (untuk tabel & detail). */
export function formatRupiahFull(n) {
  const num = Number(n) || 0;
  return 'Rp ' + num.toLocaleString('id-ID', { maximumFractionDigits: 0 });
}