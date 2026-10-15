export interface ImagePreset {
  /** Plus grand côté, en pixels. */
  maxDimension: number;
  /** Qualité JPEG de départ (0-1). */
  quality: number;
  /** Poids visé après compression, en octets. */
  maxBytes: number;
}

export const COVER_IMAGE: ImagePreset = { maxDimension: 900, quality: 0.85, maxBytes: 300 * 1024 };
export const CHAPTER_IMAGE: ImagePreset = { maxDimension: 1400, quality: 0.82, maxBytes: 600 * 1024 };

/** Poids maximal du fichier d'origine (avant compression). */
export const MAX_SOURCE_BYTES = 20 * 1024 * 1024;

export const isDataImageUrl = (value?: string | null): boolean => !!value && /^data:image\//i.test(value);

const approxBytes = (dataUrl: string): number => Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * 0.75);

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decode(file: File): Promise<Decoded> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => URL.revokeObjectURL(url),
    };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}


export async function compressImage(file: File, preset: ImagePreset): Promise<string> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    throw new Error('Ce fichier n’est pas une image prise en charge (JPEG, PNG, WebP ou GIF).');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Cette image est trop lourde (20 Mo maximum).');
  }

  let decoded: Decoded;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error('Impossible de lire cette image.');
  }

  try {
    const render = (scale: number, quality: number): string => {
      const width = Math.max(1, Math.round(decoded.width * scale));
      const height = Math.max(1, Math.round(decoded.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Impossible de traiter cette image.');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(decoded.source, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', quality);
    };

    let scale = Math.min(1, preset.maxDimension / Math.max(decoded.width, decoded.height));
    let quality = preset.quality;
    let dataUrl = render(scale, quality);

    for (let attempt = 0; attempt < 8 && approxBytes(dataUrl) > preset.maxBytes; attempt += 1) {
      if (quality > 0.55) quality = Math.max(0.55, quality - 0.1);
      else scale *= 0.85;
      dataUrl = render(scale, quality);
    }

    return dataUrl;
  } finally {
    decoded.release();
  }
}