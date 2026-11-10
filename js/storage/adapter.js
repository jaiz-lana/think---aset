export const TABLES = [
  'settings', 'categories', 'locations', 'holders', 'assets',
  'asset_files', 'asset_history', 'asset_finance', 'agendas', 'journals',
  'audits', 'audit_items', 'loans', 'activity_log'
];

/** Tabel yang memiliki kolom version/created_at/updated_at/updated_by. */
export const VERSIONED_TABLES = [
  'categories', 'locations', 'holders', 'assets',
  'asset_files', 'asset_history', 'asset_finance',
  'agendas', 'journals', 'audits', 'audit_items', 'loans'
];

/**
 * Header kolom setiap tabel. Urutan HARUS stabil untuk kompatibilitas
 * dengan Spreadsheet yang sudah ada.
 */
export const SCHEMAS = {
  settings:       ['key', 'value'],

  categories:     ['id', 'parent_id', 'nama', 'umur_ekonomis', 'metode_susut',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  locations:      ['id', 'parent_id', 'nama',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  holders:        ['id', 'nama', 'jabatan', 'unit', 'kontak',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  assets:         ['id', 'kode', 'nama', 'category_id', 'location_id', 'holder_id',
                   'tgl_beli', 'harga', 'vendor', 'merk', 'tipe', 'serial',
                   'kondisi', 'status', 'umur_ekonomis', 'nilai_residu',
                   'metode_susut', 'keterangan', 'foto_ids', 'qr_token',
                   'version', 'created_at', 'updated_at', 'updated_by',
                   'jumlah', 'custom_fields'],
  asset_files:    ['id', 'asset_id', 'nama', 'jenis', 'drive_file_id',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  asset_history:  ['id', 'asset_id', 'jenis', 'dari', 'ke', 'tanggal', 'catatan', 'user',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  asset_finance:  ['id', 'asset_id', 'tanggal', 'jenis', 'kategori', 'nominal', 'catatan', 'bukti_id',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  agendas:        ['id', 'asset_id', 'judul', 'tanggal', 'berulang', 'pengingat_hari', 'selesai',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  journals:       ['id', 'asset_id', 'tanggal', 'judul', 'isi', 'foto_id',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  audits:         ['id', 'nama', 'periode', 'lokasi_id', 'status',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  audit_items:    ['id', 'audit_id', 'asset_id', 'hasil', 'catatan',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  loans:          ['id', 'asset_id', 'peminjam', 'tgl_pinjam', 'tgl_jatuh_tempo', 'tgl_kembali',
                   'status', 'kondisi_kembali',
                   'version', 'created_at', 'updated_at', 'updated_by'],
  activity_log:   ['id', 'user', 'aksi', 'objek', 'waktu']
};

/** Field kunci ID per tabel (default 'id'). */
export const ID_KEY = {
  settings: 'key'
};

export const SCHEMA_VERSION = 2;

/**
 * Base class Storage Adapter.
 */
export class StorageAdapter {
  constructor(config) {
    this.config = config;
    this.role = 'viewer';   // 'owner' | 'editor' | 'viewer'
    this.user = null;       // { email, name, picture }
    this.mode = 'unknown';  // 'google' | 'local'
  }

  async init()                       { throw new Error('init() belum diimplementasikan'); }
  async list(tabel, filter = null)   { throw new Error('list() belum diimplementasikan'); }
  async get(tabel, id)               { throw new Error('get() belum diimplementasikan'); }
  async create(tabel, data)          { throw new Error('create() belum diimplementasikan'); }
  async update(tabel, id, data)      { throw new Error('update() belum diimplementasikan'); }
  async remove(tabel, id)            { throw new Error('remove() belum diimplementasikan'); }
  async createMany(tabel, list)      { throw new Error('createMany() belum diimplementasikan'); }
  async listRecent(tabel, n = 8)     { return (await this.list(tabel)).slice(-n); }
  async refresh()                    { /* default no-op */ }
  async uploadFile(file)             { throw new Error('uploadFile() belum diimplementasikan'); }
  async getFileUrl(id)               { throw new Error('getFileUrl() belum diimplementasikan'); }
  async shareWith(email, peran)      { throw new Error('shareWith() belum diimplementasikan'); }
  async listMembers()                { throw new Error('listMembers() belum diimplementasikan'); }
  async signOut()                    { /* default no-op */ }

  canWrite() { return this.role === 'owner' || this.role === 'editor'; }
  isOwner()  { return this.role === 'owner'; }
}
