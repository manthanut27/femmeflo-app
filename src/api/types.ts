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
  isSeller?: boolean;
  active: boolean;
  state?: string | null;
  district?: string | null;
  village?: string | null;
  managerId?: string | null;
  permissions?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface LoginPayload {
  identifier: string;
  password: string;
  roleHint?: 'admin' | 'manager' | 'seller';
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
  name?: string;
  contactName?: string;
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
  email?: string;
  phone: string;
  categoryId: string;
  address: string;
  pincode: string;
  state: string;
  district: string;
  village?: string;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  noPhotoReason?: string;
  photoSkipReason?: string;
  photoPath?: string;
}

export interface BulkCustomerRow {
  shopName: string;
  contactName: string;
  phone: string;
  email?: string;
  categoryId?: string;
  sellerId?: string;
  shopNumber?: string;
  streetName?: string;
  pincode?: string;
  address?: string;
  state?: string;
  district?: string;
  village?: string;
  noPhotoReason?: string;
  photoPath?: string;
  latitude?: number | string;
  longitude?: number | string;
  accuracy?: number;
  createdAt?: string;
}

export interface CreateBulkCustomersPayload {
  customers: BulkCustomerRow[];
  defaultSellerId?: string;
  defaultCategoryId?: string;
  defaultState?: string;
  defaultDistrict?: string;
  defaultVillage?: string;
  defaultNoPhotoReason?: string;
}

