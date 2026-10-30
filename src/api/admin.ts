import { apiRequest } from './client';
import type {
  AdminDashboardData,
  BusinessSettings,
  PaginationMeta,
  ProductItem,
  PublicUser,
  SaleItem,
  WarehouseItem,
} from './types';

export interface PendingApprovalItem extends SaleItem {
  requestedUnitPricePaise?: number;
  minimumPricePaise?: number;
}

export const adminApi = {
  // ----------------------------------------------------
  // Dashboard
  // ----------------------------------------------------
  async getDashboard(filters?: {
    state?: string;
    district?: string;
    managerId?: string;
    sellerId?: string;
  }): Promise<AdminDashboardData> {
    return apiRequest<AdminDashboardData>('admin/dashboard', {
      method: 'GET',
      params: filters,
    });
  },

  // ----------------------------------------------------
  // Price Approvals Queue
  // ----------------------------------------------------
  async listApprovals(params?: { page?: number; pageSize?: number }): Promise<{ items: PendingApprovalItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ items?: PendingApprovalItem[]; approvals?: PendingApprovalItem[]; pagination: PaginationMeta }>(
      'admin/approvals',
      {
        method: 'GET',
        params,
      }
    );
    const list = raw?.items ?? raw?.approvals ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async approveSale(saleId: string, notes?: string): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`admin/approvals/${saleId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ notes }),
    });
  },

  async rejectSale(saleId: string, reason?: string): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`admin/approvals/${saleId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // ----------------------------------------------------
  // Warehouses & Stock Movements
  // ----------------------------------------------------
  async getWarehouses(): Promise<{ items: WarehouseItem[] }> {
    try {
      const raw = await apiRequest<{ warehouses?: WarehouseItem[]; items?: WarehouseItem[] }>(
        'admin/inventory/warehouses',
        { method: 'GET' }
      );
      return { items: raw?.warehouses ?? raw?.items ?? [] };
    } catch {
      const raw = await apiRequest<{ warehouses?: WarehouseItem[]; items?: WarehouseItem[] }>(
        'admin/warehouses',
        { method: 'GET' }
      ).catch(() => ({ items: [] as WarehouseItem[], warehouses: [] as WarehouseItem[] }));
      return { items: raw?.warehouses ?? raw?.items ?? [] };
    }
  },

  async recordStockReceipt(payload: {
    warehouseId: string;
    productId: string;
    quantity: number;
    batchNumber?: string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string }> {
    return apiRequest<{ success: boolean; message?: string }>('admin/inventory/receipts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async recordStockTransfer(payload: {
    sourceWarehouseId: string;
    targetLocationId: string;
    productId: string;
    quantity: number;
    reference?: string;
  }): Promise<{ success: boolean; message?: string }> {
    return apiRequest<{ success: boolean; message?: string }>('admin/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ----------------------------------------------------
  // User Management
  // ----------------------------------------------------
  async listManagers(params?: { page?: number; pageSize?: number; search?: string }): Promise<{ items: PublicUser[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ managers?: PublicUser[]; items?: PublicUser[]; pagination: PaginationMeta }>(
      'admin/managers',
      {
        method: 'GET',
        params,
      }
    );
    const list = raw?.managers ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async createManager(payload: {
    name: string;
    email?: string;
    password?: string;
    phone?: string;
    state?: string;
    district?: string;
    village?: string;
  }): Promise<{ manager: PublicUser }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const body: Record<string, any> = {
      name: payload.name.trim(),
      phone,
      password: payload.password || 'FemmeFlo@2026',
    };
    if (payload.email?.trim()) body.email = payload.email.trim();
    if (payload.state?.trim()) body.state = payload.state.trim();
    if (payload.district?.trim()) body.district = payload.district.trim();
    if (payload.village?.trim()) body.village = payload.village.trim();

    const res = await apiRequest<{ manager?: PublicUser; user?: PublicUser }>('admin/managers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { manager: (res.manager ?? res.user)! };
  },

  async listSellers(params?: { page?: number; pageSize?: number; search?: string }): Promise<{ items: PublicUser[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ sellers?: PublicUser[]; items?: PublicUser[]; pagination: PaginationMeta }>(
      'admin/sellers',
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

  async createSeller(payload: {
    name: string;
    email?: string;
    managerId: string;
    password?: string;
    phone?: string;
    state?: string;
    district?: string;
    village?: string;
  }): Promise<{ seller: PublicUser }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const body: Record<string, any> = {
      name: payload.name.trim(),
      phone,
      password: payload.password || 'FemmeFlo@2026',
      managerId: payload.managerId,
    };
    if (payload.email?.trim()) body.email = payload.email.trim();
    if (payload.state?.trim()) body.state = payload.state.trim();
    if (payload.district?.trim()) body.district = payload.district.trim();
    if (payload.village?.trim()) body.village = payload.village.trim();

    const res = await apiRequest<{ seller?: PublicUser; user?: PublicUser }>('admin/sellers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { seller: (res.seller ?? res.user)! };
  },

  // ----------------------------------------------------
  // Business Settings
  // ----------------------------------------------------
  async getBusinessSettings(): Promise<BusinessSettings> {
    try {
      const res = await apiRequest<{ settings?: BusinessSettings } | BusinessSettings>('admin/incentives/settings', {
        method: 'GET',
      });
      return ((res as any)?.settings ?? res) as BusinessSettings;
    } catch {
      return apiRequest<BusinessSettings>('admin/settings', {
        method: 'GET',
      });
    }
  },

  async updateBusinessSettings(payload: Partial<BusinessSettings>): Promise<BusinessSettings> {
    try {
      const res = await apiRequest<{ settings?: BusinessSettings } | BusinessSettings>('admin/incentives/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      return ((res as any)?.settings ?? res) as BusinessSettings;
    } catch {
      return apiRequest<BusinessSettings>('admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    }
  },

  async listProducts(): Promise<{ items: ProductItem[] }> {
    return apiRequest<{ items: ProductItem[] }>('admin/products', {
      method: 'GET',
    });
  },
};
