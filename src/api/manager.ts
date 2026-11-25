import { apiRequest, uploadFileMultipart, API_BASE_URL, isMockMode } from './client';
import { handleMockRequest } from './mockService';
import { sanitizeUpdateSalePayload } from '../utils/saleSanitizer';
import { sanitizeIndiaCoordinates } from '../utils/geoValidation';
import type {
  BulkCustomerResponse,
  CreateBulkCustomersPayload,
  CreateCustomerPayload,
  CustomerItem,
  ManagerDashboardData,
  ManagerIncentiveData,
  ManagerInventoryData,
  PaginationMeta,
  ProductItem,
  PublicUser,
  SaleItem,
  Shift,
  UpdateCustomerPayload,
  UpdateSalePayload,
} from './types';

export interface ManagerSellerItem extends PublicUser {
  sellerId?: string;
  customersCount?: number;
  totalSalesPaise?: number;
}

export const managerApi = {
  // ----------------------------------------------------
  // Profile & Settings
  // ----------------------------------------------------
  async updateProfile(payload: Partial<PublicUser>): Promise<{ user: PublicUser }> {
    return apiRequest<{ user: PublicUser }>('manager/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
  // ----------------------------------------------------
  // Dashboard
  // ----------------------------------------------------
  async getDashboard(): Promise<ManagerDashboardData> {
    const raw = await apiRequest<any>('manager/dashboard', {
      method: 'GET',
    });
    if (raw && raw.metrics) {
      return {
        totalSellers: raw.totalSellers ?? raw.metrics.totalSellers ?? 0,
        activeSellersCount: raw.activeSellersCount ?? raw.metrics.activeSellersCount ?? raw.metrics.totalSellers ?? 0,
        monthlyRevenuePaise: raw.monthlyRevenuePaise ?? raw.metrics.totalEarningsPaise ?? 0,
        monthlyPacketsSold: raw.monthlyPacketsSold ?? raw.metrics.totalPacketsSold ?? 0,
        totalCustomers: raw.totalCustomers ?? raw.metrics.totalCustomers ?? 0,
        metrics: raw.metrics,
      };
    }
    return raw;
  },

  // ----------------------------------------------------
  // Sellers in Territory
  // ----------------------------------------------------
  async listSellers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    active?: boolean;
  }): Promise<{ items: ManagerSellerItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ sellers?: ManagerSellerItem[]; items?: ManagerSellerItem[]; pagination: PaginationMeta }>(
      'manager/sellers',
      {
        method: 'GET',
        params,
      }
    );
    const list = raw?.sellers ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getSeller(id: string): Promise<{ seller: ManagerSellerItem }> {
    const raw = await apiRequest<{ seller?: ManagerSellerItem; user?: ManagerSellerItem }>(`manager/sellers/${id}`, {
      method: 'GET',
    });
    return { seller: (raw?.seller ?? raw?.user)! };
  },

  

  async createSeller(payload: {
    name: string;
    email?: string;
    password?: string;
    phone?: string;
    state?: string;
    district?: string;
    village?: string;
    dailyTarget?: number;
    shiftTiming?: string;
    designation?: string;
    employeeCode?: string;
    active?: boolean;
    alternatePhone?: string;
    aadhaarNumber?: string;
    drivingLicenseNumber?: string;
    qualification?: string;
    address?: string;
    pincode?: string;
  }): Promise<{ seller: ManagerSellerItem }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const body: Record<string, any> = {
      name: payload.name.trim(),
      phone,
      password: payload.password?.trim() || '',
    };
    if (payload.email?.trim()) body.email = payload.email.trim();
    if (payload.state?.trim()) body.state = payload.state.trim();
    if (payload.district?.trim()) body.district = payload.district.trim();
    if (payload.village?.trim()) body.village = payload.village.trim();
    if (payload.dailyTarget) body.dailyTarget = payload.dailyTarget;
    if (payload.shiftTiming?.trim()) body.shiftTiming = payload.shiftTiming.trim();
    if (payload.designation?.trim()) body.designation = payload.designation.trim();
    if (payload.employeeCode?.trim()) body.employeeCode = payload.employeeCode.trim();
    if (payload.active !== undefined) body.active = payload.active;
    if (payload.alternatePhone?.trim()) body.alternatePhone = payload.alternatePhone.trim();
    if (payload.address?.trim()) body.address = payload.address.trim();
    if (payload.pincode?.trim()) body.pincode = payload.pincode.trim();

    const raw = await apiRequest<{ seller?: ManagerSellerItem; user?: ManagerSellerItem }>('manager/sellers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { seller: (raw?.seller ?? raw?.user)! };
  },

  async updateSeller(
    sellerId: string,
    payload: Partial<PublicUser> & { dailyTarget?: number }
  ): Promise<{ seller: ManagerSellerItem }> {
    const raw = await apiRequest<{ seller?: ManagerSellerItem; user?: ManagerSellerItem }>(
      `manager/sellers/${sellerId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }
    );
    return { seller: (raw?.seller ?? raw?.user)! };
  },

  // ----------------------------------------------------
  // Customers in Territory
  // ----------------------------------------------------
  async listCustomers(params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    categoryId?: string;
    sellerId?: string;
    active?: boolean;
    state?: string;
    district?: string;
  }): Promise<{ items: CustomerItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ customers?: CustomerItem[]; items?: CustomerItem[]; pagination: PaginationMeta }>(
      'manager/customers',
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
    const res = await apiRequest<{ customer: CustomerItem }>(`manager/customers/${id}`, {
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

    const coords = sanitizeIndiaCoordinates(payload.latitude, payload.longitude);

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
      latitude: coords.latitude,
      longitude: coords.longitude,
    };
    if (payload.email) body.email = payload.email.trim();
    if (payload.sellerId) body.sellerId = payload.sellerId;
    if (payload.accuracy != null) body.accuracy = payload.accuracy;
    if (noPhotoReason) body.noPhotoReason = noPhotoReason;
    if (payload.photoPath) body.photoPath = payload.photoPath;

    return apiRequest<{ customer: CustomerItem }>('manager/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async updateCustomer(id: string, payload: UpdateCustomerPayload): Promise<{ customer: CustomerItem }> {
    const body: Record<string, any> = { ...payload };
    if (payload.latitude != null || payload.longitude != null) {
      const coords = sanitizeIndiaCoordinates(payload.latitude, payload.longitude);
      body.latitude = coords.latitude;
      body.longitude = coords.longitude;
    }
    const res = await apiRequest<{ customer: CustomerItem }>(`manager/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (res?.customer) {
      res.customer = {
        ...res.customer,
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
    return apiRequest<BulkCustomerResponse>('manager/customers/bulk', {
      method: 'POST',
      body: JSON.stringify({ ...payload, customers: sanitizedCustomers }),
    });
  },

  async uploadCustomerPhoto(customerId: string, fileUri: string): Promise<{ photoUrl: string }> {
    return uploadFileMultipart<{ photoUrl: string }>(`manager/customers/${customerId}/photo`, fileUri, 'photo');
  },

  // ----------------------------------------------------
  // Sales in Territory
  // ----------------------------------------------------
  async listSales(params?: {
    page?: number;
    pageSize?: number;
    sellerId?: string;
    status?: string;
    paymentMode?: string;
    search?: string;
  }): Promise<{ items: SaleItem[]; pagination: PaginationMeta }> {
    try {
      const raw = await apiRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination: PaginationMeta }>(
        'manager/sales',
        {
          method: 'GET',
          params,
        }
      );
      const list = raw?.sales ?? raw?.items ?? [];
      return {
        items: list,
        pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
      };
    } catch (err: any) {
      // If manager lacks approve_sales/SALES_READ or backend returns 403 Permission denied,
      // fallback to seller/sales so the dual-role manager can access their own recorded field sales
      if (
        err?.status === 403 ||
        err?.status === 401 ||
        err?.message?.toLowerCase().includes('permission denied')
      ) {
        try {
          const sellerRes = await apiRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination: PaginationMeta }>(
            'seller/sales',
            {
              method: 'GET',
              params: {
                page: params?.page,
                pageSize: params?.pageSize,
                status: params?.status,
                paymentMode: params?.paymentMode,
                search: params?.search,
              },
            }
          );
          const list = sellerRes?.sales ?? sellerRes?.items ?? [];
          return {
            items: list,
            pagination: sellerRes?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
          };
        } catch {
          return {
            items: [],
            pagination: { page: 1, pageSize: params?.pageSize || 20, total: 0, totalPages: 1 },
          };
        }
      }

      // Never inject hardcoded mock sales (e.g. Pooja Sharma / 28 Oct) into live backend views
      if (isMockMode()) {
        try {
          const mockRaw = await handleMockRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination?: PaginationMeta }>(
            'manager/sales',
            {
              method: 'GET',
              params,
            }
          );
          const list = mockRaw?.sales ?? mockRaw?.items ?? [];
          return {
            items: list,
            pagination: mockRaw?.pagination ?? { page: 1, pageSize: params?.pageSize || 20, total: list.length, totalPages: 1 },
          };
        } catch {
          return {
            items: [],
            pagination: { page: 1, pageSize: params?.pageSize || 20, total: 0, totalPages: 1 },
          };
        }
      }

      throw err;
    }
  },

  async updateSale(id: string, payload: UpdateSalePayload): Promise<{ sale: SaleItem }> {
    const cleanPayload = sanitizeUpdateSalePayload(payload);
    try {
      return await apiRequest<{ sale: SaleItem }>(`manager/sales/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(cleanPayload),
      });
    } catch {
      return await apiRequest<{ sale: SaleItem }>(`seller/sales/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(cleanPayload),
      });
    }
  },

  // ----------------------------------------------------
  // Inventory in Territory
  // ----------------------------------------------------
  async getInventory(): Promise<ManagerInventoryData> {
    try {
      return await apiRequest<ManagerInventoryData>('manager/inventory', {
        method: 'GET',
      });
    } catch {
      return {
        summary: { totalSellers: 0, totalAssigned: 0, totalSold: 0, totalRemaining: 0 },
        sellers: [],
      };
    }
  },

  // ----------------------------------------------------
  // Shifts in Territory
  // ----------------------------------------------------
  async listShifts(params?: {
    page?: number;
    pageSize?: number;
    from?: string;
    to?: string;
    sellerId?: string;
    status?: string;
  }): Promise<{ items: Shift[]; pagination: PaginationMeta }> {
    try {
      const raw = await apiRequest<{ items?: Shift[]; shifts?: Shift[]; pagination: PaginationMeta }>(
        'manager/shifts',
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

  // ----------------------------------------------------
  // Incentives in Territory
  // ----------------------------------------------------
  async getIncentives(): Promise<ManagerIncentiveData> {
    return apiRequest<ManagerIncentiveData>('manager/incentives', {
      method: 'GET',
    });
  },

  async listProducts(): Promise<{ items: ProductItem[] }> {
    return apiRequest<{ items: ProductItem[] }>('manager/products', {
      method: 'GET',
    });
  },

  // ----------------------------------------------------
  // Tax Invoices in Territory
  // ----------------------------------------------------
  getInvoicePdfUrl(id: string, download = true): string {
    return `${API_BASE_URL}/invoices/${id}/pdf?download=${download ? 'true' : 'false'}`;
  },

  async downloadInvoicePdf(id: string, download = false): Promise<Blob> {
    return apiRequest<Blob>(`invoices/${id}/pdf?download=${download ? 'true' : 'false'}`, {
      method: 'GET',
    });
  },
};
