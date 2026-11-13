/**
 * Konfigurasi Google untuk seluruh pengguna deployment.
 * Client ID bersifat publik; batasi origin yang diizinkan di Google Cloud.
 * API Key dan App ID hanya diperlukan bila Google Picker diaktifkan.
 */
export const deploymentConfig = {
  GOOGLE_CLIENT_ID: '',
  GOOGLE_API_KEY: '',
  GOOGLE_APP_ID: ''
};
