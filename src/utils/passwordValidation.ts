/**
 * Validation for onboarding passwords (Manager and Seller accounts).
 * Requirements:
 * - Minimum 7 characters
 * - At least one letter (a-z, A-Z)
 * - At least one number (0-9)
 * - At least one symbol / special character
 */
export function validateOnboardingPassword(password?: string | null): { isValid: boolean; error?: string } {
  const trimmed = (password || '').trim();
  if (!trimmed) {
    return { isValid: false, error: 'Initial password is required.' };
  }
  if (trimmed.length < 7) {
    return { isValid: false, error: 'Initial password must be at least 7 characters.' };
  }
  if (!/[a-zA-Z]/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one letter.' };
  }
  if (!/[0-9]/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one number.' };
  }
  if (!/[^a-zA-Z0-9]/.test(trimmed)) {
    return { isValid: false, error: 'Password must contain at least one symbol (e.g. @, #, $, !).' };
  }
  return { isValid: true };
}
