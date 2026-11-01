import type { ManagerSellerItem } from './manager';
import type {
  AdminDashboardData,
  BusinessSettings,
  CategoryItem,
  CustomerItem,
  ManagerDashboardData,
  NotificationItem,
  ProductItem,
  PublicUser,
  SaleItem,
  SellerDashboardData,
  SellerIncentiveData,
  SellerInventoryData,
  Shift,
  StockTransactionItem,
  WarehouseItem,
} from './types';

// ==========================================
// 1. Mock Users
// ==========================================
export const MOCK_USERS: Record<string, PublicUser> = {
  seller: {
    id: 'usr_seller_01',
    name: 'Pooja Sharma',
    email: 'seller@femmeflo.com',
    phone: '+91 98765 43210',
    role: 'SELLER',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Rau',
    managerId: 'usr_manager_01',
    createdAt: '2026-01-15T09:00:00Z',
  },
  manager: {
    id: 'usr_manager_01',
    name: 'Rajesh Kumar',
    email: 'manager@femmeflo.com',
    phone: '+91 98765 43220',
    role: 'MANAGER',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Indore',
    createdAt: '2025-11-01T09:00:00Z',
  },
  admin: {
    id: 'usr_admin_01',
    name: 'Anita Mehta',
    email: 'admin@femmeflo.com',
    phone: '+91 98765 43230',
    role: 'SUPER_ADMIN',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Bhopal',
    createdAt: '2025-08-01T09:00:00Z',
  },
};

export const MOCK_ALL_MANAGERS: PublicUser[] = [
  MOCK_USERS.manager,
  {
    id: 'usr_manager_02',
    name: 'Sunil Verma',
    email: 'sunil.manager@femmeflo.com',
    phone: '+91 98765 43221',
    role: 'MANAGER',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Bhopal',
    createdAt: '2025-12-10T10:00:00Z',
  },
  {
    id: 'usr_manager_03',
    name: 'Meenakshi Iyer',
    email: 'meenakshi@femmeflo.com',
    phone: '+91 98765 43222',
    role: 'MANAGER',
    active: true,
    state: 'Maharashtra',
    district: 'Nagpur',
    createdAt: '2026-02-01T10:00:00Z',
  },
];

export const MOCK_ALL_SELLERS: ManagerSellerItem[] = [
  {
    ...MOCK_USERS.seller,
    sellerId: 'usr_seller_01',
    customersCount: 18,
    totalSalesPaise: 4850000,
  },
  {
    id: 'usr_seller_02',
    sellerId: 'usr_seller_02',
    name: 'Kavita Patel',
    email: 'kavita.seller@femmeflo.com',
    phone: '+91 98765 43212',
    role: 'SELLER',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Mhow',
    managerId: 'usr_manager_01',
    customersCount: 22,
    totalSalesPaise: 6120000,
    createdAt: '2026-01-20T11:00:00Z',
  },
  {
    id: 'usr_seller_03',
    sellerId: 'usr_seller_03',
    name: 'Aakash Solanki',
    email: 'aakash.seller@femmeflo.com',
    phone: '+91 98765 43213',
    role: 'SELLER',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Sanwer',
    managerId: 'usr_manager_01',
    customersCount: 14,
    totalSalesPaise: 3890000,
    createdAt: '2026-02-05T09:30:00Z',
  },
  {
    id: 'usr_seller_04',
    sellerId: 'usr_seller_04',
    name: 'Deepika Rathore',
    email: 'deepika.seller@femmeflo.com',
    phone: '+91 98765 43214',
    role: 'SELLER',
    active: true,
    state: 'Madhya Pradesh',
    district: 'Bhopal',
    village: 'Sehore',
    managerId: 'usr_manager_02',
    customersCount: 19,
    totalSalesPaise: 5400000,
    createdAt: '2026-02-12T14:00:00Z',
  },
];

// ==========================================
// 2. Categories
// ==========================================
export const MOCK_CATEGORIES: CategoryItem[] = [
  {
    id: 'cat_01',
    name: 'Pharmacy & Chemist',
    description: 'Licensed medical stores, retail pharmacies and chemist outlets',
    active: true,
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'cat_02',
    name: 'Kirana & General Store',
    description: 'Local neighborhood grocery stores and daily essentials shops',
    active: true,
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'cat_03',
    name: 'Supermarket & Mart',
    description: 'Multi-aisle self-service retail grocers and chain stores',
    active: true,
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'cat_04',
    name: 'Community Health Clinic',
    description: 'Primary health centers, maternity clinics and rural dispensaries',
    active: true,
    createdAt: '2025-09-01T00:00:00Z',
  },
  {
    id: 'cat_05',
    name: 'Self Help Group (SHG) Outlet',
    description: 'Women empowerment collectives and rural distribution points',
    active: true,
    createdAt: '2025-09-01T00:00:00Z',
  },
];

