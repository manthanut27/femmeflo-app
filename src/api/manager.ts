import { apiRequest } from './client';
import type {
  CustomerItem,
  ManagerDashboardData,
  PaginationMeta,
  ProductItem,
  PublicUser,
  SaleItem,
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
    return apiRequest<ManagerDashboardData>('manager/dashboard', {
      method: 'GET',
    });
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
    email: string;
    password?: string;
    phone?: string;
    state?: string;
    district?: string;
    village?: string;
  }): Promise<{ seller: ManagerSellerItem }> {
    const raw = await apiRequest<{ seller?: ManagerSellerItem; user?: ManagerSellerItem }>('manager/sellers', {
      method: 'POST',
      body: JSON.stringify(payload),
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

  // ----------------------------------------------------
  // Sales in Territory
  // ----------------------------------------------------
  async listSales(params?: {
    page?: number;
    pageSize?: number;
    sellerId?: string;
    status?: string;
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

  async listProducts(): Promise<{ items: ProductItem[] }> {
    return apiRequest<{ items: ProductItem[] }>('manager/products', {
      method: 'GET',
    });
  },
};
