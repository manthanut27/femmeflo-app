import type {
  SaleItem,
  SellerIncentiveData,
  SellerReportDailyAdjustmentItem,
  SellerReportDailyRecord,
  SellerReportData,
  SellerReportPreset,
  Shift,
} from '../api/types.ts';
import { getISTDateKey, getISTDateParts } from './dateUtils.ts';
import {
  buildShiftWaypoints,
  calculateWaypointRouteKm,
  computeShiftTravelDistance,
} from './distanceUtils.ts';
import {
  formatDateKey,
  getShiftDurationSeconds,
  istDateKeyToIsoBounds,
  subtractDaysFromDateKey,
} from './shiftFilterUtils.ts';

const CONFIRMED_STATUSES = new Set(['CONFIRMED', 'COMPLETED']);

export interface SellerReportFilterSelection {
  preset: SellerReportPreset;
  customFromDateKey?: string;
  customToDateKey?: string;
}

export interface SellerReportDateRange {
  fromDateKey?: string;
  toDateKey?: string;
  fromIso?: string;
  toIso?: string;
  label: string;
  subtitle: string;
}

export const SELLER_REPORT_PRESETS: Array<{
  id: SellerReportPreset;
  label: string;
  shortLabel: string;
}> = [
  { id: 'today', label: 'Today', shortLabel: 'Day' },
  { id: 'week', label: 'This Week', shortLabel: 'Week' },
  { id: 'weekend', label: 'Weekend', shortLabel: 'Weekend' },
  { id: 'month', label: 'This Month', shortLabel: 'Month' },
  { id: 'all', label: 'All Time', shortLabel: 'All' },
  { id: 'custom_range', label: 'Date Range', shortLabel: 'Range' },
];

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatShortDateKey(dateKey: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return dateKey;
  const year = match[1];
  const monthIdx = Math.max(0, Math.min(11, Number(match[2]) - 1));
  const day = Number(match[3]);
  return `${day} ${SHORT_MONTHS[monthIdx]} ${year}`;
}

export function getSellerReportDateRange(
  selection: SellerReportFilterSelection,
  referenceDate: Date = new Date()
): SellerReportDateRange {
  if (selection.preset === 'all') {
    return {
      label: 'All Time',
      subtitle: 'Complete recorded history',
    };
  }

  const parts = getISTDateParts(referenceDate);
  const todayKey = formatDateKey(parts.year, parts.month, parts.day);
  const weekday = new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();

  let fromDateKey = todayKey;
  let toDateKey = todayKey;
  let label = 'Today';

  if (selection.preset === 'today') {
    fromDateKey = todayKey;
    toDateKey = todayKey;
    label = 'Today';
  } else if (selection.preset === 'week') {
    const daysSinceMonday = weekday === 0 ? 6 : weekday - 1;
    fromDateKey = subtractDaysFromDateKey(parts.year, parts.month, parts.day, daysSinceMonday);
    toDateKey = todayKey;
    label = 'This Week';
  } else if (selection.preset === 'weekend') {
    if (weekday === 6) {
      fromDateKey = todayKey;
      toDateKey = todayKey;
    } else if (weekday === 0) {
      fromDateKey = subtractDaysFromDateKey(parts.year, parts.month, parts.day, 1);
      toDateKey = todayKey;
    } else {
      // Previous Sat-Sun in IST
      fromDateKey = subtractDaysFromDateKey(parts.year, parts.month, parts.day, weekday + 1);
      toDateKey = subtractDaysFromDateKey(parts.year, parts.month, parts.day, weekday);
    }
    label = 'Weekend';
  } else if (selection.preset === 'month') {
    fromDateKey = formatDateKey(parts.year, parts.month, 1);
    toDateKey = todayKey;
    label = 'This Month';
  } else if (selection.preset === 'custom_range') {
    const rawA = selection.customFromDateKey || selection.customToDateKey || todayKey;
    const rawB = selection.customToDateKey || selection.customFromDateKey || todayKey;
    if (rawA <= rawB) {
      fromDateKey = rawA;
      toDateKey = rawB;
    } else {
      fromDateKey = rawB;
      toDateKey = rawA;
    }
    label = fromDateKey === toDateKey ? formatShortDateKey(fromDateKey) : 'Date Range';
  }

  const fromBounds = istDateKeyToIsoBounds(fromDateKey);
  const toBounds = istDateKeyToIsoBounds(toDateKey);
  const subtitle =
    fromDateKey === toDateKey
      ? formatShortDateKey(fromDateKey)
      : `${formatShortDateKey(fromDateKey)} – ${formatShortDateKey(toDateKey)}`;

  return {
    fromDateKey,
    toDateKey,
    fromIso: fromBounds?.startIso,
    toIso: toBounds?.endIso,
    label,
    subtitle,
  };
}