// ==========================================
// 3. Products
// ==========================================
export const MOCK_PRODUCTS: ProductItem[] = [
  {
    id: 'prod_01',
    name: 'FemmeFlo Ultra Comfort Regular (Pack of 10)',
    sku: 'FF-UCR-10',
    basePricePaise: 3000, // ₹30.00
    minimumPricePaise: 2500, // ₹25.00
    description: 'Breathable cotton feel sanitary pads with leak-guard wings, 240mm.',
    active: true,
  },
  {
    id: 'prod_02',
    name: 'FemmeFlo Ultra Comfort XL (Pack of 10)',
    sku: 'FF-UCXL-10',
    basePricePaise: 3500, // ₹35.00
    minimumPricePaise: 3000, // ₹30.00
    description: 'Heavy flow protection with gel-lock core, 280mm with wide back.',
    active: true,
  },
  {
    id: 'prod_03',
    name: 'FemmeFlo Overnight Wings XXL (Pack of 8)',
    sku: 'FF-ONXXL-08',
    basePricePaise: 4500, // ₹45.00
    minimumPricePaise: 3800, // ₹38.00
    description: 'All-night 320mm maximum coverage pads with 360 anti-leak barrier.',
    active: true,
  },
  {
    id: 'prod_04',
    name: 'FemmeFlo Organic Cotton Regular (Pack of 10)',
    sku: 'FF-OCR-10',
    basePricePaise: 4000, // ₹40.00
    minimumPricePaise: 3500, // ₹35.00
    description: '100% GOTS certified organic cotton top-sheet, chemical-free & hypoallergenic.',
    active: true,
  },
  {
    id: 'prod_05',
    name: 'FemmeFlo Eco Biodegradable (Pack of 8)',
    sku: 'FF-ECO-08',
    basePricePaise: 5200, // ₹52.00
    minimumPricePaise: 4500, // ₹45.00
    description: 'Plant-based eco biodegradable compostable sanitary napkins.',
    active: true,
  },
];

// ==========================================
// 4. Warehouses
// ==========================================
export const MOCK_WAREHOUSES: WarehouseItem[] = [
  {
    id: 'wh_01',
    name: 'Central Distribution Hub (Indore)',
    code: 'WH-IND-01',
    state: 'Madhya Pradesh',
    district: 'Indore',
    address: 'Plot 42, Sanwer Industrial Area, Indore',
    active: true,
  },
  {
    id: 'wh_02',
    name: 'Bhopal Regional Depot',
    code: 'WH-BHP-01',
    state: 'Madhya Pradesh',
    district: 'Bhopal',
    address: 'Govindpura Industrial Estate, Bhopal',
    active: true,
  },
  {
    id: 'wh_03',
    name: 'Jabalpur Storage Facility',
    code: 'WH-JBL-01',
    state: 'Madhya Pradesh',
    district: 'Jabalpur',
    address: 'Richhai Industrial Area, Jabalpur',
    active: true,
  },
];

