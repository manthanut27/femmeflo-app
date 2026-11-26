import type { CustomerItem, UpdateCustomerPayload } from '../api/types';

/**
 * Normalizes backend Customer payloads so `ownerName`, `contactName`, and `photoUrl`
 * are consistently available in mobile views and edit forms.
 */
export function normalizeCustomerItem<T extends CustomerItem | null | undefined>(customer: T): T {
  if (!customer || typeof customer !== 'object') return customer;
  const raw = customer as any;
  const resolvedOwner = raw.ownerName || raw.contactName || '';
  return {
    ...customer,
    ownerName: resolvedOwner,
    contactName: raw.contactName || resolvedOwner || undefined,
    photoUrl: raw.photoUrl || raw.photoPath || null,
  };
}

/**
 * Builds a strict PATCH body for `PATCH /(seller|manager|admin)/customers/:id`.
 * Backend `updateCustomerSchema` enforces strict keys (`contactName` instead of `ownerName`)
 * and rejects unrecognized or empty string fields.
 */
export function buildCustomerUpdateBody(payload: UpdateCustomerPayload): Record<string, any> {
  const raw = payload as Record<string, any>;
  const body: Record<string, any> = {};

  if (typeof payload.shopName === 'string' && payload.shopName.trim()) {
    body.shopName = payload.shopName.trim();
  }

  const resolvedContact =
    typeof raw.contactName === 'string' && raw.contactName.trim()
      ? raw.contactName.trim()
      : typeof payload.ownerName === 'string' && payload.ownerName.trim()
      ? payload.ownerName.trim()
      : undefined;
  if (resolvedContact) {
    body.contactName = resolvedContact;
  }

  if (typeof payload.phone === 'string' && payload.phone.trim()) {
    const rawPhone = payload.phone.trim();
    body.phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
  }

  if (typeof payload.email === 'string' && payload.email.trim()) {
    body.email = payload.email.trim();
  }
  if (typeof payload.categoryId === 'string' && payload.categoryId.trim()) {
    body.categoryId = payload.categoryId.trim();
  }
  if (typeof payload.sellerId === 'string' && payload.sellerId.trim()) {
    body.sellerId = payload.sellerId.trim();
  }
  if (typeof payload.address === 'string' && payload.address.trim()) {
    body.address = payload.address.trim();
  }
  if (typeof payload.pincode === 'string' && payload.pincode.trim()) {
    body.pincode = payload.pincode.trim();
  }
  if (typeof payload.state === 'string' && payload.state.trim()) {
    body.state = payload.state.trim();
  }
  if (typeof payload.district === 'string' && payload.district.trim()) {
    body.district = payload.district.trim();
  }
  if (typeof payload.village === 'string' && payload.village.trim()) {
    body.village = payload.village.trim();
  }
  if (typeof raw.photoPath === 'string' && raw.photoPath.trim()) {
    body.photoPath = raw.photoPath.trim();
  }
  if (typeof payload.photoUrl === 'string' && payload.photoUrl.trim() && !payload.photoUrl.startsWith('file://')) {
    body.photoUrl = payload.photoUrl.trim();
  }
  if (typeof payload.noPhotoReason === 'string' && payload.noPhotoReason.trim()) {
    body.noPhotoReason = payload.noPhotoReason.trim();
  }
  if (typeof payload.active === 'boolean') {
    body.active = payload.active;
  }

  return body;
}
