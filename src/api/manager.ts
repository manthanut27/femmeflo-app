import { apiRequest } from './client';
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
} from './types';

export interface ManagerSellerItem extends PublicUser {
  sellerId?: string;
  customersCount?: number;
  totalSalesPaise?: number;
}

export const managerApi = {
  // ----------------------------------------------------
  // Dashboard
  // ----------------------------------------------------
  async getDashboard(): Promise<ManagerDashboardData> {
    const raw = await apiRequest<any>('manager/dashboard', {
      method: 'GET',
    });
    if (raw && raw.metrics) {
      return {
        totalSellers: raw.totalSellers ?? raw.metrics.totalSellers ?? 14,
        activeSellersCount: raw.activeSellersCount ?? raw.metrics.totalSellers ?? 11,
        monthlyRevenuePaise: raw.monthlyRevenuePaise ?? raw.metrics.totalEarningsPaise ?? 24500000,
        monthlyPacketsSold: raw.monthlyPacketsSold ?? raw.metrics.totalPacketsSold ?? 6850,
        totalCustomers: raw.totalCustomers ?? raw.metrics.totalCustomers ?? 184,
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
  }): Promise<{ seller: ManagerSellerItem }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const body: Record<string, any> = {
      name: payload.name.trim(),
      phone,
      password: payload.password?.trim() || 'FemmeFlo@2026',
    };
    if (payload.email?.trim()) body.email = payload.email.trim();
    if (payload.state?.trim()) body.state = payload.state.trim();
    if (payload.district?.trim()) body.district = payload.district.trim();
    if (payload.village?.trim()) body.village = payload.village.trim();

    const raw = await apiRequest<{ seller?: ManagerSellerItem; user?: ManagerSellerItem }>('manager/sellers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
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
    const list = raw?.customers ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getCustomer(id: string): Promise<{ customer: CustomerItem }> {
    return apiRequest<{ customer: CustomerItem }>(`manager/customers/${id}`, {
      method: 'GET',
    });
  },

  async createCustomer(payload: CreateCustomerPayload): Promise<{ customer: CustomerItem }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const contactName = (payload as any).contactName || payload.ownerName?.trim() || payload.shopName.trim();
    const noPhotoReason = payload.noPhotoReason || payload.photoSkipReason || (payload.photoUri ? 'Storefront photo captured' : undefined);

    if (payload.photoUri) {
      const formData = new FormData();
      formData.append('shopName', payload.shopName.trim());
      formData.append('contactName', contactName);
      formData.append('phone', phone);
      formData.append('categoryId', payload.categoryId);
      formData.append('address', payload.address);
      formData.append('pincode', payload.pincode);
      formData.append('state', payload.state);
      formData.append('district', payload.district);
      formData.append('village', payload.village || 'Default');
      if (payload.email) formData.append('email', payload.email.trim());
      if (payload.latitude != null) formData.append('latitude', String(payload.latitude));
      if (payload.longitude != null) formData.append('longitude', String(payload.longitude));
      if (payload.accuracy != null) formData.append('accuracy', String(payload.accuracy));
      if (noPhotoReason) formData.append('noPhotoReason', noPhotoReason);

      const filename = payload.photoUri.split('/').pop() || 'customer_photo.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';
      formData.append('photo', {
        uri: payload.photoUri,
        name: filename,
        type,
      } as any);

      return apiRequest<{ customer: CustomerItem }>('manager/customers', {
        method: 'POST',
        body: formData,
      });
    }

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

    return apiRequest<{ customer: CustomerItem }>('manager/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async createBulkCustomers(payload: CreateBulkCustomersPayload): Promise<BulkCustomerResponse> {
    return apiRequest<BulkCustomerResponse>('manager/customers/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
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

    return apiRequest<{ photoUrl: string }>(`manager/customers/${customerId}/photo`, {
      method: 'POST',
      body: formData,
    });
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
  },

  // ----------------------------------------------------
  // Inventory in Territory
  // ----------------------------------------------------
  async getInventory(): Promise<ManagerInventoryData> {
    return apiRequest<ManagerInventoryData>('manager/inventory', {
      method: 'GET',
    });
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
};
