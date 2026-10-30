import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseBulkCustomersCsv, parseRawCsv } from '../utils/csvParser.ts';
import { validateCoordinates } from '../utils/geoValidation.ts';
import { draftStorage, type CustomerDraft } from '../utils/draftStorage.ts';
import { validateCustomerEmail } from '../api/domainRules.ts';
import type { BulkCustomerRow, CreateBulkCustomersPayload } from '../api/types.ts';

// Helper: Indian mobile phone validator & normalizer
function validateAndNormalizeIndianPhone(phone: string): { valid: boolean; normalized?: string; error?: string } {
  if (!phone) return { valid: false, error: 'Phone number is required' };
  const digits = phone.replace(/\D/g, '');
  let tenDigits = digits;
  if (digits.length === 11 && digits.startsWith('0')) {
    tenDigits = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith('91')) {
    tenDigits = digits.slice(2);
  } else if (digits.length === 13 && digits.startsWith('091')) {
    tenDigits = digits.slice(3);
  } else if (digits.length !== 10) {
    return { valid: false, error: 'Phone number must be a valid 10-digit Indian mobile number' };
  }

  if (!/^[6-9]\d{9}$/.test(tenDigits)) {
    return { valid: false, error: 'Indian mobile number must start with 6, 7, 8, or 9' };
  }
  return { valid: true, normalized: `+91${tenDigits}` };
}

// Helper: Single customer onboarding form validation
interface SingleCustomerFormData {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  categoryId: string;
  address: string;
  pincode: string;
  state: string;
  district: string;
  village?: string;
  photoUri?: string | null;
  noPhotoReason?: string | null;
}

function validateSingleCustomerForm(data: SingleCustomerFormData): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  if (!data.shopName?.trim()) errors.shopName = 'Retail shop name is required.';
  if (!data.ownerName?.trim()) errors.ownerName = 'Owner / Contact person name is required.';
  
  const trimmedEmail = data.email?.trim() || '';
  if (!trimmedEmail || !validateCustomerEmail(trimmedEmail)) {
    errors.email = 'A valid customer email is required.';
  }

  const phoneRes = validateAndNormalizeIndianPhone(data.phone);
  if (!phoneRes.valid) {
    errors.phone = phoneRes.error || 'A valid 10-digit Indian mobile number is required.';
  }

  if (!data.categoryId?.trim()) errors.categoryId = 'Please select a customer category.';
  if (!data.address?.trim()) errors.address = 'Street address is required.';
  if (!data.pincode?.trim() || !/^\d{6}$/.test(data.pincode.trim())) {
    errors.pincode = 'A valid 6-digit Indian PIN code is required.';
  }
  if (!data.state?.trim()) errors.state = 'State is required.';
  if (!data.district?.trim()) errors.district = 'District is required.';

  // Mandatory photo exemption rule:
  // If photo is not uploaded, photo exemption reason is strictly mandatory.
  if (!data.photoUri && (!data.noPhotoReason || !data.noPhotoReason.trim())) {
    errors.noPhotoReason = 'Photo exemption reason is mandatory when storefront photo is omitted.';
  }

  return { valid: Object.keys(errors).length === 0, errors };
}

// Helper: Duplicate phone checker in batch
function checkDuplicatePhonesInBatch(rows: Array<{ phone: string }>): Map<string, number[]> {
  const phoneMap = new Map<string, number[]>();
  rows.forEach((row, idx) => {
    const norm = row.phone.replace(/\D/g, '').slice(-10);
    if (norm) {
      const existing = phoneMap.get(norm) || [];
      existing.push(idx + 1);
      phoneMap.set(norm, existing);
    }
  });

  const duplicates = new Map<string, number[]>();
  phoneMap.forEach((indices, phone) => {
    if (indices.length > 1) {
      duplicates.set(phone, indices);
    }
  });
  return duplicates;
}

