import { apiRequest, API_BASE_URL, isMockMode, uploadFileMultipart } from './client';
import { handleMockRequest } from './mockService';
import { sanitizeBackendPermissions } from '../utils/permissions';
import { buildCustomerUpdateBody, normalizeCustomerItem } from '../utils/customerSanitizer';
import { sanitizeIndiaCoordinates } from '../utils/geoValidation';
import type {
  AdminDashboardData,
  AdminIncentiveListResponse,
  AdminInventoryTransactionItem,
  BulkCustomerResponse,
  BusinessSettings,
  CreateAdjustmentPayload,
  CreateBulkCustomersPayload,
  CreateCustomerPayload,
  CreatePayoutPayload,
  CreateProductPayload,
  CreateWarehousePayload,
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
  UpdateCustomerPayload,
  UpdateProductPayload,
  UpdateUserRatePayload,
  UserIncentiveDetails,
  WarehouseItem,
} from './types';

export interface PendingApprovalItem extends SaleItem {
  requestedUnitPricePaise?: number;
  minimumPricePaise?: number;
  isResubmitted?: boolean;
  resubmitForApproval?: boolean;
}

export function isSaleResubmitted(raw: any): boolean {
  if (!raw || typeof raw !== 'object') return false;
  if (raw.isResubmitted === true || raw.resubmitForApproval === true) return true;
  if (raw.resubmittedAt) return true;
  if (
    typeof raw.customerFeedback === 'string' &&
    (raw.customerFeedback.includes('Price Revised') ||
      raw.customerFeedback.includes('Manager Price Revised') ||
      raw.customerFeedback.includes('Resubmitted'))
  ) {
    return true;
  }
  if (
    typeof raw.approvalReason === 'string' &&
    (raw.approvalReason.toLowerCase().includes('revised') ||
      raw.approvalReason.toLowerCase().includes('reapproval'))
  ) {
    return true;
  }
  if (raw.status === 'PENDING_APPROVAL' && raw.updatedAt && raw.createdAt) {
    const created = new Date(raw.createdAt).getTime();
    const updated = new Date(raw.updatedAt).getTime();
    if (!isNaN(created) && !isNaN(updated) && updated - created > 2000) {
      return true;
    }
  }
  return false;
}

export function normalizeApprovalItem(raw: any): PendingApprovalItem {
  const totalPaise = Number(raw.totalPaise ?? raw.totalAmountPaise ?? 0);
  const totalAmountPaise = Number(raw.totalAmountPaise ?? raw.totalPaise ?? totalPaise);
  const quantity = Number(raw.quantity ?? raw.packetCount ?? 0);
  const packetCount = Number(raw.packetCount ?? raw.quantity ?? quantity);
  const unitPricePaise = Number(
    raw.unitPricePaise ?? (quantity > 0 ? Math.round(totalPaise / quantity) : 0)
  );
  const lineItems = Array.isArray(raw.lineItems)
    ? raw.lineItems
    : Array.isArray(raw.items)
    ? raw.items
    : [];

  const saleNumber =
    raw.saleNumber ||
    (raw.id && typeof raw.id === 'string'
      ? `#${raw.id.slice(0, 8).toUpperCase()}`
      : undefined);

  const isResubmitted = isSaleResubmitted(raw);

  return {
    ...raw,
    id: String(raw.id || ''),
    saleNumber,
    totalPaise,
    totalAmountPaise,
    quantity,
    packetCount,
    unitPricePaise,
    lineItems,
    items: lineItems,
    requestedUnitPricePaise: raw.requestedUnitPricePaise ?? unitPricePaise,
    minimumPricePaise: raw.minimumPricePaise ?? 2500,
    isResubmitted,
    resubmitForApproval: isResubmitted,
  };
}

