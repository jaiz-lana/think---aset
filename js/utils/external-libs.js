const LIBRARIES = {
  chart: {
    src: 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
    integrity: 'sha384-e6nUZLBkQ86NJ6TVVKAeSaK8jWa3NhkYWZFomE39AvDbQWeie9PlQqM3pmYW5d1g',
    globalName: 'Chart'
  },
  xlsx: {
    src: 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
    integrity: 'sha384-QCIdq2UMVEoSRhR3ZWZwdz2/pivLowr+eokFMdYyukq7qI26VYRxFa4Nl6FKetmL',
    globalName: 'XLSX'
  }
};

const pendingLoads = new Map();

function loadLibrary(name) {
  const library = LIBRARIES[name];
  if (!library) return Promise.reject(new Error(`Pustaka tidak dikenal: ${name}`));

  if (window[library.globalName]) return Promise.resolve(window[library.globalName]);
  if (pendingLoads.has(name)) return pendingLoads.get(name);

  const script = document.createElement('script');
  script.src = library.src;
  script.integrity = library.integrity;
  script.crossOrigin = 'anonymous';
  script.async = true;

  const load = new Promise((resolve, reject) => {
    script.onload = () => {
      if (window[library.globalName]) resolve(window[library.globalName]);
      else reject(new Error(`${name} termuat tanpa API yang diharapkan`));
    };
    script.onerror = () => reject(new Error(`Gagal memuat ${name}. Periksa koneksi internet.`));
    document.head.appendChild(script);
  }).catch(error => {
    pendingLoads.delete(name);
    script.remove();
    throw error;
  });

  pendingLoads.set(name, load);
  return load;
}

export function ensureChartJs() {
  return loadLibrary('chart');
}

export function ensureXLSX() {
  return loadLibrary('xlsx');
}
