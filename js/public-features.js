import { FEATURES, getUnavailableFeatures, escapeFeatureText } from './features.js';

const announcement = document.getElementById('feature-announcement');
const featureGrid = document.querySelector('[data-feature-grid]');
const unavailable = getUnavailableFeatures();

if (announcement) {
  announcement.innerHTML = unavailable.length
    ? `<strong>Fitur yang belum tersedia</strong><ul class="feature-status-list">${unavailable.map(feature =>
      `<li>${escapeFeatureText(feature.title)}</li>`
    ).join('')}</ul>`
    : '<strong>Semua fitur yang tercatat tersedia.</strong>';
}

if (featureGrid) {
  featureGrid.innerHTML = FEATURES.map(feature => {
    const available = !unavailable.includes(feature);
    const status = available
      ? 'Tersedia'
      : feature.availability === 'planned' ? 'Belum tersedia' : 'Belum dikonfigurasi';
    return `<article class="feature-card${available ? '' : ' feature-card-pending'}">
      <div class="icon-wrap" aria-hidden="true">${escapeFeatureText(feature.icon)}</div>
      <h3>${escapeFeatureText(feature.title)}</h3>
      <p>${escapeFeatureText(feature.description)}</p>
      <span class="feature-status">${status}</span>
    </article>`;
  }).join('');
}
