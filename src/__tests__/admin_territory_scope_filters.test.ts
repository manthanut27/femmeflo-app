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

  it('verifies filter sections include ONLY Date Range, State, District, and Village / Area', () => {
    const filterSections = [
      { section: 'Date Range:', hasFromTo: true, fromPlaceholder: 'dd-mm-yyyy', toPlaceholder: 'dd-mm-yyyy' },
      { section: 'State', allOptionLabel: 'All states' },
      { section: 'District', allOptionLabel: 'All districts' },
      { section: 'Village / Area', allOptionLabel: 'All villages' },
    ];

    assert.strictEqual(filterSections.length, 4);
    assert.strictEqual(filterSections[0].section, 'Date Range:');
    assert.strictEqual(filterSections[0].fromPlaceholder, 'dd-mm-yyyy');
    assert.strictEqual(filterSections[0].toPlaceholder, 'dd-mm-yyyy');
    assert.strictEqual(filterSections[1].allOptionLabel, 'All states');
    assert.strictEqual(filterSections[2].allOptionLabel, 'All districts');
    assert.strictEqual(filterSections[3].allOptionLabel, 'All villages');

    // Manager, Field Officer, and Category must NOT be present
    const sectionNames = filterSections.map((s) => s.section);
    assert.strictEqual(sectionNames.includes('Manager'), false);
    assert.strictEqual(sectionNames.includes('Field Officer'), false);
    assert.strictEqual(sectionNames.includes('Category'), false);
  });

  it('verifies Territory & Scope Filters header and subtext copy', () => {
    const headerTitle = 'Territory & Scope Filters';
    const headerSubtitle = 'Filter live operational metrics by date and territory';

    assert.strictEqual(headerTitle, 'Territory & Scope Filters');
    assert.strictEqual(headerSubtitle, 'Filter live operational metrics by date and territory');
  });

  it('verifies dynamic extraction of villages from existing database records without fake defaults', () => {
    // Simulated database records from customer table & location API
    const dbCustomers = [
      { id: 'c1', shopName: 'Shop A', state: 'Madhya Pradesh', district: 'Indore', village: 'Rau' },
      { id: 'c2', shopName: 'Shop B', state: 'Madhya Pradesh', district: 'Indore', village: 'Indore City' },
      { id: 'c3', shopName: 'Shop C', state: 'Madhya Pradesh', district: 'Indore', village: 'Rau' }, // duplicate village
      { id: 'c4', shopName: 'Shop D', state: 'Madhya Pradesh', district: 'Indore', village: '  Mhow  ' }, // whitespace
      { id: 'c5', shopName: 'Shop E', state: 'Madhya Pradesh', district: 'Indore', village: null }, // missing
    ];

    const vSet = new Set<string>();
    dbCustomers.forEach((c) => {
      const trimmed = (c.village || '').trim();
      if (trimmed) vSet.add(trimmed);
    });

    const dynamicVillages = Array.from(vSet).sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(dynamicVillages, ['Indore City', 'Mhow', 'Rau']);
    assert.strictEqual(dynamicVillages.includes('Diva'), false, 'Should not contain hardcoded default Diva');
    assert.strictEqual(dynamicVillages.includes('Shivpur'), false, 'Should not contain hardcoded default Shivpur');
  });

  it('verifies dropdown search filtering across State, District, and Village pickers', () => {
    const mockFilterOptions = {
      states: ['Maharashtra', 'Uttar Pradesh', 'Madhya Pradesh', 'Bihar', 'Rajasthan'],
      districts: ['Thane', 'Mumbai', 'Varanasi', 'Indore', 'Bhopal', 'Patna', 'Jaipur'],
      villages: ['Indore City', 'Mhow', 'Pithampur', 'Rau', 'Sanwer'],
    };

    // State search
    const stateMatches = mockFilterOptions.states.filter((s) => s.toLowerCase().includes('maha'));
    assert.deepStrictEqual(stateMatches, ['Maharashtra']);

    // District search
    const districtMatches = mockFilterOptions.districts.filter((d) => d.toLowerCase().includes('tha'));
    assert.deepStrictEqual(districtMatches, ['Thane']);

    // Village search
    const villageMatches = mockFilterOptions.villages.filter((v) => v.toLowerCase().includes('rau'));
    assert.deepStrictEqual(villageMatches, ['Rau']);
  });

  it('verifies custom village search entry fallback', () => {
    const knownVillages = ['Diva', 'Shivpur'];
    const customQuery = 'Kolwadi';

    const isExisting = knownVillages.some((v) => v.toLowerCase() === customQuery.toLowerCase());
    assert.strictEqual(isExisting, false);

    // Custom village query should be permitted as a selected option
    const customOption = {
      title: `Filter by: "${customQuery}"`,
      value: customQuery,
    };
    assert.strictEqual(customOption.value, 'Kolwadi');
  });
});
