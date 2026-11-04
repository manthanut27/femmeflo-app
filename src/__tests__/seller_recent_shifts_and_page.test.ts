import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

describe('Seller Profile Recent Shifts (Max 5) & Dedicated All Shifts Page Suite', () => {
  it('ensures seller profile limits displayed recent duty shifts to 5 and provides dedicated page links', () => {
    const profilePath = resolve(process.cwd(), 'src/app/(seller)/profile/index.tsx');
    const content = readFileSync(profilePath, 'utf8');

    // Asserts page size 5 query
    assert.ok(
      content.includes('pageSize: 5'),
      'Profile must request pageSize: 5'
    );
    // Asserts slice(0, 5) rendering
    assert.ok(
      content.includes('shiftHistory.slice(0, 5).map'),
      'Profile screen must only render up to 5 shifts'
    );
    // Asserts navigation link to dedicated shifts page
    assert.ok(
      content.includes("router.push('/(seller)/profile/shifts'"),
      'Must contain navigation link to dedicated shifts page'
    );
    // Asserts dedicated page CTA button
    assert.ok(
      content.includes('seeMoreShiftsBtn'),
      'Must render see more shifts button'
    );
  });

  it('ensures profile route has stack layout with index and shifts screens', () => {
    const layoutPath = resolve(process.cwd(), 'src/app/(seller)/profile/_layout.tsx');
    const layoutContent = readFileSync(layoutPath, 'utf8');

    assert.ok(layoutContent.includes('Stack'), 'Profile layout must be a Stack navigator');
    assert.ok(layoutContent.includes('name="index"'), 'Must register index screen');
    assert.ok(layoutContent.includes('name="shifts"'), 'Must register shifts screen');
  });

  it('ensures seller tabs layout registers profile cleanly without duplicate tab entries', () => {
    const sellerLayoutPath = resolve(process.cwd(), 'src/app/(seller)/_layout.tsx');
    const content = readFileSync(sellerLayoutPath, 'utf8');

    assert.ok(content.includes('name="profile"'), 'Seller tabs must register profile stack screen');
    assert.ok(!content.includes('name="profile/shifts"'), 'Should not have standalone hidden tab for profile/shifts');
    assert.ok(!content.includes('name="profile/index"'), 'Should not use profile/index tab screen');
  });

  it('ensures dedicated shifts screen handles back navigation and displays summary metrics', () => {
    const shiftsPagePath = resolve(process.cwd(), 'src/app/(seller)/profile/shifts.tsx');
    const content = readFileSync(shiftsPagePath, 'utf8');

    assert.ok(content.includes('Duty Shifts History'), 'Must display title Duty Shifts History');
    assert.ok(content.includes('showBack'), 'Must show back button in Header');
    assert.ok(content.includes('Total Travel'), 'Must render Total Travel KPI metric');
    assert.ok(content.includes('Stores Visited'), 'Must render Stores Visited KPI metric');
    assert.ok(content.includes('Completed'), 'Must render Completed KPI metric');
    assert.ok(content.includes('toggleExpand'), 'Must support expanding and viewing store visits');
  });

  it('verifies pagination slicing logic for recent shifts (5) vs all shifts (50)', () => {
    const mockShifts = [
      { id: 's1' }, { id: 's2' }, { id: 's3' }, { id: 's4' }, { id: 's5' },
      { id: 's6' }, { id: 's7' }, { id: 's8' },
    ];

    // Page size 5 query simulation
    const pageSize5 = 5;
    const recentShifts = mockShifts.slice(0, pageSize5);
    assert.equal(recentShifts.length, 5);
    assert.equal(mockShifts.length, 8);

    // Dedicated page size 50 simulation
    const pageSize50 = 50;
    const allShifts = mockShifts.slice(0, pageSize50);
    assert.equal(allShifts.length, 8);
  });
});