export interface BulkCustomerResponse {
  success?: boolean;
  message?: string;
  count?: number;
  customers?: CustomerItem[];
  insertedCount?: number;
  failedCount?: number;
  errors?: Array<{ row: number; error: string }>;
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
  createdAt?: string;
  updatedAt?: string;
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
export type SaleStatus = 'PENDING' | 'PENDING_APPROVAL' | 'APPROVED' | 'CONFIRMED' | 'REJECTED';
export type PaymentMode = 'CASH' | 'BANK' | 'PENDING';

export interface InvoiceSummary {
  id: string;
  number: string;
  snapshot?: Record<string, unknown> | null;
}

export interface SaleLineItem {
  id?: string;
  productId: string;
  productName?: string;
  product?: { id: string; name: string; sku?: string | null };
  quantity: number;
  unitPricePaise: number;
  totalPricePaise?: number;
  totalPaise?: number;
}

export interface SaleItem {
  id: string;
  saleNumber?: string;
  customerId: string;
  customer?: CustomerItem & { contactName?: string };
  sellerId: string;
  seller?: { id: string; name: string; phone?: string | null };
  totalAmountPaise: number;
  totalPaise?: number;
  packetCount: number;
  quantity?: number;
  unitPricePaise?: number;
  status: SaleStatus;
  paymentMode: PaymentMode;
  paymentReference?: string | null;
  paidAt?: string | null;
  approvalReason?: string | null;
  rejectionReason?: string | null;
  items?: SaleLineItem[];
  lineItems?: SaleLineItem[];
  invoice?: InvoiceSummary | null;
  payments?: Array<{ id: string; amountPaise: number; mode: string; reference?: string | null }>;
  requestKey?: string | null;
  customerFeedback?: string | null;
  createdAt: string;
  requestedAt?: string;
  confirmedAt?: string | null;
}

export interface CreateSalePayload {
  customerId: string;
  paymentMode: PaymentMode;
  paymentReference?: string;
  idempotencyKey?: string;
  requestKey?: string;
  customerFeedback?: string;
  quantity?: number;
  unitPricePaise?: number;
  items?: Array<{
    productId: string;
    quantity: number;
    unitPricePaise: number;
  }>;
}

export interface UpdateSalePayload {
  customerId?: string;
  quantity?: number;
  unitPricePaise?: number;
  paymentMode?: PaymentMode;
  customerFeedback?: string;
}

export interface CollectPaymentPayload {
  paymentMode: 'CASH' | 'BANK';
  paymentReference?: string;
}

// ----------------------------------------------------
// Shift & Duty Attendance Types
// ----------------------------------------------------
export type ShiftStatus = 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OPEN' | 'CLOSED';

export interface ShiftVisit {
  id: string;
  shiftId: string;
  customerId?: string | null;
  customer?: { id?: string; shopName: string; ownerName?: string; phone?: string } | null;
  shopName?: string;
  checkInTime: string;
  checkOutTime?: string | null;
  durationMins?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  accuracy?: number | null;
  visitReason?: string | null;
  feedback?: string | null;
  orderPlaced?: boolean;
  saleDone?: boolean | null;
  customerFeedback?: string | null;
  saleId?: string | null;
  sale?: { id: string; totalPaise: number; quantity: number; paymentMode: string; status: string } | null;
  summary?: string | null;
  notes?: string | null;
  createdAt?: string;
}

export interface Shift {
  id: string;
  sellerId: string;
  seller?: { id: string; name: string; phone?: string | null; employeeCode?: string | null };
  status: ShiftStatus;
  startTime: string;
  endTime?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMins?: number | null;
  startOdometerKm: number;
  endOdometerKm?: number | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  startAddress?: string | null;
  startFaceVerified?: boolean | null;
  startFacePhoto?: string | null;
  endLatitude?: number | null;
  endLongitude?: number | null;
  endAddress?: string | null;
  endFaceVerified?: boolean | null;
  endFacePhoto?: string | null;
  totalDistanceKm?: number;
  territory?: string | null;
  notes?: string | null;
  visits?: ShiftVisit[];
}

export interface StartShiftPayload {
  startOdometerKm?: number;
  startLatitude?: number;
  startLongitude?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  notes?: string;
  remarks?: string;
  faceVerified?: boolean;
  facePhoto?: string;
  faceConfidence?: number;
  faceMethod?: string;
}

export interface CheckInPayload {
  customerId?: string;
  shopName?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  summary?: string;
}

export interface CheckOutPayload {
  visitId: string;
  latitude?: number;
  longitude?: number;
  summary?: string;
  notes?: string;
  orderPlaced?: boolean;
  saleDone?: boolean;
  customerFeedback?: string;
  saleId?: string;
  outcome?: string;
}

export interface EndShiftPayload {
  endOdometerKm?: number;
  endLatitude?: number;
  endLongitude?: number;
  latitude?: number;
  longitude?: number;
  address?: string;
  notes?: string;
  remarks?: string;
  faceVerified?: boolean;
  facePhoto?: string;
  faceConfidence?: number;
  faceMethod?: string;
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
  todaySalesAmountPaise?: number;
  todaySalesPaise?: number;
  todayOrdersCount?: number;
  todayPacketsSold?: number;
  monthSalesPaise?: number;
  lowStockCount?: number;
  stockBalance?: number;
  pendingApprovalsCount?: number;
  activeShift?: Shift | null;
  metrics?: {
    assignedPackets: number;
    soldPackets: number;
    remainingPackets: number;
    totalIncentivePaise: number;
    totalIncentiveRupees: number;
  };
  recentSales?: SaleItem[];
}

export interface SalesReportQuery {
  startDate?: string;
  endDate?: string;
  from?: string;
  to?: string;
  state?: string;
  district?: string;
  village?: string;
  managerId?: string;
  sellerId?: string;
  paymentMode?: PaymentMode;
  status?: string;
  groupBy?: 'date' | 'seller' | 'manager' | 'state' | 'district' | 'village';
  format?: 'json' | 'csv' | 'xlsx';
}

export interface SalesReportGroupItem {
  label: string;
  count: number;
  quantity: number;
  totalPaise: number;
}

export interface SalesReportData {
  summary: {
    totalSalesCount: number;
    totalQuantitySold: number;
    grossSalesPaise: number;
    grossSalesRupees: number;
    netSalesPaise: number;
    netSalesRupees: number;
    averageOrderValueRupees: number;
  };
  groups?: SalesReportGroupItem[];
  items: SaleItem[];
}

export interface ManagerDashboardData {
  totalSellers: number;
  activeSellersCount: number;
  monthlyRevenuePaise: number;
  monthlyPacketsSold: number;
  totalCustomers: number;
  metrics?: {
    totalSellers?: number;
    activeSellersCount?: number;
    monthlyRevenuePaise?: number;
    monthlyPacketsSold?: number;
    totalCustomers?: number;
  };
}

export interface AdminDashboardData {
  totalRevenuePaise: number;
  totalPacketsSold: number;
  totalCustomers: number;
  activeSellers: number;
  pendingApprovalsCount: number;
  warehouseStockBalance: number;
  metrics?: {
    totalPacketsSold: number;
    totalEarningsPaise: number;
    totalEarningsRupees?: number;
    totalStates?: number;
    totalShops?: number;
    totalManagers?: number;
    totalSellers?: number;
    totalInventory?: number;
    hqStock?: number;
    warehouseStock?: number;
    sellerStock?: number;
    totalIncentivePaise?: number;
    totalIncentiveRupees?: number;
  };
  appliedFilters?: Record<string, unknown>;
}

export interface BusinessSettings {
  minimumPricePaise?: number;
  minimumSalePricePaise?: number;
  incentiveRatePaise?: number | null;
  lowStockThreshold?: number;
  companyName?: string;
  companyGst?: string;
  companyPan?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  invoiceTerms?: string;
}

export interface StockLocationItem {
  id: string;
  name: string;
  type: 'HQ' | 'WAREHOUSE' | 'SELLER';
  balance: number;
  sellerId?: string | null;
  seller?: { id: string; name: string; phone?: string | null } | null;
  productBalances?: Array<{ productId: string; productName: string; balance: number }>;
}

export interface InventorySummaryData {
  totalStock: number;
  hqStock: number;
  warehouseStock: number;
  sellerStock: number;
  totalReceived: number;
  totalTransferred: number;
  totalSold: number;
  products: Array<{ id: string; name: string; sku?: string | null; balance: number }>;
  locations: StockLocationItem[];
  warehouses: StockLocationItem[];
  sellers: StockLocationItem[];
}

export interface ManagerInventoryData {
  summary?: {
    totalSellers?: number;
    totalAssigned?: number;
    totalSold?: number;
    totalRemaining?: number;
  };
  sellers?: Array<{
    seller: {
      id: string;
      name: string;
      phone?: string | null;
      state?: string | null;
      district?: string | null;
      village?: string | null;
    };
    assigned: number;
    sold: number;
    remaining: number;
  }> | StockLocationItem[];
  locations?: StockLocationItem[];
  warehouses?: StockLocationItem[];
  totalStock?: number;
}

export interface IncentiveItem {
  id: string;
  userId: string;
  userName?: string;
  userRole?: string;
  periodYear: number;
  periodMonth: number;
  earnedPaise: number;
  adjustedPaise: number;
  paidPaise: number;
  netPayablePaise: number;
  status: 'UNPAID' | 'PARTIALLY_PAID' | 'PAID';
  updatedAt?: string;
}

export interface IncentiveSummaryItem {
  id: string;
  sellerId: string;
  sellerName?: string;
  name?: string;
  phone?: string | null;
  role?: string;
  ratePerPacketRupees?: number;
  effectiveRatePaise?: number;
  totalEarnedPaise: number;
  totalPaidPaise: number;
  outstandingPaise: number;
  netPayablePaise?: number;
  status: string;
  currentMonth?: any;
  previousMonth?: any;
}

export interface AdminIncentiveListResponse {
  summary?: {
    totalEarnedPaise: number;
    totalEarnedRupees?: number;
    totalPaidPaise: number;
    totalPaidRupees?: number;
    totalPendingPaise: number;
    totalPendingRupees?: number;
    totalAdditionsPaise?: number;
    totalDeductionsPaise?: number;
    pendingEmployeesCount?: number;
    currentMonth?: any;
    previousMonth?: any;
  };
  sellers?: IncentiveSummaryItem[];
  managers?: IncentiveSummaryItem[];
  items?: IncentiveSummaryItem[];
  pagination?: PaginationMeta;
}

export interface ManagerIncentiveData {
  summary: {
    totalEarnedPaise: number;
    totalPaidPaise: number;
    totalPendingPaise: number;
    sellerCount: number;
  };
  sellers: Array<{
    id: string;
    name: string;
    phone?: string;
    totalEarnedPaise: number;
    totalPaidPaise: number;
    netPayablePaise: number;
    status: string;
  }>;
}

export interface UpdateUserRatePayload {
  ratePaise: number;
  effectiveDate?: string;
  reason?: string;
}

export interface CreateAdjustmentPayload {
  type: 'ADD' | 'DEDUCT';
  amountPaise: number;
  reason: string;
  adjustmentDate?: string;
}

export interface CreatePayoutPayload {
  amountPaise: number;
  paymentMethod?: string;
  referenceId?: string;
  remarks?: string;
  paymentDate?: string;
  requestKey?: string;
  periodYear?: number;
  periodMonth?: number;
}

export interface CreateProductPayload {
  name: string;
  sku?: string;
  basePricePaise: number;
  minimumPricePaise: number;
  active?: boolean;
}

export interface UpdateProductPayload {
  name?: string;
  sku?: string | null;
  basePricePaise?: number;
  minimumPricePaise?: number;
  active?: boolean;
}

export interface ReverseGeocodeResult {
  latitude: number;
  longitude: number;
  formattedAddress: string;
  state: string | null;
  district: string | null;
  sublocality: string | null;
  pincode: string | null;
  locationType?: string;
}

export interface InvoiceCompanyInfo {
  name: string;
  gst?: string | null;
  pan?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  terms?: string | null;
}

export interface InvoiceSnapshot {
  invoiceNumber: string;
  saleId: string;
  date: string;
  company?: InvoiceCompanyInfo;
  customer: {
    shopName: string;
    contactName: string;
    phone: string;
    state?: string | null;
    district?: string | null;
    village?: string | null;
  };
  seller: {
    name: string;
    phone: string;
  };
  quantity: number;
  unitPricePaise: number;
  totalPaise: number;
  paymentMode: string;
  lineItems?: Array<{
    productName: string;
    productSku?: string | null;
    quantity: number;
    unitPricePaise: number;
    totalPaise: number;
  }>;
}

export interface InvoiceItem {
  id: string;
  number: string;
  saleId: string;
  pdfPath?: string | null;
  createdAt: string;
  updatedAt?: string;
  sale?: {
    id: string;
    saleNumber?: string;
    quantity: number;
    packetCount?: number;
    totalPaise: number;
    totalAmountPaise?: number;
    paymentMode: string;
    customer?: {
      id: string;
      shopName: string;
      contactName?: string;
      phone?: string;
      email?: string;
    } | null;
    seller?: {
      id: string;
      name: string;
      phone?: string | null;
    } | null;
  } | null;
  deliveries?: Array<{ channel: string; status: string; sentAt?: string }>;
}

export interface PendingApprovalItem extends SaleItem {
  requestedUnitPricePaise?: number;
  minimumPricePaise?: number;
}

export interface ManagerItem extends PublicUser {
  sellersCount?: number;
  customersCount?: number;
}

export interface ListSalesParams {
  page?: number;
  pageSize?: number;
  status?: 'PENDING_APPROVAL' | 'CONFIRMED' | 'REJECTED';
  paymentMode?: 'CASH' | 'BANK' | 'PENDING';
  period?: 'all' | 'this_month' | 'last_month';
  customerId?: string;
  sellerId?: string;
  search?: string;
}

export interface UserIncentiveDetails {
  user: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    role: string;
    employeeCode?: string;
    designation?: string;
    state?: string | null;
    district?: string | null;
    village?: string | null;
    manager?: { id: string; name: string; phone?: string | null } | null;
    incentiveRatePaise?: number | null;
    effectiveRatePaise: number;
    effectiveRateRupees: number;
    isCustomRate: boolean;
  };
  summary: any;
  rateHistory?: any[];
  adjustments?: any[];
  payouts?: any[];
  sales?: any[];
}

export interface ManagerSellerItem extends PublicUser {
  sellerId?: string;
  customersCount?: number;
  totalSalesPaise?: number;
}

export type SellerItem = ManagerSellerItem;

export class ApiError extends Error {
  statusCode: number;
  status: number;
  data?: unknown;
  isNetworkError: boolean;

  constructor(message: string, statusCode = 500, data?: unknown, isNetworkError = false) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.status = statusCode;
    this.data = data;
    this.isNetworkError = isNetworkError;
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
  timeoutMs?: number;
}
