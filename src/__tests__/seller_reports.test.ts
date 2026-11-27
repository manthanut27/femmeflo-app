import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, it } from 'node:test';
import type { SaleItem, SellerIncentiveData, Shift } from '../api/types.ts';
import {
  ADMIN_DATE_FILTER_PRESETS,
  composeFallbackSellerReport,
  formatReportDuration,
  getSellerReportDateRange,
  SELLER_REPORT_PRESETS,
} from '../utils/reportFilterUtils.ts';

describe('Seller Activity Report Filters, Fallback Composition & UI Contracts', () => {
  const rootDir = process.cwd();
  const readSource = (relPath: string) => fs.readFileSync(path.join(rootDir, relPath), 'utf-8');

  it('computes accurate IST ranges for Day, This Week, Weekend, Month, All, and Date Range', () => {
    // Friday 2026-11-27 14:30 IST
    const fridayRef = new Date('2026-11-27T09:00:00.000Z');

    const dayRange = getSellerReportDateRange({ preset: 'today' }, fridayRef);
    assert.equal(dayRange.fromDateKey, '2026-11-27');
    assert.equal(dayRange.toDateKey, '2026-11-27');

    const weekRange = getSellerReportDateRange({ preset: 'week' }, fridayRef);
    assert.equal(weekRange.fromDateKey, '2026-11-23'); // Mon
    assert.equal(weekRange.toDateKey, '2026-11-27'); // Fri

    const weekendFromFri = getSellerReportDateRange({ preset: 'weekend' }, fridayRef);
    assert.equal(weekendFromFri.fromDateKey, '2026-11-21'); // Sat
    assert.equal(weekendFromFri.toDateKey, '2026-11-22'); // Sun

    // Saturday 2026-11-28 11:00 IST
    const saturdayRef = new Date('2026-11-28T05:30:00.000Z');
    const weekendFromSat = getSellerReportDateRange({ preset: 'weekend' }, saturdayRef);
    assert.equal(weekendFromSat.fromDateKey, '2026-11-28');
    assert.equal(weekendFromSat.toDateKey, '2026-11-28');

    // Sunday 2026-11-29 11:00 IST
    const sundayRef = new Date('2026-11-29T05:30:00.000Z');
    const weekendFromSun = getSellerReportDateRange({ preset: 'weekend' }, sundayRef);
    assert.equal(weekendFromSun.fromDateKey, '2026-11-28');
    assert.equal(weekendFromSun.toDateKey, '2026-11-29');

    const monthRange = getSellerReportDateRange({ preset: 'month' }, fridayRef);
    assert.equal(monthRange.fromDateKey, '2026-11-01');
    assert.equal(monthRange.toDateKey, '2026-11-27');

    const last7Range = getSellerReportDateRange({ preset: '7days' }, fridayRef);
    assert.equal(last7Range.fromDateKey, '2026-11-21');
    assert.equal(last7Range.toDateKey, '2026-11-27');
    assert.deepEqual(
      ADMIN_DATE_FILTER_PRESETS.map((p) => p.label),
      ['All Time', 'Today', 'Last 7 Days', 'This Month']
    );

    const allRange = getSellerReportDateRange({ preset: 'all' }, fridayRef);
    assert.equal(allRange.fromDateKey, undefined);
    assert.equal(allRange.toDateKey, undefined);

    // Custom date range normalizes reversed endpoints automatically
    const swappedCustom = getSellerReportDateRange(
      {
        preset: 'custom_range',
        customFromDateKey: '2026-11-25',
        customToDateKey: '2026-11-18',
      },
      fridayRef
    );
    assert.equal(swappedCustom.fromDateKey, '2026-11-18');
    assert.equal(swappedCustom.toDateKey, '2026-11-25');

    assert.equal(formatReportDuration(0), '0m');
    assert.equal(formatReportDuration(2700), '45m');
    assert.equal(formatReportDuration(8100), '2h 15m');
    assert.deepEqual(
      SELLER_REPORT_PRESETS.map((p) => p.id),
      ['today', 'week', 'weekend', 'month', 'all', 'custom_range']
    );
  });

  it('composes accurate offline/fallback SellerReportData across shifts, visits, sales, and incentives', () => {
    const now = new Date('2026-11-27T10:00:00.000Z');
    const shifts: Shift[] = [
      {
        id: 'sh_1',
        sellerId: 'sel_1',
        status: 'COMPLETED',
        startTime: '2026-11-27T04:00:00.000Z',
        endTime: '2026-11-27T07:00:00.000Z',
        startOdometerKm: 100,
        endOdometerKm: 124,
        totalDistanceKm: 24,
        visits: [
          {
            id: 'v_1',
            shiftId: 'sh_1',
            customerId: 'c_1',
            shopName: 'Shree Mart',
            checkInTime: '2026-11-27T04:30:00.000Z',
            checkOutTime: '2026-11-27T05:00:00.000Z',
            durationMins: 30,
            saleDone: true,
            saleId: 's_1',
          },
          {
            id: 'v_2',
            shiftId: 'sh_1',
            customerId: 'c_2',
            shopName: 'Care Chemist',
            checkInTime: '2026-11-27T05:30:00.000Z',
            checkOutTime: '2026-11-27T05:45:00.000Z',
            durationMins: 15,
            saleDone: false,
          },
        ],
      },
      {
        id: 'sh_out',
        sellerId: 'sel_1',
        status: 'COMPLETED',
        startTime: '2026-10-15T04:00:00.000Z',
        endTime: '2026-10-15T08:00:00.000Z',
        startOdometerKm: 0,
        endOdometerKm: 15,
        totalDistanceKm: 15,
        visits: [],
      },
    ];

    const sales: SaleItem[] = [
      {
        id: 's_1',
        customerId: 'c_1',
        customer: {
          id: 'c_1',
          shopName: 'Shree Mart',
          ownerName: 'Ramesh',
          email: 'shree@example.com',
          phone: '9999999999',
          address: '',
          state: 'MH',
          district: 'Thane',
          village: 'Thane',
          pincode: '400601',
          createdAt: '2026-11-01T00:00:00.000Z',
          active: true,
        },
        sellerId: 'sel_1',
        totalAmountPaise: 25_000,
        totalPaise: 25_000,
        packetCount: 25,
        quantity: 25,
        unitPricePaise: 1000,
        status: 'CONFIRMED',
        paymentMode: 'CASH',
        createdAt: '2026-11-27T04:55:00.000Z',
      },
      {
        id: 's_pending',
        customerId: 'c_2',
        sellerId: 'sel_1',
        totalAmountPaise: 8_000,
        packetCount: 10,
        status: 'PENDING_APPROVAL',
        paymentMode: 'PENDING',
        createdAt: '2026-11-27T05:40:00.000Z',
      },
    ];

    const incentives: SellerIncentiveData = {
      currentMonthEarnedPaise: 15_000,
      totalPacketsSoldMonth: 25,
      ratePerPacketPaise: 200,
      pendingPayoutPaise: 12_000,
      totalPaidPaise: 3_000,
      adjustedEntitlementPaise: 15_000,
      summary: {
        salesIncentivePaise: 10_000,
        additionsPaise: 5_000,
        deductionsPaise: 0,
        adjustedEntitlementPaise: 15_000,
        totalPaidPaise: 3_000,
        outstandingPaise: 12_000,
      },
      adjustments: [
        {
          id: 'adj_1',
          type: 'ADD',
          amountPaise: 5_000,
          reason: 'Daily Target Bonus',
          adjustmentDate: '2026-11-27T06:00:00.000Z',
        },
      ],
    };

    const report = composeFallbackSellerReport({
      shifts,
      sales,
      incentives,
      fromDateKey: '2026-11-27',
      toDateKey: '2026-11-27',
      now,
    });

    assert.equal(report.summary.activeDays, 1);
    assert.equal(report.summary.shopsVisited, 2);
    assert.equal(report.summary.salesDoneVisits, 1);
    assert.equal(report.summary.conversionRatePercent, 50);
    assert.equal(report.summary.totalDistanceKm, 24);
    assert.equal(report.summary.totalPacketsSold, 25);
    assert.equal(report.summary.totalSalesPaise, 25_000);
    assert.equal(report.summary.cashPaise, 25_000);
    assert.equal(report.summary.pendingOrdersCount, 1);
    assert.equal(report.summary.baseCommissionPaise, 5_000);
    assert.equal(report.summary.additionsPaise, 5_000);
    assert.equal(report.summary.netIncentivePaise, 10_000);
    assert.equal(report.incentiveOverview.outstandingPaise, 12_000);
    assert.equal(report.dailyRecords.length, 1);
    assert.equal(report.dailyRecords[0].visits.length, 2);
    assert.equal(report.dailyRecords[0].sales.length, 2);
  });

  it('wires Seller Reports screen, API, mock endpoint, and Seller portal navigation links', () => {
    const reportScreen = readSource('src/app/(seller)/reports/index.tsx');
    assert.match(reportScreen, /useDashboardBackHandler\(['"]\/\(seller\)['"]\)/);
    assert.match(reportScreen, /OVERALL SUMMARY/);
    assert.match(reportScreen, /INCENTIVE & TARGET/);
    assert.match(reportScreen, /DAILY RECORD/);
    assert.match(reportScreen, /AttendanceFilterButton/);
    assert.match(reportScreen, /DateRangeFilterModal/);
    assert.doesNotMatch(reportScreen, /filterPillsScroll/);

    const dateFilterModal = readSource('src/components/common/DateRangeFilterModal.tsx');
    assert.match(dateFilterModal, /buildCalendarMonthCells/);

    const sellerSalesScreen = readSource('src/app/(seller)/sales/index.tsx');
    assert.doesNotMatch(sellerSalesScreen, /All Retail Customers/);
    assert.doesNotMatch(sellerSalesScreen, /Retail Customer Account/);
    assert.match(sellerSalesScreen, /DateRangeFilterModal/);

    const managerSalesScreen = readSource('src/app/(manager)/sales/index.tsx');
    assert.match(managerSalesScreen, /DateRangeFilterModal/);
    assert.doesNotMatch(managerSalesScreen, /All Retail Customers/);

    const adminFilterModal = readSource('src/components/sales/AdminSalesFilterModal.tsx');
    assert.match(adminFilterModal, /ADMIN_DATE_FILTER_PRESETS/);
    assert.match(adminFilterModal, /Date Range/);
    assert.match(adminFilterModal, /buildCalendarMonthCells/);

    const adminReportsScreen = readSource('src/app/(admin)/reports/index.tsx');
    assert.match(adminReportsScreen, /AttendanceFilterButton/);
    assert.match(adminReportsScreen, /DateRangeFilterModal/);
    assert.match(adminReportsScreen, /ADMIN_DATE_FILTER_PRESETS/);

    const adminDashboardScreen = readSource('src/app/(admin)/index.tsx');
    assert.match(adminDashboardScreen, /AttendanceFilterButton/);
    assert.match(adminDashboardScreen, /All Time/);

    const sellerIncentivesScreen = readSource('src/app/(seller)/incentives/index.tsx');
    assert.match(sellerIncentivesScreen, /Sales Target/);
    assert.match(sellerIncentivesScreen, /SegmentedTabs/);
    assert.doesNotMatch(sellerIncentivesScreen, /Incentive Policy & Rate Protection/);

    const sellerLayout = readSource('src/app/(seller)/_layout.tsx');
    assert.match(sellerLayout, /name="reports\/index"/);

    const drawer = readSource('src/components/common/MobileNavigationDrawer.tsx');
    assert.match(drawer, /route:\s*'\/\(seller\)\/reports'/);

    const sellerHome = readSource('src/app/(seller)/index.tsx');
    assert.match(sellerHome, /\/\(seller\)\/reports/);

    const sellerProfile = readSource('src/app/(seller)/profile/index.tsx');
    assert.match(sellerProfile, /\/\(seller\)\/reports/);

    const sellerApiSource = readSource('src/api/seller.ts');
    assert.match(sellerApiSource, /async getReport\(/);
    assert.match(sellerApiSource, /apiRequest<SellerReportData>\('seller\/reports'/);

    const mockService = readSource('src/api/mockService.ts');
    assert.match(mockService, /cleanEndpoint === 'seller\/reports'/);
  });
});
