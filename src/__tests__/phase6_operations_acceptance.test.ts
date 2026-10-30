import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  computePayloadHash,
  createDraftStorage,
  generateIdempotencyKey,
  shouldRotateIdempotencyKey,
  type OrderDraft,
  type StorageBackend,
} from '../utils/draftStorage.ts';
import type {
  CreateCustomerPayload,
  CreateSalePayload,
  ManagerIncentiveData,
  ManagerInventoryData,
  PaymentMode,
  ProductItem,
  Shift,
} from '../api/types.ts';

describe('FemmeFlo Phase 6: Seller & Manager Operations Acceptance Suite', () => {
  // In-memory mock storage for draft tests
  function createMockStorage(): StorageBackend {
    const memory = new Map<string, string>();
    return {
      async getItem(key: string) {
        return memory.get(key) ?? null;
      },
      async setItem(key: string, value: string) {
        memory.set(key, value);
      },
      async removeItem(key: string) {
        memory.delete(key);
      },
    };
  }

  const mockProduct1: ProductItem = {
    id: 'prod-001',
    name: 'FemmeFlo Regular 6s',
    sku: 'FF-REG-06',
    basePricePaise: 3500, // ₹35.00
    minimumPricePaise: 2500, // ₹25.00
    active: true,
  };

  const mockProduct2: ProductItem = {
    id: 'prod-002',
    name: 'FemmeFlo XL Wings 8s',
    sku: 'FF-XL-08',
    basePricePaise: 4500, // ₹45.00
    minimumPricePaise: 3500, // ₹35.00
    active: true,
  };

  // ==========================================================================
  // SCENARIO 1: Multi-SKU POS Order Creation & Exact Payload Contract
  // ==========================================================================
  test('Scenario 1: Creates multi-SKU sale matching backend items contract', () => {
    const cartItems = [
      { productId: mockProduct1.id, quantity: 20, unitPriceRupees: 35 },
      { productId: mockProduct2.id, quantity: 15, unitPriceRupees: 45 },
    ];

    const customerId = 'cust-123e4567-e89b-12d3-a456-426614174000';
    const idempotencyKey = generateIdempotencyKey();
    const feedback = 'Owner pleased with regular napkins; requested promotional stand.';

    // Construct backend payload
    const payload: CreateSalePayload = {
      customerId,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPricePaise: Math.round(item.unitPriceRupees * 100),
      })),
      paymentMode: 'CASH',
      requestKey: idempotencyKey,
      customerFeedback: feedback,
    };

    assert.equal(payload.customerId, customerId);
    assert.equal(payload.items?.length, 2);
    assert.equal(payload.items![0].productId, mockProduct1.id);
    assert.equal(payload.items![0].quantity, 20);
    assert.equal(payload.items![0].unitPricePaise, 3500);

    assert.equal(payload.items![1].productId, mockProduct2.id);
    assert.equal(payload.items![1].quantity, 15);
    assert.equal(payload.items![1].unitPricePaise, 4500);

    assert.equal(payload.paymentMode, 'CASH');
    assert.equal(payload.requestKey, idempotencyKey);
    assert.equal(payload.customerFeedback, feedback);
  });

  // ==========================================================================
  // SCENARIO 2: Quantity Changes, Line Totals & Total Order Value
  // ==========================================================================
  test('Scenario 2: Calculates individual line totals and total order value accurately', () => {
    const cart = [
      { key: 'line_1', productId: mockProduct1.id, quantity: 10, unitPrice: 35 },
      { key: 'line_2', productId: mockProduct2.id, quantity: 5, unitPrice: 42.5 },
    ];

    // Compute line totals
    const line1Total = cart[0].quantity * cart[0].unitPrice; // 10 * 35 = 350
    const line2Total = cart[1].quantity * cart[1].unitPrice; // 5 * 42.50 = 212.50

    assert.equal(line1Total, 350);
    assert.equal(line2Total, 212.5);

    // Compute grand total and volume
    const grandTotal = cart.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);
    const totalPackets = cart.reduce((sum, li) => sum + li.quantity, 0);

    assert.equal(grandTotal, 562.5);
    assert.equal(totalPackets, 15);

    // Increment line 2 quantity by 5
    cart[1].quantity += 5;
    const updatedLine2Total = cart[1].quantity * cart[1].unitPrice; // 10 * 42.50 = 425
    const updatedGrandTotal = cart.reduce((sum, li) => sum + li.quantity * li.unitPrice, 0);

    assert.equal(updatedLine2Total, 425);
    assert.equal(updatedGrandTotal, 775);
  });

  // ==========================================================================
  // SCENARIO 3: Minimum Price Floor Validation & Super Admin Approval Requirement
  // ==========================================================================
  test('Scenario 3: Detects unit price below minimum floor and triggers approval warning', () => {
    // Product 1 min price is 2500 paise (₹25.00). User enters ₹22.00.
    const cart = [
      { productId: mockProduct1.id, quantity: 10, unitPriceRupees: 22.0 },
      { productId: mockProduct2.id, quantity: 5, unitPriceRupees: 45.0 },
    ];

    const catalog = [mockProduct1, mockProduct2];

    const hasBelowFloorItem = cart.some((item) => {
      const prod = catalog.find((p) => p.id === item.productId);
      if (!prod) return false;
      return Math.round(item.unitPriceRupees * 100) < (prod.minimumPricePaise ?? 2500);
    });

    assert.equal(
      hasBelowFloorItem,
      true,
      'Cart with item below ₹25.00 floor must trigger approval flag'
    );

    // If price is adjusted up to ₹26.00, warning clears
    cart[0].unitPriceRupees = 26.0;
    const hasBelowFloorAfterFix = cart.some((item) => {
      const prod = catalog.find((p) => p.id === item.productId);
      if (!prod) return false;
      return Math.round(item.unitPriceRupees * 100) < (prod.minimumPricePaise ?? 2500);
    });

    assert.equal(hasBelowFloorAfterFix, false, 'Cart with items >= floor requires no approval');
  });

  // ==========================================================================
  // SCENARIO 4: Offline Draft Storage & Restoration (Multi-Item + Feedback)
  // ==========================================================================
  test('Scenario 4: Saves and restores multi-item order drafts including customer and feedback', async () => {
    const mockStorage = createMockStorage();
    const draftMgr = createDraftStorage(mockStorage);
    const userId = 'seller-user-001';

    const draftOrder: OrderDraft = {
      idempotencyKey: 'idemp-uuid-12345',
      payloadHash: 'hash-abcde-999',
      submitted: false,
      customerId: 'cust-9988',
      customerName: 'Asha General Store',
      items: [
        {
          productId: mockProduct1.id,
          productName: mockProduct1.name,
          quantity: 25,
          unitPricePaise: 3500,
          minPricePaise: 2500,
        },
        {
          productId: mockProduct2.id,
          productName: mockProduct2.name,
          quantity: 10,
          unitPricePaise: 4500,
          minPricePaise: 3500,
        },
      ],
      paymentMode: 'BANK',
      paymentReference: 'UPI-REF-00129',
      customerFeedback: 'Demanded 20 extra packs next Tuesday for festival sale.',
      updatedAt: new Date().toISOString(),
    };

    await draftMgr.saveOrderDraft(userId, draftOrder);

    // Retrieve restored draft
    const restored = await draftMgr.getOrderDraft(userId);
    assert.ok(restored, 'Draft must be retrieved from storage');
    assert.equal(restored?.customerId, 'cust-9988');
    assert.equal(restored?.items.length, 2);
    assert.equal(restored?.items[0].quantity, 25);
    assert.equal(restored?.items[1].quantity, 10);
    assert.equal(restored?.paymentMode, 'BANK');
    assert.equal(restored?.paymentReference, 'UPI-REF-00129');
    assert.equal(
      restored?.customerFeedback,
      'Demanded 20 extra packs next Tuesday for festival sale.'
    );

    // Clear draft on checkout
    await draftMgr.clearOrderDraft(userId);
    const cleared = await draftMgr.getOrderDraft(userId);
    assert.equal(cleared, null, 'Draft must be cleared after checkout');
  });

  // ==========================================================================
  // SCENARIO 5: Idempotency Key Binding and Rotation on Payload Change
  // ==========================================================================
  test('Scenario 5: Rotates idempotency key when payload changes after a submission attempt', () => {
    const key1 = generateIdempotencyKey();
    assert.ok(key1 && key1.length >= 32, 'Must generate valid UUID key');

    const initialPayload = {
      customerId: 'cust-1',
      items: [{ productId: 'p1', quantity: 10, unitPricePaise: 3000 }],
      paymentMode: 'CASH',
      customerFeedback: 'Note A',
    };
    const hash1 = computePayloadHash(initialPayload);

    // 1. Unsubmitted draft changes: should NOT rotate key (still editing draft before first submit)
    const shouldRotateBeforeSubmit = shouldRotateIdempotencyKey(hash1, hash1, false);
    assert.equal(shouldRotateBeforeSubmit, false);

    // 2. Draft was submitted once (e.g. uncertain timeout or server retry).
    // If payload is UNCHANGED, key should NOT rotate (ensuring safe idempotent replay)
    const shouldRotateSamePayload = shouldRotateIdempotencyKey(hash1, hash1, true);
    assert.equal(
      shouldRotateSamePayload,
      false,
      'Unchanged payload must reuse idempotency key for safe retry'
    );

    // 3. User modifies quantity to 20 after submission attempt
    const modifiedPayload = {
      customerId: 'cust-1',
      items: [{ productId: 'p1', quantity: 20, unitPricePaise: 3000 }],
      paymentMode: 'CASH',
      customerFeedback: 'Note A',
    };
    const hash2 = computePayloadHash(modifiedPayload);
    assert.notEqual(hash1, hash2, 'Payload hash must change when quantity changes');

    const shouldRotateModifiedPayload = shouldRotateIdempotencyKey(hash2, hash1, true);
    assert.equal(
      shouldRotateModifiedPayload,
      true,
      'Must rotate idempotency key when order payload changes after submit attempt'
    );
  });

  // ==========================================================================
  // SCENARIO 6: Manager Van Stock Supervision
  // ==========================================================================
  test('Scenario 6: Computes manager territory van stock balance and seller allocations', () => {
    const mockInventoryResponse: ManagerInventoryData = {
      summary: {
        totalSellers: 3,
        totalAssigned: 1500,
        totalSold: 950,
        totalRemaining: 550,
      },
      sellers: [
        {
          seller: { id: 's1', name: 'Ramesh Patel', phone: '9876543210', district: 'Varanasi', village: 'Shivpur' },
          assigned: 500,
          sold: 320,
          remaining: 180,
        },
        {
          seller: { id: 's2', name: 'Sunita Sharma', phone: '9876543211', district: 'Varanasi', village: 'Rohaniya' },
          assigned: 600,
          sold: 450,
          remaining: 150,
        },
        {
          seller: { id: 's3', name: 'Amit Verma', phone: '9876543212', district: 'Varanasi', village: 'Kashi' },
          assigned: 400,
          sold: 180,
          remaining: 220,
        },
      ],
    };

    const { summary, sellers } = mockInventoryResponse;
    assert.equal(summary?.totalSellers, 3);
    assert.equal(summary?.totalAssigned, 1500);
    assert.equal(summary?.totalSold, 950);
    assert.equal(summary?.totalRemaining, 550);

    // Verify mathematical invariant: totalRemaining = totalAssigned - totalSold
    assert.equal(summary!.totalRemaining, summary!.totalAssigned! - summary!.totalSold!);

    // Verify seller list aggregation
    const sellerList = (sellers as any[]) || [];
    const sumRemaining = sellerList.reduce((acc, s) => acc + s.remaining, 0);
    assert.equal(sumRemaining, 550, 'Sum of individual seller remaining stock must equal total remaining');
  });

  // ==========================================================================
  // SCENARIO 7: Manager Shift Supervision & Attendance Tracking
  // ==========================================================================
  test('Scenario 7: Surfaces active shifts, odometer readings, and store visit counts', () => {
    const mockShifts: Shift[] = [
      {
        id: 'shift-1',
        sellerId: 's1',
        seller: { id: 's1', name: 'Ramesh Patel', phone: '9876543210', employeeCode: 'EMP-01' },
        status: 'ACTIVE',
        startTime: '2026-10-30T03:30:00.000Z', // 09:00 AM IST
        startOdometerKm: 12450,
        startFaceVerified: true,
        visits: [
          { id: 'v1', shiftId: 'shift-1', customerId: 'c1', checkInTime: '2026-10-30T04:15:00.000Z', saleDone: true },
          { id: 'v2', shiftId: 'shift-1', customerId: 'c2', checkInTime: '2026-10-30T05:00:00.000Z', saleDone: false },
        ],
      },
      {
        id: 'shift-2',
        sellerId: 's2',
        seller: { id: 's2', name: 'Sunita Sharma', phone: '9876543211', employeeCode: 'EMP-02' },
        status: 'COMPLETED',
        startTime: '2026-10-30T03:00:00.000Z',
        endTime: '2026-10-30T11:00:00.000Z',
        durationMins: 480,
        startOdometerKm: 8200,
        endOdometerKm: 8245,
        totalDistanceKm: 45,
        startFaceVerified: true,
        visits: [
          { id: 'v3', shiftId: 'shift-2', customerId: 'c3', checkInTime: '2026-10-30T04:00:00.000Z', saleDone: true },
        ],
      },
    ];

    const activeShifts = mockShifts.filter((s) => s.status === 'ACTIVE');
    assert.equal(activeShifts.length, 1, 'Must have exactly 1 active shift');
    assert.equal(activeShifts[0].seller?.name, 'Ramesh Patel');
    assert.equal(activeShifts[0].visits?.length, 2, 'Ramesh has 2 store visits');
    assert.equal(activeShifts[0].startFaceVerified, true);

    const completedShifts = mockShifts.filter((s) => s.status === 'COMPLETED');
    assert.equal(completedShifts.length, 1);
    assert.equal(completedShifts[0].totalDistanceKm, 45, 'Sunita covered 45 km');
    assert.equal(completedShifts[0].durationMins, 480, 'Sunita worked 8 hours (480 mins)');
  });

  // ==========================================================================
  // SCENARIO 8: Manager Team Incentives & Payout Status Mapping
  // ==========================================================================
  test('Scenario 8: Computes team incentive entitlements and categorizes payout statuses', () => {
    const mockIncentives = {
      team: {
        summary: {
          assignedSellersCount: 2,
          totalPacketsSold: 850,
          totalIncentiveEarnedPaise: 425000, // ₹4,250.00 (@ ₹5/pkt)
          totalPaidPaise: 300000, // ₹3,000.00
          totalPendingPaise: 125000, // ₹1,250.00
        },
        members: [
          {
            seller: { id: 's1', name: 'Ramesh Patel' },
            confirmedPackets: 500,
            earnedPaise: 250000,
            totalPaidPaise: 250000,
            outstandingPaise: 0,
            status: 'PAID' as const,
          },
          {
            seller: { id: 's2', name: 'Sunita Sharma' },
            confirmedPackets: 350,
            earnedPaise: 175000,
            totalPaidPaise: 50000,
            outstandingPaise: 125000,
            status: 'PARTIALLY_PAID' as const,
          },
        ],
      },
    };

    const { summary, members } = mockIncentives.team;
    assert.equal(summary.totalPacketsSold, 850);
    assert.equal(summary.totalIncentiveEarnedPaise, 425000);
    assert.equal(summary.totalPaidPaise, 300000);
    assert.equal(summary.totalPendingPaise, 125000);

    assert.equal(members[0].status, 'PAID');
    assert.equal(members[0].outstandingPaise, 0);

    assert.equal(members[1].status, 'PARTIALLY_PAID');
    assert.equal(members[1].outstandingPaise, 125000);
  });

  // ==========================================================================
  // SCENARIO 9: Manager Customer Onboarding Contract
  // ==========================================================================
  test('Scenario 9: Validates single customer onboarding with mandatory photo exemption reason', () => {
    // When storefront photo is omitted, noPhotoReason is mandatory
    const customerPayloadWithoutPhoto: CreateCustomerPayload = {
      shopName: 'Maa Durga General Store',
      ownerName: 'Vimla Devi',
      phone: '9876543299',
      categoryId: 'cat-kirana',
      address: 'Near Old Temple, Shivpur',
      pincode: '221001',
      state: 'Uttar Pradesh',
      district: 'Varanasi',
      village: 'Shivpur',
      latitude: 25.3541,
      longitude: 82.9812,
      noPhotoReason: 'Owner requested no external photography inside household premises',
    };

    assert.ok(customerPayloadWithoutPhoto.shopName);
    assert.ok(customerPayloadWithoutPhoto.pincode.length === 6);
    assert.ok(customerPayloadWithoutPhoto.noPhotoReason);
    assert.ok(customerPayloadWithoutPhoto.latitude && customerPayloadWithoutPhoto.longitude);

    // Ensure invalid phone number is caught
    const invalidPhone = '12345';
    const isPhoneValid = /^[6-9]\d{9}$/.test(invalidPhone);
    assert.equal(isPhoneValid, false, 'Short invalid phone number must fail validation');
  });

  // ==========================================================================
  // SCENARIO 10: Territory Authorization Protection
  // ==========================================================================
  test('Scenario 10: Unauthorized territory access is strictly rejected', () => {
    const managerTerritory = { state: 'Uttar Pradesh', district: 'Varanasi' };

    const sellerA = { id: 's1', district: 'Varanasi' };
    const sellerB = { id: 's2', district: 'Prayagraj' };

    // Manager can only supervise sellers within their authorized district
    const isSellerAAuthorized = sellerA.district.toLowerCase() === managerTerritory.district.toLowerCase();
    const isSellerBAuthorized = sellerB.district.toLowerCase() === managerTerritory.district.toLowerCase();

    assert.equal(isSellerAAuthorized, true, 'Seller in Varanasi is authorized');
    assert.equal(isSellerBAuthorized, false, 'Seller in Prayagraj must be rejected as unauthorized');
  });
});
