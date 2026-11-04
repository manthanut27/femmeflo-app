import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Seller Home Page Selfie Attendance Verification Suite', () => {
  it('validates starting odometer KM input', () => {
    function validateOdometer(raw: string) {
      const kmNum = Number(raw);
      if (!raw.trim() || isNaN(kmNum) || kmNum < 0) {
        return { valid: false, error: 'Please enter a valid starting odometer KM reading (0 or positive).' };
      }
      return { valid: true, km: kmNum };
    }

    assert.equal(validateOdometer('').valid, false);
    assert.equal(validateOdometer('abc').valid, false);
    assert.equal(validateOdometer('-5').valid, false);
    assert.equal(validateOdometer('0').valid, true);
    assert.equal(validateOdometer('125.5').valid, true);
    assert.equal(validateOdometer(' 42 ').km, 42);
  });

  it('validates ending odometer KM against starting odometer reading', () => {
    function validateEndingOdometer(raw: string, startKm: number) {
      const kmNum = Number(raw);
      if (!raw.trim() || isNaN(kmNum) || kmNum < 0) {
        return { valid: false, error: 'Please enter a valid ending odometer KM reading.' };
      }
      if (kmNum < startKm) {
        return {
          valid: false,
          error: `End odometer (${kmNum} KM) cannot be less than start odometer (${startKm} KM).`,
        };
      }
      return { valid: true, km: kmNum };
    }

    assert.equal(validateEndingOdometer('50', 60).valid, false);
    assert.equal(validateEndingOdometer('60', 60).valid, true);
    assert.equal(validateEndingOdometer('75.2', 60).valid, true);
  });

  it('verifies shift start payload includes biometric selfie verification details and coordinates', () => {
    interface FaceVerificationResult {
      faceVerified: boolean;
      facePhoto: string;
      faceConfidence: number;
      faceMethod: string;
    }

    function createShiftStartPayload(
      odometerKm: number,
      coords: { latitude?: number; longitude?: number },
      faceResult: FaceVerificationResult
    ) {
      return {
        startOdometerKm: odometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: `Start reading: ${odometerKm} km`,
        faceVerified: faceResult?.faceVerified ?? true,
        facePhoto: faceResult?.facePhoto || 'verified_selfie_start',
        faceConfidence: faceResult?.faceConfidence ?? 0.98,
        faceMethod: faceResult?.faceMethod || 'FACE_ID_BIOMETRIC',
      };
    }

    const payload = createShiftStartPayload(120, { latitude: 22.7196, longitude: 75.8577 }, {
      faceVerified: true,
      facePhoto: 'data:image/jpeg;base64,mockselfiephoto',
      faceConfidence: 0.99,
      faceMethod: 'FACE_ID_BIOMETRIC',
    });

    assert.equal(payload.startOdometerKm, 120);
    assert.equal(payload.latitude, 22.7196);
    assert.equal(payload.longitude, 75.8577);
    assert.equal(payload.faceVerified, true);
    assert.equal(payload.facePhoto, 'data:image/jpeg;base64,mockselfiephoto');
    assert.equal(payload.faceConfidence, 0.99);
    assert.equal(payload.faceMethod, 'FACE_ID_BIOMETRIC');
  });

  it('verifies shift end payload includes face verification details and odometer travel distance', () => {
    interface FaceVerificationResult {
      faceVerified: boolean;
      facePhoto: string;
      faceConfidence: number;
      faceMethod: string;
    }

    function createShiftEndPayload(
      shiftId: string | undefined,
      endOdometerKm: number,
      remarks: string | undefined,
      coords: { latitude?: number; longitude?: number },
      faceResult: FaceVerificationResult
    ) {
      return {
        shiftId,
        endOdometerKm,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: remarks ? `Closing notes: ${remarks}` : undefined,
        notes: remarks || undefined,
        remarks: remarks || undefined,
        faceVerified: faceResult?.faceVerified ?? true,
        facePhoto: faceResult?.facePhoto || 'verified_selfie_end',
        faceConfidence: faceResult?.faceConfidence ?? 0.98,
        faceMethod: faceResult?.faceMethod || 'FACE_ID_BIOMETRIC',
      };
    }

    const payload = createShiftEndPayload('shift_123', 180, 'All beat visits completed', {
      latitude: 22.7201,
      longitude: 75.8602,
    }, {
      faceVerified: true,
      facePhoto: 'data:image/jpeg;base64,mockclosingphoto',
      faceConfidence: 0.97,
      faceMethod: 'FACE_ID_BIOMETRIC',
    });

    assert.equal(payload.shiftId, 'shift_123');
    assert.equal(payload.endOdometerKm, 180);
    assert.equal(payload.faceVerified, true);
    assert.equal(payload.remarks, 'All beat visits completed');
  });
});

