/**
 * FemmeFlo Mobile Application Domain & API Types
 */

export type AuthRole = 'SUPER_ADMIN' | 'MANAGER' | 'SELLER';

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: AuthRole;
  active: boolean;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  managerId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
}

export interface LoginResponseData {
  token: string;
  user: PublicUser;
}

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string | {
    code?: string;
    message?: string;
    fieldErrors?: Record<string, string>;
  };
}

// ----------------------------------------------------
// Customer Types
// ----------------------------------------------------
export interface CategoryItem {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  createdAt?: string;
}

export interface CustomerItem {
  id: string;
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  categoryId?: string | null;
  category?: CategoryItem | null;
  sellerId?: string;
  seller?: { id: string; name: string } | null;
  address: string;
  pincode: string;
  state: string;
  district: string;
  village?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  photoUrl?: string | null;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateCustomerPayload {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  categoryId: string;
  address: string;
  pincode: string;
  state: string;
  district: string;
  village?: string;
  latitude?: number;
  longitude?: number;
}

export interface PincodeLookupResponse {
  pincode: string;
  state: string;
  district: string;
  village: string;
  villages: string[];
}

// ----------------------------------------------------
// Product & Inventory Types
// ----------------------------------------------------
export interface ProductItem {
  id: string;
  name: string;
  sku: string | null;
  basePricePaise: number;
  minimumPricePaise: number;
  description?: string | null;
  active?: boolean;
}

export interface ProductStockItem {
  productId: string;
  productName: string;
  productSku?: string | null;
  balance: number;
  assigned: number;
  sold: number;
}

export interface SellerInventoryData {
  balance: number;
  remaining?: number;
  assignedPackets: number;
  soldPackets: number;
  locationName: string;
  products?: ProductStockItem[];
}

export interface StockTransactionItem {
  id: string;
  productId: string;
  product?: { name: string; sku?: string };
  quantity: number;
  type: string;
  reference?: string | null;
  sourceLocation?: string | null;
  targetLocation?: string | null;
  createdAt: string;
}

export interface WarehouseItem {
  id: string;
  name: string;
  code: string;
  state: string;
  district: string;
  address?: string;
  active: boolean;
}

// ----------------------------------------------------
// Sale & POS Types
// ----------------------------------------------------
export type SaleStatus = 'PENDING' | 'APPROVED' | 'CONFIRMED' | 'REJECTED';
export type PaymentMode = 'CASH' | 'BANK' | 'PENDING';

export interface SaleLineItem {
  id?: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPricePaise: number;
  totalPricePaise?: number;
}

export interface SaleItem {
  id: string;
  saleNumber?: string;
  customerId: string;
  customer?: CustomerItem;
  sellerId: string;
  seller?: { id: string; name: string };
  totalAmountPaise: number;
  packetCount: number;
  status: SaleStatus;
  paymentMode: PaymentMode;
  paymentReference?: string | null;
  paidAt?: string | null;
  approvalReason?: string | null;
  rejectionReason?: string | null;
  items?: SaleLineItem[];
  createdAt: string;
  confirmedAt?: string | null;
}

export interface CreateSalePayload {
  customerId: string;
  paymentMode: PaymentMode;
  paymentReference?: string;
  items: Array<{
    productId: string;
    quantity: number;
    unitPricePaise: number;
  }>;
}

export interface CollectPaymentPayload {
  paymentMode: 'CASH' | 'BANK';
  paymentReference?: string;
}

// ----------------------------------------------------
// Shift & Duty Attendance Types
// ----------------------------------------------------
export type ShiftStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED';

export interface ShiftVisit {
  id: string;
  shiftId: string;
  customerId: string;
  customer?: { shopName: string; ownerName: string };
  checkInTime: string;
  checkOutTime?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  orderPlaced?: boolean;
  summary?: string | null;
}

export interface Shift {
  id: string;
  sellerId: string;
  status: ShiftStatus;
  startTime: string;
  endTime?: string | null;
  startOdometerKm: number;
  endOdometerKm?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  visits?: ShiftVisit[];
}

export interface StartShiftPayload {
  startOdometerKm: number;
  startLatitude?: number;
  startLongitude?: number;
}

export interface CheckInPayload {
  customerId: string;
  latitude?: number;
  longitude?: number;
}

export interface CheckOutPayload {
  visitId: string;
  summary?: string;
  orderPlaced?: boolean;
}

export interface EndShiftPayload {
  endOdometerKm: number;
  endLatitude?: number;
  endLongitude?: number;
  remarks?: string;
}

// ----------------------------------------------------
// Incentives
// ----------------------------------------------------
export interface SellerIncentiveData {
  currentMonthEarnedPaise: number;
  totalPacketsSoldMonth: number;
  ratePerPacketPaise: number;
  pendingPayoutPaise: number;
  history?: Array<{
    month: string;
    packetsSold: number;
    earnedPaise: number;
    ratePerPacketPaise: number;
    status: string;
  }>;
}

// ----------------------------------------------------
// Notifications
// ----------------------------------------------------
export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  message: string;
  read: boolean;
  type?: string;
  createdAt: string;
}

// ----------------------------------------------------
// Dashboard Aggregates
// ----------------------------------------------------
export interface SellerDashboardData {
  todaySalesAmountPaise: number;
  todayPacketsSold: number;
  stockBalance: number;
  pendingApprovalsCount: number;
  activeShift?: Shift | null;
}

export interface ManagerDashboardData {
  totalSellers: number;
  activeSellersCount: number;
  monthlyRevenuePaise: number;
  monthlyPacketsSold: number;
  totalCustomers: number;
}

export interface AdminDashboardData {
  totalRevenuePaise: number;
  totalPacketsSold: number;
  totalCustomers: number;
  activeSellers: number;
  pendingApprovalsCount: number;
  warehouseStockBalance: number;
}

export interface BusinessSettings {
  minimumSalePricePaise: number;
  lowStockThreshold?: number;
}
