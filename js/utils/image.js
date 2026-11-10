/** Kompresi gambar di sisi klien. Mengembalikan Blob JPEG. */
export async function compressImage(file, maxSize = 800, quality = 0.82) {
  if (!file.type.startsWith('image/')) return file;
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width >= height) { height = Math.round(height * maxSize / width); width = maxSize; }
          else { width = Math.round(width * maxSize / height); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas tidak didukung browser');
        context.drawImage(img, 0, 0, width, height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Gagal mengompres gambar'));
          resolve(blob);
        }, 'image/jpeg', quality);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('File bukan gambar valid'));
    };
    img.src = url;
  });
}

/** Crop persegi terpusat + resize. Dipakai untuk logo (Tahap 1 prep, UI Tahap 6). */
export async function cropSquare(file, maxSize = 256, quality = 0.9) {
  if (!file.type.startsWith('image/')) throw new Error('Bukan gambar');
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      try {
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = Math.min(maxSize, side);
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas tidak didukung browser');
        context.drawImage(img, sx, sy, side, side, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          if (!blob) return reject(new Error('Crop gagal'));
          resolve(blob);
        }, 'image/png', quality);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gambar rusak'));
    };
    img.src = url;
  });
}