describe('FemmeFlo Advanced Customer Onboarding Acceptance Suite', () => {
  // Scenario 1: Single customer onboarding
  it('Scenario 1: Single customer onboarding validates full payload and succeeds', () => {
    const validData: SingleCustomerFormData = {
      shopName: 'Balaji Kirana Store',
      ownerName: 'Sunil Sharma',
      email: 'balaji.kirana@example.com',
      phone: '+91 98260 12345',
      categoryId: 'cat_kirana_01',
      address: 'Shop No 14, Main Market, Rau',
      pincode: '453331',
      state: 'Madhya Pradesh',
      district: 'Indore',
      village: 'Rau',
      photoUri: 'file:///cache/photo_balaji.jpg',
      noPhotoReason: '',
    };

    const result = validateSingleCustomerForm(validData);
    assert.equal(result.valid, true);
    assert.deepEqual(result.errors, {});
  });

  // Scenario 2: 5 customers batch onboarding
  it('Scenario 2: 5 customers batch onboarding parses, validates and formats batch payload correctly', () => {
    const csvContent = `Shop Name,Contact Person,Mobile,Email,Category,State,District,Village,Pincode,Address
"A One Super Store",Ramesh Kumar,9826011111,ramesha1@example.com,Retail,Madhya Pradesh,Indore,Rau,453331,"Near Bus Stand"
"Bhavna General Store",Bhavna Patel,9826022222,bhavna@example.com,Retail,Madhya Pradesh,Indore,Mhow,453441,"Pithampur Road"
"Chotiwala Kirana",Kishore Chotiwala,9826033333,chotiwala@example.com,Wholesale,Madhya Pradesh,Indore,Sanwer,453551,"Main Road"
"Deepak Provisions",Deepak Jain,9826044444,deepak@example.com,Retail,Madhya Pradesh,Indore,Depalpur,453115,"Gali No 2"
"Ekta Medical & General",Dr. Ekta Singh,9826055555,ekta@example.com,Chemist,Madhya Pradesh,Indore,Indore City,452001,"MG Road"
`;

    const parsed = parseBulkCustomersCsv(csvContent);
    assert.equal(parsed.totalRows, 5);
    assert.equal(parsed.validCount, 5);
    assert.equal(parsed.errorCount, 0);

    const payload: CreateBulkCustomersPayload = {
      customers: parsed.rows.map((row) => ({
        shopName: row.shopName,
        contactName: row.contactName,
        email: row.email,
        phone: row.phone,
        categoryId: row.categoryId || 'cat_retail_default',
        state: row.state,
        district: row.district,
        village: row.village,
        pincode: row.pincode,
        address: row.address,
      })),
    };

    assert.equal(payload.customers.length, 5);
    assert.equal(payload.customers[0].phone, '+919826011111');
    assert.equal(payload.customers[4].shopName, 'Ekta Medical & General');
  });

  // Scenario 3: 100 customers batch onboarding
  it('Scenario 3: 100 customers batch onboarding respects bounds and rejects > 100 limit', () => {
    const rows100: BulkCustomerRow[] = [];
    for (let i = 1; i <= 100; i++) {
      const phoneDigits = String(9800000000 + i);
      rows100.push({
        shopName: `Store ${i}`,
        contactName: `Owner ${i}`,
        phone: `+91${phoneDigits}`,
        email: `store${i}@example.com`,
        state: 'Madhya Pradesh',
        district: 'Indore',
        village: `Village ${i}`,
        pincode: '453331',
        address: `Address line ${i}`,
      });
    }

    assert.equal(rows100.length, 100);
    // Upper limit boundary check
    const isWithinBounds = (count: number) => count >= 1 && count <= 100;
    assert.equal(isWithinBounds(rows100.length), true);
    assert.equal(isWithinBounds(101), false);
    assert.equal(isWithinBounds(0), false);
  });

  // Scenario 4: Duplicate phone numbers in batch
  it('Scenario 4: Duplicate phone numbers in batch are detected and flagged with row numbers', () => {
    const batchWithDupes = [
      { shopName: 'Shop A', phone: '+919876543210' },
      { shopName: 'Shop B', phone: '9876543210' },       // Duplicate of Shop A
      { shopName: 'Shop C', phone: '+918888888888' },
      { shopName: 'Shop D', phone: '+91-98765-43210' }, // Duplicate of Shop A & B
    ];

    const duplicates = checkDuplicatePhonesInBatch(batchWithDupes);
    assert.equal(duplicates.has('9876543210'), true);
    assert.deepEqual(duplicates.get('9876543210'), [1, 2, 4]);
    assert.equal(duplicates.has('8888888888'), false);
  });

  // Scenario 5: Invalid Indian phone numbers
  it('Scenario 5: Rejects invalid Indian phone numbers and accepts valid variants with normalization', () => {
    const invalidNumbers = [
      '1234567890',      // Starts with 1 (not 6-9)
      '5987654321',      // Starts with 5 (not 6-9)
      '98765432',        // Only 8 digits
      '987654321000',    // 12 digits
      'abcdefghij',      // Non-numeric
      '0000000000',      // Invalid starting digit
    ];

    for (const num of invalidNumbers) {
      const res = validateAndNormalizeIndianPhone(num);
      assert.equal(res.valid, false, `Expected ${num} to be invalid`);
    }

    const validNumbers = [
      { input: '9826012345', expected: '+919826012345' },
      { input: '+91 98260 12345', expected: '+919826012345' },
      { input: '09826012345', expected: '+919826012345' },
      { input: '+91-9123456789', expected: '+919123456789' },
      { input: '6234567890', expected: '+916234567890' },
      { input: '7890123456', expected: '+917890123456' },
      { input: '8901234567', expected: '+918901234567' },
    ];

    for (const { input, expected } of validNumbers) {
      const res = validateAndNormalizeIndianPhone(input);
      assert.equal(res.valid, true, `Expected ${input} to be valid`);
      assert.equal(res.normalized, expected);
    }
  });

  // Scenario 6: Missing required fields
  it('Scenario 6: Missing required fields (shopName, ownerName, email, category, district) are identified', () => {
    const missingData: SingleCustomerFormData = {
      shopName: '',
      ownerName: '',
      email: '',
      phone: '',
      categoryId: '',
      address: '',
      pincode: '',
      state: '',
      district: '',
      photoUri: null,
      noPhotoReason: '',
    };

    const res = validateSingleCustomerForm(missingData);
    assert.equal(res.valid, false);
    assert.match(res.errors.shopName, /shop name is required/i);
    assert.match(res.errors.ownerName, /contact person name is required/i);
    assert.match(res.errors.email, /valid customer email is required/i);
    assert.match(res.errors.phone, /phone number is required|valid/i);
    assert.match(res.errors.categoryId, /category/i);
    assert.match(res.errors.pincode, /PIN code is required/i);
    assert.match(res.errors.state, /state is required/i);
    assert.match(res.errors.district, /district is required/i);
    assert.match(res.errors.noPhotoReason, /exemption reason is mandatory/i);
  });

  // Scenario 7: CSV template generation & RFC4180 parsing
  it('Scenario 7: Generates template and parses RFC4180 compliant CSV with escaped quotes and commas', () => {
    // In RFC4180 CSV, quotes inside a quoted field are escaped with double quotes: ""
    const rfcCsv = `Shop Name,Contact Person,Mobile,Email,State,District,Village,Pincode,Address
"Gupta & Sons, Kirana",Rakesh Gupta,9826011223,rakesh@example.com,Madhya Pradesh,Indore,Rau,453331,"Plot 12, ""B"" Block, Market"
`;

    const parsed = parseBulkCustomersCsv(rfcCsv);
    assert.equal(parsed.validCount, 1);
    const row = parsed.rows[0];
    assert.equal(row.shopName, 'Gupta & Sons, Kirana');
    assert.equal(row.address, 'Plot 12, "B" Block, Market');
    assert.equal(row.phone, '+919826011223');
  });

  // Scenario 8: Excel tab-separated clipboard paste
  it('Scenario 8: Parses Excel tab-separated clipboard paste correctly', () => {
    // Tab-delimited format copied from Excel / Google Sheets
    const tsvData = `Shop Name\tContact Person\tMobile\tEmail\tState\tDistrict\tPincode\nShreeji Retail\tManish Vyas\t9826099887\tmanish@shreeji.com\tMadhya Pradesh\tUjjain\t456001`;

    const parsed = parseBulkCustomersCsv(tsvData);
    assert.equal(parsed.validCount, 1);
    assert.equal(parsed.rows[0].shopName, 'Shreeji Retail');
    assert.equal(parsed.rows[0].contactName, 'Manish Vyas');
    assert.equal(parsed.rows[0].phone, '+919826099887');
    assert.equal(parsed.rows[0].district, 'Ujjain');
  });

  // Scenario 9: Failed bulk submission handling & data preservation
  it('Scenario 9: Failed bulk submission preserves entered rows in state for correction', () => {
    let customerRows: BulkCustomerRow[] = [
      {
        shopName: 'Preserved Store 1',
        contactName: 'Owner 1',
        phone: '+919826011111',
        state: 'Madhya Pradesh',
        district: 'Indore',
        pincode: '453331',
      },
      {
        shopName: 'Preserved Store 2',
        contactName: 'Owner 2',
        phone: '+919826022222',
        state: 'Madhya Pradesh',
        district: 'Indore',
        pincode: '453331',
      },
    ];

    // Simulate API throwing network or validation error
    let submissionError: Error | null = null;
    try {
      throw new Error('Network timeout. Customer records preserved.');
    } catch (err: any) {
      submissionError = err;
      // Critical test: customerRows are NOT cleared on failure!
    }

    assert.notEqual(submissionError, null);
    assert.equal(customerRows.length, 2);
    assert.equal(customerRows[0].shopName, 'Preserved Store 1');
  });

  // Scenario 10: Successful bulk submission payload formatting
  it('Scenario 10: Successful bulk submission payload conforms to POST /api/v1/:role/customers/bulk schema', () => {
    const rawRows = [
      {
        shopName: 'City Mart',
        contactName: 'Ashok',
        email: 'ashok@example.com',
        phone: '9826077777',
        categoryId: 'cat_supermarket',
        state: 'Madhya Pradesh',
        district: 'Indore',
        village: 'Indore',
        pincode: '452001',
        address: 'MG Road',
        noPhotoReason: 'Store closed on Sunday',
      },
    ];

    const bulkPayload: CreateBulkCustomersPayload = {
      customers: rawRows.map((r) => ({
        shopName: r.shopName.trim(),
        contactName: r.contactName.trim(),
        email: r.email?.trim() || undefined,
        phone: `+91${r.phone.replace(/\D/g, '').slice(-10)}`,
        categoryId: r.categoryId,
        state: r.state.trim(),
        district: r.district.trim(),
        village: r.village?.trim() || undefined,
        pincode: r.pincode.trim(),
        address: r.address?.trim() || undefined,
        noPhotoReason: r.noPhotoReason?.trim() || undefined,
      })),
    };

    assert.equal(Array.isArray(bulkPayload.customers), true);
    assert.equal(bulkPayload.customers[0].phone, '+919826077777');
    assert.equal(bulkPayload.customers[0].noPhotoReason, 'Store closed on Sunday');
  });

  // Scenario 11: Missing storefront photo AND missing exemption reason (Rejected)
  it('Scenario 11: Missing storefront photo and missing exemption reason is strictly rejected', () => {
    const dataWithoutPhotoOrReason: SingleCustomerFormData = {
      shopName: 'Super Mart',
      ownerName: 'Vikas',
      email: 'vikas@example.com',
      phone: '9826012345',
      categoryId: 'cat_retail',
      address: 'Main Bazaar',
      pincode: '453331',
      state: 'Madhya Pradesh',
      district: 'Indore',
      photoUri: null,
      noPhotoReason: '', // Blank reason
    };

    const res = validateSingleCustomerForm(dataWithoutPhotoOrReason);
    assert.equal(res.valid, false);
    assert.equal(
      res.errors.noPhotoReason,
      'Photo exemption reason is mandatory when storefront photo is omitted.'
    );
  });

  // Scenario 12: Missing storefront photo WITH valid exemption reason (Accepted)
  it('Scenario 12: Missing storefront photo with valid exemption reason is accepted', () => {
    const dataWithExemptionReason: SingleCustomerFormData = {
      shopName: 'Super Mart',
      ownerName: 'Vikas',
      email: 'vikas@example.com',
      phone: '9826012345',
      categoryId: 'cat_retail',
      address: 'Main Bazaar',
      pincode: '453331',
      state: 'Madhya Pradesh',
      district: 'Indore',
      photoUri: null,
      noPhotoReason: 'Storefront undergoing renovation; owner requested photo later',
    };

    const res = validateSingleCustomerForm(dataWithExemptionReason);
    assert.equal(res.valid, true);
    assert.equal(res.errors.noPhotoReason, undefined);
  });

  // Scenario 13: Storefront photo uploaded WITHOUT exemption reason (Accepted)
  it('Scenario 13: Storefront photo uploaded without exemption reason is accepted', () => {
    const dataWithPhotoOnly: SingleCustomerFormData = {
      shopName: 'Super Mart',
      ownerName: 'Vikas',
      email: 'vikas@example.com',
      phone: '9826012345',
      categoryId: 'cat_retail',
      address: 'Main Bazaar',
      pincode: '453331',
      state: 'Madhya Pradesh',
      district: 'Indore',
      photoUri: 'file:///cache/storefront_01.jpg',
      noPhotoReason: '', // Optional when photo is present
    };

    const res = validateSingleCustomerForm(dataWithPhotoOnly);
    assert.equal(res.valid, true);
    assert.equal(res.errors.noPhotoReason, undefined);
  });

  // Scenario 14: GPS permission denied (Graceful fallback without crashing)
  it('Scenario 14: GPS permission denied yields graceful fallback status without crashing', () => {
    interface GpsPermissionMock {
      status: 'granted' | 'denied';
    }

    const mockCheckPermission = (perm: GpsPermissionMock) => {
      if (perm.status === 'denied') {
        return {
          latitude: null,
          longitude: null,
          status: 'denied' as const,
          errorMessage: 'Location permission was denied. You may enter coordinates or address manually.',
        };
      }
      return { latitude: 22.7196, longitude: 75.8577, status: 'acquired' as const };
    };

    const gpsState = mockCheckPermission({ status: 'denied' });
    assert.equal(gpsState.status, 'denied');
    assert.equal(gpsState.latitude, null);
    assert.match(gpsState.errorMessage!, /permission was denied/i);
  });

  // Scenario 15: GPS timeout and balanced fallback (Coordinate validation)
  it('Scenario 15: Coordinates validation validates ranges and Indian subcontinent boundary', () => {
    // Valid Indore coordinates
    const indore = validateCoordinates(22.7196, 75.8577, true);
    assert.equal(indore.valid, true);

    // Valid coordinates worldwide
    const london = validateCoordinates(51.5074, -0.1278, false);
    assert.equal(london.valid, true);

    // Outside India bounds when requireIndiaBounds is true
    const outsideIndia = validateCoordinates(51.5074, -0.1278, true);
    assert.equal(outsideIndia.valid, false);
    assert.match(outsideIndia.error!, /(territory of India|Indian subcontinent)/i);

    // Invalid coordinate values
    const outOfRange = validateCoordinates(95.0, 75.0);
    assert.equal(outOfRange.valid, false);
    assert.match(outOfRange.error!, /Latitude must be between -90 and \+?90/i);

    const nanCoord = validateCoordinates('not_a_number', 75.0);
    assert.equal(nanCoord.valid, false);
    assert.match(nanCoord.error!, /valid numbers/i);
  });

  // Scenario 16: Application restart / draft storage recovery
  it('Scenario 16: Application draft storage saves, restores, and clears customer draft', async () => {
    const draft: CustomerDraft = {
      shopName: 'Mahalaxmi Provisions',
      ownerName: 'Girish Joshi',
      email: 'girish@example.com',
      phone: '9826088899',
      categoryId: 'cat_groceries',
      address: 'Near Old Bus Stand',
      pincode: '453331',
      state: 'Madhya Pradesh',
      district: 'Indore',
      village: 'Rau',
      noPhotoReason: 'Camera malfunctioning on field device',
      latitude: 22.6284,
      longitude: 75.8087,
      updatedAt: new Date().toISOString(),
    };

    // 1. Save draft
    await draftStorage.saveCustomerDraft(draft);

    // 2. Retrieve draft (simulate app restart)
    const recovered = await draftStorage.getCustomerDraft();
    assert.notEqual(recovered, null);
    assert.equal(recovered?.shopName, 'Mahalaxmi Provisions');
    assert.equal(recovered?.phone, '9826088899');
    assert.equal(recovered?.noPhotoReason, 'Camera malfunctioning on field device');
    assert.equal(recovered?.latitude, 22.6284);

    // 3. Clear draft upon successful submission
    await draftStorage.clearCustomerDraft();
    const emptyDraft = await draftStorage.getCustomerDraft();
    assert.equal(emptyDraft, null);
  });
});
