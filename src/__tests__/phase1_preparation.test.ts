import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkCustomersCsv, parseRawCsv } from '../utils/csvParser.ts';
import { formatDateIST, formatTimeIST, formatDateTimeIST, getISTDateParts, formatCurrencyINR } from '../utils/dateUtils.ts';
import { draftStorage } from '../utils/draftStorage.ts';
import { isValidImageUri, getMimeTypeFromUri } from '../utils/imageUtils.ts';

describe('FemmeFlo Phase 1 Preparation — Mobile Utilities & Integration Suite', () => {
  it('CSV Parser: Correctly parses RFC4180 CSV with quotes, headers and normalizes phone numbers', () => {
    const csvData = `Shop Name,Contact Person,Mobile,Email,State,District,Village,Pincode
"Shree Ganesh Kirana",Ramesh Patel,9876543210,ramesh@example.com,Madhya Pradesh,Indore,Rau,453331
"A-One General Store","Sita Devi",8877665544,,Madhya Pradesh,Indore,Mhow,453441
`;

    const result = parseBulkCustomersCsv(csvData);
    assert.equal(result.totalRows, 2);
    assert.equal(result.validCount, 2);
    assert.equal(result.errorCount, 0);

    const first = result.rows[0];
    assert.equal(first.shopName, 'Shree Ganesh Kirana');
    assert.equal(first.contactName, 'Ramesh Patel');
    assert.equal(first.phone, '+919876543210');
    assert.equal(first.state, 'Madhya Pradesh');
    assert.equal(first.pincode, '453331');

    const second = result.rows[1];
    assert.equal(second.shopName, 'A-One General Store');
    assert.equal(second.contactName, 'Sita Devi');
    assert.equal(second.phone, '+918877665544');
  });

  it('CSV Parser: Detects and reports invalid rows without halting parser', () => {
    const invalidCsv = `Shop Name,Contact,Phone,Pincode
,Invalid No Name,9876543210,453331
"Valid Store",Sunil,12345,453331
"Valid Store 2",Raj,9988776655,999
"Valid Store 3",Amit,9988776655,453331
`;

    const result = parseBulkCustomersCsv(invalidCsv);
    assert.equal(result.totalRows, 4);
    assert.equal(result.validCount, 1);
    assert.equal(result.errorCount, 3);
    assert.equal(result.errors.length, 3);
    assert.match(result.errors[0].reason, /Shop Name is required/i);
    assert.match(result.errors[1].reason, /Invalid phone number/i);
    assert.match(result.errors[2].reason, /Invalid 6-digit Indian pincode/i);
  });

  it('Date Utilities: Accurately formats UTC ISO timestamps in Asia/Kolkata timezone (+5:30)', () => {
    // 2026-10-30T10:00:00Z is 15:30 (3:30 PM) IST
    const utcIso = '2026-10-30T10:00:00Z';
    const timeFormatted = formatTimeIST(utcIso);
    assert.match(timeFormatted, /3:30\s*pm/i);

    const dateFormatted = formatDateIST(utcIso, 'short');
    assert.match(dateFormatted, /30\/10\/2026/);

    const parts = getISTDateParts(utcIso);
    assert.equal(parts.year, 2026);
    assert.equal(parts.month, 10);
    assert.equal(parts.day, 30);
    assert.equal(parts.hour, 15);
    assert.equal(parts.minute, 30);
  });

  it('Currency Utilities: Formats Paise amounts into INR currency format', () => {
    assert.equal(formatCurrencyINR(2500), '₹25');
    assert.equal(formatCurrencyINR(4550), '₹45.50');
    assert.equal(formatCurrencyINR(100000), '₹1,000');
  });

  it('Image Utilities: Identifies valid image extensions and returns correct MIME types', () => {
    assert.equal(isValidImageUri('file:///var/mobile/photo.jpg'), true);
    assert.equal(isValidImageUri('https://cdn.femmeflo.com/sample.png'), true);
    assert.equal(isValidImageUri('file:///docs/invoice.pdf'), false);

    assert.equal(getMimeTypeFromUri('photo.jpg'), 'image/jpeg');
    assert.equal(getMimeTypeFromUri('document.png'), 'image/png');
    assert.equal(getMimeTypeFromUri('image.webp'), 'image/webp');
  });

  it('Draft Storage: Persists and restores customer onboarding draft', async () => {
    const testUserId = 'user_test_99';
    await draftStorage.saveCustomerDraft(testUserId, {
      shopName: 'Super Mart',
      ownerName: 'Vikas Gupta',
      phone: '9876543210',
      pincode: '452001',
      state: 'Madhya Pradesh',
      district: 'Indore',
      updatedAt: new Date().toISOString(),
    });

    const retrieved = await draftStorage.getCustomerDraft(testUserId);
    assert.ok(retrieved);
    assert.equal(retrieved?.shopName, 'Super Mart');
    assert.equal(retrieved?.ownerName, 'Vikas Gupta');
    assert.equal(retrieved?.pincode, '452001');

    await draftStorage.clearCustomerDraft(testUserId);
    const afterClear = await draftStorage.getCustomerDraft(testUserId);
    assert.equal(afterClear, null);
  });
});
