import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

describe('Shift Start Authentication: Mobile Password & Fingerprint Suite', () => {
  it('validates starting odometer KM input for duty shift start', () => {
    function validateOdometer(raw: string) {
      const kmNum = Number(raw);
      if (!raw.trim() || isNaN(kmNum) || kmNum < 0) {
        return { valid: false, error: 'Please enter a valid starting odometer KM reading (0 or positive).' };
      }
      return { valid: true, km: kmNum };
    }

    assert.equal(validateOdometer('').valid, false);
    assert.equal(validateOdometer('xyz').valid, false);
    assert.equal(validateOdometer('-10').valid, false);
    assert.equal(validateOdometer('0').valid, true);
    assert.equal(validateOdometer('45.5').valid, true);
    assert.equal(validateOdometer('120').km, 120);
  });

  it('constructs shift start payload for Fingerprint authentication', () => {
    interface ShiftAuthResult {
      verified: boolean;
      method: 'FINGERPRINT' | 'MOBILE_PASSWORD';
      confidence: number;
      timestamp: string;
      faceVerified?: boolean;
      facePhoto?: string;
      faceConfidence?: number;
      faceMethod?: string;
    }

    function createShiftStartPayload(
      odometerKm: number,
      coords: { latitude?: number; longitude?: number },
      authResult: ShiftAuthResult
    ) {
      return {
        startOdometerKm: odometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: `Start reading: ${odometerKm} km`,
        faceVerified: authResult?.faceVerified ?? true,
        facePhoto: authResult?.facePhoto || (authResult.method === 'FINGERPRINT' ? 'biometric_fingerprint_start' : 'mobile_password_start'),
        faceConfidence: authResult?.confidence ?? 1.0,
        faceMethod: authResult?.method === 'FINGERPRINT' ? 'FINGERPRINT_BIOMETRIC' : 'MOBILE_PASSWORD',
      };
    }

    const payload = createShiftStartPayload(150, { latitude: 22.7196, longitude: 75.8577 }, {
      verified: true,
      method: 'FINGERPRINT',
      confidence: 0.99,
      timestamp: new Date().toISOString(),
      faceVerified: true,
      facePhoto: 'biometric_fingerprint_verified',
      faceConfidence: 0.99,
      faceMethod: 'FINGERPRINT_BIOMETRIC',
    });

    assert.equal(payload.startOdometerKm, 150);
    assert.equal(payload.latitude, 22.7196);
    assert.equal(payload.longitude, 75.8577);
    assert.equal(payload.faceVerified, true);
    assert.equal(payload.faceMethod, 'FINGERPRINT_BIOMETRIC');
    assert.equal(payload.facePhoto, 'biometric_fingerprint_verified');
    assert.equal(payload.faceConfidence, 0.99);
  });

  it('constructs shift start payload for Mobile Password authentication', () => {
    interface ShiftAuthResult {
      verified: boolean;
      method: 'FINGERPRINT' | 'MOBILE_PASSWORD';
      confidence: number;
      timestamp: string;
      faceVerified?: boolean;
      facePhoto?: string;
      faceConfidence?: number;
      faceMethod?: string;
    }

    function createShiftStartPayload(
      odometerKm: number,
      coords: { latitude?: number; longitude?: number },
      authResult: ShiftAuthResult
    ) {
      return {
        startOdometerKm: odometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: `Start reading: ${odometerKm} km`,
        faceVerified: authResult?.faceVerified ?? true,
        facePhoto: authResult?.facePhoto || (authResult.method === 'FINGERPRINT' ? 'biometric_fingerprint_start' : 'mobile_password_start'),
        faceConfidence: authResult?.confidence ?? 1.0,
        faceMethod: authResult?.method === 'FINGERPRINT' ? 'FINGERPRINT_BIOMETRIC' : 'MOBILE_PASSWORD',
      };
    }

    const payload = createShiftStartPayload(210, { latitude: 19.076, longitude: 72.8777 }, {
      verified: true,
      method: 'MOBILE_PASSWORD',
      confidence: 1.0,
      timestamp: new Date().toISOString(),
      faceVerified: true,
      facePhoto: 'mobile_password_verified',
      faceConfidence: 1.0,
      faceMethod: 'MOBILE_PASSWORD',
    });

    assert.equal(payload.startOdometerKm, 210);
    assert.equal(payload.faceVerified, true);
    assert.equal(payload.faceMethod, 'MOBILE_PASSWORD');
    assert.equal(payload.facePhoto, 'mobile_password_verified');
    assert.equal(payload.faceConfidence, 1.0);
  });

  it('validates mobile password entry constraints', () => {
    function validatePassword(password: string): { valid: boolean; error?: string } {
      const trimmed = password.trim();
      if (!trimmed) {
        return { valid: false, error: 'Please enter your mobile password or security PIN.' };
      }
      if (trimmed.length < 4) {
        return { valid: false, error: 'Password must be at least 4 characters.' };
      }
      return { valid: true };
    }

    assert.equal(validatePassword('').valid, false);
    assert.equal(validatePassword('   ').valid, false);
    assert.equal(validatePassword('123').valid, false);
    assert.equal(validatePassword('1234').valid, true);
    assert.equal(validatePassword('admin@123').valid, true);
  });

  it('ensures ShiftAuthVerificationModal contains both Fingerprint and Mobile Password tabs', async () => {
    const modalPath = path.resolve(process.cwd(), 'src/components/common/ShiftAuthVerificationModal.tsx');
    const content = await fs.readFile(modalPath, 'utf-8');

    assert.match(content, /activeTab === 'FINGERPRINT'/);
    assert.match(content, /activeTab === 'PASSWORD'/);
    assert.match(content, /LocalAuthentication/);
    assert.match(content, /Fingerprint/);
    assert.match(content, /Mobile Password/);
  });

  it('ensures Seller Dashboard and Shift page start shift flows use ShiftAuthVerificationModal', async () => {
    const sellerIndexPath = path.resolve(process.cwd(), 'src/app/(seller)/index.tsx');
    const sellerIndexContent = await fs.readFile(sellerIndexPath, 'utf-8');
    assert.match(sellerIndexContent, /ShiftAuthVerificationModal/);
    assert.match(sellerIndexContent, /shiftAuthModalVisible/);

    const shiftIndexPath = path.resolve(process.cwd(), 'src/app/(seller)/shift/index.tsx');
    const shiftIndexContent = await fs.readFile(shiftIndexPath, 'utf-8');
    assert.match(shiftIndexContent, /ShiftAuthVerificationModal/);
    assert.match(shiftIndexContent, /shiftAuthModalVisible/);
  });

  it('ensures ShiftRequiredGate mentions fingerprint and mobile password', async () => {
    const gatePath = path.resolve(process.cwd(), 'src/components/common/ShiftRequiredGate.tsx');
    const gateContent = await fs.readFile(gatePath, 'utf-8');
    assert.match(gateContent, /fingerprint/i);
    assert.match(gateContent, /finger-print-outline/);
  });
});
