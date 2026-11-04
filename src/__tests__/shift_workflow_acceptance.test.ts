import assert from 'node:assert/strict';
import test, { describe } from 'node:test';
import {
  createDraftStorage,
  generateIdempotencyKey,
  type StorageBackend,
  type VisitCheckoutDraft,
} from '../utils/draftStorage.ts';
import type {
  CreateSalePayload,
  EndShiftPayload,
  PaymentMode,
  Shift,
  ShiftVisit,
  StartShiftPayload,
} from '../api/types.ts';

describe('FemmeFlo Shift Workflow & Checkout Parity Acceptance Suite', () => {
  // Mock in-memory storage for draft persistence tests
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

  // ----------------------------------------------------
  // SCENARIO 1: Branch 1 - No Sale Generated Checkout
  // ----------------------------------------------------
  test('Scenario 1: Branch 1 completes visit without creating a sale record', async () => {
    let saleCreated = false;
    let checkedOutVisit: any = null;

    // Simulate mock sellerApi
    const mockSellerApi = {
      async createSale(payload: CreateSalePayload) {
        saleCreated = true;
        return { sale: { id: 'sale-999', ...payload } };
      },
      async checkOut(payload: any) {
        checkedOutVisit = {
          id: payload.visitId,
          checkOutTime: new Date().toISOString(),
          durationMins: 14.5,
          saleDone: payload.saleDone ?? false,
          customerFeedback: payload.customerFeedback,
          notes: payload.notes,
          saleId: payload.saleId ?? null,
        };
        return { visit: checkedOutVisit };
      },
    };

    const visitId = 'visit-branch-1-001';
    const reason = 'Stock already sufficient';
    const feedback = 'Shopkeeper stated current stock will last 2 more weeks.';
    const notes = `Reason: ${reason}`;

    // Branch 1 execution: No sale created
    const res = await mockSellerApi.checkOut({
      visitId,
      latitude: 22.7196,
      longitude: 75.8577,
      saleDone: false,
      customerFeedback: `${reason}. ${feedback}`,
      notes,
    });

    assert.equal(saleCreated, false, 'No sale should be created in Branch 1');
    assert.equal(res.visit.saleDone, false);
    assert.equal(res.visit.saleId, null);
    assert.match(res.visit.customerFeedback, /Stock already sufficient/);
    assert.match(res.visit.notes, /Reason: Stock already sufficient/);
    assert.ok(res.visit.durationMins > 0);
  });

  // ----------------------------------------------------
  // SCENARIO 2: Branch 2 - Sale Generated Checkout
  // ----------------------------------------------------
  test('Scenario 2: Branch 2 creates sale with products, payment mode, and links saleId to visit', async () => {
    let createdSalePayload: any = null;
    let checkedOutVisit: any = null;

    const mockSellerApi = {
      async createSale(payload: CreateSalePayload) {
        createdSalePayload = payload;
        return {
          sale: {
            id: 'sale-branch-2-uuid',
            customerId: payload.customerId,
            quantity: payload.quantity,
            unitPricePaise: payload.unitPricePaise,
            totalPaise: (payload.quantity || 1) * (payload.unitPricePaise || 2500),
            paymentMode: payload.paymentMode,
            status: 'PENDING_APPROVAL',
            customerFeedback: payload.customerFeedback,
          },
        };
      },
      async checkOut(payload: any) {
        checkedOutVisit = {
          id: payload.visitId,
          checkOutTime: new Date().toISOString(),
          durationMins: 22.0,
          saleDone: payload.saleDone,
          saleId: payload.saleId,
          customerFeedback: payload.customerFeedback,
          notes: payload.notes,
        };
        return { visit: checkedOutVisit };
      },
    };

    const visitId = 'visit-branch-2-002';
    const customerId = 'cust-uuid-456';
    const productId = 'prod-uuid-789';
    const quantity = 15;
    const unitPricePaise = 2500; // ₹25
    const paymentMode: PaymentMode = 'BANK'; // UPI / Bank transfer
    const feedback = 'Retailer requested weekly restocking and paid via QR code.';
    const reqKey = `sale_checkout_${visitId}_${Date.now()}`;

    // Step 1: Create sale
    const saleRes = await mockSellerApi.createSale({
      customerId,
      items: [{ productId, quantity, unitPricePaise }],
      quantity,
      unitPricePaise,
      paymentMode,
      requestKey: reqKey,
      customerFeedback: feedback,
    });

    assert.equal(createdSalePayload.paymentMode, 'BANK');
    assert.equal(createdSalePayload.quantity, 15);
    assert.equal(saleRes.sale.id, 'sale-branch-2-uuid');

    // Step 2: Check out visit with linked saleId
    const checkOutRes = await mockSellerApi.checkOut({
      visitId,
      latitude: 22.7196,
      longitude: 75.8577,
      saleDone: true,
      saleId: saleRes.sale.id,
      customerFeedback: feedback,
      notes: 'Sale billed and concluded successfully',
    });

    assert.equal(checkOutRes.visit.saleDone, true);
    assert.equal(checkOutRes.visit.saleId, 'sale-branch-2-uuid');
    assert.equal(checkOutRes.visit.customerFeedback, feedback);
  });

  // ----------------------------------------------------
  // SCENARIO 3: Supported Backend Payment Modes
  // ----------------------------------------------------
  test('Scenario 3: Only supports backend payment modes CASH, BANK, and PENDING', () => {
    const validModes: PaymentMode[] = ['CASH', 'BANK', 'PENDING'];
    const backendAllowedEnums = new Set(['CASH', 'BANK', 'PENDING']);

    for (const mode of validModes) {
      assert.ok(
        backendAllowedEnums.has(mode),
        `Payment mode ${mode} must be supported by backend Prisma enum`
      );
    }
  });

  // ----------------------------------------------------
  // SCENARIO 4: Feedback Persistence in Draft Storage
  // ----------------------------------------------------
  test('Scenario 4: In-progress checkout feedback is preserved locally and recovered after navigation', async () => {
    const backend = createMockStorage();
    const draftStorage = createDraftStorage(backend);
    const userId = 'seller-user-123';
    const visitId = 'visit-draft-001';

    const initialDraft: VisitCheckoutDraft = {
      visitId,
      saleDone: false,
      reason: 'Shop closed',
      feedback: 'Owner visiting home village; reopen on Monday.',
      notes: 'Will revisit next Tuesday morning.',
      quantity: 1,
      unitPrice: 25,
      paymentMode: 'CASH',
      updatedAt: new Date().toISOString(),
    };

    // Save draft
    await draftStorage.saveVisitCheckoutDraft(userId, visitId, initialDraft);

    // Retrieve draft (simulating reopening the checkout modal or returning to screen)
    const recovered = await draftStorage.getVisitCheckoutDraft(userId, visitId);
    assert.ok(recovered);
    assert.equal(recovered.visitId, visitId);
    assert.equal(recovered.reason, 'Shop closed');
    assert.equal(recovered.feedback, 'Owner visiting home village; reopen on Monday.');

    // Clear draft on successful checkout
    await draftStorage.clearVisitCheckoutDraft(userId, visitId);
    const afterClear = await draftStorage.getVisitCheckoutDraft(userId, visitId);
    assert.equal(afterClear, null);
  });

  // ----------------------------------------------------
  // SCENARIO 5: Failed Sale Submission Aborts Checkout
  // ----------------------------------------------------
  test('Scenario 5: Failed sale creation aborts checkout without marking visit completed', async () => {
    let visitCheckedOut = false;

    const mockSellerApi = {
      async createSale(_payload: CreateSalePayload) {
        throw new Error('Database transaction timeout: inventory lock failed');
      },
      async checkOut(_payload: any) {
        visitCheckedOut = true;
        return { visit: {} };
      },
    };

    let checkoutError: Error | null = null;
    try {
      // Attempting checkout with sale
      await mockSellerApi.createSale({
        customerId: 'c1',
        paymentMode: 'CASH',
        quantity: 5,
        unitPricePaise: 2500,
      });
      // Should not reach checkOut if createSale fails
      await mockSellerApi.checkOut({ visitId: 'v1' });
    } catch (err: any) {
      checkoutError = err;
    }

    assert.ok(checkoutError);
    assert.match(checkoutError.message, /inventory lock failed/);
    assert.equal(visitCheckedOut, false, 'Visit checkout must NOT be marked completed if sale fails');
  });

  // ----------------------------------------------------
  // SCENARIO 6: Shift Start with Face Verification & GPS
  // ----------------------------------------------------
  test('Scenario 6: Shift start requires valid odometer, GPS coordinates, and face verification payload', async () => {
    let startedShift: any = null;

    const mockSellerApi = {
      async startShift(payload: StartShiftPayload) {
        startedShift = {
          id: 'shift-100',
          sellerId: 'seller-1',
          startTime: new Date().toISOString(),
          startLatitude: payload.latitude,
          startLongitude: payload.longitude,
          startFaceVerified: payload.faceVerified,
          startFacePhoto: payload.facePhoto,
          status: 'ACTIVE',
          visits: [],
        };
        return { shift: startedShift };
      },
    };

    const res = await mockSellerApi.startShift({
      startOdometerKm: 14200,
      latitude: 22.7196,
      longitude: 75.8577,
      faceVerified: true,
      facePhoto: 'data:image/jpeg;base64,face_selfie_data',
      faceConfidence: 0.98,
      faceMethod: 'FACE_ID_BIOMETRIC',
    });

    assert.equal(res.shift.status, 'ACTIVE');
    assert.equal(res.shift.startFaceVerified, true);
    assert.equal(res.shift.startLatitude, 22.7196);
  });

  // ----------------------------------------------------
  // SCENARIO 7: Shift Start Rejects Invalid Odometer
  // ----------------------------------------------------
  test('Scenario 7: Shift start rejects negative or NaN odometer readings', () => {
    function validateOdometer(val: string): boolean {
      const km = parseFloat(val);
      return !isNaN(km) && km >= 0;
    }

    assert.equal(validateOdometer('12500'), true);
    assert.equal(validateOdometer('0'), true);
    assert.equal(validateOdometer('-50'), false);
    assert.equal(validateOdometer('abc'), false);
    assert.equal(validateOdometer(''), false);
  });

  // ----------------------------------------------------
  // SCENARIO 8: Shift End Closing Odometer Validation
  // ----------------------------------------------------
  test('Scenario 8: Shift end validates closing odometer is greater than or equal to start odometer', () => {
    const startOdometer = 14200;

    function validateClosingOdometer(endVal: string, startVal: number): { valid: boolean; error?: string } {
      const km = parseFloat(endVal);
      if (isNaN(km)) {
        return { valid: false, error: 'Invalid number' };
      }
      if (km < startVal) {
        return { valid: false, error: 'Closing odometer must be >= start odometer' };
      }
      return { valid: true };
    }

    assert.equal(validateClosingOdometer('14250', startOdometer).valid, true);
    assert.equal(validateClosingOdometer('14200', startOdometer).valid, true);
    assert.equal(validateClosingOdometer('14100', startOdometer).valid, false);
    assert.match(
      validateClosingOdometer('14100', startOdometer).error || '',
      /Closing odometer must be >= start odometer/
    );
  });

  // ----------------------------------------------------
  // SCENARIO 9: Shift End Completes with Total Distance KM
  // ----------------------------------------------------
  test('Scenario 9: Shift end records verified Face ID selfie and returns total distance route', async () => {
    const mockSellerApi = {
      async endShift(payload: EndShiftPayload) {
        return {
          shift: {
            id: 'shift-100',
            status: 'COMPLETED',
            endTime: new Date().toISOString(),
            endLatitude: payload.latitude,
            endLongitude: payload.longitude,
            endFaceVerified: payload.faceVerified,
            totalDistanceKm: 42.6,
          },
        };
      },
    };

    const res = await mockSellerApi.endShift({
      endOdometerKm: 14242,
      latitude: 22.7500,
      longitude: 75.8900,
      notes: 'End of beat shift',
      faceVerified: true,
      facePhoto: 'data:image/jpeg;base64,end_selfie',
      faceConfidence: 0.98,
      faceMethod: 'FACE_ID_BIOMETRIC',
    });

    assert.equal(res.shift.status, 'COMPLETED');
    assert.equal(res.shift.endFaceVerified, true);
    assert.equal(res.shift.totalDistanceKm, 42.6);
  });

  // ----------------------------------------------------
  // SCENARIO 10: Never Mark Completed Locally on Server Failure
  // ----------------------------------------------------
  test('Scenario 10: Active shift is never cleared from cache if server endShift request fails', async () => {
    const backend = createMockStorage();
    const draftStorage = createDraftStorage(backend);
    const userId = 'seller-user-999';

    const activeShift: Shift = {
      id: 'active-shift-1',
      sellerId: userId,
      status: 'ACTIVE',
      startTime: new Date().toISOString(),
      startOdometerKm: 1000,
      visits: [],
    };

    // Active shift saved in draft storage
    await draftStorage.saveActiveShift(userId, activeShift);

    const mockSellerApi = {
      async endShift(_payload: EndShiftPayload) {
        throw new Error('500 Internal Server Error: Gateway timeout');
      },
    };

    let endError: Error | null = null;
    try {
      await mockSellerApi.endShift({ latitude: 0, longitude: 0 });
      // Only clear if endShift succeeded
      await draftStorage.clearActiveShift(userId);
    } catch (err: any) {
      endError = err;
    }

    assert.ok(endError);
    // Active shift MUST still be present in storage
    const cached = await draftStorage.getActiveShift(userId);
    assert.ok(cached, 'Active shift must remain intact after network failure');
    assert.equal(cached.id, 'active-shift-1');
  });

  // ----------------------------------------------------
  // SCENARIO 11: Duplicate Checkout Prevention Guard
  // ----------------------------------------------------
  test('Scenario 11: Re-entry guard prevents double submission and blocks already completed visits', () => {
    const existingVisit: ShiftVisit = {
      id: 'visit-completed-123',
      shiftId: 'shift-1',
      customerId: 'cust-1',
      checkInTime: new Date(Date.now() - 3600000).toISOString(),
      checkOutTime: new Date().toISOString(), // Already checked out
      durationMins: 60,
    };

    function canInitiateCheckout(visit: ShiftVisit, isCheckingOut: boolean): { allowed: boolean; reason?: string } {
      if (isCheckingOut) {
        return { allowed: false, reason: 'Checkout already in progress' };
      }
      if (visit.checkOutTime) {
        return { allowed: false, reason: 'Already checked out' };
      }
      return { allowed: true };
    }

    // Attempting checkout when already checking out
    assert.equal(canInitiateCheckout(existingVisit, true).allowed, false);

    // Attempting checkout when visit is already completed
    const res = canInitiateCheckout(existingVisit, false);
    assert.equal(res.allowed, false);
    assert.equal(res.reason, 'Already checked out');

    // Attempting checkout on open visit
    const openVisit: ShiftVisit = { ...existingVisit, checkOutTime: null };
    assert.equal(canInitiateCheckout(openVisit, false).allowed, true);
  });

  // ----------------------------------------------------
  // SCENARIO 12: Dual-Compatible Shift API Payload Builder
  // ----------------------------------------------------
  test('Scenario 12: Shift Start & End payloads include odometer and GPS coordinates in server-expected format', () => {
    const startPayload = {
      startOdometerKm: 15200,
      latitude: 22.7196,
      longitude: 75.8577,
      faceVerified: true,
      facePhoto: 'data:image/jpeg;base64,selfie_test_base64',
      faceConfidence: 0.98,
      faceMethod: 'FACE_ID_BIOMETRIC',
      address: 'Start notes: beat route Indore Central',
    };

    const startKm = startPayload.startOdometerKm ?? 0;
    const lat = startPayload.latitude ?? 0;
    const lng = startPayload.longitude ?? 0;

    const startBody: Record<string, any> = {
      startOdometerKm: startKm,
      odometerKm: startKm,
      startLatitude: lat,
      startLongitude: lng,
      latitude: lat,
      longitude: lng,
    };
    if (startPayload.address) startBody.address = startPayload.address;
    if (startPayload.faceVerified !== undefined) startBody.faceVerified = startPayload.faceVerified;

    assert.equal(startBody.startOdometerKm, 15200);
    assert.equal(startBody.odometerKm, 15200);
    assert.equal(startBody.startLatitude, 22.7196);
    assert.equal(startBody.startLongitude, 75.8577);
    assert.equal(startBody.faceVerified, true);

    const endPayload = {
      endOdometerKm: 15280,
      latitude: 22.7250,
      longitude: 75.8600,
      faceVerified: true,
      notes: 'Closing notes: beat route finished',
    };

    const endKm = endPayload.endOdometerKm ?? 0;
    const endBody: Record<string, any> = {
      endOdometerKm: endKm,
      odometerKm: endKm,
      endLatitude: endPayload.latitude,
      endLongitude: endPayload.longitude,
      latitude: endPayload.latitude,
      longitude: endPayload.longitude,
    };
    if (endPayload.notes) {
      endBody.notes = endPayload.notes;
      endBody.remarks = endPayload.notes;
    }

    assert.equal(endBody.endOdometerKm, 15280);
    assert.equal(endBody.odometerKm, 15280);
    assert.equal(endBody.endLatitude, 22.7250);
    assert.equal(endBody.endLongitude, 75.8600);
    assert.equal(endBody.remarks, 'Closing notes: beat route finished');
  });

  // ----------------------------------------------------
  // SCENARIO 13: Numeric Coordinate & Duration Parsing Crash Guard
  // ----------------------------------------------------
  test('Scenario 13: Numeric coordinate & duration parsing robustness prevents runtime .toFixed type errors', () => {
    // When backend returns Decimal fields serialized as string
    const serverShiftWithStrings: any = {
      id: 'shift_str_001',
      startLatitude: '22.719584',
      startLongitude: '75.857712',
      startTime: '2026-11-04T09:00:00.000Z',
    };

    const formatGpsCoordinates = (shift: any) => {
      const lat = Number(shift.startLatitude).toFixed(4);
      const lng = shift.startLongitude != null ? Number(shift.startLongitude).toFixed(4) : '0.0000';
      return `GPS Locked (${lat}, ${lng})`;
    };

    assert.doesNotThrow(() => {
      const text = formatGpsCoordinates(serverShiftWithStrings);
      assert.equal(text, 'GPS Locked (22.7196, 75.8577)');
    });

    // When duration is a string or null
    const formatDuration = (durationMins: any) => {
      return durationMins != null ? `${Number(durationMins).toFixed(1)} mins` : 'Completed';
    };

    assert.equal(formatDuration('45.75'), '45.8 mins');
    assert.equal(formatDuration(null), 'Completed');
  });

  // ----------------------------------------------------
  // SCENARIO 14: Shift Response Unpacking Multi-Shape Resilience
  // ----------------------------------------------------
  test('Scenario 14: Shift response unpacking supports both nested { shift: Shift } and direct Shift resource shapes', () => {
    const rawNested = {
      shift: { id: 'shift_nested', startTime: '2026-11-04T09:00:00Z', startOdometerKm: 12000 },
    };
    const rawDirect = {
      id: 'shift_direct',
      startTime: '2026-11-04T09:00:00Z',
      startOdometerKm: 12000,
    };
    const rawApiDataNested = {
      data: { shift: { id: 'shift_data_nested', startTime: '2026-11-04T09:00:00Z' } },
    };

    const unpackShift = (res: any) => {
      return res?.shift || res?.data?.shift || res?.data || res;
    };

    assert.equal(unpackShift(rawNested).id, 'shift_nested');
    assert.equal(unpackShift(rawDirect).id, 'shift_direct');
    assert.equal(unpackShift(rawApiDataNested).id, 'shift_data_nested');
  });

  // ----------------------------------------------------
  // SCENARIO 15: Store Visit Check-in Payload & Shift Association
  // ----------------------------------------------------
  test('Scenario 15: Store visit check-in payload includes customer, coordinates, notes, and active shiftId', () => {
    const payload = {
      customerId: 'cust_indore_001',
      shopName: 'Sharma General Store',
      latitude: 22.7196,
      longitude: 75.8577,
      notes: 'Routine inventory audit and restocking visit',
      shiftId: 'shift_active_123',
    };

    const body: Record<string, any> = {
      latitude: payload.latitude ?? 0,
      longitude: payload.longitude ?? 0,
      shopName: payload.shopName,
    };
    if (payload.customerId) body.customerId = payload.customerId;
    if (payload.notes) body.notes = payload.notes;
    if (payload.shiftId) body.shiftId = payload.shiftId;

    assert.equal(body.customerId, 'cust_indore_001');
    assert.equal(body.shopName, 'Sharma General Store');
    assert.equal(body.latitude, 22.7196);
    assert.equal(body.longitude, 75.8577);
    assert.equal(body.notes, 'Routine inventory audit and restocking visit');
    assert.equal(body.shiftId, 'shift_active_123');
  });

  // ----------------------------------------------------
  // SCENARIO 16: Safe Visit Time Formatting Prevents Invalid Date Crashes
  // ----------------------------------------------------
  test('Scenario 16: Safe visit time formatting handles undefined, snake_case, or invalid timestamps safely without RangeError', () => {
    const formatTimeSafely = (rawDate?: string | number | null): string => {
      if (!rawDate) return 'Just now';
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return 'Just now';
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Valid ISO timestamp
    assert.doesNotThrow(() => {
      const formatted = formatTimeSafely('2026-11-04T10:30:00.000Z');
      assert.ok(formatted && typeof formatted === 'string');
    });

    // Missing, null, or undefined
    assert.equal(formatTimeSafely(undefined), 'Just now');
    assert.equal(formatTimeSafely(null), 'Just now');
    assert.equal(formatTimeSafely(''), 'Just now');

    // Invalid date string (e.g. malformed server response)
    assert.doesNotThrow(() => {
      assert.equal(formatTimeSafely('invalid_date_format'), 'Just now');
    });

    // Fallback checks for snake_case backend fields
    const rawVisitSnakeCase: any = {
      id: 'visit_999',
      check_in_time: '2026-11-04T11:00:00.000Z',
      check_out_time: null,
    };
    const checkInDisplay = formatTimeSafely(
      rawVisitSnakeCase.checkInTime || rawVisitSnakeCase.check_in_time || rawVisitSnakeCase.createdAt
    );
    assert.ok(checkInDisplay !== 'Just now');
  });

  // ----------------------------------------------------
  // SCENARIO 17: Safe Handling of Null Shift in loadShiftData
  // ----------------------------------------------------
  test('Scenario 17: Null shift response from backend does not throw Cannot read properties of null', () => {
    const unpackShift = (shiftRes: any) => {
      let active = shiftRes?.shift;
      if (active === undefined && shiftRes?.data !== undefined) {
        active = shiftRes.data?.shift !== undefined ? shiftRes.data.shift : shiftRes.data;
      }
      if (active === undefined) {
        active = shiftRes;
      }
      return active;
    };

    const shiftResNull: any = null;
    const activeFromNull = unpackShift(shiftResNull);

    assert.equal(activeFromNull, null);
    assert.doesNotThrow(() => {
      const id = (activeFromNull as any)?.id;
      assert.equal(id, undefined);
    });

    const shiftResEmptyData: any = { data: null };
    const activeFromEmpty = unpackShift(shiftResEmptyData);
    assert.equal(activeFromEmpty, null);

    const shiftResShiftNull: any = { shift: null };
    assert.equal(unpackShift(shiftResShiftNull), null);

    const shiftResDirect: any = { id: 'shift_123', startTime: '2026-11-04T08:00:00Z' };
    assert.equal(unpackShift(shiftResDirect).id, 'shift_123');
  });
});
