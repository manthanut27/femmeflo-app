import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { VillageToasts } from '../utils/toast.ts';

describe('Village-Friendly Toast Popups Naming & Verification Suite', () => {
  it('verifies duty/shift messages use simple everyday words without corporate jargon', () => {
    assert.strictEqual(VillageToasts.shiftStarted(120), 'Duty Started! Meter: 120 km');
    assert.strictEqual(VillageToasts.shiftStarted(), 'Duty Started! Good luck.');
    assert.strictEqual(VillageToasts.shiftEnded(15), 'Duty Finished! Travelled: 15 km');
    assert.strictEqual(VillageToasts.shiftEnded(), 'Duty Finished! Have a good rest.');
    assert.strictEqual(VillageToasts.meterRequired(), 'Please enter your bike meter reading.');
    assert.strictEqual(VillageToasts.selfieRequired(), 'Please take your selfie photo.');
    assert.strictEqual(VillageToasts.needStartShift(), 'Please start duty first before doing sales.');

    // No confusing jargon like "initialized", "odometer", "reconciliation"
    assert.ok(!VillageToasts.shiftStarted(120).toLowerCase().includes('initialize'));
    assert.ok(!VillageToasts.meterRequired().toLowerCase().includes('odometer'));
  });

  it('verifies shop visit and sales messages are direct and concise', () => {
    assert.strictEqual(VillageToasts.visitCheckedIn('Radha Store'), 'Checked in at Radha Store!');
    assert.strictEqual(VillageToasts.visitCheckedIn(), 'Shop Visit Started!');
    assert.strictEqual(VillageToasts.visitCheckedOut('Radha Store'), 'Finished visit at Radha Store!');
    assert.strictEqual(VillageToasts.saleRecorded(), 'Sale Done! Bill saved.');
    assert.strictEqual(VillageToasts.emptyCart(), 'Cart is empty. Add at least 1 packet.');
    assert.strictEqual(VillageToasts.paymentReceived(), 'Cash Received! Payment marked as Done.');
    assert.strictEqual(VillageToasts.paymentPending(), 'Bill saved as Credit (Unpaid).');
  });

  it('verifies customer onboarding and GPS messages give clear instructions', () => {
    assert.strictEqual(VillageToasts.customerAdded('Gupta General Store'), 'Gupta General Store added successfully!');
    assert.strictEqual(VillageToasts.customerAdded(), 'New Shop Added!');
    assert.strictEqual(VillageToasts.fillRequiredFields(), 'Please fill all details marked with *');
    assert.strictEqual(VillageToasts.validPhoneRequired(), 'Please enter a valid 10-digit mobile number.');
    assert.strictEqual(VillageToasts.photoSaved(), 'Shop photo saved!');
    assert.strictEqual(VillageToasts.gpsNeeded(), 'Turn on GPS and stand in open area.');
  });

  it('verifies stock and warehouse messages avoid confusing logistics terminology', () => {
    assert.strictEqual(VillageToasts.stockTransferred(), 'Stock Moved! Packets sent to depot.');
    assert.strictEqual(VillageToasts.stockReceived(5000), '5,000 packets added to HQ stock!');
    assert.strictEqual(VillageToasts.warehouseAdded('Thane Depot'), 'Thane Depot warehouse added!');
    assert.strictEqual(VillageToasts.notEnoughStock(), 'Not enough packets in stock.');

    // Avoid jargon like "inter-depot dispatch", "receipt voucher"
    assert.ok(!VillageToasts.stockTransferred().toLowerCase().includes('dispatched'));
  });

  it('verifies offline and sync messages reassure village users when internet is spotty', () => {
    assert.strictEqual(VillageToasts.noInternet(), 'No Internet! Working in Offline Mode.');
    assert.strictEqual(VillageToasts.savedToPhone(), 'Saved to phone! Will upload when network comes.');
    assert.strictEqual(VillageToasts.dataSynced(), 'All data sent to office successfully!');
  });
});

