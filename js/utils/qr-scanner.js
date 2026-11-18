/**
 * Utilitas QR Code & Scanner reusable:
 * - Pembentukan URL QR lengkap agar kamera HP / Google Lens langsung membuka detail aset.
 * - Ekstraksi kode dari URL lengkap, hash route, format `TA:<token>`, atau kode mentah.
 * - Sesi pemindaian kamera dengan BarcodeDetector + fallback jsQR.
 */

let jsQrPromise = null;

export function buildAssetQrUrl(tokenOrId) {
  const key = String(tokenOrId || '').trim();
  if (!key) return '';
  try {
    return new URL(`app.html#/aset/${encodeURIComponent(key)}`, window.location.href).href;
  } catch {
    return `TA:${key}`;
  }
}

export function extractQrCode(value) {
  let code = String(value || '').trim();
  if (!code) return '';
  try {
    if (/^https?:/i.test(code)) {
      const url = new URL(code);
      const hashMatch = url.hash.match(/^#\/aset\/([^?#]+)/);
      if (hashMatch) {
        code = decodeURIComponent(hashMatch[1]);
      } else {
        const paramKey = url.searchParams.get('asset') || url.searchParams.get('kode');
        if (paramKey) code = paramKey.trim();
      }
    }
    const directHashMatch = code.match(/^#?\/aset\/([^?#]+)/);
    if (directHashMatch) {
      code = decodeURIComponent(directHashMatch[1]);
    }
  } catch {
    // Biarkan memakai string asli jika parsing URL gagal
  }
  if (code.startsWith('TA:')) code = code.slice(3);
  return code.trim();
}

export function loadJsQrLibrary() {
  if (window.jsQR) return Promise.resolve(window.jsQR);
  if (jsQrPromise) return jsQrPromise;
  jsQrPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
    s.crossOrigin = 'anonymous';
    s.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('Library jsQR gagal dimuat'));
    s.onerror = () => reject(new Error('Pemindaian kamera tidak didukung & gagal memuat jsQR. Gunakan kolom kode manual.'));
    document.head.appendChild(s);
  }).catch(error => {
    jsQrPromise = null;
    throw error;
  });
  return jsQrPromise;
}

export function createQrScannerSession({ videoEl, onDetected, onStatus, onError } = {}) {
  let stream = null;
  let detector = null;
  let frame = 0;
  let running = false;

  const stop = () => {
    running = false;
    cancelAnimationFrame(frame);
    frame = 0;
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    if (videoEl) {
      videoEl.srcObject = null;
      videoEl.style.display = 'none';
    }
  };

  const start = async () => {
    if (running) return;
    if (!videoEl) throw new Error('Elemen video tidak ditemukan');
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Browser tidak mendukung akses kamera.');
    }

    let useJsQr = false;
    if ('BarcodeDetector' in window) {
      try {
        const supported = await window.BarcodeDetector.getSupportedFormats?.();
        if (!supported || supported.includes('qr_code')) {
          detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        } else {
          useJsQr = true;
        }
      } catch {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
      }
    } else {
      useJsQr = true;
    }

    if (useJsQr) {
      await loadJsQrLibrary();
    }

    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    running = true;
    videoEl.srcObject = stream;
    videoEl.style.display = 'block';
    await videoEl.play();
    onStatus?.('Arahkan kamera ke QR aset.');

    const canvas = useJsQr ? document.createElement('canvas') : null;
    const ctx = canvas ? canvas.getContext('2d', { willReadFrequently: true }) : null;

    const scan = async () => {
      if (!running || !stream) return;
      try {
        if (!useJsQr && detector) {
          const codes = await detector.detect(videoEl);
          if (codes.length && codes[0].rawValue) {
            const raw = codes[0].rawValue;
            stop();
            onDetected?.(raw);
            return;
          }
        } else if (useJsQr && window.jsQR && videoEl.readyState >= 2 && videoEl.videoWidth > 0) {
          canvas.width = videoEl.videoWidth;
          canvas.height = videoEl.videoHeight;
          ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = window.jsQR(imgData.data, imgData.width, imgData.height, { inversionAttempts: 'dontInvert' });
          if (code?.data) {
            const raw = code.data;
            stop();
            onDetected?.(raw);
            return;
          }
        }
      } catch (error) {
        stop();
        onError?.(error);
        return;
      }
      frame = requestAnimationFrame(scan);
    };

    scan();
  };

  return {
    start,
    stop,
    isRunning: () => running
  };
}
