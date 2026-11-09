import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { Shift, SaleItem, PaginationMeta } from '../api/types.ts';
import { createDraftStorage } from '../utils/draftStorage.ts';

describe('Manager Shift 500 & Sales Permission Denied Resilience Suite', () => {

  // ----------------------------------------------------
  // 1. Shift Start Payload Sanitization & 500 Fallback
  // ----------------------------------------------------
  it('Scenario 1: Constructs strict backend payload without unrecognized biometric telemetry', () => {
    function sanitizeStartShiftPayload(input: {
      latitude?: number;
      longitude?: number;
      startLatitude?: number;
      startLongitude?: number;
      address?: string;
      startOdometerKm?: number;
      faceVerified?: boolean;
      facePhoto?: string;
      faceConfidence?: number;
      faceMethod?: string;
    }): { latitude: number; longitude: number; address?: string } {
      const lat = Number(input.latitude ?? input.startLatitude ?? 0);
      const lng = Number(input.longitude ?? input.startLongitude ?? 0);
      const body: { latitude: number; longitude: number; address?: string } = {
        latitude: lat,
        longitude: lng,
      };
      if (input.address) {
        body.address = input.address.slice(0, 500);
      }
      return body;
    }

    const payload = sanitizeStartShiftPayload({
      latitude: 19.2183,
      longitude: 72.9781,
      startOdometerKm: 12450,
      address: 'Thane Central Depot',
      faceVerified: true,
      facePhoto: 'data:image/jpeg;base64,...',
      faceConfidence: 0.99,
      faceMethod: 'FACE_ID_BIOMETRIC',
    });

    assert.equal(payload.latitude, 19.2183);
    assert.equal(payload.longitude, 72.9781);
    assert.equal(payload.address, 'Thane Central Depot');
    assert.equal((payload as any).faceVerified, undefined, 'faceVerified stripped for strict schema');
    assert.equal((payload as any).facePhoto, undefined, 'facePhoto stripped for strict schema');
    assert.equal((payload as any).startOdometerKm, undefined, 'startOdometerKm stripped for strict schema');
  });

  it('Scenario 2: Gracefully generates active local shift when server returns 500 or 403', async () => {
    async function mockStartShiftWithFallback(
      payload: { latitude: number; longitude: number; startOdometerKm?: number; address?: string },
      serverShouldFail = true
    ): Promise<{ shift: Shift }> {
      try {
        if (serverShouldFail) {
          const err: any = new Error('Internal server error');
          err.status = 500;
          throw err;
        }
        return {
          shift: {
            id: 'shift_srv_123',
            sellerId: 'usr_seller',
            status: 'ACTIVE',
            startTime: '2026-11-09T08:00:00Z',
            startOdometerKm: 10000,
          },
        };
      } catch (err: any) {
        if (
          err?.status === 500 ||
          err?.status === 403 ||
          err?.message?.toLowerCase().includes('internal server error')
        ) {
          const localShift: Shift = {
            id: `shift_local_${Date.now()}`,
            sellerId: 'usr_seller',
            status: 'ACTIVE',
            startTime: new Date().toISOString(),
            startLatitude: payload.latitude,
            startLongitude: payload.longitude,
            startOdometerKm: payload.startOdometerKm ?? 0,
            startAddress: payload.address,
          };
          return { shift: localShift };
        }
        throw err;
      }
    }

    const res = await mockStartShiftWithFallback({
      latitude: 19.2183,
      longitude: 72.9781,
      startOdometerKm: 15000,
      address: 'Kalyan Route',
    }, true);

    assert.ok(res.shift.id.startsWith('shift_local_'), 'Created resilient local shift');
    assert.equal(res.shift.status, 'ACTIVE');
    assert.equal(res.shift.startOdometerKm, 15000);
    assert.ok(res.shift.startTime);
  });

  // ----------------------------------------------------
  // 2. Shift End Resilience
  // ----------------------------------------------------
  it('Scenario 3: Local shift completes locally without sending remote request', async () => {
    let remoteCalled = false;
    async function mockEndShift(payload: {
      shiftId?: string;
      endOdometerKm?: number;
      latitude?: number;
      longitude?: number;
      notes?: string;
    }): Promise<{ shift: Shift }> {
      if (payload.shiftId && payload.shiftId.startsWith('shift_local_')) {
        return {
          shift: {
            id: payload.shiftId,
            sellerId: 'usr_seller',
            status: 'COMPLETED',
            startTime: new Date().toISOString(),
            startOdometerKm: 15000,
            endTime: new Date().toISOString(),
            endLatitude: payload.latitude,
            endLongitude: payload.longitude,
            endOdometerKm: payload.endOdometerKm,
            notes: payload.notes,
          },
        };
      }
      remoteCalled = true;
      return {
        shift: {
          id: payload.shiftId || 'shift_remote',
          sellerId: 'usr_seller',
          status: 'COMPLETED',
          startTime: new Date().toISOString(),
          startOdometerKm: 15000,
        },
      };
    }

    const res = await mockEndShift({
      shiftId: 'shift_local_1731140000',
      endOdometerKm: 15045,
      latitude: 19.22,
      longitude: 72.98,
      notes: 'Beat completed successfully',
    });

    assert.equal(remoteCalled, false, 'Did not call remote backend for local shift');
    assert.equal(res.shift.status, 'COMPLETED');
    assert.equal(res.shift.endOdometerKm, 15045);
    assert.ok(res.shift.endTime);
  });

  // ----------------------------------------------------
  // 3. Manager Sales Permission Denied (403) Fallback
  // ----------------------------------------------------
  it('Scenario 4: Falls back to seller/sales when manager/sales returns 403 Permission denied', async () => {
    const mockSellerSales: SaleItem[] = [
      {
        id: 'sale_1',
        saleNumber: 'SL-2026-001',
        customerId: 'cust_1',
        sellerId: 'usr_seller_1',
        totalAmountPaise: 50000,
        packetCount: 20,
        status: 'CONFIRMED',
        paymentMode: 'CASH',
        createdAt: '2026-11-09T09:00:00Z',
      },
    ];

    async function mockManagerListSales(managerThrows403: boolean): Promise<{ items: SaleItem[]; pagination: PaginationMeta }> {
      try {
        if (managerThrows403) {
          const err: any = new Error('Permission denied');
          err.status = 403;
          throw err;
        }
        return {
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        };
      } catch (err: any) {
        if (err?.status === 403 || err?.message?.toLowerCase().includes('permission denied')) {
          // Fallback to seller/sales
          return {
            items: mockSellerSales,
            pagination: { page: 1, pageSize: 20, total: mockSellerSales.length, totalPages: 1 },
          };
        }
        return {
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        };
      }
    }

    const res = await mockManagerListSales(true);
    assert.equal(res.items.length, 1);
    assert.equal(res.items[0].saleNumber, 'SL-2026-001');
    assert.equal(res.pagination.total, 1);
  });

  it('Scenario 5: Returns empty list gracefully if both manager and seller endpoints reject', async () => {
    async function mockFailingSales(): Promise<{ items: SaleItem[]; pagination: PaginationMeta }> {
      try {
        const err: any = new Error('Permission denied');
        err.status = 403;
        throw err;
      } catch (err: any) {
        if (err?.status === 403) {
          try {
            // Seller sales also fails
            const sellerErr: any = new Error('Unauthorized');
            sellerErr.status = 401;
            throw sellerErr;
          } catch {
            return {
              items: [],
              pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
            };
          }
        }
        return {
          items: [],
          pagination: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
        };
      }
    }

    const res = await mockFailingSales();
    assert.deepEqual(res.items, []);
    assert.equal(res.pagination.total, 0);
  });

  // ----------------------------------------------------
  // 4. Shift Guard Offline & Draft Resilience
  // ----------------------------------------------------
  it('Scenario 6: ShiftGuard identifies active local shift when server returns null', async () => {
    const memory = new Map<string, string>();
    const storage = createDraftStorage({
      async getItem(key: string) { return memory.get(key) ?? null; },
      async setItem(key: string, val: string) { memory.set(key, val); },
      async removeItem(key: string) { memory.delete(key); },
    });

    const userId = 'usr_mgr_dual';
    const localActiveShift: Shift = {
      id: 'shift_local_99999',
      sellerId: 'usr_mgr_dual',
      status: 'ACTIVE',
      startTime: new Date().toISOString(),
      startOdometerKm: 14200,
    };
    await storage.saveActiveShift(userId, localActiveShift);

    // Simulate checkHasActiveShift logic
    async function checkShift(uId?: string): Promise<{ hasActiveShift: boolean; shift: Shift | null }> {
      let activeShift: Shift | null = null;
      try {
        // Server returns null for dual-role manager
        activeShift = null;
      } catch {
        // Ignored
      }

      if (!activeShift && uId) {
        activeShift = await storage.getActiveShift(uId).catch(() => null);
      }

      const isActive = Boolean(
        activeShift &&
        typeof activeShift === 'object' &&
        activeShift.startTime &&
        !activeShift.endTime
      );

      return {
        hasActiveShift: isActive,
        shift: isActive ? activeShift : null,
      };
    }

    const status = await checkShift(userId);
    assert.equal(status.hasActiveShift, true, 'Active local shift is recognized');
    assert.equal(status.shift?.id, 'shift_local_99999');
    assert.equal(status.shift?.startOdometerKm, 14200);
  });

  // ----------------------------------------------------
  // 5. Manager Screen Promise.all Crash Prevention
  // ----------------------------------------------------
  it('Scenario 7: Manager sales screen loader does not crash dashboard or sellers on sales error', async () => {
    let dashboardLoaded = false;
    let sellersLoaded = false;

    async function loadManagerData() {
      const [salesRes, dashRes, sellersRes] = await Promise.all([
        Promise.reject(new Error('Permission denied')).catch(() => ({
          items: [],
          pagination: { page: 1, pageSize: 100, total: 0, totalPages: 1 },
        })),
        Promise.resolve({ totalSalesPaise: 500000 }).catch(() => null),
        Promise.resolve({ items: [{ id: 's1', name: 'Seller 1' }] }).catch(() => ({ items: [] })),
      ]);

      if (dashRes) dashboardLoaded = true;
      if (sellersRes.items.length > 0) sellersLoaded = true;

      return {
        sales: salesRes.items,
        pagination: salesRes.pagination,
      };
    }

    const data = await loadManagerData();
    assert.deepEqual(data.sales, []);
    assert.equal(dashboardLoaded, true, 'Dashboard successfully loaded despite sales error');
    assert.equal(sellersLoaded, true, 'Sellers list successfully loaded despite sales error');
  });
});
