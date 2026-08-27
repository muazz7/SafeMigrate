import type { PickedFile } from '@/lib/platform';

/**
 * Client-side downscaling — BUILD-SPEC §7.4.2.
 *
 * Longest edge to 1600px, re-encoded JPEG q0.8. This roughly halves extraction
 * cost and latency, which matters on a ≤$5 model budget and a 20s latency ceiling
 * — and matters more on the slow mobile data these users actually have.
 *
 * PDFs pass through untouched: there is no canvas path for them and the provider
 * accepts them directly.
 */

export const MAX_EDGE = 1600;
export const JPEG_QUALITY = 0.8;

/** 10MB, matching the API route's limit (§7.4.1). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const isPdf = (mimeType: string): boolean => mimeType === 'application/pdf';

/** Approximate decoded byte length of a base64 string, without decoding it. */
export const base64Bytes = (base64: string): number => {
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
};

const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Image could not be decoded'));
    img.src = dataUrl;
  });

/**
 * Returns a downscaled copy, or the original when it is already small enough,
 * is a PDF, or the canvas path fails. Never throws for a merely-oversized image:
 * failing to shrink is a cost problem, not a reason to block the user's scan.
 */
export async function downscaleImage(file: PickedFile): Promise<PickedFile> {
  if (isPdf(file.mimeType)) return file;
  if (typeof document === 'undefined') return file;

  try {
    const img = await loadImage(file.previewUrl);
    const longest = Math.max(img.naturalWidth, img.naturalHeight);

    // Already small enough and already JPEG — nothing to gain.
    if (longest <= MAX_EDGE && file.mimeType === 'image/jpeg') return file;

    const scale = longest > MAX_EDGE ? MAX_EDGE / longest : 1;
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return file;

    // White ground: a transparent PNG would flatten to black and make the
    // document unreadable to the model.
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);

    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
    const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);

    // Guard against the pathological case where re-encoding grew the file.
    if (base64Bytes(base64) >= base64Bytes(file.base64) && longest <= MAX_EDGE) return file;

    return {
      base64,
      mimeType: 'image/jpeg',
      fileName: file.fileName.replace(/\.[^.]+$/, '') + '.jpg',
      previewUrl: dataUrl,
    };
  } catch {
    // Corrupt or exotic image: send the original and let the server decide.
    return file;
  }
}

/** Converts a picked file into a Blob for multipart upload. */
export function toBlob(file: PickedFile): Blob {
  const binary = atob(file.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: file.mimeType });
}
