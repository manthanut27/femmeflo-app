export interface FrameValidationInput {
  width?: number;
  height?: number;
  base64Length?: number;
  avgLuma?: number;
  lumaStdDev?: number;
}

export interface FrameValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Rejects blank, covered, pitch-dark night frames, or featureless snapshots
 * before marking biometric face verification successful.
 */
export function validateCapturedFaceFrame(input: FrameValidationInput): FrameValidationResult {
  const { width, height, base64Length, avgLuma, lumaStdDev } = input;

  if ((typeof width === 'number' && width < 60) || (typeof height === 'number' && height < 60)) {
    return {
      valid: false,
      reason: 'Camera image resolution is too low. Please position your face clearly and scan again.',
    };
  }

  // Pixel luminance & contrast validation (available on Web via offscreen Canvas)
  if (typeof avgLuma === 'number' && avgLuma < 32) {
    return {
      valid: false,
      reason: 'Camera image is too dark (night mode / covered lens). Turn on Fill Light or move to a lit area and scan again.',
    };
  }
  if (typeof lumaStdDev === 'number' && lumaStdDev < 10) {
    return {
      valid: false,
      reason: 'No clear face features detected (blank or covered camera). Align your face in bright light and retry.',
    };
  }

  // Compressed JPEG entropy / byte-density check (pitch-dark or covered lens compresses near-empty)
  if (typeof base64Length === 'number') {
    const approxBytes = Math.floor(base64Length * 0.75);
    if (approxBytes < 8000) {
      return {
        valid: false,
        reason: 'Captured photo appears blank or completely dark. Turn on Fill Light or move into light and try again.',
      };
    }
    if (typeof width === 'number' && typeof height === 'number' && width > 0 && height > 0) {
      const bytesPerPixel = approxBytes / (width * height);
      if (bytesPerPixel < 0.032) {
        return {
          valid: false,
          reason: 'Camera view is too dark or covered — no face detected. Turn on Fill Light or move to bright lighting and scan again.',
        };
      }
    }
  }

  return { valid: true };
}
