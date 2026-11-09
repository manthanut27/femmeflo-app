import { apiRequest, API_BASE_URL, isMockMode, uploadFileMultipart } from './client';
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
  UpdateSalePayload,
} from './types';

import { sanitizeUpdateSalePayload } from '../utils/saleSanitizer';

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
    const salesPaise =
      raw?.todaySalesPaise ??
      raw?.todaySalesAmountPaise ??
      (metrics?.soldPackets !== undefined ? metrics.soldPackets * 3500 : 0);

    return {
      todaySalesPaise: salesPaise,
      todaySalesAmountPaise: salesPaise,
      todayOrdersCount: raw?.todayOrdersCount ?? (Array.isArray(raw?.recentSales) ? raw.recentSales.length : 0),
      todayPacketsSold: soldPackets,
      monthSalesPaise: raw?.monthSalesPaise ?? salesPaise,
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
    const list = (raw?.customers ?? raw?.items ?? []).map((c) => ({
      ...c,
      photoUrl: c.photoUrl || (c as any).photoPath || null,
    }));
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
        ...res.customer,
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

    const body: Record<string, any> = {
      shopName: payload.shopName.trim(),
      contactName,
      phone,
      categoryId: payload.categoryId,
      address: payload.address,
      pincode: payload.pincode,
      state: payload.state,
      district: payload.district,
      village: payload.village || 'Default',
    };
    if (payload.email) body.email = payload.email.trim();
    if (payload.latitude != null) body.latitude = payload.latitude;
    if (payload.longitude != null) body.longitude = payload.longitude;
    if (payload.accuracy != null) body.accuracy = payload.accuracy;
    if (noPhotoReason) body.noPhotoReason = noPhotoReason;
    if (payload.photoPath) body.photoPath = payload.photoPath;

    return apiRequest<{ customer: CustomerItem }>('seller/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async createBulkCustomers(payload: CreateBulkCustomersPayload): Promise<BulkCustomerResponse> {
    return apiRequest<BulkCustomerResponse>('seller/customers/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
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

    // Server createSaleSchema is z.strictObject({ customerId, items, paymentMode, requestKey })
    const body: Record<string, any> = {
      customerId: payload.customerId,
      items: payload.items,
      paymentMode: payload.paymentMode,
    };
    if (key) {
      body.requestKey = key;
    }
    if (payload.paymentReference) {
      body.paymentReference = payload.paymentReference;
    }
    if (payload.customerFeedback) {
      body.customerFeedback = payload.customerFeedback;
    }

    return apiRequest<{ sale: SaleItem }>('seller/sales', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
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
    const raw = await apiRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination: PaginationMeta }>('seller/sales', {
      method: 'GET',
      params,
    });
    const list = raw?.sales ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getSale(id: string): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${id}`, {
      method: 'GET',
    });
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

  getInvoicePdfUrl(id: string, download = true): string {
    return `${API_BASE_URL}/invoices/${id}/pdf?download=${download ? 'true' : 'false'}`;
  },

  // ----------------------------------------------------
  // Incentives
  // ----------------------------------------------------
  async getIncentives(): Promise<SellerIncentiveData> {
    return apiRequest<SellerIncentiveData>('seller/incentives', {
      method: 'GET',
    });
  },

  // ----------------------------------------------------
  // Duty Shifts & Visit Tracking
  // ----------------------------------------------------
  async getCurrentShift(): Promise<{ shift: Shift | null }> {
    try {
      return await apiRequest<{ shift: Shift | null }>('seller/shifts/current', {
        method: 'GET',
      });
    } catch {
      return { shift: null };
    }
  },

  async startShift(payload: StartShiftPayload): Promise<{ shift: Shift }> {
    const lat = Number(payload.latitude ?? payload.startLatitude ?? 0);
    const lng = Number(payload.longitude ?? payload.startLongitude ?? 0);

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
      return await apiRequest<{ shift: Shift }>('seller/shifts/start', {
        method: 'POST',
        body: JSON.stringify(body),
      });
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
      return { shift: localShift };
    }
  },

  async checkIn(payload: CheckInPayload): Promise<{ visit: ShiftVisit }> {
    // Backend checkInSchema is z.strictObject({ latitude, longitude, shopName, customerId?, notes?, shiftId? })
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
    if (payload.shiftId && !payload.shiftId.startsWith('shift_local_') && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.shiftId)) {
      body.shiftId = payload.shiftId;
    }

    try {
      return await apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-in', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      console.warn('[sellerApi.checkIn] Server rejected check-in, recording local visit:', err?.message);
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
      return {
        visit: {
          id: payload.visitId,
          checkOutTime: new Date().toISOString(),
          durationMins: 15,
          notes: payload.notes,
          saleDone: payload.saleDone,
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
      });
    } catch (err: any) {
      console.warn('[sellerApi.checkOut] Server rejected check-out, recording local visit completion:', err?.message);
      return {
        visit: {
          id: payload.visitId,
          checkOutTime: new Date().toISOString(),
          durationMins: 15,
          notes: body.notes,
          saleDone: payload.saleDone,
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

  async getShiftHistory(params?: { page?: number; pageSize?: number }): Promise<{ items: Shift[]; pagination: PaginationMeta }> {
    try {
      const raw = await apiRequest<{ items?: Shift[]; shifts?: Shift[]; pagination: PaginationMeta }>(
        'seller/shifts/history',
        {
          method: 'GET',
          params,
        }
      );
      const list = raw?.items ?? raw?.shifts ?? [];
      return {
        items: list,
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
