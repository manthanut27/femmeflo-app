import type { PendingApprovalItem } from './admin';
import type { RequestOptions } from './client';
import type { ManagerSellerItem } from './manager';
import {
  MOCK_ADMIN_DASHBOARD,
  MOCK_ALL_MANAGERS,
  MOCK_ALL_SELLERS,
  MOCK_CATEGORIES,
  MOCK_CURRENT_SHIFT,
  MOCK_CUSTOMERS,
  MOCK_MANAGER_DASHBOARD,
  MOCK_NOTIFICATIONS,
  MOCK_PRODUCTS,
  MOCK_SALES,
  MOCK_SELLER_INCENTIVES,
  MOCK_SELLER_INVENTORY,
  MOCK_SETTINGS,
  MOCK_SHIFT_HISTORY,
  MOCK_STOCK_TRANSACTIONS,
  MOCK_USERS,
  MOCK_WAREHOUSES,
} from './mockData';
import type {
  AdminDashboardData,
  BusinessSettings,
  CategoryItem,
  CheckInPayload,
  CheckOutPayload,
  CustomerItem,
  EndShiftPayload,
  ManagerDashboardData,
  NotificationItem,
  PincodeLookupResponse,
  ProductItem,
  PublicUser,
  SaleItem,
  SellerDashboardData,
  Shift,
  ShiftVisit,
  StartShiftPayload,
  StockTransactionItem,
  WarehouseItem,
} from './types';

// ====================================================
// Stateful In-Memory Mock Database
// ====================================================
class MockDatabase {
  currentUser: PublicUser = MOCK_USERS.seller;
  customers: CustomerItem[] = JSON.parse(JSON.stringify(MOCK_CUSTOMERS));
  sales: SaleItem[] = JSON.parse(JSON.stringify(MOCK_SALES));
  products: ProductItem[] = JSON.parse(JSON.stringify(MOCK_PRODUCTS));
  warehouses: WarehouseItem[] = JSON.parse(JSON.stringify(MOCK_WAREHOUSES));
  categories: CategoryItem[] = JSON.parse(JSON.stringify(MOCK_CATEGORIES));
  sellers: ManagerSellerItem[] = JSON.parse(JSON.stringify(MOCK_ALL_SELLERS));
  managers: PublicUser[] = JSON.parse(JSON.stringify(MOCK_ALL_MANAGERS));
  transactions: StockTransactionItem[] = JSON.parse(JSON.stringify(MOCK_STOCK_TRANSACTIONS));
  inventory = JSON.parse(JSON.stringify(MOCK_SELLER_INVENTORY));
  currentShift: Shift | null = JSON.parse(JSON.stringify(MOCK_CURRENT_SHIFT));
  shiftHistory: Shift[] = JSON.parse(JSON.stringify(MOCK_SHIFT_HISTORY));
  incentives = JSON.parse(JSON.stringify(MOCK_SELLER_INCENTIVES));
  notifications: NotificationItem[] = JSON.parse(JSON.stringify(MOCK_NOTIFICATIONS));
  settings: BusinessSettings = JSON.parse(JSON.stringify(MOCK_SETTINGS));

  setCurrentUser(user: PublicUser) {
    this.currentUser = user;
  }
}

export const mockDb = new MockDatabase();

/**
 * Helper to simulate realistic slight latency (50-150ms) for UI responsiveness
 */
function sleep(ms = 80): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Handle incoming API requests in offline UI mock mode
 */
