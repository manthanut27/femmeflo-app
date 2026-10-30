import type { PaymentMode, Shift } from '@/api/types';

export interface OrderDraftLineItem {
  productId: string;
  productName: string;
  sku?: string;
  quantity: number;
  unitPricePaise: number;
  minPricePaise?: number;
}

export interface OrderDraft {
  idempotencyKey: string;
  payloadHash?: string;
  submitted?: boolean;
  customerId?: string;
  customerName?: string;
  items: OrderDraftLineItem[];
  paymentMode: PaymentMode;
  paymentReference?: string;
  customerFeedback?: string;
  updatedAt: string;
}

export interface VisitCheckoutDraft {
  visitId: string;
  saleDone: boolean;
  selectedCustomerId?: string;
  selectedProductId?: string;
  quantity: number;
  unitPrice: number;
  paymentMode: PaymentMode;
  feedback: string;
  notes: string;
  reason?: string;
  updatedAt: string;
}

export interface CustomerDraft {
  shopName?: string;
  ownerName?: string;
  email?: string;
  phone?: string;
  categoryId?: string;
  address?: string;
  pincode?: string;
  state?: string;
  district?: string;
  village?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  noPhotoReason?: string;
  photoUri?: string;
  updatedAt: string;
}

export interface StorageBackend {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function computePayloadHash(payload: {
  customerId?: string;
  items: Array<{ productId: string; quantity: number; unitPricePaise: number }>;
  paymentMode?: string;
  paymentReference?: string;
  customerFeedback?: string;
}): string {
  const normItems = [...(payload.items || [])]
    .map((i) => `${i.productId}:${i.quantity}:${i.unitPricePaise}`)
    .sort()
    .join('|');
  return `${payload.customerId || ''}#${payload.paymentMode || ''}#${payload.paymentReference || ''}#${payload.customerFeedback || ''}#${normItems}`;
}

export function shouldRotateIdempotencyKey(
  currentHash: string,
  savedHash: string | undefined,
  wasSubmitted: boolean
): boolean {
  if (!wasSubmitted) return false;
  return Boolean(savedHash && currentHash !== savedHash);
}

export function createDraftStorage(backend: StorageBackend) {
  const getDraftKey = (userId?: string) => `@femmeflo_order_draft_${userId || 'anonymous'}`;
  const getShiftKey = (userId?: string) => `@femmeflo_active_shift_${userId || 'anonymous'}`;
  const getCustomerDraftKey = (userId?: string) => `@femmeflo_customer_draft_${userId || 'anonymous'}`;
  const getCheckoutDraftKey = (userId: string | undefined, visitId: string) =>
    `@femmeflo_checkout_draft_${userId || 'anonymous'}_${visitId}`;

  return {
    async getOrderDraft(userId?: string): Promise<OrderDraft | null> {
      try {
        const raw = await backend.getItem(getDraftKey(userId));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async saveOrderDraft(userId: string | undefined, draft: OrderDraft): Promise<void> {
      try {
        const payload = JSON.stringify({
          ...draft,
          updatedAt: new Date().toISOString(),
        });
        await backend.setItem(getDraftKey(userId), payload);
      } catch (err) {
        console.warn('Failed to save order draft', err);
      }
    },

    async clearOrderDraft(userId?: string): Promise<void> {
      try {
        await backend.removeItem(getDraftKey(userId));
      } catch (err) {
        console.warn('Failed to clear order draft', err);
      }
    },

    async getCustomerDraft(userId?: string): Promise<CustomerDraft | null> {
      try {
        const raw = await backend.getItem(getCustomerDraftKey(userId));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async saveCustomerDraft(userId: string | undefined, draft: CustomerDraft): Promise<void> {
      try {
        const payload = JSON.stringify({
          ...draft,
          updatedAt: new Date().toISOString(),
        });
        await backend.setItem(getCustomerDraftKey(userId), payload);
      } catch (err) {
        console.warn('Failed to save customer draft', err);
      }
    },

    async clearCustomerDraft(userId?: string): Promise<void> {
      try {
        await backend.removeItem(getCustomerDraftKey(userId));
      } catch (err) {
        console.warn('Failed to clear customer draft', err);
      }
    },

    async getActiveShift(userId?: string): Promise<Shift | null> {
      try {
        const raw = await backend.getItem(getShiftKey(userId));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async saveActiveShift(userId: string | undefined, shift: Shift | null): Promise<void> {
      try {
        if (!shift) {
          await backend.removeItem(getShiftKey(userId));
          return;
        }
        await backend.setItem(getShiftKey(userId), JSON.stringify(shift));
      } catch (err) {
        console.warn('Failed to cache active shift', err);
      }
    },

    async clearActiveShift(userId?: string): Promise<void> {
      try {
        await backend.removeItem(getShiftKey(userId));
      } catch (err) {
        console.warn('Failed to clear active shift cache', err);
      }
    },

    async getVisitCheckoutDraft(userId: string | undefined, visitId: string): Promise<VisitCheckoutDraft | null> {
      try {
        const raw = await backend.getItem(getCheckoutDraftKey(userId, visitId));
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    },

    async saveVisitCheckoutDraft(userId: string | undefined, visitId: string, draft: VisitCheckoutDraft): Promise<void> {
      try {
        const payload = JSON.stringify({
          ...draft,
          updatedAt: new Date().toISOString(),
        });
        await backend.setItem(getCheckoutDraftKey(userId, visitId), payload);
      } catch (err) {
        console.warn('Failed to save visit checkout draft', err);
      }
    },

    async clearVisitCheckoutDraft(userId: string | undefined, visitId: string): Promise<void> {
      try {
        await backend.removeItem(getCheckoutDraftKey(userId, visitId));
      } catch (err) {
        console.warn('Failed to clear visit checkout draft', err);
      }
    },

    async clearUserStorage(userId?: string): Promise<void> {
      try {
        await Promise.all([
          backend.removeItem(getDraftKey(userId)),
          backend.removeItem(getShiftKey(userId)),
          backend.removeItem(getCustomerDraftKey(userId)),
        ]);
      } catch (err) {
        console.warn('Failed to clear user storage', err);
      }
    },
  };
}

function resolveWebStorage(): StorageBackend {
  if (typeof localStorage !== 'undefined') {
    return {
      async getItem(key: string) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      },
      async setItem(key: string, value: string) {
        localStorage.setItem(key, value);
      },
      async removeItem(key: string) {
        localStorage.removeItem(key);
      },
    };
  }

  const memory = new Map<string, string>();
  return {
    async getItem(key: string) {
      return memory.get(key) ?? null;
    },
    async setItem(key: string, value: string) {
      memory.set(key, value);
    },
    async removeItem(key: string) {
      memory.delete(key);
    },
  };
}

export const draftStorage = createDraftStorage(resolveWebStorage());

