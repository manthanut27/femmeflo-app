import { apiRequest, API_BASE_URL } from './client';
import type {
  AdminDashboardData,
  AdminIncentiveListResponse,
  BulkCustomerResponse,
  BusinessSettings,
  CreateAdjustmentPayload,
  CreateBulkCustomersPayload,
  CreateCustomerPayload,
  CreatePayoutPayload,
  CreateProductPayload,
  CustomerItem,
  InventorySummaryData,
  InvoiceItem,
  ListSalesParams,
  PaginationMeta,
  ProductItem,
  PublicUser,
  SaleItem,
  SalesReportData,
  SalesReportQuery,
  Shift,
  UpdateProductPayload,
  UpdateUserRatePayload,
  UserIncentiveDetails,
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
    village?: string;
    managerId?: string;
    sellerId?: string;
    categoryId?: string;
    from?: string;
    to?: string;
  }): Promise<AdminDashboardData> {
    const raw = await apiRequest<AdminDashboardData>('admin/dashboard', {
      method: 'GET',
      params: filters,
    });
    // Map backend metrics structure into AdminDashboardData fields if needed
    if (raw && raw.metrics) {
      if (raw.totalRevenuePaise === undefined) raw.totalRevenuePaise = raw.metrics.totalEarningsPaise || 0;
      if (raw.totalPacketsSold === undefined) raw.totalPacketsSold = raw.metrics.totalPacketsSold || 0;
      if (raw.totalCustomers === undefined) raw.totalCustomers = raw.metrics.totalShops || 0;
      if (raw.activeSellers === undefined) raw.activeSellers = raw.metrics.totalSellers || 0;
      if (raw.warehouseStockBalance === undefined) raw.warehouseStockBalance = raw.metrics.warehouseStock || raw.metrics.totalInventory || 0;
    }
    return raw;
  },

  async getDashboardFilters(): Promise<{
    categories: Array<{ id: string; name: string }>;
    customerLocations: Array<{ state: string; district: string; village: string }>;
    managers: Array<{ id: string; name: string; state?: string; district?: string }>;
    sellers: Array<{ id: string; name: string; managerId?: string; state?: string; district?: string }>;
    states: string[];
    districts: string[];
    villages: string[];
  }> {
    try {
      return await apiRequest('admin/dashboard/filters', { method: 'GET' });
    } catch {
      return {
        categories: [],
        customerLocations: [],
        managers: [],
        sellers: [],
        states: [],
        districts: [],
        villages: [],
      };
    }
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

  async getInventorySummary(): Promise<InventorySummaryData> {
    return apiRequest<InventorySummaryData>('admin/inventory', {
      method: 'GET',
    });
  },

  async recordStockReceipt(payload: {
    warehouseId?: string;
    productId?: string;
    quantity: number;
    items?: Array<{ productId: string; quantity: number }>;
    batchNumber?: string;
    requestKey?: string;
    notes?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const requestKey = payload.requestKey || payload.batchNumber || undefined;
    let body: any;
    if (payload.items && payload.items.length > 0) {
      body = {
        items: payload.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        requestKey,
      };
    } else if (payload.productId) {
      body = {
        items: [{ productId: payload.productId, quantity: payload.quantity }],
        requestKey,
      };
    } else {
      body = {
        quantity: payload.quantity,
        requestKey,
      };
    }

    return apiRequest<{ success: boolean; message?: string }>('admin/inventory/receipts', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async recordStockTransfer(payload: {
    sourceWarehouseId?: string;
    sourceId?: string;
    targetLocationId?: string;
    destinationId?: string;
    productId?: string;
    quantity: number;
    items?: Array<{ productId: string; quantity: number }>;
    reference?: string;
    requestKey?: string;
  }): Promise<{ success: boolean; message?: string }> {
    const sourceId = payload.sourceId || payload.sourceWarehouseId;
    let destinationId = payload.destinationId || payload.targetLocationId;

    if (!sourceId || !destinationId) {
      throw new Error('Source and destination locations are required.');
    }

    // If destinationId was passed as a seller's user ID, attempt resolution to their stockLocation ID
    try {
      const summary = await this.getInventorySummary();
      const matchedSellerLocation = summary?.locations?.find(
        (l) => l.sellerId === destinationId || l.id === destinationId
      );
      if (matchedSellerLocation) {
        destinationId = matchedSellerLocation.id;
      }
    } catch {
      // Continue with destinationId as provided
    }

    const requestKey = payload.requestKey || payload.reference || undefined;

    let body: any;
    if (payload.items && payload.items.length > 0) {
      body = {
        sourceId,
        destinationId,
        items: payload.items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        requestKey,
      };
    } else if (payload.productId) {
      body = {
        sourceId,
        destinationId,
        items: [{ productId: payload.productId, quantity: payload.quantity }],
        requestKey,
      };
    } else {
      body = {
        sourceId,
        destinationId,
        quantity: payload.quantity,
        requestKey,
      };
    }

    return apiRequest<{ success: boolean; message?: string }>('admin/inventory/transfers', {
      method: 'POST',
      body: JSON.stringify(body),
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
    permissions?: string[];
    isSeller?: boolean;
  }): Promise<{ manager: PublicUser }> {
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
    if (payload.permissions) body.permissions = payload.permissions;
    if (payload.isSeller !== undefined) body.isSeller = payload.isSeller;

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
      password: payload.password?.trim() || 'FemmeFlo@2026',
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
  // Customer Management
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
      'admin/customers',
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

  async createCustomer(payload: CreateCustomerPayload): Promise<{ customer: CustomerItem }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const body: Record<string, any> = {
      shopName: payload.shopName.trim(),
      contactName: (payload as any).contactName || payload.ownerName?.trim() || payload.shopName.trim(),
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
    const noPhotoReason = payload.noPhotoReason || payload.photoSkipReason;
    if (noPhotoReason) body.noPhotoReason = noPhotoReason;
    if (payload.photoPath) body.photoPath = payload.photoPath;

    return apiRequest<{ customer: CustomerItem }>('admin/customers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async createBulkCustomers(payload: CreateBulkCustomersPayload): Promise<BulkCustomerResponse> {
    return apiRequest<BulkCustomerResponse>('admin/customers/bulk', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // ----------------------------------------------------
  // Shifts
  // ----------------------------------------------------
  async listShifts(params?: {
    page?: number;
    pageSize?: number;
    from?: string;
    to?: string;
    sellerId?: string;
    managerId?: string;
    status?: string;
  }): Promise<{ items: Shift[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{ items?: Shift[]; shifts?: Shift[]; pagination: PaginationMeta }>(
      'admin/shifts',
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
  // Incentives
  // ----------------------------------------------------
  async getIncentives(params?: {
    role?: string;
    managerId?: string;
    status?: string;
    year?: number;
    month?: number;
    search?: string;
  }): Promise<AdminIncentiveListResponse> {
    return apiRequest<AdminIncentiveListResponse>('admin/incentives', {
      method: 'GET',
      params,
    });
  },

  async updateUserRate(userId: string, payload: UpdateUserRatePayload): Promise<{ success: boolean; message?: string }> {
    return apiRequest<{ success: boolean; message?: string }>(`admin/incentives/users/${userId}/rate`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async createAdjustment(userId: string, payload: CreateAdjustmentPayload): Promise<{ success: boolean; message?: string }> {
    return apiRequest<{ success: boolean; message?: string }>(`admin/incentives/users/${userId}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async createPayout(userId: string, payload: CreatePayoutPayload): Promise<{ success: boolean; message?: string }> {
    return apiRequest<{ success: boolean; message?: string }>(`admin/incentives/users/${userId}/payouts`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async getUserIncentiveDetails(userId: string): Promise<UserIncentiveDetails> {
    return apiRequest<UserIncentiveDetails>(`admin/incentives/users/${userId}`, {
      method: 'GET',
    });
  },

  async getIncentiveSettings(): Promise<{ settings: BusinessSettings }> {
    const settings = await this.getBusinessSettings();
    return { settings };
  },

  async updateIncentiveSettings(payload: Partial<BusinessSettings>): Promise<{ settings: BusinessSettings }> {
    const settings = await this.updateBusinessSettings(payload);
    return { settings };
  },

  // ----------------------------------------------------
  // Business Settings
  // ----------------------------------------------------
  async getBusinessSettings(): Promise<BusinessSettings> {
    try {
      const res = await apiRequest<{ settings?: BusinessSettings } | BusinessSettings>('admin/incentives/settings', {
        method: 'GET',
      });
      const settings = ((res as any)?.settings ?? res) as BusinessSettings;
      if (settings && settings.minimumPricePaise && !settings.minimumSalePricePaise) {
        settings.minimumSalePricePaise = settings.minimumPricePaise;
      }
      return settings;
    } catch {
      const res = await apiRequest<BusinessSettings>('admin/settings', {
        method: 'GET',
      });
      if (res && res.minimumPricePaise && !res.minimumSalePricePaise) {
        res.minimumSalePricePaise = res.minimumPricePaise;
      }
      return res;
    }
  },

  async updateBusinessSettings(payload: Partial<BusinessSettings>): Promise<BusinessSettings> {
    const minPrice = payload.minimumPricePaise ?? payload.minimumSalePricePaise;
    const body: Record<string, any> = {};
    if (minPrice !== undefined) body.minimumPricePaise = minPrice;
    if (payload.incentiveRatePaise !== undefined) body.incentiveRatePaise = payload.incentiveRatePaise;
    if (payload.companyName !== undefined) body.companyName = payload.companyName;
    if (payload.companyGst !== undefined) body.companyGst = payload.companyGst;
    if (payload.companyAddress !== undefined) body.companyAddress = payload.companyAddress;
    if (payload.companyPhone !== undefined) body.companyPhone = payload.companyPhone;
    if (payload.companyEmail !== undefined) body.companyEmail = payload.companyEmail;
    if (payload.companyPan !== undefined) body.companyPan = payload.companyPan;
    if (payload.invoiceTerms !== undefined) body.invoiceTerms = payload.invoiceTerms;
    if (payload.lowStockThreshold !== undefined) body.lowStockThreshold = payload.lowStockThreshold;

    try {
      const res = await apiRequest<{ settings?: BusinessSettings } | BusinessSettings>('admin/incentives/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      const settings = ((res as any)?.settings ?? res) as BusinessSettings;
      if (settings && settings.minimumPricePaise && !settings.minimumSalePricePaise) {
        settings.minimumSalePricePaise = settings.minimumPricePaise;
      }
      return settings;
    } catch {
      const res = await apiRequest<BusinessSettings>('admin/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (res && res.minimumPricePaise && !res.minimumSalePricePaise) {
        res.minimumSalePricePaise = res.minimumPricePaise;
      }
      return res;
    }
  },

  // ----------------------------------------------------
  // Products Catalog
  // ----------------------------------------------------
  async listProducts(): Promise<{ items: ProductItem[] }> {
    return apiRequest<{ items: ProductItem[] }>('admin/products', {
      method: 'GET',
    });
  },

  async createProduct(payload: CreateProductPayload): Promise<{ product: ProductItem }> {
    return apiRequest<{ product: ProductItem }>('admin/products', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateProduct(id: string, payload: UpdateProductPayload): Promise<{ product: ProductItem }> {
    return apiRequest<{ product: ProductItem }>(`admin/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async toggleProductActive(id: string): Promise<{ product: ProductItem }> {
    return apiRequest<{ product: ProductItem }>(`admin/products/${id}/toggle`, {
      method: 'PATCH',
    });
  },

  // ----------------------------------------------------
  // Invoices & Sales Reports
  // ----------------------------------------------------
  async getSalesReport(query?: SalesReportQuery): Promise<SalesReportData> {
    const params: Record<string, any> = { ...query };
    if (query?.startDate && !params.from) params.from = query.startDate;
    if (query?.endDate && !params.to) params.to = query.endDate;
    return apiRequest<SalesReportData>('admin/reports/sales', {
      method: 'GET',
      params,
    });
  },

  getInvoicePdfUrl(id: string, download = true): string {
    return `${API_BASE_URL}/invoices/${id}/pdf?download=${download ? 'true' : 'false'}`;
  },

  getAdminInvoicePdfUrl(id: string, download = true): string {
    return `${API_BASE_URL}/admin/invoices/${id}/pdf?download=${download ? 'true' : 'false'}`;
  },

  async listInvoices(params?: { page?: number; pageSize?: number; search?: string }): Promise<{ items: InvoiceItem[]; invoices: InvoiceItem[]; pagination: PaginationMeta }> {
    try {
      const raw = await apiRequest<{ items?: InvoiceItem[]; invoices?: InvoiceItem[]; pagination: PaginationMeta }>(
        'admin/invoices',
        {
          method: 'GET',
          params,
        }
      );
      const list = raw?.items ?? raw?.invoices ?? [];
      return {
        items: list,
        invoices: list,
        pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
      };
    } catch {
      const raw = await apiRequest<{ sales?: SaleItem[]; items?: SaleItem[]; pagination: PaginationMeta }>(
        'admin/sales',
        {
          method: 'GET',
          params: { ...params, status: 'CONFIRMED' },
        }
      );
      const list = (raw?.sales ?? raw?.items ?? []).map((s) => ({
        id: s.id,
        number: s.saleNumber || `INV-${s.id.slice(0, 8).toUpperCase()}`,
        saleId: s.id,
        createdAt: s.createdAt || new Date().toISOString(),
        sale: {
          id: s.id,
          saleNumber: s.saleNumber,
          quantity: s.packetCount || s.quantity || 0,
          totalPaise: s.totalAmountPaise || s.totalPaise || 0,
          paymentMode: s.paymentMode,
          customer: s.customer,
          seller: s.seller,
        },
      })) as InvoiceItem[];

      return {
        items: list,
        invoices: list,
        pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
      };
    }
  },

  async getInvoice(id: string): Promise<{ invoice: InvoiceItem }> {
    return apiRequest<{ invoice: InvoiceItem }>(`admin/invoices/${id}`, {
      method: 'GET',
    });
  },

  // ----------------------------------------------------
  // Permissions Matrix
  // ----------------------------------------------------
  async listPermissions(): Promise<{ permissions: string[] }> {
    const raw = await apiRequest<{ permissions?: string[] } | string[]>('admin/permissions', {
      method: 'GET',
    });
    if (Array.isArray(raw)) {
      return { permissions: raw };
    }
    return { permissions: raw?.permissions ?? [] };
  },

  async updateManagerPermissions(
    managerId: string,
    permissions: string[]
  ): Promise<{ manager: PublicUser }> {
    const res = await apiRequest<{ manager?: PublicUser; user?: PublicUser }>(
      `admin/permissions/managers/${managerId}/permissions`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions }),
      }
    );
    return { manager: (res.manager ?? res.user)! };
  },

  async updateOverallPermissions(
    permissions: string[]
  ): Promise<{ count: number; message?: string }> {
    const res = await apiRequest<{ count?: number; message?: string; data?: { count: number } }>(
      'admin/permissions/overall',
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions }),
      }
    );
    return {
      count: res.count ?? res.data?.count ?? 0,
      message: res.message,
    };
  },

  // ----------------------------------------------------
  // Sales Directory & Orders Ledger
  // ----------------------------------------------------
  async listSales(
    params?: ListSalesParams
  ): Promise<{ items: SaleItem[]; sales: SaleItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{
      items?: SaleItem[];
      sales?: SaleItem[];
      pagination: PaginationMeta;
    }>('admin/sales', {
      method: 'GET',
      params: params as Record<string, string | number | boolean | undefined | null>,
    });
    const list = raw?.items ?? raw?.sales ?? [];
    return {
      items: list,
      sales: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getSale(id: string): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`admin/sales/${id}`, {
      method: 'GET',
    });
  },

  async updateSale(id: string, payload: any): Promise<{ sale: SaleItem }> {
    return apiRequest<{ sale: SaleItem }>(`admin/sales/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
};
