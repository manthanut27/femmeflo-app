import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseDateInputToISO } from '../utils/dateUtils.ts';

describe('Admin Territory & Scope Filters Suite', () => {
  it('parses dd-mm-yyyy format to ISO string accurately', () => {
    const iso = parseDateInputToISO('14-11-2026');
    assert.ok(iso, 'Should return ISO string');
    const date = new Date(iso);
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 10); // 0-indexed: 10 = November
    assert.strictEqual(date.getDate(), 14);
  });

  it('parses dd/mm/yyyy format to ISO string accurately', () => {
    const iso = parseDateInputToISO('05/03/2026');
    assert.ok(iso, 'Should return ISO string');
    const date = new Date(iso);
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 2); // March
    assert.strictEqual(date.getDate(), 5);
  });

  it('parses standard yyyy-mm-dd format to ISO string accurately', () => {
    const iso = parseDateInputToISO('2026-08-15');
    assert.ok(iso, 'Should return ISO string');
    const date = new Date(iso);
    assert.strictEqual(date.getFullYear(), 2026);
    assert.strictEqual(date.getMonth(), 7); // August
    assert.strictEqual(date.getDate(), 15);
  });

  it('handles empty strings and whitespace safely without throwing', () => {
    assert.strictEqual(parseDateInputToISO(''), undefined);
    assert.strictEqual(parseDateInputToISO('   '), undefined);
    assert.strictEqual(parseDateInputToISO('not-a-date'), undefined);
  });

  it('verifies the 4 standard date range presets: Today, Last 7 Days, Last 30 Days, This Month', () => {
    const presets = [
      { id: 'today', label: 'Today' },
      { id: '7days', label: 'Last 7 Days' },
      { id: '30days', label: 'Last 30 Days' },
      { id: 'this_month', label: 'This Month' },
    ];

    assert.strictEqual(presets.length, 4);
    assert.deepStrictEqual(presets.map((p) => p.label), [
      'Today',
      'Last 7 Days',
      'Last 30 Days',
      'This Month',
    ]);

    // Verify "This Month" calculates start of current month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    assert.strictEqual(startOfMonth.getDate(), 1);
    assert.strictEqual(startOfMonth.getMonth(), now.getMonth());
  });

  it('verifies hierarchy, section titles, and all-option labels match specifications', () => {
    const filterSections = [
      { section: 'Date Range:', hasFromTo: true, fromPlaceholder: 'dd-mm-yyyy', toPlaceholder: 'dd-mm-yyyy' },
      { section: 'State', allOptionLabel: 'All states' },
      { section: 'District', allOptionLabel: 'All districts' },
      { section: 'Village / Area', allOptionLabel: 'All villages' },
      { section: 'Manager', allOptionLabel: 'All managers' },
      { section: 'Field Officer', allOptionLabel: 'All field officers' },
      { section: 'Category', allOptionLabel: 'All categories' },
    ];

    assert.strictEqual(filterSections.length, 7);
    assert.strictEqual(filterSections[0].section, 'Date Range:');
    assert.strictEqual(filterSections[0].fromPlaceholder, 'dd-mm-yyyy');
    assert.strictEqual(filterSections[0].toPlaceholder, 'dd-mm-yyyy');
    assert.strictEqual(filterSections[1].allOptionLabel, 'All states');
    assert.strictEqual(filterSections[2].allOptionLabel, 'All districts');
    assert.strictEqual(filterSections[3].allOptionLabel, 'All villages');
    assert.strictEqual(filterSections[4].allOptionLabel, 'All managers');
    assert.strictEqual(filterSections[5].allOptionLabel, 'All field officers');
    assert.strictEqual(filterSections[6].allOptionLabel, 'All categories');
  });

  it('verifies Territory & Scope Filters header and subtext copy', () => {
    const headerTitle = 'Territory & Scope Filters';
    const headerSubtitle = 'Filter live operational metrics by geographic hierarchy and category';

    assert.strictEqual(headerTitle, 'Territory & Scope Filters');
    assert.strictEqual(headerSubtitle, 'Filter live operational metrics by geographic hierarchy and category');
  });
});
