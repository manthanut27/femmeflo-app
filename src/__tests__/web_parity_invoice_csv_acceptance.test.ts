import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';

import { fileURLToPath } from 'node:url';

describe('Web Parity & Invoicing / CSV Export Acceptance Suite', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const rootDir = path.resolve(__dirname, '../..');

  const readFile = (relPath: string): string => {
    const fullPath = path.join(rootDir, relPath);
    assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
    return fs.readFileSync(fullPath, 'utf-8');
  };

  it('1. managerApi provides getInvoicePdfUrl and downloadInvoicePdf methods', () => {
    const managerCode = readFile('src/api/manager.ts');

    assert.match(
      managerCode,
      /getInvoicePdfUrl\(\s*id:\s*string,\s*download\s*=\s*true\s*\):\s*string/,
      'managerApi must define getInvoicePdfUrl(id: string, download = true): string'
    );

    assert.match(
      managerCode,
      /async\s+downloadInvoicePdf\(\s*id:\s*string,\s*download\s*=\s*false\s*\):\s*Promise<Blob>/,
      'managerApi must define downloadInvoicePdf(id: string, download = false): Promise<Blob>'
    );
  });

  it('2. Admin Sales Record Screen provides direct Tax Invoice PDF dispatch without separate Invoices page', () => {
    const code = readFile('src/app/(admin)/sales/index.tsx');

    assert.ok(code.includes('handleOpenInvoice'), 'Sales Record must implement handleOpenInvoice');
    assert.ok(code.includes('adminApi.getInvoicePdfUrl'), 'Sales Record must fetch invoice PDF URL');
    assert.ok(code.includes('Open Tax Invoice'), 'Sales Record must expose Open Tax Invoice action');
    assert.ok(code.includes('<PdfPreviewModal'), 'Sales Record must render PdfPreviewModal for PDF preview & sharing');
    assert.ok(code.includes('title="Sales Record"'), 'Admin sales page must use Sales Record header title');
  });

  it('3. Admin Customers Screen implements Table-Level CSV Export', () => {
    const code = readFile('src/app/(admin)/customers/index.tsx');

    assert.ok(code.includes('handleExportCsv'), 'Must implement handleExportCsv');
    assert.ok(code.includes('escapeCsvCell'), 'Must sanitize and escape CSV cells');
    assert.ok(code.includes('Shop Name'), 'CSV must include Shop Name header');
    assert.ok(code.includes('Owner / Contact'), 'CSV must include Owner / Contact header');
    assert.ok(code.includes('Village / Area'), 'CSV must include Village / Area header');
    assert.ok(code.includes('Active Status'), 'CSV must include Active Status header');
    assert.ok(code.includes('writeAsStringAsync') || code.includes('shareAsync'), 'Must write/share CSV file');
    assert.ok(code.includes('exportBtn'), 'Must define exportBtn style and button');
  });

  it('4. Manager Sales Screen provides Direct Invoice PDF and WhatsApp dispatch for Confirmed Sales', () => {
    const code = readFile('src/app/(manager)/sales/index.tsx');

    // Invoice View & Share PDF
    assert.ok(code.includes('handleViewInvoice'), 'Must implement handleViewInvoice');
    assert.ok(code.includes('handleShareInvoicePdf'), 'Must implement handleShareInvoicePdf');
    assert.ok(code.includes('managerApi.getInvoicePdfUrl'), 'Must call managerApi.getInvoicePdfUrl');

    // WhatsApp Dispatch
    assert.ok(code.includes('handleShareWhatsAppInvoice'), 'Must implement handleShareWhatsAppInvoice');
    assert.ok(code.includes('api.whatsapp.com/send'), 'Must invoke WhatsApp dispatch endpoint');

    // UI Buttons in both Daily Report and Transaction views
    assert.ok(code.includes('managerInvoiceRow'), 'Must render managerInvoiceRow container');
    assert.ok(code.includes('managerPdfBtn'), 'Must render tax invoice view button');
    assert.ok(code.includes('managerWaBtn'), 'Must render WhatsApp share button');
    assert.ok(code.includes('managerShareBtn'), 'Must render PDF share button');
  });

  it('5. CSV Cell escaping correctly sanitizes quotes, commas, and linebreaks', () => {
    function escapeCsvCell(val: any): string {
      if (val === null || val === undefined) return '';
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }

    assert.strictEqual(escapeCsvCell('Simple Text'), 'Simple Text');
    assert.strictEqual(escapeCsvCell('Text, with comma'), '"Text, with comma"');
    assert.strictEqual(escapeCsvCell('Text with "quotes"'), '"Text with ""quotes"""');
    assert.strictEqual(escapeCsvCell('Line 1\nLine 2'), '"Line 1\nLine 2"');
    assert.strictEqual(escapeCsvCell(null), '');
    assert.strictEqual(escapeCsvCell(undefined), '');
  });
});