export const adminApi = {
  // ----------------------------------------------------
  // Profile & Settings
  // ----------------------------------------------------
  async updateProfile(payload: Partial<PublicUser>): Promise<{ user: PublicUser }> {
    return apiRequest<{ user: PublicUser }>('admin/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },
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
    // Safely sync pending approvals count if missing
    if (raw && raw.pendingApprovalsCount === undefined) {
      try {
        const appRes = await adminApi.listApprovals({ page: 1, pageSize: 1 });
        raw.pendingApprovalsCount = appRes?.pagination?.total ?? (Array.isArray(appRes?.items) ? appRes.items.length : 0);
      } catch {
        raw.pendingApprovalsCount = 0;
      }
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
      const raw = await apiRequest<any>('admin/dashboard/filters', { method: 'GET' });
      if (!raw) throw new Error('Empty filters response');

      // Normalize states to clean string array
      const states: string[] = Array.isArray(raw.states)
        ? raw.states.map((s: any) => (typeof s === 'string' ? s : s?.state || '')).filter(Boolean)
        : [];

      // Normalize districts: handle rawDistricts array of strings or districts array of objects
      let districts: string[] = [];
      if (Array.isArray(raw.rawDistricts)) {
        districts = raw.rawDistricts.filter((d: any) => typeof d === 'string' && d.trim().length > 0);
      } else if (Array.isArray(raw.districts)) {
        districts = raw.districts
          .map((d: any) => (typeof d === 'string' ? d : d?.district || ''))
          .filter((d: string) => d.trim().length > 0);
      }
      districts = Array.from(new Set(districts));

      // Normalize villages to clean string array
      let villages: string[] = [];
      if (Array.isArray(raw.villages)) {
        villages = raw.villages
          .map((v: any) => (typeof v === 'string' ? v : v?.village || ''))
          .filter((v: string) => v.trim().length > 0);
      }
      villages = Array.from(new Set(villages));

      return {
        categories: Array.isArray(raw.categories) ? raw.categories : [],
        customerLocations: Array.isArray(raw.customerLocations) ? raw.customerLocations : [],
        managers: Array.isArray(raw.managers) ? raw.managers : [],
        sellers: Array.isArray(raw.sellers) ? raw.sellers : [],
        states: Array.from(new Set(states)),
        districts,
        villages,
      };
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
    try {
      const raw = await apiRequest<{ items?: any[]; approvals?: any[]; pendingSales?: any[]; pagination: PaginationMeta }>(
        'admin/approvals',
        {
          method: 'GET',
          params,
        }
      );
      const rawList = raw?.items ?? raw?.approvals ?? raw?.pendingSales ?? [];
      const list = rawList.map(normalizeApprovalItem);
      list.sort((a, b) => {
        if (a.isResubmitted && !b.isResubmitted) return -1;
        if (!a.isResubmitted && b.isResubmitted) return 1;
        const timeA = new Date(a.resubmittedAt || a.updatedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.resubmittedAt || b.updatedAt || b.createdAt || 0).getTime();
        return timeB - timeA;
      });
      return {
        items: list,
        pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
      };
    } catch (err) {
      if (isMockMode()) {
        try {
          const mockRaw = await handleMockRequest<{ items?: any[]; pendingSales?: any[]; pagination?: PaginationMeta }>(
            'admin/approvals',
            {
              method: 'GET',
              params,
            }
          );
          const mockList = (mockRaw?.items ?? mockRaw?.pendingSales ?? []).map(normalizeApprovalItem);
          mockList.sort((a, b) => {
            if (a.isResubmitted && !b.isResubmitted) return -1;
            if (!a.isResubmitted && b.isResubmitted) return 1;
            const timeA = new Date(a.resubmittedAt || a.updatedAt || a.createdAt || 0).getTime();
            const timeB = new Date(b.resubmittedAt || b.updatedAt || b.createdAt || 0).getTime();
            return timeB - timeA;
          });
          return {
            items: mockList,
            pagination: mockRaw?.pagination ?? { page: 1, pageSize: 20, total: mockList.length, totalPages: 1 },
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

  async approveSale(saleId: string, notes?: string): Promise<{ sale: SaleItem }> {
    try {
      return await apiRequest<{ sale: SaleItem }>(`admin/approvals/${saleId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ notes }),
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sale: SaleItem }>(`admin/approvals/${saleId}/approve`, {
          method: 'POST',
          body: JSON.stringify({ notes }),
        });
      }
      throw err;
    }
  },

  async rejectSale(saleId: string, reason?: string): Promise<{ sale: SaleItem }> {
    try {
      return await apiRequest<{ sale: SaleItem }>(`admin/approvals/${saleId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sale: SaleItem }>(`admin/approvals/${saleId}/reject`, {
          method: 'POST',
          body: JSON.stringify({ reason }),
        });
      }
      throw err;
    }
  },

  // ----------------------------------------------------
  // Warehouses & Stock Movements
  // ----------------------------------------------------
  async getWarehouses(): Promise<{ items: WarehouseItem[] }> {
    try {
      const [whRaw, summaryRaw] = await Promise.all([
        apiRequest<{ warehouses?: WarehouseItem[]; items?: WarehouseItem[] }>(
          'admin/inventory/warehouses',
          { method: 'GET' }
        ).catch(() => ({ items: [] as WarehouseItem[] })),
        apiRequest<any>('admin/inventory', { method: 'GET' }).catch(() => null),
      ]);

      const warehouseList: WarehouseItem[] = (whRaw as any)?.warehouses ?? (whRaw as any)?.items ?? [];

      // Extract all locations of type HQ or WAREHOUSE from inventory summary
      if (summaryRaw?.locations && Array.isArray(summaryRaw.locations)) {
        for (const loc of summaryRaw.locations) {
          if (loc.type === 'HQ' || loc.type === 'WAREHOUSE') {
            const exists = warehouseList.some((w) => w.id === loc.id);
            if (!exists) {
              const isHq = loc.type === 'HQ';
              warehouseList.unshift({
                id: loc.id,
                name: loc.name || (isHq ? 'Central HQ Warehouse' : 'Regional Warehouse'),
                code: isHq ? 'HQ-MAIN' : (loc.code || 'WH-DEPOT'),
                state: loc.state || 'Uttar Pradesh',
                district: loc.district || 'Varanasi',
                active: true,
                type: loc.type,
                balance: Number(loc.balance || 0),
              } as WarehouseItem);
            } else {
              const item = warehouseList.find((w) => w.id === loc.id);
              if (item && loc.balance !== undefined) {
                (item as any).balance = Number(loc.balance);
              }
            }
          }
        }
      }

      return { items: warehouseList };
    } catch {
      return {
        items: [],
      };
    }
  },

  async createWarehouse(
    payload: CreateWarehousePayload
  ): Promise<{ success: boolean; warehouse: WarehouseItem; message?: string }> {
    const cleanName = payload.name.trim();
    const cleanPrefix = cleanName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase() || 'DEP';
    const code = payload.code ? payload.code.trim().toUpperCase() : `WH-${cleanPrefix}-${Math.floor(100 + Math.random() * 900)}`;
    const district = payload.district?.trim() || cleanName.split(' ')[0] || 'Regional';
    const state = payload.state?.trim() || 'Maharashtra';

    return apiRequest<{ success: boolean; warehouse: WarehouseItem; message?: string }>(
      'admin/warehouses',
      {
        method: 'POST',
        body: JSON.stringify({
          name: cleanName,
          code,
          state,
          district,
          address: payload.address ? payload.address.trim() : undefined,
          type: payload.type || 'WAREHOUSE',
        }),
      }
    );
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
    requestKey?: string;
  }): Promise<{ success: boolean; message?: string }> {
    // Generate an independent unique idempotency request key if not explicitly supplied
    const requestKey =
      payload.requestKey ||
      `rcpt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
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

  async listInventoryTransactions(params?: {
    page?: number;
    pageSize?: number;
    type?: string;
    locationId?: string;
  }): Promise<{ items: AdminInventoryTransactionItem[]; pagination: PaginationMeta }> {
    const raw = await apiRequest<{
      items?: AdminInventoryTransactionItem[];
      transactions?: AdminInventoryTransactionItem[];
      pagination?: PaginationMeta;
    }>('admin/inventory/transactions', {
      method: 'GET',
      params,
    });
    const list = raw?.transactions ?? raw?.items ?? [];
    return {
      items: list,
      pagination: raw?.pagination ?? {
        page: params?.page || 1,
        pageSize: params?.pageSize || 20,
        total: list.length,
        totalPages: Math.ceil(list.length / (params?.pageSize || 20)) || 1,
      },
    };
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
    const rawSourceId = payload.sourceId || payload.sourceWarehouseId;
    let rawDestinationId = payload.destinationId || payload.targetLocationId;

    if (!rawSourceId || !rawDestinationId) {
      throw new Error('Source and destination locations are required.');
    }

    let sourceId = rawSourceId;
    let destinationId = rawDestinationId;

    // Resolve sourceId & destinationId to valid StockLocation UUIDs from inventory summary
    try {
      const summary = await adminApi.getInventorySummary();
      const locations = summary?.locations || [];

      // 1. Resolve source location:
      // Match by exact id, or if id was default 'loc_hq_central', resolve to the HQ location UUID
      const matchedSource =
        locations.find((l) => l.id === sourceId) ||
        (sourceId.startsWith('loc_hq') || sourceId.toLowerCase().includes('hq')
          ? locations.find((l) => l.type === 'HQ')
          : undefined) ||
        locations.find((l) => l.type === 'HQ');

      if (matchedSource?.id) {
        sourceId = matchedSource.id;
      }

      // 2. Resolve destination location:
      // Can be a seller's user ID, stockLocation ID, or warehouse ID
      const matchedDest = locations.find(
        (l) =>
          l.id === destinationId ||
          l.sellerId === destinationId ||
          (l.seller && l.seller.id === destinationId)
      );
      if (matchedDest?.id) {
        destinationId = matchedDest.id;
      }
    } catch {
      // Continue with provided IDs if network lookup fails
    }

    const items =
      payload.items && payload.items.length > 0
        ? payload.items.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) }))
        : payload.productId
        ? [{ productId: payload.productId, quantity: Number(payload.quantity) }]
        : [];

    const requestKey = payload.requestKey || payload.reference || undefined;

    const body: Record<string, any> = {
      sourceId,
      destinationId,
      items,
    };
    if (requestKey) {
      body.requestKey = requestKey;
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
    employeeCode?: string;
    aadhaarNumber?: string;
    drivingLicenseNumber?: string;
    qualification?: string;
    alternatePhone?: string;
    address?: string;
    pincode?: string;
    permissions?: string[];
    isSeller?: boolean;
    salesTargetPackets?: number | null;
    salesTargetPeriod?: 'DAILY' | 'MONTHLY';
    targetBonusPaise?: number | null;
  }): Promise<{ manager: PublicUser }> {
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
    if (payload.employeeCode?.trim()) body.employeeCode = payload.employeeCode.trim();
    if (payload.alternatePhone?.trim()) body.alternatePhone = payload.alternatePhone.trim();
    if (payload.address?.trim()) body.address = payload.address.trim();
    if (payload.pincode?.trim()) body.pincode = payload.pincode.trim();
    if (payload.permissions && payload.permissions.length > 0) {
      body.permissions = sanitizeBackendPermissions(payload.permissions);
    }
    if (payload.isSeller !== undefined) body.isSeller = payload.isSeller;
    if (payload.salesTargetPackets !== undefined) body.salesTargetPackets = payload.salesTargetPackets;
    if (payload.salesTargetPeriod !== undefined) body.salesTargetPeriod = payload.salesTargetPeriod;
    if (payload.targetBonusPaise !== undefined) body.targetBonusPaise = payload.targetBonusPaise;

    const res = await apiRequest<{ manager?: PublicUser; user?: PublicUser }>('admin/managers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { manager: (res.manager ?? res.user)! };
  },

  async updateManager(
    managerId: string,
    payload: {
      name?: string;
      email?: string;
      phone?: string;
      alternatePhone?: string;
      state?: string;
      district?: string;
      village?: string;
      address?: string;
      pincode?: string;
      permissions?: string[];
      isSeller?: boolean;
      active?: boolean;
      salesTargetPackets?: number | null;
      salesTargetPeriod?: 'DAILY' | 'MONTHLY';
      targetBonusPaise?: number | null;
    }
  ): Promise<{ manager: PublicUser }> {
    const body: Record<string, any> = {};
    if (payload.name !== undefined) body.name = payload.name.trim();
    if (payload.email !== undefined) body.email = payload.email.trim();
    if (payload.phone !== undefined) {
      const raw = payload.phone.trim();
      body.phone = raw.startsWith('+') ? raw : `+91${raw.replace(/\D/g, '').slice(-10)}`;
    }
    if (payload.state !== undefined) body.state = payload.state.trim();
    if (payload.district !== undefined) body.district = payload.district.trim();
    if (payload.village !== undefined) body.village = payload.village.trim();
    if (payload.alternatePhone !== undefined) body.alternatePhone = payload.alternatePhone.trim();
    if (payload.address !== undefined) body.address = payload.address.trim();
    if (payload.pincode !== undefined) body.pincode = payload.pincode.trim();
    if (payload.permissions !== undefined) body.permissions = payload.permissions;
    if (payload.isSeller !== undefined) body.isSeller = payload.isSeller;
    if (payload.active !== undefined) body.active = payload.active;
    if (payload.salesTargetPackets !== undefined) body.salesTargetPackets = payload.salesTargetPackets;
    if (payload.salesTargetPeriod !== undefined) body.salesTargetPeriod = payload.salesTargetPeriod;
    if (payload.targetBonusPaise !== undefined) body.targetBonusPaise = payload.targetBonusPaise;

    const res = await apiRequest<{ manager?: PublicUser; user?: PublicUser }>(`admin/managers/${managerId}`, {
      method: 'PATCH',
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
    dailyTarget?: number;
    salesTargetPackets?: number | null;
    salesTargetPeriod?: 'DAILY' | 'MONTHLY';
    targetBonusPaise?: number | null;
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
  }): Promise<{ seller: PublicUser }> {
    const rawPhone = (payload.phone || '').trim();
    const phone = rawPhone.startsWith('+') ? rawPhone : `+91${rawPhone.replace(/^0+/, '')}`;
    const body: Record<string, any> = {
      name: payload.name.trim(),
      phone,
      password: payload.password?.trim() || '',
      managerId: payload.managerId,
    };
    if (payload.email?.trim()) body.email = payload.email.trim();
    if (payload.state?.trim()) body.state = payload.state.trim();
    if (payload.district?.trim()) body.district = payload.district.trim();
    if (payload.village?.trim()) body.village = payload.village.trim();
    if (payload.dailyTarget) body.dailyTarget = payload.dailyTarget;
    if (payload.salesTargetPackets !== undefined) body.salesTargetPackets = payload.salesTargetPackets;
    if (payload.salesTargetPeriod !== undefined) body.salesTargetPeriod = payload.salesTargetPeriod;
    if (payload.targetBonusPaise !== undefined) body.targetBonusPaise = payload.targetBonusPaise;
    if (payload.shiftTiming?.trim()) body.shiftTiming = payload.shiftTiming.trim();
    if (payload.designation?.trim()) body.designation = payload.designation.trim();
    if (payload.employeeCode?.trim()) body.employeeCode = payload.employeeCode.trim();
    if (payload.active !== undefined) body.active = payload.active;
    if (payload.alternatePhone?.trim()) body.alternatePhone = payload.alternatePhone.trim();
    if (payload.address?.trim()) body.address = payload.address.trim();
    if (payload.pincode?.trim()) body.pincode = payload.pincode.trim();

    const res = await apiRequest<{ seller?: PublicUser; user?: PublicUser }>('admin/sellers', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    return { seller: (res.seller ?? res.user)! };
  },

  async updateSeller(
    sellerId: string,
    payload: Partial<PublicUser> & {
      dailyTarget?: number;
      salesTargetPackets?: number | null;
      salesTargetPeriod?: 'DAILY' | 'MONTHLY';
      targetBonusPaise?: number | null;
    }
  ): Promise<{ seller: PublicUser }> {
    const res = await apiRequest<{ seller?: PublicUser; user?: PublicUser }>(`admin/sellers/${sellerId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
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
    const list = (raw?.customers ?? raw?.items ?? []).map((c) => normalizeCustomerItem(c));
    return {
      items: list,
      pagination: raw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
    };
  },

  async getCustomer(id: string): Promise<{ customer: CustomerItem }> {
    const res = await apiRequest<{ customer: CustomerItem }>(`admin/customers/${id}`, {
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
    if (payload.sellerId) body.sellerId = payload.sellerId;

    return apiRequest<{ customer: CustomerItem }>('admin/customers', {
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
    const res = await apiRequest<{ customer: CustomerItem }>(`admin/customers/${id}`, {
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

  async uploadCustomerPhoto(customerId: string, fileUri: string): Promise<{ photoUrl: string }> {
    return uploadFileMultipart<{ photoUrl: string }>(`admin/customers/${customerId}/photo`, fileUri, 'photo');
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
    return apiRequest<BulkCustomerResponse>('admin/customers/bulk', {
      method: 'POST',
      body: JSON.stringify({ ...payload, customers: sanitizedCustomers }),
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
  }): Promise<{ items: Shift[]; pagination: PaginationMeta; summary?: import('./types').ShiftSummary }> {
    const raw = await apiRequest<{
      items?: Shift[];
      shifts?: Shift[];
      pagination: PaginationMeta;
      summary?: import('./types').ShiftSummary;
    }>(
      'admin/shifts',
      {
        method: 'GET',
        params,
      }
    );
    const list = raw?.items ?? raw?.shifts ?? [];
    return {
      items: list,
      summary: raw?.summary,
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

  async updateUserTarget(
    userId: string,
    payload: {
      salesTargetPackets: number | null;
      salesTargetPeriod: 'DAILY' | 'MONTHLY';
      targetBonusPaise?: number | null;
    }
  ): Promise<{
    success: boolean;
    message?: string;
    data?: {
      user: {
        id: string;
        name: string;
        role: string;
        salesTargetPackets: number | null;
        salesTargetPeriod: 'DAILY' | 'MONTHLY';
        targetBonusPaise: number | null;
      };
      targetProgress: import('./types').TargetProgressSummary;
    };
  }> {
    return apiRequest(`admin/incentives/users/${userId}/target`, {
      method: 'PATCH',
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

  async updateIncentiveSettings(
    payload: Partial<BusinessSettings> & { applyToUnpaid?: boolean }
  ): Promise<{ settings: BusinessSettings; recalculatedCount?: number }> {
    const body: Record<string, any> = {};
    if (payload.incentiveRatePaise !== undefined) body.incentiveRatePaise = payload.incentiveRatePaise;
    if (payload.applyToUnpaid !== undefined) body.applyToUnpaid = payload.applyToUnpaid;
    const minPrice = payload.minimumPricePaise ?? payload.minimumSalePricePaise;
    if (minPrice !== undefined) body.minimumPricePaise = minPrice;

    try {
      const res = await apiRequest<{ settings?: BusinessSettings; recalculatedCount?: number } | BusinessSettings>(
        'admin/incentives/settings',
        {
          method: 'PATCH',
          body: JSON.stringify(body),
        }
      );
      const settings = ((res as any)?.settings ?? res) as BusinessSettings;
      if (settings && settings.minimumPricePaise && !settings.minimumSalePricePaise) {
        settings.minimumSalePricePaise = settings.minimumPricePaise;
      }
      return { settings, recalculatedCount: (res as any)?.recalculatedCount };
    } catch {
      const settings = await this.updateBusinessSettings(payload);
      return { settings };
    }
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
      const list = (raw?.sales ?? raw?.items ?? []).map((s, idx) => ({
        id: s.id,
        number: s.invoice?.number || s.saleNumber || `INV-${String(idx + 1).padStart(3, '0')}`,
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
    const sanitized = sanitizeBackendPermissions(permissions);
    const res = await apiRequest<{ manager?: PublicUser; user?: PublicUser }>(
      `admin/permissions/managers/${managerId}/permissions`,
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions: sanitized }),
      }
    );
    return { manager: (res.manager ?? res.user)! };
  },

  async updateOverallPermissions(
    permissions: string[]
  ): Promise<{ count: number; message?: string }> {
    const sanitized = sanitizeBackendPermissions(permissions);
    const res = await apiRequest<{ count?: number; message?: string; data?: { count: number } }>(
      'admin/permissions/overall',
      {
        method: 'PATCH',
        body: JSON.stringify({ permissions: sanitized }),
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
    try {
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
    } catch (err) {
      if (isMockMode()) {
        try {
          const mockRaw = await handleMockRequest<{
            items?: SaleItem[];
            sales?: SaleItem[];
            pagination?: PaginationMeta;
          }>('admin/sales', {
            method: 'GET',
            params: params as Record<string, string | number | boolean | undefined | null>,
          });
          const list = mockRaw?.items ?? mockRaw?.sales ?? [];
          return {
            items: list,
            sales: list,
            pagination: mockRaw?.pagination ?? { page: 1, pageSize: 20, total: list.length, totalPages: 1 },
          };
        } catch {
          return {
            items: [],
            sales: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
          };
        }
      }
      throw err;
    }
  },

  async getSale(id: string): Promise<{ sale: SaleItem }> {
    try {
      return await apiRequest<{ sale: SaleItem }>(`admin/sales/${id}`, {
        method: 'GET',
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sale: SaleItem }>(`admin/sales/${id}`, {
          method: 'GET',
        });
      }
      throw err;
    }
  },

  async updateSale(id: string, payload: any): Promise<{ sale: SaleItem }> {
    try {
      return await apiRequest<{ sale: SaleItem }>(`admin/sales/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sale: SaleItem }>(`admin/sales/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }
      throw err;
    }
  },

  async receiveSalePayment(
    saleId: string,
    payload: { remark?: string; receivedAt?: string }
  ): Promise<{ sale: SaleItem }> {
    const body: Record<string, string> = {};
    if (payload.remark?.trim()) body.remark = payload.remark.trim();
    if (payload.receivedAt?.trim()) body.receivedAt = payload.receivedAt.trim();
    try {
      return await apiRequest<{ sale: SaleItem }>(`admin/sales/${saleId}/receive-payment`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sale: SaleItem }>(`admin/sales/${saleId}/receive-payment`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      }
      throw err;
    }
  },

  async bulkCompleteSales(payload: {
    saleIds: string[];
    remark?: string;
    receivedAt?: string;
  }): Promise<{ sales: SaleItem[]; completedCount: number }> {
    const body: { saleIds: string[]; remark?: string; receivedAt?: string } = {
      saleIds: payload.saleIds,
    };
    if (payload.remark?.trim()) body.remark = payload.remark.trim();
    if (payload.receivedAt?.trim()) body.receivedAt = payload.receivedAt.trim();
    try {
      return await apiRequest<{ sales: SaleItem[]; completedCount: number }>('admin/sales/bulk-complete', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } catch (err) {
      if (isMockMode()) {
        return await handleMockRequest<{ sales: SaleItem[]; completedCount: number }>(
          'admin/sales/bulk-complete',
          {
            method: 'POST',
            body: JSON.stringify(body),
          }
        );
      }
      throw err;
    }
  },
};
