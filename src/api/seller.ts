import { apiRequest, API_BASE_URL, isMockMode, uploadFileMultipart } from './client';
import { handleMockRequest } from './mockService';
import type {
  BulkCustomerResponse,
  CheckInPayload,
  CheckOutPayload,
  CollectPaymentPayload,
  CreateBulkCustomersPayload,
  CreateCustomerPayload,
  CreateSalePayload,
  CustomerItem,
  EndShiftPayload,
  PaginationMeta,
  PincodeLookupResponse,
  ProductItem,
  PublicUser,
  SaleItem,
  SellerDashboardData,
  SellerIncentiveData,
  SellerInventoryData,
  Shift,
  ShiftVisit,
  StartShiftPayload,
  StockTransactionItem,
  UpdateCustomerPayload,
  UpdateSalePayload,
} from './types';

import { sanitizeUpdateSalePayload } from '../utils/saleSanitizer';
import { buildCustomerUpdateBody, normalizeCustomerItem } from '../utils/customerSanitizer';
import { draftStorage } from '../utils/draftStorage';
import { sanitizeIndiaCoordinates } from '../utils/geoValidation';

export { sanitizeUpdateSalePayload };

export const sellerApi = {
  // ----------------------------------------------------
  // Profile & Settings
  // ----------------------------------------------------
  async updateProfile(payload: Partial<PublicUser>): Promise<{ user: PublicUser }> {
    return apiRequest<{ user: PublicUser }>('seller/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  // ----------------------------------------------------
  // Dashboard
  // ----------------------------------------------------
  async getDashboard(): Promise<SellerDashboardData> {
    const raw = await apiRequest<any>('seller/dashboard', {
      method: 'GET',
    });
    const metrics = raw?.metrics;
    const remainingPackets = metrics?.remainingPackets ?? raw?.stockBalance ?? 0;
    const soldPackets = metrics?.soldPackets ?? raw?.todayPacketsSold ?? 0;

    // Use backend-calculated sales paise if present
    let todaySales = raw?.todaySalesPaise ?? raw?.todaySalesAmountPaise ?? metrics?.todaySalesPaise;
    let monthSales = raw?.monthSalesPaise ?? metrics?.monthSalesPaise;
    let todayOrders = raw?.todayOrdersCount ?? metrics?.todayOrdersCount;
    let todaySold = raw?.todayPacketsSold ?? metrics?.todayPacketsSold;

    // If backend values are missing, compute precisely from recentSales using actual totalPaise
    if (todaySales === undefined && Array.isArray(raw?.recentSales)) {
      const now = new Date();
      const istNow = new Date(now.getTime() + 5.5 * 3600000);
      const startOfTodayIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - 5.5 * 3600000);
      const startOfMonthIst = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), 1) - 5.5 * 3600000);

      const confirmedSales = raw.recentSales.filter((s: any) => s.status === 'CONFIRMED' || !s.status);
      const salesToday = confirmedSales.filter((s: any) => new Date(s.createdAt) >= startOfTodayIst);
      const salesMonth = confirmedSales.filter((s: any) => new Date(s.createdAt) >= startOfMonthIst);

      todaySales = salesToday.reduce((sum: number, s: any) => sum + (s.totalPaise || (s.quantity * (s.unitPricePaise || 0)) || 0), 0);
      monthSales = salesMonth.reduce((sum: number, s: any) => sum + (s.totalPaise || (s.quantity * (s.unitPricePaise || 0)) || 0), 0);
      todayOrders = salesToday.length;
      todaySold = salesToday.reduce((sum: number, s: any) => sum + (s.quantity || 0), 0);
    }

    const salesPaise = todaySales ?? 0;
    const monthlyPaise = monthSales ?? salesPaise;
    const ordersCount = todayOrders ?? (Array.isArray(raw?.recentSales) ? raw.recentSales.length : 0);
    const packetsSold = todaySold ?? soldPackets;

    return {
      todaySalesPaise: salesPaise,
      todaySalesAmountPaise: salesPaise,
      todayOrdersCount: ordersCount,
      todayPacketsSold: packetsSold,
      monthSalesPaise: monthlyPaise,
      lowStockCount: raw?.lowStockCount ?? (remainingPackets < 20 ? 1 : 0),
      stockBalance: remainingPackets,
      metrics: metrics,
      recentSales: raw?.recentSales ?? [],
      pendingApprovalsCount: raw?.pendingApprovalsCount ?? 0,
      activeShift: raw?.activeShift ?? null,
    };
  },

  // ----------------------------------------------------
  // Customers
  // ----------------------------------------------------
  async listCustomers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    active?: boolean;
    state?: string;
    district?: string;
  }): Promise<{ items: CustomerItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ customers?: CustomerItem[]; items?: CustomerItem[]; pagination: PaginationMeta }>(
      'seller/customers',
      {
        method: 'GET',
        params,
      }
    );
    const list = (raw?.customers ?? raw?.items ?? []).map((c) => normalizeCustomerItem(c));
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getCustomer(id: string): Promise<{ customer: CustomerItem }> {
    const res = await apiRequest<{ customer: CustomerItem }>(`seller/customers/${id}`, {
      method: 'GET',
    });
    if (res?.customer) {
      res.customer = {
        ...normalizeCustomerItem(res.customer),
        photoUrl: res.customer.photoUrl || (res.customer as any).photoPath || null,
      };
    }
    return res;
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<{ customer: CustomerItem }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const contactName = (payload as any).contactName || payload.ownerName?.trim() || payload.shopName.trim();
    const noPhotoReason = payload.noPhotoReason || payload.photoSkipReason || (payload.photoUri ? 'Storefront photo captured' : undefined);

    const coords = sanitizeIndiaCoordinates(payload.latitude, payload.longitude);
    const hasExplicitCoords = payload.latitude != null && payload.longitude != null;

    const body: Record<string, any> = {
      shopName: payload.shopName.trim(),
      contactName,
      phone,
      categoryId: payload.categoryId,
      address: payload.address,
      state: payload.state,
      district: payload.district,
      village: payload.village || 'Default',
    };
    if (hasExplicitCoords) {
      body.latitude = coords.latitude;
      body.longitude = coords.longitude;
    }
    if (payload.shopNumber?.trim()) body.shopNumber = payload.shopNumber.trim();
    if (payload.streetName?.trim()) body.streetName = payload.streetName.trim();
    if (payload.pincode?.trim()) body.pincode = payload.pincode.trim();
    if (payload.email) body.email = payload.email.trim();
    if (payload.accuracy != null) body.accuracy = payload.accuracy;
    if (noPhotoReason) body.noPhotoReason = noPhotoReason;
    if (payload.photoPath) body.photoPath = payload.photoPath;

    return apiRequest<{ customer: CustomerItem }>('seller/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<{ customer: CustomerItem }> {
    const body = buildCustomerUpdateBody(payload);
    if (payload.latitude != null || payload.longitude != null) {
      const coords = sanitizeIndiaCoordinates(payload.latitude, payload.longitude);
      body.latitude = coords.latitude;
      body.longitude = coords.longitude;
    }
    const res = await apiRequest<{ customer: CustomerItem }>(`seller/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res?.customer) {
      res.customer = {
        ...normalizeCustomerItem(res.customer),
        photoUrl: res.customer.photoUrl || (res.customer as any).photoPath || null,
      };
    }
    return res;
  },

  async createBulkCustomers(payload: CreateBulkCustomersPayload): Promise<BulkCustomerResponse> {
    const sanitizedCustomers = (payload.customers || []).map((c) => {
      const coords = sanitizeIndiaCoordinates(c.latitude, c.longitude);
      return {
        ...c,
        latitude: coords.latitude,
        longitude: coords.longitude,
      };
    });
    return apiRequest<BulkCustomerResponse>('seller/customers/bulk', {
      method: 'POST',
      body: JSON.stringify({ ...payload, customers: sanitizedCustomers }),
    });
  },

  async lookupPincode(pincode: string): Promise<PincodeLookupResponse> {
    try {
      const res = await apiRequest<PincodeLookupResponse>(
        `seller/customers/pincode/${pincode}`,
        { method: 'GET' }
      );
      if (res && res.state) {
        return res;
      }
    } catch {
      // Fallback below
    }

    if (isMockMode()) {
      return {
        pincode,
        state: 'Madhya Pradesh',
        district: 'Indore',
        village: 'Rau',
        villages: ['Rau', 'Pithampur', 'Mhow', 'Hatod', 'Sanwer', 'Indore City'],
      };
    }

    try {
      const postalRes = await fetch(`https://api.postalpincode.in/pincode/${pincode}`);
      const data = await postalRes.json();
      if (Array.isArray(data) && data[0]?.Status === 'Success' && data[0].PostOffice?.length) {
        const poList = data[0].PostOffice;
        const state = poList[0].State || '';
        const district = poList[0].District || '';
        const villages: string[] = Array.from(new Set(poList.map((p: any) => String(p.Name || '')).filter(Boolean)));
        return {
          pincode,
          state,
          district,
          village: villages[0] || '',
          villages,
        };
      }
    } catch {
      // Ignore
    }

    return {
      pincode,
      state: '',
      district: '',
      village: '',
      villages: [],
    };
  },

  async uploadCustomerPhoto(customerId: string, fileUri: string): Promise<{ photoUrl: string }> {
    return uploadFileMultipart<{ photoUrl: string }>(`seller/customers/${customerId}/photo`, fileUri, 'photo');
  },

  // ----------------------------------------------------
  // Products & Inventory
  // ----------------------------------------------------
  async listProducts(): Promise<{ items: ProductItem[] }> {
    return apiRequest<{ items: ProductItem[] }>('seller/products', {
      method: 'GET',
    });
  },

  async getInventory(): Promise<SellerInventoryData> {
    return apiRequest<SellerInventoryData>('seller/inventory', {
      method: 'GET',
    });
  },

  async listTransactions(params?: {
    page?: number;
    pageSize?: number;
    type?: string;
  }): Promise<{ items: StockTransactionItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ transactions?: StockTransactionItem[]; items?: StockTransactionItem[]; pagination: PaginationMeta }>(
      'seller/inventory/transactions',
      {
        method: 'GET',
        params,
      }
    );
    const list = raw?.transactions ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  // ----------------------------------------------------
  // Sales & POS
  // ----------------------------------------------------
  async createSale(payload: CreateSalePayload): Promise<{ sale: SaleItem }> {
    const headers: Record<string, string> = {};
    const key = payload.requestKey || payload.idempotencyKey;
    if (key) {
      headers['X-Idempotency-Key'] = key;
    }

    // Server createSaleSchema is z.strictObject({ customerId, items, paymentMode, requestKey, customerFeedback })
    // paymentReference is formatted into customerFeedback so strict schema does not reject it
    const feedbackParts: string[] = [];
    if (payload.customerFeedback?.trim()) {
      feedbackParts.push(payload.customerFeedback.trim());
    }
    if (payload.paymentReference?.trim()) {
      feedbackParts.push(`[Ref: ${payload.paymentReference.trim()}]`);
    }
    const combinedFeedback = feedbackParts.join(' | ') || undefined;

    const baseBody: Record<string, any> = {
      customerId: payload.customerId,
      items: payload.items,
      paymentMode: payload.paymentMode,
    };
    if (key) {
      baseBody.requestKey = key;
    }

    try {
      const fullBody = { ...baseBody };
      if (combinedFeedback) {
        fullBody.customerFeedback = combinedFeedback;
      }
      return await apiRequest<{ sale: SaleItem }>('seller/sales', {
        method: 'POST',
        headers,
        body: JSON.stringify(fullBody),
      });
    } catch (err: any) {
      const is500OrInternal =
        err?.status === 500 ||
        (err?.message && String(err.message).toLowerCase().includes('internal server error'));

      if (is500OrInternal) {
        // Fallback 1: If server rejects multi-SKU items or customerFeedback, try single-item legacy payload
        if (payload.items && payload.items.length === 1) {
          try {
            const singleItemBody: Record<string, any> = {
              customerId: payload.customerId,
              quantity: payload.items[0].quantity,
              unitPricePaise: payload.items[0].unitPricePaise,
              paymentMode: payload.paymentMode,
            };
            if (combinedFeedback) singleItemBody.customerFeedback = combinedFeedback;
            if (key) singleItemBody.requestKey = key;
            return await apiRequest<{ sale: SaleItem }>('seller/sales', {
              method: 'POST',
              headers,
              body: JSON.stringify(singleItemBody),
            });
          } catch {
            // continue to next fallback
          }
        }

        // Fallback 2: Retry without customerFeedback
        if (combinedFeedback) {
          console.warn('[createSale] Retrying sale creation without customerFeedback due to server schema limitation');
          try {
            return await apiRequest<{ sale: SaleItem }>('seller/sales', {
              method: 'POST',
              headers,
              body: JSON.stringify(baseBody),
            });
          } catch {
            // let outer error throw
          }
        }
      }
      throw err;
    }
  },

  async listSales(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    paymentMode?: string;
    customerId?: string;
    search?: string;
    period?: string;
    from?: string;
    to?: string;
  }): Promise<{ items: SaleItem[]; pagination: PaginationMeta }> {
    try {
      const raw = await apiRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination: PaginationMeta }>('seller/sales', {
        method: 'GET',
        params,
      });
      const list = raw?.sales ?? raw?.items ?? [];
      return {
        items: list,
        pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
      };
    } catch (err) {
      if (isMockMode()) {
        try {
          const mockRaw = await handleMockRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination?: PaginationMeta }>('seller/sales', {
            method: 'GET',
            params,
          });
          const list = mockRaw?.sales ?? mockRaw?.items ?? [];
          return {
            items: list,
            pagination: mockRaw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
          };
        } catch {
          return {
            items: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
          };
        }
      }
      throw err;
    }
  },

  async getSale(id: string): Promise<{ sale: SaleItem }> {
    try {
      return await apiRequest<{ sale: SaleItem }>(`seller/sales/${id}`, {
        method: 'GET',
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sale: SaleItem }>(`seller/sales/${id}`, {
          method: 'GET',
        });
      }
      throw err;
    }
  },

  async updateSale(id: string, payload: UpdateSalePayload): Promise<{ sale: SaleItem }> {
    const cleanPayload = sanitizeUpdateSalePayload(payload);
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(cleanPayload),
    });
  },

  async collectPayment(saleId: string, payload: CollectPaymentPayload): Promise<{ sale: SaleItem }> {
    const mode = (payload.mode || payload.paymentMode || 'CASH') as 'CASH' | 'BANK';
    const body: Record<string, any> = {
      mode,
    };
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${saleId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  async markPaymentSent(
    saleId: string,
    payload: { remark?: string; sentAt?: string }
  ): Promise<{ sale: SaleItem }> {
    const body: Record<string, string> = {};
    if (payload.remark?.trim()) body.remark = payload.remark.trim();
    if (payload.sentAt?.trim()) body.sentAt = payload.sentAt.trim();
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${saleId}/payment-sent`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  getInvoicePdfUrl(id: string, download = true): string {
    return `${API_BASE_URL}/invoices/${id}/pdf?download=${download ? 'true' : 'false'}`;
  },

  // ----------------------------------------------------
  // Incentives
  // ----------------------------------------------------
  async getIncentives(): Promise<SellerIncentiveData> {
    const raw = await apiRequest<any>('seller/incentives', {
      method: 'GET',
    });
    const summary = raw?.summary || raw;
    const currentMonth = summary?.currentMonth ?? raw?.months?.[0];
    const resolvedRatePaise =
      raw?.effectiveRatePaise ??
      raw?.ratePerPacketPaise ??
      summary?.effectiveRatePaise ??
      summary?.ratePerPacketPaise ??
      100;
    const totalEarnedPaise =
      summary?.adjustedEntitlementPaise ??
      summary?.earnedPaise ??
      summary?.salesIncentivePaise ??
      summary?.totalIncentivePaise ??
      raw?.totalEarnedPaise ??
      0;
    const currentMonthEarnedPaise =
      currentMonth?.earnedPaise ??
      currentMonth?.salesIncentivePaise ??
      currentMonth?.adjustedEntitlementPaise ??
      0;
    const totalPacketsSold =
      summary?.confirmedPackets ??
      summary?.totalPacketsSold ??
      summary?.totalConfirmedPackets ??
      raw?.totalPacketsSold ??
      0;
    const totalPacketsSoldMonth =
      currentMonth?.confirmedPackets ??
      0;
    const pendingPayoutPaise = summary?.outstandingPaise ?? raw?.pendingPayoutPaise ?? 0;
    const totalPaidPaise = summary?.totalPaidPaise ?? summary?.paidPaise ?? raw?.totalPaidPaise ?? 0;
    const status = summary?.status ?? (totalPaidPaise > 0 && pendingPayoutPaise === 0 ? 'PAID' : pendingPayoutPaise > 0 ? 'PENDING' : 'UNPAID');

    const history = (raw?.months && Array.isArray(raw.months) && raw.months.length > 0)
      ? raw.months.map((m: any) => {
          const monthEarned = m.adjustedEntitlementPaise ?? m.salesIncentivePaise ?? m.earnedPaise ?? 0;
          const monthPaid = m.allocatedPaidPaise ?? m.paidPaise ?? 0;
          return {
            month: m.label || `${m.month}/${m.year}`,
            packetsSold: m.confirmedPackets || 0,
            earnedPaise: monthEarned,
            ratePerPacketPaise:
              m.ratePerPacketPaise ??
              (m.confirmedPackets > 0 ? Math.round(monthEarned / m.confirmedPackets) : resolvedRatePaise),
            status:
              m.outstandingPaise === 0 && monthEarned > 0
                ? 'PAID'
                : monthPaid > 0
                  ? 'PARTIALLY_PAID'
                  : 'PENDING',
          };
        })
      : (raw?.history || []);

    return {
      ...raw,
      totalEarnedPaise,
      totalPacketsSold,
      salesIncentivePaise: summary?.salesIncentivePaise ?? totalEarnedPaise,
      adjustedEntitlementPaise: summary?.adjustedEntitlementPaise ?? totalEarnedPaise,
      additionsPaise: summary?.additionsPaise ?? 0,
      deductionsPaise: summary?.deductionsPaise ?? 0,
      currentMonthEarnedPaise,
      totalPacketsSoldMonth,
      ratePerPacketPaise: resolvedRatePaise,
      effectiveRatePaise: resolvedRatePaise,
      pendingPayoutPaise,
      totalPaidPaise,
      status,
      history,
      items: raw?.items || [],
      adjustments: raw?.adjustments || [],
      payouts: raw?.payouts || [],
      months: raw?.months || [],
    };
  },

  // ----------------------------------------------------
  // Duty Shifts & Visit Tracking
  // ----------------------------------------------------
  async getCurrentShift(): Promise<{ shift: Shift | null }> {
    try {
      return await apiRequest<{ shift: Shift | null }>('seller/shifts/current', {
        method: 'GET',
        cachePolicy: 'no-cache',
        skipCache: true,
        skipRateLimit: true,
      });
    } catch {
      return { shift: null };
    }
  },

  async startShift(payload: StartShiftPayload): Promise<{ shift: Shift }> {
    const lat = Number(payload.latitude ?? payload.startLatitude ?? 0);
    const lng = Number(payload.longitude ?? payload.startLongitude ?? 0);

    // If an active shift is already active on the server, return it directly to avoid duplicate start 500 error
    try {
      const current = await sellerApi.getCurrentShift();
      if (current?.shift && current.shift.status === 'ACTIVE' && !current.shift.endTime) {
        return { shift: current.shift };
      }
    } catch {
      // Ignore and proceed to startShift
    }

    // Backend startShiftSchema is strictly: { latitude, longitude, address? }
    // Unrecognized keys trigger Zod validation error or HTTP 500 on strict backends.
    const body: Record<string, any> = {
      latitude: lat,
      longitude: lng,
    };
    if (payload.address) {
      body.address = payload.address.slice(0, 500);
    }

    try {
      const res = await apiRequest<{ shift: Shift }>('seller/shifts/start', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const shift = res?.shift;
      if (shift && shift.sellerId) {
        draftStorage.saveActiveShift(shift.sellerId, shift).catch(() => {});
      }
      return res;
    } catch (err: any) {
      console.warn('[sellerApi.startShift] Server rejected shift start, falling back to resilient local active shift:', err?.message);
      // Fallback: create resilient local active shift so managers and sellers are not blocked
      const localShift: Shift = {
        id: `shift_local_${Date.now()}`,
        sellerId: (payload as any).sellerId || 'local_user',
        status: 'ACTIVE',
        startTime: new Date().toISOString(),
        startLatitude: lat,
        startLongitude: lng,
        startOdometerKm: payload.startOdometerKm ?? 0,
        startAddress: payload.address,
      };
      draftStorage.saveActiveShift(localShift.sellerId, localShift).catch(() => {});
      return { shift: localShift };
    }
  },

  async checkIn(payload: CheckInPayload): Promise<{ visit: ShiftVisit }> {
    // Backend checkInSchema is z.strictObject({ latitude, longitude, shopName, customerId?, notes? })
    // Never include shiftId in request body; strict Zod validation on backend rejects unrecognized keys.
    const body: Record<string, any> = {
      latitude: Number(payload.latitude ?? 0),
      longitude: Number(payload.longitude ?? 0),
      shopName: (payload.shopName || (payload as any).customer?.shopName || 'Retail Customer').slice(0, 200),
    };
    if (payload.customerId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.customerId)) {
      body.customerId = payload.customerId;
    }
    const notesText = payload.notes || payload.summary;
    if (notesText) {
      body.notes = notesText.slice(0, 1000);
    }

    if (payload.shiftId?.startsWith('shift_local_')) {
      return {
        visit: {
          id: `visit_local_${Date.now()}`,
          customerId: payload.customerId || '',
          shopName: body.shopName,
          checkInTime: new Date().toISOString(),
          latitude: body.latitude,
          longitude: body.longitude,
          notes: body.notes,
        } as ShiftVisit,
      };
    }

    try {
      return await apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-in', {
        method: 'POST',
        body: JSON.stringify(body),
        skipRateLimit: true,
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 0;
      const isClientRejection = status >= 400 && status < 500;
      if (isClientRejection) {
        throw err;
      }
      console.warn('[sellerApi.checkIn] Network/server unavailable, recording local visit:', err?.message);
      return {
        visit: {
          id: `visit_local_${Date.now()}`,
          customerId: payload.customerId || '',
          shopName: body.shopName,
          checkInTime: new Date().toISOString(),
          latitude: body.latitude,
          longitude: body.longitude,
          notes: body.notes,
        } as ShiftVisit,
      };
    }
  },

  async checkOut(payload: CheckOutPayload): Promise<{ visit: ShiftVisit }> {
    if (payload.visitId && payload.visitId.startsWith('visit_local_')) {
      const durationFallback =
        typeof (payload as any).durationMins === 'number' && (payload as any).durationMins >= 1
          ? (payload as any).durationMins
          : 1;
      return {
        visit: {
          id: payload.visitId,
          checkOutTime: new Date().toISOString(),
          durationMins: durationFallback,
          notes: payload.notes,
          saleDone: payload.saleDone,
          customerFeedback: payload.customerFeedback,
          saleId: payload.saleId,
        } as ShiftVisit,
      };
    }

    // Backend checkOutSchema is z.strictObject({ visitId, latitude, longitude, notes?, saleDone?, customerFeedback?, saleId? })
    const body: Record<string, any> = {
      visitId: payload.visitId,
      latitude: Number(payload.latitude ?? 0),
      longitude: Number(payload.longitude ?? 0),
    };
    const notesText = payload.notes || payload.summary;
    if (notesText) {
      body.notes = notesText.slice(0, 1000);
    }
    if (payload.saleDone !== undefined) {
      body.saleDone = payload.saleDone;
    }
    if (payload.customerFeedback) {
      body.customerFeedback = payload.customerFeedback.slice(0, 1000);
    }
    if (payload.saleId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.saleId)) {
      body.saleId = payload.saleId;
    }

    try {
      return await apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-out', {
        method: 'POST',
        body: JSON.stringify(body),
        skipRateLimit: true,
      });
    } catch (err: any) {
      const status = typeof err?.status === 'number' ? err.status : 0;
      const isClientRejection = status >= 400 && status < 500;
      if (isClientRejection) {
        throw err;
      }
      console.warn('[sellerApi.checkOut] Network/server unavailable, recording local visit completion:', err?.message);
      return {
        visit: {
          id: payload.visitId,
          checkOutTime: new Date().toISOString(),
          durationMins: 1,
          notes: body.notes,
          saleDone: payload.saleDone,
          customerFeedback: payload.customerFeedback,
          saleId: payload.saleId,
        } as ShiftVisit,
      };
    }
  },

  async endShift(payload: EndShiftPayload): Promise<{ shift: Shift }> {
    const lat = Number(payload.latitude ?? payload.endLatitude ?? 0);
    const lng = Number(payload.longitude ?? payload.endLongitude ?? 0);
    const endNotesText = payload.notes || payload.remarks;

    // If shift was local, finish locally
    if (payload.shiftId && payload.shiftId.startsWith('shift_local_')) {
      const closedShift: Shift = {
        id: payload.shiftId,
        sellerId: 'local_user',
        status: 'COMPLETED',
        startTime: new Date().toISOString(),
        startOdometerKm: 0,
        endTime: new Date().toISOString(),
        endLatitude: lat,
        endLongitude: lng,
        endOdometerKm: payload.endOdometerKm,
        notes: endNotesText,
      };
      return { shift: closedShift };
    }

    // Backend endShiftSchema allows: latitude, longitude, address, notes
    const body: Record<string, any> = {
      latitude: lat,
      longitude: lng,
    };
    if (payload.address) {
      body.address = payload.address.slice(0, 500);
    }
    if (endNotesText) {
      body.notes = endNotesText.slice(0, 1000);
    }

    try {
      return await apiRequest<{ shift: Shift }>('seller/shifts/end', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      console.warn('[sellerApi.endShift] Server rejected shift end, completing local shift:', err?.message);
      const closedShift: Shift = {
        id: payload.shiftId || `shift_local_${Date.now()}`,
        sellerId: 'local_user',
        status: 'COMPLETED',
        startTime: new Date().toISOString(),
        startOdometerKm: 0,
        endTime: new Date().toISOString(),
        endLatitude: lat,
        endLongitude: lng,
        endOdometerKm: payload.endOdometerKm,
        notes: endNotesText,
      };
      return { shift: closedShift };
    }
  },

  async getShiftHistory(params?: {
    page?: number;
    pageSize?: number;
    from?: string;
    to?: string;
    status?: string;
  }): Promise<{ items: Shift[]; pagination: PaginationMeta; summary?: import('./types').ShiftSummary }> {
    try {
      const raw = await apiRequest<{
        items?: Shift[];
        shifts?: Shift[];
        pagination: PaginationMeta;
        summary?: import('./types').ShiftSummary;
      }>(
        'seller/shifts/history',
        {
          method: 'GET',
          params,
          cachePolicy: 'no-cache',
          skipCache: true,
          skipRateLimit: true,
        }
      );
      const list = raw?.items ?? raw?.shifts ?? [];
      return {
        items: list,
        summary: raw?.summary,
        pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
      };
    } catch {
      return {
        items: [],
        pagination: { page: 1, pageSize: params?.pageSize || 20, total: 0, totalPages: 1 },
      };
    }
  },
};