// ==========================================
// 5. Customers
// ==========================================
export const MOCK_CUSTOMERS: CustomerItem[] = [
  {
    id: 'cust_01',
    shopName: 'Radha Medical & General Store',
    ownerName: 'Rameshwar Patidar',
    email: 'radha.medical@example.com',
    phone: '9826011223',
    categoryId: 'cat_01',
    category: MOCK_CATEGORIES[0],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    address: 'Main Bazaar, Near Clock Tower, Rau',
    pincode: '453331',
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Rau',
    latitude: 22.6285,
    longitude: 75.8085,
    photoUrl: 'https://images.unsplash.com/photo-1586015555751-63bb77f4322a?w=400',
    active: true,
    createdAt: '2026-01-20T10:30:00Z',
  },
  {
    id: 'cust_02',
    shopName: 'Mahalaxmi Supermart',
    ownerName: 'Vikas Agarwal',
    email: 'mahalaxmi.mart@example.com',
    phone: '9826022334',
    categoryId: 'cat_03',
    category: MOCK_CATEGORIES[2],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    address: 'Shop 12-14, Annapurna Road, Near Mandir',
    pincode: '452009',
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Indore City',
    latitude: 22.6985,
    longitude: 75.8398,
    photoUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?w=400',
    active: true,
    createdAt: '2026-01-22T14:15:00Z',
  },
  {
    id: 'cust_03',
    shopName: 'Gupta Pharmacy & Wellness',
    ownerName: 'Sanjay Gupta',
    email: 'gupta.pharma@example.com',
    phone: '9826033445',
    categoryId: 'cat_01',
    category: MOCK_CATEGORIES[0],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    address: 'Opposite Community Health Center, Mhow Road',
    pincode: '453441',
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Mhow',
    latitude: 22.5539,
    longitude: 75.7601,
    photoUrl: null,
    active: true,
    createdAt: '2026-01-25T11:45:00Z',
  },
  {
    id: 'cust_04',
    shopName: 'Asha Health & Hygiene Center',
    ownerName: 'Sunita Bai (ASHA Worker)',
    email: 'asha.center@example.com',
    phone: '9826044556',
    categoryId: 'cat_04',
    category: MOCK_CATEGORIES[3],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    address: 'Panchayat Bhavan Campus, Gram Hatod',
    pincode: '453111',
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Hatod',
    latitude: 22.7932,
    longitude: 75.7285,
    photoUrl: null,
    active: true,
    createdAt: '2026-01-28T09:20:00Z',
  },
  {
    id: 'cust_05',
    shopName: 'Shree Ganesh Kirana Bhandar',
    ownerName: 'Ganesh Choudhary',
    email: 'ganesh.kirana@example.com',
    phone: '9826055667',
    categoryId: 'cat_02',
    category: MOCK_CATEGORIES[1],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    address: 'Bus Stand Square, Betma',
    pincode: '453001',
    state: 'Madhya Pradesh',
    district: 'Indore',
    village: 'Betma',
    latitude: 22.6865,
    longitude: 75.6124,
    photoUrl: null,
    active: true,
    createdAt: '2026-02-02T16:00:00Z',
  },
];

// ==========================================
// 6. Sales Orders
// ==========================================
export const MOCK_SALES: SaleItem[] = [
  {
    id: 'sale_001',
    saleNumber: 'FF-2026-00412',
    customerId: 'cust_01',
    customer: MOCK_CUSTOMERS[0],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    totalAmountPaise: 60000, // ₹600.00
    packetCount: 20,
    status: 'CONFIRMED',
    paymentMode: 'CASH',
    paidAt: '2026-10-28T10:15:00Z',
    items: [
      {
        id: 'sli_001',
        productId: 'prod_01',
        productName: 'FemmeFlo Ultra Comfort Regular (Pack of 10)',
        quantity: 20,
        unitPricePaise: 3000,
        totalPricePaise: 60000,
      },
    ],
    createdAt: '2026-10-28T10:10:00Z',
    confirmedAt: '2026-10-28T10:12:00Z',
  },
  {
    id: 'sale_002',
    saleNumber: 'FF-2026-00413',
    customerId: 'cust_02',
    customer: MOCK_CUSTOMERS[1],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    totalAmountPaise: 87500, // ₹875.00
    packetCount: 25,
    status: 'CONFIRMED',
    paymentMode: 'BANK',
    paymentReference: 'UPI-98260199281',
    paidAt: '2026-10-28T12:30:00Z',
    items: [
      {
        id: 'sli_002',
        productId: 'prod_02',
        productName: 'FemmeFlo Ultra Comfort XL (Pack of 10)',
        quantity: 25,
        unitPricePaise: 3500,
        totalPricePaise: 87500,
      },
    ],
    createdAt: '2026-10-28T12:25:00Z',
    confirmedAt: '2026-10-28T12:28:00Z',
  },
  {
    id: 'sale_003',
    saleNumber: 'FF-2026-00414',
    customerId: 'cust_03',
    customer: MOCK_CUSTOMERS[2],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    totalAmountPaise: 44000, // ₹440.00
    packetCount: 20,
    status: 'PENDING', // Below minimum price (₹22 vs min ₹25)
    paymentMode: 'PENDING',
    approvalReason: 'Wholesale introductory discount requested by chemist association.',
    items: [
      {
        id: 'sli_003',
        productId: 'prod_01',
        productName: 'FemmeFlo Ultra Comfort Regular (Pack of 10)',
        quantity: 20,
        unitPricePaise: 2200, // Below min ₹25
        totalPricePaise: 44000,
      },
    ],
    createdAt: '2026-10-28T13:45:00Z',
  },
  {
    id: 'sale_004',
    saleNumber: 'FF-2026-00398',
    customerId: 'cust_04',
    customer: MOCK_CUSTOMERS[3],
    sellerId: 'usr_seller_01',
    seller: { id: 'usr_seller_01', name: 'Pooja Sharma' },
    totalAmountPaise: 68000, // ₹680.00
    packetCount: 20,
    status: 'CONFIRMED',
    paymentMode: 'CASH',
    paidAt: '2026-10-27T15:00:00Z',
    items: [
      {
        id: 'sli_004',
        productId: 'prod_02',
        productName: 'FemmeFlo Ultra Comfort XL (Pack of 10)',
        quantity: 20,
        unitPricePaise: 3400,
        totalPricePaise: 68000,
      },
    ],
    createdAt: '2026-10-27T14:50:00Z',
    confirmedAt: '2026-10-27T14:55:00Z',
  },
];

