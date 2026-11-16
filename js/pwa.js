if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const scriptUrl = document.currentScript?.src;
  if (scriptUrl) {
    const serviceWorkerUrl = new URL('../sw.js', scriptUrl);
    const scope = new URL('../', scriptUrl).pathname;
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    navigator.serviceWorker.register(serviceWorkerUrl.href, { scope })
      .then(reg => {
        reg.update().catch(() => {});
      })
      .catch(error => console.error('Pendaftaran Service Worker gagal:', error));
  }
}
