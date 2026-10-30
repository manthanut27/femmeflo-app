export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
}

function isWebEnvironment(): boolean {
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    return true;
  }
  try {
    // Dynamic check without triggering Node ESM Flow parse error
    const RN = require('react-native');
    return RN?.Platform?.OS === 'web';
  } catch {
    return false;
  }
}

export const BACKEND_ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

export const DEFAULT_IMAGE_PICKER_OPTIONS = {
  quality: 0.65, // Compresses image to ~1MB, far below 5MB Multer limit
  allowsEditing: true,
  aspect: [4, 3] as [number, number],
};

/**
 * Checks if the image MIME type is supported by backend Multer middleware.
 */
export function isBackendSupportedImageType(mimeType: string): boolean {
  return BACKEND_ALLOWED_IMAGE_TYPES.has(mimeType.toLowerCase());
}

/**
 * Validates whether a file URI points to a valid image format.
 */
export function isValidImageUri(uri: string): boolean {
  if (!uri || typeof uri !== 'string') return false;
  return /\.(jpe?g|png|webp|gif|bmp)$/i.test(uri) || uri.startsWith('data:image/') || uri.startsWith('blob:');
}

/**
 * Infers mime-type from URI or file path.
 */
export function getMimeTypeFromUri(uri: string): string {
  const match = /\.([a-zA-Z0-9]+)(\?.*)?$/.exec(uri);
  if (!match) return 'image/jpeg';
  const ext = match[1].toLowerCase();
  switch (ext) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'gif':
      return 'image/gif';
    default:
      return 'image/jpeg';
  }
}

/**
 * On Web: Compresses and resizes an image via Canvas.
 * On Native: Returns URI (expo-image-picker applies native compression during capture).
 */
export async function compressImage(
  uri: string,
  options: ImageCompressionOptions = {}
): Promise<{ uri: string; mimeType: string }> {
  const { maxWidth = 1200, maxHeight = 1200, quality = 0.75 } = options;
  const mimeType = getMimeTypeFromUri(uri);

  if (!isWebEnvironment()) {
    // Native platforms rely on ImagePicker's built-in compression
    return { uri, mimeType };
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        if (width / height > maxWidth / maxHeight) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        } else {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ uri, mimeType });
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const compressedUri = canvas.toDataURL(mimeType, quality);
      resolve({ uri: compressedUri, mimeType });
    };

    img.onerror = () => {
      resolve({ uri, mimeType });
    };

    img.src = uri;
  });
}

/**
 * Creates a FormData payload suitable for React Native fetch / multipart photo uploads.
 */
export function createImageFormData(
  fieldName: string,
  uri: string,
  fileName?: string
): FormData {
  const formData = new FormData();
  const name = fileName || uri.split('/').pop() || `${fieldName}_${Date.now()}.jpg`;
  const type = getMimeTypeFromUri(name);

  formData.append(fieldName, {
    uri,
    name,
    type,
  } as any);

  return formData;
}