// ==========================================
// 7. Stock Transactions
// ==========================================
export const MOCK_STOCK_TRANSACTIONS: StockTransactionItem[] = [
  {
    id: 'st_01',
    productId: 'prod_01',
    product: { name: 'FemmeFlo Ultra Comfort Regular (Pack of 10)', sku: 'FF-UCR-10' },
    quantity: 200,
    type: 'DISPATCH',
    reference: 'ALLOC-2026-081',
    sourceLocation: 'Central Distribution Hub (Indore)',
    targetLocation: 'Indore Central Van #04',
    createdAt: '2026-10-26T08:30:00Z',
  },
  {
    id: 'st_02',
    productId: 'prod_02',
    product: { name: 'FemmeFlo Ultra Comfort XL (Pack of 10)', sku: 'FF-UCXL-10' },
    quantity: 150,
    type: 'DISPATCH',
    reference: 'ALLOC-2026-081',
    sourceLocation: 'Central Distribution Hub (Indore)',
    targetLocation: 'Indore Central Van #04',
    createdAt: '2026-10-26T08:30:00Z',
  },
  {
    id: 'st_03',
    productId: 'prod_01',
    product: { name: 'FemmeFlo Ultra Comfort Regular (Pack of 10)', sku: 'FF-UCR-10' },
    quantity: 20,
    type: 'SALE',
    reference: 'FF-2026-00412',
    sourceLocation: 'Indore Central Van #04',
    targetLocation: 'Radha Medical & General Store',
    createdAt: '2026-10-28T10:12:00Z',
  },
  {
    id: 'st_04',
    productId: 'prod_02',
    product: { name: 'FemmeFlo Ultra Comfort XL (Pack of 10)', sku: 'FF-UCXL-10' },
    quantity: 25,
    type: 'SALE',
    reference: 'FF-2026-00413',
    sourceLocation: 'Indore Central Van #04',
    targetLocation: 'Mahalaxmi Supermart',
    createdAt: '2026-10-28T12:28:00Z',
  },
];

// ==========================================
// 8. Seller Inventory
// ==========================================
export const MOCK_SELLER_INVENTORY: SellerInventoryData = {
  balance: 305,
  remaining: 305,
  assignedPackets: 350,
  soldPackets: 45,
  locationName: 'Indore Central Van #04 (Pooja Sharma)',
  products: [
    {
      productId: 'prod_01',
      productName: 'FemmeFlo Ultra Comfort Regular (Pack of 10)',
      productSku: 'FF-UCR-10',
      balance: 180,
      assigned: 200,
      sold: 20,
    },
    {
      productId: 'prod_02',
      productName: 'FemmeFlo Ultra Comfort XL (Pack of 10)',
      productSku: 'FF-UCXL-10',
      balance: 125,
      assigned: 150,
      sold: 25,
    },
  ],
};

// ==========================================
// 9. Shifts & Attendance
// ==========================================
export const MOCK_CURRENT_SHIFT: Shift | null = {
  id: 'shift_today_01',
  sellerId: 'usr_seller_01',
  status: 'ACTIVE',
  startTime: '2026-10-28T09:00:00Z',
  startOdometerKm: 14250,
  startLatitude: 22.7196,
  startLongitude: 75.8577,
  visits: [
    {
      id: 'visit_01',
      shiftId: 'shift_today_01',
      customerId: 'cust_01',
      customer: { shopName: 'Radha Medical & General Store', ownerName: 'Rameshwar Patidar' },
      checkInTime: '2026-10-28T10:05:00Z',
      checkOutTime: '2026-10-28T10:25:00Z',
      latitude: 22.6285,
      longitude: 75.8085,
      orderPlaced: true,
      summary: 'Order for 20 Regular packs delivered and paid in cash.',
    },
    {
      id: 'visit_02',
      shiftId: 'shift_today_01',
      customerId: 'cust_02',
      customer: { shopName: 'Mahalaxmi Supermart', ownerName: 'Vikas Agarwal' },
      checkInTime: '2026-10-28T12:15:00Z',
      checkOutTime: '2026-10-28T12:40:00Z',
      latitude: 22.6985,
      longitude: 75.8398,
      orderPlaced: true,
      summary: 'Order for 25 XL packs delivered. Payment via UPI.',
    },
  ],
};

