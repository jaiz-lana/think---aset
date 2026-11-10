/**
 * Interaksi ringan untuk halaman profil publik:
 * - Toggle tema (sinkron dengan localStorage `ta_theme`)
 * - Toggle menu mobile
 * - Menandai link aktif sesuai halaman saat ini
 */

(function () {
  // ---------- Tema ----------
  const themeToggle = document.getElementById('theme-toggle');
  const currentTheme = () => {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  };
  const renderIcon = () => {
    if (themeToggle) themeToggle.textContent = currentTheme() === 'dark' ? '☀' : '☾';
  };

  if (themeToggle) {
    renderIcon();
    themeToggle.addEventListener('click', () => {
      const next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('ta_theme', next); } catch {}
      renderIcon();
    });
  }

  // ---------- Menu mobile ----------
  const mobileToggle = document.getElementById('mobile-toggle');
  const navLinks = document.getElementById('nav-links');
  if (mobileToggle && navLinks) {
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.addEventListener('click', () => {
      const open = navLinks.classList.toggle('open');
      mobileToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    navLinks.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navLinks.classList.remove('open');
        mobileToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ---------- Sorot link aktif ----------
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.profile-nav-links a[data-page]').forEach(a => {
    if (a.dataset.page === path) a.classList.add('active');
  });
})();