export function formatReportDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds || 0));
  if (safe === 0) return '0m';
  const totalMins = Math.floor(safe / 60);
  if (totalMins < 60) {
    return `${Math.max(1, totalMins)}m`;
  }
  const hours = Math.floor(totalMins / 60);
  const mins = totalMins % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function isDateKeyInRange(dateKey: string, fromDateKey?: string, toDateKey?: string): boolean {
  if (fromDateKey && dateKey < fromDateKey) return false;
  if (toDateKey && dateKey > toDateKey) return false;
  return true;
}

function roundKm(val: number): number {
  return Math.round(val * 10) / 10;
}

function computeClientShiftKm(shift: Shift): number {
  const storedOrOdom = computeShiftTravelDistance(shift);
  if (storedOrOdom.distanceKm > 0) {
    return storedOrOdom.distanceKm;
  }
  const waypoints = buildShiftWaypoints(shift);
  return waypoints.length >= 2 ? calculateWaypointRouteKm(waypoints) : 0;
}

export function composeFallbackSellerReport(params: {
  shifts: Shift[];
  sales: SaleItem[];
  incentives?: SellerIncentiveData | null;
  fromDateKey?: string;
  toDateKey?: string;
  now?: Date;
}): SellerReportData {
  const now = params.now ?? new Date();
  const nowMs = now.getTime();
  const ratePerPacketPaise =
    Number(
      params.incentives?.effectiveRatePaise ??
        params.incentives?.ratePerPacketPaise ??
        params.incentives?.summary?.effectiveRatePaise ??
        100
    ) || 100;

  const dayMap = new Map<
    string,
    {
      record: SellerReportDailyRecord;
      shopKeys: Set<string>;
    }
  >();

  const ensureDay = (dateKey: string) => {
    let entry = dayMap.get(dateKey);
    if (!entry) {
      entry = {
        record: {
          date: dateKey,
          shiftsCount: 0,
          activeShiftsCount: 0,
          shopsVisited: 0,
          uniqueShopsVisited: 0,
          salesDoneVisits: 0,
          travelKm: 0,
          durationSeconds: 0,
          ordersCount: 0,
          confirmedOrdersCount: 0,
          pendingOrdersCount: 0,
          rejectedOrdersCount: 0,
          packetsSold: 0,
          salesPaise: 0,
          cashPaise: 0,
          bankPaise: 0,
          pendingPaise: 0,
          baseCommissionPaise: 0,
          additionsPaise: 0,
          deductionsPaise: 0,
          netIncentivePaise: 0,
          visits: [],
          sales: [],
          adjustments: [],
        },
        shopKeys: new Set<string>(),
      };
      dayMap.set(dateKey, entry);
    }
    return entry;
  };

  let shiftsCount = 0;
  let activeShiftsCount = 0;
  let completedShiftsCount = 0;
  let totalTravelKm = 0;
  let totalDurationSeconds = 0;
  let totalShopsVisited = 0;
  let totalSalesDoneVisits = 0;
  const overallShopKeys = new Set<string>();

  for (const shift of params.shifts) {
    const startValue = shift.startTime || shift.startedAt;
    if (!startValue) continue;
    const dateKey = getISTDateKey(startValue);
    if (!isDateKeyInRange(dateKey, params.fromDateKey, params.toDateKey)) continue;

    const dayEntry = ensureDay(dateKey);
    const shiftKm = computeClientShiftKm(shift);
    const shiftSec = getShiftDurationSeconds(shift, nowMs);

    shiftsCount += 1;
    if (shift.status === 'ACTIVE' || shift.status === 'OPEN') {
      activeShiftsCount += 1;
      dayEntry.record.activeShiftsCount += 1;
    } else if (shift.status === 'COMPLETED' || shift.status === 'CLOSED') {
      completedShiftsCount += 1;
    }

    totalTravelKm += shiftKm;
    totalDurationSeconds += shiftSec;
    dayEntry.record.shiftsCount += 1;
    dayEntry.record.travelKm += shiftKm;
    dayEntry.record.durationSeconds += shiftSec;

    for (const visit of shift.visits || []) {
      totalShopsVisited += 1;
      dayEntry.record.shopsVisited += 1;

      const resolvedShopName = visit.customer?.shopName || visit.shopName || 'Visited Shop';
      const shopIdentity =
        visit.customer?.id || visit.customerId || resolvedShopName.trim().toLowerCase();
      overallShopKeys.add(shopIdentity);
      dayEntry.shopKeys.add(shopIdentity);

      const saleDone = Boolean(visit.saleDone || visit.orderPlaced || visit.saleId || visit.sale);
      if (saleDone) {
        totalSalesDoneVisits += 1;
        dayEntry.record.salesDoneVisits += 1;
      }

      dayEntry.record.visits.push({
        id: visit.id,
        shiftId: shift.id,
        shopName: resolvedShopName,
        customerId: visit.customer?.id ?? visit.customerId ?? null,
        checkInTime: visit.checkInTime,
        checkOutTime: visit.checkOutTime ?? null,
        durationMins: visit.durationMins ?? null,
        saleDone,
        saleId: visit.saleId ?? visit.sale?.id ?? null,
        saleTotalPaise: visit.sale?.totalPaise ?? null,
        saleQuantity: visit.sale?.quantity ?? null,
        notes: visit.notes ?? visit.summary ?? null,
      });
    }
  }

  let ordersCount = 0;
  let confirmedOrdersCount = 0;
  let pendingOrdersCount = 0;
  let rejectedOrdersCount = 0;
  let totalPacketsSold = 0;
  let totalSalesPaise = 0;
  let cashPaise = 0;
  let bankPaise = 0;
  let pendingPaise = 0;
  let baseCommissionPaise = 0;

  for (const sale of params.sales) {
    const dateKey = getISTDateKey(sale.createdAt);
    if (!isDateKeyInRange(dateKey, params.fromDateKey, params.toDateKey)) continue;

    const dayEntry = ensureDay(dateKey);
    const qty = Number(sale.quantity ?? sale.packetCount ?? 0);
    const saleTotal = Number(sale.totalPaise ?? sale.totalAmountPaise ?? 0);
    const isConfirmed = CONFIRMED_STATUSES.has(sale.status);
    const saleRate = Number((sale as any).incentiveRatePaise ?? ratePerPacketPaise);
    const commissionPaise = isConfirmed
      ? Number((sale as any).incentiveAmountPaise ?? qty * saleRate)
      : 0;

    ordersCount += 1;
    dayEntry.record.ordersCount += 1;

    if (isConfirmed) {
      confirmedOrdersCount += 1;
      totalPacketsSold += qty;
      totalSalesPaise += saleTotal;
      baseCommissionPaise += commissionPaise;

      dayEntry.record.confirmedOrdersCount += 1;
      dayEntry.record.packetsSold += qty;
      dayEntry.record.salesPaise += saleTotal;
      dayEntry.record.baseCommissionPaise += commissionPaise;

      if (sale.paymentMode === 'CASH') {
        cashPaise += saleTotal;
        dayEntry.record.cashPaise += saleTotal;
      } else if (sale.paymentMode === 'BANK') {
        bankPaise += saleTotal;
        dayEntry.record.bankPaise += saleTotal;
      } else {
        pendingPaise += saleTotal;
        dayEntry.record.pendingPaise += saleTotal;
      }
    } else if (sale.status === 'PENDING_APPROVAL') {
      pendingOrdersCount += 1;
      dayEntry.record.pendingOrdersCount += 1;
    } else if (sale.status === 'REJECTED') {
      rejectedOrdersCount += 1;
      dayEntry.record.rejectedOrdersCount += 1;
    }

    dayEntry.record.sales.push({
      id: sale.id,
      shopName: sale.customer?.shopName || 'Retail Shop',
      customerId: sale.customerId,
      quantity: qty,
      unitPricePaise: Number(sale.unitPricePaise ?? (qty > 0 ? Math.round(saleTotal / qty) : 0)),
      totalPaise: saleTotal,
      paymentMode: sale.paymentMode,
      status: sale.status,
      incentivePaise: commissionPaise,
      createdAt: sale.createdAt,
    });
  }

  const rawAdjustments: Array<SellerReportDailyAdjustmentItem & { createdAt?: string }> =
    Array.isArray(params.incentives?.adjustments) ? params.incentives.adjustments : [];

  let additionsPaise = 0;
  let deductionsPaise = 0;

  for (const adj of rawAdjustments) {
    const adjDate = adj.adjustmentDate || adj.createdAt;
    if (!adjDate) continue;
    const dateKey = getISTDateKey(adjDate);
    if (!isDateKeyInRange(dateKey, params.fromDateKey, params.toDateKey)) continue;

    const dayEntry = ensureDay(dateKey);
    const amount = Number(adj.amountPaise || 0);
    if (adj.type === 'ADD') {
      additionsPaise += amount;
      dayEntry.record.additionsPaise += amount;
    } else {
      deductionsPaise += amount;
      dayEntry.record.deductionsPaise += amount;
    }

    dayEntry.record.adjustments.push({
      id: adj.id,
      type: adj.type,
      amountPaise: amount,
      reason: adj.reason,
      adjustmentDate: adjDate,
    });
  }

  const dailyRecords = Array.from(dayMap.values())
    .map(({ record, shopKeys }) => {
      record.uniqueShopsVisited = shopKeys.size;
      record.travelKm = roundKm(record.travelKm);
      record.netIncentivePaise = Math.max(
        0,
        record.baseCommissionPaise + record.additionsPaise - record.deductionsPaise
      );
      record.visits.sort(
        (a, b) => new Date(a.checkInTime).getTime() - new Date(b.checkInTime).getTime()
      );
      record.sales.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return record;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const incentiveSummary = params.incentives?.summary || params.incentives;
  const lifetimeSalesIncentivePaise = Number(
    incentiveSummary?.salesIncentivePaise ??
      incentiveSummary?.adjustedEntitlementPaise ??
      params.incentives?.currentMonthEarnedPaise ??
      baseCommissionPaise
  );
  const lifetimeAdditionsPaise = Number(incentiveSummary?.additionsPaise ?? additionsPaise);
  const lifetimeDeductionsPaise = Number(incentiveSummary?.deductionsPaise ?? deductionsPaise);
  const lifetimeEarnedPaise = Number(
    params.incentives?.adjustedEntitlementPaise ??
      incentiveSummary?.adjustedEntitlementPaise ??
      params.incentives?.totalEarnedPaise ??
      lifetimeSalesIncentivePaise + lifetimeAdditionsPaise - lifetimeDeductionsPaise
  );
  const lifetimePaidPaise = Number(
    params.incentives?.totalPaidPaise ?? incentiveSummary?.totalPaidPaise ?? 0
  );
  const lifetimeOutstandingPaise = Number(
    params.incentives?.pendingPayoutPaise ??
      incentiveSummary?.outstandingPaise ??
      Math.max(0, lifetimeEarnedPaise - lifetimePaidPaise)
  );

  return {
    range: {
      from: params.fromDateKey ?? null,
      to: params.toDateKey ?? null,
    },
    ratePerPacketPaise,
    summary: {
      activeDays: dailyRecords.length,
      shiftsCount,
      activeShiftsCount,
      completedShiftsCount,
      shopsVisited: totalShopsVisited,
      uniqueShopsVisited: overallShopKeys.size,
      salesDoneVisits: totalSalesDoneVisits,
      conversionRatePercent:
        totalShopsVisited > 0
          ? Math.round((totalSalesDoneVisits / totalShopsVisited) * 100)
          : 0,
      totalDistanceKm: roundKm(totalTravelKm),
      totalDurationSeconds,
      ordersCount,
      confirmedOrdersCount,
      pendingOrdersCount,
      rejectedOrdersCount,
      totalPacketsSold,
      totalSalesPaise,
      cashPaise,
      bankPaise,
      pendingPaise,
      baseCommissionPaise,
      additionsPaise,
      deductionsPaise,
      netIncentivePaise: Math.max(0, baseCommissionPaise + additionsPaise - deductionsPaise),
    },
    incentiveOverview: {
      ratePerPacketPaise,
      salesIncentivePaise: lifetimeSalesIncentivePaise,
      additionsPaise: lifetimeAdditionsPaise,
      deductionsPaise: lifetimeDeductionsPaise,
      totalEarnedPaise: lifetimeEarnedPaise,
      totalPaidPaise: lifetimePaidPaise,
      outstandingPaise: lifetimeOutstandingPaise,
      status:
        params.incentives?.status ||
        (lifetimePaidPaise > 0 && lifetimeOutstandingPaise <= 0
          ? 'PAID'
          : lifetimePaidPaise > 0
            ? 'PARTIALLY_PAID'
            : 'UNPAID'),
    },
    targetProgress: params.incentives?.targetProgress ?? null,
    dailyRecords,
  };
}
