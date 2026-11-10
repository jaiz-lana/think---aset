import { deploymentConfig } from './deployment-config.js';

export const config = {
  APP_NAME: 'Think Aset',
  APP_VERSION: '0.4.13',

  // Google OAuth
  GOOGLE_CLIENT_ID: deploymentConfig.GOOGLE_CLIENT_ID,
  GOOGLE_API_KEY:   deploymentConfig.GOOGLE_API_KEY,
  GOOGLE_APP_ID:    deploymentConfig.GOOGLE_APP_ID,

  // Scope minimal — JANGAN menambah tanpa alasan.
  SCOPES: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile'
  ].join(' '),

  SHEET_TITLE:  'Think Aset - Data',
  FOLDER_TITLE: 'Think Aset - Lampiran',
  MAX_PHOTO_BYTES: 500_000,

  LS: {
    THEME: 'ta_theme',
    MODE: 'ta_mode',
    SS_ID: 'ta_ss_id',           // + "_" + email  (per akun)
    FOLDER_ID: 'ta_folder_id',   // + "_" + email  (per akun)
    ORG_NAME: 'ta_org_name',
    LOGO_ID: 'ta_logo_id',
    LOGO_DARK_ID: 'ta_logo_dark_id',
    APP_DISPLAY_NAME: 'ta_app_display_name',
    SCHEMA_VERSION: 'ta_schema_version'
  },

  SS: {
    TOKEN: 'ta_g_token',
    TOKEN_EXP: 'ta_g_exp',
    EMAIL: 'ta_g_email'
  }
};

/** Kunci per-akun Google agar ganti akun di browser sama tidak campur. */
export function ssIdKey(email)     { return `${config.LS.SS_ID}_${email || 'anon'}`; }
export function folderIdKey(email) { return `${config.LS.FOLDER_ID}_${email || 'anon'}`; }
