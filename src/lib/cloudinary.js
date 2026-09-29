// Cloudinary unsigned uploads for profile pictures and announcement posters.
// Env: VITE_CLOUDINARY_CLOUD_NAME, VITE_CLOUDINARY_UPLOAD_PRESET (an *unsigned* preset).

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET?.trim();

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export const isCloudinaryConfigured = Boolean(CLOUD_NAME && UPLOAD_PRESET);

// Returns an error message for an unacceptable file, or null if it is fine.
export function validateImage(file) {
  if (!file) return 'No file selected.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return 'Please choose a JPG, PNG or WebP image.';
  if (file.size > MAX_UPLOAD_BYTES) return 'Image is too large. The maximum size is 5 MB.';
  return null;
}

/**
 * Uploads an image straight from the browser to Cloudinary.
 * Resolves with the HTTPS delivery URL (secure_url).
 */
export async function uploadImage(file, { signal } = {}) {
  if (!isCloudinaryConfigured) {
    throw new Error('Profile photo uploads are not configured.');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('upload_preset', UPLOAD_PRESET);

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body,
      signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Network connection lost during upload. Please try again.', { cause: error });
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok || !data.secure_url) {
    const reason = data?.error?.message || `Upload failed (HTTP ${response.status}).`;
    if (/preset/i.test(reason)) {
      throw new Error('Upload preset is invalid or not unsigned. Please contact the church leadership.');
    }
    throw new Error(reason);
  }

  return data.secure_url;
}

/**
 * Returns a resized, face-cropped, auto-format version of a Cloudinary image URL.
 * Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryThumb(url, size = 96) {
  if (!url || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/c_fill,g_face,w_${size},h_${size},f_auto,q_auto/`);
}

/**
 * Wide banner crop for event posters (default 16:9), smart-cropped around the subject,
 * auto format/quality. Non-Cloudinary URLs are returned unchanged.
 */
export function cloudinaryBanner(url, width = 800, aspect = '16:9') {
  if (!url || !url.includes('/image/upload/')) return url;
  return url.replace('/image/upload/', `/image/upload/c_fill,g_auto,w_${width},ar_${aspect},f_auto,q_auto/`);
}
