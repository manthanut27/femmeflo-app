import type { BulkCustomerRow } from '@/api/types';

export interface CsvParseResult {
  rows: BulkCustomerRow[];
  totalRows: number;
  validCount: number;
  errorCount: number;
  errors: Array<{ rowNumber: number; reason: string }>;
}

/**
 * Robust RFC4180 compliant CSV parser.
 * Supports quoted fields, multiline cells, escaped double quotes (""), and varied delimiters.
 */
export function parseRawCsv(text: string, delimiter = ','): string[][] {
  const result: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuote = false;
  let i = 0;

  // Auto-detect delimiter if not specified
  if (text.includes('\t') && !text.includes(',')) {
    delimiter = '\t';
  } else if (text.includes(';') && !text.includes(',')) {
    delimiter = ';';
  }

  while (i < text.length) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuote && nextChar === '"') {
        currentField += '"';
        i += 2;
        continue;
      } else {
        insideQuote = !insideQuote;
        i++;
        continue;
      }
    }

    if (!insideQuote && char === delimiter) {
      currentRow.push(currentField.trim());
      currentField = '';
      i++;
      continue;
    }

    if (!insideQuote && (char === '\r' || char === '\n')) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f.length > 0)) {
        result.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      i++;
      continue;
    }

    currentField += char;
    i++;
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    if (currentRow.some((f) => f.length > 0)) {
      result.push(currentRow);
    }
  }

  return result;
}

/**
 * Normalizes Indian 10-digit mobile phone numbers.
 */
function normalizeIndianPhone(phone: string): string | null {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (/^\+91[6-9]\d{9}$/.test(cleaned)) return cleaned;
  if (/^[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^0[6-9]\d{9}$/.test(cleaned)) return `+91${cleaned.slice(1)}`;
  if (/^\+[1-9]\d{8,14}$/.test(cleaned)) return cleaned;
  return null;
}

/**
 * Maps CSV table data into typed BulkCustomerRow records with validation.
 */
export function parseBulkCustomersCsv(csvContent: string): CsvParseResult {
  const table = parseRawCsv(csvContent.trim());
  if (table.length === 0) {
    return { rows: [], totalRows: 0, validCount: 0, errorCount: 0, errors: [] };
  }

  const rawHeaders = table[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
  const headerMap: Record<string, number> = {};

  rawHeaders.forEach((header, index) => {
    headerMap[header] = index;
  });

  const getCol = (names: string[]): number | undefined => {
    for (const name of names) {
      const clean = name.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (headerMap[clean] !== undefined) return headerMap[clean];
    }
    return undefined;
  };

  const colShopName = getCol(['shopname', 'shop', 'businessname', 'storename']);
  const colContact = getCol(['contactname', 'ownername', 'name', 'owner', 'contact']);
  const colPhone = getCol(['phone', 'mobile', 'phonenumber', 'contactnumber']);
  const colEmail = getCol(['email', 'emailaddress']);
  const colAddress = getCol(['address', 'shopaddress', 'street', 'streetname']);
  const colPincode = getCol(['pincode', 'pin', 'postalcode', 'zip']);
  const colState = getCol(['state', 'province']);
  const colDistrict = getCol(['district', 'city']);
  const colVillage = getCol(['village', 'town', 'locality', 'sublocality']);
  const colNoPhotoReason = getCol(['nophotoreason', 'photoreason', 'photoskipreason']);

  const rows: BulkCustomerRow[] = [];
  const errors: Array<{ rowNumber: number; reason: string }> = [];

  for (let rowIndex = 1; rowIndex < table.length; rowIndex++) {
    const row = table[rowIndex];
    const rowNumber = rowIndex + 1; // 1-indexed for user display

    const shopName = (colShopName !== undefined ? row[colShopName] : row[0])?.trim() || '';
    const contactName = (colContact !== undefined ? row[colContact] : row[1])?.trim() || shopName;
    const rawPhone = (colPhone !== undefined ? row[colPhone] : row[2])?.trim() || '';
    const email = (colEmail !== undefined ? row[colEmail] : '')?.trim() || undefined;
    const address = (colAddress !== undefined ? row[colAddress] : '')?.trim() || undefined;
    const pincode = (colPincode !== undefined ? row[colPincode] : '')?.trim() || undefined;
    const state = (colState !== undefined ? row[colState] : '')?.trim() || undefined;
    const district = (colDistrict !== undefined ? row[colDistrict] : '')?.trim() || undefined;
    const village = (colVillage !== undefined ? row[colVillage] : '')?.trim() || undefined;
    const noPhotoReason = (colNoPhotoReason !== undefined ? row[colNoPhotoReason] : '')?.trim() || 'Bulk CSV Import';

    if (!shopName) {
      errors.push({ rowNumber, reason: 'Shop Name is required.' });
      continue;
    }

    if (!rawPhone) {
      errors.push({ rowNumber, reason: 'Phone number is required.' });
      continue;
    }

    const normalizedPhone = normalizeIndianPhone(rawPhone);
    if (!normalizedPhone) {
      errors.push({
        rowNumber,
        reason: `Invalid phone number '${rawPhone}'. Must be 10 digits starting with 6-9.`,
      });
      continue;
    }

    if (pincode && !/^[1-9][0-9]{5}$/.test(pincode)) {
      errors.push({
        rowNumber,
        reason: `Invalid 6-digit Indian pincode '${pincode}'.`,
      });
      continue;
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.push({
        rowNumber,
        reason: `Invalid email address format '${email}'.`,
      });
      continue;
    }

    rows.push({
      shopName,
      contactName: contactName || shopName,
      phone: normalizedPhone,
      email,
      address,
      pincode,
      state,
      district,
      village,
      noPhotoReason,
    });
  }

  return {
    rows,
    totalRows: table.length - 1,
    validCount: rows.length,
    errorCount: errors.length,
    errors,
  };
}

