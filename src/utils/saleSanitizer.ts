import type { UpdateSalePayload } from '../api/types.ts';

/**
 * Strict whitelist sanitizer for sale update payloads.
 * Backend PATCH /api/v1/seller/sales/:id and manager/sales/:id enforce strict schema validation
 * and throw 400 Bad Request if unrecognized keys are present.
 *
 * Recognized keys:
 * - customerId?: string
 * - quantity?: number
 * - unitPricePaise?: number
 * - paymentMode?: PaymentMode
 * - customerFeedback?: string
 *
 * All client-computed or extra keys (e.g. totalAmountPaise, totalPaise, status, resubmitForApproval, notes)
 * are discarded to prevent "Unrecognized keys" errors.
 */
export function sanitizeUpdateSalePayload(
  raw: Partial<UpdateSalePayload> | Record<string, any>
): UpdateSalePayload {
  const sanitized: UpdateSalePayload = {};
  if (typeof raw?.unitPricePaise === 'number' && !isNaN(raw.unitPricePaise)) {
    sanitized.unitPricePaise = raw.unitPricePaise;
  }
  if (typeof raw?.quantity === 'number' && !isNaN(raw.quantity)) {
    sanitized.quantity = raw.quantity;
  }
  if (raw?.customerId && typeof raw.customerId === 'string') {
    sanitized.customerId = raw.customerId;
  }
  if (raw?.paymentMode && typeof raw.paymentMode === 'string') {
    sanitized.paymentMode = raw.paymentMode as UpdateSalePayload['paymentMode'];
  }
  if (raw?.customerFeedback && typeof raw.customerFeedback === 'string') {
    sanitized.customerFeedback = raw.customerFeedback;
  }
  return sanitized;
}