export const MOCK_SHIFT_HISTORY: Shift[] = [
  {
    id: 'shift_hist_01',
    sellerId: 'usr_seller_01',
    status: 'COMPLETED',
    startTime: '2026-10-27T08:45:00Z',
    endTime: '2026-10-27T17:30:00Z',
    startOdometerKm: 14190,
    endOdometerKm: 14250,
    startLatitude: 22.7196,
    startLongitude: 75.8577,
    endLatitude: 22.7196,
    endLongitude: 75.8577,
    visits: [
      {
        id: 'visit_h_01',
        shiftId: 'shift_hist_01',
        customerId: 'cust_04',
        customer: { shopName: 'Asha Health & Hygiene Center', ownerName: 'Sunita Bai' },
        checkInTime: '2026-10-27T14:40:00Z',
        checkOutTime: '2026-10-27T15:15:00Z',
        orderPlaced: true,
        summary: '20 XL packets delivered.',
      },
    ],
  },
];

// ==========================================
// 10. Incentives
// ==========================================
export const MOCK_SELLER_INCENTIVES: SellerIncentiveData = {
  currentMonthEarnedPaise: 720000, // ₹7,200.00
  totalPacketsSoldMonth: 180,
  ratePerPacketPaise: 4000, // ₹40.00 / packet
  pendingPayoutPaise: 720000,
  history: [
    {
      month: 'September 2026',
      packetsSold: 210,
      earnedPaise: 840000,
      ratePerPacketPaise: 4000,
      status: 'PAID',
    },
    {
      month: 'August 2026',
      packetsSold: 195,
      earnedPaise: 780000,
      ratePerPacketPaise: 4000,
      status: 'PAID',
    },
    {
      month: 'July 2026',
      packetsSold: 160,
      earnedPaise: 640000,
      ratePerPacketPaise: 4000,
      status: 'PAID',
    },
  ],
};

// ==========================================
// 11. Notifications
// ==========================================
export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_01',
    userId: 'usr_seller_01',
    title: 'Daily Van Stock Ready',
    message: 'Van stock of 350 packets allocated from Central Distribution Hub.',
    read: false,
    type: 'STOCK',
    createdAt: '2026-10-28T08:00:00Z',
  },
  {
    id: 'notif_02',
    userId: 'usr_seller_01',
    title: 'Incentive Milestone Reached! 🌟',
    message: 'Congratulations! You reached 180 packets sold this month.',
    read: false,
    type: 'INCENTIVE',
    createdAt: '2026-10-27T18:00:00Z',
  },
  {
    id: 'notif_03',
    userId: 'usr_seller_01',
    title: 'New Customer Category Added',
    message: 'Self Help Group (SHG) Outlets now eligible for special partner rates.',
    read: true,
    type: 'SYSTEM',
    createdAt: '2026-10-25T11:00:00Z',
  },
];

// ==========================================
// 12. Dashboards
// ==========================================
export const MOCK_SELLER_DASHBOARD: SellerDashboardData = {
  todaySalesAmountPaise: 147500, // ₹1,475.00
  todayPacketsSold: 45,
  stockBalance: 305,
  pendingApprovalsCount: 1,
  activeShift: MOCK_CURRENT_SHIFT,
};

export const MOCK_MANAGER_DASHBOARD: ManagerDashboardData = {
  totalSellers: 14,
  activeSellersCount: 11,
  monthlyRevenuePaise: 24500000, // ₹2,45,000.00
  monthlyPacketsSold: 6850,
  totalCustomers: 184,
};

export const MOCK_ADMIN_DASHBOARD: AdminDashboardData = {
  totalRevenuePaise: 128500000, // ₹12,85,000.00
  totalPacketsSold: 36200,
  totalCustomers: 590,
  activeSellers: 48,
  pendingApprovalsCount: 1,
  warehouseStockBalance: 42500,
};

// ==========================================
// 13. Business Settings
// ==========================================
export const MOCK_SETTINGS: BusinessSettings = {
  minimumSalePricePaise: 2500, // ₹25.00 minimum
  lowStockThreshold: 50,
  companyName: '',
  companyGst: '',
  companyPan: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  invoiceTerms: '',
};
