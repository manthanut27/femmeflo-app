import type { AdminInventoryTransactionItem } from '../api/types';

/**
 * Format an ISO date timestamp into Indian Standard Time (IST) strings:
 * e.g. dateStr: "08 Nov 2026", timeStr: "09:22 AM"
 */
export function formatTransactionIST(createdAt: string | undefined): { dateStr: string; timeStr: string } {
  if (!createdAt) return { dateStr: '—', timeStr: '—' };
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return { dateStr: '—', timeStr: '—' };

  try {
    const dateStr = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata',
    });
    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });
    return { dateStr, timeStr };
  } catch {
    const utcMs = d.getTime() + d.getTimezoneOffset() * 60000;
    const istMs = utcMs + 5.5 * 3600000;
    const istDate = new Date(istMs);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const day = String(istDate.getDate()).padStart(2, '0');
    const month = months[istDate.getMonth()];
    const year = istDate.getFullYear();
    let hours = istDate.getHours();
    const minutes = String(istDate.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const hourStr = String(hours).padStart(2, '0');
    return {
      dateStr: `${day} ${month} ${year}`,
      timeStr: `${hourStr}:${minutes} ${ampm}`,
    };
  }
}

/**
 * Maps transaction routing presentation across INWARD, TRANSFER, and SALE:
 * INWARD: Factory / Supplier -> Headquarters (HQ)
 * TRANSFER: Source Warehouse -> Destination Warehouse
 * SALE: Warehouse / Seller -> Customer
 */
export function getTransactionRoute(tx: AdminInventoryTransactionItem): { from: string; to: string } {
  const type = String(tx.type || '').toUpperCase();
  if (type === 'INWARD' || type === 'RECEIPT') {
    return {
      from: tx.sourceLocation || tx.source?.name || 'Factory / Supplier',
      to: tx.destinationLocation || tx.destination?.name || 'Headquarters (HQ)',
    };
  }
  if (type === 'SALE' || type === 'SALES') {
    const customer =
      tx.sale?.customer?.shopName ||
      tx.sale?.customerName ||
      tx.destinationLocation ||
      tx.destination?.name ||
      'Customer';
    return {
      from: tx.sourceLocation || tx.source?.name || 'Warehouse / Seller',
      to: customer,
    };
  }
  return {
    from: tx.sourceLocation || tx.source?.name || 'Source Warehouse',
    to: tx.destinationLocation || tx.destination?.name || 'Destination Warehouse',
  };
}

/**
 * Validates stock transfer quantity against available stock at source
 */
export function validateStockTransfer(
  qtyStr: string,
  availableStock: number
): {
  parsedQty: number;
  isValid: boolean;
  isStockExceeded: boolean;
  canSubmit: boolean;
} {
  const parsedQty = parseInt(qtyStr, 10);
  const isValid = !isNaN(parsedQty) && parsedQty > 0;
  const isStockExceeded = isValid && availableStock > 0 && parsedQty > availableStock;
  return {
    parsedQty,
    isValid,
    isStockExceeded,
    canSubmit: isValid && !isStockExceeded,
  };
}

/**
 * Calculates updated quantity when a quick-add chip is tapped
 */
export function calculateQuickAdd(
  currentQtyStr: string,
  addAmount: number,
  maxCap?: number
): string {
  const current = parseInt(currentQtyStr, 10);
  const next = isNaN(current) || current <= 0 ? addAmount : current + addAmount;
  if (typeof maxCap === 'number' && maxCap > 0 && next > maxCap) {
    return String(maxCap);
  }
  return String(next);
}

/**
 * Generates an independent unique idempotency request key for stock receipts
 */
export function generateReceiptRequestKey(): string {
  return `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Maps the 4 UI history filter options to the exact backend enum:
 * Backend expects: "RECEIPT" | "TRANSFER" | "SALE"
 */
export function mapHistoryFilterToApiType(
  filter: 'All' | 'Inward' | 'Transfer' | 'Sales' | string
): 'RECEIPT' | 'TRANSFER' | 'SALE' | undefined {
  if (filter === 'Inward') return 'RECEIPT';
  if (filter === 'Transfer') return 'TRANSFER';
  if (filter === 'Sales') return 'SALE';
  return undefined;
}

