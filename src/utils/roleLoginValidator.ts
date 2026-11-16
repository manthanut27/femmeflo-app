import { MOCK_ALL_MANAGERS, MOCK_ALL_SELLERS, MOCK_USERS } from '../api/mockData.ts';

export type LoginRoleSection = 'seller' | 'manager' | 'admin';

export interface RoleValidationResult {
  isValid: boolean;
  error?: string;
  recommendedSection?: LoginRoleSection;
}

export interface ResolvedUserRole {
  role: string;
  isSeller?: boolean;
  section: LoginRoleSection;
}

/**
 * Normalizes phone number or email for identity matching.
 */
function matchesLoginId(
  user: { email?: string | null; phone?: string | null },
  cleanId: string,
  rawDigits: string
): boolean {
  if (user.email && user.email.toLowerCase() === cleanId) return true;
  if (rawDigits.length === 10 && user.phone) {
    const userDigits = user.phone.replace(/\D/g, '').slice(-10);
    if (userDigits.length === 10 && userDigits === rawDigits) return true;
  }
  return false;
}

/**
 * Validates whether an authenticated or resolved user is authorized
 * to log into the selected portal section on the login screen.
 *
 * Rules:
 * 1. Seller section ('seller'):
 *    - Allowed: 'SELLER' OR ('MANAGER' with isSeller: true, i.e. Dual Role)
 *    - Disallowed: 'SUPER_ADMIN' or standard 'MANAGER' without isSeller
 * 2. Manager section ('manager'):
 *    - Allowed: 'MANAGER' (both standard manager and dual-role manager)
 *    - Disallowed: 'SUPER_ADMIN', 'SELLER'
 * 3. Admin section ('admin'):
 *    - Allowed: 'SUPER_ADMIN' only
 *    - Disallowed: 'MANAGER' (even dual role), 'SELLER'
 */
export function validateLoginRoleSection(
  selectedSection: LoginRoleSection,
  user: { role: string; isSeller?: boolean }
): RoleValidationResult {
  if (!user || !user.role) {
    return {
      isValid: false,
      error: 'Invalid user profile data received.',
    };
  }

  const role = user.role.toUpperCase();
  const isSeller = Boolean(user.isSeller);

  switch (selectedSection) {
    case 'seller': {
      if (role === 'SELLER' || (role === 'MANAGER' && isSeller)) {
        return { isValid: true };
      }
      if (role === 'SUPER_ADMIN') {
        return {
          isValid: false,
          error: 'This account is for Super Admin. Please switch to the Super Admin tab above to sign in.',
          recommendedSection: 'admin',
        };
      }
      if (role === 'MANAGER' && !isSeller) {
        return {
          isValid: false,
          error: 'This account is for Territory Manager without seller access. Please switch to the Territory Manager tab above to sign in.',
          recommendedSection: 'manager',
        };
      }
      return {
        isValid: false,
        error: 'Account role is not recognized for Field Seller portal.',
      };
    }

    case 'manager': {
      if (role === 'MANAGER') {
        return { isValid: true };
      }
      if (role === 'SUPER_ADMIN') {
        return {
          isValid: false,
          error: 'This account is for Super Admin. Please switch to the Super Admin tab above to sign in.',
          recommendedSection: 'admin',
        };
      }
      if (role === 'SELLER') {
        return {
          isValid: false,
          error: 'This account is for Field Seller. Please switch to the Field Seller tab above to sign in.',
          recommendedSection: 'seller',
        };
      }
      return {
        isValid: false,
        error: 'Account role is not recognized for Territory Manager portal.',
      };
    }

    case 'admin': {
      if (role === 'SUPER_ADMIN') {
        return { isValid: true };
      }
      if (role === 'MANAGER') {
        return {
          isValid: false,
          error: 'This account is for Territory Manager. Please switch to the Territory Manager tab above to sign in.',
          recommendedSection: 'manager',
        };
      }
      if (role === 'SELLER') {
        return {
          isValid: false,
          error: 'This account is for Field Seller. Please switch to the Field Seller tab above to sign in.',
          recommendedSection: 'seller',
        };
      }
      return {
        isValid: false,
        error: 'Account role is not recognized for Super Admin portal.',
      };
    }

    default:
      return {
        isValid: false,
        error: 'Unknown login section.',
      };
  }
}