export async function handleMockRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  await sleep(60);

  const cleanEndpoint = endpoint.replace(/^\/+/, '').split('?')[0];
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

  // ----------------------------------------------------
  // Auth endpoints
  // ----------------------------------------------------
  if (cleanEndpoint.endsWith('auth/login')) {
    const identifier = (body.identifier || '').toLowerCase();
    let selectedUser: PublicUser = mockDb.currentUser;

    if (cleanEndpoint.startsWith('admin') || identifier.includes('admin')) {
      selectedUser = MOCK_USERS.admin;
    } else if (cleanEndpoint.startsWith('manager') || identifier.includes('manager')) {
      selectedUser = MOCK_USERS.manager;
    } else {
      selectedUser = MOCK_USERS.seller;
    }

    mockDb.setCurrentUser(selectedUser);
    return {
      token: `mock_jwt_token_${selectedUser.role.toLowerCase()}_${Date.now()}`,
      user: selectedUser,
    } as unknown as T;
  }

  if (cleanEndpoint === 'auth/me') {
    return { user: mockDb.currentUser } as unknown as T;
  }

  if (cleanEndpoint === 'auth/password') {
    return { success: true, message: 'Password updated successfully in demo mode.' } as unknown as T;
  }

  if (cleanEndpoint === 'auth/forgot-password') {
    return { success: true, message: 'Password recovery email sent (demo mode).' } as unknown as T;
  }

  if (cleanEndpoint === 'auth/reset-password') {
    return { success: true, message: 'Password reset successful.' } as unknown as T;
  }

  if (cleanEndpoint === 'health') {
    return { status: 'ok', database: 'in-memory mock UI engine' } as unknown as T;
  }

  // ----------------------------------------------------
  // Seller: Dashboard
  // ----------------------------------------------------
  if (cleanEndpoint === 'seller/dashboard') {
    const todaySales = mockDb.sales.filter((s) => s.status === 'CONFIRMED');
    const todayAmountPaise = todaySales.reduce((acc, s) => acc + s.totalAmountPaise, 0);
    const todayPackets = todaySales.reduce((acc, s) => acc + s.packetCount, 0);
    const pendingApprovalsCount = mockDb.sales.filter((s) => s.status === 'PENDING').length;

    const data: SellerDashboardData = {
      todaySalesAmountPaise: todayAmountPaise,
      todayPacketsSold: todayPackets,
      stockBalance: mockDb.inventory.balance,
      pendingApprovalsCount,
      activeShift: mockDb.currentShift,
    };
    return data as unknown as T;
  }

  // ----------------------------------------------------
  // Seller: Customers
  // ----------------------------------------------------
  if (cleanEndpoint === 'seller/customers' && method === 'GET') {
    let list = [...mockDb.customers];
    const search = options.params?.search;
    if (search && typeof search === 'string') {
      const q = search.toLowerCase();
      list = list.filter(
        (c) =>
          c.shopName.toLowerCase().includes(q) ||
          c.ownerName.toLowerCase().includes(q) ||
          c.phone.includes(q)
      );
    }
    return {
      items: list,
      pagination: { page: 1, pageSize: 50, total: list.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint.startsWith('seller/customers/') && method === 'GET') {
    const id = cleanEndpoint.replace('seller/customers/', '');
    if (id.startsWith('pincode/')) {
      const pincode = id.replace('pincode/', '');
      const response: PincodeLookupResponse = {
        pincode,
        state: 'Madhya Pradesh',
        district: 'Indore',
        village: 'Rau',
        villages: ['Rau', 'Pithampur', 'Mhow', 'Hatod', 'Sanwer', 'Indore City'],
      };
      return response as unknown as T;
    }
    const customer = mockDb.customers.find((c) => c.id === id) || mockDb.customers[0];
    return { customer } as unknown as T;
  }

  if (cleanEndpoint === 'seller/customers' && method === 'POST') {
    const category = mockDb.categories.find((cat) => cat.id === body.categoryId) || mockDb.categories[0];
    const newCustomer: CustomerItem = {
      id: `cust_${Date.now()}`,
      shopName: body.shopName,
      ownerName: body.ownerName,
      email: body.email,
      phone: body.phone,
      categoryId: body.categoryId,
      category,
      sellerId: mockDb.currentUser.id,
      seller: { id: mockDb.currentUser.id, name: mockDb.currentUser.name },
      address: body.address,
      pincode: body.pincode,
      state: body.state,
      district: body.district,
      village: body.village || null,
      latitude: body.latitude || 22.7196,
      longitude: body.longitude || 75.8577,
      photoUrl: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=400',
      active: true,
      createdAt: new Date().toISOString(),
    };
    mockDb.customers.unshift(newCustomer);
    return { customer: newCustomer } as unknown as T;
  }

  if (cleanEndpoint.includes('/photo') && method === 'POST') {
    return { photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400' } as unknown as T;
  }

  // ----------------------------------------------------
  // Seller: Products & Inventory
  // ----------------------------------------------------
  if (cleanEndpoint === 'seller/products' || cleanEndpoint === 'manager/products' || cleanEndpoint === 'admin/products') {
    return { items: mockDb.products } as unknown as T;
  }

  if (cleanEndpoint === 'seller/inventory') {
    return mockDb.inventory as unknown as T;
  }

  if (cleanEndpoint === 'seller/inventory/transactions') {
    return {
      items: mockDb.transactions,
      pagination: { page: 1, pageSize: 50, total: mockDb.transactions.length, totalPages: 1 },
    } as unknown as T;
  }

  // ----------------------------------------------------
  // Seller: Sales
  // ----------------------------------------------------
  if (cleanEndpoint === 'seller/sales' && method === 'GET') {
    return {
      items: mockDb.sales,
      pagination: { page: 1, pageSize: 50, total: mockDb.sales.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint === 'seller/sales' && method === 'POST') {
    const customer = mockDb.customers.find((c) => c.id === body.customerId) || mockDb.customers[0];
    const items = body.items || [];
    let totalAmountPaise = 0;
    let packetCount = 0;
    let isBelowMinimum = false;

    const lineItems = items.map((it: any, idx: number) => {
      const prod = mockDb.products.find((p) => p.id === it.productId);
      const unitPrice = it.unitPricePaise;
      const minPrice = prod?.minimumPricePaise || mockDb.settings.minimumSalePricePaise;
      if (unitPrice < minPrice) {
        isBelowMinimum = true;
      }
      const itemTotal = unitPrice * it.quantity;
      totalAmountPaise += itemTotal;
      packetCount += it.quantity;
      return {
        id: `sli_${Date.now()}_${idx}`,
        productId: it.productId,
        productName: prod?.name || 'FemmeFlo Product',
        quantity: it.quantity,
        unitPricePaise: unitPrice,
        totalPricePaise: itemTotal,
      };
    });

    const status = isBelowMinimum ? 'PENDING' : 'CONFIRMED';
    const newSale: SaleItem = {
      id: `sale_${Date.now()}`,
      saleNumber: `FF-2026-${String(mockDb.sales.length + 420).padStart(5, '0')}`,
      customerId: body.customerId,
      customer,
      sellerId: mockDb.currentUser.id,
      seller: { id: mockDb.currentUser.id, name: mockDb.currentUser.name },
      totalAmountPaise,
      packetCount,
      status,
      paymentMode: body.paymentMode || 'CASH',
      paymentReference: body.paymentReference || null,
      paidAt: status === 'CONFIRMED' && body.paymentMode !== 'PENDING' ? new Date().toISOString() : null,
      approvalReason: isBelowMinimum ? 'Unit price requested below standard floor price.' : null,
      items: lineItems,
      createdAt: new Date().toISOString(),
      confirmedAt: status === 'CONFIRMED' ? new Date().toISOString() : null,
    };

    mockDb.sales.unshift(newSale);

    // If confirmed, update stock
    if (status === 'CONFIRMED') {
      mockDb.inventory.balance = Math.max(0, mockDb.inventory.balance - packetCount);
      mockDb.inventory.soldPackets += packetCount;
      mockDb.transactions.unshift({
        id: `st_${Date.now()}`,
        productId: items[0]?.productId || 'prod_01',
        product: { name: lineItems[0]?.productName || 'FemmeFlo Sanitary Napkins' },
        quantity: packetCount,
        type: 'SALE',
        reference: newSale.saleNumber,
        sourceLocation: mockDb.inventory.locationName,
        targetLocation: customer.shopName,
        createdAt: new Date().toISOString(),
      });
    }

    return { sale: newSale } as unknown as T;
  }

  if (cleanEndpoint.startsWith('seller/sales/') && method === 'GET') {
    const id = cleanEndpoint.replace('seller/sales/', '');
    const sale = mockDb.sales.find((s) => s.id === id) || mockDb.sales[0];
    return { sale } as unknown as T;
  }

  if (cleanEndpoint.startsWith('seller/sales/') && cleanEndpoint.endsWith('/payment') && method === 'PATCH') {
    const id = cleanEndpoint.replace('seller/sales/', '').replace('/payment', '');
    const sale = mockDb.sales.find((s) => s.id === id);
    if (sale) {
      sale.paymentMode = body.paymentMode || 'CASH';
      sale.paymentReference = body.paymentReference || 'COLLECTED-IN-PERSON';
      sale.paidAt = new Date().toISOString();
      return { sale } as unknown as T;
    }
    return { sale: mockDb.sales[0] } as unknown as T;
  }

  // ----------------------------------------------------
  // Seller: Incentives
  // ----------------------------------------------------
  if (cleanEndpoint === 'seller/incentives') {
    return mockDb.incentives as unknown as T;
  }

  // ----------------------------------------------------
  // Seller: Shifts & Attendance
  // ----------------------------------------------------
  if (cleanEndpoint === 'seller/shifts/current') {
    return { shift: mockDb.currentShift } as unknown as T;
  }

  if (cleanEndpoint === 'seller/shifts/start' && method === 'POST') {
    const payload = body as StartShiftPayload;
    const newShift: Shift = {
      id: `shift_${Date.now()}`,
      sellerId: mockDb.currentUser.id,
      status: 'ACTIVE',
      startTime: new Date().toISOString(),
      startOdometerKm: payload.startOdometerKm,
      startLatitude: payload.startLatitude || 22.7196,
      startLongitude: payload.startLongitude || 75.8577,
      visits: [],
    };
    mockDb.currentShift = newShift;
    return { shift: newShift } as unknown as T;
  }

  if (cleanEndpoint === 'seller/shifts/check-in' && method === 'POST') {
    const payload = body as CheckInPayload;
    const customer = mockDb.customers.find((c) => c.id === payload.customerId) || mockDb.customers[0];
    const visit: ShiftVisit = {
      id: `visit_${Date.now()}`,
      shiftId: mockDb.currentShift?.id || 'shift_active',
      customerId: payload.customerId,
      customer: { shopName: customer.shopName, ownerName: customer.ownerName },
      checkInTime: new Date().toISOString(),
      latitude: payload.latitude || customer.latitude,
      longitude: payload.longitude || customer.longitude,
      orderPlaced: false,
    };
    if (mockDb.currentShift) {
      mockDb.currentShift.visits = mockDb.currentShift.visits || [];
      mockDb.currentShift.visits.push(visit);
    }
    return { visit } as unknown as T;
  }

  if (cleanEndpoint === 'seller/shifts/check-out' && method === 'POST') {
    const payload = body as CheckOutPayload;
    let visit: ShiftVisit | undefined;
    if (mockDb.currentShift?.visits) {
      visit = mockDb.currentShift.visits.find((v) => v.id === payload.visitId);
      if (visit) {
        visit.checkOutTime = new Date().toISOString();
        visit.summary = payload.summary || 'Visit completed.';
        visit.orderPlaced = payload.orderPlaced ?? false;
      }
    }
    return { visit: visit || { id: payload.visitId, shiftId: 's', customerId: 'c', checkInTime: '' } } as unknown as T;
  }

  if (cleanEndpoint === 'seller/shifts/end' && method === 'POST') {
    const payload = body as EndShiftPayload;
    if (mockDb.currentShift) {
      mockDb.currentShift.status = 'COMPLETED';
      mockDb.currentShift.endTime = new Date().toISOString();
      mockDb.currentShift.endOdometerKm = payload.endOdometerKm;
      mockDb.currentShift.endLatitude = payload.endLatitude || 22.7196;
      mockDb.currentShift.endLongitude = payload.endLongitude || 75.8577;
      mockDb.shiftHistory.unshift(mockDb.currentShift);
      const finishedShift = mockDb.currentShift;
      mockDb.currentShift = null;
      return { shift: finishedShift } as unknown as T;
    }
    return {
      shift: {
        id: `shift_${Date.now()}`,
        sellerId: mockDb.currentUser.id,
        status: 'COMPLETED',
        startTime: new Date().toISOString(),
        startOdometerKm: payload.endOdometerKm,
        endOdometerKm: payload.endOdometerKm,
      },
    } as unknown as T;
  }

  if (cleanEndpoint === 'seller/shifts/history') {
    return {
      items: mockDb.shiftHistory,
      pagination: { page: 1, pageSize: 20, total: mockDb.shiftHistory.length, totalPages: 1 },
    } as unknown as T;
  }

  // ----------------------------------------------------
  // Manager Endpoints
  // ----------------------------------------------------
  if (cleanEndpoint === 'manager/dashboard') {
    const managerDash: ManagerDashboardData = {
      ...MOCK_MANAGER_DASHBOARD,
      totalCustomers: mockDb.customers.length,
      totalSellers: mockDb.sellers.length,
    };
    return managerDash as unknown as T;
  }

  if (cleanEndpoint === 'manager/sellers' && method === 'GET') {
    return {
      items: mockDb.sellers,
      pagination: { page: 1, pageSize: 50, total: mockDb.sellers.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint === 'manager/sellers' && method === 'POST') {
    const newSeller: ManagerSellerItem = {
      id: `usr_seller_${Date.now()}`,
      sellerId: `usr_seller_${Date.now()}`,
      name: body.name,
      email: body.email,
      phone: body.phone || '+91 98765 00000',
      role: 'SELLER',
      active: true,
      state: body.state || 'Madhya Pradesh',
      district: body.district || 'Indore',
      village: body.village || 'Rau',
      managerId: mockDb.currentUser.id,
      customersCount: 0,
      totalSalesPaise: 0,
      createdAt: new Date().toISOString(),
    };
    mockDb.sellers.unshift(newSeller);
    return { seller: newSeller } as unknown as T;
  }

  if (cleanEndpoint.startsWith('manager/sellers/') && method === 'GET') {
    const id = cleanEndpoint.replace('manager/sellers/', '');
    const seller = mockDb.sellers.find((s) => s.id === id || s.sellerId === id) || mockDb.sellers[0];
    return { seller } as unknown as T;
  }

  if (cleanEndpoint === 'manager/customers') {
    return {
      items: mockDb.customers,
      pagination: { page: 1, pageSize: 50, total: mockDb.customers.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint === 'manager/sales') {
    return {
      items: mockDb.sales,
      pagination: { page: 1, pageSize: 50, total: mockDb.sales.length, totalPages: 1 },
    } as unknown as T;
  }

  // ----------------------------------------------------
  // Admin Endpoints
  // ----------------------------------------------------
  if (cleanEndpoint === 'admin/dashboard') {
    const pendingCount = mockDb.sales.filter((s) => s.status === 'PENDING').length;
    const adminDash: AdminDashboardData = {
      ...MOCK_ADMIN_DASHBOARD,
      totalCustomers: mockDb.customers.length,
      activeSellers: mockDb.sellers.length,
      pendingApprovalsCount: pendingCount,
    };
    return adminDash as unknown as T;
  }

  if (cleanEndpoint === 'admin/approvals' && method === 'GET') {
    const pendingSales = mockDb.sales.filter((s) => s.status === 'PENDING');
    const items: PendingApprovalItem[] = pendingSales.map((sale) => ({
      ...sale,
      requestedUnitPricePaise: sale.items?.[0]?.unitPricePaise || 2200,
      minimumPricePaise: mockDb.settings.minimumSalePricePaise,
    }));
    return {
      items,
      pagination: { page: 1, pageSize: 20, total: items.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint.startsWith('admin/approvals/') && cleanEndpoint.endsWith('/approve') && method === 'POST') {
    const saleId = cleanEndpoint.split('/')[2];
    const sale = mockDb.sales.find((s) => s.id === saleId);
    if (sale) {
      sale.status = 'CONFIRMED';
      sale.confirmedAt = new Date().toISOString();

      // Deduct stock balance and record stock ledger transaction upon admin approval
      mockDb.inventory.balance = Math.max(0, mockDb.inventory.balance - sale.packetCount);
      mockDb.inventory.soldPackets += sale.packetCount;
      mockDb.transactions.unshift({
        id: `st_${Date.now()}`,
        productId: sale.items?.[0]?.productId || 'prod_01',
        product: { name: sale.items?.[0]?.productName || 'FemmeFlo Sanitary Napkins' },
        quantity: sale.packetCount,
        type: 'SALE',
        reference: sale.saleNumber,
        sourceLocation: mockDb.inventory.locationName,
        targetLocation: sale.customer?.shopName || 'Retail Customer',
        createdAt: new Date().toISOString(),
      });

      return { sale } as unknown as T;
    }
    return { sale: mockDb.sales[0] } as unknown as T;
  }

  if (cleanEndpoint.startsWith('admin/approvals/') && cleanEndpoint.endsWith('/reject') && method === 'POST') {
    const saleId = cleanEndpoint.split('/')[2];
    const sale = mockDb.sales.find((s) => s.id === saleId);
    if (sale) {
      sale.status = 'REJECTED';
      sale.rejectionReason = body.reason || 'Price discount rejected by Super Admin';
      return { sale } as unknown as T;
    }
    return { sale: mockDb.sales[0] } as unknown as T;
  }

  if (cleanEndpoint === 'admin/warehouses') {
    return { items: mockDb.warehouses } as unknown as T;
  }

  if (cleanEndpoint === 'admin/inventory/receipts' && method === 'POST') {
    return { success: true, message: 'Stock receipt recorded successfully in warehouse inventory.' } as unknown as T;
  }

  if (cleanEndpoint === 'admin/inventory/transfers' && method === 'POST') {
    return { success: true, message: 'Stock transfer recorded and dispatched.' } as unknown as T;
  }

  if (cleanEndpoint === 'admin/managers' && method === 'GET') {
    return {
      items: mockDb.managers,
      pagination: { page: 1, pageSize: 50, total: mockDb.managers.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint === 'admin/managers' && method === 'POST') {
    const newManager: PublicUser = {
      id: `usr_manager_${Date.now()}`,
      name: body.name,
      email: body.email,
      phone: body.phone || '+91 98765 00000',
      role: 'MANAGER',
      active: true,
      state: body.state || 'Madhya Pradesh',
      district: body.district || 'Indore',
      createdAt: new Date().toISOString(),
    };
    mockDb.managers.unshift(newManager);
    return { manager: newManager } as unknown as T;
  }

  if (cleanEndpoint === 'admin/sellers' && method === 'GET') {
    return {
      items: mockDb.sellers,
      pagination: { page: 1, pageSize: 50, total: mockDb.sellers.length, totalPages: 1 },
    } as unknown as T;
  }

  if (cleanEndpoint === 'admin/sellers' && method === 'POST') {
    const newSeller: ManagerSellerItem = {
      id: `usr_seller_${Date.now()}`,
      sellerId: `usr_seller_${Date.now()}`,
      name: body.name,
      email: body.email,
      phone: body.phone || '+91 98765 00000',
      role: 'SELLER',
      active: true,
      state: body.state || 'Madhya Pradesh',
      district: body.district || 'Indore',
      village: 'Indore City',
      managerId: body.managerId || mockDb.managers[0]?.id,
      customersCount: 0,
      totalSalesPaise: 0,
      createdAt: new Date().toISOString(),
    };
    mockDb.sellers.unshift(newSeller);
    return { seller: newSeller } as unknown as T;
  }

  if (cleanEndpoint === 'admin/settings' && method === 'GET') {
    return mockDb.settings as unknown as T;
  }

  if (cleanEndpoint === 'admin/settings' && method === 'PATCH') {
    mockDb.settings = { ...mockDb.settings, ...body };
    return mockDb.settings as unknown as T;
  }

  // ----------------------------------------------------
  // Shared: Categories
  // ----------------------------------------------------
  if (cleanEndpoint === 'categories' && method === 'GET') {
    return { items: mockDb.categories } as unknown as T;
  }

  if (cleanEndpoint === 'categories' && method === 'POST') {
    const newCat: CategoryItem = {
      id: `cat_${Date.now()}`,
      name: body.name,
      description: body.description || '',
      active: true,
      createdAt: new Date().toISOString(),
    };
    mockDb.categories.push(newCat);
    return { category: newCat } as unknown as T;
  }

  if (cleanEndpoint.startsWith('categories/') && method === 'PATCH') {
    const id = cleanEndpoint.replace('categories/', '');
    const cat = mockDb.categories.find((c) => c.id === id);
    if (cat) {
      Object.assign(cat, body);
      return { category: cat } as unknown as T;
    }
    return { category: mockDb.categories[0] } as unknown as T;
  }

  // ----------------------------------------------------
  // Shared: Notifications
  // ----------------------------------------------------
  if (cleanEndpoint === 'notifications' && method === 'GET') {
    const unreadCount = mockDb.notifications.filter((n) => !n.read).length;
    return { items: mockDb.notifications, unreadCount } as unknown as T;
  }

  if (cleanEndpoint.startsWith('notifications/') && cleanEndpoint.endsWith('/read') && method === 'PATCH') {
    const id = cleanEndpoint.replace('notifications/', '').replace('/read', '');
    const notif = mockDb.notifications.find((n) => n.id === id);
    if (notif) notif.read = true;
    return { success: true, message: 'Notification marked as read.' } as unknown as T;
  }

  if (cleanEndpoint === 'notifications/read-all' && method === 'POST') {
    mockDb.notifications.forEach((n) => (n.read = true));
    return { success: true, message: 'All notifications marked as read.' } as unknown as T;
  }

  // Fallback for unhandled endpoints
  console.warn(`[MockApi] Unhandled mock endpoint: ${method} ${cleanEndpoint}`);
  return {} as unknown as T;
}
