import { ensureXLSX } from './external-libs.js';
export async function exportToXLSX(rows, columns, filename, sheetName = 'Data') {
  const XLSX = await ensureXLSX();
  const header = columns.map(c => c.label);
  const data = [header];
  for (const row of rows) {
    data.push(columns.map(c => {
      const raw = row[c.key];
      if (c.format) return c.format(raw, row);
      return raw == null ? '' : raw;
    }));
  }
  const ws = XLSX.utils.aoa_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename);
}

/** Ekspor CSV sederhana (fallback tanpa SheetJS). */
export function exportToCSV(rows, columns, filename) {
  const header = columns.map(c => escapeCsv(c.label)).join(',');
  const lines = [header];
  for (const row of rows) {
    lines.push(columns.map(c => {
      const raw = row[c.key];
      const val = c.format ? c.format(raw, row) : raw;
      return escapeCsv(val == null ? '' : val);
    }).join(','));
  }
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, filename);
}

function escapeCsv(v) {
  const s = String(v);
  if (/[",\r\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

/** Unduh Blob dengan nama file. */
export function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

/**
 * Baca file spreadsheet → array of object (baris pertama = header).
 * Mendukung .xlsx, .xls, .csv.
 */
export async function readSpreadsheet(file) {
  const XLSX = await ensureXLSX();
  const buf = await file.arrayBuffer();
  const isCsv = /\.csv$/i.test(file.name || '');
  const wb = XLSX.read(buf, { type: 'array', cellDates: !isCsv });
  if (!wb.SheetNames.length) throw new Error('Berkas kosong');
  const ws = wb.Sheets[wb.SheetNames[0]];
  // Excel: angka tetap angka, tanggal jadi YYYY-MM-DD. CSV: tetap teks apa adanya.
  const json = XLSX.utils.sheet_to_json(ws, { defval: '', raw: !isCsv });
  const pad = n => String(n).padStart(2, '0');
  for (const row of json) {
    for (const k of Object.keys(row)) {
      if (row[k] instanceof Date && !isNaN(row[k].getTime())) {
        // +12 jam agar kebal selisih zona waktu/detik dari SheetJS
        const d = new Date(row[k].getTime() + 12 * 3600 * 1000);
        row[k] = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      }
    }
  }
  return json;
}