/**
 * Resolves an identifier (email, phone, username) against known accounts
 * to determine its inherent role and portal section before submission.
 */
export function resolveKnownUserRole(
  identifier: string,
  customUsers?: Array<{ email?: string | null; phone?: string | null; role: string; isSeller?: boolean }>
): ResolvedUserRole | null {
  const clean = (identifier || '').trim().toLowerCase();
  if (!clean) return null;

  const rawDigits = clean.replace(/\D/g, '').slice(-10);

  // 1. Check custom dynamically registered users if provided
  if (customUsers && customUsers.length > 0) {
    const match = customUsers.find((u) => matchesLoginId(u, clean, rawDigits));
    if (match) {
      const role = match.role.toUpperCase();
      const isSeller = Boolean(match.isSeller);
      const section: LoginRoleSection =
        role === 'SUPER_ADMIN' ? 'admin' : role === 'MANAGER' ? 'manager' : 'seller';
      return { role, isSeller, section };
    }
  }

  // 2. Super Admin Check
  if (
    matchesLoginId(MOCK_USERS.admin, clean, rawDigits) ||
    clean === 'admin@femmeflo.com' ||
    clean === 'admin@femmeflo.in' ||
    (rawDigits.length === 10 && rawDigits === '9876543230') ||
    clean.includes('admin') ||
    clean.includes('super')
  ) {
    return {
      role: 'SUPER_ADMIN',
      isSeller: false,
      section: 'admin',
    };
  }

  // 3. Manager Check
  const foundManager = MOCK_ALL_MANAGERS.find((m) => matchesLoginId(m, clean, rawDigits));
  if (
    foundManager ||
    matchesLoginId(MOCK_USERS.manager, clean, rawDigits) ||
    clean === 'manager@femmeflo.com' ||
    clean === 'manager@femmeflo.in' ||
    clean === 'sunil.manager@femmeflo.com' ||
    (rawDigits.length === 10 &&
      (rawDigits === '9876543220' || rawDigits === '9876543221' || rawDigits === '9876543222')) ||
    clean.includes('manager')
  ) {
    const isDual =
      Boolean(foundManager?.isSeller) ||
      clean.includes('dual') ||
      (clean.includes('manager') && clean.includes('seller'));
    return {
      role: 'MANAGER',
      isSeller: isDual,
      section: 'manager',
    };
  }

  // 4. Seller Check
  const foundSeller = MOCK_ALL_SELLERS.find((s) => matchesLoginId(s, clean, rawDigits));
  if (
    foundSeller ||
    matchesLoginId(MOCK_USERS.seller, clean, rawDigits) ||
    clean === 'seller@femmeflo.com' ||
    clean === 'seller@femmeflo.in' ||
    clean === 'kavita.seller@femmeflo.com' ||
    clean === 'aakash.seller@femmeflo.com' ||
    clean === 'deepika.seller@femmeflo.com' ||
    (rawDigits.length === 10 &&
      (rawDigits === '9876543210' ||
        rawDigits === '9876543212' ||
        rawDigits === '9876543213' ||
        rawDigits === '9876543214')) ||
    clean.includes('seller')
  ) {
    return {
      role: 'SELLER',
      isSeller: true,
      section: 'seller',
    };
  }

  return null;
}

/**
 * Pre-login validator that checks whether the identifier entered by the user
 * matches an account whose role is allowed in the currently active tab.
 *
 * If identifier is unknown or empty, returns { isValid: true } to allow
 * backend authentication to proceed.
 */
export function checkIdentifierForRoleSection(
  selectedSection: LoginRoleSection,
  identifier: string,
  customUsers?: Array<{ email?: string | null; phone?: string | null; role: string; isSeller?: boolean }>
): RoleValidationResult {
  const trimmed = (identifier || '').trim();
  if (!trimmed) {
    return { isValid: true };
  }

  const known = resolveKnownUserRole(trimmed, customUsers);
  if (!known) {
    return { isValid: true };
  }

  return validateLoginRoleSection(selectedSection, known);
}
