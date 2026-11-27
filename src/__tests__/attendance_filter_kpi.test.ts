import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import {
  buildCalendarMonthCells,
  computeAttendanceKpiMetrics,
  filterShiftsByState,
  getShiftFilterDateRange,
  mergeLiveShiftIntoFilteredList,
} from '../utils/shiftFilterUtils.ts';

describe('Attendance / Duty Shift Filter, Calendar Picker & KPI Metrics Suite', () => {
  const rootDir = process.cwd();
  const readSource = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf-8');

  it('computes accurate IST range bounds for Today, Week, Month, 3 Months, 6 Months, All, and Custom Date', () => {
    // 2026-11-27 08:53 IST == 2026-11-27T03:23:00Z
    const refNow = new Date('2026-11-27T03:23:00.000Z');

    const today = getShiftFilterDateRange({ preset: 'today' }, refNow);
    assert.equal(today.fromDateKey, '2026-11-27');
    assert.equal(today.toDateKey, '2026-11-27');
    assert.equal(today.from, '2026-11-26T18:30:00.000Z');
    assert.equal(today.to, '2026-11-27T18:29:59.999Z');

    const week = getShiftFilterDateRange({ preset: 'week' }, refNow);
    assert.equal(week.fromDateKey, '2026-11-21');
    assert.equal(week.toDateKey, '2026-11-27');

    const month = getShiftFilterDateRange({ preset: 'month' }, refNow);
    assert.equal(month.fromDateKey, '2026-10-27');
    assert.equal(month.toDateKey, '2026-11-27');

    const threeMonths = getShiftFilterDateRange({ preset: '3months' }, refNow);
    assert.equal(threeMonths.fromDateKey, '2026-08-27');
    assert.equal(threeMonths.toDateKey, '2026-11-27');

    const sixMonths = getShiftFilterDateRange({ preset: '6months' }, refNow);
    assert.equal(sixMonths.fromDateKey, '2026-05-27');
    assert.equal(sixMonths.toDateKey, '2026-11-27');

    const all = getShiftFilterDateRange({ preset: 'all' }, refNow);
    assert.equal(all.from, undefined);
    assert.equal(all.to, undefined);

    const custom = getShiftFilterDateRange({ preset: 'custom_date', customDateKey: '2026-10-28' }, refNow);
    assert.equal(custom.fromDateKey, '2026-10-28');
    assert.equal(custom.toDateKey, '2026-10-28');
    assert.equal(custom.from, '2026-10-27T18:30:00.000Z');
    assert.equal(custom.to, '2026-10-28T18:29:59.999Z');
  });

  it('includes early-morning IST shifts (4:52 AM IST) under Today and Selected Date filters', () => {
    const refNow = new Date('2026-11-27T09:00:00.000+05:30');
    const shifts: any[] = [
      {
        id: 'early-today',
        sellerId: 's1',
        status: 'COMPLETED',
        startTime: '2026-11-27T04:52:00+05:30', // 2026-11-26T23:22:00Z!
        endTime: '2026-11-27T07:52:00+05:30',
        totalDistanceKm: 5.4,
        visits: [{ id: 'v1', saleDone: true }, { id: 'v2', saleDone: false }],
      },
      {
        id: 'oct-28',
        sellerId: 's1',
        status: 'COMPLETED',
        startTime: '2026-10-28T10:00:00+05:30',
        endTime: '2026-10-28T14:30:00+05:30',
        totalDistanceKm: 14.2,
        visits: [{ id: 'v3', saleDone: true }],
      },
    ];

    const todayOnly = filterShiftsByState(shifts, { preset: 'today' }, refNow);
    assert.equal(todayOnly.length, 1);
    assert.equal(todayOnly[0].id, 'early-today');

    const octOnly = filterShiftsByState(shifts, { preset: 'custom_date', customDateKey: '2026-10-28' }, refNow);
    assert.equal(octOnly.length, 1);
    assert.equal(octOnly[0].id, 'oct-28');

    const kpiMonth = computeAttendanceKpiMetrics(shifts);
    assert.equal(kpiMonth.totalShifts, 2);
    assert.equal(kpiMonth.shopsVisited, 3);
    assert.equal(kpiMonth.salesDoneVisits, 2);
    assert.equal(kpiMonth.totalDistanceKm, 19.6);
    assert.equal(kpiMonth.totalTimeLabel, '7h 30m');
  });

  it('merges active live shift into Today KPIs without duplicating or leaking into past custom dates', () => {
    const refNow = new Date('2026-11-27T11:00:00.000+05:30');
    const currentShift: any = {
      id: 'shift-live',
      sellerId: 's1',
      status: 'ACTIVE',
      startTime: '2026-11-27T09:00:00+05:30',
      visits: [{ id: 'v1' }, { id: 'v2', saleDone: true }],
      totalDistanceKm: 3.2,
    };

    const todayMerged = mergeLiveShiftIntoFilteredList([], currentShift, { preset: 'today' }, refNow);
    assert.equal(todayMerged.length, 1);
    assert.equal(todayMerged[0].id, 'shift-live');

    const octMerged = mergeLiveShiftIntoFilteredList([], currentShift, { preset: 'custom_date', customDateKey: '2026-10-28' }, refNow);
    assert.equal(octMerged.length, 0);
  });

  it('generates aligned 7-column IST calendar cells and marks future dates cleanly', () => {
    const refNow = new Date('2026-11-27T10:00:00+05:30');
    const cells = buildCalendarMonthCells(2026, 11, refNow);
    assert.equal(cells.length % 7, 0);
    const todayCell = cells.find((c) => c.dateKey === '2026-11-27');
    const futureCell = cells.find((c) => c.dateKey === '2026-11-30');
    assert.equal(todayCell?.isToday, true);
    assert.equal(todayCell?.isFuture, false);
    assert.equal(futureCell?.isFuture, true);
  });

  it('wires AttendanceFilterButton, AttendanceFilterModal (Today/Week/Month/3M/6M + Calendar), and KPIs across Admin, Manager, and Seller', () => {
    const filterModalCode = readSource('src/components/common/AttendanceFilterModal.tsx');
    const filterUtilsCode = readSource('src/utils/shiftFilterUtils.ts');
    const adminCode = readSource('src/app/(admin)/shifts/index.tsx');
    const managerCode = readSource('src/app/(manager)/shifts/index.tsx');
    const sellerAttendanceCode = readSource('src/app/(seller)/attendance/index.tsx');
    const sellerProfileShiftsCode = readSource('src/app/(seller)/profile/shifts.tsx');

    assert.ok(filterModalCode.includes('SHIFT_FILTER_PRESETS'), 'Filter modal must render SHIFT_FILTER_PRESETS');
    for (const label of ['Today', 'Week', 'Month', '3 Months', '6 Months']) {
      assert.ok(filterUtilsCode.includes(label), `Filter presets must contain ${label}`);
    }
    assert.ok(filterModalCode.includes('Select Specific Date'), 'Filter modal must include Select Specific Date calendar option');
    assert.ok(filterModalCode.includes('calendar-outline'), 'Filter modal must display calendar icon');
    assert.ok(filterModalCode.includes('options-outline'), 'Filter button must render clean icon-only filter trigger');

    for (const [name, code] of [
      ['Admin shifts', adminCode],
      ['Manager shifts', managerCode],
      ['Seller attendance', sellerAttendanceCode],
      ['Seller profile shifts', sellerProfileShiftsCode],
    ]) {
      assert.ok(code.includes('<AttendanceFilterButton'), `${name} must use AttendanceFilterButton`);
      assert.ok(code.includes('<AttendanceFilterModal'), `${name} must use AttendanceFilterModal`);
      assert.ok(code.includes('computeAttendanceKpiMetrics'), `${name} must compute filtered KPI metrics`);
      assert.ok(code.includes('Total Time'), `${name} must render Total Time KPI`);
    }
  });
});
