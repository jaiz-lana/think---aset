if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const scriptUrl = document.currentScript?.src;
  if (scriptUrl) {
    const serviceWorkerUrl = new URL('../sw.js', scriptUrl);
    const scope = new URL('../', scriptUrl).pathname;
    navigator.serviceWorker.register(serviceWorkerUrl.href, { scope })
      .catch(error => console.error('Pendaftaran Service Worker gagal:', error));
  }
}
