/**
 * Date and Time utilities explicitly anchored to Asia/Kolkata (IST, UTC+5:30).
 */

const IST_TIMEZONE = 'Asia/Kolkata';

export function parseDate(dateInput: string | number | Date | null | undefined): Date | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  return isNaN(d.getTime()) ? null : d;
}

export function formatDateIST(
  dateInput: string | number | Date | null | undefined,
  formatStyle: 'short' | 'medium' | 'long' = 'medium'
): string {
  const d = parseDate(dateInput);
  if (!d) return '—';

  const dateStyleMap: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: 'numeric', month: 'short', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
  };

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    ...dateStyleMap[formatStyle],
  }).format(d);
}

export function formatTimeIST(
  dateInput: string | number | Date | null | undefined,
  includeSeconds = false
): string {
  const d = parseDate(dateInput);
  if (!d) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    second: includeSeconds ? '2-digit' : undefined,
    hour12: true,
  }).format(d);
}

export function formatDateTimeIST(
  dateInput: string | number | Date | null | undefined
): string {
  const d = parseDate(dateInput);
  if (!d) return '—';

  return new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(d);
}

export function isTodayIST(dateInput: string | number | Date | null | undefined): boolean {
  const d = parseDate(dateInput);
  if (!d) return false;

  const now = new Date();
  const todayParts = getISTDateParts(now);
  const targetParts = getISTDateParts(d);

  return (
    todayParts.year === targetParts.year &&
    todayParts.month === targetParts.month &&
    todayParts.day === targetParts.day
  );
}

export function getISTDateParts(dateInput: string | number | Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const d = parseDate(dateInput) || new Date();
  const formatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: IST_TIMEZONE,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(d);
  const getPart = (type: string) => {
    const p = parts.find((pt) => pt.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  return {
    year: getPart('year'),
    month: getPart('month'),
    day: getPart('day'),
    hour: getPart('hour'),
    minute: getPart('minute'),
    second: getPart('second'),
  };
}

export function formatCurrencyINR(paise: number = 0): string {
  const rupees = Math.round(paise) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
    minimumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees);
}

export function getISTDateKey(dateInput: string | number | Date = new Date()): string {
  const parts = getISTDateParts(dateInput);
  const mm = String(parts.month).padStart(2, '0');
  const dd = String(parts.day).padStart(2, '0');
  return `${parts.year}-${mm}-${dd}`;
}

export interface DailyReportGroup<T = any> {
  dateKey: string;
  dayLabel: string;
  formattedDate: string;
  isToday: boolean;
  isYesterday: boolean;
  totalPackets: number;
  totalPaise: number;
  salesCount: number;
  officerNames: string[];
  cashPaise: number;
  bankPaise: number;
  pendingPaise: number;
  confirmedCount: number;
  pendingCount: number;
  rejectedCount: number;
  sales: T[];
}

export function groupSalesByDay<T extends { createdAt?: string; requestedAt?: string; quantity?: number; totalAmountPaise?: number; totalPaise?: number; paymentMode?: string; status?: string; seller?: { name?: string } | null }>(
  salesList: T[]
): DailyReportGroup<T>[] {
  const map: Record<string, DailyReportGroup<T>> = {};
  const todayKey = getISTDateKey(new Date());

  const yest = new Date();
  yest.setDate(yest.getDate() - 1);
  const yesterdayKey = getISTDateKey(yest);

  for (const s of salesList) {
    const raw = s.createdAt || s.requestedAt;
    const dateKey = raw ? getISTDateKey(raw) : todayKey;

    if (!map[dateKey]) {
      const isToday = dateKey === todayKey;
      const isYesterday = dateKey === yesterdayKey;
      let dayLabel = formatDateIST(raw || new Date(), 'medium');
      if (isToday) dayLabel = 'Today';
      else if (isYesterday) dayLabel = 'Yesterday';

      map[dateKey] = {
        dateKey,
        dayLabel,
        formattedDate: formatDateIST(raw || new Date(), 'medium'),
        isToday,
        isYesterday,
        totalPackets: 0,
        totalPaise: 0,
        salesCount: 0,
        officerNames: [],
        cashPaise: 0,
        bankPaise: 0,
        pendingPaise: 0,
        confirmedCount: 0,
        pendingCount: 0,
        rejectedCount: 0,
        sales: [],
      };
    }

    const group = map[dateKey]!;
    const q = s.quantity || 0;
    const total = s.totalAmountPaise ?? s.totalPaise ?? 0;

    group.salesCount += 1;
    group.totalPackets += q;
    group.totalPaise += total;

    if (s.seller?.name && !group.officerNames.includes(s.seller.name)) {
      group.officerNames.push(s.seller.name);
    }

    if (s.paymentMode === 'CASH') group.cashPaise += total;
    else if (s.paymentMode === 'BANK') group.bankPaise += total;
    else if (s.paymentMode === 'PENDING') group.pendingPaise += total;

    if (s.status === 'CONFIRMED') group.confirmedCount += 1;
    else if (s.status === 'PENDING_APPROVAL' || s.status === 'PENDING') group.pendingCount += 1;
    else if (s.status === 'REJECTED') group.rejectedCount += 1;

    group.sales.push(s);
  }

  // Sort groups descending by dateKey
  return Object.values(map).sort((a, b) => b.dateKey.localeCompare(a.dateKey));
}

export function getISTDateRangeFilter(period: 'all' | 'today' | 'week' | 'month'): { from?: string; to?: string } {
  const now = new Date();
  const todayKey = getISTDateKey(now);
  if (period === 'today') {
    return { from: todayKey, to: todayKey };
  }
  if (period === 'week') {
    const d = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    return { from: getISTDateKey(d), to: todayKey };
  }
  if (period === 'month') {
    const parts = getISTDateParts(now);
    const mm = String(parts.month).padStart(2, '0');
    const firstDayKey = `${parts.year}-${mm}-01`;
    return { from: firstDayKey, to: todayKey };
  }
  return {};
}

