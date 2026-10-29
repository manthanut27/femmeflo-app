import { apiRequest, API_BASE_URL, tokenStorage, isMockMode } from './client';
import type {
  CheckInPayload,
  CheckOutPayload,
  CollectPaymentPayload,
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
} from './types';

export const sellerApi = {
  // ----------------------------------------------------
  // Dashboard
  // ----------------------------------------------------
  async getDashboard(): Promise<SellerDashboardData> {
    return apiRequest<SellerDashboardData>('seller/dashboard', {
      method: 'GET',
    });
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
    const list = raw?.customers ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getCustomer(id: string): Promise<{ customer: CustomerItem }> {
    return apiRequest<{ customer: CustomerItem }>(`seller/customers/${id}`, {
      method: 'GET',
    });
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<{ customer: CustomerItem }> {
    return apiRequest<{ customer: CustomerItem }>('seller/customers', {
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
    const formData = new FormData();
    const filename = fileUri.split('/').pop() || 'photo.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('photo', {
      uri: fileUri,
      name: filename,
      type,
    } as any);

    return apiRequest<{ photoUrl: string }>(`seller/customers/${customerId}/photo`, {
      method: 'POST',
      body: formData,
    });
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
    return apiRequest<{ sale: SaleItem }>('seller/sales', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listSales(params?: {
    page?: number;
    pageSize?: number;
    status?: string;
    paymentMode?: string;
    customerId?: string;
    search?: string;
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

  async collectPayment(saleId: string, payload: CollectPaymentPayload): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`seller/sales/${saleId}/payment`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async getInvoicePdfUrl(id: string, download = true): Promise<string> {
    const token = await tokenStorage.getToken();
    return `${API_BASE_URL}/invoices/${id}/pdf?download=${download ? 'true' : 'false'}${token ? `&token=${encodeURIComponent(token)}` : ''}`;
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
    return apiRequest<{ shift: Shift }>('seller/shifts/start', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async checkIn(payload: CheckInPayload): Promise<{ visit: ShiftVisit }> {
    return apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-in', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async checkOut(payload: CheckOutPayload): Promise<{ visit: ShiftVisit }> {
    return apiRequest<{ visit: ShiftVisit }>('seller/shifts/check-out', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async endShift(payload: EndShiftPayload): Promise<{ shift: Shift }> {
    return apiRequest<{ shift: Shift }>('seller/shifts/end', {
      method: 'POST',
      body: JSON.stringify(payload),
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
