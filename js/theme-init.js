try {
  const theme = localStorage.getItem('ta_theme');
  document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
} catch {
  document.documentElement.setAttribute('data-theme', 'light');
}
