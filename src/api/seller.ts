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

export const sellerApi = {
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
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async collectPayment(saleId: string, payload: CollectPaymentPayload): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${saleId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
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
    return apiRequest<{ shift: Shift | null }>('seller/shifts/current', {
      method: 'GET',
    });
  },

  async startShift(payload: StartShiftPayload): Promise<{ shift: Shift }> {
    const startKm = payload.startOdometerKm ?? (payload as any).odometerKm ?? 0;
    const lat = payload.latitude ?? payload.startLatitude ?? 0;
    const lng = payload.longitude ?? payload.startLongitude ?? 0;

    const body: Record<string, any> = {
      startOdometerKm: startKm,
      odometerKm: startKm,
      startLatitude: lat,
      startLongitude: lng,
      latitude: lat,
      longitude: lng,
    };
    if (payload.address) body.address = payload.address;
    if (payload.notes) body.notes = payload.notes;
    if (payload.faceVerified !== undefined) body.faceVerified = payload.faceVerified;
    if (payload.facePhoto) {
      body.facePhoto = payload.facePhoto.length > 50000
        ? `verified_selfie_start_${Date.now()}`
        : payload.facePhoto;
    }
    if (payload.faceConfidence !== undefined) body.faceConfidence = payload.faceConfidence;
    if (payload.faceMethod) body.faceMethod = payload.faceMethod;
    return apiRequest<{ shift: Shift }>('seller/shifts/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async checkIn(payload: CheckInPayload): Promise<{ visit: ShiftVisit }> {
    const body: Record<string, any> = {
      latitude: payload.latitude ?? 0,
      longitude: payload.longitude ?? 0,
      shopName: payload.shopName || (payload as any).customer?.shopName || 'Retail Customer',
    };
    if (payload.customerId) body.customerId = payload.customerId;
    if (payload.notes || payload.summary) body.notes = payload.notes || payload.summary;
    return apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-in', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async checkOut(payload: CheckOutPayload): Promise<{ visit: ShiftVisit }> {
    const body: Record<string, any> = {
      visitId: payload.visitId,
      latitude: payload.latitude ?? 0,
      longitude: payload.longitude ?? 0,
    };
    if (payload.notes || payload.summary) body.notes = payload.notes || payload.summary;
    if (payload.saleDone !== undefined) body.saleDone = payload.saleDone;
    if (payload.customerFeedback) body.customerFeedback = payload.customerFeedback;
    if (payload.saleId) body.saleId = payload.saleId;
    return apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-out', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async endShift(payload: EndShiftPayload): Promise<{ shift: Shift }> {
    const endKm = payload.endOdometerKm ?? (payload as any).odometerKm ?? 0;
    const lat = payload.latitude ?? payload.endLatitude ?? 0;
    const lng = payload.longitude ?? payload.endLongitude ?? 0;

    const body: Record<string, any> = {
      endOdometerKm: endKm,
      odometerKm: endKm,
      endLatitude: lat,
      endLongitude: lng,
      latitude: lat,
      longitude: lng,
    };
    if (payload.address) body.address = payload.address;
    if (payload.notes || payload.remarks) {
      body.notes = payload.notes || payload.remarks;
      body.remarks = payload.notes || payload.remarks;
    }
    if (payload.faceVerified !== undefined) body.faceVerified = payload.faceVerified;
    if (payload.facePhoto) {
      body.facePhoto = payload.facePhoto.length > 50000
        ? `verified_selfie_end_${Date.now()}`
        : payload.facePhoto;
    }
    if (payload.faceConfidence !== undefined) body.faceConfidence = payload.faceConfidence;
    if (payload.faceMethod) body.faceMethod = payload.faceMethod;
    return apiRequest<{ shift: Shift }>('seller/shifts/end', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getShiftHistory(params?: { page?: number; pageSize?: number }): Promise<{ items: Shift[]; pagination: PaginationMeta }> {
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
  },
};
