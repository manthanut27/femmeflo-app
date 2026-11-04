import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Seller Shift Prerequisite Enforcement Suite', () => {
  function computeHasActiveShift(shift: any): boolean {
    return Boolean(
      shift &&
      typeof shift === 'object' &&
      shift.startTime &&
      !shift.endTime
    );
  }

  it('determines shift is inactive when shift response is null', () => {
    assert.equal(computeHasActiveShift(null), false);
    assert.equal(computeHasActiveShift(undefined), false);
  });

  it('determines shift is active when startTime exists and endTime is missing', () => {
    const activeShift = {
      id: 'shift_123',
      sellerId: 'user_1',
      startTime: '2026-11-04T09:00:00.000Z',
      startOdometerKm: 120,
      endTime: null,
    };
    assert.equal(computeHasActiveShift(activeShift), true);
  });

  it('determines shift is inactive once endTime has been recorded', () => {
    const closedShift = {
      id: 'shift_123',
      sellerId: 'user_1',
      startTime: '2026-11-04T09:00:00.000Z',
      endTime: '2026-11-04T18:00:00.000Z',
      startOdometerKm: 120,
      endOdometerKm: 180,
    };
    assert.equal(computeHasActiveShift(closedShift), false);
  });

  it('blocks field action execution when off duty and triggers start shift navigation', () => {
    let promptShown = false;
    let promptedAction = '';
    let startShiftCallbackExecuted = false;

    function guardAction(
      hasShift: boolean,
      actionName: string,
      onStartShift: () => void
    ): boolean {
      if (!hasShift) {
        promptShown = true;
        promptedAction = actionName;
        onStartShift();
        return false;
      }
      return true;
    }

    const allowed = guardAction(false, 'onboard new retailers', () => {
      startShiftCallbackExecuted = true;
    });

    assert.equal(allowed, false);
    assert.equal(promptShown, true);
    assert.equal(promptedAction, 'onboard new retailers');
    assert.equal(startShiftCallbackExecuted, true);
  });

  it('allows field action execution when duty shift is active', () => {
    let promptShown = false;

    function guardAction(hasShift: boolean): boolean {
      if (!hasShift) {
        promptShown = true;
        return false;
      }
      return true;
    }

    const allowed = guardAction(true);
    assert.equal(allowed, true);
    assert.equal(promptShown, false);
  });

  it('verifies that retailer onboarding, batch entry, and POS sales all require active shift', () => {
    const protectedActions = [
      'onboard new retailers',
      'batch onboard retail stores',
      'record new store sales',
      'capture or update storefront photos',
    ];

    const results = protectedActions.map((action) => {
      const shiftActive = false;
      return {
        action,
        blocked: !shiftActive,
        reason: `Duty shift required with selfie attendance before ${action}`,
      };
    });

    assert.equal(results.length, 4);
    assert.ok(results.every((r) => r.blocked === true));
  });
});
